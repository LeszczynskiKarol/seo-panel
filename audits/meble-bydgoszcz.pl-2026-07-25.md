# SEO audit (on-site + off-site) — meble-bydgoszcz.pl
**Date:** 2026-07-25
**Profile:** A/B hybrid — lokalna wizytówka usługowa (meble na wymiar, Bydgoszcz) z blogiem contentowym (10 wpisów). W panelu sklasyfikowana jako SATELLITE, ale funkcjonalnie to strona lead-gen własnego biznesu.
**Stack:** Astro (static), S3 `meble-bydgoszcz-static` + CloudFront (www: E30D0R03T5Q0AH, apex: E20PWMP4ZEUKF9), deploy przez GitHub Actions (push + repository_dispatch z panelu). Repo lokalne: `D:\meble-bydgoszcz-modern`.
**Repo↔prod state:** MIXED — 3 pliki src zmodyfikowane niezacommitowane (w tym fix sitemapy), śledzony w git stale'owy `dist/`, live = build CI z HEAD (świeży, Last-Modified 2026-07-24 22:00 GMT).
**Last crawl (panel):** 2026-07-24 03:13 | **GSC pull:** 2026-07-24 06:00 | **GA4 sync:** 2026-07-24 08:00
**Pages:** 57 tracked, 39 indexed, 50 w sitemapie (39 realnych + 11 duplikatów) | **DA:** 14 / PA 26 | **28d GSC:** 4 kliknięcia, ~2 600 wyświetleń, śr. pozycja ~30 | **28d GA4:** 7 sesji, 0 konwersji

---

## ⚠ Drift summary — repo ↔ prod
| Plik | Status | W repo (HEAD) | Na live | Akcja |
|------|--------|----------------|----------------|--------|
| `astro.config.mjs` | `M` niezacommitowany | HEAD: `sitemap({customPages: [12 URL-i bez trailing-slash]})` → duplikaty w sitemapie | live sitemap ma 11 duplikatów 301 | **COMMIT + DEPLOY** — lokalny diff (usunięcie customPages) naprawia problem |
| `src/pages/kontakt.astro`, `src/lib/types.ts` | `M` niezacommitowane | WIP Karola (formularz) | live = wersja z HEAD | dokończyć/zacommitować świadomie |
| `dist/**` (setki plików) | śledzony, stale | build sprzed kilku dni + moje lokalne buildy | live budowane przez CI od zera | **usunąć z repo** — patrz P2 `.gitignore` |

---

## P0 — Critical (fix this week)

### [LIVE] Brak robots.txt — 404 na produkcji
**Where:** `https://www.meble-bydgoszcz.pl/robots.txt`; brak pliku w `public/` (są tylko favicony, `site.webmanifest`, `images/`).
**Evidence:** `curl` → S3 `404 NoSuchKey, Key: robots.txt` (2026-07-25).
**Impact:** brak dyrektywy `Sitemap:` (sitemapa znajdowana tylko przez GSC), każdy crawler dostaje 404 zamiast polityki; przy 39/57 zindeksowanych stron discovery ma znaczenie.
**Fix:** utworzyć `D:\meble-bydgoszcz-modern\public\robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://www.meble-bydgoszcz.pl/sitemap-index.xml
```
commit + push (CI wdroży).

### [LIVE] Link `/proces` → 404 w stopce każdej strony (34 strony linkujące)
**Where:** `src/components/layout/Footer.astro:36`: `<li><a href="/proces">Strona główna</a></li>` — href wskazuje nieistniejącą stronę, a etykieta mówi „Strona główna".
**Evidence:** sitecrawl 2026-07-25: `[404] https://meble-bydgoszcz.pl/proces (linkowany z 34 stron)`; `curl /proces` → 404.
**Impact:** site-wide broken link (crawl waste + sygnał jakości); użytkownik klikający „Strona główna" w stopce ląduje na rozbitym XML-owym 404 S3.
**Fix:** w `Footer.astro:36` zamienić `href="/proces"` na `href="/"`.

---

## P1 — High (fix this sprint)

### [DRIFT→DEPLOY] Sitemapa zawiera 11 duplikatów bez trailing-slash, wszystkie 301
**Where:** live `sitemap-0.xml` — pary `/kuchnie` + `/kuchnie/` itd. dla 11 podstron; źródło: `astro.config.mjs` w HEAD (`sitemap({customPages:[...]})` z URL-ami bez slasha).
**Evidence:** urlcheck 2026-07-25: 50 URL-i, 11 z `redirects=1`. Skutek już widoczny w GSC: `https://www.meble-bydgoszcz.pl/realizacje` (bez slasha) ma własne 56 wyświetleń na pozycji 67,0, konkurując z `/realizacje/`; `/regulamin` (bez slasha) 8 wyświetleń.
**Impact:** rozmycie sygnałów na duplikaty, redirecty w sitemapie (higiena), 57 tracked vs 39 indexed w panelu to w dużej mierze te duplikaty.
**Fix:** lokalny, niezacommitowany diff `astro.config.mjs` już usuwa `customPages` — `git add astro.config.mjs && git commit -m "sitemap: usun customPages (duplikaty bez trailing-slash)" && git push`. Po deployu w GSC podejrzeć, czy sitemapa spadła do 39 wpisów.

### [LIVE] `og:image` i obraz schema wskazują nieistniejące pliki (404)
**Where:** `src/content/site-config.ts:51` → `https://www.meble-bydgoszcz.pl/og-image.jpg`; `src/layouts/BaseLayout.astro:123` (JSON-LD FurnitureStore) → `https://www.meble-bydgoszcz.pl/logo.png`. Oba emitowane na **każdej** stronie.
**Evidence:** `curl -w %{http_code}` → og-image.jpg: **404**, logo.png: **404** (2026-07-25). W `public/` są wyłącznie favicony.
**Impact:** udostępnienia na FB/Messenger/WhatsApp bez obrazka (dla lokalnego biznesu to główny kanał poleceń); schema z martwym `image`.
**Fix:** dodać do `public/`: `og-image.jpg` (1200×630, np. najlepsza realizacja kuchni z CDN) i `logo.png`; commit + push. Alternatywnie podmienić oba URL-e w `site-config.ts:51` i `BaseLayout.astro:123` na istniejący plik z `https://media.meblesystem.pl/...`.

### [WORKFLOW] Sekcja „Opinie klientów" martwa — brak `PUBLIC_GOOGLE_PLACE_ID` w buildzie CI
**Where:** `src/components/sections/Reviews.astro:86` używa `import.meta.env.PUBLIC_GOOGLE_PLACE_ID`; `.github/workflows/deploy.yml` nie ustawia żadnych env (tylko AWS creds); `.env` jest w `.gitignore`, więc CI go nie ma.
**Evidence:** live homepage: sekcja wisi na „Ładowanie opinii z Google...", licznik „-.-", link „wszystkie opinie" z `place_id:undefined`.
**Impact:** pusty social proof na stronie głównej + link do Google Maps prowadzący donikąd.
**Fix:** w `deploy.yml` w kroku `npm run build` dodać `env: PUBLIC_GOOGLE_PLACE_ID: ${{ secrets.GOOGLE_PLACE_ID }}` i dodać sekret w repo (wartość z Google Business Profile). Jeśli opinie i tak są fetchowane client-side z klucza, którego nie ma — rozważyć wstawienie 3-4 opinii statycznie do HTML (SSG), a link „więcej" do profilu GBP.

### [LIVE] LCP 4,3–6,1 s mobile (próg „poor" > 4 s)
**Where:** PSI mobile 2026-07-25: home **LCP 4,3 s** (perf 82), `/realizacje/` **LCP 6,1 s** (perf 72), `/kontakt/` LCP 3,7 s + **TBT 530 ms** (perf 74). CLS wszędzie 0.
**Evidence:** jw. (API PageSpeed, klucz z `.env` skilla).
**Impact:** przy pozycjach ~30 CWV nie jest głównym hamulcem, ale `/realizacje/` to strona konwersyjna — 6,1 s na mobile realnie gubi leady.
**Fix (konkrety):**
1. `/realizacje/` renderuje galerię w 100% client-side (`renderGallery()` z `innerHTML`) — LCP czeka na JS. Wyrenderować pierwsze ~12 kafelków statycznie w Astro (build-time, dane są w `galleryData` w tym samym pliku), JS niech tylko dokłada paginację/filtry.
2. Obrazy CDN wstawiane bez `width`/`height`/`srcset` — dodać `width="600" height="600"` (kafelki są kwadratowe) i `loading="lazy"` zostaje; dla pierwszych 4 kafelków `loading="eager"` + `fetchpriority="high"` na pierwszym.
3. `/kontakt/` TBT 530 ms — inline skrypt formularza (Cloudinary widget w HEAD) ładować z `defer`/po interakcji; zbiega się z WIP migracji formularza.

### [CONTENT] Tytuły przekraczają 65 znaków na całej witrynie; blog ma potrójny suffix
**Where:** wszystkie 39 stron (urlcheck: issue `tytuł >65 zn.` na każdej niż-redirect stronie poza FAQ). Blog: `BlogLayout.astro:113` dokleja `| Blog Meble Bydgoszcz`, a `site-config.ts:33` (`titleTemplate: "%s | Meble-Bydgoszcz.pl"`) dokleja drugi suffix → np. 134 zn.: „Garderoba na wymiar — jak zaprojektować... | Blog Meble Bydgoszcz | Meble-Bydgoszcz.pl".
**Evidence:** crawl CSV `meble-bydgoszcz-crawl.csv`, kolumna title (80–134 zn.).
**Impact:** Google ucina tytuły w SERP ~60 zn.; przy CTR 0,15% (4 kliki / 2600 wyświetleń) snippet to najtańsza dźwignia.
**Fix:** w `BlogLayout.astro:113` zamienić `` title={`${title} | Blog Meble Bydgoszcz`} `` na `title={title}` (globalny template i tak doda markę). Dla stron usługowych skrócić frontmatter `title` do wzorca „Garderoby na wymiar Bydgoszcz — [wyróżnik]" ≤ 60 zn. z markią.

---

## P2 — Medium

### [LIVE] Schema FurnitureStore: adres bez ulicy/kodu, brak geo, `sameAs` wskazuje Instagram innej marki
**Where:** JSON-LD w `BaseLayout.astro` (emitowany na każdej stronie).
**Evidence:** live: `address` = tylko `Bydgoszcz, PL` (brak `streetAddress`, `postalCode`); brak `geo`; `sameAs`: `instagram.com/grandkuchnie` (profil **grandkuchnie**, nie meble-bydgoszcz) oraz facebookowy URL z `&ref=pl_edit_xav_ig_profile_page_web#`.
**Impact:** osłabiony sygnał NAP dla local SEO; cross-brand mieszanie encji (Google może skleić meble-bydgoszcz z grandkuchnie).
**Fix:** w `BaseLayout.astro` uzupełnić `streetAddress`, `postalCode`, dodać `geo: {latitude, longitude}` zgodnie z wizytówką GBP; w `sameAs` zostawić czysty URL FB (`https://www.facebook.com/profile.php?id=61576849590169`) i wpisać właściwy profil IG marki albo usunąć wpis.

### [LIVE] 5 pustych kategorii bloga: sieroty w sitemapie
**Where:** `/blog/kategoria/{faq, realizacje, sypialnie, trendy-i-inspiracje, wykonczenia-wnetrz}/` — w sitemapie, nieosiągalne żadnym linkiem wewnętrznym (sitecrawl, pełne pokrycie 36/39 stron).
**Impact:** indeksowalne thin pages bez treści i bez linków — szum jakościowy.
**Fix:** w generatorze kategorii (`src/pages/blog/kategoria/`) budować strony tylko dla kategorii mających ≥1 wpis (filtr na kolekcji `blog` przed `getStaticPaths`), pozostałe wykluczyć też z sitemapy.

### [WORKFLOW] `dist/` śledzony w git przez literówkę w `.gitignore`
**Where:** `.gitignore` ostatnia linia: `.dist` (kropka za dużo) i brak końcowego newline (`cat -A`: `.dist` bez `$`).
**Impact:** stale'owy build w repo (dziś: kilkaset zmodyfikowanych/untracked plików po lokalnych buildach), rozdęte diffy, ryzyko konfliktów; CI i tak buduje od zera.
**Fix:** poprawić na `dist` + newline, potem `git rm -r --cached dist && git commit -m "gitignore: dist zamiast .dist, usun dist z repo"`.

### [LIVE] Brak strony 404 — surowy XML S3
**Where:** dowolny nieistniejący URL, np. `/nie-ma-takiej-strony/` → status 404, ale body to `NoSuchKey` + „An Error Occurred While Attempting to Retrieve a Custom Error Document: error.html" (S3 website szuka `error.html`, którego nie ma; Astro nie generuje `404.html`, bo brak `src/pages/404.astro`).
**Fix:** dodać `src/pages/404.astro` (layout + link do realizacji/kontaktu); w konfiguracji S3 website bucketa `meble-bydgoszcz-static` ustawić ErrorDocument na `404.html`.

### [LIVE] Brak nagłówka HSTS
**Evidence:** `curl -I https://www.meble-bydgoszcz.pl/` — brak `Strict-Transport-Security` (2026-07-25).
**Fix:** w CloudFront (obie dystrybucje E30D0R03T5Q0AH, E20PWMP4ZEUKF9) podpiąć Response Headers Policy `Managed-SecurityHeadersPolicy` albo custom z `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

### [CONTENT] Klaster „garderoby" — największa niewykorzystana widoczność
**Evidence (GSC API, 28d):** `garderoby na wymiar bydgoszcz` 69 imp/poz. 27,6; `garderoby zabudowa bydgoszcz` 57/28,3; `garderoby na zamówienie bydgoszcz` 47/28,7; `garderoby bydgoszcz` 46/26,9; `garderoba na wymiar bydgoszcz` 43/35,7 — łącznie ~260+ imp., 0 kliknięć. Dziś rankuje zbiorcza `/szafy-garderoby/`.
**Fix:** wydzielić dedykowaną podstronę `/garderoby-bydgoszcz/` (lub rozbudować `/szafy-garderoby/` z H1/tytułem „Garderoby na wymiar Bydgoszcz"), z sekcją realizacji garderób z CDN i wewnętrznym linkowaniem z home + bloga (wpis o garderobie już jest: `garderoba-na-wymiar-projektowanie`).

---

## P3 — Polish
- Podwójny hop przekierowania: `http://meble-bydgoszcz.pl` → `https://meble-bydgoszcz.pl` → `https://www...` — można 301-ować od razu na www (konfiguracja CloudFront/S3 apex).
- Wszystkie kafelki galerii mają identyczny `alt="Realizacja"` / `alt="Kuchnia na wymiar Bydgoszcz"` — przy przejściu na SSG (fix LCP) nadać alty z kategorii + miasta.
- GA4: 0 keyEvents skonfigurowanych efektów — jeśli formularz `/lead` ma być liczony jak na meblesystem, dodać key event w GA4 (panel liczy konwersje per domena).

---

## Off-site — podsumowanie
**Autorytet:** DA 14, PA 26 (Moz, cron panelu).
**Backlinki (BacklinkSnapshot, 91 rekordów):** żywych tylko **6** — wszystkie z własnej sieci: `karol-leszczynski.pl` ×4, `torweb.pl` ×2 (dofollow). Pozostałe 85 (freestyle.pl DA37, empowher DA79, pages.dev DA92, thebump DA77, katalogi/scrapery) — `isLive=false`, wygasłe. Kotwice żywych linków wyłącznie brandowe/generyczne („meble-bydgoszcz.pl", „Zobacz stronę", „Odwiedź →") — zero fraz z „meble/garderoby/kuchnie Bydgoszcz".
**Widoczność:** śr. pozycja ~30; impresje rosną (56/dzień pod koniec czerwca → 107-135/dzień w połowie lipca), ale CTR ~0,15% (4 kliki/28 dni) — strona jest „widziana, nieklikana" (pozycje 26-36 + ucięte tytuły).
**Lokalność:** zapytania z miejscowości ościennych już się pojawiają (aleksandrów kujawski 26 imp., papowo toruńskie 14, chełmża) — potencjał na sekcję „obszar działania".
**Rekomendacje off-site (kolejność wg zwrotu):**
1. **GBP**: naprawić widget opinii (P1 wyżej), zdobywać opinie z frazą usługi; spójny NAP ze schemą (po uzupełnieniu adresu).
2. 3-5 linków z lokalnych źródeł bydgoskich (katalogi firm KujPom, portale lokalne — `bydgoszcz.com` już kiedyś linkował i link wygasł: odzyskać) z kotwicami „meble na wymiar Bydgoszcz" / „garderoby Bydgoszcz".
3. Linki wewnętrzne sieci własnej: z meblesystem.pl (DA wyższe, ten sam właściciel) kontekstowy link do meble-bydgoszcz.pl — obecnie brak go w żywych backlinkach.
4. Po naprawie tytułów (P1) — monitorować CTR w GSC; to tańsze niż linki przy obecnych pozycjach.

## Unverified — needs re-run
- Stan wizytówki Google Business Profile (opinie, kategoria, NAP) — brak dostępu API z tej sesji; sprawdzić ręcznie w GBP.
- Konfiguracja key events w GA4 (property 505145465) — wymaga wejścia w admin GA4.
- Czy panel „Publikuj" dla meble-bydgoszcz wysyła `repository_dispatch` poprawnie (deploy działa z push — dispatch nietestowany w tym audycie).

## Skipped — not applicable
- C11 Product/Offer schema — to nie e-commerce.
- T16 hreflang — jedna wersja językowa.
- botlog / crawl-budget — hosting S3+CloudFront, brak logów nginx; przy 39 stronach crawl budget bez znaczenia.
- Faceted search / paginacja kanoniczna — brak parametryzowanych listingów.

---

## Sequence of recommended actions
1. **Edycje w repo (jeden PR):** `public/robots.txt` (P0) → `Footer.astro:36` href="/" (P0) → commit gotowego `astro.config.mjs` (P1 sitemap) → `og-image.jpg` + `logo.png` do `public/` (P1) → `BlogLayout.astro:113` bez podwójnego suffixu (P1) → `.gitignore` `dist` + `git rm --cached` (P2) → `src/pages/404.astro` (P2) → schema: adres/geo/sameAs (P2).
2. **GitHub:** sekret `GOOGLE_PLACE_ID` + env w `deploy.yml` (P1 opinie).
3. **AWS:** Response Headers Policy z HSTS na obu dystrybucjach (P2); ErrorDocument=404.html na buckecie (P2).
4. **Po deployu:** w GSC ponownie przesłać sitemapę; NIE wymuszać re-indeksacji 11 duplikatów (limit ~10 URL-i/dzień — zbędne, 301 same wygasną).
5. **Content sprint:** strona/sekcja „Garderoby Bydgoszcz" + skrócone tytuły usługowe (P1/P2).
6. **Off-site:** GBP + 3-5 lokalnych linków + link z meblesystem.pl.

## Appendix — verification commands
```bash
curl -sIL -A "Mozilla/5.0" https://meble-bydgoszcz.pl/            # łańcuch 301
curl -s https://www.meble-bydgoszcz.pl/robots.txt                  # 404 NoSuchKey
curl -s -o /dev/null -w "%{http_code}" https://www.meble-bydgoszcz.pl/og-image.jpg   # 404
D:\go-tools\urlcheck\urlcheck.exe -sitemap https://www.meble-bydgoszcz.pl/sitemap-index.xml -dupes
D:\go-tools\sitecrawl\sitecrawl.exe -sitemap https://www.meble-bydgoszcz.pl/sitemap-index.xml https://www.meble-bydgoszcz.pl/
# prod DB: aws-ssh panel "sudo -u postgres psql -d seo_panel ..." (Domain, GscDomainDaily, GscPageDaily+Page, BacklinkSnapshot)
# GSC API: sc-domain:meble-bydgoszcz.pl, 28d, dimensions=query
# GA4: properties/505145465 runReport sessions/totalUsers/keyEvents 28daysAgo..yesterday
# PSI: home / realizacje / kontakt, mobile
```
Crawle: `D:\seo-panel\audits\cache\meble-bydgoszcz-crawl.csv`, `meble-bydgoszcz-graph.csv`.
