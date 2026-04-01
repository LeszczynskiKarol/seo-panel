// frontend/src/components/GlobalProfitabilityPanel.tsx

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { cn, fmtNumber } from "../lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Plus,
  X,
  Calendar,
  RefreshCw,
  Percent,
} from "lucide-react";

// ─── CONSTANTS ───

const COST_CATEGORIES: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  GOOGLE_ADS: { label: "Google Ads", icon: "📢", color: "#ef4444" },
  INFRASTRUCTURE: { label: "Infrastruktura", icon: "🖥️", color: "#3b82f6" },
  TAXES: { label: "Podatki", icon: "🏛️", color: "#f59e0b" },
  ZUS: { label: "Składki ZUS", icon: "🏥", color: "#a855f7" },
  TOOLS: { label: "Narzędzia", icon: "🔧", color: "#06b6d4" },
  MARKETING: { label: "Marketing", icon: "📣", color: "#ec4899" },
  OTHER: { label: "Inne", icon: "📋", color: "#64748b" },
};

const PRESETS = [
  {
    label: "Dziś",
    getDates: () => {
      const d = fmt(new Date());
      return [d, d];
    },
  },
  {
    label: "Wczoraj",
    getDates: () => {
      const d = fmt(new Date(Date.now() - 86400000));
      return [d, d];
    },
  },
  {
    label: "7d",
    getDates: () => [fmt(new Date(Date.now() - 7 * 86400000)), fmt(new Date())],
  },
  {
    label: "30d",
    getDates: () => [
      fmt(new Date(Date.now() - 30 * 86400000)),
      fmt(new Date()),
    ],
  },
  {
    label: "W tym miesiącu",
    getDates: () => {
      const now = new Date();
      return [
        now.getFullYear() +
          "-" +
          String(now.getMonth() + 1).padStart(2, "0") +
          "-01",
        fmt(now),
      ];
    },
  },
  {
    label: "Poprzedni miesiąc",
    getDates: () => {
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return [fmt(prevMonth), fmt(lastDay)];
    },
  },
  {
    label: "90d",
    getDates: () => [
      fmt(new Date(Date.now() - 90 * 86400000)),
      fmt(new Date()),
    ],
  },
  {
    label: "W tym roku",
    getDates: () => [new Date().getFullYear() + "-01-01", fmt(new Date())],
  },
];

function fmt(d: Date) {
  return d.toISOString().split("T")[0];
}

// ─── MAIN COMPONENT ───

export function GlobalProfitabilityPanel() {
  const qc = useQueryClient();
  const [presetIdx, setPresetIdx] = useState(4); // default: W tym miesiącu
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [compare, setCompare] = useState(false);
  const [showAddCost, setShowAddCost] = useState(false);
  const [showCostsTable, setShowCostsTable] = useState(false);

  // Calculate dates
  const [startDate, endDate] = useMemo(() => {
    if (customStart && customEnd) return [customStart, customEnd];
    return PRESETS[presetIdx].getDates();
  }, [presetIdx, customStart, customEnd]);

  // Calculate previous period for comparison
  const days =
    Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
    ) + 1;
  const prevStart = fmt(
    new Date(new Date(startDate).getTime() - days * 86400000),
  );
  const prevEnd = fmt(new Date(new Date(startDate).getTime() - 86400000));

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ["global-summary", startDate, endDate],
    queryFn: () => api.getGlobalSummary(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });

  const { data: prevData } = useQuery({
    queryKey: ["global-summary-prev", prevStart, prevEnd],
    queryFn: () => api.getGlobalSummary(prevStart, prevEnd),
    enabled: compare && !!prevStart && !!prevEnd,
  });

  const { data: costs, refetch: refetchCosts } = useQuery({
    queryKey: ["costs", startDate, endDate],
    queryFn: () => api.getCosts(`startDate=${startDate}&endDate=${endDate}`),
    enabled: showCostsTable,
  });

  const applyPreset = (idx: number) => {
    setPresetIdx(idx);
    setCustomStart("");
    setCustomEnd("");
  };

  const applyCustom = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    setPresetIdx(-1);
  };

  if (isLoading) {
    return (
      <div className="bg-panel-card border border-panel-border rounded-lg p-8 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-panel-muted" />
      </div>
    );
  }

  if (!data?.totals) return null;

  const t = data.totals;
  const pt = prevData?.totals;

  return (
    <div className="space-y-4">
      {/* ═══ HEADER + PERIOD SELECTOR ═══ */}
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-accent-green" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Podsumowanie globalne
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddCost(true)}
              className="btn btn-primary text-[10px] flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Dodaj koszt
            </button>
            <button
              onClick={() => setShowCostsTable(!showCostsTable)}
              className={cn(
                "btn btn-ghost text-[10px]",
                showCostsTable && "bg-accent-blue/10 text-accent-blue",
              )}
            >
              Historia kosztów
            </button>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-panel-muted" />
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(i)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono transition-all",
                presetIdx === i && !customStart
                  ? "bg-accent-blue/20 text-accent-blue font-semibold"
                  : "text-panel-muted hover:text-panel-text",
              )}
            >
              {p.label}
            </button>
          ))}
          <span className="text-[9px] text-panel-muted ml-1">lub:</span>
          <input
            type="date"
            className="input text-[10px] py-0.5 w-[110px]"
            value={customStart || startDate}
            onChange={(e) => applyCustom(e.target.value, customEnd || endDate)}
          />
          <span className="text-[9px] text-panel-muted">→</span>
          <input
            type="date"
            className="input text-[10px] py-0.5 w-[110px]"
            value={customEnd || endDate}
            onChange={(e) =>
              applyCustom(customStart || startDate, e.target.value)
            }
          />
          <div className="ml-2 border-l border-panel-border pl-2">
            <button
              onClick={() => setCompare(!compare)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] transition-all",
                compare
                  ? "bg-accent-purple/20 text-accent-purple font-semibold"
                  : "text-panel-muted hover:text-panel-text",
              )}
            >
              vs poprzedni okres
            </button>
          </div>
          <span className="text-[9px] text-panel-muted ml-auto font-mono">
            {days}d
          </span>
        </div>
      </div>

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-5 gap-2">
        <KpiCard
          label="Przychód netto"
          value={t.commission}
          prev={compare ? pt?.commission : undefined}
          format="pln"
          color="#22c55e"
          icon={<TrendingUp className="w-4 h-4" />}
          sub={`GMV: ${fmtNumber(Math.round(t.revenue))} zł`}
        />
        <KpiCard
          label="Koszty łączne"
          value={t.totalCosts}
          prev={compare ? pt?.totalCosts : undefined}
          format="pln"
          color="#ef4444"
          icon={<TrendingDown className="w-4 h-4" />}
          positiveIsBad
        />
        <KpiCard
          label={t.profit >= 0 ? "ZYSK NETTO" : "STRATA NETTO"}
          value={t.profit}
          prev={compare ? pt?.profit : undefined}
          format="pln-signed"
          color={t.profit >= 0 ? "#22c55e" : "#ef4444"}
          highlight
        />
        <KpiCard
          label="Konwersje"
          value={t.conversions}
          prev={compare ? pt?.conversions : undefined}
          format="number"
          color="#06b6d4"
          icon={<ShoppingCart className="w-4 h-4" />}
        />
        <KpiCard
          label="Marża"
          value={t.margin}
          prev={compare ? pt?.margin : undefined}
          format="percent"
          color={t.margin >= 0 ? "#22c55e" : "#ef4444"}
          icon={<Percent className="w-4 h-4" />}
        />
      </div>

      {/* ═══ CHARTS ROW ═══ */}
      <div className="grid grid-cols-3 gap-3">
        {/* Daily profit bar chart */}
        {data.daily?.length > 0 && (
          <div className="col-span-2 bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
              Dzienny zysk/strata
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.daily}>
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
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a2235",
                    border: "1px solid #1e2a3a",
                    borderRadius: "4px",
                    fontSize: "9px",
                  }}
                  formatter={(v: number) => [
                    `${v.toFixed(2)} zł`,
                    "Zysk/Strata",
                  ]}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
                <Bar dataKey="profit" radius={[2, 2, 0, 0]}>
                  {data.daily.map((d: any, i: number) => (
                    <Cell
                      key={i}
                      fill={d.profit >= 0 ? "#22c55e" : "#ef4444"}
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Cost breakdown pie */}
        {data.costBreakdown?.length > 0 && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
              Struktura kosztów
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={data.costBreakdown}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={50}
                  innerRadius={25}
                  paddingAngle={2}
                >
                  {data.costBreakdown.map((c: any, i: number) => (
                    <Cell
                      key={i}
                      fill={COST_CATEGORIES[c.category]?.color || "#64748b"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#1a2235",
                    border: "1px solid #1e2a3a",
                    borderRadius: "4px",
                    fontSize: "9px",
                  }}
                  formatter={(v: number, name: string) => [
                    `${fmtNumber(Math.round(v as number))} zł`,
                    COST_CATEGORIES[name]?.label || name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {data.costBreakdown.map((c: any) => {
                const cat = COST_CATEGORIES[c.category] || {
                  label: c.category,
                  icon: "📋",
                  color: "#64748b",
                };
                const pct =
                  t.totalCosts > 0
                    ? Math.round((c.amount / t.totalCosts) * 100)
                    : 0;
                return (
                  <div
                    key={c.category}
                    className="flex items-center gap-1.5 text-[10px]"
                  >
                    <span>{cat.icon}</span>
                    <span className="text-panel-muted flex-1">{cat.label}</span>
                    <span className="font-mono" style={{ color: cat.color }}>
                      {fmtNumber(Math.round(c.amount))} zł
                    </span>
                    <span className="text-panel-dim font-mono w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ DOMAIN REVENUE BREAKDOWN ═══ */}
      {data.domainBreakdown?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
            Przychód per domena
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {data.domainBreakdown.map((d: any) => (
              <div
                key={d.domainId}
                className="flex items-center gap-2 text-[11px] bg-panel-bg/30 rounded px-2 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-panel-text truncate">
                    {d.label}
                  </div>
                  <div className="text-panel-muted text-[9px]">
                    {d.isCommissionBased ? "prowizja 12%" : "bezpośredni"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-accent-green">
                    {fmtNumber(Math.round(d.commission))} zł
                  </div>
                  {d.isCommissionBased && (
                    <div className="text-[9px] text-panel-dim font-mono">
                      GMV: {fmtNumber(Math.round(d.revenue))} zł
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ COSTS TABLE ═══ */}
      {showCostsTable && (
        <CostsTable
          costs={costs || []}
          onRefresh={refetchCosts}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* ═══ ADD COST MODAL ═══ */}
      {showAddCost && (
        <AddCostModal
          onClose={() => setShowAddCost(false)}
          onAdded={() => {
            qc.invalidateQueries({ queryKey: ["global-summary"] });
            qc.invalidateQueries({ queryKey: ["costs"] });
          }}
        />
      )}
    </div>
  );
}

// ─── KPI CARD ───

function KpiCard({
  label,
  value,
  prev,
  format,
  color,
  icon,
  sub,
  highlight,
  positiveIsBad,
}: {
  label: string;
  value: number;
  prev?: number;
  format: string;
  color: string;
  icon?: React.ReactNode;
  sub?: string;
  highlight?: boolean;
  positiveIsBad?: boolean;
}) {
  const formatted =
    format === "pln"
      ? `${fmtNumber(Math.round(value))} zł`
      : format === "pln-signed"
        ? `${value >= 0 ? "+" : ""}${fmtNumber(Math.round(value))} zł`
        : format === "percent"
          ? `${value.toFixed(1)}%`
          : fmtNumber(value);

  const delta = prev != null ? value - prev : null;
  const deltaPct =
    prev && prev !== 0
      ? Math.round(((value - prev) / Math.abs(prev)) * 100)
      : null;
  const isGood = delta != null ? (positiveIsBad ? delta < 0 : delta > 0) : null;

  return (
    <div
      className={cn("stat-card", highlight && "ring-1 ring-current/20")}
      style={{ "--stat-accent": color } as any}
    >
      <div className="flex items-center gap-1 mb-1">
        {icon && <span style={{ color }}>{icon}</span>}
        <span className="text-[9px] text-panel-muted">{label}</span>
      </div>
      <div className="text-lg font-bold font-mono" style={{ color }}>
        {formatted}
      </div>
      {sub && <div className="text-[9px] text-panel-dim">{sub}</div>}
      {delta != null && deltaPct != null && (
        <div
          className={cn(
            "text-[9px] font-mono mt-0.5",
            isGood
              ? "text-accent-green"
              : isGood === false
                ? "text-accent-red"
                : "text-panel-muted",
          )}
        >
          {delta > 0 ? "+" : ""}
          {format === "percent"
            ? `${delta.toFixed(1)} pp`
            : `${fmtNumber(Math.round(delta))} zł`}{" "}
          ({deltaPct > 0 ? "+" : ""}
          {deltaPct}%)
        </div>
      )}
    </div>
  );
}

// ─── COSTS TABLE ───

function CostsTable({
  costs,
  onRefresh,
  startDate,
  endDate,
}: {
  costs: any[];
  onRefresh: () => void;
  startDate: string;
  endDate: string;
}) {
  const qc = useQueryClient();

  const deleteCost = useMutation({
    mutationFn: (id: string) => api.deleteCost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costs"] });
      qc.invalidateQueries({ queryKey: ["global-summary"] });
    },
  });

  return (
    <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
      <div className="px-4 py-2.5 border-b border-panel-border flex items-center gap-2">
        <span className="text-[10px] text-panel-muted uppercase tracking-wider">
          Koszty ręczne ({startDate} → {endDate})
        </span>
        <span className="text-[10px] text-panel-dim ml-auto">
          {costs.length} wpisów
        </span>
      </div>
      {costs.length === 0 ? (
        <div className="p-6 text-center text-panel-muted text-sm">
          Brak ręcznych kosztów w tym okresie
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Kategoria</th>
              <th>Opis</th>
              <th>Kwota</th>
              <th>Domena</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {costs.map((c: any) => {
              const cat = COST_CATEGORIES[c.category] || {
                label: c.category,
                icon: "📋",
                color: "#64748b",
              };
              return (
                <tr key={c.id}>
                  <td className="text-panel-muted font-mono">
                    {new Date(c.date).toLocaleDateString("pl-PL")}
                  </td>
                  <td>
                    <span className="flex items-center gap-1 text-[10px]">
                      <span>{cat.icon}</span>
                      <span style={{ color: cat.color }}>{cat.label}</span>
                    </span>
                  </td>
                  <td className="text-panel-text">{c.label}</td>
                  <td className="text-accent-red font-mono font-bold">
                    {c.amount.toFixed(2)} zł
                  </td>
                  <td className="text-panel-muted">
                    {c.domain?.label || c.domain?.domain || "—"}
                  </td>
                  <td>
                    <button
                      onClick={() => deleteCost.mutate(c.id)}
                      className="text-panel-muted hover:text-accent-red text-[10px]"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── ADD COST MODAL ───

function AddCostModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [category, setCategory] = useState("INFRASTRUCTURE");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(fmt(new Date()));
  const [domainId, setDomainId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: api.getDomains,
  });

  const addCost = useMutation({
    mutationFn: (data: any) => api.addCost(data),
    onSuccess: () => {
      onAdded();
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!label || !amount || !date) return;
    addCost.mutate({
      category,
      label,
      amount: parseFloat(amount),
      date,
      domainId: domainId || null,
      isRecurring,
      notes: notes || null,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-panel-card border border-panel-border rounded-xl p-6 w-[480px] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Dodaj koszt</h3>
          <button
            onClick={onClose}
            className="text-panel-muted hover:text-panel-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category */}
        <div>
          <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
            Kategoria
          </label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(COST_CATEGORIES)
              .filter(([k]) => k !== "GOOGLE_ADS")
              .map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] border transition-all flex items-center gap-1",
                    category === key
                      ? "border-accent-blue bg-accent-blue/10 text-accent-blue"
                      : "border-panel-border text-panel-muted hover:text-panel-text",
                  )}
                >
                  <span>{cat.icon}</span> {cat.label}
                </button>
              ))}
          </div>
        </div>

        {/* Label */}
        <div>
          <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
            Opis
          </label>
          <input
            className="input w-full"
            placeholder="np. AWS EC2 eu-central-1, ZUS marzec 2026..."
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {/* Amount + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
              Kwota (PLN)
            </label>
            <input
              className="input w-full"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
              Data
            </label>
            <input
              className="input w-full"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Domain (optional) */}
        <div>
          <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
            Domena (opcjonalnie)
          </label>
          <select
            className="input w-full"
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
          >
            <option value="">— Ogólny (nie przypisany) —</option>
            {(domains || []).map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.label || d.domain}
              </option>
            ))}
          </select>
        </div>

        {/* Recurring + Notes */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[11px] text-panel-muted cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="rounded"
            />
            Powtarzalny miesięcznie
          </label>
        </div>

        <div>
          <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
            Notatki (opcjonalnie)
          </label>
          <textarea
            className="input w-full h-16 resize-none"
            placeholder="Dodatkowe informacje..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost text-xs">
            Anuluj
          </button>
          <button
            onClick={handleSubmit}
            disabled={!label || !amount || addCost.isPending}
            className="btn btn-primary text-xs flex items-center gap-1"
          >
            {addCost.isPending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            Dodaj koszt
          </button>
        </div>
      </div>
    </div>
  );
}
