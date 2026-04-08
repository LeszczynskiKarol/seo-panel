// backend/src/services/ads.service.ts

import { GoogleAdsApi } from "google-ads-api";
import { prisma } from "../lib/prisma.js";

const ADS_CONFIG = {
  client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
  customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID || "",
  mcc_id: process.env.GOOGLE_ADS_MCC_ID || "",
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
};

export class AdsService {
  private client: GoogleAdsApi;

  constructor() {
    this.client = new GoogleAdsApi({
      client_id: ADS_CONFIG.client_id,
      client_secret: ADS_CONFIG.client_secret,
      developer_token: ADS_CONFIG.developer_token,
    });
  }

  private getCustomer() {
    return this.client.Customer({
      customer_id: ADS_CONFIG.customer_id,
      login_customer_id: ADS_CONFIG.mcc_id,
      refresh_token: ADS_CONFIG.refresh_token,
    });
  }

  isConfigured(): boolean {
    return !!ADS_CONFIG.refresh_token && ADS_CONFIG.refresh_token !== "PENDING";
  }

  // ─── SYNC CAMPAIGNS ──────────────────────────────────────
  async syncCampaignDaily(domainId: string, days = 30) {
    console.log(
      "[Ads] syncCampaignDaily called, configured:",
      this.isConfigured(),
    );
    console.log("[Ads] config:", {
      hasClientId: !!ADS_CONFIG.client_id,
      hasSecret: !!ADS_CONFIG.client_secret,
      hasDevToken: !!ADS_CONFIG.developer_token,
      hasCustomerId: !!ADS_CONFIG.customer_id,
      hasMccId: !!ADS_CONFIG.mcc_id,
      hasRefreshToken: !!ADS_CONFIG.refresh_token,
    });

    if (!this.isConfigured()) return { error: "Google Ads not configured" };

    try {
      const customer = this.getCustomer();
      console.log("[Ads] Customer created, querying campaigns...");
      // DEBUG — list accessible customers
      try {
        const accessible = await this.client.listAccessibleCustomers(
          ADS_CONFIG.refresh_token,
        );
        console.log("[Ads] Accessible customers:", JSON.stringify(accessible));
      } catch (e: any) {
        console.error("[Ads] listAccessibleCustomers error:", e.message);
      }
      const rows = await customer.query(`
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
        WHERE segments.date BETWEEN '${this.daysAgo(days)}' AND '${this.today()}'
          AND campaign.status = 'ENABLED'
        ORDER BY segments.date DESC
      `);

      console.log(`[Ads] Got ${rows.length} rows from API`);
      if (rows.length > 0) {
        console.log("[Ads] Sample row:", JSON.stringify(rows[0]));
      }

      let created = 0;

      for (const row of rows) {
        const campaignId = String(row.campaign?.id);
        const date = new Date(row.segments?.date + "T00:00:00Z");
        const cost = (row.metrics?.cost_micros || 0) / 1_000_000;
        const clicks = row.metrics?.clicks || 0;
        const impressions = row.metrics?.impressions || 0;
        const conversions = row.metrics?.conversions || 0;
        const conversionValue = row.metrics?.conversions_value || 0;

        try {
          await prisma.adsCampaignDaily.upsert({
            where: { campaignId_date: { campaignId, date } },
            update: {
              cost,
              clicks,
              impressions,
              conversions,
              conversionValue,
              ctr: impressions > 0 ? clicks / impressions : null,
              cpc: clicks > 0 ? cost / clicks : null,
              roas: cost > 0 ? conversionValue / cost : null,
            },
            create: {
              domainId,
              campaignId,
              campaignName: row.campaign?.name || "Unknown",
              campaignType: String(
                row.campaign?.advertising_channel_type || "UNKNOWN",
              ),
              date,
              cost,
              clicks,
              impressions,
              conversions,
              conversionValue,
              ctr: impressions > 0 ? clicks / impressions : null,
              cpc: clicks > 0 ? cost / clicks : null,
              roas: cost > 0 ? conversionValue / cost : null,
            },
          });
          created++;
        } catch (e: any) {
          console.error("[Ads] Upsert error:", e.message);
        }
      }

      console.log(`[Ads] Saved ${created} campaign daily records`);
      return { rows: rows.length, created };
    } catch (e: any) {
      console.error("[Ads] API Error:", e.message);
      console.error(
        "[Ads] Full error:",
        JSON.stringify(e.errors || e, null, 2),
      );
      return { error: e.message };
    }
  }

  // ─── SYNC PRODUCTS (Shopping/PMax) ────────────────────────
  async syncProductDaily(domainId: string, days = 30) {
    if (!this.isConfigured()) return { error: "Google Ads not configured" };

    try {
      const customer = this.getCustomer();
      console.log("[Ads] Syncing products...");

      const rows = await customer.query(`
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
        WHERE segments.date BETWEEN '${this.daysAgo(days)}' AND '${this.today()}'
        ORDER BY metrics.conversions_value DESC
      `);

      console.log(`[Ads] Got ${rows.length} product rows`);
      if (rows.length > 0)
        console.log("[Ads] Sample product:", JSON.stringify(rows[0]));

      let saved = 0;
      for (const row of rows) {
        const productId = row.segments?.product_item_id || "unknown";
        const date = new Date(row.segments?.date + "T00:00:00Z");
        const cost = (row.metrics?.cost_micros || 0) / 1_000_000;
        const clicks = row.metrics?.clicks || 0;
        const impressions = row.metrics?.impressions || 0;
        const conversions = row.metrics?.conversions || 0;
        const conversionValue = row.metrics?.conversions_value || 0;

        try {
          await prisma.adsProductDaily.upsert({
            where: { productId_date: { productId, date } },
            update: {
              cost,
              clicks,
              impressions,
              conversions,
              conversionValue,
              ctr: impressions > 0 ? clicks / impressions : null,
              roas: cost > 0 ? conversionValue / cost : null,
            },
            create: {
              domainId,
              productId,
              productTitle: row.segments?.product_title || "Unknown",
              productCategory: row.segments?.product_type_l1 || null,
              date,
              cost,
              clicks,
              impressions,
              conversions,
              conversionValue,
              ctr: impressions > 0 ? clicks / impressions : null,
              roas: cost > 0 ? conversionValue / cost : null,
            },
          });
          saved++;
        } catch {}
      }

      console.log(`[Ads] Saved ${saved} product records`);
      return { rows: rows.length, saved };
    } catch (e: any) {
      console.error("[Ads] Products error:", e.message);
      return { error: e.message };
    }
  }

  // ─── GET CACHED DATA FOR FRONTEND ─────────────────────────

  async getCampaignOverview(domainId: string, days = 30) {
    const since =
      days === 0
        ? new Date(new Date().toISOString().split("T")[0])
        : days === 1
          ? new Date(
              new Date(Date.now() - 86400000).toISOString().split("T")[0],
            )
          : new Date(Date.now() - days * 86400000);

    const daily = await prisma.adsCampaignDaily.findMany({
      where: { domainId, date: { gte: since } },
      orderBy: { date: "asc" },
    });

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
      const e = byDate.get(dateStr) || {
        date: dateStr,
        cost: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        revenue: 0,
      };
      e.cost += d.cost;
      e.clicks += d.clicks;
      e.impressions += d.impressions;
      e.conversions += d.conversions;
      e.revenue += d.conversionValue;
      byDate.set(dateStr, e);
    }

    const chartData = Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const byCampaign = new Map<string, any>();
    for (const d of daily) {
      const e = byCampaign.get(d.campaignId) || {
        id: d.campaignId,
        name: d.campaignName,
        type: d.campaignType,
        cost: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        revenue: 0,
      };
      e.cost += d.cost;
      e.clicks += d.clicks;
      e.impressions += d.impressions;
      e.conversions += d.conversions;
      e.revenue += d.conversionValue;
      byCampaign.set(d.campaignId, e);
    }

    const campaigns = Array.from(byCampaign.values())
      .map((c) => ({
        ...c,
        cpc: c.clicks > 0 ? c.cost / c.clicks : 0,
        ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
        roas: c.cost > 0 ? c.revenue / c.cost : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

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
    const since =
      days === 0
        ? new Date(new Date().toISOString().split("T")[0])
        : days === 1
          ? new Date(
              new Date(Date.now() - 86400000).toISOString().split("T")[0],
            )
          : new Date(Date.now() - days * 86400000);
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

  // ─── SYNC ASSET GROUP PERFORMANCE ─────────────────────────
  async syncAssetGroupPerformance(domainId: string, days = 30) {
    if (!this.isConfigured()) return { error: "Google Ads not configured" };

    try {
      const customer = this.getCustomer();
      console.log("[Ads] Syncing asset group performance...");

      const rows = await customer.query(`
        SELECT
          asset_group.id,
          asset_group.name,
          asset_group.status,
          asset_group.primary_status,
          asset_group.primary_status_reasons,
          campaign.id,
          campaign.name,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.conversions,
          metrics.conversions_value,
          metrics.all_conversions,
          metrics.interactions
        FROM asset_group
        WHERE segments.date DURING LAST_${days}_DAYS
          AND campaign.advertising_channel_type = 'PERFORMANCE_MAX'
        ORDER BY metrics.conversions_value DESC
      `);

      console.log(`[Ads] Got ${rows.length} asset group rows`);

      const groups = rows.map((row: any) => ({
        assetGroupId: String(row.asset_group?.id),
        assetGroupName: row.asset_group?.name || "Unknown",
        status: row.asset_group?.status,
        primaryStatus: row.asset_group?.primary_status,
        primaryStatusReasons: row.asset_group?.primary_status_reasons || [],
        campaignId: String(row.campaign?.id),
        campaignName: row.campaign?.name || "Unknown",
        cost: (row.metrics?.cost_micros || 0) / 1_000_000,
        clicks: row.metrics?.clicks || 0,
        impressions: row.metrics?.impressions || 0,
        conversions: row.metrics?.conversions || 0,
        conversionValue: row.metrics?.conversions_value || 0,
        allConversions: row.metrics?.all_conversions || 0,
        interactions: row.metrics?.interactions || 0,
      }));

      // Aggregate by asset group (rows are per-day)
      const byGroup = new Map<string, any>();
      for (const g of groups) {
        const existing = byGroup.get(g.assetGroupId);
        if (!existing) {
          byGroup.set(g.assetGroupId, { ...g });
        } else {
          existing.cost += g.cost;
          existing.clicks += g.clicks;
          existing.impressions += g.impressions;
          existing.conversions += g.conversions;
          existing.conversionValue += g.conversionValue;
          existing.allConversions += g.allConversions;
          existing.interactions += g.interactions;
        }
      }

      const result = Array.from(byGroup.values())
        .map((g) => ({
          ...g,
          roas: g.cost > 0 ? g.conversionValue / g.cost : 0,
          cpc: g.clicks > 0 ? g.cost / g.clicks : 0,
          ctr: g.impressions > 0 ? g.clicks / g.impressions : 0,
          convRate: g.clicks > 0 ? g.conversions / g.clicks : 0,
        }))
        .sort((a, b) => b.conversionValue - a.conversionValue);

      return { assetGroups: result, total: result.length };
    } catch (e: any) {
      console.error("[Ads] Asset group error:", e.message);
      return { error: e.message, assetGroups: [] };
    }
  }

  // ─── SYNC ASSET PERFORMANCE (headlines, images, etc.) ─────
  async syncAssetPerformance(domainId: string, days = 30) {
    if (!this.isConfigured()) return { error: "Google Ads not configured" };

    try {
      const customer = this.getCustomer();
      console.log("[Ads] Syncing asset performance...");

      const rows = await customer.query(`
  SELECT
    asset_group_asset.field_type,
    asset_group_asset.status,
    asset.id,
    asset.name,
    asset.type,
    asset.text_asset.text,
    asset_group.id,
    asset_group.name,
    campaign.name
  FROM asset_group_asset
  WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
    AND asset_group_asset.status = 'ENABLED'
`);

      console.log(`[Ads] Got ${rows.length} asset performance rows`);

      const assets = rows.map((row: any) => ({
        assetId: String(row.asset?.id),
        assetName: row.asset?.name || null,
        assetType: row.asset?.type,
        fieldType: row.asset_group_asset?.field_type,
        performanceLabel: "UNAVAILABLE",
        status: row.asset_group_asset?.status,
        // Content based on type
        text: row.asset?.text_asset?.text || null,
        imageUrl: null,
        videoTitle: null,
        // Context
        assetGroupId: String(row.asset_group?.id),
        assetGroupName: row.asset_group?.name || "Unknown",
        campaignName: row.campaign?.name || "Unknown",
      }));

      // Group by fieldType for summary
      const byFieldType = new Map<
        string,
        {
          total: number;
          best: number;
          good: number;
          low: number;
          learning: number;
          unknown: number;
        }
      >();
      for (const a of assets) {
        const ft = a.fieldType || "OTHER";
        const existing = byFieldType.get(ft) || {
          total: 0,
          best: 0,
          good: 0,
          low: 0,
          learning: 0,
          unknown: 0,
        };
        existing.total++;
        switch (a.performanceLabel) {
          case "BEST":
            existing.best++;
            break;
          case "GOOD":
            existing.good++;
            break;
          case "LOW":
            existing.low++;
            break;
          case "LEARNING":
            existing.learning++;
            break;
          default:
            existing.unknown++;
            break;
        }
        byFieldType.set(ft, existing);
      }

      return {
        assets,
        total: assets.length,
        byFieldType: Object.fromEntries(byFieldType),
      };
    } catch (e: any) {
      const errDetail = e.errors
        ? JSON.stringify(e.errors, null, 2)
        : e.message || JSON.stringify(e);
      console.error("[Ads] Asset performance error:", errDetail);
      return { error: errDetail, assets: [], byFieldType: {} };
    }
  }

  // ─── GET AUDIENCE SIGNALS ─────────────────────────────────
  async getAudienceSignals(domainId: string) {
    if (!this.isConfigured()) return { error: "Google Ads not configured" };

    try {
      const customer = this.getCustomer();
      console.log("[Ads] Fetching audience signals...");

      const rows = await customer.query(`
  SELECT
    asset_group.id,
    asset_group.name,
    campaign.name
  FROM asset_group_signal
  WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
`);

      console.log(`[Ads] Got ${rows.length} audience signal rows`);

      const signals = rows.map((row: any) => ({
        assetGroupId: String(row.asset_group?.id),
        assetGroupName: row.asset_group?.name || "Unknown",
        campaignName: row.campaign?.name || "Unknown",
        audiences: row.asset_group_signal?.audience_signal?.audiences || [],
        searchThemes:
          row.asset_group_signal?.audience_signal?.search_themes || [],
      }));

      return { signals, total: signals.length };
    } catch (e: any) {
      console.error("[Ads] Audience signals error:", e.message);
      return { error: e.message, signals: [] };
    }
  }

  async listAccessibleCustomers() {
    try {
      const customers = await this.client.listAccessibleCustomers(
        ADS_CONFIG.refresh_token,
      );
      console.log("[Ads] Accessible customers:", JSON.stringify(customers));
      return customers;
    } catch (e: any) {
      console.error("[Ads] listAccessibleCustomers error:", e.message);
      return { error: e.message };
    }
  }
  private today(): string {
    return new Date().toISOString().split("T")[0];
  }

  private daysAgo(days: number): string {
    return new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  }
}
