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

    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id },
    });

    // Last 30 days traffic
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await prisma.gscDomainDaily.findMany({
      where: { domainId: id, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "asc" },
    });

    // Indexing breakdown
    const indexingStats = await prisma.page.groupBy({
      by: ["indexingVerdict"],
      where: { domainId: id, inSitemap: true },
      _count: { id: true },
    });

    // Recent alerts
    const alerts = await prisma.alert.findMany({
      where: { domainId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      ...domain,
      dailyStats,
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
    const { sort, verdict, search, limit, offset } = request.query as any;

    const where: any = { domainId: id, inSitemap: true };
    if (verdict) where.indexingVerdict = verdict;
    if (search) {
      where.OR = [
        { path: { contains: search, mode: "insensitive" } },
        { url: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: any =
      sort === "impressions"
        ? { impressions: "desc" }
        : sort === "position"
          ? { position: "asc" }
          : { clicks: "desc" };

    const [pages, total] = await Promise.all([
      prisma.page.findMany({
        where,
        orderBy,
        take: parseInt(limit) || 50,
        skip: parseInt(offset) || 0,
      }),
      prisma.page.count({ where }),
    ]);

    return { pages, total };
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

  // ─── ORPHAN PAGES ──────────────────────────────────────────
  fastify.get("/:id/orphan-pages", async (request) => {
    const { id } = request.params as { id: string };

    const pages = await prisma.page.findMany({
      where: {
        domainId: id,
        inSitemap: true,
        internalLinksIn: 0,
      },
      orderBy: { clicks: "desc" },
    });

    return pages;
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
}
