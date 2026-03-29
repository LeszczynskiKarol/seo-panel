// backend/src/services/alert-detection.service.ts
// NOWY PLIK — wykrywanie alertów cross-source
// Wywoływany z crona (np. codziennie o 09:30 po wszystkich syncach)

import { prisma } from "../lib/prisma.js";

export class AlertDetectionService {
  /**
   * Run all detection checks for all active domains
   */
  async detectAll(): Promise<{ created: number; checks: string[] }> {
    const domains = await prisma.domain.findMany({
      where: { isActive: true },
      include: {
        integrations: {
          where: { status: "ACTIVE" },
        },
      },
    });

    let created = 0;
    const checks: string[] = [];

    for (const domain of domains) {
      // ─── INDEXING: page indexed (positive) ───
      const indexed = await this.detectNewlyIndexed(domain.id);
      created += indexed;
      if (indexed > 0)
        checks.push(
          `${domain.label || domain.domain}: ${indexed} nowo zaindeksowanych`,
        );

      // ─── GSC: traffic drop ───
      const trafficDrop = await this.detectTrafficDrop(domain.id);
      created += trafficDrop;

      // ─── GSC: position drop ───
      const positionDrop = await this.detectPositionDrops(domain.id);
      created += positionDrop;

      // ─── MOZ: backlink changes ───
      if (domain.mozLastSync) {
        const blAlerts = await this.detectBacklinkChanges(domain.id);
        created += blAlerts;
      }

      // ─── MOZ: DA change ───
      if (domain.mozDA != null) {
        const daAlert = await this.detectDAChange(domain.id, domain.mozDA);
        created += daAlert;
      }

      // ─── GA4: conversion/revenue drops ───
      const ga4Integration = domain.integrations.find(
        (i) => i.provider === "GOOGLE_ANALYTICS",
      );
      if (ga4Integration) {
        const ga4Alerts = await this.detectGA4Anomalies(
          domain.id,
          ga4Integration.id,
        );
        created += ga4Alerts;
      }

      // ─── MERCHANT: disapprovals ───
      const merchantIntegration = domain.integrations.find(
        (i) => i.provider === "GOOGLE_MERCHANT",
      );
      if (merchantIntegration) {
        const merchantAlerts = await this.detectMerchantIssues(
          domain.id,
          merchantIntegration,
        );
        created += merchantAlerts;
      }
    }

    return { created, checks };
  }

  // ═══════════════════════════════════════════════════════════
  // INDEXING: Detect newly indexed pages (positive alert)
  // ═══════════════════════════════════════════════════════════
  private async detectNewlyIndexed(domainId: string): Promise<number> {
    // Find pages that changed to PASS in last 24h
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
      // Check if alert already exists
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          pageId: page.id,
          type: "PAGE_INDEXED",
          createdAt: { gte: yesterday },
        },
      });
      if (existing) continue;

      await prisma.alert.create({
        data: {
          domainId,
          pageId: page.id,
          type: "PAGE_INDEXED",
          severity: "LOW",
          title: `Strona zaindeksowana: ${page.path}`,
          description: `Zmiana statusu ${page.previousVerdict} → PASS`,
        },
      });
      created++;
    }
    return created;
  }

  // ═══════════════════════════════════════════════════════════
  // GSC: Traffic drop detection (week-over-week)
  // ═══════════════════════════════════════════════════════════
  private async detectTrafficDrop(domainId: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

    const [recentAgg, prevAgg] = await Promise.all([
      prisma.gscDomainDaily.aggregate({
        where: { domainId, date: { gte: sevenDaysAgo } },
        _sum: { clicks: true },
      }),
      prisma.gscDomainDaily.aggregate({
        where: { domainId, date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
        _sum: { clicks: true },
      }),
    ]);

    const recent = recentAgg._sum.clicks || 0;
    const prev = prevAgg._sum.clicks || 0;

    if (prev > 20 && recent < prev * 0.7) {
      const dropPct = Math.round(((prev - recent) / prev) * 100);
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "TRAFFIC_DROP",
          createdAt: { gte: sevenDaysAgo },
          isResolved: false,
        },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            domainId,
            type: "TRAFFIC_DROP",
            severity: dropPct > 50 ? "HIGH" : "MEDIUM",
            title: `Spadek ruchu o ${dropPct}% (tydzień do tygodnia)`,
            description: `Kliknięcia: ${prev} → ${recent} (${dropPct}% spadek)`,
          },
        });
        return 1;
      }
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════════
  // GSC: Position drops for important pages
  // ═══════════════════════════════════════════════════════════
  private async detectPositionDrops(domainId: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

    const recent = await prisma.gscPageDaily.groupBy({
      by: ["pageId"],
      where: { page: { domainId }, date: { gte: sevenDaysAgo } },
      _avg: { position: true },
      _sum: { clicks: true },
    });

    const previous = await prisma.gscPageDaily.groupBy({
      by: ["pageId"],
      where: {
        page: { domainId },
        date: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
      _avg: { position: true },
    });

    const prevMap = new Map(previous.map((r) => [r.pageId, r._avg.position]));
    let created = 0;

    for (const r of recent) {
      const prevPos = prevMap.get(r.pageId);
      const currPos = r._avg.position;
      if (!prevPos || !currPos) continue;
      if ((r._sum.clicks || 0) < 5) continue; // ignore low-traffic pages

      const drop = currPos - prevPos;
      if (drop >= 5) {
        const existing = await prisma.alert.findFirst({
          where: {
            domainId,
            pageId: r.pageId,
            type: "POSITION_DROP",
            createdAt: { gte: sevenDaysAgo },
            isResolved: false,
          },
        });
        if (!existing) {
          const page = await prisma.page.findUnique({
            where: { id: r.pageId },
            select: { path: true },
          });
          await prisma.alert.create({
            data: {
              domainId,
              pageId: r.pageId,
              type: "POSITION_DROP",
              severity: drop >= 10 ? "HIGH" : "MEDIUM",
              title: `Pozycja spadła o ${drop.toFixed(1)} — ${page?.path || "?"}`,
              description: `Pozycja: ${prevPos.toFixed(1)} → ${currPos.toFixed(1)}`,
            },
          });
          created++;
        }
      }
    }
    return created;
  }

  // ═══════════════════════════════════════════════════════════
  // MOZ: New/lost backlinks
  // ═══════════════════════════════════════════════════════════
  private async detectBacklinkChanges(domainId: string): Promise<number> {
    const yesterday = new Date(Date.now() - 86400000);
    let created = 0;

    // New high-DA backlinks (DA ≥ 30)
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
        targetUrl: true,
        mozSourceDA: true,
      },
    });

    for (const bl of newBacklinks) {
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "BACKLINK_NEW",
          description: { contains: bl.sourceDomain },
          createdAt: { gte: yesterday },
        },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            domainId,
            type: "BACKLINK_NEW",
            severity: (bl.mozSourceDA || 0) >= 50 ? "MEDIUM" : "LOW",
            title: `Nowy backlink z ${bl.sourceDomain} (DA ${bl.mozSourceDA?.toFixed(0)})`,
            description: `${bl.sourceDomain} → ${bl.targetUrl}`,
          },
        });
        created++;
      }
    }

    // Lost backlinks (DA ≥ 20)
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
        targetUrl: true,
        mozSourceDA: true,
      },
    });

    for (const bl of lostBacklinks) {
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "BACKLINK_LOST",
          description: { contains: bl.sourceDomain },
          createdAt: { gte: twoDaysAgo },
        },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            domainId,
            type: "BACKLINK_LOST",
            severity: (bl.mozSourceDA || 0) >= 40 ? "HIGH" : "MEDIUM",
            title: `Utracony backlink z ${bl.sourceDomain} (DA ${bl.mozSourceDA?.toFixed(0)})`,
            description: `${bl.sourceDomain} → ${bl.targetUrl}`,
          },
        });
        created++;
      }
    }

    return created;
  }

  // ═══════════════════════════════════════════════════════════
  // MOZ: DA change detection
  // ═══════════════════════════════════════════════════════════
  private async detectDAChange(
    domainId: string,
    currentDA: number,
  ): Promise<number> {
    // Check last alert for previous DA
    const lastDAAlert = await prisma.alert.findFirst({
      where: { domainId, type: "DA_CHANGE" },
      orderBy: { createdAt: "desc" },
    });

    if (!lastDAAlert?.description) return 0;

    // Parse previous DA from description
    const match = lastDAAlert.description.match(/→ (\d+)/);
    if (!match) return 0;

    const prevDA = parseFloat(match[1]);
    const change = currentDA - prevDA;

    if (Math.abs(change) >= 2) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "DA_CHANGE",
          createdAt: { gte: thirtyDaysAgo },
        },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            domainId,
            type: "DA_CHANGE",
            severity: change > 0 ? "LOW" : "MEDIUM",
            title: `Domain Authority ${change > 0 ? "wzrosło" : "spadło"}: ${prevDA} → ${currentDA}`,
            description: `DA zmiana: ${prevDA} → ${currentDA} (${change > 0 ? "+" : ""}${change.toFixed(1)})`,
          },
        });
        return 1;
      }
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════════
  // GA4: Conversion and revenue anomaly detection
  // ═══════════════════════════════════════════════════════════
  private async detectGA4Anomalies(
    domainId: string,
    integrationId: string,
  ): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

    const [recentDays, prevDays] = await Promise.all([
      prisma.integrationDaily.findMany({
        where: { integrationId, date: { gte: sevenDaysAgo } },
      }),
      prisma.integrationDaily.findMany({
        where: {
          integrationId,
          date: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      }),
    ]);

    if (recentDays.length < 3 || prevDays.length < 3) return 0;

    const recentConv = recentDays.reduce((s, d) => s + (d.conversions || 0), 0);
    const prevConv = prevDays.reduce((s, d) => s + (d.conversions || 0), 0);
    const recentRev = recentDays.reduce((s, d) => s + (d.revenue || 0), 0);
    const prevRev = prevDays.reduce((s, d) => s + (d.revenue || 0), 0);

    let created = 0;

    // Conversion drop >30%
    if (prevConv >= 5 && recentConv < prevConv * 0.7) {
      const dropPct = Math.round(((prevConv - recentConv) / prevConv) * 100);
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "CONVERSION_DROP",
          createdAt: { gte: sevenDaysAgo },
          isResolved: false,
        },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            domainId,
            type: "CONVERSION_DROP",
            severity: dropPct > 50 ? "CRITICAL" : "HIGH",
            title: `Spadek konwersji o ${dropPct}% (tydzień do tygodnia)`,
            description: `Konwersje: ${prevConv} → ${recentConv}. Przychód: ${prevRev.toFixed(0)} → ${recentRev.toFixed(0)} zł`,
          },
        });
        created++;
      }
    }

    // Conversion spike >50% (positive)
    if (prevConv >= 3 && recentConv > prevConv * 1.5) {
      const spikePct = Math.round(((recentConv - prevConv) / prevConv) * 100);
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "CONVERSION_SPIKE",
          createdAt: { gte: sevenDaysAgo },
        },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            domainId,
            type: "CONVERSION_SPIKE",
            severity: "LOW",
            title: `Wzrost konwersji o ${spikePct}%!`,
            description: `Konwersje: ${prevConv} → ${recentConv}. Przychód: ${prevRev.toFixed(0)} → ${recentRev.toFixed(0)} zł`,
          },
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
          type: "REVENUE_DROP",
          createdAt: { gte: sevenDaysAgo },
          isResolved: false,
        },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            domainId,
            type: "REVENUE_DROP",
            severity: dropPct > 50 ? "CRITICAL" : "HIGH",
            title: `Spadek przychodu o ${dropPct}%`,
            description: `Przychód: ${prevRev.toFixed(0)} → ${recentRev.toFixed(0)} zł`,
          },
        });
        created++;
      }
    }

    return created;
  }

  // ═══════════════════════════════════════════════════════════
  // MERCHANT: Product disapprovals and feed issues
  // ═══════════════════════════════════════════════════════════
  private async detectMerchantIssues(
    domainId: string,
    integration: any,
  ): Promise<number> {
    const cached = integration.cachedData as any;
    if (!cached) return 0;

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    let created = 0;

    // New disapprovals
    if (cached.disapproved > 0) {
      const existing = await prisma.alert.findFirst({
        where: {
          domainId,
          type: "MERCHANT_DISAPPROVED",
          createdAt: { gte: sevenDaysAgo },
          isResolved: false,
        },
      });
      if (!existing) {
        const products = (cached.disapprovedProducts || []).slice(0, 3);
        const names = products
          .map((p: any) => p.title || p.productId)
          .join(", ");
        await prisma.alert.create({
          data: {
            domainId,
            type: "MERCHANT_DISAPPROVED",
            severity: cached.disapproved > 10 ? "HIGH" : "MEDIUM",
            title: `${cached.disapproved} produktów odrzuconych w Merchant Center`,
            description: names ? `Przykłady: ${names}` : undefined,
          },
        });
        created++;
      }
    }

    // Approval rate drop — compare with previous daily snapshot
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
            type: "FEED_APPROVAL_DROP",
            createdAt: { gte: sevenDaysAgo },
            isResolved: false,
          },
        });
        if (!existing) {
          await prisma.alert.create({
            data: {
              domainId,
              type: "FEED_APPROVAL_DROP",
              severity: prevRate - currRate >= 15 ? "CRITICAL" : "HIGH",
              title: `Approval rate spadł: ${prevRate.toFixed(0)}% → ${currRate.toFixed(0)}%`,
              description: `Approved: ${prevSnapshot.approvedProducts} → ${cached.approved}. Disapproved: ${prevSnapshot.disapprovedProducts || 0} → ${cached.disapproved}`,
            },
          });
          created++;
        }
      }
    }

    return created;
  }
}
