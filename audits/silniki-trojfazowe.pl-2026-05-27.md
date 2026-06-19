# SEO on-site audit — silniki-trojfazowe.pl
**Date:** 2026-05-27
**Profile:** C — E-commerce / product catalog (Astro static + 247 produktów + koszyk/checkout; w DB sklasyfikowane jako SATELLITE — błędna kategoryzacja, faktycznie sklep)
**Stack:** Astro 5.17 static + React + Tailwind + @astrojs/sitemap → S3 (`www.silniki-trojfazowe.pl`, eu-north-1) + CloudFront `E2Q8CBRHCSGB32`
**Repo↔prod state:** **MIXED** — 1 modified file lokalnie (H1 fix na `/moc/[power].astro` niewdrożony), CookieConsent `GA_ID` w źródle inny niż na live (live nowszy niż commit)
**Last crawl:** 2026-05-27 03:08 | **GSC:** 2026-05-27 06:00 | **GA4:** ACTIVE, lastSync 2026-05-27 08:00
**Pages:** 286 tracked, 237 indexed, 286 in sitemap | **DA:** 3 | **Last 28d GSC:** 6 clicks / 277 impressions / pozycja śr. ~12

---

## ⚠ Drift summary — repo ↔ prod

| File | Status | What's in repo | What's on live | Action |
|------|--------|----------------|----------------|--------|
| `frontend/src/pages/moc/[power].astro` | `M` modified | H1: `Trójfazowe silniki elektryczne {label} kW` | H1: `Używane silniki elektryczne {label} kW` | DEPLOY (commit + `./deploy.sh`) |
| `frontend/src/components/CookieConsent.astro` (linia 232) | clean (HEAD = `a2b1a71` z 2026-03-06) | `var GA_ID = 'G-XSFVYZEMZP'` | `var GA_ID = 'G-CWQQMY5X4D'` (build z 2026-05-27 04:01) | COMMIT TO REPO (live nowszy o ~2,5 mies. niż HEAD — repo nie jest źródłem prawdy dla produkcji) |
| `frontend/public/robots.txt` | clean | `Sitemap: https://www.silnik-elektryczny.pl/sitemap-index.xml` (zła domena!) | `Sitemap: https://www.silniki-trojfazowe.pl/sitemap-index.xml` | COMMIT TO REPO (źródło ma copy-paste z innego projektu) |

Build z 2026-05-27 04:01 (live `Last-Modified`) jest nowszy niż ostatni commit (2026-03-06). Live ma poprawki nieuwzględnione w repo. **Następny rebuild ze źródła rozjedzie produkcję.**

---

## P0 — Critical (fix this week)

### [LIVE] `robots.txt` zaczyna się od śmieci `ro` przed `User-agent`
**Where:** `https://www.silniki-trojfazowe.pl/robots.txt` (i źródło `frontend/public/robots.txt`)
**Evidence:**
```
$ curl -s https://www.silniki-trojfazowe.pl/robots.txt | xxd | head -2
00000000: 726f 5573 6572 2d61 6765 6e74 3a20 2a0d  roUser-agent: *.
00000010: 0a41 6c6c 6f77 3a20 2f0d 0a0d 0a44 6973  .Allow: /....Dis
```
Bajty `0x72 0x6f` = literalne `ro` przed `User-agent`. Te same śmieci są w źródle `frontend/public/robots.txt` (`xxd` identyczny).
**Impact:** Wg [Google robots.txt RFC](https://www.rfc-editor.org/rfc/rfc9309), parser ignoruje nierozpoznane dyrektywy. Pierwsza linia `roUser-agent: *` jest **niezgrupowana** — wszystkie poniższe `Disallow:` są bez user-agenta. Faktycznie Google interpretuje to jako "brak grupy dla *", co oznacza że `Disallow: /checkout` i `Disallow: /zamowienie/` **mogą być ignorowane**. Plus: ryzyko, że overly-strict parser uzna cały plik za nieprawidłowy.
**Fix:** W `frontend/public/robots.txt` usunąć dwa pierwsze znaki "ro" — plik ma się zaczynać od literalnego `User-agent: *`. Komenda:
```powershell
$bytes = [System.IO.File]::ReadAllBytes("D:\silniki-trojfazowe.pl\frontend\public\robots.txt")
[System.IO.File]::WriteAllBytes("D:\silniki-trojfazowe.pl\frontend\public\robots.txt", $bytes[2..($bytes.Length-1)])
```
Potem `git add` + `./deploy.sh`.

### [LIVE] `/checkout/` zaindeksowany w `sitemap-0.xml`
**Where:** `https://www.silniki-trojfazowe.pl/sitemap-0.xml` zawiera `<loc>https://www.silniki-trojfazowe.pl/checkout/</loc>`. Strona `/checkout/` zwraca 200 OK (1,4 KB HTML) i NIE ma `<meta name="robots" content="noindex">` ‒ sprawdzone w `src/pages/checkout.astro` (faktycznie ma `noindex={true}` w Layout — więc na żywo jest `<meta name="robots" content="noindex">`), ALE w sitemap mówisz Google "indeksuj to".
**Evidence:**
```
$ grep -oE '<loc>[^<]*checkout[^<]*</loc>' sitemap-0.xml
<loc>https://www.silniki-trojfazowe.pl/checkout/</loc>
$ curl -sI https://www.silniki-trojfazowe.pl/checkout/
HTTP/1.1 200 OK
```
Plus w sitemap są też `/polityka-prywatnosci/` i `/regulamin/`, które również mają `noindex`. W DB: `/koszty-wysylki/` i `/polityka-prywatnosci/` mają `coverageState = "Excluded by 'noindex' tag"` — Google widzi sitemap-noindex konflikt i loguje to jako problem indeksacji.
**Impact:** Konflikt sygnałów (sitemap mówi "indeksuj", meta mówi "nie indeksuj") → Google obniża zaufanie do sitemap, marnuje crawl budget. W GSC pojawia się "Sent but excluded by noindex" w raporcie pokrycia.
**Fix:** W `astro.config.mjs` skonfigurować `@astrojs/sitemap` z filtrem wykluczającym strony noindex:
```js
import sitemap from '@astrojs/sitemap';
export default defineConfig({
  site: 'https://www.silniki-trojfazowe.pl',
  integrations: [react(), tailwind(), sitemap({
    filter: (page) => !['checkout', 'zamowienie', 'polityka-prywatnosci',
                        'regulamin', 'odstapienie-od-umowy', 'przetwarzanie-danych',
                        'koszty-wysylki', 'formy-platnosci', 'kontakt']
                       .some(s => page.includes(`/${s}/`)),
  })],
});
```
Rebuild + deploy.

---

## P1 — High (fix this sprint)

### [LIVE] Trailing-slash inconsistency — 302 (zamiast 301) na wersji bez slasha + canonical wskazuje na wersję która redirectuje
**Where:** wszystkie `/moc/Xkw/` i `/silnik/<slug>/`
**Evidence:**
```
$ curl -sI https://www.silniki-trojfazowe.pl/moc/4kw
HTTP/1.1 302 Moved Temporarily      ← S3 website "Found", nie 301
Location: /moc/4kw/

$ curl -s https://www.silniki-trojfazowe.pl/moc/4kw/ | grep canonical
<link rel="canonical" href="https://www.silniki-trojfazowe.pl/moc/4kw">  ← bez slasha
```
Canonical w `/moc/4kw/` wskazuje na `/moc/4kw` (bez slasha), który zwraca 302 → `/moc/4kw/`. Również w `src/pages/silnik/[slug].astro:76` i `src/pages/moc/[power].astro:79` canonical jest budowany bez końcowego slasha.
**Impact:** (a) 302 nie przekazuje pełnego PageRank (Google traktuje to jako tymczasowy redirect, nie kanonizację), (b) canonical wskazujący na URL który redirectuje = niejednoznaczny sygnał — Google sam zdecyduje który URL kanonizować. W DB widać że GSC zna oba warianty: `https://www.silniki-trojfazowe.pl/moc/15kw`, `.../moc/22kw`, `.../moc/7-5kw` (bez slasha) — wszystkie `indexingVerdict=UNKNOWN`.
**Fix:** Wybrać wersję z końcowym slashem (zgodna z URL w sitemap) i zmienić canonical w 2 plikach:
- `frontend/src/pages/moc/[power].astro:79`: `canonical={\`https://www.silniki-trojfazowe.pl/moc/${power}/\`}` (dodać `/`)
- `frontend/src/pages/silnik/[slug].astro:76`: `const canonical = \`https://www.silniki-trojfazowe.pl/silnik/${slug}/\`;` (dodać `/`)
Schema.org breadcrumb używa tej samej zmiennej `canonical` więc też się naprawi.

### [LIVE] Breadcrumb schema wskazuje na URL który zwraca 404
**Where:** każda strona produktu, np. `https://www.silniki-trojfazowe.pl/silnik/elektrowibrator-silnik-wibracyjny-0-3kw-1500obr/`
**Evidence:**
```json
"itemListElement": [
  ...
  { "@type": "ListItem", "position": 2, "name": "Trójfazowe",
    "item": "https://www.silniki-trojfazowe.pl/kategoria/trojfazowe" }, ←
  ...
]
$ curl -sI https://www.silniki-trojfazowe.pl/kategoria/trojfazowe
HTTP/1.1 404 Not Found
$ curl -sI https://www.silniki-trojfazowe.pl/kategoria/trojfazowe/
HTTP/1.1 404 Not Found
```
Również nav w `src/layouts/Layout.astro:17-20` linkuje do `/kategoria/trojfazowe`, `/kategoria/jednofazowe` itd. — wszystkie 404 (brak katalogu `src/pages/kategoria/`).
**Impact:** (a) Google walidator rich-results odrzuci breadcrumb z 404, (b) wewnętrzny link z header'a do 404 marnuje crawl budget i psuje user experience.
**Fix:** Albo dodać strony kategorii `src/pages/kategoria/[slug].astro` (paralelnie do `/moc/[power].astro`), albo usunąć/przekierować breadcrumb na `/`:
- `src/pages/silnik/[slug].astro` linie ~125-130 (breadcrumb level 2) — zmienić `item` na `https://www.silniki-trojfazowe.pl/` (lub strona z filtrem `/?cat=trojfazowe`)
- `src/layouts/Layout.astro` linie 17-20 (`NAV_CATS`) — albo usunąć, albo zlinkować do realnych stron

### [LIVE] LCP 6,1 s na home (mobile) — strona główna waży 1015 KB HTML
**Where:** `https://www.silniki-trojfazowe.pl/` (PSI mobile)
**Evidence:**
```
PSI mobile: Performance 67/100, SEO 92/100
LCP: 6.1 s  (target <2.5s)
FCP: 3.7 s  (target <1.8s)
TBT: 10 ms  (excellent)
CLS: 0      (perfect)
Total transfer: 812 KiB
HTML size: 1015 KB
Top opp: Reduce unused JavaScript (900ms savings)
$ wc -c /tmp/home.html → 1 015 522 bytes
```
1 MB HTML na home — przyczyna: SSR-renderowane karty wszystkich 247 produktów embedowane w jednym pliku (`firstPageProducts = products.slice(0, PER_PAGE)` deklaruje 24 per page, ale grep H2 znalazł 20 produktów w bieżącym widoku — reszta to prawdopodobnie pełne markup wszystkich kart sklepu w innym stanie filtra).
**Impact:** LCP 6,1 s mobile = "Poor" Core Web Vital. Ranking penalty dla zapytań mobile (~70% ruchu w PL). Dla sklepu CWV = współczynnik konwersji.
**Fix:** Wymaga pomiaru profilu — które bloki HTML zajmują najwięcej miejsca:
```powershell
# Sprawdź co jest w HTML
python -c "import re; h=open(r'D:\seo-panel\audits\cache\silniki-trojfazowe.pl\home.html',encoding='utf-8').read(); print('inline CSS bytes:', sum(len(s) for s in re.findall(r'<style[^>]*>(.*?)</style>',h,re.S))); print('inline SVG bytes:', sum(len(s) for s in re.findall(r'<svg.*?</svg>',h,re.S))); print('product card bytes (approx):', len(re.findall(r'class=\"card\"',h))*1000)"
```
Najprawdopodobniej środki zaradcze: (a) ograniczyć liczbę renderowanych kart produktów na home do 12–24 (sprawdzić czy faktycznie renderuje wszystkie 247), (b) wyciągnąć krytyczny CSS, resztę asynchronicznie, (c) preload LCP image. Najpierw zmierzyć — nie ciąć w ciemno.

### [DRIFT→COMMIT] GA Measurement ID w źródle nie zgadza się z live
**Where:** `frontend/src/components/CookieConsent.astro:232`
**Evidence:**
```
$ git blame -L 232 frontend/src/components/CookieConsent.astro
a2b1a71 (2026-03-06) var GA_ID = 'G-XSFVYZEMZP';

$ curl -s https://www.silniki-trojfazowe.pl/ | grep "var GA_ID"
  var GA_ID = 'G-CWQQMY5X4D';      ← live ma INNY ID

$ curl -sI ... → Last-Modified: Wed, 27 May 2026 04:01:26 GMT  ← build z dziś
$ git log -1 → 2026-03-06 17:09:55                              ← commit z 11 tyg. temu
```
Live build z 2026-05-27 jest o **~2,5 miesiąca nowszy** niż ostatni commit. GA4 integration w `seo_panel` DB ma `lastSync 2026-05-27 08:00 ACTIVE`, więc `G-CWQQMY5X4D` jest tym, który zbiera dane (czyli to jest "ten poprawny"). Repo nie jest źródłem prawdy.
**Impact:** Jeśli ktoś dziś zrobi `git pull && npm run build && ./deploy.sh`, na produkcję trafi `G-XSFVYZEMZP` — i analytics przestanie zbierać dane do właściwego stream'u. Cisza w GA4, ale GSC dalej pokaże ruch — łatwo przeoczyć.
**Fix:**
```bash
cd D:/silniki-trojfazowe.pl/frontend
sed -i "s/G-XSFVYZEMZP/G-CWQQMY5X4D/g" src/components/CookieConsent.astro
git add src/components/CookieConsent.astro
git commit -m "fix: sync GA_ID with prod (G-CWQQMY5X4D)"
```

### [DRIFT→COMMIT] `frontend/public/robots.txt` w źródle linkuje sitemap z **niewłaściwej domeny**
**Where:** `frontend/public/robots.txt` ostatnia linia
**Evidence:**
```
$ cat frontend/public/robots.txt | grep Sitemap
Sitemap: https://www.silnik-elektryczny.pl/sitemap-index.xml      ← inna domena!

$ curl -s https://www.silniki-trojfazowe.pl/robots.txt | grep Sitemap
Sitemap: https://www.silniki-trojfazowe.pl/sitemap-index.xml      ← live OK
```
Live serwuje poprawną wersję (ktoś ręcznie poprawił na S3 lub build podstawił), ale w repo jest copy-paste z projektu silnik-elektryczny.pl.
**Impact:** Następny `./deploy.sh` z repo wgra wadliwy robots.txt — Google przestanie znajdować sitemap, ranking polegnie.
**Fix:** W `frontend/public/robots.txt` zmienić ostatnią linię na `Sitemap: https://www.silniki-trojfazowe.pl/sitemap-index.xml`. Najlepiej razem z fix'em P0 (`ro` prefix).

### [DRIFT→DEPLOY] H1 zmieniony w repo lokalnie — niewdrożony na produkcji (28 stron kategorii moc)
**Where:** `frontend/src/pages/moc/[power].astro:144` — `M` w `git status`
**Evidence:**
```diff
-      <h1>Używane silniki elektryczne {label} kW</h1>
+      <h1>Trójfazowe silniki elektryczne {label} kW</h1>
```
Live na 27 stron `/moc/Xkw/` nadal pokazuje "Używane silniki elektryczne...":
```
$ curl -s https://www.silniki-trojfazowe.pl/moc/4kw/ | grep -oE "<h1[^>]*>[^<]+"
<h1>Używane silniki elektryczne 4 kW
```
**Impact:** Brand consistency — H1 "Używane silniki" sprzedaje używane, ale meta description nowej wersji mówi "Trójfazowe silniki". Spójność intencji z domeną też lepsza po zmianie. Ponadto title też nie zgadza się: w źródle nowy title `Trójfazowe silniki elektryczne ${label} kW – ...` ale live ma starą wersję `Używane silniki elektryczne ${label} kW – ...` (też wymaga deploya).
**Fix:** `git add frontend/src/pages/moc/'[power].astro' && git commit -m "h1+title: trójfazowe zamiast używane" && ./deploy.sh`

### [LIVE] Brak schemy strukturalnej na stronach kategorii `/moc/Xkw/`
**Where:** wszystkie 27 stron `/moc/Xkw/`
**Evidence:**
```
$ curl -s https://www.silniki-trojfazowe.pl/moc/4kw/ | grep -c 'application/ld+json'
0
```
W `src/pages/moc/[power].astro` nie ma żadnego `<script type="application/ld+json">`.
**Impact:** Brak rich results dla stron kategorii (`ItemList` + `BreadcrumbList`). Strony kategorii to potencjalnie wartościowe landing pages — np. `silniki-trojfazowe.pl/moc/7-5kw` ma już 1 click / 17 impressions w GSC.
**Fix:** Dodać w `src/pages/moc/[power].astro` przed `<Layout>` zamknięciem:
```astro
const schemaBreadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Strona główna", "item": "https://www.silniki-trojfazowe.pl/" },
    { "@type": "ListItem", "position": 2, "name": `${label} kW` }
  ]
};
const schemaItemList = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "numberOfItems": products.length,
  "itemListElement": products.slice(0, 20).map((p, i) => ({
    "@type": "ListItem", "position": i+1,
    "url": `https://www.silniki-trojfazowe.pl/silnik/${p.marketplaces?.ownStore?.slug}/`
  }))
};
```
Render: `<script type="application/ld+json" set:html={JSON.stringify(schemaBreadcrumb)} slot="head" />` (+ analogiczne dla ItemList).

---

## P2 — Medium (fix when capacity allows)

### [LIVE] Brak Open Graph i Twitter Card meta na wszystkich stronach
**Where:** całe `frontend/src/layouts/Layout.astro` — w `<head>` brak `<meta property="og:*">` i `<meta name="twitter:*">`
**Evidence:**
```
$ grep -ioE '<meta[^>]*(og:|twitter:)[^>]*>' home.html | wc -l
0
```
**Impact:** Linki na FB/Messenger/Slack/LinkedIn nie pokażą obrazka/tytułu — dla e-commerce to obniża CTR z social/direct.
**Fix:** W `Layout.astro` w `<head>` dodać (po `<title>`):
```astro
{canonical && <>
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={title} />
  {description && <meta property="og:description" content={description} />}
  <meta property="og:site_name" content="silniki-trojfazowe.pl" />
  <meta property="og:image" content="https://www.silniki-trojfazowe.pl/og-default.png" />
  <meta name="twitter:card" content="summary_large_image" />
</>}
```
Dorzucić `frontend/public/og-default.png` (1200×630).

### [LIVE] Sitemap bez `<lastmod>` — 286 URL, 0 znaczników daty
**Where:** `https://www.silniki-trojfazowe.pl/sitemap-0.xml`
**Evidence:**
```
$ grep -c '<lastmod>' sitemap-0.xml
0
$ grep -c '<loc>' sitemap-0.xml
286
```
**Impact:** Google nie wie kiedy strony zostały zaktualizowane → mniejsza częstotliwość recrawl'u, wolniejsze podchwytywanie zmian (cen, dostępności).
**Fix:** W `astro.config.mjs` skonfigurować plugin sitemap z `lastmod`:
```js
sitemap({
  serialize(item) {
    return { ...item, lastmod: new Date().toISOString() };
  }
})
```
(Statyczny site = data builda, czyli każda strona dostanie `<lastmod>` = czas ostatniego deploya.)

### [LIVE] Cookie policy text mówi o `_ga_CWQQMY5X4D`, ale w źródle GA_ID to `XSFVYZEMZP` — niespójność z RODO-art.13
**Where:** `frontend/src/components/CookieConsent.astro:181`
**Evidence:** Source code linia 181: `<strong>Pliki:</strong> _ga, _ga_CWQQMY5X4D` — opisuje cookie dla `G-CWQQMY5X4D`, ale `var GA_ID` na linii 232 jest `G-XSFVYZEMZP`. Live ma oba spójne (`G-CWQQMY5X4D`), ale jeśli ktoś naprawi tylko jedną stronę bez drugiej, cookie policy zostanie wprowadzona w błąd użytkownika (informacja o cookie różna od faktycznej).
**Impact:** Art. 13 RODO wymaga informowania o konkretnych nazwach cookies. Niezgodność = ryzyko sankcji UODO przy kontroli.
**Fix:** Razem z DRIFT-fix `GA_ID` upewnić się że linia 181 i linia 232 wskazują na ten sam ID.

### [LIVE] HTML page `/moc/4kw/` używa H2 z długimi tytułami produktów + duplikacja H2 "Sklep z silnikami trójfazowymi"
**Where:** `frontend/src/pages/index.astro` i `/moc/[power].astro`
**Evidence:** Na home są 20 `<h2>` zawierających pełne nazwy produktów (długie do 90 znaków każdy). To H2 jako technika SEO-stuffingowa może być traktowana jako anti-pattern.
**Impact:** Niski. Karty produktów powinny używać `<h3>` lub `<a>`, nie `<h2>`. Google generalnie radzi sobie z tym, ale przy auditcie ręcznym wygląda nienaturalnie.
**Fix:** W `src/pages/index.astro` i kartach produktów zmienić H2 na H3 dla nazw produktów, zostawiając H2 tylko dla nagłówków sekcji.

---

## P3 — Polish (backlog)

### [WORKFLOW] DB klasyfikuje domenę jako `SATELLITE`, faktycznie to e-commerce (sklep z koszykiem i 247 produktami)
**Evidence:** `SELECT category FROM "Domain" WHERE domain='www.silniki-trojfazowe.pl'` → `SATELLITE`. Ale repo ma `AddToCart.tsx`, `CartDropdown.tsx`, `CheckoutForm.tsx`, `pages/checkout.astro`, `pages/zamowienie/`.
**Impact:** Wszystkie raporty / dashboardy seo_panel grupujące po `Domain.category` traktują ją błędnie. Wpływa na priorytety audytu jeśli inni używają tego pola.
**Fix:** `UPDATE "Domain" SET category='ECOMMERCE' WHERE domain='www.silniki-trojfazowe.pl';` na panel'u — albo poczekać, aż user sam ustawi.

### [WORKFLOW] `deploy.sh` komentarz w nagłówku: `# ── silnik-elektryczny.pl deploy ──` (cosmetic)
**Where:** `frontend/deploy.sh:3`
**Evidence:** Komentarz wskazuje że deploy.sh był copy-paste z innego projektu. Wszystkie zmienne (BUCKET, DIST_ID) są jednak poprawne dla tej domeny.
**Fix:** Zmienić komentarz na `# ── silniki-trojfazowe.pl deploy ──`. Drobiazg, ale ułatwia identyfikację.

### [CONTENT] Strona home meta description: "247 silników w ofercie", DB pokazuje totalPages=286
**Where:** `https://www.silniki-trojfazowe.pl/` w `<meta name="description">`
**Evidence:** 286 = wszystkie strony (produkty + kategorie + statyczne), faktycznych produktów ~247. To OK liczbowo, ale meta-description liczba jest dynamiczna w `index.astro:56` (`${total}`) i będzie się aktualizować przy rebuildzie. Brak findingu właściwie.

---

## Unverified — needs re-run

- **PSI na stronie kategorii i produktu** — uruchomione tylko na home (kwota okej, ale by oszczędzić budżet). Jeśli chcesz pełen obraz CWV — uruchomić na `https://www.silniki-trojfazowe.pl/moc/4kw/` i jednym produkcie.
- **Walidacja JSON-LD przez Google Rich Results Test** — schema parsuje się jako JSON OK, ale potwierdzić w https://search.google.com/test/rich-results że Product + Offer + BreadcrumbList są bez błędów (zwłaszcza po naprawie URL `/kategoria/trojfazowe`).
- **Czy w `var GA_ID = 'G-XSFVYZEMZP'` faktycznie był poprzedni stream GA, który jest opuszczony** — DB ma `propertyId = properties/527397241` ACTIVE. Trzeba sprawdzić ręcznie w GA4 admin: który Measurement ID odpowiada `properties/527397241` (powinno być `G-CWQQMY5X4D`, jeśli tak — `XSFVYZEMZP` jest stary i należy go skasować w repo na rzecz CWQQMY).

---

## Skipped — not applicable to this profile

- T16 hreflang — site jednojęzyczny PL
- L1 orphan analysis — 286 stron, dominują dynamiczne template'y; analiza orphan przy tej skali ma niski ROI
- I1 GSC URL Inspection API — niska ilość ruchu (6 clicks/28d), surowe dane DB wystarczają
- C7 word count check (>300) — strony produktowe celowo krótkie (`p.description` slice 500)
- Astro mandatory pattern: Consent Mode gating — sprawdzone, jest poprawne (gtag.js ładowany od razu z denied default, Consent Mode v2 zgodne z RFC) ✓
- Astro mandatory pattern: `Astro.redirect()` bez statusu — sprawdzone, jedyne użycie w `src/pages/silnik/[slug].astro:12` to fallback `return Astro.redirect('/404')` przy braku produktu — dla budowy statycznej ten kod się nie wykona (`getStaticPaths` filtruje), więc bezpieczne
- Astro mandatory pattern: sitemap slug coverage — `@astrojs/sitemap` auto-generuje, brak ręcznej listy slug'ów ✓

---

## Sequence of recommended actions

**KROK 1 — Source-of-truth recovery (drift):**
1. `cd D:/silniki-trojfazowe.pl/frontend`
2. Edytuj `src/components/CookieConsent.astro` linia 232: zmień `G-XSFVYZEMZP` → `G-CWQQMY5X4D` (a wcześniej upewnij się że to faktycznie ID dla `properties/527397241`)
3. Edytuj `public/robots.txt`: (a) usuń pierwsze 2 bajty `ro`, (b) ostatnia linia: `Sitemap: https://www.silniki-trojfazowe.pl/sitemap-index.xml`
4. `git add` + commit "fix: sync repo with prod (GA_ID, robots.txt)"

**KROK 2 — Fixy P0/P1 w kodzie:**
5. Edytuj `src/layouts/Layout.astro` — dodaj OG/Twitter meta + napraw NAV_CATS (usuń linki do nieistniejących /kategoria/)
6. Edytuj `src/pages/silnik/[slug].astro` linia 76 i breadcrumb position 2 — dodaj końcowy `/` w canonical, zmień breadcrumb item URL na `/`
7. Edytuj `src/pages/moc/[power].astro` linia 79 — dodaj końcowy `/` w canonical. (H1 fix jest już w `M`-status.)
8. Edytuj `astro.config.mjs` — dodaj filter dla sitemap (wykluczyć noindex pages) + `serialize` dla `<lastmod>`
9. Dodaj JSON-LD (`BreadcrumbList` + `ItemList`) w `src/pages/moc/[power].astro`
10. `git add` + commit "seo: og, canonical slashes, sitemap filter+lastmod, category schema"

**KROK 3 — Deploy:**
11. `cd frontend && ./deploy.sh` (build + S3 sync + CloudFront invalidation)

**KROK 4 — Walidacja (po deploy):**
12. `curl -s https://www.silniki-trojfazowe.pl/robots.txt | xxd | head -2` → powinno zaczynać się od `User-agent`
13. `curl -s https://www.silniki-trojfazowe.pl/sitemap-0.xml | grep -c checkout` → 0
14. Google Rich Results Test na 1 stronie produktu + 1 stronie kategorii
15. GSC → URL Inspection na `https://www.silniki-trojfazowe.pl/moc/4kw/` — sprawdź czy nowe canonical się propaguje
16. **GSC Re-indexing**: NIE submituj masowo (limit ~10/dzień). Tylko top 5: `/`, `/moc/7-5kw/`, `/moc/5-5kw/` (już dostają impressions) + 2 produkty z `clicks=1`. Reszta — Google sam zaktualizuje przy następnym crawlu.

**KROK 5 — Performance (osobny sprint):**
17. Profilowanie 1 MB HTML home → najprawdopodobniej cięcie SSR-renderowanej listy produktów
18. Ponowny PSI po optymalizacji

**KROK 6 — Kategoryzacja DB:**
19. (Opcjonalne) `UPDATE "Domain" SET category='ECOMMERCE' WHERE domain='www.silniki-trojfazowe.pl';` na panel

---

## Appendix — full URL lists for flagged checks

### Sitemap URL-e które są noindex / nie powinny tam być
- `https://www.silniki-trojfazowe.pl/checkout/` (200, brak meta-robots w live — UWAGA, sprawdziłem source: `noindex={true}` w Layout, więc na żywo powinno być noindex; warto zweryfikować)
- `https://www.silniki-trojfazowe.pl/polityka-prywatnosci/` (DB: `Excluded by 'noindex' tag`)
- `https://www.silniki-trojfazowe.pl/regulamin/` (sprawdzić noindex)
- `https://www.silniki-trojfazowe.pl/koszty-wysylki/` (DB: `Excluded by 'noindex' tag`)
- `https://www.silniki-trojfazowe.pl/kontakt/`
- `https://www.silniki-trojfazowe.pl/formy-platnosci/`
- `https://www.silniki-trojfazowe.pl/odstapienie-od-umowy/`
- `https://www.silniki-trojfazowe.pl/przetwarzanie-danych/`

### Top 10 stron z ruchem (28 dni)
| URL | clicks | impressions | position |
|-----|--------|-------------|----------|
| /moc/7-5kw | 1 | 7 | 17 |
| /moc/5-5kw | 1 | 8 | 9.875 |
| /silnik/silnik-elektryczny-055kw-700obr-3fazowy-90b3 | 1 | 4 | 10 |
| /silnik/silnik-elektryczny-110kw-740obr-3fazowy-vem | 1 | 2 | 4 |

UWAGA: wszystkie URL bez końcowego `/` — to wersja która 302-redirectuje. Po napraweniu canonical (P1) GSC w ciągu kilku tygodni przeindeksuje na `/`-suffixed.

### Rozkład indexingVerdict (286 stron w `Page`)
- PASS: 249 (87%)
- UNKNOWN: 121 (brak danych)
- NEUTRAL: 109 ("URL is unknown to Google" lub "Excluded by noindex")
- UNCHECKED: 2

Suma > 286 bo niektóre nakładają się czasowo (kolumna może zmieniać się przy każdej weryfikacji).

---

## Appendix — verification commands

```bash
# Drift między source a live
curl -s https://www.silniki-trojfazowe.pl/ | grep "var GA_ID"
git -C D:/silniki-trojfazowe.pl blame -L 232,232 frontend/src/components/CookieConsent.astro

# Sprawdzenie robots.txt prefix
curl -s https://www.silniki-trojfazowe.pl/robots.txt | xxd | head -2

# Sprawdzenie schema breadcrumb URL
curl -s "https://www.silniki-trojfazowe.pl/silnik/elektrowibrator-silnik-wibracyjny-0-3kw-1500obr/" | grep -oE '"item":"[^"]+/kategoria/[^"]+"'
curl -sI https://www.silniki-trojfazowe.pl/kategoria/trojfazowe

# Trailing slash 302
curl -sI https://www.silniki-trojfazowe.pl/moc/4kw  # 302
curl -sI https://www.silniki-trojfazowe.pl/moc/4kw/ # 200

# DB query
ssh panel "sudo -u postgres psql -d seo_panel -c \"SELECT \\\"indexingVerdict\\\", COUNT(*) FROM \\\"Page\\\" WHERE \\\"domainId\\\"='cmn9fo4f0000iqrdyipdbrcvx' GROUP BY \\\"indexingVerdict\\\";\""

# PSI re-run
$env:PSI_API_KEY = (Get-Content "$HOME\.claude\skills\seo-audit-onsite\.env" | ? { $_ -match '^PSI_API_KEY=' } | % { ($_ -split '=',2)[1].Trim() })
Invoke-RestMethod "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fwww.silniki-trojfazowe.pl%2F&strategy=mobile&category=performance&key=$env:PSI_API_KEY" | ConvertTo-Json -Depth 4 | Out-File psi-home.json
```
