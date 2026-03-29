// backend/src/services/moz.service.ts

import { prisma } from "../lib/prisma.js";

const MOZ_BASE = "https://lsapi.seomoz.com/v2";

interface MozRequestOpts {
  endpoint: string;
  body: Record<string, any>;
}

export class MozService {
  private token: string;

  constructor() {
    this.token = process.env.MOZ_API_TOKEN || "";
    if (!this.token) {
      console.warn("[Moz] MOZ_API_TOKEN not set — Moz integration disabled");
    }
  }

  private async request<T = any>(opts: MozRequestOpts): Promise<T> {
    if (!this.token) throw new Error("MOZ_API_TOKEN not configured");

    const url = `${MOZ_BASE}/${opts.endpoint}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-moz-token": this.token,
      },
      body: JSON.stringify(opts.body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Moz API ${opts.endpoint} failed: ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ─── URL METRICS (DA, PA, Spam Score) ──────────────────────
  async getUrlMetrics(targets: string[]): Promise<any[]> {
    // Max 50 targets per call
    const chunks: string[][] = [];
    for (let i = 0; i < targets.length; i += 50) {
      chunks.push(targets.slice(i, i + 50));
    }

    const allResults: any[] = [];
    for (const chunk of chunks) {
      const data = await this.request({
        endpoint: "url_metrics",
        body: { targets: chunk },
      });
      allResults.push(...(data.results || []));
      // Rate limit between chunks
      if (chunks.length > 1) await this.sleep(1000);
    }

    return allResults;
  }

  // ─── LINKING ROOT DOMAINS ──────────────────────────────────
  async getLinkingRootDomains(
    target: string,
    limit = 50,
    sort = "source_domain_authority",
  ): Promise<any> {
    return this.request({
      endpoint: "linking_root_domains",
      body: {
        target,
        target_scope: "root_domain",
        filter: "external",
        sort,
        limit,
      },
    });
  }

  // ─── LINKS (individual backlinks) ──────────────────────────
  async getLinks(
    target: string,
    limit = 50,
    sort = "source_domain_authority",
  ): Promise<any> {
    return this.request({
      endpoint: "links",
      body: {
        target,
        target_scope: "root_domain",
        filter: "external",
        sort,
        limit,
      },
    });
  }

  // ─── ANCHOR TEXT ───────────────────────────────────────────
  async getAnchorText(target: string, limit = 50): Promise<any> {
    return this.request({
      endpoint: "anchor_text",
      body: {
        target,
        scope: "root_domain",
        limit,
      },
    });
  }

  // ─── SYNC DOMAIN METRICS (DA/PA/Spam) ─────────────────────
  async syncDomainMetrics(domainId: string) {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    // Cooldown — don't re-sync within 1 hour
    if (
      domain.mozLastSync &&
      Date.now() - new Date(domain.mozLastSync).getTime() < 3600000
    ) {
      return {
        skipped: true,
        reason: "Synced less than 1h ago",
        lastSync: domain.mozLastSync,
      };
    }

    const target = domain.domain.replace(/^www\./, "");

    const metrics = await this.getUrlMetrics([target]);
    if (!metrics.length) return { error: "No metrics returned" };

    const m = metrics[0];

    await prisma.domain.update({
      where: { id: domainId },
      data: {
        mozDA: m.domain_authority || null,
        mozPA: m.page_authority || null,
        mozSpamScore: m.spam_score || null,
        mozLinks:
          m.external_pages_to_root_domain || m.pages_to_root_domain || null,
        mozDomains: m.root_domains_to_root_domain || null,
        mozLastSync: new Date(),
      },
    });

    // Log API usage
    await this.logApiCall("url_metrics", 1);

    return {
      domain: target,
      da: m.domain_authority,
      pa: m.page_authority,
      spamScore: m.spam_score,
      externalLinks: m.external_pages_to_root_domain,
      linkingDomains: m.root_domains_to_root_domain,
    };
  }

  // ─── SYNC EXTERNAL BACKLINKS ──────────────────────────────
  async syncExternalBacklinks(domainId: string, force = false) {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    if (!force) {
      // Only check cooldown when not forced
      const lastMozBacklink = await prisma.backlinkSnapshot.findFirst({
        where: { domainId, source: "MOZ" },
        orderBy: { lastChecked: "desc" },
      });
      if (
        lastMozBacklink &&
        Date.now() - new Date(lastMozBacklink.lastChecked).getTime() < 3600000
      ) {
        return { skipped: true, reason: "Backlinks synced less than 1h ago" };
      }
      if (
        domain.mozLastSync &&
        Date.now() - new Date(domain.mozLastSync).getTime() < 3600000
      ) {
        return { skipped: true, reason: "Domain synced less than 1h ago" };
      }
    }

    const target = domain.domain.replace(/^www\./, "");
    console.log(`[Moz] Syncing backlinks for ${target} (force=${force})`);

    let newLinks = 0;
    let updatedLinks = 0;
    let totalRows = 0;
    const now = new Date();

    const linksData = await this.getLinks(target, 50);
    const links = linksData.results || [];
    totalRows += links.length;
    console.log(`[Moz] Got ${links.length} links from API for ${target}`);
    if (links.length > 0) {
      console.log(`[Moz] Sample link:`, JSON.stringify(links[0]));
    }

    for (const link of links) {
      const sourceUrl = link.source?.page ? `https://${link.source.page}` : "";
      const sourceDomain =
        link.source?.root_domain || link.source?.subdomain || "";
      const targetPage_ = link.target?.page
        ? `https://${link.target.page}`
        : "";
      const anchorText = link.anchor_text || null;
      const isDofollow = !link.nofollow;

      if (!sourceUrl || !sourceDomain) continue;

      let fullTargetUrl = targetPage_ || `https://${domain.domain}/`;

      // Try to match target page in our DB
      let targetPath: string;
      try {
        targetPath = new URL(fullTargetUrl).pathname;
      } catch {
        targetPath = "/";
      }
      const targetPage = await prisma.page.findFirst({
        where: { domainId, path: targetPath },
      });

      // Upsert backlink
      const existing = await prisma.backlinkSnapshot.findFirst({
        where: {
          domainId,
          sourceUrl,
          targetUrl: fullTargetUrl,
        },
      });

      if (existing) {
        await prisma.backlinkSnapshot.update({
          where: { id: existing.id },
          data: {
            lastSeen: now,
            lastChecked: now,
            isLive: true,
            lostAt: null,
            anchorText: anchorText || existing.anchorText,
            isDofollow,
            mozSourceDA: link.source?.domain_authority || null,
            mozSourcePA: link.source?.page_authority || null,
            mozSourceSpam:
              link.source?.spam_score != null ? link.source.spam_score : null,

            pageId: targetPage?.id || existing.pageId,
            source: "MOZ",
          },
        });
        updatedLinks++;
      } else {
        try {
          await prisma.backlinkSnapshot.create({
            data: {
              domainId,
              pageId: targetPage?.id || null,
              targetUrl: fullTargetUrl,
              sourceUrl,
              sourceDomain,
              anchorText,
              isDofollow,
              isLive: true,
              firstSeen: now,
              lastSeen: now,
              lastChecked: now,
              mozSourceDA: link.source?.domain_authority || null,
              mozSourcePA: link.source?.page_authority || null,
              mozSourceSpam: link.source?.spam_score || null,
              source: "MOZ",
            },
          });

          // Create SEO event for new backlink
          await prisma.seoEvent.create({
            data: {
              domainId,
              pageId: targetPage?.id,
              type: "BACKLINK_NEW",
              importance: 2,
              data: {
                sourceUrl,
                sourceDomain,
                targetUrl: fullTargetUrl,
                anchor: anchorText,
                da: link.source?.domain_authority,
                source: "moz",
              },
            },
          });

          newLinks++;
        } catch (e: any) {
          // Unique constraint violation — skip
          if (e.code === "P2002") continue;
          throw e;
        }
      }
    }

    // 3. Get anchor text distribution
    const anchorData = await this.getAnchorText(target, 20);
    totalRows += (anchorData.results || []).length;

    // Store anchor text distribution on domain
    const anchors = (anchorData.results || []).map((a: any) => ({
      text: a.anchor_text || "",
      externalPages: a.external_pages || 0,
      externalDomains: a.external_root_domains || 0,
    }));

    await prisma.domain.update({
      where: { id: domainId },
      data: {
        mozAnchors: anchors,
        mozLastSync: now,
      },
    });

    // Log API usage
    await this.logApiCall("sync_backlinks", totalRows);

    return {
      domain: target,
      newLinks,
      updatedLinks,
      totalApiRows: totalRows,
      anchors: anchors.length,
    };
  }

  // ─── SYNC ALL DOMAINS ─────────────────────────────────────
  async syncAllDomains() {
    const domains = await prisma.domain.findMany({
      where: { isActive: true },
    });

    const results = [];
    for (const d of domains) {
      try {
        const metrics = await this.syncDomainMetrics(d.id);
        await this.sleep(500);
        const backlinks = await this.syncExternalBacklinks(d.id);
        await this.sleep(1000);

        results.push({
          domainName: d.domain,
          status: "ok",
          metrics,
          backlinks,
        });
      } catch (e: any) {
        results.push({
          domainName: d.domain,
          status: "error",
          error: e.message,
        });
      }
    }

    return results;
  }

  // ─── GET MOZ DATA FOR FRONTEND ────────────────────────────
  async getDomainMozData(domainId: string) {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
      select: {
        id: true,
        domain: true,
        mozDA: true,
        mozPA: true,
        mozSpamScore: true,
        mozLinks: true,
        mozDomains: true,
        mozAnchors: true,
        mozLastSync: true,
      },
    });

    // Get Moz-sourced backlinks
    const backlinks = await prisma.backlinkSnapshot.findMany({
      where: { domainId, source: "MOZ" },
      orderBy: { mozSourceDA: { sort: "desc", nulls: "last" } },
      include: {
        page: { select: { path: true, clicks: true, position: true } },
      },
    });

    // Group by source domain
    const byDomain = new Map<string, typeof backlinks>();
    for (const bl of backlinks) {
      if (!byDomain.has(bl.sourceDomain)) byDomain.set(bl.sourceDomain, []);
      byDomain.get(bl.sourceDomain)!.push(bl);
    }

    return {
      ...domain,
      backlinks,
      byDomain: Array.from(byDomain.entries())
        .map(([dom, links]) => ({
          domain: dom,
          count: links.length,
          avgDA:
            links.reduce((s, l) => s + (l.mozSourceDA || 0), 0) / links.length,
          links,
        }))
        .sort((a, b) => b.avgDA - a.avgDA),
      stats: {
        total: backlinks.length,
        live: backlinks.filter((b) => b.isLive).length,
        lost: backlinks.filter((b) => !b.isLive).length,
        dofollow: backlinks.filter((b) => b.isDofollow).length,
        uniqueDomains: byDomain.size,
        avgSourceDA:
          backlinks.length > 0
            ? Math.round(
                backlinks.reduce((s, b) => s + (b.mozSourceDA || 0), 0) /
                  backlinks.length,
              )
            : 0,
      },
    };
  }

  // ─── HELPERS ──────────────────────────────────────────────
  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async logApiCall(feature: string, rows: number) {
    try {
      await prisma.apiLog.create({
        data: {
          feature: `moz_${feature}`,
          model: "moz-links-v2",
          endpoint: `v2/${feature}`,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          durationMs: 0,
          metadata: { rows },
        },
      });
    } catch {}
  }
}
