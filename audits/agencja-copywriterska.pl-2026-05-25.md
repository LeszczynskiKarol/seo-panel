# SEO on-site audit — agencja-copywriterska.pl
**Date:** 2026-05-25
**Profile:** B (content/services site z blogiem — DB klasyfikuje jako SATELLITE, ale struktura to klasyczna strona agencyjna z 9 podstronami usług + 23 wpisy bloga; audytowane jak agencja, nie satelita)
**Stack:** Astro 5 + @astrojs/sitemap, statyczny build → S3 (`www.agencja-copywriterska.pl`) + CloudFront (`E1SXQB1KZPYXOD`)
**Repo↔prod state:** in-sync — czysty `git status`, ostatni commit `1df5147 "poprawka seo"` z 11 Feb, `Last-Modified` homepage = 11 Feb. Brak driftu kodu, ale infrastruktura na S3 ma braki, których repo NIE pokrywa (patrz Drift summary).
**Last crawl:** 2026-05-25 04:30 | **GSC:** 2026-05-25 06:00 | **GA4:** 2026-05-25 08:00 (ACTIVE, sync OK)
**Pages:** 55 śledzonych, 37 zindeksowanych, 37 w sitemap | **DA:** 10 | **Last 28d GSC:** ~13 clicks, ~2 800 impressions, avg position ~23

---

## ⚠ Drift summary — repo ↔ prod
Repo i prod są spójne **kodem**, ale produkcyjny S3 nie zawiera plików statycznych, których `BaseLayout.astro` i `SEO.astro` wymagają (pliki nigdy nie istniały w `public/` — to nie drift po deployu, tylko brakujące assety od początku projektu).

| Element | Repo `public/` | Live (S3) | Akcja |
|---------|----------------|-----------|-------|
| `robots.txt` | brak | 404 (NoSuchKey) | CREATE + DEPLOY |
| `favicon.svg` | brak | 404 | CREATE + DEPLOY |
| `apple-touch-icon.png` | brak | 404 | CREATE + DEPLOY |
| `site.webmanifest` | brak | 404 | CREATE + DEPLOY |
| `og-image.jpg` | brak | 404 | CREATE + DEPLOY |
| `logo.png` (z JSON-LD) | brak | 404 | CREATE + DEPLOY |
| `404.html` (S3 ErrorDocument) | brak | 404 (kaskada) | CREATE + DEPLOY |
| `src/pages/uslugi/index.astro` | brak | 404 | CREATE + DEPLOY |

`public/` zawiera tylko katalog `blog/` z obrazkami artykułów. Wszystkie pozostałe assety zadeklarowane w `BaseLayout.astro:39-41` i `SEO.astro:18,27` to martwe ścieżki.

---

## P0 — Critical (fix this week)

### [LIVE] Brak `/robots.txt` — 404 z S3
**Where:** `https://www.agencja-copywriterska.pl/robots.txt`
**Evidence:**
```
HTTP/1.1 404 Not Found
Code: NoSuchKey
Key: 404.html      ← przy okazji widać że ErrorDocument też nie istnieje
```
Brak też wpisu `Sitemap:` którykolwiek widziałby crawler — sitemap-index istnieje pod `/sitemap-index.xml` ale Google musi go wykryć z robots.txt albo GSC submission.
**Impact:** Google domyślnie zakłada „crawl wszystko", więc indexing technicznie działa, ale: (a) crawler nie ma kierunku do sitemap, (b) crawler marnuje budget na stałe 404 (każde wejście Googlebota na `/robots.txt` to bonus 404 w raporcie GSC), (c) sygnał „niedopracowana strona" dla algorytmu. Na 55-stronnicowym site z DA 10 to wymierna strata percepcji jakości.
**Fix:** Utwórz `public/robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://www.agencja-copywriterska.pl/sitemap-index.xml
```
Następnie `./deploy.sh` (zawiera `npm run build && aws s3 sync dist/ s3://www.agencja-copywriterska.pl --delete && aws cloudfront create-invalidation ...`). Astro skopiuje plik 1:1 z `public/` do `dist/`.

### [LIVE] `/uslugi/` zwraca 404 — strona agregująca usługi nie istnieje
**Where:**
- Live URL: `https://www.agencja-copywriterska.pl/uslugi/` (i `/uslugi` bez slasha) → 404
- W repo brak `src/pages/uslugi/index.astro` (jest tylko `src/pages/uslugi/copywriting/index.astro` itd.)
- Linki z `src/pages/index.astro:357` (`<Button href="/uslugi" variant="secondary">Zobacz wszystkie usługi</Button>`) prowadzą do 404
- Header.astro:13-14 oznacza pozycję "Usługi" jako `href: '#'` (więc dropdown — OK), ale wszystkie inne CTA odsyłają do martwego `/uslugi`
**Evidence:**
```
curl -sI https://www.agencja-copywriterska.pl/uslugi/
HTTP/1.1 404 Not Found
```
**Impact:** Najważniejsze CTA na home („Zobacz wszystkie usługi") nigdzie nie prowadzi → bezpośrednia strata konwersji. To jest typowy „dead-end" w UX agencji.
**Fix:** Utworzyć `src/pages/uslugi/index.astro` jako hub-page wszystkich 9 usług (grid kart z linkami do podstron). Wzór z `index.astro:341-360` jest gotowy do skopiowania. Dodaj `<title>Usługi copywriterskie — agencja-copywriterska.pl</title>`, opisowy meta description i schema.org `Service` ItemList. Po dodaniu strony pojawi się też automatycznie w sitemapie (Astro sitemap integration).

### [LIVE] `og-image.jpg` 404 — wszystkie podglądy w social media zepsute
**Where:** `SEO.astro:18` deklaruje `ogImage = '/og-image.jpg'` jako default; `SEO.astro:27` produkuje absolutny URL `https://www.agencja-copywriterska.pl/og-image.jpg`. Live HTML potwierdza:
```html
<meta property="og:image" content="https://www.agencja-copywriterska.pl/og-image.jpg">
<meta property="twitter:image" content="https://www.agencja-copywriterska.pl/og-image.jpg">
```
ale:
```
curl -sI .../og-image.jpg → HTTP/1.1 404 Not Found
```
**Impact:** Każde udostępnienie linku na Facebook / LinkedIn / Slack / Discord wyświetla pustą kartę bez obrazu = drastyczny spadek CTR z social. Również Twitter scraper i FB debugger będą logować to jako błąd.
**Fix:** Wgenerować obraz 1200×630 px z brandingiem (logo + slogan „Tworzymy teksty, które sprzedają"), zapisać jako `public/og-image.jpg` (<300 KB, RGB sRGB, plik JPG nie WebP — FB/LI mają problem z WebP w OG). Deploy.

### [LIVE] `logo.png` 404 — schema.org Organization wskazuje na martwy plik
**Where:** `src/pages/index.astro:44-46` — JSON-LD Organization ma:
```json
"logo": { "@type": "ImageObject", "url": "https://www.agencja-copywriterska.pl/logo.png" }
```
Live `curl -sI /logo.png` → `404 NoSuchKey`.
**Impact:** Google ignoruje niedostępne pole `logo` przy budowie Knowledge Panel / brand SERP. To również jeden z warunków rich snippet dla Organization. Validator schema.org wyrzuci ostrzeżenie.
**Fix:** Wgrać `public/logo.png` (kwadratowe min. 112×112 px, najlepiej 512×512 PNG z przezroczystym tłem). Deploy.

### [LIVE] 6 starych URL-i (post-WordPress?) zwraca 404 zamiast 301 — utracony equity i impresje GSC
**Where:** Z `Page` table w prod DB (`indexingVerdict=UNKNOWN`, nie w sitemap, ale GSC zwraca dla nich impresje):

| URL | impresje 28d | Powinien redirektować na |
|-----|--------------|--------------------------|
| `/pisanie-artykulow/` | 9 | `/uslugi/pisanie-artykulow/` |
| `/cennik/` | 4 | `/kontakt/` lub nowa `/cennik/` |
| `/copywriting/` | brak danych | `/uslugi/copywriting/` |
| `/opisy-produktow/` | 1 | `/uslugi/opisy-produktow/` |
| `/o-nas/` | brak | `/` lub nowa `/o-nas/` |
| `/artykuly-i-tresci-blogowe-prowadzenie-blogow-firmowych/` | brak | `/uslugi/pisanie-artykulow/` |

Wszystkie wracają `HTTP/1.1 404 Not Found`. To URL-e które Google pamięta z poprzedniej wersji strony (najpewniej WP), wciąż mają backlinki / wpis w indeksie.
**Impact:** Każda impresja na 404 to utracony klik. 9 impresji/28d na `/pisanie-artykulow/` przy DA 10 to ~5% wszystkich impresji site'u marnowane. Backlinki do tych URL-i (jeśli istnieją) nie przekazują juice'a do nowych stron.
**Fix:** CloudFront Function albo S3 routing rules (preferowane: CF Function z mapą redirektów):

```js
function handler(event) {
  var req = event.request;
  var map = {
    '/pisanie-artykulow/': '/uslugi/pisanie-artykulow/',
    '/pisanie-artykulow':  '/uslugi/pisanie-artykulow/',
    '/copywriting/':       '/uslugi/copywriting/',
    '/copywriting':        '/uslugi/copywriting/',
    '/opisy-produktow/':   '/uslugi/opisy-produktow/',
    '/opisy-produktow':    '/uslugi/opisy-produktow/',
    '/cennik/':            '/kontakt/',
    '/cennik':             '/kontakt/',
    '/o-nas/':             '/',
    '/o-nas':              '/',
    '/artykuly-i-tresci-blogowe-prowadzenie-blogow-firmowych/': '/uslugi/pisanie-artykulow/',
    '/artykuly-i-tresci-blogowe-prowadzenie-blogow-firmowych':  '/uslugi/pisanie-artykulow/'
  };
  if (map[req.uri]) {
    return { statusCode: 301, statusDescription: 'Moved Permanently',
             headers: { 'location': { value: map[req.uri] } } };
  }
  return req;
}
```

Powiąż z viewer-request CloudFront. Po deployu sprawdź `curl -sI /pisanie-artykulow/` powinno dać `HTTP/1.1 301` z `Location: /uslugi/pisanie-artykulow/`.

---

## P1 — High (fix this sprint)

### [LIVE] CookieBanner — GA4 nie ładuje się dla nowych odwiedzających (Consent Mode v2 gating bug)
**Where:** `src/components/CookieBanner.astro:448-456` — funkcja `init()`:
```js
function init() {
  var consent = getConsent();
  if (consent) { updateGoogleConsent(consent); loadGA(consent); }
  else { showBanner(); }                   // ← nowi użytkownicy: TYLKO banner, brak loadGA()
  ...
}
```
A `loadGA(consent)` (linia 397) sprawdza:
```js
if (consent.analytics && !document.getElementById('ga4-script')) { ... }
```
Czyli **gtag.js (`https://www.googletagmanager.com/gtag/js?id=G-92N4WCQ297`) ładuje się TYLKO gdy `consent.analytics === true`**. Dla nowych użytkowników którzy nie kliknęli baneru — `gtag.js` nigdy nie ładuje się, więc nawet „consent denied ping" nie dociera do Google. Te same wzorce widziano w `sklad-tekstu.pl` i `ecopywriting.pl` ([[gtm-consent-gating-pattern]]).
**Evidence:** Grep w cache home.html: pattern `googletagmanager.com/gtag/js` znajduje się tylko w preconnect (`<link rel="preconnect">`), brak `<script src="...gtag/js...">` w wyjściowym HTML. To potwierdza że GA nigdy nie jest ładowane podczas pierwszej wizyty z nowej sesji.
**Impact:** GA4 traci 100% nowych użytkowników odrzucających cookie (zwykle ~30-60% ruchu zależnie od EU). Wskaźniki w GA4 są drastycznie zaniżone, raporty kampanii niedokładne, GA4 nie może raportować w Consent Mode v2 (który WYMAGA żeby gtag.js się załadował z denied consent, by Google mogło robić modelling). Brak danych = brak optymalizacji marketingowej.
**Fix:** W `src/components/CookieBanner.astro` przepisz `init()` tak, by **ZAWSZE ładować gtag.js**, niezależnie od consent (Consent Mode default = denied już jest ustawiony w linii 362). Zmiana w linii 397-408 — usuń warunek `consent.analytics &&`:
```js
function loadGoogleScript() {
  if (document.getElementById('ga4-script')) return;
  var s = document.createElement('script');
  s.id = 'ga4-script'; s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);
  s.onload = function() {
    gtag('js', new Date());
    gtag('config', GA_ID, { 'anonymize_ip': true, 'cookie_flags': 'SameSite=None;Secure' });
  };
}
```
I w `init()` wywołaj `loadGoogleScript()` ZAWSZE (nie tylko gdy consent istnieje). `updateGoogleConsent()` w handlerach `handleAcceptAll/Selected/Reject` zostaje bez zmian.

### [LIVE] `favicon.svg` / `apple-touch-icon.png` / `site.webmanifest` — 404
**Where:** `BaseLayout.astro:39-41`:
```astro
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
```
Wszystkie 3 zwracają `404 NoSuchKey` z S3.
**Impact:** (a) brak ikony w tabach przeglądarek = wygląd „niedokończony", (b) iOS/Android shortcut bez ikony = słaby trust signal, (c) `site.webmanifest` 404 generuje błąd w DevTools dla każdego odwiedzającego, (d) Lighthouse w „real-world" (nie tylko PSI) odejmuje punkty za PWA-readiness.
**Fix:** Wygenerować zestaw faviconów (np. realfavicongenerator.net) → wgrać do `public/`:
- `favicon.svg` (lub `favicon.ico` + zmienić link w BaseLayout)
- `apple-touch-icon.png` (180×180)
- `site.webmanifest` z polami `name`, `short_name`, `icons[]`, `theme_color: #12193a` (zgodnie z BaseLayout:42)
Deploy.

### [LIVE] 302 zamiast 301 dla wszystkich URL-i bez trailing slash — wewnętrzne linki w Header generują redirect chain
**Where:** S3 + CloudFront default behavior. Header.astro:16-25 generuje linki bez trailing slasha (`/uslugi/copywriting`, `/blog`, `/kontakt`), sitemap zawiera z trailing slashem (`/uslugi/copywriting/`).
**Evidence:**
```
curl -sIL https://www.agencja-copywriterska.pl/uslugi/copywriting
HTTP/1.1 302 Moved Temporarily      ← powinno być 301
Location: /uslugi/copywriting/
HTTP/1.1 200 OK
```
**Impact:** (a) Każdy klik z nawigacji to dwa requesty zamiast jednego — drobny narzut UX, (b) 302 oznacza dla Google „tymczasowe przekierowanie" → equity może nie przechodzić w pełni, (c) crawl budget marnowany na łańcuch redirektów (Googlebot musi przejść przez 302→200), (d) niespójność: sitemap mówi „canonical kończy się /", linki Header mówią coś innego.
**Fix:** Najprostsze: zmienić wszystkie linki w `Header.astro:16-25` na trailing-slash:
```js
{ label: 'Copywriting', href: '/uslugi/copywriting/' },
{ label: 'Pisanie tekstów', href: '/uslugi/pisanie-tekstow/' },
... // wszystkie pozostałe
```
oraz w `Header.astro:27-28`: `{ label: 'Blog', href: '/blog/' }`, `{ label: 'Kontakt', href: '/kontakt/' }`. Również w `index.astro:357` (`href="/uslugi"` → po dodaniu strony zmienić na `/uslugi/`). Alternatywnie ustawić w CloudFront response redirect 301 zamiast 302, ale edycja Astro jest tańsza.

### [LIVE] Wszystkie 9 stron usług + 6 stron kategorii bloga: "URL is unknown to Google"
**Where:** Prod DB `Page` query:
```
indexingVerdict=NEUTRAL coverageState='URL is unknown to Google' for:
  /uslugi/copywriting/, /uslugi/pisanie-tekstow/, /uslugi/pisanie-artykulow/,
  /uslugi/tworzenie-ebookow/, /uslugi/sklad-tekstu/, /uslugi/artykuly-sponsorowane/,
  /uslugi/opisy-produktow/, /uslugi/opisy-kategorii/, /uslugi/naming/,
  /blog/kategoria/copywriting/, /blog/kategoria/content-marketing/, /blog/kategoria/e-commerce/,
  /blog/kategoria/branding-i-naming/, /blog/kategoria/poradniki/, /blog/kategoria/seo-i-pozycjonowanie/,
  /polityka-prywatnosci/
```
**Impact:** 15 z 37 stron w sitemapie nie istnieje w indeksie Google = 40% strony nie generuje impresji. Strony usług to MONEY pages (każda powinna rankować na własne frazy: „copywriting cena", „naming firmy", „skład tekstu LaTeX"). Każda nieindexowana strona usług = stracone leady.
**Fix:** Po naprawieniu P0 (robots.txt + redirekty + /uslugi/) **ręcznie zgłosić w GSC URL Inspection → Request Indexing** dla każdej z 15 stron. **Uwaga: limit GSC ~10 URL/dobę/property** — rozłożyć na 2 dni:
- Dzień 1: wszystkie 9 stron `/uslugi/*/`
- Dzień 2: 6 stron `/blog/kategoria/*/`

Po pierwszej zindeksowanej fali (3-7 dni) re-sprawdzić w DB — jeśli pojedyncze strony nadal `URL unknown`, sprawdzić wewnętrzne linkowanie do nich (Header to robi, ale strona-hub `/uslugi/` której brak też pomogłaby crawlowi).

### [LIVE] Brak HSTS i innych nagłówków bezpieczeństwa
**Where:** CloudFront response (na każdą stronę):
```
curl -sI https://www.agencja-copywriterska.pl/
  → brak Strict-Transport-Security
  → brak Content-Security-Policy
  → brak X-Content-Type-Options
  → brak Referrer-Policy
  → brak X-Frame-Options
```
**Impact:** HSTS chroni przed downgrade attack — sygnał trust dla Google (wymóg dla niektórych branż). Brak innych headerów to drobne ostrzeżenia w Lighthouse Best Practices oraz w skanerach SEO trzeciej strony.
**Fix:** W CloudFront → Distribution `E1SXQB1KZPYXOD` → Response Headers Policies → utwórz lub przypisz policy z:
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: SAMEORIGIN
```
Przypisać do default behaviora dystrybucji.

### [LIVE] Słaby LCP na 3 z 3 sprawdzonych URL-i (mobile)
**Where:** PSI mobile, 2026-05-25:
| URL | Performance | LCP | FCP |
|-----|-------------|-----|-----|
| `/` (home) | 74 | **4.2 s** | 4.2 s |
| `/uslugi/copywriting/` | 74 | **4.2 s** | 4.2 s |
| `/blog/bledy-w-namingu-...` | 67 | **6.9 s** | 3.5 s |

Threshold Google: LCP <2.5 s = good, 2.5-4 s = needs improvement, >4 s = **poor**. Wszystkie 3 strony są w „poor" lub na granicy.
**Evidence z PSI:** największy transfer 3rd party to fonty: 5 plików `https://fonts.gstatic.com/s/fraunces/*.woff2` (~330 KB łącznie) + `dm sans/*.woff2`. Brak `<link rel="preload">` dla fontów. Brak `font-display: swap` w CSS — fonty blokują render.
**Impact:** LCP > 4s na mobile to bezpośredni negatywny ranking signal od Google (Core Web Vitals). Blog-post LCP 6.9 s = bardzo dużo. Słaby LCP może być częścią przyczyny dlaczego strona „nie wchodzi" do TOP-10 mimo 23 ranking position (avg).
**Fix:** Trzy zmiany w priorytecie:
1. W `BaseLayout.astro:55-57` — dodać `preload` dla 2 najważniejszych fontów (jeden Fraunces, jeden DM Sans):
   ```astro
   <link rel="preload" href="/fonts/fraunces-variable.woff2" as="font" type="font/woff2" crossorigin />
   <link rel="preload" href="/fonts/dm-sans-variable.woff2" as="font" type="font/woff2" crossorigin />
   ```
   Z lokalnymi kopiami plików — pobierz z Google Fonts CSS API i wgraj do `public/fonts/`.
2. W globalnym CSS (sprawdź `src/styles/global.css`) — przy każdym `@font-face` dodać `font-display: swap`. To zwalnia render zanim font się załaduje.
3. Self-hostować fonty (eliminuje DNS lookup + connection do `fonts.googleapis.com` + `fonts.gstatic.com`). Wycina ~500-800 ms FCP.

Po zmianach re-PSI i potwierdź LCP <2.5 s na home.

---

## P2 — Medium (fix when capacity allows)

### [LIVE] Niestabilne pozycje frazy „agencja copywriterska" — wahania od 14 do 78 w SeoEvent
**Where:** Prod DB `SeoEvent` — 8 z 15 ostatnich eventów dotyczy frazy „agencja copywriterska":
- POSITION_DROPPED 14.9→23.6 (-8.7)
- POSITION_DROPPED 23.5→32.7 (-9.2)
- POSITION_IMPROVED 77.9→52.5 (+25.4)
- POSITION_DROPPED 14.4→25.7 (-11.3, na pojedynczym kliknięciu)
- POSITION_DROPPED 23.2→35.4 (-12.2)
- POSITION_IMPROVED 78→43.8 (+34.2)
**Impact:** Główna fraza biznesowa nigdy stabilnie nie weszła w TOP-10. Wahania 14↔78 sugerują że Google traktuje stronę jako „kandydat na pierwszą stronę" ale niestabilny — typowo z powodu (a) słabej E-E-A-T, (b) konkurencja przebija content depth, (c) link velocity nieregularny. DA 10 to dolna liga konkurencji w niszy „agencja copywriterska" (top wyniki to zwykle DA 25-45).
**Fix:** Wymaga długoterminowej strategii poza zakresem on-site audytu. Krótkoterminowo: rozszerzyć sekcję SEO content w `index.astro:529-590` o 500-800 słów (dziś ma ~330 słów) z mocniej zakotwiczonymi LSI: „agencja copywriting Warszawa/Toruń", „cennik copywritingu", „freelancer copywriter vs agencja", „efekty współpracy z agencją copywriterską". Dodać też anchor link wewnątrz tekstu do `/blog/uslugi-agencji-copywriterskiej-dlaczego-i-kiedy-warto-zdecydowac-sie-na-wsparcie-w-copywritingu/` (już istnieje, pasuje semantycznie).

### [CONTENT] Najwyższe traffic-driver z impresji nie ma żadnych kliknięć — `/blog/jak-napisac-tekst-na-strone-internetowa-...` (58 impr, pozycja 28.5)
**Where:** Prod DB `Page` table, top traffic page. Sprawdzenie live:
- Title (live): „Jak napisać tekst na stronę internetową — 10 kroków..." (z URL slug)
- Position avg 28.5 — strona 3 wyników. Klików: 0 w 28 dni.
**Impact:** Pozycja 28 to potencjał na top-10 jeśli content jest mocny. Zerowy CTR sugeruje że Google pokazuje ten URL dla zapytań które do niego nie pasują semantycznie, ALBO że title/meta nie zachęca do kliknięcia.
**Fix:** (a) Otworzyć GSC → Performance → filtr po tym URL → zobaczyć dla jakich queries Google go pokazuje. Jeśli queries pasują semantycznie → przepisać title na bardziej clickbait („Jak napisać tekst na stronę WWW: 10-krokowy proces krok po kroku z przykładami") i meta description z liczbami/benefits. (b) Dodać wewnętrzne linkowanie do tego artykułu z 3-4 innych blog postów + z `/uslugi/pisanie-tekstow/`. (c) Sprawdzić aktualność treści, dodać sekcję FAQ z 4-6 pytaniami z PAA Google.

### [LIVE] Brak strony `/cennik/` mimo że ma 4 impresje GSC (i widoczny w starym URL pattern)
**Where:** Z DB: `/cennik/` ma 4 impresje 28d, ale URL 404. Brak też w sitemap i brak pliku `src/pages/cennik.astro`.
**Impact:** Użytkownik z Google wpisujący „agencja copywriterska cennik" trafia na 404. To bezpośrednia strata leadu — pytanie o cenę to wysoka intencja zakupowa.
**Fix:** Albo (a) utworzyć stronę `/cennik/` z przykładowymi widełkami cenowymi (nawet „od 25 zł netto / 1000 znaków" + CTA do bezpłatnej wyceny), albo (b) jeśli polityka „cena tylko po wycenie" — przekierować 301 `/cennik/` → `/kontakt/` z fragmentem URL `#cennik` lub treścią na kontakcie wyjaśniającą. Pierwsza opcja lepsza SEO (utrzymuje ruch na transactional intent).

### [LIVE] CSP / cache-control nie ustawione przez CloudFront
**Where:** Response headers z CloudFront — brak `Cache-Control`, brak `Content-Security-Policy`. Każda strona ma `Age: 14567` (4h cache HIT), ale jawnego policy brak — to default CloudFront.
**Impact:** Drobne — `Last-Modified` jest ustawiony, więc revalidacja działa. Ale brak jawnej polityki cache utrudnia kontrolę invalidacji po deploycie.
**Fix:** W CloudFront cache policy ustawić jawnie: HTML pages `Cache-Control: public, max-age=3600, s-maxage=86400`, assety `/_astro/*.css|js` (już mają hash w nazwie) `max-age=31536000, immutable`. To eliminuje potrzebę invalidacji `/*` po każdym buildzie (drogie + wolne).

---

## P3 — Polish (backlog)

### [CONTENT] Alt-text obrazków blog-cards generowany z slug-a
**Where:** `src/pages/index.astro:493-494`:
```astro
<img src={post.data.image} alt={post.data.imageAlt || post.data.title} loading="lazy" />
```
W live HTML widać: `alt="jak napisac skuteczny opis produktu ktory sprzedaje i wspomaga seo"` (bez polskich znaków, ze slug-a).
**Impact:** Tekstowo działa (Google odczyta), ale nie jest opisowy ani z polskimi znakami. Brak rich keyword context.
**Fix:** W `src/content/blog/*.md` w frontmatter każdego posta dodać pole `imageAlt: "Profesjonalny copywriter pisze opis produktu na laptopie"` (lub podobne, opisowe). Zmiana w jednym miejscu (Markdown frontmatter) → wszystkie miejsca renderujące się aktualizują.

### [CONTENT] Avatary klientów w testimonials z absolutnym URL zewnętrznym (Meblesystem hostuje sam)
**Where:** `src/pages/index.astro:165` — `avatar: 'https://www.meblesystem.pl/wp-content/uploads/2020/02/logo-male.png'`
**Impact:** Jeśli meblesystem.pl zmieni URL/zniknie, awatar zniknie z testimonials. To też dodaje request do zewnętrznej domeny (drobne dla LCP).
**Fix:** Pobrać logo, zapisać w `public/images/testimonials/meblesystem.png` (analogicznie do nadamel.png i stojan.png które już są), zmienić ścieżkę w `index.astro:165` na `/images/testimonials/meblesystem.png`.

---

## Unverified — needs re-run
- **Lighthouse SEO score 100/100 na wszystkich 3 sprawdzonych URL-ach** — wynik formalnie idealny, ale Lighthouse SEO checks są płytkie (tytuł, meta-desc, indexable, viewport). Realna jakość on-page była weryfikowana manualnie (powyżej).
- **GSC URL Inspection API na 15 stronach „URL unknown to Google"** — nie wywołano API, polegano na cache w prod DB `Page.coverageState`. W razie wątpliwości potwierdzić w GSC interfejs.
- **Backlinki do starych WP URL-i (`/pisanie-artykulow/` itp.)** — nie sprawdzono Moz API ani Ahrefs (Moz weekly cron już zaktualizował, ale `BacklinkSnapshot` nie sprawdzano). Warto zweryfikować że 9 impresji na `/pisanie-artykulow/` faktycznie pochodzi z backlinków, nie tylko z Google pamiętającego URL z historii indexowania.

---

## Skipped — not applicable to this profile
- **C11 product schema / C12 AggregateRating** — nie e-commerce, brak ofert produktowych.
- **T16 hreflang** — strona monojęzyczna PL.
- **L1 orphan pages** — strona ma 55 stron i pełną nawigację z Header dropdown + Footer; orphan analysis byłaby trywialna (sitemap = pełna lista, każda strona ma wewnętrzne linki z Header).
- **C16 search-intent mismatch (głęboka analiza per-query)** — zbyt mało clicks (13 w 28d) by miarodajnie ocenić.
- **T21-T23 AWS Route53 / S3 bucket policy** — site live, redirekty działają, certyfikat ważny, nie audytowano dalej (poza zakresem on-site).

---

## Sequence of recommended actions

**Etap 1 — assety statyczne (1 dzień, deploy-only):**
1. Wygeneruj 6 brakujących plików → `public/`:
   - `robots.txt` z wpisem Sitemap
   - `favicon.svg`, `apple-touch-icon.png`, `site.webmanifest`
   - `og-image.jpg` (1200×630)
   - `logo.png` (min. 512×512)
   - `404.html` (S3 ErrorDocument — astro-build ją wygeneruje jeśli dodasz `src/pages/404.astro`)
2. `./deploy.sh` (build + S3 sync + CloudFront invalidation).
3. `curl -sI /robots.txt /og-image.jpg /favicon.svg /logo.png` — wszystkie 200.

**Etap 2 — zawartość brakująca (1-2 dni):**
4. Utwórz `src/pages/uslugi/index.astro` — hub z 9 kartami usług.
5. (opcjonalnie) Utwórz `src/pages/cennik/index.astro` (lub redirect → kontakt).
6. Deploy.

**Etap 3 — fix CookieBanner Consent Mode (1 dzień):**
7. Przepisz `init()` w `src/components/CookieBanner.astro` tak by ZAWSZE wywoływało `loadGoogleScript()` (niezależnie od consent). Test: w DevTools sprawdź czy `gtag.js` ładuje się przed kliknięciem baneru.
8. Deploy.

**Etap 4 — infrastruktura (1 dzień, CloudFront only — nie wymaga rebuilda):**
9. Dodaj CloudFront Function z redirektami 6 starych URL → nowe (z map kodem powyżej).
10. Dodaj CloudFront Response Headers Policy z HSTS + X-Content-Type-Options + Referrer-Policy.
11. Verify: `curl -sIL /pisanie-artykulow/ → 301 → /uslugi/pisanie-artykulow/`; `curl -sI / | grep Strict-Transport-Security`.

**Etap 5 — trailing slash spójność (15 min, build-only):**
12. Edytuj `src/components/Header.astro:16-28` — dodaj trailing slash do wszystkich `href`. Edytuj `src/pages/index.astro:357` po dodaniu strony `/uslugi/`.
13. Deploy.

**Etap 6 — perf / fonts (2-3 dni):**
14. Pobierz Fraunces + DM Sans z Google Fonts CSS API jako `.woff2` → `public/fonts/`.
15. Przepisz `@font-face` w `src/styles/global.css` na lokalne pliki z `font-display: swap`.
16. Dodaj `<link rel="preload">` w `BaseLayout.astro:55-57`.
17. Deploy + re-PSI. Cel: LCP <2.5 s na home.

**Etap 7 — GSC re-indexing (po Etapie 2):**
18. Dzień 1 po Etapie 2: w GSC URL Inspection → Request Indexing dla 9 stron `/uslugi/*/`.
19. Dzień 2: 6 stron `/blog/kategoria/*/` + nowa `/uslugi/`. **Limit GSC ~10 URL/dobę/property — nie próbuj wszystkich na raz.**
20. Po 7-14 dniach: ponowny audit DB `Page.indexingVerdict` żeby zweryfikować efekt.

**Etap 8 — content polish (do backlogu):**
21. Rozszerz SEO content w `index.astro:529-590` z 330 → 600+ słów.
22. Dodaj `imageAlt` do frontmatterów blog postów.
23. Pobierz i self-hostuj awatara MebleSystem.

---

## Appendix — szczegóły komend weryfikacyjnych

**Sprawdzanie 6 brakujących plików:**
```bash
for f in /robots.txt /og-image.jpg /favicon.svg /favicon.ico /apple-touch-icon.png /site.webmanifest /logo.png /404.html /uslugi/; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' https://www.agencja-copywriterska.pl${f}) ${f}"
done
```
Pre-fix output (wszystkie 404):
```
404 /robots.txt
404 /og-image.jpg
404 /favicon.svg
404 /favicon.ico
404 /apple-touch-icon.png
404 /site.webmanifest
404 /logo.png
404 /uslugi/
```

**PSI re-run po fix fontów:**
```powershell
$env:PSI_API_KEY = (Get-Content "$HOME\.claude\skills\seo-audit-onsite\.env" |
  Where-Object { $_ -match '^PSI_API_KEY=' } |
  ForEach-Object { ($_ -split '=', 2)[1].Trim() })
Invoke-RestMethod "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fwww.agencja-copywriterska.pl%2F&strategy=mobile&category=performance&key=$env:PSI_API_KEY"
```

**Re-query stanu indexowania po Etapie 7:**
```sql
-- via ssh_exec do panel
SELECT url, "indexingVerdict", "coverageState", "lastChecked"
FROM "Page"
WHERE "domainId"=(SELECT id FROM "Domain" WHERE domain='www.agencja-copywriterska.pl')
  AND url LIKE '%/uslugi/%'
ORDER BY url;
```
Cel: `indexingVerdict=PASS` dla wszystkich 9 stron usług.
