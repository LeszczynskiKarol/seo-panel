# SEO on-site audit — grandkuchnie.pl
**Date:** 2026-05-25
**Profile:** A (static brochure / local business) — Astro static site, ~32 URLs, lokalny biznes (kuchnie na wymiar woj. kujawsko-pomorskie), deploy S3+CloudFront, ostatni commit + deploy 2026-03-23
**Stack:** Astro 4.16 + React + Tailwind + @astrojs/sitemap, build statyczny, S3 bucket `www.grandkuchnie.pl` + CloudFront `E3BHDI3E6KXQAJ`
**Repo↔prod state:** in-sync — `git status` czysty, `Last-Modified` headera (2026-03-23 10:20:32 GMT) zgadza się z ostatnim commitem `3855287`
**Last crawl:** n/a — domena nie istnieje w `seo_panel` | **GSC:** n/a | **GA4:** n/a (GTM-5S7T7F2G osadzony w HTML)
**Pages:** 32 w sitemap (1 home, 1 blog index, 4 blog posts, 9 kategorii blog, 5 miast, 9 usług, 3 statyczne)

---

## ⚠ Data freshness caveats
- Brak metryk GSC/GA4 w `seo_panel` — domena nigdy nie została dodana do `Domain`. Wszystkie ustalenia oparte wyłącznie na live HTTP / PSI / inspekcji kodu. Ranking & query data → niedostępne dla tego audytu.
- CrUX field metrics: `no field data` — strona ma za mały ruch żeby Google miał próbkę CrUX dla CWV. Wszystkie liczby LCP/FCP poniżej z PSI lab (Lighthouse).

---

## P0 — Critical (fix this week)

### [LIVE] og:image dla 26+ stron prowadzi do 404 — psute Open Graph dla całej strony oprócz blog posts
**Where:** `src/layouts/Layout.astro:14` (default `ogImage = '/img/og-image.jpg'`), live URL: `https://www.grandkuchnie.pl/img/og-image.jpg`
**Evidence:**
```
$ curl -sI https://www.grandkuchnie.pl/img/og-image.jpg
HTTP/1.1 404 Not Found
Content-Length: 12773            ← identyczne z body 404 page
X-Cache: Error from cloudfront
```
Plik nie istnieje ani w `public/img/` ani w `dist/img/` (są tam tylko `favicon.png`, `kuchnia_na_wymiar*.webp`, `logo.png`). Każda strona która nie nadpisuje `ogImage` (homepage, 5× /miasto/, 9× /uslugi/, /blog/, /blog/kategoria/×9, /kontakt, /realizacje, /polityka-prywatnosci) wysyła do Facebooka/LinkedIn/WhatsApp `<meta property="og:image" content="/img/og-image.jpg">` — share card pokazuje pusty obrazek lub fallback.
**Impact:** Wszystkie udostępnienia social mediów lokalnego biznesu wyglądają nieprofesjonalnie → mniej kliknięć z FB share, brak preview w komunikatorach. Local business SEO mocno powiązany z social signals.
**Fix:** Dwa kroki — w skrócie: dodać plik + zmienić ścieżkę na absolutną.
1. Stwórz `public/img/og-image.jpg` (1200×630 px JPG/WebP, branding Grand Kuchnie + hasło + tel). Plik referencyjny do designu jest np. w którymkolwiek `1740478531501-a1-3-1_opt.webp` na S3 piszemy.com.pl.
2. W `src/layouts/Layout.astro:14-17` zmień default na absolutny URL i normalizuj override:
   ```astro
   ogImage = '/img/og-image.jpg'
   } = Astro.props;
   const canonicalURL = new URL(Astro.url.pathname, Astro.site);
   const ogImageURL = new URL(ogImage, Astro.site).toString();
   ```
   I w meta tagach (linie 36 i 46) użyj `{ogImageURL}` zamiast `{ogImage}`. **Open Graph specyfikacja wymaga absolutnych URLi** — FB scraper często nie potrafi rozwiązać ścieżki względnej. Astro 4 zwraca `Astro.site` (z `astro.config.mjs:7`) jako `https://www.grandkuchnie.pl/`, więc `new URL('/img/og-image.jpg', Astro.site)` da poprawne `https://www.grandkuchnie.pl/img/og-image.jpg`. To samo rozwiąże problem dla `BlogLayout.astro` linia 115 (gdy `image` z frontmatter jest względne).

### [LIVE] Mobile LCP 17.1 s / Performance 56 — krytyczna wydajność mobilna
**Where:** `https://www.grandkuchnie.pl/` (homepage), też miasto/torun 16.0s i blog 12.8s
**Evidence:** PSI mobile (2026-05-25):
```
Performance: 0.56 | LCP: 17.1s | FCP: 4.3s | TBT: 170ms | CLS: 0
Total bytes: 9 163 KiB (~9 MB)
Top failed:
[0] image-delivery-insight    — Est savings 7 777 KiB
[0] cache-insight             — Est savings 8 605 KiB
[0] render-blocking-insight   — Est savings 1 350 ms
[0] unused-javascript         — Est savings 260 KiB
[0.5] unsized-images          — <img> brak width/height
```
Rdzeń problemu: 
- pojedynczy obraz hero `1739376513294-KA2-4.jpg` waży **1 593 204 B (1.5 MB JPG)**, drugi `1739376104808-meble-wa-16.jpg` waży **805 KB**. To są fotografie wsadzone bezpośrednio do HeroCarousel.tsx (ścieżki w `src/data/`), bez wariantów responsywnych, bez WebP, bez resize do rozmiaru wyświetlanego (Carousel = `h-[500px]`, czyli max ~1000×500 px).
- żaden obraz z `s3.eu-north-1.amazonaws.com/piszemy.com.pl/grandkuchnie/*` **nie ma headera Cache-Control** — przeglądarka i CDN nie cache'ują (potwierdzone curl).
- `public/img/logo.png` waży **172 KB** a `public/img/favicon.png` **174 KB** — to są ikony, powinny ważyć ~5-20 KB każda.
- Także te w `public/` (serwowane z S3 `www.grandkuchnie.pl`) **nie mają Cache-Control** (tylko `Last-Modified`).

Google używa CWV jako rankingowego sygnału w mobile, a LCP 17.1s to 7× powyżej progu "poor" (4 s). Brak Cache-Control = każdy powtórny visit pobiera 9 MB od nowa.
**Impact:** mobile bounce rate, słabszy ranking w MOB, kosztowne dla Toruń/Bydgoszcz (lokalna konkurencja walczy o frazy z PSI 80+). Estymowana redukcja transferu po fixach: ~8 MB / load (z 9.1 MB do ~1 MB).
**Fix:** trzy ortogonalne akcje (każda osobno warta P0):
1. **CloudFront Response Headers Policy + cache-control na S3:** w AWS Console → CloudFront → Distribution `E3BHDI3E6KXQAJ` → Behaviors → utwórz Response Headers Policy "cache-static-1y" z `Cache-Control: public, max-age=31536000, immutable` i przypisz do path patternów `/_assets/*` (zawartość z hashem) oraz `/img/*`. Dla HTML osobny pattern z `max-age=300, must-revalidate`. Equivalent przez CLI:
   ```bash
   aws s3 cp s3://www.grandkuchnie.pl/_assets/ s3://www.grandkuchnie.pl/_assets/ --recursive --metadata-directive REPLACE --cache-control "public, max-age=31536000, immutable"
   aws s3 cp s3://www.grandkuchnie.pl/img/ s3://www.grandkuchnie.pl/img/ --recursive --metadata-directive REPLACE --cache-control "public, max-age=2592000"
   ```
   Następnie dodaj do `deploy.sh` po linii 29:
   ```bash
   aws s3 cp s3://${S3_BUCKET}/_assets/ s3://${S3_BUCKET}/_assets/ --recursive --metadata-directive REPLACE --cache-control "public, max-age=31536000, immutable" --no-progress
   aws s3 cp s3://${S3_BUCKET}/img/ s3://${S3_BUCKET}/img/ --recursive --metadata-directive REPLACE --cache-control "public, max-age=2592000" --no-progress
   ```
   żeby kolejne deploy'e tego nie zresetowały.
2. **Dla piszemy.com.pl S3 bucket (skąd ładują się hero images):** dodać `Cache-Control: public, max-age=31536000` jako default object metadata dla całego bucketa (bo te obrazy nigdy się nie zmieniają — mają hash w nazwie typu `1739376513294-KA2-4.jpg`).
3. **Resize + WebP hero images:** dla każdego `*.jpg` o wadze >300 KB użyj `cwebp -q 82 -resize 1600 0 input.jpg -o input.webp` (lub Squoosh), zaktualizuj ścieżki w `src/data/` i HeroCarousel.tsx. Lista plików do konwersji (>300 KB) z homepage: `1739376513294-KA2-4.jpg` (1.5 MB), `1739376104808-meble-wa-16.jpg` (805 KB), `1739377196824-kuchsier-3.jpg`, `1751701550370-IMG_1811.jpeg`, plus city heroes `torun.jpg`/`bydgoszcz.jpg` itd. (~390 KB każdy). Dodaj `loading="lazy"` na wszystkich obrazach poniżej viewportu i `width`/`height` na każdym `<img>` (PSI flaguje `unsized-images`).

---

## P1 — High (fix this sprint)

### [LIVE] Schema.org JSON-LD całkowicie nieobecne na żadnej stronie
**Where:** `src/layouts/BlogLayout.astro:117-126` używa `<script slot="head">`, ale `src/layouts/Layout.astro` **nie definiuje `<slot name="head" />` w `<head>`** (linie 25-92). Astro 4 tichcho odrzuca contentup nazwanego slota który nie istnieje.
**Evidence:**
```
$ for slug in trendy-kuchenne-2026 trojkat-roboczy-ergonomiczna-kuchnia ile-kosztuje-kuchnia-na-wymiar jak-wybrac-material-na-fronty-kuchenne; do
    count=$(curl -s "https://www.grandkuchnie.pl/blog/$slug/" | grep -c "ld+json")
    echo "/blog/$slug/ → JSON-LD: $count"
  done
/blog/trendy-kuchenne-2026/ → JSON-LD: 0
/blog/trojkat-roboczy-ergonomiczna-kuchnia/ → JSON-LD: 0
/blog/ile-kosztuje-kuchnia-na-wymiar/ → JSON-LD: 0
/blog/jak-wybrac-material-na-fronty-kuchenne/ → JSON-LD: 0
Homepage: 0 | /miasto/torun/: 0 | /uslugi/projektowanie-kuchni/: 0
```
**Impact:** Brak rich snippets w Google (article preview, breadcrumbs, business info). Dla lokalnego biznesu krytyczne braki to **LocalBusiness** (nie pojawi się w Knowledge Graph + Maps z dokładnymi godzinami/telefonem/adresem) i **Article** (no `Article` cards w Discover/SGE).
**Fix:** dwie zmiany:
1. W `src/layouts/Layout.astro` po linii 91 (przed `</head>`) dodaj `<slot name="head" />`. To natychmiast naprawi Article+BreadcrumbList na 4 blog postach (kod już jest w BlogLayout.astro:59-109, działający, tylko nieosadzony).
2. W `src/layouts/Layout.astro` przed `<title>` (linia 54) dodaj LocalBusiness JSON-LD (homepage i city pages skorzystają — to też wartość per-strona, więc warto sparametryzować przez props):
   ```astro
   const localBusinessSchema = {
     "@context": "https://schema.org",
     "@type": "LocalBusiness",
     "name": "Grand Kuchnie",
     "image": "https://www.grandkuchnie.pl/img/logo.png",
     "telephone": "+48576376567",
     "email": "kontakt@grandkuchnie.pl",
     "address": {
       "@type": "PostalAddress",
       "streetAddress": "ul. Polna 134, hala nr 3",
       "addressLocality": "Toruń",
       "postalCode": "87-100",
       "addressCountry": "PL"
     },
     "areaServed": ["Toruń", "Bydgoszcz", "Włocławek", "Grudziądz", "Inowrocław", "województwo kujawsko-pomorskie"],
     "url": "https://www.grandkuchnie.pl",
     "priceRange": "$$"
   };
   ```
   i renderuj `<script type="application/ld+json" set:html={JSON.stringify(localBusinessSchema)} />` w `<head>`. NIP `9562111620` i REGON `389437853` (z Footer.astro:96-97) idealnie pasują też do pola `taxID` / `identifier`. Współrzędne geo dodaj jeśli masz w Google Business — to wzmacnia LocalBusiness.

### [LIVE] 9 stron usług ma duplikujące się, zbyt krótkie meta descriptions
**Where:** wszystkie 9 stron `/uslugi/*` — źródło prawdopodobnie w `src/data/services.ts` (`heroSubtitle` re-used as description) i w `src/pages/uslugi/[slug].astro`
**Evidence:**
```
/uslugi/akryl-lakier-plyta/        description="Projekt, montaż, produkcja"          (26 chars)
/uslugi/akrylowe-mata/             description="Projekt, produkcja, montaż"          (26 chars, DUP)
/uslugi/blaty-hpl/                 description="Projekt, produkcja, montaż"          (26 chars, DUP)
/uslugi/fornir/                    description="Projekt, produkcja, montaż"          (26 chars, DUP)
/uslugi/mdf-lakierowany/           description="Projekt, wykonanie, montaż"          (26 chars, DUP)
/uslugi/plyta-laminowana/          description="Projekt, wykonanie, montaż"          (26 chars, DUP)
/uslugi/projektowanie-kuchni/      description="Zamów swoją wymarzoną aranżację kuchenną"  (44 chars)
/uslugi/lazienka-na-wymiar/        description="Piękne i praktyczne przestrzenie..."        (51 chars)
/uslugi/szafy-zabudowy-garderoby/  description="Stylowe i praktyczne rozwiązania..."        (51 chars)
```
Wszystkie poniżej 70-160 zalecanego zakresu. **Pięć stron ma identyczny tekst "Projekt, produkcja, montaż" lub "Projekt, wykonanie, montaż"** → Google ignoruje meta description i generuje własną z pierwszego paragrafu (zwykle gorszą).
**Impact:** Niższy CTR z SERP, gorzej dopasowane snippety, brak różnicowania konkurencyjnych fraz typu "kuchnia z fornirem", "blaty HPL". Bezpośrednio mniej kliknięć.
**Fix:** W `src/data/services.ts` dodaj pole `metaDescription: string` (osobne od `heroSubtitle`) — przykład dla `plyta-laminowana`:
```ts
metaDescription: "Kuchnie z płyty laminowanej na wymiar — ekonomiczny wybór z szeroką paletą wzorów i odpornością na zarysowania. Projekt, produkcja i montaż w Toruniu i woj. kujawsko-pomorskim. Darmowa wycena."  // 196 chars — przytniesz do 158
```
Następnie w `src/pages/uslugi/[slug].astro` przekaż `description={service.metaDescription ?? service.heroSubtitle}`. Skup się na frazach: nazwa materiału + "na wymiar" + miasto + cena/wycena CTA. ~130-155 znaków każda, unikalna.

### [LIVE] Brak Cache-Control na statycznych assetach (osobno od P0 perf — bo deploy-process workflow)
**Where:** S3 bucket `www.grandkuchnie.pl`, ścieżki `/img/*` i `/_assets/*`
**Evidence:**
```
$ curl -sI https://www.grandkuchnie.pl/img/logo.png | grep -i cache
(empty)
$ curl -sI https://www.grandkuchnie.pl/_assets/_slug_.36AOGIzF.css | grep -i cache
(empty)
```
PSI: `cache-insight — Use efficient cache lifetimes — Est savings of 8 605 KiB`.
**Impact:** powtórzenie problemu z P0 + każdy kolejny deploy będzie miał tę samą lukę dopóki `deploy.sh` nie ustawi metadata.
**Fix:** Patrz P0 punkt 1 — dodać metadata-set w `deploy.sh`. Tutaj raport wyróżnia to jako osobne workflow finding, bo bez procesowej zmiany w deploy.sh problem wraca po każdej zmianie pliku.

### [LIVE] H1 niespójny między stronami miast — "Kuchnie" vs "Kuchnia"
**Where:** `src/data/cities.ts:18` vs `src/data/cities.ts:27,36,45,54`
**Evidence:**
```
/miasto/torun/      <h1>Kuchnie na wymiar - Toruń</h1>       (plural)
/miasto/bydgoszcz/  <h1>Kuchnia na wymiar - Bydgoszcz</h1>   (singular)
/miasto/wloclawek/  <h1>Kuchnia na wymiar - Włocławek</h1>   (singular)
/miasto/grudziadz/  <h1>Kuchnia na wymiar - Grudziądz</h1>   (singular)
/miasto/inowroclaw/ <h1>Kuchnia na wymiar - Inowrocław</h1>  (singular)
```
**Impact:** Wskazuje że dane pochodzą z różnych edycji szablonu. Search-intent: Google ranking dla frazy "kuchnia na wymiar toruń" rzecz jasna wygenerowałby ten H1 zgodnie z singular wzorcem; "Kuchnie" (plural) jako jedyna anomalia osłabia spójność klastrów.
**Fix:** W `src/data/cities.ts:18` zmień `heroTitle: "Kuchnie na wymiar - Toruń"` → `"Kuchnia na wymiar - Toruń"` (lub odwrotnie: zmień wszystkie 5 na plural — wybór bazuje na tym, którą frazę chcesz rankować). Sprawdź GSC po podłączeniu w `seo_panel` które warianty mają największe impressions — to przesądzi.

### [LIVE] Header nawigacja nie zawiera linków do /uslugi/* — 9 stron usług osiągalnych tylko z Footer (tylko 6 z 9)
**Where:** `src/components/Header.astro:3-10` — menuItems nie zawiera /uslugi/ wcale; `src/components/Footer.astro:32` — `services.slice(0, 6)` pokazuje tylko 6 pierwszych
**Evidence:** Header.astro:34-46 navbar-center pokazuje tylko 5 miast; navbar-end pokazuje [Blog, Realizacje, Darmowa wycena]. Mobile menu (linie 73-86) ma menuItems + miasta, **brak /uslugi/**. Footer pokazuje `services.slice(0, 6)` — to są 6 z 9 (3 ostatnie usługi: `fornir`, `lazienka-na-wymiar`, `szafy-zabudowy-garderoby` — możliwe że niezalinkowane z żadnej strony nawigacyjnej).
**Impact:** Crawl-budget i link-equity flow: strony usług otrzymują 0 lub 1 link wewnętrzny zamiast 32 (każdy header → każda usługa). To **typowe deindexowanie** w Profile A. Bardziej praktycznie: użytkownik na stronie miasta nie znajdzie nawigacji do typu kuchni którą chce zamówić.
**Fix:** W `src/components/Header.astro` przed `</ul>` w navbar-center (linia 46) dodaj dropdown "Usługi" z listą wszystkich 9 usług z `services` (analogicznie do iterowania `cities`). Mobile menu po sekcji "Miasta" (linia 86) dodaj sekcję "Usługi" z pełną listą. Footer.astro:32 — usuń `.slice(0, 6)` żeby pokazywać wszystkie 9.

### [WORKFLOW] grandkuchnie.pl nie istnieje w bazie seo_panel — brak monitoringu GSC/GA4
**Where:** `seo_panel` DB na hoście `panel`, tabela `"Domain"`
**Evidence:**
```sql
SELECT d.id, d.domain, di."propertyId" AS ga4
FROM "Domain" d
LEFT JOIN "DomainIntegration" di ON di."domainId"=d.id AND di.provider='GOOGLE_ANALYTICS'
WHERE d.domain ILIKE '%grandkuchnie%';
-- (0 rows)
```
**Impact:** Brak danych do prioritetyzacji audytu (rule #3: traffic-impact), brak alertu o deindexowanych URL-ach (`PAGE_DEINDEXED` events), brak weekly Moz DA/PA refresh. Re-run audytu za miesiąc nie będzie mógł użyć tail-signal checks.
**Fix:** dodaj domenę w seo_panel UI (https://panel.torweb.pl) → New Domain → wpisz `grandkuchnie.pl`, kategoria "local business", powiąż z GSC property `sc-domain:grandkuchnie.pl` i GA4 property (GTM-5S7T7F2G nadal nie podaje propertyID — sprawdź w Google Analytics który G-XXXXXX jest spięty pod ten GTM container, prawdopodobnie nadać dostęp do `google-index-api@ageless-period-491209-s8.iam.gserviceaccount.com` w GA4 Admin → Property Access).

---

## P2 — Medium (fix when capacity allows)

### [LIVE] robots.txt zawiera niepoprawny `User-agent: \*` (backslash przed gwiazdką)
**Where:** `public/robots.txt:1` (1:1 odzwierciedlone w live `https://www.grandkuchnie.pl/robots.txt`)
**Evidence:**
```
$ xxd public/robots.txt | head -1
00000000: 5573 6572 2d61 6765 6e74 3a20 5c2a 0d0a  User-agent: \*..
$ curl -s https://www.grandkuchnie.pl/robots.txt
User-agent: \*
Allow: /

Sitemap: https://www.grandkuchnie.pl/sitemap-index.xml
```
W składni robots.txt `\*` to literalny string "\\*", nie wildcard. Grupa reguł nie ma matchującego user-agenta, więc `Allow: /` jest efektywnie ignorowane. Crawl się dzieje (default = allow w braku reguł), ale przy zmianie strategii ("dodam tu Disallow") strzelisz sobie w kolano.
**Impact:** dziś realnego problemu indeksacji nie ma, ale to mina dla przyszłych zmian.
**Fix:** `public/robots.txt` — zmień linię 1 z `User-agent: \*` na `User-agent: *` (bez backslasha).

### [LIVE] Sitemap nie ma `<lastmod>` na żadnym z 32 URL-i
**Where:** `https://www.grandkuchnie.pl/sitemap-0.xml`, generowany przez `@astrojs/sitemap` w `astro.config.mjs:8`
**Evidence:**
```xml
<url><loc>https://www.grandkuchnie.pl/</loc></url>
<url><loc>https://www.grandkuchnie.pl/blog/</loc></url>
...
(wszystkie 32 url-e bez <lastmod>)
```
**Impact:** Google nie wie kiedy treść aktualizowano → nie traktuje sitemapa jako sygnału świeżości. Dla blog postów ze świeżymi datami to strata sygnału recency.
**Fix:** W `astro.config.mjs:8` zmień `sitemap()` na `sitemap({ lastmod: new Date() })` (build-time timestamp dla wszystkich URL) lub lepiej: skonfiguruj `serialize` callback który dla `/blog/*` używa `post.data.updateDate ?? post.data.publishDate`. Patrz https://docs.astro.build/en/guides/integrations-guide/sitemap/ — opcja `serialize`.

### [LIVE] 5 stron miast — niemal identyczne template'y (doorway page risk)
**Where:** `src/pages/miasto/[slug].astro:30-93`
**Evidence:** Wszystkie 5 city pages renderują dokładnie te same sekcje: `KitchenTypesSection`, `ProcessSection`, `FeaturesSection`, `GoogleReviewsSection`, identyczny CTA. Jedyne unikalne: `heroTitle`, `heroSubtitle`, `heroImage` (zdjęcie miasta), i jedna fraza w CTA "wykonawcy w {city.nameLocative}". To ~95% duplikacji treści między /miasto/torun a /miasto/bydgoszcz.
**Impact:** Google's site-quality systems mogą rozpoznać to jako doorway pattern i indeksować tylko 1 z 5 (zwykle Toruń, bo to siedziba w NAP). Strata 4 potencjalnych wejść na "kuchnia na wymiar bydgoszcz/włocławek/grudziądz/inowrocław".
**Fix:** Dla każdego miasta dodaj 200-400 słów unikalnej treści *na temat lokalny*. Pomysły co dopisać per miasto (możesz to wygenerować lokalnie i wrzucić do `src/data/cities.ts` jako `localContent: string`):
- referencje od klientów z tego miasta (cytat + dzielnica)
- dane o dojeżdżamy (ile km od siedziby Toruń, average czas dojazdu)
- lokalne dzielnice/osiedla gdzie były realizacje (np. Bydgoszcz Fordon, Włocławek Centrum)
- linki do 1-2 najbliższych realizacji z `/realizacje/` jeśli kategoryzowane geograficznie
Po dodaniu — renderuj jako sekcję `<section>` z `<h2>` zawierającym "Kuchnie na wymiar w {city} - jak działamy lokalnie".

### [LIVE] Blog index `/blog/` nie ma `<h1>`
**Where:** `https://www.grandkuchnie.pl/blog/` (źródło: `src/pages/blog/index.astro`)
**Evidence:**
```
$ curl -s https://www.grandkuchnie.pl/blog/ | grep -oE '<h1[^>]*>[^<]+</h1>'
(empty — no H1 on page)
```
Title: "Blog kuchenny, poradnik o kuchniach | Grand Kuchnie - Porady i inspiracje". OK ale brak H1 to brak głównego sygnału on-page topic.
**Impact:** Słabszy sygnał on-page dla rankingu blog hub, szczególnie dla fraz typu "blog kuchenny" / "poradnik kuchnia na wymiar".
**Fix:** W `src/pages/blog/index.astro` dodaj w głównej sekcji `<h1 class="text-4xl lg:text-5xl font-bold mb-4">Blog kuchenny — porady, inspiracje, trendy</h1>` przed listą postów.

### [LIVE] favicon.png 174 KB, logo.png 172 KB
**Where:** `public/img/favicon.png` (174 438 B), `public/img/logo.png` (171 988 B)
**Evidence:** `ls -la public/img/` (powyżej). Logo ładowane w Header.astro:18 i Footer pośrednio (logo URL w JSON-LD ld+json).
**Impact:** Każdy first-visit pobiera 350 KB tylko na ikony brand. Drobne, ale na mobile w słabej sieci to ~1s extra ładowania.
**Fix:** Konwertuj `logo.png` → SVG (jeśli to logo wektorowe) albo do WebP 150×150 px (~5-10 KB). Konwertuj `favicon.png` → 32×32 ICO + 192×192 PNG dla apple-touch (~3-5 KB każdy). Po konwersji zaktualizuj Layout.astro:49-52 i Header.astro:18.

### [LIVE] Brak `<meta name="robots">` na żadnej stronie
**Where:** wszystkie strony (Layout.astro nie generuje meta robots)
**Evidence:** `grep '<meta name="robots"' home.html` → empty
**Impact:** Domyślne zachowanie crawlera = index,follow, więc OK dla treści. Ale brak jakiejkolwiek deklaracji oznacza: jeśli kiedyś będziesz potrzebować `noindex` (np. staging), trzeba pamiętać że nie ma defaultu. Mniej krytyczne — to porządek a nie bug.
**Fix:** W Layout.astro w `<head>` dodaj `<meta name="robots" content="index, follow, max-image-preview:large">` (max-image-preview:large pomaga dla blog postów w SGE). Per-page override przez Props jak `ogImage`.

### [LIVE] Accessibility — color-contrast i target-size fails na homepage
**Where:** PSI a11y score 0.91; failed: `color-contrast` (background/foreground contrast za niski), `target-size` (touch targets za małe).
**Impact:** WCAG niezgodność może mieć drobny wpływ na ranking (Google używa "page experience" sygnałów); ważniejsze że może wykluczać użytkowników z wadami wzroku.
**Fix:** Otwórz https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fwww.grandkuchnie.pl%2F → zakładka Accessibility → dostaniesz konkretne elementy. Najczęstsze winowajcy: jasny tekst typu `text-gray-300` na `bg-secondary` w Footer.astro:15, `text-base-content/60` na białym tle, drobne ikony social w BlogLayout.astro:240-275 (40×40px = bordeline OK, ale gap 12px = za blisko).

---

## P3 — Polish (backlog)

### [LIVE] Brak HSTS i nagłówków bezpieczeństwa
**Where:** CloudFront distribution `E3BHDI3E6KXQAJ`
**Evidence:** `curl -sI https://www.grandkuchnie.pl/` → brak `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`.
**Fix:** W CloudFront → Distribution → Response Headers Policy → utwórz "security-baseline" z HSTS `max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Przypisz do wszystkich behaviors.

### [LIVE] `og:type` na blog postach = `"website"` zamiast `"article"`
**Where:** Layout.astro:38 (`<meta property="og:type" content="website">` — hardcoded), BlogLayout.astro nie nadpisuje
**Evidence:** `curl -s https://www.grandkuchnie.pl/blog/trendy-kuchenne-2026/ | grep og:type` → `"website"`
**Fix:** Layout.astro przyjmij `ogType` jako prop z defaultem `"website"`, w BlogLayout.astro:112 przekaż `ogType="article"`. Dodatkowo dla article przekaż `<meta property="article:published_time">` i `:author`.

### [LIVE] Twitter card `twitter:image` powiela problem og:image
**Where:** Layout.astro:46
**Fix:** rozwiązany przez ten sam fix co og:image (zmienić obie wartości na absolutne).

---

## Unverified — needs re-run
- **GSC/GA4 tail signals** (top 50 queries, low-CTR, zero-conversion sessions) — niemożliwe bez dodania domeny do seo_panel. Re-run audytu po wykonaniu P1 [WORKFLOW] o dodaniu domeny.
- **Crawled-not-indexed cluster (I3)** i **PAGE_DEINDEXED events (I4)** — wymagają GSC API, niedostępne bez integracji.
- **Indexation status check** (czy 32 URL-e z sitemapa są w indeksie Google) — wymaga GSC URL Inspection API albo `site:grandkuchnie.pl` manualnie. Zalecane sprawdzić ręcznie w Search Console po dodaniu.

## Skipped — not applicable to this profile
- **C11/C12 product schema** — to nie e-commerce, brak Product/Offer schema.
- **L1 orphan analysis (formalna)** — 32 URL-e to za mało dla statystyki link-graph; problem header→/uslugi pokryty osobno w P1.
- **L4 broken external links** — tylko 1 wychodzący link (footer→meblesystem.pl + torweb.pl + social share na blog).
- **T16 hreflang** — single-language (pl).
- **Faceted search / pagination** — nie ma.
- **Out-of-stock** — nie e-commerce.

---

## Sequence of recommended actions

**Etap 1 — natychmiastowe live fixes (commit + deploy 1 PR):**
1. Stwórz `public/img/og-image.jpg` (1200×630, brand+CTA).
2. W `src/layouts/Layout.astro:14-17` zmień default `ogImage` na absolutny URL (przez `new URL(ogImage, Astro.site)`) — patrz P0.
3. W `src/layouts/Layout.astro` przed `</head>` dodaj `<slot name="head" />` — odblokuje JSON-LD na blog postach.
4. Dodaj LocalBusiness JSON-LD do `<head>` w Layout.astro (patrz P1).
5. W `src/data/services.ts` dodaj pole `metaDescription` z unikalnym tekstem 130-155 znaków dla każdej z 9 usług.
6. W `src/data/cities.ts:18` zmień `Kuchnie` → `Kuchnia` (lub spójnie odwrotnie wszystkie 5).
7. `public/robots.txt:1` — usuń `\` z `User-agent: \*`.
8. `src/pages/blog/index.astro` — dodaj `<h1>`.
9. `astro.config.mjs:8` — zmień `sitemap()` → `sitemap({ lastmod: new Date() })`.
10. W `Header.astro` dodaj dropdown/sekcję "Usługi" z 9 linkami; `Footer.astro:32` usuń `.slice(0, 6)`.
11. Layout.astro — dodaj `<meta name="robots" content="index, follow, max-image-preview:large">`.
12. `npm run build && ./deploy.sh`.

**Etap 2 — assety i wydajność (osobny PR / sesja):**
13. Konwertuj 4-5 hero-jpg >300 KB do WebP 1600×900 q82. Zaktualizuj `src/data/services.ts` i HeroCarousel.tsx.
14. Konwertuj `public/img/logo.png` + `favicon.png` do WebP/SVG (cel <20 KB każdy).
15. Dodaj `width`/`height`/`loading="lazy"` na każdym `<img>` poza hero.

**Etap 3 — infra (AWS Console):**
16. CloudFront → Distribution → Response Headers Policy: utwórz "cache-static" + "security-baseline". Przypisz do behaviors.
17. S3 bucket `www.grandkuchnie.pl`: ustaw Cache-Control metadata dla istniejących `/img/*` i `/_assets/*` (bash w P0).
18. Aktualizuj `deploy.sh` dodając `aws s3 cp --metadata-directive REPLACE --cache-control ...` po `aws s3 sync`.
19. Dla bucketa `piszemy.com.pl` — default object metadata Cache-Control 1y.

**Etap 4 — workflow/monitoring:**
20. Dodaj `grandkuchnie.pl` w https://panel.torweb.pl: powiąż z GSC (`sc-domain:grandkuchnie.pl`) i GA4 (znajdź `G-XXXX` pod GTM-5S7T7F2G; dodaj `google-index-api@ageless-period-491209-s8.iam.gserviceaccount.com` w GA4 Property Access).
21. Po pierwszym GSC pull (cron 06:00 następnego dnia) — re-run tego audytu żeby wypełnić tail-signal sekcje.

**Etap 5 — treść (najwięcej czasu):**
22. Dla każdej z 5 city pages dopisz 200-400 słów lokalnej treści (referencje, dzielnice, dojazd, lokalne realizacje).

---

## Appendix — verification commands
```bash
# Drift / state
git status --short && git log --oneline -5
git diff src/layouts/Layout.astro

# Live probes
curl -sIL -A "Mozilla/5.0 (compatible; SEO-Audit/1.0)" https://www.grandkuchnie.pl/
curl -sIL -A "Mozilla/5.0 (compatible; SEO-Audit/1.0)" https://grandkuchnie.pl/
curl -sI https://www.grandkuchnie.pl/img/og-image.jpg      # ← powinien zwrócić 200 po fixie
curl -s https://www.grandkuchnie.pl/robots.txt              # ← linia 1 bez backslasha
curl -s https://www.grandkuchnie.pl/sitemap-0.xml | grep -c '<lastmod>'  # ← >0 po fixie

# JSON-LD obecność (po fixie powinno być >=1 per strona)
for u in / /blog/trendy-kuchenne-2026/ /miasto/torun/ /uslugi/projektowanie-kuchni/; do
  echo "$u → $(curl -s https://www.grandkuchnie.pl$u | grep -c 'ld+json') ld+json scripts"
done

# Cache headers po fixie
curl -sI https://www.grandkuchnie.pl/img/logo.png | grep -i cache-control
curl -sI https://www.grandkuchnie.pl/_assets/_slug_.36AOGIzF.css | grep -i cache-control

# PSI po fixie
# https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fwww.grandkuchnie.pl%2F&form_factor=mobile

# DB sanity (z panel hosta)
sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT * FROM \"Domain\" WHERE domain ILIKE '%grandkuchnie%';" 2>/dev/null
```
