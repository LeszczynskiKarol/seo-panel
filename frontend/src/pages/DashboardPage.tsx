import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  fmtNumber,
  fmtDate,
  categoryLabel,
  categoryColor,
  cn,
} from "../lib/utils";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { AddDomainModal } from "../components/AddDomainModal";
import {
  Globe,
  FileCheck,
  MousePointerClick,
  Eye,
  AlertTriangle,
  RefreshCw,
  Plus,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  Percent,
  Shield,
  Link2,
  Zap,
  ArrowRight,
  BarChart3,
  PiggyBank,
} from "lucide-react";
import { useState, useMemo } from "react";

function fmt(d: Date) {
  return d.toISOString().split("T")[0];
}

const DOMAIN_ORDER: Record<string, number> = {
  cmn9fo4dn0004qrdye8hjou1g: 1,
  cmn9fo4db0001qrdyh34ldxul: 2,
  cmn9fo4d50000qrdy96h2sdr6: 3,
  cmn9fo4dr0005qrdyj39z8k9e: 4,
  cmn9fo4df0002qrdywpl8ymwe: 5,
  cmn9fo4e50009qrdyog51y31k: 6,
};

export function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAddDomain, setShowAddDomain] = useState(false);

  // ─── Data queries ───
  const { data: overview, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
  });

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: api.getDomains,
  });

  const { data: alerts } = useQuery({
    queryKey: ["alerts", "unresolved"],
    queryFn: () => api.getAlerts("resolved=false&limit=8"),
  });

  // This month financial summary
  const now = new Date();
  const monthStart =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-01";
  const today = fmt(now);

  const { data: financial } = useQuery({
    queryKey: ["global-summary", monthStart, today],
    queryFn: () => api.getGlobalSummary(monthStart, today),
  });

  // Moz overview
  const { data: mozData } = useQuery({
    queryKey: ["moz-analytics"],
    queryFn: api.getMozAnalytics,
    staleTime: 300_000,
  });

  // 30d traffic
  const { data: traffic30d } = useQuery({
    queryKey: ["overview-traffic-30d"],
    queryFn: async () => {
      // Use overview's recentTraffic but we want 30 days
      // Fallback to 7d from overview
      return null;
    },
    enabled: false,
  });

  const syncAll = useMutation({
    mutationFn: api.syncAllSitemaps,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  });

  const pullAll = useMutation({
    mutationFn: () => api.pullAllGsc(7),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["overview"] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-5 h-5 animate-spin text-panel-muted" />
      </div>
    );
  }

  const o = overview || {
    domains: 0,
    totalPages: 0,
    totalIndexed: 0,
    indexRate: 0,
    totalClicks: 0,
    totalImpressions: 0,
    alertCount: 0,
    recentTraffic: [],
  };

  const ft = financial?.totals;
  const sortedDomains = [...(domains || [])].sort((a: any, b: any) => {
    const aOrder = DOMAIN_ORDER[a.id] || 100;
    const bOrder = DOMAIN_ORDER[b.id] || 100;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (b.totalClicks || 0) - (a.totalClicks || 0);
  });

  // Moz aggregated
  const mozDomains = mozData?.domains || [];
  const avgDA = mozData?.stats?.avgDA || 0;
  const totalBacklinks = mozData?.stats?.totalMozBacklinks || 0;

  return (
    <div className="p-6 space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-panel-muted mt-0.5">
            {o.domains} domen · {fmtDate(new Date().toISOString())}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddDomain(true)}
            className="btn btn-primary text-xs flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Dodaj domenę
          </button>
          <button
            className="btn btn-ghost text-xs"
            onClick={() => syncAll.mutate()}
            disabled={syncAll.isPending}
          >
            <RefreshCw
              className={cn(
                "w-3.5 h-3.5 mr-1.5",
                syncAll.isPending && "animate-spin",
              )}
            />
            Sync sitemaps
          </button>
          <button
            className="btn btn-primary text-xs"
            onClick={() => pullAll.mutate()}
            disabled={pullAll.isPending}
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Pull GSC (7d)
          </button>
        </div>
      </div>

      {/* ═══ BUSINESS KPIs — this month ═══ */}
      {ft && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-accent-green" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                W tym miesiącu
              </span>
              <span className="text-[9px] text-panel-dim font-mono">
                {monthStart} → {today}
              </span>
            </div>
            <button
              onClick={() => navigate("/profitability")}
              className="text-[10px] text-accent-blue hover:underline flex items-center gap-1"
            >
              Szczegóły <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2">
            <MiniKpi
              icon={<DollarSign className="w-3.5 h-3.5" />}
              label="Przychód netto"
              value={`${fmtNumber(Math.round(ft.totalIncome || ft.commission))} zł`}
              color="#3022c5"
            />
            <MiniKpi
              icon={<TrendingDown className="w-3.5 h-3.5" />}
              label="Koszty"
              value={`${fmtNumber(Math.round(ft.totalCosts))} zł`}
              color="#ef4444"
            />
            <MiniKpi
              label={ft.profit >= 0 ? "Zysk netto" : "Strata"}
              value={`${ft.profit >= 0 ? "+" : ""}${fmtNumber(Math.round(ft.profit))} zł`}
              color={ft.profit >= 0 ? "#22c55e" : "#ef4444"}
              bold
            />
            <MiniKpi
              icon={<ShoppingCart className="w-3.5 h-3.5" />}
              label="Konwersje"
              value={ft.conversions}
              color="#06b6d4"
            />
            <MiniKpi
              icon={<Percent className="w-3.5 h-3.5" />}
              label="Marża"
              value={`${ft.margin.toFixed(1)}%`}
              color={ft.margin >= 0 ? "#22c55e" : "#ef4444"}
            />
            <MiniKpi
              label="GMV"
              value={`${fmtNumber(Math.round(ft.revenue))} zł`}
              color="#a855f7"
            />
          </div>

          {/* Daily profit mini chart */}
          {financial?.daily?.length > 3 && (
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={60}>
                <BarChart data={financial.daily}>
                  <Bar dataKey="profit" radius={[1, 1, 0, 0]}>
                    {financial.daily.map((d: any, i: number) => (
                      <Cell
                        key={i}
                        fill={d.profit >= 0 ? "#22c55e" : "#ef4444"}
                        fillOpacity={0.5}
                      />
                    ))}
                  </Bar>
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ═══ SEO + MOZ KPIs ═══ */}
      <div className="grid grid-cols-7 gap-2">
        <StatCard
          accent="#3b82f6"
          icon={Globe}
          value={o.domains}
          label="Domeny"
        />
        <StatCard
          accent="#22c55e"
          icon={FileCheck}
          value={`${o.indexRate}%`}
          label={`${fmtNumber(o.totalIndexed)}/${fmtNumber(o.totalPages)}`}
        />
        <StatCard
          accent="#06b6d4"
          icon={MousePointerClick}
          value={fmtNumber(o.totalClicks)}
          label="Kliknięcia 30d"
        />
        <StatCard
          accent="#a855f7"
          icon={Eye}
          value={fmtNumber(o.totalImpressions)}
          label="Wyświetlenia"
        />
        <StatCard
          accent="#ef4444"
          icon={AlertTriangle}
          value={o.alertCount}
          label="Alerty"
        />
        <StatCard
          accent="#f59e0b"
          icon={Shield}
          value={avgDA || "—"}
          label="Śr. DA (Moz)"
        />
        <StatCard
          accent="#8b5cf6"
          icon={Link2}
          value={fmtNumber(totalBacklinks)}
          label="Backlinki (Moz)"
        />
      </div>

      {/* ═══ MAIN CHART + DOMAIN REVENUE BREAKDOWN ═══ */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <DashboardChart />
        </div>

        {/* Domain revenue breakdown (this month) */}
        {financial?.domainBreakdown?.length > 0 && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
              Przychód per domena (ten miesiąc)
            </div>
            <div className="space-y-2">
              {financial.domainBreakdown.slice(0, 6).map((d: any) => {
                const maxRev = financial.domainBreakdown[0]?.commission || 1;
                const pct = Math.min(
                  ((d.commission + (d.manualRevenue || 0)) / maxRev) * 100,
                  100,
                );
                return (
                  <div key={d.domainId} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-panel-text truncate max-w-[120px]">
                        {d.label}
                      </span>
                      <span className="text-accent-green font-mono font-bold">
                        {fmtNumber(
                          Math.round(d.commission + (d.manualRevenue || 0)),
                        )}{" "}
                        zł
                      </span>
                    </div>
                    <div className="h-1 bg-panel-border/30 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-green/60"
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ DOMAINS TABLE ═══ */}
      <div className="bg-panel-card border border-panel-border rounded overflow-x-auto">
        <div className="px-4 py-2.5 border-b border-panel-border flex items-center justify-between">
          <span className="text-[10px] text-panel-muted uppercase tracking-wider">
            Domeny ({sortedDomains.length})
          </span>
          <div className="flex gap-3 text-[10px]">
            <button
              onClick={() => navigate("/profitability")}
              className="text-accent-green hover:underline"
            >
              Rentowność →
            </button>
            <button
              onClick={() => navigate("/conversions")}
              className="text-accent-blue hover:underline"
            >
              Konwersje →
            </button>
            <button
              onClick={() => navigate("/moz")}
              className="text-accent-amber hover:underline"
            >
              Moz →
            </button>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Domena</th>
              <th>Kategoria</th>
              <th>Indeks</th>
              <th>Kliknięcia</th>
              <th>Wyświetl.</th>
              <th>Pozycja</th>
              <th>DA</th>
              <th>Backlinki</th>
              <th>GSC</th>
            </tr>
          </thead>
          <tbody>
            {sortedDomains.map((d: any) => {
              const pct =
                d.totalPages > 0
                  ? Math.round((d.indexedPages / d.totalPages) * 100)
                  : 0;
              const mozDomain = mozDomains.find((m: any) => m.id === d.id);
              return (
                <tr
                  key={d.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/domains/${d.id}`)}
                >
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          pct === 100
                            ? "bg-accent-green"
                            : pct > 50
                              ? "bg-accent-amber"
                              : "bg-accent-red",
                        )}
                      />
                      <span className="text-accent-blue font-semibold">
                        {d.label || d.domain.replace("www.", "")}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={cn("badge", categoryColor(d.category))}>
                      {categoryLabel(d.category)}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "font-semibold",
                      pct === 100
                        ? "text-accent-green"
                        : pct > 50
                          ? "text-accent-amber"
                          : "text-accent-red",
                    )}
                  >
                    {pct}%
                    <span className="text-[9px] text-panel-dim ml-1">
                      {d.indexedPages}/{d.totalPages}
                    </span>
                  </td>
                  <td className="text-accent-cyan font-mono">
                    {fmtNumber(d.totalClicks)}
                  </td>
                  <td className="font-mono">{fmtNumber(d.totalImpressions)}</td>
                  <td className="font-mono">
                    {d.avgPosition ? d.avgPosition.toFixed(1) : "—"}
                  </td>
                  <td>
                    {mozDomain?.mozDA ? (
                      <span className="text-accent-amber font-mono font-semibold">
                        {mozDomain.mozDA}
                      </span>
                    ) : (
                      <span className="text-panel-dim">—</span>
                    )}
                  </td>
                  <td className="text-panel-muted font-mono">
                    {mozDomain?.mozBacklinks
                      ? fmtNumber(mozDomain.mozBacklinks)
                      : "—"}
                  </td>
                  <td className="text-panel-muted text-[10px]">
                    {fmtDate(d.lastGscPull)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ═══ BOTTOM ROW: ALERTS + COST BREAKDOWN ═══ */}
      <div className="grid grid-cols-2 gap-3">
        {/* Alerts */}
        {alerts && alerts.length > 0 && (
          <div className="bg-panel-card border border-panel-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-panel-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-accent-red" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Alerty ({o.alertCount})
                </span>
              </div>
              <button
                className="text-[10px] text-accent-blue hover:underline"
                onClick={() => navigate("/alerts")}
              >
                Wszystkie →
              </button>
            </div>
            <div className="divide-y divide-panel-border/50 max-h-[240px] overflow-y-auto">
              {alerts.map((a: any) => (
                <div
                  key={a.id}
                  className="px-4 py-2.5 flex items-center gap-2 text-[10px] hover:bg-panel-bg/30 transition-colors"
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      a.severity === "HIGH" || a.severity === "CRITICAL"
                        ? "bg-accent-red"
                        : a.severity === "MEDIUM"
                          ? "bg-accent-amber"
                          : "bg-accent-blue",
                    )}
                  />
                  <span className="text-panel-dim font-mono shrink-0 w-[80px] truncate">
                    {a.domain?.label || a.domain?.domain}
                  </span>
                  <span className="text-panel-text truncate flex-1">
                    {a.title}
                  </span>
                  <span className="text-panel-muted font-mono shrink-0">
                    {fmtDate(a.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cost structure */}
        {financial?.costBreakdown?.length > 0 && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] text-panel-muted uppercase tracking-wider">
                Struktura kosztów (ten miesiąc)
              </span>
              <span className="text-[10px] text-accent-red font-mono font-bold">
                {fmtNumber(Math.round(ft?.totalCosts || 0))} zł
              </span>
            </div>
            <div className="space-y-2">
              {financial.costBreakdown.map((c: any) => {
                const CATS: Record<string, { icon: string; color: string }> = {
                  GOOGLE_ADS: { icon: "📢", color: "#ef4444" },
                  INFRASTRUCTURE: { icon: "🖥️", color: "#3b82f6" },
                  TAXES: { icon: "🏛️", color: "#f59e0b" },
                  ZUS: { icon: "🏥", color: "#a855f7" },
                  TOOLS: { icon: "🔧", color: "#06b6d4" },
                  MARKETING: { icon: "📣", color: "#ec4899" },
                  OTHER: { icon: "📋", color: "#64748b" },
                };
                const cat = CATS[c.category] || {
                  icon: "📋",
                  color: "#64748b",
                };
                const pctCost =
                  ft && ft.totalCosts > 0
                    ? Math.round((c.amount / ft.totalCosts) * 100)
                    : 0;
                return (
                  <div key={c.category} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1">
                        <span>{cat.icon}</span>
                        <span className="text-panel-muted">{c.category}</span>
                      </span>
                      <span className="font-mono" style={{ color: cat.color }}>
                        {fmtNumber(Math.round(c.amount))} zł
                        <span className="text-panel-dim ml-1">{pctCost}%</span>
                      </span>
                    </div>
                    <div className="h-1 bg-panel-border/30 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(pctCost, 2)}%`,
                          backgroundColor: cat.color,
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showAddDomain && (
        <AddDomainModal onClose={() => setShowAddDomain(false)} />
      )}
    </div>
  );
}

// ─── DASHBOARD CHART — multi-metric with toggles ───

const CHART_PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  {
    label: "Ten miesiąc",
    getDates: () => {
      const n = new Date();
      return [
        n.getFullYear() +
          "-" +
          String(n.getMonth() + 1).padStart(2, "0") +
          "-01",
        fmt(n),
      ];
    },
  },
  {
    label: "Ten rok",
    getDates: () => [new Date().getFullYear() + "-01-01", fmt(new Date())],
  },
];

type MetricKey =
  | "revenue"
  | "commission"
  | "conversions"
  | "profit"
  | "adsCost"
  | "manualCosts";

const METRICS: {
  key: MetricKey;
  label: string;
  color: string;
  yAxis: "money" | "count";
  defaultOn: boolean;
}[] = [
  {
    key: "commission",
    label: "Przychód netto",
    color: "#22c55e",
    yAxis: "money",
    defaultOn: true,
  },
  {
    key: "profit",
    label: "Zysk/Strata",
    color: "#06b6d4",
    yAxis: "money",
    defaultOn: true,
  },
  {
    key: "conversions",
    label: "Konwersje",
    color: "#f59e0b",
    yAxis: "count",
    defaultOn: true,
  },
  {
    key: "revenue",
    label: "GMV",
    color: "#a855f7",
    yAxis: "money",
    defaultOn: false,
  },
  {
    key: "adsCost",
    label: "Koszt Ads",
    color: "#ef4444",
    yAxis: "money",
    defaultOn: false,
  },
  {
    key: "manualCosts",
    label: "Koszty ręczne",
    color: "#ec4899",
    yAxis: "money",
    defaultOn: false,
  },
];

function DashboardChart() {
  const [presetIdx, setPresetIdx] = useState(2); // 30d default
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [active, setActive] = useState<Set<MetricKey>>(
    () => new Set(METRICS.filter((m) => m.defaultOn).map((m) => m.key)),
  );

  const [startDate, endDate] = useMemo(() => {
    if (customStart && customEnd) return [customStart, customEnd];
    const preset = CHART_PRESETS[presetIdx];
    if ("getDates" in preset) return preset.getDates!();
    const end = fmt(new Date());
    const start = fmt(new Date(Date.now() - preset.days! * 86400000));
    return [start, end];
  }, [presetIdx, customStart, customEnd]);

  const { data, isLoading } = useQuery({
    queryKey: ["global-summary", startDate, endDate],
    queryFn: () => api.getGlobalSummary(startDate, endDate),
    staleTime: 60_000,
  });

  const toggle = (key: MetricKey) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyPreset = (idx: number) => {
    setPresetIdx(idx);
    setCustomStart("");
    setCustomEnd("");
  };

  const daily = data?.daily || [];
  const activeMetrics = METRICS.filter((m) => active.has(m.key));
  const hasMoneyAxis = activeMetrics.some((m) => m.yAxis === "money");
  const hasCountAxis = activeMetrics.some((m) => m.yAxis === "count");

  return (
    <div className="bg-panel-card border border-panel-border rounded-lg p-4">
      {/* Header: presets + custom dates */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <BarChart3 className="w-3.5 h-3.5 text-panel-muted" />
        <span className="text-[9px] text-panel-muted uppercase tracking-wider">
          Trendy
        </span>
        {CHART_PRESETS.map((p, i) => (
          <button
            key={i}
            onClick={() => applyPreset(i)}
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-mono transition-all",
              presetIdx === i && !customStart
                ? "bg-accent-blue/20 text-accent-blue font-bold"
                : "text-panel-muted hover:text-panel-text",
            )}
          >
            {p.label}
          </button>
        ))}
        <span className="text-[9px] text-panel-muted ml-1">|</span>
        <input
          type="date"
          className="input text-[9px] py-0 w-[100px]"
          value={customStart || startDate}
          onChange={(e) => {
            setCustomStart(e.target.value);
            setPresetIdx(-1);
          }}
        />
        <span className="text-[9px] text-panel-muted">→</span>
        <input
          type="date"
          className="input text-[9px] py-0 w-[100px]"
          value={customEnd || endDate}
          onChange={(e) => {
            setCustomEnd(e.target.value);
            setPresetIdx(-1);
          }}
        />
      </div>

      {/* Metric toggles */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {METRICS.map((m) => {
          const isOn = active.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono border transition-all",
                isOn
                  ? "border-current font-bold"
                  : "border-panel-border text-panel-dim opacity-50 hover:opacity-80",
              )}
              style={
                isOn ? { color: m.color, borderColor: m.color + "60" } : {}
              }
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isOn ? m.color : "#475569" }}
              />
              {m.label}
              {m.yAxis === "count" && (
                <span className="text-[7px] opacity-60">(→)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="h-[180px] flex items-center justify-center">
          <RefreshCw className="w-4 h-4 animate-spin text-panel-muted" />
        </div>
      ) : daily.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-[10px] text-panel-muted">
          Brak danych dla wybranego okresu
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={daily}>
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
            {hasMoneyAxis && (
              <YAxis
                yAxisId="money"
                tick={{ fontSize: 7, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={45}
                tickFormatter={(v: number) =>
                  `${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`
                }
              />
            )}
            {hasCountAxis && (
              <YAxis
                yAxisId="count"
                orientation="right"
                tick={{ fontSize: 7, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
            )}
            <Tooltip
              contentStyle={{
                background: "#1a2235",
                border: "1px solid #1e2a3a",
                borderRadius: "4px",
                fontSize: "9px",
              }}
              formatter={(v: number, name: string) => {
                const m = METRICS.find((mm) => mm.key === name);
                if (!m) return [v, name];
                return [
                  m.yAxis === "money" ? `${v.toFixed(2)} zł` : v,
                  m.label,
                ];
              }}
              labelFormatter={(d: string) => {
                const dt = new Date(d);
                return dt.toLocaleDateString("pl-PL");
              }}
            />
            {hasMoneyAxis && (
              <ReferenceLine
                yAxisId="money"
                y={0}
                stroke="#475569"
                strokeDasharray="2 2"
              />
            )}
            {activeMetrics.map((m) => (
              <Area
                key={m.key}
                yAxisId={m.yAxis}
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                fill="none"
                strokeWidth={
                  m.key === "profit" || m.key === "commission" ? 2 : 1.5
                }
                strokeDasharray={
                  m.key === "adsCost" || m.key === "manualCosts"
                    ? "4 2"
                    : undefined
                }
                name={m.key}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Components ───

function StatCard({
  accent,
  icon: Icon,
  value,
  label,
}: {
  accent: string;
  icon: any;
  value: string | number;
  label: string;
}) {
  return (
    <div
      className="stat-card flex-1"
      style={{ "--stat-accent": accent } as any}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-3 h-3 opacity-30" />
        <span className="text-lg font-bold font-mono tracking-tight">
          {value}
        </span>
      </div>
      <div className="text-[9px] text-panel-muted mt-0.5">{label}</div>
    </div>
  );
}

function MiniKpi({
  icon,
  label,
  value,
  color,
  bold,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bold?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon && (
          <span style={{ color }} className="opacity-50">
            {icon}
          </span>
        )}
        <span
          className={cn(
            "font-mono",
            bold ? "text-lg font-bold" : "text-sm font-semibold",
          )}
          style={{ color }}
        >
          {value}
        </span>
      </div>
      <div className="text-[8px] text-panel-muted">{label}</div>
    </div>
  );
}
