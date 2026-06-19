# SEO on-site audit — inkmagnet.com
**Date:** 2026-06-15
**Profile:** D — SaaS landing + app (Astro static marketing site for an AI ebook generator; conversion-critical, ~21 indexable pages, EN/PL bilingual). The app itself (`app.inkmagnet.com`) is correctly `noindex` + `Disallow: /`, so the audit targets the `site/` marketing front only.
**Stack:** Astro 5 (static output, `inlineStylesheets: always`), self-hosted Inter font, Tailwind 4. Deployed S3 `inkmagnet-site-prod` + CloudFront `E2HQKNVM051L97` (eu-central-1) via GitHub Actions. PL: `inkmagnet.pl` → 301 → `inkmagnet.com/pl/`.
**Repo↔prod state:** in-sync — `git status` clean, no uncommitted/untracked source. Live `Last-Modified` (2026-06-13 22:27) ≈ last `site/` commit. No drift.
**GSC:** `sc-domain:inkmagnet.com` verified (SA = siteOwner); sitemap `sitemap-index.xml` submitted 2026-06-11, **21 URLs, 0 warnings, 0 errors**.
**GA4:** `G-QLDSL0FSYN` (property 541024234), Consent Mode v2 wired correctly.
**Pages:** 21 in sitemap, all return 200 (urlcheck full crawl: 21/21 2xx, 0 redirects, 0 noindex, avg 86 ms).
**Traffic:** ~0 (1 noise impression in 28d) — expected for a 4-day-old indexed domain.

---

## Headline

The technical foundation is **strong** — no P0 or P1 issues. http→https + www→apex 301s, HSTS, self-referential canonicals, reciprocal hreflang (en/pl/x-default), rich valid JSON-LD (Organization + WebSite + SoftwareApplication/AggregateOffer + FAQPage), on-the-fly gzip, security headers, PSI home 97/100 — all correct and **deliberately omitted from this report** per findings-only rule.

The remaining items are P2/P3 polish plus two workflow gaps. For a new domain the real growth levers now are **indexation + content + links**, not technical fixes.

---

## P0 — Critical
None.

## P1 — High
None.

---

## P2 — Medium (fix when capacity allows)

### [CONTENT] 14 of 21 page titles exceed ~65 chars → truncated in SERP
**Where:** all blog posts + both `vs` analogues + landing variants. Worst offenders:
- `/blog/how-to-self-publish-an-ebook/` — 97 chars
- `/pl/generator-ebookow/` — 84 chars
- `/blog/how-to-create-an-ebook/` — 80 chars
- `/pl/blog/jak-stworzyc-ebooka/`, `/pl/blog/pdf-czy-epub/` — 77 chars
**Evidence:** urlcheck flagged `tytuł >65 zn.` on 14 rows (`D:\seo-panel\audits\cache\inkmagnet.com-crawl.csv`). The pattern is `<H1 verbatim> | InkMagnet` — the " | InkMagnet" suffix (12 chars) pushes already-long headings past Google's ~580 px (~60 char) display limit.
**Impact:** mid-word truncation in SERP → lower CTR once these pages rank. Titles are keyword-rich, so ranking itself is unaffected; this is a display/CTR loss.
**Fix:** give each long page an SEO `title` distinct from its `heading` (the layouts already separate them — `ArticleLayout` takes both `title` and `heading`). Target ≤ 60 chars *including* the brand suffix. Examples:
- `site/src/pages/blog/how-to-self-publish-an-ebook/...` frontmatter `title:` → `"How to self-publish an ebook in 2026 | InkMagnet"` (keep the long version as the on-page `<h1>`/`heading`).
- `site/src/pages/pl/generator-ebookow.astro` `title:` → `"Generator ebooków AI po polsku | InkMagnet"`.
- For blog posts, set a short `title` in each post's content-collection frontmatter and let the H1 stay long.

### [WORKFLOW] Site deploy sets no `Cache-Control` on any static asset
**Where:** `.github/workflows/deploy.yml:91`
**Evidence:**
```
line 91 (site):  aws s3 sync dist "s3://${SITE_BUCKET}" --delete            ← no --cache-control
line 106 (app):  aws s3 sync dist ... --cache-control "public,max-age=31536000,immutable"
```
Live confirmation — no `Cache-Control` header on HTML, fonts, or og-image:
```
curl -sI https://inkmagnet.com/fonts/inter-latin-wght-normal.woff2   → no Cache-Control
curl -sI https://inkmagnet.com/og-image.png                          → no Cache-Control
curl -sI https://inkmagnet.com/                                      → no Cache-Control
```
The app bucket does it right; the site bucket was never given the same treatment. Hashed `_assets/` are content-addressed (immutable) but currently rely only on CloudFront's default TTL — browsers get no caching directive and revalidate on every visit.
**Impact:** slower repeat visits, more origin/edge revalidation. Low traffic today, but it's a one-line fix and compounds as traffic grows.
**Fix:** mirror the app pattern in the site step — immutable for hashed assets, short TTL for HTML:
```bash
cd site && npm install && npm run build
aws s3 sync dist "s3://${SITE_BUCKET}" --delete \
  --exclude "*.html" --exclude "sitemap*.xml" --exclude "robots.txt" \
  --cache-control "public,max-age=31536000,immutable"
aws s3 sync dist "s3://${SITE_BUCKET}" --delete \
  --exclude "*" --include "*.html" --include "sitemap*.xml" --include "robots.txt" \
  --cache-control "public,max-age=3600"
aws cloudfront create-invalidation --distribution-id "${SITE_CF_ID}" --paths "/*"
```

### [LIVE] `/lead-magnet-generator/` — mobile LCP 3.4 s (conversion page)
**Where:** `https://inkmagnet.com/lead-magnet-generator/`
**Evidence:** PSI mobile — Perf 87, **LCP 3.4 s**, FCP 2.3 s, Speed Index 4.4 s (home by contrast: Perf 97, LCP 2.5 s). CLS 0, TBT 50 ms are fine. The page loads `exCover` / `exPhoto1` / `psyChapter` via `astro:assets` `Image`.
**Impact:** this is a money page (primary keyword "lead magnet generator"). LCP > 2.5 s = "needs improvement" CWV bucket → weaker ranking signal + bounce on slow connections.
**Fix:** identify the LCP element (likely the hero image). In `site/src/pages/lead-magnet-generator.astro`: ensure the above-the-fold image uses `loading="eager"` + `fetchpriority="high"` and a tight `width`/`sizes` (don't ship 1440px to mobile), and confirm it's served as WebP/AVIF (Astro `<Image>` does this if `format` isn't pinned to PNG). Re-run PSI after.

### [LIVE] EN/PL equivalent pages not hreflang-paired
**Where:** `site/src/pages/lead-magnet-generator.astro:58` (EN) ↔ `site/src/pages/pl/generator-ebookow.astro:63` (PL)
**Evidence:** both invoke `<ArticleLayout ...>` without `translated` → `ArticleLayout` defaults `translated = false` (`ArticleLayout.astro:50`) → no `<link rel="alternate" hreflang>` emitted. These two pages are direct translations of each other (EN "AI Lead Magnet Generator" / PL "Generator ebooków AI") but Google sees no link between them.
**Impact:** Google may serve the wrong-language version to a user, or treat them as competing rather than localized. The site's `/`, `/blog/`, `/examples`↔`/pl/przyklady` pairs are correctly linked — this pair was missed.
**Fix:** add to **both** ArticleLayout invocations:
```astro
<ArticleLayout
  ...
  translated={true}
  hreflangEnPath="/lead-magnet-generator/"
  hreflangPlPath="/pl/generator-ebookow/"
>
```
(The `vs/*` pages are intentionally EN-only and correctly emit no hreflang — leave them.)

### [WORKFLOW] Domain not tracked in `seo_panel`
**Where:** prod `seo_panel` DB
**Evidence:** `SELECT ... FROM "Domain" WHERE domain ILIKE '%inkmagnet%'` → **0 rows**. None of the cron jobs (`gsc_pull`, `indexing_check`, `detect_changes`) run for it.
**Impact:** for a brand-new domain the thing you most want to watch — indexation progress and first rankings — isn't being recorded anywhere. GSC has the data (verified, sitemap submitted) but nothing pulls it into the panel.
**Fix:** add inkmagnet.com to the panel (`Domain` row + GSC property `sc-domain:inkmagnet.com` + GA4 integration `G-QLDSL0FSYN`/property 541024234, to which the SA must be granted Viewer in GA4 Admin). Then `indexing_check` will track how many of the 21 URLs Google actually indexes over the next 2–4 weeks.

---

## P3 — Polish (backlog)

- **[CONTENT] Home meta description 186 chars → truncated** (`site/src/pages/index.astro:9`). Google shows ~155–160. Trim to ~155, e.g. end after "...PDF + EPUB." and drop "From $9.99 per book." or shorten the lead.
- **[LIVE] Brotli not enabled on CloudFront** — `Accept-Encoding: br, gzip` still returns `Content-Encoding: gzip`. Enable Brotli in the CloudFront cache/compression policy for ~15–20 % smaller text payloads vs gzip. (`SITE_CF_ID = E2HQKNVM051L97`.)
- **[CONTENT] Organization `logo` is `favicon.svg`** (`site/src/pages/index.astro:18`). Google's logo guidelines prefer a raster PNG/JPG (min 112×112, on a square/transparent canvas) for the knowledge panel. Point `logo` at a dedicated PNG.
- **[CONTENT] `sameAs` empty** (`site/src/config/site.ts`). No social/brand profiles linked → weaker entity/EAT signal. Populate once X/LinkedIn/etc. exist.
- **[LIVE] ~62 KiB unused JS** (PSI, both pages) — this is `gtag.js`. Acceptable cost of GA4; no action unless you later drop analytics.

---

## Unverified — needs re-run
- **Indexed-page count** (I1) — sitemap submitted only 2026-06-11 (4 days ago); Google hasn't finished first-pass indexing. Re-check GSC Coverage / `indexing_check` in ~2–4 weeks (after the domain is added to the panel). Not a finding yet — too early.

## Skipped — not applicable to this profile
- **C7 content depth, L1–L6 internal-link graph** — 21-page marketing site; no meaningful link graph or orphan problem (`sitecrawl` not warranted at this size).
- **C11 Product/Offer schema, faceted search, pagination, out-of-stock** (Profile C checks) — not e-commerce; AggregateOffer on the SoftwareApplication node is the correct shape and is present.
- **GA4/GSC traffic, tail signals, CTR/position analysis** — zero traffic; nothing to analyze.
- **botlog crawl-budget** — new domain, trivial crawl volume; budget is not a constraint.
- **Astro Consent-Mode gating check** (mandatory pattern) — RAN: `Analytics.astro` loads `gtag.js` immediately with `consent default … denied` (correct Consent Mode v2), NOT gated behind banner interaction. The known cross-domain bug is **absent here**. (No finding = passes.)
- **Astro.redirect status / sitemap-slug coverage** (mandatory patterns) — RAN: static output, no dynamic `Astro.redirect()`; sitemap is generated by `@astrojs/sitemap` from real pages, all 21 return 200, no slug↔page drift possible.

---

## Sequence of recommended actions
1. **Edit titles** (P2 #1) — short SEO `title` ≠ long `heading` on the 14 flagged pages; trim home meta description (P3).
2. **Add hreflang pair** to lead-magnet-generator ↔ generator-ebookow (P2 #4).
3. **Fix lead-magnet-generator hero image** for LCP (P2 #3).
4. **Patch deploy workflow** with Cache-Control on the site sync (P2 #2).
5. `git commit` + push → CI redeploys site (single deploy covers 1–4).
6. **Add inkmagnet.com to `seo_panel`** + grant SA Viewer on GA4 property (P2 #5) — non-code.
7. **Enable Brotli** on CloudFront (P3) — infra.
8. Re-run this audit / check GSC Coverage in ~3–4 weeks to confirm all 21 URLs indexed.

---

## Appendix — verification commands
```
# redirects / headers
curl -sIL -A "Mozilla/5.0 (compatible; SEO-Audit/1.0)" https://inkmagnet.com/
curl -sI  -H "Accept-Encoding: br, gzip" https://inkmagnet.com/        # → gzip only (no br)
# bulk crawl
D:\go-tools\urlcheck\urlcheck.exe -sitemap https://inkmagnet.com/sitemap-index.xml -c 20 -rps 15 -out D:\seo-panel\audits\cache\inkmagnet.com-crawl.csv -dupes
# GSC (SA token, webmasters.readonly) — site list, sitemaps, searchAnalytics 28d
# GA4 id G-QLDSL0FSYN / property 541024234
# PSI mobile
#   https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<enc>&strategy=mobile&category=performance&category=seo&key=<PSI_API_KEY from .env>
# DB (prod): SELECT ... FROM "Domain" WHERE domain ILIKE '%inkmagnet%';   → 0 rows
```
