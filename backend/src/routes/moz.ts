// backend/src/routes/moz.routes.ts
import { prisma } from "../lib/prisma.js";
import { FastifyInstance } from "fastify";
import { MozService } from "../services/moz.service.js";

const moz = new MozService();

export async function mozRoutes(fastify: FastifyInstance) {
  // Get Moz data for a domain (metrics + backlinks + anchors)
  fastify.get("/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return moz.getDomainMozData(domainId);
  });

  // Sync domain metrics (DA/PA/Spam Score)
  fastify.post("/:domainId/sync-metrics", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return moz.syncDomainMetrics(domainId);
  });

  // Sync external backlinks from Moz
  fastify.post("/:domainId/sync-backlinks", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return moz.syncExternalBacklinks(domainId);
  });

  // Sync all domains (metrics + backlinks)
  fastify.post("/sync-all", async () => {
    return moz.syncAllDomains();
  });

  // Get URL metrics for arbitrary targets (utility)
  fastify.post("/url-metrics", async (request) => {
    const { targets } = request.body as { targets: string[] };
    return moz.getUrlMetrics(targets);
  });

  // ─── MOZ ANALYTICS ─────────────────────────────────────────
  fastify.get("/analytics/overview", async () => {
    // 1. All domains with Moz data
    const domains = await prisma.domain.findMany({
      where: { isActive: true },
      select: {
        id: true,
        domain: true,
        label: true,
        category: true,
        mozDA: true,
        mozPA: true,
        mozSpamScore: true,
        mozLinks: true,
        mozDomains: true,
        mozLastSync: true,
        totalClicks: true,
      },
      orderBy: { mozDA: { sort: "desc", nulls: "last" } },
    });

    // 2. Backlink stats per domain
    const backlinkStats = await prisma.backlinkSnapshot.groupBy({
      by: ["domainId"],
      where: { source: "MOZ" },
      _count: { id: true },
    });
    const backlinkLiveStats = await prisma.backlinkSnapshot.groupBy({
      by: ["domainId"],
      where: { source: "MOZ", isLive: true },
      _count: { id: true },
    });
    const backlinkDofollowStats = await prisma.backlinkSnapshot.groupBy({
      by: ["domainId"],
      where: { source: "MOZ", isDofollow: true },
      _count: { id: true },
    });

    const blMap = new Map(backlinkStats.map((b) => [b.domainId, b._count.id]));
    const blLiveMap = new Map(
      backlinkLiveStats.map((b) => [b.domainId, b._count.id]),
    );
    const blDfMap = new Map(
      backlinkDofollowStats.map((b) => [b.domainId, b._count.id]),
    );

    const domainsWithBl = domains.map((d) => ({
      ...d,
      mozBacklinks: blMap.get(d.id) || 0,
      mozBacklinksLive: blLiveMap.get(d.id) || 0,
      mozBacklinksDofollow: blDfMap.get(d.id) || 0,
    }));

    // 3. API usage logs (last 90 days)
    const since = new Date(Date.now() - 90 * 86400000);
    const logs = await prisma.apiLog.findMany({
      where: { feature: { startsWith: "moz_" }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // 4. Aggregate usage
    const totalRows = logs.reduce(
      (s, l) => s + ((l.metadata as any)?.rows || 0),
      0,
    );
    const totalSyncs = logs.length;

    // Daily usage for chart
    const dailyMap = new Map<string, number>();
    for (const log of logs) {
      const date = new Date(log.createdAt).toISOString().split("T")[0];
      dailyMap.set(
        date,
        (dailyMap.get(date) || 0) + ((log.metadata as any)?.rows || 0),
      );
    }
    const dailyUsage = Array.from(dailyMap.entries())
      .map(([date, rows]) => ({ date, rows }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Per-feature breakdown
    const featureMap = new Map<string, number>();
    for (const log of logs) {
      const f = log.feature || "unknown";
      featureMap.set(
        f,
        (featureMap.get(f) || 0) + ((log.metadata as any)?.rows || 0),
      );
    }
    const featureBreakdown = Array.from(featureMap.entries())
      .map(([feature, rows]) => ({ feature, rows }))
      .sort((a, b) => b.rows - a.rows);

    // 5. Global totals
    const totalMozBacklinks = domainsWithBl.reduce(
      (s, d) => s + d.mozBacklinks,
      0,
    );
    const avgDA =
      domains.filter((d) => d.mozDA).length > 0
        ? Math.round(
            domains
              .filter((d) => d.mozDA)
              .reduce((s, d) => s + (d.mozDA || 0), 0) /
              domains.filter((d) => d.mozDA).length,
          )
        : 0;
    const domainsWithData = domains.filter((d) => d.mozDA != null).length;

    return {
      domains: domainsWithBl,
      logs: logs.slice(0, 50),
      dailyUsage,
      featureBreakdown,
      stats: {
        totalRows,
        totalSyncs,
        totalMozBacklinks,
        avgDA,
        domainsWithData,
        totalDomains: domains.length,
        monthlyQuota: 3000, // Update when you change plan
      },
    };
  });
}
