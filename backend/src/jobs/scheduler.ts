import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { GscService } from "../services/gsc.service.js";
import { SitemapService } from "../services/sitemap.service.js";
import { IndexingService } from "../services/indexing.service.js";
import { LinkCrawlerService } from "../services/link-crawler.service.js";

const gsc = new GscService();
const sitemap = new SitemapService();
const indexing = new IndexingService();
const crawler = new LinkCrawlerService();

async function runJob(jobName: string, fn: () => Promise<any>) {
  const job = await prisma.jobRun.create({
    data: { jobName, status: "RUNNING" },
  });

  try {
    const result = await fn();
    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        details: result,
      },
    });
    console.log(`✅ Job ${jobName} completed`);
  } catch (error: any) {
    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorLog: error.message,
      },
    });
    console.error(`❌ Job ${jobName} failed: ${error.message}`);
  }
}

export function startScheduler() {
  console.log("⏰ Starting SEO Panel scheduler...");

  // Daily 06:00 — Pull GSC data (yesterday + today)
  cron.schedule("0 6 * * *", () => {
    runJob("gsc_pull", async () => {
      const end = new Date().toISOString().split("T")[0];
      const start = new Date(Date.now() - 3 * 86400000)
        .toISOString()
        .split("T")[0];
      return gsc.pullAllDomains(start, end);
    });
  });

  // Daily 07:00 — Sync sitemaps
  cron.schedule("0 7 * * *", () => {
    runJob("sitemap_sync", () => sitemap.syncAll());
  });

  // Daily 08:00 — Check indexing for non-PASS pages
  cron.schedule("0 8 * * *", () => {
    runJob("indexing_check", async () => {
      const domains = await prisma.domain.findMany({
        where: { isActive: true },
      });
      const results = [];
      for (const domain of domains) {
        try {
          const r = await indexing.checkDomain(domain.id);
          results.push({ domain: domain.domain, ...r });
        } catch (e: any) {
          results.push({ domain: domain.domain, error: e.message });
        }
      }
      return results;
    });
  });

  // Weekly Sunday 03:00 — Full link crawl
  cron.schedule("0 3 * * 0", () => {
    runJob("link_crawl", async () => {
      const domains = await prisma.domain.findMany({
        where: { isActive: true },
      });
      const results = [];
      for (const domain of domains) {
        try {
          const r = await crawler.crawlDomain(domain.id);
          results.push({ domain: domain.domain, ...r });
        } catch (e: any) {
          results.push({ domain: domain.domain, error: e.message });
        }
      }
      return results;
    });
  });

  console.log("  📊 GSC pull: daily 06:00");
  console.log("  🗺️  Sitemap sync: daily 07:00");
  console.log("  🔍 Indexing check: daily 08:00");
  console.log("  🔗 Link crawl: weekly Sunday 03:00");
}
