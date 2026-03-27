// backend/src/routes/import.ts

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function importRoutes(fastify: FastifyInstance) {
  // Import indexing data from existing Lambda dashboard API
  fastify.post("/import-indexing", async () => {
    const DASHBOARD_API =
      "https://aqsazq5ae5.execute-api.eu-central-1.amazonaws.com/prod";

    // Get domains from dashboard
    const domainsRes = await fetch(`${DASHBOARD_API}/domains`);
    const dashDomains = await domainsRes.json();

    const results: any[] = [];

    for (const dd of dashDomains) {
      // Find matching domain in our DB
      const domain = await prisma.domain.findUnique({
        where: { domain: dd.domain },
      });

      if (!domain) {
        results.push({
          domain: dd.domain,
          status: "skipped",
          reason: "not in DB",
        });
        continue;
      }

      // Fetch URLs from dashboard
      const urlsRes = await fetch(`${DASHBOARD_API}/urls?domain=${dd.domain}`);
      const urlsText = await urlsRes.text();
      let urls: any[];
      try {
        urls = JSON.parse(urlsText);
        if (typeof urls === "string") urls = JSON.parse(urls);
      } catch {
        results.push({
          domain: dd.domain,
          status: "error",
          reason: "parse error",
        });
        continue;
      }

      let updated = 0;
      for (const u of urls) {
        const path = new URL(u.url).pathname;

        try {
          await prisma.page.upsert({
            where: { domainId_path: { domainId: domain.id, path } },
            update: {
              indexingVerdict:
                u.verdict === "PASS"
                  ? "PASS"
                  : u.verdict === "FAIL"
                    ? "FAIL"
                    : u.verdict === "NEUTRAL"
                      ? "NEUTRAL"
                      : "UNKNOWN",
              coverageState: u.coverageState || null,
              lastCrawlTime:
                u.lastCrawlTime && u.lastCrawlTime !== "none"
                  ? new Date(u.lastCrawlTime)
                  : undefined,
              lastChecked: u.lastChecked ? new Date(u.lastChecked) : undefined,
              firstSubmitted: u.firstSubmitted
                ? new Date(u.firstSubmitted)
                : undefined,
              lastSubmitted: u.lastSubmitted
                ? new Date(u.lastSubmitted)
                : undefined,
              statusChangedAt: u.statusChangedAt
                ? new Date(u.statusChangedAt)
                : undefined,
              previousVerdict: u.previousVerdict || undefined,
              indexingState: u.indexingState || undefined,
              pageFetchState: u.pageFetchState || undefined,
              robotsTxtState: u.robotsTxtState || undefined,
            },
            create: {
              domainId: domain.id,
              url: u.url,
              path,
              indexingVerdict:
                u.verdict === "PASS"
                  ? "PASS"
                  : u.verdict === "FAIL"
                    ? "FAIL"
                    : u.verdict === "NEUTRAL"
                      ? "NEUTRAL"
                      : "UNKNOWN",
              coverageState: u.coverageState || null,
              lastChecked: u.lastChecked ? new Date(u.lastChecked) : undefined,
              inSitemap: true,
            },
          });
          updated++;
        } catch (e: any) {
          // skip duplicates
        }
      }

      // Update domain stats
      const stats = await prisma.page.groupBy({
        by: ["indexingVerdict"],
        where: { domainId: domain.id, inSitemap: true },
        _count: { id: true },
      });
      const indexed =
        stats.find((s) => s.indexingVerdict === "PASS")?._count.id || 0;
      const total = stats.reduce((sum, s) => sum + s._count.id, 0);

      await prisma.domain.update({
        where: { id: domain.id },
        data: { indexedPages: indexed, totalPages: total },
      });

      results.push({ domain: dd.domain, updated, indexed, total });
    }

    return results;
  });
}
