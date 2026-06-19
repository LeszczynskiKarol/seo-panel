# SEO on-site audit — mekra.pl
**Date:** 2026-05-25
**Profile:** A (brochure 9 stron) — wariant „local business landing", choć DB ma kategorię SATELLITE (patrz P2-16). Audytowany jak prawdziwa strona firmowa.
**Stack:** Astro 4.16.19 (static output), `@astrojs/sitemap`, Tailwind. S3 (`s3://www.mekra.pl/`) + CloudFront (`E26WECN75Q2HTH`). 9 stron HTML, 436 plików media.
**Repo↔prod state:** in-sync. Ostatni commit `2026-05-21 17:38:47 UTC`, live `Last-Modified: Thu, 21 May 2026 17:38:39 GMT`. `git status` clean, brak dryfu.
**Last crawl:** 2026-05-25 04:27 | **GSC pull:** 2026-05-25 06:00 | **GA4 lastSync:** 2026-05-25 08:00 (ACTIVE)
**Pages:** 9 w sitemap, **1 zaindeksowane** (`/`), 28d GSC: **2 kliki, 39 wyświetleń** | **DA:** 3

---

## ⚠ Drift summary — repo ↔ prod
Brak dryfu. `git status` czysty, ostatni commit zgodny z `Last-Modified` na S3 (różnica 8 s — czas trwania builda). Konfiguracja CloudFront (cf-www.json) trzymana w repo. Nic do zaznaczenia.

---

## P0 — Critical (fix this week)

### [LIVE] Niespójność hosta apex↔www w **całej** infrastrukturze SEO
**Where:**
- `astro.config.mjs:5` — `site: "https://mekra.pl"` (apex)
- `dist/` deploy → bucket `s3://www.mekra.pl/`, CloudFront dystrybucja `E26WECN75Q2HTH` obsługuje **www**
- `mekra.pl` → 301 → `www.mekra.pl` (Location: `https://www.mekra.pl/`)
- Każdy `<link rel="canonical">`, każdy `og:url`, każdy `twitter:url`, wszystkie URL w sitemap-0.xml, wszystkie URL w JSON-LD (`LocalBusiness.url`, `Product.image`, `Product.offers.url`, `BreadcrumbList.item`) używają **apex** `https://mekra.pl/...`
- `robots.txt` → `Sitemap: https://mekra.pl/sitemap-index.xml` (apex też)

**Evidence:**
```
curl -sIL https://mekra.pl/  →  301 Location: https://www.mekra.pl/   ✓ redirect działa
curl -s  https://www.mekra.pl/ | grep canonical  →  <link rel="canonical" href="https://mekra.pl/">
curl -s  https://www.mekra.pl/sitemap-0.xml | grep -o '<loc>[^<]*' | head -3
  <loc>https://mekra.pl/
  <loc>https://mekra.pl/oferta/
  <loc>https://mekra.pl/oferta/ramka-7mm/
DB Page status (cmnhmz8ih6xlwqrwmv6c226nd):
  /                          PASS    Submitted and indexed
  /oferta/                   NEUTRAL Page with redirect
  /oferta/ramka-7mm/         NEUTRAL URL is unknown to Google
  /oferta/ramka-18mm/        NEUTRAL URL is unknown to Google
  /oferta/ramka-36mm/        NEUTRAL URL is unknown to Google
  /oferta/ramka-60mm/        NEUTRAL URL is unknown to Google
  /oferta/zabudowy/          NEUTRAL URL is unknown to Google
  /realizacje/               NEUTRAL URL is unknown to Google
```
**Impact:** Google widzi `https://mekra.pl/oferta/ramka-7mm/` w sitemap, próbuje pobrać → 301 → musi przejść crawl-budget na `www.mekra.pl/...`. Wszystkie sygnały (canonical, OG, schema, breadcrumb item) wskazują na URL który redirectuje. To najbardziej prawdopodobna przyczyna stanu **1/9 zaindeksowanych** po 4 dniach od deployu — Google ma sprzeczne sygnały który host jest kanoniczny. `/oferta/` w GSC od razu sklasyfikowane jako „Page with redirect" zamiast indeksowane.

**Fix:** zdecyduj jeden host. Domyślny wybór: **www** (już deployowane na bucket `www.mekra.pl`, redirect apex→www już działa). Wymagana zmiana:

1. `astro.config.mjs:5` — zmień `site: "https://mekra.pl"` na `site: "https://www.mekra.pl"`.
2. `public/robots.txt` — zmień `Sitemap: https://mekra.pl/sitemap-index.xml` na `Sitemap: https://www.mekra.pl/sitemap-index.xml`.
3. `src/components/IkeaSection.astro` lub inne miejsce gdzie hardcodowane są URL-e schema/JSON-LD (`LocalBusiness.url: "https://mekra.pl"`) — przeszukaj i zmień. Grep:
   ```bash
   grep -rn '"https://mekra.pl' src/
   ```
4. `npm run build && ./deploy.sh`
5. W GSC: zostaw `sc-domain:mekra.pl` (właściwość Domain pokrywa oba), ale resubmit sitemap pod nowym URL-em.

Alternatywa (apex jako kanoniczny) wymagałaby przepięcia CloudFront na bucket `mekra.pl` i zmiany kierunku 301 — większa praca, bez korzyści (www już dominuje w sygnałach DNS od trzech tygodni).

---

### [LIVE] `og:image` i `twitter:image` → 404 (plik nie istnieje)
**Where:**
- `src/layouts/BaseLayout.astro:15` — `ogImage = '/og-image.jpg'` jako default
- Live: `curl -I https://www.mekra.pl/og-image.jpg` → `HTTP/1.1 404 Not Found`
- Lokalnie: `public/og-image.jpg` brak; `dist/og-image.jpg` brak; w S3 `aws s3 ls s3://www.mekra.pl/og-image.jpg` → brak
- Plus problem: ścieżka jest **względna** (`/og-image.jpg`), spec OG wymaga absolutnego URL z `https://`

**Evidence:**
```
curl -sI https://www.mekra.pl/og-image.jpg
HTTP/1.1 404 Not Found
Content-Length: 47599   ← to długość 404.html (potwierdzenie że to fallback)
```

**Impact:** Każde udostępnienie linku do mekra.pl na Facebooku, LinkedIn, Slacku, WhatsAppie, Twitterze nie pokazuje preview image. Wpływ pośredni na CTR z social, bezpośrednio słabsza prezentacja marki w każdym udostępnieniu.

**Fix:** dwie zmiany.
1. **Dorzucić plik**: stwórz `public/og-image.jpg` 1200×630 px (rekomendacja FB/Twitter) — np. front ramiakowy ze `src/components/Hero.astro` + napis „Mekra — fronty ramiakowe z płyty". `sharp` już jest w deps, można skryptem wygenerować z istniejącego `public/img/ramka77mm.jpg`.
2. **Absolutyzować URL** w `src/layouts/BaseLayout.astro` — zmień:
   ```astro
   <meta property="og:image" content={ogImage} />
   <meta property="twitter:image" content={ogImage} />
   ```
   na:
   ```astro
   <meta property="og:image" content={new URL(ogImage, Astro.site).href} />
   <meta property="twitter:image" content={new URL(ogImage, Astro.site).href} />
   ```
   (działa razem z poprawką `site:` z P0-1 — wtedy generuje `https://www.mekra.pl/og-image.jpg`.)

---

## P1 — High (fix this sprint)

### [LIVE] Sitemap nie ma `<lastmod>` w żadnym wpisie
**Where:** `https://www.mekra.pl/sitemap-0.xml` — wszystkie 9 `<url>` to bare `<loc>` bez `<lastmod>`, `<changefreq>` ani `<priority>`.
**Evidence:**
```
curl -sL https://www.mekra.pl/sitemap-0.xml | grep -o lastmod | wc -l  →  0
```
**Impact:** Google nie wie, czy strony się zmieniają — crawl-budget niezoptymalizowany, świeże zmiany (np. dodanie 109 realizacji) nie dostają sygnału do re-crawlu.
**Fix:** w `astro.config.mjs` zmień konfigurację `sitemap()` na:
```javascript
import sitemap from "@astrojs/sitemap";
// ...
integrations: [
  tailwind(),
  sitemap({
    lastmod: new Date(),     // każdy build = nowy timestamp
    changefreq: 'weekly',
    priority: 0.7,
    serialize(item) {
      // override priority for home
      if (item.url === 'https://www.mekra.pl/') item.priority = 1.0;
      return item;
    },
  }),
],
```

### [LIVE] LCP **4.6 s** na home, **6.6 s** na `/oferta/ramka-36mm/` (mobile)
**Where:** PSI mobile, 2026-05-25.
**Evidence:**
```
PSI https://www.mekra.pl/                     perf=0.73  LCP=4.6s  FCP=3.6s  TBT=60ms  CLS=0
PSI https://www.mekra.pl/oferta/ramka-36mm/   perf=0.67  LCP=6.6s  FCP=3.6s  TBT=30ms  CLS=0
Audyt PSI: "Reduce unused JavaScript savings: 600 ms"
```
**Impact:** Poniżej progu „Good" (LCP ≤ 2.5 s) na wszystkich stronach. Wpływa na ranking mobile (Core Web Vitals to confirmed ranking signal od 2021). Dla strony lokalnej w Toruniu, gdzie ruch jest z urządzeń mobilnych, bezpośrednio na konwersję.
**Fix:** trzy konkretne kroki:
1. **Hero image preload**: w `src/components/Hero.astro` dorzuć w head `<link rel="preload" as="image" href="/img/<heroFile>" fetchpriority="high">`. Hero JPGs ważą 200-570 KB — preload przesuwa je z „discovered late" na początek kolejki.
2. **Wymień JPG → WebP w `<img>`** — w S3 są już wersje `.webp` (np. `ramka-7mm-01.webp` = 319 KB vs `.jpg` = 497 KB). Component `src/components/Hero.astro` i `src/components/Gallery.astro` powinny używać `<picture>` z `source srcset="*.webp" type="image/webp"`.
3. **Fonts**: `<link rel="stylesheet">` na `fonts.googleapis.com` jest render-blocking. Dorzuć `media="print" onload="this.media='all'"` lub przenieś do `font-display: swap` przez `<link rel="preload" as="style">`.

### [LIVE] `Product.offers` w schema.org bez wymaganego pola `price`
**Where:** wszystkie 5 stron `/oferta/<slug>/`. Wygenerowane prawdopodobnie w `src/pages/oferta/[slug].astro` lub w komponencie odpowiedzialnym za schema.
**Evidence:** pobrane z `/oferta/ramka-7mm/`:
```json
"offers":{
  "@type":"Offer",
  "availability":"https://schema.org/InStock",
  "url":"https://mekra.pl/oferta/ramka-7mm/",
  "priceCurrency":"PLN",
  "priceSpecification":{
    "@type":"PriceSpecification",
    "description":"Cena indywidualna — wycena na podstawie wymiarów i dekoru"
  }
}
```
**Impact:** Google Rich Results Test wyrzuci warning „Offer missing field 'price'". `availability: InStock` z `priceCurrency` bez `price` jest niespójne — produkt może wypaść z eligibility na product rich snippet (zielone „W magazynie" + cena w SERP). Dla strony, która chce konkurować z gotowymi sklepami z frontami, brak rich snippet to czytelna strata.
**Fix:** **opcja A** (zalecana): zmień `@type: Offer` na `@type: AggregateOffer` z polami `lowPrice` i `highPrice` (jeśli masz widełki) lub usuń `@type: Offer` całkowicie i zostaw tylko `Product` bez `offers` — wtedy nie ma warningu. **Opcja B**: jeśli chcesz zachować `Offer`, dodaj `"price": "0"` z `"priceSpecification.description"` w komentarzu UI „cena indywidualna" — to akceptowalny pattern dla custom-made, choć słabszy.

### [LIVE] Meta description za długie na `/` (248 znaków) i `/oferta/` (246 znaków)
**Where:**
- `src/pages/index.astro` — meta description podawana do `<BaseLayout description="...">` ma 248 znaków
- `src/pages/oferta/index.astro` — 246 znaków
**Evidence:**
```
TITLE [56c]: Fronty ramiakowe z płyty - producent, sprzedaż, oferta
DESC  [248c]: Mekra — producent frontów ramiakowych z płyty laminowanej, matowej i akrylowej. Ramki 7mm, 18mm, 36mm, 60mm. Fronty kuchenne na wymiar, fronty do IKEA. Toruń i kujawsko-pomorskie. Najwyższa odporność, wyczuwalna faktura, konkurencyjna cena.
```
**Impact:** Google ucina opis ok. 155-160 znaków na mobile, 158-170 na desktop. Pełna druga połowa zdania o „najwyższej odporności, wyczuwalnej fakturze, konkurencyjnej cenie" nigdy nie pokaże się w SERP. Marnujesz value-prop, który aktualnie jest „za horyzontem".
**Fix:** przepisz oba opisy do ~155 znaków, kluczowy value-prop na początku.
- `index.astro` propozycja (155c): `Mekra — producent frontów ramiakowych z płyty laminowanej. Ramki 7, 18, 36, 60 mm. Fronty kuchenne na wymiar, fronty do IKEA. Toruń i okolice.`
- `oferta/index.astro` propozycja (153c): `Pełna oferta Mekra: fronty ramiakowe 7/18/36/60 mm + zabudowy na wymiar. Dwustronny dekor, klej PUR, kompatybilność z Blum, Häfele, Hettich.`

### [LIVE] Strony bez końcowego slasha zwracają 302 (powinno być 301)
**Where:** S3 default behavior dla folder redirect — wszystkie URL-e canonical bez `/` na końcu.
**Evidence:**
```
curl -sIL https://www.mekra.pl/oferta
HTTP/1.1 302 Moved Temporarily
Location: /oferta/

curl -sIL https://www.mekra.pl/polityka-prywatnosci
HTTP/1.1 302 Moved Temporarily
Location: /polityka-prywatnosci/
```
DB `Page` ma zarówno `/oferta` (UNKNOWN) jak i `/oferta/` (NEUTRAL — „Page with redirect"). `/oferta` (bez slasha) odebrało **7 wyświetleń w GSC** na pozycji średniej 42 — czyli Google indeksuje wersję bez slasha (z 302) jako osobną i daje jej impresje.
**Impact:** 302 sygnalizuje Google „tymczasowe" — link equity nie przenosi się tak czysto jak przy 301. Dodatkowo dwie wersje URL-a (z/bez slasha) walczą o ten sam impression slot.
**Fix:** w CloudFront skonfiguruj **CloudFront Function** lub **Lambda@Edge** który dla path bez końcowego `/` (poza root i znanymi rozszerzeniami) zwróci 301. Plik `aws-lambdas/` w repo sugeruje że Lambda@Edge już bywa używana — sprawdź czy nie ma istniejącego. Alternatywa lżejsza: w `astro.config.mjs` ustaw `trailingSlash: 'always'` (Astro już to robi domyślnie dla static, ale wymusi to dla wszystkich linków wewnętrznych) i upewnij się, że wszystkie linki wewnętrzne w `src/components/Navbar.astro` i `Footer.astro` mają końcowy `/`.

---

## P2 — Medium (fix when capacity allows)

### [LIVE] Brak `Strict-Transport-Security` (HSTS)
**Where:** CloudFront response headers policy nie ustawia HSTS.
**Evidence:** `curl -sI https://www.mekra.pl/ | grep -i strict` → brak.
**Impact:** Brak ochrony przed SSL strippingiem przy pierwszej wizycie, mniejszy „security signal" dla Google. Niski wpływ na ranking, średni na bezpieczeństwo użytkownika.
**Fix:** w CloudFront utwórz lub zmodyfikuj response-headers policy:
```
aws cloudfront create-response-headers-policy --response-headers-policy-config '{
  "Name":"mekra-security-headers",
  "SecurityHeadersConfig":{
    "StrictTransportSecurity":{
      "AccessControlMaxAgeSec":31536000,
      "IncludeSubdomains":true,
      "Preload":false,
      "Override":true
    }
  }
}'
```
Następnie `aws cloudfront update-distribution --id E26WECN75Q2HTH ...` z polisą przypiętą do default cache behavior. Trzymaj polisę w repo (`cf-www.json` już jest commitowane — dorzuć tam).

### [LIVE] `apple-touch-icon.png` zwraca 404
**Where:** `src/layouts/BaseLayout.astro:65` — `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`. Plik nie istnieje w `public/` ani w S3.
**Evidence:** `curl -sI https://www.mekra.pl/apple-touch-icon.png` → 404, content-length 47599 (fallback 404.html).
**Impact:** Strona zapisana jako skrót na iOS pokazuje generyczną ikonę zamiast logo Mekra. Kosmetyczne, ale widoczne.
**Fix:** wygeneruj `public/apple-touch-icon.png` 180×180 px z `public/favicon.svg` (`sharp` w deps):
```javascript
import sharp from 'sharp';
await sharp('public/favicon.svg').resize(180, 180).png().toFile('public/apple-touch-icon.png');
```

### [CONTENT] H1 na home nie zawiera frazy „fronty ramiakowe"
**Where:** `src/components/Hero.astro` — H1 to obecnie „Charakter wnętrza zaczyna się od frontu" (brand statement).
**Evidence:**
```
H1 home: Charakter wnętrza zaczyna się od frontu
TITLE: Fronty ramiakowe z płyty - producent, sprzedaż, oferta
GSC top query (per Page table, position=17.87): impressions=31 clicks=1 na home
```
**Impact:** Title bije w „fronty ramiakowe", H1 mówi co innego. Google preferuje spójność title↔H1↔intent. Średnia pozycja 17.87 (3 strona) sugeruje, że relevancy signal jest słaby.
**Fix:** to jest **decyzja brand-design vs SEO**. Trzy opcje:
- **A (zalecana, kompromis):** rozbij H1 na dwie linie — pierwsza brand („Charakter wnętrza zaczyna się od frontu"), druga sub-line z keyword (`<span class="block text-xl mt-2">Fronty ramiakowe z płyty — producent Toruń</span>`). H1 nadal zawiera oba — Google parsuje, użytkownik widzi brand-first.
- **B (czysto SEO):** H1 = „Fronty ramiakowe z płyty laminowanej — Mekra", obecny H1 staje się `<p class="hero-tagline">`.
- **C (zostaw):** zaakceptuj że pozycja 17 na „fronty ramiakowe" zostanie, brand-first wygrywa. Wtedy nie ma fix-u, ale flag-uj jako świadomy wybór.

### [CONTENT] 109 realizacji bez indywidualnych podstron
**Where:** `src/data/realizacje.json` ma 109 items z polami `id`, `title`, `description`, ale `src/pages/realizacje/` ma tylko `index.astro`. Brak `[id].astro`.
**Evidence:** lokalnie 5 katalogów `public/img/realizacje/{ramka-7mm,18mm,36mm,60mm,zabudowy}/` po 19/17/50/15/8 items. Nazwy plików wskazują case-study (`ramka-36mm-grudziadz-01`, `ramka-18mm-rubinova-01`, `zabudowa-wino-01`) — czyli projekt-per-realizacja.
**Impact:** Każdy projekt to potencjalny long-tail target (np. „fronty ramiakowe 36mm grudziądz", „zabudowa pod wino na wymiar"). Obecnie cały content galerii to **1 strona** = brak okazji do rankowania na konkretne case-study lub lokalizacje.
**Fix:** stwórz `src/pages/realizacje/[slug].astro` generujący stronę per item z `realizacje.json`. Każda strona: hero image (już masz `.jpg` + `.webp`), opis (uzupełnić w JSON), schema `CreativeWork` lub `ImageObject`, link do odpowiedniej kategorii oferty. Dodaj do sitemap (Astro sitemap integration to wykryje automatycznie).

### [CONTENT] `LocalBusiness.sameAs: []` puste
**Where:** schema JSON-LD w `src/layouts/BaseLayout.astro` lub wstawione przez osobny komponent — pole `sameAs` zawsze `[]`.
**Evidence:** `"sameAs":[]` na każdej stronie.
**Impact:** Słabszy entity validation — Google Knowledge Graph łatwiej kojarzy biznes z profilami społecznościowymi. Mała strona lokalna w Toruniu skorzysta na powiązaniu np. z fanpage FB / Instagram / Google Business Profile.
**Fix:** dodaj URL-e do `sameAs`. Minimum: `"https://www.google.com/maps?cid=..."` (Google Business Profile) + Facebook/Instagram jeśli istnieją. Jeśli profili nie ma — ZADANIE dla marketingu, nie programisty.

### [WORKFLOW] `Domain.category = 'SATELLITE'` w seo_panel jest zła
**Where:** prod DB `seo_panel`, tabela `Domain`, wiersz dla `mekra.pl`.
**Evidence:**
```sql
SELECT category FROM "Domain" WHERE domain='mekra.pl';
SATELLITE
```
**Impact:** Domena to brand business site (producent w Toruniu, fizyczna firma, JSON-LD `LocalBusiness`, formularz kontaktowy, telefon). Sklasyfikowanie jako SATELLITE wpływa na to, jak panel raportuje sukces (satellite = link juice, brochure = traffic/leads), automatyczne reguły w cronach mogą stosować inną politykę indexing-check/crawl-frequency.
**Fix:** zmień ręcznie w panelu lub:
```sql
UPDATE "Domain" SET category='BROCHURE' WHERE domain='mekra.pl';
```
(zweryfikuj nazwę wartości enum — `SELECT DISTINCT category FROM "Domain";` powinno pokazać legalne wartości.)

---

## P3 — Polish (backlog)

### [LIVE] DB śledzi duplikaty `/path` i `/path/` jako osobne wiersze
**Where:** `Page` table — 11 wierszy dla 9 unikalnych URL-i; `/oferta` + `/oferta/`, `/polityka-prywatnosci` + `/polityka-prywatnosci/`.
**Impact:** Czysto dashboard noise — po naprawie 302→301 (P1-9), kanonicznym powinien zostać slash, drugi wiersz `removalNote='duplicate-non-slash'` + UI filter.
**Fix:** osobne workflow, nie kod.

---

## Unverified — needs re-run
Brak. Wszystkie planowane checki dla profilu A zostały wykonane (PSI: 2/2 URL, sitemap: pełna parsacja, schema: 5/5 stron, DB: zarówno `Domain` jak i `Page`).

---

## Skipped — not applicable to this profile
- **L1 orphan / L2 dead-end / L6 anchor concentration** — 9 stron, graf wewnętrzny trywialny (każda podstrona linkowana z Navbar)
- **C2 / C4 duplicate titles / descriptions** — każda z 9 stron ma unikalny title/desc (sprawdzone, OK)
- **I3 „Crawled - currently not indexed" cluster** — tylko 9 URL-i, indywidualne statusy są w sekcji P0-1
- **C11 (Product schema dla e-commerce PDP)** — strona nie jest e-commerce; Product schema obecny, ale nie audytowany jak na PDP (jeden wariant per kategoria, brak SKU/reviews/aggregateRating)
- **T16 hreflang** — strona jednojęzyczna (pl-PL), brak innych wersji
- **C15 over-optimized anchor text** — 9 stron, ręczny przegląd nie ujawnił problemów
- **I5 GSC impressions na URL spoza Page table** — 9 URL-i, wszystkie pokryte
- **Tail signals (high-bounce, zero-conversion)** — tylko 2 kliki 28d, brak danych do analizy

---

## Sequence of recommended actions

1. **(P0-2)** Wygeneruj `public/og-image.jpg` (1200×630) z istniejącego hero JPG (`sharp` w deps).
2. **(P0-1)** Edytuj `astro.config.mjs:5` — `site: "https://www.mekra.pl"`.
3. **(P0-1)** Edytuj `public/robots.txt` — `Sitemap: https://www.mekra.pl/sitemap-index.xml`.
4. **(P0-1)** `grep -rn '"https://mekra.pl' src/` — zamień wszystkie wystąpienia hardcode na `"https://www.mekra.pl"` (komponenty JSON-LD).
5. **(P0-2)** Edytuj `src/layouts/BaseLayout.astro` — zaabsolutyzuj `og:image` / `twitter:image` przez `new URL(ogImage, Astro.site).href`.
6. **(P1-5)** Edytuj `astro.config.mjs` — dorzuć `lastmod`, `changefreq`, `priority` do `sitemap()`.
7. **(P1-8)** Skróć meta description w `src/pages/index.astro` i `src/pages/oferta/index.astro` do ~155 znaków.
8. **(P1-7)** Popraw `Product.offers` w schema — usuń lub przejdź na `AggregateOffer`.
9. **(P2-12)** Wygeneruj `public/apple-touch-icon.png` (180×180) z favicon.
10. `git add -A && git commit -m "fix: canonical www host + og:image + sitemap lastmod + schema offers"`
11. `./deploy.sh` (build + sync + CloudFront invalidation już są w skrypcie).
12. **(P0-1, post-deploy)** W GSC właściwości `sc-domain:mekra.pl` zrób „Inspect URL" + „Request Indexing" dla 8 nowych `www.mekra.pl/...` URL-i. **Uwaga:** GSC ogranicza do ~10 indexing-requestów/dzień/property — wszystkie 8 zmieści się jednorazowo.
13. **(P1-6)** Następna iteracja: hero preload + WebP `<picture>` + `<link rel="preload">` na fonty.
14. **(P1-9)** Lambda@Edge / CloudFront Function na 301 dla URL bez końcowego slasha (osobny task).
15. **(P2-11)** Response-headers policy w CloudFront — HSTS (commit `cf-*-headers.json` do repo).
16. **(P2-14)** Indywidualne strony realizacji `src/pages/realizacje/[slug].astro` — większy task, planuj jako sprint feature.

---

## Appendix — DB snapshot (prod seo_panel, 2026-05-25)
```
Domain row:
id=cmnhmz8ih6xlwqrwmv6c226nd | domain=mekra.pl | category=SATELLITE
totalPages=9 | indexedPages=1 | totalClicks=2 | mozDA=3
lastCrawl=2026-05-25 04:27 | lastGscPull=2026-05-25 06:00
gscProperty=sc-domain:mekra.pl
GA4: properties/526525192 (ACTIVE, lastSync=2026-05-25 08:00)

Page table:
path                          verdict   coverageState                clicks  impr  pos
/                             PASS      Submitted and indexed        1       31    17.87
/oferta                       UNKNOWN   (no GSC data joined)         0       7     42.57
/oferta/                      NEUTRAL   Page with redirect           0       0     -
/oferta/ramka-7mm/            NEUTRAL   URL is unknown to Google     0       0     -
/oferta/ramka-18mm/           NEUTRAL   URL is unknown to Google     0       0     -
/oferta/ramka-36mm/           NEUTRAL   URL is unknown to Google     0       0     -
/oferta/ramka-60mm/           NEUTRAL   URL is unknown to Google     0       0     -
/oferta/zabudowy/             NEUTRAL   URL is unknown to Google     0       0     -
/realizacje/                  NEUTRAL   URL is unknown to Google     0       0     -
/polityka-prywatnosci         PASS      Submitted and indexed        0       1     2
/polityka-prywatnosci/        NEUTRAL   URL is unknown to Google     0       0     -
```

## Appendix — verification commands
```bash
# Host mismatch
curl -sIL https://mekra.pl/ | grep -E '^(HTTP|Location)'
curl -s  https://www.mekra.pl/ | grep -oE 'rel="canonical" href="[^"]*"'
curl -sL https://www.mekra.pl/sitemap-0.xml | head -c 500

# og-image 404
curl -sI https://www.mekra.pl/og-image.jpg

# PSI
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fwww.mekra.pl%2F&strategy=mobile&key=$PSI_API_KEY"

# Trailing slash 302
curl -sIL https://www.mekra.pl/oferta

# Per-page meta
for url in https://www.mekra.pl/ https://www.mekra.pl/oferta/ ...; do
  H=$(curl -s "$url"); ...  # full loop in audit log
done

# DB
ssh_exec panel "sudo -u postgres psql -d seo_panel -A -F '|' -c \"SELECT ...\""
```
