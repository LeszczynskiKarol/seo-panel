import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { domainRoutes } from "./routes/domains.js";
import { adsRoutes } from "./routes/ads.js";
import { aiRoutes } from "./routes/ai.js";
import { profitabilityRoutes } from "./routes/profitability.js";
import { integrationRoutes } from "./routes/integrations.js";
import { mozRoutes } from "./routes/moz.js";
import { chatRoutes } from "./routes/chat.js";
import { conversionRoutes } from "./routes/conversions.js";
import { backfillRoutes } from "./routes/backfill.js";
import { registerAuth, authGuard } from "./lib/auth.js";
import { overviewRoutes } from "./routes/overview.js";
import { watchlistRoutes } from "./routes/watchlist.js";
import { startScheduler } from "./jobs/scheduler.js";
import { prisma } from "./lib/prisma.js";
import { importRoutes } from "./routes/import.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { costRoutes } from "./routes/costs.js";
import { alertRoutes } from "./routes/alerts.js";
import { timelineRoutes } from "./routes/timeline.js";

const fastify = Fastify();

// Plugins
fastify.register(cors, {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    process.env.FRONTEND_URL || "",
  ].filter(Boolean),
  credentials: true,
});

registerAuth(fastify);

// Public webhooks (no auth)
fastify.post("/api/webhook/stojan-order", async (request, reply) => {
  const { apiKey, date, revenue, orders } = request.body as any;
  if (apiKey !== process.env.STOJAN_API_KEY) {
    return reply.code(401).send({ error: "Invalid API key" });
  }
  const intId = process.env.STOJAN_INTEGRATION_ID;
  if (!intId)
    return reply.code(500).send({ error: "STOJAN_INTEGRATION_ID not set" });
  await prisma.integrationDaily.upsert({
    where: {
      integrationId_date: { integrationId: intId, date: new Date(date) },
    },
    update: { conversions: orders, revenue },
    create: {
      integrationId: intId,
      date: new Date(date),
      sessions: 0,
      users: 0,
      conversions: orders,
      revenue,
    },
  });
  return { ok: true, date, orders, revenue };
});

fastify.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/api/webhook/")) return;
  if (request.url === "/api/health") return;
  return authGuard(request, reply);
});

// Routes
fastify.register(domainRoutes, { prefix: "/api/domains" });
fastify.register(overviewRoutes, { prefix: "/api" });
fastify.register(importRoutes, { prefix: "/api" });
fastify.register(analyticsRoutes, { prefix: "/api/analytics" });
fastify.register(timelineRoutes, { prefix: "/api/timeline" });
fastify.register(adsRoutes, { prefix: "/api/ads" });
fastify.register(profitabilityRoutes, { prefix: "/api/profitability" });
fastify.register(watchlistRoutes, { prefix: "/api/watchlist" });
fastify.register(mozRoutes, { prefix: "/api/moz" });
fastify.register(conversionRoutes, { prefix: "/api/conversions" });
fastify.register(backfillRoutes, { prefix: "/api/backfill" });
fastify.register(integrationRoutes, { prefix: "/api/domains" });
fastify.register(aiRoutes, { prefix: "/api/ai" });
fastify.register(chatRoutes, { prefix: "/api/chat" });
fastify.register(costRoutes, { prefix: "/api/costs" });
fastify.register(alertRoutes, { prefix: "/api/alerts" });

// Health check
fastify.get("/api/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
}));

// Start
const PORT = parseInt(process.env.PORT || "5555");
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  try {
    await prisma.$connect();
    console.log("✅ Connected to PostgreSQL");

    await fastify.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 SEO Panel running on http://${HOST}:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Domains: http://localhost:${PORT}/api/domains\n`);

    // Start background jobs
    if (process.env.ENABLE_SCHEDULER !== "false") {
      startScheduler();
    }
  } catch (err) {
    console.error("❌ Failed to start:", err);
    process.exit(1);
  }
}

const shutdown = async () => {
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();
