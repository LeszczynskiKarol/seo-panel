// backend/src/services/merchant.service.ts
// ZASTĄP CAŁY PLIK

import { prisma } from "../lib/prisma.js";
import { getGoogleAuth } from "../lib/google-auth.js";
import { google } from "googleapis";

export class MerchantService {
  private async getContentApi() {
    const auth = await getGoogleAuth();
    return google.content({ version: "v2.1", auth });
  }

  async verifyAccess(
    merchantId: string,
  ): Promise<{ ok: boolean; error?: string; name?: string }> {
    try {
      const content = await this.getContentApi();
      const res = await content.accounts.get({
        merchantId,
        accountId: merchantId,
      });
      return { ok: true, name: res.data.name || merchantId };
    } catch (e: any) {
      const msg = e.message || "Unknown error";
      if (msg.includes("403") || msg.includes("permission")) {
        return {
          ok: false,
          error: `Brak dostępu. Dodaj email Service Account w Merchant Center → Settings → Account access.`,
        };
      }
      if (msg.includes("404")) {
        return {
          ok: false,
          error: `Merchant ID "${merchantId}" nie znaleziony.`,
        };
      }
      return { ok: false, error: msg };
    }
  }

  /**
   * Pull data with configurable date range
   */
  async pullData(
    integrationId: string,
    merchantId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ products: number; error?: string }> {
    try {
      const content = await this.getContentApi();

      const end = endDate || new Date().toISOString().split("T")[0];
      const start =
        startDate ||
        new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

      // ═══ 1. PRODUCT STATUSES ═══
      let allStatuses: any[] = [];
      let pageToken: string | undefined;
      do {
        const res: any = await content.productstatuses.list({
          merchantId,
          pageToken,
          maxResults: 250,
        });
        allStatuses.push(...(res.data.resources || []));
        pageToken = res.data.nextPageToken;
      } while (pageToken);

      let approved = 0,
        disapproved = 0,
        pending = 0;
      const productStatuses: any[] = [];

      for (const ps of allStatuses) {
        const dest = ps.destinationStatuses || [];
        const primaryDest =
          dest.find((d: any) => d.destination === "Shopping") ||
          dest.find((d: any) => d.destination === "SurfacesAcrossGoogle") ||
          dest[0];

        const hasApproved = dest.some(
          (d: any) => d.approvedCountries?.length > 0,
        );
        const hasPending = dest.some(
          (d: any) => d.pendingCountries?.length > 0,
        );

        let verdict: "approved" | "disapproved" | "pending";
        if (hasApproved) {
          verdict = "approved";
          approved++;
        } else if (hasPending) {
          verdict = "pending";
          pending++;
        } else {
          verdict = "disapproved";
          disapproved++;
        }

        productStatuses.push({
          productId: ps.productId,
          title: ps.title,
          link: ps.link,
          verdict,
          approvedCountries: primaryDest?.approvedCountries?.join(", ") || "",
          disapprovedCountries:
            primaryDest?.disapprovedCountries?.join(", ") || "",
          issues: (ps.itemLevelIssues || []).map((i: any) => ({
            code: i.code,
            description: i.description,
            detail: i.detail,
            severity: i.servability || i.severity,
            resolution: i.resolution,
          })),
        });
      }
      const total = allStatuses.length;

      // ═══ 2. PRODUCT LIST (ALL) ═══
      let allProducts: any[] = [];
      let prodPageToken: string | undefined;
      let fetchCount = 0;
      do {
        const productsRes: any = await content.products.list({
          merchantId,
          maxResults: 250,
          pageToken: prodPageToken,
        });
        allProducts.push(
          ...(productsRes.data.resources || []).map((p: any) => ({
            id: p.id,
            offerId: p.offerId,
            title: p.title,
            price: p.price ? `${p.price.value} ${p.price.currency}` : null,
            priceValue: p.price ? parseFloat(p.price.value) : 0,
            availability: p.availability,
            brand: p.brand,
            link: p.link,
            imageLink: p.imageLink,
            channel: p.channel,
          })),
        );
        prodPageToken = productsRes.data.nextPageToken;
        fetchCount++;
      } while (prodPageToken && fetchCount < 10);

      // ═══ 3. PERFORMANCE — MerchantPerformanceView ═══
      // Free listings only. Paid clicks → Google Ads API.
      let productPerformance: any[] = [];
      let dailyPerformance: any[] = [];

      // 3a. Per-product
      try {
        const res = await content.reports.search({
          merchantId,
          requestBody: {
            query: `SELECT segments.offer_id, segments.title, metrics.clicks, metrics.impressions, metrics.ctr FROM MerchantPerformanceView WHERE segments.date BETWEEN '${start}' AND '${end}' ORDER BY metrics.clicks DESC LIMIT 1000`,
          },
        });

        const perfMap = new Map<
          string,
          {
            offerId: string;
            title: string;
            clicks: number;
            impressions: number;
          }
        >();
        for (const r of res.data.results || []) {
          const offerId = r.segments?.offerId || "";
          const title = r.segments?.title || "";
          const clicks = parseInt(r.metrics?.clicks || "0");
          const impressions = parseInt(r.metrics?.impressions || "0");
          const ex = perfMap.get(offerId) || {
            offerId,
            title,
            clicks: 0,
            impressions: 0,
          };
          ex.clicks += clicks;
          ex.impressions += impressions;
          perfMap.set(offerId, ex);
        }

        productPerformance = Array.from(perfMap.values())
          .map((p) => ({
            ...p,
            ctr: p.impressions > 0 ? p.clicks / p.impressions : 0,
          }))
          .sort((a, b) => b.clicks - a.clicks);

        console.log(
          `✅ Merchant per-product perf (${start} → ${end}): ${productPerformance.length} products, top=${productPerformance[0]?.clicks || 0} clicks`,
        );
      } catch (e: any) {
        console.log(
          "⚠️ Merchant per-product perf error:",
          e.message?.slice(0, 300),
        );
      }

      // 3b. Daily aggregate
      try {
        const res = await content.reports.search({
          merchantId,
          requestBody: {
            query: `SELECT segments.date, metrics.clicks, metrics.impressions, metrics.ctr FROM MerchantPerformanceView WHERE segments.date BETWEEN '${start}' AND '${end}' ORDER BY segments.date ASC`,
          },
        });

        const dailyMap = new Map<
          string,
          { date: string; clicks: number; impressions: number }
        >();
        for (const r of res.data.results || []) {
          const d = r.segments?.date;
          if (!d) continue;
          const dateStr = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
          const clicks = parseInt(r.metrics?.clicks || "0");
          const impressions = parseInt(r.metrics?.impressions || "0");
          const ex = dailyMap.get(dateStr) || {
            date: dateStr,
            clicks: 0,
            impressions: 0,
          };
          ex.clicks += clicks;
          ex.impressions += impressions;
          dailyMap.set(dateStr, ex);
        }

        dailyPerformance = Array.from(dailyMap.values()).sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        console.log(
          `✅ Merchant daily perf: ${dailyPerformance.length} days, total clicks=${dailyPerformance.reduce((s, d) => s + d.clicks, 0)}`,
        );
      } catch (e: any) {
        console.log("⚠️ Merchant daily perf error:", e.message?.slice(0, 300));
      }

      // ═══ 4-5. MERGE ═══
      const disapprovedProducts = productStatuses
        .filter((p) => p.verdict === "disapproved")
        .slice(0, 30);
      const perfByOffer = new Map(
        productPerformance.map((p) => [p.offerId, p]),
      );
      const statusByProduct = new Map(
        productStatuses.map((p) => [p.productId, p]),
      );

      const enrichedProducts = allProducts.map((p) => {
        const perf = perfByOffer.get(p.offerId);
        const status = statusByProduct.get(p.id);
        return {
          ...p,
          clicks: perf?.clicks || 0,
          impressions: perf?.impressions || 0,
          ctr: perf?.ctr || 0,
          verdict: status?.verdict || "unknown",
          issues: status?.issues || [],
        };
      });
      enrichedProducts.sort((a, b) => b.clicks - a.clicks);

      // ═══ 6. TOTALS ═══
      const totalClicks = dailyPerformance.reduce((s, d) => s + d.clicks, 0);
      const totalImpressions = dailyPerformance.reduce(
        (s, d) => s + d.impressions,
        0,
      );
      const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

      // ═══ 7. SAVE ═══
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      await prisma.integrationDaily.upsert({
        where: { integrationId_date: { integrationId, date: todayDate } },
        update: {
          productCount: total,
          approvedProducts: approved,
          disapprovedProducts: disapproved,
          pendingProducts: pending,
          breakdown: {
            dailyPerformance,
            productPerformance: productPerformance.slice(0, 200),
          },
        },
        create: {
          integrationId,
          date: todayDate,
          productCount: total,
          approvedProducts: approved,
          disapprovedProducts: disapproved,
          pendingProducts: pending,
          breakdown: {
            dailyPerformance,
            productPerformance: productPerformance.slice(0, 200),
          },
        },
      });

      await prisma.domainIntegration.update({
        where: { id: integrationId },
        data: {
          status: "ACTIVE",
          lastSync: new Date(),
          lastError: null,
          syncCount: { increment: 1 },
          cachedData: {
            totalProducts: total,
            approved,
            disapproved,
            pending,
            approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
            totalClicks,
            totalImpressions,
            avgCtr: Math.round(avgCtr * 10000) / 100,
            topProducts: enrichedProducts,
            disapprovedProducts: disapprovedProducts.slice(0, 20),
            dailyPerformance,
            productPerformance: productPerformance.slice(0, 200),
            startDate: start,
            endDate: end,
            syncDate: new Date().toISOString(),
          },
        },
      });

      return { products: total };
    } catch (e: any) {
      console.error("Merchant pullData error:", e.message);
      await prisma.domainIntegration.update({
        where: { id: integrationId },
        data: { status: "ERROR", lastError: e.message },
      });
      return { products: 0, error: e.message };
    }
  }

  async syncAll() {
    const integrations = await prisma.domainIntegration.findMany({
      where: {
        provider: "GOOGLE_MERCHANT",
        status: { in: ["ACTIVE", "ERROR"] },
      },
      include: { domain: { select: { domain: true, label: true } } },
    });
    const results: { domain: string; products: number; error?: string }[] = [];
    for (const int of integrations) {
      const result = await this.pullData(int.id, int.merchantId!);
      results.push({
        domain: int.domain.label || int.domain.domain,
        ...result,
      });
      await new Promise((r) => setTimeout(r, 300));
    }
    return results;
  }
}
