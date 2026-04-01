// frontend/src/components/DomainConversionsTab.tsx

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
} from "recharts";
import {
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Target,
  Search,
  Monitor,
  Smartphone,
  Tablet,
  ArrowDown,
  Filter,
  Key,
  BarChart3,
} from "lucide-react";

const STOJAN_DOMAIN_ID = "cmn9fo4dn0004qrdye8hjou1g";

type SubTab = "overview" | "keywords" | "funnel" | "top-pages";

export function DomainConversionsTab({ domainId }: { domainId: string }) {
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [days, setDays] = useState(30);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const isCustom = !!(customFrom && customTo);
  const isStojan = domainId === STOJAN_DOMAIN_ID;

  const TABS: { key: SubTab; label: string; icon: any }[] = [
    { key: "overview", label: "Przegląd", icon: BarChart3 },
    { key: "keywords", label: "Słowa → Konwersje", icon: Key },
    { key: "funnel", label: "Funnel", icon: Filter },
    { key: "top-pages", label: "Top Strony", icon: Target },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => {
                setDays(d);
                setCustomFrom("");
                setCustomTo("");
              }}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono",
                days === d && !isCustom
                  ? "bg-accent-blue/20 text-accent-blue font-semibold"
                  : "text-panel-muted hover:text-panel-text",
              )}
            >
              {d}d
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-panel-muted">od:</span>
          <input
            type="date"
            className="input text-[10px] py-0.5 w-[110px]"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <span className="text-[10px] text-panel-muted">do:</span>
          <input
            type="date"
            className="input text-[10px] py-0.5 w-[110px]"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
          />
          {isCustom && (
            <button
              className="text-[10px] text-accent-red hover:underline"
              onClick={() => {
                setCustomFrom("");
                setCustomTo("");
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-panel-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium border-b-2 transition-all -mb-px whitespace-nowrap",
              subTab === t.key
                ? "border-accent-green text-accent-green"
                : "border-transparent text-panel-muted hover:text-panel-text",
            )}
          >
            <t.icon className="w-3 h-3" />
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "overview" && (
        <OverviewSection
          domainId={domainId}
          days={days}
          startDate={customFrom}
          endDate={customTo}
          isStojan={isStojan}
        />
      )}
      {subTab === "keywords" && (
        <KeywordsSection
          domainId={domainId}
          days={days}
          startDate={customFrom}
          endDate={customTo}
        />
      )}
      {subTab === "funnel" && (
        <FunnelSection
          domainId={domainId}
          days={days}
          startDate={customFrom}
          endDate={customTo}
        />
      )}
      {subTab === "top-pages" && (
        <TopPagesSection
          domainId={domainId}
          days={days}
          startDate={customFrom}
          endDate={customTo}
          isStojan={isStojan}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════

function OverviewSection({
  domainId,
  days,
  startDate,
  endDate,
  isStojan,
}: {
  domainId: string;
  days: number;
  startDate?: string;
  endDate?: string;
  isStojan: boolean;
}) {
  const isCustom = !!(startDate && endDate);
  const { data, isLoading } = useQuery({
    queryKey: ["conv-overview", domainId, days, startDate, endDate],
    queryFn: () =>
      api.getConversionOverview(domainId, days, startDate, endDate),
    enabled: !!domainId,
  });

  if (isLoading) return <Spinner />;
  if (data?.error)
    return <Info message={data.message || "Brak integracji GA4"} />;
  if (!data) return null;

  const t = data.totals;
  const comp = data.comparison;

  return (
    <div className="space-y-4">
      <div
        className={cn("grid gap-2", isStojan ? "grid-cols-5" : "grid-cols-4")}
      >
        <Stat
          label="Konwersje"
          value={t.conversions}
          color="#22c55e"
          change={comp?.change?.conversions}
        />
        <Stat
          label="Przychód"
          value={`${t.revenue.toFixed(0)} zł`}
          color="#a855f7"
          change={comp?.change?.revenue}
        />
        {isStojan && (
          <Stat
            label="Prowizja (12%)"
            value={`${t.commission.toFixed(0)} zł`}
            color="#f59e0b"
          />
        )}
        <Stat
          label="Conv. Rate"
          value={`${t.conversionRate}%`}
          color="#06b6d4"
        />
        <Stat
          label="Śr. zamówienie"
          value={`${t.avgOrderValue.toFixed(0)} zł`}
          color="#3b82f6"
        />
      </div>

      {comp && (
        <div className="flex gap-3 text-[10px]">
          <Delta label="Konwersje" change={comp.change.conversions} />
          <Delta label="Przychód" change={comp.change.revenue} />
          <Delta label="Sesje" change={comp.change.sessions} />
        </div>
      )}

      {data.daily.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
            Konwersje i przychód —{" "}
            {isCustom ? `${startDate} → ${endDate}` : `${days}d`}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data.daily}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 7, fill: "#64748b" }}
                tickFormatter={fmtTick}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 7, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 7, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => `${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={ttStyle}
                formatter={(v: number, n: string) => [
                  n === "revenue" ? `${v.toFixed(0)} zł` : v,
                  n === "conversions" ? "Konwersje" : "Przychód",
                ]}
              />
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="conversions"
                stroke="#22c55e"
                fill="url(#cg)"
                strokeWidth={2}
                name="conversions"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="#a855f7"
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                name="revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {data.byChannel?.length > 0 && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-3">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
              Per kanał
            </div>
            <div className="space-y-1.5">
              {data.byChannel.map((ch: any) => (
                <div
                  key={ch.channel}
                  className="flex items-center gap-2 text-[10px]"
                >
                  <span className="text-panel-dim w-[100px] truncate">
                    {ch.channel}
                  </span>
                  <div className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-green"
                      style={{
                        width: `${t.conversions > 0 ? (ch.conversions / t.conversions) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-accent-green font-mono w-[25px] text-right">
                    {ch.conversions}
                  </span>
                  <span className="text-accent-purple font-mono w-[50px] text-right">
                    {ch.revenue.toFixed(0)} zł
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.byDevice?.length > 0 && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-3">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
              Per urządzenie
            </div>
            <div className="space-y-2">
              {data.byDevice.map((d: any) => {
                const Icon =
                  d.device === "desktop"
                    ? Monitor
                    : d.device === "mobile"
                      ? Smartphone
                      : Tablet;
                return (
                  <div
                    key={d.device}
                    className="flex items-center gap-2 text-[10px]"
                  >
                    <Icon className="w-3 h-3 text-panel-muted" />
                    <span className="w-[55px] capitalize">{d.device}</span>
                    <span className="text-panel-muted">{d.sessions} ses.</span>
                    <span className="text-accent-green font-semibold">
                      {d.conversions}
                    </span>
                    <span className="text-accent-purple font-mono">
                      {d.revenue.toFixed(0)} zł
                    </span>
                    <span className="ml-auto text-accent-cyan font-mono">
                      {(d.conversionRate * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// KEYWORDS
// ═══════════════════════════════════════════════════════════

function KeywordsSection({
  domainId,
  days,
  startDate,
  endDate,
}: {
  domainId: string;
  days: number;
  startDate?: string;
  endDate?: string;
}) {
  const [search, setSearch] = useState("");
  const [showCount, setShowCount] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ["conv-keywords", domainId, days, startDate, endDate],
    queryFn: () =>
      api.getConversionKeywords(domainId, days, 100, startDate, endDate),
    enabled: !!domainId,
  });

  if (isLoading) return <Spinner />;
  if (data?.error) return <Info message={data.message} />;
  if (!data) return null;

  const keywords = (data.aggregatedKeywords || []).filter(
    (kw: any) =>
      !search || kw.keyword.toLowerCase().includes(search.toLowerCase()),
  );
  const visible = keywords.slice(0, showCount);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <Mini
          label="Stron z konw."
          value={data.stats.totalCorrelatedPages}
          color="#22c55e"
        />
        <Mini
          label="Stron z queries"
          value={data.stats.pagesWithQueries}
          color="#06b6d4"
        />
        <Mini
          label="Keywords"
          value={data.stats.totalAggregatedKeywords}
          color="#a855f7"
        />
        <Mini
          label="Ads terms"
          value={data.stats.totalAdsKeywords}
          color="#f59e0b"
        />
      </div>

      <input
        className="input text-xs w-64"
        placeholder="Szukaj keyword..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowCount(50);
        }}
      />

      <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Źródła</th>
              <th>GSC klik.</th>
              <th>Pozycja</th>
              <th>Ads klik.</th>
              <th>Est. conv.</th>
              <th>Total conv.</th>
              <th>Przychód</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((kw: any, i: number) => (
              <tr key={i}>
                <td className="max-w-[180px] truncate font-medium">
                  {kw.keyword}
                </td>
                <td>
                  <div className="flex gap-0.5">
                    {kw.sources.map((s: string) => (
                      <span
                        key={s}
                        className={cn(
                          "badge text-[8px]",
                          s === "GSC" ? "badge-pass" : "badge-neutral",
                        )}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="text-accent-cyan font-mono">{kw.gscClicks}</td>
                <td className="text-panel-muted font-mono">
                  {kw.gscPosition || "—"}
                </td>
                <td className="text-accent-blue font-mono">
                  {kw.adsClicks || "—"}
                </td>
                <td className="text-accent-amber font-mono">
                  {kw.estimatedConversions > 0
                    ? `~${kw.estimatedConversions.toFixed(1)}`
                    : "—"}
                </td>
                <td className="text-accent-green font-bold font-mono">
                  {kw.totalConversions > 0
                    ? kw.totalConversions.toFixed(1)
                    : "—"}
                </td>
                <td className="text-accent-purple font-mono">
                  {kw.totalRevenue > 0
                    ? `${kw.totalRevenue.toFixed(0)} zł`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length < keywords.length && (
          <div className="px-4 py-2 text-[10px] text-panel-muted border-t border-panel-border flex justify-between">
            <span>
              {visible.length} z {keywords.length}
            </span>
            <button
              onClick={() => setShowCount(showCount + 50)}
              className="text-accent-blue hover:underline"
            >
              Pokaż kolejne →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FUNNEL
// ═══════════════════════════════════════════════════════════

function FunnelSection({
  domainId,
  days,
  startDate,
  endDate,
}: {
  domainId: string;
  days: number;
  startDate?: string;
  endDate?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["conv-funnel", domainId, days, startDate, endDate],
    queryFn: () => api.getConversionFunnel(domainId, days, startDate, endDate),
    enabled: !!domainId,
  });

  if (isLoading) return <Spinner />;
  if (data?.error || !data?.funnel?.length)
    return (
      <Info message="Brak danych funnel. Sprawdź eventy e-commerce w GA4." />
    );

  const maxUsers = Math.max(...data.funnel.map((s: any) => s.users), 1);

  return (
    <div className="space-y-3">
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3">
          E-commerce Funnel — {days}d
        </div>
        <div className="space-y-2">
          {data.funnel.map((step: any, i: number) => (
            <div key={step.event}>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-panel-dim w-[130px] truncate">
                  {step.label}
                </span>
                <div className="flex-1 h-6 bg-panel-border/30 rounded relative overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(step.users / maxUsers) * 100}%`,
                      background: `linear-gradient(90deg, #22c55e ${100 - step.dropOff}%, #ef4444 100%)`,
                      opacity: 0.7 + 0.3 * (1 - i / data.funnel.length),
                    }}
                  />
                  <div className="absolute inset-0 flex items-center px-2 text-[9px] font-mono font-semibold text-white">
                    {fmtNumber(step.users)} users
                  </div>
                </div>
                <span className="text-[10px] text-panel-muted w-[50px] text-right">
                  {step.overallRate}%
                </span>
              </div>
              {i < data.funnel.length - 1 && step.dropOff > 0 && (
                <div className="ml-[142px] flex items-center gap-1 text-[9px] text-accent-red py-0.5">
                  <ArrowDown className="w-2.5 h-2.5" />−{step.dropOff}% drop-off
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {data.funnelByDevice?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Urządzenie</th>
                <th>View</th>
                <th>Cart</th>
                <th>Checkout</th>
                <th>Purchase</th>
                <th>Cart%</th>
                <th>Purchase%</th>
                <th>Overall</th>
              </tr>
            </thead>
            <tbody>
              {data.funnelByDevice.map((d: any) => (
                <tr key={d.device}>
                  <td className="capitalize">{d.device}</td>
                  <td>{d.viewItem}</td>
                  <td>{d.addToCart}</td>
                  <td>{d.checkout}</td>
                  <td className="text-accent-green font-semibold">
                    {d.purchase}
                  </td>
                  <td className="text-accent-cyan font-mono">{d.cartRate}%</td>
                  <td className="text-accent-purple font-mono">
                    {d.purchaseRate}%
                  </td>
                  <td className="text-accent-green font-mono font-bold">
                    {d.overallRate}%
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

// ═══════════════════════════════════════════════════════════
// TOP PAGES
// ═══════════════════════════════════════════════════════════

function TopPagesSection({
  domainId,
  days,
  startDate,
  endDate,
  isStojan,
}: {
  domainId: string;
  days: number;
  startDate?: string;
  endDate?: string;
  isStojan: boolean;
}) {
  const [showCount, setShowCount] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ["conv-top-pages", domainId, days, startDate, endDate],
    queryFn: () =>
      api.getConversionTopPages(domainId, days, 50, startDate, endDate),
    enabled: !!domainId,
  });

  if (isLoading) return <Spinner />;
  if (!data?.length)
    return <Info message="Brak danych o konwersjach per strona" />;

  const visible = data.slice(0, showCount);

  return (
    <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>URL</th>
            <th>Sesje</th>
            <th>Conv.</th>
            <th>CR%</th>
            <th>Przychód</th>
            {isStojan && <th>Prowizja</th>}
            <th>zł/sesję</th>
            <th>GSC klik.</th>
            <th>GSC poz.</th>
            <th>Indeks</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p: any, i: number) => (
            <tr key={i}>
              <td className="max-w-[200px] truncate">
                <a
                  href={p.path.startsWith("/") ? undefined : p.path}
                  target="_blank"
                  className="text-accent-blue hover:underline text-[10px] font-mono"
                >
                  {p.path.split("?")[0]}
                </a>
              </td>
              <td className="text-panel-muted font-mono">{p.sessions}</td>
              <td className="text-accent-green font-semibold">
                {p.conversions}
              </td>
              <td className="text-accent-cyan font-mono">
                {p.conversionRate}%
              </td>
              <td className="text-accent-purple font-mono font-semibold">
                {p.revenue.toFixed(0)} zł
              </td>
              {isStojan && (
                <td className="text-accent-amber font-mono">
                  {p.commission.toFixed(0)} zł
                </td>
              )}
              <td className="text-panel-muted font-mono">
                {p.revenuePerSession.toFixed(1)}
              </td>
              <td className="text-accent-cyan">{p.gscClicks || "—"}</td>
              <td className="text-accent-amber font-mono">
                {p.gscPosition ? p.gscPosition.toFixed(1) : "—"}
              </td>
              <td>
                {p.indexingVerdict && (
                  <span
                    className={cn(
                      "badge text-[8px]",
                      p.indexingVerdict === "PASS"
                        ? "badge-pass"
                        : p.indexingVerdict === "FAIL"
                          ? "badge-fail"
                          : "badge-neutral",
                    )}
                  >
                    {p.indexingVerdict}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible.length < data.length && (
        <div className="px-4 py-2 text-[10px] text-panel-muted border-t border-panel-border flex justify-between">
          <span>
            {visible.length} z {data.length}
          </span>
          <button
            onClick={() => setShowCount(showCount + 50)}
            className="text-accent-blue hover:underline"
          >
            Pokaż kolejne →
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SHARED
// ═══════════════════════════════════════════════════════════

const ttStyle = {
  background: "#1a2235",
  border: "1px solid #1e2a3a",
  borderRadius: "4px",
  fontSize: "9px",
};
function fmtTick(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()}.${dt.getMonth() + 1}`;
}

function Stat({
  label,
  value,
  color,
  change,
}: {
  label: string;
  value: string | number;
  color: string;
  change?: number;
}) {
  return (
    <div className="stat-card" style={{ "--stat-accent": color } as any}>
      <div className="flex items-center gap-1.5">
        <span className="text-lg font-bold font-mono" style={{ color }}>
          {value}
        </span>
        {change !== undefined && change !== 0 && (
          <span
            className={cn(
              "text-[9px] font-mono flex items-center",
              change > 0 ? "text-accent-green" : "text-accent-red",
            )}
          >
            {change > 0 ? (
              <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
            ) : (
              <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
            )}
            {change > 0 ? "+" : ""}
            {(change * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="text-[9px] text-panel-muted mt-0.5">{label}</div>
    </div>
  );
}

function Delta({ label, change }: { label: string; change: number }) {
  const pct = (change * 100).toFixed(1);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono",
        change > 0
          ? "bg-accent-green/10 text-accent-green"
          : change < 0
            ? "bg-accent-red/10 text-accent-red"
            : "bg-panel-border text-panel-muted",
      )}
    >
      {change > 0 ? "↑+" : change < 0 ? "↓" : "="}
      {pct}% {label}
    </span>
  );
}

function Mini({
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

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-4 h-4 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Info({ message }: { message: string }) {
  return (
    <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-lg p-4 text-center text-xs text-panel-muted">
      {message}
    </div>
  );
}
