# SEO Command Center

Centralny panel analityczny SEO dla wszystkich domen. Łączy dane z Google Search Console, Google Indexing API, crawl linków i statusów indeksowania.

## Quick Start (lokalnie)

### 1. Baza danych PostgreSQL

```bash
# Jeśli nie masz PostgreSQL lokalnie:
docker run -d --name seo-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=seo_panel -p 5432:5432 postgres:16

# Albo użyj istniejącego PostgreSQL i utwórz bazę:
createdb seo_panel
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edytuj .env — ustaw DATABASE_URL i ścieżkę do Google SA key

npm install
npx prisma db push
npx prisma generate
npm run db:seed    # załaduje 20 Twoich domen
npm run dev        # → http://localhost:5555
```

### 3. Google Service Account Key

Skopiuj swój plik `ageless-period-491209-s8-49244dd0a1f5.json` do `backend/google-sa-key.json`.

Lub ustaw w `.env`:
```
GOOGLE_PRIVATE_KEY_PATH=./google-sa-key.json
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev   # → http://localhost:5173
```

## Co robi system

### Automatyczne joby (cron)
- **06:00** — Pull danych z Google Search Console (kliknięcia, wyświetlenia, pozycje)
- **07:00** — Sync sitemap (wykrywa nowe/usunięte strony)
- **08:00** — Sprawdzanie indeksowania (URL Inspection API)
- **Niedziela 03:00** — Crawl linków (wewnętrzne, zewnętrzne, złamane)

### Dashboard
- Przegląd wszystkich domen: indeksowanie %, traffic, alerty
- Per-domena: strony, zapytania GSC, złamane linki, orphan pages
- Wykresy traffic (clicks/impressions) per domena i globalnie
- System alertów: deindeksacja, spadek ruchu, złamane linki

### API Endpoints
- `GET /api/overview` — globalne statystyki
- `GET /api/domains` — lista domen
- `GET /api/domains/:id` — szczegóły domeny + wykres + alerty
- `GET /api/domains/:id/pages` — strony z filtrami
- `GET /api/domains/:id/queries` — top zapytania GSC
- `GET /api/domains/:id/broken-links` — złamane linki
- `GET /api/domains/:id/orphan-pages` — strony bez linków wewnętrznych
- `POST /api/domains/:id/sync-sitemap` — sync sitemap
- `POST /api/domains/:id/pull-gsc` — pull danych GSC
- `POST /api/domains/:id/check-indexing` — sprawdź indeksowanie
- `POST /api/domains/:id/crawl-links` — crawl linków
- `GET /api/alerts` — lista alertów
- `PATCH /api/alerts/:id/resolve` — rozwiąż alert

## Stack
- Backend: Fastify + Prisma + PostgreSQL
- Frontend: React + Vite + Tailwind + Recharts + TanStack Query
- Auth: Google Service Account (ten sam co do Indexing API)
- Scheduler: node-cron
