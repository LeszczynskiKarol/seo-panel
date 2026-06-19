# SEO on-site audit — matury-online.pl
**Date:** 2026-06-10
**Profile:** D (SaaS, conversion-critical) + B (content arm: blog 114 art., wiadomości, informator) — platforma subskrypcyjna walcząca o discovery, treść jest kanałem akwizycji.
**Stack:** Astro SSR (node standalone) + Fastify, PM2 na VPS `matury`, nginx TLS. 505 URL-i w sitemapach (391 + 114 articles + 2 news).
**Repo↔prod state:** in-sync — `git status` czysty, ostatni commit 2026-06-10 17:16 CEST, build sitemap 15:18 UTC (2 min po commicie).
**Last crawl:** 2026-06-10 04:46 | **GSC pull:** 2026-06-10 06:00 | **GA4 sync:** 2026-06-10 08:01 (ACTIVE, properties/534052853)
**Pages:** 385 tracked w panelu, 322 INDEXED (PASS), 505 w sitemapach | **DA:** 16 | **GSC 28d:** 7 kliknięć, 468 impresji

---

## P0 — Critical
*(brak — homepage 200, redirecty http→https→www 301, HSTS, robots.txt + 3 sitemapy 200, próbka 26/505 URL-i = wszystkie 200, noindex poprawnie na /dashboard i /auth/*)*

## P1 — High (fix this sprint)

### [LIVE] Legacy duplikat `/egzamin/matura-podstawowy` — zaindeksowana kopia `/egzamin/matematyka-podstawowa`
**Where:** `frontend/src/pages/egzamin/matura-podstawowy/index.astro` (katalog na dysku); live `https://www.matury-online.pl/egzamin/matura-podstawowy`
**Evidence:**
- Oba URL-e zwracają 200 z **identycznym** `<title>Egzamin maturalny z matematyki 2027 — poziom podstawowy, struktura, zadania, dowody | Matury Online</title>`
- Oba mają self-canonical i oba są w `sitemap-0.xml`
- `diff` plików: `matura-podstawowy` to starsza kopia (brak sekcji LIVE VIEW i `ExamLiveTeaserMath` dodanych później do `matematyka-podstawowa`)
- Prod seo_panel: `/egzamin/matura-podstawowy` ma `indexingVerdict=PASS` (zaindeksowany!) i jest **jedynym orphanem** w serwisie (`internalLinksIn=0`)
**Impact:** dwie zaindeksowane, niemal identyczne strony konkurują o te same frazy ("egzamin maturalny matematyka podstawowa") — rozszczepienie sygnałów na domenie, która ma DA 16 i walczy o każdą pozycję.
**Fix:**
1. `git rm -r frontend/src/pages/egzamin/matura-podstawowy/`
2. W `frontend/src/middleware.ts` dodaj przed blokiem trailing-slash:
   ```ts
   if (pathname === '/egzamin/matura-podstawowy') {
     url.pathname = '/egzamin/matematyka-podstawowa';
     return Response.redirect(url.toString(), 301);
   }
   ```
3. Po deployu: GSC → URL Inspection na starym URL-u → Request Indexing (przyspieszy przepięcie).

### [LIVE] `Astro.redirect()` bez statusu — nieistniejące tematy/posty zwracają 302 zamiast 301
**Where:** 22 pliki w `frontend/src/pages/` (pełna lista w Appendix A); zweryfikowane live:
**Evidence:**
```
GET /test/matematyka/nieistniejacy-temat-xyz → 302 → /test/matematyka
GET /blog/nieistniejacy-post-xyz             → 302 → /blog
```
3 pliki już mają poprawione `301` (`informator/[subject].astro:18`, `test/wos/[temat].astro:13`, `test/historia/[temat].astro:13`) — reszta nie, więc to świadomie wybrany wzorzec wdrożony niekonsekwentnie. 302 mówi Google "stary URL wróci" — Google trzyma go w indeksie/kolejce crawl zamiast skonsolidować na hubie. Przy usuwaniu/zmianie slugów tematów (a sluggi tematów już się zmieniały — w panelu wisi 103 "URL is unknown to Google", głównie stare warianty) każdy stary link działa jako wieczny 302.
**Impact:** marnowany crawl budget + brak konsolidacji link equity na hubach `/test/<przedmiot>` i `/zadania/<przedmiot>`.
**Fix:** w każdym pliku z Appendix A dodać drugi argument `301`, np. w `frontend/src/pages/zadania/matematyka/[temat].astro:16`:
`return Astro.redirect('/zadania/matematyka', 301);`
Redirecty w `dashboard/**` (2 pliki) mogą zostać 302 — to flow aplikacyjny pod noindex.

### [WORKFLOW] 28 wartościowych stron z sitemap nie jest zaindeksowanych i nigdy nie zostało zgłoszonych
**Where:** prod seo_panel `Page`: 25× `Discovered - currently not indexed` + 3× `Crawled - currently not indexed`; klaster: **16× `/test/polski/*`** (lektury/epoki: makbet, wesele, chlopi, zbrodnia-i-kara…), 6× `/test/matematyka/*` (ciagi, funkcje, trygonometria…), pojedyncze `/zadania/*`, `/egzamin/angielski-podstawowy`
**Evidence:** wszystkie mają `inSitemap=t` i `lastSubmitted=NULL` (nigdy nie zgłoszone przez Indexing API/GSC). To NIE jest thin content: `/test/polski/makbet` = 8149 słów, `/test/polski/oswiecenie` = 4998, `/test/matematyka/ciagi` = 3013. Linkowanie wewnętrzne jest (jedyny orphan to legacy duplikat wyżej). Przyczyna: młoda domena (DA 16), Google raczkuje z crawl budgetem.
**Impact:** 28 stron × frazy typu "makbet test maturalny" (GSC pokazuje, że analogiczne frazy już łapią pozycje 4–6: "antygona zadania maturalne" poz. 4.5, "renesans zadania maturalne polski" poz. 6) — to najtańszy dostępny wzrost.
**Fix:** zgłaszać przez GSC URL Inspection → Request Indexing. **Google limituje ~10 URL-i/dzień/property — rozłożyć na 3 dni.** Lista URL-i w Appendix B. Zacząć od `/test/polski/*` (najsilniejszy klaster intencji).

## P2 — Medium

### [LIVE] `/wiadomosci/*` — zdublowane, sprzeczne tagi OG (website + article, 2× og:title, 2× og:image)
**Where:** `frontend/src/pages/wiadomosci/[slug]/index.astro:106-121` + `frontend/src/layouts/Base.astro:54-70`
**Evidence:** szablon wiadomości wstrzykuje przez `<Fragment slot="head">` własne `og:type=article`, `og:title`, `og:image` — ale `Base.astro` emituje wcześniej (linie 54–70, slot jest w linii 77) swoje `og:type=website`, `og:title`, `og:image=og-default.png`. W HTML strony newsa są więc DWA komplety OG, sprzeczne co do typu i obrazka; parsery biorą zwykle pierwszy napotkany → udostępnienia pokazują domyślny obrazek zamiast hero.
**Fix:** przekazać do Base zamiast dublować: `<Base title={metaTitle} description={metaDesc} ogType="article" ogImage={post.heroImageUrl}>` i usunąć z head-slota zdublowane `og:type/og:title/og:description/og:url/og:site_name/og:locale/og:image` (zostawić tylko `article:published_time` itp., których Base nie emituje).

### [LIVE] Posty blogowe: `og:type=website` i domyślny `og:image` mimo istniejącego hero
**Where:** `frontend/src/pages/blog/[slug]/index.astro:46`
**Evidence:** live `/blog/wzory-matematyczne-matura-pdf`: `og:type=website`, `og:image=https://www.matury-online.pl/og-default.png` — a post MA hero (`post.data.heroImage`, użyty w JSON-LD i `<img loading="eager">`). Szablon woła `<Base title={metaTitle} description={metaDesc}>` bez `ogType`/`ogImage`.
**Impact:** udostępnienia 114 artykułów pokazują generyczny brand-obrazek zamiast dedykowanych hero — niższy CTR z social.
**Fix:** linia 46: `<Base title={metaTitle} description={metaDesc} ogType="article" ogImage={post.data.heroImage}>`.

### [LIVE] Mobile LCP 4.2–4.4 s na stronach treściowych (PSI lab)
**Where:** `/blog/wzory-matematyczne-matura-pdf`: perf **75**, FCP 3.2 s, LCP 4.4 s; `/test/polski/lalka`: perf **85**, LCP 4.2 s. (Homepage: perf 100, LCP 1.4 s — bez uwag.)
**Evidence:** hero blogowe ładowane z `https://matury-online-audio.s3.eu-north-1.amazonaws.com/...webp` — cross-origin, a w HTML **zero** `<link rel="preconnect">` (grep preconnect/dns-prefetch = 0 wyników). Każdy hero płaci pełny koszt DNS+TLS do S3 w Sztokholmie. Dodatkowo PSI: unused JS 166 KiB na wszystkich stronach (bundle React islands).
**Impact:** strony bloga/testów to landing pages z organica — LCP 4.4 s mobile to realny koszt pozycji i konwersji. Brak danych CrUX (za mały ruch), więc lab-only.
**Fix:**
1. W `Base.astro` `<head>` dodać: `<link rel="preconnect" href="https://matury-online-audio.s3.eu-north-1.amazonaws.com" crossorigin>`
2. W szablonie blog/wiadomości na hero `<img>` dodać `fetchpriority="high"` (obok istniejącego `loading="eager"`).
3. (Opcjonalnie, większy kaliber) serwować hero przez CloudFront zamiast surowego S3 eu-north-1 — TTFB obrazka z edge zamiast ze Sztokholmu.

### [LIVE] `sitemap-0.xml`: wszystkie 391 `<lastmod>` = timestamp builda
**Where:** `frontend/astro.config.mjs` — `serialize()` ustawia `item.lastmod = new Date().toISOString()` dla wszystkiego
**Evidence:** wszystkie lastmod w sitemap-0 = `2026-06-10T15:18:27.xxx` (czas dzisiejszego builda). Deploye są częste (auto-publish bloga = commit = deploy), więc lastmod całego serwisu bumpuje się co 1–2 dni mimo braku zmian na 390 stronach.
**Impact:** Google dokumentuje, że ignoruje lastmod, gdy jest niewiarygodny — domena tracąca ten sygnał w fazie walki o crawl budget to strzał w stopę. Komentarz w configu pokazuje, że to świadoma decyzja, ale działa odwrotnie do intencji.
**Fix (judgment-dependent, 2 opcje):**
a) **Rekomendowane:** usunąć fallback `item.lastmod = new Date()...` z `serialize()` — brak lastmod jest lepszy niż fałszywy; realne lastmod zostają w `sitemap-articles.xml` (z dat publikacji) i `sitemap-news.xml`.
b) Trzymać per-URL daty realnych zmian (np. z git lub z DB) — poprawne, ale nakład niewspółmierny do zysku przy 391 URL-ach.

## P3 — Polish

### [LIVE] Homepage: brak JSON-LD `Organization`/`WebSite` (jest tylko `FAQPage`)
**Where:** `frontend/src/pages/index.astro` (head slot)
**Evidence:** w HTML homepage dokładnie 1 blok `application/ld+json` — poprawny FAQPage. Brak Organization (logo, sameAs) i WebSite.
**Fix:** dodać w head-slocie index.astro drugi `<script type="application/ld+json">` z `{"@type":"Organization","name":"Matury Online","url":"https://www.matury-online.pl","logo":"https://www.matury-online.pl/logo.png"}` + `{"@type":"WebSite","name":"Matury Online","url":"https://www.matury-online.pl"}`.

### [CONTENT] Meta description stron tematów zaczyna zdanie małą literą, gdy `questionCount=0`
**Where:** `frontend/src/components/test/TestTopicPage.astro:319`
**Evidence:** live `/test/matematyka/rachunek-rozniczkowy`: `…z matematyki – rachunek różniczkowy. adaptacyjna trudność, AI ocenia…` — warunek `${questionCount > 0 ? questionCount + ' pytań w bazie, ' : ''}` po wypadnięciu zostawia małe "a" po kropce.
**Fix:** zmienić szablon na: `…${topicName.toLowerCase()}. ${questionCount > 0 ? questionCount + ' pytań w bazie, adaptacyjna' : 'Adaptacyjna'} trudność, AI ocenia odpowiedzi w 30 s…`

### [WORKFLOW] seo_panel: `Page.title` to slugi, nie realne tytuły — check duplikatów title niewykonalny z panelu
**Evidence:** panel pokazuje "duplikaty" typu `Biologia` × 4 (`/biologia`, `/test/biologia`…), ale live tytuły tych stron są unikalne i rozbudowane (zweryfikowano 4 strony). `Page.title` wygląda na wygenerowany z patha (brak ogonków: "Sredniowiecze"). Druga niespójność: `Domain.totalPages=385` vs 505 URL-i w sitemapach — crawl panelu nie nadąża.
**Fix:** w seo-panelu: crawler powinien zapisywać realny `<title>` z HTML; odświeżyć crawl domeny.

---

## Unverified — needs re-run
- **Element LCP na `/test/polski/lalka`** — PSI API zwróciło audyt `largest-contentful-paint-element` bez node details; przyczyna LCP 4.2 s na stronach testów (bez hero) to hipoteza (hydratacja React islands / późny render tekstu), nieudowodniona. Sprawdzić w DevTools po wdrożeniu preconnect.
- **C16 intent match / tail signals GA4** — 7 kliknięć/28d to za mało danych na rzetelne wnioski; powtórzyć przy >100 kliknięć/28d.

## Skipped — not applicable to this profile
- T16 hreflang — serwis jednojęzyczny (pl).
- C11 Product/Offer schema — nie e-commerce.
- Profil E (satellite): audyt outbound anchors / link-flow — to money site.
- L4/L5 (broken/excessive external links na high-click pages) — brak high-click pages (7 kliknięć/28d), panel raportuje `brokenLinksOut=0` globalnie.
- Tail: high-bounce / zero-conversion landing pages — ruch zbyt mały, by segmentacja miała moc statystyczną.

---

## Sequence of recommended actions
1. **Kod (1 PR):**
   - usuń `frontend/src/pages/egzamin/matura-podstawowy/` + 301 w `middleware.ts`
   - dodaj `301` do 20 wywołań `Astro.redirect()` (Appendix A, bez dashboard)
   - `blog/[slug]/index.astro:46` → `ogType="article" ogImage={post.data.heroImage}`
   - `wiadomosci/[slug]/index.astro` → ogType/ogImage przez Base, usuń zdublowane OG ze slota
   - `Base.astro` → preconnect do S3; hero `<img>` → `fetchpriority="high"`
   - `astro.config.mjs` → usuń fallback lastmod w `serialize()`
   - `TestTopicPage.astro:319` → wielka litera; `index.astro` → Organization/WebSite JSON-LD
2. **Deploy** (push → CI).
3. **GSC:** Request Indexing — dzień 1: 10× `/test/polski/*`; dzień 2: pozostałe `/test/polski/*` + `/test/matematyka/*`; dzień 3: reszta z Appendix B + stary URL `/egzamin/matura-podstawowy` (po deployu 301). Limit ~10/dzień/property.
4. **seo-panel:** poprawić crawler (realne title) i odświeżyć crawl domeny.

---

## Appendix A — pliki z `Astro.redirect()` bez statusu 301
```
frontend/src/pages/blog/[slug]/index.astro:13
frontend/src/pages/wiadomosci/[slug]/index.astro:24
frontend/src/pages/zadania/polski/[temat].astro:16
frontend/src/pages/zadania/matematyka/[temat].astro:16
frontend/src/pages/zadania/angielski/[temat].astro:17
frontend/src/pages/zadania/niemiecki/[temat].astro:31
frontend/src/pages/zadania/biologia/[temat].astro:22
frontend/src/pages/zadania/chemia/[temat].astro:17
frontend/src/pages/zadania/fizyka/[temat].astro:17
frontend/src/pages/zadania/geografia/[temat].astro:18
frontend/src/pages/zadania/historia/[temat].astro:16
frontend/src/pages/zadania/informatyka/[temat].astro:29
frontend/src/pages/test/polski/[temat].astro:18
frontend/src/pages/test/matematyka/[temat].astro:13
frontend/src/pages/test/angielski/[temat].astro:16
frontend/src/pages/test/niemiecki/[temat].astro:16
frontend/src/pages/test/biologia/[temat].astro:16
frontend/src/pages/test/chemia/[temat].astro:16
frontend/src/pages/test/fizyka/[temat].astro:16
frontend/src/pages/test/geografia/[temat].astro:16
frontend/src/pages/test/informatyka/[temat].astro:16
(zostawić 302: dashboard/egzamin-live/wyniki/[attemptid].astro:5, dashboard/egzamin-live/egzamin/[examid].astro:5 — pod noindex)
```

## Appendix B — strony nie zaindeksowane (in-sitemap, lastSubmitted NULL)
Crawled - currently not indexed (3):
```
/zadania/fizyka/termodynamika
/zadania/geografia/srodowisko-polski
/zadania/polski/kordian
```
Discovered - currently not indexed (25):
```
/egzamin/angielski-podstawowy
/test/geografia/czlowiek-srodowisko
/test/matematyka/ciagi
/test/matematyka/funkcje
/test/matematyka/geometria-analityczna
/test/matematyka/prawdopodobienstwo-i-statystyka
/test/matematyka/rachunek-rozniczkowy
/test/matematyka/trygonometria
/test/niemiecki/rozumienie-ze-sluchu
/test/polski/ballady-i-romanse
/test/polski/barok
/test/polski/chlopi
/test/polski/makbet
/test/polski/mloda-polska
/test/polski/pisanie
/test/polski/powrot-posla
/test/polski/pozytywizm
/test/polski/renesans
/test/polski/starozytnosc
/test/polski/swietoszek
/test/polski/tango
/test/polski/teoria-literatury
/test/polski/treny
/test/polski/wesele
/test/polski/zbrodnia-i-kara
```

## Appendix C — verification commands
```bash
# redirect chains
curl -sIL -A "Mozilla/5.0" "http://matury-online.pl/"
# 302 na nieistniejącym temacie
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" "https://www.matury-online.pl/test/matematyka/nieistniejacy-temat-xyz"
# duplikat
curl -s "https://www.matury-online.pl/egzamin/matura-podstawowy" | grep -o "<title>.*</title>"
curl -s "https://www.matury-online.pl/egzamin/matematyka-podstawowa" | grep -o "<title>.*</title>"
# sitemapy
curl -s "https://www.matury-online.pl/sitemap-0.xml" | grep -c "<loc>"   # 391
# prod DB (ssh panel)
sudo -u postgres psql -d seo_panel -A -F "|" -c "SELECT \"indexingVerdict\",\"coverageState\",count(*) FROM \"Page\" WHERE \"domainId\"='cmo928oyl01n2qrovi3au1tdc' GROUP BY 1,2 ORDER BY 3 DESC;"
# PSI
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fwww.matury-online.pl%2Fblog%2Fwzory-matematyczne-matura-pdf&strategy=mobile&key=$PSI_API_KEY"
```
