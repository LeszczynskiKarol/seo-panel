// backend/src/routes/backfill.ts
// Jednorazowy backfill: /sukces pageviews → conversions (49 zł/szt)
// Po użyciu USUŃ ten plik i wyrejestruj route z server.ts

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getGoogleAuth } from "../lib/google-auth.js";
import { google, analyticsdata_v1beta } from "googleapis";

type RunReportResponse = analyticsdata_v1beta.Schema$RunReportResponse;

const EBOOK_PRICE = 49; // zł per conversion

export async function backfillRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/backfill/ebook-conversions
   *
   * Body: {
   *   domainId: string,        // ID domeny ebookcopywriting.pl w panelu
   *   startDate?: string,      // default: "2024-01-01"
   *   endDate?: string,        // default: yesterday
   *   dryRun?: boolean         // default: true — pokaż co by zmienił, nie zapisuj
   * }
   *
   * Odpytuje GA4 o pageviews na /sukces per dzień,
   * aktualizuje IntegrationDaily.conversions i .revenue
   */
  fastify.post("/ebook-conversions", async (request) => {
    const { domainId, startDate, endDate, dryRun = true } = request.body as any;

    if (!domainId) {
      return { error: "domainId is required" };
    }

    // Find GA4 integration for this domain
    const integration = await prisma.domainIntegration.findFirst({
      where: {
        domainId,
        provider: "GOOGLE_ANALYTICS",
        status: "ACTIVE",
      },
    });

    if (!integration?.propertyId) {
      return { error: "No active GA4 integration found for this domain" };
    }

    const auth = await getGoogleAuth();
    const analytics = google.analyticsdata({ version: "v1beta", auth });

    const start = startDate || "2024-01-01";
    const end =
      endDate || new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Step 1: Find what paths GA4 actually sees (debug)
    const debugRes = (await analytics.properties.runReport({
      property: integration.propertyId,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
        dimensionFilter: {
          filter: {
            fieldName: "pagePath",
            stringFilter: {
              matchType: "CONTAINS",
              value: "sukces",
            },
          },
        },
        limit: "20",
      },
    })) as { data: RunReportResponse };

    const foundPaths = (debugRes.data.rows || []).map((r) => ({
      path: r.dimensionValues?.[0]?.value,
      pageviews: parseInt(r.metricValues?.[0]?.value || "0"),
      users: parseInt(r.metricValues?.[1]?.value || "0"),
    }));

    // Determine actual path
    const successPath =
      foundPaths.length > 0
        ? foundPaths.sort((a, b) => b.users - a.users)[0].path
        : "/sukces";

    // Step 2: Query daily data with correct path
    const res = (await analytics.properties.runReport({
      property: integration.propertyId,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
        dimensionFilter: {
          filter: {
            fieldName: "pagePath",
            stringFilter: {
              matchType: "EXACT",
              value: successPath!,
            },
          },
        },
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: "500",
      },
    })) as { data: RunReportResponse };

    const rows = res.data.rows || [];
    const results: {
      date: string;
      pageviews: number;
      users: number;
      revenue: number;
      action: string;
    }[] = [];

    let totalConversions = 0;
    let totalRevenue = 0;
    let updatedDays = 0;
    let skippedDays = 0;

    for (const row of rows) {
      const dateStr = row.dimensionValues?.[0]?.value || "";
      const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      const pageviews = parseInt(row.metricValues?.[0]?.value || "0");
      const users = parseInt(row.metricValues?.[1]?.value || "0");

      if (users <= 0) continue;

      // Use users (not pageviews) as conversion count — one user = one purchase
      const conversions = users;
      const revenue = conversions * EBOOK_PRICE;

      totalConversions += conversions;
      totalRevenue += revenue;

      // Check existing IntegrationDaily record
      const existing = await prisma.integrationDaily.findUnique({
        where: {
          integrationId_date: {
            integrationId: integration.id,
            date: new Date(date),
          },
        },
      });

      // Skip if already has conversions (GA4 already tracking)
      if (
        existing &&
        (existing.conversions || 0) > 0 &&
        existing.revenue &&
        existing.revenue > 0
      ) {
        results.push({
          date,
          pageviews,
          users,
          revenue,
          action: `SKIP — already has ${existing.conversions} conv, ${existing.revenue} zł`,
        });
        skippedDays++;
        continue;
      }

      if (!dryRun) {
        if (existing) {
          // Update existing record
          await prisma.integrationDaily.update({
            where: { id: existing.id },
            data: {
              conversions,
              revenue,
            },
          });
        } else {
          // Create new record
          await prisma.integrationDaily.create({
            data: {
              integrationId: integration.id,
              date: new Date(date),
              conversions,
              revenue,
              sessions: pageviews, // approximate
              users,
            },
          });
        }
        updatedDays++;
      }

      results.push({
        date,
        pageviews,
        users,
        revenue,
        action: dryRun ? "WOULD UPDATE" : "UPDATED",
      });
    }

    // Update cachedData on integration — with organic source attribution
    if (!dryRun && totalConversions > 0) {
      const cached = (integration.cachedData as any) || {};

      // Merge into existing bySource or create new
      const existingBySource = cached.bySource || [];
      const organicIdx = existingBySource.findIndex(
        (s: any) => s.sourceMedium === "google / organic",
      );

      if (organicIdx >= 0) {
        existingBySource[organicIdx].conversions =
          (existingBySource[organicIdx].conversions || 0) + totalConversions;
        existingBySource[organicIdx].revenue =
          Math.round(
            ((existingBySource[organicIdx].revenue || 0) + totalRevenue) * 100,
          ) / 100;
      } else {
        existingBySource.push({
          sourceMedium: "google / organic",
          sessions: results.reduce((s, r) => s + r.pageviews, 0),
          users: totalConversions,
          conversions: totalConversions,
          revenue: totalRevenue,
        });
      }

      await prisma.domainIntegration.update({
        where: { id: integration.id },
        data: {
          cachedData: {
            ...cached,
            conversions: (cached.conversions || 0) + totalConversions,
            revenue:
              Math.round(((cached.revenue || 0) + totalRevenue) * 100) / 100,
            bySource: existingBySource,
            backfillNote: `Backfill /sukces: +${totalConversions} conv, +${totalRevenue} zł (${start} → ${end}), attributed to organic`,
          },
        },
      });
    }

    return {
      dryRun,
      propertyId: integration.propertyId,
      dateRange: { start, end },
      debug: {
        searchedFor: "sukces",
        foundPaths,
        usedPath: successPath,
      },
      summary: {
        totalDaysWithVisits: rows.length,
        totalConversions,
        totalRevenue,
        updatedDays: dryRun ? 0 : updatedDays,
        skippedDays,
        pricePerConversion: EBOOK_PRICE,
      },
      details: results,
    };
  });

  /**
   * POST /api/backfill/fix-ebook-attribution
   * Naprawia atrybucję — dodaje organic source do cachedData
   * Body: { domainId: string }
   */
  fastify.post("/fix-ebook-attribution", async (request) => {
    const { domainId } = request.body as any;
    if (!domainId) return { error: "domainId is required" };

    const integration = await prisma.domainIntegration.findFirst({
      where: { domainId, provider: "GOOGLE_ANALYTICS", status: "ACTIVE" },
    });
    if (!integration) return { error: "No GA4 integration" };

    // Sum all backfilled conversions from IntegrationDaily
    const agg = await prisma.integrationDaily.aggregate({
      where: { integrationId: integration.id },
      _sum: { conversions: true, revenue: true, sessions: true },
    });

    const totalConv = agg._sum.conversions || 0;
    const totalRev = agg._sum.revenue || 0;
    const totalSess = agg._sum.sessions || 0;

    if (totalConv === 0) return { error: "No conversions to attribute" };

    const cached = (integration.cachedData as any) || {};
    const bySource = cached.bySource || [];

    // Remove old organic entry if exists, add fresh one
    const filtered = bySource.filter(
      (s: any) =>
        !s.sourceMedium?.includes("organic") ||
        s.sourceMedium === "Organic Shopping",
    );

    filtered.push({
      sourceMedium: "google / organic",
      sessions: totalSess,
      users: totalConv,
      conversions: totalConv,
      revenue: Math.round(totalRev * 100) / 100,
    });

    // Sort by revenue desc
    filtered.sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0));

    await prisma.domainIntegration.update({
      where: { id: integration.id },
      data: {
        cachedData: {
          ...cached,
          conversions: totalConv,
          revenue: Math.round(totalRev * 100) / 100,
          bySource: filtered,
          backfillNote: `Attributed ${totalConv} conv (${totalRev} zł) to organic`,
        },
      },
    });

    return {
      success: true,
      attributed: {
        conversions: totalConv,
        revenue: totalRev,
        channel: "google / organic",
      },
      bySource: filtered,
    };
  });
}
