# SEO audit (on-site + off-site) — karol-leszczynski.pl
**Date:** 2026-08-05
**Profile:** B (content/portfolio) — wizytówka usługowa + blog techniczny (14 wpisów), 31 URL-i w sitemapie, ruch śladowy.
**Stack:** Astro 5 static, deploy S3 + CloudFront (eu-north-1, 2 dystrybucje: naked E1WSPFUI6IC88H → 301 → www E5XFF2KOROL5S), sitemap via @astrojs/sitemap.
**Repo↔prod state:** prod AHEAD of repo — live zdeployowany 2026-08-05 07:34 (Last-Modified), ostatni commit 2026-06-11; 2 pliki zmodyfikowane + 4 untracked obrazki już serwowane na produkcji.
**Last crawl:** 2026-08-05 03:12 | **GSC pull:** 2026-08-05 06:01 | **GA4 sync:** 2026-08-05 08:00 (ACTIVE)
**Pages:** 46 tracked (w tym duplikaty slash/non-slash), 31 indexed, 31 w sitemapie | **DA:** 8 / PA 21 | **Last 28d GSC:** 5 clicks, 269 impressions

---

## ⚠ Drift summary — repo ↔ prod

| File | Status | What's in repo | What's on live | Action |
|------|--------|----------------|----------------|--------|
| `src/content/blog/matury-online-pl-saas-architektura.md` | `M` | brak heroImage w HEAD; dodany lokalnie | wdrożone (obrazek 200 na live) | COMMIT |
| `public/images/blog/{google-indexing-notifier-architecture, matury-online-saas-architektura, mcp-server-claude-ai, seo-command-center-dashboard}.jpg` | `??` untracked | brak w repo | wszystkie 4 serwowane 200 (jpg + webp) | COMMIT |
| `deploy.sh` | `M` | HEAD zawiera auto `git add/commit/push` | lokalnie usunięty krok auto-commit | COMMIT (świadoma decyzja — patrz [WORKFLOW] niżej) |

Prod jest zbudowany z niezacommitowanego stanu — repo NIE odtworzy dziś produkcji. Jeden `git add -A && git commit` zamyka temat.

---

## P0 — Critical (fix this week)

*(brak znalezisk P0 — strona żyje, indeksuje się częściowo, nic nie jest zepsute krytycznie; największe straty są w P1)*

## P1 — High (fix this sprint)

### [LIVE] Wszystkie linki wewnętrzne bez trailing slash → każde kliknięcie/crawl przechodzi przez 301, a GSC indeksuje oba warianty URL-i osobno
**Where:** `src/components/Header.astro`, `Footer.astro`, `LatestPosts.astro`, layouty i strony — 17+ wystąpień `href="/kontakt"`, `href="/uslugi/..."`, `href="/blog/..."` (bez `/` na końcu). Canonical i sitemap używają wersji ze slashem; CloudFront robi 301 non-slash→slash.
**Evidence:**
- `curl -sI .../uslugi/sklepy-internetowe-torun` → `HTTP/1.1 301` (Server: CloudFront); to samo dla `/kontakt` i `/blog/astro-framework`.
- Homepage HTML: wszystkie hrefy nawigacji bez slasha (`href="/projekty"` ×4, `href="/uslugi/strony-www-torun"` ×3 itd.).
- Prod `Page` table: **oba warianty indeksowane osobno** — `/uslugi/sklepy-internetowe-torun` (poz. 12.3, internalLinksIn=45) i `/uslugi/sklepy-internetowe-torun/` (poz. 10.1, internalLinksIn=0). Analogiczne pary dla ~15 ścieżek → stąd 46 wierszy w `Page` przy 31 URL-ach w sitemapie. Sygnały (linki wewnętrzne vs canonical) rozjeżdżają się między wariantami.
**Impact:** rozmycie sygnałów linkowania wewnętrznego na całej witrynie, marnowanie crawlu na 301, duplikaty w GSC.
**Fix:** w wymienionych plikach dopisać `/` na końcu każdego wewnętrznego `href` (np. `href="/kontakt"` → `href="/kontakt/"`, `href="/uslugi/strony-www-torun"` → `.../strony-www-torun/"`). Dodatkowo w `astro.config.mjs` ustawić `trailingSlash: "always"`, żeby dev łapał regresje. Po deployu Google skonsoliduje warianty sam (301 już istnieje — nic więcej nie trzeba).

### [LIVE] 11 z 31 URL-i niezaindeksowanych, w tym 9 wpisów blogowych i sam indeks `/blog/`
**Where:** `Discovered – currently not indexed`: `/blog/`, `/blog/dlaczego-90-aplikacji-ai-to-nakladki/`, `/blog/narzedzie-indeksowanie-stron-google/`, `/blog/jak-obsługuje-30-domen-na-aws/`, `/blog/formularz-kontaktowy-na-statycznej-stronie/`, `/blog/15-stron-w-astro-na-aws/`, `/blog/astro-framework/`, `/blog/wlasny-serwer-mcp-do-claude/`. `URL is unknown to Google`: `/projekty/`, `/blog/multi-agent-ai-pipeline-do-generowania-tresci/`, `/blog/wlasne-narzedzie-seo-z-ai/`, `/blog/sklep-internetowy-bez-serwera/`, `/uslugi/sklepy-internetowe-bydgoszcz/`.
**Evidence:** prod `Page.coverageState` (crawl seo-panel 2026-08-05 03:12). Wpisy blogowe mają `internalLinksIn` 0–2 (usługi: 45).
**Impact:** ~60% treści blogowej niewidoczne w Google — cały wysiłek contentowy bez zwrotu.
**Fix (likely causes among several — niska moc domeny DA 8 + słabe linkowanie wewnętrzne + 301 na każdym linku do wpisu):**
1. Najpierw wdrożyć fix trailing-slash (wyżej).
2. Dodać blok "powiązane wpisy" (3–4 linki) na końcu każdego wpisu w `src/layouts/BlogPost.astro` — dziś wpisy mają 0–2 linki wchodzące, a home linkuje tylko 3 najnowsze (`LatestPosts.astro`).
3. Po deployu: GSC → Request Indexing dla 13 URL-i powyżej. **Limit ~10/dzień/property — rozłożyć na 2 dni**, zacząć od `/blog/` i `/projekty/`.

### [LIVE] LCP/FCP ~6 s mobile (PSI perf 63–67) — render-blokujący łańcuch: global.css → @import Google Fonts (3 rodziny, 14 wariantów)
**Where:** `src/styles/global.css:7` — `@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:...&family=Newsreader:...&family=IBM+Plex+Mono:...")`.
**Evidence:** PSI mobile 2026-08-05: home perf 63, FCP 6.0 s, LCP 6.0 s (TTFB 40 ms — to nie serwer); blog 67 / LCP 5.3 s; uslugi 65 / LCP 5.9 s. `render-blocking-insight`: **Est savings 3,750 ms**, wskazany URL fonts.googleapis.com/css2. Newsreader woff2 = 147 KB. Brak danych CrUX (za mały ruch) — pomiar lab-only.
**Impact:** każda wizyta mobilna czeka ~6 s na treść; przy stronie sprzedażowej usług to bezpośrednia strata konwersji.
**Fix:** usunąć `@import` z `global.css`; self-host fontów (np. `@fontsource-variable/bricolage-grotesque` + `@fontsource/newsreader` — tylko używane wagi) importowanych w `Base.astro`, plus `<link rel="preload" as="font">` dla 2 głównych woff2. Rozważyć redukcję: Newsreader ma 6 wariantów (ital+3 wagi) — realnie używane są zwykle 2–3. Preconnecty do fonts.googleapis/gstatic w `SEOHead.astro` wtedy do usunięcia.

## P2 — Medium

### [LIVE] Wszystkie 14 tytułów wpisów blogowych ma 86–163 znaki (limit widoczny w SERP ~65)
**Where:** frontmatter `title` w `src/content/blog/*.md` + sufiks `| Karol Leszczyński` doklejany w `src/components/SEOHead.astro` (`fullTitle`). Najgorszy: `narzedzie-indeksowanie-stron-google.md` — 163 znaki. Indeks `/blog/` — 86.
**Evidence:** crawl urlcheck 2026-08-05, kolumna title (pełna lista w załączniku).
**Impact:** Google ucina/przepisuje tytuły; CTR z 269 wyświetleń/28d wynosi ~1,9%.
**Fix:** skrócić `title` we frontmatter każdego wpisu do ≤45 znaków (sufiks dodaje ~20). Np. `narzedzie-indeksowanie-stron-google.md`: „Automatyczne powiadamianie Google o nowych stronach — jak zbudowałem serverless notifier na AWS Lambda, który indeksuje moje domeny w 48 godzin" → „Serverless notifier: indeksowanie w Google w 48 h". Alternatywnie: nie doklejać sufiksu dla wpisów blogowych (warunek w `SEOHead.astro` po `ogType === 'article'`).

### [LIVE] `/polityka-prywatnosci/` ma `noindex, nofollow`, a siedzi w sitemapie
**Where:** sitemap-0.xml (31 URL-i) zawiera URL wykluczony z indeksacji; GSC: „Excluded by 'noindex' tag".
**Evidence:** crawl urlcheck: meta_robots=`noindex, nofollow` dla tego URL-a; obecny w sitemapie.
**Fix:** w `astro.config.mjs` do integracji sitemap dodać `filter: (page) => !page.includes("/polityka-prywatnosci")`.

### [WORKFLOW] `deploy.sh` z usuniętym auto-commitem — powrót ryzyka „prod ahead of repo"
**Where:** `deploy.sh` (zmiana niezacommitowana): usunięty blok `git add . && git commit && git push` sprzed builda.
**Evidence:** `git diff deploy.sh`; skutek już widoczny — dzisiejszy deploy (07:34) nie ma odpowiadającego commita (ostatni: 2026-06-11).
**Fix:** albo przywrócić push w deploy.sh (choćby jako prompt y/n), albo zacommitować obecną wersję i przyjąć zasadę ręcznego commitu przed `./deploy.sh`. Wybrać jedno — obecny stan (zmiana wisząca w working tree) to najgorsza opcja.

### [WORKFLOW] Brak śledzonych fraz w seo-panelu dla tej domeny
**Where:** prod `DomainKeyword` — 0 wierszy dla domainId `karol01` (przy 269 wyświetleniach/28d frazy istnieją).
**Impact:** panel nie alertuje o spadkach fraz — a te już się dzieją (patrz off-site niżej).
**Fix:** dodać w seo-panelu tracked keywords: „karol leszczyński", „programista toruń", „strony internetowe toruń", „integracja ai dla firm", „sklepy internetowe toruń".

## P3 — Polish

- **[LIVE] Zdublowany BreadcrumbList na wpisach blogowych** — emitują go równolegle `src/layouts/BlogPost.astro:48` i `src/components/Breadcrumbs.astro:16`. Usunąć schema z jednego z nich (zostawić w Breadcrumbs.astro, bo odpowiada widocznemu UI).
- **[LIVE] Niepoprawne semantycznie `alumniOf`** w Person schema (`src/components/SEOHead.astro`): `"alumniOf": {"@type":"Organization","name":"15+ lat doświadczenia w digital marketing..."}` — to nie jest organizacja. Usunąć pole albo zastąpić `description`.
- **[CONTENT] `sameAs` tylko GitHub** — istnieje profil X (`twitter.com/Leszczynski_K`, widoczny w SERP na brand query). Dodać do `sameAs` w `SEOHead.astro` (+ LinkedIn, jeśli jest).
- **[LIVE] `/kontakt/` title 27 znaków** („Kontakt — Karol Leszczyński") — dopisać frazę, np. „Kontakt — wycena strony / sklepu | Karol Leszczyński".

---

# Off-site

## P1 — [CONTENT] Profil linków = własna sieć + spam; realnych linków redakcyjnych ~5 domen, DA stoi na 8
**Evidence (prod `BacklinkSnapshot`, 2026-08-05):**
- **matury-online.pl: 468 linków** (site-wide, anchor „karol-leszczynski.pl") — jedna domena to ~85% profilu.
- Pozostała własna sieć: sitario.com (2), maturalnie.pl (1), kurs-copywritingu.pl (1), zostancopywriterem.pl (1).
- Quasi-redakcyjne/katalogi: archnews.pl (DA 25), edwin.pl (14), gasik.net (24), kukaj.pl (19), kataloog.info (32), prezentacje2013.pl.
- Reszta to skracacze URL i śmieci (.top/.icu/.xyz/.sbs/.fyi).
**Impact:** DA 8, brand query „karol leszczyński" wypadł z top10 (SeoEvent LEFT_TOP10 2026-08-02 i 03: poz. 9.6→11.5), „integracja ai dla firm" poleciała z 10 na 63–83 (LEFT_TOP10 2026-08-03/04). Bez dywersyfikacji linków usługowe frazy lokalne nie wejdą do top10.
**Fix (konkretne kierunki):** (1) case studies z bloga (matury-online SaaS, multi-agent pipeline) zgłosić do polskich agregatorów/társerwisów dev — np. devstyle-owe kanały gościnne, JustJoinIT blog, hackernoon crosspost z linkiem kanonicznym; (2) profile firmowe: Google Business Profile (Toruń — frazy lokalne „programista toruń" to główne impressiony), Clutch/GoodFirms, oferteo (ranking „Programista Toruń" jest w top10 SERP); (3) w stopkach własnej sieci zamienić anchor „karol-leszczynski.pl" na zróżnicowane brandowe/opisowe i ograniczyć site-wide z matury-online do np. strony głównej + /o-nas.

## P2 — [LIVE] Linki z własnej sieci celują w nagą domenę → dodatkowy hop 301
**Evidence:** SeoEvent BACKLINK_NEW 2026-08-03/04: `https://www.matury-online.pl/diagnoza` i `/diagnoza/wynik` → target `https://karol-leszczynski.pl` (naked); maturalnie.pl/o-redakcji → naked. Naked 301-uje na www.
**Fix:** w stopce matury-online.pl i maturalnie.pl podmienić href na `https://www.karol-leszczynski.pl/`.

## P2 — [WORKFLOW] Spam-linki PBN z toksycznymi anchorami — monitorować, nie disavowować
**Evidence:** BACKLINK_NEW 2026-08-02: plumeriamarketing.com (DA 60) i lydiaroyrealestate.com (DA 61), anchor „high quality dofollow backlinks da 50 pa 40 premium pbn network service … buy backlinks online cheap"; knows.sbs spam score **93**; ~15 domen-skracaczy.
**Impact:** przy braku manual action Google to zwykle ignoruje; disavow na tym etapie niepotrzebny i ryzykowny.
**Fix:** nic nie robić teraz; sprawdzić GSC → Security & Manual Actions (raz), obserwować czy wolumen rośnie. Jeśli spam przekroczy ~50% profilu lub pojawi się manual action — wtedy disavow listą domen.

---

# Część marketingowa — diagnoza małego ruchu, frazy konwertujące, zachowania userów

*(dane: GSC API 90 dni do 2026-08-04, GA4 API 90 dni, property 503043956; wszystkie liczby to realne pomiary, nie szacunki z narzędzi zewnętrznych)*

## Diagnoza: dlaczego ruch jest śladowy (90 dni: 2 kliknięcia organiczne, 21 sesji GA4)

1. **Cała widoczność wisi na jednej stronie i jednej frazie.** `/uslugi/sklepy-internetowe-torun/` zbiera ~600 z ~700 wyświetleń domeny, z czego 407 to „sklepy internetowe toruń" na **poz. 16** — strefa zerowego CTR. Nic z realnym wolumenem nie jest w top10.
2. **Blog (14 wpisów = 60% treści witryny) generuje ~0 wyświetleń.** Tematy dev (Astro, AWS, multi-agent AI) po polsku nie mają wolumenu wyszukiwań, a po angielsku nie ma szans przy DA 8. Do tego odbiorca tych treści (programista) nie jest klientem na usługi — blog nie zasila lejka. Jedyny wpis łapiący frazy to allegro-api (6–9 impr., „wielowariantowość allegro api" poz. 31).
3. **„strony internetowe toruń" — 0 wyświetleń w 90 dni** mimo poprawnego targetowania (`/uslugi/strony-www-torun/` ma dobry title i H1 „Strony internetowe Toruń"). Strona jest poza top ~100. To problem autorytetu (DA 8, brak Google Business Profile i cytowań NAP), nie on-page.
4. **Frazy bydgoskie rankują stroną toruńską** (poz. 24–97: „e-commerce bydgoszcz" 56, „tworzenie sklepów online bydgoszcz" 83, „woocommerce bydgoszcz" 29 — wszystko przez `/uslugi/sklepy-internetowe-torun/`). Dedykowane strony bydgoskie są niewidoczne — kanibalizacja + zbyt słabe podstrony.
5. **Zero pomiaru konwersji.** GA4 ma wyłącznie domyślne eventy (page_view 22, scroll 5, click 2); `conversions = 0` z definicji — brak eventów za formularz, tel:, mailto. Nie wiadomo, czy te 21 sesji cokolwiek zrobiło.

## Pozycje na frazy konwertujące (GSC, 90 dni)

| Fraza | Impr. | Poz. | Strona rankująca | Wniosek |
|---|---|---|---|---|
| sklepy internetowe toruń | 407 | 16,0 | /uslugi/sklepy-internetowe-torun/ | **główna fraza money** — jedyna szybka wygrana z wolumenem |
| sklepy internetowe typo3 toruń | 76 | 10,3 | jw. | tuż za top10 (strona nawet nie wspomina TYPO3) |
| budowa sklepu internetowego toruń | 59 | 26,7 | jw. | dołączyć do optymalizacji M3 |
| copywriter toruń | 45 | 19,5 | / (home) | dziedzictwo poprzedniej działalności — decyzja: targetować czy ignorować |
| e-commerce toruń | 7 | 6,9 | sklepy-torun | już top10, mały wolumen |
| sklep b2b ecommerce toruń | 8 | 8,8 | jw. | intent B2B — warta sekcji na stronie |
| firmy programistyczne toruń | 1 | 12,0 | /uslugi/programista-torun/ | strona prawie niewidoczna |
| skład książki naukowej | 1 | **1,0** | /uslugi/publikacje-latex/ | **poz. 1** — nisza ogólnopolska do rozbudowy |
| strony internetowe toruń | 0 | — | brak | strona istnieje, nie rankuje wcale |

## Zachowania userów (GA4, 90 dni — próbka mała: 21 sesji, wnioski kierunkowe)

- **Organic: 10 sesji, engagement 60%, śr. 104 s** — kto już trafi, ten czyta. Problem jest w dowozie ruchu, nie w jakości strony. Landingi usługowe: 100% engagement (po 1 sesji).
- `/blog/astro-framework/` — 3 sesje, 199 s średnio: treść trzyma uwagę, ale to czytelnik-programista, nie klient.
- **Referral: 4 sesje, 0% engagement, 2 s** — szum (boty/własna sieć), nie liczyć tego jako ruch.
- **Kanał „AI Assistant": 1 sesja, 164 s, 100% engagement** — LLM-y już odsyłają; tematy MCP/AI na blogu mają tu drugie życie (cytowalność w odpowiedziach AI).
- Konwersje: 0 — brak instrumentacji (patrz M1).

## Plan działań marketingowych (wg wpływu)

### M1 [P1] Pomiar konwersji — bez tego wszystko inne jest ślepe
**Fix:** w `src/layouts/Base.astro` dodać delegowany listener: klik w `a[href^="tel:"]` → `gtag('event','click_to_call')`, `a[href^="mailto:"]` → `gtag('event','click_to_email')`; w callbacku sukcesu formularza kontaktowego → `gtag('event','generate_lead')`. W GA4 Admin oznaczyć te 3 eventy jako key events.

### M2 [P1] Google Business Profile + cytowania NAP
Frazy lokalne („sklepy internetowe toruń", „strony internetowe toruń") mają nad wynikami organicznymi local pack — bez wizytówki GBP nie istniejesz w nim wcale, a przy poz. 16 organicznie to jedyna droga do widoczności w tygodnie, nie miesiące. **Fix:** założyć/zweryfikować GBP (kategoria „Projektowanie stron internetowych", adres Toruń), spójny NAP; wpisy: Oferteo (ich ranking „Programista Toruń" jest w top10), Panorama Firm, Aleo. To jednocześnie linki off-site z P1.

### M3 [P1] Doinwestować `/uslugi/sklepy-internetowe-torun/` — jedyną stronę z realnym wolumenem
Cel: poz. 16 → top 5–8 na „sklepy internetowe toruń" (407 impr./90 dni). **Fix:** (1) sekcja case studies z realnych sklepów (silniki-elektryczne.com.pl, sitario) ze screenami i wynikami; (2) proces + widełki cenowe; (3) FAQ z FAQPage schema; (4) sekcja „sklep B2B" (fraza „sklep b2b ecommerce toruń" już na 8,8); (5) linki wewnętrzne z wpisu allegro-api i sklep-bez-serwera z anchorem „sklepy internetowe Toruń"; (6) meta description z USP cenowym/czasowym zamiast ogólników.

### M4 [P2] Klaster LaTeX — ogólnopolska nisza, w której już jest poz. 1
„skład książki naukowej" poz. 1 pokazuje, że w tej niszy DA 8 wystarcza (brak konkurencji SEO). Klient niszowy, ale wysokomarżowy, targetowanie ogólnopolskie — nie ogranicza Cię Toruń. **Fix:** rozbudować `/uslugi/publikacje-latex/` + 3–4 wpisy BOFU: „skład książki naukowej — proces i cennik", „skład pracy doktorskiej w LaTeX", „Quarto vs LaTeX — co wybrać do publikacji", każdy linkuje do strony usługi.

### M5 [P2] Przeorientować blog z dev-tematów na treści komercyjne (BOFU/MOFU)
Nowe wpisy pod frazy transakcyjno-informacyjne po polsku: „ile kosztuje sklep internetowy [2026]", „ile kosztuje strona internetowa dla firmy", „migracja sklepu z WooCommerce", „integracja Allegro z własnym sklepem" (temat już łapie frazy!), „sklep internetowy bez abonamentu — ile realnie kosztuje utrzymanie". Każdy z CTA i linkiem do strony usługowej. Istniejące wpisy dev zostawić (E-E-A-T + widoczność w AI Assistant), ale nowa produkcja = tylko treści wspierające sprzedaż.

### M6 [P2] Bydgoszcz: wzmocnić albo skonsolidować
Dziś strona toruńska kanibalizuje frazy bydgoskie na poz. 24–97 — nic z tego nie będzie bez zmian. **Opcja A (jeśli Bydgoszcz to realny target):** unikalna treść na stronach bydgoskich (nie mutacja toruńskiej), linki wewnętrzne z anchorami bydgoskimi, GBP nie da się zdublować — więc cytowania lokalne bydgoskie. **Opcja B (jeśli nie):** 301 stron bydgoskich na toruńskie odpowiedniki i nie rozpraszać autorytetu. Decyzja biznesowa — na dziś strony bydgoskie to martwy balast.

### M7 [P3] Brand
„karol leszczyński" poz. 7,7–8,5 przy CTR 1,6% — wynik brandowy poza top3 to symptom słabego autorytetu encji. GBP + sameAs (X, LinkedIn) + spójne NAP z M2 adresują to przy okazji.

### M8 [P3] „copywriter toruń" (45 impr., poz. 19,5)
Decyzja: jeśli usługi copywritingu nadal są w ofercie — dedykowana sekcja/strona (fraza sama przyszła); jeśli nie — świadomie ignorować.

---

## Unverified — needs re-run
- GSC URL Inspection API na 13 niezaindeksowanych URL-ach — nie odpalone (dane coverage z `Page` table są z dziś 03:12, wystarczające); warto po deployu fixów.
- CrUX field data — brak (za mały ruch); wyniki perf są lab-only.

## Skipped — not applicable to this profile
- C11 Product/Offer schema, faceted nav, paginacja, out-of-stock — nie e-commerce.
- T16 hreflang — witryna jednojęzyczna.
- sitecrawl orphan analysis — 31 stron; graf zbadany przez homepage HTML + `Page.internalLinksIn` z prod DB.
- botlog crawl budget — hosting S3+CloudFront (brak logów nginx); przy 31 stronach crawl budget nie jest ograniczeniem.
- Mandatory Astro check: Consent Mode gating — **sprawdzony, nie występuje** (defaults `denied` ustawiane inline przed gtag.js w `Base.astro`); `Astro.redirect()` — brak użyć w kodzie stron statycznych; sitemap-slugs — nie dotyczy (@astrojs/sitemap generuje z routingu).

## Sequence of recommended actions
1. **Commit driftu**: `git add -A && git commit -m "blog: hero images + deploy.sh manual push"` (decyzja co do deploy.sh — patrz [WORKFLOW]).
2. **Kod**: trailing slash w hrefach (Header/Footer/LatestPosts/strony) + `trailingSlash: "always"`; sitemap filter na politykę prywatności; usunięcie dubla BreadcrumbList; alumniOf + sameAs w SEOHead; related-posts w BlogPost.astro.
3. **Fonty**: self-host przez @fontsource, usunąć `@import` z global.css, preload 2 woff2.
4. **Treść**: skrócić 14 tytułów blogowych do ≤45 zn. + title kontaktu.
5. **Deploy**: `./deploy.sh`, po nim commit (albo odwrotnie, zgodnie z decyzją z pkt 1).
6. **GSC**: Request Indexing 13 URL-i — max ~10/dzień, rozłożyć na 2 dni, zacząć od `/blog/` i `/projekty/`.
7. **Off-site**: podmiana targetów linków w stopkach matury-online/maturalnie na www; zmiana anchorów site-wide; założenie/uzupełnienie Google Business Profile + oferteo; dodać tracked keywords w seo-panelu.

## Appendix — verification commands
```bash
curl -sIL -A "Mozilla/5.0" https://karol-leszczynski.pl/            # 301 → www, 200
curl -sI  -A "Mozilla/5.0" https://www.karol-leszczynski.pl/kontakt # 301 (trailing slash)
D:/go-tools/urlcheck/urlcheck.exe -sitemap https://www.karol-leszczynski.pl/sitemap-index.xml -c 20 -rps 20 -dupes
# prod DB:
aws-ssh panel "sudo -u postgres psql -d seo_panel -A -F '|' -c \"SELECT path, \\\"coverageState\\\", \\\"internalLinksIn\\\" FROM \\\"Page\\\" WHERE \\\"domainId\\\"='karol01' ORDER BY impressions DESC;\" 2>/dev/null"
aws-ssh panel "sudo -u postgres psql -d seo_panel -A -F '|' -c \"SELECT \\\"sourceDomain\\\", count(*) FROM \\\"BacklinkSnapshot\\\" WHERE \\\"domainId\\\"='karol01' GROUP BY 1 ORDER BY 2 DESC;\" 2>/dev/null"
# PSI: cache JSON w D:/seo-panel/audits/cache/karol-leszczynski.pl/psi-*.json
```

## Appendix — crawl data
Pełny CSV: `D:\seo-panel\audits\cache\karol-leszczynski.pl-crawl-2026-08-05.csv` (31 wierszy; wszystkie 200, 0 redirectów, 1 noindex).
Tytuły >65 zn. (14): wszystkie `/blog/*` (86–163 zn.) — szczegóły w CSV, kolumna `title`.
