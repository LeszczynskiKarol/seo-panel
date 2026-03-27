// backend/src/routes/analytics.ts

import { FastifyInstance } from "fastify";
import { AnalyticsService } from "../services/analytics.service.js";

const analytics = new AnalyticsService();

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.get("/quick-wins", async (request) => {
    const { domainId, limit } = request.query as any;
    return analytics.getQuickWins(domainId, parseInt(limit) || 50);
  });

  fastify.get("/content-gaps", async (request) => {
    const { domainId, limit } = request.query as any;
    return analytics.getContentGaps(domainId, parseInt(limit) || 50);
  });

  fastify.get("/cannibalization/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return analytics.getCannibalization(domainId);
  });

  fastify.get("/cross-domain-links", async () => {
    return analytics.getCrossDomainLinks();
  });

  fastify.get("/indexing-velocity", async (request) => {
    const { domainId } = request.query as any;
    return analytics.getIndexingVelocity(domainId);
  });

  fastify.get("/health/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return analytics.getDomainHealth(domainId);
  });

  fastify.get("/movers/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { limit } = request.query as any;
    return analytics.getPositionMovers(domainId, parseInt(limit) || 30);
  });

  fastify.get("/stale-pages", async (request) => {
    const { domainId, days } = request.query as any;
    return analytics.getStalePages(domainId, parseInt(days) || 30);
  });
}
