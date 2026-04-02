import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { cn, fmtNumber } from "../lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  RefreshCw,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  PiggyBank,
} from "lucide-react";

const COMMISSION_RATE = 0.12; // 12%

type AdsTab = "overview" | "products" | "profitability" | "pmax";

export function AdsSection({ domainId }: { domainId: string }) {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<AdsTab>("overview");

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["ads-campaigns", domainId, days],
    queryFn: () => api.getAdsCampaigns(domainId, days),
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["ads-products", domainId, days],
    queryFn: () => api.getAdsProducts(domainId, days),
    enabled:
      tab === "products" || tab === "profitability" || tab === "overview",
  });

  const syncAll = useMutation({
    mutationFn: async () => {
      await api.syncAdsCampaigns(domainId);
      await api.syncAdsProducts(domainId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-campaigns"] });
      qc.invalidateQueries({ queryKey: ["ads-products"] });
    },
  });

  if (!campaigns?.isConfigured) {
    return (
      <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-lg p-6 text-center">
        <AlertTriangle className="w-6 h-6 text-accent-amber mx-auto mb-2" />
        <div className="text-sm font-semibold text-accent-amber mb-1">
          Google Ads API — oczekiwanie na zatwierdzenie
        </div>
        <div className="text-xs text-panel-muted max-w-md mx-auto">
          Po zatwierdzeniu podłącz refresh token.
        </div>
      </div>
    );
  }

  const t = campaigns?.totals;
  const commission = t ? t.revenue * COMMISSION_RATE : 0;
  const profit = t ? commission - t.cost : 0;
  const realRoas = t && t.cost > 0 ? commission / t.cost : 0;

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
            onClick={() => syncAll.mutate()}
            disabled={syncAll.isPending}
          >
            {syncAll.isPending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              "Sync All"
            )}
          </button>
        </div>
      </div>

      {/* Main stat cards — Ads + Profit */}
      {t && (
        <div className="space-y-2">
          <div className="grid grid-cols-6 gap-2">
            <MiniStat
              label={`Wydatki (${days}d)`}
              value={`${t.cost.toFixed(0)} zł`}
              color="#ef4444"
            />
            <MiniStat
              label="Sprzedaż (GMV)"
              value={`${t.revenue.toFixed(0)} zł`}
              color="#a855f7"
            />
            <MiniStat
              label="ROAS (GMV)"
              value={`${(t.roas * 100).toFixed(0)}%`}
              color={
                t.roas >= 2.5
                  ? "#22c55e"
                  : t.roas >= 1.5
                    ? "#f59e0b"
                    : "#ef4444"
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
          {/* Profit row */}
          <div className="grid grid-cols-4 gap-2">
            <MiniStat
              label="Moja prowizja (0.12%)"
              value={`${commission.toFixed(2)} zł`}
              color="#f59e0b"
            />
            <MiniStat
              label="Koszt Ads"
              value={`${t.cost.toFixed(2)} zł`}
              color="#ef4444"
            />
            <MiniStat
              label={profit >= 0 ? "ZYSK" : "STRATA"}
              value={`${profit >= 0 ? "+" : ""}${profit.toFixed(2)} zł`}
              color={profit >= 0 ? "#22c55e" : "#ef4444"}
            />
            <MiniStat
              label="Realny ROAS"
              value={`${(realRoas * 100).toFixed(1)}%`}
              color={realRoas >= 1 ? "#22c55e" : "#ef4444"}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-panel-border">
        {[
          { key: "overview" as AdsTab, label: "Przegląd", icon: TrendingUp },
          { key: "products" as AdsTab, label: "Produkty", icon: ShoppingCart },
          {
            key: "profitability" as AdsTab,
            label: "Rentowność",
            icon: PiggyBank,
          },
          { key: "pmax" as AdsTab, label: "PMax Insights", icon: TrendingUp },
        ].map((t) => (
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

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === "overview" && campaigns?.chartData?.length > 0 && (
        <div className="space-y-3">
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
              Koszt vs Sprzedaż — {days}d
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
                    name === "cost" ? "Koszt" : "Sprzedaż",
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

          {campaigns.campaigns?.length > 0 && (
            <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kampania</th>
                    <th>Typ</th>
                    <th>Koszt</th>
                    <th>Sprzedaż</th>
                    <th>ROAS</th>
                    <th>Prowizja</th>
                    <th>Zysk</th>
                    <th>Konwersje</th>
                    <th>Kliknięcia</th>
                    <th>CPC</th>
                    <th>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.campaigns.map((c: any) => {
                    const comm = c.revenue * COMMISSION_RATE;
                    const prof = comm - c.cost;
                    return (
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
                        <td className="text-accent-purple font-mono">
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
                        <td className="text-accent-amber font-mono">
                          {comm.toFixed(2)} zł
                        </td>
                        <td
                          className={cn(
                            "font-mono font-bold",
                            prof >= 0 ? "text-accent-green" : "text-accent-red",
                          )}
                        >
                          {prof >= 0 ? "+" : ""}
                          {prof.toFixed(2)} zł
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ PRODUCTS TAB ═══ */}
      {tab === "products" && (
        <ProductsTable products={products || []} isLoading={productsLoading} />
      )}

      {/* ═══ PROFITABILITY TAB ═══ */}
      {tab === "profitability" && (
        <ProfitabilityTab
          chartData={campaigns?.chartData || []}
          products={products || []}
          days={days}
          isLoading={productsLoading}
        />
      )}

      {tab === "pmax" && <PMaxInsightsTab domainId={domainId} days={days} />}

      {/* Empty state */}
      {!campaigns?.chartData?.length &&
        !campaignsLoading &&
        campaigns?.isConfigured && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-8 text-center text-panel-muted text-sm">
            Brak danych. Kliknij "Sync All" aby pobrać dane z Google Ads.
          </div>
        )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PROFITABILITY TAB
// ═══════════════════════════════════════════════════════════

function ProfitabilityTab({
  chartData,
  products,
  days,
  isLoading,
}: {
  chartData: any[];
  products: any[];
  days: number;
  isLoading: boolean;
}) {
  const [showCount, setShowCount] = useState(50);
  const [sortCol, setSortCol] = useState<string>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Build daily P&L chart data
  const profitChart = chartData.map((d: any) => {
    const comm = d.revenue * COMMISSION_RATE;
    return {
      date: d.date,
      cost: d.cost,
      commission: Math.round(comm * 100) / 100,
      profit: Math.round((comm - d.cost) * 100) / 100,
      revenue: d.revenue,
    };
  });

  const totalCommission = profitChart.reduce((s, d) => s + d.commission, 0);
  const totalCost = profitChart.reduce((s, d) => s + d.cost, 0);
  const totalProfit = totalCommission - totalCost;
  const profitableDays = profitChart.filter((d) => d.profit >= 0).length;
  const lossDays = profitChart.filter((d) => d.profit < 0).length;

  // Product profitability
  const profitProducts = products.map((p: any) => {
    const comm = p.revenue * COMMISSION_RATE;
    return {
      ...p,
      commission: comm,
      profit: comm - p.cost,
      profitMargin:
        p.cost > 0 ? ((comm - p.cost) / p.cost) * 100 : comm > 0 ? 100 : 0,
    };
  });

  const profitable = profitProducts.filter((p) => p.profit > 0);
  const unprofitable = profitProducts.filter((p) => p.profit < 0 && p.cost > 0);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "title" ? "asc" : "desc");
    }
  };

  const sorted = [...profitProducts]
    .filter((p) => p.cost > 0 || p.revenue > 0)
    .sort((a: any, b: any) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string")
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

  const visible = showCount === -1 ? sorted : sorted.slice(0, showCount);

  const SortTh = ({
    col,
    label,
    className,
  }: {
    col: string;
    label: string;
    className?: string;
  }) => (
    <th
      className={cn(
        "cursor-pointer hover:text-panel-text select-none",
        className,
      )}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-0.5">
        {label}
        {sortCol === col && (
          <span className="text-accent-blue">
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-6 gap-2">
        <MiniStat
          label="Prowizja łącznie"
          value={`${totalCommission.toFixed(2)} zł`}
          color="#f59e0b"
        />
        <MiniStat
          label="Koszt Ads"
          value={`${totalCost.toFixed(2)} zł`}
          color="#ef4444"
        />
        <MiniStat
          label={totalProfit >= 0 ? "ZYSK" : "STRATA"}
          value={`${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)} zł`}
          color={totalProfit >= 0 ? "#22c55e" : "#ef4444"}
        />
        <MiniStat
          label="Dni z zyskiem"
          value={`${profitableDays}/${profitChart.length}`}
          color="#22c55e"
        />
        <MiniStat
          label="Zyskowne produkty"
          value={profitable.length}
          color="#22c55e"
        />
        <MiniStat
          label="Stratne produkty"
          value={unprofitable.length}
          color="#ef4444"
        />
      </div>

      {/* Daily P&L chart */}
      {profitChart.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
            Dzienny zysk/strata — {days}d (prowizja 0.12% − koszt Ads)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={profitChart}>
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
                formatter={(v: number, name: string) => {
                  const labels: Record<string, string> = {
                    profit: "Zysk/Strata",
                    commission: "Prowizja",
                    cost: "Koszt Ads",
                    revenue: "Sprzedaż",
                  };
                  return [`${v.toFixed(2)} zł`, labels[name] || name];
                }}
              />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
              <Bar
                dataKey="profit"
                name="profit"
                fill="#22c55e"
                radius={[2, 2, 0, 0]}
                // Color per bar: green for positive, red for negative
              ></Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-[9px] text-panel-muted mt-1">
            <span>
              Prowizja:{" "}
              <strong className="text-accent-amber">
                {totalCommission.toFixed(2)} zł
              </strong>
            </span>
            <span>
              Koszt:{" "}
              <strong className="text-accent-red">
                {totalCost.toFixed(2)} zł
              </strong>
            </span>
            <span>
              Bilans:{" "}
              <strong
                className={
                  totalProfit >= 0 ? "text-accent-green" : "text-accent-red"
                }
              >
                {totalProfit >= 0 ? "+" : ""}
                {totalProfit.toFixed(2)} zł
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Profit/loss by day — mini table for context */}
      {profitChart.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
            Prowizja vs Koszt — wykres liniowy
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={profitChart}>
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
                width={35}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a2235",
                  border: "1px solid #1e2a3a",
                  borderRadius: "4px",
                  fontSize: "9px",
                }}
                formatter={(v: number, name: string) => {
                  const labels: Record<string, string> = {
                    commission: "Prowizja",
                    cost: "Koszt",
                  };
                  return [`${v.toFixed(2)} zł`, labels[name] || name];
                }}
              />
              <Area
                type="monotone"
                dataKey="commission"
                stroke="#f59e0b"
                fill="none"
                strokeWidth={1.5}
                name="commission"
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
      )}

      {/* Product profitability table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-panel-muted uppercase tracking-wider flex items-center gap-1">
            <PiggyBank className="w-3 h-3" /> Rentowność per produkt
          </div>
          <div className="flex items-center gap-1.5">
            {isLoading && (
              <RefreshCw className="w-3 h-3 animate-spin text-accent-blue/50" />
            )}
            <span className="text-[9px] text-panel-muted">Pokaż:</span>
            {[50, 200, 500].map((n) => (
              <button
                key={n}
                onClick={() => setShowCount(n)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-mono",
                  showCount === n
                    ? "bg-accent-blue/20 text-accent-blue font-semibold"
                    : "text-panel-muted hover:text-panel-text",
                )}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setShowCount(-1)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono",
                showCount === -1
                  ? "bg-accent-blue/20 text-accent-blue font-semibold"
                  : "text-panel-muted hover:text-panel-text",
              )}
            >
              Wszystkie
            </button>
          </div>
        </div>

        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortTh col="title" label="Produkt" />
                <SortTh col="revenue" label="Sprzedaż" />
                <SortTh col="commission" label="Prowizja" />
                <SortTh col="cost" label="Koszt Ads" />
                <SortTh col="profit" label="Zysk/Strata" />
                <SortTh col="profitMargin" label="Marża" />
                <SortTh col="conversions" label="Konw." />
                <SortTh col="clicks" label="Klik." />
              </tr>
            </thead>
            <tbody>
              {visible.map((p: any, i: number) => (
                <tr key={i}>
                  <td className="max-w-[250px] truncate text-panel-text">
                    {p.title}
                  </td>
                  <td className="text-accent-purple font-mono">
                    {p.revenue.toFixed(0)} zł
                  </td>
                  <td className="text-accent-amber font-mono">
                    {p.commission.toFixed(2)} zł
                  </td>
                  <td className="text-accent-red font-mono">
                    {p.cost.toFixed(2)} zł
                  </td>
                  <td
                    className={cn(
                      "font-mono font-bold",
                      p.profit >= 0 ? "text-accent-green" : "text-accent-red",
                    )}
                  >
                    {p.profit >= 0 ? "+" : ""}
                    {p.profit.toFixed(2)} zł
                  </td>
                  <td
                    className={cn(
                      "font-mono",
                      p.profitMargin >= 0
                        ? "text-accent-green"
                        : "text-accent-red",
                    )}
                  >
                    {p.profitMargin.toFixed(0)}%
                  </td>
                  <td className="text-accent-purple">
                    {p.conversions.toFixed(0)}
                  </td>
                  <td className="text-accent-cyan">{p.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 flex items-center justify-between text-[10px] text-panel-muted border-t border-panel-border">
            <span>
              {visible.length} z {sorted.length} produktów z aktywnością
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PRODUCTS TABLE (sortable + paginated)
// ═══════════════════════════════════════════════════════════

function ProductsTable({
  products,
  isLoading,
}: {
  products: any[];
  isLoading: boolean;
}) {
  const [showCount, setShowCount] = useState(50);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "title" || col === "category" ? "asc" : "desc");
    }
  };

  const filtered = products.filter(
    (p: any) =>
      !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()),
  );

  const sorted = [...filtered].sort((a: any, b: any) => {
    const aVal = a[sortCol];
    const bVal = b[sortCol];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === "string")
      return sortDir === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  const visible = showCount === -1 ? sorted : sorted.slice(0, showCount);
  const hasMore = showCount !== -1 && showCount < sorted.length;

  const SortTh = ({
    col,
    label,
    className,
  }: {
    col: string;
    label: string;
    className?: string;
  }) => (
    <th
      className={cn(
        "cursor-pointer hover:text-panel-text select-none",
        className,
      )}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-0.5">
        {label}
        {sortCol === col && (
          <span className="text-accent-blue">
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <input
          className="input text-xs w-64"
          placeholder="Szukaj produktu..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowCount(50);
          }}
        />
        <div className="flex items-center gap-1.5">
          {isLoading && (
            <RefreshCw className="w-3 h-3 animate-spin text-accent-blue/50" />
          )}
          <span className="text-[9px] text-panel-muted">Pokaż:</span>
          {[50, 200, 500, 1000].map((n) => (
            <button
              key={n}
              onClick={() => setShowCount(n)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono",
                showCount === n
                  ? "bg-accent-blue/20 text-accent-blue font-semibold"
                  : "text-panel-muted hover:text-panel-text",
              )}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setShowCount(-1)}
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-mono",
              showCount === -1
                ? "bg-accent-blue/20 text-accent-blue font-semibold"
                : "text-panel-muted hover:text-panel-text",
            )}
          >
            Wszystkie
          </button>
        </div>
      </div>

      <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh col="title" label="Produkt" />
              <SortTh col="category" label="Kategoria" />
              <SortTh col="cost" label="Koszt" />
              <SortTh col="revenue" label="Przychód" />
              <SortTh col="roas" label="ROAS" />
              <SortTh col="conversions" label="Konwersje" />
              <SortTh col="clicks" label="Kliknięcia" />
              <SortTh col="cpc" label="CPC" />
            </tr>
          </thead>
          <tbody>
            {visible.map((p: any, i: number) => (
              <tr key={i}>
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
        <div className="px-4 py-2 flex items-center justify-between text-[10px] text-panel-muted border-t border-panel-border">
          <span>
            {visible.length} z {sorted.length} produktów
          </span>
          {hasMore && (
            <button
              onClick={() =>
                setShowCount((c) => c + (showCount === -1 ? 50 : showCount))
              }
              className="text-accent-blue hover:underline"
            >
              Pokaż kolejne{" "}
              {Math.min(showCount, sorted.length - visible.length)} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MINI STAT CARD
// ═══════════════════════════════════════════════════════════

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

const PERF_COLORS: Record<string, string> = {
  BEST: "#22c55e",
  GOOD: "#3b82f6",
  LOW: "#ef4444",
  LEARNING: "#f59e0b",
  UNKNOWN: "#64748b",
};

const PERF_LABELS_PL: Record<string, string> = {
  BEST: "Najlepszy",
  GOOD: "Dobry",
  LOW: "Słaby",
  LEARNING: "Uczenie",
  UNKNOWN: "Brak danych",
};

const FIELD_TYPE_PL: Record<string, string> = {
  HEADLINE: "Nagłówek",
  LONG_HEADLINE: "Długi nagłówek",
  DESCRIPTION: "Opis",
  BUSINESS_NAME: "Nazwa firmy",
  LOGO: "Logo",
  LANDSCAPE_LOGO: "Logo poziome",
  MARKETING_IMAGE: "Obraz",
  SQUARE_MARKETING_IMAGE: "Obraz kwadratowy",
  PORTRAIT_MARKETING_IMAGE: "Obraz pionowy",
  YOUTUBE_VIDEO: "Film YouTube",
  CALL_TO_ACTION_SELECTION: "CTA",
};

function PMaxInsightsTab({
  domainId,
  days,
}: {
  domainId: string;
  days: number;
}) {
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["ads-asset-groups", domainId, days],
    queryFn: () => api.getAdsAssetGroups(domainId, days),
  });

  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: ["ads-asset-performance", domainId, days],
    queryFn: () => api.getAdsAssetPerformance(domainId, days),
  });

  const { data: signalsData } = useQuery({
    queryKey: ["ads-audience-signals", domainId],
    queryFn: () => api.getAdsAudienceSignals(domainId),
  });

  const isLoading = groupsLoading || assetsLoading;

  const groups = groupsData?.assetGroups || [];
  const assets = assetsData?.assets || [];
  const byFieldType = assetsData?.byFieldType || {};
  const signals = signalsData?.signals || [];

  if (groupsData?.error && assetsData?.error) {
    return (
      <div className="bg-accent-red/5 border border-accent-red/20 rounded-lg p-4 text-center text-sm text-accent-red">
        Błąd: {groupsData.error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-panel-muted">
          <RefreshCw className="w-3 h-3 animate-spin" /> Pobieram dane PMax...
        </div>
      )}

      {/* ═══ ASSET GROUPS ═══ */}
      {groups.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-panel-muted uppercase tracking-wider">
            Asset Groups — Performance ({days}d)
          </div>
          <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset Group</th>
                  <th>Kampania</th>
                  <th>Koszt</th>
                  <th>Sprzedaż</th>
                  <th>ROAS</th>
                  <th>Konw.</th>
                  <th>Klik.</th>
                  <th>CTR</th>
                  <th>Conv Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g: any) => (
                  <tr key={g.assetGroupId}>
                    <td className="font-semibold text-panel-text">
                      {g.assetGroupName}
                    </td>
                    <td className="text-panel-muted text-[10px]">
                      {g.campaignName}
                    </td>
                    <td className="text-accent-red font-mono">
                      {g.cost.toFixed(0)} zł
                    </td>
                    <td className="text-accent-green font-mono font-semibold">
                      {g.conversionValue.toFixed(0)} zł
                    </td>
                    <td
                      className={cn(
                        "font-mono font-bold",
                        g.roas >= 2.5
                          ? "text-accent-green"
                          : g.roas >= 1.5
                            ? "text-accent-amber"
                            : "text-accent-red",
                      )}
                    >
                      {(g.roas * 100).toFixed(0)}%
                    </td>
                    <td className="text-accent-purple">
                      {g.conversions.toFixed(1)}
                    </td>
                    <td className="text-accent-cyan">{g.clicks}</td>
                    <td className="text-panel-muted">
                      {(g.ctr * 100).toFixed(1)}%
                    </td>
                    <td className="text-panel-muted">
                      {(g.convRate * 100).toFixed(1)}%
                    </td>
                    <td>
                      <span
                        className={cn(
                          "badge text-[9px]",
                          g.primaryStatus === "ELIGIBLE"
                            ? "badge-success"
                            : "badge-neutral",
                        )}
                      >
                        {g.primaryStatus || g.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ ASSET PERFORMANCE SUMMARY ═══ */}
      {Object.keys(byFieldType).length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-panel-muted uppercase tracking-wider">
            Asset Performance — podsumowanie per typ
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(byFieldType).map(([type, stats]: [string, any]) => (
              <div
                key={type}
                className="bg-panel-card border border-panel-border rounded-lg p-3"
              >
                <div className="text-[10px] font-semibold text-panel-text mb-2">
                  {FIELD_TYPE_PL[type] || type}
                </div>
                <div className="text-[9px] text-panel-muted mb-1">
                  {stats.total} komponentów
                </div>
                <div className="flex gap-1">
                  {stats.best > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
                      style={{
                        background: `${PERF_COLORS.BEST}20`,
                        color: PERF_COLORS.BEST,
                      }}
                    >
                      {stats.best} BEST
                    </span>
                  )}
                  {stats.good > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                      style={{
                        background: `${PERF_COLORS.GOOD}20`,
                        color: PERF_COLORS.GOOD,
                      }}
                    >
                      {stats.good} GOOD
                    </span>
                  )}
                  {stats.low > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                      style={{
                        background: `${PERF_COLORS.LOW}20`,
                        color: PERF_COLORS.LOW,
                      }}
                    >
                      {stats.low} LOW
                    </span>
                  )}
                  {stats.learning > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                      style={{
                        background: `${PERF_COLORS.LEARNING}20`,
                        color: PERF_COLORS.LEARNING,
                      }}
                    >
                      {stats.learning} LEARN
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ INDIVIDUAL ASSETS TABLE ═══ */}
      {assets.length > 0 && <AssetPerformanceTable assets={assets} />}

      {/* ═══ AUDIENCE SIGNALS ═══ */}
      {signals.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-panel-muted uppercase tracking-wider">
            Audience Signals
          </div>
          <div className="space-y-2">
            {signals.map((s: any, i: number) => (
              <div
                key={i}
                className="bg-panel-card border border-panel-border rounded-lg p-3"
              >
                <div className="text-[10px] font-semibold text-panel-text mb-1">
                  {s.assetGroupName}
                  <span className="text-panel-muted font-normal ml-2">
                    {s.campaignName}
                  </span>
                </div>
                {s.searchThemes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.searchThemes.slice(0, 20).map((t: any, j: number) => (
                      <span
                        key={j}
                        className="px-1.5 py-0.5 bg-accent-blue/10 text-accent-blue rounded text-[9px]"
                      >
                        {t.text || t}
                      </span>
                    ))}
                  </div>
                )}
                {s.audiences?.length > 0 && (
                  <div className="text-[9px] text-panel-muted mt-1">
                    {s.audiences.length} segmentów odbiorców
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && groups.length === 0 && assets.length === 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-8 text-center text-panel-muted text-sm">
          Brak danych PMax. Upewnij się że masz aktywną kampanię Performance
          Max.
        </div>
      )}
    </div>
  );
}

function AssetPerformanceTable({ assets }: { assets: any[] }) {
  const [filter, setFilter] = useState<string>("ALL");
  const [perfFilter, setPerfFilter] = useState<string>("ALL");

  const fieldTypes = [...new Set(assets.map((a) => a.fieldType))].sort();

  const filtered = assets.filter((a) => {
    if (filter !== "ALL" && a.fieldType !== filter) return false;
    if (perfFilter !== "ALL" && a.performanceLabel !== perfFilter) return false;
    return true;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-panel-muted uppercase tracking-wider">
          Wszystkie komponenty ({filtered.length})
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input text-[10px] py-0.5 px-1.5 w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">Wszystkie typy</option>
            {fieldTypes.map((ft) => (
              <option key={ft} value={ft}>
                {FIELD_TYPE_PL[ft] || ft}
              </option>
            ))}
          </select>
          <select
            className="input text-[10px] py-0.5 px-1.5 w-auto"
            value={perfFilter}
            onChange={(e) => setPerfFilter(e.target.value)}
          >
            <option value="ALL">Wszystkie oceny</option>
            <option value="BEST">BEST</option>
            <option value="GOOD">GOOD</option>
            <option value="LOW">LOW</option>
            <option value="LEARNING">LEARNING</option>
          </select>
        </div>
      </div>

      <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Treść</th>
              <th>Ocena</th>
              <th>Asset Group</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((a: any, i: number) => {
              const content =
                a.text ||
                a.videoTitle ||
                (a.imageUrl ? "🖼️ Obraz" : a.assetName) ||
                "—";
              const perfColor =
                PERF_COLORS[a.performanceLabel] || PERF_COLORS.UNKNOWN;
              return (
                <tr key={i}>
                  <td>
                    <span className="badge badge-neutral text-[9px]">
                      {FIELD_TYPE_PL[a.fieldType] || a.fieldType}
                    </span>
                  </td>
                  <td className="max-w-[350px]">
                    {a.imageUrl ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={a.imageUrl}
                          alt=""
                          className="w-8 h-8 rounded object-cover"
                        />
                        <span className="text-panel-muted text-[10px] truncate">
                          {a.assetName || "Obraz"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-panel-text text-[11px]">
                        {content}
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className="px-2 py-0.5 rounded text-[9px] font-mono font-bold"
                      style={{ background: `${perfColor}20`, color: perfColor }}
                    >
                      {PERF_LABELS_PL[a.performanceLabel] || a.performanceLabel}
                    </span>
                  </td>
                  <td className="text-panel-muted text-[10px]">
                    {a.assetGroupName}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div className="px-4 py-2 text-[10px] text-panel-muted border-t border-panel-border">
            Pokazano 100 z {filtered.length}
          </div>
        )}
      </div>
    </div>
  );
}
