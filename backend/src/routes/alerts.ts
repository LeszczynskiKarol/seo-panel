// backend/src/routes/alerts.ts
// v2 — rich filtering, pagination, domain/type/date filters

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function alertRoutes(fastify: FastifyInstance) {
  // ─── GET /api/alerts — with full filtering ─────────────────
  fastify.get("/", async (request) => {
    const {
      resolved,
      domainId,
      domains, // comma-separated domain IDs
      type, // single type or comma-separated
      severity, // single or comma-separated
      dateFrom,
      dateTo,
      limit,
      offset,
      search,
    } = request.query as any;

    const where: any = { AND: [] as any[] };

    // Resolved filter
    if (resolved === "false") {
      where.AND.push({ isResolved: false });
    } else if (resolved === "true") {
      where.AND.push({ isResolved: true });
    }
    // else: show all

    // Domain filter (single or multi)
    if (domainId) {
      where.AND.push({ domainId });
    } else if (domains) {
      const domainIds = domains.split(",").filter(Boolean);
      if (domainIds.length > 0) {
        where.AND.push({ domainId: { in: domainIds } });
      }
    }

    // Type filter
    if (type) {
      const types = type.split(",").filter(Boolean);
      if (types.length === 1) {
        where.AND.push({ type: types[0] });
      } else if (types.length > 1) {
        where.AND.push({ type: { in: types } });
      }
    }

    // Severity filter
    if (severity) {
      const sevs = severity.split(",").filter(Boolean);
      if (sevs.length === 1) {
        where.AND.push({ severity: sevs[0] });
      } else if (sevs.length > 1) {
        where.AND.push({ severity: { in: sevs } });
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      const dateCondition: any = {};
      if (dateFrom) dateCondition.gte = new Date(dateFrom);
      if (dateTo) dateCondition.lte = new Date(dateTo + "T23:59:59Z");
      where.AND.push({ createdAt: dateCondition });
    }

    // Search
    if (search) {
      where.AND.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const finalWhere = where.AND.length > 0 ? where : undefined;
    const take = Math.min(parseInt(limit) || 20, 1000);
    const skip = parseInt(offset) || 0;

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where: finalWhere,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          domain: { select: { domain: true, label: true } },
          page: { select: { path: true, url: true } },
        },
      }),
      prisma.alert.count({ where: finalWhere }),
    ]);

    // Aggregate counts for filter UI
    const [byType, bySeverity, byDomain] = await Promise.all([
      prisma.alert.groupBy({
        by: ["type"],
        where: finalWhere,
        _count: true,
      }),
      prisma.alert.groupBy({
        by: ["severity"],
        where: finalWhere,
        _count: true,
      }),
      prisma.alert.groupBy({
        by: ["domainId"],
        where: finalWhere,
        _count: true,
      }),
    ]);

    return {
      alerts,
      total,
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      bySeverity: bySeverity.map((s) => ({
        severity: s.severity,
        count: s._count,
      })),
      byDomain: byDomain.map((d) => ({
        domainId: d.domainId,
        count: d._count,
      })),
    };
  });

  // ─── PATCH /api/alerts/:id/resolve ─────────────────────────
  fastify.patch("/:id/resolve", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.alert.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() },
    });
  });

  // ─── POST /api/alerts/resolve-multiple ─────────────────────
  fastify.post("/resolve-multiple", async (request) => {
    const { ids } = request.body as { ids: string[] };
    if (!ids?.length) return { resolved: 0 };

    const result = await prisma.alert.updateMany({
      where: { id: { in: ids } },
      data: { isResolved: true, resolvedAt: new Date() },
    });

    return { resolved: result.count };
  });

  // ─── GET /api/alerts/stats — summary for dashboard ─────────
  fastify.get("/stats", async () => {
    const [unresolvedCount, byType, bySeverity] = await Promise.all([
      prisma.alert.count({ where: { isResolved: false } }),
      prisma.alert.groupBy({
        by: ["type"],
        where: { isResolved: false },
        _count: true,
      }),
      prisma.alert.groupBy({
        by: ["severity"],
        where: { isResolved: false },
        _count: true,
      }),
    ]);

    return {
      unresolvedCount,
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      bySeverity: bySeverity.map((s) => ({
        severity: s.severity,
        count: s._count,
      })),
    };
  });
}
