// backend/src/routes/costs.ts

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function costRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════
  // MANUAL REVENUE — CRUD
  // ═══════════════════════════════════════════════════════════

  fastify.get("/revenues", async (request) => {
    const { startDate, endDate, category, domainId } = request.query as any;

    const where: any = {};
    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    }
    if (category) where.category = category;
    if (domainId) where.domainId = domainId;

    return prisma.manualRevenue.findMany({
      where,
      include: { domain: { select: { id: true, label: true, domain: true } } },
      orderBy: { date: "desc" },
    });
  });

  fastify.post("/revenues", async (request, reply) => {
    const { category, label, amount, date, domainId, isRecurring, notes } =
      request.body as any;

    if (!category || !label || amount == null || !date) {
      return reply
        .code(400)
        .send({ error: "category, label, amount, date required" });
    }

    const revenue = await prisma.manualRevenue.create({
      data: {
        category,
        label,
        amount: parseFloat(amount),
        date: new Date(date),
        domainId: domainId || null,
        isRecurring: isRecurring || false,
        notes: notes || null,
      },
    });

    return reply.code(201).send(revenue);
  });

  fastify.patch("/revenues/:id", async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    if (data.date) data.date = new Date(data.date);
    if (data.amount) data.amount = parseFloat(data.amount);
    return prisma.manualRevenue.update({ where: { id }, data });
  });

  fastify.delete("/revenues/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.manualRevenue.delete({ where: { id } });
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════
  // MANUAL COSTS — CRUD
  // ═══════════════════════════════════════════════════════════

  fastify.get("/", async (request) => {
    const { startDate, endDate, category, domainId } = request.query as any;

    const where: any = {};
    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    }
    if (category) where.category = category;
    if (domainId) where.domainId = domainId;

    return prisma.manualCost.findMany({
      where,
      include: { domain: { select: { id: true, label: true, domain: true } } },
      orderBy: { date: "desc" },
    });
  });

  fastify.post("/", async (request, reply) => {
    const { category, label, amount, date, domainId, isRecurring, notes } =
      request.body as any;

    if (!category || !label || amount == null || !date) {
      return reply
        .code(400)
        .send({ error: "category, label, amount, date required" });
    }

    const cost = await prisma.manualCost.create({
      data: {
        category,
        label,
        amount: parseFloat(amount),
        date: new Date(date),
        domainId: domainId || null,
        isRecurring: isRecurring || false,
        notes: notes || null,
      },
    });

    return reply.code(201).send(cost);
  });

  fastify.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    if (data.date) data.date = new Date(data.date);
    if (data.amount) data.amount = parseFloat(data.amount);
    return prisma.manualCost.update({ where: { id }, data });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.manualCost.delete({ where: { id } });
    return reply.code(204).send();
  });

  // ═══════════════════════════════════════════════════════════
  // GLOBAL PROFITABILITY SUMMARY
  // ═══════════════════════════════════════════════════════════

  fastify.get("/global-summary", async (request) => {
    const { startDate, endDate } = request.query as any;

    if (!startDate || !endDate) {
      return { error: "startDate and endDate required" };
    }

    const since = new Date(startDate);
    const until = new Date(endDate);

    // ─── 1. All GA4 integrations + domain categories ───
    const allIntegrations = await prisma.domainIntegration.findMany({
      where: { provider: "GOOGLE_ANALYTICS", status: "ACTIVE" },
      select: { id: true, domainId: true },
    });

    const intIds = allIntegrations.map((i) => i.id);
    const domainIds = [...new Set(allIntegrations.map((i) => i.domainId))];

    // Load domain categories once (no N+1)
    const domainInfos = await prisma.domain.findMany({
      where: { id: { in: domainIds } },
      select: { id: true, category: true, label: true, domain: true },
    });
    const domainCategoryMap = new Map(
      domainInfos.map((d) => [d.id, d.category]),
    );
    const domainLabelMap = new Map(
      domainInfos.map((d) => [d.id, d.label || d.domain]),
    );

    // ─── 2. GA4 daily revenue ───
    const ga4Daily = await prisma.integrationDaily.findMany({
      where: {
        integrationId: { in: intIds },
        date: { gte: since, lte: until },
      },
    });

    const intToDomain = new Map(allIntegrations.map((i) => [i.id, i.domainId]));

    let totalRevenue = 0;
    let totalCommission = 0;
    let totalConversions = 0;

    const dailyMap = new Map<
      string,
      {
        date: string;
        revenue: number;
        commission: number;
        adsCost: number;
        manualCosts: number;
        manualRevenue: number;
        profit: number;
        conversions: number;
      }
    >();

    const domainRevenue = new Map<
      string,
      { revenue: number; conversions: number }
    >();

    const emptyDay = (dateStr: string) => ({
      date: dateStr,
      revenue: 0,
      commission: 0,
      adsCost: 0,
      manualCosts: 0,
      manualRevenue: 0,
      profit: 0,
      conversions: 0,
    });

    for (const g of ga4Daily) {
      const domainId = intToDomain.get(g.integrationId) || "";
      const isCommissionBased = domainCategoryMap.get(domainId) === "ECOMMERCE";
      const rate = isCommissionBased ? 0.12 : 1.0;
      const rev = g.revenue || 0;
      const comm = rev * rate;

      totalRevenue += rev;
      totalCommission += comm;
      totalConversions += g.conversions || 0;

      const prev = domainRevenue.get(domainId) || {
        revenue: 0,
        conversions: 0,
      };
      prev.revenue += rev;
      prev.conversions += g.conversions || 0;
      domainRevenue.set(domainId, prev);

      const dateStr = g.date.toISOString().split("T")[0];
      const d = dailyMap.get(dateStr) || emptyDay(dateStr);
      d.revenue += rev;
      d.commission += comm;
      d.conversions += g.conversions || 0;
      dailyMap.set(dateStr, d);
    }

    // ─── 3. All Ads costs ───
    const adsCosts = await prisma.adsCampaignDaily.findMany({
      where: { date: { gte: since, lte: until } },
    });

    let totalAdsCost = 0;
    for (const a of adsCosts) {
      totalAdsCost += a.cost;
      const dateStr = a.date.toISOString().split("T")[0];
      const d = dailyMap.get(dateStr) || emptyDay(dateStr);
      d.adsCost += a.cost;
      dailyMap.set(dateStr, d);
    }

    // ─── 4. Manual costs ───
    const manualCosts = await prisma.manualCost.findMany({
      where: { date: { gte: since, lte: until } },
    });

    let totalManualCosts = 0;
    const costsByCategory = new Map<string, number>();

    for (const mc of manualCosts) {
      totalManualCosts += mc.amount;
      costsByCategory.set(
        mc.category,
        (costsByCategory.get(mc.category) || 0) + mc.amount,
      );

      const dateStr = mc.date.toISOString().split("T")[0];
      const d = dailyMap.get(dateStr) || emptyDay(dateStr);
      d.manualCosts += mc.amount;
      dailyMap.set(dateStr, d);
    }

    // ─── 5. Manual revenues ───
    const manualRevenues = await prisma.manualRevenue.findMany({
      where: { date: { gte: since, lte: until } },
    });

    let totalManualRevenue = 0;
    const revenueByCategory = new Map<string, number>();
    const manualRevByDomain = new Map<string, number>();

    for (const mr of manualRevenues) {
      totalManualRevenue += mr.amount;
      revenueByCategory.set(
        mr.category,
        (revenueByCategory.get(mr.category) || 0) + mr.amount,
      );

      if (mr.domainId) {
        manualRevByDomain.set(
          mr.domainId,
          (manualRevByDomain.get(mr.domainId) || 0) + mr.amount,
        );
      }

      const dateStr = mr.date.toISOString().split("T")[0];
      const d = dailyMap.get(dateStr) || emptyDay(dateStr);
      d.manualRevenue += mr.amount;
      dailyMap.set(dateStr, d);
    }

    // Add Google Ads to costsByCategory
    if (totalAdsCost > 0) {
      costsByCategory.set(
        "GOOGLE_ADS",
        (costsByCategory.get("GOOGLE_ADS") || 0) + totalAdsCost,
      );
    }

    // ─── 6. Calculate daily profit ───
    const daily = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        profit: d.commission + d.manualRevenue - d.adsCost - d.manualCosts,
      }));

    const totalCosts = totalAdsCost + totalManualCosts;
    const totalProfit = totalCommission + totalManualRevenue - totalCosts;

    // ─── 7. Per-domain breakdown ───
    const domainBreakdown: any[] = [];

    for (const int of allIntegrations) {
      const stats = domainRevenue.get(int.domainId);
      if (!stats || (stats.revenue === 0 && stats.conversions === 0)) continue;

      const isCommissionBased =
        domainCategoryMap.get(int.domainId) === "ECOMMERCE";
      const rate = isCommissionBased ? 0.12 : 1.0;

      domainBreakdown.push({
        domainId: int.domainId,
        label: domainLabelMap.get(int.domainId) || int.domainId,
        revenue: stats.revenue,
        commission: stats.revenue * rate,
        manualRevenue: manualRevByDomain.get(int.domainId) || 0,
        conversions: stats.conversions,
        isCommissionBased,
      });
    }

    // Add domains with ONLY manual revenue (no GA4)
    for (const [dId, amount] of manualRevByDomain) {
      if (!domainBreakdown.find((d) => d.domainId === dId)) {
        // Fetch label if not already loaded
        let label = domainLabelMap.get(dId);
        if (!label) {
          const dom = await prisma.domain.findUnique({
            where: { id: dId },
            select: { label: true, domain: true },
          });
          label = dom?.label || dom?.domain || dId;
        }
        domainBreakdown.push({
          domainId: dId,
          label,
          revenue: 0,
          commission: 0,
          manualRevenue: amount,
          conversions: 0,
          isCommissionBased: false,
        });
      }
    }

    domainBreakdown.sort(
      (a, b) =>
        b.commission + b.manualRevenue - (a.commission + a.manualRevenue),
    );

    // ─── 8. Breakdowns ───
    const costBreakdown = Array.from(costsByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const revenueBreakdown = Array.from(revenueByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      period: {
        startDate,
        endDate,
        days: Math.round((until.getTime() - since.getTime()) / 86400000),
      },
      totals: {
        revenue: totalRevenue,
        commission: totalCommission,
        manualRevenue: totalManualRevenue,
        totalIncome: totalCommission + totalManualRevenue,
        adsCost: totalAdsCost,
        manualCosts: totalManualCosts,
        totalCosts,
        profit: totalProfit,
        conversions: totalConversions,
        margin:
          totalCommission + totalManualRevenue > 0
            ? (totalProfit / (totalCommission + totalManualRevenue)) * 100
            : 0,
      },
      daily,
      domainBreakdown,
      costBreakdown,
      revenueBreakdown,
    };
  });

  // ═══════════════════════════════════════════════════════════
  // STOJAN BACKFILL (one-time)
  // ═══════════════════════════════════════════════════════════

  fastify.post("/stojan-backfill", async () => {
    const STOJAN_API_URL =
      process.env.STOJAN_API_URL || "http://16.171.6.205:4000";
    const STOJAN_API_KEY = process.env.STOJAN_API_KEY || "";
    const STOJAN_INTEGRATION_ID = process.env.STOJAN_INTEGRATION_ID || "";

    if (!STOJAN_API_KEY || !STOJAN_INTEGRATION_ID) {
      return {
        error: "STOJAN_API_KEY and STOJAN_INTEGRATION_ID required in .env",
      };
    }

    const url = `${STOJAN_API_URL}/api/integration/daily-stats?startDate=2020-01-01&endDate=${new Date().toISOString().split("T")[0]}&apiKey=${STOJAN_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return { error: `Stojan API: ${res.status}` };

    const data = (await res.json()) as any;
    let upserted = 0;

    for (const day of data.daily) {
      await prisma.integrationDaily.upsert({
        where: {
          integrationId_date: {
            integrationId: STOJAN_INTEGRATION_ID,
            date: new Date(day.date),
          },
        },
        update: {
          conversions: day.orders,
          revenue: day.revenue,
        },
        create: {
          integrationId: STOJAN_INTEGRATION_ID,
          date: new Date(day.date),
          sessions: 0,
          users: 0,
          conversions: day.orders,
          revenue: day.revenue,
        },
      });
      upserted++;
    }

    return {
      totalOrders: data.totals.orders,
      totalRevenue: data.totals.revenue,
      daysUpserted: upserted,
      firstDay: data.daily[0]?.date,
      lastDay: data.daily[data.daily.length - 1]?.date,
    };
  });

  // ─── STOJAN WEBHOOK — order created/paid ───
  fastify.post("/webhook/stojan-order", async (request, reply) => {
    const { apiKey, date, revenue, orders } = request.body as any;

    if (apiKey !== process.env.STOJAN_API_KEY) {
      return reply.code(401).send({ error: "Invalid API key" });
    }

    const intId = process.env.STOJAN_INTEGRATION_ID;
    if (!intId)
      return reply.code(500).send({ error: "STOJAN_INTEGRATION_ID not set" });

    const dateObj = new Date(date);

    await prisma.integrationDaily.upsert({
      where: { integrationId_date: { integrationId: intId, date: dateObj } },
      update: { conversions: orders, revenue },
      create: {
        integrationId: intId,
        date: dateObj,
        sessions: 0,
        users: 0,
        conversions: orders,
        revenue,
      },
    });

    return { ok: true, date, orders, revenue };
  });
}
