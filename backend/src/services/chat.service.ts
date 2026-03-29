// backend/src/services/chat.service.ts

import { prisma } from "../lib/prisma.js";
import { aiCall } from "../lib/ai-client.js";
import type Anthropic from "@anthropic-ai/sdk";

// Tool definitions — Claude decides when to call them
const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_domain_details",
    description:
      "Pobierz szczegółowe dane domeny: top 30 stron z metrykami, statystyki indeksowania, orphan pages, broken links, ostatnie alerty i eventy SEO. Użyj gdy pytanie dotyczy konkretnej domeny.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: {
          type: "string",
          description:
            "Nazwa/label domeny np. 'Stojan Shop', 'MaturaPolski', 'Smart-Edu.ai'",
        },
      },
      required: ["domain_label"],
    },
  },
  {
    name: "get_domain_backlinks",
    description:
      "Pobierz backlinki domeny: źródła, DA źródeł, anchory, dofollow/nofollow, Moz anchors distribution. Użyj gdy pytanie dotyczy linkowania zewnętrznego, profilu linkowego, DA, anchor text.",
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
      "Pobierz top 50 fraz z GSC dla domeny: query, clicks, impressions, position, CTR. Użyj gdy pytanie dotyczy fraz, pozycji, widoczności w Google, CTR, cannibalization.",
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
    name: "get_domain_internal_links",
    description:
      "Pobierz strukturę linkowania wewnętrznego: link magnets, orphan pages, strony z małą liczbą linków IN ale dużą liczbą wyświetleń. Użyj gdy pytanie dotyczy linkowania wewnętrznego, struktury serwisu, orphan pages.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain_label: { type: "string", description: "Nazwa domeny" },
      },
      required: ["domain_label"],
    },
  },
  {
    name: "get_cross_domain_links",
    description:
      "Pobierz mapę cross-linków między domenami w portfelu: kto linkuje do kogo, ile linków, anchory. Użyj gdy pytanie dotyczy strategii linkowania między domenami, sieci satelitów.",
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
      "Pobierz strony które zyskały lub straciły pozycje w ostatnim tygodniu (winners/losers). Użyj gdy pytanie dotyczy trendów, zmian pozycji, co rośnie/spada.",
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
      "Porównaj 2-5 domen: DA, kliknięcia, indeksowanie, backlinki, pozycje side by side. Użyj gdy użytkownik prosi o porównanie lub ranking domen.",
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
];

// Tool implementations
async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    case "get_domain_details":
      return await getDetailedDomainData(input.domain_label);
    case "get_domain_backlinks":
      return await getDomainBacklinksData(input.domain_label);
    case "get_domain_queries":
      return await getDomainQueriesData(
        input.domain_label,
        input.min_impressions || 5,
      );
    case "get_domain_internal_links":
      return await getDomainInternalLinksData(input.domain_label);
    case "get_cross_domain_links":
      return await getCrossDomainLinksData(input.group);
    case "get_position_movers":
      return await getPositionMoversData(input.domain_label);
    case "compare_domains":
      return await compareDomainsData(input.domain_labels);
    default:
      return `Unknown tool: ${name}`;
  }
}

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
    `DA: ${domain.mozDA?.toFixed(0) || "-"} | PA: ${domain.mozPA?.toFixed(0) || "-"} | Spam: ${domain.mozSpamScore?.toFixed(0) || "-"}`,
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
      internalLinksIn: true,
      internalLinksOut: true,
      externalLinksOut: true,
      title: true,
    },
  });
  sections.push(`\nTop 30 stron (sortowane po kliknięciach):`);
  sections.push(
    "Path | Klik | Imp | Poz | Verdict | LinksIn | LinksOut | Title",
  );
  for (const p of topPages) {
    sections.push(
      `${p.path} | ${p.clicks} | ${p.impressions} | ${p.position?.toFixed(1) || "-"} | ${p.indexingVerdict} | IN:${p.internalLinksIn} OUT:${p.internalLinksOut + p.externalLinksOut} | ${(p.title || "").slice(0, 60)}`,
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

  // Orphan count
  const orphans = await prisma.page.count({
    where: { domainId, inSitemap: true, internalLinksIn: 0 },
  });
  const broken = await prisma.link.count({
    where: { isBroken: true, fromPage: { domainId } },
  });
  sections.push(`\nOrphan pages: ${orphans} | Broken links: ${broken}`);

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
      sections.push(
        `  ${new Date(e.createdAt).toISOString().split("T")[0]} | ${e.type} | ${e.page?.path || "-"}`,
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

  // Group by domain
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

  // Anchor distribution from Moz
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

  // Aggregate queries from GscPageDaily
  const sevenDaysAgo = new Date(Date.now() - 30 * 86400000);
  const daily = await prisma.gscPageDaily.findMany({
    where: { page: { domainId: domain.id }, date: { gte: sevenDaysAgo } },
    select: { topQueries: true, page: { select: { path: true } } },
  });

  const queryMap = new Map<
    string,
    {
      clicks: number;
      impressions: number;
      positions: number[];
      pages: Set<string>;
    }
  >();
  for (const d of daily) {
    if (!d.topQueries) continue;
    for (const q of d.topQueries as any[]) {
      if (!q.query) continue;
      const existing = queryMap.get(q.query) || {
        clicks: 0,
        impressions: 0,
        positions: [],
        pages: new Set(),
      };
      existing.clicks += q.clicks || 0;
      existing.impressions += q.impressions || 0;
      if (q.position) existing.positions.push(q.position);
      existing.pages.add(d.page.path);
      queryMap.set(q.query, existing);
    }
  }

  const queries = Array.from(queryMap.entries())
    .map(([query, data]) => ({
      query,
      clicks: data.clicks,
      impressions: data.impressions,
      avgPosition: data.positions.length
        ? data.positions.reduce((s, p) => s + p, 0) / data.positions.length
        : 0,
      pages: data.pages.size,
      pagesList: Array.from(data.pages).slice(0, 3),
    }))
    .filter((q) => q.impressions >= minImpressions)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50);

  const sections: string[] = [];
  sections.push(
    `=== FRAZY GSC: ${domain.label || domain.domain} (30d, min ${minImpressions} imp) ===`,
  );
  sections.push(`Łącznie: ${queries.length} fraz`);
  sections.push("Query | Klik | Imp | Śr.Poz | Stron | Strony");
  for (const q of queries) {
    const ctr =
      q.impressions > 0 ? ((q.clicks / q.impressions) * 100).toFixed(1) : "0";
    sections.push(
      `"${q.query}" | ${q.clicks} | ${q.impressions} | ${q.avgPosition.toFixed(1)} | ${q.pages} | ${q.pagesList.join(", ")}`,
    );
  }

  // Cannibalization alerts
  const cannibalized = queries.filter((q) => q.pages > 1);
  if (cannibalized.length) {
    sections.push(`\n⚠️ CANNIBALIZATION — frazy z >1 stroną rankującą:`);
    for (const q of cannibalized.slice(0, 10)) {
      sections.push(
        `  "${q.query}" — ${q.pages} stron: ${q.pagesList.join(", ")}`,
      );
    }
  }

  return sections.join("\n");
}

async function getDomainInternalLinksData(label: string): Promise<string> {
  const domain = await findDomainByLabel(label);
  if (!domain) return `Nie znaleziono domeny: ${label}`;

  const pages = await prisma.page.findMany({
    where: { domainId: domain.id, inSitemap: true },
    orderBy: { clicks: "desc" },
    take: 100,
    select: {
      path: true,
      clicks: true,
      impressions: true,
      position: true,
      internalLinksIn: true,
      internalLinksOut: true,
      externalLinksOut: true,
      indexingVerdict: true,
    },
  });

  const sections: string[] = [];
  sections.push(
    `=== LINKOWANIE WEWNĘTRZNE: ${domain.label || domain.domain} ===`,
  );

  const totalIn = pages.reduce((s, p) => s + p.internalLinksIn, 0);
  const totalOut = pages.reduce((s, p) => s + p.internalLinksOut, 0);
  const orphans = pages.filter((p) => p.internalLinksIn === 0);
  const avgIn = pages.length ? (totalIn / pages.length).toFixed(1) : "0";
  sections.push(
    `Stron: ${pages.length} | Łącznie linków IN: ${totalIn} | Śr. IN/stronę: ${avgIn} | Orphan pages: ${orphans.length}`,
  );

  // Orphan pages with traffic
  const orphansWithTraffic = orphans
    .filter((p) => p.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions);
  if (orphansWithTraffic.length) {
    sections.push(`\n🔴 ORPHAN PAGES Z RUCHEM (${orphansWithTraffic.length}):`);
    for (const p of orphansWithTraffic.slice(0, 15)) {
      sections.push(
        `  ${p.path} | ${p.clicks} klik | ${p.impressions} imp | poz ${p.position?.toFixed(1) || "-"} | ${p.indexingVerdict}`,
      );
    }
  }

  // Pages needing links (traffic but few links IN)
  const needLinks = pages
    .filter((p) => p.internalLinksIn <= 1 && p.impressions > 10)
    .sort((a, b) => b.impressions - a.impressions);
  if (needLinks.length) {
    sections.push(`\n🟡 POTRZEBUJĄ LINKÓW (IN ≤ 1, imp > 10):`);
    for (const p of needLinks.slice(0, 15)) {
      sections.push(
        `  ${p.path} | IN:${p.internalLinksIn} | ${p.clicks} klik | ${p.impressions} imp | poz ${p.position?.toFixed(1) || "-"}`,
      );
    }
  }

  // Link magnets
  const magnets = [...pages]
    .sort((a, b) => b.internalLinksIn - a.internalLinksIn)
    .slice(0, 10);
  sections.push(`\n🟢 LINK MAGNETS (top IN):`);
  for (const p of magnets) {
    sections.push(
      `  ${p.path} | IN:${p.internalLinksIn} | OUT:${p.internalLinksOut} | ${p.clicks} klik`,
    );
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

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

  const recent = await prisma.gscPageDaily.groupBy({
    by: ["pageId"],
    where: { page: { domainId: domain.id }, date: { gte: sevenDaysAgo } },
    _avg: { position: true },
    _sum: { clicks: true, impressions: true },
  });

  const previous = await prisma.gscPageDaily.groupBy({
    by: ["pageId"],
    where: {
      page: { domainId: domain.id },
      date: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
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
    "Domena | DA | PA | Spam | Strony | Index% | Klik(30d) | Imp | Poz | ExtLinks | LinkDomains | Orphans",
  );

  for (const d of domains) {
    const orphans = await prisma.page.count({
      where: { domainId: d.id, inSitemap: true, internalLinksIn: 0 },
    });
    const pct =
      d.totalPages > 0 ? Math.round((d.indexedPages / d.totalPages) * 100) : 0;
    sections.push(
      `${d.label || d.domain} | DA:${d.mozDA?.toFixed(0) || "-"} | PA:${d.mozPA?.toFixed(0) || "-"} | Spam:${d.mozSpamScore?.toFixed(0) || "-"} | ${d.totalPages} | ${pct}% | ${d.totalClicks} | ${d.totalImpressions} | ${d.avgPosition?.toFixed(1) || "-"} | ${d.mozLinks || "-"} | ${d.mozDomains || "-"} | ${orphans}`,
    );
  }

  return sections.join("\n");
}

// ─── MAIN SERVICE ────────────────────────────────────────────

export class ChatService {
  async buildOverview(): Promise<string> {
    const allDomains = await prisma.domain.findMany({
      where: { isActive: true },
      select: {
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

    const lines: string[] = ["=== PRZEGLĄD 23 DOMEN ==="];
    lines.push(
      "Domena | Kat | Grupa | Rola | Strony | Index% | Klik(30d) | Imp | Poz | DA | Spam | ExtLinks | LinkDomains",
    );
    for (const d of allDomains) {
      const pct =
        d.totalPages > 0
          ? Math.round((d.indexedPages / d.totalPages) * 100)
          : 0;
      lines.push(
        `${d.label || d.domain} | ${d.category} | ${d.linkGroup || "-"} | ${d.linkRole || "-"} | ${d.totalPages} | ${pct}% | ${d.totalClicks} | ${d.totalImpressions} | ${d.avgPosition?.toFixed(1) || "-"} | ${d.mozDA?.toFixed(0) || "-"} | ${d.mozSpamScore?.toFixed(0) || "-"} | ${d.mozLinks || "-"} | ${d.mozDomains || "-"}`,
      );
    }
    return lines.join("\n");
  }

  async chat(
    question: string,
    history: { role: string; content: string }[] = [],
  ) {
    const overview = await this.buildOverview();

    const systemPrompt = `Jesteś ekspertem SEO zarządzającym portfelem 23 polskich domen. Masz dostęp do przeglądu wszystkich domen ORAZ narzędzi do pobierania szczegółowych danych.

ZASADY:
- ZAWSZE użyj narzędzi gdy potrzebujesz szczegółowych danych o konkretnej domenie
- Nie zgaduj — sięgnij po dane
- Odpowiadaj KONKRETNIE z liczbami, URL-ami, pozycjami
- Jeśli widzisz problem — powiedz wprost co zrobić
- Polski z terminami SEO po angielsku
- Znasz grupy: EDU, COPY, MOTORS, PERSONAL
- Znasz role: MAIN (money site), SATELLITE (zaplecze), SUPPORT

PRZEGLĄD DOMEN (dane podstawowe — po szczegóły użyj narzędzi):
${overview}`;

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: question },
    ];

    let allToolResults: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const startTime = Date.now();

    // Multi-turn tool loop
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

    // Process tool calls in a loop (max 5 iterations)
    let iterations = 0;
    while (response.stop_reason === "tool_use" && iterations < 5) {
      iterations++;
      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use",
      );
      const toolResults: Anthropic.MessageParam = {
        role: "user",
        content: await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== "tool_use")
              return { type: "text" as const, text: "" };
            console.log(
              `[Chat] Tool call: ${block.name}(${JSON.stringify(block.input)})`,
            );
            const result = await executeTool(block.name, block.input);
            allToolResults.push(`[${block.name}] ${result.slice(0, 200)}...`);
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: result,
            };
          }),
        ),
      };

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

    return {
      answer,
      matchedDomain: null,
      usage: {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      },
      durationMs: Date.now() - startTime,
      context: `${systemPrompt}\n\n--- TOOL CALLS (${iterations}) ---\n${allToolResults.join("\n")}`,
    };
  }
}
