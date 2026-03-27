import { prisma } from "../lib/prisma.js";

export class SitemapService {
  /**
   * Fetch and parse sitemap for a domain. Handles:
   * - Sitemap index (sitemapindex → multiple urlset)
   * - Flat sitemap (single urlset)
   * - Both /sitemap-index.xml and /sitemap_index.xml
   */
  async syncDomain(domainId: string): Promise<{ total: number; added: number; removed: number }> {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    const sitemapUrl = `${domain.siteUrl}${domain.sitemapPath}`;
    const urls = await this.fetchSitemapUrls(sitemapUrl);

    // Get current pages
    const currentPages = await prisma.page.findMany({
      where: { domainId },
      select: { id: true, url: true, path: true, inSitemap: true },
    });

    const currentUrlSet = new Set(currentPages.map((p) => p.url));
    const newUrlSet = new Set(urls);

    let added = 0;
    let removed = 0;

    // Add new pages
    for (const url of urls) {
      if (!currentUrlSet.has(url)) {
        try {
          const path = new URL(url).pathname;
          await prisma.page.create({
            data: {
              domainId,
              url,
              path,
              inSitemap: true,
              indexingVerdict: "UNCHECKED",
            },
          });
          added++;
        } catch {
          // Unique constraint — page already exists with different URL format
        }
      }
    }

    // Mark removed pages
    for (const page of currentPages) {
      if (!newUrlSet.has(page.url) && page.inSitemap) {
        await prisma.page.update({
          where: { id: page.id },
          data: { inSitemap: false },
        });
        removed++;
      }
    }

    // Mark existing pages as in sitemap
    for (const page of currentPages) {
      if (newUrlSet.has(page.url) && !page.inSitemap) {
        await prisma.page.update({
          where: { id: page.id },
          data: { inSitemap: true },
        });
      }
    }

    // Update domain stats
    const totalInSitemap = await prisma.page.count({
      where: { domainId, inSitemap: true },
    });

    await prisma.domain.update({
      where: { id: domainId },
      data: {
        totalPages: totalInSitemap,
        lastSitemapSync: new Date(),
      },
    });

    // Create alert for sitemap changes
    if (added > 0 || removed > 0) {
      await prisma.alert.create({
        data: {
          domainId,
          type: "SITEMAP_CHANGE",
          severity: "LOW",
          title: `Sitemap: +${added} / -${removed} stron`,
          description: `Dodano ${added} nowych URL-i, usunięto ${removed}. Total: ${totalInSitemap}.`,
        },
      });
    }

    return { total: urls.length, added, removed };
  }

  /**
   * Sync all active domains
   */
  async syncAll() {
    const domains = await prisma.domain.findMany({
      where: { isActive: true },
    });

    const results: { domain: string; total: number; added: number; removed: number; error?: string }[] = [];

    for (const domain of domains) {
      try {
        const result = await this.syncDomain(domain.id);
        results.push({ domain: domain.domain, ...result });
      } catch (error: any) {
        results.push({
          domain: domain.domain,
          total: 0,
          added: 0,
          removed: 0,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Fetch URLs from sitemap (handles index + flat formats)
   */
  private async fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
    const res = await fetch(sitemapUrl);
    const xml = await res.text();

    // Check if it's a sitemap index
    const sitemapLocs = [
      ...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g),
    ].map((m) => m[1]);

    if (sitemapLocs.length > 0) {
      // Sitemap index — fetch each child
      const allUrls: string[] = [];
      for (const loc of sitemapLocs) {
        const childRes = await fetch(loc);
        const childXml = await childRes.text();
        const urls = [
          ...childXml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g),
        ].map((m) => m[1]);
        allUrls.push(...urls);
      }
      return [...new Set(allUrls)];
    } else {
      // Flat sitemap
      const urls = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map(
        (m) => m[1]
      );
      return [...new Set(urls)];
    }
  }
}
