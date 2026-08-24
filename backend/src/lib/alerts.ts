import { prisma } from "./prisma.js";

/**
 * Wylacznik alertow.
 *
 * 2026-08-24 Karol: "alerty i tak z nich nie korzystam, zeby JUZ NIGDY nie
 * byly generowane". Tabela Alert zostala oprozniona (10 366 wierszy, backup
 * w /var/backups/seo-panel/seo-panel-Alert-2026-08-24.sql.gz na panelu),
 * a cron cross-source detection (09:30) zakomentowany w scheduler.ts.
 *
 * Sam cron to bylo jednak za malo: alerty tworzy takze piec innych miejsc,
 * siedzacych w jobach ZBIERAJACYCH DANE, ktore zostaja wlaczone
 * (sitemap_sync 07:00, indexing_check 08:00, link_crawl 03:00). Bez tego
 * wylacznika tabela zapelnialaby sie z powrotem juz nastepnej nocy.
 *
 * Zapisy sa pomijane, ale cala reszta logiki tych jobow dziala bez zmian -
 * to celowo no-op, a nie usuniecie kodu, zeby dalo sie wrocic jednym env.
 * Wlaczenie z powrotem: SEO_PANEL_ALERTS=1 w srodowisku procesu.
 */
export const ALERTS_ENABLED = process.env.SEO_PANEL_ALERTS === "1";

type AlertCreateArgs = Parameters<typeof prisma.alert.create>[0];

export async function writeAlert(args: AlertCreateArgs) {
  if (!ALERTS_ENABLED) return null;
  return prisma.alert.create(args);
}
