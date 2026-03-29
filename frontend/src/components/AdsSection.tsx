import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { cn, fmtNumber, fmtDate } from "../lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  RefreshCw,
  DollarSign,
  ShoppingCart,
  Search,
  TrendingUp,
  AlertTriangle,
  Zap,
} from "lucide-react";

export function AdsSection({ domainId }: { domainId: string }) {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<
    "overview" | "products" | "search" | "comparison"
  >("overview");

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["ads-campaigns", domainId, days],
    queryFn: () => api.getAdsCampaigns(domainId, days),
  });

  const { data: products } = useQuery({
    queryKey: ["ads-products", domainId, days],
    queryFn: () => api.getAdsProducts(domainId, days),
    enabled: tab === "products",
  });

  const { data: searchTerms } = useQuery({
    queryKey: ["ads-search-terms", domainId, days],
    queryFn: () => api.getAdsSearchTerms(domainId, days),
    enabled: tab === "search",
  });

  const { data: comparison } = useQuery({
    queryKey: ["ads-vs-organic", domainId, days],
    queryFn: () => api.getAdsVsOrganic(domainId, days),
    enabled: tab === "comparison",
  });

  const syncCampaigns = useMutation({
    mutationFn: () => api.syncAdsCampaigns(domainId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ads-campaigns"] }),
  });

  if (!campaigns?.isConfigured) {
    return (
      <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-lg p-6 text-center">
        <AlertTriangle className="w-6 h-6 text-accent-amber mx-auto mb-2" />
        <div className="text-sm font-semibold text-accent-amber mb-1">
          Google Ads API — oczekiwanie na zatwierdzenie
        </div>
        <div className="text-xs text-panel-muted max-w-md mx-auto">
          Zgłoszenie o Basic Access zostało wysłane. Google zatwierdza w 1-3 dni
          roboczych. Po zatwierdzeniu podłącz refresh token i dane pojawią się
          automatycznie.
        </div>
      </div>
    );
  }

  const t = campaigns?.totals;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-accent-green" />
          <span className="text-xs font-semibold">Google Ads</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-mono",
                  days === d
                    ? "bg-accent-blue/20 text-accent-blue font-semibold"
                    : "text-panel-muted",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            className="btn btn-ghost text-xs"
            onClick={() => syncCampaigns.mutate()}
            disabled={syncCampaigns.isPending}
          >
            {syncCampaigns.isPending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              "Sync"
            )}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {t && (
        <div className="grid grid-cols-6 gap-2">
          <MiniStat
            label={`Wydatki (${days}d)`}
            value={`${t.cost.toFixed(0)} zł`}
            color="#ef4444"
          />
          <MiniStat
            label="Przychód"
            value={`${t.revenue.toFixed(0)} zł`}
            color="#22c55e"
          />
          <MiniStat
            label="ROAS"
            value={`${(t.roas * 100).toFixed(0)}%`}
            color={
              t.roas >= 2.5 ? "#22c55e" : t.roas >= 1.5 ? "#f59e0b" : "#ef4444"
            }
          />
          <MiniStat
            label="Konwersje"
            value={t.conversions.toFixed(0)}
            color="#a855f7"
          />
          <MiniStat
            label="Kliknięcia"
            value={fmtNumber(t.clicks)}
            color="#06b6d4"
          />
          <MiniStat
            label="CPC"
            value={`${t.cpc.toFixed(2)} zł`}
            color="#3b82f6"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-panel-border">
        {(
          [
            { key: "overview", label: "Przegląd", icon: TrendingUp },
            { key: "products", label: "Produkty", icon: ShoppingCart },
            { key: "search", label: "Frazy", icon: Search },
            { key: "comparison", label: "Ads vs Organic", icon: Zap },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-2 text-[10px] font-medium border-b-2 -mb-px flex items-center gap-1",
              tab === t.key
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-panel-muted hover:text-panel-text",
            )}
          >
            <t.icon className="w-3 h-3" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && campaigns?.chartData?.length > 0 && (
        <div className="space-y-3">
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
              Koszt vs Przychód — {days}d
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={campaigns.chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 7, fill: "#64748b" }}
                  tickFormatter={(d: string) => {
                    const dt = new Date(d);
                    return `${dt.getDate()}.${dt.getMonth() + 1}`;
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 7, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v: number) => `${v.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a2235",
                    border: "1px solid #1e2a3a",
                    borderRadius: "4px",
                    fontSize: "9px",
                  }}
                  formatter={(v: number, name: string) => [
                    `${v.toFixed(0)} zł`,
                    name === "cost" ? "Koszt" : "Przychód",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#22c55e"
                  fill="none"
                  strokeWidth={1.5}
                  name="revenue"
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#ef4444"
                  fill="none"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  name="cost"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Campaigns table */}
          {campaigns.campaigns?.length > 0 && (
            <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kampania</th>
                    <th>Typ</th>
                    <th>Koszt</th>
                    <th>Przychód</th>
                    <th>ROAS</th>
                    <th>Konwersje</th>
                    <th>Kliknięcia</th>
                    <th>CPC</th>
                    <th>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.campaigns.map((c: any) => (
                    <tr key={c.id}>
                      <td className="font-semibold text-panel-text">
                        {c.name}
                      </td>
                      <td>
                        <span className="badge badge-neutral text-[9px]">
                          {c.type}
                        </span>
                      </td>
                      <td className="text-accent-red font-mono">
                        {c.cost.toFixed(0)} zł
                      </td>
                      <td className="text-accent-green font-mono font-semibold">
                        {c.revenue.toFixed(0)} zł
                      </td>
                      <td
                        className={cn(
                          "font-mono font-bold",
                          c.roas >= 2.5
                            ? "text-accent-green"
                            : c.roas >= 1.5
                              ? "text-accent-amber"
                              : "text-accent-red",
                        )}
                      >
                        {(c.roas * 100).toFixed(0)}%
                      </td>
                      <td className="text-accent-purple">
                        {c.conversions.toFixed(0)}
                      </td>
                      <td className="text-accent-cyan">
                        {fmtNumber(c.clicks)}
                      </td>
                      <td className="text-panel-muted font-mono">
                        {c.cpc.toFixed(2)} zł
                      </td>
                      <td className="text-panel-muted">
                        {(c.ctr * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Products tab */}
      {tab === "products" && products?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Kategoria</th>
                <th>Koszt</th>
                <th>Przychód</th>
                <th>ROAS</th>
                <th>Konwersje</th>
                <th>Kliknięcia</th>
                <th>CPC</th>
              </tr>
            </thead>
            <tbody>
              {(products || []).slice(0, 50).map((p: any) => (
                <tr key={p.productId}>
                  <td className="max-w-[250px] truncate text-panel-text">
                    {p.title}
                  </td>
                  <td className="text-panel-muted text-[10px]">
                    {p.category || "—"}
                  </td>
                  <td className="text-accent-red font-mono">
                    {p.cost.toFixed(0)} zł
                  </td>
                  <td className="text-accent-green font-mono font-semibold">
                    {p.revenue.toFixed(0)} zł
                  </td>
                  <td
                    className={cn(
                      "font-mono font-bold",
                      p.roas >= 2.5
                        ? "text-accent-green"
                        : p.roas >= 1.5
                          ? "text-accent-amber"
                          : "text-accent-red",
                    )}
                  >
                    {(p.roas * 100).toFixed(0)}%
                  </td>
                  <td className="text-accent-purple">
                    {p.conversions.toFixed(0)}
                  </td>
                  <td className="text-accent-cyan">{p.clicks}</td>
                  <td className="text-panel-muted font-mono">
                    {p.cpc.toFixed(2)} zł
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Search Terms tab */}
      {tab === "search" && searchTerms?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fraza</th>
                <th>Koszt</th>
                <th>Kliknięcia</th>
                <th>Wyświetlenia</th>
                <th>Konwersje</th>
                <th>Przychód</th>
                <th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {(searchTerms || []).slice(0, 50).map((t: any, i: number) => (
                <tr key={i}>
                  <td className="font-mono text-accent-amber">{t.term}</td>
                  <td className="text-accent-red font-mono">
                    {t.cost.toFixed(0)} zł
                  </td>
                  <td className="text-accent-cyan">{t.clicks}</td>
                  <td>{fmtNumber(t.impressions)}</td>
                  <td className="text-accent-purple">
                    {t.conversions.toFixed(0)}
                  </td>
                  <td className="text-accent-green font-mono">
                    {t.revenue.toFixed(0)} zł
                  </td>
                  <td
                    className={cn(
                      "font-mono font-bold",
                      t.roas >= 2.5
                        ? "text-accent-green"
                        : t.roas >= 1.5
                          ? "text-accent-amber"
                          : "text-accent-red",
                    )}
                  >
                    {(t.roas * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ads vs Organic tab */}
      {tab === "comparison" && comparison && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <MiniStat
              label="Paid terms"
              value={comparison.summary.totalPaidTerms}
              color="#ef4444"
            />
            <MiniStat
              label="Z organic"
              value={comparison.summary.withOrganicPresence}
              color="#22c55e"
            />
            <MiniStat
              label="Tylko paid"
              value={comparison.summary.purelyPaid}
              color="#f59e0b"
            />
            <MiniStat
              label="Potencjalne oszczędności"
              value={`${comparison.summary.potentialSavings.toFixed(0)} zł`}
              color="#06b6d4"
            />
          </div>

          <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fraza</th>
                  <th>Paid klik</th>
                  <th>Paid koszt</th>
                  <th>Organic klik</th>
                  <th>Organic poz.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {comparison.terms.slice(0, 50).map((t: any, i: number) => (
                  <tr key={i}>
                    <td className="font-mono text-accent-amber max-w-[250px] truncate">
                      {t.term}
                    </td>
                    <td className="text-accent-cyan">{t.paid.clicks}</td>
                    <td className="text-accent-red font-mono">
                      {t.paid.cost.toFixed(0)} zł
                    </td>
                    <td
                      className={
                        t.organic ? "text-accent-green" : "text-panel-muted"
                      }
                    >
                      {t.organic?.clicks || "—"}
                    </td>
                    <td
                      className={
                        t.organic
                          ? "text-accent-blue font-mono"
                          : "text-panel-muted"
                      }
                    >
                      {t.organic?.avgPosition?.toFixed(1) || "—"}
                    </td>
                    <td>
                      {t.hasOrganic && (t.organic?.avgPosition || 99) <= 5 ? (
                        <span className="badge badge-pass text-[9px]">
                          Można ograniczyć ads
                        </span>
                      ) : t.hasOrganic ? (
                        <span className="badge badge-neutral text-[9px]">
                          Organic + Paid
                        </span>
                      ) : (
                        <span className="badge badge-fail text-[9px]">
                          Tylko Paid
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!campaigns?.chartData?.length &&
        !isLoading &&
        campaigns?.isConfigured && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-8 text-center text-panel-muted text-sm">
            Brak danych. Kliknij "Sync" aby pobrać dane z Google Ads.
          </div>
        )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="stat-card" style={{ "--stat-accent": color } as any}>
      <div className="text-base font-bold font-mono" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] text-panel-muted">{label}</div>
    </div>
  );
}
