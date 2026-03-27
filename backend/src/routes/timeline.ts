// backend/src/routes/timeline.ts

import { FastifyInstance } from "fastify";
import { TimelineService } from "../services/timeline.service.js";

const timeline = new TimelineService();

export async function timelineRoutes(fastify: FastifyInstance) {
  // Domain timeline
  fastify.get("/domain/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { limit, types } = request.query as any;
    return timeline.getTimeline({
      domainId,
      limit: parseInt(limit) || 100,
      types: types ? types.split(",") : undefined,
    });
  });

  // Page timeline (position + events + backlinks correlated)
  fastify.get("/page/:pageId", async (request) => {
    const { pageId } = request.params as { pageId: string };
    const { days } = request.query as any;
    return timeline.getPageSeoHistory(pageId, parseInt(days) || 90);
  });

  // Domain backlinks
  fastify.get("/backlinks/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { live, limit } = request.query as any;
    return timeline.getBacklinks(domainId, {
      live: live === "true" ? true : live === "false" ? false : undefined,
      limit: parseInt(limit) || 200,
    });
  });

  // Trigger backlink sync
  fastify.post("/sync-backlinks/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return timeline.syncBacklinks(domainId);
  });

  // Trigger position change detection
  fastify.post("/detect-changes/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return timeline.detectPositionChanges(domainId);
  });

  // Detect all
  fastify.post("/detect-all", async () => {
    const domains = await (
      await import("../lib/prisma.js")
    ).prisma.domain.findMany({
      where: { isActive: true },
    });
    const results = [];
    for (const d of domains) {
      const positions = await timeline.detectPositionChanges(d.id);
      const backlinks = await timeline.syncBacklinks(d.id);
      results.push({
        domain: d.domain,
        positionEvents: positions,
        ...backlinks,
      });
    }
    return results;
  });

  // Reset position events (for re-detection with queries)
  fastify.delete("/reset-position-events", async () => {
    const deleted = await (
      await import("../lib/prisma.js")
    ).prisma.seoEvent.deleteMany({
      where: {
        type: {
          in: [
            "POSITION_IMPROVED",
            "POSITION_DROPPED",
            "ENTERED_TOP3",
            "ENTERED_TOP10",
            "LEFT_TOP10",
          ],
        },
      },
    });
    return { deleted: deleted.count };
  });
}
