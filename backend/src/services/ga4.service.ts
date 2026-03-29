// backend/src/services/ga4.service.ts

import { prisma } from "../lib/prisma.js";
import { getGoogleAuth } from "../lib/google-auth.js";
import { google } from "googleapis";

export class GA4Service {
  private async getAnalyticsData() {
    const auth = await getGoogleAuth();
    return google.analyticsdata({ version: "v1beta", auth });
  }

  /**
   * Verify access to a GA4 property — try pulling 1 day of data
   */
  async verifyAccess(
    propertyId: string,
  ): Promise<{ ok: boolean; error?: string; propertyName?: string }> {
    try {
      const analytics = await this.getAnalyticsData();

      // Try a minimal report to verify access
      const res = await analytics.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
          metrics: [{ name: "sessions" }],
          limit: 1,
        },
      });

      return {
        ok: true,
        propertyName: res.data.metadata?.currencyCode || propertyId,
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

  /**
   * Pull daily aggregated metrics for a GA4 property
   */
  async pullDailyData(
    integrationId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ days: number; error?: string }> {
    try {
      const analytics = await this.getAnalyticsData();

      // 1. Daily aggregates
      const dailyRes = await analytics.properties.runReport({
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
          limit: 500,
        },
      });

      const rows = dailyRes.data.rows || [];
      let daysProcessed = 0;

      for (const row of rows) {
        const dateStr = row.dimensionValues?.[0]?.value; // YYYYMMDD
        if (!dateStr) continue;

        const date = new Date(
          `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
        );

        const metrics = row.metricValues || [];
        const getNum = (i: number) => parseFloat(metrics[i]?.value || "0") || 0;

        await prisma.integrationDaily.upsert({
          where: {
            integrationId_date: { integrationId, date },
          },
          update: {
            sessions: Math.round(getNum(0)),
            users: Math.round(getNum(1)),
            newUsers: Math.round(getNum(2)),
            pageviews: Math.round(getNum(3)),
            avgSessionDuration: getNum(4),
            bounceRate: getNum(5),
            conversions: Math.round(getNum(6)),
            revenue: getNum(7),
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
            conversions: Math.round(getNum(6)),
            revenue: getNum(7),
          },
        });

        daysProcessed++;
      }

      // 2. Pull source/medium breakdown for entire range (stored in last day's breakdown)
      const sourceRes = await analytics.properties.runReport({
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
          limit: 25,
        },
      });

      const bySource = (sourceRes.data.rows || []).map((r) => ({
        sourceMedium: r.dimensionValues?.[0]?.value || "unknown",
        sessions: parseInt(r.metricValues?.[0]?.value || "0"),
        users: parseInt(r.metricValues?.[1]?.value || "0"),
        conversions: parseInt(r.metricValues?.[2]?.value || "0"),
        revenue: parseFloat(r.metricValues?.[3]?.value || "0"),
      }));

      // 3. Pull top landing pages
      const landingRes = await analytics.properties.runReport({
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
          limit: 50,
        },
      });

      const landingPages = (landingRes.data.rows || []).map((r) => ({
        path: r.dimensionValues?.[0]?.value || "/",
        sessions: parseInt(r.metricValues?.[0]?.value || "0"),
        conversions: parseInt(r.metricValues?.[1]?.value || "0"),
        revenue: parseFloat(r.metricValues?.[2]?.value || "0"),
        bounceRate: parseFloat(r.metricValues?.[3]?.value || "0"),
      }));

      // 4. Update cached summary + breakdown on integration
      const totalSessions = rows.reduce(
        (s, r) => s + parseInt(r.metricValues?.[0]?.value || "0"),
        0,
      );
      const totalUsers = rows.reduce(
        (s, r) => s + parseInt(r.metricValues?.[1]?.value || "0"),
        0,
      );
      const totalConversions = rows.reduce(
        (s, r) => s + parseInt(r.metricValues?.[6]?.value || "0"),
        0,
      );
      const totalRevenue = rows.reduce(
        (s, r) => s + parseFloat(r.metricValues?.[7]?.value || "0"),
        0,
      );
      const avgBounce =
        rows.length > 0
          ? rows.reduce(
              (s, r) => s + parseFloat(r.metricValues?.[5]?.value || "0"),
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
        data: {
          status: "ERROR",
          lastError: e.message,
        },
      });
      return { days: 0, error: e.message };
    }
  }

  /**
   * Get realtime active users (for dashboard widget)
   */
  async getRealtimeUsers(propertyId: string): Promise<number> {
    try {
      const analytics = await this.getAnalyticsData();
      const res = await analytics.properties.runRealtimeReport({
        property: propertyId,
        requestBody: {
          metrics: [{ name: "activeUsers" }],
        },
      });

      return parseInt(res.data.rows?.[0]?.metricValues?.[0]?.value || "0");
    } catch {
      return 0;
    }
  }

  /**
   * Pull data for ALL active GA4 integrations
   */
  async syncAll(startDate: string, endDate: string) {
    const integrations = await prisma.domainIntegration.findMany({
      where: {
        provider: "GOOGLE_ANALYTICS",
        status: { in: ["ACTIVE", "ERROR"] },
      },
      include: { domain: { select: { domain: true, label: true } } },
    });

    const results: { domain: string; days: number; error?: string }[] = [];

    for (const int of integrations) {
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
      // Rate limit: GA4 has 10 concurrent requests limit
      await new Promise((r) => setTimeout(r, 500));
    }

    return results;
  }
}
