// backend/src/routes/analytics.ts

import { prisma } from "../lib/prisma.js";
import { FastifyInstance } from "fastify";
import { AnalyticsService } from "../services/analytics.service.js";

const analytics = new AnalyticsService();

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.get("/quick-wins", async (request) => {
    const { domainId, limit } = request.query as any;
    return analytics.getQuickWins(domainId, parseInt(limit) || 50);
  });

  fastify.get("/content-gaps", async (request) => {
    const { domainId, limit } = request.query as any;
    return analytics.getContentGaps(domainId, parseInt(limit) || 50);
  });

  fastify.get("/cannibalization/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return analytics.getCannibalization(domainId);
  });

  fastify.get("/cross-domain-links", async () => {
    return analytics.getCrossDomainLinks();
  });

  fastify.get("/indexing-velocity", async (request) => {
    const { domainId } = request.query as any;
    return analytics.getIndexingVelocity(domainId);
  });

  fastify.get("/health/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return analytics.getDomainHealth(domainId);
  });

  fastify.get("/movers/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { limit } = request.query as any;
    return analytics.getPositionMovers(domainId, parseInt(limit) || 30);
  });

  fastify.get("/stale-pages", async (request) => {
    const { domainId, days } = request.query as any;
    return analytics.getStalePages(domainId, parseInt(days) || 30);
  });

  // ─── API LOGS ──────────────────────────────────────────────
  fastify.get("/api-logs", async (request) => {
    const { feature, domainId, limit, offset, startDate, endDate } =
      request.query as any;
    const where: any = {};
    if (feature) where.feature = feature;
    if (domainId) where.domainId = domainId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + "T23:59:59Z");
    }

    const [logs, total, stats] = await Promise.all([
      prisma.apiLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit) || 50,
        skip: parseInt(offset) || 0,
      }),
      prisma.apiLog.count({ where }),
      prisma.apiLog.aggregate({
        where,
        _sum: {
          costUsd: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
        _avg: { costUsd: true, durationMs: true, totalTokens: true },
        _count: true,
      }),
    ]);

    // Daily breakdown
    const dailyRaw = await prisma.$queryRaw`
      SELECT DATE("createdAt") as date, 
             COUNT(*) as calls,
             SUM("costUsd") as cost,
             SUM("inputTokens") as input_tokens,
             SUM("outputTokens") as output_tokens
      FROM "ApiLog"
      ${startDate ? prisma.$queryRaw`WHERE "createdAt" >= ${new Date(startDate)}` : prisma.$queryRaw``}
      GROUP BY DATE("createdAt")
      ORDER BY date DESC
      LIMIT 30
    `;

    // By feature
    const byFeature = await prisma.apiLog.groupBy({
      by: ["feature"],
      where,
      _sum: { costUsd: true, totalTokens: true },
      _count: true,
      _avg: { durationMs: true },
    });

    // By model
    const byModel = await prisma.apiLog.groupBy({
      by: ["model"],
      where,
      _sum: {
        costUsd: true,
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
      },
      _count: true,
    });

    return {
      logs,
      total,
      stats: {
        totalCost: stats._sum.costUsd || 0,
        totalTokens: stats._sum.totalTokens || 0,
        totalInput: stats._sum.inputTokens || 0,
        totalOutput: stats._sum.outputTokens || 0,
        avgCost: stats._avg.costUsd || 0,
        avgDuration: stats._avg.durationMs || 0,
        avgTokens: stats._avg.totalTokens || 0,
        totalCalls: stats._count || 0,
      },
      byFeature: byFeature.map((f) => ({
        feature: f.feature || "unknown",
        calls: f._count,
        cost: f._sum.costUsd || 0,
        tokens: f._sum.totalTokens || 0,
        avgDuration: f._avg.durationMs || 0,
      })),
      byModel: byModel.map((m) => ({
        model: m.model,
        calls: m._count,
        cost: m._sum.costUsd || 0,
        input: m._sum.inputTokens || 0,
        output: m._sum.outputTokens || 0,
      })),
    };
  });
}
