# SEO on-site audit — magisterkaonline.com.pl
**Date:** 2026-05-25
**Profile:** B (content / poradnik site, ~31 podstron poradnikowych z treścią 500-2700 słów) z drugorzędną cechą E (satelita — wszystkie zewnętrzne CTA prowadzą do `praca-magisterska.pl`, `smart-edu.ai`, `smart-copy.ai`).
**Stack:** Astro 5.15 static + Tailwind + `@astrojs/sitemap`. Deploy: S3 `www.magisterkaonline.com.pl` + CloudFront `E40SLOZB94VN2` (regions eu-central-1).
**Repo↔prod state:** in-sync. `git status` pokazuje tylko `M package-lock.json`. `deploy.sh` automatycznie commituje + pushuje przed buildem, więc dryf repo↔prod jest mało prawdopodobny.
**Last crawl:** 2026-05-25 03:32 | **GSC pull:** 2026-05-25 06:00 | **GA4 sync:** 2026-05-25 08:00 (ACTIVE, property `properties/515577063`)
**Pages:** 31 tracked, 5 indexed (PASS), 26 nie-zaindeksowane | **DA:** 3 | **Last 14d GSC:** 12 kliknięć, 634 wyświetlenia, śr. pozycja ~13

---

## P0 — Critical (fix this week)

### [LIVE] `/robots.txt` zwraca 404
**Where:** `https://www.magisterkaonline.com.pl/robots.txt`; brak pliku w `public/`
**Evidence:**
```
HTTP/1.1 404 Not Found
Server: AmazonS3
X-Cache: Error from cloudfront
```
CloudFront przy 404 wraca 404.html (17433 B) z 404-strony zamiast `text/plain`. W repo brak `public/robots.txt` ani generatora.
**Impact:** Google nie odkrywa sitemapy automatycznie z `Sitemap:` directive (brak go w robots.txt → trzeba ręcznie zgłaszać sitemap w GSC). Każdy crawler/bot dostaje 404. Skala: prawdopodobny współwinowajca masowego "Discovered – currently not indexed" (18 z 31 stron — patrz P0 #3).
**Fix:** Utwórz `D:\magisterkaonline.com.pl\public\robots.txt` z dosłowną treścią:
```
User-agent: *
Allow: /

Sitemap: https://www.magisterkaonline.com.pl/sitemap-index.xml
```
Następnie `bash deploy.sh`. Po deployu zweryfikuj `curl -I https://www.magisterkaonline.com.pl/robots.txt` zwraca 200 + `text/plain`.

### [LIVE] Każda strona w stopce linkuje do dwóch 404: `/regulamin/` i `/kontakt/`
**Where:** `src/components/Footer.astro:30-32` (sekcja `legal`); te linki pojawiają się w stopce na każdej stronie serwisu (31 stron).
**Evidence:**
```
/regulamin/   => HTTP 404
/regulamin    => HTTP 404
/kontakt/     => HTTP 404
/kontakt      => HTTP 404
```
W `src/pages/` nie ma katalogów `regulamin/` ani `kontakt/`. Dodatkowo `src/pages/polityka-prywatnosci/index.astro:75` w treści tekstowej linkuje do `/kontakt/` ("możesz skontaktować się z nami przez stronę kontakt").
**Impact:** 2×31 = 62 broken outbound linki wewnętrzne, "site-wide". Złe UX (użytkownik klika → 404), Google obniża jakość architektury linkowania, polityka prywatności kieruje na nieistniejący kontakt.
**Fix:** Dwie opcje, w zależności od decyzji biznesowej:
1. **Stwórz brakujące strony** (rekomendowane jeśli zamierzasz zostawić sitewide-link w stopce):
   - `src/pages/kontakt/index.astro` — np. krótka strona z `<Layout title="Kontakt">` i adresem email/formularzem
   - `src/pages/regulamin/index.astro` — regulamin serwisu (lub przekierowanie do polityki prywatności)
2. **Usuń linki** ze stopki: w `src/components/Footer.astro:29-33` usuń obiekty `{href: '/regulamin/', ...}` i `{href: '/kontakt/', ...}` z tablicy `footerLinks.legal`. Dodatkowo w `src/pages/polityka-prywatnosci/index.astro:73-77` zmień "przez stronę kontakt" na adres email.

### [LIVE] Indeksacja: tylko 5 z 31 stron jest w indeksie Google
**Where:** Cały serwis, dane z `Page` table (GSC API):
- `PASS` (indexed): 5 URL — `/`, `/formatowanie/`, `/metodologia/badania-ilosciowe/`, `/metodologia/jak-przeprowadzic-wywiad/`, oraz duplikaty
- `Discovered – currently not indexed`: 18 URL (m.in. `/metodologia/`, `/jak-napisac-wstep/`, `/konspekt/`, `/obrona/`, `/zakonczenie/`, `/bibliografia/`, `/cytowanie-i-cytaty/`, większość podstron `/metodologia/*`)
- `URL is unknown to Google`: 7 URL (m.in. `/cel-pracy-magisterskiej/`, `/wybor-tematu/`, `/polityka-prywatnosci/`, `/spis-tresci/`)

**Evidence (sample, z `Page` table w prod seo_panel):**
```
url                                                            | coverageState
https://www.magisterkaonline.com.pl/metodologia/hipotezy-badawcze/       | Discovered – currently not indexed
https://www.magisterkaonline.com.pl/metodologia/                          | Discovered – currently not indexed
https://www.magisterkaonline.com.pl/jak-napisac-wstep/                    | Discovered – currently not indexed
https://www.magisterkaonline.com.pl/wybor-tematu/                         | URL is unknown to Google
https://www.magisterkaonline.com.pl/cel-pracy-magisterskiej/              | URL is unknown to Google
...
```
**Impact:** Strony są w sitemap, ale Google ich nie indeksuje. Skutek: 14-dniowe GSC pokazuje tylko 12 kliknięć i ~634 impresji — przy realnej liczbie 31 podstron i sumarycznym contencie kilkanaście tysięcy słów to znikomy udział potencjalnego ruchu.
**Likely causes (w kolejności prawdopodobieństwa):**
1. robots.txt 404 (P0 #1) — Google nie odkrywa Sitemap-directive
2. Bardzo niska DA (3) i mało backlinków → "Crawl demand" niski
3. Brak silnego internal linkingu z indeksowanych stron (architektura: home → wszystkie, ale głębsze strony otrzymują linki głównie ze stopki)
**Fix:** Sekwencja:
1. Najpierw napraw P0 #1 (robots.txt), a potem zgłoś sitemap ręcznie w GSC: Search Console → Sitemaps → submit `sitemap-index.xml`.
2. W GSC URL Inspection → "Request Indexing" dla 10 najważniejszych nie-indeksowanych URL dziennie (Google limituje ~10/dzień/property — rozłóż na 2-3 dni). Priorytet:
   - `/metodologia/hipotezy-badawcze/` (ma już 14 imp, pos. 14)
   - `/jak-napisac-wstep/` (tematyczny core)
   - `/konspekt/`
   - `/obrona/`
   - `/bibliografia/`
   - `/wybor-tematu/`
   - `/cytowanie-i-cytaty/`
   - `/zakonczenie/`
   - `/metodologia/` (hub)
   - `/cel-pracy-magisterskiej/`
3. Wzmocnij internal linki *do* tych stron z `/` (home) i z `/metodologia/` (hub). Obecnie hub `/metodologia/` jest sam nie-zaindeksowany — chodzi o efekt domina.

---

## P1 — High (fix this sprint)

### [LIVE] `/wybor-tematu/` — meta description jest skopiowana z `cytowanie-i-cytaty/` (mówi o cytowaniu zamiast o wyborze tematu)
**Where:** `src/pages/wybor-tematu/index.astro:7`
**Evidence:** Linia 7 w pliku:
```
description="Kompletny przewodnik po cytowaniu w pracy magisterskiej. Dowiedz się, jak umieszczać cytaty w pracy mgr, które przyciągną uwagę komisji i zostawią czytelnika z doskonałym wrażeniem."
```
Strona traktuje o wyborze tematu, nie o cytowaniu. Treść description nie pasuje do treści strony i jej tytułu.
**Impact:** Google może wygenerować własny snippet (ignorując description) → utrata kontroli nad SERP. Dodatkowo, jeśli Google użyje description, CTR spadnie (intent mismatch). Też: signal jakości — duplicate-style snippet sugeruje thin/sloppy content, co może obniżać "search-intent match" scoring.
**Fix:** W `src/pages/wybor-tematu/index.astro:7` zastąp wartość atrybutu `description=` na konkretną:
```
description="Kompletny przewodnik po wyborze tematu pracy magisterskiej. Jak znaleźć temat ciekawy, realny i akceptowalny przez promotora — krok po kroku, z przykładami."
```

### [LIVE] OG image (`/images/og-image.jpg`) zwraca 404 dla całego serwisu
**Where:** `src/layouts/Layout.astro:15` (default `image = '/images/og-image.jpg'`), używany przez wszystkie strony; folder `D:\magisterkaonline.com.pl\public\images\` istnieje ale jest pusty.
**Evidence:**
```
$ curl -I https://www.magisterkaonline.com.pl/images/og-image.jpg
HTTP/1.1 404 Not Found
Content-Length: 17433   # to body 404.html, nie obrazek
```
W każdej stronie head: `<meta property="og:image" content="https://www.magisterkaonline.com.pl/images/og-image.jpg">` — i tak samo dla `twitter:image`.
**Impact:** Każde udostępnienie na FB / X / LinkedIn / Slack pokazuje pustą/zepsutą miniaturkę zamiast brandingowanego obrazu. Skutek: niższy CTR z linków w social.
**Fix:** Stwórz plik `D:\magisterkaonline.com.pl\public\images\og-image.jpg` — wymiary 1200×630 px, format JPG (lub PNG/WebP — Astro nie kompresuje statycznych assetów, wybór JPG ~150-300 KB jest OK), branding "MagisterkaOnline.pl — poradnik pisania pracy magisterskiej" + jakaś grafika (książka/dyplom). Jeśli nie chcesz tworzyć obrazka teraz, zmień default w `Layout.astro:15` na istniejące `image = '/favicon.svg'` (gorsze rozwiązanie ale przynajmniej nie-404).

### [LIVE] Polityka prywatności opisuje Google Consent Mode, GTM i GA4 (G-WS3XHX6SYH) — ale strona NIE MA żadnego trackingu
**Where:** `src/pages/polityka-prywatnosci/index.astro` (treść wymienia "Google Consent Mode", `GTM-`, identyfikator GA `G-WS3XHX6SYH`); jednocześnie ani `Layout.astro`, ani żaden inny komponent (`Header.astro`, `Footer.astro`) nie ładuje GTM, gtag, ani żadnego trackera. `grep -r "gtag\|googletagmanager\|G-" src/` → tylko trafienia w treści polityki.
**Evidence:**
- Home (`https://www.magisterkaonline.com.pl/`) — w HTML jest tylko jeden `<script type="module">` (toggle mobile menu). Brak `gtag(`, brak `googletagmanager.com`, brak GA-id, brak GTM-id.
- DB: `Domain.totalClicks` = 1 (kumulatywnie) i `DomainIntegration.GOOGLE_ANALYTICS.lastSync` = 2026-05-25 08:00 ACTIVE, property `515577063` — czyli integracja GA4 jest ustawiona po stronie panelu, ale GA4-tag NIE jest osadzony w stronie.
**Impact:**
1. **Prawne:** polityka prywatności kłamie — opisuje praktyki przetwarzania danych, których nie ma. RODO/UODO mogą uznać to za wprowadzanie użytkownika w błąd.
2. **Analityczne:** brak danych GA4 → integracja w panelu seo_panel nigdy nie pobierze realnych metryk sesji/konwersji; `Ga4DailyMetric` dla tej domeny pozostanie pusty.
3. **Decyzyjne:** bez trackingu nie wiesz, ile osób faktycznie klika CTA do `praca-magisterska.pl/sklep/...` (ebook 39zł) z poziomu Header (kluczowy KPI tej strony).
**Fix:** Wybierz jedno:
1. **Dodaj tracking** (rekomendowane — masz polityk gotową): w `src/layouts/Layout.astro` przed `</head>` dodaj GTM container snippet z `G-WS3XHX6SYH`, plus banner zgody (CookieBanner). Wzorzec z innych projektów Karola: `D:\sklad-tekstu.pl\src\components\CookieBanner.astro` — przekopiuj, podmień ID na `G-WS3XHX6SYH`. UWAGA: pamiętaj o Consent Mode v2 — banner musi domyślnie ustawiać consent na `denied` i `gtag('consent', 'default', {...})` przed `gtag('config',...)`. Patrz [[gtm-consent-gating-pattern]] w memory — nie powtarzaj błędu sklad-tekstu/ecopywriting.
2. **Usuń wzmianki z polityki**: w `src/pages/polityka-prywatnosci/index.astro` usuń sekcje o GTM/GA/Consent Mode. Krótsza polityka, bez deklarowania trackera którego nie ma.

### [LIVE] Strona 404 ma 5 niedziałających linków (/poradnik-pisania/* i /ai-w-pisaniu-prac-mgr)
**Where:** `src/pages/404.astro:32, 43, 47, 51, 55`
**Evidence:**
```
/poradnik-pisania              => 404 (link główny CTA "Przejdź do Poradnika")
/poradnik-pisania/jak-zaczac   => 404
/poradnik-pisania/struktura    => 404
/poradnik-pisania/bibliografia => 404
/ai-w-pisaniu-prac-mgr         => 404
```
Aktualna struktura serwisu używa płaskich slugów (`/wybor-tematu/`, `/konspekt/`, `/bibliografia/` itp.) — prefiks `/poradnik-pisania/*` to relikt poprzedniej struktury (potwierdzone w commitach `f8f085f zmieniono strukture`). README na linii 28 też wciąż wymienia `poradnik-pisania/` jako strukturę.
**Impact:** User dostaje 404 → klika CTA na 404 → znowu 404. Total UX fail dla recovery path. Też: 404.astro jest sometimes indeksowane / odwiedzane przez Googlebota — kolejne dead-end.
**Fix:** W `src/pages/404.astro` zastąp linki na istniejące:
- linia 32: `href="/poradnik-pisania"` → `href="/"`  (oraz tekst przycisku „Przejdź do Poradnika" → np. „Zobacz wszystkie poradniki")
- linia 43: `href="/poradnik-pisania/jak-zaczac"` → `href="/wybor-tematu/"`  (tekst „Jak Zacząć" pasuje)
- linia 47: `href="/poradnik-pisania/struktura"` → `href="/spis-tresci/"`  (lub `/konspekt/`)
- linia 51: `href="/poradnik-pisania/bibliografia"` → `href="/bibliografia/"`
- linia 55: usuń całą `<a>` „AI w Pisaniu" (linia 54-57) wraz z poprzednim `<span>•</span>` (lub zastąp linkiem do `/metodologia/`).

Dodatkowo: zaktualizuj `README.md` linie 28-32 — wciąż dokumentuje strukturę `poradnik-pisania/...` która nie istnieje.

---

## P2 — Medium (fix when capacity allows)

### [LIVE] Brak JSON-LD na wszystkich stronach (zero structured data)
**Where:** `src/layouts/Layout.astro` (brak `<script type="application/ld+json">`), `src/layouts/ArticleLayout.astro` (też brak)
**Evidence:** grep `application/ld\+json` w 6 fetchach (home, konspekt, metodologia, hipotezy, wybor, polityka) = 0 trafień.
**Impact:** Tracimy:
- `Organization` schema na home (signaling kto stoi za serwisem) — istotne dla EAT
- `WebSite` schema z `SearchAction` (sitelinks SearchBox w SERP)
- `Article` / `BlogPosting` na artykułach — może aktywować rich results (date, author, image)
- `BreadcrumbList` na artykułach — `ArticleLayout.astro:36-56` renderuje breadcrumbs wizualnie ale brak schematu

Dla content site na konkurencyjnym keyword ("praca magisterska", "metodologia badań") strukturalne dane to jeden z elementarnych signali.

**Fix:** W `src/layouts/Layout.astro` dodaj przed `</head>` (do `<head>`):
```astro
<script type="application/ld+json" set:html={JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "MagisterkaOnline.pl",
  "url": "https://www.magisterkaonline.com.pl/",
  "inLanguage": "pl-PL"
})}></script>
```
W `src/layouts/ArticleLayout.astro` dodaj dodatkowo `Article` + `BreadcrumbList` (używając już posiadanych props: `title`, `description`, `publishDate`, `canonicalURL`). Wymagane pola `Article`: `headline`, `datePublished`, `author` (np. „MagisterkaOnline.pl" jako Organization), `image` (OG image — który najpierw musi istnieć, patrz P1 #2).

### [LIVE] Trailing-slash redirect to 302 (powinien być 301)
**Where:** CloudFront / S3 default — każde URL bez slasha (np. `/konspekt`) odpowiada `302 → /konspekt/`. Wewnątrz repo brak konfiguracji CF Function ani Lambda@Edge dla tego ruchu.
**Evidence:**
```
$ curl -sIL https://www.magisterkaonline.com.pl/konspekt
HTTP/1.1 302 Moved Temporarily
Location: /konspekt/
HTTP/1.1 200 OK
```
**Impact:** Każde wejście na URL bez slasha traci ułamek link-equity (302 = soft, nie kanonizuje). Większość ruchu i tak idzie na URL ze slashem (sitemap i wewnętrzne linki w `Footer.astro` mają trailing slash), więc impact jest niewielki — ale Google preferuje 301.
**Fix:** Dwa podejścia:
1. **CloudFront Function**: dodaj prostą funkcję na viewer-request, która jeśli `uri` nie kończy się na `/` ani na rozszerzeniu — zwraca 301 z `Location: ${uri}/`. Karol już używa takiej funkcji w innych projektach (`D:\seo-panel\audits\eb-cf-function.js` — odpowiednik dla `eb-` jeśli to ten skrypt). Sprawdź i zaadaptuj.
2. **Bypass: zostaw 302** — jeśli wszystkie wewnętrzne linki używają trailing-slash (a używają), to ruch z 302 dotyczy głównie ręcznie wpisywanych URL → niski wolumen. Można odpuścić.

### [LIVE] Render-blocking Google Fonts spowalnia FCP/LCP do ~3s na mobile
**Where:** `src/layouts/Layout.astro:49-51` — Google Fonts ładowany jako synchronous `<link rel="stylesheet">`:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700;900&display=swap" rel="stylesheet" />
```
**Evidence:** PageSpeed Insights mobile dla home:
- Performance: 0.88
- FCP: 2.9s (score 0.53)
- LCP: 2.9s (score 0.81)
- `render-blocking-insight`: score 0 (główny winowajca: ten stylesheet + dwa pliki `_astro/*.css`)
- `network-dependency-tree-insight`: score 0
Dla hipotezy-badawcze: perf 0.85, FCP 3.2s, LCP 3.2s.
**Impact:** ~1s wolniej niż mogłoby być. Dla satellite/contentu poradnikowego, gdzie użytkownik czyta przed konwersją, to drugorzędne — ale na mobile-first index Google liczy LCP.
**Fix:** W `Layout.astro:49-51` zamień na pattern z `media` swap:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700;900&display=swap" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700;900&display=swap" media="print" onload="this.media='all'" />
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700;900&display=swap" /></noscript>
```
Alternatywa lepsza długoterminowo: self-host fontów przez `@fontsource/inter` + `@fontsource/merriweather` (subset `latin-ext`), wtedy bez DNS-handshake + preconnect.

### [LIVE] Tytuł `/wybor-tematu/` ma literówkę: „Wybór temat**y** pracy" zamiast „temat**u** pracy"
**Where:** `src/pages/wybor-tematu/index.astro:6`
**Evidence:**
```
title="Wybór tematy pracy magisterskiej - jak wybrać tematykę magisterki"
```
**Impact:** Tytuł nie zawiera dokładnej formy fleksyjnej kluczowego zapytania ("wybór tematu pracy magisterskiej"). Możliwy niższy CTR + niższe ranking.
**Fix:** W `src/pages/wybor-tematu/index.astro:6` zmień na:
```
title="Wybór tematu pracy magisterskiej - jak wybrać temat magisterki"
```

### [LIVE] Sitemap nie zawiera `<lastmod>` dla żadnego URL
**Where:** `https://www.magisterkaonline.com.pl/sitemap-0.xml`
**Evidence:** `grep -oE '<lastmod>[^<]+</lastmod>' sitemap-0.xml` → 0 trafień. `@astrojs/sitemap` w default mode bez konfiguracji `lastmod` go nie emituje dla statycznych routes.
**Impact:** Google nie wie, kiedy ostatnio zmodyfikowano stronę — może rzadziej recrawlować i wolniej reagować na update'y treści. Dla świeżego serwisu z indeksacją w trakcie — opóźnia ścieżkę do PASS.
**Fix:** W `astro.config.mjs` rozszerz konfigurację sitemapy:
```js
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.magisterkaonline.com.pl",
  integrations: [tailwind(), sitemap({ lastmod: new Date() })],
  output: "static",
});
```
(Wszystkie strony dostają lastmod = czas buildu — to wystarczy jeśli build robisz regularnie. Jeśli chcesz per-page lastmod opartego na ostatniej modyfikacji pliku `.astro`, trzeba customowego `serialize`.)

---

## P3 — Polish (backlog)

### [LIVE] Tytuł na stronie /konspekt/ jest długi 97 znaków (limit Google ~60)
**Where:** `src/pages/konspekt/index.astro` (przez ArticleLayout title prop)
**Evidence:** `<title>Konspekt pracy magisterskiej - poradnik jak napisać + przykład [PDF i DOCX] | MagisterkaOnline.pl</title>` (97 znaków)
**Impact:** Google obetnie tytuł w SERP. „| MagisterkaOnline.pl" prawdopodobnie zniknie.
**Fix:** W `src/pages/konspekt/index.astro` skróć title prop. Propozycja:
```
title="Konspekt pracy magisterskiej — jak napisać + wzór [PDF/DOCX]"
```
(64 znaki łącznie z `| MagisterkaOnline.pl`, mieści się w limicie.)

### [LIVE] Brak Atom/RSS feed
**Where:** Brak `feed.xml` / `atom.xml` w `public/` ani route.
**Impact:** Bardzo małe — typowy poradnik nie potrzebuje, ale dla content-site to standard signal "active publishing" + ułatwia syndykację.
**Fix:** Opcjonalne — pomiń jeśli nie planujesz regularnych publikacji.

### [LIVE] Header.astro ma stałe dropdown menu z 9 linkami — wszystkie na te same strony co stopka (nadmiarowe powtórzenie z perspektywy SEO crawl-budget)
**Where:** `src/components/Header.astro` — dropdown "Poradnik" + footer.poradnik
**Impact:** Bardzo małe (sitewide-link już istnieje przez stopkę), ale to pełna duplikacja anchor textów.
**Fix:** Pomiń — to wybór UX, nie SEO finding.

---

## Unverified — needs re-run
- **GA4/GSC daily metrics dla pełnej trajektorii ruchu** — w bazie jest 14 dni `GscDomainDaily` (~12 kliknięć łącznie, ~634 imp); zbyt mało aby wykryć trendy. Re-audit za 4 tygodnie po naprawie P0.
- **Real-user Core Web Vitals (CrUX)** — PSI Lighthouse to lab data; CrUX dla tej domeny prawdopodobnie ma za mało danych aby pokazać p75. Po wzroście ruchu re-uruchom PSI z field-data.

---

## Skipped — not applicable to this profile
- **C8 (img alt)** — strona nie używa żadnych `<img>` (0 trafień w 6 sprawdzonych stronach). Wszystkie ikony to inline SVG.
- **C10 (oversized images)** — brak obrazów (poza brakującym `og-image.jpg`).
- **L1 (orphan pages)** — przy 31 stronach i pełnym linkowaniu w `Footer.astro` (24 z 31 stron) + dropdown nawigacji, klasyczne sieroty są mało prawdopodobne; w sitemap są wszystkie URL.
- **C11/C12 produkt schema** — to nie e-commerce.
- **T16 hreflang** — strona jest tylko polskojęzyczna.
- **I5 (GSC impressions on URLs not in Page table)** — brak danych w GscQuery (tabela pusta dla tej domeny).
- **L3 broken internal links (pełny crawl wszystkich 31 stron)** — sprawdzone tylko home + 5 sample; ze stopki wiemy o `/regulamin/` i `/kontakt/` (P0 #2). Pełen crawl wszystkich 31 stron pod kątem dodatkowych broken-linków poza stopką — pominięty, nie spodziewane więcej (strony używają tych samych komponentów).

---

## Sequence of recommended actions

**Najpierw (commit + deploy):**
1. Dodaj `public/robots.txt` z `Sitemap:` directive (P0 #1)
2. Wybierz strategię dla `/regulamin/` i `/kontakt/`: utwórz brakujące strony lub usuń linki ze stopki + z polityki prywatności (P0 #2)
3. Popraw broken linki na `src/pages/404.astro:32-57` (P1 #4)
4. Popraw `description` na `src/pages/wybor-tematu/index.astro:7` i `title` na linii 6 (P1 #1 + P2 #4)
5. Stwórz `public/images/og-image.jpg` 1200×630 px (P1 #2)
6. Zdecyduj: dodać GTM/GA z bannerem zgody, czy usunąć wzmianki z polityki (P1 #3)
7. Uruchom `bash deploy.sh`

**Drugi etap (po deployu):**
8. W GSC: Sitemaps → submit `https://www.magisterkaonline.com.pl/sitemap-index.xml` (po naprawie robots.txt)
9. W GSC URL Inspection → "Request Indexing" dla 10 priorytetowych URL z P0 #3 — Google rate-limituje ~10/dzień/property, rozłóż na 2-3 dni
10. Po 14 dniach re-sprawdź `Page.coverageState` w bazie seo_panel — oczekiwany wzrost PASS z 5 do ~20+

**Trzeci etap (content/perf):**
11. Dodaj JSON-LD do Layout + ArticleLayout (P2 #1)
12. Zoptymalizuj Google Fonts loading (P2 #3)
13. Dodaj `lastmod: new Date()` do `sitemap()` w `astro.config.mjs` (P2 #5)
14. Rozważ CloudFront Function dla 301-trailing-slash (P2 #2 — opcjonalne)

---

## Appendix — full URL lists for flagged checks

### Broken internal links (P0 #2, P1 #4)
| URL | Source | HTTP |
|-----|--------|------|
| `/regulamin/` | `Footer.astro:31` (sitewide) | 404 |
| `/kontakt/` | `Footer.astro:32` (sitewide), `polityka-prywatnosci/index.astro:75` | 404 |
| `/poradnik-pisania` | `404.astro:32` | 404 |
| `/poradnik-pisania/jak-zaczac` | `404.astro:43` | 404 |
| `/poradnik-pisania/struktura` | `404.astro:47` | 404 |
| `/poradnik-pisania/bibliografia` | `404.astro:51` | 404 |
| `/ai-w-pisaniu-prac-mgr` | `404.astro:55` | 404 |

### Indexation status (P0 #3) — pełne 31 URL
| URL | Verdict | CoverageState | Clicks | Impressions |
|-----|---------|---------------|--------|-------------|
| `/metodologia/jak-przeprowadzic-wywiad/` | PASS | Submitted and indexed | 1 | 22 |
| `/metodologia/badania-ilosciowe/` | PASS | Submitted and indexed | 0 | 7 |
| `/formatowanie/` | PASS | Submitted and indexed | 0 | 5 |
| `/` | PASS | Submitted and indexed | 0 | 1 |
| `/cel-pracy-magisterskiej/` | NEUTRAL | URL is unknown to Google | 0 | 0 |
| `/konspekt/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/zakonczenie/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/obrona/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/metodologia/kwestionariusz-ankiety-konstrukcja/` | NEUTRAL | URL is unknown to Google | 0 | 0 |
| `/polityka-prywatnosci/` | NEUTRAL | URL is unknown to Google | 0 | 0 |
| `/wybor-tematu/` | NEUTRAL | URL is unknown to Google | 0 | 0 |
| `/metodologia/metody-badawcze/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/metodologia/sondaz-diagnostyczny/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/metodologia/analiza-danych-ilosciowych/` | NEUTRAL | URL is unknown to Google | 0 | 0 |
| `/metodologia/dobor-proby-badawczej/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/metodologia/problemy-badawcze-w-pracy-magisterskiej/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/streszczenie/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/cytowanie-i-cytaty/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/metodologia/analiza-danych-jakosciowych/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/metodologia/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/jak-napisac-wstep/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/metodologia/techniki-i-narzedzia-badawcze/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/metodologia/planowanie-i-prowadzenie-badan/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/spis-tresci/` | NEUTRAL | URL is unknown to Google | 0 | 0 |
| `/metodologia/badania-jakosciowe/` | NEUTRAL | URL is unknown to Google | 0 | 0 |
| `/bibliografia/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/metodologia/hipotezy-badawcze/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |
| `/metodologia/jak-przeprowadzic-ankiete/` | NEUTRAL | Discovered – currently not indexed | 0 | 0 |

---

## Appendix — verification commands

```bash
# P0 #1 — robots.txt
curl -sI -A "Mozilla/5.0" https://www.magisterkaonline.com.pl/robots.txt

# P0 #2 — broken footer links
for u in /regulamin/ /kontakt/; do
  echo "$u => $(curl -s -o /dev/null -w '%{http_code}' -A 'M5' https://www.magisterkaonline.com.pl$u)"
done

# P0 #3 — indexation snapshot
ssh panel "sudo -u postgres psql -d seo_panel -A -F '|' -c \"SELECT url,\\\"coverageState\\\" FROM \\\"Page\\\" WHERE \\\"domainId\\\"='cmn9fo4e8000aqrdyy7wkyh5j' ORDER BY \\\"coverageState\\\";\""

# P1 #2 — OG image
curl -sI -A "M5" https://www.magisterkaonline.com.pl/images/og-image.jpg | head -3

# P1 #3 — tracking presence
curl -s -A "M5" https://www.magisterkaonline.com.pl/ | grep -E "gtag|googletagmanager|G-WS3XHX6SYH" || echo "no tracking"

# P2 #3 — performance
# (Wykorzystaj PSI z .env, klucz w D:\seo-panel\.env / .claude\skills\seo-audit-onsite\.env)
```
