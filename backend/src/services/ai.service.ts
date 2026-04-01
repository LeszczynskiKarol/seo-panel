// backend/src/services/ai.service.ts

import { prisma } from "../lib/prisma.js";
import { aiCall } from "../lib/ai-client.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "LeszczynskiKarol";

const LINK_DENSITY_RULES = `
LIMITY LINKÓW NA STRONĘ:
- Strona z < 500 słów: max 3-5 linków wychodzących
- Strona z 500-1500 słów: max 5-10 linków
- Strona z > 1500 słów: max 10-15 linków
- NIGDY nie dodawaj linka do strony która już ma >15 linków OUT
- Jeśli strona ma już dużo linków — POMIŃ ją jako źródło
- Jeden link na akapit max`;

// ─── GITHUB HELPERS ──────────────────────────────────────────

async function githubGet(repo: string, path: string): Promise<any> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function githubGetFile(
  repo: string,
  filePath: string,
): Promise<{ content: string; sha: string } | null> {
  const data = await githubGet(repo, filePath);
  if (!data || !data.content) return null;
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha };
}

async function githubListDir(repo: string, path: string): Promise<any[]> {
  const data = await githubGet(repo, path);
  if (!Array.isArray(data)) return [];
  return data;
}

async function githubCommit(
  repo: string,
  filePath: string,
  content: string,
  sha: string,
  message: string,
): Promise<string | null> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/${filePath}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString("base64"),
      sha,
      branch: "main",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`GitHub commit failed: ${err}`);
    return null;
  }
  const data = await res.json();
  return data.commit?.sha || null;
}

// ─── FIND CONTENT FILES ──────────────────────────────────────

async function findContentFiles(
  repo: string,
): Promise<{ path: string; name: string }[]> {
  const files: { path: string; name: string }[] = [];

  // Common Astro content locations
  const dirs = [
    "src/pages",
    "src/content",
    "src/content/blog",
    "src/pages/blog",
    "src/pages/baza-wiedzy",
  ];

  for (const dir of dirs) {
    try {
      const items = await githubListDir(repo, dir);
      for (const item of items) {
        if (
          item.type === "file" &&
          (item.name.endsWith(".astro") ||
            item.name.endsWith(".md") ||
            item.name.endsWith(".mdx"))
        ) {
          files.push({ path: item.path, name: item.name });
        }
        // One level deep
        if (item.type === "dir") {
          const subItems = await githubListDir(repo, item.path);
          for (const sub of subItems) {
            if (
              sub.type === "file" &&
              (sub.name.endsWith(".astro") ||
                sub.name.endsWith(".md") ||
                sub.name.endsWith(".mdx"))
            ) {
              files.push({ path: sub.path, name: sub.name });
            }
          }
        }
      }
    } catch {}
  }

  return files;
}

// ─── GATHER DOMAIN DATA ──────────────────────────────────────

async function getDomainContext(domainId: string) {
  const domain = await prisma.domain.findUniqueOrThrow({
    where: { id: domainId },
  });

  const pages = await prisma.page.findMany({
    where: { domainId, inSitemap: true, clicks: { gt: 0 } },
    orderBy: { clicks: "desc" },
    take: 50,
    select: {
      id: true,
      url: true,
      path: true,
      clicks: true,
      impressions: true,
      position: true,
      internalLinksIn: true,
      internalLinksOut: true,
    },
  });

  // Get top queries per page (from GscPageDaily topQueries)
  const pageIds = pages.map((p) => p.id);
  const recentDaily = await prisma.gscPageDaily.findMany({
    where: {
      pageId: { in: pageIds },
      date: { gte: new Date(Date.now() - 7 * 86400000) },
    },
    select: { pageId: true, topQueries: true },
  });

  // Build query map
  const queryMap = new Map<string, string[]>();
  for (const d of recentDaily) {
    if (!d.topQueries) continue;
    const queries = (d.topQueries as any[]).map((q) => q.query).filter(Boolean);
    const existing = queryMap.get(d.pageId) || [];
    queryMap.set(d.pageId, [...new Set([...existing, ...queries])]);
  }

  // Get domain keywords
  const domainKeywords = await prisma.domainKeyword.findMany({
    where: { domainId },
    select: { keyword: true, bestPosition: true, totalClicks: true },
  });

  // Get existing outgoing links
  const outLinks = await prisma.link.findMany({
    where: { fromPage: { domainId }, isInternal: false },
    select: { toUrl: true, fromPage: { select: { path: true } } },
    take: 200,
  });

  return {
    domain,
    pages: pages.map((p) => ({
      ...p,
      queries: queryMap.get(p.id)?.slice(0, 5) || [],
    })),
    domainKeywords,
    outLinks: outLinks.map((l) => ({ from: l.fromPage.path, to: l.toUrl })),
  };
}

// ─── CROSS-LINK ANALYSIS ─────────────────────────────────────

export async function analyzeCrossLinks(domainId: string) {
  const source = await getDomainContext(domainId);
  if (!source.domain.githubRepo)
    throw new Error("Domain has no GitHub repo configured");

  // Get all other domains with their pages
  const otherDomains = await prisma.domain.findMany({
    where: { isActive: true, id: { not: domainId } },
    select: {
      id: true,
      domain: true,
      label: true,
      siteUrl: true,
      githubRepo: true,
      category: true,
    },
  });

  // Pre-filter: ask Claude which domains are thematically relevant
  const filterPrompt = `Masz listę domen. Wskaż TYLKO te, które mają tematyczny związek z domeną "${source.domain.label || source.domain.domain}" (${source.domain.category}).

Domeny:
${otherDomains.map((d) => `- ${d.label || d.domain} (${d.category})`).join("\n")}

Odpowiedz TYLKO listą nazw domen które pasują tematycznie (jedna per linia, bez numeracji):`;

  const filterMsg = await aiCall({
    messages: [{ role: "user", content: filterPrompt }],
    max_tokens: 500,
    feature: "crosslink_filter",
    domainId,
    domainLabel: source.domain.label || source.domain.domain,
  });

  const filterText =
    filterMsg.content.find((c) => c.type === "text")?.text || "";
  const relevantNames = filterText
    .split("\n")
    .map((l) =>
      l
        .replace(/^[-•*]\s*/, "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  // Filter domains by Claude's recommendation
  const relevantDomains = otherDomains.filter((d) => {
    const name = (d.label || d.domain).toLowerCase();
    return relevantNames.some((r) => name.includes(r) || r.includes(name));
  });

  console.log(
    `Cross-link filter: ${otherDomains.length} domains → ${relevantDomains.length} relevant`,
  );

  const otherPagesData = [];
  for (const od of relevantDomains) {
    const pages = await prisma.page.findMany({
      where: { domainId: od.id, inSitemap: true, clicks: { gt: 0 } },
      orderBy: { clicks: "desc" },
      take: 20,
      select: { path: true, url: true, clicks: true, position: true },
    });
    if (pages.length > 0) {
      otherPagesData.push({
        domain: od.domain,
        label: od.label,
        siteUrl: od.siteUrl,
        githubRepo: od.githubRepo,
        pages,
      });
    }
  }

  // Existing cross-links
  const existingCrossLinks = source.outLinks.filter((l) => {
    return otherDomains.some((od) =>
      l.to.includes(od.domain.replace("www.", "")),
    );
  });

  // Build strategy context
  const allDomains = await prisma.domain.findMany({
    where: { isActive: true },
    select: {
      domain: true,
      label: true,
      linkGroup: true,
      linkRole: true,
      siteUrl: true,
    },
  });

  const groups = new Map<string, any[]>();
  for (const d of allDomains) {
    const g = d.linkGroup || "INNE";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(d);
  }

  const strategyContext = Array.from(groups.entries())
    .map(([group, domains]) => {
      const main = domains
        .filter((d) => d.linkRole === "MAIN")
        .map((d) => d.label || d.domain)
        .join(", ");
      const satellites = domains
        .filter((d) => d.linkRole === "SATELLITE")
        .map((d) => d.label || d.domain)
        .join(", ");
      const support = domains
        .filter((d) => d.linkRole === "SUPPORT")
        .map((d) => d.label || d.domain)
        .join(", ");
      return `GRUPA ${group}:
  Główne (money sites): ${main || "brak"}
  Satelity (linkują do głównych): ${satellites || "brak"}
  Wsparcie: ${support || "brak"}`;
    })
    .join("\n\n");

  const sourceRole = source.domain.linkRole || "UNKNOWN";
  const sourceGroup = source.domain.linkGroup || "INNE";

  // Group existing links per page
  const linksByPage = new Map<string, string[]>();
  for (const l of existingCrossLinks) {
    if (!linksByPage.has(l.from)) linksByPage.set(l.from, []);
    linksByPage.get(l.from)!.push(l.to);
  }
  const existingLinksFormatted = Array.from(linksByPage.entries())
    .map(
      ([page, links]) =>
        `${page} (${links.length} linków OUT):\n${links.map((l) => `  → ${l}`).join("\n")}`,
    )
    .join("\n\n");

  const prompt = `Jesteś ekspertem SEO. Analizujesz domeny pod kątem wzajemnego linkowania (cross-linking).

STRATEGIA LINKOWANIA — STRUKTURA SIECI DOMEN:
${strategyContext}

ZASADY STRATEGICZNE:
- Satelity linkują DO domen głównych (money sites) w swojej grupie — to ich główna rola SEO.
- Domeny główne mogą linkować do siebie nawzajem JEŚLI jest tematyczny związek.
- Satelity mogą linkować do satelitów w tej samej grupie jeśli to naturalne.
- Cross-group linkowanie (np. MOTORS → EDU) — tylko gdy jest wyraźny tematyczny kontekst.
- Linki muszą wyglądać naturalnie — nie spam, nie footerowe, nie w sidebarze. W treści artykułów.

ANALIZOWANA DOMENA: ${source.domain.label || source.domain.domain} (${source.domain.siteUrl})
Rola: ${sourceRole} | Grupa: ${sourceGroup}
${sourceRole === "SATELLITE" ? `→ Priorytet: linkowanie DO domeny głównej w grupie ${sourceGroup}` : ""}
${sourceRole === "MAIN" ? `→ Ta domena OTRZYMUJE linki z satelitów. Cross-linkuj do innych domen głównych jeśli pasuje tematycznie.` : ""}

STRONY ŹRÓDŁOWE (z kliknięciami i frazami):
${source.pages.map((p) => `- ${p.path} | ${p.clicks} klik. | poz. ${p.position?.toFixed(1) || "—"} | OUT: ${p.internalLinksOut + (linksByPage.get(p.path)?.length || 0)} | frazy: ${p.queries.join(", ") || "brak"}`).join("\n")}

ŚLEDZONE FRAZY: ${source.domainKeywords.map((k) => `${k.keyword} (poz. ${k.bestPosition?.toFixed(1)}, ${k.totalClicks} klik.)`).join(", ") || "brak"}

ISTNIEJĄCE LINKI WYCHODZĄCE (pogrupowane per strona):
${existingLinksFormatted || "BRAK — żadne cross-linki nie istnieją!"}

INNE NASZE DOMENY (potencjalne cele):
${otherPagesData
  .map((od) => {
    const odDomain = allDomains.find((d) => d.domain === od.domain);
    return `--- ${od.label || od.domain} [${odDomain?.linkRole || "?"}/${odDomain?.linkGroup || "?"}] (${od.siteUrl}) ---
${od.pages.map((p) => `  ${p.path} | ${p.clicks} klik. | poz. ${p.position?.toFixed(1) || "—"}`).join("\n")}`;
  })
  .join("\n\n")}

ZADANIE:
1. Znajdź 5-10 najlepszych okazji do cross-linkowania, zgodnych ze STRATEGIĄ powyżej.
2. ${sourceRole === "SATELLITE" ? "PRIORYTET: linki do domeny głównej w grupie " + sourceGroup : "Szukaj naturalnych powiązań tematycznych."}
3. Anchor text musi być naturalny — nie "kliknij tutaj", nie exact match keyword.
4. Nie proponuj linków które już istnieją.

${LINK_DENSITY_RULES}

Odpowiedz TYLKO w formacie JSON (bez markdown, bez backticks):
[
  {
    "sourcePath": "/strona-zrodlowa",
    "targetUrl": "https://domena.pl/strona-docelowa",
    "targetDomain": "domena.pl",
    "anchorText": "tekst linku",
    "reason": "uzasadnienie po polsku, z odniesieniem do strategii grupy"
  }
]`;

  const msg = await aiCall({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
    feature: "cross_links_analyze",
  });

  const text = msg.content.find((c) => c.type === "text")?.text || "[]";
  let proposals: any[];
  try {
    proposals = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
  } catch {
    console.error("Failed to parse AI response:", text.slice(0, 500));
    return { proposals: [], error: "Failed to parse AI response" };
  }

  // Now for each proposal, find the actual file and generate code change
  const saved = [];
  for (const prop of proposals) {
    try {
      const fileResult = await generateCodeChange(
        source.domain.githubRepo!,
        source.domain.siteUrl,
        prop.sourcePath,
        prop.targetUrl,
        prop.anchorText,
        "CROSSLINK",
      );

      if (fileResult) {
        const created = await prisma.linkProposal.create({
          data: {
            domainId,
            type: "CROSSLINK",
            sourceUrl: `${source.domain.siteUrl}${prop.sourcePath}`,
            sourcePath: prop.sourcePath,
            sourceDomain: source.domain.domain,
            targetUrl: prop.targetUrl,
            targetPath: new URL(prop.targetUrl).pathname,
            targetDomain: prop.targetDomain,
            anchorText: prop.anchorText,
            reason: prop.reason,
            githubRepo: source.domain.githubRepo!,
            filePath: fileResult.filePath,
            originalCode: fileResult.original,
            proposedCode: fileResult.proposed,
          },
        });
        saved.push(created);
      }
    } catch (e: any) {
      console.error(
        `Failed to generate code for ${prop.sourcePath}: ${e.message}`,
      );
    }
  }

  return { proposals: saved, total: proposals.length };
}

// ─── INTERNAL LINK ANALYSIS ──────────────────────────────────

export async function analyzeInternalLinks(domainId: string) {
  const source = await getDomainContext(domainId);
  if (!source.domain.githubRepo)
    throw new Error("Domain has no GitHub repo configured");

  // Get all pages with link data
  const allPages = await prisma.page.findMany({
    where: { domainId, inSitemap: true },
    orderBy: { clicks: "desc" },
    take: 100,
    select: {
      path: true,
      url: true,
      clicks: true,
      impressions: true,
      position: true,
      internalLinksIn: true,
      internalLinksOut: true,
    },
  });

  // Get existing internal links
  const internalLinks = await prisma.link.findMany({
    where: { fromPage: { domainId }, isInternal: true, toPage: { domainId } },
    select: {
      fromPage: { select: { path: true } },
      toPage: { select: { path: true } },
    },
    take: 500,
  });

  const prompt = `Jesteś ekspertem SEO. Analizujesz LINKOWANIE WEWNĘTRZNE na domenie.

DOMENA: ${source.domain.label || source.domain.domain} (${source.domain.siteUrl})
Kategoria: ${source.domain.category}

STRONY (z metrykmi):
${allPages.map((p) => `- ${p.path} | ${p.clicks} klik. | ${p.impressions} imp. | poz. ${p.position?.toFixed(1) || "—"} | linki IN: ${p.internalLinksIn} | linki OUT: ${p.internalLinksOut}`).join("\n")}

ŚLEDZONE FRAZY: ${source.domainKeywords.map((k) => `${k.keyword} (poz. ${k.bestPosition?.toFixed(1)}, ${k.totalClicks} klik.)`).join(", ") || "brak"}

ISTNIEJĄCE LINKI WEWNĘTRZNE:
${
  internalLinks
    .slice(0, 100)
    .map((l) => `${l.fromPage.path} → ${l.toPage?.path || "?"}`)
    .join("\n") || "BRAK"
}

ZADANIE:
1. Znajdź 5-15 najlepszych okazji do linkowania wewnętrznego.
2. Priorytet:   
   - Strony z ruchem które mogą przekazać link juice do ważnych stron
   - Tematyczne powiązania (np. strona kategorii → produkty, blog → usługi)
3. Dla każdej propozycji: strona źródłowa, strona docelowa (path), anchor text, uzasadnienie.
4. Nie proponuj linków które JUŻ ISTNIEJĄ. 

${LINK_DENSITY_RULES}

Odpowiedz TYLKO w formacie JSON:
[
  {
    "sourcePath": "/strona-zrodlowa",
    "targetPath": "/strona-docelowa",
    "anchorText": "tekst linku",
    "reason": "uzasadnienie po polsku"
  }
]`;

  const msg = await aiCall({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
    feature: "internal_links_analyze",
  });

  const text = msg.content.find((c) => c.type === "text")?.text || "[]";
  let proposals: any[];
  try {
    proposals = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
  } catch {
    return { proposals: [], error: "Failed to parse AI response" };
  }

  const saved = [];
  for (const prop of proposals) {
    try {
      const targetUrl = `${source.domain.siteUrl}${prop.targetPath}`;
      const fileResult = await generateCodeChange(
        source.domain.githubRepo!,
        source.domain.siteUrl,
        prop.sourcePath,
        targetUrl,
        prop.anchorText,
        "INTERNAL",
      );

      if (fileResult) {
        const created = await prisma.linkProposal.create({
          data: {
            domainId,
            type: "INTERNAL",
            sourceUrl: `${source.domain.siteUrl}${prop.sourcePath}`,
            sourcePath: prop.sourcePath,
            sourceDomain: source.domain.domain,
            targetUrl,
            targetPath: prop.targetPath,
            targetDomain: source.domain.domain,
            anchorText: prop.anchorText,
            reason: prop.reason,
            githubRepo: source.domain.githubRepo!,
            filePath: fileResult.filePath,
            originalCode: fileResult.original,
            proposedCode: fileResult.proposed,
          },
        });
        saved.push(created);
      }
    } catch (e: any) {
      console.error(
        `Failed to generate code for ${prop.sourcePath}: ${e.message}`,
      );
    }
  }

  return { proposals: saved, total: proposals.length };
}

// ─── GENERATE CODE CHANGE ────────────────────────────────────

async function generateCodeChange(
  repo: string,
  siteUrl: string,
  sourcePath: string,
  targetUrl: string,
  anchorText: string,
  linkType: "CROSSLINK" | "INTERNAL",
): Promise<{ filePath: string; original: string; proposed: string } | null> {
  // Map URL path to file path in repo
  // Common patterns for Astro sites:
  // /blog/article → src/pages/blog/article.astro or src/content/blog/article.md
  // /category → src/pages/category.astro or src/pages/category/index.astro

  const pathParts = sourcePath.replace(/^\//, "").replace(/\/$/, "");
  const candidates = [
    `src/pages/${pathParts}.astro`,
    `src/pages/${pathParts}/index.astro`,
    `src/pages/${pathParts}.md`,
    `src/pages/${pathParts}.mdx`,
    `src/content/blog/${pathParts}.md`,
    `src/content/blog/${pathParts}.mdx`,
    `src/content/${pathParts}.md`,
  ];

  let fileContent: string | null = null;
  let fileSha: string | null = null;
  let foundPath: string | null = null;

  for (const candidate of candidates) {
    const result = await githubGetFile(repo, candidate);
    if (result) {
      fileContent = result.content;
      fileSha = result.sha;
      foundPath = candidate;
      break;
    }
  }

  if (!fileContent || !foundPath) {
    console.log(`  File not found for ${sourcePath} in ${repo}`);
    return null;
  }

  // Ask Claude to insert the link
  const linkHref =
    linkType === "INTERNAL" ? new URL(targetUrl).pathname : targetUrl;

  const editPrompt = `Masz plik źródłowy strony Astro/MD. Musisz wstawić link do treści.

PLIK: ${foundPath}
ZAWARTOŚĆ:
${fileContent.slice(0, 8000)}

LINK DO WSTAWIENIA:
- URL: ${linkHref}
- Anchor text: "${anchorText}"
- Typ: ${linkType === "INTERNAL" ? "link wewnętrzny" : "link zewnętrzny (cross-link do innej naszej domeny)"}

ZASADY:
1. Wstaw link w NATURALNYM miejscu w treści — tam gdzie pasuje kontekstowo.
2. Jeśli to plik .astro — użyj <a href="${linkHref}">${anchorText}</a>
3. Jeśli to plik .md/.mdx — użyj [${anchorText}](${linkHref})
4. Dla cross-linków użyj pełnego URL. Dla wewnętrznych — ścieżkę.
5. NIE zmieniaj nic innego w pliku.
6. Jeśli nie ma dobrego miejsca na link — zwróć EXACTLY "NO_GOOD_PLACE".

Zwróć CAŁY zmieniony plik (nie diff, cały plik). Bez markdown backticks, bez komentarzy — TYLKO zawartość pliku.`;

  const editMsg = await aiCall({
    messages: [{ role: "user", content: editPrompt }],
    max_tokens: 8000,
    feature: "code_generation",
  });

  const proposed = editMsg.content.find((c) => c.type === "text")?.text || "";

  if (proposed.includes("NO_GOOD_PLACE") || proposed.length < 50) {
    return null;
  }

  return {
    filePath: foundPath,
    original: fileContent,
    proposed: proposed.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, ""),
  };
}

// ─── APPROVE PROPOSAL ────────────────────────────────────────

export async function approveProposal(proposalId: string) {
  const proposal = await prisma.linkProposal.findUniqueOrThrow({
    where: { id: proposalId },
  });

  if (proposal.status !== "PENDING")
    throw new Error(`Proposal is ${proposal.status}`);

  // Get current file SHA (might have changed)
  const file = await githubGetFile(
    proposal.githubRepo.replace(`${GITHUB_OWNER}/`, ""),
    proposal.filePath,
  );
  if (!file) throw new Error("File not found on GitHub");

  // Verify file hasn't changed too much
  if (file.content !== proposal.originalCode) {
    // File changed since proposal — need to regenerate
    return {
      error: "FILE_CHANGED",
      message:
        "Plik zmienił się od czasu propozycji. Uruchom analizę ponownie.",
    };
  }

  const repoName = proposal.githubRepo.includes("/")
    ? proposal.githubRepo.split("/")[1]
    : proposal.githubRepo;

  const commitMsg =
    proposal.type === "CROSSLINK"
      ? `[skip ci] SEO: Add cross-link from ${proposal.sourcePath} to ${proposal.targetDomain}${proposal.targetPath}`
      : `[skip ci] SEO: Add internal link from ${proposal.sourcePath} to ${proposal.targetPath}`;

  const sha = await githubCommit(
    repoName,
    proposal.filePath,
    proposal.proposedCode,
    file.sha,
    commitMsg,
  );

  if (!sha) throw new Error("GitHub commit failed");

  await prisma.linkProposal.update({
    where: { id: proposalId },
    data: {
      status: "COMMITTED",
      approvedAt: new Date(),
      committedAt: new Date(),
      commitSha: sha,
    },
  });
  console.log("=== APPROVE DEBUG ===");
  console.log("Proposal status:", proposal.status);
  console.log("File found:", !!file);
  console.log("File content length:", file?.content.length);
  console.log("Original code length:", proposal.originalCode.length);
  console.log("Content match:", file?.content === proposal.originalCode);
  console.log(
    "First diff at:",
    (() => {
      for (
        let i = 0;
        i < Math.min(file!.content.length, proposal.originalCode.length);
        i++
      ) {
        if (file!.content[i] !== proposal.originalCode[i])
          return `pos ${i}: "${file!.content.slice(i, i + 20)}" vs "${proposal.originalCode.slice(i, i + 20)}"`;
      }
      return "lengths differ";
    })(),
  );
  return { ok: true, commitSha: sha };
}

// ─── REJECT PROPOSAL ─────────────────────────────────────────

export async function rejectProposal(proposalId: string) {
  await prisma.linkProposal.update({
    where: { id: proposalId },
    data: { status: "REJECTED" },
  });
  return { ok: true };
}

// ─── GET PROPOSALS ───────────────────────────────────────────

export async function getProposals(domainId?: string, status?: string) {
  const where: any = {};
  if (domainId) where.domainId = domainId;
  if (status) where.status = status;

  return prisma.linkProposal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// ─── SITEMAP-BASED ANALYSIS (for dynamic sites) ─────────────

export async function analyzeBySitemap(
  domainId: string,
  type: "CROSSLINK" | "INTERNAL",
) {
  const domain = await prisma.domain.findUniqueOrThrow({
    where: { id: domainId },
  });

  // Fetch sitemap
  const sitemapUrls = await fetchSitemapUrls(
    domain.siteUrl,
    domain.sitemapPath,
  );

  // Get pages with GSC data
  const pages = await prisma.page.findMany({
    where: { domainId, inSitemap: true },
    orderBy: { clicks: "desc" },
    take: 100,
    select: {
      path: true,
      url: true,
      clicks: true,
      impressions: true,
      position: true,
      internalLinksIn: true,
      internalLinksOut: true,
    },
  });

  // Get domain keywords
  const domainKeywords = await prisma.domainKeyword.findMany({
    where: { domainId },
    select: { keyword: true, bestPosition: true, totalClicks: true },
  });

  // Get existing links
  const existingLinks = await prisma.link.findMany({
    where: { fromPage: { domainId } },
    select: {
      toUrl: true,
      fromPage: { select: { path: true } },
      isInternal: true,
    },
    take: 500,
  });

  let otherDomainsContext = "";
  if (type === "CROSSLINK") {
    const otherDomains = await prisma.domain.findMany({
      where: { isActive: true, id: { not: domainId } },
      select: { domain: true, label: true, siteUrl: true },
    });
    const otherPages = [];
    for (const od of otherDomains) {
      const op = await prisma.page.findMany({
        where: { domainId: od.domain, inSitemap: true, clicks: { gt: 0 } },
        orderBy: { clicks: "desc" },
        take: 15,
        select: { path: true, clicks: true, position: true },
      });
      // Fallback — query by domain record
      const opByDomain = op.length
        ? op
        : await prisma.page.findMany({
            where: {
              domain: { domain: od.domain },
              inSitemap: true,
              clicks: { gt: 0 },
            },
            orderBy: { clicks: "desc" },
            take: 15,
            select: { path: true, clicks: true, position: true },
          });
      if (opByDomain.length) otherPages.push({ ...od, pages: opByDomain });
    }
    otherDomainsContext = otherPages
      .map(
        (od) =>
          `--- ${od.label || od.domain} (${od.siteUrl}) ---\n${od.pages.map((p) => `  ${p.path} | ${p.clicks} klik. | poz. ${p.position?.toFixed(1) || "—"}`).join("\n")}`,
      )
      .join("\n\n");
  }

  const prompt =
    type === "CROSSLINK"
      ? buildCrosslinkSitemapPrompt(
          domain,
          pages,
          sitemapUrls,
          domainKeywords,
          existingLinks,
          otherDomainsContext,
        )
      : buildInternalSitemapPrompt(
          domain,
          pages,
          sitemapUrls,
          domainKeywords,
          existingLinks,
        );

  const msg = await aiCall({
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4000,
    feature: type === "CROSSLINK" ? "crosslink_sitemap" : "internal_sitemap",
    domainId,
    domainLabel: domain.label || domain.domain,
  });

  const text = msg.content.find((c) => c.type === "text")?.text || "[]";
  let recommendations: any[];
  try {
    recommendations = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
  } catch {
    return {
      recommendations: [],
      raw: text.slice(0, 2000),
      error: "Failed to parse",
    };
  }

  // Save as proposals with type MANUAL
  const saved = [];
  for (const rec of recommendations) {
    const created = await prisma.linkProposal.create({
      data: {
        domainId,
        type: type === "CROSSLINK" ? "CROSSLINK_MANUAL" : "INTERNAL_MANUAL",
        sourceUrl: rec.sourceUrl || `${domain.siteUrl}${rec.sourcePath}`,
        sourcePath: rec.sourcePath,
        sourceDomain: domain.domain,
        targetUrl: rec.targetUrl || `${domain.siteUrl}${rec.targetPath || ""}`,
        targetPath:
          rec.targetPath || new URL(rec.targetUrl || domain.siteUrl).pathname,
        targetDomain: rec.targetDomain || domain.domain,
        anchorText: rec.anchorText,
        reason: rec.reason,
        context: rec.implementation || null,
        githubRepo: domain.githubRepo || "manual",
        filePath: "manual",
        originalCode: "",
        proposedCode: "",
        status: "MANUAL",
      },
    });
    saved.push(created);
  }

  return { recommendations: saved, total: recommendations.length };
}

async function fetchSitemapUrls(
  siteUrl: string,
  sitemapPath: string,
): Promise<string[]> {
  const urls: string[] = [];
  const tryPaths = [
    sitemapPath,
    "/sitemap-index.xml",
    "/sitemap_index.xml",
    "/sitemap.xml",
  ];

  for (const path of tryPaths) {
    try {
      const res = await fetch(`${siteUrl}${path}`);
      if (!res.ok) continue;
      const xml = await res.text();

      // Extract URLs from sitemap
      const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
      const extractedUrls = urlMatches.map((m) => m.replace(/<\/?loc>/g, ""));

      // Check if sitemap index
      if (xml.includes("<sitemapindex") || xml.includes("<sitemap>")) {
        for (const subUrl of extractedUrls) {
          try {
            const subRes = await fetch(subUrl);
            if (!subRes.ok) continue;
            const subXml = await subRes.text();
            const subMatches = subXml.match(/<loc>([^<]+)<\/loc>/g) || [];
            urls.push(...subMatches.map((m) => m.replace(/<\/?loc>/g, "")));
          } catch {}
        }
      } else {
        urls.push(...extractedUrls);
      }

      if (urls.length > 0) break;
    } catch {}
  }

  return urls;
}

function buildInternalSitemapPrompt(
  domain: any,
  pages: any[],
  sitemapUrls: string[],
  keywords: any[],
  existingLinks: any[],
): string {
  const internalLinks = existingLinks
    .filter((l) => l.isInternal)
    .map((l) => `${l.fromPage.path} → ${l.toUrl}`);

  return `Jesteś ekspertem SEO. Analizujesz stronę DYNAMICZNĄ (SSR/e-commerce) pod kątem linkowania wewnętrznego.
UWAGA: To jest strona dynamiczna — NIE masz dostępu do kodu źródłowego. Podajesz rekomendacje do RĘCZNEGO wdrożenia.

DOMENA: ${domain.label || domain.domain} (${domain.siteUrl})
Kategoria: ${domain.category}

MAPA STRONY (${sitemapUrls.length} URL-i, pierwsze 200):
${sitemapUrls
  .slice(0, 200)
  .map((u) => {
    try {
      return new URL(u).pathname;
    } catch {
      return u;
    }
  })
  .join("\n")}

STRONY Z RUCHEM (GSC):
${pages.map((p) => `- ${p.path} | ${p.clicks} klik. | ${p.impressions} imp. | poz. ${p.position?.toFixed(1) || "—"} | IN: ${p.internalLinksIn} | OUT: ${p.internalLinksOut}`).join("\n")}

ŚLEDZONE FRAZY: ${keywords.map((k) => `${k.keyword} (poz. ${k.bestPosition?.toFixed(1)}, ${k.totalClicks} klik.)`).join(", ") || "brak"}

ISTNIEJĄCE LINKI WEWNĘTRZNE (${internalLinks.length}):
${internalLinks.slice(0, 100).join("\n") || "BRAK"}


ZADANIE:
1. Przeanalizuj strukturę URL-i z sitemapy — zidentyfikuj kategorie, produkty, artykuły, strony informacyjne.
2. Znajdź 10-20 najlepszych okazji do linkowania wewnętrznego.
3. Dla każdej propozycji podaj KONKRETNE wskazówki implementacji (np. "na stronie /kategoria dodaj sekcję 'Polecane produkty' z linkami do X, Y, Z").
4. Nie proponuj linków które już istnieją.

${LINK_DENSITY_RULES}



Format JSON:
[
  {
    "sourcePath": "/strona-zrodlowa",
    "targetPath": "/strona-docelowa",
    "anchorText": "tekst linku",
    "reason": "uzasadnienie SEO",
    "implementation": "Konkretna wskazówka gdzie i jak dodać link — np. 'W sekcji opisu produktu dodaj paragraf z linkiem' lub 'Dodaj sidebar z powiązanymi kategoriami'"
  }
]`;
}

function buildCrosslinkSitemapPrompt(
  domain: any,
  pages: any[],
  sitemapUrls: string[],
  keywords: any[],
  existingLinks: any[],
  otherDomainsContext: string,
): string {
  const externalLinks = existingLinks
    .filter((l) => !l.isInternal)
    .map((l) => `${l.fromPage.path} → ${l.toUrl}`);

  return `Jesteś ekspertem SEO. Analizujesz stronę DYNAMICZNĄ pod kątem cross-linkowania z innymi domenami.
UWAGA: To jest strona dynamiczna — podajesz rekomendacje do RĘCZNEGO wdrożenia.

DOMENA ŹRÓDŁOWA: ${domain.label || domain.domain} (${domain.siteUrl})
Kategoria: ${domain.category}

MAPA STRONY (${sitemapUrls.length} URL-i, pierwsze 200):
${sitemapUrls
  .slice(0, 200)
  .map((u) => {
    try {
      return new URL(u).pathname;
    } catch {
      return u;
    }
  })
  .join("\n")}

STRONY Z RUCHEM:
${pages.map((p) => `- ${p.path} | ${p.clicks} klik. | poz. ${p.position?.toFixed(1) || "—"}`).join("\n")}

ŚLEDZONE FRAZY: ${keywords.map((k) => `${k.keyword} (poz. ${k.bestPosition?.toFixed(1)}, ${k.totalClicks} klik.)`).join(", ") || "brak"}

ISTNIEJĄCE LINKI WYCHODZĄCE:
${externalLinks.slice(0, 50).join("\n") || "BRAK"}

INNE NASZE DOMENY:
${otherDomainsContext || "brak danych"}

ZADANIE:
1. Znajdź 5-10 okazji do cross-linkowania Z tej domeny DO innych naszych domen.
2. Podaj konkretne wskazówki implementacji dla strony dynamicznej.
3. Skup się na tematycznych powiązaniach.

5. Nie proponuj linków które już istnieją.

${LINK_DENSITY_RULES}


Format JSON:
[
  {
    "sourcePath": "/strona-zrodlowa",
    "targetUrl": "https://domena.pl/strona-docelowa",
    "targetDomain": "domena.pl",
    "anchorText": "tekst linku",
    "reason": "uzasadnienie SEO",
    "implementation": "Konkretna wskazówka — np. 'Na stronie produktu w sekcji footer dodaj link w kontekście powiązanych zasobów'"
  }
]`;
}
