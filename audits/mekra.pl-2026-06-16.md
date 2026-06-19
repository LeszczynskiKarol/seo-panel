# SEO on-site audit — mekra.pl
**Date:** 2026-06-16
**Profile:** A — statyczny brochure/katalog producenta (16 podstron, brak bloga, brak link-grafu). Audyt techniczny + indeksacja + konfiguracja pomiaru; analiza orphanów/treści kategorii pominięta jako nieadekwatna.
**Stack:** Astro 4 (static export, `inlineStylesheets: always`), AWS S3 (`www.mekra.pl`) + CloudFront (`E26WECN75Q2HTH`), deploy ręczny `./deploy.sh`.
**Repo↔prod state:** in-sync. `git status` czysty, ostatni commit `31bf31c optymalizacje` (2026-06-16 18:05), live `Last-Modified` 18:06 → optymalizacje z tej sesji (webp, deferred GTM, fallback czcionki) są wdrożone.
**Last crawl:** 2026-06-16 03:21 | **GSC pull:** 2026-06-16 06:01 | **GA4 sync:** 2026-06-16 08:01 (ACTIVE)
**Pages:** 16 w sitemap, 2 zindeksowane (DB `indexedPages`) | **DA:** 3 | **28d GSC:** 78 kliknięć, 1280 wyświetleń, CTR 6,09%, śr. poz. 15,8 | **28d GA4:** 120 sesji, 76 użytk.

---

## Ocena ogólna (project evaluation)

Strona jest **technicznie zrobiona poprawnie** — to rzadkość przy tak świeżej domenie. PSI mobile **perf 92 / SEO 100**, TBT 30 ms, CLS 0,066; HSTS, gzip, jeden host kanoniczny (www), poprawny canonical/OG/JSON-LD `LocalBusiness`, sitemap + robots OK, 404 zwraca realny 404, wszystkie 16 URL = 200, Consent Mode v2 zaimplementowany prawidłowo. Po dzisiejszych optymalizacjach **warstwa on-site jest praktycznie wyczerpana** — nie ma tu już dużych technicznych dźwigni.

**Sufit wzrostu leży teraz poza on-site.** Przy 0 linkach zewnętrznych, DA 3 i świeżej domenie, GSC i tak pokazuje 1280 wyświetleń/28 dni na trafnych frazach — czyli Google rozumie tematykę, ale brak autorytetu trzyma większość fraz na stronach 2–6. Główne hamulce, w kolejności wpływu:
1. **Brak jakichkolwiek linków przychodzących** → niski DA → ranking duszony mimo dobrej treści on-page.
2. **Indeksacja 2/16** → świeżość domeny + brak sygnałów crawl; rozwiązywalne ręcznie + linkami.
3. **Konwersje nie są mierzone** (patrz P1 niżej) — nawet jak ruch przyjdzie, nie zobaczysz ROI.

To nie jest projekt „do naprawy" tylko „do rozpędzenia" — działania off-site (linki, GMB/lokalne cytowania, treść pod frazy lokalne) dadzą teraz 10× więcej niż kolejne poprawki kodu.

---

## P1 — High

### [WORKFLOW] Konwersje w GA4 nie istnieją — `generate_lead` zbierany, ale nieoznaczony jako key event
**Where:** GA4 property `properties/526525192`; event wysyłany z `src/components/Contact.astro:439`.
**Evidence:** GA4 Data API, 28 dni:
```
keyEvents: 0        (żaden event nie jest kluczowy)
generate_lead: 6    (event SIĘ wysyła — 6 leadów w 28 dni)
form_start: 8
```
`isKeyEvent` dla wszystkich eventów = „(not set)" — zero konwersji skonfigurowanych w panelu.
**Impact:** Odpowiedź na pytanie Karola: **tak, konwersje będą dostępne** — dane już lecą (6 leadów/28 dni), brakuje tylko jednego kliknięcia w panelu. Dopóki tego nie zrobisz, raporty konwersji i optymalizacja kampanii są ślepe.
**Fix:** GA4 → Administracja → Zdarzenia (Events) → przy `generate_lead` przełącz **„Oznacz jako kluczowe zdarzenie"**. (Opcjonalnie też `form_start` jako mikro-konwersja). Zmiana działa od momentu włączenia — historii wstecz GA4 nie przelicza, więc im wcześniej, tym lepiej. Kod nie wymaga zmian.

### [LIVE] Indeksacja 2 z 16 podstron
**Where:** wszystkie URL z `sitemap-0.xml`; DB `indexedPages=2`.
**Evidence:** 16 URL w sitemap, wszystkie 200, ale tylko 2 zindeksowane wg seo_panel. GSC totals: śr. poz. 15,8 — strony są widziane, ale większość nie w indeksie.
**Impact:** 14 podstron (m.in. warianty ramek `/oferta/ramka-*`, realizacje) nie może rankować, bo nie są w indeksie. To główny bezpośredni hamulec ruchu organicznego.
**Fix:** GSC → Sprawdzanie adresu URL → „Poproś o zindeksowanie" dla priorytetowych: `/oferta/ramka-7mm/`, `/oferta/ramka-18mm/`, `/oferta/ramka-36mm/`, `/oferta/ramka-60mm/`, `/oferta/zabudowy/`, `/realizacje/`. **Limit ~10 URL/dobę** — rozłóż 16 URL na 2 dni. Realnie indeksacja przyspieszy dopiero z pierwszymi linkami zewnętrznymi (sygnał, że domena jest „warta" crawlowania).

---

## P2 — Medium

### [CONTENT] Wartościowe frazy lokalne i produktowe utknęły na stronach 2–6
**Where:** GSC query report 28d.
**Evidence:** (query | wyświetlenia | pozycja)
```
fronty meblowe toruń        | 127 | 25,8   ← największa okazja lokalna
fronty z ramką              |  79 | 22,9
fronty lakierowane toruń    |  36 | 38,9
fronty laminowane           |  34 | 54,9   (strona 6)
fronty kuchenne z ramką     |  11 |  9,8   (strona 1, 0 kliknięć → okazja CTR/snippet)
```
**Impact:** „fronty meblowe toruń" (127 wyśw., poz. 25,8) to ruch lokalny o wysokiej intencji zakupowej, niemal niewykorzystany. „fronty kuchenne z ramką" jest już na stronie 1 (poz. 9,8) z 0 kliknięć — title/description nie zachęca do kliknięcia.
**Fix (2 konkretne):**
1. Wzmocnij sygnał lokalny: na stronie głównej i `/oferta/` dodaj naturalne wystąpienia „fronty meblowe Toruń / kujawsko-pomorskie" w treści i nagłówku H2 sekcji o firmie; rozważ osobną krótką sekcję/podstronę „Producent frontów meblowych — Toruń". Uzupełnij/załóż wizytówkę Google Business Profile (Toruń) — to najmocniejszy lewar dla fraz `+toruń`.
2. Dla `fronty kuchenne z ramką` (poz. 9,8): upewnij się, że któraś podstrona ma tę dokładną frazę w `<title>`/H1 — obecnie title strony głównej to „Fronty ramiakowe z płyty…", fraza „kuchenne z ramką" nie jest celowana wprost.

### [LIVE] LCP 3,1 s (lab, mobile) — powyżej progu 2,5 s
**Where:** PSI mobile, strona główna.
**Evidence:** LCP 3,1 s (lab, throttling Moto G4); FCP 1,7 s, TBT 30 ms, CLS 0,066. Brak opportunities >100 ms.
**Impact:** Pole (CrUX) nie istnieje — domena za świeża/za mały ruch — więc to wyłącznie sygnał laboratoryjny, nie liczy się jeszcze do Core Web Vitals w rankingu. Niski priorytet.
**Fix:** Element LCP to tekst hero. Po dzisiejszym skróceniu `animation-delay` (0,4→0,18 s) render delay już spadł. Dalsza poprawa tylko jeśli pole pokaże >2,5 s realnie: rozważyć preload pierwszego woff2 fontu body lub `font-display: optional`. Na teraz **monitorować**, nie ruszać.

---

## P3 — Polish

### [LIVE] Łańcuch przekierowań na `http://` + apex (2 przeskoki)
**Where:** wejście `http://mekra.pl/`.
**Evidence:**
```
http://mekra.pl/  → 301 → https://mekra.pl/  → 301 → https://www.mekra.pl/  → 200
```
**Impact:** Marginalny — dotyczy tylko wejść po gołym `http://` bez `www`. Każdy hop to drobne opóźnienie i lekkie rozproszenie sygnału linku (gdyby kiedyś ktoś podlinkował `http://mekra.pl`).
**Fix:** W funkcji CloudFront (viewer-request) obsługującej redirecty połączyć dwa warunki w jeden skok: `http://mekra.pl` i `http://www` → bezpośrednio `https://www.mekra.pl` (1×301). Niski priorytet, kosmetyka.

---

## Unverified — needs re-run
- **Pokrycie indeksu wg GSC API** — użyto `DomainIntegration.indexedPages` z seo_panel (=2) jako proxy; dokładny status per-URL (Indexed / Crawled-not-indexed / Discovered) wymaga URL Inspection API per URL (nie odpytywano, by nie zużywać limitu). Przy następnej iteracji sprawdzić, czy „2" to realny indeks, czy opóźnienie crawla.

## Skipped — not applicable to this profile
- **L1–L6 (orphany, dead-endy, link graph)** — 16 statycznych podstron z pełną nawigacją; brak grafu do analizy.
- **C11 Product/Offer schema, pagination, faceted search, out-of-stock** — nie e-commerce, brak koszyka/cen/wariantów.
- **I5 GSC impressions na URL spoza `Page`** — zbyt mały zbiór, brak wartości.
- **botlog / crawl budget** — strona <1k URL, crawl budget nie jest ograniczeniem; logi nginx nieadekwatne (hosting S3/CloudFront, nie VPS).
- **hreflang (T16)** — strona jednojęzyczna (pl).

---

## Sequence of recommended actions
1. **GA4** (5 min, najpierw): oznacz `generate_lead` jako kluczowe zdarzenie → konwersje zaczynają się liczyć od dziś.
2. **GSC** (dziś + jutro): „Poproś o zindeksowanie" dla 6 priorytetowych URL dziś, reszta jutro (limit ~10/dobę).
3. **Off-site** (priorytet strategiczny): założyć/uzupełnić Google Business Profile (Toruń), pierwsze cytowania NAP w katalogach branżowych/lokalnych — to odblokuje frazy `+toruń` i przyspieszy indeksację.
4. **Treść** (P2): wzmocnić sygnał lokalny „Toruń" + celować wprost frazę „fronty kuchenne z ramką".
5. **CloudFront** (backlog): scalić redirect `http`/apex do 1 skoku.

---

## Appendix — verification commands
```bash
# Live probe / redirecty
curl -sIL -A "Mozilla/5.0" http://mekra.pl/
curl -s  -A "Mozilla/5.0" https://www.mekra.pl/robots.txt
# Statusy wszystkich URL z sitemap → 16×200, /nie-istnieje → 404
# PSI: perf 92 / seo 100, LCP 3.1s, TBT 30ms, CLS 0.066
# GA4 (properties/526525192): sessions 120, keyEvents 0, generate_lead 6
# GSC (sc-domain:mekra.pl): clicks 78, impr 1280, pos 15.8
```
seo_panel (prod, host `panel`):
```sql
SELECT d.domain,d.category,d."totalPages",d."indexedPages",d."totalClicks",d."mozDA",
       di."propertyId",di.status,di."lastSync"
FROM "Domain" d LEFT JOIN "DomainIntegration" di
  ON di."domainId"=d.id AND di.provider='GOOGLE_ANALYTICS'
WHERE d.domain ILIKE '%mekra%';
-- → OTHER | 8 | 2 | 6 | DA 3 | properties/526525192 | ACTIVE | 2026-06-16 08:01
```
