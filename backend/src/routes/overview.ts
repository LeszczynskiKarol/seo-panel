import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { GscService } from "../services/gsc.service.js";
import { SitemapService } from "../services/sitemap.service.js";

const gsc = new GscService();
const sitemap = new SitemapService();

export async function overviewRoutes(fastify: FastifyInstance) {
  // ─── GLOBAL OVERVIEW ───────────────────────────────────────
  fastify.get("/overview", async () => {
    const domains = await prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { totalClicks: "desc" },
    });

    const totalPages = domains.reduce((s, d) => s + d.totalPages, 0);
    const totalIndexed = domains.reduce((s, d) => s + d.indexedPages, 0);
    const totalClicks = domains.reduce((s, d) => s + d.totalClicks, 0);
    const totalImpressions = domains.reduce((s, d) => s + d.totalImpressions, 0);

    // Unresolved alerts
    const alertCount = await prisma.alert.count({
      where: { isResolved: false },
    });

    // Last 7 days traffic trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTraffic = await prisma.gscDomainDaily.groupBy({
      by: ["date"],
      where: { date: { gte: sevenDaysAgo } },
      _sum: { clicks: true, impressions: true },
      orderBy: { date: "asc" },
    });

    return {
      domains: domains.length,
      totalPages,
      totalIndexed,
      indexRate: totalPages > 0 ? Math.round((totalIndexed / totalPages) * 100) : 0,
      totalClicks,
      totalImpressions,
      alertCount,
      recentTraffic: recentTraffic.map((r) => ({
        date: r.date,
        clicks: r._sum.clicks || 0,
        impressions: r._sum.impressions || 0,
      })),
    };
  });

  // ─── ALERTS ────────────────────────────────────────────────
  fastify.get("/alerts", async (request) => {
    const { resolved, type, limit } = request.query as any;

    const where: any = {};
    if (resolved === "false") where.isResolved = false;
    if (resolved === "true") where.isResolved = true;
    if (type) where.type = type;

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit) || 50,
      include: {
        domain: { select: { domain: true, label: true } },
        page: { select: { path: true, url: true } },
      },
    });

    return alerts;
  });

  // Resolve alert
  fastify.patch("/alerts/:id/resolve", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.alert.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() },
    });
  });

  // ─── BULK ACTIONS ──────────────────────────────────────────

  // Sync all sitemaps
  fastify.post("/sync-all-sitemaps", async () => {
    return sitemap.syncAll();
  });

  // Pull GSC for all domains
  fastify.post("/pull-all-gsc", async (request) => {
    const { days } = request.body as any;
    const d = parseInt(days) || 3;
    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - d * 86400000).toISOString().split("T")[0];
    return gsc.pullAllDomains(start, end);
  });

  // ─── JOB HISTORY ───────────────────────────────────────────
  fastify.get("/jobs", async (request) => {
    const { limit } = request.query as any;
    return prisma.jobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: parseInt(limit) || 20,
    });
  });
}
