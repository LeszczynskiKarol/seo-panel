# SEO on-site audit — karol-leszczynski.pl (v3, pre-launch)
**Date:** 2026-08-15
**Profile:** A/B hybryda — statyczna wizytówka usługowa (13 stron, 7 landingów sprzedażowych) z celem rankowania podstron na frazy konwertujące. Blog z v2 znika w v3.
**Stack:** Astro 5 (static), S3 `karolleszczynski-portfolio` + CloudFront `E5XFF2KOROL5S` (www) / `E1WSPFUI6IC88H` (apex → 301 www), region eu-north-1. Repo `D:\karol-leszczynski-v3` **bez gita**, bez `deploy.sh`.
**Repo↔prod state:** LIVE = v2 (build 2026-08-05, 32 URL w sitemapie, blog, landingi Toruń/Bydgoszcz). v3 **niewdrożone** — audyt dotyczy `dist/` v3 (build 2026-08-15 11:37) plus wszystkiego, co przy wdrożeniu zostanie po v2 w tym samym buckecie.
**DB (prod seo_panel):** `www.karol-leszczynski.pl`, category OTHER, 45 pages / 31 indexed, DA 7, lastCrawl 2026-08-15 04:22, GSC pull 06:01, GA4 `properties/503043956` ACTIVE lastSync 08:00.
**GSC 90 dni (17.05–13.08):** 19 klików, ~1 380 wyświetleń. 616 wyśw. (45 %) na `/uslugi/sklepy-internetowe-torun/` — strona, której w v3 nie ma.

---

## ⚠ Data freshness caveats
- Nie da się uruchomić PSI/CWV na v3 (nie ma jej pod publicznym URL). Wydajność oceniona statycznie z `dist/`.
- v3 nie ma repo git → brak historii; „drift" liczony między `dist/` v3 a live v2.

---

## ⚠ Drift summary — repo ↔ prod
| Element | v3 (`dist/`) | Live v2 | Skutek przy wdrożeniu |
|---|---|---|---|
| `astro.config.mjs` `site` | `https://karol-leszczynski.pl` (apex) | canonical host = **www**, apex 301→www | wszystkie canonical/og:url/BreadcrumbList wskażą na URL, który robi 301 |
| `robots.txt` | brak w `public/` | jest, z `Sitemap:` | zostanie stary plik (deploy nie kasuje txt/xml) — OK tylko przypadkiem |
| `sitemap-index.xml` / `sitemap-0.xml` | brak (`@astrojs/sitemap` nieinstalowany) | 32 URL v2 | zostanie **stara mapa z 19 martwymi/zmienionymi URL** |
| `404.html` | brak (`src/pages/404.astro` nie istnieje) | jest, v2 | CloudFront `CustomErrorResponses` → `/404.html` w starym designie |
| 19 URL v2 (blog ×15, publikacje-latex, 8 landingów lokalnych) | brak stron i brak 301 | 200, 31 zaindeksowanych | deploy przez `aws s3 sync` (HTML bez `--delete`) zostawi **zombie HTML v2 obok v3** — duplikaty, dwa designy, stary blog dalej żyje |
| `deploy.sh` | brak | `D:\karol-leszczynski.pl\deploy.sh` | trzeba skopiować i poprawić (patrz P0) |

---

## P0 — Critical (przed wdrożeniem)

### [LIVE] Canonical, og:url i schema wskazują na apex, a domena kanoniczna to www
**Where:** `astro.config.mjs:4` (`site: "https://karol-leszczynski.pl"`); `src/layouts/Base.astro:17-18` (`canonical`, `ogImage` z `Astro.site`); hardcoded apex w `src/components/Breadcrumbs.astro:21`, `src/pages/kontakt/index.astro:62`, `src/pages/polityka-prywatnosci/index.astro:42,44`, `provider.url` w 7 landingach (`sklepy-internetowe:301`, `tworzenie-stron:201`, `aplikacje-webowe:240`, `aplikacje-mobilne:231`, `automatyzacja-procesow:202`, `wdrozenia-ai:202`, `opieka:154`).
**Evidence:** `dist/index.html`: `<link rel="canonical" href="https://karol-leszczynski.pl/">`, `<meta property="og:url" content="https://karol-leszczynski.pl/">`. Live: `curl -sIL https://karol-leszczynski.pl/` → `301 Location: https://www.karol-leszczynski.pl/` (CF function `redirect-to-www-karol`). Live v2 canonical: `https://www.karol-leszczynski.pl/`.
**Impact:** każda strona v3 deklaruje canonical na URL zwracający 301 → Google ignoruje sygnał albo konsoliduje na apex; utrata ciągłości z 31 zaindeksowanymi www-URL. og:url na apex psuje też zliczanie udostępnień.
**Fix:** `astro.config.mjs` → `site: "https://www.karol-leszczynski.pl"`. W 10 plikach wyżej zamienić literal `https://karol-leszczynski.pl` na `https://www.karol-leszczynski.pl` (albo na `Astro.site.origin`). Zweryfikować po buildzie: `grep -rL 'canonical" href="https://www\.' dist/**/index.html` ma zwrócić 0 plików.

### [WORKFLOW] Brak mapy 301 dla 19 URL v2 — 45 % wyświetleń serwisu i wszystkie 31 zaindeksowanych URL idą w 404/zombie
**Where:** brak `src/pages/404.astro`, brak reguł przekierowań (CF function `kl-trailing-slash-301` robi tylko slash), brak `deploy.sh` w v3.
**Evidence:** `sitemap-0.xml` live = 31 URL; `dist/` v3 = 13 stron. Wspólne: `/`, `/kontakt/`, `/polityka-prywatnosci/`, `/projekty/`, `/uslugi/`, `/uslugi/automatyzacja-procesow/`. **Zniknie 19** (pełna lista w Appendix A). GSC 90 d: `/uslugi/sklepy-internetowe-torun/` 616 imp (poz. 18,3 na „sklepy internetowe toruń" 349 imp, „budowa sklepu internetowego toruń" 70), `/uslugi/publikacje-latex/` 4 kliki/83 imp poz. 7,7 (najlepszy CTR serwisu, „skład książki naukowej" poz. 1), `/uslugi/programista-torun/` 33 imp poz. 5,5, blog `synchronizacja-allegro…` 91 imp. DB prod: 31 URL `Submitted and indexed`.
Deploy v2 (`D:\karol-leszczynski.pl\deploy.sh:47-60`) syncuje HTML **bez `--delete`** → po wdrożeniu v3 do tego samego bucketa stare HTML zostaną i dalej będą 200 (dwa serwisy w jednym hoście, stara mapa witryny nadal je wymienia).
**Impact:** utrata jedynego realnego sygnału tematycznego („sklepy internetowe toruń") i strony z najlepszym CTR; 31 URL w indeksie → miękkie/twarde 404 lub duplikaty w dwóch designach; sitemap wskazuje martwe URL.
**Fix (kolejność):**
1. Dodać do CF function `kl-trailing-slash-301` (viewer-request, dystrybucja `E5XFF2KOROL5S`) mapę 301 **przed** logiką slasha — tabela docelowa w Appendix A (m.in. `/uslugi/sklepy-internetowe-torun/`, `-bydgoszcz/`, `/uslugi/migracje-sklepow/` → `/uslugi/sklepy-internetowe/`; `strony-www-torun/`, `strony-internetowe-bydgoszcz/` → `/uslugi/tworzenie-stron-internetowych/`; `programista-torun/`, `-bydgoszcz/`, `platformy-saas-ai/` → `/uslugi/aplikacje-webowe/`; `integracje-ai/` → `/uslugi/wdrozenia-ai/`; `publikacje-latex/` → patrz P1; `/blog/*` → najbliższy landing lub `/projekty/`, wpis allegro → `/uslugi/sklepy-internetowe/`). Publikować przez `aws cloudfront update-function` + `publish-function`.
2. Skopiować `deploy.sh` z v2 do v3 i w sekcji HTML dodać `--delete` (z `--exclude "404.html"` jeśli 404 nie będzie w buildzie), oraz `--delete` w sekcji XML — żeby stara `sitemap-0.xml` zniknęła.
3. Dodać `src/pages/404.astro` (Base + `<meta slot="head" name="robots" content="noindex">`), bo CloudFront serwuje `/404.html` z bucketa.
4. Po wdrożeniu: w GSC „Request indexing" tylko dla 7 landingów + `/` (limit ~10/dzień — jedna partia), resztę zostawić do naturalnego recrawlu 301.

### [LIVE] Brak sitemapa i robots.txt w v3
**Where:** `package.json` — brak `@astrojs/sitemap`; `public/` — brak `robots.txt`.
**Evidence:** `ls dist/*.xml public/robots.txt` → brak. Live `robots.txt` wskazuje `sitemap-index.xml` (v2, 32 URL).
**Fix:** `npm i @astrojs/sitemap`; w `astro.config.mjs`: `integrations: [sitemap({ filter: (p) => !p.includes('/znak/') })]`; `public/robots.txt`:
```
User-agent: *
Allow: /
Disallow: /znak/
Sitemap: https://www.karol-leszczynski.pl/sitemap-index.xml
```
`/znak/` ma już `noindex` (`src/pages/znak.astro:24`) — filtr chroni przed wpisaniem go do mapy.

---

## P1 — High

### [CONTENT] Landing `/uslugi/sklepy-internetowe/` nie celuje we frazę, na którą serwis realnie się wyświetla („sklepy internetowe toruń")
**Where:** `src/pages/uslugi/sklepy-internetowe/index.astro:325-326` (title/description), `:338-340` (H1), cała treść.
**Evidence:** GSC 90 d: „sklepy internetowe toruń" 349 imp poz. 14,5; „budowa sklepu internetowego toruń" 70 imp poz. 26,6; „sklepy internetowe typo3 toruń" 74; „e-commerce toruń" 6 poz. 6,8; „sklep b2b ecommerce toruń" 7 poz. 8,9 — razem ~520 imp, wszystkie na stronę, która znika. W `dist/uslugi/sklepy-internetowe/index.html` w `<main>`: **0** wystąpień „Toruń", 0 „Bydgoszcz"; title = „Sklepy internetowe na zamówienie — katalog, konfigurator, Allegro | Karol Leszczyński" (85 zn., ogólnopolska fraza, w której DA 7 nie ma szans). Dla porównania `tworzenie-stron-internetowych` ma sekcję `#okolica` (Toruń ×6).
**Impact:** to jedyna fraza z wolumenem, gdzie serwis jest w zasięgu TOP10 — po 301 z landingu -torun nowa strona nie utrzyma pozycji bez lokalnego sygnału.
**Fix:** title → `Sklepy internetowe Toruń — budowa i migracja sklepu od 4999 zł | Karol Leszczyński` (≤65 zn. przed „|"); H1 → `Sklepy internetowe na zamówienie — <em>Toruń, Bydgoszcz i cała Polska</em>`; przekopiować sekcję `#okolica` z `tworzenie-stron-internetowych/index.astro:545-558` (H2 „Sklep internetowy w Toruniu i okolicach"); w `ld` dodać `areaServed: [{ "@type":"City", name:"Toruń" }, { "@type":"City", name:"Bydgoszcz" }, { "@type":"Country", name:"Polska" }]`; w FAQ jedno pytanie „Czy robisz sklepy internetowe w Toruniu?" (pod frazę + spotkanie na miejscu). To samo (H1/`areaServed`) w `aplikacje-webowe` — na `programista-torun` było 33 imp przy poz. 5,5.

### [CONTENT] Strona `publikacje-latex` — najlepszy CTR serwisu — wyłączona bez następcy
**Where:** `_wylaczone/publikacje/index.astro` (gotowa nowa wersja, title „Skład książek i publikacji naukowych — LaTeX, Quarto"), `dist/publikacje/*.webp` (resztki poprzedniego buildu).
**Evidence:** GSC: `/uslugi/publikacje-latex/` 4 kliki / 83 imp / poz. 7,7 / CTR 4,8 %; „skład książki naukowej" poz. 1,0. W v3 brak strony i brak celu 301.
**Fix:** przenieść `_wylaczone/publikacje/index.astro` do `src/pages/uslugi/publikacje-latex/index.astro` (zachować stary URL — zero 301, zero utraty) i dodać do `services.ts` jako 8. usługę (`href: "/uslugi/publikacje-latex/"`), żeby weszła do stopki i `/uslugi/`. Jeśli ma zostać nowy slug — 301 `publikacje-latex/ → publikacje/` w CF function.

### [CONTENT] Landingi usługowe nie mają ani jednego linku kontekstowego między sobą ani ze strony głównej
**Where:** `src/pages/index.astro` (Hero/Approach/Standards), wszystkie `src/pages/uslugi/*/index.astro`.
**Evidence:** `dist/index.html` `<main>` linkuje wewnętrznie tylko do `/`, `/uslugi/`, `/projekty/`, `/kontakt/`. Każdy landing: 23 linki wewn. = header 5 + footer + breadcrumbs; w `<main>` sklepy-internetowe: `/uslugi/`, `/`, `/projekty/`, `/kontakt/`, `/#produkty` — żadnego linku do `opieka-nad-strona-internetowa` mimo zdania „abonament od 400 zł miesięcznie" (`:poStarcie`), do `automatyzacja-procesow` mimo sekcji `#autoblog`, do `wdrozenia-ai`. Landingi dostają PR wyłącznie ze stopki (link site-wide, słaby sygnał).
**Fix:** (a) `Standards.astro`/`Approach.astro` na home — każdy z ~7 punktów oferty ma linkować do swojego landingu (`services.ts` już ma `href`); (b) w każdym landingu 2–3 linki w treści: sklepy → `/uslugi/opieka-nad-strona-internetowa/` (przy „od 400 zł/mies."), `/uslugi/automatyzacja-procesow/` (sekcja autoblog/integracje), `/uslugi/wdrozenia-ai/` (wyszukiwarka rozumiejąca zapytania); strony → sklepy + opieka; aplikacje-webowe ↔ mobilne ↔ wdrozenia-ai; (c) blok „Powiązane usługi" nad `<Contact/>` generowany z `services.ts` z pominięciem bieżącej.

### [LIVE] Title 74–89 znaków na 8 z 13 stron, description 167–226 znaków na 12 z 13
**Where:** `Base` props w `src/pages/uslugi/*/index.astro`, `uslugi/index.astro:13-14`, `projekty/index.astro:25-26`, `kontakt/index.astro:80-81`, `index.astro:16-17`.
**Evidence:** `dist/`: wdrozenia-ai 89/223, aplikacje-webowe 88/224, opieka 88/191, sklepy 85/209, tworzenie-stron 83/221, aplikacje-mobilne 79/226, automatyzacja 74/215, uslugi 74/218, projekty 68/167, kontakt 56/192, home 53/172. Google ucina ok. 60 zn. / ~155 zn. — obcięte zostaną właśnie ceny („od 15 000 zł") i „| Karol Leszczyński".
**Fix (propozycje, ≤62 zn.):**
- wdrozenia-ai: `Wdrożenia AI w firmie — integracja z Twoimi systemami, od 5000 zł`
- aplikacje-webowe: `Aplikacje webowe dla firm na zamówienie — od 15 000 zł`
- opieka: `Opieka nad stroną i serwerem — od 150 zł/mies. | Toruń`
- tworzenie-stron: `Tworzenie stron internetowych Toruń — od 1500 zł`
- aplikacje-mobilne: `Aplikacje mobilne Android i iOS na zamówienie — od 30 000 zł`
- automatyzacja: `Automatyzacja procesów w firmie — wdrożenia od 3000 zł`
- uslugi: `Usługi — strony, sklepy, aplikacje, AI | Karol Leszczyński`
- description: skrócić każdą do 140–155 zn., cena i miasto w pierwszych 100 zn.

---

## P2 — Medium

### [LIVE] Strona główna bez JSON-LD (Person/WebSite) — v2 miała Person globalnie
**Where:** `src/pages/index.astro`, `src/layouts/Base.astro`.
**Evidence:** `dist/index.html` — 0 bloków `application/ld+json`; live v2 `<head>` ma `Person` z `sameAs`, `knowsAbout`, `address`. Fraza brandowa „karol leszczyński" = 108+17 imp, poz. 8 — panel wiedzy/encja to główny lewar.
**Fix:** w `index.astro` `<script slot="head" type="application/ld+json">` z `@graph`: `Person` (name, url `https://www.karol-leszczynski.pl/`, image `/photo/karol.webp`, jobTitle, address Toruń, sameAs: GitHub, Google Play dev, LinkedIn jeśli jest, telephone, email) + `WebSite` (`name`, `url`). Skopiować dane z `kontakt/index.astro:57-76`.

### [LIVE] Zrzuty PNG 250–713 KB, każdy w dwóch wariantach (dark/light) — 7,3 MB w `public/projects`
**Where:** `public/projects/*.png`, `src/components/Projects.astro`, `src/pages/projekty/index.astro`, sekcje `#realizacje` w landingach.
**Evidence:** `mekra-desktop-light.png` 713 KB, `mekra-desktop.png` 652 KB, `inkmagnet-desktop*.png` 559 KB ×2, `smart-copy-*` 400–530 KB ×4. W HTML oba warianty jako `<img class="on-dark|on-light" loading="lazy">` — ukryty CSS-em wariant i tak jest pobierany. `/projekty/` = 45 `<img>`.
**Fix:** przekonwertować na WebP (v2 ma gotowy `D:\karol-leszczynski.pl\scripts\gen-webp.mjs` + sharp) — cel <120 KB/plik; wariant dark/light przez `<picture><source media="(prefers-color-scheme: light)">` lub jeden obraz; pierwszy zrzut w sekcji `Projects` na home bez `loading="lazy"` + `fetchpriority="high"` jeśli jest LCP.

### [LIVE] Fonty z Google Fonts (3 rodziny, zewnętrzny CSS blokujący render)
**Where:** `src/layouts/Base.astro:117-121`.
**Evidence:** `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono…&family=IBM+Plex+Sans…&family=Instrument+Serif…">` w każdym HTML; dodatkowe połączenie DNS+TLS przed FCP; brak `preload` woff2.
**Fix:** self-host (`npm i @fontsource-variable/ibm-plex-sans @fontsource/ibm-plex-mono @fontsource/instrument-serif` lub pliki woff2 w `public/fonts/`), `@font-face` z `font-display: swap` w `global.css`, `<link rel="preload" as="font" type="font/woff2" crossorigin>` dla 2 plików above-the-fold. Usunąć preconnect do googleapis.

### [WORKFLOW] Projekt bez repozytorium git i bez skryptu deployu
**Evidence:** `git status` → `not a git repository`; brak `deploy.sh`; `dist/` zawiera resztki poprzedniego buildu (`dist/publikacje/*.webp` bez HTML). Prod będzie nie do odtworzenia z historii; poprzednie audyty pokazały, że S3 dryfuje od repo.
**Fix:** `git init` + `.gitignore` już jest; commit przed pierwszym deployem; `deploy.sh` z v2 z poprawkami z P0.

---

## P3 — Polish
- `[LIVE]` `/index.html` odpowiada 200 obok `/` (CF `DefaultRootObject`) — canonical to ratuje; opcjonalnie w CF function 301 `/index.html` → `/`.
- `[LIVE]` `og:image` jedno globalne `/og.png` na wszystkie strony (`Base.astro:18`) — landingi bez własnej grafiki OG; dodać prop `ogImage` i wykorzystać zrzuty realizacji.
- `[LIVE]` `services.ts` slug `automatyzacje-i-integracje` vs URL `/uslugi/automatyzacja-procesow/`, `infrastruktura-i-utrzymanie` vs `/uslugi/opieka-nad-strona-internetowa/` — kotwice `#slug` na `/uslugi/` nie pokrywają się z nazwami landingów (kosmetyka).
- `[LIVE]` `Base.astro` — tylko `twitter:card`, brak `twitter:title/description/image` (fallback na OG działa, ale nie wszędzie).
- `[CONTENT]` `Service.offers.price` w schema podane jako „od" bez `priceSpecification`/`minPrice` — Google może pokazać „4999 zł" jako cenę stałą; użyć `"@type":"PriceSpecification","minPrice":4999,"priceCurrency":"PLN"` lub `AggregateOffer.lowPrice`.

---

## Unverified — needs re-run
- **T17 PSI/CWV** — v3 nie jest pod publicznym URL; uruchomić po wdrożeniu na `/`, `/uslugi/sklepy-internetowe/`, `/projekty/` (mobile), z kluczem z `.env` skilla.
- **T18 mobile-friendly** — jw. (kod ma `viewport`, layout responsywny w CSS — nie testowane na urządzeniu).
- **I1/I3 po wdrożeniu** — status indeksacji 13 nowych URL i przejście 301 (sprawdzić w seo_panel po ~14 dniach; `Page.indexingVerdict`).

## Skipped — not applicable to this profile
- C11 Product schema, faceted nav, paginacja — nie e-commerce.
- L1/L2 orphany, `sitecrawl`, `botlog` — 13 stron, wszystkie linkowane ze stopki; brak dostępu do logów CloudFront w tym runie.
- T16 hreflang — jeden język.
- Consent Mode gating (obowiązkowy check Astro) — **sprawdzony, nie jest błędem**: `Base.astro:66-105` ładuje gtag zawsze z `consent default = denied`; `CookieBanner.astro` tylko aktualizuje. GA ID `G-T4JJ4B0JH2` = ten sam co live v2.
- `Astro.redirect()`, `sitemap-slugs.mjs` — brak dynamicznych tras w v3.

---

## Sequence of recommended actions
1. **Kod (przed buildem):** `site` → www (P0-1) + 10 literalnych URL; `@astrojs/sitemap` + `robots.txt` (P0-3); `404.astro`; przenieść `publikacje` z `_wylaczone/` do `src/pages/uslugi/publikacje-latex/` (P1-2); title/description (P1-4); Toruń w `sklepy-internetowe` (P1-1); linki kontekstowe (P1-3); JSON-LD home (P2-1).
2. **Infra:** rozszerzyć CF function `kl-trailing-slash-301` o mapę 301 z Appendix A i opublikować **przed** syncem plików.
3. **Deploy:** `git init` + commit; `deploy.sh` z `--delete` dla HTML/XML; build; sync; invalidation `/*`.
4. **Weryfikacja live (tego samego dnia):** `curl -sIL` dla każdego URL z Appendix A → dokładnie jedno 301 → 200; `curl https://www.karol-leszczynski.pl/sitemap-0.xml` → tylko 13 URL www; canonical na home = `https://www.karol-leszczynski.pl/`.
5. **GSC:** prześlij nowy sitemap; Request indexing dla `/`, 7 landingów (limit ~10/dzień — jedna partia). PSI na 3 URL.
6. **Po 14 dniach:** obrazy → WebP (P2-2), fonty self-host (P2-3), sprawdzić indeksację w seo_panel.

---

## Appendix A — mapa 301 (URL v2 → v3)
| v2 (live, 200 dziś) | GSC 90d imp | → v3 |
|---|---:|---|
| `/uslugi/sklepy-internetowe-torun/` | 616 | `/uslugi/sklepy-internetowe/` |
| `/uslugi/sklepy-internetowe-bydgoszcz/` | 0 | `/uslugi/sklepy-internetowe/` |
| `/uslugi/migracje-sklepow/` | — | `/uslugi/sklepy-internetowe/` (sekcja `#migracja`) |
| `/uslugi/publikacje-latex/` | 83 | **zachować URL** (P1-2) — jeśli nowy slug: 301 |
| `/uslugi/programista-torun/` | 33 | `/uslugi/aplikacje-webowe/` |
| `/uslugi/programista-bydgoszcz/` | — | `/uslugi/aplikacje-webowe/` |
| `/uslugi/platformy-saas-ai/` | 13 | `/uslugi/aplikacje-webowe/` |
| `/uslugi/integracje-ai/` | 13 | `/uslugi/wdrozenia-ai/` |
| `/uslugi/strony-www-torun/` | 9 | `/uslugi/tworzenie-stron-internetowych/` |
| `/uslugi/strony-internetowe-bydgoszcz/` | 4 | `/uslugi/tworzenie-stron-internetowych/` |
| `/blog/synchronizacja-allegro-api-wlasny-sklep/` | 91 | `/uslugi/sklepy-internetowe/` (`#integracje`) |
| `/blog/jeden-scraper-trzy-aplikacje-ai/` | 29 | `/uslugi/wdrozenia-ai/` |
| `/blog/matury-online-pl-saas-architektura/` | 6 | `/uslugi/aplikacje-webowe/` |
| `/blog/ai-w-aplikacjach/`, `/blog/dlaczego-90-aplikacji-ai-to-nakladki/`, `/blog/multi-agent-ai-pipeline-do-generowania-tresci/`, `/blog/wlasny-serwer-mcp-do-claude/`, `/blog/wlasne-narzedzie-seo-z-ai/`, `/blog/narzedzie-indeksowanie-stron-google/` | ≤3 | `/uslugi/wdrozenia-ai/` |
| `/blog/15-stron-w-astro-na-aws/`, `/blog/astro-framework/`, `/blog/jak-obs%C5%82uguje-30-domen-na-aws/`, `/blog/sklep-internetowy-bez-serwera/`, `/blog/formularz-kontaktowy-na-statycznej-stronie/` | 0 | `/uslugi/opieka-nad-strona-internetowa/` |
| `/blog/` , `/rss.xml` | 0 | `/projekty/` (lub `/`) |

Szkic do CF function (przed logiką slasha):
```js
var R = { '/uslugi/sklepy-internetowe-torun/': '/uslugi/sklepy-internetowe/', /* … */ };
if (R[uri]) return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: R[uri] } } };
if (uri.indexOf('/blog/') === 0) return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: '/projekty/' } } };
```
(Uwaga: CF Function ma limit ~10 KB kodu — 20 wpisów mieści się bez problemu.)

## Appendix B — verification commands
```bash
# live host + redirect chain
curl -sIL -A "Mozilla/5.0" https://karol-leszczynski.pl/
# v2 sitemap
curl -s https://www.karol-leszczynski.pl/sitemap-0.xml | grep -oE "<loc>[^<]+" 
# CF config / function
aws cloudfront get-distribution-config --id E5XFF2KOROL5S
aws cloudfront get-function --name kl-trailing-slash-301 --stage LIVE cf-func.js
# dist analysis script
node <scratchpad>/analyze.mjs   # title/desc/h1/img/links/JSON-LD per page
# prod DB
sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT p.path,p.\"indexingVerdict\",p.\"coverageState\",p.impressions FROM \"Page\" p JOIN \"Domain\" d ON d.id=p.\"domainId\" WHERE d.domain='www.karol-leszczynski.pl' ORDER BY p.impressions DESC;"
# GSC 90d — sc-domain:karol-leszczynski.pl, dims page / query / page+query (cache: D:\seo-panel\audits\cache\karol-leszczynski.pl\gsc-page-query-90d.json)
```
