// backend/src/routes/ads.ts

import { FastifyInstance } from "fastify";
import { AdsService } from "../services/ads.service.js";
import { prisma } from "../lib/prisma.js";

const ads = new AdsService();

export async function adsRoutes(fastify: FastifyInstance) {
  // Campaign overview
  fastify.get("/:domainId/campaigns", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { days } = request.query as { days?: string };
    return ads.getCampaignOverview(domainId, parseInt(days || "30"));
  });

  // Product performance
  fastify.get("/:domainId/products", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { days } = request.query as { days?: string };
    return ads.getProductPerformance(domainId, parseInt(days || "30"));
  });

  // Sync campaigns
  fastify.post("/:domainId/sync-campaigns", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { days } = request.body as { days?: number };
    return ads.syncCampaignDaily(domainId, days || 30);
  });

  // Sync products
  fastify.post("/:domainId/sync-products", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return ads.syncProductDaily(domainId);
  });

  fastify.get("/accessible-customers", async () => {
    return ads.listAccessibleCustomers();
  });

  // Waste analysis
  fastify.get("/waste-analysis", async () => {
    const products = await prisma.$queryRaw`
      SELECT 
        "productId",
        "productTitle" as title,
        SUM(cost)::float as total_cost,
        SUM(clicks)::int as total_clicks,
        SUM(impressions)::int as total_impressions,
        SUM("conversionValue")::float as total_revenue,
        SUM(conversions)::float as total_conversions
      FROM "AdsProductDaily"
      WHERE cost > 0
      GROUP BY "productId", "productTitle"
      ORDER BY SUM(cost) DESC
    `;

    const waste = (products as any[]).filter(
      (p) => p.total_revenue === 0 && p.total_cost > 2,
    );
    const profitable = (products as any[]).filter((p) => p.total_revenue > 0);

    return {
      waste: waste.map((p) => ({
        ...p,
        cpc:
          p.total_clicks > 0 ? (p.total_cost / p.total_clicks).toFixed(2) : 0,
      })),
      profitable,
      summary: {
        wasteCount: waste.length,
        wasteCost: waste.reduce((s, p) => s + p.total_cost, 0).toFixed(2),
        profitableCount: profitable.length,
        profitableRevenue: profitable
          .reduce((s, p) => s + p.total_revenue, 0)
          .toFixed(2),
      },
    };
  });
}
