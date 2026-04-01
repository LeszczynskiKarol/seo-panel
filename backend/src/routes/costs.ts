// backend/src/routes/costs.ts

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function costRoutes(fastify: FastifyInstance) {
  // ─── LIST COSTS ───
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

    const costs = await prisma.manualCost.findMany({
      where,
      include: { domain: { select: { id: true, label: true, domain: true } } },
      orderBy: { date: "desc" },
    });

    return costs;
  });

  // ─── ADD COST ───
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

  // ─── UPDATE COST ───
  fastify.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    if (data.date) data.date = new Date(data.date);
    if (data.amount) data.amount = parseFloat(data.amount);

    return prisma.manualCost.update({ where: { id }, data });
  });

  // ─── DELETE COST ───
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.manualCost.delete({ where: { id } });
    return reply.code(204).send();
  });

  // ─── GLOBAL PROFITABILITY SUMMARY ───
  fastify.get("/global-summary", async (request) => {
    const { startDate, endDate } = request.query as any;

    if (!startDate || !endDate) {
      return { error: "startDate and endDate required" };
    }

    const since = new Date(startDate);
    const until = new Date(endDate);

    // 1. All GA4 revenue across all domains
    const allIntegrations = await prisma.domainIntegration.findMany({
      where: { provider: "GOOGLE_ANALYTICS", status: "ACTIVE" },
      select: { id: true, domainId: true, cachedData: true },
    });

    const intIds = allIntegrations.map((i) => i.id);

    const ga4Daily = await prisma.integrationDaily.findMany({
      where: {
        integrationId: { in: intIds },
        date: { gte: since, lte: until },
      },
    });

    // Group by integration → domain
    const intToDomain = new Map(allIntegrations.map((i) => [i.id, i.domainId]));

    const STOJAN_ID = "cmn9fo4dn0004qrdye8hjou1g";

    let totalRevenue = 0;
    let totalCommission = 0; // revenue after commission logic
    let totalConversions = 0;
    const dailyMap = new Map<
      string,
      {
        date: string;
        revenue: number;
        commission: number;
        adsCost: number;
        manualCosts: number;
        profit: number;
        conversions: number;
      }
    >();
    const domainRevenue = new Map<string, number>();

    for (const g of ga4Daily) {
      const domainId = intToDomain.get(g.integrationId) || "";
      const isStorjan = domainId === STOJAN_ID;
      const rate = isStorjan ? 0.12 : 1.0;
      const rev = g.revenue || 0;
      const comm = rev * rate;

      totalRevenue += rev;
      totalCommission += comm;
      totalConversions += g.conversions || 0;

      domainRevenue.set(domainId, (domainRevenue.get(domainId) || 0) + rev);

      const dateStr = g.date.toISOString().split("T")[0];
      const d = dailyMap.get(dateStr) || {
        date: dateStr,
        revenue: 0,
        commission: 0,
        adsCost: 0,
        manualCosts: 0,
        profit: 0,
        conversions: 0,
      };
      d.revenue += rev;
      d.commission += comm;
      d.conversions += g.conversions || 0;
      dailyMap.set(dateStr, d);
    }

    // 2. All Ads costs
    const adsCosts = await prisma.adsCampaignDaily.findMany({
      where: { date: { gte: since, lte: until } },
    });

    let totalAdsCost = 0;
    for (const a of adsCosts) {
      totalAdsCost += a.cost;
      const dateStr = a.date.toISOString().split("T")[0];
      const d = dailyMap.get(dateStr) || {
        date: dateStr,
        revenue: 0,
        commission: 0,
        adsCost: 0,
        manualCosts: 0,
        profit: 0,
        conversions: 0,
      };
      d.adsCost += a.cost;
      dailyMap.set(dateStr, d);
    }

    // 3. Manual costs
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
      const d = dailyMap.get(dateStr) || {
        date: dateStr,
        revenue: 0,
        commission: 0,
        adsCost: 0,
        manualCosts: 0,
        profit: 0,
        conversions: 0,
      };
      d.manualCosts += mc.amount;
      dailyMap.set(dateStr, d);
    }

    // Add Google Ads to costsByCategory
    costsByCategory.set(
      "GOOGLE_ADS",
      (costsByCategory.get("GOOGLE_ADS") || 0) + totalAdsCost,
    );

    // 4. Calculate daily profit
    const daily = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        profit: d.commission - d.adsCost - d.manualCosts,
      }));

    const totalCosts = totalAdsCost + totalManualCosts;
    const totalProfit = totalCommission - totalCosts;

    // 5. Per-domain breakdown
    const domainBreakdown = [];
    for (const int of allIntegrations) {
      const rev = domainRevenue.get(int.domainId) || 0;
      if (rev === 0) continue;
      const isStorjan = int.domainId === STOJAN_ID;
      const rate = isStorjan ? 0.12 : 1.0;

      const domain = await prisma.domain.findUnique({
        where: { id: int.domainId },
        select: { label: true, domain: true },
      });

      domainBreakdown.push({
        domainId: int.domainId,
        label: domain?.label || domain?.domain || int.domainId,
        revenue: rev,
        commission: rev * rate,
        isCommissionBased: isStorjan,
      });
    }
    domainBreakdown.sort((a, b) => b.commission - a.commission);

    // 6. Cost breakdown
    const costBreakdown = Array.from(costsByCategory.entries())
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
        adsCost: totalAdsCost,
        manualCosts: totalManualCosts,
        totalCosts,
        profit: totalProfit,
        conversions: totalConversions,
        margin: totalCommission > 0 ? (totalProfit / totalCommission) * 100 : 0,
      },
      daily,
      domainBreakdown,
      costBreakdown,
    };
  });

  // ─── STOJAN BACKFILL (one-time) ───
  fastify.post("/stojan-backfill", async (request) => {
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

    const data = await res.json();
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
}
