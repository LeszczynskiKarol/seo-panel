// backend/src/services/conversion.service.ts

import { prisma } from "../lib/prisma.js";
import { getGoogleAuth } from "../lib/google-auth.js";
import { google, analyticsdata_v1beta } from "googleapis";

type RunReportResponse = analyticsdata_v1beta.Schema$RunReportResponse;
type Row = analyticsdata_v1beta.Schema$Row;

const COMMISSION_RATE = 0.12;

const EXCLUDED_LANDING_PATHS = [
  "/checkout",
  "/checkout/",
  "/checkout/sukces",
  "/checkout/sukces/",
  "/koszyk",
  "/cart",
  "(not set)",
];

function isExcludedLandingPage(path: string): boolean {
  const clean = path.split("?")[0].toLowerCase();
  return EXCLUDED_LANDING_PATHS.some(
    (ex) =>
      clean === ex || clean.startsWith("/checkout/") || clean === "(not set)",
  );
}

export class ConversionService {
  private async getAnalyticsData() {
    const auth = await getGoogleAuth();
    return google.analyticsdata({ version: "v1beta", auth });
  }

  // ═══════════════════════════════════════════════════════════
  // 1. CONVERSION OVERVIEW
  // ═══════════════════════════════════════════════════════════

  async getConversionOverview(
    domainId: string,
    startDate: string,
    endDate: string,
  ) {
    const integration = await this.getGA4Integration(domainId);
    if (!integration)
      return { error: "NO_GA4", message: "Brak integracji GA4 dla tej domeny" };

    const analytics = await this.getAnalyticsData();
    const propertyId = integration.propertyId!;

    // ─── 1a. Daily sessions/users from GA4 (NO conversions/revenue!) ───
    const dailyRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "addToCarts" },
          { name: "checkouts" },
        ],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: "500",
      },
    })) as { data: RunReportResponse };

    const ga4Map = new Map<
      string,
      {
        sessions: number;
        users: number;
        addToCarts: number;
        checkouts: number;
      }
    >();
    for (const r of dailyRes.data.rows || []) {
      const dateStr = r.dimensionValues?.[0]?.value || "";
      const m = r.metricValues || [];
      const gn = (i: number) => parseFloat(m[i]?.value || "0") || 0;
      const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      ga4Map.set(formatted, {
        sessions: Math.round(gn(0)),
        users: Math.round(gn(1)),
        addToCarts: Math.round(gn(2)),
        checkouts: Math.round(gn(3)),
      });
    }

    // ─── 1a2. Conversions/revenue ONLY from IntegrationDaily (webhook = truth) ───
    const localDaily = await prisma.integrationDaily.findMany({
      where: {
        integrationId: integration.id,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      orderBy: { date: "asc" },
    });

    // Build daily: GA4 for sessions/users, IntegrationDaily for conversions/revenue
    const allDates = new Set<string>();
    for (const [d] of ga4Map) allDates.add(d);
    for (const ld of localDaily)
      allDates.add(ld.date.toISOString().split("T")[0]);

    const daily = Array.from(allDates)
      .sort()
      .map((dateStr) => {
        const ga4 = ga4Map.get(dateStr);
        const local = localDaily.find(
          (ld) => ld.date.toISOString().split("T")[0] === dateStr,
        );

        const sessions = ga4?.sessions || local?.sessions || 0;
        const users = ga4?.users || local?.users || 0;
        const conversions = local?.conversions || 0;
        const revenue = local?.revenue || 0;

        return {
          date: dateStr,
          sessions,
          users,
          conversions,
          revenue: Math.round(revenue * 100) / 100,
          purchases: conversions,
          addToCarts: ga4?.addToCarts || 0,
          checkouts: ga4?.checkouts || 0,
          conversionRate: sessions > 0 ? conversions / sessions : 0,
          commission: Math.round(revenue * COMMISSION_RATE * 100) / 100,
        };
      });

    // Webhook totals (used for device/channel distribution)
    const totalWebhookConv = daily.reduce((s, d) => s + d.conversions, 0);
    const totalWebhookRev = daily.reduce((s, d) => s + d.revenue, 0);

    // ─── 1b. By event name ───
    const eventRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "eventName" }],
        metrics: [
          { name: "eventCount" },
          { name: "totalRevenue" },
          { name: "totalUsers" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [
                "purchase",
                "add_to_cart",
                "begin_checkout",
                "add_payment_info",
                "add_shipping_info",
                "view_item",
                "view_item_list",
                "select_item",
                "generate_lead",
                "sign_up",
                "login",
              ],
            },
          },
        },
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: "20",
      },
    })) as { data: RunReportResponse };

    const byEvent = (eventRes.data.rows || []).map((r: Row) => ({
      event: r.dimensionValues?.[0]?.value || "unknown",
      count: parseInt(r.metricValues?.[0]?.value || "0"),
      revenue: parseFloat(r.metricValues?.[1]?.value || "0"),
      users: parseInt(r.metricValues?.[2]?.value || "0"),
    }));

    // ─── 1c. By device (sessions from GA4, conversions distributed from webhook) ───
    const deviceRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      },
    })) as { data: RunReportResponse };

    const byDevice = (deviceRes.data.rows || []).map((r: Row) => {
      const sessions = parseInt(r.metricValues?.[0]?.value || "0");
      return {
        device: r.dimensionValues?.[0]?.value || "unknown",
        sessions,
        conversions: 0,
        revenue: 0,
        purchases: 0,
        conversionRate: 0,
      };
    });

    // Distribute webhook conversions proportionally to device sessions
    if (totalWebhookConv > 0 && byDevice.length > 0) {
      const totalDeviceSessions = byDevice.reduce((s, d) => s + d.sessions, 0);
      for (const d of byDevice) {
        const share =
          totalDeviceSessions > 0 ? d.sessions / totalDeviceSessions : 0;
        d.conversions = Math.round(totalWebhookConv * share);
        d.revenue = Math.round(totalWebhookRev * share * 100) / 100;
        d.purchases = d.conversions;
        d.conversionRate = d.sessions > 0 ? d.conversions / d.sessions : 0;
      }
    }

    // ─── 1d. By channel (sessions from GA4, conversions distributed from webhook) ───
    const channelRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "15",
      },
    })) as { data: RunReportResponse };

    const byChannel = (channelRes.data.rows || []).map((r: Row) => {
      const sessions = parseInt(r.metricValues?.[0]?.value || "0");
      return {
        channel: r.dimensionValues?.[0]?.value || "unknown",
        sessions,
        conversions: 0,
        revenue: 0,
        purchases: 0,
        users: parseInt(r.metricValues?.[1]?.value || "0"),
        conversionRate: 0,
        commission: 0,
      };
    });

    // Distribute webhook conversions proportionally to channel sessions
    if (totalWebhookConv > 0 && byChannel.length > 0) {
      const totalChannelSessions = byChannel.reduce(
        (s, ch) => s + ch.sessions,
        0,
      );
      for (const ch of byChannel) {
        const share =
          totalChannelSessions > 0 ? ch.sessions / totalChannelSessions : 0;
        ch.conversions = Math.round(totalWebhookConv * share);
        ch.revenue = Math.round(totalWebhookRev * share * 100) / 100;
        ch.purchases = ch.conversions;
        ch.conversionRate = ch.sessions > 0 ? ch.conversions / ch.sessions : 0;
        ch.commission = Math.round(ch.revenue * COMMISSION_RATE * 100) / 100;
      }
    }

    // ─── 1e. Period comparison (webhook = truth) ───
    const dayCount =
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000;
    const prevStart = new Date(
      new Date(startDate).getTime() - dayCount * 86400000,
    )
      .toISOString()
      .split("T")[0];
    const prevEnd = new Date(new Date(startDate).getTime() - 86400000)
      .toISOString()
      .split("T")[0];

    let comparison: any = null;
    try {
      // Sessions from GA4
      const compRes = (await analytics.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [
            { startDate, endDate, name: "current" },
            { startDate: prevStart, endDate: prevEnd, name: "previous" },
          ],
          metrics: [{ name: "sessions" }],
        },
      })) as { data: RunReportResponse };

      const rows = compRes.data.rows || [];
      const gn = (arr: any[], i: number) =>
        parseFloat(arr[i]?.value || "0") || 0;

      const currSess = rows.length >= 1 ? gn(rows[0].metricValues || [], 0) : 0;
      const prevSess = rows.length >= 2 ? gn(rows[1].metricValues || [], 0) : 0;

      // Conversions from IntegrationDaily (webhook = truth)
      const [localCurr, localPrev] = await Promise.all([
        prisma.integrationDaily.aggregate({
          where: {
            integrationId: integration.id,
            date: { gte: new Date(startDate), lte: new Date(endDate) },
          },
          _sum: { conversions: true, revenue: true },
        }),
        prisma.integrationDaily.aggregate({
          where: {
            integrationId: integration.id,
            date: { gte: new Date(prevStart), lte: new Date(prevEnd) },
          },
          _sum: { conversions: true, revenue: true },
        }),
      ]);

      const currConv = localCurr._sum.conversions || 0;
      const currRev = localCurr._sum.revenue || 0;
      const prevConv = localPrev._sum.conversions || 0;
      const prevRev = localPrev._sum.revenue || 0;

      if (currSess > 0 || currConv > 0 || prevSess > 0 || prevConv > 0) {
        comparison = {
          current: {
            sessions: Math.round(currSess),
            conversions: currConv,
            revenue: Math.round(currRev * 100) / 100,
            conversionRate: currSess > 0 ? currConv / currSess : 0,
          },
          previous: {
            sessions: Math.round(prevSess),
            conversions: prevConv,
            revenue: Math.round(prevRev * 100) / 100,
            conversionRate: prevSess > 0 ? prevConv / prevSess : 0,
          },
          change: {
            sessions: prevSess > 0 ? (currSess - prevSess) / prevSess : 0,
            conversions: prevConv > 0 ? (currConv - prevConv) / prevConv : 0,
            revenue: prevRev > 0 ? (currRev - prevRev) / prevRev : 0,
          },
        };
      }
    } catch {}

    // ─── Totals ───
    const totalSessions = daily.reduce((s, d) => s + d.sessions, 0);
    const totalConversions = totalWebhookConv;
    const totalRevenue = totalWebhookRev;
    const totalPurchases = totalWebhookConv;
    const totalAddToCarts = daily.reduce((s, d) => s + d.addToCarts, 0);
    const totalCheckouts = daily.reduce((s, d) => s + d.checkouts, 0);

    return {
      totals: {
        sessions: totalSessions,
        conversions: totalConversions,
        revenue: Math.round(totalRevenue * 100) / 100,
        commission: Math.round(totalRevenue * COMMISSION_RATE * 100) / 100,
        purchases: totalPurchases,
        addToCarts: totalAddToCarts,
        checkouts: totalCheckouts,
        conversionRate:
          totalSessions > 0
            ? Math.round((totalConversions / totalSessions) * 10000) / 100
            : 0,
        avgOrderValue:
          totalPurchases > 0
            ? Math.round((totalRevenue / totalPurchases) * 100) / 100
            : 0,
      },
      daily,
      byEvent,
      byDevice,
      byChannel,
      comparison,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 2. KEYWORDS → CONVERSIONS
  // ═══════════════════════════════════════════════════════════

  async getKeywordConversions(
    domainId: string,
    startDate: string,
    endDate: string,
    limit = 100,
  ) {
    const integration = await this.getGA4Integration(domainId);
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    if (!integration || !domain.gscProperty) {
      return {
        error: "MISSING_DATA",
        message: "Potrzebna integracja GA4 + GSC property",
        correlatedPages: [],
        adsKeywords: [],
      };
    }

    const analytics = await this.getAnalyticsData();
    const propertyId = integration.propertyId!;

    // ─── A) GA4: Landing pages with sessions (conversions from GA4 for per-page correlation) ───
    const landingRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [
          { name: "sessions" },
          { name: "conversions" },
          { name: "totalRevenue" },
          { name: "ecommercePurchases" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
        orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
        limit: String(limit),
      },
    })) as { data: RunReportResponse };

    const landingPages = (landingRes.data.rows || [])
      .map((r: Row) => {
        const sessions = parseInt(r.metricValues?.[0]?.value || "0");
        const conversions = parseInt(r.metricValues?.[1]?.value || "0");
        return {
          path: r.dimensionValues?.[0]?.value || "/",
          sessions,
          conversions,
          revenue: parseFloat(r.metricValues?.[2]?.value || "0"),
          purchases: parseInt(r.metricValues?.[3]?.value || "0"),
          bounceRate: parseFloat(r.metricValues?.[4]?.value || "0"),
          avgDuration: parseFloat(r.metricValues?.[5]?.value || "0"),
          conversionRate: sessions > 0 ? conversions / sessions : 0,
        };
      })
      .filter((lp) => !isExcludedLandingPage(lp.path));

    // ─── B) GA4: Landing pages by channel ───
    const channelLandingRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "landingPagePlusQueryString" },
          { name: "sessionDefaultChannelGroup" },
        ],
        metrics: [
          { name: "sessions" },
          { name: "conversions" },
          { name: "totalRevenue" },
        ],
        orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
        limit: "500",
      },
    })) as { data: RunReportResponse };

    const pageChannelMap = new Map<string, Record<string, any>>();
    for (const r of channelLandingRes.data.rows || []) {
      const path = r.dimensionValues?.[0]?.value || "/";
      const channel = (
        r.dimensionValues?.[1]?.value || "unknown"
      ).toLowerCase();
      const entry = pageChannelMap.get(path) || {};
      entry[channel] = {
        sessions: parseInt(r.metricValues?.[0]?.value || "0"),
        conversions: parseInt(r.metricValues?.[1]?.value || "0"),
        revenue: parseFloat(r.metricValues?.[2]?.value || "0"),
      };
      pageChannelMap.set(path, entry);
    }

    // ─── C) GSC: Top queries per converting page ───
    const { getSearchConsole } = await import("../lib/google-auth.js");
    const sc = await getSearchConsole();

    const convertingPages = landingPages.filter((lp) => lp.conversions > 0);
    const correlatedPages: any[] = [];

    for (const lp of convertingPages.slice(0, 50)) {
      const cleanPath = lp.path.split("?")[0];
      const fullUrl = `${domain.siteUrl}${cleanPath}`;

      let topQueries: any[] = [];
      try {
        const urlVariants = [
          fullUrl,
          fullUrl.replace(/\/$/, ""),
          fullUrl + "/",
        ];
        for (const tryUrl of urlVariants) {
          const qRes = await sc.searchanalytics.query({
            siteUrl: domain.gscProperty,
            requestBody: {
              startDate,
              endDate,
              dimensions: ["query"],
              dimensionFilterGroups: [
                { filters: [{ dimension: "page", expression: tryUrl }] },
              ],
              rowLimit: 15,
            },
          });
          topQueries = (qRes.data.rows || []).map((r: any) => ({
            query: r.keys![0],
            clicks: r.clicks || 0,
            impressions: r.impressions || 0,
            ctr: r.ctr || 0,
            position: Math.round((r.position || 0) * 10) / 10,
          }));
          if (topQueries.length > 0) break;
        }
      } catch {}

      const channelBreakdown = pageChannelMap.get(lp.path) || {};

      correlatedPages.push({
        path: cleanPath,
        url: fullUrl,
        sessions: lp.sessions,
        conversions: lp.conversions,
        revenue: Math.round(lp.revenue * 100) / 100,
        purchases: lp.purchases,
        conversionRate: Math.round(lp.conversionRate * 10000) / 100,
        bounceRate: Math.round(lp.bounceRate * 100) / 100,
        avgDuration: Math.round(lp.avgDuration),
        commission: Math.round(lp.revenue * COMMISSION_RATE * 100) / 100,
        organicSessions: channelBreakdown["organic search"]?.sessions || 0,
        organicConversions:
          channelBreakdown["organic search"]?.conversions || 0,
        organicRevenue: channelBreakdown["organic search"]?.revenue || 0,
        paidSessions: channelBreakdown["paid search"]?.sessions || 0,
        paidConversions: channelBreakdown["paid search"]?.conversions || 0,
        paidRevenue: channelBreakdown["paid search"]?.revenue || 0,
        directSessions: channelBreakdown["direct"]?.sessions || 0,
        directConversions: channelBreakdown["direct"]?.conversions || 0,
        topQueries,
        queryCount: topQueries.length,
      });

      await new Promise((r) => setTimeout(r, 150));
    }

    // ─── D) Google Ads search terms ───
    let adsKeywords: any[] = [];
    try {
      const adsTerms = await prisma.adsSearchTerm.groupBy({
        by: ["searchTerm"],
        where: {
          domainId,
          date: { gte: new Date(startDate), lte: new Date(endDate) },
        },
        _sum: {
          clicks: true,
          impressions: true,
          cost: true,
          conversions: true,
          conversionValue: true,
        },
      });

      adsKeywords = adsTerms
        .map((t) => {
          const cost = t._sum.cost || 0;
          const revenue = t._sum.conversionValue || 0;
          const commission = revenue * COMMISSION_RATE;
          return {
            keyword: t.searchTerm,
            source: "Google Ads",
            clicks: t._sum.clicks || 0,
            impressions: t._sum.impressions || 0,
            cost: Math.round(cost * 100) / 100,
            conversions: t._sum.conversions || 0,
            revenue: Math.round(revenue * 100) / 100,
            commission: Math.round(commission * 100) / 100,
            profit: Math.round((commission - cost) * 100) / 100,
            roas: cost > 0 ? Math.round((revenue / cost) * 100) / 100 : 0,
          };
        })
        .filter((t) => t.clicks > 0)
        .sort((a, b) => b.conversions - a.conversions);
    } catch {}

    // ─── E) Aggregated keyword list ───
    const keywordMap = new Map<
      string,
      {
        keyword: string;
        sources: string[];
        gscClicks: number;
        gscImpressions: number;
        gscPositionSum: number;
        gscPositionCount: number;
        adsClicks: number;
        adsCost: number;
        adsConversions: number;
        adsRevenue: number;
        estimatedConversions: number;
        estimatedRevenue: number;
        associatedPages: string[];
      }
    >();

    for (const page of correlatedPages) {
      for (const q of page.topQueries) {
        const key = q.query.toLowerCase();
        const existing = keywordMap.get(key) || {
          keyword: q.query,
          sources: [] as string[],
          gscClicks: 0,
          gscImpressions: 0,
          gscPositionSum: 0,
          gscPositionCount: 0,
          adsClicks: 0,
          adsCost: 0,
          adsConversions: 0,
          adsRevenue: 0,
          estimatedConversions: 0,
          estimatedRevenue: 0,
          associatedPages: [] as string[],
        };

        if (!existing.sources.includes("GSC")) existing.sources.push("GSC");
        existing.gscClicks += q.clicks;
        existing.gscImpressions += q.impressions;
        existing.gscPositionSum += q.position;
        existing.gscPositionCount++;

        const totalPageClicks = page.topQueries.reduce(
          (s: number, qq: any) => s + qq.clicks,
          0,
        );
        if (totalPageClicks > 0) {
          const share = q.clicks / totalPageClicks;
          existing.estimatedConversions += page.conversions * share;
          existing.estimatedRevenue += page.revenue * share;
        }

        if (!existing.associatedPages.includes(page.path)) {
          existing.associatedPages.push(page.path);
        }
        keywordMap.set(key, existing);
      }
    }

    for (const ak of adsKeywords) {
      const key = ak.keyword.toLowerCase();
      const existing = keywordMap.get(key) || {
        keyword: ak.keyword,
        sources: [] as string[],
        gscClicks: 0,
        gscImpressions: 0,
        gscPositionSum: 0,
        gscPositionCount: 0,
        adsClicks: 0,
        adsCost: 0,
        adsConversions: 0,
        adsRevenue: 0,
        estimatedConversions: 0,
        estimatedRevenue: 0,
        associatedPages: [] as string[],
      };

      if (!existing.sources.includes("Ads")) existing.sources.push("Ads");
      existing.adsClicks += ak.clicks;
      existing.adsCost += ak.cost;
      existing.adsConversions += ak.conversions;
      existing.adsRevenue += ak.revenue;
      keywordMap.set(key, existing);
    }

    const aggregatedKeywords = Array.from(keywordMap.values())
      .map((kw) => ({
        keyword: kw.keyword,
        sources: kw.sources,
        gscClicks: kw.gscClicks,
        gscImpressions: kw.gscImpressions,
        gscPosition:
          kw.gscPositionCount > 0
            ? Math.round((kw.gscPositionSum / kw.gscPositionCount) * 10) / 10
            : null,
        adsClicks: kw.adsClicks,
        adsCost: Math.round(kw.adsCost * 100) / 100,
        adsConversions: kw.adsConversions,
        adsRevenue: Math.round(kw.adsRevenue * 100) / 100,
        estimatedConversions: Math.round(kw.estimatedConversions * 10) / 10,
        estimatedRevenue: Math.round(kw.estimatedRevenue * 100) / 100,
        totalClicks: kw.gscClicks + kw.adsClicks,
        totalConversions:
          kw.adsConversions + Math.round(kw.estimatedConversions * 10) / 10,
        totalRevenue:
          Math.round((kw.adsRevenue + kw.estimatedRevenue) * 100) / 100,
        pages: kw.associatedPages,
        pageCount: kw.associatedPages.length,
      }))
      .sort((a, b) => b.totalConversions - a.totalConversions);

    return {
      correlatedPages,
      adsKeywords: adsKeywords.slice(0, 200),
      aggregatedKeywords: aggregatedKeywords.slice(0, 300),
      stats: {
        totalCorrelatedPages: correlatedPages.length,
        totalAdsKeywords: adsKeywords.length,
        totalAggregatedKeywords: aggregatedKeywords.length,
        pagesWithQueries: correlatedPages.filter((p) => p.queryCount > 0)
          .length,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 3. FUNNEL
  // ═══════════════════════════════════════════════════════════

  async getConversionFunnel(
    domainId: string,
    startDate: string,
    endDate: string,
  ) {
    const integration = await this.getGA4Integration(domainId);
    if (!integration)
      return { error: "NO_GA4", message: "Brak integracji GA4" };

    const analytics = await this.getAnalyticsData();
    const propertyId = integration.propertyId!;

    const funnelRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [
                "view_item",
                "view_item_list",
                "select_item",
                "add_to_cart",
                "view_cart",
                "begin_checkout",
                "add_shipping_info",
                "add_payment_info",
                "purchase",
              ],
            },
          },
        },
      },
    })) as { data: RunReportResponse };

    const eventMap = new Map<string, { count: number; users: number }>();
    for (const r of funnelRes.data.rows || []) {
      const event = r.dimensionValues?.[0]?.value || "";
      eventMap.set(event, {
        count: parseInt(r.metricValues?.[0]?.value || "0"),
        users: parseInt(r.metricValues?.[1]?.value || "0"),
      });
    }

    const funnelSteps = [
      { key: "view_item_list", label: "Wyświetlenie listy" },
      { key: "view_item", label: "Wyświetlenie produktu" },
      { key: "select_item", label: "Wybór produktu" },
      { key: "add_to_cart", label: "Dodanie do koszyka" },
      { key: "view_cart", label: "Wyświetlenie koszyka" },
      { key: "begin_checkout", label: "Rozpoczęcie checkout" },
      { key: "add_shipping_info", label: "Dane wysyłki" },
      { key: "add_payment_info", label: "Dane płatności" },
      { key: "purchase", label: "Zakup" },
    ];

    const funnel = funnelSteps
      .map((step, index) => {
        const data = eventMap.get(step.key);
        const count = data?.count || 0;
        const users = data?.users || 0;
        const prevStep =
          index > 0 ? eventMap.get(funnelSteps[index - 1].key) : null;
        const firstStep = eventMap.get(funnelSteps[0].key);
        return {
          event: step.key,
          label: step.label,
          count,
          users,
          dropOff:
            prevStep && prevStep.users > 0
              ? Math.round((1 - users / prevStep.users) * 10000) / 100
              : 0,
          overallRate:
            firstStep && firstStep.users > 0
              ? Math.round((users / firstStep.users) * 10000) / 100
              : index === 0
                ? 100
                : 0,
        };
      })
      .filter((step) => step.count > 0);

    const funnelDeviceRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "eventName" }, { name: "deviceCategory" }],
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [
                "view_item",
                "add_to_cart",
                "begin_checkout",
                "purchase",
              ],
            },
          },
        },
      },
    })) as { data: RunReportResponse };

    const deviceFunnel = new Map<
      string,
      Record<string, { count: number; users: number }>
    >();
    for (const r of funnelDeviceRes.data.rows || []) {
      const event = r.dimensionValues?.[0]?.value || "";
      const device = r.dimensionValues?.[1]?.value || "unknown";
      if (!deviceFunnel.has(device)) deviceFunnel.set(device, {});
      deviceFunnel.get(device)![event] = {
        count: parseInt(r.metricValues?.[0]?.value || "0"),
        users: parseInt(r.metricValues?.[1]?.value || "0"),
      };
    }

    const funnelByDevice = Array.from(deviceFunnel.entries()).map(
      ([device, events]) => {
        const viewItem = events["view_item"]?.users || 0;
        const addToCart = events["add_to_cart"]?.users || 0;
        const checkout = events["begin_checkout"]?.users || 0;
        const purchase = events["purchase"]?.users || 0;
        return {
          device,
          viewItem,
          addToCart,
          checkout,
          purchase,
          cartRate:
            viewItem > 0 ? Math.round((addToCart / viewItem) * 10000) / 100 : 0,
          checkoutRate:
            addToCart > 0
              ? Math.round((checkout / addToCart) * 10000) / 100
              : 0,
          purchaseRate:
            checkout > 0 ? Math.round((purchase / checkout) * 10000) / 100 : 0,
          overallRate:
            viewItem > 0 ? Math.round((purchase / viewItem) * 10000) / 100 : 0,
        };
      },
    );

    const purchaseDailyRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "ecommercePurchases" },
          { name: "totalRevenue" },
          { name: "addToCarts" },
        ],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: "500",
      },
    })) as { data: RunReportResponse };

    const purchaseDaily = (purchaseDailyRes.data.rows || []).map((r: Row) => {
      const dateStr = r.dimensionValues?.[0]?.value || "";
      return {
        date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
        purchases: parseInt(r.metricValues?.[0]?.value || "0"),
        revenue: parseFloat(r.metricValues?.[1]?.value || "0"),
        addToCarts: parseInt(r.metricValues?.[2]?.value || "0"),
      };
    });

    return { funnel, funnelByDevice, purchaseDaily };
  }

  // ═══════════════════════════════════════════════════════════
  // 4. TOP CONVERTING PAGES
  // ═══════════════════════════════════════════════════════════

  async getTopConvertingPages(
    domainId: string,
    startDate: string,
    endDate: string,
    limit = 50,
  ) {
    const integration = await this.getGA4Integration(domainId);
    if (!integration) return [];

    const analytics = await this.getAnalyticsData();
    const propertyId = integration.propertyId!;

    const res = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [
          { name: "sessions" },
          { name: "conversions" },
          { name: "totalRevenue" },
          { name: "ecommercePurchases" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
          { name: "totalUsers" },
        ],
        orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }],
        limit: String(limit),
      },
    })) as { data: RunReportResponse };

    const pages = (res.data.rows || [])
      .map((r: Row) => {
        const sessions = parseInt(r.metricValues?.[0]?.value || "0");
        const conversions = parseInt(r.metricValues?.[1]?.value || "0");
        const revenue = parseFloat(r.metricValues?.[2]?.value || "0");
        return {
          path: r.dimensionValues?.[0]?.value || "/",
          sessions,
          conversions,
          revenue: Math.round(revenue * 100) / 100,
          purchases: parseInt(r.metricValues?.[3]?.value || "0"),
          bounceRate:
            Math.round(parseFloat(r.metricValues?.[4]?.value || "0") * 100) /
            100,
          avgDuration: Math.round(
            parseFloat(r.metricValues?.[5]?.value || "0"),
          ),
          users: parseInt(r.metricValues?.[6]?.value || "0"),
          conversionRate:
            sessions > 0
              ? Math.round((conversions / sessions) * 10000) / 100
              : 0,
          revenuePerSession:
            sessions > 0 ? Math.round((revenue / sessions) * 100) / 100 : 0,
          commission: Math.round(revenue * COMMISSION_RATE * 100) / 100,
        };
      })
      .filter((p) => !isExcludedLandingPage(p.path));

    const gscPages = await prisma.page.findMany({
      where: { domainId },
      select: {
        path: true,
        clicks: true,
        impressions: true,
        position: true,
        indexingVerdict: true,
        internalLinksIn: true,
      },
    });
    const gscMap = new Map(gscPages.map((p) => [p.path, p]));

    return pages.map((p) => {
      const cleanPath = p.path.split("?")[0];
      const gsc =
        gscMap.get(cleanPath) ||
        gscMap.get(cleanPath + "/") ||
        gscMap.get(cleanPath.replace(/\/$/, ""));
      return {
        ...p,
        gscClicks: gsc?.clicks || 0,
        gscImpressions: gsc?.impressions || 0,
        gscPosition: gsc?.position || null,
        indexingVerdict: gsc?.indexingVerdict || null,
        internalLinksIn: gsc?.internalLinksIn || 0,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GLOBAL — all domains aggregated
  // ═══════════════════════════════════════════════════════════

  async getGlobalConversionOverview(startDate: string, endDate: string) {
    const integrations = await prisma.domainIntegration.findMany({
      where: { provider: "GOOGLE_ANALYTICS", status: "ACTIVE" },
      include: { domain: { select: { id: true, domain: true, label: true } } },
    });

    const results: any[] = [];

    for (const int of integrations) {
      try {
        const analytics = await this.getAnalyticsData();

        // Sessions from GA4
        const res = (await analytics.properties.runReport({
          property: int.propertyId!,
          requestBody: {
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: "sessions" }],
          },
        })) as { data: RunReportResponse };

        const row = res.data.rows?.[0];
        const sessions = row
          ? parseInt(row.metricValues?.[0]?.value || "0")
          : 0;

        // Conversions from IntegrationDaily (webhook = truth)
        const localAgg = await prisma.integrationDaily.aggregate({
          where: {
            integrationId: int.id,
            date: { gte: new Date(startDate), lte: new Date(endDate) },
          },
          _sum: { conversions: true, revenue: true },
        });

        const conversions = localAgg._sum.conversions || 0;
        const revenue = localAgg._sum.revenue || 0;

        if (sessions > 0 || conversions > 0) {
          results.push({
            domainId: int.domain.id,
            domain: int.domain.label || int.domain.domain,
            sessions,
            conversions,
            revenue: Math.round(revenue * 100) / 100,
            purchases: conversions,
            conversionRate:
              sessions > 0
                ? Math.round((conversions / sessions) * 10000) / 100
                : 0,
            commission: Math.round(revenue * COMMISSION_RATE * 100) / 100,
          });
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }

    return results.sort((a, b) => b.revenue - a.revenue);
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private async getGA4Integration(domainId: string) {
    return prisma.domainIntegration.findFirst({
      where: {
        domainId,
        provider: "GOOGLE_ANALYTICS",
        status: "ACTIVE",
      },
    });
  }
}
