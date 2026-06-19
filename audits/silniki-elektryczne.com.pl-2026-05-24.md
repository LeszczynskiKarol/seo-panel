# SEO on-site audit — silniki-elektryczne.com.pl
**Date:** 2026-05-24
**Profile:** C (e-commerce) — Astro frontend + Fastify/Prisma backend; 812 produktów + 92 producentów + 83 power-pages + 33 kategorii (+power dup) + 16 static/city + 9 blog + 8 legal = ~1053 URL-e w sitemap, 1141 stron tracked w panelu, 926 indexed wg GSC.
**Stack:** Astro SSR + Fastify (Node), Prisma → Postgres, nginx, deploy via `deploy.sh` na VPS AWS, repo `stojan-shop-new` (D:\stojan-shop-new).
**Repo↔prod state:** in-sync dla wszystkiego SEO-istotnego. Lokalnie 3 zmiany — `.gitignore` (+frpc.toml), `scripts/dev-start.sh` (dev tooling, frpc tunnel), `scripts/start-frpc.sh` (untracked, dev tooling). Żadna z nich nie dotyczy live HTML / SEO. Last commit 2026-05-24 15:30 — świeże.
**Last crawl:** 2026-05-24 03:29 | **GSC:** 2026-05-24 06:00 | **GA4:** 2026-05-24 08:00 (ACTIVE, propertyId 374102839)
**Pages:** 2709 tracked, 1032 PASS, 217 NEUTRAL, 1460 UNKNOWN | **DA:** 19 | **GSC ostatnio:** ~60 kliknięć/dzień, ~3300 impressions/dzień (14d avg).

---

## ⚠ Drift summary — repo ↔ prod
Brak driftu SEO-istotnego. Lokalne zmiany w `scripts/dev-start.sh` + `.gitignore` + `scripts/start-frpc.sh` to wyłącznie tooling dev (tunel frpc) — nie wpływają na production HTML, sitemap, robots, ani buildowane artefakty.

---

## P0 — Critical (fix this week)

### [LIVE] Sitemap producentów emituje 92 URL-e z podwójnym prefiksem `/marka-producent/marka-producent/<slug>` — wszystkie 404
**Where:**
- Sitemap: `https://www.silniki-elektryczne.com.pl/sitemap-manufacturers.xml`
- Generator: `backend/src/routes/sitemap.ts:102-129`
- Źródło danych: prod Postgres, tabela `Manufacturer.slug` — wartości typu `marka-producent/siemens` zamiast `siemens`
- Strona docelowa działa pod poprawnym URL: `frontend/src/pages/marka-producent/[slug].astro`

**Evidence:**
```
$ curl -s sitemap-manufacturers.xml | grep -c "marka-producent/marka-producent"
92

$ curl -sI "https://www.silniki-elektryczne.com.pl/marka-producent/marka-producent/siemens"
HTTP/1.1 404
$ curl -sI "https://www.silniki-elektryczne.com.pl/marka-producent/siemens"
HTTP/1.1 200
```
Panel `GscPageDaily` pokazuje **204 stron oznaczonych przez Google jako "Not found (404)"**, wszystkie pasują do wzorca `/marka-producent/marka-producent/<slug>` (próbka 25 — wszystkie z `inSitemap=true`).

Kod w `sitemap.ts:124` generuje `loc: \`/marka-producent/${m.slug}\`` — sam template jest poprawny. Bug siedzi w danych: `Manufacturer.slug` w produkcyjnym Postgres zawiera prefix `marka-producent/`, więc finalny URL ma duplikat segmentu.

**Impact:**
- 92 URL-i w sitemap aktywnie marnuje crawl budget Google.
- GSC raport "Pages not indexed" pokazuje 204 strony 404 z sitemap — psuje "Sitemap coverage" w GSC.
- Strona `/marka-producent/indukta` ma już 3 kliknięcia/28d (pos 11.2) — pozostałe 91 producentów mogłoby dorzucić podobny ruch, gdyby były indeksowane.
- Sygnał jakości domeny — Google obniża zaufanie, gdy duża część zgłoszonych URL-i jest 404.

**Fix:**
1. Wybierz jedno z dwóch (poprawka danych jest czystsza):
   - **(rekomendowane)** Wyczyść kolumnę `Manufacturer.slug` w prod DB:
     ```sql
     UPDATE "Manufacturer" SET slug = REPLACE(slug, 'marka-producent/', '') WHERE slug LIKE 'marka-producent/%';
     ```
     Uruchom przez `mcp__claude_ai_mcp_torweb_pl__ssh_exec` na produkcji (DB hostowana razem z aplikacją na VPS `16.171.6.205`).
   - **(plaster)** W `backend/src/routes/sitemap.ts:124` zmień na:
     ```ts
     loc: `/marka-producent/${m.slug.replace(/^marka-producent\//, '')}`,
     ```
2. Po naprawie zgłoś sitemap-manufacturers.xml ponownie w GSC (URL → Submit). Google sam wycofa stare 404 w ~2 tyg.
3. Sprawdź czy `frontend/src/pages/marka-producent/[slug].astro` nie zapisuje gdzieś `slug` w bazie z prefixem (skąd to się wzięło?) — szukaj seed/import scripts.

---

## P1 — High (fix this sprint)

### [LIVE] 5 stron z >50 impressions i 0 kliknięć w 28d — snippet/CTR opportunity na ~430 imp/m-c
**Where:**
| URL | Impr | Pos | Problem |
|---|---|---|---|
| `/silniki-elektryczne-2-2-kw` | 104 | 10.3 | Pozycja na granicy 1. strony |
| `/jednofazowe/silnik-elektryczny-025kw-2900obr-1fazowy-230v` | 92 | 5.8 | 0 kliknięć przy pos 5.8 — title/desc nie sprzedają |
| `/silniki-elektryczne-3-kw` | 92 | 8.0 | Pozycja 8 — snippet do poprawy |
| `/blog/jak-dziala-silnik-elektryczny` | 87 | 10.7 | Blog post na granicy strony |
| `/silniki-elektryczne-4-kw` | 54 | 9.2 | Pozycja 9 |

**Evidence:** `Page` table, ostatnie 28d. Verbatim z DB powyżej.

**Impact:** 5 stron × średnio ~85 imp = ~430 impressions/miesiąc generuje 0 kliknięć. Realne ~2-5% CTR przy poprawie pozycji + snippeta = +10-20 kliknięć/m-c (czyli +15-30% obecnego ruchu).

**Fix (konkretnie, per URL):**
1. **`/silniki-elektryczne-2-2-kw`** — sprawdź obecny `<title>` (najpewniej szablon "Silniki elektryczne 2,2 kW — X szt. od Y zł | Stojan"). Dodaj do title konkretną wartość-trigger: liczbę obrotów lub typ ("3-fazowe, 1400 obr"). Powód: 2,2 kW to standard 3-faz/1400 — searcher szuka konkretu, nie ogólnika.
2. **`/jednofazowe/silnik-elektryczny-025kw-2900obr-1fazowy-230v`** — pos 5.8 i 0 click oznacza, że dopasowanie jest, ale snippet nie wzywa do akcji. Sprawdź meta description w `Product.metaDescription` (Prisma). Dodaj: cenę brutto, "wysyłka 24h", stan magazynowy. Patrz wzorzec produktu top: `/trojfazowe/silnik-elektryczny-08kw-1400obr-3fazowy-tamel-ex-ese-14a-075` (3 clicks/13 imp = 23% CTR — snippet działa).
3. **`/silniki-elektryczne-3-kw`** — analogicznie do (1), z naciskiem na CTA w description.
4. **`/blog/jak-dziala-silnik-elektryczny`** — pozycja 10.7 to "ostatnia widoczna" pozycja w SERP. Sprawdź długość artykułu (>1500 słów?), dodaj FAQ JSON-LD na końcu (mocny CTR booster dla blog SERP). Również: powiąż wewnętrznie z `/blog/budowa-silnika-elektrycznego` (2 clicks, działa).
5. **`/silniki-elektryczne-4-kw`** — jak (1).

### [LIVE] 129 stron orphaned (internalLinksIn=0) z ruchem GSC (clicks≥1 OR impressions≥5)
**Where:** Wszystkie produktowe URL-e których nie ma w żadnym listingu kategorii/producenta po wyczerpaniu paginacji + niektóre kombinacje power-pages. Pełna lista — patrz appendix CSV.

**Evidence:**
```sql
SELECT COUNT(*) FROM "Page" WHERE "domainId"=... AND "internalLinksIn"=0
  AND (clicks > 0 OR impressions > 5) AND "indexingVerdict" != 'NEUTRAL'
→ 129
```
Spośród top-25 stron z ruchem 8 ma `internalLinksIn=0` — m.in. `/trojfazowe/silnik-elektryczny-08kw-1400obr-3fazowy-tamel-ex-ese-14a-075` (top click page, 5 clicks/28d, 0 inbound links wg crawlera).

**Caveat:** crawler panelu mógł nie zindeksować linków z paginacji `?page=2..N` (bo `?` jest disallowed w robots). Realnie strony mogą być dostępne z listingu — ale dla SEO to ten sam efekt: Google też ich nie znajdzie bez kliknięcia paginacji, więc PageRank do nich nie spływa.

**Impact:** Strony o najwyższym potencjalnym CTR (pos 1-5 dla 8 z 25 top) nie dostają wewnętrznego juice'a. Każde 100 spadku PageRank na produkt ≈ -10-20% impressions.

**Fix:**
1. Na stronach kategorii (`/trojfazowe`, `/jednofazowe`, ...) dodaj sekcję "Bestsellery" / "Polecane" z 8-12 produktami opartymi o realny ruch GSC (top-clicked z tej kategorii). To natychmiast nadaje internalLinksIn≥1 dla głównych traffic-driverów.
2. Na stronie produktu dodaj sekcję "Podobne silniki" z 4-6 produktami z tej samej kategorii+moc±bucket. Patrz: silnik-elektryczny-08kw → linki do innych 0,75-1,1 kW 1400obr.
3. Footer już linkuje do power-pages (`internalLinksIn=1054` dla większości power-pages — to footer-driven). Rozważ dodanie 6-8 "best sellers" w footerze rotacyjnie.

### [LIVE] Sitemap-categories.xml i sitemap-power-pages.xml duplikują te same 23 power-page URL-e
**Where:**
- `backend/src/routes/sitemap.ts:44-57` (sitemap-categories) — generator z `Category.findMany()`
- `backend/src/routes/sitemap.ts:132-196` (sitemap-power-pages) — hardcoded lista mocy

**Evidence:** `/sitemap-categories.xml` zawiera 33 `<url>` z czego 23 to power-pages (`/silniki-elektryczne-3-kw`, `/silniki-elektryczne-009-kw`, ...). Te same URL-e są też w `/sitemap-power-pages.xml` (83 entries). Powód: w prod DB jest tabela `Category` która zawiera power-pages jako rekordy (slug-y `silniki-elektryczne-3-kw` etc.) — historyczne. Generator kategorii bierze WSZYSTKO z tabeli.

**Impact:** Google odrzuca duplikaty (nie ma szkody crawlerskiej), ale:
- GSC "Sitemap coverage" pokazuje sztucznie zawyżoną liczbę URL-i.
- Lastmod-y są niespójne — w sitemap-categories power-pages mają lastmod `2025-02-03` (15 m-cy temu, z `Category.updatedAt`), a w sitemap-power-pages nie mają lastmod w ogóle. Google używa najnowszego lastmod ze wszystkich źródeł — tu OK, ale konfuzja.
- Trudno śledzić rzeczywistą strukturę.

**Fix:** W `sitemap.ts:44-57` (sitemap-categories) odfiltruj power-page sluga:
```ts
const categories = await prisma.category.findMany({
  select: { slug: true, updatedAt: true },
  where: { NOT: { slug: { startsWith: 'silniki-elektryczne-' } } },  // wyklucz power-pages
});
```
Alternatywnie: w DB oznacz power-pages flagą `isPowerPage: true` i filtruj po niej (czyściej semantycznie). Powód, że nie czystszy fix: nie wiem, czy `Category` records jeszcze do czegoś służą w admin/back-office.

### [WORKFLOW] `Disallow: /szukaj` + `<meta noindex>` jednocześnie — Google nie zobaczy noindex
**Where:**
- `public/robots.txt` (deployed) — `Disallow: /szukaj`
- `/szukaj?q=...` zwraca `<meta name="robots" content="noindex, follow, max-image-preview:large">` (verified live)

**Evidence:**
```
$ curl -s "https://...com.pl/szukaj?q=test" | grep robots
<meta name="robots" content="noindex, follow, max-image-preview:large">
```
Komentarz w robots.txt: `# Strona wyszukiwania (ma noindex, ale blokujemy też crawl)` — autor jest świadomy.

**Impact:** Niski — bo `/szukaj` rzadko jest linkowane z zewnątrz. Ale **technicznie błędne**: gdy strona jest disallowed, Googlebot nie pobiera HTML, więc nie widzi `<meta noindex>`. Jeśli ktoś zalinkuje `/szukaj?q=cokolwiek` z zewnątrz, Google MOŻE pokazać URL w SERP jako "indexed without content" (sam URL, bez title/description, z nagłówkiem typu "A description for this result is not available because of this site's robots.txt").

**Fix:** Wybierz jedno:
- **Opcja A (preferowana, modern best practice):** usuń `Disallow: /szukaj` z robots.txt — niech Google fetchuje i widzi noindex. Strona zostanie szybciej wycofana z indeksu, jeśli kiedyś tam trafiła. `?q=...` i tak jest zablokowane przez `Disallow: /*?*q=`.
- **Opcja B:** zostaw blokadę w robots.txt + dodaj nginx-level `X-Robots-Tag: noindex` dla path `/szukaj` (nagłówek widoczny bez fetchowania HTML). W nginx conf `silniki-elektryczne.com.pl.conf`:
  ```nginx
  location /szukaj { add_header X-Robots-Tag "noindex, follow" always; proxy_pass ...; }
  ```

---

## P2 — Medium (fix when capacity allows)

### [LIVE] H1 na homepage ("Silniki elektryczne — znajdź i zamów") nie zawiera kluczowej intencji-frazy
**Where:** `frontend/src/pages/index.astro` (lub komponent hero używany na home — szukaj po klasie `text-3xl md:text-4xl lg:text-5xl font-bold mb-4`).

**Evidence:** Strona home ma `<h1>Silniki elektryczne — znajdź i zamów</h1>` (po dekodowaniu `&mdash;` i `&nbsp;`). Title strony to `Silniki elektryczne - sklep, hurtownia | Oferta, ceny, sprzedaż`. Title używa fraz wysokiej intencji ("sklep", "hurtownia", "oferta", "ceny", "sprzedaż"), H1 używa generycznego CTA "znajdź i zamów". GSC dla home: 5 clicks / 171 imp / pos 12.8 w 28d (pos 12 = strona 2!).

**Impact:** Home jest na pos 12.8 dla głównej frazy — przesunięcie do top-10 to 3-5× więcej ruchu. H1 jako sygnał semantyczny ma drugą wagę po title.

**Fix:** W komponencie hero zmień H1 na frazę bliższą title i intencji:
```diff
- <h1>Silniki elektryczne — znajdź i zamów</h1>
+ <h1>Silniki elektryczne — sklep i hurtownia, używane i nowe od 0,09 do 200 kW</h1>
```
Argument: zawiera "sklep i hurtownia" (z title), zakres mocy (długi ogon LSI), dodaje "używane i nowe" (klasa zapytań z GSC).

### [CONTENT] Tracked-keyword opportunities — pos 5-10 z impressions >40
Patrz appendix "CTR opportunities" — 14 stron z pos 4-10 i impressions ≥20. Dla każdego: jeśli pos 4-7 → CTR boost (snippet/title); jeśli pos 7-10 → content depth + internal linking.

Top kandydaci:
- `/silniki-elektryczne-5-5-kw` (pos 5.3, 95 imp, CTR 3.2%) — solidny target
- `/silniki-elektryczne-22-kw` (pos 7.1, 82 imp, CTR 1.2%) — bardzo niska CTR vs pozycja, problem ze snippetem
- `/motoreduktory/motoreduktor-przekladnia-025kw-15obr-3fazowy-nord` (pos 7.9, 84 imp, CTR 1.2%) — to długi ogon produktowy z dużym wolumenem

**Fix:** Jeden sprint na "snippet sweep" — przejść top-15 stron z pos 4-10 i przepisać title+meta po wzorcu top-CTR-pages.

### [WORKFLOW] 1460 stron z `indexingVerdict='UNKNOWN'` — panel nie inspekcjonuje nowo dodanych URL-i
**Where:** Postgres `seo_panel.Page` — pole `firstSubmitted` jest NULL dla 1460 z 2709 rekordów.

**Evidence:** sample 5 wierszy z UNKNOWN — wszystkie mają `firstSubmitted=NULL`, `lastChecked=NULL`. To akcesoria/falowniki — produkty istnieją na żywo (sitemap-products je listuje), ale panel SEO nie odpalił dla nich GSC URL Inspection.

**Impact:** Niski dla SEO produkcyjnego (Google indeksuje niezależnie od panelu). Ale audytowanie jest niepełne — nie wiemy ile z tych 1460 jest zaindexowanych, a ile np. ma "Crawled - not indexed".

**Fix:** Uruchom batch URL Inspection dla wszystkich `Page WHERE firstSubmitted IS NULL` w panelu — to job dla seo-panel backend, nie dla tego repo. **Uwaga: GSC URL Inspection API ma limit ~2000/dzień/property — 1460 zmieści się w 1 dniu.** (Inny limit niż Request Indexing!)

### [LIVE] Brak `Cache-Control` w response headers na HTML
**Where:** nginx config `silniki-elektryczne.com.pl.conf` w repo + na VPS.

**Evidence:**
```
$ curl -sI "https://www.silniki-elektryczne.com.pl/"
HTTP/1.1 200 OK
Server: nginx/1.24.0
Date: ...
Content-Type: text/html
Connection: keep-alive
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
...
[brak Cache-Control, brak ETag, brak Last-Modified]
```
Brak nagłówków cache na HTML kategorii/produktów — każdy fetch przez Googlebot jest pełną odpowiedzią backendu.

**Impact:** Nie szkoda SEO bezpośrednio, ale: (a) Googlebot nie może użyć conditional GET (If-Modified-Since) → wyższe obciążenie + wolniejszy crawl rate; (b) brak Last-Modified utrudnia Google decyzję, jak często recrawl-ować.

**Fix:** W nginx dla `text/html`:
```nginx
location / {
  proxy_pass http://backend;
  proxy_hide_header Cache-Control;
  add_header Cache-Control "public, max-age=300, stale-while-revalidate=86400" always;
}
```
+ ewentualnie wystaw `Last-Modified` z backendu (Fastify) na podstawie `Product.updatedAt`/`Category.updatedAt`.

---

## P3 — Polish (backlog)

- **HTTP→HTTPS→www = 2 hop redirect chain** dla apex: `http://silniki-elektryczne.com.pl/` → `https://silniki-elektryczne.com.pl/` (301) → `https://www.silniki-elektryczne.com.pl/` (301). 1 dodatkowy hop. Fix w nginx: na server bloku dla `silniki-elektryczne.com.pl:80` przekieruj bezpośrednio do `https://www.silniki-elektryczne.com.pl$request_uri`.
- **Status code `404 OK`** w response line — Fastify/nginx zwraca `HTTP/1.1 404 OK` zamiast `HTTP/1.1 404 Not Found`. Status code jest poprawny (404), ale reason phrase jest błędny. Bez wpływu na SEO (Google liczy się tylko z numerem), ale wskazuje na drobny bug w którymś middlewarze. Powinno być `HTTP/1.1 404 Not Found`.
- **2 strony z `Duplicate, Google chose different canonical than user`** w GSC: `/z-hamulcem/silnik-elektryczny-4kw-960obr-3fazowy-hamulec-indukta` i `/jednofazowe/silnik-elektryczny-018kw-1400obr-1fazowy-230v`. Google znalazł duplikat. Sprawdź dane produktu (czy istnieje też w innej kategorii ze swoim URL).
- **9 stron `Crawled - currently not indexed`** — niska wartość per-page; jak będzie capacity, sprawdź czy to thin content vs duplicate. Nie blockuje niczego.
- **Lastmod-y z Lutego 2025 w sitemap-categories.xml** dla power-pages (np. `/silniki-elektryczne-200-kw` lastmod `2025-02-03`). Po wprowadzeniu zmian w content power-pages bump-uj `Category.updatedAt` lub zignoruj (lastmod nie jest decydujące dla Google od ~2023).

---

## Unverified — needs re-run
- **PageSpeed Insights (LCP/CLS/INP)** — nie odpalone (PSI ma swój limit, a domena ma niskie traffic; CWV nie jest tu priorytetem). Jeśli chcesz CWV, powiedz — odpalę dla home + top 5 stron.
- **`marka-producent/marka-producent/*` źródło danych** — nie zweryfikowałem przyczyny w produkcyjnym Postgres (skąd `slug` ma prefix). Wymaga `ssh_exec` + `psql` na VPS, żeby potwierdzić w `Manufacturer.slug`. Fix jest niezależny od źródła (UPDATE działa zarówno gdy seed był buggy jak i gdy admin-UI zapisuje źle).
- **Strony city** (`/silniki-elektryczne-warszawa` etc.) — nie ma ich w `Page` table seo-panela (0 rows). Nie wiem, czy mają trafficcGSC. Jak panel je doczyta przy następnym crawlu — sprawdzę.

## Skipped — not applicable to this profile
- **C7 word count >300** — produkty mają z założenia krótki opis; nie ma sensu liczyć słów per-page dla 812 produktów.
- **C8 brakujące alt-y (mass count)** — spot-check na produkcie pokazał 22 img, 0 z pustym alt. Brak systemowego problemu.
- **C13 placeholder text** — kod jest production-ready (ostatnie commity to fixy/poprawki, nie boilerplate).
- **L4 broken external links na high-click pages** — DB pokazuje 0 stron z `brokenLinksOut > 0`. Nic do roboty.
- **L5 excessive external links** — nie ma sensu dla sklepu (zewnętrzne linki minimalne).
- **L6 anchor concentration** — strony nie linkują masowo do zewnętrznych money sites (sklep wewnętrzny).
- **T16 hreflang** — strona jedno-językowa PL; obecny `<link rel="alternate" hreflang="pl-PL">` + `x-default` na home jest wystarczający.
- **T17 PSI/CWV deep dive** — niska wartość przy 60 clicks/day; do zrobienia gdy będzie czas (patrz Unverified).
- **T19 HSTS** — działa: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` na live. ✓
- **T20 favicon** — istnieje 4-wariantowy favicon set + manifest. ✓
- **T21-T23 AWS infra** — VPS na EC2 + nginx; nie ma CloudFront/S3 dla static-site, więc nie aplikowalne.
- **Profile E satellite checks** — to nie satellite, to e-commerce.

---

## Sequence of recommended actions

**1. Hotfix produkcyjny (DB UPDATE) — 5 minut:**
```bash
ssh ubuntu@16.171.6.205 'cd /home/ubuntu/apps/stojan-shop/backend && PGPASSWORD=... psql -U stojan -d stojan_shop -c "UPDATE \"Manufacturer\" SET slug = REPLACE(slug, '\''marka-producent/'\'', '\'''\'') WHERE slug LIKE '\''marka-producent/%'\'';"'
```
(lub przez `mcp__claude_ai_mcp_torweb_pl__ssh_exec` jeśli skonfigurowane dla tego VPS — wg memory `vps-access-refs.md` ten VPS nie jest w hosts.json, więc raczej manualny SSH).

Po naprawie: `curl https://www.silniki-elektryczne.com.pl/sitemap-manufacturers.xml | grep -c "marka-producent/marka-producent"` powinno zwrócić `0`.

**2. Zgłoś poprawione sitemap-y w GSC** (1 minuta) — re-submit `/sitemap_index.xml`. **Uwaga: Request-Indexing API limit ~10 URL/dzień/property — nie odpalaj batch URL Inspection dla 92 producentów, sam sitemap re-submit wystarczy, Google przekomercjalizuje w ~2 tyg.**

**3. Snippet/title sweep dla 5 top opportunity pages** (1-2h pracy redakcyjnej) — patrz P1 fix instructions per URL.

**4. Fix H1 na home** — 1 edycja w Astro template, deploy. 5 minut.

**5. Internal linking pass** (1-2 dni dev) — sekcja "Bestsellery" w categorii + "Podobne silniki" na produktach.

**6. Sitemap dedup** — 5-min PR w `sitemap.ts:44-57` z filtrem `NOT slug startsWith 'silniki-elektryczne-'`.

**7. nginx Cache-Control + bezpośredni redirect apex→www** — drobny diff w `silniki-elektryczne.com.pl.conf`.

**8. Decyzja: `/szukaj` robots strategy** — wybór A vs B z P1.

---

## Appendix — verification commands

```bash
# Drift check (mandatory)
git -C D:/stojan-shop-new status --short
git -C D:/stojan-shop-new log -1 --format=%ai

# Redirect chain
curl -sIL -A "Mozilla/5.0" "http://silniki-elektryczne.com.pl/"
curl -sIL -A "Mozilla/5.0" "https://silniki-elektryczne.com.pl/"

# Robots + sitemap shape
curl -s "https://www.silniki-elektryczne.com.pl/robots.txt"
curl -s "https://www.silniki-elektryczne.com.pl/sitemap_index.xml"

# Manufacturer 404 confirm
curl -s "https://www.silniki-elektryczne.com.pl/sitemap-manufacturers.xml" | grep -c "marka-producent/marka-producent"
curl -sI "https://www.silniki-elektryczne.com.pl/marka-producent/marka-producent/siemens"
curl -sI "https://www.silniki-elektryczne.com.pl/marka-producent/siemens"

# DB queries (panel)
PGPASSWORD='...' psql -h localhost -U postgres -d seo_panel -c "
  SELECT \"coverageState\", COUNT(*) FROM \"Page\"
  WHERE \"domainId\"=(SELECT id FROM \"Domain\" WHERE domain='www.silniki-elektryczne.com.pl')
    AND \"indexingVerdict\" != 'PASS' GROUP BY \"coverageState\";
"

# 404 URL pattern
PGPASSWORD='...' psql -h localhost -U postgres -d seo_panel -c "
  SELECT url FROM \"Page\"
  WHERE \"domainId\"=(SELECT id FROM \"Domain\" WHERE domain='www.silniki-elektryczne.com.pl')
    AND \"coverageState\"='Not found (404)' LIMIT 5;
"
```

## Appendix — top GSC pages 28d (verbatim)
```
url                                              | clicks | impr | pos | verdict | links_in
/skup-silnikow                                   |    5   |  59  | 8.8 | PASS    | 1054
/                                                |    5   | 171  |12.8 | PASS    | 1056
/trojfazowe/silnik-elektryczny-08kw-tamel-ese-14a|    3   |  13  | 2.8 | UNKNOWN |    0
/silniki-elektryczne-1-5-kw                      |    3   |  62  | 7.2 | PASS    | 1054
/trojfazowe/silnik-elektryczny-5-5kw-siemens     |    3   |   8  | 4.3 | UNKNOWN |    0
/silniki-elektryczne-5-5-kw                      |    3   |  95  | 5.3 | PASS    | 1054
/marka-producent/indukta                         |    3   |  21  |11.2 | UNKNOWN |    0
/trojfazowe/silnik-pierscieniowy-sudg-180l-8     |    3   |   7  | 7.9 | UNKNOWN |    0
/blog/budowa-silnika-elektrycznego               |    2   |  96  | 9.3 | PASS    |    1
/silniki-elektryczne-11-kw                       |    2   |  27  | 6.4 | PASS    | 1054
... (15 więcej w panelu)
```
