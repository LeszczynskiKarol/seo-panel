# SEO on-site audit — kurscopywriting.preview.sitario.com
**Date:** 2026-07-10
**Profile:** A (static brochure, 4 strony) — ale de facto **audyt outputu szablonu Sitario**: to zamówienie testowe (H1 zawiera "[TEST EDYTORA]", fikcyjny hydraulik Hydro-Bax, domena docelowa kurscopywriting.pl użyta do testu go-live). Findingi mapowane na kod platformy/szablonu, bo tam jest realna dźwignia — każdy bug szablonu powiela się na wszystkie strony klientów.
**Stack:** Astro v5.18.2 static (szablon `D:\claude-astro-generator\templates\project-base`), build przez runner `D:\sitario.com\runner`, deploy S3 + CloudFront (`PREVIEW_BUCKET`/`PREVIEW_DIST_ID`)
**Repo↔prod state:** in-sync dla szablonu (repo `D:\claude-astro-generator` czyste; `D:\sitario.com` ma 3 zmodyfikowane pliki — backend/frontend panelu, bez związku z SEO szablonu). Live build z 2026-07-10 01:56 (Last-Modified + sitemap lastmod zgodne).
**Pages:** 4 na preview (/, /blog/, /blog/jak-uniknac-zamarzniecia-rur/, /polityka-prywatnosci) | sitemap: 3 URL-e (polityka wykluczona filtrem — poprawnie)
**PSI (mobile, home):** Performance **0.85**, SEO **1.0** | FCP 3.3 s (score 0.40), LCP 3.3 s (0.69), CLS 0, TBT 0 ms

---

## ⚠ Data freshness caveats
- Treść strony to **dane testowe** ("[TEST EDYTORA]", "Nowa sekcja" ×2, alt="Testowa realizacja", tel. +48601000000) — problemy treściowe testu NIE są findingami; raport ocenia szablon i platformę.
- Docelowa domena `www.kurscopywriting.pl` serwuje obecnie **inną, starą stronę PHP** (nginx, PHPSESSID) — wszystkie canonicale/OG/sitemap preview wskazują na domenę z żywym, niepowiązanym contentem.
- seo_panel prod DB nie odpytany — preview.sitario.com nie jest domeną trackowaną w panelu (brak GSC/GA4 danych ruchu; severity ustawione wg wpływu na produkt, nie ruch).

---

## P0 — Critical
*(brak — nic nie blokuje indeksacji przyszłych stron produkcyjnych ani nie łamie fundamentów)*

## P1 — High

### [LIVE] Wszystkie preview klientów są indeksowalne przez Google (duplicate content + wyciek draftów)
**Where:** cała dystrybucja `*.preview.sitario.com` (w tym warianty `<slug>-edit.preview.sitario.com` — sprawdzone: `kurscopywriting-edit` zwraca 200); źródła: `templates/project-base/public/robots.txt`, `runner/src/publish.mjs:46-49`
**Evidence:**
- `robots.txt` na preview: `User-agent: * / Allow: /` + `Sitemap: https://www.kurscopywriting.pl/sitemap-index.xml`
- HTML: `<meta name="robots" content="index, follow">`
- nagłówki odpowiedzi (curl -sI): brak `X-Robots-Tag` (pełny zrzut w Appendix)
- canonical wskazuje cross-domain na `https://www.kurscopywriting.pl/` — domenę, która dziś serwuje **inną stronę**; canonical to dla Google hint, nie dyrektywa, więc preview może zostać zindeksowane samodzielnie
**Impact:** każdy preview klienta może wejść do indeksu (druga kopia strony po go-live = duplicate content kanibalizujący świeżą domenę klienta; przed go-live = publicznie indeksowane drafty). Skala: platformowa — dotyczy każdego zamówienia.
**Fix:** jedna zmiana infra — dopiąć do dystrybucji preview (`PREVIEW_DIST_ID`) ResponseHeadersPolicy z customowym nagłówkiem `X-Robots-Tag: noindex, nofollow`:
```
aws cloudfront create-response-headers-policy --response-headers-policy-config '{"Name":"sitario-preview-noindex","CustomHeadersConfig":{"Quantity":1,"Items":[{"Header":"X-Robots-Tag","Value":"noindex, nofollow","Override":true}]}}'
# potem update-distribution na PREVIEW_DIST_ID: DefaultCacheBehavior.ResponseHeadersPolicyId=<id> + invalidacja
```
Nagłówek działa na WSZYSTKIE pliki (HTML, obrazy, PDF-y klientów) i nie wymaga zmian w buildzie — po go-live ta sama paczka na domenie docelowej nie dostaje nagłówka. NIE robić tego przez `Disallow: /` w robots.txt preview — zablokowałoby crawl, ale nie indeksację już znanych URL-i, i wymagałoby rozgałęziania buildu.

### [LIVE] Blog systemowo osierocony — zero linków wewnętrznych do /blog/ przy włączonym module
**Where:** `templates/project-base/src/content/navigation.json` (tylko kotwice `#oferta/#proces/#kontakt`), `runner/src/migrations/003-blog-module.mjs` (grep `navigation|nav|header|link` → 0 trafień), `runner/src/prompts.mjs:81` (instrukcja wypełnienia navigation.json bez wzmianki o blogu)
**Evidence:** home.html: `grep -c 'href="/blog'` → **0**; jedyne linki wewnętrzne na home: `/` i `/polityka-prywatnosci`. Sitemap zawiera `/blog/` i wpis — blog odkrywalny WYŁĄCZNIE przez sitemapę.
**Impact:** strony blogowe klientów bez linków wewnętrznych = zerowy przepływ PageRank z home, wolniejsza/niepewna indeksacja, użytkownik w ogóle nie trafi na blog z nawigacji. Podkopuje wartość całego modułu blog + AI-writera (klient płaci za content, którego nie widać).
**Fix:** dwa miejsca:
1. `runner/src/migrations/003-blog-module.mjs` (lub handler `POST /orders/:id/blog` w backendzie) — przy włączaniu bloga dopisać do `site/src/content/navigation.json` w workspace: `{"label":"Blog","href":"/blog/"}` do `header.links` i `footer.links` (idempotentnie — skip jeśli href już jest).
2. `runner/src/prompts.mjs:81` — do punktu 5 dodać: „jeśli `hasBlog`, dodaj link {label: 'Blog', href: '/blog/'} w header i footer".

## P2 — Medium

### [LIVE] Fonty z Google Fonts = 186 KB third-party i FCP/LCP 3,3 s na mobile
**Where:** `templates/project-base/src/layouts/BaseLayout.astro` (preconnect + preload + stylesheet fonts.googleapis.com)
**Evidence:** PSI mobile: FCP 3.3 s (score 0.40), LCP 3.3 s (0.69); network-requests: Inter 86 083 B + 49 244 B, Plus Jakarta Sans 28 083 + 22 499 B z fonts.gstatic.com — **186 KB fontów przy 18 KB dokumentu** (fonty = 92% transferu strony). CSS jest inline (`inlineStylesheets: "always"`), TTFB 10 ms — fonty to jedyny zewnętrzny łańcuch renderu.
**Impact:** każda strona klienta startuje z FCP ~3+ s na mobile (CWV "needs improvement"); dodatkowo transfer IP użytkowników do Google (fonts.gstatic) — znany problem RODO (niemieckie orzecznictwo LG München 2022), istotny przy sprzedaży stron firmom w PL/EU.
**Fix:** self-host w szablonie: pobrać subset latin+latin-ext (Inter 400/500, Plus Jakarta Sans 500/700) jako woff2 do `templates/project-base/public/fonts/`, zdefiniować `@font-face` z `font-display: swap` w `src/styles/`, dodać `<link rel="preload" as="font" type="font/woff2" crossorigin>` dla 2 fontów użytych above-the-fold, usunąć 3 linki do fonts.googleapis.com z BaseLayout.astro. Subset latin+latin-ext zetnie ~86 KB Inter do ~30-40 KB.

### [LIVE] BlogPosting bez `author` i `image` — nie kwalifikuje się do rich results Article
**Where:** `templates/project-base/src/pages/blog/[...slug].astro:56-69` (obiekt `jsonLd`)
**Evidence:** live JSON-LD wpisu: `{"@type":"BlogPosting","headline":…,"datePublished":…,"mainEntityOfPage":…,"publisher":{…}}` — brak pól `author` i `image` (wymagane/mocno zalecane przez Google dla strukturalnych danych Article; walidator Google zgłosi warning `author` i `image` missing).
**Impact:** wpisy blogowe wszystkich klientów bez szans na rozszerzone wyniki artykułów; przy module AI-writer generującym content na skalę to systematycznie tracona widoczność.
**Fix:** w obiekcie `jsonLd` w `[...slug].astro` dodać:
```js
author: { "@type": "Organization", name: siteConfig.name },
image: post.data.image ?? `${siteConfig.url}/og-image.jpg`,
```
oraz (opcjonalnie, lepiej) dodać pole `image` do schematu kolekcji blog w `content.config.ts`, żeby AI-writer/import DOCX mógł je ustawiać per wpis.

### [WORKFLOW] Dystrybucje go-live bez ResponseHeadersPolicy — produkcyjne strony klientów bez HSTS i security headers
**Where:** `runner/src/golive.mjs:253,264` (`create-distribution --distribution-config` — w configu brak `ResponseHeadersPolicyId`; grep `ResponseHeaders|hsts|Strict-Transport` po całym pliku → 0 trafień)
**Evidence:** preview (ta sama architektura) nie zwraca `Strict-Transport-Security` (pełne nagłówki w Appendix); w golive.mjs żadna polityka nagłówków nie jest przypinana do nowych dystrybucji.
**Impact:** T19 — każda nowa domena klienta idzie na produkcję bez HSTS/X-Content-Type-Options; drobny sygnał bezpieczeństwa/jakości, łatwy do domknięcia raz na zawsze.
**Fix:** w obu distribution-configach w `golive.mjs` ustawić `DefaultCacheBehavior.ResponseHeadersPolicyId: "67f7725c-6f97-4210-82d7-5512b31e9d03"` (AWS-managed **SecurityHeadersPolicy**: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) — zero własnej infry do utrzymania.

## P3 — Polish

### [LIVE] Brak Twitter Cards w szablonie
**Where:** `templates/project-base/src/layouts/BaseLayout.astro` (head ma komplet OG, zero `twitter:*` — potwierdzone w live HTML: `grep '<meta name="twitter'` → 0)
**Fix:** obok bloku OG dodać: `<meta name="twitter:card" content="summary_large_image">` + `twitter:title`, `twitter:description`, `twitter:image` (te same wartości co OG).

### [LIVE] Sitemap `lastmod` = czas builda dla wszystkich URL-i
**Where:** `templates/project-base/astro.config.mjs` — `sitemap({ lastmod: new Date(), … })`
**Evidence:** sitemap-index: `<lastmod>2026-07-10T01:56:21.560Z</lastmod>` — każdy rebuild (np. publish z edytora) bumpuje lastmod WSZYSTKICH stron, więc sygnał świeżości jest szumem.
**Fix:** usunąć globalne `lastmod: new Date()` z configu; realne daty wpisów blog są już w `datePublished` JSON-LD. (Per-URL lastmod przez `serialize()` możliwy, ale przy 4-stronowym brochure ROI znikome.)

### [LIVE] Duplikaty trailing-slash + link wewnętrzny do wariantu niekanonicznego
**Where:** CloudFront/S3 serwuje 200 dla obu wariantów (`/blog/jak-uniknac-zamarzniecia-rur` i `…-rur/` — sprawdzone, oba 200 bez redirectu); footer linkuje `href="/polityka-prywatnosci"` (bez slasha), a canonical tej strony to wariant ze slashem
**Impact:** mitygowane canonicalem (wskazuje wariant ze slashem) — realne ryzyko niskie.
**Fix:** minimalnie: w stopce szablonu (SiteFooter.astro) ujednolicić linki do wariantów ze slashem. Opcjonalnie: CloudFront Function z 301 `path` → `path/` dla URL-i bez rozszerzenia (jedna funkcja, obie dystrybucje).

### [CONTENT] Polityka prywatności deklaruje GA4 i "zgodę na cookies", których na stronie nie ma
**Where:** wygenerowana `/polityka-prywatnosci` (tekst: „anonimowe dane analityczne z Google Analytics 4", „retencji GA4 (14 miesięcy)", „zgody na cookies"); tymczasem `features.ga4` w tym zamówieniu jest puste → `Analytics.astro` i baner cookies się nie renderują (grep `gtag|googletagmanager|cookie-consent` w home.html → 0)
**Impact:** dokument prawny nadaje zgody/procesy, które nie istnieją — odwrotność typowego ryzyka, ale u klienta bez GA4 polityka wprowadza w błąd.
**Fix:** w promptach generujących politykę (`runner/src/prompts.mjs` / szablon polityki) uzależnić sekcje GA4/cookies od `features.ga4` — analogicznie jak renderowanie `Analytics.astro`.

### [CONTENT] Title strony głównej 73 znaki — utnie się w SERP
**Where:** test content: `Hydraulik w Piasecznie i Konstancinie — awarie i biały montaż | Hydro-Bax` (73 zn. > ~60-65 widocznych)
**Fix:** to dane testowe, ale limit warto wymusić systemowo: w `runner/src/prompts.mjs` (instrukcje contentu) dodać twardy limit „title ≤ 60 znaków łącznie z ` | {brand}`".

---

## Unverified — needs re-run
- **PSI desktop** — nie odpytany (mobile wystarczył do diagnozy fontów; desktop przy TTFB 10 ms i CSS inline będzie zielony). Bez wpływu na wnioski.
- Nagłówki produkcyjnej dystrybucji go-live — wniosek o braku HSTS oparty na kodzie golive.mjs + zachowaniu preview; żadna strona klienta nie jest jeszcze live na własnej domenie do bezpośredniego sprawdzenia.

## Skipped — not applicable to this profile
- seo_panel prod DB (traffic, GSC/GA4 tail signals, I1-I6) — preview nie jest domeną trackowaną; brak danych ruchu z definicji.
- `urlcheck`/`sitecrawl` bulk pass — sitemap wskazuje URL-e na `www.kurscopywriting.pl` (obecnie INNA żywa strona) — crawl sitemapy badałby cudzy content; 4 strony preview sprawdzone ręcznie 1:1.
- L4-L6, C15-C16, crawl budget (`botlog`) — 4-stronowy brochure bez ruchu.
- C11 Product schema / pagination / faceted search — nie e-commerce.
- **Mandatory Astro checks (wykonane, bez findingów):** Consent Mode gating — `Analytics.astro` implementuje wzorzec POPRAWNIE (defaults denied przed gtag.js, gtag ładuje się od razu, banner tylko aktualizuje zgodę — bug z [[gtm-consent-gating-pattern]] NIE występuje); `Astro.redirect` — 0 użyć w pages; sitemap-slugs — n/a (auto przez @astrojs/sitemap + content collections).

---

## Sequence of recommended actions
1. **Infra (raz, kwadrans):** ResponseHeadersPolicy `X-Robots-Tag: noindex` na `PREVIEW_DIST_ID` (P1-1) + `ResponseHeadersPolicyId` SecurityHeadersPolicy w `golive.mjs` (P2-3).
2. **Runner:** dopisanie linku Blog do navigation.json przy włączaniu modułu (P1-2) + limit title i warunkowa polityka GA4 w prompts.mjs (P3).
3. **Szablon project-base:** self-host fontów (P2-1) → `author`/`image` w BlogPosting (P2-2) → Twitter Cards, usunięcie `lastmod: new Date()`, slash w linkach stopki (P3). Po zmianach szablonu: `migrate.mjs --all` dla istniejących workspace'ów zgodnie z systemem wersjonowania.
4. Żadnych działań GSC — preview nie powinien być w Search Console.

---

## Appendix — nagłówki odpowiedzi home (verbatim)
```
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 91933
Last-Modified: Fri, 10 Jul 2026 01:56:28 GMT
ETag: "c6d6a44ea69cde1c0f5f61db7bd314af"
x-amz-server-side-encryption: AES256
Server: AmazonS3
X-Cache: Miss from cloudfront
Content-Encoding: br   (przy Accept-Encoding: gzip, br)
(brak: X-Robots-Tag, Strict-Transport-Security, Cache-Control)
```

## Appendix — verification commands
```bash
curl -sIL -A "Mozilla/5.0" https://kurscopywriting.preview.sitario.com/
curl -s https://kurscopywriting.preview.sitario.com/robots.txt
curl -s https://kurscopywriting.preview.sitario.com/sitemap-index.xml
curl -s -o /dev/null -w "%{http_code}" https://kurscopywriting-edit.preview.sitario.com/
grep -c 'href="/blog' cache/kurscopywriting.preview.sitario.com/home.html   # 0
# PSI: runPagespeed?url=https://kurscopywriting.preview.sitario.com/&strategy=mobile (klucz z .env skilla)
# kod: grep -n "ResponseHeaders" D:\sitario.com\runner\src\golive.mjs  (0 hits)
#      grep -rn navigation D:\sitario.com\runner\src\migrations\003-blog-module.mjs  (0 hits)
```
Cache HTML: `D:\seo-panel\audits\cache\kurscopywriting.preview.sitario.com\` (home, blog, blogpost, polityka, sitemapy, psi-home-mobile.json)
