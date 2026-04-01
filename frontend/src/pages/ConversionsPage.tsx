// frontend/src/pages/ConversionsPage.tsx

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
  Globe,
  ArrowRight,
  ArrowDown,
  Zap,
  Filter,
  Key,
  BarChart3,
} from "lucide-react";

type Tab = "overview" | "keywords" | "funnel" | "top-pages";

export function ConversionsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [days, setDays] = useState(30);

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: () => api.getDomains(),
  });

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Przegląd", icon: BarChart3 },
    { key: "keywords", label: "Słowa → Konwersje", icon: Key },
    { key: "funnel", label: "Funnel", icon: Filter },
    { key: "top-pages", label: "Top Strony", icon: Target },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-accent-green" />
          Konwersje
        </h1>
        <p className="text-sm text-panel-muted mt-0.5">
          Analiza konwersji, funnel e-commerce, korelacja słów kluczowych z
          konwersjami
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-panel-muted">Domena:</span>
          <select
            className="input text-xs py-1.5"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
          >
            <option value="">— Wybierz domenę —</option>
            {(domains || []).map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.label || d.domain}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-mono",
                days === d
                  ? "bg-accent-blue/20 text-accent-blue font-semibold"
                  : "text-panel-muted hover:text-panel-text",
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {!selectedDomain ? (
        <div className="bg-panel-card border border-panel-border rounded-lg p-12 text-center">
          <ShoppingCart className="w-8 h-8 text-panel-muted mx-auto mb-3 opacity-30" />
          <div className="text-sm text-panel-muted">
            Wybierz domenę z integracja GA4 aby zobaczyć dane konwersji
          </div>
        </div>
      ) : (
        <>
          {/* Tab nav */}
          <div className="flex gap-1 border-b border-panel-border overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-all -mb-px whitespace-nowrap",
                  tab === t.key
                    ? "border-accent-green text-accent-green"
                    : "border-transparent text-panel-muted hover:text-panel-text",
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <OverviewTab domainId={selectedDomain} days={days} />
          )}
          {tab === "keywords" && (
            <KeywordsTab domainId={selectedDomain} days={days} />
          )}
          {tab === "funnel" && (
            <FunnelTab domainId={selectedDomain} days={days} />
          )}
          {tab === "top-pages" && (
            <TopPagesTab domainId={selectedDomain} days={days} />
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: OVERVIEW
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ domainId, days }: { domainId: string; days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["conv-overview", domainId, days],
    queryFn: () => api.getConversionOverview(domainId, days),
    enabled: !!domainId,
  });

  if (isLoading) return <Loading />;
  if (data?.error)
    return <ErrorBox message={data.message || "Brak danych GA4"} />;
  if (!data) return null;

  const t = data.totals;
  const comp = data.comparison;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-2">
        <StatCard
          label="Konwersje"
          value={t.conversions}
          color="#22c55e"
          change={comp?.change?.conversions}
        />
        <StatCard
          label="Przychód"
          value={`${t.revenue.toFixed(0)} zł`}
          color="#a855f7"
          change={comp?.change?.revenue}
        />
        <StatCard
          label="Prowizja (12%)"
          value={`${t.commission.toFixed(0)} zł`}
          color="#f59e0b"
        />
        <StatCard
          label="Conv. Rate"
          value={`${t.conversionRate}%`}
          color="#06b6d4"
        />
        <StatCard
          label="Śr. wartość zamówienia"
          value={`${t.avgOrderValue.toFixed(0)} zł`}
          color="#3b82f6"
        />
      </div>

      {/* Comparison badge */}
      {comp && (
        <div className="flex gap-3 text-[10px]">
          <ComparisonBadge label="Konwersje" change={comp.change.conversions} />
          <ComparisonBadge label="Przychód" change={comp.change.revenue} />
          <ComparisonBadge label="Sesje" change={comp.change.sessions} />
        </div>
      )}

      {/* Daily chart */}
      {data.daily.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
            Konwersje i przychód — {days}d
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.daily}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 7, fill: "#64748b" }}
                tickFormatter={fmtDateTick}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 7, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 7, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={45}
                tickFormatter={(v: number) => `${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => {
                  const labels: Record<string, string> = {
                    conversions: "Konwersje",
                    revenue: "Przychód",
                    addToCarts: "Add to cart",
                  };
                  return [
                    name === "revenue" ? `${v.toFixed(0)} zł` : v,
                    labels[name] || name,
                  ];
                }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="conversions"
                stroke="#22c55e"
                fill="url(#convGrad)"
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
              <defs>
                <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By Channel + By Device side by side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Channels */}
        {data.byChannel.length > 0 && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3">
              Konwersje per kanał
            </div>
            <div className="space-y-2">
              {data.byChannel.map((ch: any) => (
                <div
                  key={ch.channel}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span className="text-panel-dim w-[130px] truncate">
                    {ch.channel}
                  </span>
                  <div className="flex-1 h-2 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-green"
                      style={{
                        width: `${t.conversions > 0 ? (ch.conversions / t.conversions) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-accent-green font-mono font-semibold w-[30px] text-right">
                    {ch.conversions}
                  </span>
                  <span className="text-accent-purple font-mono w-[55px] text-right">
                    {ch.revenue.toFixed(0)} zł
                  </span>
                  <span className="text-panel-muted font-mono w-[35px] text-right">
                    {ch.conversionRate > 0
                      ? (ch.conversionRate * 100).toFixed(1) + "%"
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Devices */}
        {data.byDevice.length > 0 && (
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3">
              Konwersje per urządzenie
            </div>
            <div className="space-y-3">
              {data.byDevice.map((d: any) => {
                const DeviceIcon =
                  d.device === "desktop"
                    ? Monitor
                    : d.device === "mobile"
                      ? Smartphone
                      : Tablet;
                return (
                  <div
                    key={d.device}
                    className="flex items-center gap-3 text-[11px]"
                  >
                    <DeviceIcon className="w-3.5 h-3.5 text-panel-muted" />
                    <span className="text-panel-text font-medium w-[70px] capitalize">
                      {d.device}
                    </span>
                    <span className="text-panel-muted">{d.sessions} ses.</span>
                    <span className="text-accent-green font-semibold">
                      {d.conversions} conv.
                    </span>
                    <span className="text-accent-purple font-mono">
                      {d.revenue.toFixed(0)} zł
                    </span>
                    <span className="ml-auto text-accent-cyan font-mono">
                      {(d.conversionRate * 100).toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Events table */}
      {data.byEvent.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3">
            Eventy konwersji
          </div>
          <div className="space-y-1.5">
            {data.byEvent.map((ev: any) => (
              <div
                key={ev.event}
                className="flex items-center gap-3 text-[11px]"
              >
                <span className="badge badge-neutral text-[9px] w-[140px]">
                  {ev.event}
                </span>
                <span className="text-accent-green font-mono font-semibold">
                  {fmtNumber(ev.count)}×
                </span>
                <span className="text-panel-muted">
                  {fmtNumber(ev.users)} users
                </span>
                {ev.revenue > 0 && (
                  <span className="text-accent-purple font-mono">
                    {ev.revenue.toFixed(0)} zł
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: KEYWORDS → CONVERSIONS
// ═══════════════════════════════════════════════════════════════

function KeywordsTab({ domainId, days }: { domainId: string; days: number }) {
  const [subTab, setSubTab] = useState<"aggregated" | "pages" | "ads">(
    "aggregated",
  );
  const [search, setSearch] = useState("");
  const [showCount, setShowCount] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ["conv-keywords", domainId, days],
    queryFn: () => api.getConversionKeywords(domainId, days),
    enabled: !!domainId,
  });

  if (isLoading) return <Loading />;
  if (data?.error) return <ErrorBox message={data.message} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-accent-amber" />
          <span className="text-sm font-semibold">
            Słowa kluczowe → Konwersje
          </span>
        </div>
        <p className="text-xs text-panel-muted">
          Google nie łączy bezpośrednio organic keywords z konwersjami. Tu
          widzisz <strong>korelację</strong>: GSC queries dla stron które
          generują konwersje w GA4 + bezpośrednie dane z Google Ads search
          terms. Kolumna "Est. Conv." to szacunek proporcjonalny do kliknięć.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <MiniStat
          label="Stron z konwersjami"
          value={data.stats.totalCorrelatedPages}
          color="#22c55e"
        />
        <MiniStat
          label="Stron z queries"
          value={data.stats.pagesWithQueries}
          color="#06b6d4"
        />
        <MiniStat
          label="Zagregowane keywords"
          value={data.stats.totalAggregatedKeywords}
          color="#a855f7"
        />
        <MiniStat
          label="Ads search terms"
          value={data.stats.totalAdsKeywords}
          color="#f59e0b"
        />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-panel-border">
        {[
          {
            key: "aggregated" as const,
            label: `Keywords (${data.aggregatedKeywords?.length || 0})`,
          },
          {
            key: "pages" as const,
            label: `Strony (${data.correlatedPages?.length || 0})`,
          },
          {
            key: "ads" as const,
            label: `Ads Terms (${data.adsKeywords?.length || 0})`,
          },
        ].map((st) => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            className={cn(
              "px-3 py-2 text-[10px] font-medium border-b-2 -mb-px",
              subTab === st.key
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-panel-muted hover:text-panel-text",
            )}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        className="input text-xs w-72"
        placeholder="Szukaj keyword..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowCount(50);
        }}
      />

      {/* ── Aggregated Keywords ── */}
      {subTab === "aggregated" && (
        <KeywordsAggregatedTable
          keywords={data.aggregatedKeywords || []}
          search={search}
          showCount={showCount}
          setShowCount={setShowCount}
        />
      )}

      {/* ── Correlated Pages ── */}
      {subTab === "pages" && (
        <CorrelatedPagesTable
          pages={data.correlatedPages || []}
          search={search}
        />
      )}

      {/* ── Ads Search Terms ── */}
      {subTab === "ads" && (
        <AdsKeywordsTable
          keywords={data.adsKeywords || []}
          search={search}
          showCount={showCount}
          setShowCount={setShowCount}
        />
      )}
    </div>
  );
}

function KeywordsAggregatedTable({
  keywords,
  search,
  showCount,
  setShowCount,
}: {
  keywords: any[];
  search: string;
  showCount: number;
  setShowCount: (n: number) => void;
}) {
  const filtered = keywords.filter(
    (kw) => !search || kw.keyword.toLowerCase().includes(search.toLowerCase()),
  );
  const visible = filtered.slice(0, showCount);

  return (
    <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Źródła</th>
            <th>GSC klik.</th>
            <th>GSC pozycja</th>
            <th>Ads klik.</th>
            <th>Ads koszt</th>
            <th>Ads conv.</th>
            <th>Est. conv.</th>
            <th>Total conv.</th>
            <th>Total przychód</th>
            <th>Stron</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((kw: any, i: number) => (
            <tr key={i}>
              <td className="max-w-[200px] truncate font-medium text-panel-text">
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
              <td className="text-accent-blue font-mono">{kw.adsClicks}</td>
              <td className="text-accent-red font-mono">
                {kw.adsCost > 0 ? `${kw.adsCost.toFixed(0)} zł` : "—"}
              </td>
              <td className="text-accent-green font-semibold">
                {kw.adsConversions || "—"}
              </td>
              <td className="text-accent-amber font-mono">
                {kw.estimatedConversions > 0
                  ? `~${kw.estimatedConversions.toFixed(1)}`
                  : "—"}
              </td>
              <td className="text-accent-green font-bold font-mono">
                {kw.totalConversions > 0 ? kw.totalConversions.toFixed(1) : "—"}
              </td>
              <td className="text-accent-purple font-mono">
                {kw.totalRevenue > 0 ? `${kw.totalRevenue.toFixed(0)} zł` : "—"}
              </td>
              <td className="text-panel-muted">{kw.pageCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TableFooter
        visible={visible.length}
        total={filtered.length}
        showCount={showCount}
        setShowCount={setShowCount}
      />
    </div>
  );
}

function CorrelatedPagesTable({
  pages,
  search,
}: {
  pages: any[];
  search: string;
}) {
  const filtered = pages.filter(
    (p) =>
      !search ||
      p.path.toLowerCase().includes(search.toLowerCase()) ||
      p.topQueries?.some((q: any) =>
        q.query.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  return (
    <div className="space-y-3">
      {filtered.map((page: any, i: number) => (
        <div
          key={i}
          className="bg-panel-card border border-panel-border rounded-lg p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <a
              href={page.url}
              target="_blank"
              className="text-accent-blue text-xs font-mono hover:underline truncate max-w-[400px]"
            >
              {page.path}
            </a>
            <div className="flex gap-2 ml-auto text-[10px]">
              <span className="text-accent-green font-semibold">
                {page.conversions} conv.
              </span>
              <span className="text-accent-purple font-mono">
                {page.revenue.toFixed(0)} zł
              </span>
              <span className="text-panel-muted">
                {page.sessions} ses. · CR {page.conversionRate}%
              </span>
            </div>
          </div>

          {/* Channel breakdown */}
          <div className="flex gap-4 text-[9px] text-panel-muted mb-3">
            <span>
              Organic:{" "}
              <strong className="text-accent-green">
                {page.organicConversions}
              </strong>{" "}
              conv. / {page.organicSessions} ses.
            </span>
            <span>
              Paid:{" "}
              <strong className="text-accent-blue">
                {page.paidConversions}
              </strong>{" "}
              conv. / {page.paidSessions} ses.
            </span>
            <span>
              Direct:{" "}
              <strong className="text-panel-text">
                {page.directConversions}
              </strong>{" "}
              conv. / {page.directSessions} ses.
            </span>
          </div>

          {/* Top queries */}
          {page.topQueries?.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[9px] text-panel-muted uppercase tracking-wider">
                Top GSC queries (organic)
              </div>
              {page.topQueries.slice(0, 8).map((q: any, j: number) => (
                <div key={j} className="flex items-center gap-3 text-[10px]">
                  <Search className="w-2.5 h-2.5 text-panel-muted opacity-50" />
                  <span className="text-panel-text font-mono truncate w-[250px]">
                    {q.query}
                  </span>
                  <span className="text-accent-cyan">{q.clicks} klik.</span>
                  <span className="text-panel-muted">
                    {fmtNumber(q.impressions)} impr.
                  </span>
                  <span className="text-accent-amber font-mono">
                    pos. {q.position}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-panel-muted italic">
              Brak danych GSC queries dla tej strony
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdsKeywordsTable({
  keywords,
  search,
  showCount,
  setShowCount,
}: {
  keywords: any[];
  search: string;
  showCount: number;
  setShowCount: (n: number) => void;
}) {
  const filtered = keywords.filter(
    (kw) => !search || kw.keyword.toLowerCase().includes(search.toLowerCase()),
  );
  const visible = filtered.slice(0, showCount);

  return (
    <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Search Term</th>
            <th>Kliknięcia</th>
            <th>Wyświetlenia</th>
            <th>Koszt</th>
            <th>Konwersje</th>
            <th>Przychód</th>
            <th>Prowizja</th>
            <th>Zysk/Strata</th>
            <th>ROAS</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((kw: any, i: number) => (
            <tr key={i}>
              <td className="max-w-[250px] truncate font-medium text-panel-text">
                {kw.keyword}
              </td>
              <td className="text-accent-cyan font-mono">{kw.clicks}</td>
              <td className="text-panel-muted font-mono">
                {fmtNumber(kw.impressions)}
              </td>
              <td className="text-accent-red font-mono">
                {kw.cost.toFixed(2)} zł
              </td>
              <td className="text-accent-green font-semibold">
                {kw.conversions}
              </td>
              <td className="text-accent-purple font-mono">
                {kw.revenue.toFixed(0)} zł
              </td>
              <td className="text-accent-amber font-mono">
                {kw.commission.toFixed(2)} zł
              </td>
              <td
                className={cn(
                  "font-mono font-bold",
                  kw.profit >= 0 ? "text-accent-green" : "text-accent-red",
                )}
              >
                {kw.profit >= 0 ? "+" : ""}
                {kw.profit.toFixed(2)} zł
              </td>
              <td className="text-panel-muted font-mono">{kw.roas}x</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TableFooter
        visible={visible.length}
        total={filtered.length}
        showCount={showCount}
        setShowCount={setShowCount}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: FUNNEL
// ═══════════════════════════════════════════════════════════════

function FunnelTab({ domainId, days }: { domainId: string; days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["conv-funnel", domainId, days],
    queryFn: () => api.getConversionFunnel(domainId, days),
    enabled: !!domainId,
  });

  if (isLoading) return <Loading />;
  if (data?.error) return <ErrorBox message={data.message} />;
  if (!data || !data.funnel?.length)
    return (
      <ErrorBox message="Brak danych funnel. Sprawdź czy masz eventy e-commerce w GA4 (view_item, add_to_cart, begin_checkout, purchase)." />
    );

  const maxUsers = Math.max(...data.funnel.map((s: any) => s.users), 1);

  return (
    <div className="space-y-4">
      {/* Funnel visual */}
      <div className="bg-panel-card border border-panel-border rounded-lg p-5">
        <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-4">
          E-commerce Funnel — {days}d
        </div>
        <div className="space-y-2">
          {data.funnel.map((step: any, i: number) => {
            const widthPct = (step.users / maxUsers) * 100;
            return (
              <div key={step.event}>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-panel-dim w-[150px] truncate">
                    {step.label}
                  </span>
                  <div className="flex-1 h-7 bg-panel-border/30 rounded relative overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        background: `linear-gradient(90deg, #22c55e ${100 - step.dropOff}%, #ef4444 100%)`,
                        opacity: 0.7 + 0.3 * (1 - i / data.funnel.length),
                      }}
                    />
                    <div className="absolute inset-0 flex items-center px-3 text-[10px] font-mono font-semibold text-white">
                      {fmtNumber(step.users)} users · {fmtNumber(step.count)}{" "}
                      events
                    </div>
                  </div>
                  <span className="text-[10px] text-panel-muted w-[60px] text-right">
                    {step.overallRate}%
                  </span>
                </div>
                {i < data.funnel.length - 1 && step.dropOff > 0 && (
                  <div className="ml-[162px] flex items-center gap-1 text-[9px] text-accent-red py-0.5">
                    <ArrowDown className="w-2.5 h-2.5" />
                    <span>
                      −{step.dropOff}% drop-off (
                      {fmtNumber(step.users - (data.funnel[i + 1]?.users || 0))}{" "}
                      lost)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Funnel by device */}
      {data.funnelByDevice?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          <div className="px-4 py-2 border-b border-panel-border text-[9px] text-panel-muted uppercase tracking-wider">
            Funnel per urządzenie
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Urządzenie</th>
                <th>View item</th>
                <th>Add to cart</th>
                <th>Checkout</th>
                <th>Purchase</th>
                <th>Cart rate</th>
                <th>Checkout rate</th>
                <th>Purchase rate</th>
                <th>Overall</th>
              </tr>
            </thead>
            <tbody>
              {data.funnelByDevice.map((d: any) => (
                <tr key={d.device}>
                  <td className="font-medium capitalize">{d.device}</td>
                  <td>{fmtNumber(d.viewItem)}</td>
                  <td>{fmtNumber(d.addToCart)}</td>
                  <td>{fmtNumber(d.checkout)}</td>
                  <td className="text-accent-green font-semibold">
                    {fmtNumber(d.purchase)}
                  </td>
                  <td className="text-accent-cyan font-mono">{d.cartRate}%</td>
                  <td className="text-accent-amber font-mono">
                    {d.checkoutRate}%
                  </td>
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

      {/* Purchase daily chart */}
      {data.purchaseDaily?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
            Zakupy dziennie
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.purchaseDaily}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 7, fill: "#64748b" }}
                tickFormatter={fmtDateTick}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 7, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => {
                  const labels: Record<string, string> = {
                    purchases: "Zakupy",
                    revenue: "Przychód",
                    addToCarts: "Add to cart",
                  };
                  return [
                    name === "revenue" ? `${v.toFixed(0)} zł` : v,
                    labels[name] || name,
                  ];
                }}
              />
              <Bar
                dataKey="purchases"
                fill="#22c55e"
                radius={[2, 2, 0, 0]}
                name="purchases"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: TOP CONVERTING PAGES
// ═══════════════════════════════════════════════════════════════

function TopPagesTab({ domainId, days }: { domainId: string; days: number }) {
  const [showCount, setShowCount] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ["conv-top-pages", domainId, days],
    queryFn: () => api.getConversionTopPages(domainId, days),
    enabled: !!domainId,
  });

  if (isLoading) return <Loading />;
  if (!data?.length)
    return <ErrorBox message="Brak danych o konwersjach per strona" />;

  const visible = data.slice(0, showCount);

  return (
    <div className="space-y-3">
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-accent-green" />
          <span className="text-sm font-semibold">Top konwertujące strony</span>
        </div>
        <p className="text-xs text-panel-muted">
          Strony posortowane po przychodzie. Dane z GA4 skorelowane z GSC
          (pozycja, kliknięcia organic, indeksacja, linki wewnętrzne).
        </p>
      </div>

      <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>URL</th>
              <th>Sesje</th>
              <th>Conv.</th>
              <th>CR%</th>
              <th>Przychód</th>
              <th>Prowizja</th>
              <th>zł/sesję</th>
              <th>Bounce</th>
              <th>GSC klik.</th>
              <th>GSC poz.</th>
              <th>Indeks</th>
              <th>Linki int.</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p: any, i: number) => (
              <tr key={i}>
                <td className="max-w-[220px] truncate">
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
                <td className="text-accent-amber font-mono">
                  {p.commission.toFixed(0)} zł
                </td>
                <td className="text-panel-muted font-mono">
                  {p.revenuePerSession.toFixed(1)}
                </td>
                <td className="text-panel-muted">
                  {p.bounceRate > 0 ? `${p.bounceRate}%` : "—"}
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
                <td className="text-panel-muted">{p.internalLinksIn}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <TableFooter
          visible={visible.length}
          total={data.length}
          showCount={showCount}
          setShowCount={setShowCount}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

const tooltipStyle = {
  background: "#1a2235",
  border: "1px solid #1e2a3a",
  borderRadius: "4px",
  fontSize: "9px",
};

function fmtDateTick(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()}.${dt.getMonth() + 1}`;
}

function StatCard({
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

function ComparisonBadge({ label, change }: { label: string; change: number }) {
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
      {change > 0 ? "↑" : change < 0 ? "↓" : "="}
      {change > 0 ? "+" : ""}
      {pct}% {label} vs prev. period
    </span>
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

function TableFooter({
  visible,
  total,
  showCount,
  setShowCount,
}: {
  visible: number;
  total: number;
  showCount: number;
  setShowCount: (n: number) => void;
}) {
  return (
    <div className="px-4 py-2 flex items-center justify-between text-[10px] text-panel-muted border-t border-panel-border">
      <span>
        {visible} z {total}
      </span>
      {visible < total && (
        <button
          onClick={() => setShowCount(showCount + 50)}
          className="text-accent-blue hover:underline"
        >
          Pokaż kolejne {Math.min(50, total - visible)} →
        </button>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-lg p-6 text-center">
      <div className="text-xs text-panel-muted max-w-md mx-auto">{message}</div>
    </div>
  );
}
