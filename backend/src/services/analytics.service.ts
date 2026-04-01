import { prisma } from "../lib/prisma.js";
import { getSearchConsole } from "../lib/google-auth.js";

export class AnalyticsService {
  /**
   * QUICK WINS — strony na pozycjach 4-20 z dużą liczbą impressions
   * To są strony które łatwo wywindować do top 3
   */
  async getQuickWins(domainId?: string, limit = 50) {
    const where: any = {
      position: { gte: 4, lte: 20 },
      impressions: { gte: 10 },
      inSitemap: true,
    };
    if (domainId) where.domainId = domainId;

    const pages = await prisma.page.findMany({
      where,
      orderBy: { impressions: "desc" },
      take: limit,
      include: {
        domain: { select: { domain: true, label: true } },
      },
    });

    return pages.map((p) => ({
      ...p,
      potentialClicks: Math.round(
        p.impressions * (0.3 - (p.ctr || 0)), // ile kliknięć zyskasz przy CTR 30%
      ),
      effort: p.position! <= 10 ? "LOW" : p.position! <= 15 ? "MEDIUM" : "HIGH",
    }));
  }

  /**
   * CONTENT GAPS — dużo impressions, mało kliknięć = słaby tytuł/meta description
   * CTR poniżej oczekiwanej dla danej pozycji
   */
  async getContentGaps(domainId?: string, limit = 50) {
    // Expected CTR by position (benchmarks)
    const expectedCtr: Record<number, number> = {
      1: 0.3,
      2: 0.15,
      3: 0.1,
      4: 0.07,
      5: 0.05,
      6: 0.04,
      7: 0.03,
      8: 0.025,
      9: 0.02,
      10: 0.015,
    };

    const where: any = {
      impressions: { gte: 20 },
      position: { gte: 1, lte: 10 },
      inSitemap: true,
    };
    if (domainId) where.domainId = domainId;

    const pages = await prisma.page.findMany({
      where,
      include: { domain: { select: { domain: true, label: true } } },
    });

    const gaps = pages
      .map((p) => {
        const pos = Math.round(p.position || 10);
        const expected = expectedCtr[Math.min(pos, 10)] || 0.01;
        const actual = p.ctr || 0;
        const ctrGap = expected - actual;
        const missedClicks = Math.round(p.impressions * ctrGap);

        return {
          ...p,
          expectedCtr: expected,
          actualCtr: actual,
          ctrGap,
          missedClicks,
        };
      })
      .filter((p) => p.ctrGap > 0.02 && p.missedClicks > 5)
      .sort((a, b) => b.missedClicks - a.missedClicks)
      .slice(0, limit);

    return gaps;
  }

  /**
   * KEYWORD CANNIBALIZATION — wiele stron z tej samej domeny rankujących na to samo zapytanie
   */
  async getCannibalization(domainId: string) {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    if (!domain.gscProperty) return [];

    const searchconsole = await getSearchConsole();

    // Pull query+page data
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .split("T")[0];

    const res = await searchconsole.searchanalytics.query({
      siteUrl: domain.gscProperty,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query", "page"],
        rowLimit: 5000,
      },
    });

    const rows = res.data.rows || [];

    // Group by query
    const queryPages = new Map<
      string,
      { page: string; clicks: number; impressions: number; position: number }[]
    >();

    for (const row of rows) {
      const query = row.keys![0];
      const page = row.keys![1];

      if (!queryPages.has(query)) queryPages.set(query, []);
      queryPages.get(query)!.push({
        page,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        position: row.position || 0,
      });
    }

    // Filter: queries with 2+ pages
    const cannibalized: {
      query: string;
      pages: {
        page: string;
        clicks: number;
        impressions: number;
        position: number;
      }[];
      totalImpressions: number;
    }[] = [];

    for (const [query, pages] of queryPages) {
      if (pages.length < 2) continue;
      pages.sort((a, b) => a.position - b.position);
      const totalImpressions = pages.reduce((s, p) => s + p.impressions, 0);
      if (totalImpressions < 10) continue;

      cannibalized.push({ query, pages, totalImpressions });
    }

    cannibalized.sort((a, b) => b.totalImpressions - a.totalImpressions);
    return cannibalized.slice(0, 100);
  }

  /**
   * CROSS-DOMAIN LINK MAP — jak Twoje domeny linkują między sobą
   */
  async getCrossDomainLinks() {
    const domains = await prisma.domain.findMany({
      where: { isActive: true },
      select: { id: true, domain: true, label: true },
    });

    const domainSet = new Set(domains.map((d) => d.domain));

    // Find all external links that point to one of our domains
    const links = await prisma.link.findMany({
      where: { isInternal: false },
      include: {
        fromPage: {
          select: {
            url: true,
            path: true,
            domain: { select: { domain: true, label: true } },
          },
        },
      },
    });

    const crossLinks: {
      from: string;
      fromLabel: string | null;
      to: string;
      toLabel: string | null;
      links: { fromPath: string; toUrl: string; anchor: string | null }[];
    }[] = [];

    // Group by from→to domain pair
    const pairMap = new Map<string, (typeof crossLinks)[0]>();

    for (const link of links) {
      try {
        const toHostname = new URL(link.toUrl).hostname;

        // Check if target is one of our domains
        const toDomain = domains.find(
          (d) =>
            toHostname === d.domain ||
            toHostname === d.domain.replace("www.", ""),
        );
        if (!toDomain) continue;

        const fromDomain = link.fromPage.domain;
        if (fromDomain.domain === toDomain.domain) continue; // skip self-links

        const key = `${fromDomain.domain}→${toDomain.domain}`;
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            from: fromDomain.domain,
            fromLabel: fromDomain.label,
            to: toDomain.domain,
            toLabel: toDomain.label,
            links: [],
          });
        }

        pairMap.get(key)!.links.push({
          fromPath: link.fromPage.path,
          toUrl: link.toUrl,
          anchor: link.anchorText,
        });
      } catch {
        // invalid URL
      }
    }

    return Array.from(pairMap.values()).sort(
      (a, b) => b.links.length - a.links.length,
    );
  }

  /**
   * INDEXING VELOCITY — ile dni od firstSubmitted do PASS
   */
  async getIndexingVelocity(domainId?: string) {
    const where: any = {
      indexingVerdict: "PASS",
      firstSubmitted: { not: null },
      lastChecked: { not: null },
    };
    if (domainId) where.domainId = domainId;

    const pages = await prisma.page.findMany({
      where,
      select: {
        path: true,
        firstSubmitted: true,
        lastChecked: true,
        domain: { select: { domain: true, label: true } },
      },
    });

    const velocities = pages
      .map((p) => {
        const submitted = new Date(p.firstSubmitted!).getTime();
        const checked = new Date(p.lastChecked!).getTime();
        const days = Math.max(0, Math.round((checked - submitted) / 86400000));
        return {
          path: p.path,
          domain: p.domain.label || p.domain.domain,
          daysToIndex: days,
        };
      })
      .filter((p) => p.daysToIndex >= 0 && p.daysToIndex < 365);

    // Stats
    const avgDays =
      velocities.length > 0
        ? Math.round(
            velocities.reduce((s, v) => s + v.daysToIndex, 0) /
              velocities.length,
          )
        : 0;

    const medianDays =
      velocities.length > 0
        ? velocities.sort((a, b) => a.daysToIndex - b.daysToIndex)[
            Math.floor(velocities.length / 2)
          ].daysToIndex
        : 0;

    // Distribution
    const distribution = {
      sameDay: velocities.filter((v) => v.daysToIndex === 0).length,
      within3Days: velocities.filter((v) => v.daysToIndex <= 3).length,
      within7Days: velocities.filter((v) => v.daysToIndex <= 7).length,
      within30Days: velocities.filter((v) => v.daysToIndex <= 30).length,
      over30Days: velocities.filter((v) => v.daysToIndex > 30).length,
    };

    // Slowest pages
    const slowest = velocities
      .sort((a, b) => b.daysToIndex - a.daysToIndex)
      .slice(0, 20);

    return {
      avgDays,
      medianDays,
      total: velocities.length,
      distribution,
      slowest,
    };
  }

  /**
   * DOMAIN HEALTH SCORE — jeden wskaźnik zdrowia SEO (0-100)
   */
  async getDomainHealth(domainId: string) {
    const domain = await prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    const [
      pages,
      passCount,
      failCount,
      neutralCount,
      brokenCount,

      unresolvedAlerts,
    ] = await Promise.all([
      prisma.page.count({ where: { domainId, inSitemap: true } }),
      prisma.page.count({
        where: { domainId, inSitemap: true, indexingVerdict: "PASS" },
      }),
      prisma.page.count({
        where: { domainId, inSitemap: true, indexingVerdict: "FAIL" },
      }),
      prisma.page.count({
        where: { domainId, inSitemap: true, indexingVerdict: "NEUTRAL" },
      }),
      prisma.link.count({ where: { isBroken: true, fromPage: { domainId } } }),
      prisma.page.count({
        where: { domainId, inSitemap: true, internalLinksIn: 0 },
      }),
      prisma.alert.count({ where: { domainId, isResolved: false } }),
    ]);

    // Scoring components (each 0-100)
    const indexingScore = pages > 0 ? (passCount / pages) * 100 : 0;
    const noFailScore = pages > 0 ? ((pages - failCount) / pages) * 100 : 100;
    const brokenLinkScore = Math.max(0, 100 - brokenCount * 10);

    const alertScore = Math.max(0, 100 - unresolvedAlerts * 15);

    // Weighted total
    const healthScore = Math.round(
      indexingScore * 0.35 +
        noFailScore * 0.2 +
        brokenLinkScore * 0.15 +
        alertScore * 0.15,
    );

    return {
      healthScore: Math.min(100, Math.max(0, healthScore)),
      components: {
        indexing: {
          score: Math.round(indexingScore),
          detail: `${passCount}/${pages} zaindeksowanych`,
        },
        noFails: {
          score: Math.round(noFailScore),
          detail: `${failCount} stron z FAIL`,
        },
        brokenLinks: {
          score: Math.round(brokenLinkScore),
          detail: `${brokenCount} złamanych linków`,
        },

        alerts: {
          score: Math.round(alertScore),
          detail: `${unresolvedAlerts} nierozwiązanych`,
        },
      },
      recommendations: generateRecommendations({
        indexingScore,
        failCount,
        brokenCount,

        unresolvedAlerts,
        pages,
      }),
    };
  }

  /**
   * POSITION MOVERS — strony które zyskały/straciły pozycje w ostatnim tygodniu
   */
  async getPositionMovers(domainId: string, limit = 30) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

    // Last 7 days avg
    const recentRaw = await prisma.gscPageDaily.groupBy({
      by: ["pageId"],
      where: {
        page: { domainId },
        date: { gte: sevenDaysAgo },
      },
      _avg: { position: true, clicks: true },
      _sum: { clicks: true, impressions: true },
    });

    // Previous 7 days avg
    const previousRaw = await prisma.gscPageDaily.groupBy({
      by: ["pageId"],
      where: {
        page: { domainId },
        date: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
      _avg: { position: true },
      _sum: { clicks: true, impressions: true },
    });

    const previousMap = new Map(previousRaw.map((r) => [r.pageId, r]));

    const movers: {
      pageId: string;
      path: string;
      currentPos: number;
      previousPos: number;
      change: number;
      clicks: number;
      impressions: number;
    }[] = [];

    for (const recent of recentRaw) {
      const prev = previousMap.get(recent.pageId);
      if (!prev || !recent._avg.position || !prev._avg.position) continue;

      const change = prev._avg.position - recent._avg.position; // positive = improved

      movers.push({
        pageId: recent.pageId,
        path: "", // filled below
        currentPos: Math.round(recent._avg.position * 10) / 10,
        previousPos: Math.round(prev._avg.position * 10) / 10,
        change: Math.round(change * 10) / 10,
        clicks: recent._sum.clicks || 0,
        impressions: recent._sum.impressions || 0,
      });
    }

    // Fill paths
    const pageIds = movers.map((m) => m.pageId);
    const pages = await prisma.page.findMany({
      where: { id: { in: pageIds } },
      select: { id: true, path: true },
    });
    const pageMap = new Map(pages.map((p) => [p.id, p.path]));
    movers.forEach((m) => (m.path = pageMap.get(m.pageId) || "?"));

    // Split into winners and losers
    const winners = movers
      .filter((m) => m.change > 0.5)
      .sort((a, b) => b.change - a.change)
      .slice(0, limit);

    const losers = movers
      .filter((m) => m.change < -0.5)
      .sort((a, b) => a.change - b.change)
      .slice(0, limit);

    return { winners, losers };
  }

  /**
   * STALE PAGES — strony które nie były crawlowane przez Google od 30+ dni
   */
  async getStalePages(domainId?: string, daysSinceLastCrawl = 30) {
    const cutoff = new Date(Date.now() - daysSinceLastCrawl * 86400000);

    const where: any = {
      inSitemap: true,
      indexingVerdict: { not: "UNCHECKED" },
      OR: [{ lastCrawlTime: { lt: cutoff } }, { lastCrawlTime: null }],
    };
    if (domainId) where.domainId = domainId;

    const pages = await prisma.page.findMany({
      where,
      orderBy: { impressions: "desc" },
      take: 50,
      include: { domain: { select: { domain: true, label: true } } },
    });

    return pages;
  }
}

function generateRecommendations(data: {
  indexingScore: number;
  failCount: number;
  brokenCount: number;

  unresolvedAlerts: number;
  pages: number;
}): string[] {
  const recs: string[] = [];

  if (data.indexingScore < 50) {
    recs.push(
      `Tylko ${Math.round(data.indexingScore)}% stron zaindeksowanych. Sprawdź czy strony mają prawidłowy robots.txt i brak noindex.`,
    );
  }

  if (data.failCount > 0) {
    recs.push(
      `${data.failCount} stron z verdiktem FAIL — sprawdź coverage state i napraw problemy techniczne.`,
    );
  }

  if (data.brokenCount > 0) {
    recs.push(
      `${data.brokenCount} złamanych linków zewnętrznych — napraw lub usuń linki do nieistniejących stron.`,
    );
  }

  if (data.unresolvedAlerts > 5) {
    recs.push(
      `${data.unresolvedAlerts} nierozwiązanych alertów — przejrzyj i zaadresuj problemy.`,
    );
  }

  if (recs.length === 0) {
    recs.push("Domena w dobrej kondycji SEO. Kontynuuj monitorowanie.");
  }

  return recs;
}
