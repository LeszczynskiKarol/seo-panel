# SEO audit (on-site + off-site) — grandkuchnie.pl

**Data:** 2026-07-25
**Profil:** A/B hybryda — lokalna witryna usługowa (25 stron: 9 usług, 5 miast, 4 wpisy blogowe, portfolio, kontakt) dla stolarni meblowej z siedzibą w Toruniu. W bazie `seo_panel` sklasyfikowana jako `SATELLITE` — to błędna klasyfikacja, witryna jest głównym serwisem marki, nie zapleczem.
**Stack:** Astro 4.16 static (`output: "static"`), React islands, Tailwind; deploy `./deploy.sh` → S3 `www.grandkuchnie.pl` + CloudFront `E3BHDI3E6KXQAJ`; brak `githubRepo` w bazie.
**Repo↔prod:** mixed — 1 plik zmodyfikowany lokalnie, którego zmiana **jest już na produkcji** (deploy z niezacommitowanego drzewa).
**Last crawl:** 2026-07-24 03:35 | **GSC pull:** 2026-07-24 06:00 | **GA4 sync:** 2026-07-24 08:00 | **Moz:** 2026-06-21
**Strony:** 36 w bazie / 25 w sitemapie / 25 zwraca 200 / **13 ma jakiekolwiek wyświetlenia w GSC**
**GSC 28 dni (2026-06-26 → 2026-07-23):** 12 kliknięć, 4 191 wyświetleń, CTR 0,29%, śr. pozycja ~22–42
**GA4 28 dni (property 546178771):** 9 sesji (8 Direct, 1 Organic Social), **0 sesji Organic Search**, 0 konwersji
**Off-site (Moz, 2026-06-21):** DA 3, PA 7, **3 domeny odsyłające, 11 linków**, spam score 1

---

## ⚠ Drift summary — repo ↔ prod

| Plik | Status git | Co w repo | Co na live | Akcja |
|------|-----------|-----------|------------|-------|
| `src/components/ContactForm.tsx` | ~~`M` (niezacommitowany)~~ → **ROZWIĄZANE** | POST do `/lead` wzbogacony o `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `landing` + `try/catch` | było na produkcji przed commitem — `_assets/ContactForm.BK3g_OOy.js` zawierał `utm_source` | ~~COMMIT~~ — zacommitowane w `5b86b54` |

Dowód stanu w chwili audytu: HEAD był `713b0d0` z 2026-07-19 17:19, a `Last-Modified` HTML-a strony głównej = **2026-07-24 12:22 GMT** — deploy 5 dni po ostatnim commicie, z niezacommitowanego drzewa.

**Zamknięte 2026-07-25.** W międzyczasie doszły dwa commity, które usuwają zarówno drift, jak i jego przyczynę:
- `5b86b54` — migracja formularza na backend `meblowe-portfolio`, ContactForm.tsx zacommitowany
- `5fb2d59` — dodany `.github/workflows/deploy.yml`: deploy odpala się na push do `main`, więc ręczny `aws s3 sync` z lokalnego drzewa przestaje być ścieżką wdrożenia

Konsekwencja dla dalszych prac: **źródłem prawdy jest teraz `main`**, a nie lokalny `deploy.sh` (ten pozostał w repo jako legacy). Każdy push na `main` deployuje.

---

## ✅ Wdrożone 2026-07-25 — commit `0d51496`, CI run `30133191142` (success)

| Co | Weryfikacja na produkcji |
|---|---|
| Konsolidacja Torunia na stronę główną | `/miasto/torun/` → **301 → `/`**; sitemap 24 URL-e, 0 z „torun"; 0 linków wewnętrznych do usuniętej podstrony |
| CloudFront Function `grandkuchnie-redirects` | opublikowana i podpięta do `E3BHDI3E6KXQAJ` (viewer-request); `/kontakt` → **301** `/kontakt/`; query string zachowany (`?category=akryl&utm_source=test` przechodzi w całości) |
| Tytuł + H1 strony głównej | `Kuchnie na wymiar Toruń — pracownia Grand Kuchnie` (49 zn.), H1 z frazą w mianowniku, description 156 zn. |
| Odcięcie od marki MebleSystem | `grep -i "meble ?system"` na produkcji = **0**; usunięty sitewide dofollow ze stopki i „by MebleSystem" spod logo |
| Opinie z Places API | 5 opinii Grand Kuchnie (Ela, Marek Cygan, Ola Jercha, Wirginia Wodziak, Daria Gładka), ocena **4,8 / 5** zamiast cudzych 4,9 / 109 |
| `sameAs` + `openingHoursSpecification` | wizytówka Grand Kuchnie w schemacie, godziny pon.–pt. 7:30–16:30 w schemacie i widocznie w stopce |
| Crawl kontrolny | `urlcheck`: 24/24 → 200, 0 przekierowań, 0 noindex, 0 duplikatów tytułów |

Otwarte po wdrożeniu: konflikt adresu (P0 poniżej) i sposób odświeżania opinii (P1 poniżej).

---

## P0 — Krytyczne

### ✅ ROZSTRZYGNIĘTE 2026-07-25 (commit `7cbc67b`) — ~~Adres na stronie ≠ adres na wizytówce Google~~

Karol potwierdził: **właściwy adres to ul. Batorego 92F, 87-100 Toruń**. Polna 134 to adres innej firmy i był na witrynie błędnie. Podmienione i zweryfikowane na produkcji (`grep -i "poln"` = 0 na `/`, `/kontakt/`, `/polityka-prywatnosci/`, `/miasto/bydgoszcz/`):
- `Layout.astro` — `streetAddress` + `geo` (53.0387476 / 18.6247926, współrzędne wizytówki)
- `Footer.astro`, `src/pages/kontakt.astro` (treść i meta description), `src/pages/polityka-prywatnosci/index.astro`
- opis dojazdu do Bydgoszczy w `src/data/cities.ts`

**Pozostaje do zrobienia po stronie Google, nie w kodzie:**
1. **Wizytówka podaje `92e`, faktyczny adres to `92F`** — popraw numer w panelu GBP, żeby NAP zgadzał się co do znaku. Po korekcie zweryfikuj przez Places API, czy `formattedAddress` się zmienił.
2. **KOREKTA — wspólny telefon nie jest naruszeniem.** Napisałem wcześniej, że numer `576 376 567` na dwóch wizytówkach (Grand Kuchnie i ArtKuchnie `ChIJ3ZiRy9U1A0cRu0Lu5gk9BE4`, Polna 134) to duplikat i „jedna musi dostać własny numer". To za mocno postawione. [Wytyczne Google](https://support.google.com/business/answer/3038177?hl=pl) wymagają jedynie, żeby numer był pod bezpośrednią kontrolą firmy i nie był numerem premium; nigdzie nie zakazują współdzielenia numeru. Duplikatem jest **druga wizytówka tej samej firmy w tej samej lokalizacji** — a tu mamy różne nazwy i różne adresy, więc [definicja duplikatu](https://support.google.com/business/answer/12756178?hl=en) się nie stosuje. Google wprost dopuszcza wiele firm pod jednym adresem, w tym „locations with multiple brands, rebranded businesses, departments within other businesses".

   Realne (mniejsze) koszty wspólnego numeru, w kolejności istotności:
   - **Cytacje katalogowe** — w katalogach telefon jest jednym z kluczy tożsamości. Jeśli panoramafirm/aleo/oferteo pokażą ten sam numer przy dwóch różnych nazwach, rozpoznanie encji się rozmywa i osłabia obie marki. To dopiero zacznie boleć, gdy zaczniemy budować cytacje — czyli teraz.
   - **Atrybucja połączeń** — konwersja telefoniczna Ads (`AW-988030143/YQkUCNjx1s0aEL_JkNcD`, `Layout.astro`) nie odróżni, która marka wygenerowała telefon.
   - **Heurystyka wykrywania duplikatów** — ten sam numer plus ta sama kategoria i miasto podnosi ryzyko fałszywego scalenia lub zawieszenia przez automat. To ryzyko, nie reguła; tu niskie, bo nazwy i adresy się różnią.

   Wniosek: obniżam to z „trzeba" do „warto, gdy będzie okazja" — a konkretnie warto przed startem cytacji albo gdy zależy Ci na osobnej atrybucji połączeń per marka.
3. Cytacje katalogowe rób po (1). Wpisanie niespójnego adresu do panoramafirm/aleo/oferteo utrwaliłoby błąd w kilkunastu miejscach naraz.

Poniżej oryginalna diagnoza (zachowana dla kontekstu).

### ~~[LIVE] Adres na stronie ≠ adres na wizytówce Google — a pod adresem ze strony siedzi w Google inna firma~~

**Gdzie:** `src/layouts/Layout.astro:40` (`PostalAddress`) i `:46-50` (`geo`), `src/components/Footer.astro` (blok kontaktu), `src/data/cities.ts` → `torunLocalContent` (renderowany teraz na stronie głównej)

**Evidence** (Places API (New), 2026-07-25):
```
Wizytówka "Grand Kuchnie - kuchnie na wymiar"
  place_id  ChIJdwELFE41A0cRgSWfA_vdwuo   (CID 16916327220524295553)
  adres     Stefana Batorego 92e, 87-100 Toruń
  telefon   576 376 567
  www       https://www.grandkuchnie.pl/
  ocena     4,8 / 5 opinii     kategoria: Producent

Wizytówka "Kuchnie na wymiar Toruń - ArtKuchnie.pl"
  place_id  ChIJ3ZiRy9U1A0cRu0Lu5gk9BE4
  adres     Polna 134/hala nr 3, 87-100 Toruń
  telefon   576 376 567        ← ten sam numer co Grand Kuchnie
```
Witryna deklaruje natomiast konsekwentnie **ul. Polna 134, hala nr 3** — w `PostalAddress`, w stopce na 26 podstronach i w treści lokalnej przeniesionej właśnie na stronę główną („Pracownia Grand Kuchnie znajduje się w Toruniu przy ul. Polnej 134 (hala nr 3)"). Współrzędne `geo` w schemacie (53.0378558 / 18.6448634) też wskazują Polną.

Trzeci podmiot w tej samej lokalizacji: Meble System, ul. Polna 134, tel. 508 057 371.

**Impact:** dopasowanie encji lokalnej opiera się na spójności NAP. Google widzi witrynę podającą adres A, podczas gdy zweryfikowana wizytówka wskazująca na tę właśnie witrynę (`websiteUri` = `https://www.grandkuchnie.pl/`) stoi pod adresem B — a adres A należy w indeksie do wizytówki innej marki z tym samym telefonem. To bezpośrednio blokuje pakiet lokalny i tłumaczy pozycje 27–59 na zapytaniach miejskich lepiej niż sama słabość profilu linkowego.

**Uwaga o pewności:** wiem, że adresy się różnią — to zmierzone. **Nie wiem, który jest poprawny**: czy Batorego 92e to nowa siedziba i strona ma nieaktualne dane, czy odwrotnie (produkcja na Polnej, wizytówka pod adresem rejestrowym). Nie zgadywałem i nie zmieniałem adresu w kodzie.

**Fix — po ustaleniu, który adres obowiązuje:**
- Jeśli **Batorego 92e**: podmień `streetAddress` w `Layout.astro:40`, adres w bloku kontaktu `Footer.astro`, `geo.latitude/longitude` w `Layout.astro:46-50` oraz zdanie otwierające `torunLocalContent` w `src/data/cities.ts`.
- Jeśli **Polna 134**: popraw adres w panelu GBP, nie w kodzie. Zostaje wtedy kolizja z wizytówką ArtKuchnie pod tym samym adresem i z tym samym telefonem — dwie wizytówki o identycznym NAP to duplikat, który Google prędzej czy później scali albo zawiesi.
- Niezależnie od wyboru: numer `576 376 567` figuruje dziś na **dwóch** wizytówkach (Grand Kuchnie i ArtKuchnie). Jedna z nich musi dostać własny numer.

---

### ~~[LIVE] Marka „Grand Kuchnie" nie ma własnej tożsamości w Google — cała lokalna widoczność i 109 opinii siedzi pod marką „Meble System"~~ — ZAMKNIĘTE 2026-07-25

**Gdzie:** `src/components/GoogleReviewsSection.astro`, `src/components/Footer.astro:~100`, `src/layouts/Layout.astro:28-63` (schema LocalBusiness), profil Google Business

**Evidence:**
- Stopka witryny: `Kuchnia na wymiar - projektowanie, produkcja, montaż. Marka jest własnością MebleSystem.`
- Sekcja opinii na stronie głównej wyświetla 5 recenzji, które **dosłownie nazywają inną firmę**: `'Na firmę Meble System zdecydowałam się na podstawie wielu pozytywnych opinii…'` (`GoogleReviewsSection.astro:9`), `'Współpraca z firmą Meble System od samego początku…'` (:16), `'…realizacji wykonanej przez firmę Meble System.'` (:30)
- CTA „Zobacz wszystkie opinie" (`GoogleReviewsSection.astro:44`) linkuje do `google.com/search?q=meble+system+toruń` — jedyny wychodzący sygnał autorytetu z witryny prowadzi do **konkurencyjnej wizytówki**
- Ten sam adres, dwa telefony: `LocalBusiness.telephone = +48576376567` (`Layout.astro:35`) vs profil Meble System — ul. Polna 134, Toruń, tel. **+48 508 05 73 71**
- Wyszukiwanie webowe „Grand Kuchnie Toruń": brak jakiegokolwiek wyniku poza własną witryną — żadnego GBP, żadnego katalogu, żadnego profilu. Dla porównania „Meble System Toruń" zwraca: wizytówkę Google (4,9 / 109 opinii), Facebook `meblesystemtorun`, Yandex Maps, zlotafirma.pl, orlystolarstwa.pl, meblesystem.pl
- GSC 28 dni: **0 kliknięć** na zapytania lokalne, wszystkie miejskie pozycje 26,7–58,9

**Impact:** dla firmy usługowej z showroomem lokalny pack to zwykle większość ruchu komercyjnego. Grand Kuchnie nie występuje w packu, bo pod adresem ul. Polna 134 Google ma już zweryfikowaną encję „Meble System". 4 191 wyświetleń → 12 kliknięć (CTR 0,29%) jest spójne z brakiem wizytówki: witryna dostaje wyłącznie wyświetlenia organiczne z 3.–5. strony wyników.

**AKTUALIZACJA 2026-07-25 (Karol):** stan powyżej jest już nieaktualny w jednym kluczowym punkcie. Powiązanie z Meble System było **świadomą decyzją** (Grand Kuchnie to marka Meble System), a **Grand Kuchnie ma już własną wizytówkę Google z własnymi opiniami**. Karol decyduje się przejść na „czystą" markę. To zmienia zadanie z „zbuduj encję od zera" na „odetnij witrynę od encji Meble System". Sekcja Fix poniżej jest przepisana pod tę decyzję. Liczby o braku GBP w Evidence zostawiam jako zapis stanu z chwili audytu — ale **nie są już podstawą do działania**.

**Fix — rozdzielenie marek (decyzja podjęta: „czyste" Grand Kuchnie):**

1. `src/components/GoogleReviewsSection.astro:5-40` — wymień wszystkie 5 recenzji na opinie z **własnej** wizytówki Grand Kuchnie. Trzy z obecnych (`:9`, `:16`, `:30`) nazywają Meble System z imienia i muszą zniknąć bezwarunkowo.
2. `GoogleReviewsSection.astro:42-43` — `totalRating = 4.9` i `totalReviews = 109` to wartości wizytówki Meble System. Podmień na faktyczne wartości wizytówki Grand Kuchnie.
3. `GoogleReviewsSection.astro:44` — `GOOGLE_REVIEWS_URL`. Obecny URL to `google.com/search?…q=meble+system+toruń` z parametrami sesyjnymi (`sca_esv`, `sxsrf` z timestampem, `ved`, `rlz`, `biw`, `bih`, `dpr`), które wygasają. **Nowy link też nie może być kopiowany z paska adresu** — użyj stabilnej formy z panelu GBP: `https://search.google.com/local/reviews?placeid=<PLACE_ID>` (czytanie) albo short-link `https://g.page/r/<CID>` (Udostępnij → skrócony link). Do CTA „Wystaw opinię": `https://search.google.com/local/writereview?placeid=<PLACE_ID>`.
4. `src/components/Footer.astro:16-24` — zdanie „Marka jest własnością MebleSystem" z dofollow linkiem na `https://www.meblesystem.pl` jest **jedynym stałym linkiem wychodzącym z całej witryny**, powielonym na 26 stronach. Przy 3 domenach odsyłających to niekorzystny bilans. Zostaw informację (transparentność wobec klienta), ale przenieś ją poza stopkę — na przyszłą stronę „O nas" albo do `/polityka-prywatnosci/` — albo zostaw w stopce i **wynegocjuj link zwrotny** z `meblesystem.pl` (patrz P0 #2), żeby relacja była dwukierunkowa.
5. `src/layouts/Layout.astro` — `sameAs` ma wskazywać profile **Grand Kuchnie**, nie Meble System: własna wizytówka GBP, własny Facebook/Instagram jeśli powstaną. Nie dodawaj `parentOrganization` do Meble System, skoro celem jest rozdzielenie.
6. NAP: sprawdź, czy telefon na wizytówce Grand Kuchnie to `576 376 567` (ten z `Layout.astro:35` i ze stopki). Jeśli wizytówka ma inny numer — ujednolić, bo niespójny NAP jest jednym z silniejszych negatywnych sygnałów lokalnych.
7. W panelu GBP pole „Witryna" ustaw na `https://www.grandkuchnie.pl/` — z `www` i z końcowym slashem, żeby najważniejszy link do witryny nie trafiał w przekierowanie 302 (patrz P2).
8. Cytacje NAP dla marki Grand Kuchnie: panoramafirm, aleo, oferteo, infoserwis.torun.pl (branża 328), zlotafirma, orlystolarstwa — dokładnie te same dane co na wizytówce.

**STATUS 2026-07-25: punkty 1–5, 7 wykonane w `0d51496`.** Zweryfikowane na produkcji: 0 wystąpień „Meble System" w HTML, opinie i ocena z własnej wizytówki, `sameAs` na własne GBP, godziny w schemacie i w stopce, link do wizytówki w formie trwałej.

**Otwarte z tej listy:**
- pkt 6 (spójność NAP) — przerodził się w osobne P0 wyżej, bo adres na stronie i na wizytówce **nie są** zgodne
- pkt 8 (cytacje katalogowe) — do zrobienia ręcznie, dopiero po rozstrzygnięciu adresu; wpisanie do katalogów niewłaściwego adresu utrwaliłoby błąd w kilkunastu miejscach naraz
- `priceRange: '$$'` w `Layout.astro:37` — nadal do usunięcia (pole zdeprecjonowane)

**Korekta danych z pierwotnego audytu:** CID, który podałeś (`13776660130624185047`), **nie należy do Grand Kuchnie** — rozwiązuje się do obiektu w okolicach Bydgoszczy (współrzędne 53,127 / 17,937) i wyszukiwanie „Grand Kuchnie" w Places API go nie zwraca. Właściwy identyfikator to `place_id ChIJdwELFE41A0cRgSWfA_vdwuo` / `CID 16916327220524295553`. W kodzie jest już poprawny.

---

### [LIVE] Sieć meblowa Karola nie linkuje do grandkuchnie.pl — link equity płynie w odwrotną stronę

**Gdzie:** tabela `Domain` w `seo_panel`; `dist/index.html` (link wychodzący w stopce)

**Evidence:**
```
domain                  | mozDA | mozDomains | mozLinks | linkGroup | linkRole
www.meble-bydgoszcz.pl  |   14  |     51     |   239    |  (pusty)  | (pusty)
meblesystem.pl          |    8  |     44     |   141    |  (pusty)  | (pusty)
grandkuchnie.pl         |    3  |      3     |    11    |  (pusty)  | (pusty)
www.artkuchnie.pl       |    3  |      2     |     5    |  (pusty)  | (pusty)
```
Dla porównania klastry `COPY`, `EDU`, `MOTORS` mają uzupełnione `linkGroup` + `linkRole` (MAIN/SATELLITE/SUPPORT). **Klaster meblowy jako jedyny nie ma przypisanej roli** — nie jest zarządzany jako grupa linkowa.

- `grandkuchnie.pl` linkuje **wychodząco** do `https://www.meblesystem.pl` ze stopki (`rel="noopener noreferrer"`, bez `nofollow`) — czyli słabsza domena oddaje moc mocniejszej
- Odwrotnie: `curl` strony głównej `meblesystem.pl`, `meble-bydgoszcz.pl`, `artkuchnie.pl`, `by-interior.pl`, `project-design.pl` — **żadna nie zawiera linku do grandkuchnie.pl**
- Moz `mozAnchors` dla grandkuchnie.pl: `"zobacz stronę"` (4 podstrony, 1 domena), `""` (2/1), `"grandkuchnie.pl"` (2/1), `"kuchnie na wymiar w bydgoszczy"` (2/1). Razem 3 domeny odsyłające, 11 linków.

**Impact:** DA 3 przy 3 domenach odsyłających to główny powód, dla którego strona z porządną treścią (1 400–1 700 słów/podstronę, poprawna technicznie) siedzi na pozycjach 22–42 zamiast 5–15. `meble-bydgoszcz.pl` ma 51 domen odsyłających i **zero** przepływu do grandkuchnie.pl — to zmarnowany aktyw w tej samej niszy i tym samym regionie.

**Fix:**
1. W `seo_panel` nadaj klastrowi role, żeby cron/panel zaczął go pilnować:
   ```sql
   UPDATE "Domain" SET "linkGroup"='MEBLE', "linkRole"='MAIN'      WHERE domain='grandkuchnie.pl';
   UPDATE "Domain" SET "linkGroup"='MEBLE', "linkRole"='SATELLITE' WHERE domain IN ('www.meble-bydgoszcz.pl','www.artkuchnie.pl');
   UPDATE "Domain" SET "linkGroup"='MEBLE', "linkRole"='SUPPORT'   WHERE domain='meblesystem.pl';
   UPDATE "Domain" SET category='CONTENT_SITE' WHERE domain='grandkuchnie.pl';  -- nie SATELLITE
   ```
   (Sprawdziłem `SELECT domain, "linkGroup", "linkRole" FROM "Domain"` na prod — wszystkie cztery wiersze mają te pola puste, więc UPDATE nic nie nadpisze.)
2. Z `meble-bydgoszcz.pl` dodaj **1 link kontekstowy** do `https://www.grandkuchnie.pl/miasto/bydgoszcz/` z anchorem opisowym typu „pracownia kuchni na wymiar w Bydgoszczy" (nie exact-match — masz już jeden taki anchor, drugi zaburzyłby profil przy 11 linkach).
3. Z `meblesystem.pl` dodaj link do `https://www.grandkuchnie.pl/` z podstrony „oferta" lub „o nas", anchor `Grand Kuchnie` (branded).
4. Wzajemność stopkowa: obecny link grandkuchnie → meblesystem zostaw, ale dodaj link zwrotny, żeby przepływ był dwukierunkowy zamiast jednostronnie wyciekającego.
5. Cytacje NAP: 0 wpisów katalogowych dla „Grand Kuchnie" w całym indeksie. Minimum startowe: panoramafirm.pl, aleo.com, oferteo.pl (`oferteo.pl/kuchnie-na-wymiar/torun` już rankuje na Twoje zapytania), infoserwis.torun.pl (branża 328 — „meble kuchenne, kuchnie na wymiar"), zlotafirma.pl, orlystolarstwa.pl. Dokładnie te same nazwa/adres/telefon co w `Layout.astro:31-45` i w stopce.

---

## P1 — Wysokie

### [LIVE] Kanibalizacja: strona główna i `/miasto/torun/` walczą o to samo zapytanie

**Gdzie:** `src/pages/index.astro`, `src/pages/miasto/[slug].astro`, `src/data/cities.ts` (wpis `torun`)

**Evidence** (GSC 28 dni, wymiar query+page):
```
kuchnie na wymiar toruń  | /               impr=56  pos=13,9
kuchnie na wymiar toruń  | /miasto/torun/  impr=55  pos=41,0
projektowanie kuchni toruń | /miasto/torun/ impr=37  pos=33,1
kuchnie toruń            | /               impr=43  pos=28,1
projekty kuchni toruń    | /miasto/torun/  impr=22  pos=34,5
```
Google przełącza się między dwiema stronami dla tej samej frazy — strona główna jest mocniejsza (13,9), strona miejska rozcieńcza sygnał (41,0).

**Impact:** `kuchnie na wymiar toruń` to najważniejsze zapytanie komercyjne z siedziby firmy. Pozycja 13,9 to dolna część 1. strony — realny zasięg jednego skoku. Rozdzielenie sygnału między dwie strony blokuje ten skok.

**Fix — konsolidacja przez scalenie, nie przez skasowanie** (decyzja potwierdzona z Karolem 2026-07-25):

Toruń to siedziba firmy, nie „obsługiwane miasto". Strona główna ma tam adres w schemacie `LocalBusiness`, jest silniejsza (13,9 vs 41,0) i to ona powinna przejąć frazę na wyłączność. Ale `/miasto/torun/` zawiera ~230 słów naprawdę lokalnej treści (Starówka, Bydgoskie Przedmieście, kamienice z lat 30., Rubinkowo, Skarpa, Bielany, Wrzosy, Stawki, JAR, bezpłatny pomiar w tym samym tygodniu, montaż bez windy bez dopłat) — **strona główna nie ma dziś ani zdania o Toruniu**. Kasowanie tej treści byłoby stratą; jej przeniesienie jest w istocie całą wartością tej operacji.

1. **Przenieś treść.** `src/data/cities.ts` → wpis `torun`, pola `localContentHeading` + `localContent`. Wstaw je jako sekcję na stronie głównej (`src/pages/index.astro`), np. między `ProcessSection` a `ServiceAreasSection`. Nagłówek H2: `Kuchnie na wymiar w Toruniu — pracownia przy ul. Polnej 134`.
2. **Tytuł i H1 strony głównej.** Tytuł: `Kuchnie na wymiar Toruń — pracownia Grand Kuchnie` (48 zn.). H1 jest dziś `Tworzymy eleganckie i praktyczne kuchnie na wymiar` — bez miasta i bez frazy w mianowniku; zmień na `Kuchnie na wymiar — Toruń i województwo kujawsko-pomorskie`.
3. **301 z `/miasto/torun/` na `/`.** Witryna jest statyczna na S3, więc `Astro.redirect` nie zadziała, a `redirects` w `astro.config.mjs` przy `output: 'static'` generuje tylko meta-refresh (słaby sygnał). Właściwe miejsce to CloudFront Function na dystrybucji `E3BHDI3E6KXQAJ` — **i tak jej potrzebujesz** na przekierowania trailing-slash z P2. Dołóż obie reguły do jednej funkcji:
   - `/miasto/torun` i `/miasto/torun/` → `301` na `/`
   - URI bez kropki i bez końcowego `/` → `301` na `uri + '/'`
4. **Przełącz linki wewnętrzne.** `getStaticPaths` w `src/pages/miasto/[slug].astro` przestanie generować `torun` po usunięciu wpisu z tablicy `cities`, ale linki żyją osobno: `src/data/cities.ts:109` → `serviceAreas`, wpis `torun` — zmień `slug` na coś, co `ServiceAreasSection.astro:20` zrenderuje jako `href="/"` (albo dodaj do interfejsu `ServiceArea` opcjonalne pole `href` i użyj go tam, gdzie dziś jest `/miasto/${area.slug}/`). Sprawdź po buildzie: `grep -ro 'href="/miasto/torun/"' dist/ | wc -l` musi dać **0** — dziś daje 5 wystąpień na stronę × 26 stron.
5. **Zostaw 4 pozostałe miasta.** Bydgoszcz, Włocławek, Grudziądz i Inowrocław nie kanibalizują — strona główna ich nie targetuje, a ich zapytania (`projekty kuchni bydgoszcz` 69 wyśw., `szafy na zamówienie inowrocław` 34) mapują się czysto na własne strony.

**Czym ryzykujesz:** `/miasto/torun/` wnosi dziś 220 wyświetleń i **1 kliknięcie** w 28 dni przy średniej pozycji 36,5 — czyli praktycznie nic. W zamian strona główna dostaje 5 linków wewnętrznych z każdej podstrony (dziś idą na stronę miejską) plus 230 słów lokalnej treści, której jej brakuje. Przy DA 3 konsolidacja jest wyraźnie lepsza niż utrzymywanie dwóch słabych stron na tę samą frazę.

**Czego się spodziewać:** przez 2–4 tygodnie po wdrożeniu pozycje mogą się wahać, zanim Google przetworzy 301. Zapytania z długiego ogona przypisane dziś do strony miejskiej (`kuchnie na zamówienie papowo toruńskie` 21 wyśw./41,8) mogą wypaść — to strata rzędu pojedynczych wyświetleń, nieistotna wobec skoku na `kuchnie na wymiar toruń`.

---

### [LIVE] 9 stron usługowych to w 85% ten sam szablon — 6 z 9 ma zero wyświetleń

**Gdzie:** `src/pages/uslugi/[slug].astro`, `src/data/services.ts`

**Evidence:** porównanie unikalnych linii tekstu (`<script>` usunięte, tagi zdjęte, `sort -u`) między zbudowanymi stronami:
```
/uslugi/fornir/            176 unikalnych linii
/uslugi/lazienka-na-wymiar/ 175
/uslugi/blaty-hpl/         176
/uslugi/mdf-lakierowany/   176
/uslugi/akrylowe-mata/     176
comm -23 fornir lazienka → 13 linii tylko w fornir (~220 słów)
```
Czyli ~1 460 słów na stronę, z czego **ok. 220 unikalnych** — reszta to header, footer, formularz, galeria i te same CTA.

GSC 28 dni — wyświetlenia stron usługowych: `/uslugi/blaty-hpl/` 113, `/uslugi/projektowanie-kuchni/` 3, `/uslugi/akrylowe-mata/` 2, **pozostałe 6 stron: 0**.

**Impact:** 9 URL-i pochłania crawl budget i rozprasza autorytet wewnętrzny, nie generując nic. Przy DA 3 to realny koszt.

**Fix:** dla każdej z 9 usług dopisz w `src/data/services.ts` sekcję 400–600 słów, której nie da się przekleić między materiałami — konkret techniczny + cena + zastosowanie. Dla `fornir` np.: grubość forniru (0,6 / 0,9 mm), gatunki (dąb, orzech, jesion), sposób lakierowania (UV vs poliuretan), zachowanie w strefie zlewu i płyty, orientacyjna cena za mb względem MDF lakierowanego, ograniczenia (nie na fronty do zmywarki bez zabezpieczenia krawędzi). Jeśli nie masz mocy na 9 sztuk naraz — zacznij od tych trzech, które GSC już zauważył (`blaty-hpl`, `projektowanie-kuchni`, `akrylowe-mata`), resztę scal: 6 słabych stron → 2 mocne (`/uslugi/fronty-lakierowane/` łączące akryl+MDF+akryl-lakier-płyta, `/uslugi/zabudowy-i-lazienki/`), stare URL-e przekieruj 301.

---

### [LIVE] Portfolio: 401 zdjęć renderowanych wyłącznie po stronie klienta, 0 atrybutów alt

**Gdzie:** `src/pages/realizacje.astro:59` i `:363`, `src/data/portfolio.ts`

**Evidence:**
- `src/data/portfolio.ts` zawiera **401 wpisów** `src: "https://s3.eu-north-1.amazonaws.com/..."` i **0 wpisów `alt:`** (pole `alt?` jest opcjonalne i nieużyte ani razu)
- `realizacje.astro:59` serializuje całą tablicę do atrybutu HTML: `data-realizations={JSON.stringify(allRealizations)}` — blob ma **71 205 znaków**; `realizacje.astro:363` parsuje go dopiero w przeglądarce
- W wyrenderowanym `dist/realizacje/index.html` są dokładnie **2 tagi `<img>`**: logo i pusty `<img class="gallery-modal__img" src="">`
- Strona waży 101 KB, ale tekstu ma ~570 słów — najmniej z całego serwisu poza kontaktem
- GSC 28 dni: `/realizacje/` = 5 wyświetleń, 0 kliknięć

**Impact:** 401 zdjęć realizacji to najmocniejszy zasób contentowy firmy meblarskiej i jest w całości niewidoczny dla Google Images oraz dla oceny treści strony. Zero alt-tekstów to dodatkowo problem dostępności.

**Fix:**
1. W `src/data/portfolio.ts` uzupełnij `alt` — da się wygenerować z `category` + numeru, np. `alt: "Kuchnia na wymiar z frontami MDF lakierowanym — realizacja Grand Kuchnie Toruń"`. Priorytet: pierwsze 24 zdjęcia (pierwsza strona galerii).
2. W `realizacje.astro` wyrenderuj serwerowo pierwszą stronę galerii (`PER_PAGE = 24`) jako zwykłe `<img loading="lazy" alt={...} width height>`, a JS niech dokłada kolejne partie — zamiast renderować wszystko od zera w przeglądarce. To jednocześnie usuwa 71 KB blob z HTML-a.
3. Rozważ statyczne strony kategorii portfolio (`/realizacje/mdf-lakierowany/` itd. — 8 kategorii, 14–93 zdjęć każda) zamiast wyłącznie filtra `?category=`. Obecne URL-e `?category=` mają poprawny canonical na `/realizacje/`, więc same w sobie są OK, ale nie mogą rankować.

---

### [LIVE] LCP 7,8 s na stronach miast — hero z S3 w Sztokholmie, bez preload i bez fetchpriority

**Gdzie:** `src/pages/miasto/[slug].astro`, `src/data/cities.ts` (pole `heroImage`)

**Evidence** (PageSpeed Insights API, mobile, 2026-07-25):
```
/                                      perf=90  LCP=3,0 s  FCP=2,7 s  CLS=0  TBT=70 ms
/miasto/torun/                         perf=62  LCP=7,8 s  FCP=4,4 s  CLS=0  TBT=50 ms
/blog/ile-kosztuje-kuchnia-na-wymiar/  perf=76  LCP=4,7 s  FCP=2,8 s  CLS=0  TBT=110 ms
```
Tag hero w `dist/miasto/torun/index.html`:
```html
<img src="https://s3.eu-north-1.amazonaws.com/piszemy.com.pl/grandkuchnie/torun-opt.webp"
     alt="Toruń" class="absolute inset-0 w-full h-full object-cover">
```
Brak `fetchpriority`, brak `width`/`height`, brak `<link rel="preload">` (grep: 0 trafień na stronach miast). `fetchpriority="high"` jest zaimplementowane tylko w `HeroCarousel.astro:22` (strona główna) i `BlogLayout.astro:195` (blog) — **strony miast zostały pominięte**. Dodatkowo obrazy idą z surowego endpointu S3 `eu-north-1` (Sztokholm), poza CloudFrontem — `preconnect` z `Layout.astro:93` skraca handshake, ale nie transfer.

**Impact:** 5 stron miast to cały lokalny long tail (`projekty kuchni bydgoszcz` 69 wyśw., `kuchnie na wymiar bydgoszcz` 41, `szafy na zamówienie inowrocław` 34). LCP 7,8 s na mobile to zarówno sygnał rankingowy, jak i realny bounce.

**Fix:**
1. W `src/pages/miasto/[slug].astro` do tagu hero dodaj `fetchpriority="high"`, `decoding="async"`, `width="1920" height="1080"` (dopasuj do faktycznych wymiarów pliku).
2. W `Layout.astro` dodaj opcjonalny prop `preloadImage` i wstaw `<link rel="preload" as="image" href={preloadImage} fetchpriority="high">` w `<head>`; ze strony miasta przekaż `city.heroImage`.
3. Docelowo przenieś `s3.eu-north-1.amazonaws.com/piszemy.com.pl/grandkuchnie/*` za CloudFront (możesz dołożyć origin do istniejącej dystrybucji `E3BHDI3E6KXQAJ` jako behavior `/media/*`) — Sztokholm → Warszawa przez POP `WAW51` da największy pojedynczy zysk.

---

### [LIVE] Brak strony `/cennik/` — najmocniejsze zapytanie handlowe obsługuje wpis blogowy

**Gdzie:** brak pliku; obecnie `src/content/blog/ile-kosztuje-kuchnia-na-wymiar.md`

**Evidence** (GSC 28 dni):
- `/blog/ile-kosztuje-kuchnia-na-wymiar/` = **3 167 z 4 191 wyświetleń całej witryny (76%)**, 5 kliknięć, pos. 20,3
- Zapytanie `kuchnie na wymiar cennik` — 493 wyświetlenia (największe pojedyncze), pos. 29,2
- Ponad 20 zapytań z klastra cenowego mapuje się na ten jeden wpis: `koszt kuchni na wymiar` 135/22,1 · `ile kosztuje metr mebli kuchennych` 51/24,0 · `cena kuchni na wymiar` 32/21,5 · `cennik mebli kuchennych` 22/20,7 · `cena 1mb mebli kuchennych` 24/17,3 · `koszt kuchni na wymiar 2026` 17/**8,0**

**Impact:** cały ruch handlowy witryny wpada na artykuł poradnikowy bez ścieżki zakupowej. Zapytanie z „cennik" ma intencję transakcyjną — Google chce landing z widełkami cen, nie eseju.

**Fix:** utwórz `src/pages/cennik.astro` (URL `/cennik/`) z: widełkami zł/mb dla każdego z 9 materiałów z `services.ts`, tabelą „co wchodzi w cenę / co nie", 3 przykładowymi realizacjami z metrażem i kwotą, formularzem wyceny. Dodaj schema `FAQPage` na 5–6 najczęstszych pytań cenowych z GSC (`ile kosztuje metr bieżący kuchni`, `cena kuchni za metr`, `przykładowe ceny kuchni na wymiar`). Z wpisu blogowego linkuj do `/cennik/` anchorem `aktualny cennik kuchni na wymiar`, a nie odwrotnie. Dopisz `/cennik/` do nawigacji w `src/components/Header.astro`.

---

### [LIVE] Schema LocalBusiness bez godzin otwarcia, ocen i profili — na 26 stronach

**Gdzie:** `src/layouts/Layout.astro:28-63`

**Evidence:** obiekt `localBusinessSchema` zawiera `name`, `image`, `@id`, `url`, `telephone`, `email`, `priceRange`, `address`, `geo`, `areaServed`, `identifier`. Brakuje: `openingHoursSpecification`, `aggregateRating`, `review`, `sameAs`, `hasMap`. Grep po `src/components/Footer.astro` i `src/pages/kontakt.astro` na `godziny|openingHours|pon.*pt` — **0 trafień**, czyli godzin otwarcia nie ma nigdzie, ani w schemacie, ani w widocznej treści.

Jednocześnie witryna **ma** dane ocen w kodzie: `GoogleReviewsSection.astro` deklaruje `totalRating = 4.9`, `totalReviews = 109` i 5 pełnych recenzji — i nie są one wystawione jako structured data.

**Impact:** dla lokalnego biznesu godziny otwarcia to jeden z podstawowych atrybutów encji; ich brak osłabia dopasowanie do zapytań typu „kuchnie na wymiar toruń" z intencją wizyty. `aggregateRating` przy 4,9/109 to potencjalne gwiazdki w SERP.

**Fix:** w `src/layouts/Layout.astro` do `localBusinessSchema` dodaj:
```js
'@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],   // zamiast samego LocalBusiness
openingHoursSpecification: [
  { '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
    opens: '08:00', closes: '16:00' },          // ← wstaw faktyczne godziny
  { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '09:00', closes: '13:00' },
],
sameAs: ['https://www.meblesystem.pl', 'https://www.facebook.com/meblesystemtorun/'],
hasMap: 'https://www.google.com/maps/place/?q=place_id:<PLACE_ID>',
```
i **usuń** `priceRange: '$$'` (pole zdeprecjonowane).

**STATUS 2026-07-25:** `openingHoursSpecification` (pon.–pt. 7:30–16:30, z wizytówki), `sameAs` i widoczne godziny w stopce — wdrożone w `0d51496`. `priceRange: '$$'` nadal do usunięcia.

**NOWE P1 — opinie z Places API wymagają odświeżania, nie są stałą.**
`src/data/google-reviews.json` to snapshot pobrany skryptem `npm run reviews:refresh`. [Zasady Places API](https://developers.google.com/maps/documentation/places/web-service/policies) zabraniają cache'owania i przechowywania treści; jedynym polem zwolnionym z zakazu jest `place_id` (można trzymać bezterminowo). Ocena i opinie takiemu zwolnieniu **nie** podlegają. Dodatkowo API zwraca maksymalnie 5 opinii i nie pozwala wybrać których — więc snapshot z czasem rozjedzie się z wizytówką.

Trzy warianty, malejąco pod względem zgodności:
1. **Widget Place Details z Places UI Kit** — Google renderuje opinie u siebie, sam pilnuje atrybucji i świeżości. Zero utrzymania, zero ryzyka regulaminowego. Koszt: mniejsza kontrola nad wyglądem.
2. **Fetch po stronie klienta przez własne proxy** — endpoint w istniejącym backendzie `meblowe-portfolio` woła Places API i zwraca JSON; klucz nie opuszcza serwera. Opinie zawsze aktualne, wygląd w pełni Twój. Koszt: opinie nie są w HTML (bez znaczenia — markup ocen i tak nie da gwiazdek, patrz korekta niżej) i jedno wywołanie API na odsłonę.
3. **Obecny snapshot + odświeżanie w CI** — dodać do `.github/workflows/deploy.yml` krok `npm run reviews:refresh` z `GOOGLE_PLACES_API_KEY` w sekretach, plus harmonogram `schedule:` (np. cotygodniowy `workflow_dispatch`/cron), żeby JSON nie starzał się między deployami. Najmniej pracy teraz, ale to nadal przechowywanie treści.

Osobno: skrypt korzysta dziś z klucza `sitario-places-server` (projekt `ageless-period-491209-s8`, ograniczony do `places.googleapis.com`) — czyli klucza innego projektu Karola. Do stałego użycia w CI grandkuchnie warto wydzielić własny klucz, żeby nie wiązać limitów i rozliczeń dwóch serwisów.

**KOREKTA 2026-07-25 — `aggregateRating` NIE dodawaj.** Pierwotnie zasugerowałem tu gwiazdki w SERP na bazie 4,9/109 opinii. To było błędne. Google od września 2019 nie wyświetla „self-serving reviews": jeśli encja recenzowana kontroluje recenzje o samej sobie, jej strony z `LocalBusiness` (lub dowolnym podtypem `Organization`) są **niekwalifikowalne do gwiazdek** — dotyczy to zarówno własnego markupu, jak i osadzonych widgetów opinii. Właściwości `review`/`aggregateRating` są przeznaczone dla serwisów recenzujących **cudze** firmy. Źródła: [Review snippet — Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/review-snippet), [Making Review Rich Results more helpful (2019)](https://developers.google.com/search/blog/2019/09/making-review-rich-results-more-helpful).

Wniosek praktyczny: opinie w `GoogleReviewsSection.astro` zostawiamy jako element konwersyjny dla użytkownika (to działa), ale **nie opakowujemy ich w structured data**. Gwiazdki przy wynikach lokalnych i tak biorą się z wizytówki Google, nie z markupu na stronie — czyli droga do nich prowadzi przez GBP (P0), nie przez `Layout.astro`.

Godziny otwarcia dodaj też **widocznie** w stopce (`Footer.astro`, obok adresu) — structured data bez odpowiednika w treści to sygnał ryzyka.

---

### [LIVE] GA4 nie widzi ruchu organicznego — 12 kliknięć w GSC, 0 sesji Organic Search

**Gdzie:** `src/layouts/Layout.astro:107-142`, `src/components/CookieConsent.astro`, GA4 property `properties/546178771`

**Evidence** (te same 28 dni, 2026-06-26 → 2026-07-23):
```
GSC (wymiar page):  12 kliknięć / 4 191 wyświetleń
GA4 by channel:     Direct 8 sesji · Organic Social 1 sesja · Organic Search 0
GA4 by eventName:   session_start 9 · page_view 9 · first_visit 9
GA4 keyEvents:      0
```
Implementacja Consent Mode v2 jest poprawna — `gtag.js` ładuje się bezwarunkowo (`Layout.astro:137`) z `default` = wszystko `denied` (`:114-124`) i `wait_for_update: 2000`, a `CookieConsent.astro` tylko robi `consent update` po wyborze (`:147`). To nie jest znany błąd gatingu z innych domen Karola.

Rozbieżność ma najpewniej dwie składowe: (a) przy `analytics_storage: 'denied'` i tak niskim wolumenie Google nie uruchamia modelowania behawioralnego, więc sesje bez zgody nie trafiają do raportów; (b) `url_passthrough` + brak `client_id` może zrzucać atrybucję do Direct. **To hipoteza — nie zweryfikowałem jej pomiarem**, bo przy 9 sesjach w 28 dni nie da się tego rozstrzygnąć statystycznie.

**Impact:** przy obecnym wolumenie to problem pomiarowy, nie biznesowy. Ale gdy P0/P1 zaczną działać, będziesz podejmował decyzje na danych, które nie widzą kanału organicznego — a właśnie ten kanał chcesz mierzyć. Dodatkowo `keyEvents = 0` oznacza, że konwersje `form_submission` i `phone_click` (zaimplementowane w `Layout.astro:149-163` i `ContactForm.tsx`) nigdy się nie odpaliły — czego nie da się odróżnić od „nikt nie wysłał formularza".

**Fix:**
1. W GA4 → Admin → Data Settings → Consent Settings sprawdź, czy modelowanie zachowań jest włączone (wymaga progu ruchu — przy 9 sesjach nie zadziała, ale ustaw teraz).
2. Zweryfikuj w GSC → Ustawienia → Powiązania, czy property GA4 `546178771` jest powiązane z `sc-domain:grandkuchnie.pl` — wtedy raport „Google Organic Search Traffic" w GA4 pokaże dane GSC niezależnie od zgód.
3. Po wdrożeniu zmian z P0/P1 przetestuj konwersje ręcznie: wyślij formularz i sprawdź w GA4 Realtime, czy `form_submission` się pojawia. Bez tego nie odróżnisz „brak leadów" od „brak trackingu".
4. Pamiętaj o [[ga4-combined-tag-pollution]] — jeśli tag GT jest nadal połączony między grandkuchnie/silniki/agencja, dane mogą się dublować między properties.

---

### [CONTENT] Tytuły: 8 stron ucinanych w SERP, 9 stron usługowych bez frazy lokalnej

**Gdzie:** `src/data/cities.ts` (pole używane w `miasto/[slug].astro`), `src/data/services.ts` (pole `title`), `src/content/blog/*.md`, `src/pages/index.astro`

**Evidence** (długość znaków, `<title>` z `dist/`):
```
110  blog/trendy-kuchenne-2026            ← ucięte o ~45 zn.
 88  blog/trojkat-roboczy…                ← ucięte
 82  miasto/inowroclaw, miasto/wloclawek  ← ucięte
 81  blog/ile-kosztuje-kuchnia-na-wymiar, miasto/grudziadz
 80  miasto/bydgoszcz
 77  miasto/torun
 76  blog/jak-wybrac-material…
 69  index.html                            ← granica, brak miasta
---
 33  uslugi/blaty-hpl          "Kuchnie blaty HPL | Grand Kuchnie"
 34  uslugi/fornir             "Kuchnie z fornirem | Grand Kuchnie"
 35  uslugi/lazienka-na-wymiar "Łazienki na wymiar | Grand Kuchnie"
 36  uslugi/projektowanie-kuchni
 39  uslugi/akrylowe-mata, uslugi/mdf-lakierowany
 41  uslugi/plyta-laminowana
 42  uslugi/szafy-zabudowy-garderoby
 45  uslugi/akryl-lakier-plyta
```
Strony miast używają liczby pojedynczej („Kuchnia na wymiar - Bydgoszcz"), podczas gdy zapytania w GSC są w liczbie mnogiej (`kuchnie na wymiar bydgoszcz` 41 wyśw., `kuchnie na wymiar toruń` 87).

**Impact:** 9 tytułów usługowych marnuje po ~25 znaków, w których mieści się miasto — a `/uslugi/blaty-hpl/` już dostaje wyświetlenia na `blaty na wymiar bydgoszcz` (20 wyśw., pos. 32,4) i `blaty kuchenne na wymiar inowrocław` (14 wyśw.) bez żadnej frazy lokalnej w tytule.

**Fix — konkretne podmiany:**

W `src/data/services.ts` (pole `title` każdej z 9 usług):
| slug | obecnie | na |
|---|---|---|
| `blaty-hpl` | `Kuchnie blaty HPL` | `Blaty HPL do kuchni na wymiar — Toruń, Bydgoszcz` |
| `fornir` | `Kuchnie z fornirem` | `Kuchnie fornirowane na wymiar — Toruń i Bydgoszcz` |
| `mdf-lakierowany` | `Kuchnie MDF lakierowany` | `Kuchnie MDF lakierowany na wymiar — Toruń, Bydgoszcz` |
| `plyta-laminowana` | `Kuchnie płyta laminowana` | `Kuchnie z płyty laminowanej na wymiar — Toruń` |
| `akrylowe-mata` | `Kuchnie akrylowe / mata` | `Kuchnie akrylowe i matowe na wymiar — Toruń` |
| `akryl-lakier-plyta` | `Kuchnie akryl/lakier + płyta` | `Kuchnie akryl, lakier i płyta na wymiar — Toruń` |
| `projektowanie-kuchni` | `Projektowanie kuchni` | `Projektowanie kuchni na wymiar — Toruń i Bydgoszcz` |
| `lazienka-na-wymiar` | `Łazienki na wymiar` | `Meble łazienkowe na wymiar — Toruń i Bydgoszcz` |
| `szafy-zabudowy-garderoby` | `Szafy, zabudowy, garderoby` | `Szafy i garderoby na wymiar — Toruń, Inowrocław` |
(sufiks ` | Grand Kuchnie` dokleja się automatycznie — sprawdź, żeby suma nie przekroczyła 65 zn.; przy dłuższych wariantach usuń sufiks dla tych stron)

W `src/data/cities.ts` — skróć tytuły z 77–82 do ≤62 zn. i przejdź na liczbę mnogą:
`Kuchnie na wymiar Toruń — projekt, produkcja, montaż` (52 zn.), analogicznie dla pozostałych czterech miast.

W `src/pages/index.astro` — obecny `Grand Kuchnie - Kuchnie na wymiar | Projektowanie, produkcja, montaż` (69 zn., bez miasta) → `Kuchnie na wymiar Toruń — pracownia Grand Kuchnie` (48 zn.). Strona główna rankuje na `kuchnie na wymiar toruń` (pos. 13,9) i `kuchnie toruń` (pos. 28,1) **nie mając miasta w tytule** — to najtańszy skok w całym audycie.

W `src/content/blog/trendy-kuchenne-2026.md` — tytuł 110 zn. skróć do `Trendy kuchenne 2026 — kolory, materiały i style` (47 zn.).

---

## P2 — Średnie

### [LIVE] Przekierowania trailing-slash zwracają 302 zamiast 301
**Gdzie:** konfiguracja S3 website endpoint / CloudFront `E3BHDI3E6KXQAJ`
**Evidence:**
```
curl -sI https://www.grandkuchnie.pl/kontakt      → HTTP/1.1 302 Moved Temporarily, Location: /kontakt/
curl -sI https://www.grandkuchnie.pl/uslugi/fornir → HTTP/1.1 302, Location: /uslugi/fornir/
curl -sI https://www.grandkuchnie.pl/blog         → HTTP/1.1 302, Location: /blog/
```
**Impact:** 302 nie konsoliduje sygnałów tak jak 301. Canonical na stronie docelowej ratuje sytuację, ale warianty bez slasha krążą w indeksie — wynik wyszukiwania na „Grand Kuchnie" pokazuje `https://www.grandkuchnie.pl/miasto/torun` (bez slasha).
**Fix:** dodaj CloudFront Function (viewer-request) do dystrybucji `E3BHDI3E6KXQAJ`, która dla URI bez kropki i bez końcowego `/` zwraca `301` z `Location: uri + '/'`. Alternatywnie skonfiguruj `RoutingRules` na buckecie `www.grandkuchnie.pl`.

### [LIVE] Przekierowanie apex→www gubi query string
**Gdzie:** bucket przekierowujący `grandkuchnie.pl`
**Evidence:**
```
curl -sIL "https://grandkuchnie.pl/realizacje?category=akryl"
→ 301 Location: https://www.grandkuchnie.pl/realizacje      ← ?category=akryl zniknęło
→ 302 Location: /realizacje/
→ 200
```
Dodatkowo `http://grandkuchnie.pl/` daje łańcuch 3 skoków: `http apex → https apex → https www`.
**Impact:** każdy link zewnętrzny czy kampania z parametrami (UTM!) trafiająca na apex traci parametry — a właśnie dodałeś zbieranie UTM-ów w `ContactForm.tsx`. Ten sam mechanizm zje `?utm_source=`.
**Fix:** w regule przekierowania bucketa apex włącz zachowanie query string (`ReplaceKeyPrefixWith` z zachowaniem QS albo CloudFront Function robiąca 301 z `request.querystring`). Osobno: skonfiguruj rekord dla `http://grandkuchnie.pl` tak, żeby szedł od razu na `https://www.grandkuchnie.pl` (jeden skok zamiast dwóch).

### [LIVE] 10 linków wewnętrznych bez końcowego slasha wymusza 302
**Gdzie:** `src/data/services.ts` (9×), `src/pages/uslugi/[slug].astro:83`
**Evidence:** `grep -roh 'href="/kontakt"' dist/` → 9 trafień (po jednym na każdą stronę usługi); `grep -roh 'href="/realizacje"' dist/` → 1 trafienie.
Źródło: `services.ts:46,84,123,162,201,239,277,330,368` — `ctaUrl: "/kontakt"`; oraz `uslugi/[slug].astro:83` — fallback `: '/realizacje'`.
**Impact:** główne CTA konwersyjne na każdej stronie usługi przechodzi przez zbędne przekierowanie.
**Fix:** w `src/data/services.ts` zamień wszystkie 9 wystąpień `ctaUrl: "/kontakt"` na `ctaUrl: "/kontakt/"`. W `src/pages/uslugi/[slug].astro:83` zamień fallback `'/realizacje'` na `'/realizacje/'`.

### [LIVE] Brak stron-hubów `/uslugi/` i `/miasto/`
**Evidence:** `curl -sI https://www.grandkuchnie.pl/uslugi/` → 404; `https://www.grandkuchnie.pl/miasto/` → 404.
**Impact:** nie ma strony celującej w szeroką frazę „kuchnie na wymiar kujawsko-pomorskie" ani agregatu usług. Struktura jest płaska (max głębokość kliknięć = 2 wg `sitecrawl`), więc to nie problem crawlowania, tylko brakujący cel rankingowy. `serviceAreas` w `cities.ts:109` ma już wpis `kujawsko-pomorskie` z `isMain: true` i opisem — obecnie nie ma dla niego strony.
**Fix:** utwórz `src/pages/uslugi/index.astro` (lista 9 usług z opisami po 60–80 słów) i `src/pages/miasto/index.astro` targetujący `kuchnie na wymiar kujawsko-pomorskie`, wykorzystując istniejący `description` z `serviceAreas[0]`. Dopisz oba do `Header.astro`.

### [LIVE] Strony usług i miast bez schematu Service i BreadcrumbList
**Evidence:** typy JSON-LD per strona (`dist/`):
```
/uslugi/* (9 stron)  → tylko LocalBusiness + PostalAddress + GeoCoordinates + 2× PropertyValue
/miasto/* (5 stron)  → j.w.
/realizacje/         → j.w.
/blog/<post>/        → LocalBusiness + Article + Organization + ImageObject + WebPage + BreadcrumbList ✓
```
Czyli BreadcrumbList jest tylko na 4 wpisach blogowych; 15 stron komercyjnych go nie ma, mimo że mają ścieżkę nawigacyjną.
**Fix:** w `src/pages/uslugi/[slug].astro` dodaj przez `<slot name="head">` schema `Service` (`serviceType`, `provider` → `{"@id": "https://www.grandkuchnie.pl/#localbusiness"}`, `areaServed`) plus `BreadcrumbList` (Strona główna → Usługi → nazwa). W `src/pages/miasto/[slug].astro` dodaj `BreadcrumbList` i `Service` z `areaServed` zawężonym do konkretnego miasta.

### ~~[LIVE] Cache-Control na HTML rozjeżdża się z intencją deploy.sh~~ — WYCOFANE 2026-07-25
Pierwotnie zgłosiłem rozjazd: `deploy.sh:59-62` ustawia na `*.html` `max-age=300, must-revalidate`, a live zwraca `max-age=0, must-revalidate`. Wniosek („deploy nie przeszedł przez deploy.sh") był poprawny, ale **finding jest nieaktualny**: doszedł `.github/workflows/deploy.yml`, w którym `max-age=0, must-revalidate` na HTML jest **zamierzone** (linia 43). `deploy.sh` to legacy. Nie ma tu nic do naprawy.

Przy okazji z workflow: deploy inwaliduje **dwie** dystrybucje (`CF_DIST_WWW` i `CF_DIST_APEX`) — przy podpinaniu funkcji przekierowującej pamiętaj, że apex ma osobną dystrybucję.

### [CONTENT] Kategorie bloga mają po 2 wpisy
**Evidence:** `/blog/kategoria/poradniki/` (23 822 B, 4 obrazki) i `/blog/kategoria/trendy-w-kuchniach/` (20 773 B, 2 obrazki) — łącznie 4 wpisy w `src/content/blog/`. Obie kategorie są w sitemapie i indeksowalne; obie mają 0 wyświetleń w GSC.
**Fix:** albo dopisz treść (min. 5 wpisów na kategorię), albo tymczasowo wyłącz strony kategorii z sitemapy do czasu, aż blog urośnie. Priorytet niski — nie szkodzą, po prostu nic nie wnoszą.

---

## P3 — Backlog

- **26 KiB nieużywanego CSS na każdej stronie** (PSI: `unused-css-rules` — 25–26 KiB na wszystkich trzech badanych URL-ach). Tailwind z `daisyui` generuje więcej, niż witryna używa. Fix: przejrzyj `tailwind.config.mjs` pod kątem zawężenia motywów daisyUI do jednego.
- **126 KiB nieużywanego JS na stronach miast i bloga** (PSI: `unused-javascript`). Strony miast ładują `/_assets/hoisted.CRsG_6t7.js` — sprawdź, czy hydratacja React jest tam w ogóle potrzebna.
- **Blog bez sygnałów E-E-A-T** — 4 wpisy, brak biogramu autora, brak `author` z realnym nazwiskiem w schemacie `Article` (obecnie `Organization`). Przy treściach cenowych i doradczych to realny czynnik.
- **`priceRange: '$$'`** w `Layout.astro:37` — pole zdeprecjonowane przez Google, do usunięcia (ujęte też w P1 o schemacie).
- **Brak strony „O nas"** — dla lokalnego biznesu z 10-letnią historią i nagrodą Orły Stolarstwa (przyznaną encji Meble System) to brakujący sygnał zaufania.

---

## Niezweryfikowane — do sprawdzenia ręcznie

- **Istnienie profilu Google Business dla „Grand Kuchnie"** — wnioskuję o braku z wyszukiwania webowego i z tego, że własne CTA witryny linkuje do wizytówki Meble System. Nie mam dostępu do panelu GBP. To warunkuje całą decyzję z P0.
- **Faktyczne godziny otwarcia pracowni** — nie ma ich nigdzie w repo ani na produkcji, więc wartości w propozycji schematu są zaślepkami.
- **Raport indeksacji w GSC** (Coverage / „Crawled – currently not indexed") — API Search Console nie eksponuje tych danych. Baza mówi `indexedPages = 25`, ale tylko **13 stron ma jakiekolwiek wyświetlenia** w 28 dni. Sprawdź w panelu GSC → Indeksowanie stron, czy pozostałe 12 są zaindeksowane, czy odrzucone.
- **Pełny profil linków** — jedyne źródło to snapshot Moz z 2026-06-21 (3 domeny, 11 linków). Tabela `BacklinkSnapshot` dla tej domeny jest pusta (`SELECT * … WHERE "domainId"='cmpl6dwvdxws3qrrqonlbnei3'` → 0 wierszy). Nie znam tożsamości 2 z 3 domen odsyłających — anchor `kuchnie na wymiar w bydgoszczy` sugeruje `meble-bydgoszcz.pl`, ale `curl` jej strony głównej nie pokazał linku, więc jest gdzieś na podstronie i tego nie potwierdziłem.
- **Rzeczywisty wolumen zapytań** — GSC pokazuje wyświetlenia, nie wolumen. `kuchnie na wymiar cennik` przy 493 wyświetleniach na pozycji 29 ma realny potencjał znacznie większy, ale nie oszacowałem go — nie mam narzędzia keywordowego w tym audycie.

---

## Pominięte — nie dotyczą tego profilu

- **C11 schema Product/Offer** — nie e-commerce, brak koszyka i cen jednostkowych.
- **T16 hreflang** — witryna jednojęzyczna (`<html lang="pl">`).
- **L1 sierót** — `sitecrawl` wykrył 0 sierot przy `-max 200` i faktycznym rozmiarze 33 URL-e, więc limit nie zafałszował wyniku (w przeciwieństwie do ostrzeżenia z dokumentacji narzędzia). Głębokość kliknięć max = 2.
- **Kontrola faceted search / paginacji** — jedyne URL-e parametryczne to `/realizacje/?category=X` (8 sztuk); wszystkie mają poprawny canonical na `https://www.grandkuchnie.pl/realizacje/`, więc konsolidacja działa.
- **`botlog` / crawl budget** — witryna nie stoi na VPS-ie Karola (S3 + CloudFront), brak dostępu do logów nginx. Przy 25 stronach crawl budget i tak nie jest ograniczeniem.
- **`crawldiff`** — brak wcześniejszego snapshotu `urlcheck` dla tej domeny w `D:\seo-panel\audits\cache\`; dzisiejszy CSV jest pierwszym punktem odniesienia.

---

## Kolejność działań

**Decyzje — PODJĘTE 2026-07-25:** przejście na „czyste" Grand Kuchnie (własna wizytówka GBP już istnieje) oraz konsolidacja Torunia na stronę główną. Poniższa kolejność uwzględnia obie.

**Dane do zebrania z panelu GBP (5 minut, blokuje punkt 3):** faktyczna średnia ocen, faktyczna liczba opinii, `PLACE_ID` / `CID`, telefon widoczny na wizytówce, godziny otwarcia.

**⚠ KOLEJNOŚĆ KRYTYCZNA — funkcja CloudFront PRZED pushem na `main`.**
`.github/workflows/deploy.yml:43` synchronizuje HTML z `--delete`, a build nie generuje już `dist/miasto/torun/`. Push na `main` **usunie** `miasto/torun/index.html` z bucketa. Jeśli funkcja przekierowująca nie będzie wtedy podpięta, `/miasto/torun/` zwróci 404 zamiast 301 — czyli stracisz dokładnie ten sygnał konsolidacji, dla którego robimy całą operację. Publikuj i podepnij `infra/cloudfront-redirects.js` (viewer-request, dystrybucja `E3BHDI3E6KXQAJ`) **zanim** wypchniesz kod.

**Commit:** ~~ContactForm.tsx~~ — zrobione w `5b86b54`.

**Rozdzielenie marek (P0 #1):**
2. `GoogleReviewsSection.astro` — 5 nowych opinii Grand Kuchnie, własne `totalRating`/`totalReviews`, `GOOGLE_REVIEWS_URL` na stabilny `placeid`/`g.page`. **Bez** `aggregateRating` w schemacie — patrz korekta w P1.
3. `Footer.astro:16-24` — przenieś zdanie o MebleSystem poza stopkę albo wynegocjuj link zwrotny.
4. W panelu GBP: pole „Witryna" → `https://www.grandkuchnie.pl/`.

**Konsolidacja Torunia (P1):**
5. Przenieś `cities.ts` → `torun.localContent` na stronę główną; usuń wpis `torun` z tablicy `cities`; przełącz `serviceAreas` tak, żeby Toruń linkował na `/`.
6. CloudFront Function na `E3BHDI3E6KXQAJ`: `301 /miasto/torun → /` **plus** `301` na brakujący trailing slash (jedna funkcja, dwie reguły).
7. Po buildzie zweryfikuj: `grep -ro 'href="/miasto/torun/"' dist/ | wc -l` → musi być 0.

**Kod — reszta tej samej sesji:**
8. Tytuły: `src/pages/index.astro` (dodaj „Toruń" + nowy H1), `src/data/services.ts` (9 tytułów), `src/data/cities.ts` (4 pozostałe miasta), `src/content/blog/trendy-kuchenne-2026.md`.
9. `src/data/services.ts` — 9× `ctaUrl: "/kontakt"` → `"/kontakt/"`; `src/pages/uslugi/[slug].astro:83` → `'/realizacje/'`.
10. `src/pages/miasto/[slug].astro` — `fetchpriority="high"` + `width`/`height` na hero; `Layout.astro` — prop `preloadImage` i `<link rel="preload">`.
11. `src/layouts/Layout.astro` — `openingHoursSpecification`, `sameAs` (profile Grand Kuchnie), `@type: ['LocalBusiness','HomeAndConstructionBusiness']`, usuń `priceRange`. Godziny dodaj też widocznie w `Footer.astro`.
12. `./deploy.sh` (nie ręczny `aws s3 sync` — patrz P2 o cache).

**Kod — druga sesja:**
13. `src/pages/cennik.astro` + link z wpisu blogowego + wpis w `Header.astro`.
14. `src/data/portfolio.ts` — `alt` dla pierwszych 24 zdjęć; `realizacje.astro` — SSR pierwszej strony galerii.
15. `src/pages/uslugi/index.astro` i `src/pages/miasto/index.astro`.
16. Schema `Service` + `BreadcrumbList` na `/uslugi/*` i `/miasto/*`.

**Off-site (równolegle, nie blokuje kodu):**
17. `UPDATE "Domain" SET "linkGroup"='MEBLE', …` — nadaj role klastrowi meblowemu w `seo_panel` (SQL w P0 #2).
18. Link z `meble-bydgoszcz.pl` → `/miasto/bydgoszcz/` (anchor opisowy) i z `meblesystem.pl` → `/` (anchor branded).
19. Cytacje NAP dla marki Grand Kuchnie: panoramafirm, aleo, oferteo, infoserwis.torun.pl, zlotafirma, orlystolarstwa — identyczne dane co na wizytówce GBP i w `Layout.astro:31-45`.

**Treść (ciągłe):**
20. 400–600 unikalnych słów na każdą z 9 stron usługowych — zacznij od `blaty-hpl`, `projektowanie-kuchni`, `akrylowe-mata` (te trzy GSC już widzi).
21. Rozbuduj `/blog/ile-kosztuje-kuchnia-na-wymiar/` (76% wyświetleń witryny, pos. 20,3) o sekcje odpowiadające na konkretne warianty z GSC: „cena za metr bieżący", „cennik 2026", „przykładowe wyceny".

**GSC:**
22. Po wdrożeniu zgłoś do indeksacji: `/` (priorytet — zmieniony tytuł, H1 i treść lokalna), `/cennik/`, `/uslugi/blaty-hpl/`, `/uslugi/projektowanie-kuchni/`, `/uslugi/`, `/miasto/`. **Nie zgłaszaj `/miasto/torun/`** — po punkcie 6 zwraca 301. **Limit ~10 URL-i/dobę na property** — rozłóż na dwa dni, resztę zostaw crawlerowi (sitemap ma poprawny `lastmod`).

---

## Załącznik — polecenia weryfikacyjne

```bash
# Bulk crawl sitemapy (wynik: D:\seo-panel\audits\cache\grandkuchnie.pl-crawl.csv)
D:/go-tools/urlcheck/urlcheck.exe -sitemap https://www.grandkuchnie.pl/sitemap-index.xml \
  -c 20 -rps 15 -out "D:/seo-panel/audits/cache/grandkuchnie.pl-crawl.csv" -dupes

# Graf linkowania wewnętrznego
D:/go-tools/sitecrawl/sitecrawl.exe -c 15 -rps 15 -max 200 -depth 8 \
  -sitemap https://www.grandkuchnie.pl/sitemap-index.xml \
  -out "D:/seo-panel/audits/cache/grandkuchnie.pl-graph.csv" https://www.grandkuchnie.pl/

# Łańcuchy przekierowań
curl -sIL -A "Mozilla/5.0" http://grandkuchnie.pl/
curl -sIL -A "Mozilla/5.0" "https://grandkuchnie.pl/realizacje?category=akryl"
curl -sI  -A "Mozilla/5.0" https://www.grandkuchnie.pl/kontakt

# Weryfikacja driftu: czy niezacommitowana zmiana jest na produkcji
curl -s https://www.grandkuchnie.pl/_assets/ContactForm.BK3g_OOy.js | grep -c utm_source

# Baza prod (host panel, peer auth)
aws-ssh panel "sudo -u postgres psql -d seo_panel -A -F '|' -x -c \
  \"SELECT * FROM \\\"Domain\\\" WHERE domain='grandkuchnie.pl'\" 2>/dev/null"
aws-ssh panel "sudo -u postgres psql -d seo_panel -A -F '|' -c \
  \"SELECT domain,\\\"mozDA\\\",\\\"mozDomains\\\",\\\"mozLinks\\\",\\\"linkGroup\\\",\\\"linkRole\\\" \
    FROM \\\"Domain\\\" ORDER BY \\\"mozDA\\\" DESC\" 2>/dev/null"

# GSC (PowerShell) — zapytania + strony, 28 dni
# klucz SA: D:\seo-panel\backend\google-sa-key.json, property: sc-domain:grandkuchnie.pl
# GA4 — property properties/546178771
# PSI — klucz z ~\.claude\skills\seo-audit-onsite\.env (PSI_API_KEY)
```

## Załącznik — porównanie treści stron usługowych

```bash
for f in fornir lazienka-na-wymiar blaty-hpl mdf-lakierowany akrylowe-mata; do
  sed -e 's/<script[^>]*>.*<\/script>//g' -e 's/<[^>]*>/\n/g' dist/uslugi/$f/index.html \
    | sed 's/^ *//;s/ *$//' | grep -v '^$' | sort -u > /tmp/svc-$f.txt
done
wc -l /tmp/svc-*.txt
comm -23 /tmp/svc-fornir.txt /tmp/svc-lazienka-na-wymiar.txt   # → 13 linii unikalnych
```

Wynik: 175–176 unikalnych linii na stronę, z czego 13 to treść właściwa dla usługi (~220 słów). Analogicznie strony miast: 180 linii, 8 unikalnych (~225 słów z `cities.ts:localContent`).
