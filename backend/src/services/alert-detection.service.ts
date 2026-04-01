// backend/src/services/alert-detection.service.ts
// v2 — concrete dates, richer descriptions, expandable detail data in JSON

import { prisma } from "../lib/prisma.js";
import type { AlertType, AlertSeverity } from "@prisma/client";

// Helper: safe alert creation with type casting
// If PAGE_INDEXED gives TS errors, run: npx prisma generate
async function createAlert(data: {
  domainId: string;
  pageId?: string;
  type: string;
  severity: string;
  title: string;
  description?: string;
  metadata?: any;
}) {
  return prisma.alert.create({
    data: {
      domainId: data.domainId,
      pageId: data.pageId || undefined,
      type: data.type as AlertType,
      severity: (data.severity || "MEDIUM") as AlertSeverity,
      title: data.title,
      description: data.description,
    },
  });
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0]; // 2026-03-23
}

function fmtDatePL(d: Date): string {
  return d.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function dateRange(daysAgo: number): {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
} {
  const end = new Date();
  const start = new Date(Date.now() - daysAgo * 86400000);
  return { start, end, startStr: fmtDate(start), endStr: fmtDate(end) };
}

export class AlertDetectionService {
  async detectAll(): Promise<{ created: number; checks: string[] }> {
    const domains = await prisma.domain.findMany({
      where: { isActive: true },
      include: {
        integrations: { where: { status: "ACTIVE" } },
      },
    });

    let created = 0;
    const checks: string[] = [];

    for (const domain of domains) {
      // Indexing: newly indexed
      const indexed = await this.detectNewlyIndexed(domain.id);
      created += indexed;
      if (indexed > 0)
        checks.push(
          `${domain.label || domain.domain}: ${indexed} nowo zaindeksowanych`,
        );

      // GSC: traffic drop
      const trafficDrop = await this.detectTrafficDrop(domain.id);
      created += trafficDrop;

      // GSC: position drops
      const positionDrop = await this.detectPositionDrops(domain.id);
      created += positionDrop;

      // Moz: backlink changes
      if (domain.mozLastSync) {
        const blAlerts = await this.detectBacklinkChanges(domain.id);
        created += blAlerts;
      }

      // Moz: DA change
      if (domain.mozDA != null) {
        const daAlert = await this.detectDAChange(domain.id, domain.mozDA);
        created += daAlert;
      }

      // GA4: conversion/revenue anomalies
      const ga4Int = domain.integrations.find(
        (i) => i.provider === "GOOGLE_ANALYTICS",
      );
      if (ga4Int) {
        const ga4Alerts = await this.detectGA4Anomalies(domain.id, ga4Int.id);
        created += ga4Alerts;
      }

      // Merchant: disapprovals
      const merchantInt = domain.integrations.find(
        (i) => i.provider === "GOOGLE_MERCHANT",
      );
      if (merchantInt) {
        const merchantAlerts = await this.detectMerchantIssues(
          domain.id,
          merchantInt,
        );
        created += merchantAlerts;
      }
    }

    return { created, checks };
  }

  // ═══════════════════════════════════════════════════════════
  // INDEXING: Detect newly indexed pages
  // ═══════════════════════════════════════════════════════════
  private async detectNewlyIndexed(domainId: string): Promise<number> {
    const yesterday = new Date(Date.now() - 86400000);

    const newlyIndexed = await prisma.page.findMany({
      where: {
        domainId,
        indexingVerdict: "PASS",
        statusChangedAt: { gte: yesterday },
        previousVerdict: { in: ["UNCHECKED", "NEUTRAL", "FAIL", "UNKNOWN"] },
      },
      select: { id: true, path: true, previousVerdict: true },
    });

    let created = 0;
    for (const page of newlyIndexed) {
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          pageId: page.id,
          type: "PAGE_INDEXED" as AlertType,
          createdAt: { gte: yesterday },
        },
      });
      if (existing) continue;

      await createAlert({
        domainId,
        pageId: page.id,
        type: "PAGE_INDEXED",
        severity: "LOW",
        title: `Strona zaindeksowana: ${page.path}`,
        description: `Zmiana statusu ${page.previousVerdict} → PASS. Wykryto: ${fmtDatePL(new Date())}`,
      });
      created++;
    }
    return created;
  }

  // ═══════════════════════════════════════════════════════════
  // GSC: Traffic drop — with concrete date ranges
  // ═══════════════════════════════════════════════════════════
  private async detectTrafficDrop(domainId: string): Promise<number> {
    const recent = dateRange(7);
    const prev = {
      start: new Date(Date.now() - 14 * 86400000),
      end: new Date(Date.now() - 7 * 86400000),
    };

    const [recentAgg, prevAgg] = await Promise.all([
      prisma.gscDomainDaily.aggregate({
        where: { domainId, date: { gte: recent.start } },
        _sum: { clicks: true },
      }),
      prisma.gscDomainDaily.aggregate({
        where: { domainId, date: { gte: prev.start, lt: prev.end } },
        _sum: { clicks: true },
      }),
    ]);

    const recentClicks = recentAgg._sum.clicks || 0;
    const prevClicks = prevAgg._sum.clicks || 0;

    if (prevClicks > 20 && recentClicks < prevClicks * 0.7) {
      const dropPct = Math.round(
        ((prevClicks - recentClicks) / prevClicks) * 100,
      );

      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "TRAFFIC_DROP" as AlertType,
          createdAt: { gte: recent.start },
          isResolved: false,
        },
      });

      if (!existing) {
        // Find top pages that lost traffic
        const recentPages = await prisma.gscPageDaily.groupBy({
          by: ["pageId"],
          where: { page: { domainId }, date: { gte: recent.start } },
          _sum: { clicks: true },
        });
        const prevPages = await prisma.gscPageDaily.groupBy({
          by: ["pageId"],
          where: {
            page: { domainId },
            date: { gte: prev.start, lt: prev.end },
          },
          _sum: { clicks: true },
        });

        const prevMap = new Map(
          prevPages.map((p) => [p.pageId, p._sum.clicks || 0]),
        );
        const losers: {
          pageId: string;
          prevClicks: number;
          currClicks: number;
          drop: number;
        }[] = [];

        for (const rp of recentPages) {
          const prevC = prevMap.get(rp.pageId) || 0;
          const currC = rp._sum.clicks || 0;
          if (prevC > 3 && currC < prevC * 0.5) {
            losers.push({
              pageId: rp.pageId,
              prevClicks: prevC,
              currClicks: currC,
              drop: prevC - currC,
            });
          }
        }
        losers.sort((a, b) => b.drop - a.drop);

        // Get paths for top losers
        const topLoserIds = losers.slice(0, 5).map((l) => l.pageId);
        const loserPages = await prisma.page.findMany({
          where: { id: { in: topLoserIds } },
          select: { id: true, path: true },
        });
        const pathMap = new Map(loserPages.map((p) => [p.id, p.path]));

        const loserDetails = losers
          .slice(0, 5)
          .map(
            (l) =>
              `${pathMap.get(l.pageId) || "?"}: ${l.prevClicks} → ${l.currClicks} (−${l.drop})`,
          )
          .join("\n");

        const recentStr = `${fmtDatePL(recent.start)}–${fmtDatePL(recent.end)}`;
        const prevStr = `${fmtDatePL(prev.start)}–${fmtDatePL(prev.end)}`;

        await createAlert({
          domainId,
          type: "TRAFFIC_DROP",
          severity: dropPct > 50 ? "HIGH" : "MEDIUM",
          title: `Spadek ruchu o ${dropPct}%`,
          description: [
            `Okres bieżący (${recentStr}): ${recentClicks} kliknięć`,
            `Okres poprzedni (${prevStr}): ${prevClicks} kliknięć`,
            `Spadek: −${dropPct}% (${prevClicks - recentClicks} kliknięć mniej)`,
            loserDetails ? `\nNajwiększe spadki:\n${loserDetails}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        });
        return 1;
      }
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════════
  // GSC: Position drops — with concrete dates + affected pages
  // ═══════════════════════════════════════════════════════════
  private async detectPositionDrops(domainId: string): Promise<number> {
    const recent = dateRange(7);
    const prev = {
      start: new Date(Date.now() - 14 * 86400000),
      end: new Date(Date.now() - 7 * 86400000),
    };

    const recentData = await prisma.gscPageDaily.groupBy({
      by: ["pageId"],
      where: { page: { domainId }, date: { gte: recent.start } },
      _avg: { position: true },
      _sum: { clicks: true },
    });

    const prevData = await prisma.gscPageDaily.groupBy({
      by: ["pageId"],
      where: { page: { domainId }, date: { gte: prev.start, lt: prev.end } },
      _avg: { position: true },
    });

    const prevMap = new Map(prevData.map((r) => [r.pageId, r._avg.position]));
    let created = 0;

    for (const r of recentData) {
      const prevPos = prevMap.get(r.pageId);
      const currPos = r._avg.position;
      if (!prevPos || !currPos) continue;
      if ((r._sum.clicks || 0) < 5) continue;

      const drop = currPos - prevPos;
      if (drop >= 5) {
        const existing = await prisma.alert.findFirst({
          where: {
            domainId,
            pageId: r.pageId,
            type: "POSITION_DROP" as AlertType,
            createdAt: { gte: recent.start },
            isResolved: false,
          },
        });
        if (!existing) {
          const page = await prisma.page.findUnique({
            where: { id: r.pageId },
            select: { path: true },
          });

          const recentStr = `${fmtDatePL(recent.start)}–${fmtDatePL(recent.end)}`;
          const prevStr = `${fmtDatePL(prev.start)}–${fmtDatePL(prev.end)}`;

          await createAlert({
            domainId,
            pageId: r.pageId,
            type: "POSITION_DROP",
            severity: drop >= 10 ? "HIGH" : "MEDIUM",
            title: `Pozycja spadła o ${drop.toFixed(1)} — ${page?.path || "?"}`,
            description: [
              `Okres bieżący (${recentStr}): pozycja ${currPos.toFixed(1)}`,
              `Okres poprzedni (${prevStr}): pozycja ${prevPos.toFixed(1)}`,
              `Zmiana: +${drop.toFixed(1)} pozycji (gorzej)`,
            ].join("\n"),
          });
          created++;
        }
      }
    }
    return created;
  }

  // ═══════════════════════════════════════════════════════════
  // MOZ: Backlink changes — with specific domains
  // ═══════════════════════════════════════════════════════════
  private async detectBacklinkChanges(domainId: string): Promise<number> {
    const yesterday = new Date(Date.now() - 86400000);
    let created = 0;

    // New high-DA backlinks
    const newBacklinks = await prisma.backlinkSnapshot.findMany({
      where: {
        domainId,
        firstSeen: { gte: yesterday },
        isLive: true,
        mozSourceDA: { gte: 30 },
      },
      select: {
        id: true,
        sourceDomain: true,
        sourceUrl: true,
        targetUrl: true,
        mozSourceDA: true,
        anchorText: true,
      },
    });

    for (const bl of newBacklinks) {
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "BACKLINK_NEW" as AlertType,
          description: { contains: bl.sourceDomain },
          createdAt: { gte: yesterday },
        },
      });
      if (!existing) {
        await createAlert({
          domainId,
          type: "BACKLINK_NEW",
          severity: (bl.mozSourceDA || 0) >= 50 ? "MEDIUM" : "LOW",
          title: `Nowy backlink z ${bl.sourceDomain} (DA ${bl.mozSourceDA?.toFixed(0)})`,
          description: [
            `Źródło: ${bl.sourceUrl}`,
            `Cel: ${bl.targetUrl}`,
            bl.anchorText ? `Anchor: "${bl.anchorText}"` : null,
            `DA źródła: ${bl.mozSourceDA?.toFixed(0)}`,
            `Wykryto: ${fmtDatePL(new Date())}`,
          ]
            .filter(Boolean)
            .join("\n"),
        });
        created++;
      }
    }

    // Lost backlinks
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    const lostBacklinks = await prisma.backlinkSnapshot.findMany({
      where: {
        domainId,
        isLive: false,
        lostAt: { gte: twoDaysAgo },
        mozSourceDA: { gte: 20 },
      },
      select: {
        id: true,
        sourceDomain: true,
        sourceUrl: true,
        targetUrl: true,
        mozSourceDA: true,
      },
    });

    for (const bl of lostBacklinks) {
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "BACKLINK_LOST" as AlertType,
          description: { contains: bl.sourceDomain },
          createdAt: { gte: twoDaysAgo },
        },
      });
      if (!existing) {
        await createAlert({
          domainId,
          type: "BACKLINK_LOST",
          severity: (bl.mozSourceDA || 0) >= 40 ? "HIGH" : "MEDIUM",
          title: `Utracony backlink z ${bl.sourceDomain} (DA ${bl.mozSourceDA?.toFixed(0)})`,
          description: [
            `Źródło: ${bl.sourceUrl}`,
            `Cel: ${bl.targetUrl}`,
            `DA źródła: ${bl.mozSourceDA?.toFixed(0)}`,
            `Utracono: ${fmtDatePL(new Date())}`,
          ].join("\n"),
        });
        created++;
      }
    }

    return created;
  }

  // ═══════════════════════════════════════════════════════════
  // MOZ: DA change
  // ═══════════════════════════════════════════════════════════
  private async detectDAChange(
    domainId: string,
    currentDA: number,
  ): Promise<number> {
    const lastDAAlert = await prisma.alert.findFirst({
      where: { domainId, type: "DA_CHANGE" as AlertType },
      orderBy: { createdAt: "desc" },
    });

    if (!lastDAAlert?.description) return 0;

    const match = lastDAAlert.description.match(/→ (\d+)/);
    if (!match) return 0;

    const prevDA = parseFloat(match[1]);
    const change = currentDA - prevDA;

    if (Math.abs(change) >= 2) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "DA_CHANGE" as AlertType,
          createdAt: { gte: thirtyDaysAgo },
        },
      });
      if (!existing) {
        await createAlert({
          domainId,
          type: "DA_CHANGE",
          severity: change > 0 ? "LOW" : "MEDIUM",
          title: `Domain Authority ${change > 0 ? "wzrosło" : "spadło"}: ${prevDA} → ${currentDA}`,
          description: `DA: ${prevDA} → ${currentDA} (${change > 0 ? "+" : ""}${change.toFixed(1)}). Sprawdzono: ${fmtDatePL(new Date())}`,
        });
        return 1;
      }
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════════
  // GA4: Conversion/revenue anomalies — with concrete dates
  // ═══════════════════════════════════════════════════════════
  private async detectGA4Anomalies(
    domainId: string,
    integrationId: string,
  ): Promise<number> {
    const recent = dateRange(7);
    const prev = {
      start: new Date(Date.now() - 14 * 86400000),
      end: new Date(Date.now() - 7 * 86400000),
    };

    const [recentDays, prevDays] = await Promise.all([
      prisma.integrationDaily.findMany({
        where: { integrationId, date: { gte: recent.start } },
      }),
      prisma.integrationDaily.findMany({
        where: { integrationId, date: { gte: prev.start, lt: prev.end } },
      }),
    ]);

    if (recentDays.length < 3 || prevDays.length < 3) return 0;

    const recentConv = recentDays.reduce((s, d) => s + (d.conversions || 0), 0);
    const prevConv = prevDays.reduce((s, d) => s + (d.conversions || 0), 0);
    const recentRev = recentDays.reduce((s, d) => s + (d.revenue || 0), 0);
    const prevRev = prevDays.reduce((s, d) => s + (d.revenue || 0), 0);

    const recentStr = `${fmtDatePL(recent.start)}–${fmtDatePL(recent.end)}`;
    const prevStr = `${fmtDatePL(prev.start)}–${fmtDatePL(prev.end)}`;

    let created = 0;

    // Conversion drop >30%
    if (prevConv >= 5 && recentConv < prevConv * 0.7) {
      const dropPct = Math.round(((prevConv - recentConv) / prevConv) * 100);
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "CONVERSION_DROP" as AlertType,
          createdAt: { gte: recent.start },
          isResolved: false,
        },
      });
      if (!existing) {
        await createAlert({
          domainId,
          type: "CONVERSION_DROP",
          severity: dropPct > 50 ? "CRITICAL" : "HIGH",
          title: `Spadek konwersji o ${dropPct}%`,
          description: [
            `Okres bieżący (${recentStr}): ${recentConv} konwersji, ${recentRev.toFixed(0)} zł`,
            `Okres poprzedni (${prevStr}): ${prevConv} konwersji, ${prevRev.toFixed(0)} zł`,
            `Zmiana: −${dropPct}%`,
          ].join("\n"),
        });
        created++;
      }
    }

    // Conversion spike >50%
    if (prevConv >= 3 && recentConv > prevConv * 1.5) {
      const spikePct = Math.round(((recentConv - prevConv) / prevConv) * 100);
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "CONVERSION_SPIKE" as AlertType,
          createdAt: { gte: recent.start },
        },
      });
      if (!existing) {
        await createAlert({
          domainId,
          type: "CONVERSION_SPIKE",
          severity: "LOW",
          title: `Wzrost konwersji o ${spikePct}%!`,
          description: [
            `Okres bieżący (${recentStr}): ${recentConv} konwersji, ${recentRev.toFixed(0)} zł`,
            `Okres poprzedni (${prevStr}): ${prevConv} konwersji, ${prevRev.toFixed(0)} zł`,
          ].join("\n"),
        });
        created++;
      }
    }

    // Revenue drop >30%
    if (prevRev >= 100 && recentRev < prevRev * 0.7) {
      const dropPct = Math.round(((prevRev - recentRev) / prevRev) * 100);
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "REVENUE_DROP" as AlertType,
          createdAt: { gte: recent.start },
          isResolved: false,
        },
      });
      if (!existing) {
        await createAlert({
          domainId,
          type: "REVENUE_DROP",
          severity: dropPct > 50 ? "CRITICAL" : "HIGH",
          title: `Spadek przychodu o ${dropPct}%`,
          description: [
            `Okres bieżący (${recentStr}): ${recentRev.toFixed(0)} zł`,
            `Okres poprzedni (${prevStr}): ${prevRev.toFixed(0)} zł`,
            `Zmiana: −${dropPct}% (${(prevRev - recentRev).toFixed(0)} zł mniej)`,
          ].join("\n"),
        });
        created++;
      }
    }

    return created;
  }

  // ═══════════════════════════════════════════════════════════
  // MERCHANT: Product disapprovals
  // ═══════════════════════════════════════════════════════════
  private async detectMerchantIssues(
    domainId: string,
    integration: any,
  ): Promise<number> {
    const cached = integration.cachedData as any;
    if (!cached) return 0;

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    let created = 0;

    if (cached.disapproved > 0) {
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "MERCHANT_DISAPPROVED" as AlertType,
          createdAt: { gte: sevenDaysAgo },
          isResolved: false,
        },
      });
      if (!existing) {
        const products = (cached.disapprovedProducts || []).slice(0, 5);
        const details = products
          .map(
            (p: any, i: number) =>
              `${i + 1}. ${p.title || p.productId}${p.reason ? ` — ${p.reason}` : ""}`,
          )
          .join("\n");

        await createAlert({
          domainId,
          type: "MERCHANT_DISAPPROVED",
          severity: cached.disapproved > 10 ? "HIGH" : "MEDIUM",
          title: `${cached.disapproved} produktów odrzuconych w Merchant Center`,
          description: details
            ? `Odrzucone produkty:\n${details}${cached.disapproved > 5 ? `\n...i ${cached.disapproved - 5} więcej` : ""}`
            : undefined,
        });
        created++;
      }
    }

    // Approval rate drop
    const prevSnapshot = await prisma.integrationDaily.findFirst({
      where: {
        integrationId: integration.id,
        date: { lt: new Date(Date.now() - 86400000) },
      },
      orderBy: { date: "desc" },
    });

    if (prevSnapshot?.approvedProducts != null && cached.approved != null) {
      const prevRate = prevSnapshot.productCount
        ? (prevSnapshot.approvedProducts / prevSnapshot.productCount) * 100
        : 100;
      const currRate = cached.totalProducts
        ? (cached.approved / cached.totalProducts) * 100
        : 100;

      if (prevRate - currRate >= 5) {
        const existing = await prisma.alert.findFirst({
          where: {
            domainId,
            type: "FEED_APPROVAL_DROP" as AlertType,
            createdAt: { gte: sevenDaysAgo },
            isResolved: false,
          },
        });
        if (!existing) {
          await createAlert({
            domainId,
            type: "FEED_APPROVAL_DROP",
            severity: prevRate - currRate >= 15 ? "CRITICAL" : "HIGH",
            title: `Approval rate spadł: ${prevRate.toFixed(0)}% → ${currRate.toFixed(0)}%`,
            description: `Approved: ${prevSnapshot.approvedProducts} → ${cached.approved}. Disapproved: ${prevSnapshot.disapprovedProducts || 0} → ${cached.disapproved}`,
          });
          created++;
        }
      }
    }

    return created;
  }
}
