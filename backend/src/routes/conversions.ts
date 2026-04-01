// backend/src/routes/conversions.ts

import { FastifyInstance } from "fastify";
import { ConversionService } from "../services/conversion.service.js";

const conversions = new ConversionService();

export async function conversionRoutes(fastify: FastifyInstance) {
  // ─── OVERVIEW — daily trends, by channel, by device, by event ───
  fastify.get("/:domainId/overview", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { days, startDate, endDate } = request.query as any;

    const d = parseInt(days || "30");
    const end =
      endDate || new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const start =
      startDate ||
      new Date(Date.now() - d * 86400000).toISOString().split("T")[0];

    return conversions.getConversionOverview(domainId, start, end);
  });

  // ─── KEYWORDS → CONVERSIONS — correlated via landing page + Ads terms ───
  fastify.get("/:domainId/keywords", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { days, startDate, endDate, limit } = request.query as any;

    const d = parseInt(days || "30");
    const end =
      endDate || new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const start =
      startDate ||
      new Date(Date.now() - d * 86400000).toISOString().split("T")[0];

    return conversions.getKeywordConversions(
      domainId,
      start,
      end,
      parseInt(limit) || 100,
    );
  });

  // ─── FUNNEL — e-commerce step-by-step ───
  fastify.get("/:domainId/funnel", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { days, startDate, endDate } = request.query as any;

    const d = parseInt(days || "30");
    const end =
      endDate || new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const start =
      startDate ||
      new Date(Date.now() - d * 86400000).toISOString().split("T")[0];

    return conversions.getConversionFunnel(domainId, start, end);
  });

  // ─── TOP CONVERTING PAGES ───
  fastify.get("/:domainId/top-pages", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const { days, startDate, endDate, limit } = request.query as any;

    const d = parseInt(days || "30");
    const end =
      endDate || new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const start =
      startDate ||
      new Date(Date.now() - d * 86400000).toISOString().split("T")[0];

    return conversions.getTopConvertingPages(
      domainId,
      start,
      end,
      parseInt(limit) || 50,
    );
  });

  // ─── GLOBAL (all domains) ───
  fastify.get("/global", async (request) => {
    const { days } = request.query as any;
    const d = parseInt(days || "30");
    const end = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const start = new Date(Date.now() - d * 86400000)
      .toISOString()
      .split("T")[0];

    return conversions.getGlobalConversionOverview(start, end);
  });
}
