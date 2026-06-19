# SEO on-site audit — silnikitrojfazowe.pl
**Date:** 2026-05-27
**Profile:** A (static brochure/tool, ~8 indexable pages) + E overlay (satellite, anti-PBN-sensitive). Astro 5 static, 6 kalkulatorów + hub + o-projekcie.
**Stack:** Astro 5.17 static + React 19 islands + Tailwind 3, deploy S3 (`www.silnikitrojfazowe.pl`) + 2× CloudFront (`E3BR3RW4Z3BIJZ` www, `E4CXVU8RQ6TS3` apex-redirect), ACM cert multi-SAN.
**Repo↔prod state:** in-sync — `git status --short` empty, live `Last-Modified: 2026-05-27 12:03:31 GMT` matches commit `beda895` (today 14:01 local).
**Last crawl:** never (seo_panel cron not run yet — domain added today) | **GSC:** sitemap submitted 11:51 UTC, `isPending=True` | **GA4:** `properties/539285247` ACTIVE, `lastSync=NULL` (next cron 08:00 jutro)
**Pages:** 8 indexable (sitemap) + 3 noindex (`/kontakt/`, `/polityka-prywatnosci/`, `/404`) | **DA:** N/A (fresh) | **Last 28d GSC:** 0/0 (domena live od ~8h)

---

## ⚠ Data freshness caveats
- **GSC dane = brak**. Sitemap submitted dziś, Googlebot jeszcze nie crawlował. Findings dot. indeksacji nie są możliwe — odłożone do re-runu za ~14 dni.
- **GA4 `lastSync=NULL`** w `DomainIntegration`. Cron `ga4_sync` na `panel` chodzi codziennie 08:00 — pierwsza synchronizacja jutro rano. To nie jest błąd integracji (status ACTIVE), tylko brak okazji do pierwszego runu.
- **Lokalny DNS Karola** (router `funbox.home` / `192.168.1.1`) wciąż zwraca stary parking IP `185.253.212.22` — globalnie (8.8.8.8, 1.1.1.1) DNS wskazuje na CloudFront. Findings poniżej zostały zweryfikowane przez `curl --resolve` z bezpośrednim IP CloudFront (`13.227.146.37`).
- **PSI mobile uruchomione 1×** (key z `.env`, project `ageless-period-491209-s8`, quota OK). Field-data CrUX = brak (nowa domena, za mało ruchu).

---

## P0 — Critical (fix this week)

(brak — uruchomienie jest czyste pod względem critical issues; redirects, sitemap, robots, canonical, GA Consent Mode v2 zaimplementowane prawidłowo)

---

## P1 — High (fix this sprint)

### [LIVE] Mobile LCP/FCP poniżej progu Core Web Vitals — Google Fonts blokują render
**Where:** wszystkie 8 indeksowalnych stron. Najsilniej widoczne na home + `kalkulator-pradu-silnika-trojfazowego`.
**Evidence:** PSI mobile:
```
home    perf=79  LCP=4.2s (score 0.43)  FCP=3.2s (score 0.43)  CLS=0.002  TBT=0
calc    perf=76  LCP=4.1s (score 0.47)  FCP=3.8s (score 0.28)  CLS=0      TBT=0
home    desktop perf=99  LCP=0.8s
```
Próg Google CWV: LCP ≤ 2.5 s = "Good", > 4.0 s = "Poor". Obie strony mobile = Poor.

Root-cause w `src/layouts/Layout.astro:58-61`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```
Render-blocking external CSS request → trzeci RTT przed pierwszym paintem (DNS+TCP+TLS dla `fonts.googleapis.com`, potem fetch CSS, potem fetch WOFF2). Dlaczego TBT=0 i CLS≈0 jest dobre a LCP zły: skrypty są minimalne (1 React island, defer); szkodzi tylko font-CSS w head.

**Impact:** Mobile = 60% ruchu z polskiego SEO. LCP > 4s na pierwszym wejściu = -20 do -35% conversion (Google badania) + Core Web Vitals jako ranking signal. Świeża domena bez autorytetu nie ma marginesu na CWV penalty.
**Fix:** self-hostuj fonty zamiast Google Fonts CDN.
```bash
cd D:\silnikitrojfazowe.pl
npm install @fontsource/inter @fontsource/jetbrains-mono
```
W `src/layouts/Layout.astro`:
1. Usuń linie 56-61 (`preconnect` + `<link>` do Google Fonts).
2. Dodaj na początku `Layout.astro` (przed `<!DOCTYPE>`):
```js
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
```
Astro wbuduje to w bundle CSS — same origin, CloudFront, brak zewnętrznego RTT. Spodziewany LCP mobile po fixie: 1.5-2.0 s.

### [LIVE] Cross-link do `silniki-elektryczne.com.pl` na 10/10 stron jako dofollow — sprzeczność z brief'em + sygnał PBN dla Google
**Where:** stopka w `src/layouts/Layout.astro:150-152` renderuje się na każdej z 10 stron (sprawdzone `grep -l 'silniki-elektryczne' *.html` → wszystkie 10). Dodatkowo dwa inline-CTAs:
- `src/pages/index.astro:100` (sekcja "Bez nachalnej reklamy")
- `src/pages/o-projekcie.astro` (sekcja końcowa)
- `src/pages/kalkulator-pradu-silnika-trojfazowego.astro` — sprawdzone w live HTML, link jest

Wszystkie używają `<a rel="external">` — **bez `nofollow`, bez `sponsored`** — czyli pełen przepływ PageRank.

**Evidence:** `grep -l 'silniki-elektryczne' /tmp/silniki-audit/*.html` → 10 plików.
Wszystkie linki:
```html
<a href="https://silniki-elektryczne.com.pl" rel="external" class="text-accent hover:underline">
```
**Impact:** Brief `D:\silnikitrojfazowe.pl\brief.md:21-22` mówi explicite: *"Jeden, dyskretny CTA do sklepu (stopka + sekcja 'o projekcie'), nie spamersko"*. Live = link site-wide w stopce + 3 dodatkowe w treści, wszystkie dofollow. Dwa problemy:
1. Świeża domena (zarejestrowana ~tydzień temu) + 10 dofollow cross-linków na money site w tej samej niszy + **identyczne brzmienie domeny** (`silnikitrojfazowe.pl` vs `silniki-trojfazowe.pl`) — to klasyczny pattern PBN, na który Google ma Manual Action "Unnatural links to your site" w kierunku money-site.
2. Sprzeczność z zadeklarowaną strategią (brief, sekcja anty-PBN).

**Fix:** dwa skoki ostrożności.
1. **Zmień `rel`** w `Layout.astro:151`:
```html
<a href="https://silniki-elektryczne.com.pl" rel="external nofollow noopener" class="text-accent hover:underline">silniki-elektryczne.com.pl</a>
```
i analogicznie w `src/pages/index.astro:100`, `src/pages/o-projekcie.astro` (sekcja końcowa), `src/pages/kalkulator-pradu-silnika-trojfazowego.astro`.
2. **Rozważ usunięcie footer-CTA** — zostaw tylko `/o-projekcie/` jako jedyny CTA, zgodnie z brief'em. Edytuj `src/layouts/Layout.astro:149-152` i wytnij `<div class="mt-5 text-[11px] text-ink-400 ...">` cały blok. Footer staje się jeden-CTA-less; "discreet" znaczy dosłownie jeden punkt kontaktu, nie 10.

Jeśli SEO-strategy intencjonalnie chce zostawić dofollow do money-site (passowanie autorytetu jest celem), to trzeba przyjąć ryzyko detekcji — ale wtedy `nofollow` na 9/10 i jeden dofollow z `/o-projekcie/` jest bezpieczniejszym kompromisem niż 10× dofollow.

---

## P2 — Medium (fix when capacity allows)

### [LIVE] Title > 65 znaków na 4 stronach — SERP truncation
**Where:** zmierzone długości tytułów (live HTML):
| Strona | Tytuł (znaki) |
|---|---|
| `/` | 87 |
| `/dobor-zabezpieczen-silnika/` | 87 |
| `/kalkulator-pradu-silnika-trojfazowego/` | 82 |
| `/polaczenie-gwiazda-trojkat/` | 81 |

**Evidence:**
```
home:  "Kalkulatory silników trójfazowych — narzędzia inżynierskie | silnikitrojfazowe.pl"  (87)
dobor: "Dobór zabezpieczenia silnika trójfazowego — MCB, bezpiecznik, wyłącznik silnikowy"  (87)
prad:  "Kalkulator prądu znamionowego silnika trójfazowego (I = P / √3·U·cos φ·η)"  (82)
gw-tr: "Połączenie gwiazda / trójkąt (Y / Δ) — kalkulator i wybór dla sieci 400 V"  (81)
```
Google obcina tytuły zwykle ok. 580-600 px na desktop ≈ 55-65 znaków (zależnie od proporcji literek). Wszystkie 4 powyższe zostaną w SERPie obcięte z trzykropkiem.
**Impact:** zmniejszone CTR (4-15% strat per query w zależności od ile kluczowego słowa zostaje obcięte). Dla świeżej domeny, gdzie CTR z pierwszej strony decyduje o szansie na utrzymanie pozycji, to istotne.
**Fix:** skróć tytuły do ≤ 60 znaków. Konkretne propozycje:
- `src/pages/index.astro:50`:
  ```
  - "Kalkulatory silników trójfazowych — narzędzia inżynierskie | silnikitrojfazowe.pl"
  + "Kalkulatory silników trójfazowych — narzędzia inżynierskie"  (60)
  ```
- `src/pages/dobor-zabezpieczen-silnika.astro` (title prop):
  ```
  - "Dobór zabezpieczenia silnika trójfazowego — MCB, bezpiecznik, wyłącznik silnikowy"
  + "Dobór MCB i wyłącznika dla silnika trójfazowego"  (49)
  ```
- `src/pages/kalkulator-pradu-silnika-trojfazowego.astro:9`:
  ```
  - "Kalkulator prądu znamionowego silnika trójfazowego (I = P / √3·U·cos φ·η)"
  + "Kalkulator prądu znamionowego silnika trójfazowego"  (51)
  ```
  Wzór w nawiasie sprzeda się i tak w `<h1>` + opisie — w title obniża CTR (cosφ-η wygląda dziwnie w SERPie).
- `src/pages/polaczenie-gwiazda-trojkat.astro` (title prop):
  ```
  - "Połączenie gwiazda / trójkąt (Y / Δ) — kalkulator i wybór dla sieci 400 V"
  + "Połączenie gwiazda / trójkąt — kalkulator dla 400 V"  (53)
  ```

### [LIVE] Meta description home = 184 znaków, SERP truncates ~155
**Where:** `src/pages/index.astro:51`.
**Evidence:**
```
"Sześć kalkulatorów inżynierskich dla silników 3-fazowych: prąd znamionowy, moment obrotowy, obroty, połączenie Y/Δ, dobór zabezpieczeń, kW/KM/HP. Wzory, normy, ograniczenia."
```
184 znaków. Google zwykle pokazuje ~155-160 na desktop, 130 mobile.
**Impact:** ostatnie ważne frazy ("Wzory, normy, ograniczenia") znikną.
**Fix:**
```diff
- "Sześć kalkulatorów inżynierskich dla silników 3-fazowych: prąd znamionowy, moment obrotowy, obroty, połączenie Y/Δ, dobór zabezpieczeń, kW/KM/HP. Wzory, normy, ograniczenia."
+ "Sześć kalkulatorów dla silników 3-fazowych: prąd znamionowy, moment obrotowy, obroty, gwiazda/trójkąt, dobór zabezpieczeń, kW/KM/HP. Wzory + normy PN-EN."
```
(146 znaków, mieści PN-EN który jest mocniejszym sygnałem niż "ograniczenia").

### [LIVE] JSON-LD only `WebSite` na wszystkich 10 stronach — brak schematu specyficznego dla strony
**Where:** `src/layouts/Layout.astro:63-74` — jedyny blok JSON-LD. Renderuje `WebSite` z `publisher: Organization` na każdym `/`, `/kalkulator-*/`, `/o-projekcie/`, `/kontakt/`, `/polityka-prywatnosci/`.
**Evidence:** Python parser na 10 plików HTML:
```
home:    @type=WebSite (publisher=Organization wewnątrz)
prad:    @type=WebSite (ten sam blok)
moment:  @type=WebSite
obroty:  @type=WebSite
y-d:     @type=WebSite
zabez:   @type=WebSite
kw-km:   @type=WebSite
...
```
Wszystkie poprawnie się parsują, ale zawsze tylko WebSite. Brakuje:
1. `Organization` jako osobny blok na home (zamiast jako nested publisher — zwiększa szansę na Knowledge Graph entry).
2. `SoftwareApplication` lub `HowTo` na stronach kalkulatorów — dają rich results "Calculator" lub step-by-step w SERP.
3. `BreadcrumbList` w ogóle nie istnieje, mimo że strony mają fizycznie ślad chleba w treści (np. `kalkulator-pradu`: `/ kalkulatory / prąd znamionowy`).
4. `FAQPage` na stronach kalkulatorów — sekcje "Do czego potrzebujesz tej wartości" + "Limitations" się do tego nadają.

**Impact:** Każdy z brakujących typów = potencjalna utrata rich-result feature w SERPie (breadcrumbs widoczne pod tytułem, "free tool" sticker, FAQ accordion). Dla świeżej satelitki, gdzie naturalny ranking jest słaby, rich results to jedyna realna szansa wybicia się ponad mock-content w niszy.

**Fix:** dodaj per-page slot na JSON-LD w `Layout.astro` (`<slot name="head" />` już istnieje na linii 78) i każda strona definiuje własny blok. Przykład minimum dla `src/pages/kalkulator-pradu-silnika-trojfazowego.astro` (dodać na koniec frontmatter `---` i pod `<Layout ...>`):
```astro
<script
  slot="head"
  type="application/ld+json"
  set:html={JSON.stringify({
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "Jak obliczyć prąd znamionowy silnika trójfazowego",
    "description": "Wzór, oznaczenia, przykład 7.5 kW.",
    "totalTime": "PT1M",
    "step": [
      { "@type": "HowToStep", "name": "Odczytaj P, U, cosφ, η z tabliczki silnika" },
      { "@type": "HowToStep", "name": "Podstaw do wzoru I = P / (√3·U·cosφ·η)" },
      { "@type": "HowToStep", "name": "Wynik podaj w amperach" }
    ]
  })}
/>
```
Dla home: dodać `Organization` z `@id` jako kanoniczna referencja, `WebSite` ze `SearchAction` jeśli wprowadzasz potem search. Dla breadcrumbs: jeden `BreadcrumbList` na każdej calc-page (parent = home, current = calc-name).

### [LIVE] HSTS header brak
**Where:** CloudFront response headers (sprawdzone na home + sitemap-index).
**Evidence:**
```
curl -sI ... | grep -iE "strict-transport|x-content|referrer-policy|x-frame|permissions-policy|content-security"
(none found)
```
**Impact:** użytkownik wpisujący `silnikitrojfazowe.pl` bez `https://` dostaje 301 → https, ale przy MITM atak na pierwszym requeście może być przechwycony. Również Lighthouse "Best Practices" odejmuje punkty.
**Fix:** w AWS Console → CloudFront → Distribution `E3BR3RW4Z3BIJZ` (www) → Behaviors → Default → Response headers policy → przypisz built-in policy `Managed-SecurityHeadersPolicy` (Amazon-managed, zawiera HSTS `max-age=31536000`, X-Content-Type-Options, X-Frame-Options, Referrer-Policy). To samo dla `E4CXVU8RQ6TS3` (apex-redirect).

CLI:
```powershell
aws cloudfront get-distribution-config --id E3BR3RW4Z3BIJZ --output json > cf-config.json
# edytuj cf-config.json: DefaultCacheBehavior.ResponseHeadersPolicyId = "67f7725c-6f97-4210-82d7-5512b31e9d03"  (Managed-SecurityHeadersPolicy)
# zapisz ETag z odpowiedzi, potem:
aws cloudfront update-distribution --id E3BR3RW4Z3BIJZ --distribution-config file://cf-config.json --if-match <ETag>
```
Po 5-10 min `curl -sI` powinien pokazać `strict-transport-security: max-age=31536000`.

---

## P3 — Polish (backlog)

### [WORKFLOW] `DomainIntegration.lastSync = NULL` mimo `status=ACTIVE`
**Where:** prod `seo_panel.DomainIntegration` row dla `domainId=cmc18ab1bfad1defcc422aa5`, provider `GOOGLE_ANALYTICS`.
**Evidence:**
```
domain=www.silnikitrojfazowe.pl  category=SATELLITE  totalPages=0  indexedPages=0
                                  totalClicks=0  lastCrawl=NULL  lastGscPull=NULL
                                  propertyId=properties/539285247  ga_status=ACTIVE  ga_sync=NULL
```
**Impact:** żaden — totalClicks=0 (domena świeża), cron `ga4_sync` ma pierwszą okazję jutro 08:00. Jeśli za 24h `ga_sync` wciąż NULL, to znaczy że cron pominął integrację (możliwe race z momentem dodania row do bazy). Per skill rule 12 — odnotowane do re-checku jutro.
**Fix:** brak — sprawdzić jutro po południu `SELECT "lastSync" FROM "DomainIntegration" WHERE "domainId"='cmc18ab1bfad1defcc422aa5'`. Jeśli wciąż NULL — w `panel` VPS `pm2 logs ga4-sync` zobaczyć czemu pomijał.

### [LIVE] Brak `noopener` na zewnętrznym linku do `silniki-elektryczne.com.pl`
**Where:** `src/layouts/Layout.astro:151` (i 3 inline).
**Evidence:** `<a href="https://silniki-elektryczne.com.pl" rel="external">` — bez `target="_blank"`, więc tabnabbing nie wchodzi w grę. `noopener` formalnie niepotrzebny, ale jeśli kiedyś dodasz `target="_blank"` — zapomnisz. Już w P1 fix powyżej proponuję dodać `rel="external nofollow noopener"`.
**Fix:** part of P1 fix.

---

## Unverified — needs re-run
- **I1 indexation status** — sitemap submitted dziś, Googlebot crawluje 2-7 dni, agregacja w GSC ~14 dni. Re-run 2026-06-10.
- **I3-I6 (Crawled-not-indexed clustering, deindex events, top-CTR queries)** — wymagają min. 14 dni danych w GSC. Re-run 2026-06-10.
- **L1 orphan analysis** — `Page` table w prod `seo_panel` ma 0 rows dla tego domena (`totalPages=0`). Po pierwszym crawl `detect_changes` (09:00) będzie można sprawdzić.
- **Field-data CrUX** — `loadingExperience.overall_category=null` w PSI dla obu URL (brak ruchu rzeczywistych użytkowników). Wymaga 28-dniowego okna z minimalną próbką. Re-run za 30 dni.

## Skipped — not applicable to this profile
- **C7 word count >300** — strony narzędziowe; każdy kalkulator ma >500 słów wyprowadzeń+ograniczeń (sprawdzone wzrokowo w `src/pages/kalkulator-pradu-silnika-trojfazowego.astro`), nie ma sensu auditować ilościowo.
- **C8-C10 image checks** — site ma 0 `<img>` tagów (wszystkie grafiki to inline SVG, og-default.png ładowany tylko jako meta). Nie do auditu.
- **C11/C12 product schema, BreadcrumbList per-page** — częściowo skipped jako "nie e-commerce", częściowo wzięte do P2 (BreadcrumbList tam wskazany jako opportunity).
- **L1-L6 internal-link graph** — 8-stronicowy site, każda strona linkuje do wszystkich pozostałych przez nav+footer (sprawdzone: 19-25 internal links per page). Graf trywialny, brak orphan-page risk.
- **C15 over-optimized anchor text** — wszystkie internal anchors są naturalne ("Prąd znamionowy", "Moment obrotowy" itd. = nazwy kalkulatorów, nie keyword-stuffed). Nie do auditu.
- **C16 search-intent mismatch** — wymagałoby GSC clicks, których brak. Re-run za 30 dni.
- **T21-T23 (AWS infra-as-SEO)** — LAUNCH-REPORT pokazuje wszystkie komponenty (Route53, CloudFront, S3, ACM) skonfigurowane prawidłowo + sprawdzone live; HSTS osobno w P2.
- **Astro mandatory check: CookieBanner Consent Mode gating** — przeanalizowano `src/components/Analytics.astro:5-46` + `src/components/CookieConsent.astro:22-45`. **PASSED**: `gtag('consent','default', {analytics_storage:'denied'})` ładuje się w `<head>` synchronicznie + `<script async src="…gtag/js…">` ładuje się BEZWARUNKOWO (jeszcze przed decyzją bannera). To jest poprawny pattern Consent Mode v2 — odwrotność bug'a z sklad-tekstu.pl / ecopywriting.pl. Bez findings.
- **Astro mandatory check: `Astro.redirect()` status code** — grep `redirect\(` w `src/pages/**.astro` → brak użyć. Site całkowicie statyczny, brak redirectów w runtime. Nie do auditu.
- **Astro mandatory check: sitemap-slugs coverage** — sitemap jest auto-generowany przez `@astrojs/sitemap` z `getStaticPaths` (zerowy w tym projekcie, bo wszystkie strony to statyczne pliki w `src/pages/`). Wszystkie 8 indeksowalnych URL z `src/pages/` są w `sitemap-0.xml` (sprawdzone byte-for-byte). Bez findings.

---

## Sequence of recommended actions

### Tym tygodniu (P1)
1. **Self-host fonty Inter + JetBrains Mono.**
   ```bash
   cd D:\silnikitrojfazowe.pl
   npm install @fontsource/inter @fontsource/jetbrains-mono
   ```
   Edytuj `src/layouts/Layout.astro`: usuń linie 56-61, dodaj `import "@fontsource/inter/400.css"` itd. w frontmatter.
   ```bash
   npm run build && ./deploy.sh
   ```
2. **Dodaj `rel="nofollow"`** do wszystkich 4 wystąpień linku `silniki-elektryczne.com.pl` (1× w `Layout.astro:151` + 3× w pages). Rozważ usunięcie footer-CTA całkowicie.
3. **Re-run PSI** po deployu fixów 1-2 (powinien dać >90 mobile zamiast 79).

### Tym sprintem (P2)
4. **Skróć titles** na 4 wymienionych stronach do ≤60 znaków (Title finding).
5. **Skróć meta description** na home do ~150 znaków.
6. **Dodaj JSON-LD `BreadcrumbList`** w każdej kalkulator-page (3 minut roboty per page) — najprostszy szybki win na rich-results.
7. **Włącz CloudFront `Managed-SecurityHeadersPolicy`** na obu dystrybucjach (HSTS + reszta jednym ruchem).

### Później (po pierwszej fali GSC danych — za 14 dni)
8. **Re-audyt 2026-06-10**: indexation status (I1), Crawled-not-indexed (I3), top-CTR opportunities (I6), search-intent mismatch (C16). Jeśli któryś z 8 URLi nie został zaindeksowany → GSC URL Inspection → Request Indexing (limit ~10/dzień, więc jednorazowo OK).
9. **Re-audyt 2026-06-27** (30 dni): CrUX field-data dla LCP/CLS/INP, GA4 sessions/conversions.

### Anty-PBN long-term (per brief)
10. **Trzymaj się brief'u**: NIE linkuj z `silniki-elektryczne.com.pl` ani z `silniki-trojfazowe.pl` → `silnikitrojfazowe.pl` przez najbliższe 2-3 miesiące. Niech naturalne wzmianki na elektroda.pl / Facebook-grupy elektryków rozwiążą profil linkowy.

---

## Appendix — exact verification commands used

```bash
# Wszystkie HTTP probes szły przez --resolve, bo lokalny DNS (router) wciąż cache'uje
# stary parking IP 185.253.212.22. Public DNS (8.8.8.8) ma już CloudFront.
RESOLVE="--resolve www.silnikitrojfazowe.pl:443:13.227.146.37 \
         --resolve silnikitrojfazowe.pl:443:13.227.146.37 \
         --resolve www.silnikitrojfazowe.pl:80:13.227.146.37"

# T1-T2-T3 redirects
curl -sIL -A "Mozilla/5.0" $RESOLVE "https://silnikitrojfazowe.pl/"
curl -sIL -A "Mozilla/5.0" $RESOLVE "http://www.silnikitrojfazowe.pl/"

# T5-T8 robots + sitemap
curl -s $RESOLVE "https://www.silnikitrojfazowe.pl/robots.txt"
curl -s $RESOLVE "https://www.silnikitrojfazowe.pl/sitemap-index.xml"
curl -s $RESOLVE "https://www.silnikitrojfazowe.pl/sitemap-0.xml"

# T14 canonical, T19 HSTS
curl -sI -A "Mozilla/5.0" $RESOLVE "https://www.silnikitrojfazowe.pl/" \
  | grep -iE "strict-transport|x-content|referrer-policy"

# 404 behavior
curl -sI $RESOLVE "https://www.silnikitrojfazowe.pl/this-does-not-exist-xyz/"

# DB row (prod, panel)
sudo -u postgres psql -d seo_panel -c "
SELECT d.*, di.\"propertyId\", di.status, di.\"lastSync\"
FROM \"Domain\" d
LEFT JOIN \"DomainIntegration\" di ON di.\"domainId\"=d.id AND di.provider='GOOGLE_ANALYTICS'
WHERE d.domain ILIKE '%silnikitrojfazowe%';"

# PSI (key z .env, project ageless-period-491209-s8)
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fwww.silnikitrojfazowe.pl%2F&strategy=mobile&category=performance&category=seo&key=$PSI_API_KEY"
```

## Appendix — full pages list (na potrzeby re-runu)

| URL | Indexable | H1 | Title chars | Meta chars |
|---|---|---|---|---|
| `/` | yes | 1 | 87 ⚠ | 184 ⚠ |
| `/kalkulator-pradu-silnika-trojfazowego/` | yes | 1 | 82 ⚠ | 145 |
| `/kalkulator-momentu-obrotowego/` | yes | 1 | 57 | 101 |
| `/kalkulator-obrotow-silnika/` | yes | 1 | 69 | 136 |
| `/polaczenie-gwiazda-trojkat/` | yes | 1 | 81 ⚠ | 127 |
| `/dobor-zabezpieczen-silnika/` | yes | 1 | 87 ⚠ | 150 |
| `/przelicznik-kw-km-hp/` | yes | 1 | 69 | 129 |
| `/o-projekcie/` | yes | 1 | 36 | 90 |
| `/kontakt/` | no (noindex) | 1 | 32 | 58 |
| `/polityka-prywatnosci/` | no (noindex) | 1 | 46 | 50 |
| `/404` | no (404 status) | n/a | n/a | n/a |
