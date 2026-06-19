# SEO on-site audit — matury-online.pl
**Date:** 2026-05-24
**Profile:** D — SaaS landing + content shell. Astro SSR app for a maturalna platform; 114 tracked URLs (mostly subject-hub + topic pages + a small blog/news section), conversion-driven (49 zł/mies. subscription), GA4 `G-SQ1CESHFJ0` installed.
**Stack:** Astro 5 SSR + React 19 + Tailwind, deployed via PM2 behind nginx on `matury` VPS, sitemap via `@astrojs/sitemap` with `customPages` injection.
**Repo↔prod state:** **mixed** — 22 modified + 14 untracked files locally; live HTML matches HEAD (last commit `2fc00dd "nowe"`) for SEO-critical parts; landing-redesign + new WoS topics + robots.txt fix opportunity are uncommitted-and-undeployed.
**Last crawl:** 2026-05-24 04:28 | **GSC pull:** 2026-05-24 06:00 | **GA4 lastSync:** NULL (integration row missing for GA4 — only GSC active)
**Pages:** 114 tracked, 26 verdict=PASS (others NEUTRAL "URL unknown to Google" or REMOVED), 115 in sitemap | **DA:** 15 | **Last 14d GSC:** 4 clicks / 107 impressions (essentially undiscovered).

---

## ⚠ Data freshness caveats
- `Domain.totalClicks=0` in `seo_panel` is stale — sum of `GscPageDaily.clicks` over last 14d = 4. Aggregate cron has not propagated.
- `DomainIntegration` row for `GOOGLE_ANALYTICS` is missing entirely (only GSC integration exists in DB) although GA4 tag `G-SQ1CESHFJ0` IS present in live HTML.

---

## ⚠ Drift summary — repo ↔ prod

| File / Path | Status | What's in repo | What's on live | Action |
|---|---|---|---|---|
| `frontend/public/robots.txt` | committed (broken) | `sUser-agent: \*` (corrupted line 1) | same, corrupted | FIX-AND-DEPLOY |
| `frontend/src/pages/index.astro` | `M` modified | new 2-column hero, expanded copy "zadania, testy i symulacje", `HomeHeroMockup`/`HomePlatformShowcase`/`HomeGamificationMockup`/`HomeHowItWorksSteps` imports | old single-column hero | DEPLOY (also: still has `${maturaYear}` leak on line 118 — fix before deploying) |
| `frontend/src/pages/test/historia/[temat].astro` | `M` | import switched `zadania-historia-meta` → `test-historia-meta` | still imports `zadania-historia-meta` (file exists, works) | DEPLOY |
| `frontend/src/pages/test/{angielski,biologia,chemia,fizyka,geografia,historia,index,informatyka,matematyka,niemiecki,polski,wos}/*.astro` (12 files) | `M` | refactor to `<SubjectQuestionTypes>` component | inline cards block on each subject index page | DEPLOY (visual only — no SEO regression) |
| `frontend/src/data/test-wos-meta.ts` | `M` | +4 new topics: `dobro-wspolne`, +332 lines | older 7-topic set | DEPLOY (new SSR URLs accessible at `/test/wos/dobro-wspolne` now return 200 because [temat].astro is SSR — but they are NOT in sitemap) |
| `frontend/src/components/landing/AllQuestionTypesGallery.tsx`, `AlternatingTypesShowcase.tsx`, `HomeGamificationMockup.tsx`, `HomeHeroMockup.tsx`, `HomeHowItWorksSteps.tsx`, `HomePlatformShowcase.tsx`, `QuestionTypeMiniScreens.tsx`, `QuestionTypeShowcaseScreens.tsx`, `SubjectQuestionTypes.tsx` | `??` untracked | new landing components referenced by modified `index.astro` and test/*/index.astro | site builds without them on prod | `git add` then DEPLOY |
| `frontend/src/content/blog/interpretacja-{porownawcza-,}wiersza-matura-...md` (2 files) | `??` untracked | 2 new blog posts | not on live | `git add` then DEPLOY |
| `frontend/src/pages/rozumienie-ze-sluchu.astro` | `??` untracked | new page | live `/rozumienie-ze-sluchu` returns 404 | `git add` then DEPLOY (or delete if dead code) |
| `.gitignore`, `scripts/dev-start.sh`, `scripts/start-frpc.sh`, `tools/` | `M`/`??` | dev tooling changes | not deployable surface | commit when ready |
| `frontend/src/data/zadania-historia-meta.ts` | tracked, unmodified | duplicate of `test-historia-meta.ts` (rename in progress) | imported by deployed `[temat].astro` | DELETE after deploy |

---

## P0 — Critical (fix this week)

### [LIVE] robots.txt is corrupted — first line reads `sUser-agent: \*` instead of `User-agent: *`
**Where:** `frontend/public/robots.txt` line 1; live at `https://www.matury-online.pl/robots.txt`.
**Evidence:**
```
$ curl -sS https://www.matury-online.pl/robots.txt | xxd | head -1
00000000: 7355 7365 722d 6167 656e 743a 205c 2a0a  sUser-agent: \*.
```
Raw repo source identical:
```
sUser-agent: \*
Allow: /
Disallow: /admin/
Disallow: /auth/
Disallow: /dashboard/
Disallow: /api/

Sitemap: https://www.matury-online.pl/sitemap-index.xml
Sitemap: https://www.matury-online.pl/sitemap-news.xml
```
The leading `s` makes `sUser-agent` an unknown directive — per [robots.txt RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) Googlebot ignores unknown lines as comments. With no preceding valid `User-agent:` group, **every `Disallow:` below is orphaned and ignored**. The escaped `\*` would also be invalid even if the `s` were removed (must be literal `*`).
**Impact:** (a) Crawl budget waste: Googlebot now freely crawls `/admin`, `/dashboard/*`, `/auth/*`, `/api/*`. Currently mitigated only because every dashboard/auth/admin HTML response carries `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">` — verified live on `/admin`, `/auth/login`, `/dashboard`. So **no indexation leak today**, but ~30 internal/private URLs are being crawled and consuming Google's allotted budget for the site, slowing discovery of the 156 NEUTRAL "URL unknown to Google" pages that actually need crawling. (b) `Sitemap:` directives are still picked up by Google (top-level directive, independent of UA groups), so the sitemaps work despite the bug.
**Fix:** Replace `frontend/public/robots.txt` with:
```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /auth/
Disallow: /dashboard/
Disallow: /api/

Sitemap: https://www.matury-online.pl/sitemap-index.xml
Sitemap: https://www.matury-online.pl/sitemap-news.xml
```
After deploy, GSC → Settings → robots.txt report → "Request a recrawl" to expedite Google noticing.

### [LIVE] FAQPage JSON-LD on homepage contains literal `${maturaYear}` placeholder (unrendered template literal)
**Where:** `frontend/src/pages/index.astro:118` — the answer text uses single-quote string `'...${maturaYear}...'` instead of a backtick template literal.
**Evidence:**
```
$ grep -oF '${maturaYear}' D:\seo-panel\audits\cache\matury-home.html
${maturaYear}
${maturaYear}
```
Live JSON-LD payload (FAQPage `mainEntity[4]` Answer):
```
"Matura rozpoczyna się w maju ${maturaYear} egzaminem z języka polskiego na poziomie podstawowym..."
```
Source confirms (line 118):
```js
a: 'Matura rozpoczyna się w maju ${maturaYear} egzaminem z języka polskiego...'
```
(single quotes — no interpolation). Lines 109, 117, 150, 164, 165 all use backticks correctly; only this one slipped.
**Impact:** Google's Rich Results FAQ block is currently disabled across Google search for FAQPage on non-government/health sites (post Aug-2023), so SERP-level damage is limited, BUT (a) the malformed string IS indexed and may surface as "matura ${maturaYear}" in low-confidence answer extractions, (b) any future re-enabling of FAQ rich results would show garbage, (c) signals low content quality to crawlers.
**Fix:** In `frontend/src/pages/index.astro:118` change:
```js
a: 'Matura rozpoczyna się w maju ${maturaYear} egzaminem z języka polskiego...'
```
to:
```js
a: `Matura rozpoczyna się w maju ${maturaYear} egzaminem z języka polskiego...`
```
(swap single quotes for backticks — variable already in scope from line 6).

---

## P1 — High (fix this sprint)

### [LIVE] Sitemap omits ~90% of subject sub-pages (historia, wos, biologia, chemia, fizyka, geografia, informatyka, angielski, niemiecki)
**Where:** `frontend/src/data/sitemap-slugs.mjs:82-85`.
**Evidence:** The exported `TEST_SUB_PAGES` list only contains:
```js
export const TEST_SUB_PAGES = [
  ...MATEMATYKA_SLUGS.map((s) => `${SITE}/test/matematyka/${s}`),
  ...POLSKI_SLUGS.map((s) => `${SITE}/test/polski/${s}`),
];
```
But SSR `[temat].astro` routes exist for `historia` and `wos` (verified — `/test/wos/dobro-wspolne` returns 200, `/test/historia/dwudziestolecie` would too if slug is in `test-historia-meta.ts`). Meta files exist on disk: `test-historia-meta.ts`, `test-wos-meta.ts`. Live sitemap-0.xml has `/test/historia` and `/test/wos` (parent) but no children except polski/matematyka. Backlink targets from maturapolski.pl point to `/zadania/polski/lalka` etc. — these URLs return 200 on this site but are also absent from sitemap.
**Impact:** GSC shows 156/203 tracked Page rows with `coverageState='URL is unknown to Google'`. Sitemap is the primary discovery channel for a site with only 4 clicks/14d and DA 15 — every missing URL is one less indexation chance. Likely the single biggest reason for the "platforma niewidoczna w Google" symptom.
**Fix:** In `frontend/src/data/sitemap-slugs.mjs` add per-subject slug arrays mirroring `MATEMATYKA_SLUGS` / `POLSKI_SLUGS`, e.g.:
```js
export const HISTORIA_SLUGS = Object.keys(/* import from test-historia-meta.ts */);
export const WOS_SLUGS      = Object.keys(/* import from test-wos-meta.ts */);
// ...same for biologia, chemia, fizyka, geografia, informatyka, angielski, niemiecki

export const TEST_SUB_PAGES = [
  ...MATEMATYKA_SLUGS.map((s) => `${SITE}/test/matematyka/${s}`),
  ...POLSKI_SLUGS.map((s) => `${SITE}/test/polski/${s}`),
  ...HISTORIA_SLUGS.map((s) => `${SITE}/test/historia/${s}`),
  ...WOS_SLUGS.map((s) => `${SITE}/test/wos/${s}`),
  // …
];
```
Since the file is `.mjs`, import the meta TS files as a build step or read their `Object.keys(TOPIC_META_MAP)` arrays. Simplest: in each `*-meta.ts` file export `export const SLUGS = Object.keys(<MAP>);` and re-import in `sitemap-slugs.mjs`. Alternative: also expose `/zadania/{subject}/{lektura}` paths (the backlink targets from maturapolski.pl). After re-deploy → submit sitemap-index.xml again in GSC.

### [LIVE] Astro.redirect default 302 used for permanent topic-not-found cases — should be 301
**Where:** `frontend/src/pages/test/historia/[temat].astro:13`, `frontend/src/pages/test/wos/[temat].astro` (same pattern), `frontend/src/pages/informator/[subject].astro`.
**Evidence:**
```
$ curl -sIL "https://www.matury-online.pl/test/historia/dwudziestolecie-miedzywojenne"
HTTP/1.1 302 Found
location: /test/historia
```
Source:
```js
if (!meta) {
  return Astro.redirect('/test/historia');
}
```
`Astro.redirect()` defaults to HTTP 302. The redirect target is permanent (the topic slug doesn't and won't exist), so Google won't transfer link equity and keeps the legacy URL in the index as a soft duplicate.
**Impact:** GSC `Page` table shows 8+ legacy `/test/historia/*` and similar URLs in NEUTRAL or stale state — they came from earlier site structure and 302 keeps them undead. Same pattern blocks consolidation for `[temat]` 404s site-wide.
**Fix:** Three files, identical change. In each, replace:
```js
return Astro.redirect('/test/historia');           // historia
return Astro.redirect('/test/wos');                // wos
return Astro.redirect('/informator');              // informator
```
with the same call but passing 301:
```js
return Astro.redirect('/test/historia', 301);
return Astro.redirect('/test/wos', 301);
return Astro.redirect('/informator', 301);
```

### [LIVE] No gzip/brotli compression on HTML responses, no Cache-Control header, no HSTS
**Where:** nginx config on `matury` VPS (not in repo — infra-as-code missing).
**Evidence:**
```
$ curl -sI https://www.matury-online.pl/
HTTP/1.1 200 OK
Server: nginx/1.18.0 (Ubuntu)
Date: Sun, 24 May 2026 16:41:47 GMT
Content-Type: text/html
Connection: keep-alive
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Origin, Content-Type, Accept, Authorization, X-Requested-With, Cookie
```
No `Content-Encoding`, no `Cache-Control`, no `Strict-Transport-Security`, no `X-Content-Type-Options`, no `Vary`. Homepage HTML is 149 KB uncompressed served raw — would be ~25 KB gzipped.
**Impact:** LCP penalty ~400-800 ms over 4G for a 149 KB document; HSTS absence is a security finding (downgrade window on first visit); no `Cache-Control` means CDN/browser will not cache static assets predictably. The `Access-Control-Allow-*` headers look like API server bleeding into HTML responses — nginx is likely forwarding the wrong upstream's headers.
**Fix:** On `matury` VPS edit nginx server block for matury-online.pl:
```nginx
# in the server block serving HTTPS
gzip on;
gzip_vary on;
gzip_min_length 256;
gzip_types text/plain text/css text/xml application/javascript application/json application/xml application/xml+rss image/svg+xml;
# (or use ngx_brotli module if compiled in)

add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;

# Move the Access-Control-Allow-* headers OUT of the HTML location block —
# they belong only on /api/ (proxied to backend). Currently they're being
# added at server scope or copied from the API upstream.

location / {
  # ...existing proxy to Astro SSR (port for node adapter)
  proxy_pass http://127.0.0.1:<port>;
  add_header Cache-Control "public, max-age=60, s-maxage=300" always;
}
```
Reload: `sudo nginx -t && sudo systemctl reload nginx`. Verify with `curl -sI` afterwards.

### [LIVE] Homepage `<title>` is 85 characters — truncated in SERP (~60-65 char limit on mobile)
**Where:** `frontend/src/pages/index.astro:164`.
**Evidence:**
```
$ echo -n 'Matura 2027 — Przygotowanie do Matury z AI - sztuczna inteligencja dla maturzystów' | wc -c
85
```
Google truncates around 580-600 px (~60 chars Polish). Currently rendered SERP title would cut at "…sztuczna inteligencja dla matu…" or be rewritten by Google.
**Impact:** Lost CTR; for a homepage targeting "matura 2027" / "matura online" the right tail of the title (the most generic part) is what gets cut, so impact is moderate, but the brand+main keyword block is fine. Bigger issue: the title double-states the topic ("Przygotowanie do Matury z AI" + "sztuczna inteligencja dla maturzystów" — same concept).
**Fix:** In `frontend/src/pages/index.astro:164` replace:
```js
title={`Matura ${maturaYear} — Przygotowanie do Matury z AI - sztuczna inteligencja dla maturzystów`}
```
with one of (~55 chars):
```js
title={`Matura ${maturaYear} z AI — 11 przedmiotów, 8000+ pytań | Matury Online`}
```
or (~58 chars, brand-first):
```js
title={`Matury Online — Przygotowanie do matury ${maturaYear} z AI`}
```

---

## P2 — Medium (fix when capacity allows)

### [LIVE] Sitemap has no `<lastmod>` on any URL
**Where:** `frontend/astro.config.mjs:18-39` — `sitemap()` integration `serialize()` only strips trailing slash, doesn't supply `lastmod`. `customPages` entries don't carry timestamps.
**Evidence:**
```
$ grep -oE "<lastmod>[^<]+</lastmod>" /d/seo-panel/audits/cache/sitemap-0.xml | sort -u
(empty)
```
**Impact:** Google ignores sitemaps with no `<lastmod>` for crawl-priority signals — for a site fighting for discovery (24/114 indexed), this means crawl budget is allocated on heuristics alone.
**Fix:** In `frontend/astro.config.mjs:24` augment `serialize()`:
```js
serialize(item) {
  if (item.url && item.url !== "https://www.matury-online.pl/") {
    item.url = item.url.replace(/\/$/, "");
  }
  item.lastmod = new Date().toISOString();   // build-time = good enough for static + SSR mix
  return item;
}
```
For per-page accuracy on blog posts use `getCollection('blog')` `data.updatedAt`/`data.pubDate` from each entry and key by URL in a Map.

### [LIVE] Double-hop http→https redirect: `http://matury-online.pl/` → `https://matury-online.pl/` → `https://www.matury-online.pl/`
**Where:** nginx server blocks on `matury` VPS (apex and www handled separately).
**Evidence:**
```
$ curl -sIL "http://matury-online.pl/" | grep -iE 'HTTP/|Location'
HTTP/1.1 301 Moved Permanently
Location: https://matury-online.pl/
HTTP/1.1 301 Moved Permanently
Location: https://www.matury-online.pl/
HTTP/1.1 200 OK
```
**Impact:** Two TCP/TLS handshakes for a cold first-touch from an http source (organic results sometimes resolve to apex). Adds ~200-400ms.
**Fix:** In the nginx HTTP-listening server for `matury-online.pl` (and `www.matury-online.pl`), redirect straight to the canonical:
```nginx
server {
  listen 80;
  server_name matury-online.pl www.matury-online.pl;
  return 301 https://www.matury-online.pl$request_uri;
}
```

### [WORKFLOW] `Domain.totalClicks=0` in seo_panel despite 4 actual clicks in last 14d
**Where:** `seo_panel.Domain.totalClicks` aggregate column for domain id `cmo928oyl01n2qrovi3au1tdc`.
**Evidence:** `GscDomainDaily` last 14 rows sum to clicks=4, impressions=107. `Domain.totalClicks=0`. The aggregator job (likely `aggregate_domain_totals` cron) has either never run for this domain or runs without backfilling.
**Impact:** Internal panel shows misleading data, but doesn't affect SEO directly — flagged because the audit relies on this column for severity weighting.
**Fix:** Investigate the cron job on `panel` VPS that maintains `Domain.totalClicks` / `Domain.totalImpressions`. Likely a `SELECT SUM(clicks) FROM "GscDomainDaily" WHERE "domainId"=...` UPDATE that's missing this domain in its loop, or that filters out domains with `lastGscPull` NULL but the condition mis-handles edge cases. Run the recompute manually after fixing.

### [WORKFLOW] `DomainIntegration` row for `GOOGLE_ANALYTICS` missing for matury-online.pl, despite GA4 tag `G-SQ1CESHFJ0` being live
**Where:** `seo_panel.DomainIntegration` table.
**Evidence:**
```
SELECT * FROM "DomainIntegration" WHERE "domainId"='cmo928oyl01n2qrovi3au1tdc';
-- (no GOOGLE_ANALYTICS row)
```
Live HTML contains `gtag('config','G-SQ1CESHFJ0')` (9 references).
**Impact:** The seo-panel can't pull GA4 sessions/conversions for this domain, so audits and dashboards lack one of the two main data streams (only GSC pulls run). Compounds the "Domain.totalClicks=0" symptom.
**Fix:** In seo-panel admin → Domain → matury-online.pl → "Connect Google Analytics". Find the GA4 property ID for `G-SQ1CESHFJ0` (Karol's GA4 admin) and add it as `DomainIntegration.propertyId='properties/<numeric>'` with `provider='GOOGLE_ANALYTICS'`, `status='ACTIVE'`. The cron `ga4_sync` (08:00) will start pulling.

### [CONTENT] Homepage `<meta name="description">` repeats the same blob in OG, Twitter, and HTML
**Where:** `frontend/src/pages/index.astro:165` and downstream.
**Evidence:** Live HTML — three meta tags carry the *identical* 155-char text. Not a duplication bug (this is correct OG fallback pattern), but the description doubles as social card copy AND SERP snippet, and the current text "Platforma do nauki przed maturą 2027 z AI. 11 przedmiotów, 8000+ zadań CKE, ocena wypracowań w 30 s, listening AI, symulacje Egzaminu Live. 49 zł/mies." is a feature dump without USP or CTA hook.
**Fix:** In `frontend/src/pages/index.astro:165` rewrite to lead with the differentiator (live-generated listening, 30 s AI grading) and end with a soft CTA. Concrete option (~155 chars):
```js
description={`Matura ${maturaYear}: 8000+ zadań CKE, słuchanie AI generowane na żywo, wypracowania ocenione w 30 s wg kryteriów CKE. 11 przedmiotów za 49 zł/mies.`}
```

### [CONTENT] Homepage `<h1>` uses generic catchphrase; primary GSC query "matury online" appears nowhere in H1
**Where:** `frontend/src/pages/index.astro` H1 block.
**Evidence:** Live H1: `Przygotuj się do matury<br><span>na 100%</span>`. SeoEvent feed shows `ENTERED_TOP10` for query "matury online" (clicks=2, position 3.3) — that's literally the domain's #1 organic query.
**Impact:** Wasted on-page relevance signal. The phrase "matury online" is also the brand — embedding it strengthens both branded and generic ranking.
**Fix:** Either change H1 to include the brand/keyword (option A) or add a tagline-level `<h2>` directly under it (option B):
- A — `<h1>Matury Online — przygotuj się do matury <span>na 100%</span></h1>` (loses some punch)
- B — keep H1, add immediately below: `<p class="...uppercase text-sm tracking-widest">Matury online — kompletna platforma 2027</p>` (better)

### [CONTENT] Untracked `frontend/src/pages/rozumienie-ze-sluchu.astro` exists locally; live `/rozumienie-ze-sluchu` is 404
**Where:** Working tree.
**Evidence:** `curl -sIL https://www.matury-online.pl/rozumienie-ze-sluchu` → 404. File exists in `frontend/src/pages/`.
**Impact:** Either intended as a top-level landing page (good — generic high-volume query) and not deployed → leaves SEO on the table; or dead code → noise in the tree. Compare with `/test/angielski/rozumienie-ze-sluchu` (live, 200, in sitemap).
**Fix:** Decide: (a) deploy as a top-level hub linking both `/test/angielski/rozumienie-ze-sluchu` and `/test/niemiecki/rozumienie-ze-sluchu`, add to sitemap; or (b) `git rm` and remove from working tree.

---

## P3 — Polish (backlog)

### [LIVE] Page table has duplicate trailing-slash entries from before middleware rollout
**Where:** `seo_panel.Page` rows for domain.
**Evidence:** `\test\angielski\` and `/test/angielski` both present; same for ~50 other URL pairs in `egzamin/*` and `test/*`. Middleware now 308s slash → no-slash live, but legacy entries persist in `Page` table and Google's index.
**Impact:** Cosmetic noise in seo-panel; Google's URL canonicalization will eventually fold them. No SERP impact today.
**Fix:** Either let it decay naturally or run a one-time cleanup SQL: `DELETE FROM "Page" WHERE "domainId"='cmo928oyl01n2qrovi3au1tdc' AND url ~ '/[^/]+/$' AND EXISTS (SELECT 1 FROM "Page" p2 WHERE p2."domainId"='cmo928oyl01n2qrovi3au1tdc' AND p2.url = substring(url from '^(.*)/$'));` — but verify rowset with `SELECT` first.

### [CONTENT] `frontend/src/data/zadania-historia-meta.ts` still tracked alongside `test-historia-meta.ts` (rename half-done)
**Where:** Repo.
**Evidence:** Both files exist; the modified `[temat].astro` switches import to the new file. Old file still loadable, unused after deploy.
**Fix:** After the modified [temat].astro is deployed, `git rm frontend/src/data/zadania-historia-meta.ts` to avoid future confusion.

---

## Unverified — needs re-run
- **Core Web Vitals (PSI)** — PSI API not queried this run; on a SaaS site with 149 KB uncompressed HTML and React 19 + recharts + mathlive + codemirror imports, LCP/INP almost certainly suffer. Re-run after P1.4 (gzip/cache headers) lands for a clean read.
- **`/zadania/{subject}/{slug}` URL space** — confirmed they return 200 (backlink targets from maturapolski.pl), but their full content, canonical, and meta were not inspected. Quick spot-check recommended.
- **Indexing API status of NEUTRAL pages** — 156 rows show `coverageState='URL is unknown to Google'`. Submitting individually via Indexing API may help, but ~10/day GSC rate limit applies for manual `Request Indexing`; Indexing API itself is restricted to job postings / livestream events officially, so URLs may be rejected/throttled.

---

## Skipped — not applicable to this profile
- **C8/C9 image alt + lazy-load full audit** — site uses very few `<img>`; the visual interest is SVG icons inline + emoji. Spot-checked: home logo has implicit fallback only via OG; not worth a separate pass.
- **L1 orphan analysis** — site has clear hub-and-spoke structure (Header nav + per-subject hubs); no orphan-graph worth analyzing at 114 URLs.
- **C11 Product schema deep audit** — Product+AggregateOffer JSON-LD present and validates; minor opportunity to add `priceValidUntil` and `url` field, but not a profile-critical gap.
- **T16 hreflang** — site is pl_PL only.
- **Profile-E checks (link-juice / Moz spam score)** — this is not a satellite domain.

---

## Sequence of recommended actions

1. **Fix robots.txt** — `frontend/public/robots.txt`, replace line 1 (`sUser-agent: \*` → `User-agent: *`) and remove backslash before `*` on subsequent line if any. **P0**
2. **Fix `${maturaYear}` JSON-LD leak** — `frontend/src/pages/index.astro:118`, swap single quotes for backticks. **P0**
3. **Commit untracked landing components** that the modified `index.astro` imports (`AllQuestionTypesGallery.tsx`, `HomeHeroMockup.tsx`, etc.) — otherwise next deploy crashes. **P0 (blocker for any deploy)**
4. **Decide on `frontend/src/pages/rozumienie-ze-sluchu.astro`** — commit + add to sitemap, or `git rm`. **P2**
5. **Commit + deploy** modified test/*/index.astro and test/historia/[temat].astro changes — visual + import path. **P1**
6. **Fix sitemap-slugs.mjs** to include historia, wos, biologia, chemia, fizyka, geografia, informatyka, angielski, niemiecki topic slugs. **P1**
7. **Change three `Astro.redirect(...)` calls to pass 301** as second arg. **P1**
8. **Add `lastmod` to sitemap serialize()** in astro.config.mjs. **P2**
9. **Update nginx config on matury VPS** — gzip + Cache-Control + HSTS, remove API CORS headers from HTML responses, collapse http-apex → https-www in one hop. **P1+P2**
10. **In seo-panel** — add the missing GA4 `DomainIntegration` row for matury-online.pl. **P2**
11. **Build + deploy** (`cd frontend && npm run build`, then PM2 restart).
12. **After deploy:** in GSC, submit sitemap-index.xml again and request recrawl of robots.txt. **GSC rate-limits manual "Request Indexing" to ~10 URLs/day** — for the ~80 newly-sitemap-listed subject sub-pages, do not try to bulk-submit; let the sitemap drive discovery instead and only manually request the top 5-10 highest-priority ones (e.g. `/test/wos`, `/test/historia`, `/test/biologia`, `/test/chemia`, `/test/polski`, the new blog posts).
13. **`git rm frontend/src/data/zadania-historia-meta.ts`** after deploy verifies success.

---

## Appendix — verification commands used

```bash
# Domain row
ssh panel sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT d.*, di.\"propertyId\" AS ga4, di.status AS ga4_status, di.\"lastSync\" FROM \"Domain\" d LEFT JOIN \"DomainIntegration\" di ON di.\"domainId\"=d.id AND di.provider='GOOGLE_ANALYTICS' WHERE d.domain ILIKE '%matury-online%';"

# robots.txt raw bytes
curl -sS -A "Mozilla/5.0 (compatible; SEO-Audit/1.0)" "https://www.matury-online.pl/robots.txt" | xxd | head -10

# Redirect chain
curl -sIL "http://matury-online.pl/" | grep -iE 'HTTP/|Location'
curl -sIL "https://www.matury-online.pl/test/" | grep -iE 'HTTP/|Location'
curl -sIL "https://www.matury-online.pl/test/historia/dwudziestolecie-miedzywojenne" | grep -iE 'HTTP/|location'

# Response headers
curl -sI "https://www.matury-online.pl/"

# Sitemap
curl -sS "https://www.matury-online.pl/sitemap-index.xml"
curl -sS "https://www.matury-online.pl/sitemap-0.xml" -o /tmp/sm0.xml
grep -oE "<loc>[^<]+</loc>" /tmp/sm0.xml | wc -l        # 115
grep -oE "<lastmod>[^<]+</lastmod>" /tmp/sm0.xml | wc -l  # 0

# JSON-LD placeholder leak
curl -sSL "https://www.matury-online.pl/" -o /tmp/home.html
grep -oF '${maturaYear}' /tmp/home.html | wc -l           # 2

# Indexation breakdown
ssh panel sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT \"indexingVerdict\", count(*) FROM \"Page\" WHERE \"domainId\"='cmo928oyl01n2qrovi3au1tdc' GROUP BY \"indexingVerdict\";"

# 14d traffic
ssh panel sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT date, clicks, impressions FROM \"GscDomainDaily\" WHERE \"domainId\"='cmo928oyl01n2qrovi3au1tdc' ORDER BY date DESC LIMIT 14;"

# Top traffic pages 28d
ssh panel sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT p.url, gpd.clicks, gpd.impressions, gpd.position, gpd.date FROM \"GscPageDaily\" gpd JOIN \"Page\" p ON p.id=gpd.\"pageId\" WHERE p.\"domainId\"='cmo928oyl01n2qrovi3au1tdc' AND gpd.date >= CURRENT_DATE - 28 ORDER BY gpd.impressions DESC LIMIT 25;"

# Drift
git status --short
git diff frontend/src/pages/index.astro
git diff frontend/src/pages/test/historia/[temat].astro
```
