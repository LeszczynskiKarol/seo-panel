# SEO on-site audit — silniki-elektryczne.com.pl
**Date:** 2026-06-15
**Profile:** C (e-commerce / katalog produktowy) — 1042 stron, sklep z silnikami elektrycznymi, ~813 produktów + kategorie + power-pages + marki + blog.
**Stack:** Astro 5 SSR (`@astrojs/node` standalone), React islands, Tailwind. PM2 (`stojan-frontend`/`stojan-backend`) + nginx na EC2. Repo `stojan-shop-new`.
**Repo↔prod state:** in-sync — `git status` czysty, brak driftu lokalnego vs prod. Brak sekcji Drift.
**Last crawl:** 2026-06-15 03:44 | **GSC pull:** 2026-06-15 06:00 | **GA4:** ACTIVE, sync 2026-06-15 08:01 (properties/374102839)
**Pages:** 1042 tracked, 984 indexed, ~1035 w sitemap | **DA:** 19 | **GSC 28d:** 1790 klików, 96 925 wyświetleń, CTR 1,85%, poz. śr. 9,0

> **Wniosek nadrzędny:** podstawa techniczna jest bardzo dobra (HTTPS+HSTS preload, apex→www 301, segmentowany sitemap, poprawny schema Product/Offer/Breadcrumb/FAQ, poprawne `noindex`+canonical na filtrach, poprawny Consent Mode v2, 0× 4xx/5xx na 1034 URL, CrUX = FAST). **Nie ma findingów P0.** Realne rezerwy leżą w treści/rankingu: kategorie i część title nie domykają pozycji 4–9 → niski CTR przy dużych wyświetleniach.

---

## ⚠ Data freshness caveats
- **`Domain.totalClicks=123 / totalImpressions=6319`** w `seo_panel` nie zgadza się z GSC 28d (1790 / 96 925). To inne okno/metryka cronu `gsc_pull`; **w audycie używam liczb GSC API 28d** jako źródła prawdy.
- **Liczby „czasu odpowiedzi" z `urlcheck` (śr. 2116 ms, 745 stron „wolnych") są ARTEFAKTEM crawlu** `-c 40` na serwer SSR (sam crawl obciążył Node). Zweryfikowane pojedynczym pomiarem: **PSI lab TTFB = „Root document took 0–40 ms", a CrUX field = FAST**. Dlatego TTFB/„wolne strony" NIE są findingiem.

---

## P1 — High (fix this sprint)

### [CONTENT] Kategoria `/motoreduktory` zakopana na poz. 20,6 i spada — największa utracona rezerwa ruchu
**Where:** `https://www.silniki-elektryczne.com.pl/motoreduktory`; szablon `frontend/src/pages/[categorySlug]/index.astro:285,291,481`
**Evidence:**
- GSC 28d: `/motoreduktory` = 21 klików, **3521 wyświetleń, CTR 0,6%, poz. 20,6** (strona 2–3).
- Spadek pozycji: poprzednie 28d **18,2 → 20,6** (–2,3) — trend zniżkowy.
- Zapytanie `motoreduktor` = **1550 wyświetleń, poz. 7,9, CTR 0,8%**; `silniki elektryczne` = 958 wyśw., poz. 7,9. Pojedyncze produkty-motoreduktory rankują lepiej (np. `/motoreduktory/...037kw-90obr...` poz. 6,7) niż strona kategorii.
- Title generowany z fallbacku: `${category.name} - sklep, hurtownia, oferta, ceny, sprzedaż` (linia 285) — keyword-stuffing, nie pasuje do intencji „motoreduktor". Treść kategorii (`category.description`, render w linii 481) jest cienka/pusta — stąd słaby ranking strony hubowej.

**Impact:** kategoria z najwyższą liczbą wyświetleń w serwisie konwertuje na ~0,6% CTR z pozycji 20. Awans na dolną część str. 1 (poz. 7–8, jak produkty) to potencjalnie kilkaset wyświetleń → kliknięć/mies. z samego „motoreduktor".

**Fix:**
1. `frontend/src/pages/[categorySlug]/index.astro:285` — dla kategorii ustaw sensowny `category.metadata.title` w bazie (kolumna `metadata` kategorii), np. dla motoreduktorów: `"Motoreduktory — przekładnie z silnikiem 3-fazowym | Stojan"` zamiast generycznego „- sklep, hurtownia, oferta, ceny, sprzedaż".
2. Dodać **unikalny opis kategorii 150–300 słów** (`category.description`) dla `/motoreduktory` (i pozostałych 9 kategorii): co to motoreduktor, typy przełożeń, zakresy mocy/obrotów, zastosowania, linkowanie do podkategorii mocy. Renderuje się już przez `ExpandableDescription` (linia 483) — brakuje treści, nie kodu.
3. Wzmocnić linkowanie wewnętrzne do `/motoreduktory` z opisów produktów-motoreduktorów (anchor „motoreduktory").

---

## P2 — Medium (fix when capacity allows)

### [CONTENT/LIVE] 461 z 1034 title (45%) przekracza 65 znaków → ucinane w SERP
**Where:** szablon produktu `frontend/src/pages/[categorySlug]/[productSlug].astro:54`; suma z `D:\seo-panel\audits\cache\silniki-elektryczne-crawl.csv`
**Evidence:**
- `grep "tytuł >65"` → **461 wierszy**. Dwa wzorce sufiksu zjadają piksele: `… - zamów teraz!` (z `seo.title` w bazie) i fallback `… | Stojan Shop` (linia 54: `seo.title || \`${displayName} | Stojan Shop\``).
- Przykłady: `Silnik elektryczny 0,15/0,6kW 660/2710obr. 3fazowy SEW do reduktora - zamów teraz!` (82 zn.), `Sterownik do silnika prądu stałego DMV 2342-45A 18kW LS | Stojan Shop` (68 zn.).
- Power-pages (np. `/silniki-elektryczne-5-5-kw` → „Silniki elektryczne 5,5 kW — 27 szt. od 860 zł | Stojan", 56 zn.) są **dobre** — problem dotyczy kart produktów i części kategorii.

**Impact:** produkty rankują w poz. 5–9 z CTR 1–2% (poniżej oczekiwanego dla tych pozycji). Ucięty, mało zachęcający tytuł obniża CTR; sufiks „| Stojan Shop"/„- zamów teraz!" jest pierwszą ofiarą ucięcia i nie wnosi wartości.

**Fix:**
1. `[...productSlug].astro:54` — skrócić fallback: zamiast ` | Stojan Shop` użyć krótszego brandu lub pominąć przy długiej nazwie:
   ```ts
   const base = displayName.length > 52 ? displayName : `${displayName} | Stojan`;
   const title = seo.title || base;
   ```
2. W bazie ujednolicić `seo.title` produktów — usunąć sufiks `- zamów teraz!` (zjada ~14 zn.), zostawić go najwyżej dla najkrótszych nazw.

### [LIVE] Duplikat produktu z identycznym title, oba self-canonical
**Where:** `/motoreduktory/motoreduktor-przekladnia-055kw-70obr-3fazowy-sew` oraz ten sam slug `-2`
**Evidence:** oba URL zwracają identyczny `<title>Motoreduktor / przekładnia 0,55kW 70obr. 3fazowy SEW - zamów teraz!</title>`, każdy z **własnym** `rel=canonical` (do siebie) i `index,follow`. Wykryte przez `urlcheck -dupes`. Dwa indeksowalne URL-e konkurują o to samo zapytanie.

**Impact:** rozproszenie sygnałów rankingowych (keyword cannibalization) na tej parze; potencjalny „duplicate content".

**Fix:** zdecydować który listing jest właściwy. Albo usunąć/scalić duplikat `-2` (301 na podstawowy), albo ustawić na `-2` `canonical` wskazujący na podstawowy URL. Sprawdzić w bazie produktów czy `-2` to realny drugi egzemplarz (inny stan magazynowy) — jeśli tak, zróżnicować title (dodać nr seryjny/stan).

### [LIVE] Meta description przekraczające 160 zn. / auto-generowane z treści
**Where:** `/trojfazowe` (kategoria); blog — `frontend/src/pages/blog/[slug].astro:24-26`
**Evidence:**
- `/trojfazowe` description = **186 zn.** (ucinane przez Google).
- Blog: `metaDesc = excerpt || stripHtml(content).slice(0,160)+'…'`. Dla `/blog/historia-silnika-elektrycznego...` opis zaczyna się od urwanego zdania „Podobnie jak większość przełomowych wynalazków…" (174 zn.) — to początek artykułu, nie krafrowany snippet.

**Impact:** ucięte/„środkowe" opisy obniżają CTR w SERP dla bloga (poz. 5–8, tysiące wyświetleń: `budowa-silnika` 3216 wyśw., `jak-dziala-silnik` 2317 wyśw.).

**Fix:**
1. `/trojfazowe` — skrócić `category.metadata.description` do ≤155 zn.
2. Blog: uzupełnić pole `excerpt` (150–155 zn., krafrowane CTA) dla 9 postów — fallback `slice(content)` zostawić tylko awaryjnie. Logika w `blog/[slug].astro:24` już preferuje `excerpt`, brakuje wartości w bazie.

### [CONTENT] Klaster spadków pozycji 28d vs poprz. 28d (regresje do monitorowania)
**Where:** GSC, porównanie okien
**Evidence (drop ≥2,0, ≥200 wyśw.):**
| poprz→teraz | impr | URL |
|---|---|---|
| 18,2 → 20,6 (−2,3) | 3521 | /motoreduktory |
| 8,1 → 13,4 (−5,3) | 278 | /silniki-elektryczne-025-kw |
| 5,7 → 9,8 (−4,1) | 250 | /trojfazowe/silnik-elektryczny-75kw-900obr-3fazowy-b35 |
| 7,3 → 10,5 (−3,2) | 536 | /trojfazowe/silnik-elektryczny-75kw-1400obr-132b3 |
| 11,2 → 13,8 (−2,6) | 284 | /motoreduktory/motoreduktor-przekladnia-22kw-24obr |

**Impact:** kilka stron (w tym `/silniki-elektryczne-025-kw`) wypadło z 1. strony. Sygnał, że pojedyncze power/product pages tracą — prawdopodobnie konkurencja, nie błąd techniczny (strony zwracają 200, indeksowalne).
**Fix:** to nie bug — monitorować w `seo_panel`. Priorytet do odświeżenia treści: `/silniki-elektryczne-025-kw` i klaster `/motoreduktory` (spójne z findingiem P1).

---

## P3 — Polish (backlog)

### [CONTENT] Strona główna na poz. 11,6 (str. 2) przy 5241 wyświetleniach
**Where:** `/` | **Evidence:** GSC 28d: 93 kliki, 5241 wyśw., CTR 1,8%, **poz. 11,6**. Home nie domyka str. 1 dla zapytań brandowych+generycznych. **Fix:** wzmocnić H1/treść home pod główne zapytanie „silniki elektryczne" (958 wyśw., poz. 7,9) — obecnie generyczny title; rozważyć link-building (DA 19).

### [LIVE] Lab LCP/FCP wysokie (Google Fonts render-blocking) — pole nadal FAST
**Where:** `frontend/src/layouts/BaseLayout.astro` (preload Inter z fonts.googleapis.com) | **Evidence:** PSI mobile lab: home LCP 8,4 s / FCP 3,1 s / SI 5,5 s (perf 66); kategoria LCP 5,3 s; produkt LCP 6,7 s. **ALE CrUX field = FAST** dla wszystkich, TTFB 0–40 ms. **Impact:** realni użytkownicy OK; lab pokazuje rezerwę. **Fix (opcjonalny):** self-host Inter (woff2 z `font-display:optional`) zamiast 2× round-trip do `fonts.googleapis.com`/`fonts.gstatic.com` — zdejmie ~0,5–1 s z FCP w labie. Nisko-priorytetowe, bo pole jest zielone.

---

## Unverified — needs re-run
- **Lista 58 niezaindeksowanych stron (1042 tracked − 984 indexed).** GSC `searchAnalytics` pokazuje 1000 stron z wyświetleniami (limit zapytania), co sugeruje zdrowy stan; dokładne URL-e „crawled–not indexed" wymagają URL Inspection API per-URL (nie odpytano — niski priorytet przy 94% indeksacji).
- **Out-of-stock handling realnego SKU.** Kod (`[productSlug].astro:101`) ustawia `availability: OutOfStock` przy `stock=0` i zostawia stronę 200 (poprawna strategia). Nie zweryfikowano na żywym wycofanym produkcie — baza produktów to osobna aplikacja na EC2 (nie `seo_panel`), nie odpytano w tym przebiegu.

## Skipped — not applicable / nie dotyczy profilu
- **L1 orphan analysis (sitecrawl)** — pominięte: footer zawiera spójny zestaw 80+ linków (power-pages, marki, kategorie) na każdej stronie SSR; sitemap pokrył 1034 URL z 0× 4xx. Niskie ryzyko orphanów; crawl `-c40` już wywołał rate-limiting serwera, dalsze pełne crawlowanie odłożone.
- **C: AggregateRating w schema** — celowo nieobecne (brak realnych recenzji); poprawnie niefałszowane.
- **T16 hreflang multi-lang** — serwis jednojęzyczny PL; `hreflang pl-PL`+`x-default` obecne i poprawne.

---

## Sequence of recommended actions
1. **Treść kategorii** (P1): dopisać unikalny opis + lepszy `metadata.title` dla `/motoreduktory` (i pozostałych 9 kategorii) w bazie. Największy zwrot.
2. **Title produktów** (P2): edycja `[...productSlug].astro:54` (skrócenie fallbacku) + czyszczenie sufiksu `- zamów teraz!` w `seo.title` w bazie → `git commit` + `./deploy.sh`.
3. **Duplikat `-2`** (P2): decyzja merge/canonical w panelu produktów.
4. **Meta description** (P2): skrócić `/trojfazowe`, uzupełnić `excerpt` 9 postów blogowych.
5. **Monitoring** (P2/P3): obserwować klaster spadków `/motoreduktory` + `/silniki-elektryczne-025-kw` w `seo_panel`.
6. **(Opcjonalnie)** self-host Inter (P3).

> Brak akcji wymagających masowego re-submitu w GSC (indeksacja zdrowa, 94%). Brak driftu repo↔prod do commitowania.

---

## Appendix — verification commands
```bash
# Bulk crawl (źródło findingów title/dup):
urlcheck.exe -sitemap https://www.silniki-elektryczne.com.pl/sitemap_index.xml -c 40 -rps 20 -out ...-crawl.csv -dupes
grep -c "tytuł >65" silniki-elektryczne-crawl.csv      # 461
# Filtry/paginacja:
curl -s ".../trojfazowe?mfr=siemens"  -> robots noindex,follow + canonical=/trojfazowe  (poprawne)
curl -s ".../trojfazowe?page=2"       -> self-canonical + index               (poprawne)
# PSI (PowerShell, klucz z .env): home perf66 LCP8.4s CrUX=FAST TTFB~0ms
# GSC: searchAnalytics query dim=page/query, 28d vs poprz.28d (spadki)
# DB: seo_panel @ panel — Domain JOIN DomainIntegration (GA4 ACTIVE, sync dziś)
```
Crawl CSV: `D:\seo-panel\audits\cache\silniki-elektryczne-crawl.csv`
