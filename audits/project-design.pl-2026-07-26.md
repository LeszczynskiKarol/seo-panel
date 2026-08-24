# SEO audit (on-site + off-site) — project-design.pl

> ## ✅ Stan wdrożenia — 2026-07-26
>
> Commit `61f696a` wdrożony na produkcję (GitHub Actions run `30178244683`, sukces).
> Zweryfikowane na żywo po inwalidacji CloudFront.
>
> **Naprawione (P0):** literówka w canonical → 404 · rozjazd canonical ↔ sitemap na 5 stronach ·
> `robots.txt` (404 → 200 z dyrektywą `Sitemap:`) · e-mail w stopce i JSON-LD kierujący do
> zaparkowanej domeny · zmyślone opinie, „500 opinii" i twarde „4,9/5" · placeholder telefonu
> w danych strukturalnych.
>
> **Naprawione (P1/P2):** `og:image` (404 + względny) · martwy link `/portfolio` · `sameAs`
> wskazujący cudze profile · brak `streetAddress` w JSON-LD · martwe deklaracje favikon ·
> brak strony 404 · link do domeny NXDOMAIN · placeholder telefonu w regulaminie · sitemap
> bez `lastmod` i ze stronami prawnymi · CLS **0,122 → 0** · render-blocking fontów
> (**1 780 ms → 0**) · `FaqPage`/`BreadcrumbList`/`Person` w JSON-LD · H1 bez modyfikatora
> lokalnego · brak linków kontekstowych · hierarchia nagłówków na `/realizacje/` ·
> brakujące `alt` · za długie opisy meta · martwe pliki startowe Astro.
>
> **Obrazy responsywne** (commity `fefe8fa`, `f2d9c31`): 18 unikalnych zdjęć → 62 warianty
> `-480w/-768w/-1200w/-1600w` wgrane do `s3://meblowe-media` obok oryginałów, `srcset`+`sizes`
> na wszystkich obrazach, preload i `fetchpriority="high"` na obrazie hero każdej strony.
>
> **Zmierzony efekt (PSI mobile, przed → po, cache CloudFront rozgrzany):**
>
> | Strona | performance | LCP | CLS | obrazy do odzyskania |
> |---|---|---|---|---|
> | `/` | 65 → **74** | 11,9 s → **5,6 s** | 0,122 → **0** | 1 564 KiB → **136 KiB** |
> | `/aranzacje-wnetrz/` | 82 → **89** | 3,9 s → **3,0 s** | 0,003 | 99 KiB → **6 KiB** |
> | `/realizacje/` | 72 → **91** | 6,3 s → **3,4 s** | 0,001 | 1 092 KiB → **13 KiB** |
> | `/studio-projektowania-wnetrz/` | — | **3,5 s** | 0,024 | — |
> | `/architekci-wnetrz/` | — | **4,5 s** | 0,026 | — |
> | `/projektowanie-mebli/` | — | **5,6 s** | 0,024 | — |
>
> **Wykonane poza kodem:** `Domain.gscProperty` ustawione na `sc-domain:project-design.pl`
> w prod `seo_panel` · sitemapa zgłoszona ponownie w GSC (0 błędów, 0 ostrzeżeń) ·
> **CloudFront: HSTS, Brotli, 302→301** (szczegóły niżej) · **śledzenie konwersji spięte
> end-to-end** — GTM `GTM-MK2JNT26` wersja 5 opublikowana (2 aktywatory + 2 tagi GA4 Event),
> `form_submission` i `phone_click` oznaczone jako kluczowe zdarzenia w `properties/506914236` ·
> adres firmy zmieniony na ul. Stefana Batorego 92F w 7 miejscach.
>
> **Infrastruktura CloudFront — wdrożone 2026-07-26:**
>
> | | przed | po |
> |---|---|---|
> | HSTS | brak | `max-age=31536000; includeSubDomains` |
> | dodatkowe nagłówki | brak | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |
> | kompresja | tylko gzip | **Brotli**: 105 319 B → **18 542 B** (gzip dawał 20 130 B) |
> | normalizacja ukośnika | **302** (tymczasowe) | **301** przez CloudFront Function |
> | HTTP | h2 | h2 + **h3** |
>
> **Pozostaje do zrobienia — patrz „Zadania otwarte" na końcu raportu.**

**Data:** 2026-07-26
**Profil:** A — statyczna witryna wizytówkowa / portfolio lokalnej firmy usługowej (8 podstron, Astro static → S3+CloudFront, biznes lokalny Toruń). Ciężar SEO leży w indeksacji, local SEO (NAP/GBP) i zaufaniu, nie w skali treści.
**Stack:** Astro 4.16 (`output: "static"`, `format: "directory"`), Tailwind, `@astrojs/sitemap`; deploy GitHub Actions → S3 `www.project-design.pl` + CloudFront (`E2UJNOA00CF4G8` www, `E1ZE3XVOTW45EO` apex).
**Repo↔prod:** **in-sync**. `git status --short` pusty; ostatni commit `e2699f1` 2026-07-25 20:44:31 +0200, live `Last-Modified: Sat, 25 Jul 2026 18:44:45 GMT` (= 20:44:45 CEST). CI zadziałało ~14 s po commicie. Brak driftu → sekcja drift pominięta.
**Ostatni crawl (panel):** 2026-07-25 03:33 | **GSC pull:** brak (integracja nieskonfigurowana) | **GA4 lastSync:** 2026-07-25 08:01 (`properties/506914236`, ACTIVE)
**Strony:** 8 w sitemapie, 8 w `Page`, `indexedPages`=7 (patrz P0-2 — realnie **2/8** zaindeksowane pod URL-em z sitemapy)
**Moz:** DA 4 / PA 15 / 9 domen odsyłających / 18 linków / spam score 1 (sync 2026-06-21)
**GSC 90 dni (2026-04-23 … 2026-07-22):** 47 kliknięć, 8 914 wyświetleń, CTR 0,53 %, śr. pozycja 28,1
**GSC 28 dni vs poprzednie 28:** 32 klik. / 3 107 wyśw. / CTR 1,03 % / poz. 30,5 **vs** 5 klik. / 2 756 wyśw. / CTR 0,18 % / poz. 28,9 → trend kliknięć rośnie
**GA4 90 dni:** 172 sesje, 152 użytkowników, 310 odsłon, bounce 55 %, **0 kluczowych zdarzeń**

---

## ⚠ Zastrzeżenia co do danych

- Dane Moz (DA, profil linków) pochodzą z **2026-06-21** — 5 tygodni wstecz. Wszystkie 32 rekordy `BacklinkSnapshot` ze źródła `MOZ` mają `isLive = false` (weryfikacja crawlerem panelu ich nie potwierdziła). Nie weryfikowałem każdego z osobna ręcznie — wnioski o profilu linków opieram na tym, że **żaden z nich nie jest potwierdzony jako żywy**, a nie na twardym "wszystkie są martwe".
- **CrUX (dane polowe) dla domeny nie istnieją** — `loadingExperience.metrics` puste w PSI. Wszystkie liczby wydajności to dane laboratoryjne Lighthouse (mobile), nie rzeczywisti użytkownicy.
- **Google Business Profile nie został zweryfikowany** — konto serwisowe nie ma dostępu do Business Profile API. Dla firmy lokalnej to najważniejszy pojedynczy czynnik off-site; wymaga sprawdzenia ręcznego (patrz „Do zweryfikowania").

---

# CZĘŚĆ I — ON-SITE

## P0 — Krytyczne (w tym tygodniu)

### [LIVE] Canonical na `/aranzacje-wnetrz/` wskazuje na literówkę → URL 404

**Gdzie:** `src/pages/aranzacje-wnetrz.astro:14`, live `https://www.project-design.pl/aranzacje-wnetrz/`

**Dowód:**
```
src/pages/aranzacje-wnetrz.astro:14:  canonical: 'https://www.project-design.pl/aranazacje-wnetrz'
                                                                        ^^^^ "aranazacje"

$ curl -sIL https://www.project-design.pl/aranazacje-wnetrz
HTTP/1.1 404 Not Found

$ curl -sL https://www.project-design.pl/aranzacje-wnetrz/ | grep canonical
<link rel="canonical" href="https://www.project-design.pl/aranazacje-wnetrz">
```
URL Inspection API (`sc-domain:project-design.pl`):
```
=== https://www.project-design.pl/aranzacje-wnetrz/
   verdict=NEUTRAL coverage='Alternatywna strona zawierająca prawidłowy tag strony kanonicznej'
   userCanonical=https://www.project-design.pl/aranazacje-wnetrz
   googleCanonical=https://www.project-design.pl/aranzacje-wnetrz
```

**Wpływ:** To najgorzej rankująca podstrona serwisu: **1 081 wyświetleń / 0 kliknięć / śr. pozycja 63,6** w 90 dni (GSC, wymiar `page`). Google zignorował uszkodzony canonical i sam wybrał URL, ale strona dostaje sprzeczny sygnał od witryny. Zapytania, które ta strona powinna obsługiwać, stoją nisko: „aranżacja wnętrz toruń" 425 wyśw./poz. 28,8, „aranżacje apartamentów toruń" 243 wyśw./poz. 32,3, „aranżacje wnętrz toruń" 208 wyśw./poz. 32,0, „aranżacja salonu toruń" 150 wyśw./poz. 20,0.

**Fix:** W `src/pages/aranzacje-wnetrz.astro:14` zamień
`canonical: 'https://www.project-design.pl/aranazacje-wnetrz'`
na
`canonical: 'https://www.project-design.pl/aranzacje-wnetrz/'`
(poprawiona literówka **oraz** końcowy ukośnik — uzasadnienie w P0-2).

---

### [LIVE] Canonical bez końcowego ukośnika ↔ sitemap z ukośnikiem — 5 z 8 stron nie jest indeksowanych pod adresem z sitemapy

**Gdzie:** `src/pages/aranzacje-wnetrz.astro:14`, `architekci-wnetrz.astro:14`, `projektowanie-mebli.astro:13`, `realizacje.astro:12`, `studio-projektowania-wnetrz.astro:14`

**Dowód:** sitemap zgłasza wersje **z** ukośnikiem, canonical wskazuje wersje **bez**, a wersje bez ukośnika przekierowują 302 z powrotem na wersje z ukośnikiem:
```
$ cat sitemap-0.xml
<loc>https://www.project-design.pl/studio-projektowania-wnetrz/</loc>   ← w sitemapie

$ curl -sL https://www.project-design.pl/studio-projektowania-wnetrz/ | grep canonical
<link rel="canonical" href="https://www.project-design.pl/studio-projektowania-wnetrz">   ← canonical bez /

$ curl -sIL https://www.project-design.pl/studio-projektowania-wnetrz
HTTP/1.1 302 Moved Temporarily
Location: /studio-projektowania-wnetrz/                                 ← cel canonicala przekierowuje
HTTP/1.1 200 OK
```
Canonical wskazuje więc na URL, który przekierowuje z powrotem na stronę deklarującą. URL Inspection API na wszystkich 8 adresach z sitemapy:

| URL z sitemapy | verdict | coverageState | googleCanonical |
|---|---|---|---|
| `/` | PASS | Strona przesłana i zindeksowana | `/` |
| `/aranzacje-wnetrz/` | NEUTRAL | Alternatywna strona z prawidłowym tagiem kanonicznym | `/aranzacje-wnetrz` |
| `/architekci-wnetrz/` | NEUTRAL | Alternatywna strona z prawidłowym tagiem kanonicznym | `/architekci-wnetrz` |
| `/projektowanie-mebli/` | NEUTRAL | Alternatywna strona z prawidłowym tagiem kanonicznym | `/projektowanie-mebli` |
| `/realizacje/` | NEUTRAL | Alternatywna strona z prawidłowym tagiem kanonicznym | `/realizacje` |
| `/studio-projektowania-wnetrz/` | NEUTRAL | Alternatywna strona z prawidłowym tagiem kanonicznym | `/studio-projektowania-wnetrz` |
| `/polityka-prywatnosci/` | PASS | Strona przesłana i zindeksowana | `/polityka-prywatnosci/` |
| `/regulamin/` | NEUTRAL | Strona zeskanowana, ale jeszcze nie zindeksowana (ostatni crawl 2026-05-25) | `/regulamin/` |

Dwie strony, które **nie** przekazują propa `canonical` (`polityka-prywatnosci`, `regulamin`) korzystają z domyślnego `Astro.url.href` w `src/components/SEO.astro:16` i mają canonical z ukośnikiem — i to właśnie one nie mają tego problemu.

**Wpływ:** Wszystkie 5 stron usługowych — czyli cała komercyjna część serwisu — jest w GSC oznaczona jako „strona alternatywna", a nie zaindeksowana pod adresem zgłoszonym w sitemapie. Realnie w indeksie siedzą wersje bez ukośnika, które odpowiadają **302** (tymczasowym), więc Google przy każdym crawlu musi wykonać dodatkowy skok i traktuje ten stan jako nieustalony. Dane GSC to potwierdzają — raportowane są URL-e bez ukośnika: `/studio-projektowania-wnetrz` (2 924 wyśw.), `/architekci-wnetrz` (2 948 wyśw.), `/projektowanie-mebli` (967 wyśw.). Wartość `indexedPages = 7` w panelu jest myląca.

**Fix:** Doprowadzić canonical, sitemap i realny URL do jednej postaci — z końcowym ukośnikiem (to natywny format Astro `format: "directory"` i to jest URL, który realnie zwraca 200). W pięciu plikach:

| Plik | Linia | Było | Ma być |
|---|---|---|---|
| `src/pages/aranzacje-wnetrz.astro` | 14 | `'https://www.project-design.pl/aranazacje-wnetrz'` | `'https://www.project-design.pl/aranzacje-wnetrz/'` |
| `src/pages/architekci-wnetrz.astro` | 14 | `'https://www.project-design.pl/architekci-wnetrz'` | `'https://www.project-design.pl/architekci-wnetrz/'` |
| `src/pages/projektowanie-mebli.astro` | 13 | `'https://www.project-design.pl/projektowanie-mebli'` | `'https://www.project-design.pl/projektowanie-mebli/'` |
| `src/pages/realizacje.astro` | 12 | `'https://www.project-design.pl/realizacje'` | `'https://www.project-design.pl/realizacje/'` |
| `src/pages/studio-projektowania-wnetrz.astro` | 14 | `'https://www.project-design.pl/studio-projektowania-wnetrz'` | `'https://www.project-design.pl/studio-projektowania-wnetrz/'` |

Najprościej: **usunąć prop `canonical` z tych 5 plików w całości** — domyślne `Astro.url.href` w `SEO.astro:16` wygeneruje poprawny adres z ukośnikiem, tak jak już działa na `polityka-prywatnosci` i `regulamin`. Jedna zmiana mniej do utrzymania i literówka z P0-1 nie ma prawa się powtórzyć.

Po wdrożeniu: w GSC „Sprawdzenie URL → Poproś o zindeksowanie" dla 5 adresów. Limit Google to ok. **10 URL-i/dobę na property**, więc mieści się w jednym dniu.

---

### [LIVE] `robots.txt` zwraca 404 — brak pliku w repo i na produkcji

**Gdzie:** `https://www.project-design.pl/robots.txt`; brak `public/robots.txt` w repo

**Dowód:**
```
$ curl -s -w "status=%{http_code}\n" https://www.project-design.pl/robots.txt
status=404
<html><head><title>404 Not Found</title></head>... <li>Code: NoSuchKey</li> ...

$ find . -name 'robots*' -not -path './node_modules/*'
(brak wyników)
```
`.github/workflows/deploy.yml` w obu krokach `aws s3 sync` jawnie wymienia `robots.txt` (`--exclude "robots.txt"` / `--include "robots.txt"`) — pipeline został przygotowany pod plik, który nigdy nie powstał.

**Wpływ:** Brak dyrektywy `Sitemap:`. Sytuację pogarsza to, że sitemapa nie leży pod kanonicznym adresem: `@astrojs/sitemap` generuje `sitemap-index.xml`, a `https://www.project-design.pl/sitemap.xml` zwraca **404**. Boty, które szukają sitemapy konwencjonalnie (przez robots.txt albo `/sitemap.xml`), nie znajdą jej wcale.

**Fix:** Utwórz `public/robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://www.project-design.pl/sitemap-index.xml
```
Plik z `public/` trafia do `dist/` przy `npm run build`, a workflow już go obsługuje (Cache-Control `max-age=0, must-revalidate`).

---

### [LIVE] Adres e-mail w stopce i w JSON-LD prowadzi do zaparkowanej domeny — leady mailowe przepadają

**Gdzie:** `src/components/Footer.astro:90-91`, `src/components/SEO.astro:68`

**Dowód:**
```
src/components/Footer.astro:90:  <a href="mailto:kontakt@projectdesign.pl" ...>
src/components/Footer.astro:91:    kontakt@projectdesign.pl
src/components/SEO.astro:68:     "email": "kontakt@projectdesign.pl",
```
vs. prawidłowy adres używany w formularzu kontaktowym:
```
src/components/Contact.astro:7:  email: "kontakt@project-design.pl",
```
DNS dla domeny bez łącznika:
```
$ nslookup -type=MX projectdesign.pl
projectdesign.pl  MX preference = 10, mail exchanger = blackhole.aftermarket.pl

$ nslookup -type=MX project-design.pl
project-design.pl  MX preference = 10, mail exchanger = mx1.47.pl
```
`projectdesign.pl` (bez łącznika) to **cudza domena wystawiona na sprzedaż w aftermarket.pl**, z rekordem MX kierującym na `blackhole.aftermarket.pl`. Poczta wysłana na ten adres nie dociera nigdzie.

**Wpływ:** Dwojaki. Biznesowo — każdy użytkownik, który kliknie e-mail w stopce (obecnej na wszystkich 8 podstronach), wysyła zapytanie w próżnię. SEO-lokalnie — dane NAP w JSON-LD (`email`) są niezgodne z resztą witryny i z GBP, co osłabia spójność encji.

**Fix:**
1. `src/components/Footer.astro:90` → `href="mailto:kontakt@project-design.pl"`
2. `src/components/Footer.astro:91` → tekst `kontakt@project-design.pl`
3. `src/components/SEO.astro:68` → `"email": "kontakt@project-design.pl",`

---

### [LIVE] Na stronie głównej wyświetlają się zmyślone opinie klientów, „500 opinii" i ocena „4,9/5"

**Gdzie:** `src/components/Testimonials.astro:31-73` (fallback), `:79-80` (`totalRating = 5.0`, `totalReviews = 500`), `:124` i `:141-142` (render), live `https://www.project-design.pl/`

**Dowód:** treść pobrana surowym `curl` ze strony produkcyjnej:
```
$ grep -o 'Anna Kowalska\|Marek Nowicki\|Wiśniewscy' home.html | sort | uniq -c
      1 Anna Kowalska
      1 Marek Nowicki
      1 Wiśniewscy
$ grep -oE '[0-9]{2,4}\+? ?(opinii|opinie|recenzji)' home.html
500 opinii
$ grep -oE '4[.,][0-9][^<>]{0,25}' home.html
4.9/5 ocena klientów
```
Źródło w repo:
```
src/components/Testimonials.astro:31:  const fallbackTestimonials: Testimonial[] = [
        name: 'Anna Kowalska',                role: 'Właścicielka apartamentu', ...
        name: 'Marek Nowicki',                role: 'CEO firmy technologicznej', ...
        name: 'Katarzyna i Piotr Wiśniewscy', role: 'Rodzina z dziećmi', ...
:75  let allTestimonials: Testimonial[] = fallbackTestimonials.map(...)
:79  let totalRating: number = 5.0;
:80  let totalReviews: number = 500;
:83  const apiEndpoint = import.meta.env.PUBLIC_REVIEWS_API_ENDPOINT;
:85  if (apiEndpoint) { ... fetch ... }
:124   Zaufało nam już ponad {totalReviews} klientów. ...
:141   <span ...>{totalRating.toFixed(1)}</span>
:142   <span ...>({totalReviews} opinii)</span>
```
Fallback aktywuje się, gdy `PUBLIC_REVIEWS_API_ENDPOINT` nie jest ustawione w czasie builda. `.github/workflows/deploy.yml` **nie ustawia tej zmiennej** (`grep -c 'PUBLIC_REVIEWS' .github/workflows/deploy.yml` → `0`), a `.env` nie trafia do repo (`.gitignore`). Każdy build z CI leci więc na danych zastępczych — co potwierdza treść live.

**Wpływ:** To nie jest usterka techniczna, tylko ekspozycja prawna. Publikowanie opinii konsumenckich, które nie pochodzą od realnych klientów, oraz podawanie zagregowanej oceny bez pokrycia to praktyka zakazana wprost po wdrożeniu dyrektywy Omnibus (ustawa o przeciwdziałaniu nieuczciwym praktykom rynkowym) — pod nadzorem UOKiK, z sankcją finansową. Dodatkowo „500 opinii" przy 172 sesjach na 90 dni jest niewiarygodne dla użytkownika i szkodzi E-E-A-T.

**Fix — wybierz jedną z dwóch dróg, obie kończą build bez zmyślonych treści:**

*Wariant A (szybki, zalecany na teraz):* usuń tablicę `fallbackTestimonials` (`Testimonials.astro:31-73`) i zmień logikę tak, żeby przy braku danych z API cała sekcja się nie renderowała. W `Testimonials.astro:75-80` zastąp inicjalizację:
```ts
let allTestimonials: Testimonial[] = [];
let totalRating: number | null = null;
let totalReviews: number | null = null;
```
a na początku bloku HTML sekcji dodaj `{allTestimonials.length > 0 && ( ... )}`. Usuń też z szablonu odwołania do niepokrytych liczb: `:124` („Zaufało nam już ponad {totalReviews} klientów"), `:141` (`{totalRating.toFixed(1)}`) i `:142` (`({totalReviews} opinii)`).

Osobno — ocena „4.9/5" **nie pochodzi z tego komponentu**, tylko jest wpisana na sztywno w sekcji hero:
```
src/components/Hero.astro:37:  <span class="text-sm text-slate-600">4.9/5 ocena klientów</span>
```
Usuń tę linię (wraz z otaczającym ją znacznikiem gwiazdek) albo podmień na wartość pobraną z realnych opinii GBP.

*Wariant B (docelowy):* dodaj `PUBLIC_REVIEWS_API_ENDPOINT` do sekretów repozytorium i przekaż go do kroku builda w `.github/workflows/deploy.yml`:
```yaml
      - run: npm run build
        env:
          PUBLIC_REVIEWS_API_ENDPOINT: ${{ secrets.PUBLIC_REVIEWS_API_ENDPOINT }}
```
— i tak zostaw wariant A jako zachowanie awaryjne, żeby padnięte API nigdy nie podstawiło fikcji.

Uwaga: dopiero po wariancie B (realne opinie z GBP) ma sens dodanie `AggregateRating` do JSON-LD. Na fikcyjnych danych byłoby to naruszenie wytycznych Google dla danych strukturalnych i podstawa do ręcznej kary.

---

### [LIVE] Numer telefonu w danych strukturalnych to placeholder `+48 XXX XXX XXX` na wszystkich 8 podstronach

**Gdzie:** `src/components/SEO.astro:67`, renderowane na każdej stronie przez `BaseLayout.astro:86-92`

**Dowód:**
```
src/components/SEO.astro:67:  "telephone": "+48 XXX XXX XXX",

$ grep -o 'XXX XXX XXX' home.html
XXX XXX XXX
```
Prawidłowy numer w witrynie: `+48 576 060 832` (`Contact.astro:6`, `Footer.astro:82`, `CTA.astro:52`).

**Wpływ:** Blok `InteriorDesignBusiness` to jedyne dane strukturalne w serwisie (1 skrypt JSON-LD na stronę, zweryfikowane na wszystkich 6 stronach usługowych). Google czyta z niego telefon jako sygnał NAP dla wyników lokalnych; wartość `XXX XXX XXX` sprawia, że pole jest bezużyteczne, a przy okazji rozjeżdża się z GBP i z treścią strony.

**Fix:** `src/components/SEO.astro:67` → `"telephone": "+48576060832",` (format E.164 bez spacji jest preferowany przez schema.org dla `telephone`).

---

## P1 — Wysokie (w tym sprincie)

### [LIVE] LCP 11,9 s na mobile na stronie głównej

**Gdzie:** `https://www.project-design.pl/` (PSI, strategy=mobile, klucz z `.env` skilla)

**Dowód:**
```
=== https://www.project-design.pl/ [mobile]
  perf=65 seo=100 a11y=96
  LCP=11.9 s  CLS=0.122  TBT=50 ms  FCP=3.0 s  SI=3.2 s
  --- nieudane audyty ---
   [0]    largest-contentful-paint   :: 11.9 s
   [0]    render-blocking-insight    :: Est savings of 1,780 ms
   [0]    image-delivery-insight     :: Est savings of 1,564 KiB
   [0]    unused-javascript          :: Est savings of 125 KiB
   [0,84] cumulative-layout-shift    :: 0.122
   [0,5]  unsized-images
```
Pozostałe strony (dla porównania): `/aranzacje-wnetrz/` perf 82, LCP 3,9 s; `/realizacje/` perf 72, LCP 6,3 s (oszczędność obrazów 1 092 KiB).

Największe obrazy na stronie głównej (`image-delivery-insight`, `wastedBytes`):
```
403 368 B  media.meblesystem.pl/.../Dorota-projektSLIWY_POKOJ_DZIECIECY_14_opt.webp
340 082 B  media.meblesystem.pl/.../Dorota-projektPROJEKT_SALON_Z_ANEKSEM_SZABAT_5_opt.webp
242 119 B  media.meblesystem.pl/.../Dorota-projektRESTAURACJA_PANORAMA_10_opt.webp
209 426 B  media.meblesystem.pl/.../Dorota-projektPROJEKT_JASKOLCZA_TORUN_3_opt.webp   ← element LCP (loading="eager")
194 945 B  media.meblesystem.pl/shared/adobe-portfolio/b266f6f9-..._rw_1920.webp
```

**Wpływ:** Strona główna to 125 z 172 sesji GA4 (90 dni) i 25 z 47 kliknięć GSC. Bounce rate 57 %. Brak danych CrUX oznacza, że Core Web Vitals nie wpływają jeszcze na ranking tej domeny (za mało ruchu na próbkę polową), ale wpływają na realną konwersję i na to, co zobaczy pierwszy użytkownik z organiku.

**Fix — trzy konkretne zmiany, w tej kolejności:**

1. **Preconnect do hosta obrazów.** `src/layouts/BaseLayout.astro:94-97` deklaruje preconnect do `fonts.googleapis.com`, `fonts.gstatic.com`, `googletagmanager.com` i `google-analytics.com`, ale **nie** do `media.meblesystem.pl` — a to stamtąd ładuje się obraz LCP (61 z 61 `<img src>` na witrynie wskazuje na ten host). Dodaj obok istniejących:
   ```html
   <link rel="preconnect" href="https://media.meblesystem.pl" crossorigin />
   <link rel="preload" as="image" fetchpriority="high"
         href="https://media.meblesystem.pl/meble-bydgoszcz.pl/realizacje-legacy/Dorota-projektPROJEKT_JASKOLCZA_TORUN_3_opt.webp" />
   ```

2. **Zdejmij blokadę renderowania z Google Fonts** (`render-blocking-insight`: 1 780 ms). W `BaseLayout.astro:99-102` arkusz fontów ładuje się synchronicznie. Zamień na wzorzec nieblokujący:
   ```html
   <link rel="stylesheet" media="print" onload="this.media='all'"
     href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Playfair+Display:wght@400;700;900&display=swap" />
   <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Playfair+Display:wght@400;700;900&display=swap" /></noscript>
   ```

3. **Dodaj `width`/`height` do `<img>`** (`unsized-images`, CLS 0,122 — jedyne przesunięcie na stronie). Obrazy w `Hero.astro`, `Portfolio.astro`, `Team.astro` mają tylko klasy Tailwind (`class="w-full h-full object-cover"`), bez atrybutów wymiarów. Bez nich przeglądarka nie rezerwuje miejsca przed pobraniem pliku.

---

### [LIVE] `og:image` wskazuje na nieistniejący plik i jest URL-em względnym

**Gdzie:** `src/components/SEO.astro:15,40,49`, `src/layouts/BaseLayout.astro:20`

**Dowód:**
```
src/components/SEO.astro:15:  ogImage = '/og-default.jpg'
src/components/SEO.astro:40:  <meta property="og:image" content={ogImage} />

$ curl -s -o /dev/null -w "%{http_code}\n" https://www.project-design.pl/og-default.jpg
404
$ ls public/ | grep -c og-default
0
```
Na live: `<meta property="og:image" content="/og-default.jpg">` oraz `<meta property="twitter:image" content="/og-default.jpg">`.

**Wpływ:** Dwa niezależne błędy naraz — plik nie istnieje, a nawet gdyby istniał, protokół Open Graph wymaga URL-a bezwzględnego. Każde udostępnienie linku na Facebooku, LinkedIn czy w komunikatorach renderuje się bez grafiki. Dla firmy projektującej wnętrza — branży w 100 % wizualnej — to bezpośrednia strata na CTR w kanałach społecznościowych.

**Fix:**
1. Dodaj `public/og-default.jpg` — 1200×630 px, kadr z realizacji (kandydat: `PROJEKT_JASKOLCZA_TORUN_3`), z logo i napisem „Project Design · Toruń".
2. W `src/components/SEO.astro` zamień linie 40 i 49 na wersję bezwzględną:
   ```astro
   const absoluteOgImage = new URL(ogImage, Astro.site ?? 'https://www.project-design.pl').href;
   ```
   (dodaj w bloku frontmatter po linii 17), a w znacznikach użyj `content={absoluteOgImage}`.
3. Dorzuć `<meta property="og:image:width" content="1200" />` i `<meta property="og:image:height" content="630" />`.

---

### [LIVE] Zepsuty link wewnętrzny `/portfolio` na stronie głównej

**Gdzie:** `src/components/Portfolio.astro:77`

**Dowód:** `sitecrawl` (crawl całej witryny, 9 URL-i, głębokość 1):
```
──── Zepsute linki wewnętrzne (4xx/5xx) ────
  [404] https://project-design.pl/portfolio  (linkowany z 1 stron)
        ← https://project-design.pl/

src/components/Portfolio.astro:77:  <a href="/portfolio" class="inline-flex items-center bg-slate-900 ...">
```
W `src/pages/` nie ma pliku `portfolio.astro` — strona nigdy nie powstała.

**Wpływ:** To główny przycisk CTA pod galerią realizacji na stronie głównej — czyli pod sekcją, która ma przekierować zainteresowanego użytkownika dalej. Prowadzi do 404 bez własnego szablonu (patrz P2 — brak strony 404), więc użytkownik widzi surowy błąd S3.

**Fix:** `src/components/Portfolio.astro:77` → zmień `href="/portfolio"` na `href="/realizacje/"`. Strona `/realizacje/` istnieje, ma 20 obrazów i 1 654 słowa — to jest docelowe portfolio.

---

### [LIVE] `sameAs` w JSON-LD wskazuje na cudze profile społecznościowe; prawdziwe profile firmy nie są zadeklarowane

**Gdzie:** `src/components/SEO.astro:89-93`

**Dowód:**
```
src/components/SEO.astro:89:  "sameAs": [
:90    "https://www.facebook.com/projectdesign",
:91    "https://www.instagram.com/projectdesign",
:92    "https://www.linkedin.com/company/projectdesign"
:93  ]
```
Wszystkie trzy odpowiadają (FB 200, IG 200, LI 999 = blokada bota) — to istniejące konta, ale **nie należą do firmy z Torunia**; nazwa `projectdesign` jest generyczna i zajęta przez inny podmiot. Tymczasem prawdziwe profile są w witrynie, tyle że poza JSON-LD:
```
$ grep -rEoh 'https?://(www\.)?(facebook|instagram)\.com[^"'"'"' ]*' src/ | sort -u
https://www.facebook.com/PRFInterior       ← 200
https://www.facebook.com/projectdesign     ← cudze
https://www.instagram.com/prf.interior/    ← 200
https://www.instagram.com/projectdesign    ← cudze
```

**Wpływ:** `sameAs` służy Google do sklejenia encji firmy w Knowledge Graph. Wskazanie cudzych profili to nie tylko zmarnowany sygnał, ale aktywne zamieszanie tożsamościowe — algorytm dostaje sprzeczne dane o tym, czym jest „Project Design". Przy DA 4 i profilu linków opartym na spamie (patrz część off-site) sygnały encji są jednym z niewielu dostępnych sposobów zbudowania rozpoznawalności marki.

**Fix:** `src/components/SEO.astro:89-93` zamień na realne profile firmy:
```json
  "sameAs": [
    "https://www.facebook.com/PRFInterior",
    "https://www.instagram.com/prf.interior/"
  ]
```
LinkedIn usuń, dopóki firma nie ma zweryfikowanej strony — pusty `sameAs` jest lepszy niż błędny. Gdy powstanie profil GBP, dodaj do `sameAs` również jego URL (`https://maps.app.goo.gl/...`).

---

### [WORKFLOW] Śledzenie konwersji nie działa — `dataLayer` wypycha zdarzenia, GA4 nie rejestruje żadnego

**Gdzie:** `src/components/Contact.astro:452` (`form_submission`), `src/components/Contact.astro:523-537` (`phone_click`, push w `:530`), GTM `GTM-MK2JNT26`, GA4 `properties/506914236`

**Dowód:** zdarzenia wypychane w kodzie:
```
$ grep -rhoE "event: *['\"][a-z_]+['\"]" src/ | sort | uniq -c
      1 event: 'form_submission'
      1 event: "consent_default"
      1 event: "consent_update"
      1 event: "page_view_after_consent"
```
plus `phone_click` (`Contact.astro:530`, wypychane przez listener na `a[href^="tel:"]` zarejestrowany w `:523`).

Zdarzenia faktycznie zarejestrowane w GA4 (90 dni):
```
page_view                        310
user_engagement                  176
session_start                    170
first_visit                      146
scroll                            44
click                              4
form_start                         2
```
Brak `form_submission`, brak `phone_click`, brak `page_view_after_consent`. Metryka `keyEvents` za 90 dni = **0**, we wszystkich kanałach (Direct 107 sesji / 0, Organic Search 60 / 0, AI Assistant 3 / 0).

**Wpływ:** Witryna ma dwa jedyne kanały pozyskania leada — formularz i telefon — i żaden z nich nie jest mierzalny. `form_start` = 2 pokazuje, że ludzie *zaczynają* wypełniać formularz, ale nie wiadomo, ilu kończy. Bez tego nie da się ocenić, czy jakakolwiek poprawka SEO przekłada się na leady.

**Fix (dwa kroki, oba w GTM/GA4, nie w kodzie):**
1. W GTM (`GTM-MK2JNT26`): utwórz dwa triggery typu *Custom Event* na nazwy `form_submission` i `phone_click`, podłącz do nich tagi *GA4 Event* wysyłające do `properties/506914236` pod tymi samymi nazwami. Opublikuj kontener.
2. W GA4 → Administracja → Zdarzenia: oznacz `form_submission` i `phone_click` jako **kluczowe zdarzenia**.

Uwaga o Consent Mode: `BaseLayout.astro:34-46` ustawia `analytics_storage: "denied"` domyślnie i GTM ładuje się natychmiast (`BaseLayout.astro:70-84`), a nie dopiero po kliknięciu w banner — to jest zrobione poprawnie (znany błąd z `sklad-tekstu.pl` i `ecopywriting.pl` tu **nie** występuje), więc zdarzenia po zgodzie dojdą. Problem leży wyłącznie w braku tagów po stronie GTM.

---

### [LIVE] JSON-LD nie zawiera adresu ulicy, choć witryna go podaje

**Gdzie:** `src/components/SEO.astro:69-75` vs `src/components/Contact.astro:8-11` (blok `address`)

**Dowód:**
```
src/components/Contact.astro:9:   street: "ul. Polna 134, hala nr 3",
src/components/Contact.astro:10:  city: "87-100 Toruń"

src/components/SEO.astro:69:  "address": {
:70    "@type": "PostalAddress",
:71    "addressLocality": "Toruń",          ← brak streetAddress
:72    "addressRegion": "kujawsko-pomorskie",
:73    "postalCode": "87-100",
:74    "addressCountry": "PL"
:75  },
```
Ponadto `SEO.astro:76-80` deklaruje `geo` 53.0138 / 18.5984 — to okolice centrum Torunia, nie ul. Polna 134.

**Wpływ:** Dla firmy lokalnej `streetAddress` jest podstawowym elementem NAP. Jego brak (przy jednoczesnej obecności adresu w widocznej treści) osłabia dopasowanie do zapytań z intencją lokalną — a te stanowią praktycznie cały profil zapytań tej domeny: „architekt wnętrz toruń" (598 wyśw.), „projektant wnętrz toruń" (530), „aranżacja wnętrz toruń" (425).

**Fix:** W `src/components/SEO.astro:71` dodaj przed `addressLocality`:
```json
    "streetAddress": "ul. Polna 134, hala nr 3",
```
i skoryguj `geo` (linie 78-79) na współrzędne ul. Polna 134 — odczytaj je z pinezki w Google Maps dla tego adresu i wstaw z dokładnością do 5 miejsc po przecinku. **Wartości muszą być identyczne z tymi w Google Business Profile.**

---

### [LIVE] Przekierowanie normalizujące ukośnik zwraca 302 zamiast 301

**Gdzie:** CloudFront / S3 website endpoint, wszystkie 6 URL-i bez końcowego ukośnika

**Dowód:**
```
$ curl -sIL https://www.project-design.pl/architekci-wnetrz
HTTP/1.1 302 Moved Temporarily
Location: /architekci-wnetrz/
HTTP/1.1 200 OK
```
(identycznie dla `/aranzacje-wnetrz`, `/projektowanie-mebli`, `/realizacje`, `/studio-projektowania-wnetrz`)

Dla kontrastu przekierowania hosta i protokołu są prawidłowe — `http→https` i `apex→www` zwracają 301.

**Wpływ:** 302 sygnalizuje tymczasowość, więc Google zachowuje w indeksie adres źródłowy i nie konsoliduje na nim sygnałów. To pogłębia problem z P0-2: w indeksie siedzą właśnie te adresy bez ukośnika, do których prowadzi 302.

**Fix:** Odpowiada za to funkcja/redirect na dystrybucji CloudFront `E2UJNOA00CF4G8` (lub konfiguracja S3 website endpoint). Zmień status na `301` w CloudFront Function przypisanej do *viewer request*, albo — jeśli przekierowanie robi S3 website redirect — w regule routingu bucketa `www.project-design.pl`. Zweryfikuj po zmianie tym samym `curl -sIL`.

Uwaga: po naprawie P0-2 ten redirect przestanie być ścieżką krytyczną (canonical przestanie na niego wskazywać), ale nadal warto poprawić — Google ma te adresy w indeksie i będzie do nich wracał.

---

### [WORKFLOW] Search Console nieskonfigurowane w seo_panel, choć konto serwisowe ma pełny dostęp

**Gdzie:** prod `seo_panel`, tabele `Domain` i `DomainIntegration`

**Dowód:**
```sql
SELECT domain, "gscProperty", "lastGscPull", "totalClicks" FROM "Domain" WHERE domain ILIKE '%project-design%';
```
```
domain                |gscProperty|lastGscPull|totalClicks
www.project-design.pl |           |           |0
```
Jednocześnie konto serwisowe `google-index-api@ageless-period-491209-s8` widzi property z uprawnieniem właściciela:
```
siteUrl                     permissionLevel
sc-domain:project-design.pl siteOwner
```
i zwraca dane (47 kliknięć / 8 914 wyświetleń w 90 dni). Integracja GA4 działa poprawnie (`GOOGLE_ANALYTICS`, ACTIVE, `properties/506914236`, lastSync 2026-07-25 08:01) — brakuje wyłącznie GSC.

**Wpływ:** Cron `gsc_pull` (06:00) omija tę domenę, więc `GscDomainDaily`/`GscPageDaily` są puste, `totalClicks` pokazuje 0, a alerty o spadkach pozycji i deindeksacji nigdy się dla niej nie odpalą. Tabela `SeoEvent` dla tej domeny jest pusta — nie dlatego, że nic się nie działo, tylko dlatego, że nic nie jest monitorowane.

**Fix:** Ustaw property w panelu:
```sql
UPDATE "Domain" SET "gscProperty" = 'sc-domain:project-design.pl'
WHERE domain = 'www.project-design.pl';
```
Wartość zweryfikowana bezpośrednio przez `GET https://www.googleapis.com/webmasters/v3/sites` — to dokładny `siteUrl` zwrócony przez API, nie zgadywany. Po najbliższym przebiegu `gsc_pull` sprawdź, czy `lastGscPull` się zapełnił.

---

## P2 — Średnie

### [LIVE] Brak własnej strony 404 — użytkownik dostaje surowy błąd S3

**Dowód:**
```
$ curl -s -w "status=%{http_code}\n" https://www.project-design.pl/robots.txt
status=404
<html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1>
<ul><li>Code: NoSuchKey</li><li>Message: The specified key does not exist.</li>
<li>Key: 404.html</li><li>RequestId: ME5XT9K7TSCTNTRS</li>
<li>HostId: EYYSZcDHO5PTKFrvYXkpoZD66hRRGYdZLSZXVVK3Q8Ez+...</li></ul>
<h3>An Error Occurred While Attempting to Retrieve a Custom Error Document</h3>
```
Bucket jest skonfigurowany, żeby serwować `404.html`, ale plik nie istnieje (`curl .../404.html` → 404). Status HTTP jest prawidłowy (404, nie soft-404) — problem dotyczy wyłącznie warstwy prezentacji, za to ujawnia użytkownikowi RequestId i HostId bucketa.

**Fix:** Utwórz `src/pages/404.astro` używający `BaseLayout` — nagłówek „Nie znaleziono strony", linki do 5 stron usługowych i do `/realizacje/`. Astro wygeneruje `dist/404.html`, a workflow zsynchronizuje go razem z resztą HTML.

### [LIVE] Trzy pliki graficzne deklarowane w `<head>` i w JSON-LD zwracają 404

**Dowód:**
```
404  /logo.png            ← src/components/SEO.astro:88  "image": "/logo.png"
404  /favicon.png         ← src/components/SEO.astro:56
404  /apple-touch-icon.png ← src/components/SEO.astro:57
```
`BaseLayout.astro:225-230` deklaruje osobny, **działający** komplet favikon (`/favicon.ico`, `/favicon.svg`, `/favicon-32x32.png`, `/favicon-180x180.png`, `/favicon-192x192.png`, `/site.webmanifest` — wszystkie 200). Linie 56-57 w `SEO.astro` to pozostałość po starszej wersji i dublują tamte deklaracje błędnymi ścieżkami.

**Fix:**
1. Usuń `src/components/SEO.astro:54-57` w całości (komentarz `<!-- Favicon -->` + 3 linie `<link>`) — `BaseLayout` już to obsługuje poprawnie.
2. `src/components/SEO.astro:88` → `"image": "https://www.project-design.pl/og-default.jpg",` (ten sam plik co z P1-og:image; `image` w schema.org wymaga URL-a bezwzględnego).

### [CONTENT] Brak schematów `FAQPage`, `BreadcrumbList` i `Person` mimo istniejących sekcji

**Dowód:** w całym `src/` jedynym typem danych strukturalnych jest `InteriorDesignBusiness`:
```
$ grep -rn 'FAQPage\|BreadcrumbList\|"Service"\|AggregateRating\|"Review"' src/
(brak wyników)
$ grep -o 'application/ld+json' home.html | wc -l
1
```
Tymczasem sekcje FAQ istnieją i są realne: `/aranzacje-wnetrz/` ma H2 „Często zadawane pytania", `/realizacje/` również. Zespół to realne osoby: `Team.astro:6` Dorota Stefańska (Projektantka wnętrz), `:18` Cezary Mazurkiewicz (Projektant wnętrz), oboje ze zdjęciami.

**Fix:**
1. `FAQPage` na `/aranzacje-wnetrz/` i `/realizacje/` — pytania i odpowiedzi przepisz 1:1 z widocznej treści (Google wymaga zgodności; rozbieżność = ryzyko kary ręcznej).
2. `Person` dla obu projektantów, powiązany z `InteriorDesignBusiness` przez `employee` — buduje E-E-A-T, którego tej domenie brakuje najbardziej (DA 4).
3. `BreadcrumbList` na 5 stronach usługowych (`Strona główna › <nazwa usługi>`) — daje ścieżkę okruszków w SERP zamiast gołego URL-a.

### [CONTENT] H1 na stronach o najwyższym potencjale nie zawiera modyfikatora lokalnego

**Dowód:** H1 vs zapytania w zasięgu (GSC 90 dni, pozycja 4-20, ≥5 wyświetleń):

| Strona | Aktualny H1 | Zapytanie w zasięgu | Wyśw. | Poz. | Klik. |
|---|---|---|---|---|---|
| `/projektowanie-mebli/` | „Projektowanie mebli na wymiar" | projektowanie mebli biurowych toruń | 152 | 9,4 | 0 |
| | | projektowanie szaf toruń | 103 | 19,0 | 0 |
| `/studio-projektowania-wnetrz/` | „Studio projektowania wnętrz" | studio projektowania wnętrz toruń | 117 | 19,4 | 0 |
| | | pracownia projektowa toruń | 52 | 18,1 | 0 |
| `/realizacje/` | „Nasze realizacje" | projekty wnętrz sklepów toruń | 92 | 11,7 | 0 |
| `/` | „Projektowanie wnętrz z pasją" | toruń projektowanie wnętrz | 197 | 40,3 | 1 |

Wzorzec jest jednoznaczny: `/aranzacje-wnetrz/` i `/architekci-wnetrz/` mają „Toruń" w H1 („Aranżacje wnętrz Toruń", „Architekci wnętrz Toruń") — i to one łapią najwięcej wyświetleń. Trzy strony bez modyfikatora stoją na pozycjach 9-20 przy 0 kliknięć.

**Fix — konkretne podmiany:**

| Plik | Było | Ma być |
|---|---|---|
| `src/pages/projektowanie-mebli.astro` (H1) | `Projektowanie mebli na wymiar` | `Projektowanie mebli na wymiar — Toruń` |
| `src/pages/studio-projektowania-wnetrz.astro` (H1) | `Studio projektowania wnętrz` | `Studio projektowania wnętrz Toruń` |
| `src/pages/realizacje.astro` (H1) | `Nasze realizacje` | `Realizacje projektów wnętrz — Toruń i okolice` |
| `src/pages/index.astro` (H1) | `Projektowanie wnętrz z pasją` | `Projektowanie wnętrz Toruń` (podtytuł „z pasją" przenieś do `<p>` pod H1) |

Zero kliknięć przy 152 wyświetleniach na pozycji 9,4 („projektowanie mebli biurowych toruń") sugeruje dodatkowo, że snippet nie przekonuje — po zmianie H1 warto przepisać też `description` tej strony pod intencję biurową.

### [LIVE] Wychodzący link do domeny, która nie istnieje (NXDOMAIN)

**Dowód:**
```
src/components/Team.astro:24:  behance: 'https://cmazurkiewiczstudio.pl/works'

$ nslookup cmazurkiewiczstudio.pl
*** can't find cmazurkiewiczstudio.pl: Non-existent domain
$ curl -sI --max-time 30 https://cmazurkiewiczstudio.pl/   → code=000 (exit 6, nie rozwiązano hosta)
$ curl -sI --max-time 30 https://www.cmazurkiewiczstudio.pl/ → code=000
```
Link renderuje się w sekcji zespołu, obecnej na `/`, `/aranzacje-wnetrz/`, `/architekci-wnetrz/` i `/studio-projektowania-wnetrz/`. Drugi link partnerski, `https://prfinterior.pl/`, odpowiada 200 — ten jest w porządku.

**Fix:** `src/components/Team.astro:24` — usuń pole `behance` dla Cezarego Mazurkiewicza albo podmień na działający adres jego portfolio. Jeśli domena ma wrócić, na razie usuń link (martwy link wychodzący to zmarnowany sygnał i zły UX).

### [LIVE] Placeholder `+48 123 456 789` w regulaminie

**Dowód:**
```
src/pages/regulamin.astro:56:  Tel: +48 123 456 789
```
Ten sam plik podaje w innym miejscu prawidłowy `+48 576 060 832` — czyli w regulaminie są dwa różne numery.

**Wpływ:** Regulamin jest dokumentem, w którym dane kontaktowe usługodawcy mają znaczenie prawne (ustawa o świadczeniu usług drogą elektroniczną). Dodatkowo jest to trzeci wariant numeru w serwisie (obok `XXX XXX XXX` z JSON-LD) — rozspójnia NAP.

**Fix:** `src/pages/regulamin.astro:56` → `Tel: +48 576 060 832`

### [LIVE] Sitemapa bez `<lastmod>`; zawiera strony prawne

**Dowód:**
```xml
<url><loc>https://www.project-design.pl/</loc></url>
<url><loc>https://www.project-design.pl/aranzacje-wnetrz/</loc></url>
...
<url><loc>https://www.project-design.pl/polityka-prywatnosci/</loc></url>
<url><loc>https://www.project-design.pl/regulamin/</loc></url>
```
Żaden z 8 wpisów nie ma `<lastmod>`, `<changefreq>` ani `<priority>`.

**Wpływ:** Bez `lastmod` Google nie wie, kiedy warto wrócić po zmianach. Widać to na `/regulamin/`: ostatni crawl **2026-05-25**, status „zeskanowana, ale jeszcze nie zindeksowana" — dwa miesiące bez wizyty. Strony prawne konsumują przy tym budżet crawlowania kosztem stron usługowych.

**Fix:** W `astro.config.mjs:8` rozszerz wywołanie `sitemap()` w tablicy `integrations`:
```js
sitemap({
  filter: (page) =>
    !page.includes('/polityka-prywatnosci') && !page.includes('/regulamin'),
  serialize: (item) => ({ ...item, lastmod: new Date().toISOString() }),
}),
```
Strony prawne pozostaną indeksowalne (linki w stopce prowadzą do nich z każdej podstrony) — po prostu przestaną konkurować o budżet crawlowania.

### [LIVE] Brak nagłówka HSTS

**Dowód:**
```
$ curl -sI https://www.project-design.pl/ | grep -i strict-transport
(brak)
```
Przekierowanie `http→https` działa (301), więc jedyne ryzyko dotyczy pierwszego żądania przed przekierowaniem.

**Fix:** W CloudFront (dystrybucje `E2UJNOA00CF4G8` i `E1ZE3XVOTW45EO`) przypnij *Response headers policy* z `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Zacznij bez `preload`.

### [LIVE] Brak kompresji Brotli — serwowany wyłącznie gzip

**Dowód:**
```
$ curl -sI -H "Accept-Encoding: br" https://www.project-design.pl/ | grep -i content-encoding
(brak nagłówka)
$ curl -sI -H "Accept-Encoding: gzip, br" https://www.project-design.pl/ | grep -i content-encoding
Content-Encoding: gzip
```
Mimo zadeklarowanego wsparcia dla `br` CloudFront zwraca gzip. HTML strony głównej ma 114 120 B nieskompresowane; Brotli daje na takiej treści zwykle 15-20 % przewagi nad gzip.

**Fix:** W ustawieniach obu dystrybucji CloudFront włącz *Compress objects automatically* (obsługuje Brotli dla klientów wysyłających `Accept-Encoding: br`). Sprawdź też, czy *Cache policy* uwzględnia `Accept-Encoding` w kluczu cache.

### [LIVE] Zaburzona hierarchia nagłówków na `/realizacje/`

**Dowód:** sekwencja nagłówków na żywej stronie:
```
h1 h3 h3 h3 h3 h3 h3 h3 h3 h3 h3 h3 h3 h3 h3 h3 h3 h3 h3 h3 h2 h2 h3 h3 h3 h3 h2 h2 h3 h3 h3 h3 h2 h3 h4 h4 h4 h4
```
Po H1 następuje 19 kolejnych H3 (tytuły projektów w galerii), zanim pojawi się pierwszy H2. PSI potwierdza: `heading-order` score 0 na tej stronie.

**Fix:** W `src/pages/realizacje.astro` dodaj H2 otwierający galerię — np. `<h2>Portfolio realizacji — mieszkania, domy i lokale użytkowe</h2>` — przed pętlą renderującą kafelki, i pozostaw tytuły projektów jako H3. Rozwiązuje to zarówno błąd semantyczny, jak i brak nasyconego słowami kluczowymi nagłówka na stronie z 229 wyświetleniami.

### [CONTENT] Zero kontekstowych linków wewnętrznych — cały link graph to nawigacja i stopka

**Dowód:** rozkład linków wewnętrznych na każdej z 6 stron treściowych jest identyczny (3 × każdy cel = nawigacja desktop + nawigacja mobilna + stopka):
```
--- /architekci-wnetrz
      3 href="/studio-projektowania-wnetrz"
      3 href="/realizacje"
      3 href="/projektowanie-mebli"
      3 href="/architekci-wnetrz"
      3 href="/aranzacje-wnetrz"
```
Jedyny wyjątek: `/aranzacje-wnetrz` ma 4 linki do `/realizacje` (jeden kontekstowy w treści). `sitecrawl` potwierdza maks. głębokość kliknięć = 1 i 0 sierot.

**Wpływ:** Przy 6 stronach płaska struktura nie jest katastrofą, ale kontekstowe linki z dopasowanym anchorem są jednym z niewielu sygnałów rankingowych, które ta domena może sobie sama nadać — profil linków zewnętrznych praktycznie nie istnieje (część off-site).

**Fix:** Dodaj po 2-3 linki w treści na każdej stronie usługowej, z anchorem opisowym, nie „kliknij tutaj":
- `/aranzacje-wnetrz/` → `/projektowanie-mebli/` anchorem „meble na wymiar do zaaranżowanego wnętrza"
- `/architekci-wnetrz/` → `/studio-projektowania-wnetrz/` anchorem „nasze studio projektowania wnętrz w Toruniu"
- `/projektowanie-mebli/` → `/realizacje/` anchorem „zobacz meble na wymiar w naszych realizacjach"
- `/studio-projektowania-wnetrz/` → `/aranzacje-wnetrz/` anchorem „kompleksowe aranżacje wnętrz"
- `/realizacje/` → `/architekci-wnetrz/` anchorem „architekci wnętrz odpowiedzialni za te projekty"

---

## P3 — Kosmetyka

- **Dwa opisy meta przekraczają 160 znaków** i zostaną ucięte w SERP: `/` — 169 zn., `/aranzacje-wnetrz/` — 180 zn. Pozostałe (141-159) są w normie. Skróć obie do ≤158 znaków, zachowując „Toruń" w pierwszych 100.
- **Dwa `<img>` bez atrybutu `alt`** na `/studio-projektowania-wnetrz/` (`Dorota-projektPROJEKT_SALON_Z_ANEKSEM_SZABAT_5_opt.webp`, `Dorota-projektMIESZKANIE_CIECHOCINEK_1_opt.webp`) oraz po jednym `alt=""` na `/` i `/realizacje/`. Pozostałe 63 obrazy mają opisowe alty — to lokalna niedoróbka, nie systemowa.
- **Martwy plik `src/layouts/Layout.astro`** — szablon startowy Astro z `<html lang="en">` i `<title>Astro Basics</title>`, nieużywany przez żadną stronę (`src/pages/` importują wyłącznie `BaseLayout`). Usuń, zanim ktoś go przypadkiem podepnie.
- **`<meta name="keywords">`** (`SEO.astro:30`) — ignorowany przez Google od 2009 r., czytelny dla konkurencji. Bez wpływu na ranking; usunięcie to porządki.
- **`<meta name="language" content="Polish">`** (`SEO.astro:33`) — nieistniejący standard; `<html lang="pl">` w `BaseLayout.astro:26` już to obsługuje poprawnie.

---

# CZĘŚĆ II — OFF-SITE

## Stan profilu linków

**Źródła danych:** Moz przez `Domain.moz*` (sync 2026-06-21) + `BacklinkSnapshot` na prod `seo_panel` (36 rekordów) + weryfikacja HTTP na żywo.

```sql
SELECT domain, "mozDA", "mozPA", "mozDomains", "mozLinks", "mozSpamScore", "mozLastSync"
  FROM "Domain" WHERE domain ILIKE '%project-design%';
```
```
domain                |mozDA|mozPA|mozDomains|mozLinks|mozSpamScore|mozLastSync
www.project-design.pl |4    |15   |9         |18      |1           |2026-06-21 04:00:57
```

Podział rekordów w `BacklinkSnapshot`:
```sql
SELECT source, "isLive", count(*), count(DISTINCT "sourceDomain") AS domains
  FROM "BacklinkSnapshot" WHERE "targetUrl" ILIKE '%project-design%' GROUP BY 1,2;
```
```
source|isLive|count|domains
CRAWL |t     |4    |2
MOZ   |f     |32   |11
```

### [OFF-SITE / P1] Realny profil linków to 2 domeny — obie własne

Jedyne linki potwierdzone jako żywe przez crawler panelu (`isLive = true`, `lastSeen` 2026-07-25 09:00):

| Domena źródłowa | URL źródłowy | Anchor | dofollow |
|---|---|---|---|
| `www.karol-leszczynski.pl` | `/` | `Project-Design.pl` | tak |
| `www.karol-leszczynski.pl` | `/projekty/` | `Odwiedź →` | tak |
| `www.torweb.pl` | `/` | `project-design.pl` | tak |
| `www.torweb.pl` | `/realizacje/` | `project-design.pl` | tak |

Obie domeny należą do Ciebie. Poza własną siecią witryna **nie ma ani jednego potwierdzonego linku**.

**Wpływ:** To jest bezpośrednie wyjaśnienie średniej pozycji 28-33 na zapytania komercyjne. Przy DA 4 witryna konkuruje w Toruniu z podmiotami mającymi realny profil linków — i przegrywa nie treścią (1 187-2 075 słów na stronę to przyzwoicie), tylko autorytetem. Zapytania z najwyższym wolumenem stoją poza zasięgiem: „architekt wnętrz toruń" 598 wyśw./poz. 32,8, „projektant wnętrz toruń" 530/33,1, „aranżacja wnętrz toruń" 425/28,8.

**Fix — lokalne cytowania NAP, w tej kolejności (każde wymaga identycznego zestawu: „Project Design", ul. Polna 134 hala nr 3, 87-100 Toruń, +48 576 060 832, kontakt@project-design.pl):**
1. **Google Business Profile** — priorytet bezwzględny, patrz osobna pozycja niżej.
2. Katalogi ogólnopolskie z realnym ruchem: `panorama firm`, `pkt.pl`, `aleo.com`, `firmy.net`, `zumi.pl`.
3. Branżowe: `homebook.pl`, `architektwnetrz.pl`, `oferteo.pl`, `fixly.pl` — te ostatnie dwa dodatkowo generują zapytania ofertowe.
4. Lokalne toruńskie: `torun.pl` (katalog firm), `nowosci.com.pl`, lokalne grupy FB.
5. Wykorzystaj powiązania biznesowe, które już istnieją i są w stopce: `meblesystem.pl` („Realizacja projektów: Meble Toruń — Meble System", `Footer.astro:35`). Sprawdź, czy meblesystem.pl odsyła zwrotnie — to naturalny, tematycznie zbieżny link.

### [OFF-SITE / P2] Historyczny profil linków to scraper spam — do monitorowania, nie do disavow

Wszystkie 32 rekordy ze źródła Moz mają `isLive = false`. Domeny odsyłające:

| Domena | DA | Anchor | Charakter |
|---|---|---|---|
| `urlmetryka.pl` | 17 | „idź do witryny" | agregator metryk (nofollow) |
| `mp3fresh.net` | 16 | `project-design.pl` | scraper |
| `youtoo.in` | 12 | `project-design.pl` | scraper |
| `moneygame.pro` | 12 | `project-design.pl` | scraper |
| `8coint.com` | 6 | `project-design.pl` | scraper (nofollow) |
| `alltopleveldomains.space` | 5 | `project-design.pl` | scraper |
| `linksnatcher.art` | 4 | `project-design.pl` | scraper |
| `cheapsmmprovider.online` | 4 | `project-design.pl` | scraper |
| `newsblogsports.site` | 3 | „best pinterest tool sitetosocial.com..." | spam |
| `karol-leszczynski.pl` | 7 | `project-design.pl` | własna |
| `torunnadloni.pl` | 1 | „strona www" (nofollow) | katalog lokalny |

Sześć z nich (`mp3fresh.net`, `youtoo.in`, `alltopleveldomains.space`, `linksnatcher.art`, `cheapsmmprovider.online`, oraz `youtoo.in` z drugiego wariantu) linkuje z **tej samej ścieżki** `page-a1b7367bf867aa8e7e304656b965faa7.html` — to jedna sieć scraperów zaciągająca listy nowych domen.

Rozkład anchorów (`Domain.mozAnchors`):
```json
[{"text": "project-design.pl", "externalPages": 12, "externalDomains": 6},
 {"text": "", "externalPages": 2, "externalDomains": 1},
 {"text": "best pinterest tool sitetosocial.com to grow your website traffic fully automated", "externalPages": 2, "externalDomains": 1}]
```
100 % anchorów to nagi URL — zero anchorów komercyjnych typu „projektowanie wnętrz Toruń".

**Ocena:** `mozSpamScore = 1` (w skali 0-17) jest bardzo niski, a linki nie są potwierdzone jako żywe. **Nie rekomenduję pliku disavow** — Google od lat sam ignoruje ten typ automatycznego spamu, a przedwczesny disavow na profilu liczącym 9 domen może zaszkodzić bardziej niż pomóc. Wystarczy monitoring: jeśli `mozSpamScore` przekroczy 5 albo pojawią się anchory komercyjne z toksycznych źródeł, wróć do tematu.

### [OFF-SITE / P2] Jedyne lokalne cytowanie przestało istnieć

**Dowód:**
```
$ curl -sIL https://torunnadloni.pl/firmy/projektanci-wnetrz
HTTP/1.1 404 Not Found
```
Wpis w `BacklinkSnapshot` (`sourceDomain = torunnadloni.pl`, anchor „strona www", nofollow, `lastSeen` 2026-06-07) — dziś adres zwraca 404. Jedyny lokalny, tematycznie zbieżny link zniknął.

**Fix:** Zgłoś firmę ponownie na `torunnadloni.pl` w kategorii projektantów wnętrz i dopilnuj, żeby dane były identyczne z GBP.

### [OFF-SITE / P1] Google Business Profile — istnieje, 120 opinii, ocena 4,9 — ale witryna tego nie wykorzystywała

**Zaktualizowane 2026-07-26.** Pierwotnie oznaczyłem ten punkt jako niemożliwy do zweryfikowania (konto serwisowe nie ma dostępu do Business Profile API). Zweryfikowałem go pośrednio, uruchamiając build lokalnie — `PUBLIC_REVIEWS_API_ENDPOINT` jest ustawione w `D:\project-design.pl\.env`, więc build pobrał realne dane:

```
$ npm run build && node -e "... parse JSON-LD z dist/index.html ..."
aggregateRating: {"@type":"AggregateRating","ratingValue":4.9,"reviewCount":120,"bestRating":5,"worstRating":1}
opinie wyrenderowane w sekcji: 6
```

Czyli: **wizytówka istnieje, ma 120 opinii i średnią 4,9.** To bardzo mocne aktywo dla firmy lokalnej — i do tej pory nie było wykorzystane ani w treści strony (produkcja pokazywała zmyślone opinie), ani w danych strukturalnych (brak `aggregateRating`).

**Co zostało z tym zrobione:** `src/lib/reviews.ts` stanowi teraz jedno źródło danych dla sekcji opinii i dla `aggregateRating` w JSON-LD, więc jedno nie może rozjechać się z drugim. Przy braku danych oba znikają — nigdy nie są podmieniane atrapą.

**Co pozostaje:** CI nie ma sekretu, więc produkcja nadal nie pokazuje opinii. Instrukcja w „Zadania otwarte" pkt 1. To najwyżej punktowana pozycja z całej listy — 120 opinii przy ocenie 4,9 to realna szansa na gwiazdki w SERP-ie.

**Do sprawdzenia ręcznie w samym GBP** (tam nadal nie mam dostępu):
1. Czy NAP w wizytówce zgadza się **co do znaku** z witryną — telefon `+48 576 060 832`, adres ul. Polna 134 hala nr 3, 87-100 Toruń. JSON-LD jest już poprawny i spójny z `Contact.astro`.
2. Czy kategoria główna to „Projektant wnętrz" / „Biuro projektowe".
3. Czy w profilu są zdjęcia realizacji — masz ich 61 na CDN, to gotowy materiał.
4. Współrzędne pinezki — obecne `geo` w JSON-LD wskazuje centrum Torunia, nie ul. Polną (patrz „Zadania otwarte" pkt 6).

Dla firmy usługowej działającej w jednym mieście GBP jest pojedynczo najważniejszym czynnikiem off-site — ważniejszym niż wszystkie linki razem wzięte. Przy DA 4 i braku profilu linków to jedyna realistyczna droga do widoczności w pakiecie lokalnym.

### [OFF-SITE / P2] Ruch z wyszukiwarki nie przekłada się na kliknięcia w zasięgu pozycji 4-20

Zapytania, gdzie witryna jest już blisko, ale nie zbiera kliknięć (GSC 90 dni, poz. 4-20, ≥5 wyświetleń):

| Zapytanie | Wyśw. | Klik. | Poz. |
|---|---|---|---|
| projektowanie mebli biurowych toruń | 152 | 0 | 9,4 |
| aranżacja salonu toruń | 150 | 0 | 20,0 |
| studio projektowania wnętrz toruń | 117 | 0 | 19,4 |
| projektowanie szaf toruń | 103 | 0 | 19,0 |
| projekty wnętrz sklepów toruń | 92 | 0 | 11,7 |
| pracownia projektowa toruń | 52 | 0 | 18,1 |
| projektant wnętrz | 20 | 0 | 8,7 |
| biuro architekta wnętrz toruń | 7 | 0 | 19,6 |

**Interpretacja z zastrzeżeniem:** pozycja 9,4 przy 152 wyświetleniach i zerze kliknięć jest nietypowa — na dziesiątej pozycji spodziewalibyśmy się 1-2 % CTR. Prawdopodobna przyczyna to zajęcie górnej części SERP przez pakiet lokalny Google Maps (a witryna, jak wyżej, może nie mieć GBP) — ale **tego nie zweryfikowałem** i nie mam danych, które by to przesądzały. Alternatywne wyjaśnienia to nieatrakcyjny snippet albo pozycja uśredniona z bardzo nierównego rozkładu.

**Fix:** Nie działaj w ciemno — najpierw ustal fakty. Wpisz w Google (tryb incognito, lokalizacja Toruń) trzy zapytania z góry tabeli i zobacz, co realnie zajmuje pierwszy ekran. Jeśli to pakiet lokalny — priorytetem jest GBP, nie treść. Jeśli witryna jest w wynikach organicznych, ale ze słabym snippetem — przepisz `title`/`description` tych trzech stron pod intencję (np. `/projektowanie-mebli/` obecnie w ogóle nie wspomina o meblach biurowych ani szafach w tytule, mimo że na te frazy rankuje najwyżej).

---

## Do zweryfikowania — wymaga ponownego uruchomienia lub ręcznego sprawdzenia

- ~~**Google Business Profile** — brak dostępu API na koncie serwisowym.~~ **Rozwiązane 2026-07-26** — zweryfikowane pośrednio przez lokalny build: wizytówka istnieje, 120 opinii, ocena 4,9. Szczegóły w części off-site.
- **Świeżość danych Moz** — snapshot z 2026-06-21. Jeśli chcesz aktualny obraz profilu linków przed podejmowaniem decyzji o link buildingu, wymuś odświeżenie Moz dla tej domeny.
- **Konfiguracja przekierowania 302 → 301** — ustaliłem zachowanie na żywo (`curl -sIL`), ale nie sprawdziłem, czy odpowiada za nie CloudFront Function, czy S3 website redirect. Przed zmianą zajrzyj w konfigurację dystrybucji `E2UJNOA00CF4G8`.
- **Współrzędne geo dla ul. Polna 134** — obecne (53.0138, 18.5984) wskazują centrum Torunia; nie odczytałem prawidłowych dla tego adresu.
- **Czy `meblesystem.pl` linkuje zwrotnie** — nie sprawdzałem; to najbliższy tematycznie potencjalny link, wart weryfikacji.

## Pominięte — nieadekwatne dla tego profilu

- **Schema `Product` / `Offer` / obsługa wariantów / faceted search** — nie jest to sklep.
- **Analiza sierot i głębokości kliknięć (L1)** — `sitecrawl` potwierdził 0 sierot i maks. głębokość 1 przy 8 stronach; nie ma grafu, który dałoby się analizować.
- **`hreflang`** — witryna jednojęzyczna (`<html lang="pl">`, `og:locale` `pl_PL`), brak wersji obcojęzycznych.
- **Analiza budżetu crawlowania (`botlog`)** — witryna serwowana z S3/CloudFront, brak logów nginx. Przy 8 stronach budżet crawlowania i tak nie jest ograniczeniem.
- **Paginacja, `rel=prev/next`** — brak stron paginowanych.
- **Segmentacja sitemapy** — 8 URL-i, jeden plik jest właściwy.

---

## Kolejność działań

**Krok 1 — poprawki w kodzie (jeden commit, jeden deploy):**
1. `src/pages/*.astro` × 5 — usuń prop `canonical` z `aranzacje-wnetrz`, `architekci-wnetrz`, `projektowanie-mebli`, `realizacje`, `studio-projektowania-wnetrz` *(P0-1, P0-2)*
2. Utwórz `public/robots.txt` z dyrektywą `Sitemap:` *(P0-3)*
3. `Footer.astro:90-91` + `SEO.astro:68` — `kontakt@project-design.pl` *(P0-4)*
4. `Testimonials.astro:31-73,75-80,124,141-142` — usuń `fallbackTestimonials` i liczby bez pokrycia; sekcja ma się nie renderować bez danych. Dodatkowo `Hero.astro:37` — usuń „4.9/5 ocena klientów" *(P0-5)*
5. `SEO.astro:67` — `"telephone": "+48576060832"` *(P0-6)*
6. `SEO.astro:71` — dodaj `"streetAddress": "ul. Polna 134, hala nr 3"` *(P1)*
7. `SEO.astro:89-93` — `sameAs` na `PRFInterior` / `prf.interior` *(P1)*
8. `Portfolio.astro:77` — `href="/realizacje/"` *(P1)*
9. `SEO.astro:55-57` — usuń zdublowany blok favikon; `:88` `"image"` na URL bezwzględny *(P2)*
10. `Team.astro:24` — usuń martwy link `cmazurkiewiczstudio.pl` *(P2)*
11. `regulamin.astro:56` — `+48 576 060 832` *(P2)*

**Krok 2 — grafika i wydajność (drugi deploy):**
12. Dodaj `public/og-default.jpg` 1200×630 + bezwzględny `og:image` w `SEO.astro` *(P1)*
13. `BaseLayout.astro` — preconnect + preload dla `media.meblesystem.pl`, nieblokujące ładowanie fontów *(P1)*
14. `width`/`height` na `<img>` w `Hero.astro`, `Portfolio.astro`, `Team.astro` *(P1)*
15. `astro.config.mjs` — `filter` + `lastmod` w konfiguracji sitemapy *(P2)*
16. Utwórz `src/pages/404.astro` *(P2)*

**Krok 3 — GSC (po wdrożeniu kroku 1):**
17. Prześlij ponownie `sitemap-index.xml`.
18. „Sprawdzenie URL → Poproś o zindeksowanie" dla 5 stron usługowych. **Limit ok. 10 URL-i/dobę na property** — 5 mieści się w jednym dniu, ale jeśli dorzucisz stronę główną i `/regulamin/`, zostaje zapas 3.
19. Po 7-10 dniach powtórz URL Inspection na tych 5 adresach i sprawdź, czy `coverageState` zmienił się z „Alternatywna strona…" na „Strona przesłana i zindeksowana".

**Krok 4 — pomiar (bez deploya):**
20. GTM `GTM-MK2JNT26` — triggery Custom Event na `form_submission` i `phone_click` + tagi GA4 do `properties/506914236`; publikacja kontenera *(P1)*
21. GA4 — oznacz oba jako kluczowe zdarzenia *(P1)*
22. `UPDATE "Domain" SET "gscProperty" = 'sc-domain:project-design.pl' WHERE domain = 'www.project-design.pl';` na prod `seo_panel` *(P1)*

**Krok 5 — infrastruktura AWS:**
23. CloudFront `E2UJNOA00CF4G8` / `E1ZE3XVOTW45EO` — response headers policy z HSTS *(P2)*
24. CloudFront — włącz automatyczną kompresję (Brotli) *(P2)*
25. Zmień 302 → 301 w normalizacji ukośnika *(P1)*

**Krok 6 — off-site (praca ciągła, kolejność malejącego zwrotu):**
26. **Google Business Profile** — zweryfikuj istnienie, dane NAP, kategorię, zdjęcia. Najwyższy priorytet w całym off-site.
27. Sprawdź realne SERP-y dla trzech zapytań z pozycji 9-12 i dopiero potem decyduj: GBP czy przepisanie snippetów.
28. Cytowania lokalne: pkt.pl, panorama firm, aleo, firmy.net, homebook, oferteo, fixly, torunnadloni.pl (ponownie).
29. Sprawdź link zwrotny z `meblesystem.pl`.
30. Monitoring `mozSpamScore` — disavow dopiero powyżej 5 albo przy komercyjnych anchorach ze spamu.

**Krok 7 — treść (P2/P3, gdy będzie czas):**
31. H1 z modyfikatorem „Toruń" na 4 stronach *(P2)*
32. `FAQPage`, `Person`, `BreadcrumbList` w JSON-LD *(P2)*
33. Kontekstowe linki wewnętrzne, 2-3 na stronę *(P2)*
34. H2 otwierający galerię na `/realizacje/` *(P2)*
35. Skróć dwa opisy meta; uzupełnij brakujące `alt`; usuń `Layout.astro`, `meta keywords`, `meta language` *(P3)*

---

## Zadania otwarte (stan po wdrożeniu 2026-07-26)

### 1. Sekret `PUBLIC_REVIEWS_API_ENDPOINT` — ODŁOŻONE decyzją Karola (2026-07-26)

Karol zdecydował, że witryna działa na razie bez sekcji opinii i bez `aggregateRating`. Poniższa
instrukcja zostaje na moment, gdy będzie chciał to włączyć — nic w kodzie nie wymaga wtedy zmiany,
wystarczy sekret i ponowny przebieg workflow.

Wizytówka Google **istnieje i ma 120 realnych opinii ze średnią 4,9** — potwierdzone lokalnym
buildem, który pobrał dane z API i wyrenderował sekcję opinii oraz `aggregateRating` w JSON-LD.
To istotna korekta wobec pierwotnej wersji raportu, gdzie GBP figurował jako niezweryfikowany.

Build w CI nadal nie ma tej zmiennej, więc na produkcji sekcja opinii **nie renderuje się wcale**
(zamiast poprzednich zmyślonych — to zamierzone zachowanie, nigdy atrapy). Aby wróciła z realnymi
danymi:

1. GitHub → repozytorium `LeszczynskiKarol/project-design.pl` → Settings → Secrets and variables
   → Actions → **New repository secret**
2. Nazwa: `PUBLIC_REVIEWS_API_ENDPOINT`, wartość: ta sama co w lokalnym `D:\project-design.pl\.env`
3. Actions → „Build & Deploy project-design.pl" → **Run workflow**

Workflow jest już przygotowany (`.github/workflows/deploy.yml`, krok `npm run build` ma blok `env`).
Po przebiegu wróci sekcja opinii **oraz** `aggregateRating` w danych strukturalnych — a przy 120
opiniach i ocenie 4,9 daje to realną szansę na gwiazdki w wynikach wyszukiwania.

### 2. ~~Rozmiary obrazów~~ — ZROBIONE 2026-07-26, warianty statyczne zamiast Lambda@Edge

**Rozważana i odrzucona opcja: Lambda@Edge z resizingiem.** Koszt sam w sobie jest pomijalny —
przy pełnym pudle (100 % chybień cache) to ok. **$0,27/miesiąc** (7 421 wywołań × $0,60/1 mln
za żądania + 7 421 × ~0,7 GB-s × $0,00005001 za czas). Odrzucona nie z powodu ceny, tylko
z powodu wolumenu: cała dystrybucja `E3688K2B9B6NGO` obsłużyła **7 421 żądań przez 30 dni**
(≈ 250/dobę, CloudWatch `AWS/CloudFront Requests`, us-east-1). Przy takim ruchu obiekty wypadają
z cache brzegowego między wizytami, więc znaczna część żądań trafiałaby do origin i odpalała
zimny start Lambdy z ~30 MB paczką Sharpa — **1-3 s dokładanych do czasu ładowania dokładnie
tego obrazu, którego czas ładowania próbujemy skrócić.** Doszłaby jeszcze zależność operacyjna
przez granicę kont AWS.

Uwaga terminologiczna do pierwotnej wersji raportu: **CloudFront Function nie potrafi skalować
obrazów** (limit 10 KB kodu, 1 ms, brak sieci i systemu plików). Skalowanie wymaga Lambda@Edge
albo Lambda Function URL. Pierwotny zapis „CloudFront Function / Lambda@Edge z resizingiem"
sugerował, że to alternatywa równoważna — nie jest.

**Co zostało zrobione zamiast tego:**

```
18 unikalnych obrazów uzywanych przez witryne -> 62 warianty
media.meblesystem.pl/.../SLIWY_POKOJ_DZIECIECY_14_opt.webp   412,9 KiB  (oryginal)
                                          ...-480w.webp       11,3 KiB
                                          ...-768w.webp       25,0 KiB
                                          ...-1200w.webp      71,2 KiB
                                          ...-1600w.webp     141,7 KiB
```

- Warianty wgrane do `s3://meblowe-media` (konto `619924817756`, profil `klient`) obok
  oryginałów, z identycznymi nagłówkami: `image/webp`, `public,max-age=31536000,immutable`,
  SSE AES256.
- **Żaden istniejący plik nie został zmodyfikowany ani usunięty.** `meblesystem.pl`
  i `meble-bydgoszcz.pl` korzystają z tego samego bucketa i są nietknięte.
- Rollback: usunięcie kluczy pasujących do `*-[0-9]*w.webp`.
- `src/lib/img.ts` — mapa wariantów + `srcset()` / `dims()` / `smallest()`.
- `sizes` dopasowane do realnego slotu: `100vw` dla heroów pełnej szerokości,
  `(max-width: 1024px) 100vw, 50vw` dla obrazów w kolumnie, `33vw` dla kafelków siatki.
- Preload obrazu LCP ma `imagesrcset`/`imagesizes` **identyczne** z `<img>` — bez tego preload
  oryginału i `srcset` wariantu pobrałyby zdjęcie dwa razy. Zweryfikowane w `dist` na 6 stronach.

**Regeneracja wariantów** (gdy dojdą nowe zdjęcia): wyciągnij listę URL-i z `dist/**/*.html`,
przepuść przez `sharp` na szerokości 480/768/1200/1600 z `withoutEnlargement`, wgraj przez
`aws s3 sync --profile klient` z powyższymi nagłówkami i zaktualizuj mapę w `src/lib/img.ts`.

**Pomiar był mylący na świeżo — uwaga na przyszłość.** Bezpośrednio po wgraniu wariantów PSI
pokazywał na `/aranzacje-wnetrz/` LCP 5,2 / 5,3 / 5,3 s, czyli pozornie regresję wobec 3,9 s
sprzed zmian. Zdiagnozowałem to najpierw błędnie jako realny problem. Przyczyną był **zimny cache
CloudFront na dopiero co wgranych obiektach** — każdy przebieg PSI szedł do origin. Po rozgrzaniu
ta sama strona daje stabilnie LCP 3,0 s i performance 94 (cztery kolejne przebiegi, wszystkie
co do milisekundy identyczne). Wniosek: nie oceniaj efektu zmian w obrazach wcześniej niż po
drugim przebiegu PSI na ten sam URL.

### 2b. Co pozostaje po stronie wydajności

**Doprecyzowanie interpretacji LCP.** Raportowany przez PSI LCP 11,9 s (obecnie 10,1 s) to wartość
**symulowana** przez Lighthouse przy dławieniu Slow 4G. Wartość obserwowana w tym samym przebiegu:

```
observedLargestContentfulPaint : 185 ms
observedFirstContentfulPaint   : 152 ms
observedSpeedIndex             : 311 ms
largestContentfulPaint (sym.)  : 10055 ms   ← ta liczba trafia do raportu PSI
interactive (sym.)             : 10055 ms
```

LCP symulowany równa się co do milisekundy TTI, `lcp-discovery-insight` jest `notApplicable`
(element LCP nie jest obrazem), a `lcp-breakdown-insight` przechodzi. Oznacza to, że model Lantern
wiąże LCP z końcem łańcucha zależności, a nie z konkretnym wolnym zasobem. Na realnym łączu strona
renderuje się w ~200 ms. Danych CrUX brak (za mało ruchu), więc nie ma weryfikacji polowej.

**Co pozostało po wdrożeniu wariantów.** Waga obrazów przestała być problemem — PSI zgłasza teraz
136 KiB do odzyskania na stronie głównej (było 1 564 KiB) i 13 KiB na `/realizacje/` (było 1 092 KiB).
Strony ważą 500-650 KiB łącznie. Dwie strony zostają wolniejsze od reszty:

| Strona | performance | LCP | dlaczego |
|---|---|---|---|
| `/` | 74 | 5,6 s | 18 obrazów, najcięższa strona serwisu (601 KiB) |
| `/projektowanie-mebli/` | 74 | 5,6 s | 7 obrazów produktowych + hero (654 KiB) |

Dalsza poprawa wymagałaby ograniczenia **liczby** obrazów ładowanych początkowo (np. galeria
na stronie głównej doczytywana dopiero po interakcji), a nie ich rozmiaru. To zmiana projektowa,
nie techniczna — do decyzji, czy warto, przy 172 sesjach na 90 dni.

Pozostaje też `TBT` rzędu 30-180 ms i `Script Evaluation` ~290 ms — to głównie GTM. Bez wartości
do porównania z CrUX (za mało ruchu na dane polowe) nie ma podstaw, żeby to ruszać.

### 3. ~~Konwersje~~ — ZROBIONE 2026-07-26, cały łańcuch spięty

**Zrobione (GA4).** `form_submission` i `phone_click` utworzone jako **kluczowe zdarzenia**
w `properties/506914236` przez Admin API (`countingMethod: ONCE_PER_SESSION`). Stan przed zmianą
— tylko trzy domyślne, z których żadne nigdy na tej witrynie nie odpali:
```
purchase
close_convert_lead
qualify_lead
```
Po zmianie:
```
purchase, close_convert_lead, qualify_lead, form_submission, phone_click
```

**Zrobione (GTM).** Karol nadał kontu serwisowemu uprawnienie *Opublikuj* na kontenerze. Okazało się
jednak, że pierwotne 403 **nie wynikało z braku dostępu w GTM** — po nadaniu uprawnień błąd nie
zniknął. Pełna treść odpowiedzi ujawniła prawdziwą przyczynę:
```json
"reason": "SERVICE_DISABLED",
"message": "Tag Manager API has not been used in project 432035195576 before or it is disabled"
```
Tag Manager API nie było włączone w projekcie GCP `ageless-period-491209-s8` (globalny CLAUDE.md
wymienia tylko `analyticsdata`, `searchconsole`, `indexing`). Włączone kontem Karola:
```
gcloud services enable tagmanager.googleapis.com --project=ageless-period-491209-s8 \
  --account=karolleszczynskikorektor@gmail.com
```
**Wniosek na przyszłość:** przy 403 z Google API najpierw czytaj pełne ciało odpowiedzi. Samo
`HTTP 403` nie odróżnia „brak uprawnień do zasobu" od „usługa wyłączona w projekcie", a to zupełnie
inne działania naprawcze. Straciłem na tym jedną iterację, wysyłając Karola do panelu GTM
niepotrzebnie.

**Co zostało utworzone** — konto `accounts/6315121481`, kontener `GTM-MK2JNT26`
(`containers/231129896`), workspace `Default Workspace`:

| Obiekt | Typ | Konfiguracja |
|---|---|---|
| `CE - form_submission` (id 14) | `customEvent` | `{{_event}}` equals `form_submission` |
| `CE - phone_click` (id 15) | `customEvent` | `{{_event}}` equals `phone_click` |
| `GA4 Event - form_submission` (id 16) | `gaawe` | `eventName=form_submission`, `measurementIdOverride=G-VEV40YS20G`, trigger 14 |
| `GA4 Event - phone_click` (id 17) | `gaawe` | `eventName=phone_click`, `measurementIdOverride=G-VEV40YS20G`, trigger 15 |

Measurement ID zweryfikowany przed użyciem — `G-VEV40YS20G` to strumień `Project-Design.pl`
w `properties/506914236` (GA4 Admin API `dataStreams`), czyli ta sama usługa, w której utworzyłem
kluczowe zdarzenia. Przed publikacją sprawdziłem stan przestrzeni roboczej — cztery zmiany, wszystkie
moje, nic niezatwierdzonego po stronie Karola.

Opublikowana **wersja 5** „Konwersje: form_submission + phone_click". Istniejący tag
`googtag` (`Tag Google - GA4 Project Design`) nietknięty. Weryfikacja end-to-end na serwowanym
kontenerze:
```
$ curl -s "https://www.googletagmanager.com/gtm.js?id=GTM-MK2JNT26" | grep -c form_submission
2
$ ... | grep -c phone_click
2
```

**Pełny łańcuch działa:** `dataLayer.push({event:'form_submission'})` (`Contact.astro:452`) →
aktywator 14 → tag GA4 Event → `G-VEV40YS20G` → `properties/506914236` → oznaczone jako kluczowe
zdarzenie. Tak samo `phone_click` (`Contact.astro:530`).

`consentSettings` zostawiłem na `notSet`, spójnie z istniejącym tagiem Google. Przy Consent Mode v2
z `analytics_storage: denied` domyślnie oznacza to, że przed zgodą GA4 dostaje pingi bez ciasteczek,
a po zgodzie pełne dane — czyli zachowanie zgodne z resztą konfiguracji.

**Do sprawdzenia przez Karola (2 minuty):** wejdź na stronę, kliknij numer telefonu, po czym
w GA4 → *Raporty* → **Czas rzeczywisty** albo *Administracja* → **DebugView** sprawdź, czy
`phone_click` się pojawił. To jedyny element, którego nie mogłem zweryfikować zdalnie — potwierdziłem
konfigurację i obecność zdarzeń w serwowanym kontenerze, ale nie faktyczne kliknięcie użytkownika.

### 4. Ponowna indeksacja w GSC

Sitemapa zgłoszona ponownie przez API (0 błędów). Pozostaje ręczne „Sprawdzenie URL → Poproś
o zindeksowanie" dla 5 stron usługowych — API Google nie udostępnia tej operacji dla zwykłych stron,
a limit to ok. **10 URL-i/dobę na property**:

```
https://www.project-design.pl/aranzacje-wnetrz/
https://www.project-design.pl/architekci-wnetrz/
https://www.project-design.pl/projektowanie-mebli/
https://www.project-design.pl/realizacje/
https://www.project-design.pl/studio-projektowania-wnetrz/
```
Za 7-10 dni warto powtórzyć URL Inspection i sprawdzić, czy `coverageState` zmienił się
z „Alternatywna strona zawierająca prawidłowy tag strony kanonicznej" na „Strona przesłana
i zindeksowana". Polecenie w załączniku poniżej.

### 5. ~~Infrastruktura CloudFront~~ — ZROBIONE 2026-07-26

Obie dystrybucje (`E2UJNOA00CF4G8` www, `E1ZE3XVOTW45EO` apex) w statusie `Deployed`, zweryfikowane
na żywo.

**Response headers policy** `project-design-security-headers` (`28249aba-8634-4e16-b92d-c5dd6bee1c1f`),
podpięta do obu dystrybucji:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
```
HSTS bez `preload` — świadomie. Wpis na listę preload jest praktycznie nieodwracalny, więc nie
robię tego bez wyraźnej decyzji.

**Brotli — przyczyna była inna, niż zakładałem w pierwotnym raporcie.** Napisałem, że trzeba
„włączyć automatyczną kompresję". Tymczasem `Compress` **był już ustawiony na `true`**. Brotli nie
działał, bo behavior siedział na **legacy `ForwardedValues`**, a CloudFront obsługuje Brotli
wyłącznie przez *cache policy*. Utworzona polityka `project-design-static-brotli`
(`3425d57a-5ad7-4e93-b9e4-9b110ae0b0dd`) odwzorowuje dotychczasowe ustawienia jeden do jednego
(brak query string, cookies i nagłówków w kluczu cache; `MinTTL 0`, `DefaultTTL 86400`,
`MaxTTL 31536000`) i dokłada `EnableAcceptEncodingGzip` + `EnableAcceptEncodingBrotli`. Efekt:
```
Accept-Encoding: identity  ->  105 319 B
Accept-Encoding: gzip      ->   20 130 B
Accept-Encoding: br        ->   18 542 B   (o 7,9 % lepiej niz gzip)
```
Uwaga metodyczna: `curl -sI` (HEAD) **nie pokazuje** `Content-Encoding` na tej konfiguracji —
kompresję trzeba sprawdzać żądaniem GET, inaczej wygląda na wyłączoną.

**302 → 301** — CloudFront Function `project-design-trailing-slash-301` na *viewer-request*
dystrybucji www. Kod w repo: `infra/cloudfront-trailing-slash.js`. S3 website endpoint normalizuje
ukośnik kodem 302 i nie da się tego w nim zmienić, więc funkcja wyprzedza origin. Przetestowana
przez `aws cloudfront test-function` na 7 przypadkach przed publikacją:

| wejście | wynik |
|---|---|
| `/architekci-wnetrz` | 301 → `/architekci-wnetrz/` |
| `/architekci-wnetrz/` | przepuszczone |
| `/` | przepuszczone |
| `/robots.txt` | przepuszczone |
| `/sitemap-0.xml` | przepuszczone |
| `/assets/hoisted.BrRq_ndr.js` | przepuszczone |
| `/realizacje?utm_source=fb&gclid=abc123` | 301 → `/realizacje/?utm_source=fb&gclid=abc123` |

**Świadomy efekt uboczny:** nieistniejące adresy bez rozszerzenia dostają teraz jeden dodatkowy
skok — `301 → 404` zamiast bezpośredniego `404` (łańcuch kończy się prawidłowo na stronie
`/404.html`, sprawdzone). Uniknięcie tego wymagałoby wpisania listy istniejących ścieżek do funkcji,
czyli obowiązku aktualizacji przy każdej nowej podstronie. Przy znikomej wadze 404-ek nie warto —
zostawiam wersję generyczną. Pliki z rozszerzeniem nadal dostają 404 bez przekierowania.

**Test dymny po zmianie** (cache policy + funkcja viewer to najbardziej ryzykowne zmiany tego dnia):
wszystkie 8 podstron, `robots.txt`, obie sitemapy, favikony, `site.webmanifest`, `consent-mode.js`
oraz zbudowane zasoby JS/CSS zwracają 200; apex nadal 301 na www; strona 404 działa.

**Nieruszona, ale warta odnotowania:** dystrybucja www ma `CustomErrorResponse` mapujący
**403 → `/index.html` z kodem 200** — klasyczny wzorzec generujący soft-404. Obecnie nie odpala,
bo origin to S3 *website endpoint*, który dla brakujących kluczy zwraca 404, nie 403 (reguła 404 →
`/404.html` z kodem 404 działa poprawnie). Zostawiłem bez zmian: reguła jest uśpiona, a zmiana
konfiguracji bez dowodu, że coś psuje, to niepotrzebne ryzyko. Gdyby kiedyś origin zmienił się na
zwykły bucket S3 (nie website endpoint), ta reguła zacznie serwować stronę główną z kodem 200
pod każdym nieistniejącym adresem — wtedy trzeba ją naprawić.

### 6. Off-site — cytowania lokalne NAP

**Osobny dokument roboczy:** `D:\seo-panel\audits\project-design.pl-nap-cytowania.md` — wzorzec NAP
do kopiowania, stan istniejących wzmianek w sieci, kolejność zgłoszeń i skrypt weryfikujący
spójność po zgłoszeniach.

**Ustalenie, które wypłynęło przy okazji i wymaga Twojej decyzji:** w obiegu są **trzy** adresy.
CEIDG dla NIP 9562111620 podaje `ul. Wincentego Witosa 4g/79, 87-100 Toruń` i telefon
`736 870 687` — potwierdzone dwoma źródłami ciągnącymi wprost z rejestru (ALEO, owg.pl). Witryna
miała Polną 134, a od dziś ma Batorego 92F. Format `4g/79` wskazuje na adres rejestrowy, nie
miejsce obsługi klienta, co jest normalne — ale dokumenty prawne na stronie deklarują teraz adres
niezgodny z rejestrem, a agregatory same publikują wersję z CEIDG. Szczegóły i warianty
rozwiązania w dokumencie NAP.

### 6b. Off-site — profil linków

Bez zmian: profil linków to 2 własne domeny, DA 4. Priorytet to cytowania lokalne NAP — teraz
z pewnością, że dane w JSON-LD są poprawne i spójne z wizytówką (telefon `+48576060832`,
`kontakt@project-design.pl`, ul. Polna 134 hala nr 3). Szczegóły w części II raportu.

**Adres firmy zmieniony 2026-07-26 — decyzja Karola.** Cały serwis przeniesiony z
`ul. Polna 134, hala nr 3` na **`ul. Stefana Batorego 92F`**, 7 wystąpień w 4 plikach:

| Plik | Wystąpień | Kontekst |
|---|---|---|
| `src/components/SEO.astro` | 1 | `streetAddress` w JSON-LD |
| `src/components/Contact.astro` | 1 | dane kontaktowe widoczne na stronie |
| `src/pages/polityka-prywatnosci.astro` | 3 | w tym siedziba przy NIP 956-211-16-20 |
| `src/pages/regulamin.astro` | 2 | w tym dane administratora serwisu |

`geo` przeliczone razem z adresem: **53.03906 / 18.62219** (Batorego 92, Mokre/Dębowa Góra) wg
geokodowania OpenStreetMap/Nominatim:
```
53.0390642, 18.6221897   92, Stefana Batorego, Dębowa Góra, Mokre, Toruń, 87-100, Polska
```

Zmieniłem adres wszędzie, a nie tylko `geo`, celowo: `streetAddress` i `geo` w tym samym obiekcie
`LocalBusiness` wskazujące punkty oddalone o 2,5 km to sprzeczność w danych strukturalnych, która
szkodzi bardziej niż sam błędny punkt.

**Dwie rzeczy do potwierdzenia po Twojej stronie:**
1. **Pinezka w Google Business Profile** musi wskazywać ten sam punkt. Współrzędne pochodzą
   z geokodowania OSM, nie z odczytu Twojej wizytówki — jeśli w GBP pinezka stoi gdzie indziej,
   podmień wartość w `SEO.astro` na tę z wizytówki. Adres w GBP też trzeba zaktualizować.
2. **Adres siedziby w regulaminie i polityce prywatności** jest powiązany z NIP 956-211-16-20
   (`MSystem Jacek Wichowski`). Upewnij się, że zgadza się z wpisem w CEIDG — to dokumenty
   o skutkach prawnych, nie tylko treść marketingowa.

---

## Załącznik — polecenia weryfikacyjne

```bash
# Łańcuchy przekierowań (wszystkie 4 warianty host/protokół)
for u in http://project-design.pl/ http://www.project-design.pl/ \
         https://project-design.pl/ https://www.project-design.pl/; do
  curl -sIL -A "Mozilla/5.0" "$u" | grep -Ei '^(HTTP/|location:)'
done

# robots.txt i sitemapy
curl -s -w "status=%{http_code}\n" https://www.project-design.pl/robots.txt
curl -s -w "status=%{http_code}\n" https://www.project-design.pl/sitemap.xml
curl -s https://www.project-design.pl/sitemap-index.xml

# Canonical vs realny URL na stronach usługowych
for p in /aranzacje-wnetrz/ /architekci-wnetrz/ /projektowanie-mebli/ \
         /realizacje/ /studio-projektowania-wnetrz/; do
  echo "--- $p"
  curl -sL -A "Mozilla/5.0" "https://www.project-design.pl$p" | grep -oE '<link rel="canonical"[^>]*>'
  curl -sIL -A "Mozilla/5.0" "https://www.project-design.pl${p%/}" | grep -Ei '^(HTTP/|Location:)'
done

# Zasoby zwracające 404
for p in /og-default.jpg /logo.png /favicon.png /apple-touch-icon.png /404.html; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' https://www.project-design.pl$p)  $p"
done

# MX dla obu wariantów pisowni domeny
nslookup -type=MX projectdesign.pl
nslookup -type=MX project-design.pl

# Fikcyjne opinie na produkcji
curl -s https://www.project-design.pl/ | grep -oE 'Anna Kowalska|Marek Nowicki|500 opinii|4\.9/5[^<>]*'

# Crawl całej witryny
D:\go-tools\urlcheck\urlcheck.exe -sitemap https://www.project-design.pl/sitemap-index.xml \
  -c 8 -rps 5 -out "D:\seo-panel\audits\cache\project-design.pl-crawl.csv" -dupes
D:\go-tools\sitecrawl\sitecrawl.exe -c 8 -rps 5 -max 200 -depth 6 \
  -sitemap https://www.project-design.pl/sitemap-index.xml \
  -out "D:\seo-panel\audits\cache\project-design.pl-graph.csv" https://www.project-design.pl/
```

```sql
-- prod seo_panel przez: aws-ssh panel "sudo -u postgres psql -d seo_panel ..."
SELECT d.domain, d.category, d."totalPages", d."indexedPages", d."totalClicks",
       d."lastCrawl", d."lastGscPull", d."mozDA", d."mozPA", d."gscProperty"
  FROM "Domain" d WHERE d.domain ILIKE '%project-design%';

SELECT di.provider, di.status, di."propertyId", di."lastSync"
  FROM "DomainIntegration" di JOIN "Domain" d ON d.id = di."domainId"
 WHERE d.domain ILIKE '%project-design%';

SELECT source, "isLive", count(*), count(DISTINCT "sourceDomain") AS domains
  FROM "BacklinkSnapshot" WHERE "targetUrl" ILIKE '%project-design%'
 GROUP BY 1,2;

SELECT "sourceDomain", "sourceUrl", "anchorText", "isDofollow", "isLive", "mozSourceDA", "lastSeen"
  FROM "BacklinkSnapshot" WHERE "targetUrl" ILIKE '%project-design%'
 ORDER BY "mozSourceDA" DESC NULLS LAST;
```

```powershell
# GSC — dane wyszukiwania i inspekcja URL (klucz SA: D:\seo-panel\backend\google-sa-key.json)
$tok = gcloud auth print-access-token --scopes="https://www.googleapis.com/auth/webmasters.readonly"
$uri = "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aproject-design.pl/searchAnalytics/query"
Invoke-RestMethod -Method POST -Uri $uri -Headers @{Authorization="Bearer $tok"} `
  -ContentType "application/json" `
  -Body (@{startDate="2026-04-23";endDate="2026-07-22";dimensions=@("query");rowLimit=500} | ConvertTo-Json -Compress)

$body = @{ inspectionUrl="https://www.project-design.pl/aranzacje-wnetrz/"
           siteUrl="sc-domain:project-design.pl"; languageCode="pl" } | ConvertTo-Json -Compress
Invoke-RestMethod -Method POST -Uri "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect" `
  -Headers @{Authorization="Bearer $tok"} -ContentType "application/json" -Body $body

# PageSpeed Insights (klucz w .env skilla — nie wypisywać)
$env:PSI_API_KEY = (Get-Content "$HOME\.claude\skills\seo-audit-onsite\.env" |
  Where-Object { $_ -match '^PSI_API_KEY=' } | ForEach-Object { ($_ -split '=',2)[1].Trim() })
Invoke-RestMethod ("https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=" +
  [System.Uri]::EscapeDataString("https://www.project-design.pl/") +
  "&strategy=mobile&category=performance&category=seo&key=$env:PSI_API_KEY")
```
