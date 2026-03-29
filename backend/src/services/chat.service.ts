// backend/src/services/chat.service.ts

import { prisma } from "../lib/prisma.js";
import { aiCall } from "../lib/ai-client.js";

export class ChatService {
  // Gather all context data for Claude
  async buildContext(question: string) {
    const startTime = Date.now();

    // Detect which domains the question might be about
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
        mozAnchors: true,
        linkGroup: true,
        linkRole: true,
      },
    });

    // Try to match specific domain from question
    const qLower = question.toLowerCase();
    const matchedDomain = allDomains.find(
      (d) =>
        qLower.includes(d.domain.replace("www.", "")) ||
        (d.label && qLower.includes(d.label.toLowerCase())) ||
        qLower.includes(d.domain),
    );

    // Build context sections
    const sections: string[] = [];

    // 1. All domains overview (always include — compact)
    sections.push("=== PRZEGLĄD DOMEN ===");
    sections.push(
      "Domena | Kategoria | Grupa | Rola | Strony | Zaindeks. | Kliknięcia(30d) | Wyświetl. | Śr.Poz | DA | PA | Spam | Ext.Links | Link.Domains",
    );
    for (const d of allDomains) {
      const pct =
        d.totalPages > 0
          ? Math.round((d.indexedPages / d.totalPages) * 100)
          : 0;
      sections.push(
        `${d.label || d.domain} | ${d.category} | ${d.linkGroup || "-"} | ${d.linkRole || "-"} | ${d.totalPages} | ${d.indexedPages}(${pct}%) | ${d.totalClicks} | ${d.totalImpressions} | ${d.avgPosition?.toFixed(1) || "-"} | DA:${d.mozDA?.toFixed(0) || "-"} | PA:${d.mozPA?.toFixed(0) || "-"} | Spam:${d.mozSpamScore?.toFixed(0) || "-"} | ExtLinks:${d.mozLinks || "-"} | LinkDomains:${d.mozDomains || "-"}`,
      );
    }

    // 2. If specific domain matched — add detailed data
    if (matchedDomain) {
      const domainId = matchedDomain.id;

      // Top pages
      const topPages = await prisma.page.findMany({
        where: { domainId, inSitemap: true },
        orderBy: { clicks: "desc" },
        take: 20,
        select: {
          path: true,
          clicks: true,
          impressions: true,
          position: true,
          indexingVerdict: true,
          internalLinksIn: true,
        },
      });

      sections.push(
        `\n=== SZCZEGÓŁY: ${matchedDomain.label || matchedDomain.domain} ===`,
      );
      sections.push("Top 20 stron:");
      for (const p of topPages) {
        sections.push(
          `  ${p.path} | klik:${p.clicks} | imp:${p.impressions} | poz:${p.position?.toFixed(1) || "-"} | ${p.indexingVerdict} | linksIn:${p.internalLinksIn}`,
        );
      }

      // Indexing stats
      const indexing = await prisma.page.groupBy({
        by: ["indexingVerdict"],
        where: { domainId, inSitemap: true },
        _count: { id: true },
      });
      sections.push("\nIndeksowanie:");
      for (const s of indexing) {
        sections.push(`  ${s.indexingVerdict}: ${s._count.id}`);
      }

      // Backlinks
      const backlinks = await prisma.backlinkSnapshot.findMany({
        where: { domainId },
        take: 30,
        orderBy: { mozSourceDA: { sort: "desc", nulls: "last" } },
        select: {
          sourceDomain: true,
          anchorText: true,
          targetUrl: true,
          isDofollow: true,
          isLive: true,
          mozSourceDA: true,
          source: true,
        },
      });
      if (backlinks.length) {
        sections.push("\nBacklinki:");
        for (const bl of backlinks) {
          sections.push(
            `  ${bl.sourceDomain} → ${bl.targetUrl.replace(/^https?:\/\/[^/]+/, "")} | anchor:"${bl.anchorText || "-"}" | DA:${bl.mozSourceDA?.toFixed(0) || "-"} | ${bl.isDofollow ? "do" : "no"} | ${bl.isLive ? "live" : "lost"} | ${bl.source}`,
          );
        }
      }

      // Anchor text distribution
      if (matchedDomain.mozAnchors) {
        sections.push("\nDystrybucja anchor text:");
        for (const a of (matchedDomain.mozAnchors as any[]).slice(0, 10)) {
          sections.push(
            `  "${a.text}" — ${a.externalDomains} domen, ${a.externalPages} stron`,
          );
        }
      }

      // Recent alerts
      const alerts = await prisma.alert.findMany({
        where: { domainId, isResolved: false },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: { type: true, severity: true, title: true, createdAt: true },
      });
      if (alerts.length) {
        sections.push("\nAktywne alerty:");
        for (const a of alerts) {
          sections.push(`  [${a.severity}] ${a.type}: ${a.title}`);
        }
      }

      // Recent SEO events
      const events = await prisma.seoEvent.findMany({
        where: { domainId },
        take: 15,
        orderBy: { createdAt: "desc" },
        include: { page: { select: { path: true } } },
      });
      if (events.length) {
        sections.push("\nOstatnie wydarzenia SEO:");
        for (const e of events) {
          sections.push(
            `  ${new Date(e.createdAt).toISOString().split("T")[0]} | ${e.type} | ${e.page?.path || "-"} | ${JSON.stringify(e.data)}`,
          );
        }
      }

      // Orphan pages count
      const orphanCount = await prisma.page.count({
        where: { domainId, inSitemap: true, internalLinksIn: 0 },
      });
      sections.push(`\nOrphan pages: ${orphanCount}`);

      // Broken links count
      const brokenCount = await prisma.link.count({
        where: { isBroken: true, fromPage: { domainId } },
      });
      sections.push(`Złamane linki: ${brokenCount}`);
    }

    // 3. Cross-domain link summary
    const crossLinks = await prisma.backlinkSnapshot.groupBy({
      by: ["domainId", "sourceDomain"],
      _count: { id: true },
    });

    const durationMs = Date.now() - startTime;
    const context = sections.join("\n");

    return {
      context,
      matchedDomain,
      durationMs,
      contextLength: context.length,
    };
  }

  async chat(
    question: string,
    history: { role: string; content: string }[] = [],
  ) {
    const {
      context,
      matchedDomain,
      durationMs: contextMs,
    } = await this.buildContext(question);

    const systemPrompt = `Jesteś ekspertem SEO zarządzającym portfelem 23 polskich domen. Masz pełny dostęp do danych z Google Search Console, Moz API, link crawlera i indeksowania.

ZASADY:
- Odpowiadaj KONKRETNIE na podstawie danych — nie ogólnikowo
- Podawaj LICZBY, URL-e, pozycje — nie "warto sprawdzić"
- Jeśli widzisz problem — powiedz wprost co zrobić
- Używaj polskiego z terminami SEO po angielsku (DA, PA, CTR, impressions)
- Bądź zwięzły ale treściwy
- Jeśli pytanie dotyczy konkretnej domeny, skup się na niej
- Jeśli pytanie ogólne — porównuj domeny między sobą
- Znasz strukturę grup linkowania: EDU (edukacyjne), COPY (copywriting), MOTORS (silniki), PERSONAL
- Znasz role: MAIN (główna domena grupy), SATELLITE (zaplecze SEO), SUPPORT

DANE:
${context}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: question },
    ];

    // Use aiCall — logs everything to ApiLog automatically
    const msg = await aiCall({
      model: "claude-sonnet-4-6",
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      max_tokens: 2000,
      feature: "seo_chat",
      domainId: matchedDomain?.id,
      domainLabel: matchedDomain?.label || matchedDomain?.domain,
      system: systemPrompt,
    });

    const answer =
      msg.content.find((c) => c.type === "text")?.text || "Brak odpowiedzi";

    return {
      answer,
      matchedDomain: matchedDomain?.label || matchedDomain?.domain || null,
      usage: msg.usage,
      durationMs: 0, // aiCall handles logging
    };
  }
}
