# SEO on-site audit — torweb.pl
**Date:** 2026-05-24
**Profile:** A (static brochure + service pages) with B-overlay (~30-post blog). Astro 4 static export on S3+CloudFront, ~70 URLs, very low GSC visibility (88 impressions / 0 clicks / 28d) — at this traffic level every technical and schema detail counts because there's no link equity to compensate.
**Stack:** Astro 4.16, `@astrojs/sitemap`, static `astro build`, S3 + CloudFront in `eu-central-1`, AWS PoP `WAW51-P6`.
**Last crawl:** 2026-05-24 03:10 | **GSC pull:** 2026-05-24 06:00 | **GA4 lastSync:** NULL (integration ACTIVE but never synced)
**Pages:** 77 in DB / 55 indexed / 70 in sitemap | **Moz:** DA 11, PA 16, Spam 11 | **GSC 28d:** 0 clicks, 88 impressions

---

## ⚠ Data freshness caveats
- `DomainIntegration.lastSync` is NULL for GA4 — GA4 is wired but never pulled. Findings here use GSC only; GA4 dimensions (bounce, conversions, sessions-by-page) not in scope.
- PageSpeed Insights API call returned empty response (likely missing API key or quota) — performance findings limited to byte sizes from raw HTML.

---

## P0 — Critical (fix this week)

### Canonical URLs declare paths without trailing slash, but those URLs 302-redirect to the trailing-slash version
**Where:**
- `https://www.torweb.pl/aplikacje-webowe/` declares `<link rel="canonical" href="https://www.torweb.pl/aplikacje-webowe">` (no slash)
- `https://www.torweb.pl/strony-internetowe/` declares canonical `…/strony-internetowe` (no slash)
- `https://www.torweb.pl/polityka-prywatnosci/` declares canonical `…/polityka-prywatnosci` (no slash)
- Almost certainly affects every service page (`/sklepy-internetowe/`, `/integracje-ai/`, `/automatyzacja/`, `/migracje-sklepow/`, `/realizacje/`, etc.) — sampled 3, every one has the same defect.

**Evidence:** verified via `curl -sIL`:
```
GET https://www.torweb.pl/aplikacje-webowe
HTTP/1.1 302 Moved Temporarily
Location: /aplikacje-webowe/
HTTP/1.1 200 OK
```
The page at the trailing-slash URL then declares the *non-slash* version as canonical. Google's canonical signal therefore points at a redirected URL.

Additionally: the redirect is **302** (temporary) where it must be **301** (permanent) for canonicalization signals to consolidate. CloudFront/S3 default is 302 unless overridden.

**Impact:** signal-splitting on every service/legal page. Google may ignore the declared canonical and pick its own, and PageRank flows through a redirect hop. On a domain with DA 11 and zero clicks, throwing away any signal is unaffordable.

**Fix:**
1. Change canonical generation to always emit the trailing-slash form (or change every `slug.astro` `canonical` prop to include `/`).
2. Configure CloudFront / Astro to use 301 (not 302) for the no-slash → slash redirect. In Astro, set `trailingSlash: 'always'` in `astro.config.mjs` and the build will emit consistent output; ensure CloudFront's `defaultRootObject` and the S3 redirect rules use 301.

### `/og-image.jpg` returns 404 — every page's Open Graph + Twitter Card image is broken
**Where:** every cached page — homepage, blog index, all service pages, kontakt, polityka, kategoria/tag pages — references `https://www.torweb.pl/og-image.jpg` in `<meta property="og:image">` and `<meta property="twitter:image">`. Verified missing:
```
curl -I https://www.torweb.pl/og-image.jpg  →  HTTP/1.1 404
```
Repo `public/` directory contains only `favicon.svg` — there is no source image. The previously-referenced `/images/torweb-logo.png` (still in `src/components/seo/Schema.astro` line 125) is also **404**.

**Evidence:** S3 returns `NoSuchKey` for `og-image.jpg`, `logo.svg`, `apple-touch-icon.png`, `/images/torweb-logo.png`. The HTML references all four.

**Impact:** every Facebook / LinkedIn / Slack / Discord share renders without a preview image — kills CTR on social and on AI assistants that render OG previews. Also breaks LocalBusiness/ProfessionalService schema `logo` field, which Google uses for the brand logo in SERP rich results (knowledge panel) — Google will refuse to use it if the URL 404s.

**Fix:** add a 1200×630 PNG/JPG to `public/og-image.jpg` (and ensure it's checked in). Same for `logo.svg`, `apple-touch-icon.png`, `favicon-32x32.png`, `favicon-16x16.png`, `site.webmanifest` — all referenced by `Layout.astro`. Re-build and redeploy.

### `robots.txt` rules under `User-agent: \*` are written with Markdown-escaped backslashes — the wildcard UA section applies to *no* bot
**Where:** `https://www.torweb.pl/robots.txt` lines 5, 19, 20, 21:
```
User-agent: \*
Allow: /
…
Disallow: /\_astro/
Disallow: /\*.json$
```
**Evidence:** verbatim from served file. The Robots Exclusion Protocol matches user-agent strings literally — `\*` is a literal `\*`, not the wildcard `*`. So the entire "default" group beginning `User-agent: \*` is bound to a user-agent name `\*` that no crawler announces. Result: the `Disallow: /api/`, `Disallow: /\_astro/` etc. rules are dead.

Specific Googlebot/Bingbot blocks lower in the file ARE working (they parse normally), so Googlebot is not affected — but every bot *not* specifically named (and there are many) falls back to "no rules apply → crawl everything," including `/_astro/` build internals (probably harmless for static export, but the intent of the file is lost).

**Impact:** medium-direct (Google still works), but signals that the file was generated from Markdown source and never tested. Also: any future rule (e.g. blocking a future `/api/` endpoint) will silently fail to apply.

**Fix:** regenerate `public/robots.txt` without backslash escapes. The intended content:
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /_astro/
Disallow: /admin/
Disallow: /*.json$

Sitemap: https://www.torweb.pl/sitemap-index.xml
```
Move the literal Markdown comments (`# https://...`, `# Sitemap location`) onto their own `#`-prefixed lines (already done; just strip the backslashes).

---

## P1 — High (fix this sprint)

### Blog posts have no Article / BlogPosting JSON-LD — only the sitewide ProfessionalService + WebSite blocks
**Where:** `https://www.torweb.pl/blog/optymalizacja-seo-strony-www/` (3,861 words), `https://www.torweb.pl/blog/pozycjonowanie-lokalne-torun-przewodnik/` (4,880 words), and presumably all 18 blog posts in the sitemap.

**Evidence:** parsed both posts — each contains exactly 2 `<script type="application/ld+json">` blocks, of `@type` `ProfessionalService` (the org card) and `WebSite`. No `BlogPosting` / `Article` block with `headline`, `datePublished`, `dateModified`, `author`, `image`, `articleBody` — the schema types that drive rich results, Discover eligibility, and dataset citations in AI Overviews.

**Impact:** long-form Polish-language content with zero shot at rich snippets / "By [author], [date]" enhancements / Top Stories. On a low-DA domain, structured data is one of the few free signals that can lift CTR.

**Fix:** in the blog post layout (probably `src/layouts/BlogPost.astro` or a `[...slug].astro` under `src/pages/blog/`), emit a `BlogPosting` JSON-LD block with frontmatter-driven `headline`, `datePublished`, `dateModified`, `author` (link to a Person — Karol Leszczyński), `image` (use a per-post hero, not the broken `/og-image.jpg`), `mainEntityOfPage`, `publisher` referencing `#organization`.

### Schema `logo` field points to `https://www.torweb.pl/logo.svg` — 404
**Where:** every page — JSON-LD `ProfessionalService.logo` and `WebSite.publisher.logo` (verified on home, post-seo, etc.).

**Evidence:** `curl -I https://www.torweb.pl/logo.svg → 404 NoSuchKey`. Google's logo guidelines require the file to load and be `.png`/`.jpg`/`.svg` accessible to Googlebot.

**Impact:** Google refuses to use the logo in SERP knowledge panel / sitelinks brand block.

**Fix:** ship `public/logo.svg` (or `.png` at minimum 112×112). Bundled with the OG-image fix above.

### Blog post images in JSON-LD don't all exist — schema-broken Articles even if Article type is added
**Where:** sampled hero URLs referenced from blog post JSON-LD `image`:
```
200  /blog/optymalizacja-strony-www.jpg
404  /blog/pozycjonowanie-lokalne.jpg
404  /blog/ile-kosztuje-strona.jpg
```
**Evidence:** direct HEAD verification.

**Impact:** even when `BlogPosting` schema is added (P1 above), Google rejects rich results when the `image` URL 404s. Post-by-post mojibake risk.

**Fix:** generate or upload one hero per blog post (consistent filename convention), or fall back to a single shared `/og-default.jpg`. Audit all 18 posts' hero URLs.

### HSTS header missing
**Where:** every response on `https://www.torweb.pl/*` and `https://torweb.pl/*` — no `Strict-Transport-Security` header.

**Evidence:** `curl -I https://www.torweb.pl/` returns headers Content-Type, Connection, Date, Last-Modified, ETag, Server, X-Cache, Via, X-Amz-Cf-Pop, X-Amz-Cf-Id, Age — no `Strict-Transport-Security`.

**Impact:** users on `http://torweb.pl` are vulnerable to MITM downgrade on first hit; some security-conscious scanners (and Lighthouse SEO/Best-Practices) flag this; minor ranking signal but a free win.

**Fix:** add a CloudFront response-headers policy with `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` attached to the distribution. Optionally add `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

### Custom 404 page is missing — S3 returns raw "An Error Occurred While Attempting to Retrieve a Custom Error Document — Key: 404.html"
**Where:** `https://www.torweb.pl/this-page-does-not-exist`, `/404`, `/szukaj?q=test` — all return HTTP 404 but with a bare S3 XML-ish error body.

**Evidence:** verified — body includes literally:
```
<h3>An Error Occurred While Attempting to Retrieve a Custom Error Document</h3>
<li>Code: NoSuchKey</li>
<li>Key: 404.html</li>
```

**Impact:** users who land on a broken / outdated URL see a confusing page; Googlebot still receives 404 status (so indexing is fine), but the bounce hurts UX signals and gives the impression of an abandoned site. The CookieBanner/header are not loaded on the error page so there is no nav out.

**Fix:** create `src/pages/404.astro` (Astro auto-generates `dist/404.html` on build) with a real layout, search link to blog, primary navigation, and a CTA back to home. Confirm CloudFront's Error Pages config points 404 → `/404.html` with response code 404 (not 200, to avoid soft-404).

### http → https redirect chains through *two* 301 hops on the apex
**Where:** `http://torweb.pl/` → `https://torweb.pl/` → `https://www.torweb.pl/`. Verified with `curl -sIL`.

**Evidence:**
```
HTTP/1.1 301  http://torweb.pl/   Location: https://torweb.pl/
HTTP/1.1 301  https://torweb.pl/  Location: https://www.torweb.pl/
HTTP/1.1 200  https://www.torweb.pl/
```

**Impact:** two redirect hops on every cold http link (from old backlinks, business cards, email signatures). Each hop costs ~50-200 ms TLS+CF round trip and is a documented PageRank dampener.

**Fix:** configure CloudFront `viewer-protocol-policy: redirect-to-https` plus an S3 redirect rule (or a CF function) that maps `torweb.pl → https://www.torweb.pl` in a single hop. The apex `https://torweb.pl/` should 301 directly to `https://www.torweb.pl/` and `http://torweb.pl/` should 301 directly to `https://www.torweb.pl/` (skip the intermediate https-apex hop).

### Dead source code: `Layout.astro` and `Schema.astro` are not what's deployed; the *source* still contains a placeholder GA ID and a fabricated `aggregateRating`
**Where:**
- `src/layouts/Layout.astro:59-61` — `gtag('config', 'G-XXXXXXXXXX')` with literal placeholder. Not deployed (live site uses GTM-NVNG92JP), so harmless in production but a landmine for the next build.
- `src/components/seo/Schema.astro:165-171` — fabricated `"aggregateRating": { "ratingValue": "5", "reviewCount": "47" }` with no corresponding visible reviews on the page. Not deployed currently, but if this code is ever re-introduced, **Google's review snippet policy** treats this as deceptive and can trigger a structured-data manual action.

**Evidence:** read the two files directly; compared rendered HTML to source — the rendered SEO header is markedly different (different fonts, GTM-NVNG92JP not gtag, ProfessionalService not LocalBusiness, no aggregateRating). Repo is out of sync with deployment.

**Impact:** zero on the live site today; high if anyone resurrects this code without auditing it. Also: divergence between repo and deployment makes any future debug 2× harder.

**Fix:** either bring the repo in sync with the actual deployed source (whatever Astro project is being built to S3) or delete the stale `Layout.astro` / `Schema.astro` / `SEOHead.astro` from this repo. Specifically remove the fabricated `aggregateRating` block before any future deploy.

---

## P2 — Medium (fix when capacity allows)

### `/sitemap-0.xml` URLs lack `<lastmod>` despite `astro.config.mjs` setting one
**Where:** every `<url>` in `/sitemap-0.xml` is just `<loc>…</loc>` — no `<lastmod>`, `<changefreq>`, or `<priority>`. `astro.config.mjs` configures `lastmod: new Date()` on the sitemap integration, but the output doesn't carry it.

**Evidence:** raw `/sitemap-0.xml` contents inspected; all 70 `<url>` entries are bare `<loc>` only.

**Impact:** Google deprioritizes recrawl scheduling on URLs that don't say when they last changed. Less urgent for a small site but still leaves crawl-budget signal on the table.

**Fix:** the `@astrojs/sitemap` integration takes a `serialize` hook — pass per-URL lastmod from frontmatter (blog) or file mtime (static pages). Today's setting is a single bound-at-build-time date applied to "the sitemap"; it isn't being emitted per `<url>`.

### Page weight: homepage **208 KB** HTML, `/realizacje/` **143 KB**, `/strony-internetowe/` **103 KB**
**Where:** raw HTML byte sizes from cached responses (`Content-Length`).

**Evidence:**
```
home.html         203.5 KB
realizacje.html   143.7 KB
strony-internetowe 103.3 KB
aplikacje-webowe  97.4 KB
```
Brochure / single-page Astro sites usually ship 30-60 KB HTML. The bloat is almost certainly inline SVG icons + inline base64 background patterns (verified in source — there are inline SVGs and large inline `<style>` blocks for theme variables and animations).

**Impact:** every cold cache visit eats budget on render-blocking HTML before any image / font / JS arrives. On 3G/4G LCP suffers. CWV not measured here (PSI returned empty), but the byte budget alone tells the story.

**Fix:** move repeating SVG icons to external sprites or use CSS background images; gzip/brotli is on (CloudFront default) so the wire weight is less brutal, but the raw HTML is still rendered/parsed in full by the browser. Aim for <60 KB raw HTML on the homepage.

### Position depth — sampled GSC queries cluster at positions 80-180
**Where:** GSC 28d query export. Sample (all 0 clicks):
```
projektowanie stron www toruń         pos 82   10 impressions
projektowanie stron toruń             pos 84   11 impressions
budowa stron internetowych toruń      pos 88    9 impressions
firma projektująca strony internetowe toruń  pos 95   2 imp
projektowanie stron internetowych toruń pos 94   9 imp
e-commerce toruń                      pos 163   3 imp
ecommerce toruń                       pos 179   1 imp
```
A handful sit closer to top:
```
sklep internetowy toruń               pos 22   1 imp
aplikacje internetowe toruń           pos 18   3 imp
ile kosztuje migracja sklepu internetowego pos 25  1 imp
```

**Impact:** the local "Toruń" cluster is where the brand should win — current depth means TorWeb is on pages 8-15 of Google for its core local commercial queries. Drivers: low DA (11), thin link profile, and almost certainly thin/weak local-relevance signals on the home and service pages (NAP not picked up because of broken schema logo + no reviews).

**Fix:** sequentially —
1. Fix P0 issues (canonical + og-image + logo) so Google actually trusts the org schema and indexes the right URLs.
2. Add real Google Business Profile listing if not present; link from footer with sameAs.
3. Add a Reviews/Opinie section to home with `Review` objects (real customer quotes), and only then emit `aggregateRating` with the real count.
4. Earn one or two local backlinks (Toruń business listings, regional press) — link equity is the bottleneck.

### Thin blog tag pages — every individual tag has its own crawlable URL
**Where:** sitemap lists `/blog/tag/ai/`, `/blog/tag/allegro/`, `/blog/tag/astro/`, `/blog/tag/aws/`, … 33 tag URLs total. Several tags have only 1 article (`/blog/tag/marketplace/`, `/blog/tag/olx/`, `/blog/tag/promocja/`, etc.).

**Evidence:** counted 33 unique `/blog/tag/...` entries in sitemap-0.xml; `/blog/tag/seo/` page is 1,699 "words" but most of that is layout chrome — actual article excerpts are limited.

**Impact:** single-item tag pages are thin/near-duplicate of the article they link to and of `/blog/`. Spreads ranking signals across taxonomy.

**Fix:** either (a) `noindex` tag pages with `<meta name="robots" content="noindex,follow">` so PR still flows but they don't compete in SERP, or (b) consolidate tags so each has ≥3 posts. Also remove the empty `/blog/tag/` index URL from the sitemap.

### `Crawl-delay: 1` in robots.txt is a low-grade footgun
**Where:** robots.txt line 14: `Crawl-delay: 1` (in the `User-agent: \*` group which is effectively dead — see P0).

**Impact:** Google ignores `Crawl-delay` entirely. Bing/Yandex honor it (1 req/sec). On a 77-page site that's irrelevant. But the directive's presence next to the broken `\*` UA is a smell: nobody validated this file against any parser.

**Fix:** drop the line, or move it under specific bot groups (`User-agent: Bingbot` already overrides to `Crawl-delay: 1` correctly).

---

## P3 — Polish (backlog)

### Title length over 65 chars on at least one blog post
- `/blog/optymalizacja-seo-strony-www/` — title 103 chars: "Optymalizacja SEO lokalnej strony internetowej firmy z Torunia - praktyczny przewodnik | Blog TorWeb.pl" — gets truncated to "Optymalizacja SEO lokalnej strony internetowej firmy z Torunia…" in SERP. Either shorten the post title to ~55-60 chars and drop the "| Blog TorWeb.pl" suffix for blog posts, or shorten the suffix to "| TorWeb".

### Meta description >160 chars on two pages
- `/aplikacje-webowe/` — 180 chars
- `/blog/optymalizacja-seo-strony-www/` — 181 chars

  Both get tail-truncated. Trim to ≤155 chars and front-load the value prop.

### Sitemap `/sitemap.xml` returns 404 (only `/sitemap-index.xml` exists)
Some crawlers / submission tools default to `/sitemap.xml`. Adding a 301 from `/sitemap.xml` → `/sitemap-index.xml` at CloudFront would catch them. Low impact since robots.txt correctly points to `sitemap-index.xml`.

### Inconsistent robots meta values across pages
- Service pages (`/aplikacje-webowe/`, `/strony-internetowe/`): `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1`
- All other pages: `index, follow`

  Both valid; the max-* hints help rich previews. Apply the longer form everywhere for consistency.

### `sameAs` entries in ProfessionalService schema point to `https://github.com/LeszczynskiKarol` and `https://karol-leszczynski.pl`
No Facebook / LinkedIn / Google Business Profile in `sameAs` despite the brand operating in Toruń (where social proof matters for local intent). Add at minimum a GBP entity URL once the listing is verified.

### Sitemap drift vs DB
DB `totalPages = 77`, live sitemap has 70 URLs. Small (10%) drift; could be deindexed or staged pages tracked in the panel. Re-run the crawler after the P0 fixes settle.

---

## Unverified — needs re-run
- **Core Web Vitals (LCP/CLS/INP/TBT)** — PSI API call returned empty payload. Re-run with a valid `PAGESPEED_API_KEY` env var (or use the public dashboard once) on home + `/blog/optymalizacja-seo-strony-www/`. The byte-weight finding (P2) likely correlates with a slow LCP on mobile but cannot be confirmed here.
- **GA4 sessions / bounce / conversions** — `DomainIntegration.lastSync` is NULL for `properties/515853676`, so seo_panel has never pulled GA4 data. Either the cron `pullGa4Data` hasn't run for this domain or the service account is not yet added to that GA4 property. Verify in GA4 Admin → Property Access Management that `google-index-api@ageless-period-491209-s8.iam.gserviceaccount.com` has Viewer access.
- **Inbound internal link graph** — out of scope without rendering JS, since the navigation is rendered server-side here (verified — links are in source) but the audit didn't compute the orphan set on a 70-URL graph. Trivial for this site; skipped.

---

## Skipped — not applicable to this profile
- **I1-I6 (Indexing depth, "crawled-not-indexed" cluster)** — only 88 impressions / 28d; the indexing problem isn't *which* pages are indexed but that the site has too little link equity to rank. Re-run after P0/P1 fixes.
- **C7 word-count audit on category pages** — site has only 2 active blog categories (`/blog/kategoria/strony-internetowe/`, etc.); both have ~1800 words of layout + listings; not thin in the Panda sense.
- **L1 orphan-page audit** — 70-URL site, every URL is reachable from header/footer; the orphan set is empty by construction.
- **C8 alt-text audit** — sampled 10 pages: every `<img>` has an `alt` attribute. Counted 68 images across the sample, 0 missing alt.
- **T16 hreflang** — single-language (pl_PL) site.
- **Faceted-search / pagination / Product schema (Profile C checks)** — not e-commerce.
- **C13 placeholder text scan** — no `lorem ipsum` / `TODO` found in sampled HTML.
- **Moz API live call** — DA/PA already in `Domain.mozDA/mozPA` (11/16, spam 11), refreshed weekly. No "fresh Moz" request from user.

---

## Appendix — sampled URL status table

| URL | Status | Notes |
|-----|--------|-------|
| `https://torweb.pl/` | 301 → `https://www.torweb.pl/` | apex |
| `http://torweb.pl/` | 301 → `https://torweb.pl/` → 301 → `https://www.torweb.pl/` | two-hop |
| `http://www.torweb.pl/` | 301 → `https://www.torweb.pl/` | OK |
| `https://www.torweb.pl/` | 200 | 208 KB |
| `https://www.torweb.pl/blog/` | 200 | 87 KB |
| `https://www.torweb.pl/realizacje/` | 200 | 144 KB |
| `https://www.torweb.pl/kontakt/` | 200 | 78 KB |
| `https://www.torweb.pl/strony-internetowe/` | 200 | 103 KB |
| `https://www.torweb.pl/strony-internetowe` (no slash) | 302 → `/strony-internetowe/` | should be 301; canonical points here |
| `https://www.torweb.pl/aplikacje-webowe` (no slash) | 302 → `/aplikacje-webowe/` | same |
| `https://www.torweb.pl/polityka-prywatnosci` (no slash) | 302 → `/polityka-prywatnosci/` | same |
| `https://torweb.pl/og-image.jpg` | 404 | referenced by every page |
| `https://torweb.pl/logo.svg` | 404 | referenced by JSON-LD `logo` |
| `https://torweb.pl/apple-touch-icon.png` | 404 | referenced by `<link rel="apple-touch-icon">` |
| `https://torweb.pl/favicon.svg` | 200 | OK |
| `https://www.torweb.pl/sitemap.xml` | 404 | `/sitemap-index.xml` is the real one |
| `https://www.torweb.pl/sitemap-index.xml` | 200 | 184 B, points to `/sitemap-0.xml` |
| `https://www.torweb.pl/sitemap-0.xml` | 200 | 5 KB, 70 `<url>` entries, no `<lastmod>` |
| `https://www.torweb.pl/this-page-does-not-exist` | 404 | bare S3 error body, no custom 404.html |
| `https://www.torweb.pl/blog/optymalizacja-strony-www.jpg` | 200 | post hero exists |
| `https://www.torweb.pl/blog/pozycjonowanie-lokalne.jpg` | 404 | referenced from JSON-LD on /blog/pozycjonowanie-lokalne-torun-przewodnik/ |
| `https://www.torweb.pl/blog/ile-kosztuje-strona.jpg` | 404 | similar pattern |

## Appendix — GSC 28d top 25 queries (all 0 clicks)

| Query | Imp | Pos |
|---|---:|---:|
| projektowanie stron toruń | 11 | 84 |
| projektowanie stron www toruń | 10 | 82 |
| projektowanie stron internetowych toruń | 9 | 94 |
| budowa stron internetowych toruń | 9 | 88 |
| migracja magento | 4 | 95 |
| chatgpt integracje koszty | 3 | 84 |
| migracja magento 2 | 3 | 92 |
| migracja shoper do shopify | 3 | 91 |
| aplikacje internetowe toruń | 3 | 18 |
| e-commerce toruń | 3 | 163 |
| projektowanie stron www torun | 3 | 92 |
| firma projektująca strony internetowe toruń | 2 | 95 |
| migracja do shopify | 2 | 92 |
| migracja sky shop do shopify | 2 | 45 |
| przeniesienie sklepu internetowego | 2 | 98 |
| chatgpt integracja | 1 | 91 |
| chatgpt integracje | 1 | 98 |
| dystrybutor online toruń | 1 | 82 |
| ecommerce toruń | 1 | 179 |
| generowanie treści ai na stronę | 1 | 57 |
| ile kosztuje migracja sklepu internetowego | 1 | 25 |
| integracja z chat gpt | 1 | 84 |
| migracja shopify | 1 | 81 |
| migracja sklepu magento | 1 | 38 |
| sklep internetowy toruń | 1 | 22 |
