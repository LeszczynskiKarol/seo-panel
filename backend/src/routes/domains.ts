import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { GscService } from "../services/gsc.service.js";
import { IndexingService } from "../services/indexing.service.js";
import { SitemapService } from "../services/sitemap.service.js";
import { LinkCrawlerService } from "../services/link-crawler.service.js";

const gsc = new GscService();
const indexing = new IndexingService();
const sitemap = new SitemapService();
const crawler = new LinkCrawlerService();

export async function domainRoutes(fastify: FastifyInstance) {
  // ─── LIST DOMAINS ──────────────────────────────────────────
  fastify.get("/", async () => {
    const domains = await prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { totalClicks: "desc" },
    });
    return domains;
  });

  // ─── ADD DOMAIN ────────────────────────────────────────────
  fastify.post("/", async (request, reply) => {
    const { domain, siteUrl, gscProperty, sitemapPath, label, category } =
      request.body as any;

    const created = await prisma.domain.create({
      data: {
        domain,
        siteUrl: siteUrl || `https://${domain}`,
        gscProperty: gscProperty || null,
        sitemapPath: sitemapPath || "/sitemap-index.xml",
        label: label || null,
        category: category || "OTHER",
      },
    });

    return reply.status(201).send(created);
  });

  // ─── UPDATE DOMAIN ─────────────────────────────────────────
  fastify.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    return prisma.domain.update({ where: { id }, data });
  });

  // ─── DELETE DOMAIN ─────────────────────────────────────────
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.domain.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ─── DOMAIN DETAIL ─────────────────────────────────────────
  fastify.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const { startDate, endDate } = request.query as any;

    const domain = await prisma.domain.findUniqueOrThrow({ where: { id } });

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();

    const dailyStats = await prisma.gscDomainDaily.findMany({
      where: { domainId: id, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    });

    // Aggregate stats for selected range
    const rangeAgg = await prisma.gscDomainDaily.aggregate({
      where: { domainId: id, date: { gte: start, lte: end } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    });

    const indexingStats = await prisma.page.groupBy({
      by: ["indexingVerdict"],
      where: { domainId: id, inSitemap: true },
      _count: { id: true },
    });

    const alerts = await prisma.alert.findMany({
      where: { domainId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      ...domain,
      dailyStats,
      rangeClicks: rangeAgg._sum.clicks || 0,
      rangeImpressions: rangeAgg._sum.impressions || 0,
      rangeAvgPosition: rangeAgg._avg.position,
      indexingStats: indexingStats.map((s) => ({
        verdict: s.indexingVerdict,
        count: s._count.id,
      })),
      alerts,
    };
  });

  // ─── DOMAIN PAGES ──────────────────────────────────────────
  fastify.get("/:id/pages", async (request) => {
    const { id } = request.params as { id: string };
    const { search, verdict, limit, offset, startDate, endDate } =
      request.query as any;

    const where: any = { domainId: id };
    if (search) where.path = { contains: search, mode: "insensitive" };
    if (verdict) where.indexingVerdict = verdict;

    const [pages, total] = await Promise.all([
      prisma.page.findMany({
        where,
        orderBy: { clicks: "desc" },
        take: parseInt(limit) || 100,
        skip: parseInt(offset) || 0,
        select: {
          id: true,
          url: true,
          path: true,
          clicks: true,
          impressions: true,
          ctr: true,
          position: true,
          indexingVerdict: true,
          internalLinksIn: true,
          internalLinksOut: true,
          externalLinksOut: true,
          brokenLinksOut: true,
          lastChecked: true,
          isTracked: true,
          inSitemap: true,
        },
      }),
      prisma.page.count({ where }),
    ]);

    // If date range provided — override cached metrics with aggregated GscPageDaily
    if (startDate && endDate) {
      const pageIds = pages.map((p) => p.id);
      const dailyAgg = await prisma.gscPageDaily.groupBy({
        by: ["pageId"],
        where: {
          pageId: { in: pageIds },
          date: { gte: new Date(startDate), lte: new Date(endDate) },
        },
        _sum: { clicks: true, impressions: true },
        _avg: { position: true, ctr: true },
      });

      const aggMap = new Map(dailyAgg.map((a) => [a.pageId, a]));

      for (const page of pages) {
        const agg = aggMap.get(page.id);
        if (agg) {
          (page as any).clicks = agg._sum.clicks || 0;
          (page as any).impressions = agg._sum.impressions || 0;
          (page as any).position = agg._avg.position;
          (page as any).ctr = agg._avg.ctr;
        }
      }

      // Re-sort by aggregated clicks
      pages.sort((a: any, b: any) => b.clicks - a.clicks);
    }

    return { pages, total };
  });

  // Top queries for a specific page
  fastify.get("/:domainId/pages/:pageId/queries", async (request) => {
    const { domainId, pageId } = request.params as {
      domainId: string;
      pageId: string;
    };
    const { days } = request.query as { days?: string };
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    if (!domain.gscProperty) return { queries: [] };

    const { getSearchConsole } = await import("../lib/google-auth.js");
    const sc = await getSearchConsole();
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - parseInt(days || "30") * 86400000)
      .toISOString()
      .split("T")[0];

    const pageUrls = [page.url, page.url.replace(/\/$/, ""), page.url + "/"];
    let queries: any[] = [];

    for (const tryUrl of pageUrls) {
      try {
        const res = await sc.searchanalytics.query({
          siteUrl: domain.gscProperty,
          requestBody: {
            startDate,
            endDate,
            dimensions: ["query"],
            dimensionFilterGroups: [
              { filters: [{ dimension: "page", expression: tryUrl }] },
            ],
            rowLimit: 50,
          },
        });
        queries = (res.data.rows || [])
          .map((r: any) => ({
            query: r.keys![0],
            clicks: r.clicks || 0,
            impressions: r.impressions || 0,
            ctr: r.ctr || 0,
            position: Math.round((r.position || 0) * 10) / 10,
          }))
          .sort((a: any, b: any) => b.clicks - a.clicks);
        if (queries.length > 0) break;
      } catch {}
    }

    return { queries, url: page.url, startDate, endDate };
  });

  // ─── PAGE DETAIL ───────────────────────────────────────────
  fastify.get("/:domainId/pages/:pageId", async (request) => {
    const { pageId } = request.params as { pageId: string };

    const page = await prisma.page.findUniqueOrThrow({
      where: { id: pageId },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [history, linksOut, linksIn] = await Promise.all([
      prisma.gscPageDaily.findMany({
        where: { pageId, date: { gte: thirtyDaysAgo } },
        orderBy: { date: "asc" },
      }),
      prisma.link.findMany({
        where: { fromPageId: pageId },
        orderBy: { isBroken: "desc" },
        take: 100,
      }),
      prisma.link.findMany({
        where: { toPageId: pageId },
        take: 100,
      }),
    ]);

    return { ...page, history, linksOut, linksIn };
  });

  // ─── BROKEN LINKS ──────────────────────────────────────────
  fastify.get("/:id/broken-links", async (request) => {
    const { id } = request.params as { id: string };

    const links = await prisma.link.findMany({
      where: {
        isBroken: true,
        fromPage: { domainId: id },
      },
      include: {
        fromPage: { select: { path: true, url: true } },
      },
      orderBy: { lastChecked: "desc" },
    });

    return links;
  });

  // ─── ACTIONS ───────────────────────────────────────────────

  // Sync sitemap
  fastify.post("/:id/sync-sitemap", async (request) => {
    const { id } = request.params as { id: string };
    return sitemap.syncDomain(id);
  });

  // Pull GSC data
  fastify.post("/:id/pull-gsc", async (request) => {
    const { id } = request.params as { id: string };
    const { startDate, endDate } = request.body as any;

    const end = endDate || new Date().toISOString().split("T")[0];
    const start =
      startDate ||
      new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    return gsc.pullDomainData(id, start, end);
  });

  // Check indexing
  fastify.post("/:id/check-indexing", async (request) => {
    const { id } = request.params as { id: string };
    return indexing.checkDomain(id);
  });

  // Crawl links
  fastify.post("/:id/crawl-links", async (request) => {
    const { id } = request.params as { id: string };
    return crawler.crawlDomain(id);
  });

  // Top queries
  fastify.get("/:id/queries", async (request) => {
    const { id } = request.params as { id: string };
    const { startDate, endDate, limit } = request.query as any;

    const end = endDate || new Date().toISOString().split("T")[0];
    const start =
      startDate ||
      new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    return gsc.getTopQueries(id, start, end, parseInt(limit) || 50);
  });

  // ─── BACKLINKS ─────────────────────────────────────────────
  fastify.get("/:id/backlinks", async (request) => {
    const { id } = request.params as { id: string };
    return gsc.getBacklinks(id);
  });

  // ─── TOGGLE TRACKED ────────────────────────────────────────
  fastify.patch("/:domainId/pages/:pageId/track", async (request) => {
    const { pageId } = request.params as { pageId: string };
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    return prisma.page.update({
      where: { id: pageId },
      data: { isTracked: !page.isTracked },
    });
  });

  // ─── TRACKED PAGES WITH RICH DATA ─────────────────────────
  fastify.get("/:id/tracked", async (request) => {
    const { id } = request.params as { id: string };
    const domain = await prisma.domain.findUniqueOrThrow({ where: { id } });

    const pages = await prisma.page.findMany({
      where: { domainId: id, isTracked: true },
      orderBy: { clicks: "desc" },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const enriched = await Promise.all(
      pages.map(async (page) => {
        // Position history (30 days)
        const history = await prisma.gscPageDaily.findMany({
          where: { pageId: page.id, date: { gte: thirtyDaysAgo } },
          orderBy: { date: "asc" },
        });

        // Top queries from GSC
        let topQueries: any[] = [];
        if (domain.gscProperty) {
          try {
            const { getSearchConsole } = await import("../lib/google-auth.js");
            const { days } = request.query as { days?: string };
            const thirtyDaysAgo = new Date(
              Date.now() - parseInt(days || "30") * 86400000,
            );
            const sc = await getSearchConsole();
            const endDate = new Date().toISOString().split("T")[0];
            const startDate = new Date(
              Date.now() - parseInt(days || "30") * 86400000,
            )
              .toISOString()
              .split("T")[0];

            const qRes = await sc.searchanalytics.query({
              siteUrl: domain.gscProperty,
              requestBody: {
                startDate,
                endDate,
                dimensions: ["query"],
                dimensionFilterGroups: [
                  {
                    filters: [{ dimension: "page", expression: page.url }],
                  },
                ],
                rowLimit: 10,
              },
            });

            topQueries = (qRes.data.rows || []).map((r: any) => ({
              query: r.keys![0],
              clicks: r.clicks || 0,
              impressions: r.impressions || 0,
              ctr: r.ctr || 0,
              position: r.position || 0,
            }));
          } catch {}
        }

        // Recent SEO events
        const events = await prisma.seoEvent.findMany({
          where: { pageId: page.id },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        // Backlinks
        const backlinks = await prisma.backlinkSnapshot.findMany({
          where: { pageId: page.id, isLive: true },
          orderBy: { firstSeen: "desc" },
          take: 10,
        });

        // Tracked keywords
        const trackedKeywords = await prisma.trackedKeyword.findMany({
          where: { pageId: page.id },
          orderBy: { createdAt: "asc" },
        });

        return {
          ...page,
          history,
          topQueries,
          events,
          backlinks,
          trackedKeywords,
        };
      }),
    );

    return enriched;
  });

  // ─── ADD TRACKED URL MANUALLY ──────────────────────────────
  fastify.post("/:id/track-url", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { url } = request.body as { url: string };

    if (!url) return reply.status(400).send({ error: "URL is required" });

    // Normalize — extract path
    let path: string;
    try {
      path = new URL(url).pathname;
    } catch {
      // Maybe they pasted just the path
      path = url.startsWith("/") ? url : `/${url}`;
    }

    // Remove trailing slash for matching (but keep root /)
    const pathNorm = path.length > 1 ? path.replace(/\/$/, "") : path;

    // Find page in DB — exact match only
    const page = await prisma.page.findFirst({
      where: {
        domainId: id,
        OR: [
          { path },
          { path: pathNorm },
          ...(pathNorm !== "/" ? [{ path: `${pathNorm}/` }] : []),
        ],
      },
    });

    if (!page) {
      // Check if it's in sitemap but not yet synced
      const domain = await prisma.domain.findUniqueOrThrow({ where: { id } });
      return reply.status(404).send({
        error: "not_found",
        message: `URL "${path}" nie znaleziony w bazie. Sprawdź czy jest w sitemapie ${domain.siteUrl}${domain.sitemapPath} i odpal Sync Sitemap.`,
      });
    }

    if (page.isTracked) {
      return { ...page, message: "already_tracked" };
    }

    const updated = await prisma.page.update({
      where: { id: page.id },
      data: { isTracked: true },
    });

    return { ...updated, message: "tracked" };
  });

  // ─── REMOVE FROM TRACKED ───────────────────────────────────
  fastify.delete("/:domainId/pages/:pageId/track", async (request) => {
    const { pageId } = request.params as { pageId: string };
    return prisma.page.update({
      where: { id: pageId },
      data: { isTracked: false },
    });
  });

  // ─── TRACKED KEYWORDS ──────────────────────────────────────

  // Add keyword to track
  fastify.post("/:domainId/pages/:pageId/keywords", async (request, reply) => {
    const { pageId } = request.params as { pageId: string };
    const { keyword } = request.body as { keyword: string };

    if (!keyword?.trim())
      return reply.status(400).send({ error: "Keyword is required" });

    const existing = await prisma.trackedKeyword.findUnique({
      where: {
        pageId_keyword: { pageId, keyword: keyword.trim().toLowerCase() },
      },
    });
    if (existing) return { ...existing, message: "already_exists" };

    const created = await prisma.trackedKeyword.create({
      data: { pageId, keyword: keyword.trim().toLowerCase() },
    });

    return created;
  });

  // Remove keyword
  fastify.delete("/:domainId/pages/:pageId/keywords/:kwId", async (request) => {
    const { kwId } = request.params as { kwId: string };
    await prisma.trackedKeyword.delete({ where: { id: kwId } });
    return { ok: true };
  });

  // Check positions for all tracked keywords of a domain
  fastify.post("/:id/check-keywords", async (request) => {
    const { id } = request.params as { id: string };
    const domain = await prisma.domain.findUniqueOrThrow({ where: { id } });

    if (!domain.gscProperty) return { error: "No GSC property" };

    const { getSearchConsole } = await import("../lib/google-auth.js");
    const sc = await getSearchConsole();
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .split("T")[0];

    const keywords = await prisma.trackedKeyword.findMany({
      where: { page: { domainId: id } },
      include: { page: { select: { url: true } } },
    });

    let checked = 0;
    for (const kw of keywords) {
      try {
        const res = await sc.searchanalytics.query({
          siteUrl: domain.gscProperty,
          requestBody: {
            startDate,
            endDate,
            dimensions: ["query"],
            dimensionFilterGroups: [
              {
                filters: [
                  { dimension: "page", expression: kw.page.url },
                  { dimension: "query", expression: kw.keyword },
                ],
              },
            ],
            rowLimit: 1,
          },
        });

        const row = res.data.rows?.[0];
        const today = new Date().toISOString().split("T")[0];

        // Update history
        const history = (kw.positionHistory as any[]) || [];
        history.push({
          date: today,
          position: row?.position || null,
          clicks: row?.clicks || 0,
          impressions: row?.impressions || 0,
        });
        // Keep last 90 entries
        if (history.length > 90) history.splice(0, history.length - 90);

        await prisma.trackedKeyword.update({
          where: { id: kw.id },
          data: {
            position: row?.position || null,
            clicks: row?.clicks || 0,
            impressions: row?.impressions || 0,
            ctr: row?.ctr || null,
            positionHistory: history,
            lastChecked: new Date(),
          },
        });
        checked++;
      } catch {}

      // Rate limit
      await new Promise((r) => setTimeout(r, 200));
    }

    return { checked, total: keywords.length };
  });

  // ─── DOMAIN KEYWORDS (per-domain keyword tracking) ────────

  fastify.get("/:id/domain-keywords", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.domainKeyword.findMany({
      where: { domainId: id },
      orderBy: { totalClicks: "desc" },
    });
  });

  fastify.post("/:id/domain-keywords", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { keyword } = request.body as { keyword: string };
    if (!keyword?.trim())
      return reply.status(400).send({ error: "Keyword required" });

    const kw = keyword.trim().toLowerCase();
    const existing = await prisma.domainKeyword.findUnique({
      where: { domainId_keyword: { domainId: id, keyword: kw } },
    });
    if (existing) return { ...existing, message: "already_exists" };

    const created = await prisma.domainKeyword.create({
      data: { domainId: id, keyword: kw },
    });

    // Auto-check position
    const domain = await prisma.domain.findUniqueOrThrow({ where: { id } });
    if (domain.gscProperty) {
      try {
        const { getSearchConsole } = await import("../lib/google-auth.js");
        const sc = await getSearchConsole();
        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date(Date.now() - 7 * 86400000)
          .toISOString()
          .split("T")[0];

        const res = await sc.searchanalytics.query({
          siteUrl: domain.gscProperty,
          requestBody: {
            startDate,
            endDate,
            dimensions: ["page"],
            dimensionFilterGroups: [
              {
                filters: [
                  { dimension: "query", operator: "contains", expression: kw },
                ],
              },
            ],
            rowLimit: 20,
          },
        });

        const results = (res.data.rows || [])
          .map((r: any) => {
            let path: string;
            try {
              path = new URL(r.keys![0]).pathname;
            } catch {
              path = r.keys![0];
            }
            return {
              url: r.keys![0],
              path,
              position: Math.round((r.position || 0) * 10) / 10,
              clicks: r.clicks || 0,
              impressions: r.impressions || 0,
              ctr: r.ctr || 0,
            };
          })
          .sort((a: any, b: any) => a.position - b.position);

        const best = results[0];
        await prisma.domainKeyword.update({
          where: { id: created.id },
          data: {
            results,
            bestPosition: best?.position || null,
            totalClicks: results.reduce((s: number, r: any) => s + r.clicks, 0),
            totalPages: results.length,
            positionHistory: [
              {
                date: endDate,
                bestPosition: best?.position || null,
                pages: results.length,
              },
            ],
            lastChecked: new Date(),
          },
        });

        return {
          ...created,
          results,
          bestPosition: best?.position,
          totalPages: results.length,
        };
      } catch {}
    }

    return created;
  });

  fastify.delete("/:id/domain-keywords/:kwId", async (request) => {
    const { kwId } = request.params as { kwId: string };
    await prisma.domainKeyword.delete({ where: { id: kwId } });
    return { ok: true };
  });

  fastify.post("/:id/check-domain-keywords", async (request) => {
    const { id } = request.params as { id: string };
    const { days } = request.body as { days?: number };
    const domain = await prisma.domain.findUniqueOrThrow({ where: { id } });
    if (!domain.gscProperty) return { error: "No GSC property" };

    const { getSearchConsole } = await import("../lib/google-auth.js");
    const sc = await getSearchConsole();
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - (days || 7) * 86400000)
      .toISOString()
      .split("T")[0];
    const today = endDate;

    const keywords = await prisma.domainKeyword.findMany({
      where: { domainId: id },
    });
    let checked = 0;

    for (const kw of keywords) {
      try {
        const res = await sc.searchanalytics.query({
          siteUrl: domain.gscProperty,
          requestBody: {
            startDate,
            endDate,
            dimensions: ["page"],
            dimensionFilterGroups: [
              {
                filters: [
                  {
                    dimension: "query",
                    operator: "contains",
                    expression: kw.keyword,
                  },
                ],
              },
            ],
            rowLimit: 20,
          },
        });

        const results = (res.data.rows || [])
          .map((r: any) => {
            let path: string;
            try {
              path = new URL(r.keys![0]).pathname;
            } catch {
              path = r.keys![0];
            }
            return {
              url: r.keys![0],
              path,
              position: Math.round((r.position || 0) * 10) / 10,
              clicks: r.clicks || 0,
              impressions: r.impressions || 0,
              ctr: r.ctr || 0,
            };
          })
          .sort((a: any, b: any) => a.position - b.position);

        const best = results[0];
        const history = (kw.positionHistory as any[]) || [];
        history.push({
          date: today,
          bestPosition: best?.position || null,
          pages: results.length,
        });
        if (history.length > 90) history.splice(0, history.length - 90);

        await prisma.domainKeyword.update({
          where: { id: kw.id },
          data: {
            results,
            bestPosition: best?.position || null,
            totalClicks: results.reduce((s: number, r: any) => s + r.clicks, 0),
            totalPages: results.length,
            positionHistory: history,
            lastChecked: new Date(),
          },
        });
        checked++;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }

    return { checked, total: keywords.length };
  });
  // Get daily breakdown for single domain keyword
  fastify.get("/:id/domain-keywords/:kwId/daily", async (request) => {
    const { id, kwId } = request.params as { id: string; kwId: string };
    const { days } = request.query as { days?: string };
    const domain = await prisma.domain.findUniqueOrThrow({ where: { id } });
    const kw = await prisma.domainKeyword.findUniqueOrThrow({
      where: { id: kwId },
    });

    if (!domain.gscProperty) return { error: "No GSC property", daily: [] };

    const { getSearchConsole } = await import("../lib/google-auth.js");
    const sc = await getSearchConsole();
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - parseInt(days || "30") * 86400000)
      .toISOString()
      .split("T")[0];

    try {
      const res = await sc.searchanalytics.query({
        siteUrl: domain.gscProperty,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["date"],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: "query",
                  operator: "contains",
                  expression: kw.keyword,
                },
              ],
            },
          ],
          rowLimit: 100,
        },
      });

      const daily = (res.data.rows || [])
        .map((r: any) => ({
          date: r.keys![0],
          clicks: r.clicks || 0,
          impressions: r.impressions || 0,
          position: Math.round((r.position || 0) * 10) / 10,
          ctr: r.ctr || 0,
        }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      return { keyword: kw.keyword, daily, startDate, endDate };
    } catch (e: any) {
      return { keyword: kw.keyword, daily: [], error: e.message };
    }
  });

  // Daily breakdown for specific query on specific page
  fastify.get("/:domainId/pages/:pageId/query-daily", async (request) => {
    const { domainId, pageId } = request.params as {
      domainId: string;
      pageId: string;
    };
    const { query, days } = request.query as { query: string; days?: string };

    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    if (!domain.gscProperty) return { daily: [] };

    const { getSearchConsole } = await import("../lib/google-auth.js");
    const sc = await getSearchConsole();
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - parseInt(days || "30") * 86400000)
      .toISOString()
      .split("T")[0];

    try {
      const pageUrls = [page.url, page.url.replace(/\/$/, ""), page.url + "/"];
      let daily: any[] = [];

      for (const tryUrl of pageUrls) {
        const res = await sc.searchanalytics.query({
          siteUrl: domain.gscProperty,
          requestBody: {
            startDate,
            endDate,
            dimensions: ["date"],
            dimensionFilterGroups: [
              {
                filters: [
                  { dimension: "page", expression: tryUrl },
                  {
                    dimension: "query",
                    operator: "contains",
                    expression: query,
                  },
                ],
              },
            ],
            rowLimit: 100,
          },
        });

        daily = (res.data.rows || [])
          .map((r: any) => ({
            date: r.keys![0],
            clicks: r.clicks || 0,
            impressions: r.impressions || 0,
            position: Math.round((r.position || 0) * 10) / 10,
            ctr: r.ctr || 0,
          }))
          .sort((a: any, b: any) => a.date.localeCompare(b.date));

        if (daily.length > 0) break;
      }

      return { query, url: page.url, daily, startDate, endDate };
    } catch (e: any) {
      return { query, url: page.url, daily: [], error: e.message };
    }
  });

  // Daily breakdown for specific query on domain level (no page filter)
  fastify.get("/:domainId/query-daily", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const {
      query,
      days,
      startDate: qStart,
      endDate: qEnd,
    } = request.query as any;

    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });
    if (!domain.gscProperty) return { daily: [] };

    const { getSearchConsole } = await import("../lib/google-auth.js");
    const sc = await getSearchConsole();
    const endDate = qEnd || new Date().toISOString().split("T")[0];
    const startDate =
      qStart ||
      new Date(Date.now() - parseInt(days || "30") * 86400000)
        .toISOString()
        .split("T")[0];

    try {
      const res = await sc.searchanalytics.query({
        siteUrl: domain.gscProperty,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["date"],
          dimensionFilterGroups: [
            {
              filters: [
                { dimension: "query", operator: "contains", expression: query },
              ],
            },
          ],
          rowLimit: 100,
        },
      });

      const daily = (res.data.rows || [])
        .map((r: any) => ({
          date: r.keys![0],
          clicks: r.clicks || 0,
          impressions: r.impressions || 0,
          position: Math.round((r.position || 0) * 10) / 10,
          ctr: r.ctr || 0,
        }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      return { query, daily, startDate, endDate };
    } catch (e: any) {
      return { query, daily: [], error: e.message };
    }
  });

  // Remove URL from Google index
  fastify.post("/:domainId/pages/:pageId/remove-index", async (request) => {
    const { pageId } = request.params as { domainId: string; pageId: string };
    const page = await prisma.page.findUniqueOrThrow({
      where: { id: pageId },
      include: { domain: true },
    });
    const { IndexingService } = await import("../services/indexing.service.js");
    const indexing = new IndexingService();

    const deleteResult = await indexing.submitUrl(page.url, "URL_DELETED");
    const recrawlResult = await indexing.submitUrl(page.url, "URL_UPDATED");

    await prisma.page.update({
      where: { id: pageId },
      data: {
        indexingVerdict: "REMOVAL_REQUESTED",
        removalRequestedAt: new Date(),
        coverageState: "Removal requested via Indexing API",
        lastChecked: new Date(),
      },
    });

    return { ok: true, deleteResult, recrawlResult };
  });

  fastify.post("/:domainId/pages/:pageId/confirm-removed", async (request) => {
    const { pageId } = request.params as { domainId: string; pageId: string };
    await prisma.page.update({
      where: { id: pageId },
      data: {
        indexingVerdict: "REMOVED",
        removedAt: new Date(),
        lastChecked: new Date(),
      },
    });
    return { ok: true };
  });
}
