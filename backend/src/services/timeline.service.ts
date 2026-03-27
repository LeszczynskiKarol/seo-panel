// backend/src/services/timeline.service.ts

import { getSearchConsole } from "../lib/google-auth.js";
import { prisma } from "../lib/prisma.js";

export class TimelineService {
  /**
   * Record position changes by comparing current GSC data with previous
   * Called after each GSC pull
   */
  async detectPositionChanges(domainId: string) {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

    const recent = await prisma.gscPageDaily.groupBy({
      by: ["pageId"],
      where: { page: { domainId }, date: { gte: sevenDaysAgo } },
      _avg: { position: true },
      _sum: { clicks: true, impressions: true },
    });

    const previous = await prisma.gscPageDaily.groupBy({
      by: ["pageId"],
      where: {
        page: { domainId },
        date: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
      _avg: { position: true },
    });

    const prevMap = new Map(previous.map((r) => [r.pageId, r._avg.position]));

    // Fetch top queries per page from GSC
    let queryMap = new Map<
      string,
      { query: string; clicks: number; position: number }
    >();
    if (domain.gscProperty) {
      try {
        const searchconsole = await getSearchConsole();
        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date(Date.now() - 7 * 86400000)
          .toISOString()
          .split("T")[0];

        const qRes = await searchconsole.searchanalytics.query({
          siteUrl: domain.gscProperty,
          requestBody: {
            startDate,
            endDate,
            dimensions: ["page", "query"],
            rowLimit: 10000,
          },
        });

        // Group by page URL, keep top query by impressions
        const pageQueries = new Map<
          string,
          {
            query: string;
            clicks: number;
            impressions: number;
            position: number;
          }
        >();
        for (const row of qRes.data.rows || []) {
          const pageUrl = row.keys![0];
          const query = row.keys![1];
          const existing = pageQueries.get(pageUrl);
          if (!existing || (row.impressions || 0) > existing.impressions) {
            pageQueries.set(pageUrl, {
              query,
              clicks: row.clicks || 0,
              impressions: row.impressions || 0,
              position: row.position || 0,
            });
          }
        }

        // Map page URLs to page IDs
        const pages = await prisma.page.findMany({
          where: { domainId },
          select: { id: true, url: true },
        });
        for (const page of pages) {
          const q = pageQueries.get(page.url);
          if (q) queryMap.set(page.id, q);
        }
      } catch (e: any) {
        console.error(`Query fetch failed for ${domain.domain}: ${e.message}`);
      }
    }

    const events: any[] = [];

    for (const r of recent) {
      const prevPos = prevMap.get(r.pageId);
      const currPos = r._avg.position;
      if (!prevPos || !currPos) continue;

      const change = prevPos - currPos;
      const topQuery = queryMap.get(r.pageId);

      const baseData = {
        from: Math.round(prevPos * 10) / 10,
        to: Math.round(currPos * 10) / 10,
        clicks: r._sum.clicks,
        query: topQuery?.query || null,
        queryPosition: topQuery?.position
          ? Math.round(topQuery.position * 10) / 10
          : null,
        queryClicks: topQuery?.clicks || null,
      };

      if (prevPos > 3 && currPos <= 3) {
        events.push({
          domainId,
          pageId: r.pageId,
          type: "ENTERED_TOP3",
          importance: 3,
          data: baseData,
        });
      } else if (prevPos > 10 && currPos <= 10) {
        events.push({
          domainId,
          pageId: r.pageId,
          type: "ENTERED_TOP10",
          importance: 2,
          data: baseData,
        });
      } else if (prevPos <= 10 && currPos > 10) {
        events.push({
          domainId,
          pageId: r.pageId,
          type: "LEFT_TOP10",
          importance: 3,
          data: baseData,
        });
      } else if (change > 3) {
        events.push({
          domainId,
          pageId: r.pageId,
          type: "POSITION_IMPROVED",
          importance: change > 10 ? 3 : 2,
          data: { ...baseData, change: Math.round(change * 10) / 10 },
        });
      } else if (change < -3) {
        events.push({
          domainId,
          pageId: r.pageId,
          type: "POSITION_DROPPED",
          importance: change < -10 ? 3 : 2,
          data: { ...baseData, change: Math.round(change * 10) / 10 },
        });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const event of events) {
      const exists = await prisma.seoEvent.findFirst({
        where: {
          domainId: event.domainId,
          pageId: event.pageId,
          type: event.type,
          createdAt: { gte: today },
        },
      });
      if (!exists) {
        await prisma.seoEvent.create({ data: event });
      }
    }

    return events.length;
  }

  /**
   * Detect new/lost backlinks by comparing current crawl with BacklinkSnapshot
   */
  async syncBacklinks(domainId: string) {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    // Get all external links FROM other domains TO this domain
    const incomingLinks = await prisma.link.findMany({
      where: {
        isInternal: false,
        toUrl: { contains: domain.domain.replace("www.", "") },
        fromPage: { domainId: { not: domainId } },
      },
      include: {
        fromPage: {
          select: { url: true, domain: { select: { domain: true } } },
        },
      },
    });

    let newLinks = 0;
    let lostLinks = 0;
    const now = new Date();
    const seenSourceUrls = new Set<string>();

    for (const link of incomingLinks) {
      const sourceUrl = link.fromPage.url;
      const sourceDomain = link.fromPage.domain.domain;
      const targetUrl = link.toUrl;
      seenSourceUrls.add(`${sourceUrl}→${targetUrl}`);

      // Find target page
      let targetPath: string;
      try {
        targetPath = new URL(targetUrl).pathname;
      } catch {
        continue;
      }
      const targetPage = await prisma.page.findFirst({
        where: { domainId, path: targetPath },
      });

      // Upsert backlink snapshot
      const existing = await prisma.backlinkSnapshot.findUnique({
        where: {
          domainId_sourceUrl_targetUrl: { domainId, sourceUrl, targetUrl },
        },
      });

      if (existing) {
        // Update last seen
        await prisma.backlinkSnapshot.update({
          where: { id: existing.id },
          data: { lastSeen: now, lastChecked: now, isLive: true, lostAt: null },
        });

        // If it was lost and came back
        if (!existing.isLive) {
          await prisma.seoEvent.create({
            data: {
              domainId,
              pageId: targetPage?.id,
              type: "BACKLINK_NEW",
              importance: 2,
              data: {
                sourceUrl,
                sourceDomain,
                targetUrl,
                anchor: link.anchorText,
                recovered: true,
              },
            },
          });
          newLinks++;
        }
      } else {
        // New backlink
        await prisma.backlinkSnapshot.create({
          data: {
            domainId,
            pageId: targetPage?.id,
            targetUrl,
            sourceUrl,
            sourceDomain,
            anchorText: link.anchorText,
            isDofollow: !link.relAttributes.includes("nofollow"),
          },
        });

        await prisma.seoEvent.create({
          data: {
            domainId,
            pageId: targetPage?.id,
            type: "BACKLINK_NEW",
            importance: 2,
            data: {
              sourceUrl,
              sourceDomain,
              targetUrl,
              anchor: link.anchorText,
            },
          },
        });
        newLinks++;
      }
    }

    // Mark lost backlinks
    const allSnapshots = await prisma.backlinkSnapshot.findMany({
      where: { domainId, isLive: true },
    });

    for (const snap of allSnapshots) {
      const key = `${snap.sourceUrl}→${snap.targetUrl}`;
      if (!seenSourceUrls.has(key)) {
        // Check if it's been missing for 2+ crawls before marking lost
        const daysSinceLastSeen =
          (now.getTime() - snap.lastSeen.getTime()) / 86400000;
        if (daysSinceLastSeen > 7) {
          await prisma.backlinkSnapshot.update({
            where: { id: snap.id },
            data: { isLive: false, lostAt: now, lastChecked: now },
          });

          await prisma.seoEvent.create({
            data: {
              domainId,
              pageId: snap.pageId,
              type: "BACKLINK_LOST",
              importance: 3,
              data: {
                sourceUrl: snap.sourceUrl,
                sourceDomain: snap.sourceDomain,
                targetUrl: snap.targetUrl,
              },
            },
          });
          lostLinks++;
        }
      }
    }

    return { newLinks, lostLinks, total: incomingLinks.length };
  }

  /**
   * Get timeline for a domain or page
   */
  async getTimeline(opts: {
    domainId?: string;
    pageId?: string;
    limit?: number;
    types?: string[];
  }) {
    const where: any = {};
    if (opts.domainId) where.domainId = opts.domainId;
    if (opts.pageId) where.pageId = opts.pageId;
    if (opts.types?.length) where.type = { in: opts.types };

    const events = await prisma.seoEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit || 100,
      include: {
        domain: { select: { domain: true, label: true } },
        page: { select: { path: true, url: true } },
      },
    });

    return events;
  }

  /**
   * Get backlinks for a domain with history
   */
  async getBacklinks(
    domainId: string,
    opts: { live?: boolean; limit?: number } = {},
  ) {
    const where: any = { domainId };
    if (opts.live !== undefined) where.isLive = opts.live;

    const backlinks = await prisma.backlinkSnapshot.findMany({
      where,
      orderBy: { firstSeen: "desc" },
      take: opts.limit || 200,
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

    const stats = {
      total: backlinks.length,
      live: backlinks.filter((b) => b.isLive).length,
      lost: backlinks.filter((b) => !b.isLive).length,
      dofollow: backlinks.filter((b) => b.isDofollow).length,
      nofollow: backlinks.filter((b) => !b.isDofollow).length,
      uniqueDomains: byDomain.size,
    };

    return {
      backlinks,
      byDomain: Array.from(byDomain.entries())
        .map(([domain, links]) => ({ domain, count: links.length, links }))
        .sort((a, b) => b.count - a.count),
      stats,
    };
  }

  /**
   * Correlate: for a given page, show position history alongside backlink events
   */
  async getPageSeoHistory(pageId: string, days = 90) {
    const since = new Date(Date.now() - days * 86400000);

    const [positionHistory, events, backlinks] = await Promise.all([
      prisma.gscPageDaily.findMany({
        where: { pageId, date: { gte: since } },
        orderBy: { date: "asc" },
      }),
      prisma.seoEvent.findMany({
        where: { pageId, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.backlinkSnapshot.findMany({
        where: { pageId },
        orderBy: { firstSeen: "desc" },
      }),
    ]);

    // Merge into timeline
    const timeline: {
      date: string;
      position: number | null;
      clicks: number;
      impressions: number;
      events: any[];
    }[] = [];

    // Build daily map
    const dailyMap = new Map<string, any>();
    for (const day of positionHistory) {
      const dateStr = new Date(day.date).toISOString().split("T")[0];
      dailyMap.set(dateStr, {
        date: dateStr,
        position: day.position,
        clicks: day.clicks,
        impressions: day.impressions,
        events: [],
      });
    }

    // Add events to matching days
    for (const event of events) {
      const dateStr = new Date(event.createdAt).toISOString().split("T")[0];
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, {
          date: dateStr,
          position: null,
          clicks: 0,
          impressions: 0,
          events: [],
        });
      }
      dailyMap.get(dateStr)!.events.push(event);
    }

    // Sort by date
    const sorted = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return {
      timeline: sorted,
      backlinks,
      summary: {
        totalEvents: events.length,
        totalBacklinks: backlinks.length,
        liveBacklinks: backlinks.filter((b) => b.isLive).length,
      },
    };
  }
}
