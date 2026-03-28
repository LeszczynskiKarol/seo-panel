// backend/src/services/ai.service.ts

import { prisma } from "../lib/prisma.js";
import { aiCall } from "../lib/ai-client.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "LeszczynskiKarol";

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
    },
  });

  const otherPagesData = [];
  for (const od of otherDomains) {
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

  // Ask Claude to find opportunities
  const prompt = `Jesteś ekspertem SEO. Analizujesz domeny pod kątem wzajemnego linkowania (cross-linking).

DOMENA ŹRÓDŁOWA: ${source.domain.label || source.domain.domain} (${source.domain.siteUrl})
Repo GitHub: ${source.domain.githubRepo}

STRONY ŹRÓDŁOWE (z kliknięciami i frazami):
${source.pages.map((p) => `- ${p.path} | ${p.clicks} klik. | poz. ${p.position?.toFixed(1) || "—"} | frazy: ${p.queries.join(", ") || "brak"}`).join("\n")}

ŚLEDZONE FRAZY: ${source.domainKeywords.map((k) => `${k.keyword} (poz. ${k.bestPosition?.toFixed(1)}, ${k.totalClicks} klik.)`).join(", ") || "brak"}

ISTNIEJĄCE LINKI WYCHODZĄCE DO NASZYCH DOMEN:
${existingCrossLinks.map((l) => `${l.from} → ${l.to}`).join("\n") || "BRAK — żadne cross-linki nie istnieją!"}

INNE NASZE DOMENY (potencjalne cele linków):
${otherPagesData
  .map(
    (od) => `
--- ${od.label || od.domain} (${od.siteUrl}) ---
${od.pages.map((p) => `  ${p.path} | ${p.clicks} klik. | poz. ${p.position?.toFixed(1) || "—"}`).join("\n")}
`,
  )
  .join("\n")}

ZADANIE:
1. Znajdź 5-10 najlepszych okazji do cross-linkowania Z domeny źródłowej DO innych domen.
2. Dla każdej propozycji podaj: stronę źródłową (path), stronę docelową (pełny URL), proponowany anchor text, i uzasadnienie dlaczego ten link ma sens SEO.
3. Skup się na tematycznych powiązaniach — linkuj tylko tam gdzie jest sensowny kontekst.
4. Unikaj linkowania do stron bez ruchu.
5. Sprawdź czy dany link już nie istnieje w ISTNIEJĄCYCH LINKACH.

Odpowiedz TYLKO w formacie JSON (bez markdown, bez backticks):
[
  {
    "sourcePath": "/strona-zrodlowa",
    "targetUrl": "https://domena.pl/strona-docelowa",
    "targetDomain": "domena.pl",
    "anchorText": "tekst linku",
    "reason": "uzasadnienie po polsku"
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
   - Strony z dużą liczbą wyświetleń ale małą liczbą linków IN (orphan-like)
   - Strony z ruchem które mogą przekazać link juice do ważnych stron
   - Tematyczne powiązania (np. strona kategorii → produkty, blog → usługi)
3. Dla każdej propozycji: strona źródłowa, strona docelowa (path), anchor text, uzasadnienie.
4. Nie proponuj linków które JUŻ ISTNIEJĄ.

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
      ? `SEO: Add cross-link from ${proposal.sourcePath} to ${proposal.targetDomain}${proposal.targetPath}`
      : `SEO: Add internal link from ${proposal.sourcePath} to ${proposal.targetPath}`;

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
