// backend/src/services/ga4.service.ts
// ZASTĄP CAŁY PLIK

import { prisma } from "../lib/prisma.js";
import { getGoogleAuth } from "../lib/google-auth.js";
import { google, analyticsdata_v1beta } from "googleapis";

type RunReportResponse = analyticsdata_v1beta.Schema$RunReportResponse;
type Row = analyticsdata_v1beta.Schema$Row;

export class GA4Service {
  private async getAnalyticsData() {
    const auth = await getGoogleAuth();
    return google.analyticsdata({ version: "v1beta", auth });
  }

  async verifyAccess(
    propertyId: string,
  ): Promise<{ ok: boolean; error?: string; propertyName?: string }> {
    try {
      const analytics = await this.getAnalyticsData();

      const res = await analytics.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
          metrics: [{ name: "sessions" }],
          limit: "1",
        },
      });

      return {
        ok: true,
        propertyName: (res as any).data?.metadata?.currencyCode || propertyId,
      };
    } catch (e: any) {
      const msg = e.message || "Unknown error";
      if (msg.includes("403") || msg.includes("permission")) {
        return {
          ok: false,
          error: `Brak dostępu. Dodaj email Service Account jako Viewer w GA4 → Admin → Property Access Management.`,
        };
      }
      if (msg.includes("404") || msg.includes("not found")) {
        return {
          ok: false,
          error: `Property "${propertyId}" nie znaleziony. Sprawdź ID (format: properties/123456789).`,
        };
      }
      return { ok: false, error: msg };
    }
  }

  async pullDailyData(
    integrationId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ days: number; error?: string }> {
    try {
      const analytics = await this.getAnalyticsData();

      // 1. Daily aggregates
      const dailyRes = (await analytics.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "newUsers" },
            { name: "screenPageViews" },
            { name: "averageSessionDuration" },
            { name: "bounceRate" },
            { name: "conversions" },
            { name: "totalRevenue" },
          ],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: "500",
        },
      })) as { data: RunReportResponse };

      const rows: Row[] = dailyRes.data.rows || [];
      let daysProcessed = 0;

      for (const row of rows) {
        const dateStr = row.dimensionValues?.[0]?.value;
        if (!dateStr) continue;

        const date = new Date(
          `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
        );

        const metrics = row.metricValues || [];
        const getNum = (i: number): number =>
          parseFloat(metrics[i]?.value || "0") || 0;

        await prisma.integrationDaily.upsert({
          where: { integrationId_date: { integrationId, date } },
          update: {
            sessions: Math.round(getNum(0)),
            users: Math.round(getNum(1)),
            newUsers: Math.round(getNum(2)),
            pageviews: Math.round(getNum(3)),
            avgSessionDuration: getNum(4),
            bounceRate: getNum(5),
            // NEVER write conversions/revenue from GA4 — webhooks only
          },
          create: {
            integrationId,
            date,
            sessions: Math.round(getNum(0)),
            users: Math.round(getNum(1)),
            newUsers: Math.round(getNum(2)),
            pageviews: Math.round(getNum(3)),
            avgSessionDuration: getNum(4),
            bounceRate: getNum(5),
            conversions: 0,
            revenue: 0,
          },
        });
        daysProcessed++;
      }

      // 2. Source/medium breakdown
      const sourceRes = (await analytics.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "sessionSourceMedium" }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "conversions" },
            { name: "totalRevenue" },
          ],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "25",
        },
      })) as { data: RunReportResponse };

      const bySource = (sourceRes.data.rows || []).map((r: Row) => ({
        sourceMedium: r.dimensionValues?.[0]?.value || "unknown",
        sessions: parseInt(r.metricValues?.[0]?.value || "0"),
        users: parseInt(r.metricValues?.[1]?.value || "0"),
        conversions: parseInt(r.metricValues?.[2]?.value || "0"),
        revenue: parseFloat(r.metricValues?.[3]?.value || "0"),
      }));

      // 3. Top landing pages
      const landingRes = (await analytics.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "landingPagePlusQueryString" }],
          metrics: [
            { name: "sessions" },
            { name: "conversions" },
            { name: "totalRevenue" },
            { name: "bounceRate" },
          ],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "50",
        },
      })) as { data: RunReportResponse };

      const landingPages = (landingRes.data.rows || []).map((r: Row) => ({
        path: r.dimensionValues?.[0]?.value || "/",
        sessions: parseInt(r.metricValues?.[0]?.value || "0"),
        conversions: parseInt(r.metricValues?.[1]?.value || "0"),
        revenue: parseFloat(r.metricValues?.[2]?.value || "0"),
        bounceRate: parseFloat(r.metricValues?.[3]?.value || "0"),
      }));

      // 4. Cached summary
      const totalSessions = rows.reduce(
        (s: number, r: Row) => s + parseInt(r.metricValues?.[0]?.value || "0"),
        0,
      );
      const totalUsers = rows.reduce(
        (s: number, r: Row) => s + parseInt(r.metricValues?.[1]?.value || "0"),
        0,
      );
      const totalConversions = rows.reduce(
        (s: number, r: Row) => s + parseInt(r.metricValues?.[6]?.value || "0"),
        0,
      );
      const totalRevenue = rows.reduce(
        (s: number, r: Row) =>
          s + parseFloat(r.metricValues?.[7]?.value || "0"),
        0,
      );
      const avgBounce =
        rows.length > 0
          ? rows.reduce(
              (s: number, r: Row) =>
                s + parseFloat(r.metricValues?.[5]?.value || "0"),
              0,
            ) / rows.length
          : 0;

      await prisma.domainIntegration.update({
        where: { id: integrationId },
        data: {
          status: "ACTIVE",
          lastSync: new Date(),
          lastError: null,
          syncCount: { increment: 1 },
          cachedData: {
            sessions: totalSessions,
            users: totalUsers,
            conversions: totalConversions,
            revenue: Math.round(totalRevenue * 100) / 100,
            bounceRate: Math.round(avgBounce * 1000) / 1000,
            bySource,
            landingPages,
            startDate,
            endDate,
            daysProcessed,
          },
        },
      });

      return { days: daysProcessed };
    } catch (e: any) {
      await prisma.domainIntegration.update({
        where: { id: integrationId },
        data: { status: "ERROR", lastError: e.message },
      });
      return { days: 0, error: e.message };
    }
  }

  async getRealtimeUsers(propertyId: string): Promise<number> {
    try {
      const analytics = await this.getAnalyticsData();
      const res = (await analytics.properties.runRealtimeReport({
        property: propertyId,
        requestBody: { metrics: [{ name: "activeUsers" }] },
      })) as any;

      return parseInt(res.data?.rows?.[0]?.metricValues?.[0]?.value || "0");
    } catch {
      return 0;
    }
  }

  async syncAll(startDate: string, endDate: string) {
    const integrations = await prisma.domainIntegration.findMany({
      where: {
        provider: "GOOGLE_ANALYTICS",
        status: { in: ["ACTIVE", "ERROR"] },
      },
      include: {
        domain: { select: { domain: true, label: true, category: true } },
      },
    });

    // Sync ALL domains — GA4 provides sessions/users for all
    // (conversions/revenue won't be overwritten if webhook data exists)
    const filtered = integrations;

    const results: { domain: string; days: number; error?: string }[] = [];

    for (const int of filtered) {
      const result = await this.pullDailyData(
        int.id,
        int.propertyId!,
        startDate,
        endDate,
      );
      results.push({
        domain: int.domain.label || int.domain.domain,
        ...result,
      });
      await new Promise((r) => setTimeout(r, 500));
    }

    return results;
  }
  // ═══════════════════════════════════════════════════════════
  // DODAJ te dwie metody do klasy GA4Service w ga4.service.ts
  // (przed metodą syncAll)
  // ═══════════════════════════════════════════════════════════

  /**
   * Get source/medium breakdown for a date range (live API call)
   */
  async getSourceBreakdown(
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Promise<any[]> {
    const analytics = await this.getAnalyticsData();

    const res = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionSourceMedium" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "conversions" },
          { name: "totalRevenue" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "25",
      },
    })) as { data: RunReportResponse };

    return (res.data.rows || []).map((r: Row) => ({
      sourceMedium: r.dimensionValues?.[0]?.value || "unknown",
      sessions: parseInt(r.metricValues?.[0]?.value || "0"),
      users: parseInt(r.metricValues?.[1]?.value || "0"),
      conversions: parseInt(r.metricValues?.[2]?.value || "0"),
      revenue: parseFloat(r.metricValues?.[3]?.value || "0"),
    }));
  }

  /**
   * Get top landing pages for a date range (live API call)
   */
  async getLandingPages(
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Promise<any[]> {
    const analytics = await this.getAnalyticsData();

    const res = (await analytics.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [
          { name: "sessions" },
          { name: "conversions" },
          { name: "totalRevenue" },
          { name: "bounceRate" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "50",
      },
    })) as { data: RunReportResponse };

    return (res.data.rows || []).map((r: Row) => ({
      path: r.dimensionValues?.[0]?.value || "/",
      sessions: parseInt(r.metricValues?.[0]?.value || "0"),
      conversions: parseInt(r.metricValues?.[1]?.value || "0"),
      revenue: parseFloat(r.metricValues?.[2]?.value || "0"),
      bounceRate: parseFloat(r.metricValues?.[3]?.value || "0"),
    }));
  }
}
