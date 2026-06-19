# SEO on-site audit — smart-edu.ai
**Date:** 2026-05-25
**Profile:** D — SaaS landing/app (44 pages, 33 indexed, EN+PL, conversion-focused tool product)
**Stack:** Astro 4 SSG (`output: "static"`) + React islands + Fastify backend on PM2 + nginx; build artefacts served from `frontend-astro/dist`
**Repo↔prod state:** in-sync — `git status` clean, last commit `69e41b3` 2026-05-25 11:55 +02:00, live `Last-Modified: Mon, 25 May 2026 09:55:49 GMT` (same build).
**Last crawl:** 2026-05-25T03:31 | **GSC:** 2026-05-25T06:00 | **GA4:** 2026-05-25T08:00 ACTIVE
**Pages:** 44 tracked, 33 `Submitted and indexed`, 2 `Crawled — not indexed`, 9 `URL unknown to Google` | **DA:** 8 | **GSC last pull:** 15 clicks / 208 impressions

---

## P0 — Critical (fix this week)

### [LIVE] 5 example-category URLs in `sitemap-examples.xml` return 404
**Where:** `backend/src/routes/sitemap.ts:86-99` (sitemap generator) ↔ build-time `getStaticPaths` in `frontend-astro/src/pages/examples/[category]/index.astro` and `pl/examples/[category]/index.astro`.

**Evidence (live, ran 2026-05-25 12:13):**
```
404  https://www.smart-edu.ai/examples/licencjacka
200  https://www.smart-edu.ai/pl/examples/licencjacka
404  https://www.smart-edu.ai/examples/magisterska
200  https://www.smart-edu.ai/pl/examples/magisterska
404  https://www.smart-edu.ai/examples/administracja
200  https://www.smart-edu.ai/pl/examples/administracja
200  https://www.smart-edu.ai/examples/bezpieczenstwo-narodowe
404  https://www.smart-edu.ai/pl/examples/bezpieczenstwo-narodowe
404  https://www.smart-edu.ai/examples/budownictwo
200  https://www.smart-edu.ai/pl/examples/budownictwo
```
Confirmed root cause: API `/api/sample-works?locale=en` returns **1** published work (only `bezpieczenstwo-narodowe`); `?locale=pl` returns **11** across `licencjacka(8)/administracja/budownictwo/magisterska`. The sitemap generator (`sitemap.ts:86-99`) takes the **union** of all categories regardless of locale and emits BOTH `/examples/{cat}` and `/pl/examples/{cat}` URLs:
```ts
const categories = [...new Set(works.map((w) => w.category))]; // all locales
const catUrls = categories.flatMap((cat) => [
  `/examples/${cat}`,        // 404 if no EN work with that cat
  `/pl/examples/${cat}`,     // 404 if no PL work with that cat
]);
```
DB (`Page` table) confirms 4 of the 5 are already `indexingVerdict=PASS, coverageState='Submitted and indexed'` — Google has indexed 404 responses, which is a soft-404 risk and will degrade sitemap trust.

**Impact:** Sitemap noise teaches Google "this sitemap contains broken URLs" → reduced crawl priority for the legitimately-indexable pages. Five soft-404s is small but for a 22-URL sitemap it's >20% noise.

**Fix:** Edit `backend/src/routes/sitemap.ts` so category URLs are emitted per-locale only when at least one work in that locale uses the category. Replace lines 86-100 with:
```ts
const enCats = [...new Set(works.filter(w => w.locale === "en").map(w => w.category))];
const plCats = [...new Set(works.filter(w => w.locale === "pl").map(w => w.category))];
const catUrls = [
  ...enCats.map(cat => `  <url>
    <loc>${SITE_URL}/examples/${cat}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`),
  ...plCats.map(cat => `  <url>
    <loc>${SITE_URL}/pl/examples/${cat}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`),
].join("\n");
```
Then `pm2 reload smart-edu-backend`. Sitemap will drop from 22 to 17 URLs immediately and the 5 soft-404s will fall out of GSC index over the next 2-4 weeks.

---

### [LIVE] 7 blog posts not in any sitemap — entire `/blog/*` corpus invisible to Google via sitemap
**Where:** `backend/src/routes/sitemap.ts` registers only `/sitemap-static.xml` + `/sitemap-examples.xml` (lines 42-49); no blog route. Blog posts live in `frontend-astro/src/content/blog/*.md` (Astro Content Collection) and render under `/blog/[slug]` (EN) and `/pl/blog/[slug]` (PL).

**Evidence:**
- `sitemap_index.xml` lists 2 sitemaps; neither contains `/blog/`:
  ```
  curl https://www.smart-edu.ai/sitemap-static.xml | grep blog  → 0 matches
  curl https://www.smart-edu.ai/sitemap-examples.xml | grep blog → 0 matches
  ```
- `/sitemap-blog.xml` → HTTP 404
- `/sitemap-pl-blog.xml` → HTTP 404
- 7 PL blog posts on disk (`src/content/blog/*.md` filenames):
  `antyplagiat-praca-dyplomowa, argumentative-essay-structure-2026, bibliografia-praca-dyplomowa, ile-stron-praca-licencjacka, jak-napisac-prace-licencjacka, jak-napisac-rozprawke, jak-uzywac-ai-praca-licencjacka`
- All return live 200, e.g. `/pl/blog/jak-napisac-prace-licencjacka` → 200 (46 604 bytes)
- `/blog` index lists `/blog/argumentative-essay-structure-2026` so there is at least 1 EN post live
- Even the blog index pages themselves (`/blog`, `/pl/blog`) are NOT in `sitemap-static.xml` (which only has the 11 marketing/tool pages × 2 locales = 22 URLs)

**Impact:** All blog content is discovered only via internal links from the blog index. For a low-DA (DA=8) site with 15 clicks/28 d, every additional indexable page matters. The blog appears intentional (recent commits `593ec61 blog: Ile stron…`, `e58fed6 blog: Bibliografia…`, etc. — 7 dedicated blog commits in last 2 weeks) so this is "shipped content with no sitemap registration".

**Fix:** Add a third sitemap to `backend/src/routes/sitemap.ts`. Two options:

Option A (simpler, no DB read) — hard-code blog slugs the same way `STATIC_PAGES` does, OR build the list from a manifest the Astro build writes. After edits:
```ts
// In sitemap_index.xml:
<sitemap><loc>${SITE_URL}/sitemap-blog.xml</loc></sitemap>

// New route:
fastify.get("/sitemap-blog.xml", async (req, reply) => {
  const slugs = [
    { slug: "argumentative-essay-structure-2026", locales: ["en", "pl"] },
    { slug: "antyplagiat-praca-dyplomowa",         locales: ["pl"] },
    { slug: "bibliografia-praca-dyplomowa",        locales: ["pl"] },
    { slug: "ile-stron-praca-licencjacka",         locales: ["pl"] },
    { slug: "jak-napisac-prace-licencjacka",       locales: ["pl"] },
    { slug: "jak-napisac-rozprawke",               locales: ["pl"] },
    { slug: "jak-uzywac-ai-praca-licencjacka",     locales: ["pl"] },
  ];
  const urls = slugs.flatMap(s => s.locales.map(loc => `  <url>
    <loc>${SITE_URL}${loc === "pl" ? "/pl" : ""}/blog/${s.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`)).join("\n");
  reply.header("Content-Type", "application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
});
```
Also add `/blog`, `/pl/blog` (the index pages) to `STATIC_PAGES` at `sitemap.ts:8-39`:
```ts
{ path: "/blog",    priority: "0.8", changefreq: "weekly" },
{ path: "/pl/blog", priority: "0.8", changefreq: "weekly" },
```

Option B (more robust) — have the Astro build emit `dist/blog-manifest.json` and have Fastify read it. Out of scope for this audit; Option A unblocks indexing today.

After deploy, "Request indexing" in GSC for the 7+8 URLs. GSC limit ~10/day per property → spread over 2 days.

---

### [LIVE] Mobile LCP 4.0-5.2 s on every page tested — fails Core Web Vitals "Good" threshold (2.5 s)
**Where:** PSI mobile run 2026-05-25 12:15, API key from `.env`.

**Evidence:**
| URL | Perf | LCP | FCP | TBT | CLS |
|---|---|---|---|---|---|
| `/` (EN home) | 0.78 | **5175 ms** | 1441 ms | 164 ms | 0 |
| `/pl/bachelors-thesis` | 0.82 | **4754 ms** | 915 ms | 91 ms | 0 |
| `/pl/blog/jak-napisac-prace-licencjacka` | 0.87 | **4003 ms** | 970 ms | 66 ms | 0 |

All three exceed the LCP "Needs improvement" boundary (4.0 s) and the home is squarely in "Poor". CLS=0 and TBT<200 ms are fine; FCP is OK; the bottleneck is **what the LCP element is** and how late it shows up. Home is the worst — likely a hero image or large React island that hydrates with `client:load` (see `index.astro:24`: `<HomeWrapper locale={locale} client:load />`).

**Impact:** For Profile D (SaaS landing — conversion-critical), every 1 s of LCP correlates to measurable conversion-rate drop. Google ranks slow pages lower on mobile, especially for commercial-intent queries.

**Fix:** Open PSI for the home, click "Largest Contentful Paint element" → identify the actual element. Likely candidates and remedies:
1. Hero image not preloaded — add `<link rel="preload" as="image" href="/path/to/hero.webp" fetchpriority="high">` in `<head>` of `BaseLayout.astro:25` area.
2. `HomeWrapper client:load` blocking — try `client:idle` or `client:visible` if the hero is rendered server-side (look at `src/components/react/HomeWrapper.tsx`).
3. Web fonts blocking text render — Tailwind config uses default system fonts (`tailwind.config.mjs` doesn't show a custom font import), so probably not the cause; verify in PSI "Reduce unused JavaScript" + "Render-blocking resources" tabs.

Run PSI again after deploy. Re-runs are free; quota allows 25k/day.

---

## P1 — High (fix this sprint)

### [LIVE] `Astro.redirect()` defaults to 302 — should be 301 for missing-slug consolidation
**Where:** `frontend-astro/src/pages/examples/[category]/[slug].astro:28` and `frontend-astro/src/pages/pl/examples/[category]/[slug].astro:27`:
```ts
if (!work) {
  return Astro.redirect("/examples");       // line 28 EN — defaults to 302
}
if (!work) {
  return Astro.redirect("/pl/examples");    // line 27 PL — defaults to 302
}
```

**Evidence:** Astro docs — `Astro.redirect(path)` without 2nd arg returns 302; for permanent consolidation of dead slugs you want 301. Verified pattern (per skill memory): same issue was previously flagged in matury-online.pl. Note: in **static** output (`output: "static"`) `Astro.redirect` only fires during `getStaticPaths` rendering — for genuinely runtime missing slugs the static site simply returns nginx's 404. Still, leaving the code at 302 invites a copy-paste regression when SSR is ever turned on.

**Impact:** Low today (static build means nginx 404 is what's actually served for unknown slugs), but the code is misleading. Also a foot-gun if any team member converts to SSR.

**Fix:** Pass status explicitly:
```ts
return Astro.redirect("/examples", 301);
return Astro.redirect("/pl/examples", 301);
```

---

### [LIVE] `/pl/` (trailing slash) and `/pl` both return 200 with identical content — duplicate URL exposure
**Where:** Live URLs.

**Evidence:**
```
GET /pl   → 200, ETag "6a141ca5-24137", 147767 bytes
GET /pl/  → 200, ETag "6a141ca5-24137", 147767 bytes   (same byte for byte)
```
Same applies to other top-level paths (`/examples` vs `/examples/` both 200). `astro.config.mjs:9` sets `trailingSlash: "never"` — the intent is `/pl` only, but nginx is serving both because Astro's static build produces `/pl/index.html` (directory mode at line 11: `format: "directory"`), and nginx falls back to `try_files $uri/ $uri.html`.

Canonical handling mitigates this: both responses carry `<link rel="canonical" href="https://www.smart-edu.ai/pl">` (verified), so Google should consolidate. Still leaves crawl budget waste and dilutes link signals if anyone links with the slash.

**Impact:** Low-medium. Mainly a Google crawl-efficiency issue + risk that external links use the wrong form.

**Fix:** Add an nginx redirect block in `nginx.conf` (root of repo):
```nginx
# Strip trailing slash from non-root paths (Astro trailingSlash:"never")
rewrite ^/(.+)/$ /$1 permanent;
```
Place this **before** the static `try_files` block. `nginx -t && systemctl reload nginx`. Verify with:
```
curl -sI https://www.smart-edu.ai/pl/ | head -2   # expect 301 Location: /pl
```

---

### [LIVE] 9 URLs in `Page` table show `coverageState='URL is unknown to Google'`
**Where:** `seo_panel` DB — `Page` table for `domainId='cmn9fo4db0001qrdyh34ldxul'`.

**Evidence:**
```
SELECT "indexingVerdict","coverageState",COUNT(*) FROM "Page"
 WHERE "domainId"='cmn9fo4db0001qrdyh34ldxul' GROUP BY 1,2;

 PASS    | Submitted and indexed         | 33
 NEUTRAL | URL is unknown to Google      | 9
 UNKNOWN | NULL                          | 9
 NEUTRAL | Crawled - currently not indexed | 2
```
9 URLs Google has never seen — these are likely the missing example-category 404s + blog posts (overlaps with P0 above). The 2 "Crawled, currently not indexed" deserve manual inspection in GSC URL Inspector — those are pages Google chose NOT to index.

**Impact:** Direct: 9/44 pages (20%) are invisible. Indirect: fixes for P0 #1 + #2 (sitemap blog, category 404s) will resolve most.

**Fix:** After deploying the P0 fixes, in GSC submit re-indexing for the corrected URLs (the now-200 blog posts + the still-valid /pl/examples/bezpieczenstwo-narodowe etc.). For the 2 "Crawled, not indexed" — open GSC URL Inspector to see Google's verdict; often it's thin-content. Identify which URLs they are with:
```sql
SELECT url, "lastChecked" FROM "Page"
 WHERE "domainId"='cmn9fo4db0001qrdyh34ldxul'
   AND "coverageState"='Crawled - currently not indexed';
```

---

### [CONTENT] EN tool pages rank 30-50+ vs PL equivalents at 4-9 — content asymmetry
**Where:** `seo_panel.Page` top-impressions slice.

**Evidence (GSC last pull, position is GSC avg position):**
| URL | impressions | position |
|---|---|---|
| `/pl/composition` | 20 | **4.55** |
| `/pl/student-writer-report-generator` | 11 | **7.09** |
| `/pl/ai-paper-writer` | 9 | **9.78** |
| `/pl/bachelors-thesis` | 6 | **5.17** |
| `/argumentation-essay` (EN) | 16 | **52.31** |
| `/student-writer-report-generator` (EN) | 9 | **32.33** |
| `/composition` (EN) | 2 | 4.5 (tiny sample) |

EN pages have similar HTML structure, similar JSON-LD (FAQPage validated), but rank an order of magnitude lower. Likely causes (not directly verified — confidence: medium):
1. EN market is far more competitive (Grammarly, EssayBot, ChatGPT plus countless paper-mills) — your SEO note in `src/components/SEO.astro:39-43` already acknowledges this.
2. EN content corpus is thinner: only **1 EN sample work** in DB (`bezpieczenstwo-narodowe`) vs **11 PL**. Google likely views the EN side as content-poor.
3. EN blog has **1** published post vs PL **6+**.

**Impact:** EN side is currently leaving most of its theoretical impressions on the table. With current numbers (~26 EN impressions on 5 indexable tool pages) the absolute upside in clicks is small (~1-3/wk on rank improvement), but content debt compounds.

**Fix:** Editorial. Two concrete moves:
1. Translate/adapt 3-4 of the top-performing PL blog posts to EN (`jak-napisac-prace-licencjacka` → `how-to-write-bachelor-thesis`, etc.). Each post is a chance to rank for a long-tail term and to add internal links to the EN tool pages.
2. Add at least 3-5 EN sample works under different categories so `/examples` (EN) becomes a real corpus and the `[category]` index pages stop being mostly empty.

This is `[CONTENT]`, not a code bug — schedule with editorial team, not engineering.

---

## P2 — Medium (fix when capacity allows)

### [LIVE] `sitemap-examples.xml` uses `createdAt` for `<lastmod>` instead of `updatedAt`
**Where:** `backend/src/routes/sitemap.ts:78`:
```ts
<lastmod>${w.createdAt.toISOString()}</lastmod>
```
**Evidence:** The Prisma select at line 70 doesn't even fetch `updatedAt`. When sample works are edited (typos, content updates), Google has no signal to recrawl.
**Fix:** Change select to `{ slug, locale, category, createdAt, updatedAt }` and emit `${(w.updatedAt ?? w.createdAt).toISOString()}`. Static pages and blog have no `<lastmod>` at all currently — consider deriving from `git log -1 --format=%aI` per file at build time, or omit (Google falls back to crawl history). Not worth adding if no clean source; the example sitemap fix is the higher-value half.

### [CONTENT] EN homepage `<title>` weak — no brand, generic keywords
**Where:** `frontend-astro/src/i18n/en.json` key `HomePage.meta.title`.
**Evidence:** Current value: `"AI Academic Paper Generator & Paper Writer"` (42 chars, fine length, but no brand mention and "Paper Writer" is generic to the point of competing with thousands of templated SEO pages). PL counterpart: `"AI do pisania prac zaliczeniowych - sztuczna inteligencja do zadań"` — also no brand but more specific.
**Fix:** Try one of (test in GSC after change):
- `"Smart-Edu.ai — AI Academic Paper Generator (essays, theses in 5 min)"` (62 chars)
- `"AI Paper Writer — generate essays & theses in 5 minutes | Smart-Edu.ai"` (69 chars — slightly long but Google may still show)
Add brand to the PL title too: `"Smart-Edu.ai — AI do pisania prac zaliczeniowych w 5 minut"` (54 chars).

### [WORKFLOW] Sitemap generator has no integration test catching locale↔category mismatch
**Where:** `backend/src/routes/sitemap.ts` — the bug at P0 #1 is the kind of thing a one-liner test would have prevented.
**Evidence:** No `*.test.ts` next to `sitemap.ts`; `find backend/src -name '*.test.ts' | wc -l` = (run it) — likely 0 or near-zero.
**Fix (when implementing P0 #1):** Add `backend/src/routes/sitemap.test.ts` that calls the route with seeded data and asserts:
- every `<loc>` in EN section corresponds to a published EN work's category
- same for PL
- no duplicates
- no `/` in slug
This catches the entire class of bug — soft-404 sitemap entries — going forward.

---

## P3 — Polish (backlog)

### [LIVE] `/pl/examples/coursework` and `/pl/examples/bachelor` get GSC impressions but are 404
**Where:** Live URLs not in sitemap, not linked from `/pl/examples` (verified), but appearing in GSC with 8 + 1 impressions over 28 d (`Page` table `inSitemap=false`).
**Evidence:** Probably leftovers from older internal links or external links from when the 25-category expansion (`ad61afe`) was being planned. They 404 and are not advertised, so impact is minimal.
**Fix:** Either (a) leave 404 — they'll deindex naturally, OR (b) add a 410 Gone response in `nginx.conf` for these specific paths to accelerate removal, OR (c) actually create sample works under those categories.

### [LIVE] PSI-relevant: `client:load` on `HomeWrapper` hydrates the entire React tree eagerly
**Where:** `frontend-astro/src/pages/index.astro:24` and the PL counterpart.
**Evidence:** Inferred from LCP timings + Astro pattern; not directly profiled.
**Fix:** Switch to `client:idle` if the hero render doesn't depend on JS, or `client:visible` if it's below the fold. This is part of the broader P0 #3 LCP fix.

---

## Unverified — needs re-run
- **Image `alt` audit** — not done (homepage HTML is 144 KB, manual count not run). Run with `curl -s https://www.smart-edu.ai/ | grep -oE '<img[^>]*>' | grep -cv 'alt='` and report bare count.
- **Outbound link toxicity** — not relevant for SaaS, deliberately skipped.
- **Internal link graph (L1-L6)** — not done; site only has ~22 marketing URLs + blog + examples, link-graph analysis low value here.
- **Schema.org validator** — JSON-LD shapes verified by `@type` presence and JSON-parseability; not run against [validator.schema.org](https://validator.schema.org) — recommend manual one-time pass on home + 1 blog post.

## Skipped — not applicable to this profile
- Product/Offer schema audit — not e-commerce.
- Faceted-search controls (T-cat in profile C) — N/A.
- Pagination canonical (`rel=prev/next`) — site has no paginated lists yet.
- Out-of-stock handling — N/A.
- Mass orphan-page analysis — 44 pages, link graph trivially small.
- AWS/CloudFront/S3 checks (T21-T23) — site runs PM2+nginx, not S3+CF.

---

## Sequence of recommended actions

**Code edits (engineering, 1-2 h work):**
1. `backend/src/routes/sitemap.ts` — fix locale-aware category emission (P0 #1).
2. `backend/src/routes/sitemap.ts` — add `/sitemap-blog.xml` route + register in index + add `/blog`+`/pl/blog` to `STATIC_PAGES` (P0 #2).
3. `backend/src/routes/sitemap.ts` — also bump `<lastmod>` to use `updatedAt` (P2 #1).
4. `frontend-astro/src/pages/examples/[category]/[slug].astro:28` + PL counterpart — add `, 301` to `Astro.redirect` (P1 #1).
5. `nginx.conf` — add `rewrite ^/(.+)/$ /$1 permanent;` (P1 #2).
6. `frontend-astro/src/pages/index.astro:24` + PL — try `client:idle` on `HomeWrapper`, then PSI-check (P0 #3 + P3 #2).
7. `BaseLayout.astro` — `<link rel="preload" as="image" fetchpriority="high">` for the LCP element after identifying it in PSI (P0 #3).

**Deploy:**
8. `git add backend/src/routes/sitemap.ts nginx.conf frontend-astro/src/pages/`; commit; `./deploy.sh`.
9. `sudo nginx -t && sudo systemctl reload nginx` (or whatever the deploy script does).
10. `pm2 reload smart-edu-backend` (already done by deploy script if so configured).

**GSC operations (manual, time-spread):**
11. Re-submit the corrected category URLs + blog posts via "Request indexing" — **GSC limit ~10/day**; rotate over 2 days (15 URLs total).
12. In GSC URL Inspector, open the 2 "Crawled, currently not indexed" pages and read Google's reason — often "duplicate, alternate page", which means hreflang/canonical mismatch.

**Editorial (separate track):**
13. Translate top 3 PL blog posts to EN.
14. Add 3-5 EN sample works under `licencjacka` / `magisterska` / `administracja`.

**Re-audit after fixes:** in 14-21 days re-run this skill; expected deltas — 5 soft-404s gone from sitemap, 7-15 blog URLs indexed, LCP improvement visible in PSI (hopefully <2.5 s on at least one of the three pages).

---

## Appendix A — soft-404 sitemap URLs (full table)
| URL | sitemap | live HTTP | indexingVerdict | inSitemap |
|---|---|---|---|---|
| https://www.smart-edu.ai/examples/licencjacka | yes | 404 | PASS (indexed-as-404) | true |
| https://www.smart-edu.ai/examples/magisterska | yes | 404 | PASS | true |
| https://www.smart-edu.ai/examples/administracja | yes | 404 | PASS | true |
| https://www.smart-edu.ai/examples/budownictwo | yes | 404 | unknown | n/a |
| https://www.smart-edu.ai/pl/examples/bezpieczenstwo-narodowe | yes | 404 | unknown | n/a |

## Appendix B — verification commands used (reproducible)

```bash
# Drift / repo state
git status --short
git log -1 --format=%ai

# Sitemap parse
curl -s -A "Mozilla/5.0" https://www.smart-edu.ai/sitemap_index.xml
curl -s -A "Mozilla/5.0" https://www.smart-edu.ai/sitemap-static.xml | grep -oE '<loc>[^<]+</loc>' | wc -l
curl -s -A "Mozilla/5.0" https://www.smart-edu.ai/sitemap-examples.xml | grep -oE '<loc>[^<]+</loc>'

# Per-category live status sweep
for url in $(curl -s https://www.smart-edu.ai/sitemap-examples.xml | grep -oE 'https://www.smart-edu.ai/(pl/)?examples/[a-z-]+'); do
  echo "$(curl -sI -A "Mozilla/5.0" "$url" | head -1 | grep -oE '[0-9]{3}')  $url"
done

# Sitemap-blog probe
curl -sI https://www.smart-edu.ai/sitemap-blog.xml | head -1

# API-side reality check
curl -s "https://www.smart-edu.ai/api/sample-works?locale=en" | python -c "import sys,json; print(len(json.load(sys.stdin)['data']))"
curl -s "https://www.smart-edu.ai/api/sample-works?locale=pl" | python -c "import sys,json; print(len(json.load(sys.stdin)['data']))"

# Trailing-slash duplicate
curl -sI https://www.smart-edu.ai/pl   | grep -i 'http\|etag\|content-length'
curl -sI https://www.smart-edu.ai/pl/  | grep -i 'http\|etag\|content-length'

# PSI (key in .env, never printed)
PSI_API_KEY=$(grep "^PSI_API_KEY=" ~/.claude/skills/seo-audit-onsite/.env | cut -d= -f2- | tr -d '\r\n')
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fwww.smart-edu.ai%2F&strategy=mobile&category=performance&category=seo&key=$PSI_API_KEY"

# DB (prod, via MCP)
mcp__claude_ai_mcp_torweb_pl__postgres_query host=panel db=seo_panel \
  query='SELECT "indexingVerdict","coverageState",COUNT(*) FROM "Page" WHERE "domainId"='"'"'cmn9fo4db0001qrdyh34ldxul'"'"' GROUP BY 1,2'
```
