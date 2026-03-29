// backend/src/routes/ads.ts

import { FastifyInstance } from "fastify";
import { AdsService } from "../services/ads.service.js";

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

  // Search terms
  fastify.get("/:domainId/search-terms", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { days } = request.query as { days?: string };
    return ads.getSearchTerms(domainId, parseInt(days || "30"));
  });

  // Ads vs Organic comparison
  fastify.get("/:domainId/ads-vs-organic", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { days } = request.query as { days?: string };
    return ads.getAdsVsOrganic(domainId, parseInt(days || "30"));
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

  // Sync search terms
  fastify.post("/:domainId/sync-search-terms", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return ads.syncSearchTerms(domainId);
  });
}
