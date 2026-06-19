# SEO on-site audit — prace-magisterskie.pl
**Date:** 2026-05-25
**Profile:** E — Satellite SEO (Karol's `Domain.category=SATELLITE`; site funnels link juice + brand discovery to smart-edu.ai; thin content by design, 17 commercial landing pages built around kierunki studiów keywords; DA=2, totalClicks=0 lifetime).
**Stack:** Astro 4.16 + @astrojs/sitemap + Tailwind; static build → `aws s3 sync` → S3 bucket `www.prace-magisterskie.pl` (eu-north-1) → CloudFront `E42YH6IKMW3J7`.
**Repo↔prod state:** in-sync — last commit `737ebed` 2026-05-24 10:51, live `Last-Modified` 2026-05-24 08:52 UTC (same build). `git status` clean. No drift.
**Last crawl (panel):** 2026-05-25 03:34 | **GSC pull:** 2026-05-25 06:00 | **GA4 sync:** 2026-05-25 08:00 (ACTIVE, `properties/518184955`)
**Pages:** 19 tracked, **1 indexed**, 19 in sitemap | **DA:** 2 | **GSC 28d:** 0 clicks, 1 impression (homepage, pos. 4 on a single query)

---

## ⚠ Context — żeby zrozumieć ciężar gatunkowy P0
Z 19 podstron w sitemapie **18 ma w GSC status "URL is unknown to Google"** — czyli Googlebot nigdy ich nie odwiedził. Indeksowana jest wyłącznie strona główna (ostatni crawl 2026-03-08, 2,5 miesiąca temu). To znaczy, że całe drzewo `/kierunki/*` — czyli to, do czego ta satelita została zbudowana — **nie istnieje dla Google**. Każdy backlink równa się obecnie zero link juice'u do smart-edu.ai, bo strony pośredniczące są niewidoczne. Wszystkie P0 i P1 poniżej dotyczą tego problemu — robots/sitemap, brak schematów i niezgłoszone strony do indeksacji.

---

## P0 — Critical (do naprawy w tym tygodniu)

### [LIVE] `robots.txt` wskazuje na nieistniejący URL sitemapy → 404
**Where:**
- `public/robots.txt:4` — dyrektywa: `Sitemap: https://www.prace-magisterskie.pl/sitemap.xml`
- Faktyczna sitemapa (generowana przez `@astrojs/sitemap`): `https://www.prace-magisterskie.pl/sitemap-index.xml`

**Evidence:**
```
$ curl -sI https://www.prace-magisterskie.pl/sitemap.xml
HTTP/1.1 404 Not Found
x-amz-error-code: NoSuchKey
x-amz-error-detail-Key: 404.html

$ curl -sI https://www.prace-magisterskie.pl/sitemap-index.xml
HTTP/1.1 200 OK
Content-Type: text/xml

$ curl -s https://www.prace-magisterskie.pl/sitemap-index.xml
<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="..."><sitemap><loc>https://www.prace-magisterskie.pl/sitemap-0.xml</loc></sitemap></sitemapindex>
```
Plik `dist/robots.txt` zawiera tę samą błędną dyrektywę — czyli to **nie jest drift**, tylko realny stan repo+prod. Plik `dist/sitemap.xml` nie istnieje (Astro generuje wyłącznie `sitemap-index.xml` i `sitemap-0.xml`).

**Impact:** Bezpośrednia przyczyna braku indeksacji 18/19 stron. Googlebot pobiera robots.txt, próbuje `/sitemap.xml`, dostaje 404, kończy odkrywanie nowych URL-i. Strony `/kierunki/*` nigdy nie trafiają do kolejki crawlowania. (Homepage indeksowany prawdopodobnie z innego źródła — ręczne zgłoszenie albo zewnętrzny backlink — bo crawl jest sprzed 2,5 miesiąca, gdy `/kierunki/*` nie istniało jeszcze.)

**Fix:** w `D:\prace-magisterskie.pl\public\robots.txt` zmień linię 4:
```
Sitemap: https://www.prace-magisterskie.pl/sitemap.xml
```
na:
```
Sitemap: https://www.prace-magisterskie.pl/sitemap-index.xml
```
Następnie `./deploy.sh`. Po deployu w GSC → Sitemapy: usuń ewentualny stary wpis `sitemap.xml` i dodaj `sitemap-index.xml`.

---

### [LIVE] 18 z 19 stron "URL is unknown to Google" — nigdy nie crawlowane
**Where:** Wszystkie 17 podstron `/kierunki/...` + `/kierunki/` + `/polityka-prywatnosci/` mają w `Page.coverageState='URL is unknown to Google'`, `lastCrawlTime` NULL. Pełna lista poniżej w Evidence.

**Evidence:** (Prod `seo_panel` na hoście `panel`, query 2026-05-25)
```
url                                                                  | indexingVerdict | coverageState
https://www.prace-magisterskie.pl/                                   | PASS            | Submitted and indexed
https://www.prace-magisterskie.pl/kierunki/                          | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/administracja/            | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/bezpieczenstwo/           | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/ekonomia/                 | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/filologia-angielska/      | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/filologia-polska/         | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/informatyka/              | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/kulturoznawstwo/          | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/logistyka/                | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/marketing/                | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/pedagogika/               | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/pielegniarstwo/           | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/politologia/              | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/prawo/                    | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/psychologia/              | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/socjologia/               | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/kierunki/zarzadzanie/              | NEUTRAL         | URL is unknown to Google
https://www.prace-magisterskie.pl/polityka-prywatnosci/              | NEUTRAL         | URL is unknown to Google
```
Strony zwracają 200 i są poprawne (sprawdzone `/kierunki/administracja/` — title, canonical, description OK). Problem jest po stronie odkrywania, nie samych stron.

**Impact:** Cały SEO-funkcjonalny przekaz tej satelity jest niewidoczny. Backlinks budowane do `/kierunki/prawo/` ani nie przekazują juice'u do smart-edu.ai (bo strona nie jest w indeksie, więc nie liczy się jako źródło linka), ani nie rankują na "praca magisterska prawo na zamówienie". 0 kliknięć w GSC za ostatnie 28 dni potwierdza, że satelita w obecnej formie nie pełni żadnej funkcji.

**Fix (kolejność):**
1. Najpierw napraw P0 powyżej (`robots.txt` → `sitemap-index.xml`), deploy.
2. W GSC → "Inspekcja URL" → wklej pojedynczo każdą stronę z listy + kliknij "Poproś o zindeksowanie". **Uwaga: limit ~10/dzień/property.** Rozłóż 18 URL-i na 2 dni (np. 10 + 8).
3. Sitemapę ponownie zgłoś w GSC → Sitemapy: dodaj `https://www.prace-magisterskie.pl/sitemap-index.xml`.
4. Zbuduj choć kilka jakościowych backlinks z innych domen Karola (matury-online.pl, copywriting-blog.pl, karol-leszczynski.pl) prowadzących do `/kierunki/...` — pomoże Googlebotowi te URL-e odkryć "od strony" zamiast czekać na sitemap.

---

## P1 — High (do naprawy w tym sprincie)

### [LIVE] CookieBanner nie ładuje GTM/GA dla nowych użytkowników → brak baseline tracking
**Where:** `src/components/CookieBanner.astro` — funkcja `init()` w bloku `<script is:inline>`:
```js
function init() {
  const consent = getConsent();
  if (consent) {
    updateGoogleConsent(consent);
    loadGoogleScripts(consent);
  } else {
    showBanner();        // ← banner pokazywany, ale loadGoogleScripts() NIE wywoływane
  }
  ...
}
```

**Evidence:**
```
$ curl -s https://www.prace-magisterskie.pl/ | grep -cE 'GTM-TNMGPS5M|googletagmanager.com/gtm.js'
1
```
W żywym HTML jest tylko `<noscript>` iframe GTM dla użytkowników bez JS. Skrypt `gtm.js` jest doklejany do DOM dopiero przez `loadGoogleScripts()` — która woła się wyłącznie w `handleAcceptAll`, `handleAcceptSelected`, `handleReject` oraz w gałęzi `if (consent)` w `init()`. Dla nowego odwiedzającego (brak `localStorage.prace_magisterskie_consent`) GTM nigdy nie jest doklejany do DOM dopóki user nie kliknie któregoś przycisku — czyli **żaden ping consent='denied' nie dociera do Google Consent Mode v2**.

Ten sam architektoniczny błąd występował na sklad-tekstu.pl i ecopywriting.pl (patrz `[[gtm-consent-gating-pattern]]` w pamięci). Konfiguracja `gtag('consent', 'default', {…denied})` jest poprawna — problem jest taki, że bez wczytanego `gtm.js` ten default nie jest gdzie przekazany.

**Impact:** GA4 traci dane o nowych odwiedzających, którzy zamykają stronę bez kliknięcia banera (znaczna większość — typowo 30-60% ruchu). Liczby w panelu GA4 są systematycznie zaniżone. Dla satelity to znaczy że nie wiesz, czy ruch organiczny rośnie, bo nie masz baseline. Ranking SEO to nie utrudni, ale uniemożliwi sensowny pomiar efektywności fixów (w tym tych z tego audytu).

**Fix:** w `src/components/CookieBanner.astro`, w funkcji `init()` zmień gałąź `else`:
```js
function init() {
  const consent = getConsent();
  if (consent) {
    updateGoogleConsent(consent);
    loadGoogleScripts(consent);
  } else {
    // Load GTM even without consent — Consent Mode v2 wymaga ładowania GTM
    // żeby default='denied' ping mógł dotrzeć do Google
    loadGoogleScripts({ necessary: true, analytics: false, marketing: false });
    showBanner();
  }
  // event listeners as before
}
```
Funkcja `loadGoogleScripts` już ma odpowiednią logikę — GTM zawsze load, GA4 tylko gdy `consent.analytics === true`. Po fixie nowi użytkownicy będą ładować GTM od razu (z `consent='denied'`), a po kliknięciu "Akceptuj" GA4 zacznie strzelać normalne page_view.

---

### [LIVE] Link `/regulamin` w stopce → 404 (strona nie istnieje)
**Where:** `src/components/Footer.astro:31` — tablica `prawne`:
```ts
const prawne = [
  { href: '/regulamin', label: 'Regulamin' },
  { href: '/polityka-prywatnosci', label: 'Polityka prywatności' },
];
```
Plik `src/pages/regulamin/...` nie istnieje. `dist/regulamin/` nie istnieje. Live URL zwraca 404 (surowy XML S3 `NoSuchKey`).

**Evidence:**
```
$ curl -sI https://www.prace-magisterskie.pl/regulamin
HTTP/1.1 404 Not Found
x-amz-error-detail-Key: 404.html
```
Link jest renderowany w stopce **każdej** podstrony — czyli na 17 stronach jest link wewnętrzny prowadzący do 404. Plus serwowany `404.html` też nie istnieje, więc użytkownik widzi XML błędu zamiast strony 404.

**Impact:** (a) wewnętrzny broken link na każdej stronie obniża jakość crawl-budgetu, (b) UX — kliknięcie w "Regulamin" pokazuje nieczytelny XML, (c) jeśli/gdy `/kierunki/*` zaczną być indeksowane, Google znajdzie te 404 i obniży ocenę nawigacyjnej spójności witryny, (d) jest to wymóg formalny dla strony oferującej usługę — brak regulaminu jest też ryzykiem regulacyjnym.

**Fix:** dwie opcje, do wyboru Karola:
- **A. Stwórz stronę.** Skopiuj wzorzec z `src/pages/polityka-prywatnosci/index.astro` (już istnieje) do `src/pages/regulamin/index.astro` z treścią regulaminu usługi. Pasuje to satelicie, bo regulamin wzmacnia E-E-A-T.
- **B. Usuń link.** W `src/components/Footer.astro:32` skasuj wiersz `{ href: '/regulamin', label: 'Regulamin' }`. Zostawi to tylko polityka prywatności w stopce — szybkie, ale nie rozwiązuje braku regulaminu jako wymogu formalnego.

Rekomendacja: A.

---

### [LIVE] Brak JSON-LD schema na podstronach `/kierunki/*` (16 stron)
**Where:** Każda z 16 podstron typu `src/pages/kierunki/<slug>/index.astro` oraz `src/pages/kierunki/index.astro`. Sprawdzone na `https://www.prace-magisterskie.pl/kierunki/administracja/` jako reprezentancie:
```
$ curl -s https://www.prace-magisterskie.pl/kierunki/administracja/ | grep -c 'application/ld+json'
0
```
Tylko strona główna ma JSON-LD (`WebPage` z `Service` jako `mainEntity`).

**Impact:** Strony `/kierunki/*` mają w HTML strukturę breadcrumbs (`Strona główna > Kierunki > Administracja`) i każda ma listę "Przykładowe tytuły prac" — to są naturalne kandydaty na `BreadcrumbList` i `FAQPage` (jeśli FAQ tam jest) lub `Service`. Brak markupów to brak rich snippets w SERP-ach. Dla satelity o niskim DA (=2) każdy mechanizm wyróżnienia w SERP-ach to potencjalna przewaga.

**Fix:** w `src/layouts/Layout.astro` dodaj sekcję `<slot name="schema" />` w `<head>`, a w każdej `src/pages/kierunki/<slug>/index.astro` dodaj na końcu `<Layout>`:
```astro
<script type="application/ld+json" slot="schema" set:html={JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Strona główna", "item": "https://www.prace-magisterskie.pl/" },
    { "@type": "ListItem", "position": 2, "name": "Kierunki", "item": "https://www.prace-magisterskie.pl/kierunki/" },
    { "@type": "ListItem", "position": 3, "name": "Administracja", "item": "https://www.prace-magisterskie.pl/kierunki/administracja/" }
  ]
})} />
```
Najlepiej zrobić to przez prop w `Layout.astro` (np. `breadcrumbs: { name, url }[]`) żeby uniknąć duplikacji 16x. Po deployu — walidator: `https://search.google.com/test/rich-results`.

---

### [LIVE] Brak `og:image` / `twitter:image` (Open Graph zdjęcie do social-share)
**Where:** `src/layouts/Layout.astro:24-38` — sekcja Open Graph + Twitter:
```html
<meta property="og:type" content="website" />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonicalURL} />
<meta property="og:site_name" content="Prace-Magisterskie.pl" />
<meta property="og:locale" content="pl_PL" />
<meta name="twitter:card" content="summary_large_image" />  ← deklaruje wymóg dużego obrazka
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
```
Brak `<meta property="og:image">` i `<meta name="twitter:image">`. Deklaracja `summary_large_image` bez obrazka oznacza, że Twitter/X renderuje kartę "summary" (zwykłą), a Facebook/LinkedIn pokazują share bez podglądu.

**Evidence:**
```
$ curl -s https://www.prace-magisterskie.pl/ | grep -oE '<meta property="og:[^"]*"'
<meta property="og:type"
<meta property="og:title"
<meta property="og:description"
<meta property="og:url"
<meta property="og:site_name"
<meta property="og:locale"
(brak og:image)
```

**Impact:** Każdy link do tej strony udostępniony na Facebooku, LinkedInie, Twitterze/X, Slacku, Discordzie itp. wygląda nieprofesjonalnie (brak miniaturki). Dla strony usługowej kierowanej do studentów (silna obecność w social) to znacząca strata. Dla SEO-rankingu: drobny sygnał — Google zaczyna używać `og:image` jako fallback dla `Article` thumbnails.

**Fix:**
1. Stwórz 1200×630 px PNG/JPG (rekomendacja: zrzut Hero + logo + slogan) i zapisz jako `public/og-image.jpg`.
2. W `src/layouts/Layout.astro` po linii `og:locale` dodaj:
```astro
<meta property="og:image" content="https://www.prace-magisterskie.pl/og-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Prace-Magisterskie.pl — pisanie prac mgr z AI" />
<meta name="twitter:image" content="https://www.prace-magisterskie.pl/og-image.jpg" />
```
Możesz też dodać prop `ogImage?: string` do `Props` w Layout.astro, żeby podstrony mogły nadpisać swoje obrazki — ale 1 obrazek dla całej satelity jest OK.

---

## P2 — Medium (do naprawy gdy będzie pojemność)

### [LIVE] H1 strony głównej nie zawiera głównych słów kluczowych z title
**Where:** `src/components/Hero.astro` (rendered w `src/pages/index.astro`).
**Evidence:** title: `"Pisanie prac magisterskich z AI | Prace mgr na zamówienie | Prace-Magisterskie.pl"` — kluczowe frazy commercial: `"prace mgr na zamówienie"`. H1 w HTML:
```html
<h1>
  <span class="gradient-text">Pisanie prac magisterskich</span>
  <br>z pomocą sztucznej inteligencji
</h1>
```
H1 = "Pisanie prac magisterskich z pomocą sztucznej inteligencji". Frazy commercial ("na zamówienie", "na zlecenie") są w title i meta description, ale nie w H1 — najsilniejszym sygnale on-page.

**Impact:** Strona już ranguje na pozycji 4 na 1 zapytanie. Dopasowanie H1 do top-money-keyword może podnieść CTR i pozycję. Niska pewność co do dokładnego efektu (DA=2, mały sample), ale to typ optymalizacji o pozytywnym EV w SATELITE/long-tail.

**Fix:** zmień H1 w `src/components/Hero.astro` na:
```html
<h1>
  <span class="gradient-text">Pisanie prac magisterskich</span>
  <br>na zamówienie z pomocą AI
</h1>
```
Wymiana "z pomocą sztucznej inteligencji" → "na zamówienie z pomocą AI" zachowuje sens, daje krótszy H1 i wstawia main money keyword.

---

### [LIVE] Brak nagłówka HSTS (`Strict-Transport-Security`)
**Where:** CloudFront response headers policy dla `E42YH6IKMW3J7` (dystrybucja www). `cf-www.json` nie definiuje `ResponseHeadersPolicyId`.

**Evidence:**
```
$ curl -sI https://www.prace-magisterskie.pl/ | grep -i strict-transport
(nic)
```

**Impact:** Drobny minus dla SEO (Google preferuje HSTS), ale głównie security best practice. Niski priorytet dla satelity.

**Fix:** dołącz do dystrybucji `E42YH6IKMW3J7` managed response headers policy `SecurityHeadersPolicy` (AWS-id `67f7725c-6f97-4210-82d7-5512b31e9d03`) — daje HSTS + X-Content-Type-Options + X-Frame-Options + Referrer-Policy w komplecie. Komendą:
```bash
aws cloudfront get-distribution-config --id E42YH6IKMW3J7 > cf-www-current.json
# edytuj ResponseHeadersPolicyId pod DefaultCacheBehavior → "67f7725c-6f97-4210-82d7-5512b31e9d03"
aws cloudfront update-distribution --id E42YH6IKMW3J7 --distribution-config file://cf-www-current.json --if-match <ETag>
```

---

### [LIVE] Podwójny redirect na apex http://prace-magisterskie.pl/
**Where:** CloudFront `apex` dystrybucja (z `cf-apex.json`, alias `prace-magisterskie.pl`).

**Evidence:**
```
$ curl -sIL http://prace-magisterskie.pl/
HTTP/1.1 301 Moved Permanently     ← CloudFront http → https
Location: https://prace-magisterskie.pl/
HTTP/1.1 301 Moved Permanently     ← S3 redirect bucket apex → www
Location: https://www.prace-magisterskie.pl/
HTTP/1.1 200 OK
```
Dwa hopy — `http://prace-magisterskie.pl/` → `https://prace-magisterskie.pl/` → `https://www.prace-magisterskie.pl/`.

**Impact:** Każdy hop kosztuje ~100-200ms TTFB. Dla zewnętrznych backlinks na `http://prace-magisterskie.pl` (typowe w starych katalogach) — to ~300ms ekstra. Drobne, ale każdy ms na satelicie z DA=2 jest istotny.

**Fix:** w bucket `prace-magisterskie.pl` (redirect-only) zmień konfigurację website-redirect tak, żeby przekierowywała http+https + apex → `https://www.prace-magisterskie.pl/` w jednym kroku. Można to osiągnąć przez zmianę `OriginProtocolPolicy` apex dystrybucji na `https-only` i ustawienie redirect rule na bucket aby zawsze zwracał HTTPS+www w `Location`. Niski priorytet, P2.

---

### [LIVE] LCP 3.3s na mobile (PSI Performance score 0.83)
**Where:** Homepage, PSI mobile audit 2026-05-25 12:58.

**Evidence:**
```
Performance: 0.83 (limit good = 0.90)
SEO:         1.00
LCP:         3.3s  ← Needs Improvement (limit good = 2.5s)
CLS:         0     ← excellent
TBT:         0 ms  ← excellent
FCP:         3.3s  ← LCP element renderuje się w pierwszej klatce
Speed Idx:   4.8s
```
FCP=LCP=3.3s sugeruje że LCP element to text-only (Hero H1 lub paragraf) — nie ma obrazka blokującego LCP. Czyli problem jest w fazie wczesnego renderowania, najpewniej w CSS chain (Tailwind generuje dużą bundlę).

**Impact:** Dla satelity dla wyników "praca magisterska kierunek X" (long-tail, niskokonkurencyjne) — LCP 3.3s nie zabija rankingu, ale zostawia 7-15% potencjału. Większy efekt dla user experience (3.3s do widoku pierwszej treści to dużo na 3G).

**Fix:**
1. Sprawdź w PSI raporcie (na `https://pagespeed.web.dev/analysis/...`) dokładnie który element to LCP — jeśli to Hero H1, problem jest w CSS critical-path.
2. Tailwind config powinien już mieć `content: [...]` purge — sprawdź `tailwind.config.mjs` czy wszystkie pliki .astro są w content.
3. Rozważ preload font (jeśli używany jest Inter via Google Fonts) — `<link rel="preload" as="font" type="font/woff2" crossorigin>`.

---

### [LIVE] Strona 404 niezdefiniowana — użytkownik widzi surowy XML błędu S3
**Where:** CloudFront `E42YH6IKMW3J7` nie ma `404.html` w buckecie ani custom error response.

**Evidence:**
```
$ curl -s https://www.prace-magisterskie.pl/regulamin
<html><head><title>404 Not Found</title></head>
<body><h1>404 Not Found</h1>
<ul><li>Code: NoSuchKey</li>
<li>Message: The specified key does not exist.</li>
<li>Key: 404.html</li>
...
```
S3 próbuje serwować skonfigurowany `404.html` jako error-document, ale plik **nie istnieje** ani w `dist/` ani w buckecie. Pokazuje surowy XML.

**Impact:** UX problem dla każdego kliknięcia w broken link (jak `/regulamin` powyżej) lub literówki w URL. Status HTTP 404 jest poprawny, więc Google nie ma problemu — to czysto UX i wizerunkowo.

**Fix:** stwórz `src/pages/404.astro` z prostą stroną używającą `Layout.astro`, `<h1>Strona nie znaleziona</h1>` + link powrotu do `/` i `/kierunki/`. Astro automatycznie wygeneruje `dist/404.html`. CloudFront/S3 już skonfigurowane żeby na to wskazywać.

---

## P3 — Polish (backlog)

### [WORKFLOW] Puste katalogi `src/pages/kierunki/finanse/` i `src/pages/kierunki/historia/`
Pozostałości po usunięciu kierunków (commit `f97524c usunięto finanse`). Katalogi puste → Astro nie generuje stron, więc nie ma to wpływu na prod. Tylko bałagan w repo.
**Fix:** `rmdir src/pages/kierunki/finanse src/pages/kierunki/historia` + commit "remove stale empty subject dirs".

### [WORKFLOW] `deploy.sh` używa generycznego commit message "git push from local"
W `deploy.sh:7` jest `git add . && git commit -m "git push from local"`. Każdy deploy generuje commit z tytułem "git push from local" — historia git staje się nieczytelna (widać 2 takie commity już w log: `f6d62d2` i `f6de7a0`). Ryzyko: brak audytu zmian + przypadkowe commitowanie `.env` (`.gitignore` to chroni, ale `git add .` to wciąż błąd jeśli ktoś doda nowy plik wrażliwy).
**Fix:** zamiast `git add . && git commit -m "git push from local"`, wymaga commitu **przed** deployem (np. `if [ -n "$(git status --porcelain)" ]; then echo "Commit najpierw"; exit 1; fi`). Albo akceptuj parametr `-m` do `deploy.sh "swój opis zmian"`.

---

## Unverified — needs re-run
- Lista wszystkich sitemap-ów zgłoszonych w GSC (nie odpytywałem GSC API — żeby potwierdzić, czy w GSC jest stary wpis `sitemap.xml` z 404. Zalecam ręczną weryfikację w https://search.google.com/search-console/sitemaps?resource_id=sc-domain:prace-magisterskie.pl po fixie P0 #1).
- Backlinki przychodzące do tej domeny (Moz API/Ahrefs API nie odpytywane, `mozDA=2` daje przybliżenie ale nie listy URL-i).
- LCP element identification — z PSI displayValue widzę tylko czasy; pełny raport pokazałby dokładnie który node jest LCP. Otwórz https://pagespeed.web.dev/analysis?url=https://www.prace-magisterskie.pl/&form_factor=mobile.

## Skipped — not applicable to this profile
- **C11 product schema** — nie e-commerce.
- **C7 word count na content pages** — to satelita z 16 podobnymi landing pages 600-900 słów, świadomie skondensowana treść.
- **L1 orphan analysis** — wszystkie 17 stron jest linkowanych z Header / Footer / kierunki/index. Brak orphanów strukturalnych. (Sprawdzone via `internalLinksIn>0` w `Page` dla każdego URL-a — homepage ma 19 linków-do-siebie, podstrony 0-7).
- **I5 GSC impressions on URLs not in Page table** — GSC 28d: 1 impresja, 0 kliknięć. Sample za mały do orphan-analysis impressions.
- **T16 hreflang** — strona jest tylko po polsku.
- **C16 search-intent mismatch** — nie ma rankingu na żadne zapytanie żeby to badać.
- **I6 URL Inspection API** — z `coverageState` w DB już mam pełną listę co Google wie/nie wie; URL Inspection nie da nic ekstra przed deployem fixów.

---

## Sekwencja rekomendowanych akcji

**Faza 1 — fix indeksacji (zrób w tym tygodniu, kolejność krytyczna):**
1. Edit `public/robots.txt`: `sitemap.xml` → `sitemap-index.xml`.
2. Decyzja: stwórz `src/pages/regulamin/index.astro` (opcja A z P1) **lub** usuń wpis z `Footer.astro` (opcja B).
3. Stwórz `src/pages/404.astro` (z P2 #5).
4. Fix `src/components/CookieBanner.astro` — przenieś `loadGoogleScripts({…analytics:false})` przed `showBanner()` w gałęzi `else` w `init()` (z P1 #1).
5. Stwórz `public/og-image.jpg` (1200×630) + dodaj 5 tagów `og:image*` do `Layout.astro` (z P1 #4).
6. `cd D:\prace-magisterskie.pl && ./deploy.sh`
7. W GSC → Sitemapy: usuń `sitemap.xml`, dodaj `sitemap-index.xml`.
8. W GSC → Inspekcja URL: zgłoś 10 podstron `/kierunki/*` (limit ~10/dzień). **Kolejne 8 zgłoś następnego dnia** (rate-limit Google).

**Faza 2 — w sprincie (te 1-2 tygodnie po Faza 1):**
9. Dodaj `BreadcrumbList` JSON-LD do `Layout.astro` (przez prop, parametryzowane per strona — z P1 #3).
10. Zmień H1 w `Hero.astro` (z P2 #1).
11. Wyczyść puste katalogi `kierunki/finanse` i `kierunki/historia` (P3).
12. Dodaj `SecurityHeadersPolicy` do CF (z P2 #2).

**Faza 3 — backlog:**
13. Optymalizacja LCP (P2 #4).
14. Apex redirect single-hop (P2 #3).
15. Przebudowa `deploy.sh` żeby nie używał "git push from local" jako stałego commit message (P3).

---

## Appendix — pełne tabele

### Wszystkie URL-e do ponownego zgłoszenia w GSC (po fixie robots.txt)
Rozłożone na 2 dni z uwagi na ~10/dzień rate-limit:

**Dzień 1 (kategorie wysoko-konkurencyjne, prawdopodobnie najlepiej rankujące):**
1. https://www.prace-magisterskie.pl/kierunki/
2. https://www.prace-magisterskie.pl/kierunki/prawo/
3. https://www.prace-magisterskie.pl/kierunki/psychologia/
4. https://www.prace-magisterskie.pl/kierunki/pedagogika/
5. https://www.prace-magisterskie.pl/kierunki/zarzadzanie/
6. https://www.prace-magisterskie.pl/kierunki/ekonomia/
7. https://www.prace-magisterskie.pl/kierunki/informatyka/
8. https://www.prace-magisterskie.pl/kierunki/marketing/
9. https://www.prace-magisterskie.pl/kierunki/socjologia/
10. https://www.prace-magisterskie.pl/kierunki/administracja/

**Dzień 2:**
11. https://www.prace-magisterskie.pl/kierunki/bezpieczenstwo/
12. https://www.prace-magisterskie.pl/kierunki/filologia-polska/
13. https://www.prace-magisterskie.pl/kierunki/filologia-angielska/
14. https://www.prace-magisterskie.pl/kierunki/kulturoznawstwo/
15. https://www.prace-magisterskie.pl/kierunki/logistyka/
16. https://www.prace-magisterskie.pl/kierunki/pielegniarstwo/
17. https://www.prace-magisterskie.pl/kierunki/politologia/
18. https://www.prace-magisterskie.pl/polityka-prywatnosci/

### Komendy weryfikacyjne (do uruchomienia po deployu fixów)
```bash
# weryfikacja robots.txt
curl -s https://www.prace-magisterskie.pl/robots.txt

# weryfikacja sitemap nowa lokacja
curl -sI https://www.prace-magisterskie.pl/sitemap-index.xml

# weryfikacja /regulamin (jeśli wybrano opcję A)
curl -sI https://www.prace-magisterskie.pl/regulamin

# weryfikacja og:image
curl -s https://www.prace-magisterskie.pl/ | grep -i og:image

# stan indeksacji za ~14 dni
sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT url, \"indexingVerdict\", \"coverageState\" FROM \"Page\" WHERE \"domainId\"='cmn9fo4e50009qrdyog51y31k';" 2>/dev/null
```
