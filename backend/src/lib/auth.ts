// backend/src/lib/auth.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export function registerAuth(fastify: FastifyInstance) {
  fastify.post("/api/auth/login", async (request, reply) => {
    const { login, password } = request.body as any;

    if (
      login === process.env.ADMIN_LOGIN &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = Buffer.from(`${login}:${Date.now()}`).toString("base64");
      // Store token in memory (simple approach)
      validTokens.add(token);
      return { token };
    }

    return reply.status(401).send({ error: "Invalid credentials" });
  });

  fastify.post("/api/auth/logout", async () => {
    return { ok: true };
  });

  fastify.get("/api/auth/check", async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Not authenticated" });
    }
    const token = auth.replace("Bearer ", "");
    if (!validTokens.has(token)) {
      return reply.status(401).send({ error: "Invalid token" });
    }
    return { ok: true };
  });
}

const validTokens = new Set<string>();

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  // Skip auth for login endpoint and health
  if (request.url === "/api/auth/login" || request.url === "/api/health") {
    return;
  }

  // Skip if no credentials configured
  if (!process.env.ADMIN_LOGIN || !process.env.ADMIN_PASSWORD) {
    return;
  }

  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Not authenticated" });
  }

  const token = auth.replace("Bearer ", "");
  if (!validTokens.has(token)) {
    return reply.status(401).send({ error: "Invalid token" });
  }
}
