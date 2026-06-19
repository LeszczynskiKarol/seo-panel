# SEO on-site audit — maturalnie.pl
**Date:** 2026-05-27
**Profile:** B+ (content site z 528 statycznymi podstronami szablonowymi: 507 per-kierunek, 13 kierunki-kategorii, 7 narzędzi/hubów). Klasyfikacja `SATELLITE` w `seo_panel` jest nieaktualna — to narzędziownia maturzysty z SEO ukierunkowanym na long-tail "kierunek + uczelnia + próg".
**Stack:** Astro 5.18.2 static, S3 + CloudFront, deploy via `./deploy.sh` (git → build → s3 sync → CF invalidation)
**Repo↔prod state:** mixed — repo clean, ale ostatni commit `6a8996d` (SGH/UG skala fix, 20:55:24 lokalnego) jest 1 min PO `dist/` (20:54:33) i S3 `Last-Modified` (20:54:28). HEAD nie jest jeszcze zdeployowany.
**Last crawl:** NULL | **GSC:** NULL | **GA4:** NULL (cron jeszcze nie pobierał — domena świeża, `createdAt` 2026-05-27 13:09:22)
**Pages:** 528 w sitemapie | **DA:** brak (świeżo dodana) | **Last 28d GSC:** brak danych

---

## ⚠ Data freshness caveats

- **DB `seo_panel` nie ma jeszcze danych o tej domenie**: `totalPages=0`, `lastCrawl=NULL`, `lastGscPull=NULL`, `mozDA=NULL`. Domena dodana dzisiaj 13:09 UTC; pierwszy `gsc_pull` (06:00) i `crawl` jeszcze nie odpalały dla tego rekordu. Wnioski o indexacji / orphanach / search-intent **nie są dostępne** w tym audycie i wymagają re-runu za ~7 dni.
- **`Domain.category = SATELLITE`** — najpewniej legacy z momentu założenia. Audyt traktuje to jako Profil B (content) na podstawie struktury repo. Karol może zaktualizować w panelu, aby dopasować przyszłe automatyczne sprawdzenia.
- **`DomainIntegration` GA4** (`G-S2Q4Z209FC`) ma status `ACTIVE`, `lastSync=NULL`. To częściowo skutek P0 #1 (skrypt GA4 na live jest no-op — patrz niżej) — nie ma czego synchronizować. Wymaga re-runu po naprawie P0 #1 + ręcznym triggerze `ga4_sync` na panelu.
- **PSI**: keyless wywołanie zwróciło `429 Quota exceeded` dla projektu `ageless-period-491209-s8`. Nie udało się zmierzyć CWV w tym audycie. Re-run jutro lub z osobnym kluczem.

---

## ⚠ Drift summary — repo ↔ prod

| Obszar | Stan w repo | Stan na live | Akcja |
|--------|-------------|--------------|-------|
| `src/data/uniwersytety-uzupelnienia.ts` (commit `6a8996d`) | mk() z parametrem maxPkt; SGH/UG skala 450/150 | poprzedni build (sprzed 1 min) z hardcoded maxPkt=100 — strony SGH "Międzynarodowe stosunki publiczne — 316/100" ciągle widoczne | DEPLOY (`./deploy.sh`) |

`git status` jest clean. Powyższe to JEDYNY drift — wszystkie inne znaleziska niżej są błędami obecnymi RÓWNIEŻ w repo, czyli nie znikną po samym deployu.

---

## P0 — Critical (fix this week)

### [LIVE] GA4 + Consent Mode v2 — inline skrypt jest wykonywalnym no-opem (GDPR ryzyko + dane analityczne stracone)

**Where:**
- Źródło: `src/components/Analytics.astro:23-64` i `:68-76` (dwa bloki `<script is:inline define:vars={{ gaId }}>`)
- Wynik buildu: `dist/index.html` (i każdy inny HTML)
- Live: `https://www.maturalnie.pl/` widoczne w sekcji `<head>` po komentarzu `<!-- GA4 + Consent Mode v2 ... -->`

**Evidence:** literalna zawartość wyrenderowanego `<script>` na produkcji:

```js
(function(){const gaId = "G-S2Q4Z209FC";

        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', { ad_storage: 'denied', /* ... */ });
          /* ... */
        `}
      })();
```

Astro `define:vars` opakowało zawartość w IIFE z prefiksem `const gaId = "..."`. W .astro pliku Karol owinął body skryptu w `{` `` ` `` ... `` ` `` `}` (Astro-expression + template-literal). `is:inline` nie preprocessuje JSX-expressions w treści skryptu, więc literały `{` i `` ` `` wylądowały dosłownie w outputie. Powstałe JS jest **syntaktycznie poprawne**, ale semantycznie no-op:
- `{` … `}` to block-statement
- `` `…` `` to template-literal expression-statement — string jest ewaluowany i wyrzucany
- żadna z funkcji `gtag('consent', 'default', ...)` nie odpala
- `window.gtag` nigdy nie zostaje przypisane przez nasz skrypt

Następnie `<script async src="https://www.googletagmanager.com/gtag/js?id=G-S2Q4Z209FC">` ładuje gtag.js — biblioteka sama auto-inicjalizuje `dataLayer` i `gtag`, ale **bez wcześniejszych `gtag('consent','default','denied')` regionalnych dla PL/EU** Consent Mode v2 działa w trybie legacy "wszystko granted by default". Konsekwencje:
1. GDPR: użytkownicy z PL/EU są śledzeni bez aktywnej zgody (Consent Mode nieaktywowany).
2. CookieConsent.astro `applyConsent()` wywoła `gtag('consent','update', ...)`, ale to się dzieje DOPIERO po kliknięciu w banner — pierwszy pageview jest już wysłany w stanie nieokreślonym.
3. Jeżeli gtag.js wykryje brak Consent Mode signal, część eventów może być oznaczona przez Google jako "low quality" lub nie raportowana — wyjaśnia to też dlaczego `DomainIntegration.lastSync` jest NULL pomimo `ACTIVE`.

Wzorzec wzorcowy do porównania: `D:\mekra.pl\src\layouts\BaseLayout.astro:96-131` — używa `<script is:inline>` z hardcoded gaId, BEZ `{` `` ` `` … `` ` `` `}` wrappera, raw JS jako body.

**Impact:** ryzyko GDPR (skarga UODO za śledzenie bez consenta), brak telemetrii GA4 z prawdziwego ruchu — wszystkie raporty (CTR, bounce, konwersje) będą puste lub niewiarygodne. Krytyczne PRZED jakąkolwiek kampanią promocyjną domeny.

**Fix:** w `src/components/Analytics.astro` zamień obie sekcje `<script is:inline define:vars={{ gaId }}>` — usuń `{` i `` ` `` na początku oraz `` ` `` i `}` na końcu body. Linie 23-64 powinny wyglądać:

```astro
<script is:inline define:vars={{ gaId }}>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500,
  });

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    region: ['PL', 'EU'],
  });

  try {
    var stored = localStorage.getItem('cookie-consent');
    if (stored) {
      var parsed = JSON.parse(stored);
      gtag('consent', 'update', {
        ad_storage: parsed.ad_storage || 'denied',
        ad_user_data: parsed.ad_user_data || 'denied',
        ad_personalization: parsed.ad_personalization || 'denied',
        analytics_storage: parsed.analytics_storage || 'denied',
      });
    }
  } catch (e) {}
</script>
```

Analogicznie blok linie 68-76: usuń `{` `` ` `` i `` ` `` `}` — body to raw 4 linie z `gtag('js', ...)` i `gtag('config', ...)`. Po naprawie: `./deploy.sh`, potwierdź w DevTools (Network → `collect?v=2`) że pageview leci dopiero PO consent update.

---

### [LIVE] 404 nie istnieje — wszystkie nieistniejące URL-e zwracają `403 AccessDenied` z S3 XML

**Where:**
- Live: każdy URL spoza listy w sitemapie. Przykład: `https://www.maturalnie.pl/jakas-nieistniejaca-strona/`
- Źródło: `src/pages/404.astro` istnieje, `dist/404.html` istnieje (55 886 B), ale CloudFront ani S3 nie mapuje błędu na ten plik.

**Evidence:**

```
$ curl -sI "https://www.maturalnie.pl/jakas-nieistniejaca-strona/"
HTTP/1.1 403 Forbidden
Content-Type: application/xml
Server: AmazonS3

<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>

$ curl -sI "https://www.maturalnie.pl/404.html"
HTTP/1.1 200 OK
Content-Length: 55886
```

CloudFront Function (`_cf-function-redirect.js`) rewrite'uje każdy URL z trailing slash → `/<path>/index.html`. Jeżeli `index.html` nie istnieje w S3, S3 zwraca 403 (bucket private, OAC). Brak `CustomErrorResponses` mapującego 403/404 → `/404.html` z `ResponseCode: 404`.

**Impact:**
- Google widzi 403 zamiast 404 → stale strony oznaczone jako "blocked" zamiast "not found"; powolne deindeksowanie usuniętych URL-i.
- UX: użytkownik trafiający z typo / starym linkiem widzi surowy AWS XML zamiast strony błędu z nawigacją.
- W przyszłości — np. po zmianie struktury slugów — błędna konfiguracja będzie generować masowe 403 widoczne w GSC Coverage jako "Submitted URL marked noindex" lub "Server error (5xx)".

**Fix:** dodaj w CloudFront distribution dla `www.maturalnie.pl` (sprawdź `_cf-distribution.json` po `Id`) Custom Error Responses:

```bash
aws cloudfront get-distribution-config --id <DIST_ID> > cf.json
# ręcznie w cf.json.DistributionConfig.CustomErrorResponses dodać:
# { "ErrorCode": 404, "ResponsePagePath": "/404.html", "ResponseCode": "404", "ErrorCachingMinTTL": 60 }
# { "ErrorCode": 403, "ResponsePagePath": "/404.html", "ResponseCode": "404", "ErrorCachingMinTTL": 60 }
aws cloudfront update-distribution --id <DIST_ID> --if-match <ETAG> --distribution-config file://cf.json.DistributionConfig
```

Po aktualizacji: `aws cloudfront create-invalidation --paths "/*"`. Walidacja: `curl -sI https://www.maturalnie.pl/test-404/` musi zwrócić `HTTP/1.1 404` i HTML `404.html`.

---

### [LIVE] `/og-image.jpg` nie istnieje — wszystkie social-share previews są puste

**Where:**
- Źródło referencji: `src/layouts/BaseLayout.astro:23` — `ogImage = "/og-image.jpg"` (domyślny dla każdej strony)
- Renderowane na każdym HTML jako `<meta property="og:image" content="https://www.maturalnie.pl/og-image.jpg">` i `twitter:image`
- Asset: **nie istnieje w `public/`** (zawartość `public/`: tylko `robots.txt`) ani w `dist/`

**Evidence:**

```
$ curl -sI "https://www.maturalnie.pl/og-image.jpg"
HTTP/1.1 403 Forbidden
Server: AmazonS3
<Error><Code>AccessDenied</Code></Error>

$ ls D:/maturalnie.pl/public/
robots.txt
```

Każda strona (528 URL-i w sitemapie) deklaruje `og:image` i `twitter:image` wskazujący na nieistniejący plik.

**Impact:**
- Udostępnienie linku na Facebooku/Slacku/LinkedIn/Discordzie pokazuje pustą kartę (brak miniatury), znacząco obniżając CTR udostępnień.
- Twitter walidator (https://cards-dev.twitter.com/validator) odrzuci wszystkie strony.
- Brak ikony w preview może powodować, że Discord/Slack pokażą tylko domain + tekst — gorszy "viral factor" przy rekomendacjach uczniów-uczniom.

**Fix:**
1. Wygeneruj `og-image.jpg` 1200×630 px, ~80% jakości JPEG (~120 KB) — branding maturalnie.pl + tagline "Spokojnie, mamy to. Narzędziownia maturzysty.".
2. Skopiuj do `public/og-image.jpg`.
3. (Opcjonalnie) dla per-kierunek lub per-kategoria — wygeneruj dedykowane obrazy i przekaż jako `ogImage` prop w `BaseLayout`. Można skorzystać z Astro `@astrojs/og` lub satori.
4. `./deploy.sh` — `aws s3 sync` zsynchronizuje plik z `dist/`.

---

### [LIVE] `/favicon.svg` i `/apple-touch-icon.png` nie istnieją

**Where:**
- Źródło referencji: `src/layouts/BaseLayout.astro:98-99`
- Renderowane jako `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` i `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`
- Brak plików w `public/`

**Evidence:**

```
$ curl -sI "https://www.maturalnie.pl/favicon.svg"
HTTP/1.1 403 Forbidden

$ curl -sI "https://www.maturalnie.pl/apple-touch-icon.png"
HTTP/1.1 403 Forbidden
```

**Impact:**
- Brak ikony w karcie przeglądarki — wizualnie strona "nie działa" w taskbarach, w bookmark-listach pokazuje generyczną kropkę.
- iOS Safari "Dodaj do ekranu głównego" daje białą ikonę zamiast brandu.
- Sub-sygnał trust/jakości witryny dla użytkowników i (subtelnie) dla Google.

**Fix:**
1. `public/favicon.svg` — prosty SVG (~1-2 KB) z literą "M" lub graduacją w kolorach maturalnie.pl. Można wygenerować z https://realfavicongenerator.net/.
2. `public/apple-touch-icon.png` — 180×180 PNG.
3. (Polecane) dodać też `favicon.ico` 32×32 w `public/` dla starszych przeglądarek; `BaseLayout` doda `<link rel="alternate icon" href="/favicon.ico">`.
4. `./deploy.sh`.

---

## P1 — High (fix this sprint)

### [DRIFT→DEPLOY] Niezdeployowany fix SGH/UG — strony pokazują nielegalne `316/100` w progach punktowych

**Where:**
- Commit `6a8996d` (HEAD, 2026-05-27 20:55:24) modyfikuje `src/data/uniwersytety-uzupelnienia.ts` z helperem `mk()` przyjmującym `maxPkt`
- Live na S3: build sprzed 1 min PRZED commitem (Last-Modified 20:54:28 UTC = 20:54:28 lokalnego — bug w deploy.sh kolejności? Patrz niżej)
- Dotyczy: 12 kierunków SGH + 30 UG, np. `https://www.maturalnie.pl/kierunek/sgh/miedzynarodowe-stosunki-publiczne/` (URL hipotetyczny — nie sprawdzony bo live ma starą wersję)

**Evidence:**
```
$ git log -1 --format="%H %ai %s"
6a8996de4276587dceacb585f402896008a116ae 2026-05-27 20:55:24 +0200 fix: SGH skala 450, UG skala 150 — mk() helper przyjmuje maxPkt jako parametr

$ curl -sI https://www.maturalnie.pl/ | grep Last-Modified
Last-Modified: Wed, 27 May 2026 18:54:28 GMT   # = 20:54:28 lokalnego, 56 s PRZED commitem

$ stat dist/index.html
2026-05-27 20:54:33   # build BEFORE commit
```

Commit message wprost mówi: *"Bug: 'Międzynarodowe stosunki publiczne SGH — 316/100' (próg z otouczelnie był 316, ale mk() hardcodował maxPkt=100)"*. Bug jest naprawiony lokalnie, ale jeszcze nie zdeployowany.

**Impact:**
- UX/trust: użytkownik widzi nielogiczne "316/100 pkt" → traci zaufanie → bounce → negatywny sygnał engagement dla Google.
- Pośrednio SEO: GSC może oznaczyć takie strony jako thin/low-quality content jeśli skala 1:1000 vs 1:100 wprowadza w błąd.

**Fix:** `cd D:\maturalnie.pl && ./deploy.sh`. Walidacja: po deployu `curl -s https://www.maturalnie.pl/kierunek/sgh/<nazwa>/ | grep -oE "[0-9]{2,3}/[0-9]{2,3} pkt"` — wartości muszą być w sensownych skalach (max 450 dla SGH, max 150 dla UG).

**Workflow observation (osobno):** kolejność timestampów `dist/` 20:54:33 → S3 `Last-Modified` 20:54:28 → `git commit` 20:55:24 sugeruje, że Karol najpierw wywołał `deploy.sh` (który zrobił build + S3 sync), POTEM zrobił dodatkowy commit ręcznie. To znaczy że `deploy.sh` w obecnej formie **może deployować PRZED commitem**, jeśli commit jest pusty na starcie i Karol robi `git add . && git commit` ręcznie po skrypcie. Jeśli to powtarzalny wzorzec — git nie jest source of truth dla prod stanu. Dla audytu to mniejszy issue, ale warty zarejestrowania.

---

### [WORKFLOW] `DomainIntegration.lastSync = NULL` przy `status = ACTIVE` dla GA4

**Where:**
- DB `seo_panel` (prod, host `panel`): `SELECT * FROM "DomainIntegration" WHERE "domainId" = 'cm75c0c0cd8a5e4b6322e653' AND provider = 'GOOGLE_ANALYTICS'`
- Status: `ACTIVE`, `propertyId: properties/539276017`, `lastSync: NULL`

**Evidence:** integracja istnieje i jest aktywna, ale `ga4_sync` cron (08:00) jeszcze ani razu nie zapisał `lastSync`. Powiązanie z P0 #1: bo skrypt GA4 jest no-op, prawdopodobnie do GA4 nie spłynęła jeszcze żadna sesja, więc nawet jak cron sięgnie do API, dane będą puste. Albo: cron jeszcze nie ruszył dla nowo dodanej domeny (domena dodana 2026-05-27 13:09 UTC, cron 08:00 UTC = przed dodaniem). Sprawdź jutro rano.

**Impact:** raporty CTR/conversions w `seo_panel` będą puste — nawet po naprawie P0 #1 — dopóki ga4_sync nie odpali i nie zapisze pierwszego snapshotu.

**Fix:**
1. Najpierw napraw P0 #1 (skrypt GA4) + deploy.
2. Odczekaj ~6h aż GA4 zacznie zbierać sesje.
3. Ręcznie trigger ga4_sync na `panel` (sprawdź jaki konkretnie skrypt — np. `cd /home/ubuntu/seo-panel && node scripts/ga4_sync.js cm75c0c0cd8a5e4b6322e653`).
4. Jutro po porannym cronie sprawdź `lastSync` w DB.

---

## P2 — Medium (fix when capacity allows)

### [LIVE] `Disallow: /polityka-prywatnosci` w robots.txt KONFLIKTUJE z `noindex, nofollow` w meta — Google nie zobaczy noindex

**Where:**
- `public/robots.txt` (i live `https://www.maturalnie.pl/robots.txt`): `Disallow: /polityka-prywatnosci`
- `https://www.maturalnie.pl/polityka-prywatnosci/` HTML: `<meta name="robots" content="noindex, nofollow">`

**Evidence:**
```
$ curl -s https://www.maturalnie.pl/robots.txt
User-agent: *
Allow: /
Disallow: /polityka-prywatnosci

$ curl -s https://www.maturalnie.pl/polityka-prywatnosci/ | grep robots
<meta name="robots" content="noindex, nofollow">
```

**Impact:** klasyczny anti-pattern Google: jeżeli URL jest zablokowany w robots.txt, Google **nie zaindeksuje treści ANI nie zobaczy meta `noindex`**. Jeżeli URL kiedykolwiek pojawi się w backlinku, Google może go pokazać w wynikach jako *"Strona zablokowana"* z samego URL bez tytułu/snippetu. To gorzej niż czysty noindex.

**Fix:** w `public/robots.txt` usuń linię `Disallow: /polityka-prywatnosci` (zachowaj `noindex` w meta). Wtedy Google crawluje, czyta noindex, deindeksuje. Po zmianie: `./deploy.sh`.

---

### [WORKFLOW] PSI nie zmierzony (quota exceeded) — brak danych o CWV (LCP/CLS/INP)

**Where:** PSI API call dla `https://www.maturalnie.pl/` zwrócił `429 Quota exceeded` dla projektu `ageless-period-491209-s8`.

**Evidence:** `{"error": {"code": 429, "message": "Quota exceeded for ... 'pagespeedonline.googleapis.com' ... project_number:583797351..."}}`.

**Impact:** nie wiemy czy strona ma problemy z LCP / CLS / INP. Profil B z 528 stronami i font preloading z Google Fonts — typowe ryzyko: LCP > 2.5s przy braku cache + slow 3G. Bez pomiaru nie da się przypisać konkretnej wagi.

**Fix:** uruchom audyt ponownie jutro (limit dzienny resetuje się o 00:00 PST = 09:00 czasu polskiego) lub: w GCP `ageless-period-491209-s8` wygeneruj osobny API key z restriction "PageSpeed Insights API only" i zapisz w `~/.claude/skills/seo-audit-onsite/.env` jako `PSI_API_KEY=AIza...`. Wówczas re-run audytu sięgnie po klucz.

---

## P3 — Polish (backlog)

### [CONTENT] Title homepage celuje w "Narzędziownia maturzysty 2027" — sprawdź czy fraza ma realny search-volume

**Where:** `src/pages/index.astro` → BaseLayout `title="Narzędziownia maturzysty 2027 — 5 narzędzi w jednym miejscu"`

**Impact (hipoteza, do walidacji za 7 dni w GSC):** "Narzędziownia maturzysty" to fraza brandowa wymyślona, prawdopodobnie 0 wyszukiwań. Maturzyści szukają konkretnych narzędzi: "kalkulator punktów na studia", "progi punktowe 2025", "ile dni do matury 2027". Title mógłby zacząć od jednego z tych fraz głównych, brand zostawić jako sufiks: np. *"Kalkulator punktów na studia, progi 2025, planer nauki | maturalnie.pl"*.

**Fix:** po pierwszym tygodniu z GSC (`lastGscPull` != NULL) sprawdź na `/` jaka jest top-query w `seo_panel.SearchQuery` i ewentualnie przepisz title. Teraz to czysta spekulacja — nie zmieniaj ślepo.

---

### [CONTENT] Description home page — 240 znaków (powyżej rec. 160)

Description: `"Kalkulator punktów na studia, planer nauki, odliczanie do matury i baza progów punktowych z lat 2023–2025. Pięć narzędzi dla maturzysty w jednym miejscu. Bez rejestracji, bez paywalla."` — 191 znaków. Po renderingu w Google SERP będzie ucięte po ~160. Końcówka "Bez rejestracji, bez paywalla" — najmocniejszy USP — zostanie ucięta.

**Fix:** w `src/pages/index.astro` przepisz description na ~150 znaków, USP "bez rejestracji" wczesniej: *"Bez rejestracji: kalkulator punktów na studia, planer nauki, odliczanie do matury, baza progów punktowych 2023–2025. Pięć narzędzi w jednym miejscu."* — 156 znaków.

---

### [CONTENT] Description `/kierunek/` (493 znaków po renderingu) — index page

Description: `"492 kierunków na 15 top uczelniach publicznych w Polsce. Progi punktowe, formuły rekrutacji, kalkulator punktów. Wybierz uczelnię żeby zobaczyć pełną listę kierunków."` — 178 znaków. Też za długie.

**Fix:** skróć do ~150 chr: *"492 kierunki na 15 top uczelniach publicznych. Progi punktowe 2025, formuły rekrutacji, kalkulator. Wybierz uczelnię — zobaczysz pełną listę."*

---

## Unverified — needs re-run

- **PSI / CWV measurement** — `429 quota exceeded`. Retry jutro lub po odnowieniu API key.
- **Indexation status** (I1-I6) — `lastGscPull = NULL`, brak danych GSC. Re-run za ~7 dni.
- **Top-query / search-intent mismatch** (C16) — brak `SearchQuery` rows. Re-run za ~14 dni gdy domena będzie miała pierwsze impresje.
- **Internal-link orphans / dead-ends** (L1-L2) — brak `Page` rows w DB (crawl nie odpalił). Można jednak uznać, że dla statycznego sajta z `SiteNav` i `SiteFooter` linkującym do każdej kategorii, orphanów raczej nie będzie. Re-run formalny za ~7 dni.
- **Mobile-friendliness (T18)** — nie zmierzone (PSI quota). Strona deklaruje viewport meta i używa Tailwind responsive — z bardzo wysokim prawdopodobieństwem OK, ale wymaga formalnej weryfikacji.

---

## Skipped — not applicable to this profile

- **T16 hreflang** — strona tylko po polsku, brak multi-lang.
- **C8-C10 img alts / lazy / oversized** — homepage i wszystkie sprawdzone podstrony używają **0 tagów `<img>`** (BackgroundDecor + Iconify SVGs + CSS gradients). Brak zdjęć = brak problemów alt/lazy. Inline-SVG icons mają role/aria w komponencie `IconBadge`.
- **Profil C checks** (Product schema, faceted-search, out-of-stock, pagination canonical) — nie e-commerce.
- **Profil E checks** (anchor diversity to money sites, outbound link audit, Moz spam score) — nie satellite (mimo że `Domain.category=SATELLITE` w DB — to legacy).
- **T22-23 (CloudFront/S3 deep dive)** — kompresja `br` aktywna ✓, TLS modern ✓, cache headers separated (HTML max-age=300, assets max-age=31536000 z deploy.sh). Bez findings na CloudFront poza brakiem CustomErrorResponses (P0 #2 powyżej).

---

## Sequence of recommended actions

Wykonaj w tej kolejności:

1. **(Najpierw) wygeneruj brakujące assety** (~30 min):
   - `public/og-image.jpg` (1200×630) — P0 #3
   - `public/favicon.svg` (~1 KB) — P0 #4
   - `public/apple-touch-icon.png` (180×180) — P0 #4

2. **Napraw `src/components/Analytics.astro`** — P0 #1. Usuń wrapper `{` … `` ` `` … `` ` `` `}` z obu bloków `<script is:inline define:vars={{ gaId }}>`. Body to raw JS.

3. **Usuń linię `Disallow: /polityka-prywatnosci` z `public/robots.txt`** — P2.

4. **Skróć description na home + `/kierunek/`** — P3 (opcjonalne, niska waga).

5. **`./deploy.sh`** — jednorazowo wypycha wszystko powyższe + zaległy commit `6a8996d` (SGH/UG skala).

6. **Skonfiguruj CloudFront CustomErrorResponses** — P0 #2. Wymaga `aws cloudfront update-distribution`. Nie wpływa na deploy.sh — robione raz, osobno.

7. **Walidacja post-deploy (~5 min):**
   ```
   curl -sI https://www.maturalnie.pl/og-image.jpg          # 200
   curl -sI https://www.maturalnie.pl/favicon.svg           # 200
   curl -sI https://www.maturalnie.pl/test-404/             # 404 (NIE 403!)
   curl -s  https://www.maturalnie.pl/ | grep "consent.*default"  # rzeczywisty JS, nie template literal
   ```
   W DevTools na live: `window.gtag` musi być funkcją; `dataLayer[0]` to powinien być `["consent","default",{...}]`.

8. **Po naprawie GA4 + ~6h** — ręczny trigger `ga4_sync` na panelu, walidacja `lastSync` w DB jutro rano.

9. **(Opcjonalnie, ale polecane) update `Domain.category` z `SATELLITE` na `CONTENT_TOOL` lub jakikolwiek inny enum lepiej oddający charakter** — drobiazg DB-level.

10. **Za 7 dni — re-run audytu** dla pełnego zestawu Indexation/Orphan/Search-intent kiedy `lastCrawl`, `lastGscPull` i `lastSync` będą populated.

---

## Appendix — kluczowe komendy zweryfikowane w trakcie audytu

```bash
# Drift verification
git -C D:/maturalnie.pl log -1 --format="%ai"     # 2026-05-27 20:55:24 +0200
git -C D:/maturalnie.pl status --short             # (empty)

# Live homepage
curl -sIL "https://www.maturalnie.pl/"             # 200 OK, HSTS, max-age=300
curl -sIL "http://www.maturalnie.pl/"              # 301 → https
curl -sIL "https://maturalnie.pl/"                 # 301 → https://www

# Sitemap
curl -s https://www.maturalnie.pl/sitemap-0.xml | grep -c "<loc>"   # 528

# 404 path
curl -sI "https://www.maturalnie.pl/no-such-page/"                  # 403 (BUG)
curl -sI "https://www.maturalnie.pl/404.html"                       # 200

# Missing assets
curl -sI "https://www.maturalnie.pl/og-image.jpg"        # 403 (BUG)
curl -sI "https://www.maturalnie.pl/favicon.svg"         # 403 (BUG)
curl -sI "https://www.maturalnie.pl/apple-touch-icon.png" # 403 (BUG)

# DB lookup (prod, host: panel)
ssh_exec panel: sudo -u postgres psql -d seo_panel -A -F "|" -c \
  "SELECT d.id, d.\"totalPages\", di.status, di.\"lastSync\" FROM \"Domain\" d
    LEFT JOIN \"DomainIntegration\" di ON di.\"domainId\"=d.id AND di.provider='GOOGLE_ANALYTICS'
    WHERE d.domain ILIKE '%maturalnie%';" 2>/dev/null
```
