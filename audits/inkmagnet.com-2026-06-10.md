# SEO on-site audit — inkmagnet.com / inkmagnet.pl (strony publiczne)

**Date:** 2026-06-10
**Profile:** D — SaaS landing (2 strony indeksowalne EN/PL + 4 legal noindex; konwersja = rejestracja w app.inkmagnet.com). Zakres: tylko strony publiczne — app.* wykluczone z audytu na życzenie (poza jednym findingiem o wycieku indeksowalności app, który dotyczy SEO domeny publicznej).
**Stack:** Astro 5 (static, `site/` w repo ebooks_generator_ai), S3 `inkmagnet-site-prod` + CloudFront E2HQKNVM051L97 (funkcja `inkmagnet-site-router`), sitemap przez @astrojs/sitemap, GA4 G-QLDSL0FSYN z Consent Mode v2.
**Repo↔prod state:** live HTML == lokalny `dist/` (zweryfikowane diffem), ALE całe `site/` jest untracked w git — produkcja zbudowana ze źródła, którego nie ma w repo.
**GSC/GA:** pominięte na życzenie (domena postawiona dziś; per notatki sesji launchowej property `sc-domain:inkmagnet.com` jest zweryfikowane, a sitemap zgłoszony). Domeny nie ma natomiast w seo_panel (0 wierszy w prod `Domain`).
**Pages:** 6 publicznych (2 indeksowalne: `/`, `/pl/`; 4 legal z noindex), 2 w sitemap.

> **UPDATE 2026-06-10 wieczorem — P1 #1, #2, #3 WDROŻONE** (commit `seo: landing site/ do repo...`, deploy S3 + invalidacja obu dystrybucji, zweryfikowane live):
> 1. app.inkmagnet.com: `<meta name="robots" content="noindex, nofollow">` w HTML, `/robots.txt` → 200 z `Disallow: /`
> 2. Inter self-hosted (`site/public/fonts/`, @font-face inline + preload + metric-matched fallback) — PSI po fixie: **perf 98, CLS 0, FCP 0,8 s, LCP 2,4 s**, render-blocking zniknął (pierwszy przebieg po invalidacji pokazał LCP 3,8 s — zimny edge, drugi przebieg potwierdza poprawę)
> 3. `site/` scommitowane (40 plików; `package-lock.json` pominięty zgodnie z konwencją root `.gitignore`)
>
> Otwarte pozostają: seo_panel (P1 #4) i kosmetyka P3.

---

## ⚠ Drift summary — repo ↔ prod

| Plik | Status | W repo | Na live | Akcja |
|------|--------|--------|---------|-------|
| `site/` (cały projekt Astro) | `??` untracked | brak | zdeployowane (Last-Modified 2026-06-10 14:50, identyczne z lokalnym dist) | COMMIT — `site/.gitignore` już wyklucza `node_modules/ dist/ .astro/ asset-src/` |
| Infra .pl (R53 Z07240443B5Y0DQPY27YL, CF END7VB3WUX7OD, ACM, funkcja `inkmagnet-pl-redirect`) | n/a (click-ops) | brak | AKTYWNE — 301 → inkmagnet.com/pl/ działa | opcjonalnie spisać jako IaC |

Live == dist, więc nie ma driftu treści — drift jest w trackingu źródła.

---

## P0 — Critical (fix this week)

*(brak — wstępny kandydat na P0 okazał się fałszywym alarmem, patrz niżej)*

> **Uwaga / false alarm wykluczony:** lokalny resolver (router funbox.home) ma jeszcze w cache
> stare NS `ns1/ns2.aftermarket.pl` (A=185.253.212.22 → parking z błędnym certem). Weryfikacja
> przez 8.8.8.8 i 1.1.1.1: NS inkmagnet.pl = `ns-1692.awsdns-19.co.uk` (+3 AWS), A = CloudFront
> (18.239.83.x), a `curl --resolve inkmagnet.pl:443:18.239.83.94 https://inkmagnet.pl/` →
> `301 → https://inkmagnet.com/pl/` (działa też dla http i www). Delegacja jest przepięta
> i spropagowana globalnie; lokalny cache wygaśnie sam (TTL delegacji do 48 h).

---

## P1 — High (fix this sprint)

### [LIVE] app.inkmagnet.com jest w pełni indeksowalne (brak noindex, robots.txt → 403)
**Where:** `frontend/index.html` (shell SPA), dystrybucja CF E2ME7INHY8VH86 (`app.inkmagnet.com`).
**Evidence:**
- `curl https://app.inkmagnet.com/` → 200, `<title>InkMagnet — AI eBook Generator</title>`, **brak** `<meta name="robots">`
- `https://app.inkmagnet.com/robots.txt` → **403 AccessDenied** (S3) — kod 4xx Google traktuje jak „brak robots.txt = crawluj wszystko"
- Funkcja SPA `inkmagnet-app-spa` zwraca 200 dla dowolnej ścieżki (`/auth/login`, `/auth/register` → 200) — każdy URL aplikacji jest indeksowalnym duplikatem shella.
**Impact:** Pusty shell SPA może konkurować w indeksie z landingiem (podobny title), a nieskończona przestrzeń URL-i app/* generuje thin content.
**Fix:**
1. W `frontend/index.html` po linii 5 dodać: `<meta name="robots" content="noindex, nofollow" />`
2. Utworzyć `frontend/public/robots.txt` (katalog `public/` jeszcze nie istnieje — Vite skopiuje go do builda) z treścią:
   ```
   User-agent: *
   Disallow: /
   ```
3. Re-deploy frontu. Weryfikacja: `curl -s https://app.inkmagnet.com/robots.txt` → 200 z `Disallow: /`.

### [LIVE] Render-blocking Google Fonts + CLS od swapu Inter — jedna przyczyna, dwa skutki
**Where:** `site/src/layouts/BaseLayout.astro:75-80` (link do `fonts.googleapis.com/css2?family=Inter...`).
**Evidence (PSI mobile, 2026-06-10):**
- Performance: **84** (home), **82** (/pl/); SEO: 100/100
- `render-blocking-insight`: arkusz `fonts.googleapis.com/css2?...Inter...` — wasted **752 ms**, est. savings **1 790 ms** (home) / **2 260 ms** (/pl/)
- FCP 2,6 s / 3,1 s; LCP 3,0 s / 3,1 s
- CLS **0,159** (home) / **0,144** (/pl/) — `cls-culprits-insight` wskazuje wprost: „cause: Web font" (`fonts.gstatic.com/s/inter/v20/...woff2`), przesuwa się akapit hero
**Impact:** Jedyny istotny hamulec wydajności konwersyjnego landingu — CSS jest w 100% inline (`inlineStylesheets: "always"`), więc font to ostatni zewnętrzny zasób blokujący render; CLS 0,15 jest na granicy „needs improvement" (próg dobrego: 0,1).
**Fix (self-host Inter):**
1. `npm i @fontsource-variable/inter` w `site/`, w `site/src/styles/global.css` dodać `@import "@fontsource-variable/inter";` (albo ręcznie: subset latin+latin-ext woff2 do `site/public/fonts/` + `@font-face` z `font-display: swap` w global.css — inline'uje się do HTML).
2. Usunąć linie 75–80 z `BaseLayout.astro` (preconnecty + stylesheet Google Fonts).
3. Dodać w `<head>`: `<link rel="preload" href="/fonts/inter-latin-wght.woff2" as="font" type="font/woff2" crossorigin />` (ścieżkę dopasować do wybranego pliku).
4. Opcjonalnie domknąć CLS: fallback z metrykami — `@font-face { font-family: "Inter-fallback"; src: local("Arial"); ascent-override: 90%; descent-override: 22.5%; line-gap-override: 0%; size-adjust: 107%; }` i `font-family: InterVariable, "Inter-fallback", sans-serif`.
5. Rebuild + deploy + ponowny PSI (oczekiwane: render-blocking znika, CLS < 0,05, perf ≥ 95).

### [WORKFLOW] Domeny nie ma w seo_panel — crony nie zbierają danych od startu
**Where:** prod `seo_panel.Domain` (query `ILIKE '%inkmagnet%'` → 0 rows, zweryfikowane na hoście `panel`).
**Evidence:** patrz wyżej. GSC property `sc-domain:inkmagnet.com` i sitemap są już ogarnięte (sesja launchowa: weryfikacja przez SA, Karol dodany jako owner, sitemap zgłoszony) — ten finding dotyczy WYŁĄCZNIE seo_panel.
**Impact:** `gsc_pull`/`ga4_sync`/`indexing_check` pominą domenę — za 28 dni nie będzie historii danych od dnia zero.
**Fix:** Dodać `inkmagnet.com` do prod `Domain` (kategoria SaaS, `gscProperty = sc-domain:inkmagnet.com`) + wiersz `DomainIntegration` GOOGLE_ANALYTICS z `propertyId = properties/541024234`. Domena .pl tylko przekierowuje (301) — nie dodawać, nie ma czego monitorować.

### [DRIFT→COMMIT] Całe `site/` (źródło produkcyjnego landingu) jest poza gitem
**Where:** `D:\ebooks_generator_ai\site\` — `git status` pokazuje `?? site/`.
**Evidence:** Live HTML == lokalny `dist/` (diff czysty), ostatni commit repo 2026-02-19, deploy live 2026-06-10 14:50 — produkcja istnieje wyłącznie jako lokalne pliki. `site/.gitignore` już poprawnie wyklucza `node_modules/`, `dist/`, `.astro/`, `asset-src/`.
**Impact:** Utrata dysku = utrata źródła produkcyjnej strony; brak historii zmian SEO-krytycznych plików (BaseLayout, robots, config).
**Fix:** `git add site/ && git commit -m "site: publiczny landing inkmagnet (Astro)"` — gitignore już przygotowany, nic więcej nie wycieknie.

---

## P2 — Medium

*(brak — pozostałe znaleziska są kosmetyczne, patrz P3)*

## P3 — Polish (backlog)

### [CONTENT] Pusty alt na zdjęciu strony rozdziału w hero
**Where:** `site/src/components/Landing.astro:116` (`<Image src={pageChapter} alt="" ...>`).
**Evidence:** live: `<img src="/_assets/page-chapter...webp" alt loading="eager">` — jedyny img bez treści alt na stronie.
**Fix:** `alt=""` → `alt="Typeset chapter page from an InkMagnet ebook"` (PL wariant analogicznie, jeśli komponent współdzielony — przez props/i18n).

### [CONTENT] Meta description home = 164 znaki (utnie się w SERP)
**Where:** `site/src/pages/index.astro` (description przekazywany do BaseLayout).
**Evidence:** live desc: „Turn your expertise into a professional ebook... From $9.99 per book." — 164 zn. (limit ~155–160).
**Fix:** skrócić o ~10 znaków, np. usunąć „cover design and" → „AI research, writing, illustrations and print-quality PDF + EPUB. From $9.99 per book." Sprawdzić też wariant PL (obecnie w normie? — 161 zn., również na granicy).

### [LIVE] Warianty bez trailing slash serwują 200 zamiast 301
**Where:** funkcja CF `inkmagnet-site-router` (dystrybucja E2HQKNVM051L97).
**Evidence:** `curl -sI https://inkmagnet.com/privacy` → 200 (ta sama treść co `/privacy/`); `/pl` → 200. Duplikaty mitygowane canonicalem (wszystkie wskazują wersję ze slashem).
**Fix (opcjonalny):** w `inkmagnet-site-router` dodać na początku: jeśli URI nie ma kropki i nie kończy się `/` → `301` na `uri + '/'`.

### [LIVE] Responsive images — ~111 KiB do odzyskania
**Where:** `Landing.astro` — `page-illustration*`, `app-structure`, `page-chapter`, `app-download` (webp serwowane 900 px szer. przy wyświetlaniu ~634 px).
**Evidence:** PSI `image-delivery-insight`: est. savings 111 KiB (home) / 106 KiB (/pl/).
**Fix:** w komponentach `<Image>` dodać `widths={[480, 900]}` + `sizes="(max-width: 768px) 100vw, 634px"` — astro:assets wygeneruje srcset.

### [LIVE] Brak apple-touch-icon i fallbacku PNG dla favicon
**Where:** `BaseLayout.astro:72` — tylko `favicon.svg`.
**Fix:** dodać `site/public/apple-touch-icon.png` (180×180) + `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`.

---

## Unverified — needs re-run
- **CWV field data (CrUX)** — brak danych polowych (domena z dziś); PSI to wyłącznie lab data. Re-run za ~28 dni.
- **Stan w GSC** (pokrycie indeksem, skuteczność zgłoszonego sitemap) — wykluczone z tego audytu na życzenie; sensowny pierwszy odczyt za ~14 dni.

## Skipped — not applicable to this profile
- I1–I6 (indeksacja GSC) — domena postawiona dziś, brak danych; wykluczone na życzenie.
- Tail signals GA4/GSC — jw.
- C2/C4 (duplikaty title/desc) — 2 strony indeksowalne, sprawdzone ręcznie, różne; brak skali do analizy duplikatów.
- L1/L2 (orphany/dead-endy) — graf linków to 6 stron, wszystkie podlinkowane z header/footer.
- C11 Product schema — to nie e-commerce; SoftwareApplication + Offer obecne i poprawne.
- Audyt app.inkmagnet.com (poza indeksowalnością) — wykluczony na życzenie.
- Mandatory Astro check: Consent Mode gating — **uruchomiony, przeszedł** (gtag.js ładuje się od razu z domyślnym denied w `Analytics.astro`, nie jest bramkowany banerem); odnotowuję, bo skill wymaga jawnego potwierdzenia, że check nie został pominięty. `Astro.redirect()` — nie występuje w `site/src`. `sitemap-slugs` — brak dynamicznych kolekcji, nie dotyczy.

---

## Sequence of recommended actions
1. **Kod** (jeden commit + deploy):
   - `frontend/index.html` — meta robots noindex; nowy `frontend/public/robots.txt` z `Disallow: /`
   - `site/` — self-host Inter (usunąć Google Fonts z `BaseLayout.astro:75-80`), alt na `Landing.astro:116`, skrócić description, opcjonalnie srcset + apple-touch-icon
   - `git add site/ frontend/ && git commit` (site dotąd untracked!)
   - rebuild + `aws s3 sync` + invalidation dla obu dystrybucji
2. **seo_panel**: dodać inkmagnet.com do prod `Domain` + integrację GA4 (properties/541024234).
3. **Po deployu**: ponowny PSI (oczekiwane ≥95/100, CLS <0,05).

---

## Appendix — zbadane URL-e
| URL | Status | Canonical | Robots | Uwagi |
|-----|--------|-----------|--------|-------|
| https://inkmagnet.com/ | 200 | self | — | title 51 zn., desc 164 zn., 1×H1, JSON-LD: Organization+WebSite+SoftwareApplication+FAQPage (parsuje) |
| https://inkmagnet.com/pl/ | 200 | self | — | hreflang en/pl/x-default spójny dwukierunkowo |
| /privacy/, /terms/, /pl/polityka-prywatnosci/, /pl/regulamin/ | 200 | self | noindex,nofollow | celowe, poza sitemap |
| /nonexistent-xyz/ | 404 | — | — | poprawny status |
| http→https, www→apex | 301 | — | — | poprawne, HSTS max-age=31536000 |
| https://app.inkmagnet.com/ | 200 | — | **BRAK** | finding P1 |
| http(s)://inkmagnet.pl/, www | 301 → https://inkmagnet.com/pl/ | — | — | OK (test przez `--resolve` na świeże IP; lokalny router ma stale cache NS) |

## Appendix — verification commands
```bash
curl -sIL -A "Mozilla/5.0" https://inkmagnet.com/            # redirect chain + nagłówki
curl -s https://inkmagnet.com/robots.txt
curl -s https://inkmagnet.com/sitemap-0.xml
nslookup -type=NS inkmagnet.pl 8.8.8.8                        # NS (przez publiczny resolver — router ma stale cache!)
curl -sI --resolve inkmagnet.pl:443:18.239.83.94 https://inkmagnet.pl/   # 301 → inkmagnet.com/pl/
curl -s https://app.inkmagnet.com/robots.txt                  # 403 = finding
# PSI (klucz w ~/.claude/skills/seo-audit-onsite/.env):
# GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Finkmagnet.com%2F&strategy=mobile
# prod DB:
# ssh panel: sudo -u postgres psql -d seo_panel -c "SELECT * FROM \"Domain\" WHERE domain ILIKE '%inkmagnet%';"
# R53: aws route53 list-resource-record-sets --hosted-zone-id Z07240443B5Y0DQPY27YL
```
Cache HTML: `D:\seo-panel\audits\cache\inkmagnet.com\`
