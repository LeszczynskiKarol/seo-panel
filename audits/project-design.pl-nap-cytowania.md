# Cytowania lokalne NAP — project-design.pl

**Data:** 2026-07-26
**Po co to:** przy DA 4 i profilu linków złożonym z dwóch własnych domen cytowania lokalne
są jedyną realistyczną drogą do widoczności w pakiecie lokalnym Google. Warunek: **dane muszą
być identyczne co do znaku** w każdym miejscu. Cytowanie z rozjechanym adresem szkodzi bardziej,
niż pomaga — Google nie skleja wtedy encji, tylko widzi dwa różne podmioty.

---

## ⚠ Najpierw rozstrzygnij: masz TRZY różne adresy w obiegu

To wyszło przy sprawdzaniu, gdzie firma już figuruje. Zanim zgłosisz cokolwiek gdziekolwiek,
trzeba to uporządkować — inaczej rozsiejesz niespójność po kilkunastu serwisach.

| Źródło | Adres | Telefon |
|---|---|---|
| **CEIDG** (rejestr, NIP 9562111620) | `ul. Wincentego Witosa 4g/79, 87-100 Toruń` | `736 870 687` |
| Witryna do 2026-07-26 | `ul. Polna 134, hala nr 3, 87-100 Toruń` | `576 060 832` |
| **Witryna od 2026-07-26** (Twoja dzisiejsza decyzja) | `ul. Stefana Batorego 92F, 87-100 Toruń` | `576 060 832` |

Adres z CEIDG potwierdzony dwoma niezależnymi źródłami, które ciągną dane wprost z rejestru:
[ALEO.com](https://aleo.com/pl/firma/jacek-wichowski-msystem-torun) i
[owg.pl](https://www.owg.pl/ceidg/jacek_wichowski_msystem_9,74,956211,9562111620).
Format `4g/79` wygląda na mieszkanie, więc to najpewniej adres rejestrowy/do doręczeń, a nie
miejsce obsługi klienta. To normalne i legalne — działalność bywa zarejestrowana pod adresem
zamieszkania, a prowadzona w hali czy showroomie.

**Ale ma to dwie konsekwencje, których nie da się zignorować:**

**1. Dokumenty prawne.** `regulamin.astro` i `polityka-prywatnosci.astro` deklarują:
> „Administratorem Serwisu jest: MSystem Jacek Wichowski, ul. Stefana Batorego 92F, 87-100 Toruń,
> NIP: 956-211-16-20"

Ustawa o świadczeniu usług drogą elektroniczną wymaga podania prawdziwego adresu usługodawcy.
Jeśli w CEIDG widnieje Witosa 4g/79, a dokumenty mówią Batorego 92F, warto albo dopisać adres
Batorego jako **dodatkowe stałe miejsce wykonywania działalności w CEIDG** (bezpłatne, przez
biznes.gov.pl), albo podać w dokumentach oba: siedzibę z rejestru i adres korespondencyjny.
To kwestia do rozstrzygnięcia z księgowością, nie SEO — sygnalizuję, bo dziś zmieniłem tam adres
na Twoje polecenie i nie chcę, żeby to przeszło niezauważone.

**2. Agregatory same ciągną CEIDG.** ALEO, owg.pl i GoWork już opublikowały Witosa 4g/79 —
nikt ich o to nie prosił. Będą to robić dalej i nie da się tego „naprawić" u źródła inaczej niż
zmianą wpisu w CEIDG. Dlatego: **cytowania, na których Ci zależy (GBP, katalogi branżowe, portale
lokalne), buduj na adresie obsługi klienta — Batorego 92F.** Wpisy rejestrowe z Witosa traktuj
jako osobną, techniczną warstwę; Google sobie z tym radzi, dopóki adres *klientowski* jest spójny.

---

## Wzorzec NAP — kopiuj to i tylko to

Każde pole dokładnie w tej formie. Bez skrótów, bez zamiany „ul." na „Ulica", bez dopisywania
„Sp. z o.o.", bez wariantów typu „ProjectDesign".

```
Nazwa:      Project Design
Adres:      ul. Stefana Batorego 92F
Kod:        87-100
Miasto:     Toruń
Wojewodztwo: kujawsko-pomorskie
Telefon:    +48 576 060 832
E-mail:     kontakt@project-design.pl
WWW:        https://www.project-design.pl
Kategoria:  Projektant wnętrz / Architekt wnętrz
Godziny:    pon-pt 07:00-16:30, sob-ndz zamkniete
NIP:        956-211-16-20
```

Zgodne z tym, co od dziś siedzi w JSON-LD na stronie (`InteriorDesignBusiness`), w `Contact.astro`
i w dokumentach prawnych. Jeśli zmienisz cokolwiek w jednym miejscu, zmień wszędzie.

**Opis firmy** (do pól „o firmie"; pierwsze zdanie zawiera frazę + miasto, bo część katalogów
wycina opis po ~160 znakach):

> Project Design to studio projektowania wnętrz w Toruniu. Projektujemy wnętrza mieszkań, domów
> jednorodzinnych, biur i lokali użytkowych — od koncepcji i wizualizacji 3D, przez dokumentację
> wykonawczą, po nadzór nad realizacją. Wykonujemy również meble na wymiar: kuchnie, szafy,
> garderoby i zabudowy wnęk. Obsługujemy Toruń i okolice.

---

## Co już jest w sieci — stan na 2026-07-26

### Do poprawienia

| Gdzie | Problem | Co zrobić |
|---|---|---|
| [GoWork.pl](https://www.gowork.pl/jacek-wichowski-msystem,24861558/dane-kontaktowe-firmy) | Firma opisana jako **warszawska** („Jacek Wichowski Msystem **Warszawa**"), mimo że to Toruń | Zgłoś korektę danych — strona rankuje na nazwę firmy, a wskazuje złe miasto |
| [torunnadloni.pl](https://torunnadloni.pl/firmy/projektanci-wnetrz) | Wpis **zniknął** — kategoria zwraca **404**, choć Google trzyma ją w indeksie. Był to jedyny lokalny link tematyczny (nofollow, anchor „strona www") | Zgłoś firmę ponownie |
| ALEO / owg.pl | Adres rejestrowy Witosa 4g/79 | Zostaw — to odbicie CEIDG, nie da się zmienić inaczej niż w rejestrze |

### Już działa

[rankingpro.pl](https://rankingpro.pl/ranking-projektantow-wnetrz-torun/) — „Project Design"
figuruje w rankingu projektantów wnętrz w Toruniu, z aktywnym odnośnikiem do
`https://project-design.pl` i oceną 4,8/5. **Ale to nie jest cytowanie NAP** — nie podano ani
adresu, ani telefonu. Wartość: link, nie sygnał lokalny.

Uwaga: link prowadzi na `project-design.pl` bez `www`, czyli przez przekierowanie 301. Działa,
ale przy okazji kontaktu z redakcją warto poprosić o podmianę na `https://www.project-design.pl/`
oraz **o dopisanie adresu i telefonu** — wtedy z linku zrobi się pełne cytowanie.

### Czego nie ma nigdzie

Nie znalazłem **ani jednego** miejsca w sieci, gdzie marka „Project Design" występuje razem
z pełnym kompletem NAP. Wszystko, co istnieje, to albo wpisy rejestrowe pod nazwą
„Jacek Wichowski Msystem" z adresem z CEIDG, albo wzmianki o marce bez danych kontaktowych.
To znaczy, że budujesz cytowania praktycznie od zera — ale też, że nie musisz się mocować
z prostowaniem dziesiątek starych, rozjechanych wpisów. Dobry moment.

---

## Kolejność zgłoszeń

Robione w tej kolejności, bo część katalogów zaciąga dane z Google, a nie odwrotnie —
GBP zrobione najpierw oszczędza późniejsze prostowanie.

### Priorytet 0 — Google Business Profile

Ważniejszy niż cała reszta listy razem wzięta. Dla firmy usługowej działającej w jednym mieście
to podstawowy mechanizm widoczności lokalnej.

- adres i pinezka: **Batorego 92F** (współrzędne w JSON-LD: `53.03906, 18.62219` — jeśli pinezka
  w GBP stanie gdzie indziej, podmień wartość w `src/components/SEO.astro`, nie odwrotnie)
- kategoria główna: **Projektant wnętrz**; dodatkowe: *Architekt wnętrz*, *Producent mebli na wymiar*
- godziny: pon-pt 07:00-16:30
- zdjęcia: masz 18 realizacji na CDN, część w wariantach 1600w — gotowy materiał
- w polu „strona internetowa": `https://www.project-design.pl/` (z `www` i ukośnikiem — dokładnie
  ta wersja jest kanoniczna)

### Priorytet 1 — katalogi z realnym ruchem i zapytaniami ofertowymi

| Serwis | Dlaczego | Uwagi |
|---|---|---|
| **oferteo.pl** | Rankuje na „architekt wnętrz Toruń" i „aranżacja wnętrz Toruń" — czyli dokładnie na Twoje frazy z GSC | Generuje realne zapytania ofertowe, nie tylko link |
| **homebook.pl** | Branżowy, ma osobną kategorię specjalistów dla Torunia | Silnie tematyczny, wysoka wartość dla encji |
| **fixly.pl** | Zapytania ofertowe od klientów | Model podobny do Oferteo |

Te trzy dają jednocześnie cytowanie NAP **i** kanał pozyskania klienta — dlatego przed czysto
katalogowymi.

### Priorytet 2 — katalogi ogólnopolskie

`panoramafirm.pl`, `pkt.pl`, `firmy.net`, `aleo.com` (wpis firmowy uzupełniony ręcznie, obok
automatycznego z CEIDG), `bazafirm.pl`.

Tu chodzi wyłącznie o spójny sygnał NAP. Nie oczekuj z nich ruchu.

### Priorytet 3 — lokalne toruńskie

`torunnadloni.pl` (ponowne zgłoszenie), katalog firm na `torun.pl`, `nowosci.com.pl`,
lokalne grupy na Facebooku dotyczące budowy i remontów w Toruniu.

### Priorytet 4 — powiązania, które już masz

W stopce witryny jest: „Realizacja projektów: **Meble Toruń — Meble System**"
(`Footer.astro:35`, link do `meblesystem.pl`). To link **wychodzący**. Sprawdź, czy
`meblesystem.pl` odsyła zwrotnie do `project-design.pl` — to najbardziej naturalny tematycznie
link, jaki możesz zdobyć, a obie firmy są powiązane osobą właściciela.

Podobnie `prfinterior.pl` (profil Doroty Stefańskiej, odpowiada 200) — dziś linkujesz tam
jednostronnie z sekcji zespołu.

---

## Czego nie zrobię za Ciebie i dlaczego

Zgłoszenia do katalogów wymagają założenia konta, potwierdzenia adresu e-mail lub telefonu SMS-em
i zaakceptowania regulaminu **w imieniu Twojej firmy**. To zobowiązania w imieniu podmiotu
gospodarczego wobec zewnętrznych serwisów — nie są to działania, które powinienem podejmować
samodzielnie, nawet gdyby były technicznie wykonalne. Weryfikacja GBP dodatkowo idzie kartą
pocztową albo telefonem na numer firmy.

Co mogę zrobić dalej, jeśli chcesz:
- przygotować gotowe teksty do formularzy pod konkretny katalog (limity znaków bywają różne),
- po zgłoszeniach **zweryfikować spójność** — pobrać każdy wpis i porównać NAP znak po znaku
  z wzorcem powyżej, wypisać rozjazdy,
- monitorować, czy wpisy nie zniknęły (jak stało się z torunnadloni.pl).

---

## Weryfikacja po zgłoszeniach

Gdy będziesz mieć wpisy, uruchom to — porówna dane w serwisach z wzorcem:

```powershell
# lista URL-i wpisow do sprawdzenia
$wpisy = @(
  "https://www.oferteo.pl/...",
  "https://www.homebook.pl/..."
)
$wzorzec = @{
  telefon = "576 060 832"
  ulica   = "Batorego 92F"
  kod     = "87-100"
}
foreach ($u in $wpisy) {
  $html = (Invoke-WebRequest -Uri $u -UseBasicParsing -UserAgent "Mozilla/5.0").Content
  $brak = $wzorzec.GetEnumerator() | Where-Object { $html -notmatch [regex]::Escape($_.Value) }
  if ($brak) { "ROZJAZD $u -> brakuje: " + (($brak | ForEach-Object { $_.Key }) -join ', ') }
  else { "OK $u" }
}
```

Napisz, kiedy będziesz mieć pierwsze wpisy — podmienię listę URL-i i puszczę sprawdzenie.
