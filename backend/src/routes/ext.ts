import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { ContentDecayService } from "../services/content-decay.service.js";

const decay = new ContentDecayService();

const DAY = 86400000;
function daysAgo(n: number): Date {
  const d = new Date(Date.now() - n * DAY);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

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

  // Aggregated weekly-report payload for the AI synthesis layer (local
  // Claude Code cron on Karol's machine). Two consecutive 7-day windows,
  // both ending at today-3 to respect GSC data lag.
  fastify.get("/report-data", async () => {
    const LAG = 3;
    const curFrom = daysAgo(LAG + 7);
    const curTo = daysAgo(LAG);
    const prevFrom = daysAgo(LAG + 14);

    const domains = await prisma.domain.findMany({
      where: { isActive: true },
      select: { id: true, domain: true, label: true, category: true },
      orderBy: { domain: "asc" },
    });

    const out = [];
    for (const d of domains) {
      const [cur, prev] = await Promise.all([
        prisma.gscDomainDaily.aggregate({
          where: { domainId: d.id, date: { gte: curFrom, lt: curTo } },
          _sum: { clicks: true, impressions: true },
        }),
        prisma.gscDomainDaily.aggregate({
          where: { domainId: d.id, date: { gte: prevFrom, lt: curFrom } },
          _sum: { clicks: true, impressions: true },
        }),
      ]);

      // page movers by click delta between the two windows
      const [curPages, prevPages] = await Promise.all([
        prisma.gscPageDaily.groupBy({
          by: ["pageId"],
          where: { page: { domainId: d.id }, date: { gte: curFrom, lt: curTo } },
          _sum: { clicks: true },
        }),
        prisma.gscPageDaily.groupBy({
          by: ["pageId"],
          where: { page: { domainId: d.id }, date: { gte: prevFrom, lt: curFrom } },
          _sum: { clicks: true },
        }),
      ]);
      const prevMap = new Map(prevPages.map((p) => [p.pageId, p._sum.clicks || 0]));
      const ids = new Set([...curPages.map((p) => p.pageId), ...prevMap.keys()]);
      const curMap = new Map(curPages.map((p) => [p.pageId, p._sum.clicks || 0]));
      const deltas = [...ids]
        .map((id) => ({
          pageId: id,
          cur: curMap.get(id) || 0,
          prev: prevMap.get(id) || 0,
          delta: (curMap.get(id) || 0) - (prevMap.get(id) || 0),
        }))
        .filter((m) => m.delta !== 0);
      deltas.sort((a, b) => b.delta - a.delta);
      const moverIds = [...deltas.slice(0, 5), ...deltas.slice(-5)].map((m) => m.pageId);
      const paths = new Map(
        (
          await prisma.page.findMany({
            where: { id: { in: moverIds } },
            select: { id: true, path: true },
          })
        ).map((p) => [p.id, p.path]),
      );
      const withPath = (m: (typeof deltas)[0]) => ({
        path: paths.get(m.pageId) || "?",
        clicks: m.cur,
        clicksPrev: m.prev,
        delta: m.delta,
      });

      const [alerts, events, recsNew, outcomes, ga4] = await Promise.all([
        prisma.alert.findMany({
          where: { domainId: d.id, createdAt: { gte: daysAgo(7) } },
          select: { type: true, severity: true, title: true },
          take: 10,
          orderBy: { createdAt: "desc" },
        }),
        prisma.seoEvent.groupBy({
          by: ["type"],
          where: { domainId: d.id, createdAt: { gte: daysAgo(7) } },
          _count: true,
        }),
        prisma.contentRecommendation.findMany({
          where: { domainId: d.id, createdAt: { gte: daysAgo(7) } },
          select: { type: true, status: true, topic: true, reason: true, score: true },
          orderBy: { score: "desc" },
          take: 15,
        }),
        prisma.contentRecommendation.findMany({
          where: { domainId: d.id, measuredAt: { gte: daysAgo(7) } },
          select: {
            type: true,
            topic: true,
            outcome: true,
            publishedUrl: true,
            page: { select: { path: true } },
          },
        }),
        prisma.integrationDaily.aggregate({
          where: {
            integration: { domainId: d.id, provider: "GOOGLE_ANALYTICS" },
            date: { gte: curFrom, lt: curTo },
          },
          _sum: { sessions: true, conversions: true, revenue: true },
        }),
      ]);

      out.push({
        domain: d.domain,
        label: d.label,
        category: d.category,
        gsc: {
          clicks: cur._sum.clicks || 0,
          clicksPrev: prev._sum.clicks || 0,
          impressions: cur._sum.impressions || 0,
          impressionsPrev: prev._sum.impressions || 0,
        },
        ga4: {
          sessions: ga4._sum.sessions || 0,
          conversions: ga4._sum.conversions || 0,
          revenue: ga4._sum.revenue || 0,
        },
        winners: deltas.slice(0, 5).map(withPath),
        losers: deltas.slice(-5).reverse().map(withPath),
        alerts,
        events: Object.fromEntries(events.map((e) => [e.type, e._count])),
        recommendationsNew: recsNew,
        outcomesMeasured: outcomes,
      });
    }

    return {
      windows: {
        current: `${curFrom.toISOString().slice(0, 10)}..${curTo.toISOString().slice(0, 10)}`,
        previous: `${prevFrom.toISOString().slice(0, 10)}..${curFrom.toISOString().slice(0, 10)}`,
      },
      domains: out,
    };
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
