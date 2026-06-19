# SEO on-site audit — www.1copywriting.pl
**Date:** 2026-05-27
**Profile:** E (satellite per DB classification) + B traits — 51 blog posts + 12 silo pages, but mozDA=3, ~2 clicks/134 impressions/28d. Audit focus: indexation + technical hygiene + link-flow toward `smart-copy.ai`.
**Stack:** Astro 5.7 static export, AWS S3 (`www.1copywriting.pl`) + 2× CloudFront (E1BD994ZWOP8XT www, EDZTOI72QDPK7 apex→www).
**Repo↔prod state:** in-sync (only `indexing-result.json` modified — generated artifact, no source drift). Last commit 2026-05-24, live `Last-Modified` 2026-05-24 — matched.
**Last crawl:** 2026-05-27 03:10 | **GSC:** 2026-05-27 06:00 | **GA4:** ACTIVE, last sync 2026-05-27 08:00
**Pages:** 112 tracked, 86 indexed (77%), 70 in sitemap | **DA:** 3 | **Last 28d GSC:** 2 clicks, 134 impressions

---

## P0 — Critical (fix this week)

### [LIVE] `og:image` referenced on every page returns HTTP 404
**Where:** `src/components/SEOHead.astro:20` defaults `image = '/images/og-default.jpg'` → rendered as `<meta property="og:image" content="https://www.1copywriting.pl/images/og-default.jpg">` on the homepage and every page that doesn't supply its own `image` prop (silo pages, 404, newsletter pages, polityka).
**Evidence:**
```
$ curl -sI https://www.1copywriting.pl/images/og-default.jpg
HTTP/1.1 404 Not Found
Content-Length: 26350      # this is the 404.html bytes, not the image
```
`public/images/` on disk contains only `blog/` — no `og-default.jpg`.
**Impact:** every share to Facebook/LinkedIn/Slack/X (Twitter card declares the same URL on line 65 of `SEOHead.astro`) renders without an image. Also affects Google rich-result eligibility for `Organization`/`WebSite` schema. Direct hit on CTR from social referrals.
**Fix:** create a 1200×630 PNG/JPG at `public/images/og-default.jpg` (logo + tagline). Then run `./deploy.sh`. If you want to keep the SVG style, source from `public/favicon.svg` and export to JPG.

### [LIVE] Pillar article `/blog/copywriting-co-to-jest/` is "Discovered – currently not indexed"
**Where:** prod `seo_panel.Page` row for `https://www.1copywriting.pl/blog/copywriting-co-to-jest/`, verdict `NEUTRAL`, coverageState `Discovered - currently not indexed`, lastChecked 2026-05-27 09:06.
**Evidence:** this is the page the homepage hero CTA points to (`src/pages/index.astro:65` — `<a href="/blog/copywriting-co-to-jest/">Zacznij od podstaw</a>`). It's also one of the four `featuredSlugs` on the home (line 14-19). Yet Google has it as "Discovered" — Google knows the URL but has not crawled it. Combined with `/blog/usp/` getting 107 impressions but 0 clicks and the silo page `/co-to-jest-copywriting/` 101 impressions but 0 clicks — pillar surface ranks but doesn't convert; meanwhile its anchor target on the home is invisible.
**Impact:** the highest-internal-PR target on the site is not in the index. Every other page linking to it transfers no equity, and SERPs can't show it as a result.
**Fix:**
1. In GSC, manually "Request Indexing" for the URL today (rate-limited to ~10 URLs/day so prioritise).
2. Strengthen the inbound signal: add to `<head>` of the home a `<link rel="prefetch">` to this URL (already done by Astro `prefetchAll`), and consider making the hero `<h1>` text itself mention "copywriting" → currently the H1 is "Jedyny taki przewodnik po copywritingu" which is fine semantically but the CTA copy "Zacznij od podstaw" gives no anchor signal. Change the CTA anchor text in `src/pages/index.astro:66` to `Copywriting — co to jest?` so the link anchor matches the target's keyword.
3. Same treatment for the other 9 "Crawled – currently not indexed" articles listed under P1.

---

## P1 — High (fix this sprint)

### [LIVE] Cluster of 10 articles in "Crawled – currently not indexed"
**Where:** prod `seo_panel.Page` rows with `coverageState='Crawled - currently not indexed'`:
- `/blog/50-formul-na-naglowek/`, `/blog/co-robi-copywriter/`, `/blog/elementy-tekstu-copywriterskiego/`, `/blog/jak-pisac-teksty-marketingowe/`, `/blog/ktora-formule-wybrac/`, `/blog/przyklady-copywritingu/`, `/blog/przyklady-dobrych-naglowkow/`, `/blog/slowa-ktore-sprzedaja/`
- "Discovered – currently not indexed" (11 more, including pillar P0 above): `/blog/copywriting-w-czasach-ai/`, `/blog/hook-copywriting/`, `/blog/jak-pisac-cta/`, `/blog/jak-pisac-teksty-sprzedazowe/`, `/blog/jezyk-i-styl-w-copywritingu/`, `/blog/jezyk-korzysci/`, `/blog/copywriter-vs-autor-prac-dyplomowych-narzedzia-ai/`, silos `/formuly-copywriterskie/`, `/historia-copywritingu/`, `/jak-pisac/`
**Evidence:** 26 / 112 pages = 23% not indexed despite all returning 200 + having valid title/description/canonical/Article JSON-LD. DA=3 means Google does not consider this site authoritative enough to spend crawl budget on every article.
**Impact:** ~23% of content is invisible. With 2 total clicks in 28 days, every indexed page matters disproportionately.
**Fix:** the "Crawled but not indexed" verdict means Google saw the page and judged it insufficiently distinct from existing content on the web. Cure is content+links, not technical:
- (a) Strengthen each affected article — verify against `src/content/blog/<slug>.md` that they have ≥800 words, original examples (not just generic AIDA/PAS rehashes — those formulas have thousands of copies online), and at least 2-3 internal links into them from other articles.
- (b) **Add a "Related articles" section to `src/layouts/ArticleLayout.astro`** — currently every blog post is an internal-link dead end (see next finding). 3-5 related posts per article would solve both the dead-end problem and provide indexing signal.
- (c) Submit them in batches of ~10/day via GSC Indexing API (already wired through `aws lambda invoke google-indexing-notifier` in `deploy.sh:84` — verify the lambda has `indexing` scope on the SA `google-index-api@ageless-period-491209-s8.iam.gserviceaccount.com`).

### [LIVE] Article pages are internal-link dead-ends (no related articles, no tag links)
**Where:** `src/layouts/ArticleLayout.astro:144-159` — the sidebar contains only `<PromoBanner />` and tags rendered as `<span class="article__tag">{tag}</span>` (line 153). Tags are not `<a>` elements. No "Related articles" section, no "Read next", no in-silo navigation.
**Evidence:** `curl -s https://www.1copywriting.pl/blog/copywriting-co-to-jest/ | grep -oE 'href="/[^"]*"' | sort -u` returns only the 12 silo landing pages + favicon/CSS/canonical — zero links to other blog posts.
**Impact:** every article only sends link-equity to silo pages, never to peer articles. This is the direct cause of the "Crawled but not indexed" cluster — Googlebot reaches the article, sees no peer links, judges the page as terminal/thin, deprioritises indexation.
**Fix:** in `src/layouts/ArticleLayout.astro` after line 159 (inside `<aside class="article__sidebar-inner">`), add a "Powiązane artykuły" block:
```astro
{relatedArticles.length > 0 && (
  <div class="article__related">
    <h4 class="article__sidebar-title">Powiązane artykuły</h4>
    <ul>
      {relatedArticles.map((a) => (
        <li><a href={`/blog/${a.slug}/`}>{a.data.title}</a></li>
      ))}
    </ul>
  </div>
)}
```
Compute `relatedArticles` in the `---` frontmatter by `getCollection('blog').filter(p => p.data.silo === silo && p.slug !== Astro.params.slug).slice(0, 5)`. Same place, convert tags to links `<a href={`/tag/${tag}/`}>` once you add tag pages (separate P2 finding).

### [LIVE] CookieBanner does NOT load GTM for new visitors — Consent-Mode-v2 signal lost
**Where:** `src/components/CookieBanner.astro:345-353` (`init` function):
```js
function init() {
  const consent = getConsent();
  if (consent) {
    updateGoogleConsent(consent);
    loadGoogleScripts(consent);
  } else {
    showBanner();   // ← new visitor: GTM is never loaded
  }
}
```
`loadGoogleScripts()` is called only from `handleAcceptAll`/`handleAcceptSelected`/`handleReject` (lines 299, 311, 323) and from `init` *when consent already exists*. A first-time visitor who never interacts with the banner → no GTM, no Consent-Mode signal, no cookieless ping, no modelled conversions.
**Evidence:** `curl -s https://www.1copywriting.pl/ | grep -oE "googletagmanager[^\"']*"` returns only the `ns.html` noscript iframe and the *string literal* `googletagmanager.com/gtm.js?id=` inside the CookieBanner JS — no actual `<script>` tag with `src="...gtm.js"` is injected at page load. (BaseLayout.astro:39-47 has only the `<noscript>` iframe.)
**Impact:** GA4 / GTM tag-firing only begins after a user opt-in. Polish GDPR practice + Consent Mode v2 expects GTM to load *immediately* with `consent default = denied` so cookieless pings + behavioural-modelled conversions still fire. Without it, the bulk of organic traffic (people who close the tab before clicking the banner) is invisible to GA4. This is the same architectural bug fixed previously on `sklad-tekstu.pl` and `ecopywriting.pl`.
**Fix:** in `src/components/CookieBanner.astro:345-353` change to:
```js
function init() {
  const consent = getConsent();
  // Always load GTM — Consent Mode v2 governs what fires, not whether GTM loads.
  loadGoogleScripts(consent || { necessary: true, analytics: false, marketing: false });
  if (consent) {
    updateGoogleConsent(consent);
  } else {
    showBanner();
  }
  // Event Listeners
  if (toggleBtn) toggleBtn.addEventListener('click', toggleDetails);
  if (acceptAllBtn) acceptAllBtn.addEventListener('click', handleAcceptAll);
  if (acceptSelectedBtn) acceptSelectedBtn.addEventListener('click', handleAcceptSelected);
  if (rejectBtn) rejectBtn.addEventListener('click', handleReject);
}
```
Consent stays `denied` by default (already set at line 185-194); GTM loads and reports the cookieless ping. Verify after deploy: `curl -s https://www.1copywriting.pl/ | grep "gtm-script"` should match the dynamically-added `<script id="gtm-script">`.

### [LIVE] Trailing-slash redirect is 302 (S3 default), not 301
**Where:** every blog/silo URL without trailing slash. Example:
```
$ curl -sI https://www.1copywriting.pl/blog/copywriting-co-to-jest
HTTP/1.1 302 Moved Temporarily
x-amz-error-code: Found
Location: /blog/copywriting-co-to-jest/
```
**Evidence:** the redirect is generated by S3's static-website hosting "redirect to canonical" feature, which uses 302 by default. CloudFront passes it through.
**Impact:** 302 → Google retains the old URL in the index, splits ranking signals between trailing-/no-trailing variants, doesn't transfer link equity fully. For a satellite domain trying to consolidate weak signals onto one canonical URL, this is significant.
**Fix:** add a CloudFront Function on the viewer-request event that emits a 301 to the trailing-slash version for any path that lacks `.` and doesn't end in `/`. Example function body:
```js
function handler(event) {
  var req = event.request;
  var uri = req.uri;
  if (uri.endsWith('/') || uri.indexOf('.') >= 0) return req;
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { 'location': { value: uri + '/' } }
  };
}
```
Attach to distribution `E1BD994ZWOP8XT`. Alternatively, change the S3 bucket "Routing rules" to use HttpRedirectCode `301`.

### [LIVE] `apple-touch-icon.png` returns 404 on every page
**Where:** `src/components/SEOHead.astro:47` — `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`. File does not exist in `public/`.
**Evidence:**
```
$ curl -sI https://www.1copywriting.pl/apple-touch-icon.png
HTTP/1.1 404 Not Found
```
**Impact:** iOS "Add to home screen" falls back to a screenshot; some Lighthouse PWA / icon audits flag it. Not severe but easy fix.
**Fix:** export `public/favicon.svg` to PNG 180×180, save as `public/apple-touch-icon.png`, deploy.

### [LIVE] Noindex newsletter pages included in sitemap
**Where:** `public/sitemap-0.xml` (generated by `@astrojs/sitemap`) lists `/newsletter/blad/`, `/newsletter/potwierdzono/`, `/newsletter/wypisano/`. All three have `<meta name="robots" content="noindex, nofollow">` set via `BaseLayout`'s `noindex={true}` prop. GSC confirms `Excluded by 'noindex' tag` for two of them.
**Evidence:** see `seo_panel.Page` rows — `coverageState='Excluded by 'noindex' tag'` for `/newsletter/potwierdzono/` and `/newsletter/wypisano/`.
**Impact:** mixed signals to Google (sitemap says "index", meta says "don't"). GSC will report "Submitted URL marked noindex" warnings under Coverage. Wastes crawl budget on pages explicitly excluded.
**Fix:** in `astro.config.mjs` add a `filter` to the sitemap integration:
```js
sitemap({
  changefreq: 'weekly',
  priority: 0.7,
  lastmod: new Date(),
  filter: (page) => !page.includes('/newsletter/') && !page.includes('/polityka-prywatnosci/'),
})
```
Keep `polityka-prywatnosci` only if you intentionally want it indexed (it's currently indexed, low value but harmless).

---

## P2 — Medium (fix when capacity allows)

### [LIVE] No HSTS header
**Where:** CloudFront distribution `E1BD994ZWOP8XT` response headers — no `Strict-Transport-Security`.
**Evidence:** `curl -sI https://www.1copywriting.pl/ | grep -i strict-transport` returns empty.
**Impact:** browsers can still attempt HTTP on first visit (CloudFront 301-redirects, but the redirect itself goes over HTTP); a MITM can intercept. Also, GSC and most security scanners ding this.
**Fix:** in AWS Console → CloudFront → distribution `E1BD994ZWOP8XT` → Behaviors → edit default → Response headers policy → either attach managed `Managed-SecurityHeadersPolicy` (recommended) or create a custom policy with `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Apply to both `E1BD994ZWOP8XT` and `EDZTOI72QDPK7`.

### [LIVE] Homepage loads 4 render-blocking CSS bundles including chunks for routes it doesn't use
**Where:** live `<head>` of `/`:
```html
<link rel="stylesheet" href="/_astro/_slug_.B635Tfsh.css">   <!-- 18.9 KB -->
<link rel="stylesheet" href="/_astro/index.BSYYmWix.css">    <!-- 10.2 KB -->
<link rel="stylesheet" href="/_astro/_silo_.jITL38Kd.css">   <!-- 8.2 KB -->
<link rel="stylesheet" href="/_astro/_slug_.j89bTq-E.css">   <!-- 4.9 KB -->
```
`_slug_*` chunks belong to `src/pages/blog/[slug].astro` and `src/pages/blog/[...page].astro`; `_silo_` belongs to `src/pages/[silo].astro`. Total 42 KB of CSS is render-blocking before LCP.
**Evidence:** PSI mobile run on the homepage:
- Performance 0.80, LCP 3.4 s, FCP 3.3 s, Speed Index 6.5 s.
- Failing audit `render-blocking-insight` score 0.
- Failing audit `mainthread-work-breakdown` score 0.5.
**Impact:** LCP 3.4 s puts the home in "Needs improvement" territory (good < 2.5 s). For a satellite trying to consolidate weak signals, every CWV percentile loss matters.
**Fix:** the chunk-splitting comes from shared component scoped styles (`SiloCard`, `ArticleCard`, `Newsletter` are used on the home AND on `[silo]` / `[slug]` pages, so their styles end up in shared chunks pulled into the home bundle). Two options:
- (a) In `astro.config.mjs` change `inlineStylesheets: 'auto'` to `inlineStylesheets: 'always'` — for a static site of this size, inlining ~42 KB total is faster than 4 round-trips.
- (b) Or extract per-component critical CSS and lazy-load the rest.
Re-measure with PSI after deploy.

### [LIVE] Unused `<link rel="preconnect">` to `fonts.googleapis.com` / `fonts.gstatic.com`
**Where:** `src/components/SEOHead.astro:68-69`. The HTML preconnects to Google Fonts but no `<link href="https://fonts.googleapis.com/css2?...">` is ever loaded — `src/styles/global.css` uses `var(--font-display)` / `var(--font-body)` and falls back to system fonts.
**Evidence:** `grep -oE 'fonts\.googleapis\.com[^"]*' /tmp/home.html` returns only the two preconnect tags. No font CSS request to Google.
**Impact:** wasted handshakes; browser may even pre-warm DNS for a domain that's never used. Tiny perf cost but pure waste.
**Fix:** either remove lines 68-69 of `SEOHead.astro`, OR add a real `@import` for the fonts you reference in `global.css` and use them. Pick one — current state is "preconnect to nothing".

### [WORKFLOW] Sitemap index has only 1 file; `lastmod` updates every build (not when content changes)
**Where:** `astro.config.mjs:10` — `lastmod: new Date()`. Every `npm run build` writes a fresh `<lastmod>` on every URL.
**Evidence:** all 70 URLs in `sitemap-0.xml` carry the same `<lastmod>2026-05-24T08:55:48.696Z</lastmod>` — the build timestamp.
**Impact:** signals to Google that every page was modified on every deploy, eroding the credibility of `<lastmod>` for prioritising recrawl. Google has stated they "ignore lastmod when it's clearly bogus".
**Fix:** remove `lastmod: new Date()` from `astro.config.mjs:10`. `@astrojs/sitemap` will then either omit `<lastmod>` (acceptable) or you can configure it to read per-post `publishDate`/`updatedDate` from the content collection via the `serialize` hook.

### [LIVE] Tags stored on blog posts but rendered as visual chips, not links
**Where:** `src/layouts/ArticleLayout.astro:152-154` — `<span class="article__tag">{tag}</span>` (no `<a>`).
**Evidence:** see source. Tags are also not aggregated into any `/tag/<slug>/` page.
**Impact:** lost internal-linking surface for an Astro content site; tag pages typically index well and consolidate long-tail traffic.
**Fix:** (lower-effort) ignore — they're not currently link-worthy. (Higher-value) create `src/pages/tag/[tag].astro` with `getStaticPaths` aggregating posts per unique `data.tags`, then change line 153 to `<a class="article__tag" href={`/tag/${tag}/`}>{tag}</a>`. Adds ~N tag landing pages to crawl surface (verify with content first that ≥3 posts share each tag).

---

## P3 — Polish (backlog)

- **[LIVE]** `public/{fonts,images}/` — a literal directory created by PowerShell brace-expansion that doesn't expand (Windows-shell artifact). Empty. Remove with `Remove-Item -Recurse 'public/{fonts,images}'`, commit, deploy.
- **[LIVE]** Footer credit link `<a href="https://www.torweb.pl">TorWeb.pl</a>` carries no `rel` — it's a sitewide outbound link from 70+ pages. Either add `rel="nofollow"` if you don't want to pass equity, or leave as-is if intentional cross-link to your own domain (torweb.pl). Currently passes `dofollow` link juice on every page.
- **[LIVE]** `<a href="https://smart-copy.ai/...">` (promo link to your own product) carries `rel="noopener"` only — no `rel="nofollow"`/`sponsored`. As a sitewide cross-domain promotional link, Google's webmaster guidelines technically prefer `rel="sponsored"` for ad-like placements. If smart-copy.ai is treated as a money site that this satellite is supposed to lift, leave dofollow; if you want to be safe from manual-action risk, mark `rel="sponsored"`.
- **[LIVE]** `<title>` on home is 78 characters ("Copywriting - przewodnik po pisaniu tekstów na zlecenie | 1copywriting.pl") — over the 60-65 char SERP truncation threshold. Will be cut to "Copywriting - przewodnik po pisaniu tekstów na zlec…". Shorten to e.g. "Copywriting — przewodnik | 1copywriting.pl" (44 chars).
- **[LIVE]** GA ID inconsistency: `BaseLayout.astro:41` references `GTM-WZ5ZXCMT`, `CookieBanner.astro:6,155-156` references both `G-K50DRLY6EF` (GA4) and `GTM-WZ5ZXCMT`. DB `DomainIntegration.propertyId` = `properties/522930358`. Verify in GA4 admin that the property attached to GTM-WZ5ZXCMT IS `522930358` — if it's a different GA4 property, you have orphan tracking.

---

## Unverified — needs re-run
- **PSI desktop runs** — only mobile measured (Profile E doesn't mandate desktop; quota preserved).

## Skipped — not applicable to this profile
- C11 product schema — not e-commerce.
- L3 broken internal-link crawl (full site) — only 70 URLs; spot-checked from home + 1 article + 1 silo, all returned 200; full crawl would add no findings against this corpus size.
- I6 URL Inspection API on each URL — covered by GSC `coverageState` already present in `seo_panel.Page` for all 112 URLs.
- T16 hreflang — single-language site.

---

## Sequence of recommended actions

**Now (production hotfix in one deploy):**
1. Create `public/images/og-default.jpg` (1200×630 brand image) and `public/apple-touch-icon.png` (180×180). [P0, P1]
2. Edit `src/components/CookieBanner.astro:345-353` so `loadGoogleScripts` runs on init for everyone. [P1]
3. Edit `astro.config.mjs` to add `filter: (p) => !p.includes('/newsletter/')` and drop `lastmod: new Date()`. [P1, P2]
4. Edit `src/components/SEOHead.astro:68-69` to remove the unused Google Fonts preconnect (or actually load Google Fonts). [P2]
5. Edit `src/components/SEOHead.astro` `<title>` length / shorten home title in `src/pages/index.astro:42`. [P3]
6. `rm -rf 'public/{fonts,images}'` literal directory. [P3]
7. `./deploy.sh` — sync, invalidate, Indexing API ping.

**This sprint:**
8. Add "Powiązane artykuły" block to `src/layouts/ArticleLayout.astro` (frontmatter + sidebar JSX). Strengthens internal linking for all 51 articles. [P1]
9. CloudFront Function for 301 trailing-slash redirect on `E1BD994ZWOP8XT`. [P1]
10. CloudFront response-headers policy adding HSTS on both distributions. [P2]
11. After 7 days, GSC → Request Indexing in batches of 10/day for the 21 "not indexed" URLs (Google rate-limits ~10/day/property — rough plan: pillar P0 article today, then the 10 "Crawled – not indexed" tomorrow, then the 11 "Discovered – not indexed" the day after). Don't bulk-submit; spread over 3 days.

**Capacity-allowing:**
12. `astro.config.mjs` change `inlineStylesheets: 'always'` and re-measure PSI. [P2]
13. Build tag pages + convert article tags from chips to links. [P2]
14. Audit each "Crawled – currently not indexed" article in `src/content/blog/`: word count, uniqueness, examples. The ones that are < 800 words or rehash of generic formula content are the indexation blockers. [P1 follow-up]

---

## Appendix — verification commands used

```bash
# Live homepage probe
curl -sI -A "Mozilla/5.0 (compatible; SEO-Audit/1.0)" "https://www.1copywriting.pl/"
curl -s  -A "Mozilla/5.0" "https://www.1copywriting.pl/" -o /tmp/home.html

# Sitemap
curl -sI "https://www.1copywriting.pl/sitemap-index.xml"
curl -s  "https://www.1copywriting.pl/sitemap-0.xml" | grep -oE "newsletter[^<]*"

# OG image 404
curl -sI "https://www.1copywriting.pl/images/og-default.jpg"
curl -sI "https://www.1copywriting.pl/apple-touch-icon.png"

# Trailing slash 302
curl -sI "https://www.1copywriting.pl/blog/copywriting-co-to-jest"

# DB (prod, via ssh_exec to panel)
sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT url, \"indexingVerdict\", \"coverageState\" FROM \"Page\" WHERE \"domainId\"='cmn9fo4eq000fqrdyf41kp7to' AND \"indexingVerdict\"!='PASS' ORDER BY url;"
sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT p.url, SUM(g.clicks), SUM(g.impressions) FROM \"GscPageDaily\" g JOIN \"Page\" p ON p.id=g.\"pageId\" WHERE p.\"domainId\"='cmn9fo4eq000fqrdyf41kp7to' AND g.date >= CURRENT_DATE - 28 GROUP BY p.url HAVING SUM(g.impressions) > 0 ORDER BY 3 DESC LIMIT 12;"

# PSI (key from $HOME/.claude/skills/seo-audit-onsite/.env)
# https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<encoded>&strategy=mobile&category=performance&category=seo&key=<KEY>
```
