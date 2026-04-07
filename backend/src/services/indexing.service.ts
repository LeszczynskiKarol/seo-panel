import { prisma } from "../lib/prisma.js";
import { getAccessToken } from "../lib/google-auth.js";
import { IndexingVerdict } from "@prisma/client";

export class IndexingService {
  /**
   * Inspect a single URL via Google URL Inspection API
   */
  async inspectUrl(url: string, siteUrl: string) {
    const token = await getAccessToken();

    const res = await fetch(
      "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inspectionUrl: url, siteUrl }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      return { error: true, status: res.status, message: err };
    }

    const data = await res.json();
    const idx = data.inspectionResult?.indexStatusResult || {};

    return {
      error: false,
      verdict: idx.verdict || "UNKNOWN",
      coverageState: idx.coverageState || "Unknown",
      robotsTxtState: idx.robotsTxtState || "UNKNOWN",
      indexingState: idx.indexingState || "UNKNOWN",
      lastCrawlTime: idx.lastCrawlTime || null,
      pageFetchState: idx.pageFetchState || "UNKNOWN",
      crawledAs: idx.crawledAs || "UNKNOWN",
    };
  }

  /**
   * Check indexing status for all unchecked/non-PASS pages of a domain
   */
  async checkDomain(
    domainId: string,
  ): Promise<{ checked: number; errors: number }> {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    const siteUrl =
      domain.gscProperty || `sc-domain:${domain.domain.replace(/^www\./, "")}`;

    const pages = await prisma.page.findMany({
      where: {
        domainId,
        indexingVerdict: { notIn: ["PASS", "REMOVED"] },
        inSitemap: true,
      },
    });

    let checked = 0;
    let errors = 0;

    for (const page of pages) {
      try {
        let result = await this.inspectUrl(page.url, siteUrl);

        // If NEUTRAL, try alternate URL (with/without trailing slash)
        if (!result.error && result.verdict === "NEUTRAL") {
          const altUrl = page.url.endsWith("/")
            ? page.url.slice(0, -1)
            : page.url + "/";
          const altResult = await this.inspectUrl(altUrl, siteUrl);
          if (!altResult.error && altResult.verdict === "PASS") {
            result = altResult;
          }
          await new Promise((r) => setTimeout(r, 1200));
        }

        if (result.error) {
          errors++;
          continue;
        }

        // Fetch page title — try URL Inspection first (has rendered title), fallback to fetch
        let pageTitle: string | null = null;

        // Method 1: from inspection result (referringUrls sometimes has title)
        const inspTitle = (result as any).inspectionResult?.indexStatusResult
          ?.sitemap;

        // Method 2: fetch HTML
        try {
          const fetchUrl = page.url.endsWith("/") ? page.url : page.url + "/";
          const titleRes = await fetch(fetchUrl, {
            redirect: "follow",
            signal: AbortSignal.timeout(5000),
            headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOPanel/1.0)" },
          });
          if (titleRes.ok) {
            const html = await titleRes.text();
            // Try og:title first (works for SPAs with SSR meta tags)
            const ogMatch =
              html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
              html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
            if (ogMatch) {
              pageTitle = ogMatch[1].trim().slice(0, 500);
            } else {
              // Fallback to <title> — take last one (react-helmet/data-rh)
              const matches = [
                ...html.matchAll(/<title[^>]*>([^<]+)<\/title>/gi),
              ];
              if (matches.length > 0) {
                pageTitle = matches[matches.length - 1][1].trim().slice(0, 500);
              }
            }
            // Decode HTML entities
            if (pageTitle) {
              pageTitle = pageTitle
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&#(\d+);/g, (_, n) =>
                  String.fromCharCode(parseInt(n)),
                );
            }
          }
        } catch {}

        const verdict = this.mapVerdict(result.verdict);
        const now = new Date();

        // Check for status change
        const statusChanged =
          page.indexingVerdict !== "UNCHECKED" &&
          page.indexingVerdict !== verdict;

        await prisma.page.update({
          where: { id: page.id },
          data: {
            indexingVerdict: verdict,
            ...(pageTitle ? { title: pageTitle } : {}),
            coverageState: result.coverageState,
            robotsTxtState: result.robotsTxtState,
            indexingState: result.indexingState,
            pageFetchState: result.pageFetchState,
            crawledAs: result.crawledAs,
            lastCrawlTime: result.lastCrawlTime
              ? new Date(result.lastCrawlTime)
              : undefined,
            lastChecked: now,
            ...(statusChanged
              ? {
                  statusChangedAt: now,
                  previousVerdict: page.indexingVerdict,
                }
              : {}),
          },
        });

        // Create alert if deindexed
        if (
          statusChanged &&
          page.indexingVerdict === "PASS" &&
          verdict !== "PASS"
        ) {
          await prisma.alert.create({
            data: {
              domainId,
              pageId: page.id,
              type: "PAGE_DEINDEXED",
              severity: "HIGH",
              title: `Strona wypadła z indeksu: ${page.path}`,
              description: `Status zmieniony z ${page.indexingVerdict} na ${verdict}. Coverage: ${result.coverageState}`,
            },
          });
        }

        checked++;

        // Rate limit: ~1 req/sec for URL Inspection API
        await new Promise((r) => setTimeout(r, 1200));
      } catch (err: any) {
        errors++;
        console.error(`Inspection error for ${page.url}: ${err.message}`);
      }
    }

    // Update domain stats
    const stats = await prisma.page.groupBy({
      by: ["indexingVerdict"],
      where: { domainId, inSitemap: true },
      _count: { id: true },
    });

    const indexed =
      stats.find((s) => s.indexingVerdict === "PASS")?._count.id || 0;
    const total = stats.reduce((sum, s) => sum + s._count.id, 0);

    await prisma.domain.update({
      where: { id: domainId },
      data: { indexedPages: indexed, totalPages: total },
    });

    return { checked, errors };
  }

  /**
   * Submit URL to Google Indexing API
   */
  async submitUrl(
    url: string,
    type: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED",
  ) {
    const token = await getAccessToken();

    const res = await fetch(
      "https://indexing.googleapis.com/v3/urlNotifications:publish",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, type }),
      },
    );

    return { url, type, status: res.status, ok: res.ok };
  }

  private mapVerdict(verdict: string): IndexingVerdict {
    switch (verdict) {
      case "PASS":
        return "PASS";
      case "FAIL":
        return "FAIL";
      case "NEUTRAL":
        return "NEUTRAL";
      case "REMOVAL_REQUESTED":
        return "REMOVAL_REQUESTED";
      case "REMOVED":
        return "REMOVED";
      default:
        return "UNKNOWN";
    }
  }
}
