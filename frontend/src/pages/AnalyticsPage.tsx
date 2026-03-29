// frontend/src/pages/AnalyticsPage.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { cn, fmtDate, fmtNumber } from "../lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity, DollarSign, Zap, Clock, Database } from "lucide-react";

export function APIAnalyticsPage() {
  const [feature, setFeature] = useState("");
  const [days, setDays] = useState(30);
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const startDate = new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    startDate,
  });
  if (feature) params.set("feature", feature);

  const { data, isLoading } = useQuery({
    queryKey: ["api-logs", feature, days, offset],
    queryFn: () => api.getApiLogs(params.toString()),
  });

  const stats = data?.stats;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent-cyan" /> Analityka API
        </h1>
        <p className="text-xs text-panel-muted mt-0.5">
          Koszty, tokeny, czas odpowiedzi — wszystkie requesty do Claude
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => {
                setDays(d);
                setOffset(0);
              }}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-mono",
                days === d
                  ? "bg-accent-blue/20 text-accent-blue font-semibold"
                  : "text-panel-muted",
              )}
            >
              {d}d
            </button>
          ))}
        </div>
        <select
          className="input text-xs py-1.5"
          value={feature}
          onChange={(e) => {
            setFeature(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">Wszystkie features</option>
          <option value="seo_chat">SEO Chat</option>
          <option value="cross_links_analyze">Cross-link analysis</option>
          <option value="internal_links_analyze">Internal link analysis</option>
          <option value="code_generation">Code generation</option>
          <option value="crosslink_filter">Crosslink filter</option>
          <option value="crosslink_sitemap">Crosslink sitemap</option>
          <option value="internal_sitemap">Internal sitemap</option>
          <option value="moz_sync_backlinks">Moz backlinks</option>
          <option value="moz_url_metrics">Moz metrics</option>
        </select>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          <div
            className="stat-card"
            style={{ "--stat-accent": "#22c55e" } as any}
          >
            <div className="text-base font-bold font-mono text-accent-green">
              ${stats.totalCost.toFixed(4)}
            </div>
            <div className="text-[9px] text-panel-muted">Koszt łącznie</div>
          </div>
          <div
            className="stat-card"
            style={{ "--stat-accent": "#3b82f6" } as any}
          >
            <div className="text-base font-bold font-mono text-accent-blue">
              {stats.totalCalls}
            </div>
            <div className="text-[9px] text-panel-muted">Requestów</div>
          </div>
          <div
            className="stat-card"
            style={{ "--stat-accent": "#06b6d4" } as any}
          >
            <div className="text-base font-bold font-mono text-accent-cyan">
              {fmtNumber(stats.totalTokens)}
            </div>
            <div className="text-[9px] text-panel-muted">Tokenów łącznie</div>
          </div>
          <div
            className="stat-card"
            style={{ "--stat-accent": "#f59e0b" } as any}
          >
            <div className="text-base font-bold font-mono text-accent-amber">
              ${stats.avgCost.toFixed(4)}
            </div>
            <div className="text-[9px] text-panel-muted">Śr. koszt/req</div>
          </div>
          <div
            className="stat-card"
            style={{ "--stat-accent": "#a855f7" } as any}
          >
            <div className="text-base font-bold font-mono text-accent-purple">
              {Math.round(stats.avgDuration)}ms
            </div>
            <div className="text-[9px] text-panel-muted">Śr. czas</div>
          </div>
        </div>
      )}

      {/* By feature + By model */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          {data.byFeature?.length > 0 && (
            <div className="bg-panel-card border border-panel-border rounded-lg p-3">
              <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
                Koszty per feature
              </div>
              <div className="space-y-1.5">
                {data.byFeature.map((f: any) => (
                  <div
                    key={f.feature}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="text-accent-amber font-mono truncate flex-1">
                      {f.feature}
                    </span>
                    <span className="text-panel-muted">{f.calls} req.</span>
                    <span className="text-accent-cyan font-semibold">
                      {fmtNumber(f.tokens)} tok.
                    </span>
                    <span className="text-accent-green font-mono font-semibold">
                      ${f.cost.toFixed(4)}
                    </span>
                    <span className="text-panel-muted text-[9px]">
                      {Math.round(f.avgDuration)}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.byModel?.length > 0 && (
            <div className="bg-panel-card border border-panel-border rounded-lg p-3">
              <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
                Koszty per model
              </div>
              <div className="space-y-1.5">
                {data.byModel.map((m: any) => (
                  <div
                    key={m.model}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="text-accent-blue font-mono truncate flex-1">
                      {m.model.replace("claude-", "").replace("-20250514", "")}
                    </span>
                    <span className="text-panel-muted">{m.calls} req.</span>
                    <span className="text-panel-muted text-[9px]">
                      {fmtNumber(m.input)}→{fmtNumber(m.output)}
                    </span>
                    <span className="text-accent-green font-mono font-semibold">
                      ${m.cost.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Daily chart */}
      {data?.logs?.length > 0 &&
        (() => {
          // Build daily aggregates from logs
          const dailyMap = new Map<
            string,
            { date: string; cost: number; calls: number; tokens: number }
          >();
          for (const log of data.logs) {
            const date = new Date(log.createdAt).toISOString().split("T")[0];
            if (!dailyMap.has(date))
              dailyMap.set(date, { date, cost: 0, calls: 0, tokens: 0 });
            const d = dailyMap.get(date)!;
            d.cost += log.costUsd;
            d.calls++;
            d.tokens += log.totalTokens;
          }
          const chartData = Array.from(dailyMap.values()).sort((a, b) =>
            a.date.localeCompare(b.date),
          );

          return chartData.length > 1 ? (
            <div className="bg-panel-card border border-panel-border rounded-lg p-4">
              <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
                Koszty dziennie — {days}d
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={chartData}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 7, fill: "#64748b" }}
                    tickFormatter={(d: string) => d.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 7, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                    tickFormatter={(v: number) => `$${v.toFixed(3)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1a2235",
                      border: "1px solid #1e2a3a",
                      borderRadius: "4px",
                      fontSize: "9px",
                    }}
                    formatter={(v: number, name: string) => [
                      name === "cost" ? `$${v.toFixed(4)}` : fmtNumber(v),
                      name === "cost"
                        ? "Koszt"
                        : name === "tokens"
                          ? "Tokeny"
                          : "Requesty",
                    ]}
                  />
                  <Bar
                    dataKey="cost"
                    fill="#22c55e"
                    radius={[2, 2, 0, 0]}
                    name="cost"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null;
        })()}
      {/* Logs table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-4 h-4 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Czas</th>
                <th>Feature</th>
                <th>Model</th>
                <th>Input tok.</th>
                <th>Output tok.</th>
                <th>Koszt</th>
                <th>Czas</th>
                <th>Status</th>
                <th>Domena</th>
              </tr>
            </thead>
            <tbody>
              {(data?.logs || []).map((log: any) => (
                <LogRow key={log.id} log={log} />
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-panel-border flex items-center justify-between text-[10px]">
            <span className="text-panel-muted">
              {offset + 1}–{Math.min(offset + limit, data?.total || 0)} z{" "}
              {data?.total || 0}
            </span>
            <div className="flex gap-2">
              {offset > 0 && (
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  className="btn btn-ghost text-[10px] py-0.5"
                >
                  ← Poprzednie
                </button>
              )}
              {data && offset + limit < data.total && (
                <button
                  onClick={() => setOffset(offset + limit)}
                  className="btn btn-ghost text-[10px] py-0.5"
                >
                  Następne →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogRow({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-panel-hover/20"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="text-panel-muted text-[10px] font-mono whitespace-nowrap">
          {new Date(log.createdAt).toLocaleString("pl-PL", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </td>
        <td>
          <span className="badge badge-neutral text-[9px]">
            {log.feature || "—"}
          </span>
        </td>
        <td className="text-[10px] font-mono text-panel-muted">
          {log.model.replace("claude-", "").replace("-20250514", "")}
        </td>
        <td className="text-accent-blue font-mono">
          {fmtNumber(log.inputTokens)}
        </td>
        <td className="text-accent-purple font-mono">
          {fmtNumber(log.outputTokens)}
        </td>
        <td className="text-accent-green font-mono font-semibold">
          ${log.costUsd.toFixed(4)}
        </td>
        <td className="text-panel-muted">{log.durationMs}ms</td>
        <td>
          <span
            className={cn(
              "badge",
              log.status === "OK" ? "badge-pass" : "badge-fail",
            )}
          >
            {log.status}
          </span>
        </td>
        <td className="text-[10px] text-panel-muted truncate max-w-[100px]">
          {log.domainLabel || "—"}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="p-0">
            <div className="border-t border-panel-border bg-panel-bg/20 p-3 space-y-2">
              {log.promptPreview && (
                <div>
                  <div className="text-[9px] text-panel-muted uppercase mb-1">
                    Prompt (preview)
                  </div>
                  <pre className="text-[10px] text-panel-dim font-mono bg-panel-bg/50 rounded p-2 max-h-[200px] overflow-auto whitespace-pre-wrap">
                    {log.promptPreview}
                  </pre>
                </div>
              )}
              {log.responsePreview && (
                <div>
                  <div className="text-[9px] text-panel-muted uppercase mb-1">
                    Response (preview)
                  </div>
                  <pre className="text-[10px] text-panel-dim font-mono bg-panel-bg/50 rounded p-2 max-h-[200px] overflow-auto whitespace-pre-wrap">
                    {log.responsePreview}
                  </pre>
                </div>
              )}
              {log.error && (
                <div>
                  <div className="text-[9px] text-accent-red uppercase mb-1">
                    Error
                  </div>
                  <pre className="text-[10px] text-accent-red font-mono bg-accent-red/5 rounded p-2">
                    {log.error}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
