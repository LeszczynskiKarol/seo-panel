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
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Globe,
  FileCheck,
  MousePointerClick,
  Eye,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

export function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

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
    queryFn: () => api.getAlerts("resolved=false&limit=5"),
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-panel-muted mt-0.5">
            Przegląd wszystkich domen
          </p>
        </div>
        <div className="flex gap-2">
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
            Pull GSC (7 dni)
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard
          accent="var(--tw-colors-accent-blue, #3b82f6)"
          icon={Globe}
          value={o.domains}
          label="Domeny"
        />
        <StatCard
          accent="#22c55e"
          icon={FileCheck}
          value={`${o.indexRate}%`}
          label={`${fmtNumber(o.totalIndexed)} / ${fmtNumber(o.totalPages)} stron`}
        />
        <StatCard
          accent="#06b6d4"
          icon={MousePointerClick}
          value={fmtNumber(o.totalClicks)}
          label="Kliknięcia (30d)"
        />
        <StatCard
          accent="#a855f7"
          icon={Eye}
          value={fmtNumber(o.totalImpressions)}
          label="Wyświetlenia (30d)"
        />
        <StatCard
          accent="#ef4444"
          icon={AlertTriangle}
          value={o.alertCount}
          label="Aktywne alerty"
        />
      </div>

      {/* Traffic chart */}
      {o.recentTraffic.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4">Ruch — ostatnie 7 dni</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={o.recentTraffic}>
              <defs>
                <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickFormatter={(d) =>
                  new Date(d).toLocaleDateString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                  })
                }
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickFormatter={fmtNumber}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a2235",
                  border: "1px solid #1e2a3a",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                labelFormatter={(d) => new Date(d).toLocaleDateString("pl-PL")}
                formatter={(v: number) => [fmtNumber(v)]}
              />
              <Area
                type="monotone"
                dataKey="clicks"
                stroke="#3b82f6"
                fill="url(#clicksGrad)"
                strokeWidth={2}
                name="Kliknięcia"
              />
              <Area
                type="monotone"
                dataKey="impressions"
                stroke="#a855f7"
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                name="Wyświetlenia"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Domains grid */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Domeny</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(domains || []).map((d: any) => (
            <DomainCard
              key={d.id}
              domain={d}
              onClick={() => navigate(`/domains/${d.id}`)}
            />
          ))}
        </div>
      </div>

      {/* Recent alerts */}
      {alerts && alerts.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          <div className="px-5 py-3 border-b border-panel-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Ostatnie alerty</h2>
            <button
              className="text-xs text-accent-blue hover:underline"
              onClick={() => navigate("/alerts")}
            >
              Wszystkie →
            </button>
          </div>
          <div className="divide-y divide-panel-border/50">
            {alerts.map((a: any) => (
              <div
                key={a.id}
                className="px-5 py-3 flex items-center gap-3 text-xs"
              >
                <AlertTriangle
                  className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    a.severity === "HIGH" || a.severity === "CRITICAL"
                      ? "text-accent-red"
                      : "text-accent-amber",
                  )}
                />
                <span className="text-panel-dim font-mono">
                  {a.domain?.label || a.domain?.domain}
                </span>
                <span className="text-panel-text truncate">{a.title}</span>
                <span className="ml-auto text-panel-muted font-mono shrink-0">
                  {fmtDate(a.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div className="stat-card" style={{ "--stat-accent": accent } as any}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold font-mono tracking-tight">
            {value}
          </div>
          <div className="text-[11px] text-panel-muted mt-1">{label}</div>
        </div>
        <Icon className="w-4 h-4 opacity-30" />
      </div>
    </div>
  );
}

function DomainCard({
  domain: d,
  onClick,
}: {
  domain: any;
  onClick: () => void;
}) {
  const pct =
    d.totalPages > 0 ? Math.round((d.indexedPages / d.totalPages) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className="bg-panel-card border border-panel-border rounded-lg p-4 cursor-pointer transition-all hover:border-accent-blue/30 hover:shadow-lg hover:shadow-accent-blue/5 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={cn("badge text-[9px]", categoryColor(d.category))}>
            {categoryLabel(d.category)}
          </span>
          <div className="text-sm font-bold font-mono mt-1.5 group-hover:text-accent-blue transition-colors">
            {d.label || d.domain}
          </div>
          <div className="text-[11px] text-panel-muted font-mono">
            {d.domain}
          </div>
        </div>
        <div
          className={cn(
            "text-lg font-bold font-mono",
            pct === 100
              ? "text-accent-green"
              : pct > 50
                ? "text-accent-amber"
                : "text-accent-red",
          )}
        >
          {pct}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-panel-border rounded-full overflow-hidden mb-3">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pct === 100
              ? "bg-accent-green"
              : pct > 50
                ? "bg-accent-amber"
                : "bg-accent-red",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center gap-4 text-[11px] text-panel-muted">
        <span>
          <strong className="text-panel-text">{d.indexedPages}</strong> /{" "}
          {d.totalPages} stron
        </span>
        <span>
          <strong className="text-accent-cyan">
            {fmtNumber(d.totalClicks)}
          </strong>{" "}
          kliknięć
        </span>
        {d.avgPosition && (
          <span>
            poz.{" "}
            <strong className="text-panel-text">
              {d.avgPosition.toFixed(1)}
            </strong>
          </span>
        )}
      </div>

      <div className="text-[10px] text-panel-muted mt-2 font-mono">
        GSC: {fmtDate(d.lastGscPull)} · Sitemap: {fmtDate(d.lastSitemapSync)}
      </div>
    </div>
  );
}
