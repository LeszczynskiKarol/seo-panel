# SEO on-site audit — ecopywriting.pl
**Date:** 2026-05-24
**Profile:** B (content site / mała agencja) — DB klasyfikuje jako SATELLITE, ale strona ma rozbudowane usługi, cennik, portfolio i blog (45 wpisów). De facto: agencyjna witryna z blogiem zapleczowym i niską metryką ruchu.
**Stack:** Astro 5.7 (static SSG), build → S3 `www.ecopywriting.pl`, dystrybucja CloudFront `E2WWVJKXX5GDZA`, apex 301-bucket dla `ecopywriting.pl` (`S3-redirect-ecopywriting-pl`). Lambdas: `contact-form/`, `presign-upload/`. GA4: `G-LJEB54X9P5` (Google Consent Mode v2).
**Repo↔prod state:** in-sync. `git status` clean, ostatni commit `a690ac6 "gotowe"`. Live `Last-Modified: Sun, 24 May 2026 08:54:43` ≈ ostatni build. Brak driftu.
**Last crawl:** 2026-05-24 03:32 | **GSC:** 2026-05-24 06:00 | **GA4:** ACTIVE (lastSync NULL — `DomainIntegration.lastSync` puste, sprawdzić cronem `ga4_sync`)
**Pages:** 77 w bazie, 19 PASS, 57 NEUTRAL, 1 UNKNOWN. Sitemap: 68 URL (1 sitemap-0.xml pod sitemap-index). **DA:** 12. **Last 28d GSC:** 1 klik, ok. 50 wyświetleń (głównie pojedyncze impresje na frazach z poz. 40-80).

---

## ⚠ Data freshness caveats
- `DomainIntegration.lastSync` dla GA4 jest NULL — nie wiadomo, czy `ga4_sync` faktycznie ściąga dane dla tej property (`properties/376706496`). Wszystkie wnioski o ruchu opierają się więc tylko na GSC.
- PSI API zwróciło puste wyniki (`Perf: None, SEO: None`) — limit IP/kwoty Google. Audyt Core Web Vitals pominięty, traffic znikomy (1 klik/28d) więc niski priorytet.

---

## ⚠ Drift summary — repo ↔ prod
Brak driftu. `git status --short` puste, brak modyfikacji ani plików nieśledzonych. `Last-Modified` produkcji pokrywa się z czasem builda.

---

## P0 — Krytyczne (do tygodnia)

### [LIVE] Trailing-slash duplication — 10 par URL zaindeksowanych osobno
**Where:** Konfiguracja CloudFront `E2WWVJKXX5GDZA` (lub bucket S3 `www.ecopywriting.pl` website hosting) — przekierowanie `/path` → `/path/` odbywa się przez `302 Moved Temporarily`, nie `301`.
**Evidence:**
```
$ curl -sIL https://www.ecopywriting.pl/uslugi/opisy-produktow
HTTP/1.1 302 Moved Temporarily
Location: /uslugi/opisy-produktow/
HTTP/1.1 200 OK

$ curl -sIL https://www.ecopywriting.pl/kontakt
HTTP/1.1 302 Moved Temporarily
Location: /kontakt/
HTTP/1.1 200 OK
```
Konsekwencja w GSC (snapshot z prod `seo_panel`, tabela `Page`):
| ścieżka bez `/` | indexingVerdict | ścieżka z `/` | indexingVerdict |
|---|---|---|---|
| `/uslugi/opisy-produktow` | PASS Submitted and indexed (7 impr.) | `/uslugi/opisy-produktow/` | PASS Submitted and indexed (10 impr.) |
| `/uslugi/teksty-na-strone` | PASS Submitted and indexed (9 impr.) | `/uslugi/teksty-na-strone/` | PASS Submitted and indexed |
| `/uslugi/ebooki` | PASS Submitted and indexed (1 impr.) | `/uslugi/ebooki/` | PASS Submitted and indexed (2 impr.) |
| `/uslugi/white-papers` | PASS Submitted and indexed (1 impr.) | `/uslugi/white-papers/` | PASS Submitted and indexed (2 impr.) |
| `/kontakt` | PASS Submitted and indexed (1 impr., 1 klik) | `/kontakt/` | PASS Submitted and indexed |
| `/o-nas` | PASS Submitted and indexed (1 impr.) | `/o-nas/` | PASS Submitted and indexed |
| `/portfolio` | PASS Submitted and indexed (1 impr.) | `/portfolio/` | PASS Submitted and indexed |
| `/polityka-prywatnosci` | PASS Submitted and indexed (1 impr.) | `/polityka-prywatnosci/` | PASS Submitted and indexed |
| `/blog/5-krokow-do-idealnego-opisu-produktu` | PASS Submitted and indexed (1 impr.) | `/blog/5-krokow-do-idealnego-opisu-produktu/` | PASS Submitted and indexed (2 impr.) |
| `/blog/30-porad-dla-copywritera-ktore-usprawnia-twoja-prace` | UNKNOWN (1 impr.) | `/blog/30-porad-dla-copywritera-ktore-usprawnia-twoja-prace/` | NEUTRAL URL is unknown to Google |

**Impact:** Google traktuje 302 jako tymczasowe i utrzymuje **obie** wersje w indeksie. Link equity dzieli się na pół, sygnały rankingowe są rozcieńczone, dochodzi do duplicate-content. Przy DA 12 i 1 kliku/28d każda strata equity to realny minus. Sitemap zawiera tylko warianty z `/`, więc warianty bez `/` nigdy nie powinny być w indeksie.
**Fix:** Dodać CloudFront Function (viewer-request) wymuszającą 301:
1. AWS Console → CloudFront → Functions → Create function `ecopywriting-trailing-slash`:
```javascript
function handler(event) {
  var req = event.request;
  var uri = req.uri;
  if (uri !== '/' && !uri.endsWith('/') && !uri.includes('.')) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: uri + '/' + (req.querystring ? '?' + Object.keys(req.querystring).map(k => k + '=' + req.querystring[k].value).join('&') : '') } }
    };
  }
  return req;
}
```
2. Distribution `E2WWVJKXX5GDZA` → Behaviors → Default → Edit → Function associations → Viewer request → wybrać funkcję.
3. Po wdrożeniu: w GSC > URL Inspection wykonać **Request Indexing** dla każdej wersji z `/` (10 URL, w limicie ~10/dzień Google rate-limits — zmieści się w jednym dniu).
4. Sprawdzić `curl -sIL "https://www.ecopywriting.pl/kontakt"` — powinno zwrócić `HTTP/1.1 301`, nie `302`.

### [LIVE] Blog index `/blog/` "Crawled — currently not indexed"
**Where:** `https://www.ecopywriting.pl/blog/` (źródło: `src/pages/blog/index.astro`). DB: `indexingVerdict=NEUTRAL`, `coverageState=Crawled - currently not indexed`.
**Evidence:** Strona zawiera tylko `<SectionHeading>` z subtitle "Artykuły o strategii treści…" (≈30 słów) + grid kart wpisów (`<h2>` w każdej karcie + data + opis). `grep -oE '<p[^>]*>[^<]+</p>' eco-blog-index.html | wc -l` = 48 paragrafów (ale to głównie krótkie opisy w kartach). Brak wstępu, brak kategoryzacji, brak tekstu wprowadzającego do tematyki — Google ocenił to jako thin/duplicate content i nie indeksuje.
**Impact:** `/blog/` jest jedynym hubem prowadzącym do 45 wpisów. Niezaindeksowany hub = obniżona zachęta dla Google do indeksowania głębszych URL. Faktycznie obserwujemy: 32 z 45 wpisów blogowych ma status "URL is unknown to Google" (Google nigdy ich nie widział).
**Fix:** Dodać do `src/pages/blog/index.astro` przed `<section class="blog-list">` blok wprowadzający z ≥200 słów tekstu (kim jesteśmy, dla kogo blog, jakie tematy poruszamy, jak korzystać):
```astro
<section class="blog-intro">
  <div class="container-narrow">
    <p class="blog-intro__lead">Na blogu eCopywriting.pl publikujemy artykuły… (200+ słów: opis tematyki, target audience, częstotliwość, autor, kompetencje agencji w obszarze copywriting / SEO / content marketing).</p>
  </div>
</section>
```
Po publikacji: GSC URL Inspection → `https://www.ecopywriting.pl/blog/` → Request Indexing.

### [LIVE] 32 z 45 wpisów blogowych: "URL is unknown to Google"
**Where:** Tabela `Page` (prod `seo_panel`):
```sql
SELECT path, "coverageState" FROM "Page"
WHERE "domainId"='cmn9fo4ec000bqrdyl9rqenzx'
  AND path LIKE '/blog/%/'
  AND "coverageState"='URL is unknown to Google';
```
**Evidence:** 32 wpisów blogowych jest w sitemap (`sitemap-0.xml` zawiera wszystkie 45 wpisów), ale Google nigdy ich nie odwiedził. Pozostałe 13 wpisów ma status `Crawled - currently not indexed` (Google widział, ale nie zaindeksował). Tylko 1 wpis blogowy (`/blog/5-krokow-do-idealnego-opisu-produktu/`) jest `PASS Submitted and indexed`.
**Impact:** Cały blog (45 podstron, łącznie ~50 tys. słów contentu) jest praktycznie niewidoczny w Google. Dla witryny zapleczowo-portfoliowej to oznacza zerowy zwrot z tej części contentu.
**Fix:** Trzy działania równolegle:
1. Naprawić `/blog/` (poprzedni punkt) — bez tego ten fix nie zadziała.
2. Naprawić meta description (patrz P1 niżej) — większość ma "ucięte" opisy, co Google może traktować jako sygnał niskiej jakości.
3. Stopniowo zgłaszać wpisy do indeksacji przez GSC URL Inspection, max **10 URL/dzień** (Google rate-limit Request Indexing). Priorytet:
   - Najpierw 10 wpisów z wyższym `internalLinksIn` w sitemap (np. `/blog/storytelling-historie-narracja-sluzbie-twojej-marce/`, `/blog/jak-pisac-wyraziste-i-przykuwajace-uwage-naglowki/`)
   - Pozostałe rozłożyć na 5 kolejnych dni.

---

## P1 — Wysokie (do końca sprintu)

### [LIVE] Meta description ucięta w połowie słowa w ≥38 wpisach blogowych
**Where:** Wszystkie pliki `src/content/blog/*.md` w `description:` we frontmatter. Najpewniej generowane historycznie jako pierwsze ~150 znaków treści.
**Evidence:** Sample 13 z 45 frontmatterów (z `head -1` description'ów):
| plik | description (koniec) |
|---|---|
| `5-krokow-do-idealnego-opisu-produktu.md` | "…dobrze napisany i niepowtarzalny opis produktu **z**" |
| `7-zrodel-inspiracji-copywritera.md` | "…na określony temat, ale brak Ci weny **i**" |
| `8-wskazowek-jak-pisac-tekst-na-firmowa-strone-www.md` | "…dlatego zlecasz jej wykonanie fachowcom, dbasz **o**" |
| `budowa-i-struktura-artykulu-blogowego.md` | "…w mgnieniu oka? **Dlaczego**" |
| `content-marketing-czym-jest-i-na-czym-polega.md` | "…zajmującą pół witryny, **od**" |
| `czym-jest-copywriting-typologia.md` | "…dziedzinę, **jaką jest**" |
| `dlaczego-potrzebujesz-copywritera.md` | "…Myślisz **sobie:**" |
| `ebook-jako-narzedzie-content-marketingowe.md` | "…ale **po**" |
| `jak-kupic-teksty-w-internecie.md` | "…wziąć skądś **teksty**" |
| `optymalizacja-tresci-pod-seo-…` | "…blogowym, **,**" |
| `recykling-tresci-…` | "…zauważysz pewną **powtarzalność**" |
| `social-proof-…` | "…tej informacji szukasz, prawda? W takim razie dowiedz się, " |

Wyjątek: `ai-w-pisaniu-akademickim-vs-copywriting.md` ma poprawnie ukończony description: "Praktyczne spojrzenie copywritera na narzędzia AI do generowania prac dyplomowych. Czym pisanie akademickie różni się od copywritingu, kiedy generator AI radzi sobie świetnie, a kiedy potrzebny jest człowiek. Konkretne wnioski." — czyli model już istnieje.

**Impact:** Description trafia do SERP jako snippet (BaseLayout.astro:24 `<meta name="description" content={description}>`). Snippet kończący się słowem typu "z", "po", "i" wygląda na błąd techniczny — drastycznie obniża CTR i sygnalizuje Google'owi niską jakość. Dla 38+ wpisów to systemowy problem.

**Fix:** Przepisać `description:` w każdym frontmatterze `src/content/blog/*.md` na 130–155 znaków, kończąc pełną myśl (jak w `ai-w-pisaniu-akademickim-vs-copywriting.md`). Wzorzec: pierwsze zdanie = problem/intencja, drugie = obietnica wartości. Po edycji: `npm run build && ./deploy.sh`. Plików do zedytowania: 38 (lista pełna w Appendix).

### [LIVE] Cennik (`/cennik/`) i 11 podstron usług: "URL is unknown to Google"
**Where:** Tabela `Page`:
- `/cennik/` — URL is unknown to Google
- `/uslugi/artykuly-blogowe/`, `/uslugi/copywriting/`, `/uslugi/dokumentacja-techniczna/`, `/uslugi/email-marketing/`, `/uslugi/katalogi-broszury/`, `/uslugi/landing-page/`, `/uslugi/materialy-szkoleniowe/`, `/uslugi/prezentacje/`, `/uslugi/seo-copywriting/`, `/uslugi/social-media/`, `/uslugi/strategia-content-marketingowa/` — URL is unknown to Google

**Evidence:** Tylko 4 z 15 podstron `/uslugi/` są zaindeksowane (`opisy-produktow`, `teksty-na-strone`, `ebooki`, `white-papers`). Cennik — strona o najwyższej intencji konwersyjnej — nigdy nie był odwiedzony przez Google. Sitemap zawiera wszystkie te URL (potwierdzone w `sitemap-0.xml`).

**Impact:** 11 podstron `/uslugi/` i cennik to praktycznie cała strategia akwizycji organicznej witryny. Dla witryny pozycjonującej frazy typu "agencja copywriterska" (pozycja 46 → spadek -4) i "teksty na stronę internetową" (pozycja 70 → spadek -16, ostatnie 3 dni — patrz P2 niżej), brak tych podstron w indeksie = brak pola gry.

**Fix:** Po wdrożeniu fixów P0 (trailing slash + blog index), zgłaszać w GSC URL Inspection → Request Indexing, **max 10/dzień**:
- Dzień 1: `/cennik/`, `/uslugi/copywriting/`, `/uslugi/seo-copywriting/`, `/uslugi/artykuly-blogowe/`, `/uslugi/email-marketing/`, `/uslugi/strategia-content-marketingowa/`, `/uslugi/landing-page/`, `/uslugi/dokumentacja-techniczna/`, `/uslugi/social-media/`, `/uslugi/materialy-szkoleniowe/`
- Dzień 2: `/uslugi/katalogi-broszury/`, `/uslugi/prezentacje/` + 8 wpisów blogowych
Pamiętać, że limit GSC ~10 URL/dzień/property jest twardy.

### [LIVE] Brak `og:image` i `twitter:image` na każdej stronie
**Where:** `src/layouts/BaseLayout.astro:30-44` — sekcja Open Graph + Twitter Card. Tag `og:image` nie istnieje (potwierdzone `grep -oE 'og:image' eco-home.html` = pusto).
**Evidence:** `grep -oE 'og:[a-z:]+|twitter:[a-z:]+' eco-home.html | sort -u` zwraca: `og:description, og:locale, og:site, og:title, og:type, og:url, twitter:card, twitter:description, twitter:title` — **brak og:image i twitter:image**.
**Impact:** Każdy share w Facebook/LinkedIn/Slack/Discord pokazuje brak miniatury → CTR i wiarygodność znacząco obniżone. `twitter:card="summary_large_image"` bez `twitter:image` to wewnętrznie niespójna deklaracja.
**Fix:**
1. Dodać do `public/` plik `og-default.png` 1200×630 (logo + tagline + tło z brandingu).
2. W `src/layouts/BaseLayout.astro` w sekcji `interface Props {` dodać `ogImage?: string;` oraz `const { ..., ogImage = 'https://www.ecopywriting.pl/og-default.png' } = Astro.props;`. W sekcji `<head>` po `og:locale` dodać:
```astro
<meta property="og:image" content={ogImage} />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:image" content={ogImage} />
```
3. W `BlogPostLayout.astro` dorobić logikę: jeśli we frontmatterze wpisu jest `image:`, użyć tego; inaczej og-default.
4. `npm run build && ./deploy.sh`.

### [LIVE] Brak nagłówka HSTS
**Where:** Distribution `E2WWVJKXX5GDZA` — Response headers policy nie dodaje `Strict-Transport-Security`.
**Evidence:** `curl -sI https://www.ecopywriting.pl/ | grep -i strict` → brak wyniku.
**Impact:** Brak ochrony przed downgrade attack przy pierwszej wizycie. Lekki minus do oceny technicznej; nie ma bezpośredniego wpływu na ranking, ale Google i przeglądarki to monitorują (m.in. Lighthouse "Best Practices").
**Fix:** AWS Console → CloudFront → Policies → Response headers → Create policy `ecopywriting-security-headers`:
- Strict-Transport-Security: `max-age=31536000; includeSubDomains; preload`
- X-Content-Type-Options: `nosniff`
- Referrer-Policy: `strict-origin-when-cross-origin`
Przypisać do dystrybucji `E2WWVJKXX5GDZA` → Behaviors → Default → Response headers policy.

---

## P2 — Średnie (gdy będzie pojemność)

### [LIVE] http → https → www: łańcuch 2 hopów zamiast 1
**Where:** Apex CloudFront (S3 redirect bucket `S3-redirect-ecopywriting-pl`) ustawiony na ViewerProtocolPolicy `redirect-to-https`, ale origin S3 website hosting nie wie nic o www → trafia w domyślny redirect.
**Evidence:**
```
$ curl -sIL http://ecopywriting.pl/
HTTP/1.1 301 Moved Permanently  Location: https://ecopywriting.pl/   (CloudFront)
HTTP/1.1 301 Moved Permanently  Location: https://www.ecopywriting.pl/  (AmazonS3)
HTTP/1.1 200 OK
```
**Impact:** Każde wejście od użytkownika/bota z `http://ecopywriting.pl` traci jeden hop. Mały wpływ na CrUX/LCP, niewielki na crawl budget — ale dla witryny niskoruchowej drugi hop jest niepotrzebny.
**Fix:** W bucket S3 `ecopywriting.pl` (redirect bucket) zmienić Static website hosting → Redirect requests for an object → Host name: `www.ecopywriting.pl`, Protocol: `https`. CloudFront origin protocol policy zostawić jak jest (http-only do S3 website endpoint). Test: `curl -sIL http://ecopywriting.pl/` powinno pokazać **jeden** 301 prowadzący od razu do `https://www.ecopywriting.pl/`.

### [LIVE] Sitemap bez `<lastmod>`
**Where:** `src/sitemap.xml` (generowany przez `@astrojs/sitemap` plug-in z `astro.config.mjs`).
**Evidence:** `curl -s https://www.ecopywriting.pl/sitemap-0.xml | head` — każdy `<url>` zawiera tylko `<loc>`, brak `<lastmod>`, `<changefreq>`, `<priority>`.
**Impact:** Google pomija sygnały aktualizacji — Googlebot nie wie, czy stary wpis blogowy z 2015 r. został zaktualizowany. Dla witryny, której większość wpisów to artykuły z 2015-2018, to relevant — re-crawl jest mniej priorytetowy.
**Fix:** `astro.config.mjs`: zastąpić `sitemap()` przez `sitemap({ serialize: (item) => { item.lastmod = new Date().toISOString().split('T')[0]; return item; } })` lub — bardziej poprawnie — dla wpisów blogowych użyć `updated || date` z frontmatter. Wzorzec patrz dokumentacja `@astrojs/sitemap` (`customPages`, `entryLimit`, `serialize`).

### [LIVE] Position drops na kluczowych frazach (last 3 dni)
**Where:** `SeoEvent` typu `POSITION_DROPPED` z `importance ≥ 2`:
| query | from | to | change | data |
|---|---|---|---|---|
| `ebook copywriting` | 14.0 | 23.6 | **-9.7** (utrata top-20) | 2026-05-24 |
| `teksty na stronę internetową` | 58.9 → 70.6 → 69.1 | — | -16 / +1.5 (oscylacja) | 22→23→24 |
| `opisy produktów do sklepów internetowych` | 44.0 → 48.6 → 54.1 | — | konsekwentny spadek -10.1 | 22→23→24 |
| `agencja copywriterska` | 42.3 | 46.0 | -3.7 | 2026-05-23 |
**Impact:** Spadki o 4-16 pozycji są małe w bezwzględnym ruchu (frazy są na poz. 40-70, więc nie generują kliknięć), ale **trend jest systemowy**: 3 kolejne dni, te same frazy, ten sam kierunek. To albo objaw aktualizacji algorytmu Google, albo regresji technicznej (sprawdzić: czy commit `a690ac6 "gotowe"` z ostatnich dni czegoś nie popsuł — `git show a690ac6 --stat`).
**Fix:** Monitoring przez 7 dni. Jeśli spadki utrzymują się i `ebook copywriting` nie wróci > 20: re-audytować podstronę `/uslugi/ebooki/` pod kątem regresji on-page (po fixach P0/P1).

### [LIVE] BACKLINK_LOST: 10 backlinków utraconych 2026-05-24
**Where:** `SeoEvent` typu `BACKLINK_LOST` z 2026-05-24.
**Evidence:** Źródła: `pages.dev` (puca.pages.dev/03/...), `wearethecity.com`, `tntcode.com`, `myworthweb.com`, `example3.com`. Linki celują w stronę główną i (zaskakująco) w `https://www.ecopywriting.pl/joplin-pineapple-rag-essay-analysis` — URL który **nie istnieje w sitemap ani w `Page`**.
**Impact:** Dla DA 12 utrata 10 linków w jeden dzień jest mierzalna. Dwa zastrzeżenia: (a) część źródeł (`pages.dev`, `example3.com`) wygląda na ruch botowy / spam, (b) URL `joplin-pineapple-rag-essay-analysis` to artefakt po starszej witrynie WordPress lub spammerska próba.
**Fix:**
1. Zweryfikować, czy `https://www.ecopywriting.pl/joplin-pineapple-rag-essay-analysis` zwraca 404 (oczekiwane) lub jest soft-404. Komenda: `curl -sI "https://www.ecopywriting.pl/joplin-pineapple-rag-essay-analysis"`.
2. Jeśli `wearethecity.com` i `tntcode.com` to wartościowe domeny (DA > 30), sprawdzić w Ahrefs/Moz, czemu link został usunięty (404 na ich końcu? zmiana treści?). Pozostałych pages.dev / example3.com można zignorować jako spam.

---

## P3 — Polish (backlog)

### [LIVE] Schema.org `Article` (BlogPostLayout) bez pola `image`
**Where:** `src/layouts/BlogPostLayout.astro:28-46` — definicja `blogSchema`.
**Evidence:** Schema dla typu `Article` ma tylko `headline`, `description`, `datePublished`, opcjonalnie `dateModified`, `author`, `publisher`, `mainEntityOfPage`. **Brak `image`** — Google's strukturalna walidacja oznacza `image` jako "recommended" dla Article (https://developers.google.com/search/docs/appearance/structured-data/article). Bez `image`, Google nie wzbogaca SERP o wizualizację (np. w karuzelach Top Stories).
**Fix:** Dorobić `image` do schemy (po fixie P1 z og:image): `"image": Astro.props.image || 'https://www.ecopywriting.pl/og-default.png'`.

### [LIVE] Brak `sameAs` w schema Organization
**Where:** `src/pages/index.astro:14-30` — JSON-LD `ProfessionalService`.
**Evidence:** Schema zawiera `name`, `url`, `description`, `email`, `areaServed`, `serviceType`, `knowsAbout`. **Brak `sameAs`** wskazującego na profile społecznościowe / LinkedIn / Facebook agencji.
**Impact:** Knowledge Panel / entity recognition w Google działa lepiej, gdy `sameAs` wskazuje na zewnętrzne profile firmy.
**Fix:** Dodać do schemy ProfessionalService `"sameAs": ["https://www.linkedin.com/company/ecopywriting", "https://www.facebook.com/ecopywriting"]` (lub innych, jeśli istnieją).

### [LIVE] Brak referer-policy / x-content-type-options
**Where:** Te same nagłówki co P1 HSTS — patrz fix HSTS, gdzie response headers policy je obejmie.

---

## Unverified — needs re-run
- **Core Web Vitals (T17 PSI)** — PSI API zwróciło `score: None` (limit IP/kwoty Google). Re-run z API key (`GOOGLE_APPLICATION_CREDENTIALS` w D:\seo-panel) albo bezpośrednio https://pagespeed.web.dev/analysis?url=https://www.ecopywriting.pl/. Dla satellite z 1 klikiem/28d to niski priorytet.
- **GA4 lastSync NULL** — sprawdzić cron `ga4_sync` na panelu, czy obejmuje `properties/376706496` dla tej domeny. Komenda: `mcp__claude_ai_mcp_torweb_pl__ssh_exec host=panel command="pm2 logs ga4_sync --lines 100 --nostream | grep -i ecopywriting"`.

## Skipped — not applicable to this profile
- **C11/C12 Product schema** — nie e-commerce, brak produktów. Schema typu Service/ProfessionalService/FAQPage/Article już jest i jest poprawna.
- **T16 hreflang** — strona jednojęzyczna (`lang="pl"`).
- **L1 orphan analysis pełne** — 77 stron, header/footer linkuje do wszystkich kluczowych URL (`internalLinksIn=76` na wszystkich indeksowanych stronach top-poziomu). Graf wewnętrzny nie ma sieroty.
- **T21 Route53** — apex+www CloudFront aliasy działają, nie wymaga deepdive.

---

## Sequence of recommended actions

**1. Deploy infrastruktury (CloudFront, ~30 min, jednorazowo):**
   a. Stworzyć CloudFront Function `ecopywriting-trailing-slash`, podpiąć do dystrybucji `E2WWVJKXX5GDZA` (fix P0.1).
   b. Stworzyć Response Headers Policy `ecopywriting-security-headers` z HSTS + nosniff + referrer (fix P1.HSTS, P3.headers).
   c. W bucket `ecopywriting.pl` (redirect): zmienić host docelowy na `www.ecopywriting.pl` z protokołem `https` (fix P2.redirect-chain).
   d. CloudFront → Create Invalidation `/*`.

**2. Edycje contentu w repo (`src/`, ~3-4h):**
   a. `src/pages/blog/index.astro` — dodać sekcję wprowadzającą ≥200 słów (fix P0.2).
   b. `src/layouts/BaseLayout.astro` — dorobić `og:image` + `twitter:image` (fix P1.og-image).
   c. `src/layouts/BlogPostLayout.astro` — dorobić `image` w Article schema (fix P3.article-image).
   d. `src/pages/index.astro` — dorobić `sameAs` w ProfessionalService schema (fix P3.sameAs).
   e. `astro.config.mjs` — `sitemap({ serialize: … })` z `lastmod` (fix P2.lastmod).
   f. `public/og-default.png` — wygenerować 1200×630 (Canva / dowolne narzędzie graficzne).
   g. `src/content/blog/*.md` — przepisać `description:` we frontmatterze 38 plików (fix P1.meta-desc). Najobszerniejsza pozycja — można zacząć od top 10 wpisów z największą liczbą impr/lastInternalLinks.

**3. Build + deploy:**
   `cd D:/ecopywriting.pl && npm run build && ./deploy.sh`. Po zakończeniu sprawdzić: `curl -sIL https://www.ecopywriting.pl/kontakt` → 301 (nie 302), `curl -sI https://www.ecopywriting.pl/ | grep -i strict-transport` → niepuste.

**4. GSC re-submission (kilka dni, ze względu na rate-limit ~10 URL/dzień/property):**
   - Dzień 1: 10 URL — kluczowe duplicaty z `/` (te z fix P0.1) + `/blog/` + `/cennik/`
   - Dzień 2: 10 URL — pozostałe `/uslugi/...` (artykuly-blogowe, copywriting, seo-copywriting, …)
   - Dzień 3-7: po 10 wpisów blogowych dziennie (rozłożone)
   Pamiętać: re-submission cluster przed naprawą trailing-slash 302 jest **nieefektywny** — Google znowu zobaczy 302 i utrzyma duplicaty.

**5. Monitoring (7 dni po deploy):**
   - GSC: sprawdzić, czy duplicaty bez `/` zostały usunięte z indeksu (Coverage report).
   - `SeoEvent` w prod DB: czy `POSITION_DROPPED` na "ebook copywriting", "teksty na stronę internetową" zatrzymały się.

---

## Appendix — pełne listy URL do zgłoszenia w GSC

### Trailing-slash duplicaty (10 par, po naprawie CloudFront Function):
```
/uslugi/opisy-produktow/
/uslugi/teksty-na-strone/
/uslugi/ebooki/
/uslugi/white-papers/
/kontakt/
/o-nas/
/portfolio/
/polityka-prywatnosci/
/blog/5-krokow-do-idealnego-opisu-produktu/
/blog/30-porad-dla-copywritera-ktore-usprawnia-twoja-prace/
```

### Podstrony `/uslugi/` "URL is unknown to Google" (11):
```
/uslugi/artykuly-blogowe/
/uslugi/copywriting/
/uslugi/dokumentacja-techniczna/
/uslugi/email-marketing/
/uslugi/katalogi-broszury/
/uslugi/landing-page/
/uslugi/materialy-szkoleniowe/
/uslugi/prezentacje/
/uslugi/seo-copywriting/
/uslugi/social-media/
/uslugi/strategia-content-marketingowa/
```

### Inne nieznane Google'owi (1):
```
/cennik/
```

### Wpisy blogowe "URL is unknown to Google" (32):
```
/blog/10-bledow-copywritera-ktore-niszcza-efekty-twojej-pracy/
/blog/10-powodow-dla-ktorych-warto-prowadzic-firmowego-bloga/
/blog/30-porad-dla-copywritera-ktore-usprawnia-twoja-prace/
/blog/6-bledow-w-tresci-w-sklepach-internetowych-czego-sie-wystrzegac-wypelniajac-witryne-tekstem/
/blog/7-powodow-dla-ktorych-warto-inwestowac-w-content-marketing/
/blog/7-zrodel-inspiracji-copywritera/
/blog/budowa-i-struktura-artykulu-blogowego/
/blog/copywriting-case-study-1-domowy-kosmetyk/
/blog/czym-jest-copywriting-typologia/
/blog/dlaczego-potrzebujesz-copywritera/
/blog/jak-kupic-teksty-w-internecie/
/blog/jak-pisac-teksty-sprzedazowe-10-porad-dzieki-ktorym-przygotujesz-skuteczna-oferte/
/blog/jak-pisac-wyraziste-i-przykuwajace-uwage-naglowki/
/blog/jak-sie-czyta-w-internecie/
/blog/jak-wybrac-domene-uwzgledniajac-aspekty-kreatywne-techniczne-i-pozycjonujace/
/blog/jak-zatrudnic-copywritera-i-nie-dac-sie-oszukac/
/blog/jak-zwracac-sie-odbiorcow-czyli-sztuka-komunikacji-jezykowej/
/blog/mozg-na-sprzedaz-jak-jezyk-reklamy-ksztaltuje-twoje-wybory/
/blog/naming-typy-i-rodzaje-nazw-marek/
/blog/nie-tylko-tekst-czyli-jak-wzbogacic-artykul-aby-byc-czytany/
/blog/opis-aukcji-allegro-skuteczny-sposob-wieksza-sprzedaz/
/blog/optymalizacja-tresci-pod-seo-skuteczne-pozycjonowanie-i-wysokie-pozycje-dzieki-copywritingowi/
/blog/pisac-skuteczne-ciekawe-teksty-strony-www/
/blog/pisanie-tekstu-o-nas-czyli-misja-wizja-twojej-firmy/
/blog/piwo-telezakupy-i-copywriting-czyli-kilka-slow-o-znaczeniu-tresci-w-marketingu/
/blog/rola-funkcje-i-znaczenie-naglowkow-w-tekscie-dlaczego-sa-istotne/
/blog/schemat-aida-copywritingu-sprzedawaj-slowem-dzieki-sprawdzonemu-modelowi/
/blog/semantyka-i-semiotyka-jezyka-reklamy-ozywiaj-slowa-i-tworz-skuteczne-komunikaty-dzieki-narzedziom-jezykowym/
/blog/skutecznosc-w-content-marketingu-czym-jest-jak-mierzyc/
/blog/slowa-kluczowe-seo-copywritingu-poradnik-stosowac/
/blog/social-proof-spoleczny-dowod-slusznosci-w-marketingu-i-sprzedazy/
/blog/storytelling-historie-narracja-sluzbie-twojej-marce/
/blog/strategia-content-marketingowa-jak-ja-zaplanowac-przygotowac-i-wdrozyc/
/blog/tajemnica-dobrych-tekstow-zapleczowych-ktore-skutecznie-pozycjonuja/
```

### Wpisy blogowe "Crawled — currently not indexed" (13):
```
/blog/
/blog/4-najwazniejsze-wnioski-z-raportu-czas-na-content/
/blog/8-wskazowek-jak-pisac-tekst-na-firmowa-strone-www/
/blog/content-marketing-czym-jest-i-na-czym-polega/
/blog/czym-jest-copywriting-kim-jest-copywriter/
/blog/ebook-jako-narzedzie-content-marketingowe/
/blog/jak-napisac-opis-produktu-do-sklepu-internetowego-ktory-sprzedaje-i-wspiera-seo/
/blog/jak-pisac-tresci-ktorymi-czytelnicy-beda-sie-dzielic/
/blog/recykling-tresci-czyli-tworzyc-tekstow-jeden-temat/
/blog/tresc-dla-sklepu-internetowego-jak-zwiekszyc-sprzedaz-poprzez-copywriting/
/blog/wszystko-co-chcesz-wiedziec-o-artykule-sponsorowanym/
```

---

## Appendix — komendy weryfikacyjne (do re-runu)

```bash
# Verify trailing-slash 301 (po deploy fixu P0.1)
curl -sIL "https://www.ecopywriting.pl/kontakt"            # ma być 301, nie 302
curl -sIL "https://www.ecopywriting.pl/uslugi/copywriting" # 301

# Verify HSTS (po deploy fixu P1.HSTS)
curl -sI "https://www.ecopywriting.pl/" | grep -i strict

# Verify og:image (po deploy fixu P1.og-image)
curl -s "https://www.ecopywriting.pl/" | grep -oE 'og:image[^>]*'

# Verify redirect chain to 1 hop (po fixie P2)
curl -sIL "http://ecopywriting.pl/" | grep -E "^HTTP|^Location"

# Database snapshot — duplicaty na liście:
sudo -u postgres psql -d seo_panel -A -F "|" -c "
  SELECT REPLACE(path,'/','') stem, COUNT(*), ARRAY_AGG(path)
  FROM \"Page\"
  WHERE \"domainId\"='cmn9fo4ec000bqrdyl9rqenzx'
  GROUP BY REPLACE(path,'/','')
  HAVING COUNT(*)>1;"

# Database snapshot — pages not in Google's index:
sudo -u postgres psql -d seo_panel -A -F "|" -c "
  SELECT path, \"coverageState\"
  FROM \"Page\"
  WHERE \"domainId\"='cmn9fo4ec000bqrdyl9rqenzx'
    AND \"indexingVerdict\"!='PASS'
  ORDER BY path;"
```
