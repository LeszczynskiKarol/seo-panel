# SEO on-site audit — smart-copy.ai
**Date:** 2026-06-08
**Profile:** D (SaaS landing/app, conversion-critical) + a content blog (B traits for `/blog/*`). DB `category=SAAS`; few marketing landings + 24×2 locale blog posts.
**Stack:** Astro SSG public site (`frontend-public/`, single-dist EN-primary, PL under `/pl/`) + Vite SPA panel (`frontend/`) + Fastify backend (sitemap served backend-side). Served via nginx on `panel` VPS (3.67.113.111).
**Repo↔prod state:** in-sync for the public site. `git status` shows only unrelated SPA WIP (`frontend/package.json`, `frontend/src/components/hero/`, `tmp-debug-*.html`) — none touch `frontend-public/`. No drift relevant to this audit.
**Last crawl:** 2026-06-08 04:36 | **GSC pull:** 2026-06-08 06:00 | **GA4 sync:** 2026-06-08 08:01 (ACTIVE)
**Pages:** 46 tracked, **17 indexed**, 48 in sitemap | **DA:** 10 | **Last 28d GSC:** 9 clicks, 1036 impressions, avg pos 23.9 | **Last 90d:** 29 clicks, 2626 impr

---

## Context — the real bottleneck is OFF-site (not fixable here)
On-site technical SEO is **clean** (robots, sitemap, hreflang, canonical, 301 migration, SEO score 100/100 in PSI). The reason for ~zero traffic is **domain authority (DA 10) → average position 23 = page 3**, in a brutally competitive niche (`ai copywriter`, `ai copy generator` dominated by Jasper/Copy.ai). ~All clicks are branded (`smart copy ai`, `smartcopy`). This audit lists the on-site items worth fixing, but none of them will move traffic much until off-site authority + non-brand content/links grow. See chat for strategy.

---

## ⚠ Data reliability caveat (important for your decision-making)
**GA4 is undercounting** — see P1#2. GSC (29 clicks/90d) is the trustworthy traffic source; GA4 (3 sessions/28d) is broken low. Both agree traffic is genuinely tiny, but do **not** use GA4 for funnel/conversion analysis until the consent banner is fixed.

Migration note (NOT a finding — working correctly): `en.smart-copy.ai/*` and apex `smart-copy.ai` 301→`www`; legacy PL slugs at root (`/ai-seo-writer`) 301→`/pl/...`. GSC still shows historical impressions on `en.smart-copy.ai/` (1363/90d) because the 301s are ~12 days old; they will consolidate into `www`. Verified all 301 (not 302).

---

## P0 — Critical
None. The on-site technical foundation is sound; no production-breaking SEO defect found. (Not inventing a P0 to fill the section.)

---

## P1 — High (fix this sprint)

### [LIVE] Fake `AggregateRating` (4.8 / 127 reviews) in homepage structured data
**Where:** `frontend-public/src/components/seo/ProductSchema.astro:49-52` → rendered into `https://www.smart-copy.ai/` (and every page using `ProductSchema`).
**Evidence:** Live home JSON-LD: `"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"127"}`. Source has these values hardcoded. The product has ~0 users / no on-page review system → the 127 reviews are not real and not displayed anywhere on the page.
**Impact:** Violates Google's structured-data policy (rating markup must reflect genuine, on-page reviews). Risk = **manual action for structured-data spam** or rich-result ineligibility — devastating for a domain trying to build trust. Latent now (barely crawled) but live and served.
**Fix:** In `ProductSchema.astro` delete the `aggregateRating` block (lines 49-52) unless/until you have a real, displayed review system. If you want stars in SERPs later, collect genuine reviews and render them on-page, then re-add markup matching the visible count.

### [LIVE] GA4 undercounts — consent banner is never mounted, `analytics_storage` stuck `denied`
**Where:** `frontend-public/src/layouts/BaseLayout.astro:43-52` (consent default) + no banner component in `BaseLayout`/`Header`/`Footer`.
**Evidence:** BaseLayout sets `gtag("consent","default",{ analytics_storage:"denied", ... })` then loads GA4 (`G-0LK02F2HBW`). `grep` for any `consent ... update` / `analytics_storage: granted` / banner import across `frontend-public/src` → **none** (only the `default` block and a dangling `cookie-consent:show-banner` event in `cookies.astro:308` referencing a "consent-banner component (if mounted)" that is mounted nowhere). Result: no visitor can ever grant analytics consent → GA4 runs cookieless/modeled only. Measured gap: GA4 1 organic session vs GSC 9 organic clicks (28d).
**Impact:** GA4 data is unreliable (sessions, users, funnel, conversions all undercounted). You're trying to make product/marketing decisions on numbers that are wrong-low.
**Fix:** Mount a consent banner on the Astro public site (it was clearly intended — the event hook exists). On "Accept", call:
```js
gtag('consent','update',{ ad_storage:'granted', ad_user_data:'granted', ad_personalization:'granted', analytics_storage:'granted' });
```
and persist the choice (the `cookie-consent` localStorage keys in `cookies.astro` are already defined). Re-apply saved `granted` consent on load before GA fires. (The SPA panel `frontend/` already has a React cookie banner — port the same UX to the Astro public pages, or build a small `is:inline` banner in BaseLayout.)

### [CONTENT] Only 17 of 46 pages indexed — blog (24×2 locales) largely not in the index
**Where:** DB `indexedPages=17 / totalPages=46`. Unindexed ≈ the blog posts (all present in sitemap, both locales).
**Evidence:** Sampled `/blog/...vs-jasper...` → HTTP 200, self-canonical, valid `BlogPosting`+`BreadcrumbList` JSON-LD, 2312 words, no `noindex`. So it's **not** a technical block — it's discovery/freshness (sitemap repopulated ~2026-05-27) compounded by DA 10 (new domains get crawled slowly).
**Impact:** The blog is your main non-brand content asset and Google isn't showing most of it (posts get 1-6 impressions each).
**Fix:** (1) GSC → URL Inspection → Request Indexing on the highest-value posts (comparison/"how-much-does-it-cost" posts first) — **Google rate-limits to ~10 URLs/day/property, so spread across days.** (2) Add internal links from the home + AI landing pages to the blog (currently weak) so crawlers discover posts via links, not just sitemap. (3) The rest is time + authority — see strategy.

---

## P2 — Medium

### [LIVE] LCP ~4.0 s on mobile (home + landings) — Core Web Vitals "needs improvement"
**Where:** PSI mobile: `www.smart-copy.ai/` perf=78, **LCP 4.0s**, FCP 3.2s; `/pl/ai-seo-writer` perf=81, **LCP 4.1s**, FCP 2.9s. CLS=0, TBT=0-50ms (both excellent). SEO=100.
**Evidence:** Only flagged opportunity is "Reduce unused JavaScript ~63 KiB" — small. LCP/FCP both slow despite a static Astro site → points at TTFB (nginx/origin response) or a render-blocking hero/font, not JS weight.
**Impact:** CWV is a ranking signal and LCP 4s depresses conversion on a SaaS landing. Marginal at current traffic but compounds once you drive paid/organic visits.
**Fix:** Measure TTFB (`curl -w '%{time_starttransfer}'`) on the home HTML; if >0.6s it's nginx/origin (add caching/compression — note `Cache-Control: no-cache` was set on HTML in commit `b0da559`, which forces revalidation on every hit). Then: `<link rel="preload">` the LCP hero asset, `font-display: swap` + preload the primary font, and trim the 63 KiB unused JS. Re-test PSI after.

### [CONTENT] PL homepage `<title>` is 93 chars (truncates in SERP)
**Where:** `https://www.smart-copy.ai/pl/` — title "Generator AI do Pisania Tekstów | Sztuczna Inteligencja do Tworzenia Treści - Smart-Copy.ai" = **93 chars** (EN home is 59 — fine).
**Evidence:** Measured 93 chars; Google truncates ~60-65.
**Impact:** Tail of the title (brand + key phrase) is cut in results → lower CTR on the PL home, which is your best-impression PL page (573 impr).
**Fix:** Shorten to ≤60, lead with the primary phrase, e.g. "Generator AI do pisania tekstów — Smart-Copy.ai" or "Sztuczna inteligencja do tworzenia treści — Smart-Copy.ai". Locate in the PL home Astro page's HeadSeo title prop.

---

## P3 — Polish
- **[CONTENT] Non-brand commercial pages rank page 2-7, with the right intent but thin authority.** `seo writer` pos 14 (`/ai-seo-content-writer`), `ai copy generator` pos 55, `ai copywriting` pos 71. On-site is fine; these need content depth + internal links + backlinks to climb. Quick win: `ai do pisania tekstów` already ranks **pos 3** (PL) on low volume — lean into PL long-tail where competition is thin. (Editorial/off-site, listed for completeness.)
- **[LIVE] `SearchAction` (sitelinks searchbox) causes `/blog?q={search_term_string}` to be indexed** (3 impr). Harmless but noisy; if undesired, the template URL pattern can be excluded. Low priority.

---

## Unverified — needs re-run
- None. GA4/GSC/PSI/DB all queried live this run; PSI returned on first attempt (no 429).

## Skipped — not applicable to this profile
- **Product schema deep-validation / pagination / faceted search / out-of-stock (C-ecom, Profile C):** not e-commerce.
- **L1-L6 orphan/dead-end link graph (DB):** small public site (~10 landings + blog); link-graph analysis low value vs. the obvious "add internal links to blog" already noted in P1#3.
- **Satellite link-flow / Moz spam (Profile E):** not a satellite.
- **Astro mandatory pattern checks:** Consent-gating → CHECKED (became P1#2, inverse: no banner at all). `Astro.redirect` 302 default → CHECKED, all live redirects are 301. `sitemap-slugs` coverage → CHECKED, 48-URL sitemap covers all on-disk pages + both-locale blog, no gap.

---

## Sequence of recommended actions
1. **Delete fake `aggregateRating`** (`ProductSchema.astro:49-52`) → commit → deploy. (P1#1 — policy risk, do first.)
2. **Mount the consent banner** on the Astro public site so GA4 can be trusted (P1#2) → commit → deploy.
3. **Shorten PL home title** (P2) and **add internal links home/landings → blog** (P1#3) → deploy.
4. **GSC:** Request Indexing on top blog posts, **≤10/day**, spread over a week (P1#3).
5. **Perf pass:** measure TTFB, preload hero/font, trim unused JS, re-test PSI (P2#LCP).
6. Off-site (the actual traffic lever, outside this audit): backlinks/AI-tool directories, PL long-tail content, paid validation. See chat.

---

## Appendix — verification commands
- Live headers/redirects: `curl -sIL -A "Mozilla/5.0 (compatible; SEO-Audit/1.0)" <url>`
- Sitemap: `curl -s .../sitemap.xml` → 48 `<loc>`, 144 hreflang annotations, all absolute `www` host.
- DB (prod): `ssh panel` → `sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT d.domain,d.category,d.\"totalPages\",d.\"indexedPages\",d.\"mozDA\", di.status,di.\"lastSync\" FROM \"Domain\" d LEFT JOIN \"DomainIntegration\" di ON di.\"domainId\"=d.id AND di.provider='GOOGLE_ANALYTICS' WHERE d.domain ILIKE '%smart-copy%';"`
- PSI: PageSpeed v5 API, strategy=mobile, key from skill `.env`.
- GA4/GSC: see global procedure (property `properties/531378623`, `sc-domain:smart-copy.ai`).
