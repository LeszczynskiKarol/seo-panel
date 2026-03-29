import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtNumber, fmtDate, cn } from "../lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  RefreshCw,
  ExternalLink,
  Shield,
  Zap,
  Database,
  TrendingUp,
} from "lucide-react";

function daColor(da: number | null) {
  if (!da) return "#64748b";
  if (da >= 50) return "#3b82f6";
  if (da >= 40) return "#06b6d4";
  if (da >= 30) return "#22c55e";
  if (da >= 20) return "#f59e0b";
  return "#ef4444";
}

function spamColor(spam: number | null) {
  if (!spam) return "#64748b";
  if (spam <= 20) return "#22c55e";
  if (spam <= 40) return "#f59e0b";
  return "#ef4444";
}

export function MozAnalyticsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["moz-analytics"],
    queryFn: api.getMozAnalytics,
  });

  const syncAll = useMutation({
    mutationFn: () => api.syncMozAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["moz-analytics"] }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-5 h-5 animate-spin text-panel-muted" />
      </div>
    );
  }

  const { domains, logs, dailyUsage, featureBreakdown, stats } = data;
  const quotaPct = Math.round((stats.totalRows / stats.monthlyQuota) * 100);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono">Moz Analytics</h1>
          <p className="text-xs text-panel-muted mt-0.5">
            Domain Authority, backlinki, Spam Score — dane z Moz API
          </p>
        </div>
        <button
          className="btn btn-primary text-xs flex items-center gap-1.5"
          onClick={() => syncAll.mutate()}
          disabled={syncAll.isPending}
        >
          {syncAll.isPending ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          Sync All Domains
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-6 gap-3">
        <StatCard
          icon={<Shield className="w-4 h-4" />}
          label="Śr. DA"
          value={stats.avgDA}
          color="#22c55e"
        />
        <StatCard
          icon={<ExternalLink className="w-4 h-4" />}
          label="Backlinki (Moz)"
          value={fmtNumber(stats.totalMozBacklinks)}
          color="#06b6d4"
        />
        <StatCard
          icon={<Database className="w-4 h-4" />}
          label="Domeny z danymi"
          value={`${stats.domainsWithData}/${stats.totalDomains}`}
          color="#3b82f6"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Synce (90d)"
          value={stats.totalSyncs}
          color="#a855f7"
        />
        <StatCard
          icon={<Database className="w-4 h-4" />}
          label="Rows zużyte"
          value={fmtNumber(stats.totalRows)}
          color="#f59e0b"
        />
        <div
          className="stat-card"
          style={
            { "--stat-accent": quotaPct > 80 ? "#ef4444" : "#22c55e" } as any
          }
        >
          <div
            className="text-base font-bold font-mono"
            style={{ color: quotaPct > 80 ? "#ef4444" : "#22c55e" }}
          >
            {quotaPct}%
          </div>
          <div className="text-[9px] text-panel-muted">
            Quota ({fmtNumber(stats.monthlyQuota)})
          </div>
          <div className="mt-1 h-1.5 bg-panel-border/30 rounded overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${Math.min(quotaPct, 100)}%`,
                backgroundColor:
                  quotaPct > 80
                    ? "#ef4444"
                    : quotaPct > 50
                      ? "#f59e0b"
                      : "#22c55e",
              }}
            />
          </div>
        </div>
      </div>

      {/* DA Ranking — all domains */}
      <div className="bg-panel-card border border-panel-border rounded-lg">
        <div className="px-4 py-2.5 border-b border-panel-border flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-accent-green" />
          <span className="text-xs font-semibold">
            Domain Authority — ranking domen
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Domena</th>
                <th>DA</th>
                <th>PA</th>
                <th>Spam</th>
                <th>Ext. Links</th>
                <th>Link. Domains</th>
                <th>Backlinki (Moz)</th>
                <th>Dofollow</th>
                <th>Kliknięcia GSC</th>
                <th>Ostatni sync</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d: any, i: number) => (
                <tr key={d.id}>
                  <td className="text-panel-muted font-mono">{i + 1}</td>
                  <td>
                    <a
                      href={`/domains/${d.id}`}
                      className="text-accent-blue hover:underline font-mono text-[10px]"
                    >
                      {d.label || d.domain}
                    </a>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-1.5 bg-panel-border/30 rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${d.mozDA || 0}%`,
                            backgroundColor: daColor(d.mozDA),
                          }}
                        />
                      </div>
                      <span
                        className="font-mono font-bold"
                        style={{ color: daColor(d.mozDA) }}
                      >
                        {d.mozDA?.toFixed(0) || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="font-mono text-accent-blue">
                    {d.mozPA?.toFixed(0) || "—"}
                  </td>
                  <td>
                    <span
                      className="font-mono"
                      style={{ color: spamColor(d.mozSpamScore) }}
                    >
                      {d.mozSpamScore?.toFixed(0) || "—"}
                    </span>
                  </td>
                  <td className="text-panel-text font-mono">
                    {d.mozLinks ? fmtNumber(d.mozLinks) : "—"}
                  </td>
                  <td className="text-accent-purple font-mono">
                    {d.mozDomains ? fmtNumber(d.mozDomains) : "—"}
                  </td>
                  <td className="text-accent-cyan font-semibold">
                    {d.mozBacklinks || "—"}
                  </td>
                  <td className="text-accent-green">
                    {d.mozBacklinksDofollow || "—"}
                  </td>
                  <td className="text-panel-muted">
                    {fmtNumber(d.totalClicks)}
                  </td>
                  <td className="text-[10px] text-panel-muted">
                    {d.mozLastSync ? fmtDate(d.mozLastSync) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* DA Distribution */}
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3">
            Rozkład Domain Authority
          </div>
          <DADistributionChart domains={domains} />
        </div>

        {/* API Row Usage Chart */}
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3">
            Zużycie API rows — 90 dni
          </div>
          {dailyUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyUsage}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 7, fill: "#64748b" }}
                  tickFormatter={(d: string) => {
                    const dt = new Date(d);
                    return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}`;
                  }}
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
                  contentStyle={{
                    background: "#1a2235",
                    border: "1px solid #1e2a3a",
                    borderRadius: "4px",
                    fontSize: "9px",
                  }}
                  formatter={(v: number) => [v, "Rows"]}
                />
                <Bar dataKey="rows" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs text-panel-muted text-center h-[160px] flex items-center justify-center">
              Brak danych
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Feature breakdown */}
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3">
            Zużycie per endpoint
          </div>
          <div className="space-y-2">
            {featureBreakdown.map((f: any) => {
              const pct =
                stats.totalRows > 0
                  ? Math.round((f.rows / stats.totalRows) * 100)
                  : 0;
              return (
                <div
                  key={f.feature}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span className="font-mono text-panel-text w-40 truncate">
                    {f.feature.replace("moz_", "")}
                  </span>
                  <div className="flex-1 h-1.5 bg-panel-border/30 rounded overflow-hidden">
                    <div
                      className="h-full bg-accent-amber/60 rounded"
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                  <span className="font-mono text-accent-amber shrink-0 w-16 text-right">
                    {f.rows} rows
                  </span>
                  <span className="text-panel-muted shrink-0 w-10 text-right">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent operations */}
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3">
            Ostatnie operacje
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {logs.map((log: any) => (
              <div
                key={log.id}
                className="flex items-center gap-2 text-[10px] py-1 border-b border-panel-border/20"
              >
                <span className="text-panel-muted font-mono shrink-0">
                  {fmtDate(log.createdAt)}
                </span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded font-mono text-[9px]",
                    log.feature?.includes("url_metrics")
                      ? "bg-accent-green/10 text-accent-green"
                      : log.feature?.includes("backlinks")
                        ? "bg-accent-cyan/10 text-accent-cyan"
                        : "bg-accent-amber/10 text-accent-amber",
                  )}
                >
                  {log.feature?.replace("moz_", "")}
                </span>
                <span className="font-mono text-panel-text">
                  {(log.metadata as any)?.rows || 0} rows
                </span>
                {log.domainLabel && (
                  <span className="text-panel-muted truncate">
                    {log.domainLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spam Score alert — domains with high spam */}
      {domains.filter((d: any) => d.mozSpamScore && d.mozSpamScore > 30)
        .length > 0 && (
        <div className="bg-accent-red/5 border border-accent-red/20 rounded-lg p-4">
          <div className="text-xs font-semibold text-accent-red mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Domeny z podwyższonym Spam Score (&gt;30)
          </div>
          <div className="space-y-1">
            {domains
              .filter((d: any) => d.mozSpamScore && d.mozSpamScore > 30)
              .map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 text-[11px]">
                  <span className="font-mono text-panel-text">
                    {d.label || d.domain}
                  </span>
                  <span className="font-mono font-bold text-accent-red">
                    Spam: {d.mozSpamScore?.toFixed(0)}
                  </span>
                  <span className="text-panel-muted">
                    DA: {d.mozDA?.toFixed(0) || "—"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DADistributionChart({ domains }: { domains: any[] }) {
  const withDA = domains.filter((d: any) => d.mozDA != null);
  if (!withDA.length)
    return (
      <div className="text-xs text-panel-muted text-center h-[160px] flex items-center justify-center">
        Brak danych DA
      </div>
    );

  // Buckets: 0-10, 10-20, 20-30, 30-40, 40-50, 50+
  const buckets = [
    { range: "0-10", min: 0, max: 10, count: 0, color: "#ef4444" },
    { range: "10-20", min: 10, max: 20, count: 0, color: "#f59e0b" },
    { range: "20-30", min: 20, max: 30, count: 0, color: "#eab308" },
    { range: "30-40", min: 30, max: 40, count: 0, color: "#22c55e" },
    { range: "40-50", min: 40, max: 50, count: 0, color: "#06b6d4" },
    { range: "50+", min: 50, max: 100, count: 0, color: "#3b82f6" },
  ];

  for (const d of withDA) {
    const da = d.mozDA || 0;
    const bucket =
      buckets.find((b) => da >= b.min && da < b.max) ||
      buckets[buckets.length - 1];
    bucket.count++;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={buckets.filter((b) => b.count > 0)}>
        <XAxis
          dataKey="range"
          tick={{ fontSize: 9, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 8, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={20}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "#1a2235",
            border: "1px solid #1e2a3a",
            borderRadius: "4px",
            fontSize: "9px",
          }}
          formatter={(v: number) => [`${v} domen`, "DA"]}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {buckets
            .filter((b) => b.count > 0)
            .map((b, i) => (
              <Cell key={i} fill={b.color} />
            ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="stat-card" style={{ "--stat-accent": color } as any}>
      <div className="flex items-center gap-1.5 mb-1 text-panel-muted">
        {icon}
      </div>
      <div className="text-base font-bold font-mono" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] text-panel-muted">{label}</div>
    </div>
  );
}
