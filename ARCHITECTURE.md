# SEO Command Center — Architecture

## Overview
Centralny panel analityczny SEO dla wszystkich domen Karola. Łączy dane z Google Search Console, Google Indexing API, crawl linków wewnętrznych/zewnętrznych, i statusów indeksowania w jeden dashboard.

## Stack
- **Backend**: Fastify + Prisma + PostgreSQL
- **Frontend**: React + Vite + Tailwind + Recharts
- **Jobs**: node-cron (GSC pull, link crawl, indexing check)
- **Auth**: JWT (single admin user)

## Data Sources
1. **Google Search Console API** — clicks, impressions, CTR, position per page per day
2. **Google Indexing API** — URL inspection (verdict, coverage state, crawl time)
3. **Link Crawler** — internal/external links per page, broken links, orphan pages
4. **Sitemap Parser** — current URLs from sitemaps (all formats: index, flat, underscore)
5. **Existing DynamoDB** — read-only, for backward compatibility with Lambda dashboard

## Cron Jobs
- **Daily 06:00** — Pull GSC data for all domains (yesterday's stats)
- **Daily 07:00** — Crawl sitemaps, detect new/removed URLs
- **Weekly Sunday 03:00** — Full link crawl (internal + external)
- **On demand** — URL inspection via Google API

## Key Features
- Per-domain overview with indexing %, traffic trends
- Drill-down per page: GSC metrics + indexing status + links
- Internal link graph: orphan pages, link equity distribution
- External link audit: broken outbound links
- Historical trends: position/traffic over time
- Alerts: deindexed pages, traffic drops, broken links
- Cross-domain link map (satellite sites → main domains)

## API Endpoints

### Domains
- GET /api/domains — list all domains with summary stats
- POST /api/domains — add domain
- DELETE /api/domains/:id — remove domain

### Pages
- GET /api/domains/:id/pages — pages with GSC metrics + indexing status
- GET /api/pages/:id — single page detail (metrics, links, history)
- GET /api/pages/:id/history — daily GSC metrics history

### GSC
- POST /api/gsc/pull — trigger manual GSC data pull
- GET /api/gsc/overview — aggregate metrics across all domains

### Indexing
- POST /api/indexing/check — trigger URL inspection
- POST /api/indexing/submit — submit URL to Google
- GET /api/indexing/status — overview of indexing across domains

### Links
- GET /api/domains/:id/links — internal/external links
- GET /api/domains/:id/broken-links — broken outbound links
- GET /api/domains/:id/orphan-pages — pages with no inbound internal links
- POST /api/links/crawl — trigger link crawl

### Alerts
- GET /api/alerts — recent alerts (deindexed, traffic drop, broken links)

## Deployment
- Local development first
- Later: EC2 (existing instance or new t3.micro)
- PostgreSQL: local → later RDS or same EC2
