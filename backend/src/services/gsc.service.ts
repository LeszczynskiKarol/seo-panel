import { prisma } from "../lib/prisma.js";
import { getSearchConsole } from "../lib/google-auth.js";

export class GscService {
  /**
   * Pull GSC data for a single domain for a given date range
   */
  async pullDomainData(
    domainId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ pages: number; rows: number }> {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    if (!domain.gscProperty) {
      throw new Error(`Domain ${domain.domain} has no GSC property configured`);
    }

    const searchconsole = await getSearchConsole();
    let totalRows = 0;
    let totalPages = 0;

    // 1. Pull page-level data
    const pageResponse = await searchconsole.searchanalytics.query({
      siteUrl: domain.gscProperty,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["page", "date"],
        rowLimit: 25000,
      },
    });

    const rows = pageResponse.data.rows || [];
    totalRows = rows.length;

    // Group by page+date
    for (const row of rows) {
      const url = row.keys![0];
      const date = row.keys![1];
      const path = new URL(url).pathname;

      // Upsert page
      const page = await prisma.page.upsert({
        where: { domainId_path: { domainId, path } },
        update: {},
        create: { domainId, url, path },
      });

      totalPages++;

      // Upsert daily metrics
      await prisma.gscPageDaily.upsert({
        where: {
          pageId_date: { pageId: page.id, date: new Date(date) },
        },
        update: {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        },
        create: {
          pageId: page.id,
          date: new Date(date),
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        },
      });
    }

    // 2. Pull domain-level aggregates
    const domainResponse = await searchconsole.searchanalytics.query({
      siteUrl: domain.gscProperty,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["date"],
        rowLimit: 500,
      },
    });

    for (const row of domainResponse.data.rows || []) {
      const date = row.keys![0];
      await prisma.gscDomainDaily.upsert({
        where: {
          domainId_date: { domainId, date: new Date(date) },
        },
        update: {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        },
        create: {
          domainId,
          date: new Date(date),
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        },
      });
    }

    // 3. Update cached stats on domain
    const latestDay = await prisma.gscDomainDaily.findFirst({
      where: { domainId },
      orderBy: { date: "desc" },
    });

    const last30Agg = await prisma.gscDomainDaily.aggregate({
      where: {
        domainId,
        date: { gte: new Date(startDate) },
      },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    });

    await prisma.domain.update({
      where: { id: domainId },
      data: {
        totalClicks: last30Agg._sum.clicks || 0,
        totalImpressions: last30Agg._sum.impressions || 0,
        avgPosition: last30Agg._avg.position,
        lastGscPull: new Date(),
      },
    });

    // 4. Update page cached metrics (latest day)
    const pages = await prisma.page.findMany({ where: { domainId } });
    for (const page of pages) {
      const latest = await prisma.gscPageDaily.findFirst({
        where: { pageId: page.id },
        orderBy: { date: "desc" },
      });
      if (latest) {
        await prisma.page.update({
          where: { id: page.id },
          data: {
            clicks: latest.clicks,
            impressions: latest.impressions,
            ctr: latest.ctr,
            position: latest.position,
          },
        });
      }
    }

    return { pages: totalPages, rows: totalRows };
  }

  /**
   * Pull data for ALL active domains
   */
  async pullAllDomains(startDate: string, endDate: string) {
    const domains = await prisma.domain.findMany({
      where: { isActive: true, gscProperty: { not: null } },
    });

    const results: {
      domain: string;
      pages: number;
      rows: number;
      error?: string;
    }[] = [];

    for (const domain of domains) {
      try {
        const result = await this.pullDomainData(domain.id, startDate, endDate);
        results.push({ domain: domain.domain, ...result });
      } catch (error: any) {
        results.push({
          domain: domain.domain,
          pages: 0,
          rows: 0,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get top queries for a domain
   */
  async getTopQueries(
    domainId: string,
    startDate: string,
    endDate: string,
    limit = 50,
  ) {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    if (!domain.gscProperty) return [];

    const searchconsole = await getSearchConsole();
    const response = await searchconsole.searchanalytics.query({
      siteUrl: domain.gscProperty,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: limit,
      },
    });

    return (response.data.rows || []).map((row) => ({
      query: row.keys![0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  }

  /**
   * Get external backlinks from GSC
   */
  async getBacklinks(domainId: string) {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    if (!domain.gscProperty) return { externalLinks: [], internalLinks: [] };

    const searchconsole = await getSearchConsole();

    // External links (backlinks)
    const externalRes = await searchconsole.searchanalytics.query({
      siteUrl: domain.gscProperty,
      requestBody: {
        startDate: new Date(Date.now() - 90 * 86400000)
          .toISOString()
          .split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
        dimensions: ["page"],
        type: "web",
        rowLimit: 1000,
      },
    });

    // GSC Links API
    try {
      const linksRes = await (searchconsole as any).links?.list({
        siteUrl: domain.gscProperty,
      });
      return {
        externalLinks: linksRes?.data?.externalLinks || [],
        internalLinks: linksRes?.data?.internalLinks || [],
      };
    } catch {
      // Links API may not be available via googleapis lib, use raw fetch
      return this.fetchBacklinksRaw(domain.gscProperty);
    }
  }

  private async fetchBacklinksRaw(siteUrl: string) {
    const { getAccessToken } = await import("../lib/google-auth.js");
    const token = await getAccessToken();
    const encoded = encodeURIComponent(siteUrl);

    const [extRes, intRes] = await Promise.all([
      fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate: new Date(Date.now() - 90 * 86400000)
              .toISOString()
              .split("T")[0],
            endDate: new Date().toISOString().split("T")[0],
            dimensions: ["page"],
            rowLimit: 500,
          }),
        },
      ).then((r) => r.json()),
      // Internal links via GSC
      fetch(
        `https://searchconsole.googleapis.com/v1/sites/${encoded}/linksReport`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
        .then((r) => r.json())
        .catch(() => ({})),
    ]);

    return {
      pagesWithTraffic: (extRes.rows || []).map((r: any) => ({
        page: r.keys?.[0],
        clicks: r.clicks,
        impressions: r.impressions,
      })),
      linksReport: intRes,
    };
  }
}
