# SEO on-site audit — zostancopywriterem.pl
**Date:** 2026-05-25
**Profile:** E (satellite) — DB klasyfikuje `category=SATELLITE`, `linkGroup=COPY`, `linkRole=SATELLITE`; cel domeny: przekazywanie link juice do `ecopywriting.pl`. Treść jest jednak pełnowartościowymi blogowymi poradnikami, więc audyt łączy E (link flow) z B (content quality).
**Stack:** Astro 5.7.10 static export, `@astrojs/sitemap` 3.7.1, deploy: AWS S3 + CloudFront (E35OASC384C0TF), build skryptem `./deploy.sh`.
**Repo↔prod state:** w sync — `git status --short` pusty, ostatni commit `fce1d5e` (2026-03-11 09:06 CET), live `Last-Modified: Wed, 11 Mar 2026 08:06:14 GMT`. Zero driftu.
**Last crawl:** 2026-05-25 03:30 | **GSC:** 2026-05-25 06:00 | **GA4:** 2026-05-25 08:00 (ACTIVE, `properties/527889764`)
**Pages:** 17 śledzonych, 16 zaindeksowanych, 12 w sitemap | **DA:** 6 | **PA:** 19 | **Moz spam:** 7 | **Linki:** 42 z 17 domen | **GSC 28d:** 1 click, 95 impressions, avg pos 25.78

---

## ⚠ Data freshness caveats
Wszystkie cron jobs (gsc_pull, ga4_sync, indexing_check) odświeżone dziś. Dane GSC w tabeli `Page` są aktualne. Zerowy ruch z GA4 (1 click w 28d) — domenie pewnie celowo nie podbijano linków, więc ocena "skuteczności satelitarnej" musi to uwzględniać.

---

## P0 — Krytyczne (do naprawy w tym tygodniu)

### [LIVE] Linki "money" do ecopywriting.pl prowadzą do 404 — funkcja satelity jest złamana
**Where:**
- `src/content/blog/jak-zostac-copywriterem-i-zaczac-zarabiac-na-pisaniu-tekstow-na-zlecenie.md` — link `https://www.ecopywriting.pl/opisy-produktow/` i `https://www.ecopywriting.pl/uslugi-copywriterskie/`
- `src/content/blog/portfolio-copywritera-jak-stworzyc-profesjonalne-dossier-ktore-przyciagnie-klientow.md` — link `https://www.ecopywriting.pl/opisy-produktow/`
- `src/content/blog/zlecenia-i-praca-dla-copywriterow-gdzie-szukac-i-jak-znalezc-zatrudnienie-przy-pisaniu-tekstow.md` — link `https://www.ecopywriting.pl/opisy-produktow/`

**Evidence:**
```
$ curl -sI "https://www.ecopywriting.pl/opisy-produktow/"
HTTP/1.1 404 Not Found
x-amz-error-message: The specified key does not exist.

$ curl -sI "https://www.ecopywriting.pl/uslugi-copywriterskie/"
HTTP/1.1 404 Not Found

$ curl -sI "https://www.ecopywriting.pl/"
HTTP/1.1 200 OK
```
DB potwierdza: 4 z 7 outboundów na money domain są broken (`Link.isBroken=t, statusCode=404`).

**Impact:** Domena jest klasyfikowana jako SATELLITE — jej *jedyną* funkcją SEO jest przekazywanie link equity do `ecopywriting.pl`. Linki do `/opisy-produktow/` i `/uslugi-copywriterskie/` ustawione są na komercyjne, exact-match anchory ("opisy produktów", "usługi copywriterskie") — to są money linki, które miały rankować docelowe podstrony. Zamiast tego: 404, brak page rank flow, marnotrawiona praca redakcyjna 4 artykułów.

**Fix:** Jedno z dwóch:
- **(A)** Przywrócić docelowe URL-e na `ecopywriting.pl` (utworzyć podstrony `/opisy-produktow/` i `/uslugi-copywriterskie/`) — jeśli te usługi istnieją w ofercie.
- **(B)** Jeśli URL-e zostały świadomie usunięte, przekierować je 301 w CloudFront/S3 do aktualnych odpowiedników (np. `/oferta/opisy-produktow` lub do `/uslugi/`) — alternatywnie zaktualizować linki w 4 plikach .md na nowe ścieżki. Konkretnie:
  - `jak-zostac-copywriterem-...md` — szukać `ecopywriting.pl/opisy-produktow` i `ecopywriting.pl/uslugi-copywriterskie`, zamienić na działające URL-e
  - `portfolio-copywritera-...md` — szukać `ecopywriting.pl/opisy-produktow`
  - `zlecenia-i-praca-...md` — szukać `ecopywriting.pl/opisy-produktow`

### [LIVE] `og-default.jpg` zwraca 404 — wszystkie udostępnienia w social mediach są bez obrazu
**Where:** `src/components/SEOHead.astro:17` ustawia domyślny `ogImage = '/og-default.jpg'`. Plik nie istnieje w `public/` ani na S3.

**Evidence:**
```
$ ls public/
favicon.svg  robots.txt          # brak og-default.jpg

$ curl -sI "https://www.zostancopywriterem.pl/og-default.jpg"
HTTP/1.1 404 Not Found
x-amz-error-code: NoSuchKey
```
Wszystkie strony serwują `<meta property="og:image" content="https://www.zostancopywriterem.pl/og-default.jpg">` — sprawdzone na home.html, post.html, kontakt.html. `BlogPost.astro` nie przekazuje `ogImage`, więc każdy artykuł też używa zepsutego defaultu.

**Impact:** Każdy share posta na Facebooku, LinkedIn, Twitter/X, Slack pokaże szare puste pole zamiast podglądu. Dla satelity, której rola to też pasywne pozyskiwanie traffic + lekka świadomość marki, to widoczne zaniedbanie.

**Fix:**
1. Utworzyć plik `public/og-default.jpg` (1200×630, JPG ~150 KB) z logiem/hasłem "Zostań Copywriterem — blog o copywritingu". Po commitcie `./deploy.sh`.
2. (Opcjonalnie, ale rekomendowane) Dodać `heroImage` do każdego frontmatter w `src/content/blog/*.md` i przepisać `BlogPost.astro` żeby przekazywał `ogImage={post.data.heroImage}` do `<Base>`. Pole już istnieje w schemacie content collection (`src/content.config.ts:9`).

### [LIVE] Trailing-slash redirect to 302, nie 301 — Google indeksuje obie wersje URL
**Where:** Wszystkie URL-e bez końcowego slasha (np. `/blog/copywriter-a-dzialalnosc-nierejestrowana`) — domyślna konfiguracja bucketu S3 + CloudFront dla Astro static export.

**Evidence:**
```
$ curl -sI "https://www.zostancopywriterem.pl/blog/copywriter-a-dzialalnosc-nierejestrowana"
HTTP/1.1 302 Moved Temporarily
Location: /blog/copywriter-a-dzialalnosc-nierejestrowana/
```
W tabeli `Page` 7 URL-i występuje w dwóch wariantach (z slash + bez):
| Path | Indexed | Impr |
|------|---------|------|
| `/blog/copywriter-a-dzialalnosc-nierejestrowana` | PASS | 2 |
| `/blog/copywriter-a-dzialalnosc-nierejestrowana/` | PASS | 1 |
| `/blog/rynek-copywritingu-w-polsce-...` | PASS | 23 |
| `/kontakt` | PASS | 1 |
| `/kontakt/` | PASS | 1 |
(podobny duplikat dla 4 innych blog postów + `/blog/`)

Obie wersje są oznaczone "Submitted and indexed" — Google nie konsoliduje page rank, bo 302 to przekierowanie tymczasowe.

**Impact:** Link equity rozdzielone. Każdy backlink trafiający na wersję bez slasha "wisi" na 302, zamiast pełnym 301-em przekazać moc do canonical (slash). Dla domeny z DA=6 i 42 linkami przychodzącymi to zauważalna strata.

**Fix:** Konfiguracja po stronie CloudFront. W deployu Karol używa S3 jako origin. Trzeba dołożyć CloudFront Function lub Lambda@Edge na evencie `viewer-request`, która zwróci 301 zamiast 302 dla ścieżek bez końcowego slasha (oprócz plików). Szablon:
```js
function handler(event) {
  var req = event.request;
  var uri = req.uri;
  if (uri !== '/' && !uri.endsWith('/') && !uri.split('/').pop().includes('.')) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: uri + '/' } }
    };
  }
  return req;
}
```
Powiązać z dystrybucją `E35OASC384C0TF` na `viewer-request`. Po deployu wymusić invalidację `/*`.

Alternatywnie: w `astro.config.mjs` ustawić `trailingSlash: 'never'` i przebudować całość bez trailing slashy + zaktualizować sitemap. To większa zmiana — wariant 301 przez CF Function jest tańszy.

---

## P1 — Wysoki (do naprawy w tym sprincie)

### [LIVE] `/polityka-prywatnosci/` ma `noindex,nofollow` ale jest w sitemap
**Where:** `src/pages/polityka-prywatnosci/index.astro:9` (`noindex={true}`) vs `dist/sitemap-0.xml` zawiera `<loc>https://www.zostancopywriterem.pl/polityka-prywatnosci/</loc>`.

**Evidence:**
```
$ curl -s "https://www.zostancopywriterem.pl/polityka-prywatnosci/" | grep -oE '<meta name="robots"[^>]*>'
<meta name="robots" content="noindex, nofollow">

$ curl -s "https://www.zostancopywriterem.pl/sitemap-0.xml" | grep polityka
<loc>https://www.zostancopywriterem.pl/polityka-prywatnosci/</loc>
```
GSC potwierdza: `Page.coverageState='Excluded by 'noindex' tag'` dla tego URL.

**Impact:** Sprzeczny sygnał dla Google. Sitemap mówi "indeksuj", meta mówi "nie indeksuj". Marnowanie crawl budgetu i potencjalne osłabienie zaufania do sitemap (Google może rzadziej re-crawlować inne URL-e z sitemap, podejrzewając, że jest niewiarygodny).

**Fix:** W `astro.config.mjs:11` zmienić integrację sitemap na konfigurowalną z filtrem:
```js
integrations: [sitemap({
  filter: (page) => !page.includes('/polityka-prywatnosci'),
})],
```
Rebuild + deploy.

### [LIVE] Title double-suffix — site name doklejany dwa razy
**Where:** `src/components/SEOHead.astro:26` — `fullTitle = title === siteName ? title : \`${title} | ${siteName}\``. Strony, których `title` już zawiera "Zostań Copywriterem" lub "ZostanCopywriterem.pl", dostają drugi suffix.

**Evidence (3 strony dotknięte):**
```
home.html:    <title>Zostań Copywriterem — Praktyczny blog o copywritingu | Zostań Copywriterem</title>
polityka.html: <title>Polityka prywatności — ZostanCopywriterem.pl | Zostań Copywriterem</title>
```
Home `title` z `src/pages/index.astro:11` brzmi `"Zostań Copywriterem — Praktyczny blog o copywritingu"` — porównanie `=== siteName` ('Zostań Copywriterem') jest false, więc dokleja kolejne ` | Zostań Copywriterem`. Analogicznie polityka ustawia własny suffix.

**Impact:** Title 65 znaków (home) i 67 znaków (polityka — chociaż polityka jest noindex, więc neutralnie) — Google obetnie końcówkę "...gu | Zostań Copywriterem" w SERP, marnując słowa kluczowe. Powtórzenie marki w title jest też lekkim minusem rankingowym.

**Fix:** W `src/components/SEOHead.astro:26` zmienić warunek na "title nie zawiera siteName":
```diff
- const fullTitle = title === siteName ? title : `${title} | ${siteName}`;
+ const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
```
Dodatkowo:
- `src/pages/index.astro:11` — uprościć title do `"Zostań Copywriterem — praktyczny blog o copywritingu"` (po fixie wyświetli się bez podwojenia).
- `src/pages/polityka-prywatnosci/index.astro:4` — usunąć `" — ZostanCopywriterem.pl"` z `pageTitle`, zostawić samo `"Polityka prywatności"` (suffix doklei SEOHead).

### [LIVE] Article JSON-LD ma `author.@type = Organization` zamiast Person
**Where:** `src/layouts/BlogPost.astro:40-44`.

**Evidence:** Surowy JSON-LD z `post.html`:
```json
"author":{"@type":"Organization","name":"Zostań Copywriterem","url":"https://www.zostancopywriterem.pl"},
"publisher":{"@type":"Organization","name":"Zostań Copywriterem","url":"https://www.zostancopywriterem.pl"}
```

**Impact:** Google's [Article structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/article) zalecają `Person` z `name` i `url` dla `author` na artykułach. Brak osoby jako autora osłabia sygnały E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) — szczególnie boleśnie na artykułach o tematyce YMYL-like (poradniki podatkowe, ZUS, działalność nierejestrowana). Dla satelity ten sygnał decyduje o sile rankingu w niszy "jak zostać copywriterem".

Dodatkowo `publisher.Organization` powinien mieć `logo` (ImageObject z url, width, height) — brak.

**Fix:**
1. Dodać pole `author` do schematu content collection w `src/content.config.ts:9`:
   ```js
   author: z.object({ name: z.string(), url: z.string().optional() }).default({ name: 'Karol Leszczyński' }),
   ```
2. W `src/layouts/BlogPost.astro:40-44` przepisać `articleSchema.author` na:
   ```js
   "author": { "@type": "Person", "name": post.data.author.name, "url": post.data.author.url || `${siteUrl}/o-autorze` }
   ```
3. Dodać logo do `publisher` (po wgraniu np. `public/logo-512.png`):
   ```js
   "publisher": { "@type": "Organization", "name": "Zostań Copywriterem", "url": siteUrl, "logo": { "@type": "ImageObject", "url": `${siteUrl}/logo-512.png`, "width": 512, "height": 512 } }
   ```
4. (Powiązane) Dodać krótki bio autora pod artykułem (`BlogPost.astro`) z linkiem do `/o-autorze` — pomocne dla E-E-A-T i konwersji.

### [LIVE] Charset declaration po pierwszych 1024 bajtach HTML (PSI fail)
**Where:** `src/layouts/Base.astro:24-67` — head zaczyna się od ~1700 znaków inline'a Consent Mode v2 + ładowania GA4. Dopiero potem przychodzi `<SEOHead />`, który dopiero w wierszu 32 ma `<meta charset>`.

**Evidence:**
```
$ head -c 1200 home.html | tail -c 200
('functionality_storage': c.functional ? 'granted' : 'denied',
'personalization_storage': c.functional ? 'granted' : 'denied'
});
}
} catch(e)
```
PSI raport: `[score=0] charset | Charset declaration is missing or occurs too late in the HTML`.

**Impact:** Przeglądarka musi zacząć dekodować bajty domyślnym ASCII / Latin1, a gdy dochodzi do `<meta charset>` ~3000 bajtów później, czasem retry'uje parsing. Może powodować lekkie spowolnienie FCP (PSI mobile pokazuje FCP 2.9s na home, 3.6s na post — częściowo z tego). To też jedna z przyczyn wyniku performance 0.81 (home) / 0.75 (post).

**Fix:** W `src/layouts/Base.astro:24` przenieść `<meta charset="UTF-8" />` i `<meta name="viewport">` PRZED blokiem Consent Mode v2:
```astro
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!-- Google Consent Mode v2 — MUSI być PRZED gtag.js -->
  <script is:inline>
    ...
```
Wówczas `SEOHead.astro:32-33` można usunąć (lub zostawić — duplikat charset jest neutralny, browser bierze pierwszy).

### [LIVE] LCP 4.1-4.4s na mobile — render-blocking ~1.3-2.1s
**Where:** Cała witryna. Główni winowajcy:
1. **Google Fonts stylesheet** (`src/components/SEOHead.astro:42`) — `<link href="...fonts.googleapis.com/css2?family=DM+Serif+Display..." rel="stylesheet">` blokuje render do czasu pobrania.
2. **GA4 inline + async load** (`src/layouts/Base.astro:58-67`) — ładuje gtag.js synchronicznie via `<script async>` w head, plus dwa bloki inline'a, łącznie 62 KiB unused JS na first paint (PSI: `unused-javascript | Est savings of 62 KiB`).
3. **Consent Mode v2 inline** w head przed renderem.

**Evidence:** PSI mobile (2026-05-25):
- `/` — performance 0.81, LCP 4.1s, FCP 2.9s, render-blocking saves 2120 ms, unused-js 62 KiB.
- `/blog/copywriter-a-dzialalnosc-nierejestrowana/` — performance 0.75, LCP 4.4s, FCP 3.6s, render-blocking saves 1350 ms, unused-js 62 KiB.

**Impact:** LCP > 2.5s = "Poor" w Core Web Vitals. Dla satelity to dodatkowy minus rankingowy — Google używa CWV jako tie-breaker. Plus realna konwersja: użytkownik widzący białą stronę przez 4 sekundy wraca do SERP (pogo-sticking → spadek rankingu).

**Fix:** Trzy zmiany w `src/components/SEOHead.astro:39-42`:
1. Zamiast pełnego `<link rel="stylesheet">` Google Fonts użyć `font-display: swap` + preload pierwszego widocznego fonta:
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com" />
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
   <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Source+Sans+3:wght@400;600;700&display=swap" />
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Source+Sans+3:wght@400;600;700&display=swap" media="print" onload="this.media='all'" />
   ```
   (Ogranicz też wagi do tych faktycznie używanych — z 300;400;500;600;700 → 400;600;700.)
2. W `src/layouts/Base.astro:58` przesunąć `<script async src="...gtag/js?id=G-KQG8RXQPD2">` z `<head>` na koniec `<body>` (po `<Footer />` przed `<CookieConsent />`). Consent Mode v2 init zostawić w head — nie wymaga gtag już załadowanego, tylko `gtag()` jako funkcji która pushuje do dataLayer.
3. (Większa zmiana) Self-host fontów w `public/fonts/` zamiast Google Fonts CDN — to dawałoby preconnect = 0, ale wymaga skopiowania plików woff2 i wymiany URL na lokalne.

Po fixie spodziewany LCP < 2.5s, performance > 0.9.

### [LIVE] Wiele broken external links w 6 z 9 artykułów
**Where:**
- `agencja-copywriterska.pl/pisanie-artykulow/` — 404, z 2 plików: `jak-zostac-copywriterem-...md` i `produktywnosc-w-pracy-copywritera-...md`
- `support.google.com/chrome/answer/95647` — 404 (Chrome obecnie ma inny help URL), z `polityka-prywatnosci/index.astro:137`
- `support.microsoft.com/pl-pl/microsoft-edge/usuwanie-plik%C3%B3w-cookie` — 404, polityka-prywatnosci linie 140
- `support.mozilla.org/pl/kb/usuwanie-ciasteczek` — 405 (UA-block) — prawdopodobnie OK w przeglądarce, niska pewność
- `uodo.gov.pl` — 0 (timeout) — może być chwilowe, ale lepiej dodać `https://www.uodo.gov.pl/` (z www)

**Evidence:** Tabela `Link` z `seo_panel`:
```
toUrl                                          | isBroken | statusCode
https://www.agencja-copywriterska.pl/pisanie-artykulow/ |  t  | 404 (×2)
https://support.google.com/chrome/answer/95647          |  t  | 404
https://support.microsoft.com/.../usuwanie-plik%C3%B3w-cookie | t | 404
```
Live re-check `curl`:
```
$ curl -sI "https://www.agencja-copywriterska.pl/pisanie-artykulow/"
HTTP/1.1 404 Not Found
```

**Impact:** Broken outbound links to autorytatywne źródła osłabiają sygnał jakości treści. Plus user experience — czytelnik klikający na "Microsoft Edge" w polityce prywatności trafia na 404. Dla polityki to też ryzyko zgodności z RODO (linki "jak zarządzać cookies w przeglądarce" są obowiązkowe a ich brak działania to formalna luka).

**Fix:**
- `polityka-prywatnosci/index.astro:137` — zmienić Chrome link na `https://support.google.com/chrome/answer/95647?hl=pl`
- `polityka-prywatnosci/index.astro:140` — zmienić Edge link na `https://support.microsoft.com/pl-pl/windows/zarz%C4%85dzanie-plikami-cookie-w-przegl%C4%85darce-microsoft-edge-168dab11-0753-043d-7c16-ede5947fc64d` (lub zwięzły `https://support.microsoft.com/pl-pl/topic/usuwanie-plik%C3%B3w-cookie-d6c5e1d1-c11b-1c2b-3e2e-1c1f0eb50e6f`) — zweryfikować linkiem działającym z `curl`
- 2 pliki .md z linkiem do `agencja-copywriterska.pl/pisanie-artykulow/` — zamienić anchor `pisanie artykułów` na działający link (np. konkretny artykuł lub usunąć link jeśli niepotrzebny)
- `uodo.gov.pl` — zmienić na `https://www.uodo.gov.pl/`

Po naprawie uruchomić skanner linków (panel: detect_changes/link audit cron) żeby zweryfikować że wszystko zwraca 200.

### [LIVE] Formularz kontaktowy jest atrapą — pokazuje alert("Formularz wymaga podpięcia backendu")
**Where:** `src/pages/kontakt.astro:48`.

**Evidence:**
```html
<button type="button" class="btn btn-primary"
  onclick="alert('Formularz wymaga podpięcia backendu (np. Formspree, Netlify Forms lub własny endpoint).')">
  Wyślij wiadomość
</button>
```

**Impact:** Każdy użytkownik wypełniający formularz traci dane i widzi developerski komunikat. Strona `/kontakt/` ma 17 wewnętrznych linków przychodzących (DB: `internalLinksIn=17`) — jest sercem konwersji satelity. Dla domeny SATELLITE z 1 click w 28d to nie jest dziś krytyczne dla skali, ale każdy potencjalny lead jest tracony.

**Fix:** Trzy opcje, w kolejności łatwości:
1. **Formspree (najszybciej)** — dodać `action="https://formspree.io/f/<form_id>"` na `<form>` z `method="POST"`; usunąć inline onclick. ~5 min konfiguracji.
2. **Lambda + SES** w AWS — koszt $0, panel kontroli pełny. Wymaga Function URL endpointu.
3. **Usunąć formularz** i zostawić sam `mailto:kontakt@zostancopywriterem.pl` w cards po prawej (już jest). Mniej kliknięć, ale uczciwie.

Decyzja Karola — ale obecny stan (atrapa z alertem) jest najgorszy z możliwych.

### [LIVE] Money-anchor concentration do ecopywriting.pl — 100% exact-match komercyjne
**Where:** Wszystkie 7 outboundów do `ecopywriting.pl` używa wyłącznie keyword anchors:
- 3× `https://www.ecopywriting.pl/` — anchory: "agencja copywriterska" (×2), "agencji copywriterskiej" (×1)
- 3× `https://www.ecopywriting.pl/opisy-produktow/` — anchor: "opisy produktów" (×3)
- 1× `https://www.ecopywriting.pl/uslugi-copywriterskie/` — anchor: "usługi copywriterskie"

**Evidence:** Query:
```sql
SELECT "toUrl", COUNT(*), MIN("anchorText") FROM "Link" l JOIN "Page" p ON l."fromPageId"=p.id
 WHERE p."domainId"=(SELECT id FROM "Domain" WHERE domain='www.zostancopywriterem.pl')
 GROUP BY "toUrl" ORDER BY 2 DESC;
```
0% anchorów typu "tutaj" / "ecopywriting.pl" / "Karol Leszczyński" / brand. To wzorzec, który filtr Penguin Google identyfikuje jako manipulacyjny — szczególnie kiedy 100% linków z jednej satelity ma exact-match commercial keyword.

**Impact:** Ryzyko algorytmicznej penalizacji link profilu money domain (`ecopywriting.pl`). Dla satelity z 42 inbound links i DA=6 link profile-shape jest jeszcze poniżej radaru, ale jeśli Karol planuje skalować podobne strony, ten wzorzec powtórzony na 5-10 satelitach zsumuje się do oczywistego sygnału.

**Fix:** W 4 plikach .md (te z linkami do ecopywriting.pl) zmienić anchory tak, by ~30% miało brand/URL form, ~30% generic, ~40% keyword-rich:
- 1× "agencja copywriterska Karol Leszczyński" → brand-include
- 1× "ecopywriting.pl" → bare URL/brand
- 1× "agencja copywriterska" → leave as keyword
- 1× "więcej informacji o opisach produktów" → partial-match
- itd.

To również wymaga, że linki będą działać (poprzedni P0). Te dwa findingi są sprzężone.

---

## P2 — Średni (do naprawy gdy będzie czas)

### [LIVE] Sitemap nie zawiera `<lastmod>` dla żadnego URL
**Where:** `dist/sitemap-0.xml` — 12 elementów `<url>`, każdy ma tylko `<loc>`, brak `<lastmod>`.

**Evidence:**
```xml
<url><loc>https://www.zostancopywriterem.pl/</loc></url>
<url><loc>https://www.zostancopywriterem.pl/blog/</loc></url>
...
```

**Impact:** Bez `<lastmod>` Google nie wie, które URL-e zostały zaktualizowane od ostatniego crawla — wszystkie traktowane są równo, co marnuje crawl budget na strony niezmienione miesiące temu. Plus stała "freshness score" niska, bo Google nie ma sygnału świeżości spoza ich własnego crawla.

**Fix:** W `astro.config.mjs:11` przekazać options do `sitemap()`:
```js
integrations: [sitemap({
  filter: (page) => !page.includes('/polityka-prywatnosci'),
  serialize(item) {
    // For blog posts, use post pubDate/updatedDate from frontmatter
    // For static pages, use build time
    return item; // Astro sitemap auto-uses Last-Modified header or build time
  },
})],
```
Astro sitemap 3.x ustawi lastmod automatycznie jeśli zostanie wykryta data — można też dorzucić customPages z `lastmod`. Najpewniejsze rozwiązanie: pre-build hook generujący listę URL-i z faktycznymi `pubDate`/`updatedDate` z content collection.

### [LIVE] Slug `copywriter-freelancer-jak-załozyc-działalnosc.md` zawiera polskie znaki
**Where:** `src/content/blog/copywriter-freelancer-jak-załozyc-działalnosc.md` (nazwa pliku → `params.slug`).

**Evidence:**
```
$ curl -s sitemap-0.xml | grep -o "copywriter-freelancer[^<]*"
copywriter-freelancer-jak-za%C5%82ozyc-dzia%C5%82alnosc/
```
URL na żywo: `https://www.zostancopywriterem.pl/blog/copywriter-freelancer-jak-za%C5%82ozyc-dzia%C5%82alnosc/` (200 OK, indexed).

Dodatkowo slug zawiera "załozyc" (brakuje "ć" → powinno być "założyć" lub po slugifikacji `zalozyc`) — niespójność z innymi slugami które są ASCII (`copywriter-a-dzialalnosc-nierejestrowana` ma "dzialalnosc" bez "ł" "ść").

**Impact:** Trzy problemy:
1. URL-e z `%C5%82` źle wyglądają w SERP-ach i social shares (Facebook/Twitter często wyświetlają zdekodowaną wersję która łamie się typograficznie).
2. Niespójność z resztą bloga utrudnia ewentualne automatyzacje (np. canonical-fix scripts).
3. URL-e z encoded UTF-8 mają nieco gorsze CTR (badania anegdotyczne; Google nie penalizuje, ale użytkownicy unikają).

**Fix:** Zmienić nazwę pliku na ASCII-only:
1. `git mv src/content/blog/copywriter-freelancer-jak-załozyc-działalnosc.md src/content/blog/copywriter-freelancer-jak-zalozyc-dzialalnosc.md`
2. Dodać redirect 301 z starego URL na nowy:
   - Wariant CloudFront Function (jeśli wybrałeś go w P0-3): rozszerzyć handler o explicit redirect tej jednej ścieżki.
   - Wariant prostszy: w `astro.config.mjs` dodać `redirects: { '/blog/copywriter-freelancer-jak-za%C5%82ozyc-dzia%C5%82alnosc/': '/blog/copywriter-freelancer-jak-zalozyc-dzialalnosc/' }` — Astro generuje pliki redirect.

### [LIVE] Brak HSTS — nagłówek bezpieczeństwa nieobecny
**Where:** CloudFront response headers policy nie ma `Strict-Transport-Security`.

**Evidence:**
```
$ curl -sI "https://www.zostancopywriterem.pl/"
HTTP/1.1 200 OK
# brak: Strict-Transport-Security
```

**Impact:** Bez HSTS użytkownik wchodząc z linku `http://zostancopywriterem.pl` ma pierwszy hop niezabezpieczony (potem 301 do https). To wektor MITM tylko przy pierwszym wejściu, ale na CloudFront włączenie HSTS to 2 minuty.

**Fix:** W konsoli CloudFront → distribution `E35OASC384C0TF` → Behavior → Response Headers Policy → wybrać/utworzyć policy z `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. Bez preload na początek (jeśli kiedyś trzeba zejść z HTTPS na starszej subdomenie). Save → propagacja ~15 min.

### [LIVE] BlogPost.astro nie ustawia per-post og:image
**Where:** `src/layouts/BlogPost.astro:55-61` — wywołuje `<Base>` bez przekazania `ogImage`.

**Impact:** Wszystkie 9 artykułów dziedziczy domyślny `og:image` z `SEOHead.astro`, który wskazuje na zepsuty `/og-default.jpg` (P0-2). Nawet po naprawie og-default, każdy artykuł będzie miał ten sam obrazek — co społeczne shares interpretują jako spam (ten sam preview na 9 różnych linków → algorytm Facebook downranking).

**Fix:** Pole `heroImage` już istnieje w schemacie content collection (`content.config.ts:9`). Brakuje:
1. Wypełnienia frontmatter w każdym .md (np. `heroImage: /blog/dzialalnosc-nierejestrowana-cover.jpg`).
2. W `src/layouts/BlogPost.astro:55` zmienić wywołanie na:
   ```astro
   <Base title={title} description={description} ogType="article"
         ogImage={Astro.props.heroImage}
         articleDate={pubDate} articleModified={updatedDate}>
   ```
3. Dodać 9 plików obrazów `1200×630 JPG` do `public/blog/`.

### [LIVE] WebSite schema ma SearchAction wskazujący na nieistniejący endpoint
**Where:** `src/components/SEOHead.astro:74-78`.

**Evidence:**
```json
"potentialAction":{"@type":"SearchAction","target":"https://www.zostancopywriterem.pl/blog?q={search_term_string}","query-input":"required name=search_term_string"}
```
Strona `/blog/` to lista postów, nie ma parametru `?q=` ani search inputa.

**Impact:** Google's sitelinks-searchbox feature wymaga, żeby endpoint faktycznie zwracał wyniki dla `?q=foo`. Bez tego sitelinks-searchbox nie pojawi się — schema jest "ozdobą", która nic nie daje. Niska szkoda, ale fałszywy sygnał semantyczny.

**Fix:** Albo:
- **(A)** Usunąć blok `potentialAction` z JSON-LD WebSite — najprościej, satelity rzadko dostają sitelinks-searchbox tak czy inaczej.
- **(B)** Zaimplementować wyszukiwarkę na `/blog/` (client-side filter po `data.title`/`data.description` — Astro może to ogarnąć małą biblioteką jak Pagefind w 50 LOC).

---

## P3 — Polish (backlog)

- **[LIVE] Hero CTA group ma pusty placeholder** — `src/pages/index.astro:25` zawiera komentarz/whitespace gdzie wyglądało, że miał być drugi przycisk. Wyrównaj layout albo dorzuć drugi CTA "Najnowsze artykuły →" linkujący do najświeższego posta.
- **[LIVE] Footer "Ustawienia cookies" używa inline `onclick`** — `src/components/Footer.astro:30`. Sub-optimal dla CSP. Fix: użyć `addEventListener` w skrypcie albo `<button>` z `data-action="cookie-settings"`.
- **[LIVE] Header nav ma puste linie** w `src/components/Header.astro:9-10` (komentarzowe placeholdery po starym nav itemie). Sprzątnięcie.
- **[LIVE] 404 page nie sugeruje powiązanych artykułów** — `src/pages/404.astro:11` ma tylko jedno CTA "Wróć na stronę główną". Dla satelity bardzo wartościowy patch: pokaż 4 najnowsze posty z `getCollection('blog')`. Złapiesz część traffic z złamanych backlinków.
- **[LIVE] `cookie_consent` cookie SameSite=Lax + Secure** — OK ale brakuje `HttpOnly` (nie da się tu, bo skrypt musi czytać). Minor.

---

## Unverified — needs re-run
Brak. Wszystkie checki z repertuaru Profile E+B (link flow, indexation, sitemap, perf, on-page) wykonane.

## Skipped — not applicable to this profile
- **C11/C12 (Product/Offer schema)** — nie e-commerce.
- **C7 (body word count >300)** — sample post ma 18 min czytania ≈ 4000 słów, treść jest gęsta i merytoryczna. Skip — nie znaleziono problemu.
- **T16 (hreflang)** — single-language (pl-PL).
- **L1 (orphan pages)** — wszystkie 17 stron pokrytych internal linkami z home / footer / breadcrumbs; orphan analysis daje 0 znalezisk poza zduplikowanymi trailing-slash variantami (które są efektem 302, nie prawdziwym orphan — pokryte w P0-3).
- **C9/C10 (lazy-loading, oversized images)** — strona obecnie nie używa istotnych obrazów wbudowanych w artykuły (brak `heroImage` w frontmatter, sample post 38 KB HTML zero `<img>`). Sprawdzić ponownie po fixie P2-4.
- **I4 (PAGE_DEINDEXED events)** — tabela `SeoEvent` pusta dla tej domeny.
- **T21/T22/T23 (AWS infra deep dive)** — CloudFront/S3 działa, cache-control już skonfigurowane prawidłowo w `deploy.sh` (immutable dla assets, no-cache dla HTML/sitemap). Compression: CloudFront default. HSTS to jedyna luka, pokryta w P2-3.

---

## Sekwencja rekomendowanych działań

**Kolejność opcjonalna, ale priorytetowo poukładana — w trzech blokach.**

### Blok A — naprawa funkcji satelity (najpilniejsze, day 1)
1. Naprawić linki do `ecopywriting.pl` — albo utworzyć podstrony `/opisy-produktow/` i `/uslugi-copywriterskie/` na money domain, albo zmienić linki w 4 plikach .md na działające URL-e. **(P0-1)**
2. Naprawić anchory do money domain (po naprawieniu URL-i) — różnicować ~70/30 między keyword a brand/URL. **(P1-8)**
3. Sprawdzić w panelu/Moz że nowe linki są crawlowane i nie 404-ują.

### Blok B — fix techniczny pełen (day 2-3)
4. Stworzyć `public/og-default.jpg` + dodać `heroImage` do frontmatter każdego z 9 postów + przekazać przez BlogPost.astro. **(P0-2 + P2-4)**
5. Dodać CloudFront Function dla 302→301 trailing slash. **(P0-3)**
6. Wykluczyć `polityka-prywatnosci` z sitemap. **(P1-1)**
7. Fix title double-suffix w SEOHead.astro:26 (`title.includes(siteName)`). **(P1-2)**
8. Article schema → Person + logo dla publisher; dodać pole `author` do schematu collection. **(P1-3)**
9. Przesunąć `<meta charset>` na początek `<head>`. **(P1-4)**
10. Naprawić wszystkie broken external links (Chrome/Edge/Firefox helpers, agencja-copywriterska, uodo). **(P1-6)**
11. Podpiąć Formspree do formularza kontaktowego (lub usunąć formularz). **(P1-7)**

### Blok C — performance + polish (day 4-5)
12. Optymalizacja Google Fonts (preload + media swap; redukcja wag). **(P1-5)**
13. Przeniesienie `gtag.js` z head na koniec body. **(P1-5)**
14. Włączyć HSTS na CloudFront. **(P2-3)**
15. Sitemap z `<lastmod>`. **(P2-1)**
16. Rename slug z polskim znakiem + redirect 301. **(P2-2)**
17. Usunąć/naprawić `SearchAction` w WebSite schema. **(P2-5)**
18. P3 polish — 404 z related posts, hero CTA placeholder, cleanup.

### Po deployu
- Uruchomić w panelu sync sitemap (`/api/sitemap-sync`) + indexing check.
- W Search Console: złożyć ponownie sitemap (`sitemap-index.xml`). Indexing API ma limit ~10 URL/dzień/property — 16 URL-i rozłożyć na 2 dni.
- Re-run PSI po 24h dla home + 1 posta: cel `performance >= 0.9`, `LCP < 2.5s`.
- Re-run skanera link audit (`detect_changes` cron) żeby zweryfikować zerowe `Link.isBroken`.
- Monitorować w GSC przez 7-14 dni czy duplikaty trailing-slash znikają (zacznie się od page'a najświeższego, propagacja całości potrwa miesiące).

---

## Appendix — pełne dane do flagged checks

### Linki broken (DB query):
```sql
SELECT l."toUrl", l."statusCode", l."anchorText", p.path AS from_path
FROM "Link" l JOIN "Page" p ON l."fromPageId"=p.id JOIN "Domain" d ON p."domainId"=d.id
WHERE d.domain='www.zostancopywriterem.pl' AND l."isBroken"=true
ORDER BY l."statusCode" DESC, l."toUrl";
```

### Trailing-slash URL duplikaty:
```sql
SELECT path, "indexingVerdict", clicks, impressions, position
FROM "Page" p JOIN "Domain" d ON p."domainId"=d.id
WHERE d.domain='www.zostancopywriterem.pl'
ORDER BY path;
```

### PSI results (mobile, 2026-05-25):
| URL | Perf | LCP | FCP | TBT | render-blocking |
|-----|------|-----|-----|-----|------------------|
| `/` | 0.81 | 4.1s | 2.9s | low | 2,120 ms |
| `/blog/copywriter-a-dzialalnosc-nierejestrowana/` | 0.75 | 4.4s | 3.6s | 10 ms | 1,350 ms |

## Appendix — verification commands

```bash
# og:image 404
curl -sI "https://www.zostancopywriterem.pl/og-default.jpg"

# trailing-slash 302 (NOT 301)
curl -sI "https://www.zostancopywriterem.pl/blog/copywriter-a-dzialalnosc-nierejestrowana"

# polityka noindex but in sitemap
curl -s "https://www.zostancopywriterem.pl/polityka-prywatnosci/" | grep -oE '<meta name="robots"[^>]*>'
curl -s "https://www.zostancopywriterem.pl/sitemap-0.xml" | grep polityka

# broken money links
curl -sI "https://www.ecopywriting.pl/opisy-produktow/"        # 404
curl -sI "https://www.ecopywriting.pl/uslugi-copywriterskie/"   # 404

# PSI mobile
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fwww.zostancopywriterem.pl%2F&strategy=mobile&category=performance&category=seo&key=$PSI_API_KEY"

# DB sanity
ssh_exec panel "sudo -u postgres psql -d seo_panel -A -F '|' -c \"SELECT path, "indexingVerdict", "internalLinksIn", "externalLinksOut", "brokenLinksOut" FROM \\\"Page\\\" p JOIN \\\"Domain\\\" d ON p.\\\"domainId\\\"=d.id WHERE d.domain='www.zostancopywriterem.pl' ORDER BY impressions DESC NULLS LAST;\""
```
