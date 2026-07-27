import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { ContentDecayService } from "../services/content-decay.service.js";

const decay = new ContentDecayService();

/**
 * Machine-to-machine API for external executors (Publisher, sitario).
 * Auth: x-api-key header checked against EXT_API_KEY — fail-closed when unset.
 * Registered under /api/ext, bypasses the session authGuard (see index.ts).
 */
export async function extRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (request, reply) => {
    if (!process.env.EXT_API_KEY) {
      return reply.code(503).send({ error: "EXT_API_KEY not configured" });
    }
    if (request.headers["x-api-key"] !== process.env.EXT_API_KEY) {
      return reply.code(401).send({ error: "Invalid API key" });
    }
  });

  // List recommendations for a domain (by name), newest+highest score first
  fastify.get("/recommendations", async (request, reply) => {
    const { domain, status, type, limit } = request.query as {
      domain?: string;
      status?: string;
      type?: string;
      limit?: string;
    };

    const where: any = {};
    if (domain) {
      const d = await prisma.domain.findFirst({
        where: {
          OR: [{ domain }, { domain: `www.${domain}` }],
        },
        select: { id: true },
      });
      if (!d) return reply.code(404).send({ error: "Unknown domain" });
      where.domainId = d.id;
    }
    if (status) where.status = status;
    if (type) where.type = type;

    const recommendations = await prisma.contentRecommendation.findMany({
      where,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: Math.min(parseInt(limit || "50"), 200),
      include: {
        domain: { select: { domain: true } },
        page: { select: { url: true, path: true, title: true } },
      },
    });

    return { count: recommendations.length, recommendations };
  });

  // Status transitions from executors / decision UI
  fastify.patch("/recommendations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, publishedUrl } = request.body as {
      status?: string;
      publishedUrl?: string;
    };

    const allowed = ["QUEUED", "REJECTED", "PUBLISHED"];
    if (!status || !allowed.includes(status)) {
      return reply
        .code(400)
        .send({ error: `status must be one of: ${allowed.join(", ")}` });
    }

    const rec = await prisma.contentRecommendation.findUnique({
      where: { id },
    });
    if (!rec) return reply.code(404).send({ error: "Not found" });

    const data: any = { status };
    if (status === "QUEUED") data.queuedAt = new Date();
    if (status === "PUBLISHED") {
      data.publishedAt = new Date();
      if (publishedUrl) data.publishedUrl = publishedUrl;
    }

    const updated = await prisma.contentRecommendation.update({
      where: { id },
      data,
    });
    return updated;
  });

  // On-demand generation for one domain (e.g. right after adding it)
  fastify.post("/recommendations/generate", async (request, reply) => {
    const { domain } = request.body as { domain?: string };
    if (!domain) return reply.code(400).send({ error: "domain required" });

    const d = await prisma.domain.findFirst({
      where: { OR: [{ domain }, { domain: `www.${domain}` }] },
      select: { id: true, domain: true },
    });
    if (!d) return reply.code(404).send({ error: "Unknown domain" });

    const result = await decay.generateForDomain(d.id);
    return { domain: d.domain, ...result };
  });

  // Domain registration from external systems (sitario go-live provisioning).
  // Expects the panel's SA to already be a co-owner of the GSC property
  // (sitario adds it via siteVerification during go-live); here we upsert the
  // Domain row and best-effort add the property to the SA's Search Console.
  // body: {domain, siteUrl?, gscProperty?, category?, label?}
  fastify.post("/domains", async (request, reply) => {
    const { domain, siteUrl, gscProperty, category, label } = request.body as {
      domain?: string;
      siteUrl?: string;
      gscProperty?: string;
      category?: string;
      label?: string;
    };
    if (!domain) return reply.code(400).send({ error: "domain required" });

    const clean = domain.toLowerCase().replace(/^www\./, "");
    const data = {
      siteUrl: siteUrl || `https://www.${clean}`,
      gscProperty: gscProperty || `sc-domain:${clean}`,
      category: (category as any) || "CLIENT",
      label: label || clean,
      isActive: true,
    };

    const existing = await prisma.domain.findFirst({
      where: { OR: [{ domain: clean }, { domain: `www.${clean}` }] },
    });
    const row = existing
      ? await prisma.domain.update({ where: { id: existing.id }, data })
      : await prisma.domain.create({ data: { domain: clean, ...data } });

    // Property must be in the SA's account for daily gsc_pull to see it
    let gscAdded = false;
    try {
      const { getSearchConsole } = await import("../lib/google-auth.js");
      const sc = await getSearchConsole();
      await sc.sites.add({ siteUrl: data.gscProperty });
      gscAdded = true;
    } catch (e: any) {
      if (/already|409/i.test(e.message)) gscAdded = true;
    }

    return { ok: true, id: row.id, domain: row.domain, created: !existing, gscAdded };
  });

  // Publication events from executors → SeoEvent timeline
  // body: {domain, type, url?, path?, title?, recommendationId?, data?}
  fastify.post("/events", async (request, reply) => {
    const { domain, type, url, path, title, recommendationId, data } =
      request.body as {
        domain?: string;
        type?: string;
        url?: string;
        path?: string;
        title?: string;
        recommendationId?: string;
        data?: any;
      };

    const allowed = ["CONTENT_PUBLISHED", "CONTENT_REFRESHED", "CONTENT_PRUNED"];
    if (!domain || !type || !allowed.includes(type)) {
      return reply
        .code(400)
        .send({ error: `domain and type (${allowed.join("|")}) required` });
    }

    const d = await prisma.domain.findFirst({
      where: { OR: [{ domain }, { domain: `www.${domain}` }] },
      select: { id: true },
    });
    if (!d) return reply.code(404).send({ error: "Unknown domain" });

    // Attach the page if the panel already tracks it (sitemap_sync may lag)
    const pagePath = path || (url ? toPath(url) : null);
    const page = pagePath
      ? await prisma.page.findUnique({
          where: { domainId_path: { domainId: d.id, path: pagePath } },
          select: { id: true },
        })
      : null;

    const event = await prisma.seoEvent.create({
      data: {
        domainId: d.id,
        pageId: page?.id || null,
        type: type as any,
        importance: 3,
        data: { url, path: pagePath, title, recommendationId, ...data },
      },
    });

    if (recommendationId) {
      await prisma.contentRecommendation
        .update({
          where: { id: recommendationId },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
            ...(url ? { publishedUrl: url } : {}),
            ...(page ? { pageId: page.id } : {}),
          },
        })
        .catch(() => {}); // unknown id must not fail the event write
    }

    return { ok: true, eventId: event.id, pageMatched: !!page };
  });
}

function toPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
