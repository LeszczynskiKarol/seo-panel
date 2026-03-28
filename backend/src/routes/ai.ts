// backend/src/routes/ai.ts

import { FastifyInstance } from "fastify";
import {
  analyzeCrossLinks,
  analyzeInternalLinks,
  approveProposal,
  rejectProposal,
  getProposals,
} from "../services/ai.service.js";
import { prisma } from "../lib/prisma.js";

export async function aiRoutes(fastify: FastifyInstance) {
  // ─── ANALYZE CROSS-LINKS ──────────────────────────────────
  fastify.post("/analyze-crosslinks/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return analyzeCrossLinks(domainId);
  });

  // ─── ANALYZE INTERNAL LINKS ───────────────────────────────
  fastify.post("/analyze-internal/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    return analyzeInternalLinks(domainId);
  });

  // ─── GET PROPOSALS ────────────────────────────────────────
  fastify.get("/proposals", async (request) => {
    const { domainId, status } = request.query as any;
    return getProposals(domainId, status);
  });

  // ─── APPROVE PROPOSAL ─────────────────────────────────────
  fastify.post("/proposals/:id/approve", async (request) => {
    const { id } = request.params as { id: string };
    return approveProposal(id);
  });

  // ─── REJECT PROPOSAL ──────────────────────────────────────
  fastify.post("/proposals/:id/reject", async (request) => {
    const { id } = request.params as { id: string };
    return rejectProposal(id);
  });

  // ─── DELETE ALL PROPOSALS FOR DOMAIN ──────────────────────
  fastify.delete("/proposals/domain/:domainId", async (request) => {
    const { domainId } = request.params as { domainId: string };
    const deleted = await prisma.linkProposal.deleteMany({
      where: { domainId, status: "PENDING" },
    });
    return { deleted: deleted.count };
  });

  // ─── UPDATE DOMAIN GITHUB REPO ────────────────────────────
  fastify.patch("/domains/:id/github", async (request) => {
    const { id } = request.params as { id: string };
    const { githubRepo } = request.body as { githubRepo: string };
    return prisma.domain.update({ where: { id }, data: { githubRepo } });
  });

  // ─── GET DOMAINS WITH GITHUB CONFIG ───────────────────────
  fastify.get("/domains-config", async () => {
    return prisma.domain.findMany({
      where: { isActive: true },
      select: {
        id: true,
        domain: true,
        label: true,
        githubRepo: true,
        category: true,
      },
      orderBy: { totalClicks: "desc" },
    });
  });
}
