# SEO audit (on-site + off-site) — smart-copy.ai
**Date:** 2026-08-09
**STATUS: WDROŻONE 2026-08-09 ~11:10** (commity `d180bd7` + `e007195`, deploy zielony, zweryfikowane live) — szczegóły w sekcji "Log wdrożenia" na końcu.
**Profile:** D (SaaS landing + blog contentowy audytowany po B) — konwersja jest celem, blog jest kanałem akwizycji.
**Stack:** Astro 5 SSG (`frontend-public`, EN w root + PL w `/pl/`, build per-locale) + Vite SPA (panel, robots-disallowed) + Fastify backend (sitemap dynamiczny), nginx na VPS `panel`.
**Repo↔prod state:** in-sync dla SEO — build produkcyjny z 2026-06-08 12:18 zawiera oba commity SEO z 8.06 (`a1f78fc`, `b66dd95`); niezacommitowane zmiany w repo to wyłącznie dev-configi (proxy/HMR/frpc). Brak driftu wpływającego na produkcję.
**Last crawl:** 2026-08-09 05:04 | **GSC pull:** 2026-08-09 06:01 | **GA4 sync:** 2026-08-09 08:01 (wszystko świeże)
**Pages:** 50 tracked, 49 verdict PASS wg GSC inspection, 52 URL w sitemapie (100% status 200) | **DA:** 10 / PA 22
**Last 28d:** GSC ~29 klików / ~2500 wyświetleń (śr. pozycja 17–26) | GA4: 19 sesji (10 organic), **0 konwersji**

---

## TL;DR diagnoza

On-site jest w dobrym stanie technicznym (redirecty wzorowe, sitemap+hreflang OK, canonicale OK, schema bez fake ratingu, consent mode v2 poprawny, 404 działa). Wąskie gardło to **autorytet domeny (off-site) i CTR/snippety** — 44 zaindeksowane strony wiszą na pozycjach 8–25 i generują ~1 klik dziennie. Największe dźwignie: linki edycyjne spoza własnej sieci, naprawa og-image, odchudzenie coverów (LCP), snippety (title/description).

---

## P0 — Critical
*(brak — strona jest indeksowalna, serwuje 200, sitemap i przekierowania działają)*

## P1 — High (ten sprint)

### [LIVE] og:image na stronie głównej i fallback schema wskazują na nieistniejący plik → 404
**Where:** `https://www.smart-copy.ai/og-default.png` (użyty w `og:image` na home EN i PL) oraz fallback w `frontend-public/src/components/seo/BlogPostingSchema.astro:32` (`image: coverImage ?? ${site}/og-default.png`). W `frontend-public/public/` jest tylko `robots.txt` — pliku nigdy nie było w repo.
**Evidence:** `curl -sI https://www.smart-copy.ai/og-default.png` → `HTTP/1.1 404 Not Found` (cross-check: GET też 404, 162 B body nginx). `ls frontend-public/public/` → tylko `robots.txt`.
**Impact:** udostępnienia home/pillarów na LinkedIn/FB/X renderują się bez obrazka (niższy CTR z social); dla wpisów bez covera schema `BlogPosting.image` jest martwym URL-em (walidator rich results to odrzuci).
**Fix:** dodać plik `frontend-public/public/og-default.png` (1200×630, JPG/PNG ≤ 200 KB, logo + claim "AI Text Generator — Smart-Copy.ai"), commit + rebuild public (workflow "Rebuild public"). Zero zmian w kodzie — ścieżki już są poprawne.

### [LIVE] LCP 4.4–6.3 s na /pl i wpisach blogowych — covery 650 KB JPEG z gołego S3 eu-north-1 bez cache
**Where:** wpisy blogowe (`/blog/*`, `/pl/blog/*`) i pośrednio `/pl`; covery z `smart-copy-user-sources.s3.eu-north-1.amazonaws.com/blog-covers/*`.
**Evidence:** PSI mobile 2026-08-09: blog post perf 0.73, **LCP 6.3 s**; `/pl` perf 0.78, LCP 4.4 s; home 0.87, LCP 3.3 s. `curl -sI …/1770393593789-ai_content_2026.jpg` → `200`, `Content-Length: 649675`, **brak nagłówka Cache-Control**, brak WebP.
**Impact:** Profile D — LCP > 4 s na stronach wejściowych obniża konwersję i jest czynnikiem rankingowym (CWV). Brak danych CrUX (za mały ruch), więc liczy się lab.
**Fix (3 kroki, każdy niezależnie pomaga):**
1. Przy uploadzie covera w backendzie (miejsce, gdzie leci `PutObject` do `blog-covers/`) dodać kompresję do WebP ~1200 px szerokości, cel ≤ 150 KB, oraz `CacheControl: "public, max-age=31536000, immutable"` w parametrach PutObject. Istniejące pliki przewalczyć jednorazowym skryptem (lista ~30 coverów).
2. W szablonie wpisu (`frontend-public/src/pages/blog/[slug].astro`) upewnić się, że hero-cover ma `fetchpriority="high"` i `loading="eager"`, a covery w listingu/related — `loading="lazy"`.
3. Docelowo: CloudFront przed bucketem albo proxy przez nginx `location /blog-covers/` z `proxy_cache` — usuwa RTT do Sztokholmu.

### [CONTENT/OFF-SITE] Zero linków edycyjnych spoza własnej sieci — DA 10 blokuje cały ruch
**Where:** profil linkowy domeny (BacklinkSnapshot, 35 domen źródłowych).
**Evidence:** żywe linki pochodzą wyłącznie z sieci Karola: `1copywriting.pl` (68), `karol-leszczynski.pl` (31), `magisterkaonline.com.pl` (28), `torweb.pl` (12), `ebookcopywriting.pl` (6), `copywriting-blog.pl` (1) — wszystkie z anchorem brandowym "Smart-Copy.AI". Reszta to spam (niżej). Śr. pozycja domeny 17–26 przy 44 zaindeksowanych stronach i przyzwoitym on-site = klasyczny deficyt autorytetu.
**Impact:** to jest główny hamulec: strony rankują na poz. 8–25 ("generator tekstów seo" ~10, "smart copy ai" 10–15, "ai sales copy" ~31) — tuż pod progiem klikalności.
**Fix (konkretne, kolejność wg ROI):**
1. Katalogi SaaS/AI (bezpłatne, dofollow lub przynajmniej ruch): There's An AI For That, Futurepedia, AlternativeTo, Product Hunt (launch), SaaSHub, G2/Capterra (profil darmowy). 8–10 zgłoszeń = pierwsze niezależne domeny linkujące.
2. 2–3 gościnne artykuły eksperckie PL (case "multi-agent 150 stron" jest unikalny) — branżowe blogi marketingowe/e-commerce.
3. W sieci własnej zdywersyfikować część anchorów z "Smart-Copy.AI" na frazowe ("generator tekstów AI", "AI copywriter") — obecnie 100% brand.

## P2 — Medium

### [CONTENT] Meta descriptions ~198 znaków na wszystkich stronach szablonowych — obcinane w SERP
**Where:** home EN/PL, pillary (zmierzono: `home`, `pillar.html` = 198 zn., `pl.html` = 198 zn.).
**Evidence:** `<meta name="description">` na home EN: "Smart-Copy.ai AI text generator - professional AI content creation. Generate articles, product descriptions, reports in 8 languages. From $1.08/10…" (198 zn.).
**Impact:** Google tnie po ~155–160 zn. — ucięta wartość ("From $1.08…" znika), niższy CTR przy pozycjach 8–20, gdzie snippet decyduje.
**Fix:** skrócić descriptions do 140–155 zn. z ceną/USP na początku, np. EN home: "AI text generator: articles, product descriptions and reports in 8 languages. Pay per character — from $1.08 per 10k chars, no subscription." (145 zn.). Pliki: źródła i18n `frontend/src/locales/{en,pl}/*.json` (klucze meta) — te same, które konsumuje Astro przez alias `@locales`.

### [LIVE] Klaster "Discovered/Crawled — currently not indexed" na aktualnych URL-ach
**Where:** m.in. `/pl/blog` (index bloga PL!), `/pl/blog/generowanie-tresci-w-8-jezykach…`, `/blog/smart-copy-ai-vs-chatgpt-co…` (legacy), EN posty z impressions=0.
**Evidence:** GSC inspection w tabeli `Page`: `/pl/blog` = "Crawled - currently not indexed"; 5 wpisów "Discovered - currently not indexed". (Uwaga: ~15 pozycji "Duplicate without user-selected canonical" i "URL unknown" to **stare rootowe slugi PL sprzed migracji** — zweryfikowane live: wszystkie 301 → `/pl/blog/<slug>`, wypadną same; nie ruszać.)
**Impact:** część świeżego contentu nie zbiera wyświetleń; `/pl/blog` poza indeksem osłabia dystrybucję linków do wpisów PL.
**Fix:** (a) w GSC ręcznie zgłosić do indeksacji: `/pl/blog` + 5 wpisów "Discovered" — **limit ~10 URL-i/dzień**, zmieścimy się w jednym dniu; (b) wzmocnić linkowanie wewnętrzne do `/pl/blog` (link z footera PL już jest? — jeśli nie, dodać w `Footer.astro`); (c) to samo zjawisko zniknie częściowo po wzroście autorytetu (P1-offsite).

### [CONTENT] Słaba siatka linków wewnętrznych bloga — 40/66 stron ma ≤1 link przychodzący
**Where:** wpisy EN i PL; 4 wpisy EN z `in:1`, wpisy widoczne tylko z indeksu bloga.
**Evidence:** sitecrawl 2026-08-09: głębokość do 4 klików, 0 sierot, ale 40 stron z ≤1 inbound (pełna lista w `D:\seo-panel\audits\cache\smart-copy.ai\graph-2026-08-09.csv`).
**Impact:** wpisy nie podają sobie mocy; commit `b66dd95` dodał linki wpis→pillar, ale brak linków wpis↔wpis.
**Fix:** w `frontend-public/src/pages/blog/[slug].astro` dodać sekcję "Powiązane artykuły" (3 linki po tagu/kategorii z DB, fallback: 3 najnowsze) — jedna zmiana szablonu podnosi inbound wszystkich wpisów do ≥3.

### [WORKFLOW] GA4: 0 konwersji przy 19 sesjach — prawdopodobnie brak zdefiniowanych key events
**Where:** GA4 property 531378623.
**Evidence:** runReport 28d: Organic 10 sesji, Direct 7, konwersje = 0 we wszystkich kanałach.
**Impact:** nie da się mierzyć, czy SEO/blog dowozi rejestracje i zamówienia — każda decyzja contentowa jest w ciemno.
**Investigate first:** sprawdzić w GA4 Admin → Key events, czy zdarzenia (`sign_up`, `purchase`/`order_placed`) są oznaczone jako key events i czy frontend je wysyła (`gtag('event', 'sign_up')` po rejestracji). Jeśli nie ma — dodać event po stronie SPA w flow rejestracji/zamówienia.

### [OFF-SITE] Spam-backlinki z PBN-farm i shortenerów (świeże, 08-09)
**Where:** `skystarnews.com`, `qwenterprise.com`, `s-tribe.net`, `trendyhealthtimes.com`, `sapphirevpn.net` (deklarowane DA 50–62) + klaster shortenerów (`urls-shortener.eu`, `shortenurls.eu`, `bye.fyi`, `byteshort.xyz`, `atomizelink.icu`…).
**Evidence:** anchor "high quality dofollow backlinks da 50 pa 40 premium pbn network service smart-copy.ai rank first page google fast seo link building buy backlinks online cheap" — strony-katalogi sprzedawców linków. Cross-check: `twojepc.pl` (DA 51) figuruje jako "live" ze strony głównej, ale grep live HTML strony głównej twojepc.pl nie znajduje "smart-copy" — linki rotują/już zniknęły.
**Impact:** realnie żaden (Google takie farmy ignoruje); ryzyko kary znikome przy tej skali. Główny koszt: szum w monitoringu backlinków.
**Fix:** nic nie robić (nie disavowować — niepotrzebne przy <20 domenach spamu); ewentualnie w seo-panelu oznaczyć te domeny jako ignorowane, żeby BACKLINK_NEW nie spamował alertów. **Nie kupować** niczego z tych sieci.

## P3 — Polish (backlog)

- **[CONTENT] 24/52 URL-i ma title > 65 znaków** (max 91: `/pl/blog/sztuczna-inteligencja-do-pisania-tekstow…`). Głównie wpisy blogowe z długimi headline'ami — obcinane w SERP. Skracać przy okazji edycji; priorytet: pillar `/pl/ai-generator-opisow-produktow` (83 zn.) → np. "Generator opisów produktów AI dla e-commerce — Smart-Copy.ai" (59 zn.). Pełna lista: appendix.
- **[LIVE] hreflang używa kodów regionalnych `en-US`/`pl-PL` zamiast językowych `en`/`pl`** — en-GB/en-AU dopasowuje tylko x-default. Zmiana w generatorze sitemapy (backend) i `HeadSeo.astro`: `en-US`→`en`, `pl-PL`→`pl`.
- **[LIVE] Sitemap `<lastmod>` = dzisiejsza data na wszystkich 52 URL-ach + `changefreq: daily`** — content nie zmienił się od czerwca; Google uczy się ignorować lastmod domeny, co spowalnia wykrywanie realnych zmian. Fix w backendowym generatorze: dla wpisów użyć `updatedAt` z DB, dla stron statycznych — daty builda; usunąć changefreq/priority (ignorowane).
- **[CONTENT] Autor schema = "Karol System"** (`BlogPosting.author.name`) — wygląda placeholderowo, zero sygnału EAT. Zmienić na "Karol Leszczyński" + `url` do bio/karol-leszczynski.pl w źródle danych blogowych (kolumna autora w DB lub stała w `BlogPostingSchema.astro`).
- **[LIVE] Unused JS ~65 KiB na każdej stronie** (PSI opportunity, score 0) — hydratowane wyspy React ładują wspólny bundle. Przejrzeć, które komponenty na stronach publicznych naprawdę potrzebują `client:load` — zamienić na `client:visible`/`client:idle` lub czysty Astro.
- **[WORKFLOW] Niezacommitowane dev-configi:** `frontend-public/astro.config.mjs` (dev proxy/HMR), `frontend/vite.config.ts`, `.gitignore`, `package.json`, `scripts/`, `frpc.toml.example` — bez wpływu na prod, ale `git status` brudny od tygodni maskuje przyszłe realne drifty. Zacommitować jako "dev: frpc tunnel + api proxy configs".
- **[CONTENT] Blog nieaktualizowany od ~kwietnia** (najnowsze `dateModified` 2026-04-03; brak wpisów z maja–sierpnia) przy `changefreq: daily` — dla SaaS z blogiem jako kanałem: 2 wpisy/mies. minimum, PL-first (PL frazy mają lepsze pozycje).

---

## Unverified — needs re-run
- **GA4 key events config** — wymaga zajrzenia w GA4 Admin (API Data nie zwraca definicji key events tym tokenem); patrz P2.
- **`/ai-seo-content-writer`, `/ai-product-description-generator`, `/ai-seo-writer` — indexingVerdict UNKNOWN** w tabeli Page (null coverage) mimo impressions — prawdopodobnie nowe slugi po zmianie nazw, jeszcze nie objęte URL-inspection przez cron `indexing_check`. Sprawdzić za tydzień, czy verdict przeszedł na PASS.
- **Brand query "smart copy ai" wypadło z top10 (5.7→15, event 08-08)** — pojedynczy pomiar, może być fluktuacja; obserwować w `WatchedKeyword`. Jeśli za 2 tyg. nadal >10 — osobna analiza SERP (kto wyprzedza na brand).

## Skipped — not applicable to this profile
- C11 Product schema per-wariant / faceted search / paginacja kanoniczna — nie e-commerce z katalogiem (Product+FAQPage na landingu obecne i poprawne).
- Crawl-budget (`botlog`) — 52 strony, budżet nie jest ograniczeniem przy tej skali.
- E (satellite) checks: outbound toxic links — smart-copy.ai to money site, nie satelita.
- Astro `Astro.redirect()` check — output: "static", brak server-side redirectów w kodzie; wszystkie redirecty w nginx (zweryfikowane jako 301).
- GTM consent-gating pattern check — **wykonany, nie pominięty**: wzorzec poprawny (gtag.js ładowany od razu z `consent default: denied`, update z localStorage w oknie wait_for_update); bug znany z sklad-tekstu/ecopywriting tu nie występuje (naprawiony commitem `a1f78fc`).

---

## Sequence of recommended actions
1. **Dodaj plik:** `frontend-public/public/og-default.png` (1200×630) → commit → workflow "Rebuild public". [P1, 15 min]
2. **Skróć meta descriptions** (EN+PL home i pillary) w `frontend/src/locales/*/…` do ≤155 zn. → ten sam rebuild. [P2]
3. **Covery:** jednorazowy skrypt rekompresji `blog-covers/*` do WebP ≤150 KB + `CacheControl` w PutObject (upload path w backendzie) + `fetchpriority="high"` na hero w `[slug].astro`. [P1]
4. **Commit dev-configów** (czyści git status). [P3]
5. **GSC:** zgłoś do indeksacji `/pl/blog` + 5 wpisów "Discovered - currently not indexed" (jednego dnia — limit ~10 URL/dzień). [P2]
6. **GA4:** skonfiguruj key events (sign_up, purchase) + eventy w SPA. [P2]
7. **Off-site sprint:** 8–10 katalogów SaaS/AI + launch na Product Hunt; potem 2–3 gościnne artykuły. [P1 — największa dźwignia]
8. **Szablon "Powiązane artykuły"** w `[slug].astro` (3 linki). [P2]
9. Backlog P3: title'y, hreflang en/pl, lastmod z DB, autor schema, client:visible, 2 wpisy/mies.

---

## Appendix — dane off-site (stan 2026-08-09)
- DA 10 / PA 22 (Moz, cron weekly).
- Domeny linkujące żywe: własna sieć — 1copywriting.pl (68 linków), karol-leszczynski.pl (31), magisterkaonline.com.pl (28), torweb.pl (12), ebookcopywriting.pl (6), copywriting-blog.pl (1); anchor wszędzie "Smart-Copy.AI".
- Spam/PBN (ignorować): skystarnews.com, qwenterprise.com, s-tribe.net, trendyhealthtimes.com, sapphirevpn.net, portailorange.net + shortenery (urls-shortener.eu, shortenurls.eu, bye.fyi, byteshort.xyz, atomizelink.icu, 1unblocked.*, quero.party, blogsphere.top, *.top).
- Utracone (lostAt): 21 z apex karol-leszczynski.pl (przejęte przez www — nie strata realna), drobne z shortenerów.

## Appendix — verification commands
```bash
# crawl całej sitemapy (52 URL, wszystkie 200)
D:/go-tools/urlcheck/urlcheck.exe -sitemap https://www.smart-copy.ai/sitemap.xml -c 20 -rps 15 -out D:/seo-panel/audits/cache/smart-copy.ai/crawl-2026-08-09.csv -dupes
# graf linków wewnętrznych
D:/go-tools/sitecrawl/sitecrawl.exe -c 15 -rps 15 -max 300 -depth 8 -sitemap https://www.smart-copy.ai/sitemap.xml -out D:/seo-panel/audits/cache/smart-copy.ai/graph-2026-08-09.csv https://www.smart-copy.ai/
# og-image 404
curl -sI https://www.smart-copy.ai/og-default.png
# legacy PL slug → 301 na /pl/
curl -sI -A "Mozilla/5.0" https://www.smart-copy.ai/blog/jak-napisac-artykul-10-stronicowy-w-10-minut
# cover S3: 650 KB, brak Cache-Control
curl -sI "https://smart-copy-user-sources.s3.eu-north-1.amazonaws.com/blog-covers/1770393593789-ai_content_2026.jpg"
# prod DB (panel): Domain/Page/GscDomainDaily/BacklinkSnapshot — patrz zapytania w transkrypcie sesji
# PSI mobile: home 0.87 / pl 0.78 (LCP 4.4s) / blog post 0.73 (LCP 6.3s) — JSON-y w audits/cache/smart-copy.ai/psi-*.json
```

---

## Log wdrożenia (2026-08-09, ta sama sesja)

Zweryfikowane na produkcji po deployu (`d180bd7` seo + `e007195` ci-guard; run 31305273744 zielony):

| Finding | Status | Weryfikacja live |
|---|---|---|
| og-default.png 404 | ✅ FIXED | `curl -sI /og-default.png` → 200; plik 1200×630, 54 KB, w repo `frontend-public/public/` |
| LCP covery | ✅ FIXED | 24 pliki na S3 zrekompresowane in-place 12,5 MB → 1 MB (3136×1344 → 1200 px, q80); `Cache-Control: public, max-age=31536000, immutable`; backend: sharp przy uploadzie nowych coverów. PSI po zmianie: wpis blogowy perf 0,73→0,82 (LCP 6,3 s→3,9 s), /pl 0,78→0,84 (4,4 s→3,6 s). Pozostały koszt to Google Fonts (FCP 3,0 s) — backlog |
| hreflang en-US/pl-PL | ✅ FIXED | sitemap + HTML mają `hreflang="en"/"pl"`; guard w deploy.yml zaktualizowany |
| lastmod/changefreq w sitemapie | ✅ FIXED | lastmod tylko z `updatedAt` wpisów (+ /blog = najnowszy wpis), changefreq/priority usunięte |
| Meta descriptions ~198 zn. | ✅ FIXED | home EN = 143 zn. live; wszystkie 8 (home+pillary × EN/PL) 129–148 zn. |
| Title >65 (pillary) | ✅ FIXED | pillar opisów produktów: PL 83→60, EN 68→63; **titles wpisów blogowych (DB) nie ruszane — do edycji redakcyjnej** |
| Powiązane artykuły | ✅ FIXED | sekcja na EN i PL wpisach, 3 linki cyklicznie wg publishedAt; footer ma link do bloga |
| Autor "Karol System" | ✅ FIXED | UPDATE User (kontakt@adcopy.pl) w prod DB smartcopy; schema: `author.url` → karol-leszczynski.pl; live: "Karol Leszczyński" |
| BlogPosting mainEntityOfPage bez /pl | ✅ FIXED (bonus, znalezione przy wdrożeniu) | PL wpisy mają teraz `@id` z prefiksem /pl |
| GA4 key events | ✅ FIXED | `purchase` już był key eventem; `sign_up` utworzony przez Admin API; SPA wysyła `sign_up` (email + Google z flagą `isNewUser` dodaną w backendzie) |
| Indeksacja | ✅ SUBMITTED | Indexing API (SA google-index-api): /pl/blog, /pl/blog/generowanie-tresci…, /ai-seo-content-writer, /ai-product-description-generator, /, /pl — wszystkie 200 OK |
| Dev-configi niezacommitowane | ✅ (równoległa sesja) | commit `2edbd39` + naprawy CI `cca140e`/`6f4fce9` — zrobione w równoległej sesji Claude |

**Nie zrobione (świadomie):**
- Unused JS 65 KiB — w frontend-public nie ma żadnych dyrektyw `client:` (zero hydratowanych wysp); 65 KiB to gtag.js, nieusuwalny. Finding wycofany.
- Titles wpisów blogowych >65 zn. — treść w DB, decyzja redakcyjna per wpis.
- Off-site (katalogi SaaS, Product Hunt, gościnne artykuły) — działania manualne Karola.
- Google Fonts render-block (FCP 3,0 s) — kandydat na self-host fontów, backlog.
