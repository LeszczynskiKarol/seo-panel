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
} from "lucide-react";
import { useState } from "react";

export function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAddDomain, setShowAddDomain] = useState(false);

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
            Pull GSC (7 dni)
          </button>
        </div>
      </div>

      {/* Stat cards — kompaktowy rząd */}
      <div className="flex gap-2">
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

      {/* Domains table */}
      <div className="bg-panel-card border border-panel-border rounded overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Domena</th>
              <th>Kategoria</th>
              <th>Indeks</th>
              <th>Stron</th>
              <th>Kliknięcia</th>
              <th>Wyświetl.</th>
              <th>Pozycja</th>
              <th>GSC</th>
              <th>Sitemap</th>
            </tr>
          </thead>
          <tbody>
            {(domains || []).map((d: any) => {
              const pct =
                d.totalPages > 0
                  ? Math.round((d.indexedPages / d.totalPages) * 100)
                  : 0;
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
                  </td>
                  <td>
                    {d.indexedPages}/{d.totalPages}
                  </td>
                  <td className="text-accent-cyan">
                    {fmtNumber(d.totalClicks)}
                  </td>
                  <td>{fmtNumber(d.totalImpressions)}</td>
                  <td>{d.avgPosition ? d.avgPosition.toFixed(1) : "—"}</td>
                  <td className="text-panel-muted text-[10px]">
                    {fmtDate(d.lastGscPull)}
                  </td>
                  <td className="text-panel-muted text-[10px]">
                    {fmtDate(d.lastSitemapSync)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
      {showAddDomain && (
        <AddDomainModal onClose={() => setShowAddDomain(false)} />
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
