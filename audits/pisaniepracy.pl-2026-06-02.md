# SEO on-site audit — pisaniepracy.pl
**Date:** 2026-06-02
**Profile:** B — content hub / blog (Astro static, 13 indeksowalnych URL, hub wiedzy o pisaniu pracy dyplomowej, blog jako rdzeń, brak sklepu/formularza).
**Stack:** Astro 5 + Tailwind 4, `output: "static"`, deploy S3 + CloudFront (potwierdzone nagłówkami `Server: AmazonS3` / `Via: cloudfront`).
**Repo↔prod state:** in-sync — `git status` czysty, live `Last-Modified: 2026-06-02 20:11` ≈ ostatni commit z dziś, `dist/` w `.gitignore`. Brak driftu.
**Last crawl / GSC / GA4:** pominięte — świeża domena, brak danych historycznych (zgodnie z poleceniem).
**Pages:** 13 w sitemap (1 home + 8 artykułów + 3 kategorie + /blog), 0 z historią indeksacji (nowa domena).

> **Uwaga do polecenia:** prośba „na pewno trzeba będzie dodać og image" — **już zrobione i działa**. `public/og-image.jpg` istnieje (JPEG 1200×630, 32 KB), `BaseLayout.astro:35-37` buduje absolutny URL, live HTML zwraca `og:image content="https://www.pisaniepracy.pl/og-image.jpg"` + `twitter:image`. To NIE jest finding. Reszta meta (canonical, robots, OG, Twitter Card) też poprawna.

---

## Stan ogólny (kontekst, nie findingi)

Strona jest zbudowana solidnie. Rzeczy, które **działają i celowo NIE są poniżej** (zgodnie z zasadą findings-only): poprawny `apex → www` 301, prawdziwe HTTP 404 na nieistniejących URL (nie soft-404 — `CustomErrorResponses` w CF skonfigurowane), Consent Mode v2 zaimplementowany **poprawnie** (defaults `denied` deklarowane PRZED `gtag.js`, brak buga consent-gatingu znanego z innych domen), sitemap waliduje się i ma 13 absolutnych URL, każda strona ma dokładnie 1 `<h1>`, zero `<img>` bez `alt`, PSI mobile **PERF 0.98 / SEO 1.0** (LCP 1.7 s, CLS 0.065, TBT 70 ms). Performance i Core Web Vitals — bez uwag.

---

## P1 — High (zrób w tym sprincie)

### [LIVE] Tytuł strony głównej to sam brand — zero słów kluczowych
**Where:** `src/pages/index.astro:88` → renderowane przez `src/layouts/BaseLayout.astro:34`
**Evidence:**
```
index.astro:88  <BaseLayout title={siteConfig.name} description={siteConfig.description} ...>
BaseLayout:34   const fullTitle = title === siteName ? title : `${title} | ${siteName}`;
```
Ponieważ `title` = `siteConfig.name` = `"Pisaniepracy.pl"`, warunek `title === siteName` jest prawdziwy i `fullTitle` redukuje się do samego brandu. Live HTML home: `<title>Pisaniepracy.pl</title>` (15 znaków). Wszystkie 8 artykułów ma dobre, opisowe tytuły 66–86 zn. — tylko najważniejsza strona w serwisie ma pusty marketingowo tytuł.
**Impact:** `<title>` to najsilniejszy on-page czynnik rankingowy. Świeża domena nie ma jeszcze brand searchu, więc tytuł „Pisaniepracy.pl" nie celuje w żadną realną frazę („jak napisać pracę", „pisanie pracy dyplomowej"). Strona główna z najwyższym priorytetem (1.0 w sitemap) marnuje swój największy sygnał.
**Fix:** w `src/pages/index.astro:88` przekaż realny tytuł z frazą głową, np.:
```astro
<BaseLayout
  title="Jak napisać pracę dyplomową — kompletny przewodnik"
  description="..."  {/* patrz finding niżej */}
  jsonLd={jsonLd}
>
```
Wyrenderuje się `Jak napisać pracę dyplomową — kompletny przewodnik | Pisaniepracy.pl` (~70 zn., w granicy SERP). Brand zostaje na końcu dzięki istniejącej logice `BaseLayout`.

---

## P2 — Medium (gdy będzie czas)

### [LIVE] Meta description strony głównej za długa (191 znaków)
**Where:** `src/config/site.ts:18-19` (`siteConfig.description`), używane przez `index.astro:88`
**Evidence:** live home: `description` = 191 zn. Google ucina opis ~155–160 zn. (mobile ~120). Końcówka „…napisać samemu, zlecić czy wygenerować AI." zostanie obcięta w SERP.
**Impact:** obcięty opis = słabszy CTR z wyników; CTA na końcu zdania przepada.
**Fix:** skróć `siteConfig.description` do ≤155 zn., trzymając frazę i wartość, np.: `"Przewodnik po pisaniu pracy licencjackiej i magisterskiej: proces krok po kroku, realne koszty i porównanie ścieżek — samemu, na zlecenie czy z AI."` (146 zn.). Uwaga: ten string jest też źródłem `og:description` i opisu w JSON-LD `WebSite`/`Organization`, więc skrócenie poprawia kilka miejsc naraz.

### [LIVE] JSON-LD `BlogPosting` bez pola `image` (wszystkie 8 artykułów)
**Where:** `src/pages/blog/[...slug].astro:29-42`
**Evidence:** `grep '"image"'` w `blog/*/index.html` → brak. Schema `BlogPosting` ma `headline`, `datePublished`, `dateModified`, `author`, `publisher`, `mainEntityOfPage` — ale nie `image`. Google Article structured data wskazuje `image` jako zalecane; bez niego artykuł jest mniej eligible do bogatszej prezentacji.
**Impact:** słabsza kwalifikacja do rich results dla wszystkich wpisów bloga.
**Fix:** w `src/pages/blog/[...slug].astro:29-42` dodaj do obiektu `BlogPosting` pole `image`. Brak per-post grafik → użyj absolutnego URL OG jako fallback:
```js
image: `${siteConfig.url}/og-image.jpg`,
```
Docelowo (lepiej): dodać `heroImage` do frontmatter wpisów w `src/content.config.ts` i mapować na `image`, gdy istnieje.

### [WORKFLOW] Brak nagłówków bezpieczeństwa na CloudFront
**Where:** dystrybucja CloudFront (Response Headers Policy) — nie w repo
**Evidence:** `curl -sI https://www.pisaniepracy.pl/` → brak `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Content-Security-Policy` (wszystkie nieobecne).
**Impact:** dla SEO marginalne (HSTS to drobny sygnał zaufania), ale to standard bezpieczeństwa i element oceny „secure". `X-Content-Type-Options: nosniff` i `Referrer-Policy` to tani, bezpieczny zysk.
**Fix:** dołącz do dystrybucji CloudFront managed Response Headers Policy (`SecurityHeadersPolicy`) albo własną z co najmniej:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```
Zrób to jako rozszerzenie istniejącego wzorca `scripts/fix-cf-error-responses.sh` (analogiczny patch `aws cloudfront update-distribution` z `ResponseHeadersPolicyId`), żeby konfiguracja była powtarzalna i wersjonowana w repo.

### [CONTENT] Placeholdery danych administratora na żywej polityce prywatności
**Where:** `src/config/site.ts:23-28` → renderowane na `src/pages/polityka-prywatnosci/index.astro`
**Evidence:** live `https://www.pisaniepracy.pl/polityka-prywatnosci/` zawiera `ADMIN_NAME_PLACEHOLDER`, `ADMIN_ADDRESS_PLACEHOLDER`, `NIP_PLACEHOLDER`. Strona jest `noindex` (więc nie problem indeksacji), ale jest publicznie dostępna.
**Impact:** brak realnych danych administratora = niespełniony obowiązek informacyjny RODO; placeholdery widoczne dla użytkownika obniżają wiarygodność. To znany TODO z `LAUNCH-REPORT.md`.
**Fix:** uzupełnij `legal.adminName` / `adminAddress` / `adminNip` w `src/config/site.ts:23-28` realnymi danymi i przebuduj. Jeśli na tym etapie domena ma działać jako czysty hub bez własnej działalności — przynajmniej podmień placeholdery na realną nazwę/adres e-mail administratora.

---

## P3 — Polish (backlog)

### [LIVE] JSON-LD `Organization` minimalny — bez `logo` i `sameAs`
**Where:** `src/pages/index.astro:69-75`
**Evidence:** `Organization` ma tylko `name`, `url`, `description`. Brak `logo` (zalecane dla encji marki / panelu wiedzy) i `sameAs` (profile zewnętrzne).
**Impact:** słabszy sygnał encji do Knowledge Graph. Niski priorytet na świeżej domenie bez jeszcze istniejących profili.
**Fix:** dodaj `logo: "${siteConfig.url}/apple-touch-icon.png"` (lub dedykowane logo) oraz `sameAs: [...]` z profilami, gdy powstaną.

---

## Unverified — needs re-run
- Indeksacja / GSC / GA4 — świeża domena, pominięte zgodnie z poleceniem. Re-run po ~14 dniach od pierwszego zgłoszenia sitemap (sprawdzić I1 „sitemap pages indexed", I3 „crawled - not indexed").

## Skipped — not applicable to this profile
- **C product/Offer schema** — to nie e-commerce, brak produktów.
- **L1 orphan / L2 dead-end / link graph** — 13 URL, trywialna architektura, pełne linkowanie z nagłówka/stopki/related; brak grafu do analizy.
- **T16 hreflang** — serwis jednojęzyczny (pl).
- **Pagination canonical / faceted search (C-profile)** — brak paginacji i filtrów; kategorie to statyczne strony.
- **Tail signals (bounce, CTR, position drops)** — brak danych GA4/GSC na nowej domenie.

---

## Sequence of recommended actions
1. **Kod (1 commit, redeploy):** popraw home `<title>` (`index.astro:88`) + skróć `siteConfig.description` (`site.ts:18`) + dodaj `image` do `BlogPosting` (`blog/[...slug].astro`). To trzy najtańsze zmiany z największym efektem SEO.
2. **Treść:** uzupełnij dane administratora w `site.ts:23-28` (RODO).
3. **Infra:** dodaj Response Headers Policy do CloudFront (rozszerz `scripts/fix-cf-error-responses.sh`).
4. **Backlog:** wzbogać `Organization` o `logo`/`sameAs`.
5. **Za ~2 tygodnie:** re-run audytu z włączonym GSC/GA4, sprawdzić indeksację 13 URL (limit Google ~10 zgłoszeń/dzień, jeśli ręcznie).

---

## Appendix — verification commands
```bash
curl -sIL -A "Mozilla/5.0" https://pisaniepracy.pl/            # apex → www 301 → 200
curl -sI  -A "Mozilla/5.0" https://www.pisaniepracy.pl/nieistnieje/   # MUSI być 404
curl -s   https://www.pisaniepracy.pl/sitemap-0.xml | grep -oE '<loc>[^<]+</loc>'
# PSI: GET .../runPagespeed?url=...&strategy=mobile&category=performance&category=seo&key=$PSI_API_KEY
#   → PERF 0.98 / SEO 1.0 / LCP 1.7s / CLS 0.065 / TBT 70ms
```
