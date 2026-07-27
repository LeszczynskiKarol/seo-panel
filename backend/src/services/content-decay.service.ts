import { prisma } from "../lib/prisma.js";

const DAY = 86400000;

// GSC data arrives with ~2-3 day lag (gsc_pull backfills last 3 days),
// so all windows end at today-3 to avoid comparing against incomplete days.
const LAG_DAYS = 3;
const WINDOW_DAYS = 28;

// Suppress re-proposing after a human rejection
const REJECTED_COOLDOWN_DAYS = 90;

function daysAgo(n: number): Date {
  const d = new Date(Date.now() - n * DAY);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export class ContentDecayService {
  async generateAll() {
    const domains = await prisma.domain.findMany({
      where: { isActive: true, gscProperty: { not: null } },
    });

    const results = [];
    for (const domain of domains) {
      try {
        const r = await this.generateForDomain(domain.id);
        results.push({ domain: domain.domain, ...r });
      } catch (e: any) {
        results.push({ domain: domain.domain, error: e.message });
      }
    }
    return results;
  }

  async generateForDomain(domainId: string) {
    const refresh = await this.detectRefresh(domainId);
    const prune = await this.detectPrune(domainId);
    const newTopics = await this.detectNewTopics(domainId);
    return { refresh, prune, newTopics };
  }

  /**
   * REFRESH — pages whose clicks dropped ≥40% between two consecutive
   * 28-day windows, on a base of ≥10 clicks.
   */
  private async detectRefresh(domainId: string) {
    const recentFrom = daysAgo(LAG_DAYS + WINDOW_DAYS);
    const recentTo = daysAgo(LAG_DAYS);
    const prevFrom = daysAgo(LAG_DAYS + 2 * WINDOW_DAYS);

    const [recentRaw, prevRaw] = await Promise.all([
      prisma.gscPageDaily.groupBy({
        by: ["pageId"],
        where: { page: { domainId }, date: { gte: recentFrom, lt: recentTo } },
        _sum: { clicks: true, impressions: true },
        _avg: { position: true },
      }),
      prisma.gscPageDaily.groupBy({
        by: ["pageId"],
        where: { page: { domainId }, date: { gte: prevFrom, lt: recentFrom } },
        _sum: { clicks: true, impressions: true },
        _avg: { position: true },
      }),
    ]);

    const recentMap = new Map(recentRaw.map((r) => [r.pageId, r]));
    let created = 0;

    for (const prev of prevRaw) {
      const prevClicks = prev._sum.clicks || 0;
      if (prevClicks < 10) continue;

      const recent = recentMap.get(prev.pageId);
      const recentClicks = recent?._sum.clicks || 0;
      if (recentClicks > prevClicks * 0.6) continue;

      const page = await prisma.page.findUnique({
        where: { id: prev.pageId },
        select: { id: true, path: true, title: true, inSitemap: true },
      });
      if (!page || !page.inSitemap || page.path === "/") continue;

      if (await this.hasOpenOrRecentlyRejected(domainId, "REFRESH", page.id)) {
        continue;
      }

      const dropPct = Math.round((1 - recentClicks / prevClicks) * 100);
      const prevPos = prev._avg.position
        ? Math.round(prev._avg.position * 10) / 10
        : null;
      const recentPos = recent?._avg.position
        ? Math.round(recent._avg.position * 10) / 10
        : null;

      await prisma.contentRecommendation.create({
        data: {
          domainId,
          pageId: page.id,
          type: "REFRESH",
          reason:
            `Strona traci ruch: ${prevClicks} → ${recentClicks} kliknięć (−${dropPct}%) ` +
            `między dwoma kolejnymi oknami 28 dni` +
            (prevPos && recentPos && recentPos > prevPos
              ? `; średnia pozycja spadła z ${prevPos} na ${recentPos}`
              : "") +
            `. Odświeżenie treści może odzyskać kliknięcia.`,
          evidence: {
            windowDays: WINDOW_DAYS,
            prevClicks,
            recentClicks,
            prevImpressions: prev._sum.impressions || 0,
            recentImpressions: recent?._sum.impressions || 0,
            prevPosition: prevPos,
            recentPosition: recentPos,
          },
          score: prevClicks - recentClicks,
        },
      });
      created++;
    }

    return created;
  }

  /**
   * PRUNE — pages tracked for 90+ days with zero clicks and <50 impressions
   * over the last 90 days. Page.createdAt (first seen by sitemap_sync) is a
   * lower bound on content age. Proposal only; a human decides.
   */
  private async detectPrune(domainId: string, maxPerRun = 20) {
    const statsFrom = daysAgo(LAG_DAYS + 90);
    const statsTo = daysAgo(LAG_DAYS);

    const pages = await prisma.page.findMany({
      where: {
        domainId,
        inSitemap: true,
        path: { not: "/" },
        createdAt: { lt: daysAgo(90) },
      },
      select: { id: true, path: true, title: true, createdAt: true },
    });
    if (pages.length === 0) return 0;

    const sums = await prisma.gscPageDaily.groupBy({
      by: ["pageId"],
      where: {
        pageId: { in: pages.map((p) => p.id) },
        date: { gte: statsFrom, lt: statsTo },
      },
      _sum: { clicks: true, impressions: true },
    });
    const sumMap = new Map(sums.map((s) => [s.pageId, s]));

    // utility/system pages — never prune candidates
    const utilityPath =
      /^\/(regulamin|polityka|privacy|polityka-prywatnosci|kontakt|contact|o-nas|about|cennik|category|kategoria|tag|tags|author|page|search|szukaj|login|rejestracja|koszyk|cart|404)([\/.-]|$)/i;

    let created = 0;
    for (const page of pages) {
      if (created >= maxPerRun) break;
      if (utilityPath.test(page.path)) continue;

      const s = sumMap.get(page.id);
      const clicks90 = s?._sum.clicks || 0;
      const impressions90 = s?._sum.impressions || 0;
      if (clicks90 > 0 || impressions90 >= 50) continue;

      if (await this.hasOpenOrRecentlyRejected(domainId, "PRUNE", page.id)) {
        continue;
      }

      await prisma.contentRecommendation.create({
        data: {
          domainId,
          pageId: page.id,
          type: "PRUNE",
          reason:
            `Zero kliknięć i ${impressions90} wyświetleń przez ostatnie 90 dni, ` +
            `strona śledzona od ${page.createdAt.toISOString().split("T")[0]}. ` +
            `Kandydat do usunięcia, przekierowania lub scalenia z mocniejszą stroną.`,
          evidence: {
            windowDays: 90,
            clicks: clicks90,
            impressions: impressions90,
            trackedSince: page.createdAt.toISOString().split("T")[0],
          },
          score: 0,
        },
      });
      created++;
    }

    return created;
  }

  /**
   * NEW_TOPIC — queries with real demand (≥100 impressions/28d) where the
   * domain's best-ranking page sits beyond position 7: a dedicated article
   * can capture that traffic. Pulled live from GSC (query+page dimensions),
   * same pattern as AnalyticsService.getCannibalization.
   */
  private async detectNewTopics(domainId: string, maxPerRun = 10) {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
      select: { domain: true, gscProperty: true },
    });
    if (!domain.gscProperty) return 0;

    // skip navigational/brand queries, e.g. "smart-edu" for smart-edu.ai
    const brandFragment = domain.domain
      .replace(/^www\./, "")
      .split(".")[0]
      .toLowerCase();

    const { getSearchConsole } = await import("../lib/google-auth.js");
    const sc = await getSearchConsole();

    const endDate = daysAgo(LAG_DAYS).toISOString().split("T")[0];
    const startDate = daysAgo(LAG_DAYS + WINDOW_DAYS)
      .toISOString()
      .split("T")[0];

    const res = await sc.searchanalytics.query({
      siteUrl: domain.gscProperty,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query", "page"],
        rowLimit: 5000,
      },
    });

    type Agg = {
      clicks: number;
      impressions: number;
      weightedPos: number; // sum(position * impressions)
      bestPosition: number;
      bestPageUrl: string;
    };
    const byQuery = new Map<string, Agg>();

    for (const row of res.data.rows || []) {
      const query = (row.keys?.[0] || "").toLowerCase().trim();
      const pageUrl = row.keys?.[1] || "";
      const impressions = row.impressions || 0;
      if (!query || !impressions || query.includes(brandFragment)) continue;
      // junk queries: too short or no letters (e.g. ".", "1.5")
      if (query.length < 4 || !/[a-ząćęłńóśżź]/i.test(query)) continue;

      const agg = byQuery.get(query) || {
        clicks: 0,
        impressions: 0,
        weightedPos: 0,
        bestPosition: Infinity,
        bestPageUrl: pageUrl,
      };
      agg.clicks += row.clicks || 0;
      agg.impressions += impressions;
      agg.weightedPos += (row.position || 0) * impressions;
      if (row.position && row.position < agg.bestPosition) {
        agg.bestPosition = row.position;
        agg.bestPageUrl = pageUrl;
      }
      byQuery.set(query, agg);
    }

    const candidates = Array.from(byQuery.entries())
      .map(([query, agg]) => ({
        query,
        ...agg,
        avgPosition:
          agg.impressions > 0
            ? Math.round((agg.weightedPos / agg.impressions) * 10) / 10
            : null,
      }))
      .filter(
        (c) =>
          c.impressions >= 100 &&
          c.bestPosition > 7 &&
          c.bestPosition < 50 &&
          c.clicks < c.impressions * 0.02,
      )
      .sort((a, b) => b.impressions - a.impressions);

    let created = 0;
    for (const c of candidates) {
      if (created >= maxPerRun) break;

      const bestPath = this.toPath(c.bestPageUrl);

      // If the best page's slug already covers the query, a dedicated page
      // exists — a new article would cannibalize it. Quick-wins/REFRESH
      // handle strengthening existing pages.
      if (this.pathCoversQuery(bestPath, c.query)) continue;

      if (
        await this.hasOpenOrRecentlyRejected(domainId, "NEW_TOPIC", null, c.query)
      ) {
        continue;
      }

      await prisma.contentRecommendation.create({
        data: {
          domainId,
          type: "NEW_TOPIC",
          topic: c.query,
          reason:
            `Fraza „${c.query}": ${c.impressions} wyświetleń w 28 dni, ` +
            `ale najlepsza strona (${bestPath}) jest dopiero na pozycji ` +
            `${Math.round(c.bestPosition * 10) / 10} i zbiera ${c.clicks} kliknięć. ` +
            `Dedykowany artykuł może przejąć ten popyt.`,
          evidence: {
            windowDays: WINDOW_DAYS,
            impressions: c.impressions,
            clicks: c.clicks,
            bestPosition: Math.round(c.bestPosition * 10) / 10,
            avgPosition: c.avgPosition,
            bestPagePath: bestPath,
          },
          // rough upside: impressions at ~10% CTR (top-3) minus current clicks
          score: Math.max(0, Math.round(c.impressions * 0.1) - c.clicks),
        },
      });
      created++;
    }

    return created;
  }

  /**
   * Outcome measurement — for recommendations PUBLISHED 31+ days ago,
   * compare clicks 28d after publication vs 28d before and set a verdict.
   */
  async measureOutcomes() {
    const recs = await prisma.contentRecommendation.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: daysAgo(LAG_DAYS + WINDOW_DAYS) },
        measuredAt: null,
      },
      include: { domain: { select: { domain: true, siteUrl: true } } },
    });

    let measured = 0;
    for (const rec of recs) {
      let pageId = rec.pageId;

      // NEW_TOPIC: resolve the published page from the reported URL
      if (!pageId && rec.publishedUrl) {
        const page = await prisma.page.findFirst({
          where: {
            domainId: rec.domainId,
            OR: [
              { url: rec.publishedUrl },
              { path: this.toPath(rec.publishedUrl) },
            ],
          },
          select: { id: true },
        });
        pageId = page?.id || null;
      }

      if (!pageId) {
        await prisma.contentRecommendation.update({
          where: { id: rec.id },
          data: {
            status: "MEASURED",
            measuredAt: new Date(),
            outcome: { verdict: "NO_PAGE_DATA" },
          },
        });
        measured++;
        continue;
      }

      const pub = rec.publishedAt!;
      const afterFrom = new Date(pub.getTime() + LAG_DAYS * DAY);
      const afterTo = new Date(afterFrom.getTime() + WINDOW_DAYS * DAY);
      const beforeFrom = new Date(pub.getTime() - WINDOW_DAYS * DAY);

      const [afterAgg, beforeAgg] = await Promise.all([
        prisma.gscPageDaily.aggregate({
          where: { pageId, date: { gte: afterFrom, lt: afterTo } },
          _sum: { clicks: true, impressions: true },
        }),
        prisma.gscPageDaily.aggregate({
          where: { pageId, date: { gte: beforeFrom, lt: pub } },
          _sum: { clicks: true, impressions: true },
        }),
      ]);

      const after = afterAgg._sum.clicks || 0;
      const before = beforeAgg._sum.clicks || 0;
      const deltaPct =
        before > 0 ? Math.round(((after - before) / before) * 100) : null;

      const verdict =
        rec.type === "NEW_TOPIC"
          ? after > 0
            ? "IMPROVED"
            : "FLAT"
          : after > before * 1.15
            ? "IMPROVED"
            : after < before * 0.85
              ? "WORSE"
              : "FLAT";

      await prisma.contentRecommendation.update({
        where: { id: rec.id },
        data: {
          status: "MEASURED",
          measuredAt: new Date(),
          outcome: {
            windowDays: WINDOW_DAYS,
            clicksBefore: before,
            clicksAfter: after,
            impressionsBefore: beforeAgg._sum.impressions || 0,
            impressionsAfter: afterAgg._sum.impressions || 0,
            deltaPct,
            verdict,
          },
        },
      });
      measured++;
    }

    return { measured, pending: recs.length - measured };
  }

  private toPath(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  /**
   * True when ≥60% of the query's significant words (stemmed to 5 chars,
   * Polish diacritics stripped) appear in the page path — i.e. the page is
   * already dedicated to this query.
   */
  private pathCoversQuery(path: string, query: string): boolean {
    const deburr = (s: string) =>
      s
        .toLowerCase()
        .replace(/ą/g, "a")
        .replace(/ć/g, "c")
        .replace(/ę/g, "e")
        .replace(/ł/g, "l")
        .replace(/ń/g, "n")
        .replace(/ó/g, "o")
        .replace(/ś/g, "s")
        .replace(/ż/g, "z")
        .replace(/ź/g, "z");

    const pathNorm = deburr(path);
    const words = deburr(query)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4);
    if (words.length === 0) return false;

    const matched = words.filter((w) =>
      pathNorm.includes(w.slice(0, 5)),
    ).length;
    return matched / words.length >= 0.6;
  }

  /**
   * Dedup guard: skip if an open recommendation exists for the same target,
   * or a rejection is younger than REJECTED_COOLDOWN_DAYS.
   */
  private async hasOpenOrRecentlyRejected(
    domainId: string,
    type: "REFRESH" | "NEW_TOPIC" | "PRUNE",
    pageId: string | null,
    topic?: string,
  ): Promise<boolean> {
    const target = pageId
      ? { pageId }
      : { topic: { equals: topic, mode: "insensitive" as const } };

    const existing = await prisma.contentRecommendation.findFirst({
      where: {
        domainId,
        type,
        ...target,
        OR: [
          { status: { in: ["PROPOSED", "QUEUED", "PUBLISHED"] } },
          {
            status: "REJECTED",
            updatedAt: { gte: daysAgo(REJECTED_COOLDOWN_DAYS) },
          },
        ],
      },
      select: { id: true },
    });

    return existing !== null;
  }
}
