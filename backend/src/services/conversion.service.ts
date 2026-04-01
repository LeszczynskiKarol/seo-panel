// backend/src/services/conversion.service.ts

import { prisma } from "../lib/prisma.js";
import { getGoogleAuth } from "../lib/google-auth.js";
import { google, analyticsdata_v1beta } from "googleapis";

type RunReportResponse = analyticsdata_v1beta.Schema$RunReportResponse;
type Row = analyticsdata_v1beta.Schema$Row;

const COMMISSION_RATE = 0.12;

// Paths that are NOT real landing pages — checkout flow, success pages,
// payment redirects, cart, (not set). These appear as "landing pages"
// because Stripe redirect breaks GA4 session continuity.
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
  // 1. CONVERSION OVERVIEW — trends, totals, breakdown
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

    // ─── 1a. Daily conversion trend ───
    const dailyRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "conversions" },
          { name: "totalRevenue" },
          { name: "ecommercePurchases" },
          { name: "addToCarts" },
          { name: "checkouts" },
        ],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: "500",
      },
    })) as { data: RunReportResponse };

    const daily = (dailyRes.data.rows || []).map((r: Row) => {
      const dateStr = r.dimensionValues?.[0]?.value || "";
      const m = r.metricValues || [];
      const gn = (i: number) => parseFloat(m[i]?.value || "0") || 0;

      const sessions = Math.round(gn(0));
      const conversions = Math.round(gn(2));
      const revenue = gn(3);

      return {
        date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
        sessions,
        users: Math.round(gn(1)),
        conversions,
        revenue: Math.round(revenue * 100) / 100,
        purchases: Math.round(gn(4)),
        addToCarts: Math.round(gn(5)),
        checkouts: Math.round(gn(6)),
        conversionRate: sessions > 0 ? conversions / sessions : 0,
        commission: Math.round(revenue * COMMISSION_RATE * 100) / 100,
      };
    });

    // ─── MERGE with IntegrationDaily (backfilled/synced data) ───
    // For days where GA4 live reports 0 conversions but IntegrationDaily
    // has data (e.g. from backfill), supplement the daily array.
    const localDaily = await prisma.integrationDaily.findMany({
      where: {
        integrationId: integration.id,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      orderBy: { date: "asc" },
    });

    if (localDaily.length > 0) {
      const dailyMap = new Map(daily.map((d) => [d.date, d]));

      for (const ld of localDaily) {
        const dateStr = ld.date.toISOString().split("T")[0];
        const existing = dailyMap.get(dateStr);
        const localConv = ld.conversions || 0;
        const localRev = ld.revenue || 0;

        if (!existing) {
          // Day exists in IntegrationDaily but not in GA4 live → add it
          const sessions = ld.sessions || 0;
          daily.push({
            date: dateStr,
            sessions,
            users: ld.users || 0,
            conversions: localConv,
            revenue: Math.round(localRev * 100) / 100,
            purchases: localConv, // approximate
            addToCarts: 0,
            checkouts: 0,
            conversionRate: sessions > 0 ? localConv / sessions : 0,
            commission: Math.round(localRev * COMMISSION_RATE * 100) / 100,
          });
        } else if (existing.conversions === 0 && localConv > 0) {
          // GA4 live has 0 conversions but IntegrationDaily has backfilled data → merge
          existing.conversions = localConv;
          existing.revenue = Math.round(localRev * 100) / 100;
          existing.purchases = localConv;
          existing.commission =
            Math.round(localRev * COMMISSION_RATE * 100) / 100;
          existing.conversionRate =
            existing.sessions > 0 ? localConv / existing.sessions : 0;
        }
        // If GA4 live already has conversions, keep GA4 data (no double-counting)
      }

      // Re-sort after merge
      daily.sort((a, b) => a.date.localeCompare(b.date));
    }

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

    // ─── 1c. By device ───
    const deviceRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [
          { name: "sessions" },
          { name: "conversions" },
          { name: "totalRevenue" },
          { name: "ecommercePurchases" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      },
    })) as { data: RunReportResponse };

    const byDevice = (deviceRes.data.rows || []).map((r: Row) => {
      const sessions = parseInt(r.metricValues?.[0]?.value || "0");
      const conversions = parseInt(r.metricValues?.[1]?.value || "0");
      return {
        device: r.dimensionValues?.[0]?.value || "unknown",
        sessions,
        conversions,
        revenue: parseFloat(r.metricValues?.[2]?.value || "0"),
        purchases: parseInt(r.metricValues?.[3]?.value || "0"),
        conversionRate: sessions > 0 ? conversions / sessions : 0,
      };
    });

    // ─── MERGE backfilled conversions into byDevice ───
    // When GA4 live shows 0 conversions but IntegrationDaily has data,
    // attribute to the device with most sessions (usually desktop)
    const totalDeviceConv = byDevice.reduce((s, d) => s + d.conversions, 0);
    if (totalDeviceConv === 0) {
      const localAggForDevice = await prisma.integrationDaily.aggregate({
        where: {
          integrationId: integration.id,
          date: { gte: new Date(startDate), lte: new Date(endDate) },
        },
        _sum: { conversions: true, revenue: true },
      });
      const backfillConv = localAggForDevice._sum.conversions || 0;
      const backfillRev = localAggForDevice._sum.revenue || 0;
      if (backfillConv > 0 && byDevice.length > 0) {
        // Add to device with most sessions
        const topDevice = byDevice.sort((a, b) => b.sessions - a.sessions)[0];
        topDevice.conversions += backfillConv;
        topDevice.revenue += backfillRev;
        topDevice.purchases += backfillConv;
        topDevice.conversionRate =
          topDevice.sessions > 0
            ? topDevice.conversions / topDevice.sessions
            : 0;
      }
    }

    // ─── 1d. By channel group ───
    const channelRes = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [
          { name: "sessions" },
          { name: "conversions" },
          { name: "totalRevenue" },
          { name: "ecommercePurchases" },
          { name: "totalUsers" },
        ],
        orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
        limit: "15",
      },
    })) as { data: RunReportResponse };

    const byChannel = (channelRes.data.rows || []).map((r: Row) => {
      const sessions = parseInt(r.metricValues?.[0]?.value || "0");
      const conversions = parseInt(r.metricValues?.[1]?.value || "0");
      const revenue = parseFloat(r.metricValues?.[2]?.value || "0");
      return {
        channel: r.dimensionValues?.[0]?.value || "unknown",
        sessions,
        conversions,
        revenue,
        purchases: parseInt(r.metricValues?.[3]?.value || "0"),
        users: parseInt(r.metricValues?.[4]?.value || "0"),
        conversionRate: sessions > 0 ? conversions / sessions : 0,
        commission: Math.round(revenue * COMMISSION_RATE * 100) / 100,
      };
    });

    // ─── MERGE cachedData.bySource into byChannel (backfill support) ───
    // If GA4 live shows 0 conversions across all channels but cachedData has
    // backfilled conversion data in bySource, merge it in.
    const totalLiveConv = byChannel.reduce((s, ch) => s + ch.conversions, 0);
    if (totalLiveConv === 0) {
      const cached = integration.cachedData as any;
      const cachedBySource = cached?.bySource as any[] | undefined;
      if (cachedBySource?.length) {
        for (const src of cachedBySource) {
          if (!src.conversions || src.conversions <= 0) continue;
          // Map sourceMedium to channel name
          const sm = (src.sourceMedium || "").toLowerCase();
          let channelName = "Other";
          if (sm.includes("organic") && !sm.includes("shopping"))
            channelName = "Organic Search";
          else if (sm.includes("organic") && sm.includes("shopping"))
            channelName = "Organic Shopping";
          else if (sm.includes("cpc") || sm.includes("paid"))
            channelName = "Paid Search";
          else if (sm.includes("direct") || sm.includes("(none)"))
            channelName = "Direct";
          else if (sm.includes("referral")) channelName = "Referral";

          const existing = byChannel.find((ch) => ch.channel === channelName);
          if (existing) {
            existing.conversions += src.conversions;
            existing.revenue += src.revenue || 0;
            existing.commission =
              Math.round(existing.revenue * COMMISSION_RATE * 100) / 100;
            existing.conversionRate =
              existing.sessions > 0
                ? existing.conversions / existing.sessions
                : 0;
          } else {
            byChannel.push({
              channel: channelName,
              sessions: src.sessions || 0,
              conversions: src.conversions,
              revenue: src.revenue || 0,
              purchases: src.conversions,
              users: src.users || 0,
              conversionRate:
                (src.sessions || 0) > 0 ? src.conversions / src.sessions : 0,
              commission:
                Math.round((src.revenue || 0) * COMMISSION_RATE * 100) / 100,
            });
          }
        }
        // Re-sort by conversions desc
        byChannel.sort((a, b) => b.conversions - a.conversions);
      }
    }

    // ─── 1e. Period comparison ───
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
      const compRes = (await analytics.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [
            { startDate, endDate, name: "current" },
            { startDate: prevStart, endDate: prevEnd, name: "previous" },
          ],
          metrics: [
            { name: "sessions" },
            { name: "conversions" },
            { name: "totalRevenue" },
            { name: "ecommercePurchases" },
            { name: "totalUsers" },
          ],
        },
      })) as { data: RunReportResponse };

      const rows = compRes.data.rows || [];
      const gn = (arr: any[], i: number) =>
        parseFloat(arr[i]?.value || "0") || 0;

      let currConv = rows.length >= 1 ? gn(rows[0].metricValues || [], 1) : 0;
      let prevConv = rows.length >= 2 ? gn(rows[1].metricValues || [], 1) : 0;
      let currRev = rows.length >= 1 ? gn(rows[0].metricValues || [], 2) : 0;
      let prevRev = rows.length >= 2 ? gn(rows[1].metricValues || [], 2) : 0;
      let currSess = rows.length >= 1 ? gn(rows[0].metricValues || [], 0) : 0;
      let prevSess = rows.length >= 2 ? gn(rows[1].metricValues || [], 0) : 0;

      // Merge IntegrationDaily for comparison periods
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

      const localCurrConv = localCurr._sum.conversions || 0;
      const localCurrRev = localCurr._sum.revenue || 0;
      const localPrevConv = localPrev._sum.conversions || 0;
      const localPrevRev = localPrev._sum.revenue || 0;

      // Use higher of GA4 live vs IntegrationDaily (handles backfill)
      if (localCurrConv > currConv) {
        currConv = localCurrConv;
        currRev = Math.max(currRev, localCurrRev);
      }
      if (localPrevConv > prevConv) {
        prevConv = localPrevConv;
        prevRev = Math.max(prevRev, localPrevRev);
      }

      if (currSess > 0 || currConv > 0 || prevSess > 0 || prevConv > 0) {
        comparison = {
          current: {
            sessions: Math.round(currSess),
            conversions: Math.round(currConv),
            revenue: Math.round(currRev * 100) / 100,
            conversionRate: currSess > 0 ? currConv / currSess : 0,
          },
          previous: {
            sessions: Math.round(prevSess),
            conversions: Math.round(prevConv),
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
    const totalConversions = daily.reduce((s, d) => s + d.conversions, 0);
    const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
    const totalPurchases = daily.reduce((s, d) => s + d.purchases, 0);
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
  // 2. KEYWORDS → CONVERSIONS (correlation via landing page)
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

    // ─── A) GA4: Landing pages with conversions ───
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

    // ─── B) GA4: Landing pages by channel — separate organic vs paid ───
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

    // Map: path → { organic: {...}, paid: {...}, ... }
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

    // ─── C) GSC: Top queries per landing page (for pages with conversions) ───
    const { getSearchConsole } = await import("../lib/google-auth.js");
    const sc = await getSearchConsole();

    // Only enrich pages that actually have conversions
    const convertingPages = landingPages.filter((lp) => lp.conversions > 0);

    const correlatedPages: any[] = [];

    for (const lp of convertingPages.slice(0, 50)) {
      // Normalize path
      const cleanPath = lp.path.split("?")[0];
      const fullUrl = `${domain.siteUrl}${cleanPath}`;

      let topQueries: any[] = [];
      try {
        // Try multiple URL variants
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
        // GA4 totals
        sessions: lp.sessions,
        conversions: lp.conversions,
        revenue: Math.round(lp.revenue * 100) / 100,
        purchases: lp.purchases,
        conversionRate: Math.round(lp.conversionRate * 10000) / 100,
        bounceRate: Math.round(lp.bounceRate * 100) / 100,
        avgDuration: Math.round(lp.avgDuration),
        commission: Math.round(lp.revenue * COMMISSION_RATE * 100) / 100,
        // Channel breakdown
        organicSessions: channelBreakdown["organic search"]?.sessions || 0,
        organicConversions:
          channelBreakdown["organic search"]?.conversions || 0,
        organicRevenue: channelBreakdown["organic search"]?.revenue || 0,
        paidSessions: channelBreakdown["paid search"]?.sessions || 0,
        paidConversions: channelBreakdown["paid search"]?.conversions || 0,
        paidRevenue: channelBreakdown["paid search"]?.revenue || 0,
        directSessions: channelBreakdown["direct"]?.sessions || 0,
        directConversions: channelBreakdown["direct"]?.conversions || 0,
        // GSC queries
        topQueries,
        queryCount: topQueries.length,
      });

      // Rate limit GSC
      await new Promise((r) => setTimeout(r, 150));
    }

    // ─── D) Google Ads search terms with conversions ───
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

    // ─── E) Build aggregated keyword list ───
    // Flatten all GSC queries from converting pages + Ads keywords
    const keywordMap = new Map<
      string,
      {
        keyword: string;
        sources: string[];
        gscClicks: number;
        gscImpressions: number;
        gscAvgPosition: number;
        gscPositionSum: number;
        gscPositionCount: number;
        adsClicks: number;
        adsCost: number;
        adsConversions: number;
        adsRevenue: number;
        // Estimated from landing page correlation
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
          gscAvgPosition: 0,
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

        // Estimate conversion attribution: proportional to clicks share
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

    // Merge Ads keywords
    for (const ak of adsKeywords) {
      const key = ak.keyword.toLowerCase();
      const existing = keywordMap.get(key) || {
        keyword: ak.keyword,
        sources: [] as string[],
        gscClicks: 0,
        gscImpressions: 0,
        gscAvgPosition: 0,
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

    // Finalize
    const aggregatedKeywords = Array.from(keywordMap.values())
      .map((kw) => ({
        keyword: kw.keyword,
        sources: kw.sources,
        // GSC
        gscClicks: kw.gscClicks,
        gscImpressions: kw.gscImpressions,
        gscPosition:
          kw.gscPositionCount > 0
            ? Math.round((kw.gscPositionSum / kw.gscPositionCount) * 10) / 10
            : null,
        // Ads
        adsClicks: kw.adsClicks,
        adsCost: Math.round(kw.adsCost * 100) / 100,
        adsConversions: kw.adsConversions,
        adsRevenue: Math.round(kw.adsRevenue * 100) / 100,
        // Estimated (from landing page correlation)
        estimatedConversions: Math.round(kw.estimatedConversions * 10) / 10,
        estimatedRevenue: Math.round(kw.estimatedRevenue * 100) / 100,
        // Combined
        totalClicks: kw.gscClicks + kw.adsClicks,
        totalConversions:
          kw.adsConversions + Math.round(kw.estimatedConversions * 10) / 10,
        totalRevenue:
          Math.round((kw.adsRevenue + kw.estimatedRevenue) * 100) / 100,
        // Pages
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
  // 3. FUNNEL — e-commerce funnel steps
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

    // ─── Funnel events daily ───
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

    // Define standard funnel steps (order matters)
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
          // Drop-off from previous step
          dropOff:
            prevStep && prevStep.users > 0
              ? Math.round((1 - users / prevStep.users) * 10000) / 100
              : 0,
          // Overall rate from top of funnel
          overallRate:
            firstStep && firstStep.users > 0
              ? Math.round((users / firstStep.users) * 10000) / 100
              : index === 0
                ? 100
                : 0,
        };
      })
      .filter((step) => step.count > 0);

    // ─── Funnel by device ───
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

    // ─── Daily purchase trend (for mini chart) ───
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

    return {
      funnel,
      funnelByDevice,
      purchaseDaily,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 4. TOP CONVERTING PAGES — deep dive
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

    // Correlate with GSC page data
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
        const res = (await analytics.properties.runReport({
          property: int.propertyId!,
          requestBody: {
            dateRanges: [{ startDate, endDate }],
            metrics: [
              { name: "sessions" },
              { name: "conversions" },
              { name: "totalRevenue" },
              { name: "ecommercePurchases" },
            ],
          },
        })) as { data: RunReportResponse };

        const row = res.data.rows?.[0];
        let sessions = row ? parseInt(row.metricValues?.[0]?.value || "0") : 0;
        let conversions = row
          ? parseInt(row.metricValues?.[1]?.value || "0")
          : 0;
        let revenue = row ? parseFloat(row.metricValues?.[2]?.value || "0") : 0;
        let purchases = row ? parseInt(row.metricValues?.[3]?.value || "0") : 0;

        // Merge IntegrationDaily (backfilled data) for days where GA4 live has 0
        const localAgg = await prisma.integrationDaily.aggregate({
          where: {
            integrationId: int.id,
            date: { gte: new Date(startDate), lte: new Date(endDate) },
          },
          _sum: { conversions: true, revenue: true, sessions: true },
        });

        const localConv = localAgg._sum.conversions || 0;
        const localRev = localAgg._sum.revenue || 0;

        // If GA4 live has 0 conversions but local has data → use local
        if (conversions === 0 && localConv > 0) {
          conversions = localConv;
          revenue = localRev;
          purchases = localConv;
        }
        // If GA4 has some but local has MORE (backfill + GA4 partial) → use max
        // This handles the transition period
        else if (localConv > conversions) {
          conversions = localConv;
          revenue = Math.max(revenue, localRev);
          purchases = Math.max(purchases, localConv);
        }

        if (sessions > 0 || conversions > 0) {
          results.push({
            domainId: int.domain.id,
            domain: int.domain.label || int.domain.domain,
            sessions,
            conversions,
            revenue: Math.round(revenue * 100) / 100,
            purchases,
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
