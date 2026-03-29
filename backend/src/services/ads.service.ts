// backend/src/services/ads.service.ts

import { prisma } from "../lib/prisma.js";

// Google Ads API client setup
// Will use google-ads-api npm package once Basic Access is granted

const ADS_CONFIG = {
  client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
  customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID || "",
  mcc_id: process.env.GOOGLE_ADS_MCC_ID || "",
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
};

export class AdsService {
  private isConfigured(): boolean {
    return (
      ADS_CONFIG.refresh_token !== "" &&
      ADS_CONFIG.refresh_token !== "PENDING_APPROVAL"
    );
  }

  // ─── CAMPAIGN PERFORMANCE ─────────────────────────────────
  async syncCampaignDaily(domainId: string, days = 30) {
    if (!this.isConfigured()) {
      return {
        error:
          "Google Ads API not configured — waiting for Basic Access approval",
      };
    }

    const client = new GoogleAdsApi({
      client_id: ADS_CONFIG.client_id,
      client_secret: ADS_CONFIG.client_secret,
      developer_token: ADS_CONFIG.developer_token,
    });
    const customer = client.Customer({
      customer_id: ADS_CONFIG.customer_id,
      login_customer_id: ADS_CONFIG.mcc_id,
      refresh_token: ADS_CONFIG.refresh_token,
    });

    const campaigns = await customer.query(`
       SELECT
         campaign.id,
         campaign.name,
         campaign.advertising_channel_type,
         metrics.cost_micros,
         metrics.clicks,
         metrics.impressions,
         metrics.conversions,
         metrics.conversions_value,
         segments.date
       FROM campaign
       WHERE segments.date DURING LAST_${days}_DAYS
         AND campaign.status = 'ENABLED'
       ORDER BY segments.date DESC
     `);

    return {
      status: "pending_approval",
      message: "Waiting for Google Ads API Basic Access",
    };
  }

  // ─── PRODUCT PERFORMANCE (Shopping/PMax) ──────────────────
  async syncProductDaily(domainId: string, days = 30) {
    if (!this.isConfigured()) {
      return { error: "Google Ads API not configured" };
    }

    const products = await customer.query(`
       SELECT
         segments.product_item_id,
         segments.product_title,
         segments.product_type_l1,
         metrics.cost_micros,
         metrics.clicks,
         metrics.impressions,
         metrics.conversions,
         metrics.conversions_value,
         segments.date
       FROM shopping_performance_view
       WHERE segments.date DURING LAST_${days}_DAYS
       ORDER BY metrics.conversions_value DESC
     `);

    return { status: "pending_approval" };
  }

  // ─── SEARCH TERMS ─────────────────────────────────────────
  async syncSearchTerms(domainId: string, days = 30) {
    if (!this.isConfigured()) {
      return { error: "Google Ads API not configured" };
    }

    const terms = await customer.query(`
       SELECT
         search_term_view.search_term,
         campaign.id,
         campaign.name,
         metrics.cost_micros,
         metrics.clicks,
         metrics.impressions,
         metrics.conversions,
         metrics.conversions_value,
         segments.date
       FROM search_term_view
       WHERE segments.date DURING LAST_${days}_DAYS
       ORDER BY metrics.impressions DESC
       LIMIT 500
     `);

    return { status: "pending_approval" };
  }

  // ─── GET CACHED DATA FOR FRONTEND ─────────────────────────

  async getCampaignOverview(domainId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);

    const daily = await prisma.adsCampaignDaily.findMany({
      where: { domainId, date: { gte: since } },
      orderBy: { date: "asc" },
    });

    // Aggregate by date
    const byDate = new Map<
      string,
      {
        date: string;
        cost: number;
        clicks: number;
        impressions: number;
        conversions: number;
        revenue: number;
      }
    >();
    for (const d of daily) {
      const dateStr = d.date.toISOString().split("T")[0];
      const existing = byDate.get(dateStr) || {
        date: dateStr,
        cost: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        revenue: 0,
      };
      existing.cost += d.cost;
      existing.clicks += d.clicks;
      existing.impressions += d.impressions;
      existing.conversions += d.conversions;
      existing.revenue += d.conversionValue;
      byDate.set(dateStr, existing);
    }

    const chartData = Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // Aggregate by campaign
    const byCampaign = new Map<
      string,
      {
        id: string;
        name: string;
        type: string;
        cost: number;
        clicks: number;
        impressions: number;
        conversions: number;
        revenue: number;
        days: number;
      }
    >();
    for (const d of daily) {
      const existing = byCampaign.get(d.campaignId) || {
        id: d.campaignId,
        name: d.campaignName,
        type: d.campaignType,
        cost: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        revenue: 0,
        days: 0,
      };
      existing.cost += d.cost;
      existing.clicks += d.clicks;
      existing.impressions += d.impressions;
      existing.conversions += d.conversions;
      existing.revenue += d.conversionValue;
      existing.days++;
      byCampaign.set(d.campaignId, existing);
    }

    const campaigns = Array.from(byCampaign.values())
      .map((c) => ({
        ...c,
        cpc: c.clicks > 0 ? c.cost / c.clicks : 0,
        ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
        roas: c.cost > 0 ? c.revenue / c.cost : 0,
        convRate: c.clicks > 0 ? c.conversions / c.clicks : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Totals
    const totals = {
      cost: daily.reduce((s, d) => s + d.cost, 0),
      clicks: daily.reduce((s, d) => s + d.clicks, 0),
      impressions: daily.reduce((s, d) => s + d.impressions, 0),
      conversions: daily.reduce((s, d) => s + d.conversions, 0),
      revenue: daily.reduce((s, d) => s + d.conversionValue, 0),
      roas: 0,
      cpc: 0,
      ctr: 0,
    };
    totals.roas = totals.cost > 0 ? totals.revenue / totals.cost : 0;
    totals.cpc = totals.clicks > 0 ? totals.cost / totals.clicks : 0;
    totals.ctr =
      totals.impressions > 0 ? totals.clicks / totals.impressions : 0;

    return { totals, campaigns, chartData, isConfigured: this.isConfigured() };
  }

  async getProductPerformance(domainId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);

    const products = await prisma.adsProductDaily.groupBy({
      by: ["productId", "productTitle", "productCategory"],
      where: { domainId, date: { gte: since } },
      _sum: {
        cost: true,
        clicks: true,
        impressions: true,
        conversions: true,
        conversionValue: true,
      },
    });

    return products
      .map((p) => ({
        productId: p.productId,
        title: p.productTitle,
        category: p.productCategory,
        cost: p._sum.cost || 0,
        clicks: p._sum.clicks || 0,
        impressions: p._sum.impressions || 0,
        conversions: p._sum.conversions || 0,
        revenue: p._sum.conversionValue || 0,
        roas:
          (p._sum.cost || 0) > 0
            ? (p._sum.conversionValue || 0) / (p._sum.cost || 0)
            : 0,
        cpc:
          (p._sum.clicks || 0) > 0
            ? (p._sum.cost || 0) / (p._sum.clicks || 0)
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async getSearchTerms(domainId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);

    const terms = await prisma.adsSearchTerm.groupBy({
      by: ["searchTerm"],
      where: { domainId, date: { gte: since } },
      _sum: {
        cost: true,
        clicks: true,
        impressions: true,
        conversions: true,
        conversionValue: true,
      },
    });

    return terms
      .map((t) => ({
        term: t.searchTerm,
        cost: t._sum.cost || 0,
        clicks: t._sum.clicks || 0,
        impressions: t._sum.impressions || 0,
        conversions: t._sum.conversions || 0,
        revenue: t._sum.conversionValue || 0,
        roas:
          (t._sum.cost || 0) > 0
            ? (t._sum.conversionValue || 0) / (t._sum.cost || 0)
            : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions);
  }

  // ─── ADS vs ORGANIC COMPARISON ────────────────────────────
  async getAdsVsOrganic(domainId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);

    // Get paid search terms
    const paidTerms = await prisma.adsSearchTerm.groupBy({
      by: ["searchTerm"],
      where: { domainId, date: { gte: since } },
      _sum: {
        clicks: true,
        impressions: true,
        cost: true,
        conversions: true,
        conversionValue: true,
      },
    });

    // Get organic queries from GscPageDaily
    const organicDaily = await prisma.gscPageDaily.findMany({
      where: { page: { domainId }, date: { gte: since } },
      select: { topQueries: true },
    });

    const organicMap = new Map<
      string,
      { clicks: number; impressions: number; position: number; count: number }
    >();
    for (const d of organicDaily) {
      if (!d.topQueries) continue;
      for (const q of d.topQueries as any[]) {
        if (!q.query) continue;
        const existing = organicMap.get(q.query) || {
          clicks: 0,
          impressions: 0,
          position: 0,
          count: 0,
        };
        existing.clicks += q.clicks || 0;
        existing.impressions += q.impressions || 0;
        existing.position += q.position || 0;
        existing.count++;
        organicMap.set(q.query, existing);
      }
    }

    // Match paid with organic
    const comparison = paidTerms
      .map((pt) => {
        const organic = organicMap.get(pt.searchTerm);
        return {
          term: pt.searchTerm,
          paid: {
            clicks: pt._sum.clicks || 0,
            impressions: pt._sum.impressions || 0,
            cost: pt._sum.cost || 0,
            conversions: pt._sum.conversions || 0,
            revenue: pt._sum.conversionValue || 0,
          },
          organic: organic
            ? {
                clicks: organic.clicks,
                impressions: organic.impressions,
                avgPosition:
                  organic.count > 0 ? organic.position / organic.count : 0,
              }
            : null,
          hasOrganic: !!organic,
        };
      })
      .sort((a, b) => (b.paid.cost || 0) - (a.paid.cost || 0));

    return {
      terms: comparison,
      summary: {
        totalPaidTerms: paidTerms.length,
        withOrganicPresence: comparison.filter((c) => c.hasOrganic).length,
        purelyPaid: comparison.filter((c) => !c.hasOrganic).length,
        potentialSavings: comparison
          .filter((c) => c.hasOrganic && (c.organic?.avgPosition || 99) <= 5)
          .reduce((s, c) => s + (c.paid.cost || 0), 0),
      },
    };
  }
}
