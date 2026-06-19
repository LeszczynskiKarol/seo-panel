# SEO on-site audit — sklad-tekstu.pl
**Date:** 2026-05-24 (rewritten 16:50 after verification pass)
**Profile:** B (content/services site) — 21 publicznych URL-i (1 home, 1 listing bloga, 9 wpisów, 9 stron usług, 1 kontakt). DB klasyfikuje jako `SATELLITE` ale realna charakterystyka to content/services.
**Stack:** Astro 5 (static export), `@astrojs/sitemap`, deploy: S3 `www.sklad-tekstu.pl` + CloudFront `EZH7ALPCBUX72`.
**Last crawl (DB):** 2026-05-24 03:04 | **GSC pull:** 2026-05-24 06:00 | **GA4 sync:** active
**Pages:** 24 śledzonych / 7 zindeksowanych / 21 w sitemapie | **DA (Moz):** 3 | **28d GSC:** 8 kliknięć / 286 wyświetleń
**Last live deploy:** ostatni `aws s3 sync` przed audytem (sitemap timestamp `2026-05-24T15:03:34Z`). W repo 7 nowych commitów po `2026-03-28` plus **5 uncommitted local fixes** (patrz "Zmiany lokalne czekające na deploy" poniżej).

---

## ⚠ Status audytu — przeczytaj najpierw

Pierwszy przebieg audytu (16:43) zawierał kilka błędów wynikających z dwóch quirków narzędzi (PowerShell 5.1 `Invoke-WebRequest -MaximumRedirection 0` rzuca exception na 3xx; WebFetch parafrazuje HTML). Po weryfikacji `curl`-em:

**5 false positives usuniętych:**
- ~~P0 apex domain `sklad-tekstu.pl` bez TLS / brak HTTP→HTTPS redirectu~~ → infra działa OK (`https://sklad-tekstu.pl/` → 301 → `https://www.sklad-tekstu.pl/`, `http://www.` → 301 → HTTPS). Cert ACM ma SAN, CloudFront ma listener :80.
- ~~P0 canonical broken na każdej stronie (`content=` zamiast `href=`)~~ → live HTML ma `<link rel="canonical" href="https://www.sklad-tekstu.pl/">`. Tag jest poprawny.
- ~~P1 `og-default.png` → 404~~ → live zwraca 200 OK, plik jest na S3.
- ~~P2 HSTS header niewysłany~~ → live ma `Strict-Transport-Security: max-age=31536000`.
- ~~P2 `<lastmod>` brak w sitemapie~~ → live sitemap ma `<lastmod>` na każdym URL (build z `2026-05-24T15:03:34Z`).

**5 lokalnych fixów uncommitted i niedeployed** (`git status --short`):
1. `public/robots.txt` (untracked, nowy plik) — naprawia P0 robots 404
2. `deploy.sh` — dodane `rm -rf dist/` przed buildem — naprawia P0 stale `dist/blog/*`
3. `src/components/SEO.astro` — og:image i twitter:image teraz absolute (`absoluteOgImage`)
4. `src/layouts/BlogLayout.astro` — dodane `ogType="article"` — naprawia P1 og:type
5. `src/components/CookieBanner.astro` — `loadGoogleScripts({analytics:false, marketing:false})` bezwarunkowo — naprawia P1 GTM consent gating

**Akcja minimum dla user'a:** odpalić `./deploy.sh` → większość findings P0/P1 zniknie automatycznie. Stary `dist/blog/` należy ręcznie usunąć **przed** pierwszym deployem (patrz P0 #2 poniżej), bo `rm -rf dist/` w deploy.sh wyleci dopiero przy następnym build, a obecny `dist/` w repo ma 3 katalogi-duby.

---

## ⚠ Data freshness caveats
- PSI Mobile API zwróciło 429 (quota) w trakcie audytu — sekcja Core Web Vitals do douczenia w osobnym przebiegu.
- GA4 raportuje 6 sesji / 28 d, przy 286 wyświetleniach w GSC. Strukturalnie tracking jest "opt-in po interakcji" zamiast Consent Mode v2 — patrz fix #5 wyżej. Po deployu fixu GTM zacznie wysyłać cookieless pings.

---

## P0 — Critical (fix this week)

### 1. `robots.txt` zwraca 404 (live) — fix gotowy lokalnie, nie deployed
**Where:** `https://www.sklad-tekstu.pl/robots.txt` → 404. Lokalnie istnieje `public/robots.txt` (`?? untracked`).
**Evidence:** `curl -sI https://www.sklad-tekstu.pl/robots.txt → 404 Not Found`. Plik lokalny zawiera `User-agent: * / Allow: / / Sitemap: https://www.sklad-tekstu.pl/sitemap-index.xml`.
**Impact:** Googlebot bez wskazówki o sitemapie + przy 17/24 niezindeksowanych stronach każda przeszkoda w crawl-budget liczy się podwójnie.
**Fix:**
1. `git add public/robots.txt && git commit -m "add robots.txt"`
2. `./deploy.sh`
3. Po deployu w GSC → "Ustawienia → Statystyki indeksowania → otwórz raport host" potwierdzić że Googlebot widzi 200.

### 2. Stale `dist/blog/*` katalogi — ryzyko przy następnym deployu
**Where:** `D:\sklad-tekstu.pl\dist\blog\jak-zaczac-z-latexem\`, `...\pdf-gotowy-do-drukarni\`, `...\sklad-podrecznika-akademickiego\`. Tych URL-i nie ma w `src/content/blog/*.md` ani w aktualnym `dist/sitemap-0.xml`.
**Evidence:** `ls -d D:/sklad-tekstu.pl/dist/blog/{jak-zaczac-z-latexem,pdf-gotowy-do-drukarni,sklad-podrecznika-akademickiego}` → wszystkie istnieją. Live wszystkie trzy URL-e zwracają 404, czyli już zostały usunięte z S3 przy poprzednim `--delete`. Ale `deploy.sh` (w wersji **zacommitowanej**) NIE czyści `dist/` przed buildem.
**Impact:** Pierwszy następny `./deploy.sh` z uncommitted zmianami będzie OK (bo `rm -rf dist/` jest w lokalnej wersji deploy.sh). Ale jeśli ktoś `git stash` zrobi i odpali, albo deploy pójdzie z CI bez tego fixu — re-push 3 starych wpisów na produkcję jako duble.
**Fix:**
1. Natychmiast: `Remove-Item -Recurse -Force D:\sklad-tekstu.pl\dist\blog\jak-zaczac-z-latexem, D:\sklad-tekstu.pl\dist\blog\pdf-gotowy-do-drukarni, D:\sklad-tekstu.pl\dist\blog\sklad-podrecznika-akademickiego`.
2. Closure: zacommitować `deploy.sh` ze zmianą `rm -rf dist/` (już lokalnie zrobione, brakuje commitu+pusha).

---

## P1 — High (fix this sprint)

### 3. GTM nie ładuje się dla użytkowników, którzy nie kliknęli baneru — fix gotowy lokalnie
**Where:** live `dist/index.html` (deployed wersja) — `loadGoogleScripts(consent)` wywoływany tylko w handlerach `accept-all`/`accept-selected`/`reject` + przy zapisanym consent w localStorage. Pierwsze wejście użytkownika bez kliknięcia → brak GTM.
**Evidence:** Diff lokalny `src/components/CookieBanner.astro`:
```diff
+ // Consent Mode v2: load GTM immediately with all categories denied.
+ loadGoogleScripts({ analytics: false, marketing: false });
```
**Impact:** 8 kliknięć w 28d GSC vs 6 sesji w GA4 — strukturalnie tracking jest "opt-in po interakcji" zamiast "ładuj zawsze + consent default denied". Po deployu fixu GA dostanie modelowane konwersje od Google.
**Fix:** deploy lokalnej zmiany. Już zrobione w kodzie.

### 4. `og:type=website` na wpisach blogowych zamiast `article` — fix gotowy lokalnie
**Where:** live `dist/blog/*/index.html`. Diff `src/layouts/BlogLayout.astro`:
```diff
+ ogType="article"
```
**Evidence:** `curl -s https://www.sklad-tekstu.pl/blog/co-to-jest-sklad-tekstu/ | grep og:type` → `og:type" content="website"`. JSON-LD na tych stronach to `BlogPosting`, więc niespójność.
**Impact:** Facebook/LinkedIn nie wyświetlają metadanych typowych dla artykułów (data publikacji, autor). LinkedIn nie plasuje w feedzie jako long-form.
**Fix:** deploy lokalnej zmiany.

### 5. Względna ścieżka `og:image` (live) → niektóre social crawlery nie resolwują — fix gotowy lokalnie
**Where:** live HTML: `<meta property="og:image" content="/og-default.png">`. Diff `src/components/SEO.astro` dodaje `absoluteOgImage`:
```diff
+ const siteOrigin = Astro.site?.toString().replace(/\/$/, '') ?? 'https://www.sklad-tekstu.pl';
+ const absoluteOgImage = ogImage?.startsWith('http') ? ogImage : `${siteOrigin}${ogImage}`;
- <meta property="og:image" content={ogImage} />
+ <meta property="og:image" content={absoluteOgImage} />
```
**Impact:** Większość crawlerów (FB, LinkedIn, Twitter) resolwuje względną ścieżkę względem strony, ale są edge cases (Slack, Discord, niestandardowe boty) gdzie pełna URL ratuje share preview.
**Fix:** deploy lokalnej zmiany.

### 6. 17 z 24 stron niezindeksowanych (`indexedPages: 7` w DB)
**Where:** wszystkie strony usług `/uslugi/*` (9 szt.) i większość wpisów blogowych poza `/`.
**Evidence:** `Domain.totalPages=24, indexedPages=7`. GSC 28d pokazuje wyświetlenia tylko dla 4 URL-i: `/`, `/uslugi/cwiczenia-arkusze/`, `/blog/`, `/uslugi/instrukcje-procedury/`.
**Impact:** Cała oferta usługowa — money pages — nie generuje ruchu. Konwertuje tylko home.
**Fix:**
1. Naprawić P0 robots.txt (#1) + deploy fixów #3-5.
2. W GSC → "Inspekcja URL → Poproś o zindeksowanie" dla każdej z 17 podstron.
3. W `src/pages/index.astro` sprawdzić że `ServiceCard.astro` linkuje do pełnych `/uslugi/<slug>/`, nie do hashtagów. (Hashtagi `/#uslugi` nie przekazują link equity).

### 7. Główny keyword "skład tekstu" na pozycji 17.8 — strata page-1 ruchu
**Where:** `/` (homepage) — query "skład tekstu" → 52 wyświetlenia, 0 kliknięć, avg position 17.8. Także "łamanie tekstu" 37.7, "skład i łamanie tekstu" 46, "skład podręcznika" 6 — wszędzie 0 kliknięć.
**Evidence:** GSC 28d. DA Moz = 3 (bardzo niski).
**Impact:** Domena nie zarabia. Każde wskoczenie z 17 → 10 to ~5-7× CTR uplift na head-keyword.
**Fix on-site (poza scope linkbuildingu):**
1. Wdrożyć fixy techniczne P0+P1 (poprawia crawl quality + signaling).
2. Wzmocnić H2 na homepage frazami semantycznymi: zamiast `§3 Realizacje` → `Skład i łamanie tekstu w LaTeX-u — 9 typów publikacji`.
3. Z `/blog/co-to-jest-sklad-tekstu/` (długi pillar) zrobić destination dla query "skład tekstu" — dodać kontekstowy link z home: "Czym właściwie jest skład tekstu? [Przeczytaj przewodnik]".

---

## P2 — Medium (fix when capacity allows)

### 8. Tytuły wpisów blogowych po 130+ znaków — obcięte w SERP
**Where:** np. `/blog/co-to-jest-sklad-tekstu/` — `<title>` 138 znaków: "Co to jest skład i łamanie tekstu — kompletny przewodnik po sztuce, która jest niewidoczna — Blog | sklad-tekstu.pl".
**Evidence:** Google SERP ucina po ~600 px (~60 znaków).
**Impact:** Brand "sklad-tekstu.pl" wypada w ellipsis, ważna końcówka tytułu obcięta.
**Fix:** w `src/layouts/BlogLayout.astro` zaaplikować strategię: keep title <60 chars, sufiks `| sklad-tekstu.pl` dodawany w `SEO.astro` (już jest, więc usunąć duplikujący `— Blog | sklad-tekstu.pl` z frontmattera wpisów). Alternatywa: akceptować dla długich poradników z opisowymi tytułami, ale wtedy trzymać brand z przodu.

### 9. Liczba mnoga "skład tekstów" na pozycji 31 — opportunity
**Where:** GSC 28d, query "skład tekstów" — 6 wyświetleń, avg position 31, 0 kliknięć.
**Evidence:** strona w ogóle nie używa wariantu w liczbie mnogiej.
**Impact:** Drobny ruch ogonowy.
**Fix:** wrzucić frazę w 2-3 miejscach w `src/pages/index.astro` (sekcja "Usługi" lub "Dlaczego LaTeX") — np. "...wykonujemy skład tekstów dla wydawnictw akademickich".

### 10. Hashe `data-astro-cid-*` na każdym elemencie — niepotrzebny ciężar HTML
**Where:** `dist/index.html` ~97 KB; każdy element w body ma atrybut `data-astro-cid-37fxchfa`/`-3ef6ksr2` itd.
**Evidence:** Scoped CSS Astro generuje atrybuty per komponent. Przy ~600+ elementach na home to ~10-15 KB nadmiarowego HTML.
**Impact:** Mały (CloudFront gzipuje), ale perceived loading na 3G/mobile.
**Fix:** rozważyć przeniesienie globalnych styli z `<style>` w komponentach do `src/styles/global.css` — wtedy Astro nie generuje scoped klas. Decyzja designerska.

---

## P3 — Polish (backlog)

- **Brak `apple-touch-icon`** — favicon tylko SVG. Dodać `public/apple-touch-icon.png` 180×180 + referencja w `BaseLayout.astro`.
- **Cookie banner inline JS w `<body>`** — drobny CLS przy starcie. Niski priorytet.
- **`/showcases/*.jpg` 513 KB każdy** (8 obrazków = 4 MB galeria). Skompresować do WebP/AVIF (~80 KB każdy), JPG fallback. Jeśli galeria jest above-the-fold.
- **3-hop redirect dla `http://sklad-tekstu.pl`** (`http://apex → https://apex → https://www`). Idealnie 1-hop z apex od razu do `https://www.sklad-tekstu.pl/`. Marginalna optymalizacja; CF Function albo edge redirect zrobi to w jednym skoku.

---

## Unverified — needs re-run

- **PSI Mobile / Desktop Core Web Vitals** — API zwróciło 429 (quota). Re-run: `Invoke-RestMethod "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://www.sklad-tekstu.pl/&strategy=mobile"` za ~1h.
- **CrUX field data** — wymaga PSI; LCP/CLS/INP per origin nieznane.
- **Indexing of money pages po deployu fixów** — re-run audytu za 14 dni żeby zobaczyć czy `indexedPages` rośnie z 7 do ~20.

---

## Skipped — not applicable to this profile

- **T16 hreflang** — serwis jednojęzyczny (PL).
- **C11 product schema (Product/Offer/AggregateRating)** — to nie e-commerce, brak SKU/cen.
- **L1 orphan analysis (link graph)** — 21 URL-i, sprawdzone manualnie sitemap + Header.astro + Footer.astro. Wszystkie strony usług dostępne z `/uslugi/<slug>` przez dropdown w nagłówku; wpisy blogowe z `/blog/`. Nie wymaga graf-analizy.
- **C7 word count >300 na content pages** — sprawdzony losowy wpis ma 6000+ słów; cała seria long-form.
- **T21-T23 deep AWS audit (Route53/S3 bucket policy)** — homepage 200 przez CloudFront, asset 200, cache hit, HSTS set, redirect chain działa — zdrowy setup.
- **Satellite-specific outbound link audit + anchor diversity** — DB tag `SATELLITE` ale realnie to content/services (brak masowych linków wychodzących, własna marka, długie unikalne treści).

---

## Sequence of recommended actions

1. **Teraz:** `Remove-Item -Recurse -Force D:\sklad-tekstu.pl\dist\blog\jak-zaczac-z-latexem, D:\sklad-tekstu.pl\dist\blog\pdf-gotowy-do-drukarni, D:\sklad-tekstu.pl\dist\blog\sklad-podrecznika-akademickiego`
2. `git add public/robots.txt public/og-default.png && git commit -m "add robots.txt + og:image asset"`
3. `git add deploy.sh src/ && git commit -m "fix: deploy clean, GTM consent mode v2, og:image absolute, blog og:type=article"`
4. `./deploy.sh`
5. W GSC po deployu: zgłosić sitemap (jeśli jeszcze nie), zindeksować 17 podstron przez "Inspekcja URL".
6. Za 14 dni: re-run audytu żeby sprawdzić indexedPages + PSI Core Web Vitals.
7. Wziąć się za on-page content fix (P1 #6 → ServiceCard linkowanie, H2 frazy semantyczne, pillar link z home → przewodnika).

---

## Appendix — dane źródłowe (potwierdzone curl-em 16:50)

### GSC 28 d — page-level
| Clicks | Impr | CTR | Avg Pos | Page |
|---|---|---|---|---|
| 5 | 185 | 2.70% | 17.8 | `/` |
| 3 | 81  | 3.70% | 3.6  | `/uslugi/cwiczenia-arkusze/` |
| 0 | 13  | 0%    | 4.6  | `/blog/` |
| 0 | 7   | 0%    | 4.9  | `/uslugi/instrukcje-procedury/` |

### GSC 28 d — query-level (top 10)
| Clicks | Impr | Avg Pos | Query |
|---|---|---|---|
| 0 | 52 | 17.7 | skład tekstu |
| 0 | 19 | 37.7 | łamanie tekstu |
| 0 | 18 | 13   | wykonywał skład tekstu w drukarni |
| 0 | 14 | 46   | skład i łamanie tekstu |
| 0 | 10 | 6    | skład podręcznika |
| 0 | 7  | 7    | sklad tekstu (bez diakrytyk) |
| 0 | 6  | 31   | skład tekstów |
| 0 | 1  | 20   | latex pl |
| 0 | 1  | 47   | łamanie kolumn |

### GA4 28 d
`sessions: 6 | totalUsers: 6 | screenPageViews: 10` — wartość zaniżona przez GTM consent gating (#3).

### Verification commands used (curl, raw HTTP — nie WebFetch ani IWR -MaximumRedirection)
```bash
curl -sIL "https://sklad-tekstu.pl/"             # apex → www, OK
curl -sIL "http://www.sklad-tekstu.pl/"          # http→https, OK
curl -sI  "https://www.sklad-tekstu.pl/robots.txt"  # 404 (REAL)
curl -sI  "https://www.sklad-tekstu.pl/og-default.png"  # 200 (live OK)
curl -sI  "https://www.sklad-tekstu.pl/" | grep -i strict-transport  # HSTS set
curl -s "https://www.sklad-tekstu.pl/sitemap-0.xml" | head  # lastmod present
curl -s "https://www.sklad-tekstu.pl/" | grep -oE 'rel="canonical"[^>]*'  # href= correct
```
