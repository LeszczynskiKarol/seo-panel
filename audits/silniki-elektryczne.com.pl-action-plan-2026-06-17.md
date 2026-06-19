# Plan działań SEO — silniki-elektryczne.com.pl
**Data:** 2026-06-17  
**Domena:** https://www.silniki-elektryczne.com.pl  
**Repo:** D:\stojan-shop-new (stojan-shop-v2)  
**Stack:** Astro 5 + Node SSR, Fastify backend, PostgreSQL, PM2 na EC2

---

## Kluczowe dane wejściowe (ostatnie 28 dni GSC + GA4)

| Strona | Kliknięcia | Impressions | CTR | Śr. pozycja | Produkty | Długość opisu |
|---|---|---|---|---|---|---|
| /skup-silnikow | 174 | 1 829 | 9,5% | 8,5 | 0 | 0 |
| / (homepage) | 92 | 5 250 | 1,75% | 11,5 | — | ~7 500 znaków |
| /silniki-elektryczne-5-5-kw | 60 | 3 509 | 1,71% | 4,4 | — | — |
| /motoreduktory/motoreduktor-przekladnia-037kw-90obr-1f-230v-do-maszynki-do-miesa | 33 | 1 622 | 2,03% | 6,5 | — | — |
| /silniki-elektryczne-3-kw | 54 | 4 042 | 1,34% | 5,6 | — | — |
| /jednofazowe | 23 | 1 963 | 1,17% | 9,1 | 83 | 1 505 znaków |
| /silniki-elektryczne-055-kw | 23 | 855 | 2,69% | 5,3 | — | — |
| /motoreduktory | 20 | 3 540 | 0,56% | 21,1 | 731 | 10 904 znaków |
| /silniki-elektryczne-4-kw | 20 | 1 525 | 1,31% | 6,1 | — | — |
| /trojfazowe | **nie ma w top 50** | — | — | — | 1 169 | 4 706 znaków |

GA4: ~1 800–2 000 sesji/28 dni, średnio 60–80 sesji/dzień.

PageSpeed (mobile): perf 79–84, SEO 100, TTFB 10–30 ms, LCP 3,8–4,8 s.

---

## Diagnoza główna

1. **Kategorie główne nie rankują na własne nazwy.** /motoreduktory pozycja 21, /trojfazowe nie widać w top 50, /jednofazowe pozycja 9. Google nie uznaje ich za najlepszą odpowiedź na head-term.
2. **Ruch idzie na produkty i strony mocy, nie na kategorie.** To oznacza, że strona kategorii jest zbyt ogólna / zbyt słaba w sygnałach intencji.
3. **Brak segmentacji w /motoreduktory.** 731 produktów na jednej stronie bez podkategorii. Konkurencja ma dedykowane landingi: motoreduktor ślimakowy, walcowy, kątowy, do maszynki do mięsa, 230V, 3kW, z hamulcem.
4. **Homepage kanibalizuje kategorie.** Rankuje na „silniki elektryczne” (poz. 7) i brand, podczas gdy /trojfazowe nie rankuje na „silniki trójfazowe”.
5. **CTR homepage jest niski (1,75%).** Mimo pozycji 7–11 na ogólne frazy, snippet nie wyróżnia się.
6. **Sitemap: /motoreduktory, /trojfazowe, /jednofazowe mają lastmod 2026-05-24, podczas gdy inne kategorie 2026-06-15.** Sygnał „stary” content.

---

## Plan działań — priorytety

### P0 — największy efekt, zrób w tym tygodniu

#### P0.1 Stwórz podkategorie / landingi motoreduktorów
**Dlaczego:** /motoreduktory ma 731 produktów, pozycję 21 na własną nazwę i słaby CTR. Pojedynczy produkt do maszynki do mięsa rankuje lepiej niż sama kategoria. Konkurencja ma dedykowane landingi na każdy typ.

**Konkretne landingi do dodania (kolejność wg potencjału):**
1. `/motoreduktory-slimakowe` — frazy: „motoreduktor ślimakowy”, „motoreduktor ślimakowy 230V”
2. `/motoreduktory-walcowe` — frazy: „motoreduktor walcowy”, „motoreduktor przemysłowy”
3. `/motoreduktory-katowe` — frazy: „motoreduktor kątowy”, „motoreduktor stożkowy”
4. `/motoreduktory-do-maszynki-do-miesa` — frazy: „motoreduktor do maszynki do mięsa”, „motoreduktor do maszynki do mięsa 32”
5. `/motoreduktory-230v` — frazy: „motoreduktor 230V”, „silnik z motoreduktorem 230V”
6. `/motoreduktory-3kw` / `/motoreduktory-1-1kw` — frazy mocowe
7. `/motoreduktory-z-hamulcem` — frazy: „motoreduktor z hamulcem”

**Jak zrobić technicznie:**
- W DB tabela `Category` ma pole `parentId` i relację `children` — można dodać podkategorie z `parentId` wskazującym na kategorię `motoreduktory`.
- Frontend `[categorySlug]/index.astro` już obsługuje drzewo kategorii (pobiera `children`), więc po dodaniu podkategorii w DB strona /motoreduktory może wyświetlać podkategorie automatycznie.
- Dla landingów „zastosowanie/moc” (nie pasujących do drzewa kategorii) można użyć istniejącego mechanizmu `productFilters` w `Category` albo dodać nowe wpisy `Category` z filtrami productFilters zawężającymi produkty.

**Pliki do zmiany:**
- `frontend/src/pages/[categorySlug]/index.astro` — dodać sekcję „Typy motoreduktorów” z linkami do children (jeśli ich nie ma).
- Opcjonalnie: `frontend/src/pages/index.astro` — dodać linki do nowych landingów w sekcji quickLinks / kategorie.
- Backend `backend/src/routes/sitemap.ts` — sitemap-categories.xml automatycznie je pobierze, ale lastmod będzie nowy.

**Content:** każdy landing min. 600–800 słów: czym jest dany typ, zastosowanie, jak dobrać, tabela porównawcza, FAQ 3–5 pytań.

---

#### P0.2 Wzmocnij /trojfazowe, żeby zaczęło rankować na „silniki trójfazowe”
**Dlaczego:** kategoria ma 1 169 produktów, ale nie ma w top 50 stron. Homepage i strony mocy zjadają ruch.

**Działania:**
1. Zmień title z:
   - `Silniki trójfazowe — używane i nowe, od 0,09 do 315 kW | Stojan`
   - na: `Silniki trójfazowe 230V/400V — używane i nowe od 0,09 do 315 kW | Stojan`
   - Uzasadnienie: większość użytkowników szuka napięcia 400V / 230V/400V. Dodaj to do title i H1.
2. Rozbuduj opis kategorii z 4 706 do min. 8 000 znaków:
   - sekcje: rodzaje budowy (B3, B5, B14), klasy izolacji, IP, IE, zastosowanie, jak dobrać moc i obroty, często zadawane pytania.
3. Dodaj podkategorie / filtry linkowane wewnętrznie:
   - `/silniki-elektryczne-3-kw`, `/silniki-elektryczne-5-5-kw` itp. już istnieją — wystarczy dodać je jako „Popularne moce” na /trojfazowe.
   - `/trojfazowe?cond=uzywany` i `/trojfazowe?cond=nowy` — ale to filtry z noindex. Lepiej dedykowane landingi lub sekcje opisowe w treści.
4. Dodaj breadcrumb i internal links z /trojfazowe do top 10 producentów (już jest topMfrsInCategory — upewnij się, że wyświetla się dla >4 producentów).

**Pliki:**
- `frontend/src/pages/[categorySlug]/index.astro` — sekcja „Popularne moce” + „Producenci” dla /trojfazowe.
- DB `Category.metadata.title`, `Category.description` dla slug `trojfazowe`.

---

#### P0.3 Popraw CTR homepage na frazy ogólne
**Dlaczego:** 5 250 impressions, CTR 1,75%. Pozycja 7 na „silniki elektryczne” daje tylko 11 klików — przy wyższym CTR można podwoić ruch bez podnoszenia pozycji.

**Działania:**
1. Zmień title na bardziej konkretny / z USP:
   - obecnie: `Silniki elektryczne - sklep, hurtownia | Oferta, ceny, sprzedaż`
   - propozycja: `Silniki elektryczne — używane i nowe 0,09–285 kW | Sklep Stojan`
   - albo: `Silniki elektryczne trójfazowe, jednofazowe, motoreduktory | Sklep Stojan`
2. Meta description:
   - obecnie: ogólny opis.
   - propozycja: `✅ 1000+ silników elektrycznych od ręki: trójfazowe, jednofazowe, motoreduktory. Używane po regeneracji i nowe. Wysyłka 24 h, gwarancja do 24 mies. Sprawdź!`
3. Dodaj rich snippet / FAQ już jest — OK.
4. H1 jest OK (`Silniki elektryczne — sklep i hurtownia, używane i nowe od 0,09 do 285 kW`).

**Pliki:**
- `frontend/src/pages/index.astro` (linia 229 title, 230 description).

---

### P1 — wysoki efekt, zrób w ciągu 2 tygodni

#### P1.1 Uporządkuj /jednofazowe
**Dlaczego:** 83 produkty, tylko 23 kliknięcia. Duży potencjał na długi ogon: „silnik jednofazowy 3kW”, „silnik 230V”, „silnik elektryczny 1 fazowy”.

**Działania:**
1. Rozbuduj opis z 1 505 do min. 4 000 znaków:
   - rodzaje: kondensatorowy, szeregowy, asynchroniczny, jamnik.
   - zastosowanie: warsztat, rolnictwo, maszyny domowe.
   - jak podłączyć, jak dobrać kondensator.
2. Dodaj landingi mocowe: `/silniki-elektryczne-1-1-kw`, `/silniki-elektryczne-2-2-kw` dla jednofazowych — obecnie istnieją, ale filtrują po wszystkich kategoriach. Rozważ dedykowane opisy w metadata dla tych stron mocy, gdy główną kategorią jest jednofazowy.
3. Dodaj do title/H1 napięcie 230V (już jest w title, ale nie w H1).

---

#### P1.2 Zaktualizuj lastmod kategorii i wyślij sitemap ponownie
**Dlaczego:** /motoreduktory, /trojfazowe, /jednofazowe mają lastmod 2026-05-24, inne kategorie 2026-06-15. Świeży lastmod + re-submisja sitemap = szybsza recrawl.

**Działania:**
1. W adminie / DB zaktualizuj `updatedAt` w tabeli `categories` dla slugów: `motoreduktory`, `trojfazowe`, `jednofazowe`, `skup-silnikow` (też 2026-05-24).
2. Zdeployuj — backend regeneruje sitemap z nowymi lastmod.
3. W GSC: prześlij ponownie `https://www.silniki-elektryczne.com.pl/sitemap_index.xml`.
4. Ograniczenie: GSC pozwala ~10 URL-i dziennie na żądanie indeksacji — nie używaj bulk request indexing. Sitemap re-submit wystarczy.

---

#### P1.3 Dodaj sekcję „Popularne kategorie / typy” na homepage
**Dlaczego:** homepage ma dużo linków do kategorii, ale brakuje linków do landingów motoreduktorów i stron mocy. Przepływ link juice z homepage jest kluczowy.

**Działania:**
1. W sekcji `quickLinks` w `frontend/src/pages/index.astro` dodaj:
   - `Motoreduktory` → `/motoreduktory`
   - `Silniki 3 kW` → `/silniki-elektryczne-3-kw`
   - `Silniki 5,5 kW` → `/silniki-elektryczne-5-5-kw`
2. W sekcji kategorii (grid) upewnij się, że /motoreduktory, /trojfazowe, /jednofazowe są w pierwszych 4 kafelkach (obecnie są — OK).

---

### P2 — średni priorytet

#### P2.1 Popraw LCP na kategoriach
**Dlaczego:** PSI LCP 3,8–4,8 s. TTFB jest OK, więc problem to obrazy produktów z S3.

**Działania:**
1. Sprawdź, czy wszystkie obrazy kategorii mają `.webp` i odpowiednie srcset (`s3Webp600`, `s3Srcset`).
2. Dla LCP na kategoriach: pierwszy produkt powinien mieć `fetchpriority="high"` i `loading="eager"`, reszta `loading="lazy"`.
3. Rozważ preconnect do `piszemy.com.pl` (obrazy motoreduktorów są na `piszemy.com.pl/products/...`). Obecnie jest tylko preconnect do `s3.eu-north-1.amazonaws.com`.

**Pliki:**
- `frontend/src/components/shop/ProductCard.astro` — lazy/eager.
- `frontend/src/pages/[categorySlug]/index.astro` — eager dla pierwszych produktów.

---

#### P2.2 Ujednolicenie canonical / paginacji
**Dlaczego:** `[categorySlug]/index.astro` ma self-canonical z `?page=N` — OK. Filtry mają `noIndex` — OK.

**Sprawdź:** czy `?page=1` nie jest linkowany (kanonizacja do /category bez ?page=1). Jeśli jest, to duplikat.

---

### P3 — porządki

#### P3.1 Usuń /skup-silnikow z `sitemap-static.xml` (jest duplicate w categories)
**Dlaczego:** `/skup-silnikow` występuje zarówno w sitemap-static.xml, jak i sitemap-categories.xml. Nie jest to błąd krytyczny, ale warto usunąć z static.

**Plik:** `backend/src/routes/sitemap.ts` — usunąć `{ loc: '/skup-silnikow' }` z tablicy `pages` w `/sitemap-static.xml`.

---

## Sekwencja wdrożenia (krok po kroku)

1. **Dziś:**
   - Zaktualizuj `updatedAt` kategorii /motoreduktory, /trojfazowe, /jednofazowe, /skup-silnikow w DB.
   - Zmień title/description homepage (`frontend/src/pages/index.astro`).
   - Zdeployuj (push → main → GitHub Actions).
   - Wyślij sitemap_index.xml ponownie w GSC.

2. **W ciągu 3 dni:**
   - Dodaj podkategorie motoreduktorów w DB (ślimakowe, walcowe, kątowe, do maszynki do mięsa, 230V, z hamulcem).
   - Napisz content do każdej podkategorii (min. 600 słów).
   - Zmień title/description /trojfazowe i rozbuduj opis.

3. **W ciągu tygodnia:**
   - Rozbuduj opis /jednofazowe.
   - Dodaj sekcję „Popularne moce” i „Producenci” na /trojfazowe i /motoreduktory.
   - Dodaj quickLinks na homepage.

4. **W ciągu 2 tygodni:**
   - Optymalizacja LCP (eager load pierwszych obrazów, preconnect).
   - Usuń duplicate /skup-silnikow z sitemap-static.xml.

---

## Oczekiwany efekt

- /motoreduktory: wzrost pozycji z 21 → 8–12 na „motoreduktory” w ciągu 4–8 tygodni po dodaniu landingów.
- /trojfazowe: pojawienie się w top 10–15 na „silniki trójfazowe”.
- /jednofazowe: wzrost CTR i pozycji na „silniki jednofazowe” z 7,9 → 4–6.
- Homepage: wzrost CTR z 1,75% → 2,5%+, co przy obecnych impressions to +40 klików/28 dni.

---

## Ograniczenia / ryzyka

- Nie mam bezpośredniego dostępu do prod DB — wszystkie zmiany DB musisz wykonać przez admin panel lub bezpośrednio na PostgreSQL.
- Skill `seo-audit-onsite` nie uruchomił się automatycznie; powyższy plan oparty jest na danych z GA4/GSC API, live crawl, PSI i repo.
- GSC re-indexing wymaga czasu; efekty SEO po wdrożeniu treści mogą być widoczne po 2–6 tygodniach.
