# SEO audit (on-site + off-site) — grandkuchnie.pl
**Date:** 2026-07-19
**Profile:** A/B hybryda — lokalny lead-gen realnego biznesu (meble kuchenne, Toruń) z programatycznymi stronami miast (5) i startowym blogiem (4 posty). UWAGA: w seo_panel domena ma kategorię `SATELLITE` — to nie odpowiada rzeczywistości (patrz P2-6).
**Stack:** Astro 4 static, React islands, Tailwind/daisyUI; S3 (`www.grandkuchnie.pl`) + CloudFront (E3BHDI3E6KXQAJ); deploy przez `deploy.sh` (auto-commit + `aws s3 sync --delete`).
**Repo↔prod state:** in-sync z HEAD (live build 2026-05-25 = ostatni deploy; od tego czasu jedyny commit to deploy.sh, bez wpływu na stronę). Lokalnie 3 nieskomitowane pliki (przebudowa galerii — praca w toku).
**Last crawl:** 2026-07-19 | **GSC pull:** NIGDY (brak dostępu SA — patrz P1-1) | **GA4 lastSync:** 2026-07-19 (ale dane zanieczyszczone — patrz P0-1)
**Pages:** 32 w sitemap, wszystkie 200, wszystkie indexable | **DA:** 3 / **PA:** 7 / **Spam:** 1
**Realny ruch (GA4, tylko hostName=www.grandkuchnie.pl):** 28 dni: 39 sesji, 0 konwersji; 90 dni: ~101 sesji, w tym **3 sesje z Organic Search**.

---

## ⚠ Data freshness caveats
- **Wszystkie liczby GSC w seo_panel dla tej domeny to brak danych, nie zera** — `GscDomainDaily`: 0 wierszy, `Page.indexingVerdict`: 32× `UNCHECKED`, `lastGscPull`: NULL. Przyczyna zweryfikowana: SA nie ma dostępu do property (GSC API: 404 na sites.get, 403 na query).
- **Liczby GA4 na poziomie property są w ~96% ruchem innych domen** (patrz P0-1). Każda liczba z property 486618178 bez filtra `hostName` jest bezwartościowa dla grandkuchnie.
- Pomiar GA4 grandkuchnie może być dodatkowo zaniżony przez Consent Mode v2 (default denied — poprawny wzorzec, ale sesje bez zgody nie liczą się w pełni).

## ⚠ Drift summary — repo ↔ prod
| File | Status | What's in repo | What's on live | Action |
|------|--------|----------------|----------------|--------|
| `src/data/portfolio.ts` | `??` untracked | nowe źródło danych galerii | brak | dokończyć pracę → deploy (deploy.sh sam skomituje) |
| `src/data/realizations.ts` | `M` | warstwa kompatybilności mapująca portfolio | stara wersja hardkodowana | j.w. |
| `src/components/RealizationsGallery.tsx` | `M` | czyta z portfolio.ts | stara wersja | j.w. |

Bez wpływu na SEO do czasu deployu; wymienione dla kompletności.

---

## P0 — Critical (fix this week)

### [WORKFLOW] GA4 property „GrandKuchnie" zbiera dane z 3 różnych stron — analityka (i decyzje Ads) oparte na cudzym ruchu
**Where:** GA4 property 486618178 („GrandKuchnie", jedyny stream: G-WXL1X4CY8R → https://www.grandkuchnie.pl)
**Evidence:** runReport z dimension `hostName`, 28 dni (2026-06-21→07-18):
```
www.silniki-elektryczne.com.pl | 1947 sesji
www.grandkuchnie.pl            |   39 sesji
www.agencja-copywriterska.pl   |   11 sesji
127.0.0.1                      |    2 sesje
```
Silniki i agencja mają w HTML własne tagi (G-VPV7V6L3KW i G-92N4WCQ297, zweryfikowane curl z VPS na 3 podstronach + bundle `_astro/*.js` — brak G-WXL1X4CY8R i brak GTM inline), a mimo to ich hity lądują w property grandkuchni.
**Impact:** 96% danych property to silniki. „882 sesje organic / 35 konwersji" widoczne w raportach to niemal w całości ruch sklepu z silnikami. Jeśli kampanie Google Ads grandkuchni (commit `db360c5 dostosowano do google ads`) importują konwersje z tego property, optymalizują się na cudzych danych.
**STATUS 2026-07-19 (po interwencji):** mechanizm POTWIERDZONY — to **połączony Google Tag (GT)**: serwowany `gtag.js` dla każdego z ID (G-VPV7V6L3KW, G-92N4WCQ297, G-WXL1X4CY8R) zawiera wszystkie trzy destynacje + AW-988030143. Skażenie obustronne (Stojan i Agencja też mają w sobie wszystkie 3 hosty) i trwa od początku property. 100% konwersji w GrandKuchnie z 90 dni = 95× `purchase` z hosta silniki.
Wykonane: (1) seo_panel filtruje teraz `hostName` per domena we wszystkich zapytaniach GA4 (commity 39d07b4, b0d6bd9 w seo-panel) + `keepEmptyRows`; (2) historia `IntegrationDaily` przeliczona z filtrem dla grandkuchnie (10 823→184 sesje), agencji (3810→20), silnik-elektryczny.pl (283→37), praca-magisterska i silniki-elektryczne (uzupełnione braki 2025-26); (3) drugi klaster naprawiony u źródła: silniki-trojfazowe.pl miał wklejony cudzy tag G-CWQQMY5X4D — podmieniony na własny G-XSFVYZEMZP i wdrożony.
**Pozostaje ręcznie (brak API):** rozdzielić połączony Google Tag — GA4 → Administracja → Strumienie danych → [stream] → Skonfiguruj ustawienia tagu → karta Administracja → „Połączone tagi" → rozdziel (z dowolnego z 3 properties). Weryfikacja po: `curl -s 'https://www.googletagmanager.com/gtag/js?id=G-VPV7V6L3KW' | grep -c G-WXL1X4CY8R` → ma być 0. Oraz w Google Ads (konto 1085088127, spięte z property GrandKuchnie): przejrzeć Narzędzia → Konwersje — importowane z GA4 eventy pochodzą z ruchu silników.

---

## P1 — High (fix this sprint)

### [WORKFLOW] seo_panel ślepy na GSC — service account bez dostępu do property
**Where:** GSC property `sc-domain:grandkuchnie.pl`; SA `google-index-api@ageless-period-491209-s8.iam.gserviceaccount.com`
**Evidence:** `sites.get` → HTTP 404 (property nie jest na liście SA), `searchAnalytics/query` → HTTP 403. Skutek w DB: `GscDomainDaily` 0 wierszy, 32 strony `UNCHECKED`, `lastGscPull` NULL, `indexedPages=0` (fałszywe zero).
**Impact:** zero monitoringu indeksacji/zapytań/pozycji; cały pion GSC w panelu martwy dla tej domeny. Nie dało się w tym audycie policzyć realnej liczby zaindeksowanych stron ani zapytań.
**Fix:** Search Console → sc-domain:grandkuchnie.pl → Ustawienia → Użytkownicy i uprawnienia → Dodaj użytkownika: `google-index-api@ageless-period-491209-s8.iam.gserviceaccount.com` (Pełny). Cron `gsc_pull` (06:00) podchwyci od następnego dnia.

### [LIVE] Zepsuty URL obrazka w schema Article na wszystkich 4 postach bloga
**Where:** `src/layouts/BlogLayout.astro:64`; live np. `https://www.grandkuchnie.pl/blog/ile-kosztuje-kuchnia-na-wymiar/`
**Evidence:** live JSON-LD: `"image":"https://www.grandkuchnie.plhttps://s3.eu-north-1.amazonaws.com/piszemy.com.pl/grandkuchnie/1739376104808-meble-wa-16-opt.webp"` — sklejenie domeny z absolutnym URL-em. Kod: `image: image ? `https://www.grandkuchnie.pl${image}` : undefined` — frontmatter `image:` jest już absolutny (S3). `og:image` jest poprawny, bo Layout.astro używa `new URL(ogImage, Astro.site)`.
**Impact:** niepoprawny wymagany atrybut `image` w Article → brak kwalifikacji do rich results dla artykułów.
**Fix:** w `BlogLayout.astro:64` zamienić na `image: image ? new URL(image, Astro.site).toString() : undefined` (`new URL` zostawia absolutne URL-e bez zmian, względne dokleja do domeny — ten sam wzorzec co w Layout.astro:20).

### [LIVE] Link 404 do nieistniejącej kategorii bloga „trendy-i-inspiracje"
**Where:** `src/content/blog/trendy-kuchenne-2026.md` (frontmatter `category: "Trendy i inspiracje"`); linki 404 na `/blog/` i `/blog/trendy-kuchenne-2026/`
**Evidence:** sitecrawl: `[404] /blog/kategoria/trendy-i-inspiracje ← /blog, /blog/trendy-kuchenne-2026`. Enum w `src/content/config.ts:22` zawiera „Trendy i inspiracje", ale `ALL_CATEGORIES` w `src/pages/blog/kategoria/[category].astro:53-63` — nie, więc strona kategorii się nie generuje, a chip kategorii w BlogLayout linkuje w próżnię.
**Impact:** broken internal link z 2 stron; post nie występuje w żadnym listingu kategorii.
**Fix:** w `trendy-kuchenne-2026.md` zmienić frontmatter na `category: "Trendy w kuchniach"` (istniejąca, obecnie pusta kategoria — fix załatwia też jeden thin-content z P2-2) i usunąć `"Trendy i inspiracje"` z enum w `config.ts:22`, żeby rozjazd nie wrócił.

### [CONTENT] Off-site: praktycznie zerowa widoczność organiczna i profil linkowy oparty wyłącznie o własną sieć
**Where:** cała domena
**Evidence:** 3 sesje Organic Search w 90 dni (GA4, hostName-filtered); DA 3 / PA 7. `BacklinkSnapshot`: 20 rekordów, **6 żywych, 5 domen odsyłających**, z czego żywe wyłącznie z własnej sieci (karol-leszczynski.pl ×4, torweb.pl ×2). Strona JEST zaindeksowana (site: pokazuje home, miasta, usługi) — problem to brak autorytetu, nie deindeksacja.
**Impact:** strony miast i usług są technicznie poprawne, ale bez linków zewnętrznych nie wejdą do top10 na „kuchnie na wymiar toruń/bydgoszcz".
**Fix (konkretne kroki, kolejność wg zwrotu):**
1. **Google Business Profile** — najważniejszy kanał dla lokalnego lead-gen; nie zweryfikowałem istnienia wizytówki (patrz Unverified). Jeśli brak: założyć dla „Grand Kuchnie, ul. Polna 134 hala 3, Toruń", podpiąć www, zbierać opinie (sekcja GoogleReviewsSection już istnieje na stronie). Jeśli jest: dodać link do wizytówki w `sameAs` schema (P3-3).
2. Katalogi NAP: panoramafirm.pl, oferteo.pl, fixly.pl, mapy Bing/Apple — spójne dane z schema (NIP 9562111620).
3. Odzyskać wpis na torunnadloni.pl — `https://torunnadloni.pl/firmy/kuchnie-na-wymiar` zwraca 404 (zweryfikowane z VPS); wpis usunięto lub zmienił URL.
4. Powtórzyć format artykułu z bydgoszcz-wiadomosci.pl (żywy link DA 19, anchor „kuchnie na wymiar w bydgoszczy" → /miasto/bydgoszcz) na 2-3 innych lokalnych portalach (Toruń, Włocławek) z linkami do pozostałych stron miast.

---

## P2 — Medium (fix when capacity allows)

### [LIVE] Wszystkie linki wewnętrzne bez trailing slash → każde kliknięcie przechodzi przez 302 z S3
**Where:** wszystkie komponenty nawigacji (Header.astro, Footer.astro, BlogLayout.astro:143/158/214, [category].astro:138/177/233/250, strony miast/usług) — np. `href="/kontakt"`, `href="/blog"`, `href="/miasto/torun"`
**Evidence:** `curl -sI https://www.grandkuchnie.pl/blog` → `HTTP/1.1 302 Moved Temporarily` (`x-amz-error-code: Found`) → `/blog/`. Homepage zawiera 62 wewnętrzne hrefy bez slasha (grep po live HTML); canonicale i sitemap używają formy ze slashem.
**Impact:** ~każda nawigacja krawlera = dodatkowy hop 302 (nie 301); rozjazd forma-linkowana vs forma-kanoniczna na całym serwisie; Google to konsoliduje, ale marnuje crawl i rozmywa sygnały.
**Fix:** dopisać `/` na końcu wewnętrznych hrefów we wszystkich komponentach (mechaniczna zmiana, ~15 plików). Opcjonalnie dodatkowo CloudFront Function (viewer-request) dopisująca `index.html` do URI bez rozszerzenia — eliminuje redirect także dla linków zewnętrznych bez slasha.

### [CONTENT] 7 z 9 stron kategorii bloga to puste placeholdery, 8 z 9 to sieroty
**Where:** `/blog/kategoria/{aranzacje-wnetrz,faq,lazienki-i-garderoby,materialy-i-wykonczenia,porady-ekspertow,projektowanie-kuchni,realizacje,trendy-w-kuchniach}/`
**Evidence:** sitecrawl: 8 stron kategorii w sitemapie nieosiągalnych linkami wewnętrznymi; posty mają tylko 2 kategorie (3× Poradniki, 1× „Trendy i inspiracje" — zepsuta, patrz P1-3). Puste kategorie renderują „Artykuły z tej kategorii są w przygotowaniu" (indexowalne, w sitemapie).
**Impact:** 7 thin-content URL-i zgłaszanych Google w sitemapie przy 32-stronicowym serwisie.
**Fix:** w `src/pages/blog/kategoria/[category].astro:53-63` zostawić w `ALL_CATEGORIES` tylko kategorie z ≥1 postem (po fixie P1-3: `"Poradniki"`, `"Trendy w kuchniach"`); resztę przywracać wraz z pierwszym postem. Sitemap odchudzi się automatycznie przy buildzie.

### [LIVE] LCP 5,6–5,7 s na podstronach (PSI mobile)
**Where:** `/miasto/torun/` (PERF 75, LCP 5,6 s, unused JS 780 ms), `/blog/ile-kosztuje-kuchnia-na-wymiar/` (PERF 63, LCP 5,7 s, TBT 410 ms, unused JS 1500 ms); home OK-ish (PERF 87, LCP 3,4 s)
**Evidence:** PSI API 2026-07-19; hero obrazy ładowane z `https://s3.eu-north-1.amazonaws.com/piszemy.com.pl/grandkuchnie/…` (obce origin, brak preconnect; sam plik 107 KB webp — rozmiar OK, koszt to nowe połączenie + brak priorytetu).
**Fix:** (a) w `BlogLayout.astro:190-196` dodać `fetchpriority="high"` do hero `<img>` (jest `loading="eager"`, brak priorytetu); (b) w `Layout.astro` `<head>` dodać `<link rel="preconnect" href="https://s3.eu-north-1.amazonaws.com" crossorigin>`; (c) docelowo przenieść obrazy postów/miast do `public/img/` na CloudFront (deploy.sh już ustawia im cache 30 d). Unused JS: głównym kandydatem framer-motion w islands — do przeglądu przy okazji przebudowy galerii.

### [WORKFLOW] Backlink-checker daje fałszywe BACKLINK_LOST
**Where:** cron backlink-check na `panel`; `BacklinkSnapshot` dla grandkuchnie
**Evidence:** link z `https://bydgoszcz-wiadomosci.pl/2025/09/26/meble-na-wymiar-czy-z-siecowki-co-wybrac/` → `grandkuchnie.pl/miasto/bydgoszcz` **jest żywy** (curl z VPS: HTTP 200, anchor obecny), a w DB `isLive=f` + event `BACKLINK_LOST` 2026-06-28. Ta sama strona z mojej sieci lokalnej zwraca HTTP 000 (blokada/timeout) — checker prawdopodobnie wpada na ten sam problem i oznacza lost.
**Impact:** alerty BACKLINK_LOST niewiarygodne dla wszystkich domen (8 eventów 21-28.06 dla samej grandkuchni, większość fałszywa — linki karol-leszczynski.pl też są żywe, zweryfikowane).
**Fix:** w kodzie checkera: retry ×2 z odstępem, realistyczny User-Agent Chrome, traktować timeout/000/403 jako „unknown" (nie „lost") i oznaczać lost dopiero po N kolejnych porażkach.

### [WORKFLOW] Kategoria domeny w seo_panel: `SATELLITE`
**Where:** `Domain.category` dla grandkuchnie.pl
**Evidence:** wiersz DB; tymczasem to strona realnego biznesu z Google Ads i formularzem wyceny.
**Impact:** jeżeli panel różnicuje crawl/alerty/raporty po kategorii, domena jest traktowana jak zaplecze.
**Fix:** `UPDATE "Domain" SET category='BUSINESS' WHERE domain='grandkuchnie.pl';` (dostosować do faktycznego enuma — sprawdzić `SELECT DISTINCT category FROM "Domain"`).

---

## P3 — Polish (backlog)

1. **[CONTENT] Sitemap `lastmod` bezwartościowy** — `astro.config.mjs:8` `sitemap({ lastmod: new Date() })` stempluje WSZYSTKIE 32 URL-e datą builda (2026-05-25T12:55 ×32). Usunąć opcję (brak lastmod > kłamliwy lastmod) albo generować per-URL z frontmatter.
2. **[CONTENT] Tytuły >65 znaków na 8 stronach** — home (69), 5×miasto (78, obcinane w SERP: „Kuchnia na wymiar - Bydgoszcz | Projektowanie, montaż, produkcja na zamówienie"), 2 posty (79-103). Dla miast proponuję: `Kuchnie na wymiar Bydgoszcz — projekt i montaż | Grand Kuchnie` (58).
3. **[CONTENT] LocalBusiness schema niekompletne** — `Layout.astro:25-54`: brak `geo` (współrzędne ul. Polnej 134), `openingHoursSpecification`, `addressRegion: "kujawsko-pomorskie"` i `sameAs` (GBP/Facebook). Dla lokalnego biznesu to tanie wzmocnienie.
4. **[CONTENT] Niespójne URL-e w schema** — `BlogLayout.astro:81/94/100/106`: breadcrumb i `mainEntityOfPage` bez trailing slash (canonical ma slash). Dokleić `/`.
5. **[WORKFLOW] deploy.sh auto-commit `git add . && commit -m "git push from local"`** — commituje wszystko co leży w drzewie (np. niedokończoną galerię przy najbliższym deployu) i produkuje nieczytelną historię. Rozważyć przynajmniej parametr na wiadomość commita.

---

## Unverified — needs re-run
- **Liczba zaindeksowanych stron, zapytania, pozycje, coverage** — GSC niedostępne dla SA (P1-1). Po nadaniu dostępu: powtórzyć sekcję indeksacyjną (I1-I6) i tail signals.
- **Mechanizm zanieczyszczenia GA4** (P0-1) — hipoteza connected site tags niepotwierdzona; wymaga GA4 UI lub DevTools na silnikach.
- **Istnienie/stan Google Business Profile** — brak API w tym setupie; sprawdzić ręcznie w Mapach.
- **Kampanie Ads grandkuchni** — czy istnieją i skąd importują konwersje (tabele Ads* w seo_panel nie były sprawdzane pod tę domenę).

## Skipped — not applicable to this profile
- C11 Product/Offer schema, faceted-search, pagination, out-of-stock (Profile C) — nie e-commerce.
- T16 hreflang — serwis jednojęzyczny.
- botlog / crawl-budget — hosting S3+CloudFront, brak logów nginx; przy 32 stronach crawl budget bez znaczenia.
- crawldiff — pierwszy crawl tej domeny (brak poprzedniego CSV).
- Audyt outbound-links pod kątem satelity — mimo `category=SATELLITE` w DB strona nie linkuje do money-sites (zweryfikowane przy crawlu — brak wychodzących linków poza social share).
- Mandatory Astro check „GTM consent gating" — sprawdzony, wzorzec POPRAWNY (GTM ładowany bezwarunkowo z default denied przed kontenerem), więc zgodnie z zasadą findings-only nie ma go w findings; odnotowuję tylko dlatego, że skill wymaga jawnego raportu z mandatory checks. `Astro.redirect` występuje tylko w dead-code'zie static buildów ([slug].astro po getStaticPaths). Centralny plik slugów sitemap nie istnieje (sitemap z integracji @astrojs/sitemap) — drift sitemap↔meta-map nie dotyczy.

---

## Sequence of recommended actions
1. **GA4 (bez kodu):** namierzyć i odpiąć źródło cudzego ruchu w property 486618178 (P0-1); do tego czasu raporty tylko z filtrem hostName.
2. **GSC (bez kodu):** dodać SA jako użytkownika property (P1-1).
3. **Commit + deploy jednej paczki fixów w repo:** BlogLayout image (P1-2) + kategoria posta i enum (P1-3) + trailing slashe (P2-1) + ALL_CATEGORIES (P2-2) + preconnect/fetchpriority (P2-3) + P3-1/3/4. Jeden build, jeden `./deploy.sh` — uwaga: deploy.sh scommituje też rozgrzebaną galerię; dokończyć ją albo stash przed deployem.
4. **Off-site (proces ciągły):** GBP → katalogi NAP → odzyskanie wpisu torunnadloni → 2-3 artykuły na lokalnych portalach (P1-4).
5. **seo_panel:** poprawić kategorię domeny (P2-6), utwardzić backlink-checker (P2-5).
6. Po ~2 tyg. od deployu: re-run audytu z działającym GSC (crawldiff + sekcja indeksacyjna).

---

## Appendix — verification commands
```bash
# crawl całości
D:/go-tools/urlcheck/urlcheck.exe -sitemap https://www.grandkuchnie.pl/sitemap-index.xml -c 20 -rps 10 -dupes
D:/go-tools/sitecrawl/sitecrawl.exe -c 10 -rps 10 -max 100 -depth 6 -sitemap https://www.grandkuchnie.pl/sitemap-index.xml https://www.grandkuchnie.pl/
# redirect chain / trailing slash
curl -sIL -A "Mozilla/5.0" https://www.grandkuchnie.pl/blog
# schema na poście
curl -s https://www.grandkuchnie.pl/blog/ile-kosztuje-kuchnia-na-wymiar/ | grep -o '<script type="application/ld+json">[^<]*'
# backlink żywy (z VPS panel — z sieci lokalnej strona blokuje)
curl -s -A 'Mozilla/5.0 Chrome/126.0' 'https://bydgoszcz-wiadomosci.pl/2025/09/26/meble-na-wymiar-czy-z-siecowki-co-wybrac/' | grep -o 'grandkuchnie[^"]*'
# GA4 hostname split (SA token, property 486618178)
# runReport dimensions=[hostName] dateRanges=28daysAgo..yesterday
# GSC (obecnie 403/404 — po nadaniu dostępu SA zadziała)
# GET https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Agrandkuchnie.pl
```
Cache HTML/CSV: `D:\seo-panel\audits\cache\grandkuchnie.pl*`.
