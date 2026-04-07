// backend/src/routes/profitability.ts

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function profitabilityRoutes(fastify: FastifyInstance) {
  fastify.get("/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { days, startDate, endDate } = request.query as {
      days?: string;
      startDate?: string;
      endDate?: string;
    };
    const since = startDate
      ? new Date(startDate)
      : new Date(Date.now() - parseInt(days || "30") * 86400000);
    const until = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;
    const dateFilter = { gte: since, ...(until ? { lte: until } : {}) };

    // Determine commission rate by domain category
    const domainInfo = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { category: true },
    });
    const isCommissionBased = domainInfo?.category === "ECOMMERCE";
    const COMMISSION_RATE = isCommissionBased ? 0.12 : 1.0;

    // ─── 1. GA4 daily (all revenue, all channels) ───
    const integration = await prisma.domainIntegration.findFirst({
      where: { domainId, provider: "GOOGLE_ANALYTICS", status: "ACTIVE" },
    });

    let ga4Daily: any[] = [];
    let bySource: any[] = [];

    if (integration) {
      ga4Daily = await prisma.integrationDaily.findMany({
        where: { integrationId: integration.id, date: dateFilter },
        orderBy: { date: "asc" },
      });
      bySource = (integration.cachedData as any)?.bySource || [];
    }

    // ─── 2. Ads daily (costs) ───
    const adsCampaignDaily = await prisma.adsCampaignDaily.findMany({
      where: { domainId, date: dateFilter },
      orderBy: { date: "asc" },
    });

    // ─── 3. Ads products (for product-level profitability) ───
    const adsProducts = await prisma.adsProductDaily.groupBy({
      by: ["productId", "productTitle", "productCategory"],
      where: { domainId, date: dateFilter },
      _sum: {
        cost: true,
        clicks: true,
        impressions: true,
        conversions: true,
        conversionValue: true,
      },
    });

    // ─── 4. Manual revenue for this domain ───
    const manualRevenues = await prisma.manualRevenue.findMany({
      where: { domainId, date: dateFilter },
      orderBy: { date: "asc" },
    });

    let totalManualRevenue = 0;

    // ─── 5. Build daily P&L ───
    const dailyMap = new Map<
      string,
      {
        date: string;
        ga4Revenue: number;
        ga4Sessions: number;
        ga4Conversions: number;
        ga4Users: number;
        adsCost: number;
        adsClicks: number;
        adsConversions: number;
        adsRevenue: number;
        manualRevenue: number;
        commission: number;
        profit: number;
      }
    >();

    const emptyDay = (dateStr: string) => ({
      date: dateStr,
      ga4Revenue: 0,
      ga4Sessions: 0,
      ga4Conversions: 0,
      ga4Users: 0,
      adsCost: 0,
      adsClicks: 0,
      adsConversions: 0,
      adsRevenue: 0,
      manualRevenue: 0,
      commission: 0,
      profit: 0,
    });

    for (const g of ga4Daily) {
      const dateStr = g.date.toISOString().split("T")[0];
      const e = dailyMap.get(dateStr) || emptyDay(dateStr);
      e.ga4Revenue += g.revenue || 0;
      e.ga4Sessions += g.sessions || 0;
      e.ga4Conversions += g.conversions || 0;
      e.ga4Users += g.users || 0;
      dailyMap.set(dateStr, e);
    }

    for (const a of adsCampaignDaily) {
      const dateStr = a.date.toISOString().split("T")[0];
      const e = dailyMap.get(dateStr) || emptyDay(dateStr);
      e.adsCost += a.cost;
      e.adsClicks += a.clicks;
      e.adsConversions += a.conversions;
      e.adsRevenue += a.conversionValue;
      dailyMap.set(dateStr, e);
    }

    for (const mr of manualRevenues) {
      totalManualRevenue += mr.amount;
      const dateStr = mr.date.toISOString().split("T")[0];
      const e = dailyMap.get(dateStr) || emptyDay(dateStr);
      e.manualRevenue += mr.amount;
      dailyMap.set(dateStr, e);
    }

    // Calculate commission & profit per day
    for (const [, day] of dailyMap) {
      day.commission = day.ga4Revenue * COMMISSION_RATE;
      day.profit = day.commission + day.manualRevenue - day.adsCost;
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // ─── 6. Totals ───
    const totalRevenue = daily.reduce((s, day) => s + day.ga4Revenue, 0);
    const totalCommission = totalRevenue * COMMISSION_RATE;
    const totalAdsCost = daily.reduce((s, day) => s + day.adsCost, 0);
    const totalProfit = totalCommission + totalManualRevenue - totalAdsCost;
    const totalSessions = daily.reduce((s, day) => s + day.ga4Sessions, 0);
    const totalConversions = daily.reduce(
      (s, day) => s + day.ga4Conversions,
      0,
    );
    const totalUsers = daily.reduce((s, day) => s + day.ga4Users, 0);
    const totalAdsConversions = daily.reduce(
      (s, day) => s + day.adsConversions,
      0,
    );

    const avgOrderValue =
      totalConversions > 0 ? totalRevenue / totalConversions : 0;
    const commissionPerOrder = avgOrderValue * COMMISSION_RATE;
    const cac =
      totalAdsConversions > 0 ? totalAdsCost / totalAdsConversions : 0;
    const revenuePerVisit =
      totalSessions > 0 ? totalRevenue / totalSessions : 0;
    const commissionPerVisit =
      totalSessions > 0 ? totalCommission / totalSessions : 0;
    const conversionRate =
      totalSessions > 0 ? totalConversions / totalSessions : 0;
    const profitableDays = daily.filter((day) => day.profit >= 0).length;
    const breakEvenDailyRevenue =
      totalAdsCost > 0 && daily.length > 0
        ? totalAdsCost / daily.length / COMMISSION_RATE
        : 0;

    // ─── 7. Channel breakdown (from GA4 bySource) ───
    const channels = bySource
      .map((s: any) => {
        const isOrganic = s.sourceMedium?.includes("organic");
        const isPaid =
          s.sourceMedium?.includes("cpc") || s.sourceMedium?.includes("paid");
        const isDirect =
          s.sourceMedium?.includes("(direct)") ||
          s.sourceMedium?.includes("(none)");
        const isReferral = s.sourceMedium?.includes("referral");

        let channel = "Inne";
        if (isOrganic) channel = "Organic";
        else if (isPaid) channel = "Paid (Google Ads)";
        else if (isDirect) channel = "Direct";
        else if (isReferral) channel = "Referral";

        return {
          sourceMedium: s.sourceMedium,
          channel,
          sessions: s.sessions || 0,
          conversions: s.conversions || 0,
          revenue: s.revenue || 0,
          commission: (s.revenue || 0) * COMMISSION_RATE,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // Aggregate by channel
    const channelMap = new Map<
      string,
      {
        channel: string;
        sessions: number;
        conversions: number;
        revenue: number;
        commission: number;
        cost: number;
        profit: number;
      }
    >();
    for (const c of channels) {
      const e = channelMap.get(c.channel) || {
        channel: c.channel,
        sessions: 0,
        conversions: 0,
        revenue: 0,
        commission: 0,
        cost: 0,
        profit: 0,
      };
      e.sessions += c.sessions;
      e.conversions += c.conversions;
      e.revenue += c.revenue;
      e.commission += c.commission;
      channelMap.set(c.channel, e);
    }
    // Assign ads cost only to Paid channel
    const paidChannel = channelMap.get("Paid (Google Ads)");
    if (paidChannel) paidChannel.cost = totalAdsCost;
    for (const [, ch] of channelMap) {
      ch.profit = ch.commission - ch.cost;
    }
    const channelSummary = Array.from(channelMap.values()).sort(
      (a, b) => b.revenue - a.revenue,
    );

    // ─── 8. Product profitability (top products) ───
    const productProfit = adsProducts
      .map((p) => {
        const revenue = p._sum.conversionValue || 0;
        const cost = p._sum.cost || 0;
        const commission = revenue * COMMISSION_RATE;
        return {
          productId: p.productId,
          title: p.productTitle,
          category: p.productCategory,
          revenue,
          cost,
          commission,
          profit: commission - cost,
          clicks: p._sum.clicks || 0,
          conversions: p._sum.conversions || 0,
        };
      })
      .filter((p) => p.cost > 0 || p.revenue > 0)
      .sort((a, b) => b.profit - a.profit);

    return {
      period: {
        days:
          Math.round(
            (new Date(endDate || Date.now()).getTime() - since.getTime()) /
              86400000,
          ) + 1,
        from: daily[0]?.date,
        to: daily[daily.length - 1]?.date,
      },
      totals: {
        revenue: totalRevenue,
        commission: totalCommission,
        manualRevenue: totalManualRevenue,
        totalIncome: totalCommission + totalManualRevenue,
        adsCost: totalAdsCost,
        profit: totalProfit,
        sessions: totalSessions,
        users: totalUsers,
        conversions: totalConversions,
        adsConversions: totalAdsConversions,
        realRoas: totalAdsCost > 0 ? totalCommission / totalAdsCost : 0,
      },
      kpis: {
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        commissionPerOrder: Math.round(commissionPerOrder * 100) / 100,
        cac: Math.round(cac * 100) / 100,
        revenuePerVisit: Math.round(revenuePerVisit * 100) / 100,
        commissionPerVisit: Math.round(commissionPerVisit * 100) / 100,
        conversionRate: Math.round(conversionRate * 10000) / 100,
        profitableDays,
        totalDays: daily.length,
        breakEvenDailyRevenue: Math.round(breakEvenDailyRevenue),
      },
      daily,
      channels: channelSummary,
      channelDetail: channels,
      products: productProfit.slice(0, 200),
      hasGA4: !!integration,
      hasAds: adsCampaignDaily.length > 0,
      isCommissionBased,
      commissionRate: COMMISSION_RATE,
    };
  });
}
