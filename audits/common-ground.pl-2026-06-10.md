# SEO on-site audit — common-ground.pl
**Date:** 2026-06-10
**Profile:** A (one-pager wizytówkowy) — szkoła języka angielskiego online; cała strona to JEDNA podstrona z sekcjami kotwicowymi (#Oferta, #Cennik, #FAQ).
**Stack:** Webflow (hosted, Cloudflare przed nim), brak dostępu do kodu — audyt wyłącznie live-HTTP + PSI + Moz. Repo/DB/drift: n/d (strona zewnętrzna, brak w seo_panel).
**Pages:** 1 (one-pager) | **Moz DA/PA:** 1/1, 0 domen linkujących, Moz nigdy nie crawlował domeny (świeża domena, site utworzony w Webflow ~XII 2025 wg ID zasobów)
**GSC/GA4:** domena NIE jest w żadnym GSC dostępnym z konta Karola; na stronie brak jakiegokolwiek taga analityki.

---

## ⚠ Data freshness caveats
- Brak danych GSC/GA4/CrUX (domena niezgłoszona / brak taga / za mało ruchu na field data w PSI) — wszystkie priorytety oparte na danych lab + stanie HTML, nie na ruchu.
- Statusu indeksacji w Google nie da się zweryfikować bez dostępu do GSC właściciela — patrz "Unverified".

---

## P0 — Critical (fix this week)

### [LIVE] LCP 15,8 s na mobile — hero ładuje 1,97 MB JPG jako CSS background
**Where:** strona główna, sekcja `.hero-section`; plik `69cd248634f0de79b5bb1f71_Common_Ground_Maja_Rogozik.jpg` (1 967 899 B)
**Evidence:** PSI mobile: Performance **0.60**, LCP **15,8 s** (score 0), FCP 5,9 s, całkowita waga strony **4 340 KiB**. W `webflow.shared.3142bac19.css`:
```css
.hero-section {
    background-image: url(".../69cd248634f0de79b5bb1f71_Common_Ground_Maja_Rogozik.jpg");
    background-size: cover;
```
Obraz NIE występuje w HTML jako `<img>` — to tło CSS, więc Webflow **nie generuje wariantów responsywnych** (brak srcset) i każde urządzenie, także telefon, pobiera pełne 2 MB. Root cause zweryfikowany bezpośrednio (grep w HTML: 0 trafień; grep w CSS: trafienie w `.hero-section`).
**Impact:** LCP 15,8 s vs próg "good" 2,5 s — Core Web Vitals oblane; dla strony konwersyjnej (zapisy na lekcje) realny koszt porzuceń na mobile.
**Fix:** W Webflow Designer otworzyć sekcję Hero → Style panel → Background image i podmienić obraz na wersję skompresowaną: docelowo **WebP lub JPG q≈70, szerokość ~1600 px, waga 150–250 KB** (obecnie 1,97 MB). Plik przygotować poza Webflow (np. squoosh.app) i wgrać jako nowy asset. Opcjonalnie lepiej: przebudować hero tak, by zdjęcie było elementem `<img>` (Webflow doda wtedy srcset automatycznie), a tło zostawić jako kolor.

---

## P1 — High (fix this sprint)

### [LIVE] Brak sitemap.xml (404) + pusty robots.txt + domena niezgłoszona do GSC — indeksacja w ogóle niezarządzana
**Where:** `https://www.common-ground.pl/sitemap.xml`, `https://www.common-ground.pl/robots.txt`
**Evidence:** sitemap.xml → **HTTP 404** (zweryfikowane dwiema metodami: curl i Invoke-WebRequest). robots.txt → HTTP 200, ale **ciało puste, 0 bajtów** (brak dyrektywy `Sitemap:`). `gsc_sites_list` z konta Karola: brak common-ground.pl (jeśli właścicielka ma własne GSC — niezweryfikowane).
**Impact:** Przy DA=1 i zerowych linkach Google nie ma żadnego sygnału do crawlu poza ewentualnym linkiem z profilu Google Maps; strona może w ogóle nie być zaindeksowana.
**Fix:** W Webflow: Site settings → **SEO → wł. "Auto-generate sitemap"** (publikacja wymaga re-publish). Następnie założyć/uzyskać dostęp do Google Search Console dla `common-ground.pl` (weryfikacja DNS lub meta-tagiem w Webflow Custom Code), zgłosić `https://www.common-ground.pl/sitemap.xml` i zlecić indeksację strony głównej (URL Inspection → Request indexing).

### [LIVE] Zero analityki — brak GA4, GTM, Pixela, czegokolwiek
**Where:** strona główna (cały HTML)
**Evidence:** grep `gtag|googletagmanager|G-...|GTM-...|fbq|hotjar|clarity` po pełnym źródle HTML → **0 trafień** (reguła "absent where expected" = finding).
**Impact:** Brak jakiegokolwiek pomiaru ruchu i konwersji — nie da się ocenić skuteczności żadnego działania marketingowego.
**Fix:** Utworzyć usługę GA4, w Webflow: Site settings → **Integrations → Google Analytics** (wkleić Measurement ID `G-…`) albo Custom Code → Head. Jeśli planowany jest baner cookies — wdrożyć Consent Mode v2 z domyślnym `denied`, ale tag ładować od razu (nie dopiero po kliknięciu zgody).

### [LIVE] Brak `<link rel="canonical">`
**Where:** strona główna
**Evidence:** grep `rel="canonical"` w HTML → 0 trafień. Hosty zduplikowane domyślnie nie występują (apex 301→www, http 301→https — łańcuch zweryfikowany `curl -sIL`), ale brak canonicala zostawia otwarte duplikaty typu `?fbclid=`, `?utm_…` z linków społecznościowych (profil FB/IG/TikTok linkuje do strony).
**Fix:** Webflow: Site settings → SEO → **Global canonical tag URL** = `https://www.common-ground.pl` → Save → Publish. Jedno pole, Webflow doda self-canonical na każdej stronie.

### [LIVE] 4 × `<h1>` na jednej stronie, żaden nie zawiera frazy kluczowej
**Where:** strona główna — H1: „Tu zaczynają się nowe możliwości.", „Cześć, jestem Maja!", „Czym właściwie jest dobra nauka języka?", „Z przyjemnością odpowiem na Twoje pytania 💙"
**Evidence:** grep `<h1` → 4 wystąpienia (w tym jeden z klasą `heading-6` — typowe webflowowe pomylenie stylu z semantyką). Żaden H1 nie zawiera słów „angielski/angielskiego" — jedyna fraza kluczowa jest w `<title>`.
**Impact:** Rozmyty główny temat strony dla crawlera; dla one-pagera H1 to najsilniejszy sygnał on-page po title.
**Fix:** W Webflow Designer zmienić tagi (Element settings → Heading → H2/H3) tak, by został **jeden** H1 w hero. Proponowany tekst H1: „Szkoła języka angielskiego online — tu zaczynają się nowe możliwości". Pozostałe trzy nagłówki → H2 („Cześć, jestem Maja!", „Czym właściwie jest dobra nauka języka?") i H3 (nagłówek formularza kontaktowego).

### [LIVE] Sekcja Cennik ładuje drugie tło 1,37 MB
**Where:** `.pricing-section`, plik `69ea4bd52da53d0188864c5c_Common_Ground_Singapur_2.jpg` (1 368 505 B)
**Evidence:** w `webflow.shared.…css`: `.pricing-section { background-image: url(".../Common_Ground_Singapur_2.jpg"); background-size: cover; }` — ten sam mechanizm co w P0 (tło CSS = brak srcset, pełny plik na mobile).
**Impact:** ~1/3 wagi strony (4,3 MB łącznie); poniżej foldu, więc nie psuje LCP, ale dławi transfer na mobile.
**Fix:** Jak w P0 — skompresować do ~150–200 KB WebP/JPG i podmienić asset tła sekcji Cennik w Webflow Designer.

---

## P2 — Medium

### [LIVE] `<html>` bez atrybutu `lang` na stronie po polsku
**Where:** strona główna, tag otwierający: `<html data-wf-domain="www.common-ground.pl" …>` — brak `lang`
**Evidence:** grep `<html[^>]*>` → atrybutu `lang` nie ma w ogóle.
**Fix:** Webflow: Site settings → **General → Language** ustawić `pl` → Publish. Jedno pole.

### [LIVE] Zero danych strukturalnych (JSON-LD) — a strona ma gotowe FAQ i profil Google Maps
**Where:** strona główna
**Evidence:** grep `application/ld+json` → 0. Na stronie istnieje sekcja FAQ (5 pytań, m.in. „Jak mogę rozpocząć współpracę?", „Jak wygląda forma zajęć?") oraz link do wizytówki Google Maps („Common Ground - Szkoła Języka Angielskiego Online").
**Fix:** Webflow: Page settings → Custom Code → Head, wkleić jeden `<script type="application/ld+json">` z `@graph`: (1) `Organization` (lub `LocalBusiness`) z `name`, `url`, `logo`, `sameAs` = [profil FB, IG, TikTok, wizytówka Maps]; (2) `FAQPage` z pięcioma istniejącymi parami Q&A przepisanymi 1:1 ze strony (nie wymyślać nowych). Mogę wygenerować gotowy snippet na życzenie.

### [CONTENT] H2 sekcji to pojedyncze słowa bez fraz — „Oferta", „Cennik" (×2), „FAQ", „Opinie"
**Where:** strona główna, 5 × `<h2>`
**Evidence:** pełna lista H2: `Oferta / Cennik / Cennik / FAQ / Opinie` — w tym **duplikat „Cennik"**. Przy 1224 słowach na stronie nagłówki nie niosą żadnej frazy.
**Fix:** Konkretne podmiany w Webflow Designer: „Oferta" → „Oferta kursów angielskiego online", „Cennik" → „Cennik lekcji angielskiego" (drugi duplikat → „Pakiety i ceny"), „FAQ" → „Najczęstsze pytania o naukę angielskiego online", „Opinie" → „Opinie uczniów".

### [LIVE] 36 z 37 obrazów bez tekstu alternatywnego
**Where:** strona główna
**Evidence:** `<img>` łącznie 37, z niepustym `alt` — 1.
**Fix:** W Webflow Assets panel ustawić alt dla zdjęć znaczących (zdjęcia Mai, zdjęcia z zajęć — np. „Maja Rogozik — lektorka języka angielskiego, Common Ground"), a dekoracyjne oznaczyć jako "Decorative" (Webflow doda `alt=""`).

---

## P3 — Polish (backlog)

- **[LIVE] Brak `og:url` i `og:locale`** — przy ustawionym canonicalu (P1) warto dodać oba we wzorcu OG; `og:locale` = `pl_PL`.
- **[LIVE] 5 rodzin fontów na one-pagerze** (Lato, Cormorant Garamond, Inter, Bodoni Moda, Outfit), w tym dwa jako nieskompresowane **TTF** (Bodoni Moda 89 KB, Outfit 55 KB). Ograniczyć do 2 rodzin; warianty variable-TTF zamienić na woff2 lub korzystać tylko z Google Fonts.
- **[LIVE] Faviconki zadeklarowane `type="image/png"`, a fizycznie `.jpg`** (warianty dark-scheme i apple-touch). Kosmetyka — wgrać PNG albo poprawić deklarację.
- **[LIVE] Render-blocking ~5,4 s wg PSI** (jQuery 3.5.1, chunki webflow.js, webfont.js). Na Webflow pole manewru małe (skrypty platformy); realny zysk: usunięcie `webfont.js` jeśli fonty przejdą na self-hosted/`<link>`, oraz P0/P1 obrazkowe, które dominują czas ładowania.
- **[INFO/off-site] Profil linków zerowy** — Moz: DA 1, PA 1, 0 linkujących domen, domena nieobecna w indeksie Moz. Poza zakresem audytu on-site, ale to obecnie główny sufit widoczności: warto zadbać o podstawowe NAP-y/katalogi i link z wizytówki Google.

---

## Unverified — needs re-run
- **Status indeksacji w Google (I1-I6)** — brak dostępu do GSC właścicielki domeny (nie ma jej w GSC Karola). Po dodaniu domeny do GSC (P1) sprawdzić Coverage.
- **Field data CWV (CrUX)** — PSI nie zwrócił `loadingExperience.metrics` (za mało ruchu). Tylko dane lab.
- **PSI desktop** — nie uruchamiany (mobile wystarczył do diagnozy; przyczyna jest niezależna od strategii). Quota pozwala na re-run po wdrożeniu poprawek.

## Skipped — not applicable to this profile
- Fazy repo/drift (1a, 1a+, 1a++) — strona na hostowanym Webflow, brak dostępu do kodu i repo.
- Zapytania prod seo_panel poza lookupem domeny — domeny nie ma w bazie (0 rows), brak danych do analizy.
- L1–L6 (graf linków wewnętrznych) — one-pager, linki wyłącznie kotwicowe.
- C2/C4 (duplikaty title/description) — istnieje tylko jedna strona.
- Checki Profile C/E (product schema, faceted search, audyt linków wychodzących) — nie dotyczy.
- Mandatory checks Astro (Consent Mode gating, Astro.redirect) — stack to Webflow, nie Astro; analityki i tak brak (osobny finding P1).
- Świeży głęboki Moz — wykonano 1 oszczędny request `moz_url_metrics` (cache 7 dni), zgodnie z dyspozycją o limicie 3k/mc.

---

## Sequence of recommended actions
1. **Webflow Designer:** skompresować i podmienić 2 obrazy tła (hero ~2 MB, cennik ~1,4 MB) → re-publish. (P0 + P1)
2. **Webflow Designer:** poprawić strukturę nagłówków (1 × H1 z frazą, reszta H2/H3) + przepisać H2 sekcji + uzupełnić alty. (P1/P2)
3. **Webflow Site settings:** Global canonical URL, Language = `pl`, Auto-generate sitemap, integracja GA4 → jeden wspólny re-publish. (P1/P2)
4. **Custom Code (Head):** JSON-LD `Organization` + `FAQPage`; przy okazji `og:url`/`og:locale`. (P2/P3)
5. **GSC:** zweryfikować domenę, zgłosić sitemap, Request indexing dla strony głównej (limit ~10 URL/dzień — tu wystarczy 1). (P1)
6. **Po 1–2 tygodniach:** re-run PSI mobile + sprawdzić Coverage w GSC.

---

## Appendix — verification commands
```bash
curl -sIL -A "Mozilla/5.0 (compatible; SEO-Audit/1.0)" "http://common-ground.pl/"          # łańcuch 301: apex-http → apex-https → www (200)
curl -s "https://www.common-ground.pl/robots.txt"                                          # 200, 0 bajtów
# sitemap: curl zwracał 000 (quirk połączenia), cross-check:
# PS> Invoke-WebRequest "https://www.common-ground.pl/sitemap.xml"                         # → 404
curl -s "https://www.common-ground.pl/" -o home.html                                       # 44 103 B
grep -c 'application/ld+json' home.html                                                    # 0
grep -o '<html[^>]*>' home.html                                                            # brak lang=
grep -o '<img' home.html | wc -l                                                           # 37; z alt: 1
# PSI (klucz z .env skilla, nie wklejać):
# GET https://www.googleapis.com/pagespeedonline/v5/runpagespeed?url=https://www.common-ground.pl/&strategy=mobile
# → perf 0.60, LCP 15.8s, total 4340 KiB; cache: D:\seo-panel\audits\cache\common-ground.pl\psi-mobile.json
grep -o 'url([^)]*Maja_Rogozik[^)]*)' webflow.css                                          # tło .hero-section = 1.97 MB JPG
# Moz: mcp__aftermarket__moz_url_metrics(["common-ground.pl"]) → DA 1, PA 1, 0 linking domains
```
