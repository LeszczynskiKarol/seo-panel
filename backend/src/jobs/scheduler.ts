import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { GscService } from "../services/gsc.service.js";
import { GA4Service } from "../services/ga4.service.js";
import { MerchantService } from "../services/merchant.service.js";
import { AlertDetectionService } from "../services/alert-detection.service.js";
import { MozService } from "../services/moz.service.js";
import { SitemapService } from "../services/sitemap.service.js";
import { IndexingService } from "../services/indexing.service.js";
import { LinkCrawlerService } from "../services/link-crawler.service.js";
import { TimelineService } from "../services/timeline.service.js";

const STOJAN_API_URL = process.env.STOJAN_API_URL || "http://16.171.6.205:4000";
const STOJAN_API_KEY = process.env.STOJAN_API_KEY || "";
const STOJAN_INTEGRATION_ID = process.env.STOJAN_INTEGRATION_ID || "";
const ga4Service = new GA4Service();
const merchantService = new MerchantService();
const gsc = new GscService();
const alertDetection = new AlertDetectionService();
const sitemap = new SitemapService();
const indexing = new IndexingService();
const crawler = new LinkCrawlerService();
const timeline = new TimelineService();

async function runJob(jobName: string, fn: () => Promise<any>) {
  const job = await prisma.jobRun.create({
    data: { jobName, status: "RUNNING" },
  });
  try {
    const result = await fn();
    await prisma.jobRun.update({
      where: { id: job.id },
      data: { status: "COMPLETED", finishedAt: new Date(), details: result },
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

async function checkDomainKeywordsAll() {
  const { getSearchConsole } = await import("../lib/google-auth.js");
  const sc = await getSearchConsole();
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .split("T")[0];

  const keywords = await prisma.domainKeyword.findMany({
    include: { domain: { select: { gscProperty: true, domain: true } } },
  });

  let checked = 0;
  for (const kw of keywords) {
    if (!kw.domain.gscProperty) continue;
    try {
      const res = await sc.searchanalytics.query({
        siteUrl: kw.domain.gscProperty,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["page"],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: "query",
                  operator: "contains",
                  expression: kw.keyword,
                },
              ],
            },
          ],
          rowLimit: 20,
        },
      });

      const results = (res.data.rows || [])
        .map((r: any) => {
          let path: string;
          try {
            path = new URL(r.keys![0]).pathname;
          } catch {
            path = r.keys![0];
          }
          return {
            url: r.keys![0],
            path,
            position: Math.round((r.position || 0) * 10) / 10,
            clicks: r.clicks || 0,
            impressions: r.impressions || 0,
            ctr: r.ctr || 0,
          };
        })
        .sort((a: any, b: any) => a.position - b.position);

      const best = results[0];
      const history = (kw.positionHistory as any[]) || [];
      history.push({
        date: endDate,
        bestPosition: best?.position || null,
        pages: results.length,
      });
      if (history.length > 90) history.splice(0, history.length - 90);

      await prisma.domainKeyword.update({
        where: { id: kw.id },
        data: {
          results,
          bestPosition: best?.position || null,
          totalClicks: results.reduce((s: number, r: any) => s + r.clicks, 0),
          totalPages: results.length,
          positionHistory: history,
          lastChecked: new Date(),
        },
      });
      checked++;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return { checked, total: keywords.length };
}

export function startScheduler() {
  console.log("⏰ Starting SEO Panel scheduler...");

  // 03:00 — Link crawl (daily, all domains)
  cron.schedule("0 3 * * *", () => {
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

  // 06:00 — Pull GSC data (last 3 days)
  cron.schedule("0 6 * * *", () => {
    runJob("gsc_pull", async () => {
      const end = new Date().toISOString().split("T")[0];
      const start = new Date(Date.now() - 3 * 86400000)
        .toISOString()
        .split("T")[0];
      return gsc.pullAllDomains(start, end);
    });
  });

  // 07:00 — Sync sitemaps
  cron.schedule("0 7 * * *", () => {
    runJob("sitemap_sync", () => sitemap.syncAll());
  });

  // 08:00 — Check indexing
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

  // 09:00 — Detect position changes + sync backlinks from crawl data
  cron.schedule("0 9 * * *", () => {
    runJob("detect_changes", async () => {
      const domains = await prisma.domain.findMany({
        where: { isActive: true },
      });
      const results = [];
      for (const d of domains) {
        try {
          const positions = await timeline.detectPositionChanges(d.id);
          const backlinks = await timeline.syncBacklinks(d.id);
          results.push({
            domain: d.domain,
            positionEvents: positions,
            ...backlinks,
          });
        } catch (e: any) {
          results.push({ domain: d.domain, error: e.message });
        }
      }
      return results;
    });
  });

  // ─── MOZ SYNC — Every Sunday at 04:00 ─────────────────────
  // Syncs DA/PA/Spam Score + external backlinks for all domains

  cron.schedule("0 4 1,15 * *", async () => {
    console.log("[Scheduler] Starting weekly Moz sync...");
    const moz = new MozService();
    const job = await prisma.jobRun.create({
      data: { jobName: "moz_sync", status: "RUNNING" },
    });

    try {
      const results = await moz.syncAllDomains();
      const errors = results.filter((r: any) => r.status === "error").length;

      await prisma.jobRun.update({
        where: { id: job.id },
        data: {
          status: errors === results.length ? "FAILED" : "COMPLETED",
          finishedAt: new Date(),
          domainsProcessed: results.length,
          errors,
          details: results,
        },
      });

      console.log(
        `[Scheduler] Moz sync done: ${results.length} domains, ${errors} errors`,
      );
    } catch (e: any) {
      await prisma.jobRun.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorLog: e.message,
        },
      });
      console.error("[Scheduler] Moz sync failed:", e.message);
    }
  });

  // 10:00 — Check domain keywords
  cron.schedule("0 10 * * *", () => {
    runJob("domain_keywords_check", checkDomainKeywordsAll);
  });

  // Daily 08:00 — GA4 pull for all active integrations
  cron.schedule("0 8 * * *", async () => {
    console.log("⏰ [CRON] GA4 daily sync starting...");
    try {
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0];
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000)
        .toISOString()
        .split("T")[0];
      const results = await ga4Service.syncAll(threeDaysAgo, yesterday);
      console.log(`✅ [CRON] GA4 sync done:`, results);
    } catch (e: any) {
      console.error("❌ [CRON] GA4 sync failed:", e.message);
    }
  });

  // Daily 08:30 — Merchant Center sync
  cron.schedule("30 8 * * *", async () => {
    console.log("⏰ [CRON] Merchant Center daily sync starting...");
    try {
      const results = await merchantService.syncAll();
      console.log(`✅ [CRON] Merchant sync done:`, results);
    } catch (e: any) {
      console.error("❌ [CRON] Merchant sync failed:", e.message);
    }
  });

  //   🚨 Alert detection:   daily 09:30

  cron.schedule("30 9 * * *", async () => {
    console.log("🚨 Running cross-source alert detection...");
    const result = await alertDetection.detectAll();
    console.log(`🚨 Alert detection done: ${result.created} new alerts`);
    result.checks.forEach((c) => console.log(`   ${c}`));
  });
}
