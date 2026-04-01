// backend/src/services/chat.service.ts

import { prisma } from "../lib/prisma.js";
import { aiCall } from "../lib/ai-client.js";
import type Anthropic from "@anthropic-ai/sdk";

// ═══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS — Claude decides when to call them
// ═══════════════════════════════════════════════════════════════

const TOOLS: Anthropic.Tool[] = [
  // ─── GSC & SEO CORE ───────────────────────────────────────
  {
    name: "get_domain_details",
    description:
      "Szczegółowe dane domeny: top 30 stron z metrykami GSC, statystyki indeksowania, alerty, eventy SEO, metryki Moz (DA/PA/spam), status integracji. Użyj gdy pytanie dotyczy konkretnej domeny — stanu SEO, indeksowania, stron, alertów.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: {
          type: "string",
          description:
            "Nazwa/label domeny np. 'Stojan Shop', 'MaturaPolski', 'Smart-Edu.ai', 'silnik-elektryczny.pl'",
        },
      },
      required: ["domain_label"],
    },
  },
  {
    name: "get_domain_backlinks",
    description:
      "Backlinki domeny: źródła, DA źródeł, anchory, dofollow/nofollow, Moz anchor distribution. Użyj gdy pytanie dotyczy profilu linkowego, backlinków, anchor text, link buildingu.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: { type: "string", description: "Nazwa domeny" },
      },
      required: ["domain_label"],
    },
  },
  {
    name: "get_domain_queries",
    description:
      "Top 50 fraz z GSC: query, clicks, impressions, position, CTR + wykrywanie cannibalization. Użyj gdy pytanie dotyczy fraz, widoczności organicznej, pozycji w Google, CTR.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: { type: "string", description: "Nazwa domeny" },
        min_impressions: {
          type: "number",
          description: "Min. wyświetlenia (default 5)",
        },
      },
      required: ["domain_label"],
    },
  },
  {
    name: "get_cross_domain_links",
    description:
      "Mapa cross-linków między domenami w portfelu: kto linkuje do kogo, ile linków, anchory. Użyj gdy pytanie dotyczy strategii linkowania między domenami, sieci satelitów.",
    input_schema: {
      type: "object" as const,
      properties: {
        group: {
          type: "string",
          description:
            "Opcjonalnie filtruj po grupie: EDU, COPY, MOTORS, PERSONAL",
        },
      },
      required: [],
    },
  },
  {
    name: "get_position_movers",
    description:
      "Strony które zyskały lub straciły pozycje w ostatnim tygodniu (winners/losers). Użyj gdy pytanie dotyczy trendów pozycji, co rośnie/spada, zmian w SERP.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: { type: "string", description: "Nazwa domeny" },
      },
      required: ["domain_label"],
    },
  },
  {
    name: "compare_domains",
    description:
      "Porównaj 2-5 domen side-by-side: DA, kliknięcia, indeksowanie, backlinki, pozycje. Użyj gdy user prosi o porównanie lub ranking domen.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_labels: {
          type: "array",
          items: { type: "string" },
          description: "Lista nazw domen do porównania",
        },
      },
      required: ["domain_labels"],
    },
  },

  // ─── GOOGLE ANALYTICS (GA4) ───────────────────────────────
  {
    name: "get_domain_analytics",
    description:
      "Dane Google Analytics (GA4): sessions, users, pageviews, bounce rate, avg session duration, conversions, revenue — dziennie za okres. Użyj gdy pytanie dotyczy ruchu na stronie (nie-GSC), użytkowników, sesji, konwersji, bounceRate, przychodów, zachowania użytkowników. Wymaga aktywnej integracji GA4.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: { type: "string", description: "Nazwa domeny" },
        days: {
          type: "number",
          description: "Ile dni wstecz (default 30, max 90)",
        },
      },
      required: ["domain_label"],
    },
  },

  // ─── GOOGLE ADS ───────────────────────────────────────────
  {
    name: "get_domain_ads_campaigns",
    description:
      "Kampanie Google Ads: cost, clicks, impressions, conversions, conversionValue, ROAS, CPC, CTR — per kampania per dzień. Użyj gdy pytanie dotyczy reklam, wydatków na Ads, ROAS, efektywności kampanii, kosztów reklamowych.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: { type: "string", description: "Nazwa domeny" },
        days: {
          type: "number",
          description: "Ile dni wstecz (default 30)",
        },
      },
      required: ["domain_label"],
    },
  },
  {
    name: "get_domain_ads_products",
    description:
      "Performance produktów w Google Ads (Shopping/PMax): cost, clicks, conversions, ROAS per produkt. Użyj gdy pytanie dotyczy efektywności konkretnych produktów w reklamach, które produkty są opłacalne.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: { type: "string", description: "Nazwa domeny" },
        days: {
          type: "number",
          description: "Ile dni wstecz (default 30)",
        },
      },
      required: ["domain_label"],
    },
  },
  {
    name: "get_domain_ads_search_terms",
    description:
      "Search terms z Google Ads: jakie zapytania wpisują użytkownicy i ile kosztują, konwersje. Użyj gdy pytanie dotyczy search terms, wyszukiwań w Ads, negatywnych fraz, optymalizacji kampanii search. Przydatne do porównania z organic queries.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: { type: "string", description: "Nazwa domeny" },
        days: {
          type: "number",
          description: "Ile dni wstecz (default 30)",
        },
      },
      required: ["domain_label"],
    },
  },
  {
    name: "get_ads_vs_organic",
    description:
      "Porównanie Ads vs Organic: frazy występujące w obu kanałach, ich koszty Ads vs darmowe kliknięcia z GSC. Użyj gdy pytanie dotyczy kanibalizacji Ads/SEO, optymalizacji budżetu, czy warto reklamować frazy na których już rankujesz organicznie.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: { type: "string", description: "Nazwa domeny" },
        days: {
          type: "number",
          description: "Ile dni wstecz (default 30)",
        },
      },
      required: ["domain_label"],
    },
  },

  // ─── GOOGLE MERCHANT CENTER ───────────────────────────────
  {
    name: "get_merchant_status",
    description:
      "Stan Google Merchant Center: ile produktów approved/disapproved/pending, trendy approval rate. Użyj gdy pytanie dotyczy feedu produktowego, Merchant Center, statusu produktów, disapprovals.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: { type: "string", description: "Nazwa domeny" },
        days: {
          type: "number",
          description: "Ile dni wstecz (default 14)",
        },
      },
      required: ["domain_label"],
    },
  },

  // ─── MOZ DEEP DIVE ────────────────────────────────────────
  {
    name: "get_moz_overview",
    description:
      "Przegląd Moz dla wszystkich domen: DA, PA, spam score, external links, linking domains — ranking i porównanie. Użyj gdy pytanie dotyczy autorytetu domen, porównania DA, spam score, profilu linkowego całego portfela.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },

  // ─── MULTI-DOMAIN ANALYTICS ───────────────────────────────
  {
    name: "get_portfolio_performance",
    description:
      "Pełne dane performance dla wszystkich/wybranych domen: GSC clicks+impressions, GA4 sessions+conversions, Ads cost+ROAS — za okres. Użyj gdy pytanie dotyczy ogólnego stanu portfela, podsumowania wyników, porównania źródeł ruchu, ROI.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Ile dni wstecz (default 30)",
        },
        group: {
          type: "string",
          description: "Opcjonalnie filtruj po grupie: EDU, COPY, MOTORS",
        },
      },
      required: [],
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// TOOL ROUTER
// ═══════════════════════════════════════════════════════════════

async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    // Existing
    case "get_domain_details":
      return getDetailedDomainData(input.domain_label);
    case "get_domain_backlinks":
      return getDomainBacklinksData(input.domain_label);
    case "get_domain_queries":
      return getDomainQueriesData(
        input.domain_label,
        input.min_impressions || 5,
      );
    case "get_cross_domain_links":
      return getCrossDomainLinksData(input.group);
    case "get_position_movers":
      return getPositionMoversData(input.domain_label);
    case "compare_domains":
      return compareDomainsData(input.domain_labels);

    // GA4
    case "get_domain_analytics":
      return getDomainAnalyticsData(input.domain_label, input.days || 30);

    // Google Ads
    case "get_domain_ads_campaigns":
      return getDomainAdsCampaignsData(input.domain_label, input.days || 30);
    case "get_domain_ads_products":
      return getDomainAdsProductsData(input.domain_label, input.days || 30);
    case "get_domain_ads_search_terms":
      return getDomainAdsSearchTermsData(input.domain_label, input.days || 30);
    case "get_ads_vs_organic":
      return getAdsVsOrganicData(input.domain_label, input.days || 30);

    // Merchant
    case "get_merchant_status":
      return getMerchantStatusData(input.domain_label, input.days || 14);

    // Moz
    case "get_moz_overview":
      return getMozOverviewData();

    // Portfolio
    case "get_portfolio_performance":
      return getPortfolioPerformanceData(input.days || 30, input.group);

    default:
      return `Unknown tool: ${name}`;
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function findDomainByLabel(label: string) {
  const domains = await prisma.domain.findMany({ where: { isActive: true } });
  const q = label.toLowerCase();
  return domains.find(
    (d) =>
      d.label?.toLowerCase().includes(q) ||
      d.domain.toLowerCase().includes(q) ||
      d.domain.replace("www.", "").toLowerCase().includes(q),
  );
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

function pct(a: number, b: number): string {
  if (b === 0) return "—";
  return ((a / b) * 100).toFixed(1) + "%";
}

function delta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+∞" : "0";
  const d = ((current - previous) / previous) * 100;
  return (d >= 0 ? "+" : "") + d.toFixed(1) + "%";
}

// ═══════════════════════════════════════════════════════════════
// EXISTING TOOL IMPLEMENTATIONS (kept as-is)
// ═══════════════════════════════════════════════════════════════

async function getDetailedDomainData(label: string): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;
  const domainId = domain.id;
  const sections: string[] = [];

  sections.push(`=== ${domain.label || domain.domain} — SZCZEGÓŁY ===`);
  sections.push(
    `URL: ${domain.siteUrl} | Kategoria: ${domain.category} | Grupa: ${domain.linkGroup} | Rola: ${domain.linkRole}`,
  );
  sections.push(
    `DA: ${domain.mozDA?.toFixed(0) || "-"} | PA: ${domain.mozPA?.toFixed(0) || "-"} | Spam: ${domain.mozSpamScore?.toFixed(0) || "-"} | ExtLinks: ${domain.mozLinks || "-"} | LinkDomains: ${domain.mozDomains || "-"}`,
  );

  // Top pages
  const topPages = await prisma.page.findMany({
    where: { domainId, inSitemap: true },
    orderBy: { clicks: "desc" },
    take: 30,
    select: {
      path: true,
      clicks: true,
      impressions: true,
      position: true,
      indexingVerdict: true,
      title: true,
    },
  });
  sections.push(`\nTop 30 stron (po kliknięciach):`);
  sections.push("Path | Klik | Imp | Poz | Verdict | Title");
  for (const p of topPages) {
    sections.push(
      `${p.path} | ${p.clicks} | ${p.impressions} | ${p.position?.toFixed(1) || "-"} | ${p.indexingVerdict} | ${(p.title || "").slice(0, 60)}`,
    );
  }

  // Indexing breakdown
  const indexing = await prisma.page.groupBy({
    by: ["indexingVerdict"],
    where: { domainId, inSitemap: true },
    _count: { id: true },
  });
  sections.push(`\nIndeksowanie:`);
  for (const s of indexing)
    sections.push(`  ${s.indexingVerdict}: ${s._count.id}`);

  // Active alerts
  const alerts = await prisma.alert.findMany({
    where: { domainId, isResolved: false },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: { type: true, severity: true, title: true },
  });
  if (alerts.length) {
    sections.push(`\nAktywne alerty (${alerts.length}):`);
    for (const a of alerts)
      sections.push(`  [${a.severity}] ${a.type}: ${a.title}`);
  }

  // Recent events
  const events = await prisma.seoEvent.findMany({
    where: { domainId },
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { page: { select: { path: true } } },
  });
  if (events.length) {
    sections.push(`\nOstatnie eventy SEO:`);
    for (const e of events) {
      const date = new Date(e.createdAt).toISOString().split("T")[0];
      const d = e.data as any;
      let detail = e.page?.path || "-";

      if (e.type === "BACKLINK_NEW" && d?.sourceDomain) {
        detail = `${d.sourceDomain}${d.da ? ` DA:${d.da}` : ""} → ${e.page?.path || "/"} | anchor: "${d.anchor || "-"}"`;
      } else if (e.type === "BACKLINK_LOST" && d?.sourceDomain) {
        detail = `LOST: ${d.sourceDomain}${d.da ? ` DA:${d.da}` : ""} → ${e.page?.path || "/"}`;
      } else if (d?.description) {
        detail = d.description;
      }

      sections.push(`  ${date} | ${e.type} | ${detail}`);
    }
  }

  // Quick integration status summary
  const integrations = await prisma.domainIntegration.findMany({
    where: { domainId },
    select: { provider: true, status: true, lastSync: true },
  });
  if (integrations.length) {
    sections.push(`\nIntegracje:`);
    for (const i of integrations) {
      sections.push(
        `  ${i.provider}: ${i.status} | ostatni sync: ${i.lastSync ? new Date(i.lastSync).toISOString().split("T")[0] : "nigdy"}`,
      );
    }
  }

  return sections.join("\n");
}

async function getDomainBacklinksData(label: string): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;
  const sections: string[] = [];

  const backlinks = await prisma.backlinkSnapshot.findMany({
    where: { domainId: domain.id },
    take: 50,
    orderBy: { mozSourceDA: { sort: "desc", nulls: "last" } },
    select: {
      sourceDomain: true,
      sourceUrl: true,
      anchorText: true,
      targetUrl: true,
      isDofollow: true,
      isLive: true,
      mozSourceDA: true,
      mozSourcePA: true,
      mozSourceSpam: true,
      source: true,
      firstSeen: true,
    },
  });

  sections.push(`=== BACKLINKI: ${domain.label || domain.domain} ===`);
  sections.push(
    `Łącznie: ${backlinks.length} | Live: ${backlinks.filter((b) => b.isLive).length} | Dofollow: ${backlinks.filter((b) => b.isDofollow).length}`,
  );

  const byDomain = new Map<string, typeof backlinks>();
  for (const bl of backlinks) {
    if (!byDomain.has(bl.sourceDomain)) byDomain.set(bl.sourceDomain, []);
    byDomain.get(bl.sourceDomain)!.push(bl);
  }

  sections.push(`\nUnique domains: ${byDomain.size}`);
  sections.push("SourceDomain | Linków | DA | Anchory | Typ | Źródło");
  for (const [dom, links] of Array.from(byDomain.entries()).sort(
    (a, b) => (b[1][0]?.mozSourceDA || 0) - (a[1][0]?.mozSourceDA || 0),
  )) {
    const da = links[0]?.mozSourceDA?.toFixed(0) || "-";
    const anchors = [...new Set(links.map((l) => l.anchorText).filter(Boolean))]
      .slice(0, 3)
      .join(", ");
    const doCount = links.filter((l) => l.isDofollow).length;
    const src = links[0]?.source || "crawl";
    sections.push(
      `${dom} | ${links.length} | DA:${da} | "${anchors}" | ${doCount}do/${links.length - doCount}no | ${src}`,
    );
  }

  if (domain.mozAnchors) {
    sections.push(`\nMoz anchor text distribution:`);
    for (const a of (domain.mozAnchors as any[]).slice(0, 15)) {
      sections.push(
        `  "${a.text}" — ${a.externalDomains} domen, ${a.externalPages} stron`,
      );
    }
  }

  return sections.join("\n");
}

async function getDomainQueriesData(
  label: string,
  minImpressions: number,
): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;
  if (!domain.gscProperty)
    return `Domena ${label} nie ma skonfigurowanego GSC property.`;

  const { getSearchConsole } = await import("../lib/google-auth.js");
  const sc = await getSearchConsole();
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .split("T")[0];

  // Query 1: top queries by impressions
  const res = await sc.searchanalytics.query({
    siteUrl: domain.gscProperty,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 500,
    },
  });

  const queries = (res.data.rows || [])
    .map((r: any) => ({
      query: r.keys![0],
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: Math.round((r.position || 0) * 10) / 10,
    }))
    .filter((q) => q.impressions >= minImpressions)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50);

  // Query 2: query+page for cannibalization detection
  const canniRes = await sc.searchanalytics.query({
    siteUrl: domain.gscProperty,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: 5000,
    },
  });

  const queryPages = new Map<string, Set<string>>();
  for (const row of canniRes.data.rows || []) {
    const q = row.keys![0];
    const page = new URL(row.keys![1]).pathname;
    if (!queryPages.has(q)) queryPages.set(q, new Set());
    queryPages.get(q)!.add(page);
  }

  const sections: string[] = [];
  sections.push(
    `=== FRAZY GSC: ${domain.label || domain.domain} (30d, min ${minImpressions} imp) ===`,
  );
  sections.push(`Łącznie: ${queries.length} fraz`);
  sections.push("Query | Klik | Imp | Poz | CTR | Stron");
  for (const q of queries) {
    const pageCount = queryPages.get(q.query)?.size || 1;
    sections.push(
      `"${q.query}" | ${q.clicks} | ${q.impressions} | ${q.position} | ${(q.ctr * 100).toFixed(1)}% | ${pageCount}`,
    );
  }

  const cannibalized = queries.filter(
    (q) => (queryPages.get(q.query)?.size || 0) > 1,
  );
  if (cannibalized.length) {
    sections.push(`\n⚠️ CANNIBALIZATION — frazy z >1 stroną:`);
    for (const q of cannibalized.slice(0, 10)) {
      const pages = Array.from(queryPages.get(q.query) || []).slice(0, 3);
      sections.push(
        `  "${q.query}" — ${pages.length} stron: ${pages.join(", ")}`,
      );
    }
  }

  return sections.join("\n");
}

async function getCrossDomainLinksData(group?: string): Promise<string> {
  const domains = await prisma.domain.findMany({
    where: { isActive: true, ...(group ? { linkGroup: group } : {}) },
    select: {
      id: true,
      domain: true,
      label: true,
      linkGroup: true,
      linkRole: true,
    },
  });

  const links = await prisma.link.findMany({
    where: {
      isInternal: false,
      fromPage: { domainId: { in: domains.map((d) => d.id) } },
    },
    select: {
      toUrl: true,
      anchorText: true,
      fromPage: {
        select: {
          path: true,
          domain: { select: { domain: true, label: true } },
        },
      },
    },
    take: 1000,
  });

  const domainSet = new Set(domains.map((d) => d.domain.replace("www.", "")));
  const crossMap = new Map<
    string,
    {
      from: string;
      to: string;
      links: { fromPath: string; toUrl: string; anchor: string | null }[];
    }
  >();

  for (const l of links) {
    try {
      const toHost = new URL(l.toUrl).hostname.replace("www.", "");
      if (!domainSet.has(toHost)) continue;
      const fromDom = l.fromPage.domain.label || l.fromPage.domain.domain;
      const toDom = domains.find(
        (d) => d.domain.replace("www.", "") === toHost,
      );
      if (!toDom) continue;
      const key = `${fromDom}→${toDom.label || toDom.domain}`;
      if (!crossMap.has(key))
        crossMap.set(key, {
          from: fromDom,
          to: toDom.label || toDom.domain,
          links: [],
        });
      crossMap.get(key)!.links.push({
        fromPath: l.fromPage.path,
        toUrl: l.toUrl,
        anchor: l.anchorText,
      });
    } catch {}
  }

  const sections: string[] = [];
  sections.push(`=== CROSS-LINKI${group ? ` (grupa ${group})` : ""} ===`);
  for (const [, data] of Array.from(crossMap.entries()).sort(
    (a, b) => b[1].links.length - a[1].links.length,
  )) {
    sections.push(`\n${data.from} → ${data.to} (${data.links.length} linków):`);
    for (const l of data.links.slice(0, 5)) {
      sections.push(
        `  ${l.fromPath} → ${l.toUrl.replace(/^https?:\/\/[^/]+/, "")} | anchor: "${l.anchor || "-"}"`,
      );
    }
  }

  return sections.join("\n");
}

async function getPositionMoversData(label: string): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;

  const recent = await prisma.gscPageDaily.groupBy({
    by: ["pageId"],
    where: { page: { domainId: domain.id }, date: { gte: daysAgo(7) } },
    _avg: { position: true },
    _sum: { clicks: true, impressions: true },
  });

  const previous = await prisma.gscPageDaily.groupBy({
    by: ["pageId"],
    where: {
      page: { domainId: domain.id },
      date: { gte: daysAgo(14), lt: daysAgo(7) },
    },
    _avg: { position: true },
    _sum: { clicks: true },
  });

  const prevMap = new Map(previous.map((r) => [r.pageId, r]));
  const pageIds = recent.map((r) => r.pageId);
  const pages = await prisma.page.findMany({
    where: { id: { in: pageIds } },
    select: { id: true, path: true },
  });
  const pathMap = new Map(pages.map((p) => [p.id, p.path]));

  const movers = recent
    .map((r) => {
      const prev = prevMap.get(r.pageId);
      if (!r._avg.position || !prev?._avg.position) return null;
      return {
        path: pathMap.get(r.pageId) || "?",
        currentPos: r._avg.position,
        previousPos: prev._avg.position,
        change: prev._avg.position - r._avg.position,
        clicks: r._sum.clicks || 0,
        impressions: r._sum.impressions || 0,
      };
    })
    .filter(
      (m): m is NonNullable<typeof m> => m !== null && Math.abs(m.change) > 0.5,
    );

  const sections: string[] = [];
  sections.push(
    `=== ZMIANY POZYCJI: ${domain.label || domain.domain} (7d vs 7d) ===`,
  );

  const winners = movers
    .filter((m) => m.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 15);
  const losers = movers
    .filter((m) => m.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 15);

  sections.push(`\n🟢 WINNERS (${winners.length}):`);
  for (const m of winners) {
    sections.push(
      `  ${m.path} | ${m.previousPos.toFixed(1)} → ${m.currentPos.toFixed(1)} (${m.change > 0 ? "+" : ""}${m.change.toFixed(1)}) | ${m.clicks} klik | ${m.impressions} imp`,
    );
  }
  sections.push(`\n🔴 LOSERS (${losers.length}):`);
  for (const m of losers) {
    sections.push(
      `  ${m.path} | ${m.previousPos.toFixed(1)} → ${m.currentPos.toFixed(1)} (${m.change.toFixed(1)}) | ${m.clicks} klik | ${m.impressions} imp`,
    );
  }

  return sections.join("\n");
}

async function compareDomainsData(labels: string[]): Promise<string> {
  const domains = [];
  for (const label of labels) {
    const d = await findDomainByLabel(label);
    if (d) domains.push(d);
  }
  if (!domains.length) return "Nie znaleziono żadnej z podanych domen";

  const sections: string[] = [`=== PORÓWNANIE ${domains.length} DOMEN ===`];
  sections.push(
    "Domena | DA | PA | Spam | Strony | Index% | Klik(30d) | Imp | Poz | ExtLinks | LinkDomains",
  );

  for (const d of domains) {
    const indexPct =
      d.totalPages > 0 ? Math.round((d.indexedPages / d.totalPages) * 100) : 0;
    sections.push(
      `${d.label || d.domain} | DA:${d.mozDA?.toFixed(0) || "-"} | PA:${d.mozPA?.toFixed(0) || "-"} | Spam:${d.mozSpamScore?.toFixed(0) || "-"} | ${d.totalPages} | ${indexPct}% | ${d.totalClicks} | ${d.totalImpressions} | ${d.avgPosition?.toFixed(1) || "-"} | ${d.mozLinks || "-"} | ${d.mozDomains || "-"}`,
    );
  }

  return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// NEW: GOOGLE ANALYTICS (GA4)
// ═══════════════════════════════════════════════════════════════

async function getDomainAnalyticsData(
  label: string,
  days: number,
): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;

  const integration = await prisma.domainIntegration.findFirst({
    where: { domainId: domain.id, provider: "GOOGLE_ANALYTICS" },
  });

  if (!integration)
    return `Domena ${domain.label || domain.domain} nie ma skonfigurowanej integracji GA4.`;
  if (integration.status !== "ACTIVE")
    return `Integracja GA4 dla ${domain.label || domain.domain} ma status: ${integration.status}. Ostatni sync: ${integration.lastSync ? new Date(integration.lastSync).toISOString().split("T")[0] : "nigdy"}.`;

  const since = daysAgo(days);
  const daily = await prisma.integrationDaily.findMany({
    where: { integrationId: integration.id, date: { gte: since } },
    orderBy: { date: "desc" },
  });

  if (!daily.length)
    return `Brak danych GA4 za ostatnie ${days} dni dla ${domain.label || domain.domain}.`;

  const sections: string[] = [];
  sections.push(`=== GA4: ${domain.label || domain.domain} (${days}d) ===`);
  sections.push(
    `Property ID: ${integration.propertyId} | Status: ${integration.status} | Ostatni sync: ${integration.lastSync ? new Date(integration.lastSync).toISOString().split("T")[0] : "-"}`,
  );

  // Aggregated totals
  const totals = {
    sessions: 0,
    users: 0,
    newUsers: 0,
    pageviews: 0,
    conversions: 0,
    revenue: 0,
    daysWithData: 0,
    bounceRates: [] as number[],
    sessionDurations: [] as number[],
  };
  for (const d of daily) {
    totals.sessions += d.sessions || 0;
    totals.users += d.users || 0;
    totals.newUsers += d.newUsers || 0;
    totals.pageviews += d.pageviews || 0;
    totals.conversions += d.conversions || 0;
    totals.revenue += d.revenue || 0;
    if (d.bounceRate != null) totals.bounceRates.push(d.bounceRate);
    if (d.avgSessionDuration != null)
      totals.sessionDurations.push(d.avgSessionDuration);
    totals.daysWithData++;
  }
  const avgBounce = totals.bounceRates.length
    ? (
        totals.bounceRates.reduce((a, b) => a + b, 0) /
        totals.bounceRates.length
      ).toFixed(1)
    : "-";
  const avgDuration = totals.sessionDurations.length
    ? (
        totals.sessionDurations.reduce((a, b) => a + b, 0) /
        totals.sessionDurations.length
      ).toFixed(0)
    : "-";

  sections.push(`\nPODSUMOWANIE (${totals.daysWithData} dni z danymi):`);
  sections.push(
    `  Sessions: ${totals.sessions} | Users: ${totals.users} | New users: ${totals.newUsers}`,
  );
  sections.push(
    `  Pageviews: ${totals.pageviews} | Avg bounce rate: ${avgBounce}% | Avg session: ${avgDuration}s`,
  );
  sections.push(
    `  Conversions: ${totals.conversions} | Revenue: ${totals.revenue.toFixed(2)} PLN`,
  );

  // Compare current half vs previous half
  const midpoint = Math.floor(daily.length / 2);
  if (midpoint > 0) {
    const recentHalf = daily.slice(0, midpoint);
    const olderHalf = daily.slice(midpoint);
    const rSessions = recentHalf.reduce((s, d) => s + (d.sessions || 0), 0);
    const oSessions = olderHalf.reduce((s, d) => s + (d.sessions || 0), 0);
    const rConv = recentHalf.reduce((s, d) => s + (d.conversions || 0), 0);
    const oConv = olderHalf.reduce((s, d) => s + (d.conversions || 0), 0);
    const rRev = recentHalf.reduce((s, d) => s + (d.revenue || 0), 0);
    const oRev = olderHalf.reduce((s, d) => s + (d.revenue || 0), 0);
    sections.push(
      `\nTREND (nowsze ${midpoint}d vs starsze ${daily.length - midpoint}d):`,
    );
    sections.push(
      `  Sessions: ${rSessions} vs ${oSessions} (${delta(rSessions, oSessions)})`,
    );
    sections.push(
      `  Conversions: ${rConv} vs ${oConv} (${delta(rConv, oConv)})`,
    );
    sections.push(
      `  Revenue: ${rRev.toFixed(0)} vs ${oRev.toFixed(0)} (${delta(rRev, oRev)})`,
    );
  }

  // Daily breakdown (last 14 days max)
  sections.push(`\nDZIENNIE (ostatnie ${Math.min(daily.length, 14)} dni):`);
  sections.push(
    "Data | Sessions | Users | Pageviews | Bounce% | Conversions | Revenue",
  );
  for (const d of daily.slice(0, 14)) {
    const date = new Date(d.date).toISOString().split("T")[0];
    sections.push(
      `${date} | ${d.sessions || 0} | ${d.users || 0} | ${d.pageviews || 0} | ${d.bounceRate?.toFixed(1) || "-"}% | ${d.conversions || 0} | ${d.revenue?.toFixed(0) || "0"} PLN`,
    );
  }

  // Source breakdown from cached integration data
  if (integration.cachedData) {
    const cached = integration.cachedData as any;
    if (cached.bySource?.length) {
      sections.push(`\nŹRÓDŁA RUCHU (ostatni sync):`);
      for (const src of cached.bySource.slice(0, 10)) {
        sections.push(
          `  ${src.sourceMedium || "?"}: ${src.sessions} sesji, ${src.conversions} konw., ${src.revenue?.toFixed(0) || "0"} PLN`,
        );
      }
    }
    if (cached.landingPages?.length) {
      sections.push(`\nTOP LANDING PAGES (ostatni sync):`);
      for (const lp of cached.landingPages.slice(0, 10)) {
        sections.push(
          `  ${lp.path}: ${lp.sessions} sesji, ${lp.conversions} konw., bounce ${lp.bounceRate?.toFixed(1)}%`,
        );
      }
    }
  }

  return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// NEW: GOOGLE ADS — CAMPAIGNS
// ═══════════════════════════════════════════════════════════════

async function getDomainAdsCampaignsData(
  label: string,
  days: number,
): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;

  const since = daysAgo(days);
  const campaigns = await prisma.adsCampaignDaily.findMany({
    where: { domainId: domain.id, date: { gte: since } },
    orderBy: { date: "desc" },
  });

  if (!campaigns.length)
    return `Brak danych Google Ads (kampanie) za ostatnie ${days} dni dla ${domain.label || domain.domain}.`;

  // Aggregate per campaign
  const byCampaign = new Map<
    string,
    {
      name: string;
      type: string;
      cost: number;
      clicks: number;
      impressions: number;
      conversions: number;
      conversionValue: number;
      days: number;
    }
  >();

  for (const c of campaigns) {
    const existing = byCampaign.get(c.campaignId) || {
      name: c.campaignName,
      type: c.campaignType,
      cost: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      conversionValue: 0,
      days: 0,
    };
    existing.cost += c.cost;
    existing.clicks += c.clicks;
    existing.impressions += c.impressions;
    existing.conversions += c.conversions;
    existing.conversionValue += c.conversionValue;
    existing.days++;
    byCampaign.set(c.campaignId, existing);
  }

  const sections: string[] = [];
  sections.push(
    `=== GOOGLE ADS KAMPANIE: ${domain.label || domain.domain} (${days}d) ===`,
  );

  // Grand totals
  const grandCost = campaigns.reduce((s, c) => s + c.cost, 0);
  const grandClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const grandImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const grandConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const grandValue = campaigns.reduce((s, c) => s + c.conversionValue, 0);
  const grandRoas = grandCost > 0 ? grandValue / grandCost : 0;
  const grandCpc = grandClicks > 0 ? grandCost / grandClicks : 0;

  sections.push(`\nŁĄCZNIE:`);
  sections.push(
    `  Koszt: ${grandCost.toFixed(2)} PLN | Kliknięcia: ${grandClicks} | Wyśw: ${grandImpressions}`,
  );
  sections.push(
    `  Konwersje: ${grandConversions.toFixed(1)} | Wartość: ${grandValue.toFixed(2)} PLN | ROAS: ${grandRoas.toFixed(2)}x | CPC: ${grandCpc.toFixed(2)} PLN`,
  );
  sections.push(`  CTR: ${pct(grandClicks, grandImpressions)}`);

  // Per campaign breakdown
  sections.push(`\nPER KAMPANIA (${byCampaign.size}):`);
  sections.push("Kampania | Typ | Koszt | Klik | Konw | Wartość | ROAS | CPC");
  const sorted = Array.from(byCampaign.values()).sort(
    (a, b) => b.cost - a.cost,
  );
  for (const c of sorted) {
    const roas = c.cost > 0 ? (c.conversionValue / c.cost).toFixed(2) : "-";
    const cpc = c.clicks > 0 ? (c.cost / c.clicks).toFixed(2) : "-";
    sections.push(
      `${c.name} | ${c.type} | ${c.cost.toFixed(0)} PLN | ${c.clicks} | ${c.conversions.toFixed(1)} | ${c.conversionValue.toFixed(0)} PLN | ${roas}x | ${cpc} PLN`,
    );
  }

  // Daily trend (last 7 days aggregated)
  const dailyAgg = new Map<
    string,
    { cost: number; clicks: number; conversions: number; value: number }
  >();
  for (const c of campaigns) {
    const date = new Date(c.date).toISOString().split("T")[0];
    const existing = dailyAgg.get(date) || {
      cost: 0,
      clicks: 0,
      conversions: 0,
      value: 0,
    };
    existing.cost += c.cost;
    existing.clicks += c.clicks;
    existing.conversions += c.conversions;
    existing.value += c.conversionValue;
    dailyAgg.set(date, existing);
  }
  const dailySorted = Array.from(dailyAgg.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14);

  sections.push(`\nDZIENNIE (sumarycznie wszystkie kampanie):`);
  sections.push("Data | Koszt | Klik | Konw | Wartość | ROAS");
  for (const [date, d] of dailySorted) {
    const r = d.cost > 0 ? (d.value / d.cost).toFixed(2) : "-";
    sections.push(
      `${date} | ${d.cost.toFixed(0)} PLN | ${d.clicks} | ${d.conversions.toFixed(1)} | ${d.value.toFixed(0)} PLN | ${r}x`,
    );
  }

  return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// NEW: GOOGLE ADS — PRODUCTS
// ═══════════════════════════════════════════════════════════════

async function getDomainAdsProductsData(
  label: string,
  days: number,
): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;

  const since = daysAgo(days);
  const products = await prisma.adsProductDaily.findMany({
    where: { domainId: domain.id, date: { gte: since } },
    orderBy: { date: "desc" },
  });

  if (!products.length)
    return `Brak danych Google Ads (produkty) za ostatnie ${days} dni dla ${domain.label || domain.domain}.`;

  // Aggregate per product
  const byProduct = new Map<
    string,
    {
      title: string;
      category: string | null;
      cost: number;
      clicks: number;
      impressions: number;
      conversions: number;
      conversionValue: number;
    }
  >();

  for (const p of products) {
    const existing = byProduct.get(p.productId) || {
      title: p.productTitle,
      category: p.productCategory,
      cost: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      conversionValue: 0,
    };
    existing.cost += p.cost;
    existing.clicks += p.clicks;
    existing.impressions += p.impressions;
    existing.conversions += p.conversions;
    existing.conversionValue += p.conversionValue;
    byProduct.set(p.productId, existing);
  }

  const sections: string[] = [];
  sections.push(
    `=== ADS PRODUKTY: ${domain.label || domain.domain} (${days}d) ===`,
  );
  sections.push(`Produktów z danymi: ${byProduct.size}`);

  sections.push(`\nTOP PRODUKTY (po koszcie):`);
  sections.push("Produkt | Kategoria | Koszt | Klik | Konw | Wartość | ROAS");
  const sorted = Array.from(byProduct.values()).sort((a, b) => b.cost - a.cost);
  for (const p of sorted.slice(0, 30)) {
    const roas = p.cost > 0 ? (p.conversionValue / p.cost).toFixed(2) : "-";
    sections.push(
      `${p.title.slice(0, 50)} | ${p.category || "-"} | ${p.cost.toFixed(0)} PLN | ${p.clicks} | ${p.conversions.toFixed(1)} | ${p.conversionValue.toFixed(0)} PLN | ${roas}x`,
    );
  }

  // Profitable vs unprofitable
  const profitable = sorted.filter(
    (p) => p.cost > 0 && p.conversionValue / p.cost >= 1,
  );
  const unprofitable = sorted.filter(
    (p) =>
      p.cost > 5 &&
      (p.conversionValue === 0 || p.conversionValue / p.cost < 0.5),
  );

  sections.push(`\n🟢 OPŁACALNE (ROAS ≥ 1): ${profitable.length} produktów`);
  sections.push(
    `🔴 NIEODŁACALNE (ROAS < 0.5, koszt > 5 PLN): ${unprofitable.length} produktów`,
  );
  if (unprofitable.length > 0) {
    sections.push("Najgorsze:");
    for (const p of unprofitable.slice(0, 10)) {
      const roas = p.cost > 0 ? (p.conversionValue / p.cost).toFixed(2) : "0";
      sections.push(
        `  ${p.title.slice(0, 50)} | koszt: ${p.cost.toFixed(0)} PLN | ROAS: ${roas}x`,
      );
    }
  }

  return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// NEW: GOOGLE ADS — SEARCH TERMS
// ═══════════════════════════════════════════════════════════════

async function getDomainAdsSearchTermsData(
  label: string,
  days: number,
): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;

  const since = daysAgo(days);
  const terms = await prisma.adsSearchTerm.findMany({
    where: { domainId: domain.id, date: { gte: since } },
    orderBy: { date: "desc" },
  });

  if (!terms.length)
    return `Brak danych search terms za ostatnie ${days} dni dla ${domain.label || domain.domain}.`;

  // Aggregate per search term
  const byTerm = new Map<
    string,
    {
      campaign: string;
      cost: number;
      clicks: number;
      impressions: number;
      conversions: number;
      conversionValue: number;
    }
  >();

  for (const t of terms) {
    const existing = byTerm.get(t.searchTerm) || {
      campaign: t.campaignName,
      cost: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      conversionValue: 0,
    };
    existing.cost += t.cost;
    existing.clicks += t.clicks;
    existing.impressions += t.impressions;
    existing.conversions += t.conversions;
    existing.conversionValue += t.conversionValue;
    byTerm.set(t.searchTerm, existing);
  }

  const sections: string[] = [];
  sections.push(
    `=== ADS SEARCH TERMS: ${domain.label || domain.domain} (${days}d) ===`,
  );
  sections.push(`Unikalnych fraz: ${byTerm.size}`);

  // Sort by cost
  const sortedByCost = Array.from(byTerm.entries()).sort(
    (a, b) => b[1].cost - a[1].cost,
  );

  sections.push(
    `\nTOP FRAZY (po koszcie, ${Math.min(sortedByCost.length, 40)}):`,
  );
  sections.push("Fraza | Kampania | Koszt | Klik | Imp | Konw | Wartość");
  for (const [term, d] of sortedByCost.slice(0, 40)) {
    sections.push(
      `"${term}" | ${d.campaign.slice(0, 25)} | ${d.cost.toFixed(1)} PLN | ${d.clicks} | ${d.impressions} | ${d.conversions.toFixed(1)} | ${d.conversionValue.toFixed(0)} PLN`,
    );
  }

  // Wasted spend (cost but no conversions)
  const wasted = sortedByCost.filter(
    ([, d]) => d.cost > 2 && d.conversions === 0,
  );
  if (wasted.length) {
    const wastedTotal = wasted.reduce((s, [, d]) => s + d.cost, 0);
    sections.push(
      `\n⚠️ ZMARNOWANY BUDŻET (koszt > 2 PLN, 0 konwersji): ${wasted.length} fraz, łącznie ${wastedTotal.toFixed(0)} PLN`,
    );
    for (const [term, d] of wasted.slice(0, 15)) {
      sections.push(`  "${term}" — ${d.cost.toFixed(1)} PLN, ${d.clicks} klik`);
    }
  }

  // Top converters
  const converters = sortedByCost
    .filter(([, d]) => d.conversions > 0)
    .sort((a, b) => b[1].conversions - a[1].conversions);
  if (converters.length) {
    sections.push(`\n🟢 TOP KONWERTUJĄCE FRAZY:`);
    for (const [term, d] of converters.slice(0, 15)) {
      const cpa = d.conversions > 0 ? (d.cost / d.conversions).toFixed(1) : "-";
      sections.push(
        `  "${term}" — ${d.conversions.toFixed(1)} konw. | koszt: ${d.cost.toFixed(0)} PLN | CPA: ${cpa} PLN`,
      );
    }
  }

  return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// NEW: ADS vs ORGANIC
// ═══════════════════════════════════════════════════════════════

async function getAdsVsOrganicData(
  label: string,
  days: number,
): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;

  const since = daysAgo(days);

  // Get Ads search terms
  const adsTerms = await prisma.adsSearchTerm.findMany({
    where: { domainId: domain.id, date: { gte: since } },
  });

  const adsMap = new Map<
    string,
    {
      cost: number;
      clicks: number;
      impressions: number;
      conversions: number;
      value: number;
    }
  >();
  for (const t of adsTerms) {
    const existing = adsMap.get(t.searchTerm.toLowerCase()) || {
      cost: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      value: 0,
    };
    existing.cost += t.cost;
    existing.clicks += t.clicks;
    existing.impressions += t.impressions;
    existing.conversions += t.conversions;
    existing.value += t.conversionValue;
    adsMap.set(t.searchTerm.toLowerCase(), existing);
  }

  // Get organic queries from GscPageDaily
  const gscDaily = await prisma.gscPageDaily.findMany({
    where: { page: { domainId: domain.id }, date: { gte: since } },
    select: { topQueries: true },
  });

  const organicMap = new Map<
    string,
    { clicks: number; impressions: number; positions: number[] }
  >();
  for (const d of gscDaily) {
    if (!d.topQueries) continue;
    for (const q of d.topQueries as any[]) {
      if (!q.query) continue;
      const key = q.query.toLowerCase();
      const existing = organicMap.get(key) || {
        clicks: 0,
        impressions: 0,
        positions: [],
      };
      existing.clicks += q.clicks || 0;
      existing.impressions += q.impressions || 0;
      if (q.position) existing.positions.push(q.position);
      organicMap.set(key, existing);
    }
  }

  // Find overlapping queries
  const overlapping: {
    query: string;
    adsCost: number;
    adsClicks: number;
    adsConversions: number;
    organicClicks: number;
    organicImpressions: number;
    organicPosition: number;
  }[] = [];

  for (const [query, ads] of adsMap) {
    const organic = organicMap.get(query);
    if (organic && organic.impressions > 0) {
      const avgPos = organic.positions.length
        ? organic.positions.reduce((a, b) => a + b, 0) /
          organic.positions.length
        : 0;
      overlapping.push({
        query,
        adsCost: ads.cost,
        adsClicks: ads.clicks,
        adsConversions: ads.conversions,
        organicClicks: organic.clicks,
        organicImpressions: organic.impressions,
        organicPosition: avgPos,
      });
    }
  }

  const sections: string[] = [];
  sections.push(
    `=== ADS vs ORGANIC: ${domain.label || domain.domain} (${days}d) ===`,
  );
  sections.push(
    `Fraz w Ads: ${adsMap.size} | Fraz organic: ${organicMap.size} | Overlapping: ${overlapping.length}`,
  );

  const totalAdsCost = Array.from(adsMap.values()).reduce(
    (s, d) => s + d.cost,
    0,
  );
  const overlapCost = overlapping.reduce((s, o) => s + o.adsCost, 0);
  sections.push(
    `Łączny koszt Ads: ${totalAdsCost.toFixed(0)} PLN | Koszt na overlapping frazy: ${overlapCost.toFixed(0)} PLN (${pct(overlapCost, totalAdsCost)})`,
  );

  // Sort overlapping by Ads cost
  overlapping.sort((a, b) => b.adsCost - a.adsCost);

  sections.push(
    `\n🔄 OVERLAPPING FRAZY (Ads + Organic, top ${Math.min(overlapping.length, 30)}):`,
  );
  sections.push(
    "Fraza | Ads koszt | Ads klik | Organic klik | Organic poz | Ads konw",
  );
  for (const o of overlapping.slice(0, 30)) {
    sections.push(
      `"${o.query}" | ${o.adsCost.toFixed(1)} PLN | ${o.adsClicks} | ${o.organicClicks} | ${o.organicPosition.toFixed(1)} | ${o.adsConversions.toFixed(1)}`,
    );
  }

  // Recommendations
  const canSaveAds = overlapping.filter(
    (o) => o.organicPosition <= 5 && o.adsConversions === 0 && o.adsCost > 3,
  );
  if (canSaveAds.length) {
    const saveable = canSaveAds.reduce((s, o) => s + o.adsCost, 0);
    sections.push(
      `\n💰 POTENCJALNE OSZCZĘDNOŚCI — frazy z poz ≤ 5 organicznie, 0 konwersji w Ads:`,
    );
    sections.push(`Łącznie do zaoszczędzenia: ~${saveable.toFixed(0)} PLN`);
    for (const o of canSaveAds.slice(0, 10)) {
      sections.push(
        `  "${o.query}" — organic poz ${o.organicPosition.toFixed(1)}, Ads koszt: ${o.adsCost.toFixed(1)} PLN`,
      );
    }
  }

  // Only in Ads (no organic visibility)
  const adsOnly = Array.from(adsMap.entries())
    .filter(([q]) => !organicMap.has(q))
    .sort((a, b) => b[1].clicks - a[1].clicks);
  if (adsOnly.length) {
    sections.push(
      `\n📢 TYLKO W ADS (brak widoczności organic) — top ${Math.min(adsOnly.length, 15)}:`,
    );
    for (const [q, d] of adsOnly.slice(0, 15)) {
      sections.push(
        `  "${q}" — ${d.clicks} klik, ${d.cost.toFixed(0)} PLN, ${d.conversions.toFixed(1)} konw`,
      );
    }
  }

  return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// NEW: MERCHANT CENTER
// ═══════════════════════════════════════════════════════════════

async function getMerchantStatusData(
  label: string,
  days: number,
): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;

  const integration = await prisma.domainIntegration.findFirst({
    where: { domainId: domain.id, provider: "GOOGLE_MERCHANT" },
  });

  if (!integration)
    return `Domena ${domain.label || domain.domain} nie ma skonfigurowanej integracji Merchant Center.`;

  const since = daysAgo(days);
  const daily = await prisma.integrationDaily.findMany({
    where: { integrationId: integration.id, date: { gte: since } },
    orderBy: { date: "desc" },
  });

  const sections: string[] = [];
  sections.push(
    `=== MERCHANT CENTER: ${domain.label || domain.domain} (${days}d) ===`,
  );
  sections.push(
    `Merchant ID: ${integration.merchantId} | Status: ${integration.status}`,
  );

  if (!daily.length) {
    sections.push(`Brak danych dziennych za ostatnie ${days} dni.`);

    // Try cached data
    if (integration.cachedData) {
      const cached = integration.cachedData as any;
      sections.push(`\nOstatni snapshot (cached):`);
      sections.push(
        `  Produkty: ${cached.productCount || "-"} | Approved: ${cached.approvedProducts || "-"} | Disapproved: ${cached.disapprovedProducts || "-"} | Pending: ${cached.pendingProducts || "-"}`,
      );
    }
    return sections.join("\n");
  }

  // Latest day
  const latest = daily[0];
  sections.push(
    `\nNAJNOWSZE DANE (${new Date(latest.date).toISOString().split("T")[0]}):`,
  );
  sections.push(`  Produkty ogółem: ${latest.productCount || 0}`);
  sections.push(
    `  Approved: ${latest.approvedProducts || 0} (${pct(latest.approvedProducts || 0, latest.productCount || 1)})`,
  );
  sections.push(
    `  Disapproved: ${latest.disapprovedProducts || 0} (${pct(latest.disapprovedProducts || 0, latest.productCount || 1)})`,
  );
  sections.push(`  Pending: ${latest.pendingProducts || 0}`);

  // Trend
  if (daily.length > 1) {
    const oldest = daily[daily.length - 1];
    sections.push(
      `\nTREND (${new Date(oldest.date).toISOString().split("T")[0]} → ${new Date(latest.date).toISOString().split("T")[0]}):`,
    );
    sections.push(
      `  Produkty: ${oldest.productCount || 0} → ${latest.productCount || 0}`,
    );
    sections.push(
      `  Approved: ${oldest.approvedProducts || 0} → ${latest.approvedProducts || 0}`,
    );
    sections.push(
      `  Disapproved: ${oldest.disapprovedProducts || 0} → ${latest.disapprovedProducts || 0}`,
    );

    const oldApprRate =
      (oldest.productCount || 0) > 0
        ? ((oldest.approvedProducts || 0) / (oldest.productCount || 1)) * 100
        : 0;
    const newApprRate =
      (latest.productCount || 0) > 0
        ? ((latest.approvedProducts || 0) / (latest.productCount || 1)) * 100
        : 0;
    const rateChange = newApprRate - oldApprRate;
    sections.push(
      `  Approval rate: ${oldApprRate.toFixed(1)}% → ${newApprRate.toFixed(1)}% (${rateChange >= 0 ? "+" : ""}${rateChange.toFixed(1)}pp)`,
    );
  }

  // Daily breakdown
  sections.push(`\nDZIENNIE:`);
  sections.push("Data | Produkty | Approved | Disapproved | Pending | Appr%");
  for (const d of daily.slice(0, 14)) {
    const date = new Date(d.date).toISOString().split("T")[0];
    const apprRate =
      (d.productCount || 0) > 0
        ? pct(d.approvedProducts || 0, d.productCount || 1)
        : "-";
    sections.push(
      `${date} | ${d.productCount || 0} | ${d.approvedProducts || 0} | ${d.disapprovedProducts || 0} | ${d.pendingProducts || 0} | ${apprRate}`,
    );
  }

  return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// NEW: MOZ OVERVIEW (all domains)
// ═══════════════════════════════════════════════════════════════

async function getMozOverviewData(): Promise<string> {
  const domains = await prisma.domain.findMany({
    where: { isActive: true },
    select: {
      domain: true,
      label: true,
      linkGroup: true,
      linkRole: true,
      mozDA: true,
      mozPA: true,
      mozSpamScore: true,
      mozLinks: true,
      mozDomains: true,
      mozAnchors: true,
      mozLastSync: true,
    },
    orderBy: { mozDA: { sort: "desc", nulls: "last" } },
  });

  const sections: string[] = [];
  sections.push(`=== MOZ OVERVIEW — WSZYSTKIE DOMENY ===`);
  sections.push(
    "Domena | Grupa | Rola | DA | PA | Spam | ExtLinks | LinkDomains | Ostatni sync",
  );

  for (const d of domains) {
    sections.push(
      `${d.label || d.domain} | ${d.linkGroup || "-"} | ${d.linkRole || "-"} | DA:${d.mozDA?.toFixed(0) || "-"} | PA:${d.mozPA?.toFixed(0) || "-"} | Spam:${d.mozSpamScore?.toFixed(0) || "-"} | ${d.mozLinks || "-"} | ${d.mozDomains || "-"} | ${d.mozLastSync ? new Date(d.mozLastSync).toISOString().split("T")[0] : "nigdy"}`,
    );
  }

  // Stats
  const withDA = domains.filter((d) => d.mozDA != null);
  if (withDA.length) {
    const avgDA =
      withDA.reduce((s, d) => s + (d.mozDA || 0), 0) / withDA.length;
    const maxDA = Math.max(...withDA.map((d) => d.mozDA || 0));
    const minDA = Math.min(...withDA.map((d) => d.mozDA || 0));
    const highSpam = domains.filter((d) => (d.mozSpamScore || 0) > 30);
    sections.push(`\nSTATYSTYKI:`);
    sections.push(
      `  Avg DA: ${avgDA.toFixed(1)} | Max DA: ${maxDA.toFixed(0)} | Min DA: ${minDA.toFixed(0)}`,
    );
    sections.push(
      `  Domeny z Spam > 30: ${highSpam.length} → ${highSpam.map((d) => d.label || d.domain).join(", ") || "brak"}`,
    );
  }

  // Top anchors per domain with data
  const withAnchors = domains.filter(
    (d) => d.mozAnchors && (d.mozAnchors as any[]).length > 0,
  );
  if (withAnchors.length) {
    sections.push(`\nTOP ANCHORY (per domena, top 3):`);
    for (const d of withAnchors.slice(0, 10)) {
      const anchors = (d.mozAnchors as any[])
        .slice(0, 3)
        .map((a) => `"${a.text}" (${a.externalDomains}dom)`)
        .join(", ");
      sections.push(`  ${d.label || d.domain}: ${anchors}`);
    }
  }

  return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// NEW: PORTFOLIO PERFORMANCE (multi-source aggregation)
// ═══════════════════════════════════════════════════════════════

async function getPortfolioPerformanceData(
  days: number,
  group?: string,
): Promise<string> {
  const domains = await prisma.domain.findMany({
    where: { isActive: true, ...(group ? { linkGroup: group } : {}) },
    select: {
      id: true,
      domain: true,
      label: true,
      category: true,
      linkGroup: true,
      linkRole: true,
      totalClicks: true,
      totalImpressions: true,
      avgPosition: true,
      mozDA: true,
    },
    orderBy: { totalClicks: "desc" },
  });

  const since = daysAgo(days);
  const sections: string[] = [];
  sections.push(
    `=== PORTFOLIO PERFORMANCE (${days}d)${group ? ` — grupa ${group}` : ""} ===`,
  );
  sections.push(
    "Domena | GSC klik | GSC imp | GA4 sesje | GA4 konw | GA4 rev | Ads koszt | Ads ROAS | DA",
  );

  for (const d of domains) {
    // GA4 data
    const gaIntegration = await prisma.domainIntegration.findFirst({
      where: { domainId: d.id, provider: "GOOGLE_ANALYTICS", status: "ACTIVE" },
    });
    let gaSessions = 0,
      gaConversions = 0,
      gaRevenue = 0;
    if (gaIntegration) {
      const gaDaily = await prisma.integrationDaily.findMany({
        where: { integrationId: gaIntegration.id, date: { gte: since } },
      });
      gaSessions = gaDaily.reduce((s, r) => s + (r.sessions || 0), 0);
      gaConversions = gaDaily.reduce((s, r) => s + (r.conversions || 0), 0);
      gaRevenue = gaDaily.reduce((s, r) => s + (r.revenue || 0), 0);
    }

    // Ads data
    const adsCampaigns = await prisma.adsCampaignDaily.findMany({
      where: { domainId: d.id, date: { gte: since } },
    });
    const adsCost = adsCampaigns.reduce((s, c) => s + c.cost, 0);
    const adsValue = adsCampaigns.reduce((s, c) => s + c.conversionValue, 0);
    const adsRoas = adsCost > 0 ? (adsValue / adsCost).toFixed(2) + "x" : "-";

    // GSC data
    const gscDaily = await prisma.gscDomainDaily.findMany({
      where: { domainId: d.id, date: { gte: since } },
    });
    const gscClicks = gscDaily.reduce((s, r) => s + r.clicks, 0);
    const gscImpressions = gscDaily.reduce((s, r) => s + r.impressions, 0);

    sections.push(
      `${d.label || d.domain} | ${gscClicks} | ${gscImpressions} | ${gaSessions || "-"} | ${gaConversions || "-"} | ${gaRevenue ? gaRevenue.toFixed(0) + " PLN" : "-"} | ${adsCost ? adsCost.toFixed(0) + " PLN" : "-"} | ${adsRoas} | ${d.mozDA?.toFixed(0) || "-"}`,
    );
  }

  // Grand totals
  const allGscDaily = await prisma.gscDomainDaily.findMany({
    where: {
      domainId: { in: domains.map((d) => d.id) },
      date: { gte: since },
    },
  });
  const allAdsCampaigns = await prisma.adsCampaignDaily.findMany({
    where: {
      domainId: { in: domains.map((d) => d.id) },
      date: { gte: since },
    },
  });

  const grandGscClicks = allGscDaily.reduce((s, r) => s + r.clicks, 0);
  const grandGscImpr = allGscDaily.reduce((s, r) => s + r.impressions, 0);
  const grandAdsCost = allAdsCampaigns.reduce((s, c) => s + c.cost, 0);
  const grandAdsValue = allAdsCampaigns.reduce(
    (s, c) => s + c.conversionValue,
    0,
  );
  const grandAdsRoas =
    grandAdsCost > 0 ? (grandAdsValue / grandAdsCost).toFixed(2) : "-";

  sections.push(`\nŁĄCZNIE (${domains.length} domen):`);
  sections.push(
    `  GSC: ${grandGscClicks} kliknięć, ${grandGscImpr} wyświetleń`,
  );
  sections.push(
    `  Ads: ${grandAdsCost.toFixed(0)} PLN kosztu, ${grandAdsValue.toFixed(0)} PLN wartości, ROAS: ${grandAdsRoas}x`,
  );

  return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// MAIN SERVICE
// ═══════════════════════════════════════════════════════════════

export class ChatService {
  async buildOverview(): Promise<string> {
    const allDomains = await prisma.domain.findMany({
      where: { isActive: true },
      select: {
        id: true,
        domain: true,
        label: true,
        category: true,
        totalPages: true,
        indexedPages: true,
        totalClicks: true,
        totalImpressions: true,
        avgPosition: true,
        mozDA: true,
        mozPA: true,
        mozSpamScore: true,
        mozLinks: true,
        mozDomains: true,
        linkGroup: true,
        linkRole: true,
      },
      orderBy: { totalClicks: "desc" },
    });

    // Check which domains have integrations
    const integrations = await prisma.domainIntegration.findMany({
      where: { status: "ACTIVE" },
      select: { domainId: true, provider: true },
    });
    const integrationMap = new Map<string, string[]>();
    for (const i of integrations) {
      if (!integrationMap.has(i.domainId)) integrationMap.set(i.domainId, []);
      integrationMap.get(i.domainId)!.push(i.provider);
    }

    // Check which domains have Ads data
    const adsDomainsRaw = await prisma.adsCampaignDaily.groupBy({
      by: ["domainId"],
      _count: { id: true },
    });
    const adsDomainIds = new Set(adsDomainsRaw.map((a) => a.domainId));

    const lines: string[] = ["=== PRZEGLĄD DOMEN ==="];
    lines.push(
      "Domena | Kat | Grupa | Rola | Strony | Index% | Klik(30d) | Imp | Poz | DA | Spam | ExtLinks | Integracje",
    );
    for (const d of allDomains) {
      const indexPct =
        d.totalPages > 0
          ? Math.round((d.indexedPages / d.totalPages) * 100)
          : 0;
      const integ = integrationMap.get(d.id) || [];
      const hasAds = adsDomainIds.has(d.id);
      const integStr =
        [
          ...integ.map((i) => i.replace("GOOGLE_", "").toLowerCase()),
          ...(hasAds ? ["ads"] : []),
        ].join(",") || "-";

      lines.push(
        `${d.label || d.domain} | ${d.category} | ${d.linkGroup || "-"} | ${d.linkRole || "-"} | ${d.totalPages} | ${indexPct}% | ${d.totalClicks} | ${d.totalImpressions} | ${d.avgPosition?.toFixed(1) || "-"} | ${d.mozDA?.toFixed(0) || "-"} | ${d.mozSpamScore?.toFixed(0) || "-"} | ${d.mozLinks || "-"} | ${integStr}`,
      );
    }
    return lines.join("\n");
  }

  async chat(
    question: string,
    history: { role: string; content: string }[] = [],
  ) {
    const overview = await this.buildOverview();

    const systemPrompt = `Jesteś ekspertem SEO i analitykiem digital marketingu zarządzającym portfelem polskich domen. 

DANE, DO KTÓRYCH MASZ DOSTĘP PRZEZ NARZĘDZIA:
1. GSC (Google Search Console) — frazy, pozycje, kliknięcia, indeksowanie, crawl
2. Google Analytics (GA4) — sesje, użytkownicy, pageviews, bounce rate, konwersje, przychody, źródła ruchu
3. Google Ads — kampanie (Search, Shopping, PMax), produkty, search terms, ROAS, CPC, koszty
4. Google Merchant Center — status feedu: approved/disapproved/pending
5. Moz — Domain Authority, Page Authority, spam score, backlinki, anchory, linking domains
6. Cross-domain linking — cross-linki między domenami w portfelu, strategia satelitów
7. Alerty i eventy SEO — deindeksacja, spadki ruchu, nowe backlinki, broken links

ZASADY:
- ZAWSZE użyj narzędzi gdy potrzebujesz danych — nie zgaduj, sięgnij po konkrety
- Na pytania ogólne ("podsumuj portfel") użyj get_portfolio_performance lub overview
- Na pytania o konkretną domenę — użyj odpowiednich narzędzi dla tej domeny
- Jeśli pytanie dotyczy kilku źródeł (np. "czy Ads się opłaca vs organic") — wywołaj KILKA narzędzi
- Odpowiadaj KONKRETNIE z liczbami, URL-ami, pozycjami, kosztami
- Jeśli widzisz problem — powiedz wprost co zrobić, z priorytetami
- Polski język z terminami SEO/marketing po angielsku (DA, ROAS, CPC, CTR, bounce rate)
- Znasz grupy: EDU, COPY, MOTORS, PERSONAL
- Znasz role: MAIN (money site), SATELLITE (zaplecze), SUPPORT
- Kolumna "Integracje" w przeglądzie pokazuje jakie źródła danych są dostępne dla danej domeny (analytics, merchant, ads)
- NIE odpowiadaj na pytania o linkowanie wewnętrzne, strukturę linków wewnętrznych — panel nie zbiera wiarygodnych danych na ten temat. Powiedz użytkownikowi wprost.
- NIE opisuj suchych danych, które user sam widzi w panelu na temat strony, tylko staraj się wyciągać wnioski i przedstawiać informacje, które na pierwszy rzut oka nie są widoczne, więc masz odpowiadać analitycznie, a nie opisowo - chyba że user o to poprosi
- jeśli user zadaje pytania, po prostu z nim rozmawiaj, korzystając z własnej wiedzy i/lub danych, JEŚLI wymaga tego odpowiedzi. JEŚLI NIE, nie sięgaj po dane

PRZEGLĄD DOMEN (dane podstawowe — po szczegóły użyj narzędzi):
${overview}`;

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: question },
    ];

    // ─── Full debug trace ───
    interface ToolCallTrace {
      tool: string;
      input: any;
      resultLength: number;
      result: string; // FULL result, not truncated
      durationMs: number;
    }
    interface IterationTrace {
      iteration: number;
      toolCalls: ToolCallTrace[];
      intermediateText: string | null; // Claude's thinking between tool calls
      inputTokens: number;
      outputTokens: number;
      stopReason: string | null;
    }

    const trace: {
      systemPrompt: string;
      userQuestion: string;
      historyLength: number;
      iterations: IterationTrace[];
      finalAnswer: string;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalDurationMs: number;
    } = {
      systemPrompt,
      userQuestion: question,
      historyLength: history.length,
      iterations: [],
      finalAnswer: "",
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalDurationMs: 0,
    };

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const startTime = Date.now();

    // Initial call
    let response = await aiCall({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: systemPrompt,
      messages,
      tools: TOOLS,
      feature: "seo_chat_tool_turn",
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Process tool calls in a loop (max 8 iterations)
    let iterations = 0;
    while (response.stop_reason === "tool_use" && iterations < 8) {
      iterations++;
      const iterStart = Date.now();

      // Capture Claude's intermediate text (thinking/reasoning before tool calls)
      const intermediateText =
        response.content
          .filter((b) => b.type === "text")
          .map((b) => (b as any).text)
          .join("\n")
          .trim() || null;

      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use",
      );
      const toolCallTraces: ToolCallTrace[] = [];

      const toolResults: Anthropic.MessageParam = {
        role: "user",
        content: await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== "tool_use")
              return { type: "text" as const, text: "" };
            const toolStart = Date.now();
            console.log(
              `[Chat] Tool call #${iterations}: ${block.name}(${JSON.stringify(block.input)})`,
            );

            const result = await executeTool(block.name, block.input);

            toolCallTraces.push({
              tool: block.name,
              input: block.input,
              resultLength: result.length,
              result, // FULL — no truncation
              durationMs: Date.now() - toolStart,
            });

            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: result,
            };
          }),
        ),
      };

      trace.iterations.push({
        iteration: iterations,
        toolCalls: toolCallTraces,
        intermediateText,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      });

      messages.push({ role: "assistant", content: response.content });
      messages.push(toolResults);

      response = await aiCall({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: systemPrompt,
        messages,
        tools: TOOLS,
        feature: "seo_chat_tool_turn",
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
    }

    const answer =
      response.content.find((c) => c.type === "text")?.text ||
      "Brak odpowiedzi";
    const durationMs = Date.now() - startTime;

    trace.finalAnswer = answer;
    trace.totalInputTokens = totalInputTokens;
    trace.totalOutputTokens = totalOutputTokens;
    trace.totalDurationMs = durationMs;

    // Build full readable context for frontend
    const contextParts: string[] = [];
    contextParts.push(
      "╔══════════════════════════════════════════════════════╗",
    );
    contextParts.push(
      "║              PEŁNY KONTEKST SESJI CLAUDE             ║",
    );
    contextParts.push(
      "╚══════════════════════════════════════════════════════╝",
    );
    contextParts.push("");
    contextParts.push(
      "┌─── SYSTEM PROMPT ───────────────────────────────────┐",
    );
    contextParts.push(systemPrompt);
    contextParts.push("└────────────────────────────────────────────────────┘");
    contextParts.push("");

    if (history.length > 0) {
      contextParts.push(
        "┌─── HISTORIA KONWERSACJI ────────────────────────────┐",
      );
      for (const h of history) {
        contextParts.push(`[${h.role.toUpperCase()}]: ${h.content}`);
        contextParts.push("---");
      }
      contextParts.push(
        "└────────────────────────────────────────────────────┘",
      );
      contextParts.push("");
    }

    contextParts.push(
      `┌─── PYTANIE UŻYTKOWNIKA ─────────────────────────────┐`,
    );
    contextParts.push(question);
    contextParts.push("└────────────────────────────────────────────────────┘");
    contextParts.push("");

    for (const iter of trace.iterations) {
      contextParts.push(
        `╔══ ITERACJA ${iter.iteration} ══════════════════════════════════════╗`,
      );
      contextParts.push(
        `║ Tokens: IN=${iter.inputTokens} OUT=${iter.outputTokens} | Stop: ${iter.stopReason}`,
      );

      if (iter.intermediateText) {
        contextParts.push("║");
        contextParts.push("║ 💭 CLAUDE MYŚLI:");
        contextParts.push(iter.intermediateText);
      }

      for (const tc of iter.toolCalls) {
        contextParts.push("║");
        contextParts.push(`║ 🔧 TOOL: ${tc.tool}`);
        contextParts.push(`║ 📥 INPUT: ${JSON.stringify(tc.input)}`);
        contextParts.push(`║ ⏱  ${tc.durationMs}ms | ${tc.resultLength} chars`);
        contextParts.push("║ 📤 FULL RESULT:");
        contextParts.push(
          "║ ─────────────────────────────────────────────────",
        );
        contextParts.push(tc.result);
        contextParts.push(
          "║ ─────────────────────────────────────────────────",
        );
      }
      contextParts.push(
        "╚═══════════════════════════════════════════════════╝",
      );
      contextParts.push("");
    }

    contextParts.push(
      "┌─── FINALNA ODPOWIEDŹ CLAUDE ────────────────────────┐",
    );
    contextParts.push(
      `Tokens: IN=${totalInputTokens} OUT=${totalOutputTokens} | Iteracje: ${iterations} | Czas: ${durationMs}ms`,
    );
    contextParts.push("└────────────────────────────────────────────────────┘");

    return {
      answer,
      matchedDomain: null,
      usage: {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      },
      durationMs,
      context: contextParts.join("\n"),
      // Structured trace for programmatic access
      trace: JSON.stringify(trace),
    };
  }
}
