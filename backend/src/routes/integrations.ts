// backend/src/routes/integrations.ts

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { GA4Service } from "../services/ga4.service.js";
import { MerchantService } from "../services/merchant.service.js";

const ga4 = new GA4Service();
const merchant = new MerchantService();

export async function integrationRoutes(fastify: FastifyInstance) {
  // ─── LIST INTEGRATIONS FOR DOMAIN ──────────────────────────
  fastify.get("/:id/integrations", async (request) => {
    const { id } = request.params as { id: string };

    const integrations = await prisma.domainIntegration.findMany({
      where: { domainId: id },
      orderBy: { createdAt: "asc" },
    });

    return integrations;
  });

  // ─── ADD INTEGRATION ───────────────────────────────────────
  fastify.post("/:id/integrations", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { provider, propertyId, merchantId, adsCustomerId } =
      request.body as any;

    if (!provider) {
      return reply.status(400).send({ error: "provider is required" });
    }

    // Validate provider-specific fields
    if (provider === "GOOGLE_ANALYTICS" && !propertyId) {
      return reply.status(400).send({
        error: "propertyId is required for GA4",
        hint: "Format: properties/123456789. Znajdziesz w GA4 → Admin → Property Details.",
      });
    }
    if (provider === "GOOGLE_MERCHANT" && !merchantId) {
      return reply.status(400).send({
        error: "merchantId is required for Merchant Center",
        hint: "Numeryczny ID widoczny w URL Merchant Center.",
      });
    }

    if (provider === "GOOGLE_ADS" && !adsCustomerId) {
      return reply.status(400).send({
        error: "adsCustomerId is required",
        hint: "Format: 123-456-7890. Znajdziesz w Google Ads UI.",
      });
    }

    // Check for duplicate
    const existing = await prisma.domainIntegration.findUnique({
      where: { domainId_provider: { domainId: id, provider } },
    });
    if (existing) {
      return reply.status(409).send({
        error: "already_exists",
        message: `Integracja ${provider} już istnieje dla tej domeny.`,
        integration: existing,
      });
    }

    // Normalize propertyId
    let normalizedPropertyId = propertyId;
    if (provider === "GOOGLE_ANALYTICS" && propertyId) {
      // Accept both "properties/123" and "123"
      normalizedPropertyId = propertyId.startsWith("properties/")
        ? propertyId
        : `properties/${propertyId}`;
    }

    // Create integration
    const integration = await prisma.domainIntegration.create({
      data: {
        domainId: id,
        provider,
        propertyId: normalizedPropertyId || null,
        merchantId: merchantId || null,
        adsCustomerId: adsCustomerId || null,
        status: "PENDING",
      },
    });

    // Auto-verify
    let verifyResult: any;
    if (provider === "GOOGLE_ANALYTICS") {
      verifyResult = await ga4.verifyAccess(normalizedPropertyId);
    } else if (provider === "GOOGLE_MERCHANT") {
      verifyResult = await merchant.verifyAccess(merchantId);
    }
    if (provider === "GOOGLE_ADS") {
      const hasConfig =
        !!process.env.GOOGLE_ADS_REFRESH_TOKEN &&
        process.env.GOOGLE_ADS_REFRESH_TOKEN !== "PENDING_APPROVAL";
      verifyResult = {
        ok: hasConfig,
        error: hasConfig
          ? undefined
          : "Oczekiwanie na zatwierdzenie Google Ads API Basic Access. Po zatwierdzeniu uzupełnij GOOGLE_ADS_REFRESH_TOKEN w .env i kliknij Verify.",
      };
    }

    if (verifyResult) {
      await prisma.domainIntegration.update({
        where: { id: integration.id },
        data: {
          status: verifyResult.ok ? "ACTIVE" : "ERROR",
          lastError: verifyResult.ok ? null : verifyResult.error,
        },
      });

      // If verified — trigger initial data pull
      if (verifyResult.ok) {
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .split("T")[0];
        const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
          .toISOString()
          .split("T")[0];

        if (provider === "GOOGLE_ANALYTICS") {
          // Don't await — let it run in background
          ga4
            .pullDailyData(
              integration.id,
              normalizedPropertyId,
              ninetyDaysAgo,
              yesterday,
            )
            .catch((e) => console.error("Initial GA4 pull failed:", e.message));
        } else if (provider === "GOOGLE_MERCHANT") {
          merchant
            .pullData(integration.id, merchantId)
            .catch((e) =>
              console.error("Initial Merchant pull failed:", e.message),
            );
        }
      }
    }

    const updated = await prisma.domainIntegration.findUniqueOrThrow({
      where: { id: integration.id },
    });

    return reply.status(201).send({
      ...updated,
      verifyResult,
    });
  });

  // ─── VERIFY INTEGRATION ────────────────────────────────────
  fastify.post("/:id/integrations/:intId/verify", async (request) => {
    const { intId } = request.params as { intId: string };

    const integration = await prisma.domainIntegration.findUniqueOrThrow({
      where: { id: intId },
    });

    let result: any;

    if (integration.provider === "GOOGLE_ANALYTICS") {
      result = await ga4.verifyAccess(integration.propertyId!);
    } else if (integration.provider === "GOOGLE_MERCHANT") {
      result = await merchant.verifyAccess(integration.merchantId!);
    } else if (integration.provider === "GOOGLE_ADS") {
      const hasConfig =
        !!process.env.GOOGLE_ADS_REFRESH_TOKEN &&
        process.env.GOOGLE_ADS_REFRESH_TOKEN !== "PENDING";
      result = {
        ok: hasConfig,
        error: hasConfig ? undefined : "GOOGLE_ADS_REFRESH_TOKEN not set",
      };
    } else {
      return { ok: false, error: "Unsupported provider" };
    }

    await prisma.domainIntegration.update({
      where: { id: intId },
      data: {
        status: result.ok ? "ACTIVE" : "ERROR",
        lastError: result.ok ? null : result.error,
      },
    });

    return result;
  });

  // ─── SYNC (manual pull) ────────────────────────────────────
  fastify.post("/:id/integrations/:intId/sync", async (request) => {
    const { intId } = request.params as { intId: string };
    const { startDate, endDate, days } = request.body as any;

    const integration = await prisma.domainIntegration.findUniqueOrThrow({
      where: { id: intId },
    });

    const end =
      endDate || new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const d = parseInt(days) || 30;
    const start =
      startDate ||
      new Date(Date.now() - d * 86400000).toISOString().split("T")[0];

    if (integration.provider === "GOOGLE_ANALYTICS") {
      return ga4.pullDailyData(
        integration.id,
        integration.propertyId!,
        start,
        end,
      );
    } else if (integration.provider === "GOOGLE_MERCHANT") {
      return merchant.pullData(
        integration.id,
        integration.merchantId!,
        start,
        end,
      );
    } else if (integration.provider === "GOOGLE_ADS") {
      const { AdsService } = await import("../services/ads.service.js");
      const ads = new AdsService();
      const domainId = integration.domainId;

      let campaigns, products, searchTerms;
      try {
        campaigns = await ads.syncCampaignDaily(domainId, d);
      } catch (e: any) {
        campaigns = { error: e.message };
      }
      try {
        products = await ads.syncProductDaily(domainId, d);
      } catch (e: any) {
        products = { error: e.message };
      }

      return { campaigns, products, searchTerms };
    }

    return { error: "Unsupported provider" };
  });

  // ─── GET DATA ──────────────────────────────────────────────
  fastify.get("/:id/integrations/:intId/data", async (request) => {
    const { intId } = request.params as { intId: string };
    const { startDate, endDate, days } = request.query as any;

    const integration = await prisma.domainIntegration.findUniqueOrThrow({
      where: { id: intId },
    });

    const d = parseInt(days) || 30;
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - d * 86400000);

    const daily = await prisma.integrationDaily.findMany({
      where: {
        integrationId: intId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });

    // Aggregate stats for the period
    let aggregate: any = {};
    let bySource: any[] = [];
    let landingPages: any[] = [];

    if (integration.provider === "GOOGLE_ANALYTICS") {
      aggregate = {
        totalSessions: daily.reduce((s, d) => s + (d.sessions || 0), 0),
        totalUsers: daily.reduce((s, d) => s + (d.users || 0), 0),
        totalPageviews: daily.reduce((s, d) => s + (d.pageviews || 0), 0),
        totalConversions: daily.reduce((s, d) => s + (d.conversions || 0), 0),
        totalRevenue:
          Math.round(daily.reduce((s, d) => s + (d.revenue || 0), 0) * 100) /
          100,
        avgBounceRate:
          daily.length > 0
            ? Math.round(
                (daily.reduce((s, d) => s + (d.bounceRate || 0), 0) /
                  daily.length) *
                  1000,
              ) / 1000
            : 0,
        avgSessionDuration:
          daily.length > 0
            ? Math.round(
                daily.reduce((s, d) => s + (d.avgSessionDuration || 0), 0) /
                  daily.length,
              )
            : 0,
      };

      // Live GA4 query for source/medium + landing pages for the selected range
      if (integration.propertyId) {
        const startStr =
          startDate ||
          new Date(Date.now() - d * 86400000).toISOString().split("T")[0];
        const endStr = endDate || new Date().toISOString().split("T")[0];

        try {
          bySource = await ga4.getSourceBreakdown(
            integration.propertyId,
            startStr,
            endStr,
          );
        } catch (e: any) {
          console.log("GA4 source query failed:", e.message?.slice(0, 100));
          // Fallback to cached
          bySource = (integration.cachedData as any)?.bySource || [];
        }

        try {
          landingPages = await ga4.getLandingPages(
            integration.propertyId,
            startStr,
            endStr,
          );
        } catch (e: any) {
          console.log(
            "GA4 landing pages query failed:",
            e.message?.slice(0, 100),
          );
          landingPages = (integration.cachedData as any)?.landingPages || [];
        }
      }
    }

    return {
      integration,
      daily,
      aggregate,
      bySource,
      landingPages,
      cached: integration.cachedData,
    };
  });

  // ─── REALTIME (GA4 only) ───────────────────────────────────
  fastify.get("/:id/integrations/:intId/realtime", async (request) => {
    const { intId } = request.params as { intId: string };

    const integration = await prisma.domainIntegration.findUniqueOrThrow({
      where: { id: intId },
    });

    if (integration.provider !== "GOOGLE_ANALYTICS") {
      return { error: "Realtime only for GA4" };
    }

    const activeUsers = await ga4.getRealtimeUsers(integration.propertyId!);
    return { activeUsers };
  });

  // ─── GA4 LANDING PAGES correlated with GSC ─────────────────
  fastify.get("/:id/integrations/:intId/landing-pages", async (request) => {
    const { id, intId } = request.params as { id: string; intId: string };

    const integration = await prisma.domainIntegration.findUniqueOrThrow({
      where: { id: intId },
    });

    if (integration.provider !== "GOOGLE_ANALYTICS") {
      return { error: "Landing pages only for GA4" };
    }

    const cached = integration.cachedData as any;
    const landingPages = cached?.landingPages || [];

    if (landingPages.length === 0) {
      return { pages: [], message: "Brak danych. Kliknij Sync aby pobrać." };
    }

    // Correlate with GSC page data
    const gscPages = await prisma.page.findMany({
      where: { domainId: id },
      select: {
        path: true,
        clicks: true,
        impressions: true,
        position: true,
        ctr: true,
        indexingVerdict: true,
      },
    });

    const gscMap = new Map(gscPages.map((p) => [p.path, p]));

    const correlated = landingPages.map((lp: any) => {
      // Normalize path for matching
      const path = lp.path.split("?")[0]; // remove query params
      const gsc =
        gscMap.get(path) ||
        gscMap.get(path + "/") ||
        gscMap.get(path.replace(/\/$/, ""));

      return {
        path: lp.path,
        // GA4 data
        ga4Sessions: lp.sessions,
        ga4Conversions: lp.conversions,
        ga4Revenue: lp.revenue,
        ga4BounceRate: lp.bounceRate,
        // GSC data
        gscClicks: gsc?.clicks || 0,
        gscImpressions: gsc?.impressions || 0,
        gscPosition: gsc?.position || null,
        gscCtr: gsc?.ctr || null,
        indexingVerdict: gsc?.indexingVerdict || null,
        // Calculated
        conversionRate:
          lp.sessions > 0
            ? Math.round((lp.conversions / lp.sessions) * 10000) / 100
            : 0,
      };
    });

    return { pages: correlated };
  });

  // ─── UPDATE INTEGRATION CONFIG ─────────────────────────────
  fastify.patch("/:id/integrations/:intId", async (request) => {
    const { intId } = request.params as { intId: string };
    const { propertyId, merchantId, adsCustomerId } = request.body as any;

    const data: any = {};
    if (propertyId !== undefined) {
      data.propertyId = propertyId.startsWith("properties/")
        ? propertyId
        : `properties/${propertyId}`;
    }
    if (merchantId !== undefined) data.merchantId = merchantId;
    if (adsCustomerId !== undefined) data.adsCustomerId = adsCustomerId;

    return prisma.domainIntegration.update({
      where: { id: intId },
      data,
    });
  });

  // ─── DISCONNECT (soft delete) ──────────────────────────────
  fastify.post("/:id/integrations/:intId/disconnect", async (request) => {
    const { intId } = request.params as { intId: string };

    return prisma.domainIntegration.update({
      where: { id: intId },
      data: { status: "DISCONNECTED" },
    });
  });

  // ─── DELETE INTEGRATION (hard delete) ──────────────────────
  fastify.delete("/:id/integrations/:intId", async (request, reply) => {
    const { intId } = request.params as { intId: string };
    await prisma.domainIntegration.delete({ where: { id: intId } });
    return reply.status(204).send();
  });

  // ─── SYNC ALL (bulk) ───────────────────────────────────────
  fastify.post("/sync-all-integrations", async (request) => {
    const { days } = request.body as any;
    const d = parseInt(days) || 3;
    const end = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const start = new Date(Date.now() - d * 86400000)
      .toISOString()
      .split("T")[0];

    const [ga4Results, merchantResults] = await Promise.all([
      ga4.syncAll(start, end),
      merchant.syncAll(),
    ]);

    return { ga4: ga4Results, merchant: merchantResults };
  });
}
