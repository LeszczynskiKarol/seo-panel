# SEO on-site audit — kurs-copywritingu.pl
**Date:** 2026-05-30
**Profile:** D (SaaS / conversion-critical landing) z elementami A (static brochure). Płatny produkt, kilka stron marketingowych + biblioteka swipe; o wartości decyduje konwersja na landingu, nie wolumen treści.
**Stack:** Astro 5 SSG (apex `kurs-copywritingu.pl`, nginx static na VPS matury) + Next.js 14 (subdomena `app.kurs-copywritingu.pl`, PM2 :4010). Apex: 7 stron statycznych + 20 stron swipe = 27 URL w sitemap.
**Repo↔prod state:** **mixed / repo NIE jest źródłem prawdy** — produkcja działa (deploy dziś 09:45), ale całość kodu jest niezacommitowana (HEAD = „Initial commit from Create Next App" z 2025-08-23).
**Last crawl:** brak (domeny nie ma w seo_panel) | **GSC:** brak | **GA4:** brak
**Pages:** 27 w sitemap | **DA:** n/a | **Last 28d GSC:** brak danych (domena nietrackowana)

---

## ⚠ Data freshness caveats
- Domena **nie istnieje w `seo_panel`** (`SELECT … WHERE domain ILIKE '%kurs-copywritingu%'` → 0 wierszy na prod, host `panel`). Brak GSC/GA4 → wszystkie kontrole indeksacji (I1–I6), tail-signals (CTR, bounce, pozycje) i ruch-ważona priorytetyzacja są **niemożliwe**. Severity nadana na podstawie wpływu technicznego, nie zmierzonego ruchu.
- Strona jest świeżo wdrożona — Google prawdopodobnie jeszcze jej nie zaindeksował. To okno na naprawę błędów PRZED indeksacją (najtańszy moment).

---

## ⚠ Drift summary — repo ↔ prod
Produkcja serwuje pełny serwis, a w gicie jest tylko pusty szkielet Create-Next-App. Każdy plik projektu jest niezacommitowany.

| Obszar | Status git | Co w repo | Co na produkcji | Akcja |
|------|--------|-----------|-----------------|-------|
| `public-site/` (cały Astro) | `??` untracked | pełny kod | zbudowane i wdrożone | **COMMIT** |
| `src/app/**` (cały Next.js: api, admin, course, dashboard…) | `??` untracked | pełny kod | wdrożone na `app.` | **COMMIT** |
| `prisma/`, `scripts/`, `deploy/` | `??` untracked | pełny kod | używane na prodzie | **COMMIT** |
| `next.config.mjs`, `tailwind.config.js`, `postcss.config.js` | `??` untracked | aktualne | używane | **COMMIT** |
| `next.config.ts`, `src/app/favicon.ico` | `D` deleted | usunięte | — | commit usunięcia |
| `README.md`, `layout.tsx`, `page.tsx`, `globals.css`, `package.json`, `tsconfig.json` | `M` modified | zmienione | wdrożone | **COMMIT** |

Skutek: utrata dysku = utrata całego projektu (brak historii, brak możliwości odtworzenia prod z repo). To jest największe ryzyko w tym audycie — szczegóły w P0.

---

## P0 — Critical (zrób w tym tygodniu)

### [WORKFLOW] Cały projekt niezacommitowany — produkcja wdrożona z nieśledzonego kodu
**Where:** `git log` = jeden commit `cb99250 Initial commit from Create Next App` (2025-08-23). `git status --short` pokazuje całe `public-site/`, `src/app/**`, `prisma/`, `scripts/`, `deploy/` jako `??` (untracked).
**Evidence:**
```
$ git log --oneline -3
cb99250 Initial commit from Create Next App
$ git status --short   # (skrót)
?? public-site/   ?? prisma/   ?? scripts/   ?? deploy/
?? src/app/api/   ?? src/app/admin/   ?? src/app/course/   ?? src/app/dashboard/ …
 M page.tsx        D next.config.ts
```
Live `Last-Modified: Sat, 30 May 2026 09:45:38 GMT` — czyli prod zbudowano dziś z lokalnego, niezacommitowanego kodu.
**Impact:** Repo nie jest źródłem prawdy. Awaria dysku / pomyłka = bezpowrotna utrata całego serwisu i aplikacji. Brak historii zmian, brak rollbacku, brak możliwości odbudowy prod z gita. Nie jest to „SEO" sensu stricte, ale blokuje bezpieczne wdrażanie każdej kolejnej poprawki z tego audytu.
**Fix:**
```bash
cd D:\kurs-copywritingu
git add -A
git commit -m "zacommituj pelny projekt: Astro public-site + Next.js app + prisma + deploy"
git push
```
Upewnij się, że `.env` jest ignorowany (jest — `.gitignore` ma `.env*`). `public-site/dist/` NIE jest w `.gitignore` — patrz P2 (workflow).

---

## P1 — High (ten sprint)

### [LIVE] Soft-404: każdy nieistniejący URL zwraca stronę główną z kodem 200
**Where:** `deploy/nginx.conf:59` — `try_files $uri $uri/ $uri.html /index.html;`. Brak `src/pages/404.astro` i `dist/404.html`.
**Evidence:**
```
$ curl -o /dev/null -w "%{http_code} %{size_download}" https://kurs-copywritingu.pl/ta-strona-nie-istnieje-12345
200 18952      # ← zwraca pełną stronę główną zamiast 404
$ curl -sI https://kurs-copywritingu.pl/404.html
HTTP/1.1 200 OK   # 404.html nie istnieje → też wpada w fallback do index.html
```
**Impact:** Google traktuje to jako soft-404 — nieskończona liczba „literówkowych"/cudzych linków renderuje duplikat strony głównej z kodem 200. Marnuje crawl budget, rozmywa sygnały strony głównej, generuje ostrzeżenia w GSC („Soft 404"). Dla świeżej domeny to psuje pierwsze wrażenie crawlera.
**Fix:** dwa kroki.
1. Utwórz `public-site/src/pages/404.astro` (Astro w trybie `output: static` zbuduje `dist/404.html`):
   ```astro
   ---
   import Base from "../layouts/Base.astro";
   ---
   <Base title="Nie znaleziono strony · kurs-copywritingu.pl" description="Ta strona nie istnieje.">
     <section class="max-w-2xl mx-auto px-6 py-32 text-center">
       <h1 class="font-display text-5xl mb-4">404</h1>
       <p class="text-ink-mute mb-8">Tej strony nie ma. Wróć na <a href="/" class="text-oxblood underline">stronę główną</a>.</p>
     </section>
   </Base>
   ```
2. W `deploy/nginx.conf:58-60` zmień blok `location /` na zwracanie realnego 404:
   ```nginx
   location / {
       try_files $uri $uri/ $uri.html =404;
   }
   error_page 404 /404.html;
   ```
   Następnie `nginx -t && systemctl reload nginx` na VPS matury.

### [LIVE] Subdomena `app.` w całości indeksowalna — prywatna aplikacja może wyciec do Google
**Where:** `app.kurs-copywritingu.pl` — brak własnego `robots.txt`, brak `noindex` na stronach publicznych aplikacji. `deploy/nginx.conf:74-106` (blok app) nie dodaje `X-Robots-Tag`.
**Evidence:**
```
$ curl -sI https://app.kurs-copywritingu.pl/login        → HTTP/1.1 200 OK   (brak meta robots noindex)
$ curl -s  https://app.kurs-copywritingu.pl/courses       → HTTP 200, <title>Kurs Copywritingu</title>, brak noindex
$ curl -s  https://app.kurs-copywritingu.pl/robots.txt    → zwraca stronę 404 Next.js (czyli robots.txt NIE istnieje)
$ curl -sI https://app.kurs-copywritingu.pl/dashboard     → 307 → /login?from=/dashboard   (gated, OK)
```
`/login` i `/courses` zwracają 200 bez `noindex`, z identycznym tytułem „Kurs Copywritingu" i opisem „Naucz się pisać teksty, które sprzedają".
**Impact:** Cała subdomena aplikacji (login, courses, profile…) może trafić do indeksu — duplikaty tytułów/opisów, thin pages, ekspozycja prywatnych ścieżek aplikacji. Konkuruje i rozmywa apex (`kurs-copywritingu.pl`), który jest właściwym celem SEO. Subdomena `app.` nie ma żadnej wartości wyszukiwarkowej.
**Fix:** zablokuj indeksację całej subdomeny na poziomie nginx (najpewniej, niezależne od kodu Next). W `deploy/nginx.conf` w bloku `server_name app.kurs-copywritingu.pl` dodaj:
```nginx
add_header X-Robots-Tag "noindex, nofollow" always;

location = /robots.txt {
    add_header Content-Type text/plain;
    return 200 "User-agent: *\nDisallow: /\n";
}
```
(`location = /robots.txt` musi być przed `location /` z proxy_pass). Reload nginx. Alternatywnie/dodatkowo dodaj `robots: { index:false }` w `metadata` w `src/app/layout.tsx`, ale header w nginx jest pewniejszy i obejmuje wszystkie route'y.

---

## P2 — Medium (gdy będzie czas)

### [LIVE] `og-default.png` → 404 — każdy udostępniony link ma zepsuty obrazek social
**Where:** `public-site/src/layouts/Base.astro:12,29` — domyślny `ogImage = "/og-default.png"`, renderowany jako absolutny URL. Plik nie istnieje w `public-site/public/` (jest tam tylko `robots.txt`).
**Evidence:**
```
$ curl -sI https://kurs-copywritingu.pl/og-default.png   → HTTP/1.1 404 Not Found
# live home HTML:
<meta property="og:image" content="https://kurs-copywritingu.pl/og-default.png">  ← cel 404
```
Dotyczy WSZYSTKICH stron (żadna nie nadpisuje `ogImage`), w tym 20 stron swipe.
**Impact:** Udostępnienia na FB/LinkedIn/Slack/WhatsApp wyświetlą pustą/zepsutą kartę bez grafiki — niższy CTR z social, słabsze pierwsze wrażenie przy promocji płatnego produktu.
**Fix:** dodaj plik `public-site/public/og-default.png` w rozmiarze 1200×630 px (logo + claim „Kurs copywritingu z oceną AI"). Po dodaniu rebuild + deploy. Opcjonalnie dodaj per-strona OG (np. dedykowany obraz dla `/cennik`).

### [LIVE] `favicon.svg` → 404
**Where:** `public-site/src/layouts/Base.astro:24` — `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`. Plik nie istnieje w `public-site/public/`.
**Evidence:** `curl -sI https://kurs-copywritingu.pl/favicon.svg` → `HTTP/1.1 404 Not Found`.
**Impact:** Brak ikony w karcie przeglądarki i w wynikach mobilnych Google (Google pokazuje favicon obok wyniku). Drobny, ale widoczny sygnał „niedokończonej" strony.
**Fix:** dodaj `public-site/public/favicon.svg` (litera „k" na tle `oxblood`, spójnie z logo w nagłówku). Rozważ też `favicon.ico` jako fallback dla starszych klientów.

### [LIVE] Brak jakichkolwiek danych strukturalnych (JSON-LD) na całym serwisie
**Where:** `public-site/src/layouts/Base.astro` — w `<head>` brak `<script type="application/ld+json">`.
**Evidence:** `grep -i 'application/ld+json' /tmp/kc_home.html` → 0 trafień (live home HTML).
**Impact:** Brak kwalifikacji do rich results. Dla produktu edukacyjnego tracone są schematy `Organization` (sitelinks/knowledge panel) oraz `Course` (rich result kursu z ceną/dostawcą). Konkurenci z markupem zajmują więcej miejsca w SERP.
**Fix:** w `Base.astro` w `<head>` dodaj minimum `Organization`:
```astro
<script type="application/ld+json" set:html={JSON.stringify({
  "@context":"https://schema.org","@type":"Organization",
  "name":"kurs-copywritingu.pl","url":"https://kurs-copywritingu.pl",
  "logo":"https://kurs-copywritingu.pl/og-default.png",
  "founder":{"@type":"Person","name":"Karol Leszczyński"}
})} />
```
Na `index.astro`/`o-kursie.astro` dodaj `Course` (`name`, `description`, `provider`, `offers` z ceną z `/cennik` — 397 zł lifetime / 49 zł/mc).

### [LIVE] LCP 4,2 s na mobile — render-blocking Google Fonts
**Where:** `public-site/src/layouts/Base.astro:34-37` — blokujący `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@…">` z pełną osią zmiennej czcionki Fraunces.
**Evidence:** PSI mobile (api, strategy=mobile): performance **75/100**, **FCP 4,2 s = LCP 4,2 s = Speed Index 4,2 s** (wszystkie zbieżne → render zablokowany na CSS czcionek). CLS 0,012 ✓, TBT 0 ms ✓. SEO score 100. Insighty: `render-blocking-insight`, `cache-insight`.
**Impact:** LCP 4,2 s to „poor" (próg dobry <2,5 s). Na landingu sprzedażowym wolny pierwszy render = wyższy bounce przed konwersją. Zbieżność FCP/LCP/SI wskazuje, że żądanie czcionek blokuje pierwsze malowanie.
**Fix:** (a) `&display=swap` już jest, ale dołóż `<link rel="preconnect">` (jest) + preload arkusza, albo lepiej **self-host** podzbioru czcionek przez `@fontsource` i usuń żądanie do `fonts.googleapis.com`; (b) ogranicz osie zmiennej Fraunces do faktycznie używanych wag/optical-size (obecnie ściągasz `wght,SOFT,WONK,opsz` pełnozakresowo). Re-test PSI po zmianie.

### [WORKFLOW] Domena poza monitoringiem + brak analytics na stronie publicznej
**Where:** brak wiersza w `seo_panel."Domain"`; `grep -ciE 'gtag|googletagmanager|analytics|plausible' public-site/dist/index.html` → 0.
**Evidence:** `SELECT … WHERE domain ILIKE '%kurs-copywritingu%'` → 0 rows (prod). Brak skryptu trackującego w zbudowanym HTML.
**Impact:** Start płatnego produktu bez GSC/GA4 i bez analytics = zero danych o indeksacji, zapytaniach, źródłach ruchu i konwersji. Nie zmierzysz efektu żadnej z powyższych poprawek.
**Fix:** (1) dodaj domenę do `seo_panel` (apex jako `sc-domain:kurs-copywritingu.pl`) i podłącz GSC + GA4 zgodnie z globalnym setupem; (2) zweryfikuj własność w Search Console i wyślij `sitemap-index.xml`; (3) wstaw tag analytics na public-site (jeśli z cookies — z banerem zgody / Consent Mode v2 od razu z denied-default, nie po kliknięciu — patrz wzorzec znany z innych domen Karola).

---

## P3 — Polish (backlog)

- **[CONTENT] Zbyt krótkie meta description** na `kontakt.astro:7` (44 zn.), `regulamin.astro:7` (49 zn.), `polityka-prywatnosci.astro:7` (48 zn.) — poniżej 70 zn. Niski priorytet (strony pomocnicze), ale warto rozbudować do 70–155 zn. albo świadomie zostawić (to nie strony rankujące).
- **[CONTENT] Niespójny separator w tytułach** — `index`/`cennik`/`swipe` używają `·`, a `o-kursie`/`kontakt`/`regulamin`/`polityka` używają `|`. Ujednolić na `·` dla spójności marki w SERP.
- **[LIVE] Niekompletna Twitter Card** — `Base.astro:30` ma tylko `twitter:card`, brak `twitter:title`/`twitter:description`/`twitter:image`. X/Twitter zwykle fallbackuje na OG, ale OG image i tak jest 404 (P2). Po naprawie `og-default.png` dodaj 3 brakujące tagi.
- **[LIVE] `cache-insight` w PSI** — nginx ustawia `expires 7d` dla całej statyki (`nginx.conf:63-66`). Hashowane assety Astro (`/_astro/*.css|js`) mogą mieć `expires 1y; immutable`. Drobna optymalizacja powtórnych wizyt.

---

## Unverified — needs re-run
- **Indeksacja (I1–I6), CTR/pozycje, ruch** — niemożliwe: brak domeny w seo_panel i brak GSC. Po podłączeniu GSC (P2-workflow) re-run audytu za ~2–4 tyg. da realną priorytetyzację ruchem.
- **PSI dla `/cennik` i strony swipe** — uruchomiono PSI tylko dla strony głównej (1 URL). Profil D zaleca też landing-konwersyjny; do uzupełnienia przy re-runie (limit quoty nie był problemem — pierwszy call przeszedł).

## Skipped — not applicable to this profile
- **C11 Product/Offer schema** — to nie e-commerce z katalogiem produktów; właściwy schemat to `Course`/`Organization` (ujęte w P2), nie `Product`.
- **L1–L6 graf linków wewnętrznych / orphany** — 7 stron statycznych + spójna nawigacja w `Base.astro` (header+footer linkują wszystkie sekcje); brak grafu do analizy.
- **GTM/GA Consent Mode gating** (mandatory Astro check) — N/A: na public-site nie ma żadnego tagu GA/GTM ani `CookieBanner.astro` (`src/components/` zawiera tylko `Icon.astro`). Zamiast tego flaga w P2-workflow: dodać tracking, a przy dodawaniu zastosować Consent Mode v2 od razu z denied-default.
- **`Astro.redirect()` 302** (mandatory Astro check) — N/A: `output: static`, brak redirectów w stronach; `swipe/[id].astro` używa `getStaticPaths`, nie redirectów.
- **sitemap-slugs coverage** (mandatory Astro check) — N/A: brak centralnej listy slugów; sitemap generowany przez `@astrojs/sitemap` z faktycznie zbudowanych stron. Zweryfikowano: 27 URL, wszystkie absolutne, host zgodny, próbka (home, swipe detail) → 200.
- **Moz DA/spam** — OFF zgodnie z regułą skilla (domena i tak nie ma jeszcze profilu linkowego).

---

## Sequence of recommended actions
1. **`git add -A && git commit && git push`** — zabezpiecz cały projekt (P0). Najpierw to, bo każda kolejna poprawka i tak idzie przez repo.
2. **Dodaj brakujące assety:** `public-site/public/og-default.png` (1200×630) + `favicon.svg` (P2). Jeden rebuild załatwia dwa findingi.
3. **Utwórz `src/pages/404.astro`** i popraw `nginx.conf` (`try_files … =404; error_page 404 /404.html;`) — koniec soft-404 (P1).
4. **Zablokuj indeksację subdomeny `app.`** w `nginx.conf` (`X-Robots-Tag noindex` + `robots.txt: Disallow /`) i reload nginx (P1).
5. **Dodaj JSON-LD** (`Organization` w `Base.astro` + `Course` na index/o-kursie) (P2).
6. **Optymalizacja czcionek** (self-host / przycięcie osi Fraunces) → re-test PSI, cel LCP <2,5 s (P2).
7. **Rebuild Astro + deploy** wszystkich powyższych zmian frontu (`INTERNAL_API_BASE=http://127.0.0.1:4010 npm run build` w public-site → `aws`/sync/`/var/www/kurs-copywritingu`).
8. **Podłącz GSC + GA4 + analytics**, dodaj domenę do `seo_panel`, wyślij sitemap (P2-workflow). Uwaga: „Request Indexing" w GSC ~10 URL/dzień — przy 27 URL rozłóż na 2–3 dni (choć dla świeżej domeny wystarczy zgłosić sitemap i poczekać na crawl).
9. **Polish (P3):** ujednolić separatory tytułów, rozbudować meta opisy stron pomocniczych, dodać twitter:title/description/image, podbić cache hashowanych assetów.

---

## Appendix — verification commands
```bash
# live / drift
git log --oneline -3; git status --short; git log -1 --format=%ai
curl -sI https://kurs-copywritingu.pl                       # 200, HSTS, Last-Modified
curl -o /dev/null -w "%{http_code} %{size_download}" https://kurs-copywritingu.pl/losowy-url-123   # soft-404 → 200 18952
curl -sI https://kurs-copywritingu.pl/og-default.png        # 404
curl -sI https://kurs-copywritingu.pl/favicon.svg           # 404
curl -sI http://kurs-copywritingu.pl                        # 301 → https
curl -sI https://www.kurs-copywritingu.pl                   # 301 → apex
# app subdomain
curl -sI https://app.kurs-copywritingu.pl/login             # 200, brak noindex
curl -s  https://app.kurs-copywritingu.pl/robots.txt        # zwraca 404 Next (brak robots)
curl -sI https://app.kurs-copywritingu.pl/dashboard         # 307 → /login (gated)
# sitemap
curl -s https://kurs-copywritingu.pl/sitemap-index.xml      # 1 dziecko: sitemap-0.xml
curl -s https://kurs-copywritingu.pl/sitemap-0.xml          # 27 URL, absolutne
# DB (prod, host panel)
ssh panel: sudo -u postgres psql -d seo_panel -c "SELECT … WHERE domain ILIKE '%kurs-copywritingu%'"  # 0 rows
# PSI
GET pagespeedonline/v5/runPagespeed?url=https://kurs-copywritingu.pl/&strategy=mobile  # perf 75, LCP 4.2s, SEO 100
```
