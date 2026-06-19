# SEO on-site audit — magisterki.pl
**Date:** 2026-06-06
**Profile:** B — content hub (blog 7 artykułów) pełniący rolę funnel do smart-edu.ai; statyczny, kilka stron + blog, intencja informacyjno-decyzyjna.
**Stack:** Astro v5.18.2 (output: static), Tailwind 4, deploy AWS S3 + CloudFront (FRA), własny system ikon SVG.
**Repo↔prod state:** in-sync — `git status` czysty, HEAD = `3c176c2`, live `Last-Modified` 2026-06-06 17:45 = świeży build z dzisiejszych commitów. Brak kodowego driftu. (Jedyny wyjątek: `_commit.txt` nieobecny na prodzie — patrz P3 WORKFLOW.)
**Last crawl / GSC / GA4:** N/A — świeża domena, analiza GSC/GA/Moz pominięta na życzenie.
**Pages:** 13 stron w buildzie, 12 w sitemapie (polityka noindex słusznie wykluczona).

Audyt pomija indeksację, ruch i dane behawioralne (brak historii — domena świeża). Zakres: technika on-site, CWV (PSI lab), struktura on-page, schema, linkowanie wychodzące.

---

## ⚠ Data freshness caveats
- **CWV = tylko dane laboratoryjne PSI (Lighthouse), nie field/CrUX.** Domena nie ma jeszcze ruchu, więc CrUX jest pusty — CLS/LCP poniżej to pomiar lab mobile, nie realni użytkownicy. Traktować jako sygnał wczesny, nie jako ranking-impact (ten przyjdzie z ruchem).

---

## P0 — Critical
Brak. Technicznie strona jest czysto postawiona (200, 301 apex→www, HSTS, security headers, sitemap, robots, canonical z `href`+URL, JSON-LD waliduje, 404 zwraca realny 404, brak placeholderów w treści indeksowanej, brak noindex na stronach pieniężnych).

---

## P1 — High (fix this sprint)

### [LIVE] CLS w strefie „needs improvement" na każdej stronie (wspólna przyczyna)
**Where:** cała witryna — pomiar na `/` (CLS 0.158) i `/blog/metodologia-pracy-magisterskiej/` (CLS 0.163). Spójność wartości na dwóch różnych typach stron ⇒ przyczyna w elemencie współdzielonym (layout/fonty), nie w treści pojedynczej strony.
**Evidence:** PSI mobile 2026-06-06: `/` → perf 85, **CLS 0.158**, LCP 2.7 s, TBT 10 ms; artykuł → perf 90, **CLS 0.163**, LCP 2.5 s. Próg „good" CLS = ≤0.10; obie strony w 0.10–0.25 (needs improvement). Render-blocking resources = 0 (CSS inline'owany — to dobrze), więc CLS nie pochodzi z blokującego CSS.
**Impact:** Core Web Vitals — gdy domena zacznie zbierać ruch, CLS >0.1 obniża „good URLs" w GSC i pogarsza UX na CTA funnela (przeskok layoutu pod palcem = mylne kliknięcia). Tania do usunięcia teraz, droższa po ruchu.
**Leading hypothesis (do potwierdzenia):** swap fontów webowych. `BaseLayout.astro:55-61` ładuje Inter + Source Serif 4 wzorcem `media="print"` → `onload="this.media='all'"` (FOUT) — gdy fonty wskakują, tekst reflowuje. PSI w tym przebiegu nie zwrócił `layout-shift-elements` (null node), więc element nie jest potwierdzony bajt-w-bajt — przed wdrożeniem zweryfikować w DevTools (Performance → Layout Shift) lub ponownym PSI z `layout-shift-elements`.
**Fix:**
1. Dodać fallback z dopasowaną metryką w `src/styles/global.css`, by swap nie zmieniał wysokości linii:
   ```css
   @font-face { font-family: "Inter Fallback"; src: local("Arial");
     size-adjust: 107%; ascent-override: 90%; descent-override: 22%; line-gap-override: 0%; }
   /* analogicznie "Source Serif 4 Fallback" oparty o local("Georgia") */
   ```
   i ustawić `font-family: "Inter", "Inter Fallback", system-ui, sans-serif` (oraz wariant serif dla `.prose`).
2. Preload głównego subsetu Inter (`woff2`, `font-display: swap`) zamiast całego CSS Google Fonts, by skrócić okno FOUT.
3. Re-run PSI po wdrożeniu — cel CLS <0.10 na `/` i artykule.

---

## P2 — Medium (fix when capacity allows)

### [LIVE] Placeholdery prawne renderują się na żywo w polityce prywatności
**Where:** `https://www.magisterki.pl/polityka-prywatnosci/` — w HTML widoczne `ADMIN_NAME_PLACEHOLDER`, `ADMIN_ADDRESS_PLACEHOLDER`, `NIP_PLACEHOLDER` (źródło: `src/config/site.ts:25-30`, `legal.*`).
**Evidence:** `grep -c PLACEHOLDER dist/polityka-prywatnosci/index.html` → 2 (uppercase) + 3 lowercase wystąpienia tekstu; strona ma `<meta name="robots" content="noindex, nofollow">` (słusznie — dlatego to NIE problem indeksacyjny SEO).
**Impact:** niski SEO (strona noindex, poza sitemapą), ale **prawny/RODO + zaufanie** — administrator danych bez nazwy/NIP/adresu to brak wymaganej informacji RODO; widoczny „PLACEHOLDER" obniża wiarygodność. Już oznaczone jako TODO w `LAUNCH-REPORT.md`.
**Fix:** uzupełnić `src/config/site.ts` `legal.adminName / adminAddress / adminNip` realnymi danymi administratora i przebudować/deploy. Jeśli administratorem jest działalność Karola — wstawić nazwę firmy + NIP + adres rejestrowy.

### [LIVE] LCP strony głównej 2.7 s — tuż nad progiem „good"
**Where:** `/` (mobile). LCP 2.7 s; próg „good" ≤2.5 s (artykuł 2.5 s — na granicy).
**Evidence:** PSI mobile 2026-06-06, home perf 85 głównie przez LCP + CLS.
**Impact:** ten sam efekt CWV co wyżej; częściowo zniknie po naprawie FOUT (font swap opóźnia render tekstu LCP).
**Fix:** element LCP to prawdopodobnie nagłówek/hero w pierwszym ekranie — po wdrożeniu P1 (preload fontu, fallback) ponownie zmierzyć; jeśli LCP nadal >2.5 s, sprawdzić `HeroIllustration.astro` (czy element ma zarezerwowane wymiary / czy nie czeka na font).

---

## P3 — Polish (backlog)

### [LIVE/CONTENT] Meta description strony głównej za długa (181 znaków)
**Where:** `/` — `src/config/site.ts:20` (`description`), 181 znaków.
**Evidence:** Google ucina ~155–160 znaków na mobile; ogon „— i co zrobić, gdy goni termin" (najbardziej chwytliwy hook funnela) zostanie ucięty w SERP.
**Fix:** skrócić do ≤155 zn., np.: „Studencki przewodnik po pisaniu magisterki: temat, spis treści, metodologia, harmonogram i obrona. Konkretnie — i co zrobić, gdy goni termin." (~140 zn.).

### [LIVE] Title strony głównej 75 znaków — możliwe ucięcie brandu w SERP
**Where:** `/` — „Jak ogarnąć magisterkę — studencki przewodnik krok po kroku | Magisterki.pl" (75 zn.).
**Evidence:** Google renderuje ~580 px (~60 zn.); sufiks „ | Magisterki.pl" może zostać ucięty. Najważniejsze słowa są z przodu, więc impact niski.
**Fix (opcjonalnie):** skrócić do ~60 zn., np. „Jak ogarnąć magisterkę krok po kroku | Magisterki.pl".

### [WORKFLOW] `_commit.txt` zwraca 404 — manifest weryfikacji deployu nieobecny na prodzie
**Where:** `https://www.magisterki.pl/_commit.txt` → HTTP 404.
**Evidence:** `deploy.sh` generuje `dist/_commit.txt` i syncuje go (`--include "_commit.txt"`), ale na prodzie go nie ma ⇒ ostatni deploy poszedł **nie przez `deploy.sh`** (ręczny `aws s3 sync` lub GitHub Actions, który tego pliku nie tworzy). Skutek: szybka weryfikacja driftu `curl .../_commit.txt` nie działa.
**Fix:** deployować przez `./deploy.sh`, albo dodać krok zapisu `_commit.txt` do GitHub Actions, żeby `curl _commit.txt` zwracał `short=<sha>` zgodny z `git rev-parse --short HEAD`.

### [CONTENT] Autor artykułów to `Organization`, nie `Person` (sygnał EAT)
**Where:** JSON-LD `BlogPosting.author` = `{"@type":"Organization","name":"Redakcja magisterki.pl"}` na wszystkich postach.
**Evidence:** np. `dist/blog/metodologia-pracy-magisterskiej/index.html`.
**Impact:** dla treści doradczej (YMYL-adjacent: prawo, dyplomy) autor-osoba z bio wzmacnia EAT. Świadomy wybór (brand blog) jest akceptowalny — to tylko niewykorzystana szansa, nie błąd.
**Fix (opcjonalnie):** jeśli powstanie realna osoba-redaktor, zmienić na `Person` z `url` do strony autora; inaczej zostawić Organization.

---

## Unverified — needs re-run
- **Element CLS** — PSI w tym przebiegu zwrócił `layout-shift-elements` z pustym node; przyczyna (font swap) jest wiodącą hipotezą, nie potwierdzeniem bajtowym. Zweryfikować w Chrome DevTools (Performance → Layout Shifts) lub ponownym PSI przed/po wdrożeniu fixu P1.
- **Field CWV (CrUX)** — niedostępne: domena bez ruchu. Re-run za ~28 dni od pierwszego ruchu.

## Skipped — not applicable to this profile
- **GSC/GA/Moz (I1–I6, tail signals, DA/PA)** — pominięte na wyraźne życzenie (świeża domena, brak danych).
- **C – product schema / faceted search / pagination / out-of-stock (Profile C)** — nie e-commerce, brak katalogu produktów.
- **L1 orphan / L2 dead-end (analiza grafu linków)** — 13 stron, trywialny graf; każda strona linkowana z nav/blog index.
- **T16 hreflang** — witryna jednojęzyczna (pl), brak wersji językowych.
- **C8–C10 img alt / lazy / oversize** — strona główna ma 0 `<img>` (grafiki to inline SVG); brak rastrowych obrazów do audytu poza `og-image.jpg`.

---

## Sequence of recommended actions
1. **(P2 prawne)** Uzupełnić `src/config/site.ts` `legal.*` realnymi danymi administratora (RODO).
2. **(P1 CWV)** Dodać fallback-fonty z `size-adjust`/override metrics + preload Inter w `global.css` / `BaseLayout.astro`; zweryfikować CLS w DevTools.
3. **(P3 copy)** Skrócić home meta description do ≤155 zn. (i opcjonalnie title do ~60 zn.) w `src/config/site.ts`.
4. **Deploy przez `./deploy.sh`** (naprawia też P3 `_commit.txt`); po deployu re-run PSI na `/` + 1 artykuł, cel CLS <0.10, LCP <2.5 s.

---

## Appendix — verification commands
```bash
# Redirecty
curl -sIL -A "Mozilla/5.0" "http://magisterki.pl/"     # 301→https apex →301→www →200
curl -sIL -A "Mozilla/5.0" "https://magisterki.pl/"    # 301→www →200
# Sitemap + robots
curl -s "https://www.magisterki.pl/sitemap-index.xml"  # → sitemap-0.xml (12 URL)
curl -s "https://www.magisterki.pl/robots.txt"
# Placeholdery prawne
grep -c PLACEHOLDER dist/polityka-prywatnosci/index.html
# _commit.txt
curl -s -o /dev/null -w "%{http_code}" "https://www.magisterki.pl/_commit.txt"   # 404
```
```powershell
# PSI mobile (klucz z .env, nie echować)
$key = (gc "$HOME\.claude\skills\seo-audit-onsite\.env" | ? {$_ -match '^PSI_API_KEY='} | %{($_ -split '=',2)[1].Trim()})
$enc = [uri]::EscapeDataString("https://www.magisterki.pl/")
Invoke-RestMethod "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=$enc&strategy=mobile&category=performance&category=seo&key=$key"
# → perf 85, seo 100, LCP 2.7s, CLS 0.158, TBT 10ms
```
