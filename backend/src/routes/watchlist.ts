// backend/src/routes/watchlist.ts

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getSearchConsole } from "../lib/google-auth.js";

export async function watchlistRoutes(fastify: FastifyInstance) {
  // List all watched keywords
  fastify.get("/", async () => {
    return prisma.watchedKeyword.findMany({
      orderBy: { createdAt: "desc" },
    });
  });

  // Add keyword
  fastify.post("/", async (request, reply) => {
    const { keyword } = request.body as { keyword: string };
    if (!keyword?.trim())
      return reply.status(400).send({ error: "Keyword required" });

    const kw = keyword.trim().toLowerCase();
    const existing = await prisma.watchedKeyword.findUnique({
      where: { keyword: kw },
    });
    if (existing) return { ...existing, message: "already_exists" };

    const created = await prisma.watchedKeyword.create({
      data: { keyword: kw },
    });
    return created;
  });

  // Remove keyword
  fastify.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    await prisma.watchedKeyword.delete({ where: { id } });
    return { ok: true };
  });

  // Check all watched keywords across all domains
  fastify.post("/check-all", async () => {
    const keywords = await prisma.watchedKeyword.findMany();
    const domains = await prisma.domain.findMany({
      where: { isActive: true, gscProperty: { not: null } },
    });

    const sc = await getSearchConsole();
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .split("T")[0];
    const today = endDate;

    let checked = 0;

    for (const kw of keywords) {
      const allResults: any[] = [];

      for (const domain of domains) {
        try {
          const res = await sc.searchanalytics.query({
            siteUrl: domain.gscProperty!,
            requestBody: {
              startDate,
              endDate,
              dimensions: ["page"],
              dimensionFilterGroups: [
                {
                  filters: [{ dimension: "query", expression: kw.keyword }],
                },
              ],
              rowLimit: 20,
            },
          });

          for (const row of res.data.rows || []) {
            const url = row.keys![0];
            let path: string;
            try {
              path = new URL(url).pathname;
            } catch {
              path = url;
            }

            allResults.push({
              domainId: domain.id,
              domain: domain.label || domain.domain,
              domainName: domain.domain,
              url,
              path,
              position: Math.round((row.position || 0) * 10) / 10,
              clicks: row.clicks || 0,
              impressions: row.impressions || 0,
              ctr: row.ctr || 0,
            });
          }
        } catch {}

        // Rate limit
        await new Promise((r) => setTimeout(r, 150));
      }

      // Sort by position
      allResults.sort((a, b) => (a.position || 999) - (b.position || 999));

      const best = allResults[0];

      // Update history
      const history = (kw.positionHistory as any[]) || [];
      history.push({
        date: today,
        results: allResults.map((r) => ({
          domain: r.domainName,
          url: r.path,
          position: r.position,
          clicks: r.clicks,
        })),
      });
      if (history.length > 90) history.splice(0, history.length - 90);

      await prisma.watchedKeyword.update({
        where: { id: kw.id },
        data: {
          results: allResults,
          totalPages: allResults.length,
          bestPosition: best?.position || null,
          bestDomain: best?.domain || null,
          bestUrl: best?.url || null,
          positionHistory: history,
          lastChecked: new Date(),
        },
      });

      checked++;
    }

    return { checked, total: keywords.length };
  });

  // Get detail for single keyword
  fastify.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.watchedKeyword.findUniqueOrThrow({ where: { id } });
  });
}
