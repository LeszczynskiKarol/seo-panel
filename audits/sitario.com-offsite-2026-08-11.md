# Audyt off-site: sitario.com — 2026-08-11 (baseline)

**Kontekst**: domena w seo-panelu od 2026-07-10 (~1 miesiąc). Pierwszy raport off-site — traktować jako punkt odniesienia, nie diagnozę problemów. Źródła: Moz Links API (świeży odczyt url_metrics 2026-08-11 + snapshoty backlinków z bazy seo_panel z 2026-08-09), GSC (sc-domain:sitario.com, 2026-07-10 → 2026-08-10), web recon.

## 1. Metryki Moz (2026-08-11, świeże)

| Metryka | Wartość | Komentarz |
|---|---|---|
| Domain Authority | **2** | Normalne dla 1-miesięcznej domeny |
| Page Authority (strona główna) | 19 | Zawyżone przez linki spamowe |
| Spam Score | -1 (brak danych) | Za mało danych, by Moz policzył |
| Zewn. strony linkujące (root domain) | 58 | z czego **40 nofollow** |
| Linkujące domeny | 18 | praktycznie w całości śmieciowe |
| Usunięte linki (deleted pages) | 118 | duży churn — linki spamowe znikają |
| Link propensity | 0.088 | — |
| Anchor text | tylko „sitario.com" (13 stron / 2 domeny) | zero anchorów brandowych słownych i keywordowych |

Uwaga techniczna: Moz widzi `sitario.com/` jako **301** (redirect na www) — poprawne, ale metryki PA liczone są na URL-u przekierowującym.

## 2. Profil backlinków — jakość

**Nie ma ani jednego prawdziwego, zapracowanego linku.** Cały profil to automatyczny szum, który dostaje każda świeżo zarejestrowana domena:

- Skracarki/spam „domain stats": quero.party (DA 27, spam 4), drjack.world (21/4), blinks.monster (18/**40**), wants.cfd (15/**47**), zhanhao.online (12/**61**), vickys.design (11/**80**), backlink.wiki, blogsphere.top, toplikevideo.com…
- Większość już martwa (`isLive=false`) — stąd 118 deleted pages.
- **Nie ma czego disavowować** — przy tej skali Google to ignoruje. Nie ruszać.

## 3. Widoczność w Google (GSC, pierwszy miesiąc)

- **~13 kliknięć, ~660 wyświetleń** łącznie; Polska dominuje (11 kliknięć / 259 wyświetleń), reszta to długi ogon z bloga EN.
- Trend wyświetleń rosnący: ~5–10/dzień na starcie → ~20–40/dzień na początku sierpnia. Normalna krzywa wczesnej indeksacji.
- **Brand „sitario": 73 wyświetlenia, śr. pozycja 3,3, tylko 2 kliknięcia.** Sitario **nie jest jeszcze właścicielem własnego brand SERP-a** — wyprzedzają go m.in. utwory „Sitario" na Spotify/YouTube i słownikowe wyniki „sitario" (SpanishDict).
- Realne zapytania niebrandowe: rodzina „how long does it take to build a website" (blog EN, pozycje 48–98), pojedyncze PL. (Zapytania z operatorami `-site:` w GSC to własny rank-tracker seo-panelu — ignorować w analizie.)

## 4. Obecność marki poza Google

- WebSearch dla `"sitario.com"` → **zero wyników o projekcie**. Brand SERP okupują utwory muzyczne „Sitario" i SpanishDict.
- Konkurencyjny SERP „strona w abonamencie": sitte.pl, najszybsza.pl, arenastron.pl, home.pl, webwave — nisza z wyraźnym, przebijalnym zestawem konkurentów (w odróżnieniu od „kreator stron").
- Profile social istnieją: Facebook (`sitariowebsitecreator`), Instagram (`sitario_com`), TikTok (`@sitario_com`) — zasilane automatem. Brak: LinkedIn, YouTube, X.

## 5. Priorytety off-site (P0 → P3)

**P0 — przejąć brand SERP „sitario"**
Najtańsza wygrana: doprowadzić do zaindeksowania profili social + kilku wpisów katalogowych, żeby wyniki 1–5 dla „sitario" należały do projektu. Wesprzeć od strony on-site schematem `Organization` + `sameAs` (linki do FB/IG/TikTok). Rozważyć profil LinkedIn (firmy B2B sprawdzają) — nawet pusty zajmuje miejsce w SERP-ie.

**P1 — pierwsze prawdziwe linki (katalogi, 0 zł)**
- PL: katalogi firm (panorama firm, Aleo, ALEO/KRS-owe), mapy Google (GBP!), opineo.
- SaaS/startup: Product Hunt (launch generatora!), BetaList, SaaSHub, AlternativeTo, startup-directories PL (mamstartup, startuppoland).
- Ostrożny cross-link z własnego portfolio domen (1–2 kontekstowe wzmianki, nie sitewide footer — footprint).

**P2 — content jako magnes**
Blog EN już łapie wyświetlenia na „how long does it take to build a website" — to potencjalne linkable assets. Po zbudowaniu DA > 10 dopiero digital PR / guest posty.

**P3 — monitoring**
Cron Moz w seo-panelu już synchronizuje — wystarczy. Kolejny raport off-site sensowny za ~3 miesiące (2026-11), wcześniej metryki się nie ruszą.

## 6. Notatka strategiczna: pozycjonowanie „strona w abonamencie" vs generator

Rekomendacja: **główna strona = „strona w abonamencie", generator = osobny landing**. Uzasadnienie w rozmowie z 2026-08-11; skrót:
- „kreator stron" to SERP zdominowany przez WebWave/home.pl/Wix — nie do ruszenia z DA 2.
- „strona w abonamencie" ma jasny, słabszy zestaw konkurentów i klienta o wyższym LTV (done-for-you, nie DIY).
- Model biznesowy sitario (domeny, hosting, ads, autoblog, retencja) to abonamentowa obsługa — generator jest jedną z funkcji.
- Test przekazu nie organicznie (za mało ruchu na A/B), tylko przez Google Ads na kliencie dogfoodingowym `SIT-SITARIOADS-01`: dwie grupy reklam → dwa landingi.
