// frontend/src/components/ProfitabilityTab.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  PiggyBank,
  TrendingUp,
  Users,
  ShoppingCart,
  Target,
  RefreshCw,
} from "lucide-react";

const CHANNEL_COLORS: Record<string, string> = {
  Organic: "#22c55e",
  "Paid (Google Ads)": "#ef4444",
  Direct: "#3b82f6",
  Referral: "#f59e0b",
  Inne: "#64748b",
};

export function ProfitabilityTab({ domainId }: { domainId: string }) {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["profitability", domainId, days],
    queryFn: () => api.getProfitability(domainId, days),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-panel-muted" />
      </div>
    );
  }

  if (!data || (!data.hasGA4 && !data.hasAds)) {
    return (
      <div className="bg-panel-card border border-panel-border rounded-lg p-8 text-center text-panel-muted text-sm">
        Podłącz Google Analytics 4 i/lub Google Ads w zakładce Integracje, aby
        zobaczyć rentowność.
      </div>
    );
  }

  const t = data.totals;
  const k = data.kpis;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <PiggyBank className="w-4 h-4 text-accent-green" />
        <span className="text-xs font-semibold">Rentowność</span>
        <div className="ml-auto flex gap-1">
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
      </div>

      {/* ═══ MAIN KPI CARDS ═══ */}
      <div className="grid grid-cols-5 gap-2">
        <BigStat
          label="Sprzedaż (GMV)"
          value={`${fmtNumber(Math.round(t.revenue))} zł`}
          color="#a855f7"
          sub={`${t.conversions} zamówień`}
        />
        <BigStat
          label="Moja prowizja (12%)"
          value={`${fmtNumber(Math.round(t.commission))} zł`}
          color="#f59e0b"
        />
        <BigStat
          label="Koszt Google Ads"
          value={`${fmtNumber(Math.round(t.adsCost))} zł`}
          color="#ef4444"
        />
        <BigStat
          label={t.profit >= 0 ? "ZYSK NETTO" : "STRATA NETTO"}
          value={`${t.profit >= 0 ? "+" : ""}${fmtNumber(Math.round(t.profit))} zł`}
          color={t.profit >= 0 ? "#22c55e" : "#ef4444"}
          highlight
        />
        <BigStat
          label="Realny ROAS"
          value={`${(t.realRoas * 100).toFixed(1)}%`}
          color={t.realRoas >= 1 ? "#22c55e" : "#ef4444"}
          sub={t.realRoas >= 1 ? "zyskowne" : "stratne"}
        />
      </div>

      {/* ═══ BUSINESS KPIs ═══ */}
      <div className="grid grid-cols-7 gap-2">
        <MiniStat
          label="Śr. zamówienie"
          value={`${k.avgOrderValue.toFixed(0)} zł`}
          color="#a855f7"
        />
        <MiniStat
          label="Prowizja/zamów."
          value={`${k.commissionPerOrder.toFixed(2)} zł`}
          color="#f59e0b"
        />
        <MiniStat
          label="CAC (koszt klienta)"
          value={`${k.cac.toFixed(2)} zł`}
          color="#ef4444"
        />
        <MiniStat
          label="Konwersja"
          value={`${k.conversionRate}%`}
          color="#06b6d4"
        />
        <MiniStat
          label="Prowizja/wizytę"
          value={`${k.commissionPerVisit.toFixed(4)} zł`}
          color="#f59e0b"
        />
        <MiniStat
          label="Dni z zyskiem"
          value={`${k.profitableDays}/${k.totalDays}`}
          color={k.profitableDays > k.totalDays / 2 ? "#22c55e" : "#ef4444"}
        />
        <MiniStat
          label="Break-even/dzień"
          value={`${fmtNumber(k.breakEvenDailyRevenue)} zł`}
          color="#3b82f6"
        />
      </div>

      {/* ═══ DAILY P&L CHART ═══ */}
      {data.daily?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
            Dzienny zysk/strata — prowizja 12% minus koszt Ads
          </div>
          <ResponsiveContainer width="100%" height={200}>
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
                formatter={(v: number, name: string) => {
                  const labels: Record<string, string> = {
                    profit: "Zysk/Strata",
                    commission: "Prowizja",
                    adsCost: "Koszt Ads",
                    ga4Revenue: "Sprzedaż",
                  };
                  return [`${v.toFixed(2)} zł`, labels[name] || name];
                }}
              />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
              <Bar dataKey="profit" name="profit" radius={[2, 2, 0, 0]}>
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

      {/* ═══ COMMISSION vs COST LINE CHART ═══ */}
      {data.daily?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
            Prowizja vs Koszt Ads — linia trendu
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data.daily}>
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
                formatter={(v: number, name: string) => [
                  `${v.toFixed(2)} zł`,
                  name === "commission" ? "Prowizja" : "Koszt Ads",
                ]}
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
                dataKey="adsCost"
                stroke="#ef4444"
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                name="adsCost"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ CHANNELS ═══ */}
      <div className="grid grid-cols-2 gap-4">
        {/* Channel breakdown table */}
        {data.channels?.length > 0 && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Rentowność per kanał
            </div>
            <div className="space-y-2">
              {data.channels.map((ch: any) => {
                const color = CHANNEL_COLORS[ch.channel] || "#64748b";
                const maxRev = data.channels[0]?.revenue || 1;
                const pct = Math.round((ch.revenue / maxRev) * 100);
                return (
                  <div key={ch.channel} className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold text-panel-text">
                        {ch.channel}
                      </span>
                      <span className="ml-auto font-mono text-panel-muted">
                        {fmtNumber(ch.sessions)} sesji
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] pl-[18px]">
                      <div className="flex-1 h-1.5 bg-panel-border/30 rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            backgroundColor: color,
                            opacity: 0.5,
                          }}
                        />
                      </div>
                      <span className="text-accent-purple font-mono shrink-0">
                        {fmtNumber(Math.round(ch.revenue))} zł
                      </span>
                      <span className="text-accent-amber font-mono shrink-0">
                        {ch.commission.toFixed(2)} zł
                      </span>
                      {ch.cost > 0 && (
                        <span className="text-accent-red font-mono shrink-0">
                          −{ch.cost.toFixed(0)} zł
                        </span>
                      )}
                      <span
                        className={cn(
                          "font-mono font-bold shrink-0",
                          ch.profit >= 0
                            ? "text-accent-green"
                            : "text-accent-red",
                        )}
                      >
                        {ch.profit >= 0 ? "+" : ""}
                        {ch.profit.toFixed(2)} zł
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Revenue pie */}
        {data.channels?.length > 0 && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3 flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" /> Rozbicie sprzedaży
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data.channels.filter((c: any) => c.revenue > 0)}
                  dataKey="revenue"
                  nameKey="channel"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={35}
                  paddingAngle={2}
                >
                  {data.channels
                    .filter((c: any) => c.revenue > 0)
                    .map((ch: any, i: number) => (
                      <Cell
                        key={i}
                        fill={CHANNEL_COLORS[ch.channel] || "#64748b"}
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
                  formatter={(v: number) => [`${fmtNumber(Math.round(v))} zł`]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 justify-center">
              {data.channels
                .filter((c: any) => c.revenue > 0)
                .map((ch: any) => (
                  <div
                    key={ch.channel}
                    className="flex items-center gap-1 text-[9px]"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          CHANNEL_COLORS[ch.channel] || "#64748b",
                      }}
                    />
                    <span className="text-panel-muted">{ch.channel}</span>
                    <span className="font-mono text-panel-text">
                      {Math.round((ch.revenue / t.revenue) * 100)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ INSIGHT BOX ═══ */}
      <InsightBox data={data} />

      {/* ═══ TOP PROFITABLE PRODUCTS ═══ */}
      {data.products?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          <div className="px-4 py-2.5 border-b border-panel-border text-[10px] text-panel-muted uppercase tracking-wider flex items-center gap-1">
            <Target className="w-3 h-3" /> Top produkty wg zysku (prowizja −
            koszt Ads)
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Sprzedaż</th>
                <th>Prowizja</th>
                <th>Koszt Ads</th>
                <th>Zysk</th>
                <th>Konw.</th>
              </tr>
            </thead>
            <tbody>
              {data.products.slice(0, 30).map((p: any, i: number) => (
                <tr key={i}>
                  <td className="max-w-[280px] truncate text-panel-text">
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
                  <td className="text-accent-purple">
                    {p.conversions.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── INSIGHT BOX — automated business insights ───

function InsightBox({ data }: { data: any }) {
  const t = data.totals;
  const k = data.kpis;
  const insights: { text: string; type: "good" | "bad" | "info" }[] = [];

  // Organic revenue share
  const organicCh = data.channels?.find((c: any) => c.channel === "Organic");
  const paidCh = data.channels?.find(
    (c: any) => c.channel === "Paid (Google Ads)",
  );
  if (organicCh && t.revenue > 0) {
    const organicPct = Math.round((organicCh.revenue / t.revenue) * 100);
    if (organicPct > 50)
      insights.push({
        text: `${organicPct}% sprzedaży pochodzi z organic — darmowy ruch generuje większość przychodu.`,
        type: "good",
      });
    else
      insights.push({
        text: `Tylko ${organicPct}% sprzedaży z organic. Warto inwestować w SEO.`,
        type: "info",
      });
  }

  // Profit status
  if (t.profit >= 0)
    insights.push({
      text: `Jesteś na plusie: ${t.profit.toFixed(2)} zł zysku w ${k.totalDays} dni.`,
      type: "good",
    });
  else
    insights.push({
      text: `Strata: ${Math.abs(t.profit).toFixed(2)} zł. Koszt Ads przewyższa prowizję.`,
      type: "bad",
    });

  // CAC vs commission per order
  if (k.cac > 0 && k.commissionPerOrder > 0) {
    if (k.cac > k.commissionPerOrder)
      insights.push({
        text: `CAC (${k.cac.toFixed(2)} zł) > prowizja/zamówienie (${k.commissionPerOrder.toFixed(2)} zł). Każdy klient z Ads jest stratny.`,
        type: "bad",
      });
    else
      insights.push({
        text: `CAC (${k.cac.toFixed(2)} zł) < prowizja/zamówienie (${k.commissionPerOrder.toFixed(2)} zł). Klienci z Ads są zyskowni.`,
        type: "good",
      });
  }

  // Break-even
  if (k.breakEvenDailyRevenue > 0) {
    insights.push({
      text: `Potrzebujesz ${fmtNumber(k.breakEvenDailyRevenue)} zł sprzedaży dziennie, żeby pokryć koszt Ads.`,
      type: "info",
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="bg-panel-card border border-panel-border rounded-lg p-4 space-y-2">
      <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-1">
        Wnioski biznesowe
      </div>
      {insights.map((ins, i) => (
        <div
          key={i}
          className={cn(
            "text-[11px] flex items-start gap-2 px-2 py-1.5 rounded",
            ins.type === "good"
              ? "bg-accent-green/5 text-accent-green"
              : ins.type === "bad"
                ? "bg-accent-red/5 text-accent-red"
                : "bg-accent-blue/5 text-accent-blue",
          )}
        >
          <span className="shrink-0">
            {ins.type === "good" ? "✓" : ins.type === "bad" ? "✗" : "ℹ"}
          </span>
          <span>{ins.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── STAT CARDS ───

function BigStat({
  label,
  value,
  color,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn("stat-card", highlight && "ring-1 ring-current/20")}
      style={{ "--stat-accent": color } as any}
    >
      <div className="text-lg font-bold font-mono" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] text-panel-muted">{label}</div>
      {sub && <div className="text-[9px] text-panel-dim mt-0.5">{sub}</div>}
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
