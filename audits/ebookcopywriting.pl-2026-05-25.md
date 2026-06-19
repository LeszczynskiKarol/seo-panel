# SEO on-site audit — ebookcopywriting.pl
**Date:** 2026-05-25
**Profile:** D — single-produkt SaaS/conversion landing (1 ebook za 49 zł, Stripe Checkout, transactional flow z `/sukces` + `/anulowano`). Brak treści blogowej, brak katalogu — to landing produktowy, nie content site (kategoria w DB `CONTENT_SITE` jest myląca).
**Stack:** Astro 5.4 static, `@astrojs/sitemap`, Tailwind, AWS S3 (`www.ebookcopywriting.pl`) + CloudFront (`E1ABIXOTGNPJNL`), Lambda backend dla Stripe (`452b6mr08j.execute-api.eu-central-1`).
**Repo↔prod state:** mixed — `src/pages/index.astro` w HEAD ma kod GA4 events, live HTML też (deploy z 1 kwietnia 2026), ALE `dist/` w git jest stary (HEAD `dist/index.html` zawiera 0× `begin_checkout`, working tree 4×) — dist/ jest trackowany ale nigdy nie commitowany po rebuildzie.
**Last crawl:** 2026-05-25 03:05 | **GSC:** 2026-05-25 06:00 | **GA4:** 2026-05-25 08:00 (ACTIVE, properties/525389609)
**Pages:** 6 śledzonych, 5 zaindeksowanych, 4 w sitemapie | **DA:** 4 / **PA:** 18 | **Last 30d GSC:** 6 kliknięć, 343 wyświetleń, śr. pozycja ~24

---

## ⚠ Drift summary — repo ↔ prod
| Plik | Status | W repo (HEAD) | Na live | Akcja |
|------|--------|---------------|---------|-------|
| `dist/index.html` | `M` modified | stara wersja bez `begin_checkout`/`add_to_cart` (0×) | nowa wersja z eventami (4× `begin_checkout`, 2× `add_to_cart`) | **WORKFLOW** — wynik `npm run build`, dist/ trackowany ale nigdy nie commitowany; live OK |
| `dist/sukces/index.html` | `M` | stary | nowy (zawiera `firePurchaseEvent`) | jw. |
| `dist/anulowano/index.html` | `M` | stary | nowy | jw. |
| `src/pages/index.astro` | committed | zawiera dwa identyczne `begin_checkout` (duplicate) | live tak samo (deploy z 1.04) | DEPLOY-FIX (P1 #8) |
| `og-image.jpg` | **brak w repo i na live** | n/a | 404 | CREATE + UPLOAD (P0 #2) |
| `/polityka-prywatnosci`, `/regulamin` | **brak w `src/pages/`** | n/a | 404 (linkowane z Footera) | CREATE + DEPLOY (P0 #1) |

**Wniosek:** live = src committed. Tylko `dist/` w git jest stary (zawsze będzie "modified" po każdym buildzie, dopóki dist/ jest tracked). Po deployu 1.04.2026 nie było żadnego rebuildu wdrożonego — wszystkie problemy poniżej istnieją na live od 7 tygodni.

---

## P0 — Critical (fix this week)

### [LIVE] 1. Brakujące strony prawne — `/polityka-prywatnosci` i `/regulamin` zwracają 404
**Where:** linki w `src/components/Footer.astro:37-38`:
```astro
<a href="/polityka-prywatnosci" ...>Polityka prywatności</a>
<a href="/regulamin" ...>Regulamin</a>
```
Footer jest renderowany na **każdej** podstronie (4/4).

**Evidence:**
```
$ curl -sI https://www.ebookcopywriting.pl/polityka-prywatnosci
HTTP/1.1 404 Not Found
x-amz-error-code: NoSuchKey

$ curl -sI https://www.ebookcopywriting.pl/regulamin
HTTP/1.1 404 Not Found
```
W `src/pages/` istnieją tylko: `anulowano.astro`, `fragment.astro`, `index.astro`, `sukces.astro`.

**Impact:**
- **Łamanie prawa:** sprzedajesz ebook za 49 zł przez Stripe → musisz mieć dostępny Regulamin (art. 8 ustawy o świadczeniu usług drogą elektroniczną z 18.07.2002) i Politykę Prywatności (RODO art. 13). Brak = ryzyko skargi do UODO/UOKiK i sporu z konsumentem.
- **SEO:** każda z 4 podstron eksportuje 2 broken internal links — sygnał niskiej jakości dla Google.
- **CookieConsent.astro** powołuje się na "Art. 6 ust. 1 lit. a) RODO" — banner istnieje, ale nie ma do czego linkować. Sprzeczność.

**Fix:** Utworzyć `src/pages/polityka-prywatnosci.astro` i `src/pages/regulamin.astro`. Treść regulaminu MUSI zawierać: dane sprzedawcy (Karol Leszczyński + NIP), opis produktu cyfrowego (dostawa: link mailowy w ≤30s), brak prawa odstąpienia (lub explicit info, że zgoda na rozpoczęcie świadczenia = rezygnacja z prawa zwrotu — art. 38 pkt 13 ustawy o prawach konsumenta), płatność (Stripe), reklamacje, jurysdykcja. Polityka prywatności: administrator danych, podstawa prawna (RODO 6.1.b dla zamówienia + 6.1.a dla GA), retencja, prawa podmiotu danych, dane przekazane do Stripe (USA — Standard Contractual Clauses). Po dodaniu: `./deploy.sh`. Po deployu — dodać oba do sitemapy (auto przez `@astrojs/sitemap`) i podać do indeksacji w GSC.

---

### [LIVE] 2. `og:image` 404 — każdy share na FB/LinkedIn/Slack wyświetla zepsuty obrazek
**Where:** `src/layouts/Layout.astro:4` — domyślny `ogImage = '/og-image.jpg'`, wstawiany do `<meta property="og:image">` na każdej stronie.

**Evidence:**
```
$ curl -sI https://www.ebookcopywriting.pl/og-image.jpg
HTTP/1.1 404 Not Found
x-amz-error-code: NoSuchKey
```
`ls public/` pokazuje: `cover-1.png`, `cover-1.webp`, `favicon.svg`, `copywriting-360-preview.pdf`, `robots.txt` — **brak `og-image.jpg`**.

**Impact:** każde udostępnienie linka w mediach społecznościowych (FB Messenger, LinkedIn, WhatsApp, Slack, Discord) pokazuje placeholder zamiast okładki ebooka. Dla landing page produktowego, gdzie social-share to potencjalny kanał dystrybucji — bezpośredni cios w CTR udostępnień. Także Twitter `summary_large_image` card się nie wyrenderuje.

**Fix:** Utworzyć `public/og-image.jpg` 1200×630 px (zalecenie Open Graph), z okładką ebooka + tytułem "Copywriting 360°" + ceną. Możesz wykorzystać `public/cover-1.png` (388 KB, prawdopodobnie zoptymalizować do JPG 80% quality, ~80 KB) jako bazę. Wgrać do `public/og-image.jpg`, zrobić `./deploy.sh`. Weryfikacja: `curl -I https://www.ebookcopywriting.pl/og-image.jpg` → 200, potem [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) → "Scrape Again".

---

### [LIVE] 3. `/sukces/` i `/anulowano/` są w sitemap, indeksowalne i już zaindeksowane przez Google
**Where:**
- `src/pages/sukces.astro`, `src/pages/anulowano.astro` — używają tego samego `<Layout>` co index, więc dziedziczą `<meta name="robots" content="index, follow">`
- `https://www.ebookcopywriting.pl/sitemap-0.xml` zawiera wszystkie 4 URL bez rozróżnienia

**Evidence:**
```
$ curl -s https://www.ebookcopywriting.pl/sitemap-0.xml
... <loc>https://www.ebookcopywriting.pl/sukces/</loc>
    <loc>https://www.ebookcopywriting.pl/anulowano/</loc> ...

$ psql ... SELECT url, "coverageState", impressions FROM "Page" ...
https://www.ebookcopywriting.pl/sukces/    | URL is unknown to Google | 0
https://www.ebookcopywriting.pl/anulowano/ | Submitted and indexed    | 1  ← już zaindeksowana
https://www.ebookcopywriting.pl/fragment/  | Submitted and indexed    | 1
```
`/anulowano/` ma już 1 wyświetlenie w GSC (pozycja 3 dla jakiegoś zapytania).

**Impact:** 
- **Reputacyjnie:** ktoś szuka brand keyword → ląduje na "Płatność anulowana" → myśli, że strona nie działa.
- **Stripe session leak:** `/sukces?session_id=cs_live_xxx` — gdyby Google scrapł URL z parametrem (zdarza się przez external linki), te session IDs trafią do GSC i potencjalnie do indeksu.
- **Sygnał jakości:** thank-you pages w indeksie = "thin content" w oczach Google (~80 słów na `/sukces/`).
- **Schema.org `Book` na thank-you page** — `<Layout>` dziedziczy JSON-LD Book + Offer na każdej podstronie (potwierdzone w live HTML obu stron). Google widzi: "oferta InStock za 49 PLN" na stronie z tytułem "Dziękujemy za zakup" — semantyczny szum.

**Fix:** W `src/layouts/Layout.astro` dodać props `noindex?: boolean` i warunkowy meta:
```astro
const { ..., noindex = false } = Astro.props;
---
<meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
```
W `src/pages/sukces.astro:8` i `src/pages/anulowano.astro` (odpowiednia linia) dodać `noindex={true}` do `<Layout>`. W `astro.config.mjs` skonfigurować `sitemap()`:
```js
sitemap({ filter: (page) => !page.includes('/sukces') && !page.includes('/anulowano') })
```
Także rozważ wyrzucenie JSON-LD `Book` z Layout do osobnego komponentu wrzucanego tylko na `index.astro` i `fragment.astro`. Po deployu: w GSC → Removals → tymczasowe usunięcie `/sukces/` i `/anulowano/`.

---

### [LIVE] 4. GA4 ładuje się dopiero po zgodzie, bez Google Consent Mode v2 (default-denied)
**Where:** `src/components/CookieConsent.astro:296-311`
```js
const consent = getConsent();
if (!consent) {
  setTimeout(showBanner, 800);     // pokazuje banner, ale NIE woła gtag('consent', 'default', ...)
} else {
  if (consent.analytics) loadGA();
  else window['ga-disable-...'] = true;
}
```
Funkcja `loadGA()` (linia 158) wstrzykuje `https://www.googletagmanager.com/gtag/js?id=G-VMQMVTNPLT` dopiero po `saveConsent(true)`. **Nigdy** nie ładuje gtag z `consent_default = denied`.

**Evidence:**
```
$ grep -ciE "consent.*default|analytics_storage" /tmp/eb-home.html
0   ← brak consent default w live HTML
```
Live homepage w ogóle nie zawiera `gtag('consent', 'default', {...})`.

**Impact:** Od marca 2024 r. Google wymaga Consent Mode v2 dla użytkowników z EOG, żeby:
1. Conversion modeling działało — Google modeluje "ukryte" konwersje dla użytkowników bez zgody. Bez `consent.default('denied')` przed banerem ten modelling NIE działa → GA4 jest ślepe na ~30-50% ruchu EOG.
2. Google Ads / Ads Data Hub mogło legalnie przetwarzać dane (jeśli kiedyś włączysz reklamy).

Z domeny zarejestrowanej w GSC widać 343 wyświetleń/30d ale tylko 6 kliknięć — i z GA4 *aktualnie* dostajesz dane wyłącznie od użytkowników którzy aktywnie kliknęli "Akceptuję". Reszta jest nieobserwowalna. Przy 1 zakupie/30d to znacząca przeszkoda w optymalizacji konwersji.

**Fix:** W `src/components/CookieConsent.astro`, **przed** `if (!consent) { setTimeout(showBanner, 800); }` (linia ~299), dodać:
```js
// Consent Mode v2 — default DENIED before any consent decision
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
window.gtag = gtag;

gtag('consent', 'default', {
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'analytics_storage': 'denied',
  'wait_for_update': 500,
});

// Załaduj gtag.js OD RAZU (z denied state) — żeby Google mógł modelować
const s = document.createElement('script');
s.async = true;
s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
document.head.appendChild(s);
gtag('js', new Date());
gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
```
A w `saveConsent(analytics)` zamiast `loadGA()` / `removeGA()` użyć update consent:
```js
gtag('consent', 'update', {
  'analytics_storage': analytics ? 'granted' : 'denied',
});
```
Funkcję `loadGA()` można usunąć w całości — gtag już jest na stronie od początku. Jednocześnie: dodać do polityki prywatności (P0 #1) wzmiankę, że GA ładuje się przed zgodą *z denied storage state* (zgodne z opinią EROD ws. tzw. "consent banners minimum").

---

## P1 — High (fix this sprint)

### [LIVE] 5. `<title>` ma 92 znaki — obcinany w SERP
**Where:** `src/pages/index.astro:68`
```
Ebook Copywriting 360° — książka-poradnik o pisaniu tekstów, które sprzedają | PDF 2026
```
**Evidence:** 92 znaki vs ~60-65 przed obcięciem w wynikach Google (zależy od piksela, ale dla diakrytyków polskich bezpiecznie ~55-60).

**Impact:** Google pokaże coś w stylu *"Ebook Copywriting 360° — książka-poradnik o pisaniu tekstów…"* — końcówka "PDF 2026" (signal aktualności + format) ginie. Spada CTR.

**Fix:** Skrócić do np. *"Copywriting 360° — ebook PDF, 208 stron, 49 zł | 2026"* (52 znaki) lub *"Ebook Copywriting 360° — pisz teksty, które sprzedają (PDF, 49 zł)"* (62 znaki). Edytuj `src/pages/index.astro:68`.

---

### [LIVE] 6. Meta description ma 241 znaków — obcinany w SERP
**Where:** `src/pages/index.astro:69`
```
Ebook o copywritingu po polsku. Książka obejmuje 208 stron, 16 rozdziałów, gotowe formuły, ćwiczenia i rozdział o AI. Naucz się pisać teksty sprzedażowe, nagłówki, landing page, e-maile i oferty. 49 zł.
```
241 znaków vs ~155-160 limitu w wynikach mobilnych.

**Impact:** Obcięcie *"…landing page, e-maile…"*-i-dalej. CTA "49 zł" znika, co kosztuje konwersję.

**Fix:** Skrócić do ~150 znaków + jasne CTA, np.:
> *"Ebook o copywritingu po polsku. 208 stron, 16 rozdziałów, gotowe formuły, ćwiczenia + rozdział o AI. Naucz się pisać teksty, które sprzedają. 49 zł."* (148 znaków)

Edytuj `src/pages/index.astro:69`.

---

### [DRIFT→DEPLOY] 7. Duplikat eventu GA4 `begin_checkout` w `BuyButton` click handler
**Where:** `src/pages/index.astro:729-765` — dwa identyczne bloki:
- Linie 730-750: `gtag('event', 'add_to_cart', ...)` + `gtag('event', 'begin_checkout', ...)` (blok 1)
- Linie 752-765: ponownie `gtag('event', 'begin_checkout', ...)` z tymi samymi danymi (blok 2)

**Evidence:**
```
$ grep -c "begin_checkout" /tmp/eb-home.html   # live
4                ← 2× komentarz "// GA4: begin_checkout event" + 2× gtag('event', 'begin_checkout', ...)
```
Każde kliknięcie "Kupuję" wysyła GA4 **dwa** identyczne `begin_checkout` eventy.

**Impact:** Funnel `add_to_cart → begin_checkout → purchase` w GA4 → `begin_checkout` jest **2× zawyżony**. Konwersja `begin_checkout → purchase` wygląda na ~50% gorszą niż w rzeczywistości. Każda analiza Stripe vs GA4 będzie się rozjeżdżać. Dane funnel są nieużyteczne dopóki nie zostanie to naprawione.

**Fix:** Usunąć linie 752-765 (drugi blok `begin_checkout`). Pozostawić tylko jeden, w bloku z `add_to_cart`. Po edycie:
```bash
./deploy.sh
```
W GA4 (Admin → Data Streams → web) rozważ utworzenie filtra wykluczającego duplikaty na podstawie `event_id` jako bezpiecznik, ale to nie zastąpi naprawy w kodzie.

---

### [LIVE] 8. Schema.org `Book` powielony na `/sukces/`, `/anulowano/` i `/fragment/`
**Where:** `src/layouts/Layout.astro:31-37` — JSON-LD `Book` hardcoded w layoucie, dziedziczony na każdej z 4 stron.

**Evidence:** Pobrane HTML wszystkich 4 podstron zawiera identyczny blok:
```json
{"@type":"Book","name":"Copywriting 360°...","offers":{"@type":"Offer","price":"49","availability":"https://schema.org/InStock"}}
```
na `/sukces/` (thank-you), `/anulowano/` (cancellation), `/fragment/` (PDF preview).

**Impact:**
- Google widzi "InStock Offer 49 PLN" na stronie z `<h1>Dziękujemy za zakup</h1>` i na `<h1>Płatność anulowana</h1>` — niespójne sygnały intencji.
- Może uniemożliwić wyświetlenie rich snippetu Book/Offer dla strony głównej (Google preferuje jedną kanoniczną reprezentację produktu).

**Fix:** Wyrzuć JSON-LD Book z `Layout.astro` do props lub osobnego komponentu wstawianego tylko tam, gdzie ma sens (`index.astro` i opcjonalnie `fragment.astro`):
```astro
// Layout.astro — dodaj props
interface Props { ..., bookJsonLd?: boolean }
const { ..., bookJsonLd = false } = Astro.props;
---
{bookJsonLd && <script type="application/ld+json" set:html={...} />}
```
Następnie `index.astro:67` → `<Layout title="..." description="..." bookJsonLd={true}>`. Pozostałe strony nie ustawiają flagi, więc nie dostają Book.

Przy okazji rozszerz Book o brakujące rekomendowane pola:
```json
{
  "@type":"Book",
  "name":"...",
  "description":"...",
  "image":"https://www.ebookcopywriting.pl/cover-1.webp",
  "publisher":{"@type":"Person","name":"Karol Leszczyński"},
  "datePublished":"2026-04-01",
  "inLanguage":"pl",
  ...
}
```

---

### [LIVE] 9. Brak FAQPage schema mimo 10 pytań FAQ w `<details>`
**Where:** `src/pages/index.astro:53-64` definiuje `faqItems` (10 par Q/A), renderowane jako `<details>...</details>` w sekcji `#faq` (linia 678).

**Evidence:** W live HTML brak `"@type":"FAQPage"` (`grep -i "faqpage" /tmp/eb-home.html` → 0 matches).

**Impact:** Tracisz potencjalny rich snippet FAQ (mimo że Google ograniczył ich wyświetlanie w 2023, dla niszowych zapytań nadal działa). Dla zapytania typu *"czy ten ebook copywriting jest dla początkującego"* — FAQ schema mógłby dać "People Also Ask"-style ekspansję pod twoim wynikiem.

**Fix:** W `src/pages/index.astro` (pomiędzy `---` frontmatter a `<Layout>`, lub jako `set:html` w sekcji FAQ) dodać:
```astro
<script type="application/ld+json" set:html={JSON.stringify({
  "@context":"https://schema.org",
  "@type":"FAQPage",
  "mainEntity": faqItems.map(item => ({
    "@type":"Question",
    "name": item.q,
    "acceptedAnswer": {"@type":"Answer","text": item.a}
  }))
})} />
```

---

### [LIVE] 10. LCP 3.2s na mobile (PSI lab) — kategoria "Needs Improvement"
**Where:** Hero image `src/pages/index.astro:128-135` — `<img src="/cover-1.webp" loading="eager">` 420 px wide, 594 px tall.

**Evidence:**
```
PSI mobile lab:
  performance: 0.86
  LCP: 3.2 s (score 0.73)
  FCP: 2.9 s (score 0.53)
  CLS: 0  ✓
  TBT: 0 ms ✓
CrUX field: brak danych (za mało ruchu)
```
LCP 3.2s = powyżej progu 2.5s. FCP 2.9s też podwyższone.

**Impact:** Mobile-first indexing — Google używa mobile LCP do CWV. Pozycja ~24 w SERP może być częściowo blokowana przez słabe CWV. PSI nie pokazał dużych "opportunities" (>100 ms savings) — winowajcą jest najprawdopodobniej Google Fonts (Plus Jakarta Sans + Instrument Serif w 7 wagach, ładowane synchronicznie linia 30).

**Fix:** 3 niezależne zmiany, każda po 100-300 ms:
1. **Self-host fontów** — pobrać `Plus Jakarta Sans` + `Instrument Serif` z [google-webfonts-helper.herokuapp.com](https://google-webfonts-helper.herokuapp.com/fonts), wrzucić do `public/fonts/`, zastąpić `<link href="fonts.googleapis.com">` lokalnym `@font-face` w Tailwindzie z `font-display: swap`. Eliminuje 2 zewnętrzne preconnecty + 1 round trip.
2. **`<link rel="preload" as="image" href="/cover-1.webp" fetchpriority="high">`** w `Layout.astro` head — explicit signal LCP. Już masz `loading="eager"` ale brakuje preload.
3. **Zmniejsz wagi fontów** — używasz Plus Jakarta `400;500;600;700;800` (5 wag). Realnie w kodzie używasz `font-bold` (700), `font-extrabold` (800), `font-semibold` (600), `font-medium` (500), `font-normal` (400). Wszystkie 5 są używane → zostaw. Ale: Instrument Serif ma `ital@0;1` (italic + non-italic) — sprawdź czy używasz obu (`grep -r "italic" src/`).

---

### [LIVE] 11. Tabela porównawcza ma puste `<th>` — A11Y + SEO
**Where:** `src/pages/index.astro:229-237` (sekcja "Dlaczego akurat TEN ebook"):
```astro
<th class="text-left p-4 text-slate-400 font-medium"></th>   <!-- PUSTY -->
<th ...>Darmowe poradniki</th>
<th ...>Kursy online</th>
<th ...>Copywriting 360°</th>
```

**Evidence:** PSI: `[accessibility] td-has-header: score=0 | <td> elements in a large <table> do not have table headers.`

**Impact:** Screen readery nie potrafią opisać wiersza (np. *"Zakres: Fragmentaryczny / Często rozwodniony / 16 rozdziałów"* zamiast *"undefined: Fragmentaryczny..."*). Google bot słabiej rozumie zawartość tabeli — tracisz potencjalny rich snippet *Table* dla zapytania "porównanie kursów copywritingu".

**Fix:** W `src/pages/index.astro:230` zastąp `<th class="..."></th>` → `<th class="..." scope="col">Kategoria</th>` (lub *"Cecha"*, *"Aspekt"*). Dodaj też `scope="row"` na pierwszej kolumnie `<td>` wewnątrz każdego `<tr>` (linia 250).

---

### [LIVE] 12. PSI: failing `color-contrast` audit
**Where:** PSI: `[accessibility] color-contrast: score=0 | Background and foreground colors do not have a sufficient contrast ratio.`

**Evidence:** PSI raport (nie podaje dokładnego elementu w JSON, ale typowo: `text-slate-400` na ciemnym tle, lub `text-primary-400` na `bg-primary-50`).

**Impact:** WCAG AA wymaga 4.5:1 dla tekstu normalnego, 3:1 dla dużego. Niska kontrastowość = mniejsza accessibility (audytowane przez Google, wpływa na "Page experience signals"), gorsze UX na słabszych ekranach / w słońcu.

**Fix:** Uruchom Lighthouse w Chrome DevTools (Mobile preset) — pokaże dokładne selektory. Najprawdopodobniej do podniesienia: `text-slate-400` → `text-slate-500` lub `text-slate-600` w kilku miejscach (subtitle pod hero, pod cenami itd.). To zazwyczaj 3-5 punktowych edycji w `index.astro`.

---

## P2 — Medium (fix when capacity allows)

### [LIVE] 13. `copywriting-360-preview.pdf` rankuje w GSC ale poza sitemapem i bez polityki indeksacji
**Where:** `public/copywriting-360-preview.pdf` (5.x MB? sprawdź), eksponowany przez `<iframe src="...preview.pdf">` z `src/pages/index.astro:601` i `<a href>` z `:599`.

**Evidence:**
```sql
url                                                          | clicks | impressions | position | isInSitemap
https://www.ebookcopywriting.pl/copywriting-360-preview.pdf  | 0      | 4           | 22.5     | false
```
PDF zaindeksowany przez Google (4 wyświetlenia, pozycja 22.5) — ale nie ma `X-Robots-Tag` ani entry w sitemap.

**Impact:** Niejednoznaczna polityka. Albo go indeksujesz świadomie (wtedy dodaj do sitemap, ustaw `X-Robots-Tag: index, nofollow` przez CloudFront headers policy), albo blokujesz (wtedy `X-Robots-Tag: noindex` + `Disallow: /copywriting-360-preview.pdf` w robots.txt). Status quo = niedopilnowane.

**Fix:** Rekomenduję **noindex** — chcesz, żeby Google linkował do landing page'a, a nie do PDF (gdzie nie ma CTA, nie ma trackingu). Wariant:
1. Dodaj do `public/robots.txt`:
   ```
   Disallow: /copywriting-360-preview.pdf
   ```
2. W CloudFront → Response Headers Policy dodaj `X-Robots-Tag: noindex` dla `*.pdf` (lub explicit dla tego URL).
3. W GSC → Removals → tymczasowe usunięcie URL.

---

### [LIVE] 14. `/sukces` (bez slash) — 302 zamiast 301
**Where:** CloudFront redirect dla URLs bez końcowego `/`.

**Evidence:**
```
$ curl -sIL "https://www.ebookcopywriting.pl/sukces"
HTTP/1.1 302 Moved Temporarily
Location: /sukces/
HTTP/1.1 200 OK
```
302 = temporary. Google nie konsoliduje sygnałów rankingowych przy 302.

**Impact:** Niski — `/sukces` i tak ma być `noindex` po fix #3. Ale ogólna higiena: każdy redirect na statycznym sitcie powinien być 301.

**Fix:** W CloudFront → Functions / Lambda@Edge (jeśli używasz) lub w S3 redirect rules ustawić HTTP 301 zamiast 302 dla `<URL>` → `<URL>/`. Jeśli to robi CloudFront S3 origin, to zachowanie domyślne — wymaga utworzenia CloudFront Function z explicit `statusCode: 301`. Po fix #3 to spadnie do P3.

---

### [LIVE] 15. Brak `Organization` / `Person` schema (poza Book.author)
**Where:** `src/layouts/Layout.astro:31` — jedyna JSON-LD na stronie to `Book`.

**Impact:** Sekcja "O autorze" (`src/pages/index.astro:611-631`) ma zdjęcie + 15 lat doświadczenia + linki do `iCopywriter.pl`, `Smart-Copy.ai`, `TorWeb.pl` (w Footerze) — to materiał na bogaty `Person` schema z `sameAs`. Bez tego Google nie buduje "Knowledge Panel" dla Karola, traci EEAT signal (Experience, Expertise, Authoritativeness, Trust).

**Fix:** Dodać drugi `<script type="application/ld+json">` w `Layout.astro` lub na `index.astro`:
```json
{
  "@context":"https://schema.org",
  "@type":"Person",
  "name":"Karol Leszczyński",
  "jobTitle":"Copywriter, Content Strategist",
  "image":"https://s3.eu-north-1.amazonaws.com/piszemy.com.pl/karol_leszczynski_copywriter.jpeg",
  "url":"https://icopywriter.pl",
  "sameAs":[
    "https://icopywriter.pl",
    "https://smart-copy.ai",
    "https://torweb.pl",
    "https://www.ebookcopywriting.pl"
  ],
  "description":"Copywriter z 15-letnim doświadczeniem, autor ebooka Copywriting 360°"
}
```

---

### [LIVE] 16. Brak strony 404 — S3 zwraca surowy XML error
**Where:** Brak `src/pages/404.astro` + brak konfiguracji `error_document` w S3.

**Evidence:**
```
$ curl https://www.ebookcopywriting.pl/cokolwiek
<?xml version="1.0" ...><Error><Code>NoSuchKey</Code>...
```

**Impact:** Każde literówkowe URL (lub fix #1 jeszcze niewdrożony) pokazuje surowy AWS error zamiast zaprojektowanej strony "Nie znaleziono — wróć na home". UX szok dla 0.X% ruchu, ale niezerowy. Także CTR z SERP do potencjalnych deindeksowanych URL (np. `/sukces/` po fix #3) trafia w nicość zamiast w "wróć tu →".

**Fix:** Utwórz `src/pages/404.astro` z hero "Strona nie istnieje" + CTA wracającym do `/`. W S3 bucket → Static website hosting → "Error document" wpisać `404.html`. Po `npm run build` Astro generuje `dist/404.html` automatycznie. CloudFront też wymaga skonfigurowania custom error response (`403`/`404` → `/404.html` z TTL 60s) — bez tego CloudFront serwuje swój generic błąd.

---

### [LIVE] 17. Brak HSTS header
**Where:** CloudFront response headers policy.

**Evidence:**
```
$ curl -sI https://www.ebookcopywriting.pl/ | grep -i strict-transport
(brak)
```

**Impact:** Niska — HTTPS jest wymuszone przez 301 z http (potwierdzone w Phase 1), więc realnie nie ma luki MITM. Ale to standard security signal, oceniany przez Lighthouse i niektóre narzędzia audytowe.

**Fix:** CloudFront → Response Headers Policies → utwórz/edytuj policy → Security headers → Strict-Transport-Security → `max-age=31536000; includeSubDomains` (preload opcjonalnie, jeśli chcesz dołączyć do HSTS preload list). Bez kodu, sama konfiguracja AWS.

---

## P3 — Polish (backlog)

### [LIVE] 18. `og:type="product"` zamiast `og:type="book"`
**Where:** `src/layouts/Layout.astro:18`. Schema.org type = `Book`, ale Open Graph deklaruje generic product. OG ma typ `book` w specu Books object: `https://ogp.me/#type_book`. Wpływ minimalny.

### [LIVE] 19. `<img>` autora ładowany z external S3 bez `loading="lazy"`
**Where:** `src/pages/index.astro:615` — `https://s3.eu-north-1.amazonaws.com/.../karol_leszczynski_copywriter.jpeg` bez atrybutu `loading`. Nie blokuje LCP (sekcja "O autorze" jest poniżej fold), ale dodaj `loading="lazy"`.

### [WORKFLOW] 20. `dist/` jest trackowany w git ale nigdy nie commitowany po buildzie
**Where:** `.gitignore` zawiera tylko `node_modules/`, `.deploy-tmp/`, `.env.production`, `*.zip`. `dist/` nie jest w .gitignore.

**Impact:** Po każdym `npm run build` lokalny `git status` pokazuje 3+ modified files w dist/, których nie chcesz commitować. Confuzja, zwłaszcza jeśli `deploy.sh` zaczyna od `git add . && git commit -m "git push from local"` — wtedy stale dist/ wpada do repozytorium, ale i tak za chwilę jest rebuildowane. Mała pułapka: jeśli ktoś (lub CI) sklonuje repo i zrobi `npm run build`, dostanie najnowszy dist; ale jeśli serwuje statycznie bez builda, dostaje stale dist sprzed kilku tygodni.

**Fix:** Dodać `dist/` do `.gitignore`:
```
node_modules/
.deploy-tmp/
.env.production
*.zip
dist/      ← add
```
Następnie `git rm -r --cached dist/` (usuwa z indeksu, zostawia na dysku), commit, push. `deploy.sh` działa bez zmian (build → s3 sync).

---

## Skipped — not applicable to this profile

- **L1 (orphan pages)** — strona ma 4 podstrony i wszystkie są dostępne z menu i Footera. Link graph trywialny.
- **L2 (dead-end pages)** — jw.
- **L4 (broken external links)** — sprawdziłem footer (icopywriter.pl, smart-copy.ai, torweb.pl) — wszystkie 200; outbound count niski.
- **C7 (body word count > 300)** — landing ma ~3000+ słów, daleko ponad próg.
- **C11/C12 product schema** — to ebook, nie produkt fizyczny; jest Book schema, audytowane jako #8.
- **I5 (impressions na URL spoza Page table)** — wszystkie 7 wierszy w `Page` pokrywają znane URLe.
- **Sitemap segmentacja (T9)** — 4 URLs, jeden sitemap-0.xml, wystarczy.
- **hreflang** — strona jednojęzyczna pl_PL.
- **Pagination canonical** — brak paginacji.
- **Faceted search** — brak filtrów.
- **AWS Route53 audyt** — nie zlecone, infra DNS poza zakresem.

---

## Unverified — needs re-run

- **PSI dla `/fragment/` i `/sukces/`** — nie uruchamiałem, profile D zwykle wystarcza homepage; quota nie była limitem. Jeśli chcesz, dorzucę w kolejnym przebiegu.
- **GSC top queries z `topQueries` JSONB** — `SELECT ... FROM "GscPageDaily" WHERE topQueries IS NOT NULL` zwrócił 0 wierszy. Możliwe że cron `gsc_pull` jeszcze nie wypełnił topQueries dla tej domeny (mała ilość danych: 343 wyświetleń/30d, większość zapytań może być w "anonymized queries"). Bez tego nie mogę zrobić rzetelnego content-intent matching (C16). Re-run za 2 tygodnie po nazbieraniu danych.

---

## Sequence of recommended actions

**Krok 1 — przed-deploy (lokalnie):**
1. Utwórz `public/og-image.jpg` (1200×630, ~80 KB) (fix #2)
2. Utwórz `src/pages/polityka-prywatnosci.astro` + `src/pages/regulamin.astro` (fix #1)
3. Skróć `<title>` i `<meta description>` w `src/pages/index.astro:68-69` (fix #5, #6)
4. Dodaj prop `noindex` do `Layout.astro` i ustaw na `sukces.astro`+`anulowano.astro` (fix #3 część 1)
5. Dodaj `noindex` filter do `sitemap()` w `astro.config.mjs` (fix #3 część 2)
6. Wyrzuć JSON-LD `Book` z Layout, dodaj jako prop, włącz tylko na index/fragment (fix #8)
7. Dodaj FAQPage JSON-LD do `index.astro` (fix #9)
8. Usuń duplikat `begin_checkout` z `src/pages/index.astro:752-765` (fix #7)
9. Dodaj Consent Mode v2 default-denied w `CookieConsent.astro` (fix #4)
10. Self-host fontów + `<link rel="preload">` LCP image (fix #10)
11. Wypełnij puste `<th>` w tabeli porównawczej (fix #11)
12. Napraw color-contrast po wskazaniach DevTools (fix #12)
13. Dodaj `Person` JSON-LD (fix #15)
14. Utwórz `src/pages/404.astro` (fix #16)
15. `dist/` → `.gitignore`, `git rm -r --cached dist/` (fix #20)

**Krok 2 — deploy:**
```bash
./deploy.sh
```

**Krok 3 — AWS console (poza kodem):**
16. CloudFront → Response Headers Policy → dodaj HSTS (fix #17)
17. CloudFront → Custom Error Responses → 403/404 → `/404.html` (fix #16 część 2)
18. CloudFront → Response Headers Policy → `X-Robots-Tag: noindex` dla `*.pdf` (fix #13)
19. CloudFront → Functions → 302→301 dla redirectów (fix #14, opcjonalne)
20. S3 bucket → Static hosting → Error document = `404.html`

**Krok 4 — Google Search Console:**
21. GSC → Sitemaps → re-submit `sitemap-index.xml` (po wycięciu `/sukces/` i `/anulowano/`)
22. GSC → Removals → tymczasowe usunięcie `/sukces/` i `/anulowano/`
23. GSC → Removals → tymczasowe usunięcie `/copywriting-360-preview.pdf` (jeśli idziesz w noindex)
24. GSC → URL Inspection → "Request indexing" dla `/`, `/fragment/`, `/polityka-prywatnosci`, `/regulamin` (4 URLs — pod limitem 10/dzień)

**Krok 5 — Social:**
25. Facebook Sharing Debugger → Scrape ponownie `https://www.ebookcopywriting.pl/` (nowy og-image)
26. LinkedIn Post Inspector → ponowne pobranie metadanych

---

## Appendix — pełne polecenia weryfikacyjne

```bash
# Live HTML
curl -s -A "Mozilla/5.0 (compatible; SEO-Audit/1.0)" https://www.ebookcopywriting.pl/ -o /tmp/eb-home.html

# OG image 404 check
curl -sI https://www.ebookcopywriting.pl/og-image.jpg | head -3

# Legal pages 404 check
curl -sI https://www.ebookcopywriting.pl/polityka-prywatnosci | head -3
curl -sI https://www.ebookcopywriting.pl/regulamin | head -3

# Consent Mode v2 check
grep -ciE "consent.*default|analytics_storage" /tmp/eb-home.html   # >0 = OK

# Duplicate begin_checkout
grep -c "gtag('event', 'begin_checkout'" /tmp/eb-home.html   # 1 = OK, 2 = bug

# Sukces/anulowano indexability
curl -s https://www.ebookcopywriting.pl/sukces/ | grep -oE 'name="robots" content="[^"]*"'
# expected: noindex, nofollow

# Sitemap excludes transactional pages
curl -s https://www.ebookcopywriting.pl/sitemap-0.xml | grep -E '/sukces/|/anulowano/'
# expected: empty output

# PSI
PSI_API_KEY=$(grep ^PSI_API_KEY= ~/.claude/skills/seo-audit-onsite/.env | cut -d= -f2-)
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fwww.ebookcopywriting.pl%2F&strategy=mobile&category=performance&category=seo&category=accessibility&key=$PSI_API_KEY" | jq '.lighthouseResult.categories | to_entries[] | {id:.key, score:.value.score}'

# Prod DB sanity
mcp__claude_ai_mcp_torweb_pl__ssh_exec --host=panel \
  --command='sudo -u postgres psql -d seo_panel -c "SELECT url, \"indexingVerdict\", \"coverageState\", impressions FROM \"Page\" WHERE \"domainId\"='\''cmn9fo4dr0005qrdyj39z8k9e'\''"'
```
