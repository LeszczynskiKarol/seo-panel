# SEO on-site audit — licencjackie.pl
**Date:** 2026-05-25
**Profile:** B (content/blog) z elementami E (satellite) — 93 artykuły w 24 kategoriach, ale jednocześnie sponsorowane CTA do `smart-edu.ai` (rel=sponsored) — DB klasyfikuje jako SATELLITE.
**Stack:** Astro 4.16 (static output, trailingSlash=always), @astrojs/sitemap, Tailwind. Deploy: S3 (`www.licencjackie.pl`) + CloudFront (`E35P5HJR5VHDCE`) z CF Function dla 301 trailing-slash.
**Repo↔prod state:** in-sync — `git status` clean, ostatni commit `f3e75d7` (2026-05-24 11:38 +0200) ≈ live `Last-Modified` (2026-05-24 09:39 UTC = 11:39 +0200).
**Last crawl:** 2026-05-25 03:38 | **GSC:** 2026-05-25 06:00 | **GA4:** 2026-05-25 08:01 ACTIVE
**Pages:** 157 tracked, 148 indexed, 122 w sitemapie | **DA:** 16 | **GSC 28d:** 7 clicks / 1 048 impressions (CTR 0.67%)

---

## P0 — Critical (do końca tygodnia)

### [LIVE] Brak `<link rel="canonical">` na wszystkich stronach poza pojedynczymi postami blogowymi
**Where:**
- `src/layouts/Layout.astro:38` — `{canonical && <link rel="canonical" href={canonical} />}` (warunek wymusza przekazanie propu)
- `src/pages/index.astro:80-83` — wywołanie `<Layout title=… description=…>` **bez** `canonical`
- `src/pages/blog/index.astro:41-44`, `src/pages/blog/kategoria/[category].astro:121-125`, `src/pages/kierunki.astro:29`, `src/pages/kontakt.astro:11`, `src/pages/polityka-prywatnosci.astro`, `src/pages/404.astro:7` — wszystkie wywołują `Layout` bez propu `canonical`.
- Tylko `src/layouts/BlogLayout.astro:127` przekazuje canonical → /blog/[slug]/ ma canonical, inne nie.

**Evidence:**
```
$ curl -s https://www.licencjackie.pl/ | grep -i canonical
<!-- Canonical -->     (komentarz HTML, brak elementu)

$ curl -s https://www.licencjackie.pl/blog/ | grep -i canonical
(brak)

$ curl -s https://www.licencjackie.pl/blog/kategoria/poradniki/ | grep -i canonical
(brak)
```

Dla porównania `/blog/przypisy-w-pracy-magisterskiej/` ma poprawny `<link rel="canonical" href="https://www.licencjackie.pl/blog/przypisy-w-pracy-magisterskiej/">`.

**Impact:** Strona główna ma 83 impresje w GSC (pozycja 36.7, 0 kliknięć). Bez canonical Google sam wybiera kanonik (może wybrać apex zamiast www, wariant z/bez trailing-slash, lub wersję pre-CF-redirect). Top-impressions landing `/blog/kategoria/pisanie-prac-z-prawa/` (105 imp) też bez canonical. Razem ~250 imp na trafficked URLs bez explicit canonical.

**Fix:** W każdym z 7 plików dodać prop `canonical` do `<Layout …>` (lub uprościć Layout aby zawsze wstawiał canonical z `Astro.url.pathname`). Konkretnie:

```diff
- src/pages/index.astro:80
  <Layout
    title="Pisanie pracy licencjackiej…"
    description="…"
+   canonical="https://www.licencjackie.pl/"
  >
```
Analogicznie dla `/blog/`, `/kierunki/`, `/kontakt/`, `/polityka-prywatnosci/`, `/404` (na 404 lepiej pominąć — strona ma już `noindex`).

Dla `src/pages/blog/kategoria/[category].astro:121` użyć `canonical={`https://www.licencjackie.pl/blog/kategoria/${slugify(categoryName)}/`}`.

**Alternative (cleaner)**: w `Layout.astro:38` zrobić canonical domyślnym:
```diff
-    {canonical && <link rel="canonical" href={canonical} />}
+    <link rel="canonical" href={canonical || `https://www.licencjackie.pl${Astro.url.pathname}`} />
```
To pokrywa wszystko jednym fixem.

---

### [LIVE] GTM/GA nie ładują się dla nowych użytkowników (Consent Mode v2 gating bug)
**Where:** `src/components/CookieBanner.astro:489-497`

**Evidence:**
```javascript
// init() — pierwsza wizyta (consent === null):
function init() {
  const consent = getConsent();
  if (consent) {
    updateGoogleConsent(consent);
    loadGoogleScripts(consent);    // ✓ ładuje się dla powracających
  } else {
    showBanner();                  // ✗ brak loadGoogleScripts() dla nowych!
  }
  …
}
```

`loadGoogleScripts()` jest wywoływane tylko z `handleAcceptAll()` / `handleAcceptSelected()` / `handleReject()` (po interakcji z bannerem) oraz z `if (consent)` w init. Nowy odwiedzający, który nie kliknie żadnego przycisku, **nie ma na stronie GTM ani GA4** — Consent Mode v2 wymaga aby tag był obecny od momentu wejścia z `denied` defaults i awansował do `granted` po zgodzie. Bez GTM `denied` ping nie poleci do Google, statystyki o ratach zgody/odmów nie są zbierane, a ścieżka konwersji "wejście → zgoda" jest tracona.

W HTML widzę: `<link rel="preconnect" href="googletagmanager.com">` (tylko hint), `<noscript>` iframe GTM (działa tylko bez JS), `dataLayer` setup z `gtag("consent", "default", {…denied…})` — ale **żadnego `<script async src="…gtm.js?id=GTM-KD2J9KWN">`** dopóki user nie kliknie.

Ten sam bug był w sklad-tekstu.pl i ecopywriting.pl (patrz `[[gtm-consent-gating-pattern]]` w memory) — Karol kopiuje `CookieBanner.astro` między domenami z lekkimi edycjami; bug architektoniczny się powtarza.

**Impact:** Wszystkie GA4 sesje od nowych użytkowników, którzy nie klikną banera (typowo ~30-60% userów), nie są mierzone. GSC pokazuje 1 048 impressions, GA4 niemal puste — patrz [[seo-panel-db-mapping]] discrepancy. Brak Consent Mode v2 ping pingów ogranicza też modelowanie konwersji w Google Ads, gdyby kiedyś były podłączone.

**Fix:** W `src/components/CookieBanner.astro:489-497` przenieść `loadGoogleScripts()` poza warunek (zawsze ładować GTM, on respektuje consent mode):

```diff
  function init() {
    const consent = getConsent();
+   // ZAWSZE ładuj GTM — Consent Mode v2 sam pilnuje denied/granted
+   loadGoogleScripts(consent || { analytics: false, marketing: false });

    if (consent) {
      updateGoogleConsent(consent);
-     loadGoogleScripts(consent);
    } else {
      showBanner();
    }
    …
  }
```

I dodatkowo w `loadGoogleScripts()` (linia 392) warunkowo ładować `gtag/js?id=GA4` zawsze (a nie tylko gdy `consent.analytics`), bo to GA4 sam respektuje storage flags. Albo prościej: zostawić jak jest, tylko upewnić się że GTM ładuje się dla wszystkich.

---

## P1 — High (na ten sprint)

### [LIVE] LCP 5.0s na artykułach blogowych (Core Web Vitals: "Poor" zone)
**Where:** `src/layouts/BlogLayout.astro` (hero `<img>`), pliki `public/blog/*.jpg`

**Evidence:**
```
PSI mobile https://www.licencjackie.pl/blog/przypisy-w-pracy-magisterskiej/
  performance: 0.75
  LCP: 5.0 s   ← Google "poor" threshold = >4.0s
  FCP: 3.0 s
  CLS: 0.079
  audit unsized-images: 0.5 (fail)

$ curl -sI https://www.licencjackie.pl/blog/przypisy-w-pracy-magisterskiej.jpg
Content-Length: 476745   ← 466 KB JPEG
Content-Type: image/jpeg ← brak WebP/AVIF

$ grep '<img' …/lic-post.html | head -1
<img src="/blog/przypisy-w-pracy-magisterskiej.jpg"
     alt="Przypisy w pracy magisterskiej"
     class="w-full h-auto object-cover"
     loading="eager">     ← brak width/height/srcset
```

**Impact:** Wszystkie 93 posty blogowe (rdzeń contentu) — LCP w "poor" zone obniża ranking mobile-first i konwersję. Top GSC URL `/blog/kategoria/pisanie-prac-z-prawa/` (105 imp, 0 clicks, pos 29) — kiepski LCP przy borderline pozycji = trudno wejść na page 1.

**Fix (3 kroki, prześcielne):**
1. **Astro Image component**: zamienić `<img>` w `BlogLayout.astro` na `<Image>` z `astro:assets` — automatycznie generuje WebP, dodaje width/height, robi responsive srcset.
2. **Skompresować istniejące JPEGi**: `npm i -D sharp` (już zależność Astro), batch skrypt `for f in public/blog/*.jpg; do npx sharp -i "$f" -o "${f%.jpg}.webp" --webp quality=82; done`. Docelowo hero 1200px szeroki, ~80 KB jako WebP.
3. **Dodać width/height na każdym `<img>`** w gridach posty-related (linie z `loading="lazy"`) — eliminuje CLS i flag PSI unsized-images.

---

### [LIVE] Title cannibalizacja: `/blog/` i `/blog/kategoria/poradniki/` walczą o tę samą query "poradniki"
**Where:**
- `src/pages/blog/index.astro:42` — `title="Poradniki | Licencjackie.pl - Pisanie prac dyplomowych"` (cała indeksowa lista 93 artykułów, H1 "Poradniki dla studentów")
- `src/pages/blog/kategoria/[category].astro:121-122` — dla `categoryName="Poradniki"` generuje `title="Poradniki | Licencjackie.pl"` (lista 7 artykułów w kategorii "Poradniki")

**Evidence:**
```
$ curl -s …/blog/        | grep title
<title>Poradniki | Licencjackie.pl - Pisanie prac dyplomowych</title>
$ curl -s …/blog/kategoria/poradniki/ | grep title
<title>Poradniki | Licencjackie.pl</title>
```
Z 24 kategorii tylko 7 postów ma `category: "Poradniki"` (grep frontmatter). `/blog/` to faktycznie INDEX wszystkich 93 postów, nie kategoria.

**Impact:** Google nie wie który URL jest właściwy dla query "poradniki" — w GSC obie strony łapią impresje (`/` = 83 imp pos 36.7; `/blog/kategoria/pisanie-prac-z-prawa/` = 105 imp pos 29, top). Self-cannibalization rozprasza link equity i PageRank wewnętrzny.

**Fix:**
1. W `src/pages/blog/index.astro:42` zmienić tytuł na opisowy dla indeksu:
   - `title="Wszystkie artykuły o pisaniu prac dyplomowych | Licencjackie.pl"`
   - H1 (linia 53): `Wszystkie artykuły <span class="text-gradient">o pisaniu prac</span>` (zamiast "Poradniki dla studentów")
2. Kategorię "Poradniki" zostawić jako `<title>Poradniki o pisaniu prac dyplomowych | Licencjackie.pl</title>` w `kategoria/[category].astro:122` — wymaga case'u w `getPageTitle()` na linii ~113.
3. Po zmianie wymusić recrawl `/blog/` w GSC (`URL Inspection → Request indexing`).

---

### [LIVE] Cienka treść na top-impressions stronie kategorii (105 imp, 0 clicks, position 29)
**Where:** `https://www.licencjackie.pl/blog/kategoria/pisanie-prac-z-prawa/` (i 17 innych "Pisanie prac z X" kategorii po 2 posty każda)

**Evidence:**
```
$ grep -hE "^category:" src/content/blog/*.md | sort | uniq -c | grep "Pisanie prac z"
 2 category: "Pisanie prac z administracji"
 2 category: "Pisanie prac z prawa"
 …(18 kategorii × 2 posty)
```

Layout `kategoria/[category].astro` renderuje: H1, breadcrumb, grid 2 kart postów, koniec. **Brak intro paragraphu** (description-only z linii 124 widzi go meta-tag, nie body). Surowa treść tekstowa kategorii to ~50-100 słów (głównie titles+excerpts kart), reszta to navbar/footer/CSS noise.

**Impact:** 18 kategorii × średnio ~30 imp = ~540 imp/m bez kliknięć (CTR ~0% przy pozycjach 25-50). Google klasyfikuje cienkie listing pages jako low-quality → spada cała grupa URLi. To dziś największa pojedyncza grupa impresji bez konwersji na całej domenie.

**Fix (dwa warianty):**

**Wariant A (zalecany — kontentowy):** Dodać w `src/pages/blog/kategoria/[category].astro` po H1 (linia ~140) sekcję 200-400-słowowego **intro tekstu** generowanego per-kategoria. Można trzymać teksty w mapie:
```ts
const categoryIntros: Record<string, string> = {
  "Pisanie prac z prawa": "Praca dyplomowa z prawa wymaga…(300 słów: specyfika tematów, najczęstsze problemy z metodologią, jak dobierać literaturę, linki wewnętrzne do /blog/temat-pracy-magisterskiej/ i /blog/bibliografia-pracy-licencjackiej/)",
  // …per każda kategoria
};
```
I wrenderować `{categoryIntros[categoryName]}` w prose-div przed gridem postów.

**Wariant B (jeśli A za drogie):** Skonsolidować 18 cienkich "Pisanie prac z X" kategorii w 3 grupy meta (Humanistyczne / Społeczne / Medyczne) — mniej URLi do utrzymania, każda ma 6-12 postów. Wymaga zmiany w `src/content/config.ts` enum oraz batch-update wszystkich `.md` files (lub mapowania w slugify). + 301 z każdego starego /blog/kategoria/X/ → nowa grupa.

Wariant A daje większy upside (każda kategoria może rankować na swoją niszę), Wariant B mniej pracy.

---

### [LIVE] Meta-refresh zamiast HTTP 301 dla wszystkich legacy/typo redirectów + brak trailing slash w targetach
**Where:** `astro.config.mjs:21-200` (66 artykułów + 13 kategorii WP + 3 typo = ~82 redirectów). Plus efekt uboczny w `dist/<old-url>/index.html`.

**Evidence:**
```
$ cat dist/ankieta-w-pracy-magisterskiej/index.html
<!doctype html><title>Redirecting to:
  https://www.licencjackie.pl/blog/ankieta-w-pracy-magisterskiej</title>
<meta http-equiv="refresh" content="0;url=…/blog/ankieta-w-pracy-magisterskiej">
<meta name="robots" content="noindex">
<link rel="canonical" href="…/blog/ankieta-w-pracy-magisterskiej">

$ curl -sIL https://www.licencjackie.pl/ankieta-w-pracy-magisterskiej/
HTTP/1.1 200 OK              ← Meta refresh = HTTP 200, NIE 301
```

A target ma brak trailing slash:
```
"/ankieta-w-pracy-magisterskiej/": "/blog/ankieta-w-pracy-magisterskiej",
                                                                       ^ brakuje "/"
```

Co implikuje łańcuch: legacy `/X/` → (200+meta-refresh) `/blog/X` → (CF Function 301) `/blog/X/`. Trzy strony, dwa requesty.

To samo dla wszystkich 19 artykułów + ~18 kategorii z mapy "kierunkowej" + 13 kategorii WP. Tylko 3 typo-fixy z górnej sekcji mają trailing slash w targecie poprawnie.

**Impact:** 
- Meta-refresh jest dla Googlebota **wskazówką** (soft 301), nie definitywnym kanonikiem — pasja link equity przez taki redirect jest niepełna w porównaniu z prawdziwym 301.
- Łańcuch 2-skoków marnuje crawl budget. GSC pokazuje URLe bez trailing-slash (`/blog/analiza-i-ocena-zrodel`, `/blog/pedagogika` itd.) z impresjami 31, 27, 21 — to są dokładnie pośrednie URLe z łańcucha, których Google nie skonsolidował.
- 50 zbędnych plików HTML w `dist/` (zwiększa rozmiar S3, czas deploya, koszt CF Invalidation).

**Fix (jeden krok, najczystszy):** Przenieść **wszystkie** legacy redirects z `astro.config.mjs` do `infra/cloudfront/trailing-slash-301.js` jako tablica par przed obecną logiką:

```js
var LEGACY_REDIRECTS = {
  "/ankieta-w-pracy-magisterskiej/":    "/blog/ankieta-w-pracy-magisterskiej/",
  "/badania-w-pracy-magisterskiej/":    "/blog/badania-w-pracy-magisterskiej/",
  // …(82 wpisy, wszystkie targety z trailing slash)
};

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  // …(istniejąca logika apex→www, extension skip)

  // NEW: legacy redirects → 301 z pojedynczym hopem
  if (LEGACY_REDIRECTS[uri]) {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: { location: { value: LEGACY_REDIRECTS[uri] } },
    };
  }

  // …(istniejąca logika trailing slash)
}
```

I równolegle usunąć cały blok `redirects: { … }` z `astro.config.mjs`. Po build `dist/` schudnie o 82 katalogi, każdy legacy URL ma single-hop 301 z poprawnym slashem.

Deploy: `bash infra/cloudfront/deploy-function.sh` (już istnieje), potem `bash deploy.sh`.

**Quick-win pośredni jeśli powyższe za duże**: w `astro.config.mjs` tylko dodać slash w 50 targetach (find-replace `"/blog/X"` → `"/blog/X/"`). Zostaje meta-refresh (nie 301), ale eliminuje drugi skok.

---

### [LIVE] 404 page renderuje dwa konkurencyjne meta robots tagi
**Where:** `src/pages/404.astro:8` (wywołanie Layout) + `src/layouts/Layout.astro:30-32` (default `index, follow…`).

**Evidence:**
```
$ curl -s https://www.licencjackie.pl/this-does-not-exist/ | grep robots
<meta name="robots" content="index, follow, max-image-preview:large…">   ← Layout default
<meta name="robots" content="noindex, follow">                            ← 404.astro slot
```

Google bierze najbardziej restrykcyjną — `noindex` wygrywa — ale obecność dwóch tagów to potencjalne źródło bugów (kolejność, restrykcyjność, walidatory). Lighthouse PSI nie flagował (SEO score 1), ale to czysty smell.

**Impact:** Bardzo niski — `noindex` działa intencjonalnie. Bardziej jako risk-of-future-bug niż real issue.

**Fix:** W `src/layouts/Layout.astro:30-32` zmienić defaults na prop-driven:
```diff
-    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
+    <meta name="robots" content={robots || "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />
```
Dodać `robots?: string` w interface Props (linia 5). Potem w `404.astro:7` zamiast Fragment slot użyć propu: `<Layout title=… robots="noindex, follow">…`.

---

### [LIVE] Brak HSTS i podstawowych security headers w odpowiedzi CloudFront
**Where:** CloudFront distribution `E35P5HJR5VHDCE` — Response Headers Policy.

**Evidence:**
```
$ curl -sI https://www.licencjackie.pl/ | grep -iE "strict-transport|x-content|x-frame|referrer-policy"
(empty — brak wszystkich)
```

**Impact:** HSTS to wymóg `securityheaders.com` A grade i marker zaufania dla niektórych browserów; brakuje też X-Content-Type-Options (MIME-sniff protection) i Referrer-Policy. SEO-impact pośredni przez page experience signals.

**Fix:** Dodać do CloudFront Distribution **Response Headers Policy** (lub przez `infra/cloudfront/` jeśli planujesz utrzymywać infra-as-code):
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: SAMEORIGIN
```
W AWS CLI (jednorazowo):
```bash
aws cloudfront create-response-headers-policy --response-headers-policy-config '…'
aws cloudfront update-distribution --id E35P5HJR5VHDCE …  # przypiąć policy do default behavior
```
Lub w konsoli: CloudFront → distribution E35P5HJR5VHDCE → Behaviors → Edit → Response headers policy → CreateNew lub use AWS managed `SecurityHeadersPolicy`.

---

## P2 — Medium (jak czas pozwoli)

### [LIVE] Brak BreadcrumbList JSON-LD na stronach kategorii i indeksu blogowego
**Where:** `src/pages/blog/index.astro`, `src/pages/blog/kategoria/[category].astro:130-138` (widoczne wizualnie breadcrumbs, ale bez schema)

**Evidence:**
```
$ curl -s …/blog/ | grep -c 'application/ld+json'
0
$ curl -s …/blog/kategoria/poradniki/ | grep -c 'application/ld+json'
0
```
Posty blogowe MAJĄ BreadcrumbList (BlogLayout dostarcza), ale category/index pages — nie.

**Fix:** W `src/pages/blog/kategoria/[category].astro` po `getStaticPaths` dodać:
```ts
const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Strona główna", "item": "https://www.licencjackie.pl/" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.licencjackie.pl/blog/" },
    { "@type": "ListItem", "position": 3, "name": categoryName, "item": `https://www.licencjackie.pl/blog/kategoria/${categorySlug}/` }
  ]
};
```
i w body Layout:
```astro
<script type="application/ld+json" set:html={JSON.stringify(breadcrumbSchema)} slot="head" />
```
Analogicznie w `src/pages/blog/index.astro` (level 2 only).

---

### [LIVE] Wszystkie `<img>` bez `width`/`height` (PSI flag, CLS risk)
**Where:** Components z grid kart postów — `src/layouts/BlogLayout.astro`, `src/pages/index.astro`, `src/pages/blog/index.astro`, `src/pages/blog/kategoria/[category].astro`. Każde `<img class="w-full h-full object-cover" loading="lazy">` bez `width`/`height`.

**Evidence:** PSI mobile `unsized-images` score 0.5 (fail). Plus tylko 2 jpg na post (LCP) były skanowane PSI, więc faktyczny impakt szerszy.

**Fix:** W każdym `<img>` dodać explicite `width` i `height` (rzeczywiste piksele oryginalnego pliku, np. `width={1200} height={630}`). Jeszcze lepiej: zamienić wszystkie `<img>` na `<Image>` z `astro:assets` — dostają width/height automatycznie. Patrz pierwszy P1 (LCP fix), to ten sam pakiet pracy.

---

### [LIVE] Strona główna może rankować na "pisanie prac" — H1 generyczny, brak intro-paragraphu z keyworda
**Where:** `src/pages/index.astro:84-95` (Hero section)

**Evidence:**
```
H1 = "Wszystko o pisaniu prac dyplomowych"
title = "Pisanie pracy licencjackiej i magisterskiej - jak napisać pracę dyplomową? | Licencjackie.pl"
GSC: 83 imp, pozycja 36.7, 0 clicks
```
Title jest OK (66 znaków, query "pisanie pracy"), ale H1 zbyt ogólny — nie pokrywa specyficznych intentów ("jak napisać pracę licencjacką", "pomoc w pisaniu pracy magisterskiej") które wpisują studenci. Pozycja 36 sugeruje że Google rozumie domenę, ale rzadko ją wybiera dla głębszej query.

**Fix:** Wzmocnić Hero section:
- H1 (`src/pages/index.astro` linia 84-87): `Jak napisać pracę licencjacką i magisterską` (target dwie konkretne queries, nie ogólnik)
- Po H1 dodać paragraf 50-80 słów z linkami wewnętrznymi do najmocniejszych guide'ów (`/blog/temat-pracy-licencjackiej/`, `/blog/struktura-pracy-licencjackiej/`, `/blog/bibliografia-pracy-licencjackiej/`).

---

### [LIVE] Sitemap nie zawiera meta-refresh redirect HTMLi (122 URLe vs 157 w DB) — głównie pożądane
**Where:** `astro.config.mjs:8-14` (sitemap config) + meta-refresh stuby w `dist/`

**Evidence:**
```
$ curl -s …/sitemap-0.xml | grep -c '<loc>'
122
DB: totalPages=157, indexedPages=148
```

Różnica 35 URLi ≈ liczba meta-refresh stubów (`/ankieta-w-pracy-magisterskiej/`, `/category/praca-licencjacka/` itp.). To są poprawnie wykluczone (`noindex` w refresh stub) — sitemap zawiera tylko docelowe URLe.

**Impact:** Niezerowy ale pożądany — nie chcesz 35 noindex URLi w sitemapie. To bardziej audit-noise niż finding.

**Fix:** Jeśli przeniesiesz redirects do CF Function (patrz P1), całkowicie te 35 stubów znika z `dist/` i sitemap matchuje DB.

---

## P3 — Polish (backlog)

- **18 cienkich kategorii "Pisanie prac z X" po 2 posty** — duplikuje się z osobnymi artykułami `/blog/pisanie-prac-magisterskich-z-X/`. Po wykonaniu fix P1 (intro paragraphs), zweryfikować czy te listingi nadal mają sens — być może warto je `noindex` i zachować jedynie content-rich artykuły.
- **Strona główna nie ma `BreadcrumbList`** (bo poziom 1) — OK, nic do roboty. **Ale ma 2× JSON-LD (WebSite + Organization) w slocie `head`** — można dodać `WebPage` schema (typ landing). Marginalny upside.
- **`@type=Article` na blog postach** (BlogLayout). Można zmienić na `BlogPosting` — semantycznie bliższe, choć Google traktuje identycznie.

---

## Unverified — needs re-run
- **CrUX field data** — PSI nie zwrócił danych z prawdziwych użytkowników (`no CrUX field data` dla wszystkich 3 URLi) bo ruch jest poniżej progu agregacji Google. Wszystkie metryki LCP/CLS/INP z PSI są **lab-only** (jeden run każdy) — bias na 1-2 sek możliwy.
- **Top 50 query intent analysis** — w `Page` table są tylko URL-level metryki; brak `GSCQuery` joinu w tym audycie. Aby ocenić cannibalization globalnie, potrzeba `GSCQuery` × `Page` × `pivot`. Wymaga osobnej iteracji.

## Skipped — not applicable to this profile
- **Faceted-search & product schema** — nie e-commerce.
- **hreflang** — single-language site (pl-PL).
- **Orphan pages graph (L1/L2)** — Astro static z internal links przez Navbar/Footer/related-posts; analiza grafowa nieproporcjonalna do wartości przy 122 URLi.
- **Backlink toxicity** — outside skill scope (DA=16, kanonik smart-edu.ai jest oczekiwany dla profilu Satellite).

---

## Sequence of recommended actions

**Code changes (jedna sesja, ~2h):**
1. `src/layouts/Layout.astro:38` — canonical jako fallback z `Astro.url.pathname` (P0)
2. `src/components/CookieBanner.astro:489-497` — zawsze ładuj GTM przy init (P0)
3. `src/pages/blog/index.astro:42-53` — nowy tytuł + H1 dla blog-indexu (P1 cannibalization)
4. `src/pages/blog/kategoria/[category].astro` — intro paragraphs + BreadcrumbList JSON-LD (P1 thin content + P2 schema)
5. `src/pages/404.astro:7,11-13` + `Layout.astro:30-32` — prop-driven robots meta (P1)
6. `src/layouts/BlogLayout.astro` + wszystkie listing — zamienić `<img>` na `<Image>` z `astro:assets` (P1 LCP + P2 unsized-images)
7. **`astro.config.mjs:21-200` + `infra/cloudfront/trailing-slash-301.js`** — przenieść 82 redirects do CF Function (P1)

**Infra (oddzielnie):**
8. CloudFront E35P5HJR5VHDCE → Response Headers Policy: HSTS + X-Content-Type-Options + Referrer-Policy (P1)
9. `bash infra/cloudfront/deploy-function.sh` aby wdrożyć nowy CF Function z 82 redirectami
10. `bash deploy.sh` → S3 sync + CloudFront invalidation

**Po deployu:**
11. **W GSC** request reindex tylko 5 najważniejszych URLi (rate limit ~10/dzień): `/`, `/blog/`, `/blog/kategoria/pisanie-prac-z-prawa/`, `/blog/kategoria/poradniki/`, `/blog/przypisy-w-pracy-magisterskiej/`. Reszta sama się doczyta przy normalnym crawlu.
12. Po 2 tygodniach sprawdzić w GSC: czy non-trailing-slash URLe (`/blog/analiza-i-ocena-zrodel` itp.) wypadły z raportu Performance — dowód że CF redirect skonsolidował equity.

---

## Appendix — verification commands

```bash
# Canonical check (P0)
for url in / /blog/ /blog/kategoria/poradniki/ /kierunki/ /kontakt/; do
  echo "=== $url ==="
  curl -s "https://www.licencjackie.pl$url" | grep -E 'rel="canonical"' || echo "BRAK"
done

# GTM presence check (P0)
curl -s https://www.licencjackie.pl/ | grep -oE 'src="https://www.googletagmanager.com/gtm.js[^"]*"' || echo "GTM script not in initial HTML"

# Trailing slash redirect chain (P1)
curl -sIL https://www.licencjackie.pl/ankieta-w-pracy-magisterskiej/ | grep -E "^(HTTP|Location)"
# Expected after fix: HTTP/1.1 301 → Location /blog/ankieta-w-pracy-magisterskiej/ → HTTP/1.1 200

# Security headers (P1)
curl -sI https://www.licencjackie.pl/ | grep -iE "strict-transport|x-content-type|referrer-policy"

# LCP check (P1)
curl -sI https://www.licencjackie.pl/blog/przypisy-w-pracy-magisterskiej.jpg | grep -i content-length
# After WebP fix: <100000 (target <80 KB)

# Sitemap vs DB drift (P2)
curl -s https://www.licencjackie.pl/sitemap-0.xml | grep -oE '<loc>[^<]+</loc>' | wc -l
ssh panel "sudo -u postgres psql -d seo_panel -tAc \"SELECT count(*) FROM \\\"Page\\\" WHERE \\\"domainId\\\"='cmn9fo4dy0007qrdyriit7fd3' AND \\\"inSitemap\\\"=true\""
```
