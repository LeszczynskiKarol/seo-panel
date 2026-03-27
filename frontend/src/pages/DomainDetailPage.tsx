import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  fmtNumber,
  fmtDate,
  fmtPercent,
  fmtPosition,
  verdictBadge,
  cn,
  categoryLabel,
  categoryColor,
} from "../lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  RefreshCw,
  ArrowUp,
  Search,
  ExternalLink,
  AlertTriangle,
  ArrowDown,
  FileWarning,
} from "lucide-react";

type Tab = "pages" | "queries" | "links" | "broken" | "orphans";

export function DomainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pages");
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("");

  const { data: linksData } = useQuery({
    queryKey: ["domain-links", id],
    queryFn: async () => {
      const pages = await api.getDomainPages(id!, "limit=500");

      const byInbound = [...pages.pages]
        .sort((a: any, b: any) => b.internalLinksIn - a.internalLinksIn)
        .slice(0, 20);

      const needLinks = [...pages.pages]
        .filter((p: any) => p.internalLinksIn <= 1 && p.impressions > 0)
        .sort((a: any, b: any) => b.impressions - a.impressions)
        .slice(0, 20);

      const byOutbound = [...pages.pages]
        .sort(
          (a: any, b: any) =>
            b.internalLinksOut +
            b.externalLinksOut -
            (a.internalLinksOut + a.externalLinksOut),
        )
        .slice(0, 20);

      const totalInternal = pages.pages.reduce(
        (s: number, p: any) => s + p.internalLinksOut,
        0,
      );
      const totalExternal = pages.pages.reduce(
        (s: number, p: any) => s + p.externalLinksOut,
        0,
      );
      const orphans = pages.pages.filter(
        (p: any) => p.internalLinksIn === 0,
      ).length;
      const avgInbound =
        pages.total > 0
          ? Math.round((totalInternal / pages.total) * 10) / 10
          : 0;

      return {
        byInbound,
        needLinks,
        byOutbound,
        totalInternal,
        totalExternal,
        orphans,
        avgInbound,
        total: pages.total,
      };
    },
    enabled: !!id && tab === "links",
  });

  const { data: domain, isLoading } = useQuery({
    queryKey: ["domain", id],
    queryFn: () => api.getDomain(id!),
    enabled: !!id,
  });

  const pageParams = new URLSearchParams();
  if (search) pageParams.set("search", search);
  if (verdictFilter) pageParams.set("verdict", verdictFilter);
  pageParams.set("limit", "100");

  const { data: pagesData } = useQuery({
    queryKey: ["pages", id, search, verdictFilter],
    queryFn: () => api.getDomainPages(id!, pageParams.toString()),
    enabled: !!id && tab === "pages",
  });

  const { data: queries } = useQuery({
    queryKey: ["queries", id],
    queryFn: () => api.getQueries(id!),
    enabled: !!id && tab === "queries",
  });

  const { data: brokenLinks } = useQuery({
    queryKey: ["broken", id],
    queryFn: () => api.getBrokenLinks(id!),
    enabled: !!id && tab === "broken",
  });

  const { data: orphans } = useQuery({
    queryKey: ["orphans", id],
    queryFn: () => api.getOrphanPages(id!),
    enabled: !!id && tab === "orphans",
  });

  const syncSitemap = useMutation({
    mutationFn: () => api.syncSitemap(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domain", id] });
      qc.invalidateQueries({ queryKey: ["pages", id] });
    },
  });

  const pullGsc = useMutation({
    mutationFn: () => api.pullGsc(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domain", id] }),
  });

  const checkIndexing = useMutation({
    mutationFn: () => api.checkIndexing(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domain", id] });
      qc.invalidateQueries({ queryKey: ["pages", id] });
    },
  });

  const crawlLinks = useMutation({
    mutationFn: () => api.crawlLinks(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broken", id] });
      qc.invalidateQueries({ queryKey: ["orphans", id] });
    },
  });

  if (isLoading || !domain) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-5 h-5 animate-spin text-panel-muted" />
      </div>
    );
  }

  const d = domain;
  const pct =
    d.totalPages > 0 ? Math.round((d.indexedPages / d.totalPages) * 100) : 0;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/")}
          className="text-xs text-panel-muted hover:text-panel-text mb-3 flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Dashboard
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn("badge text-[9px]", categoryColor(d.category))}
              >
                {categoryLabel(d.category)}
              </span>
            </div>
            <h1 className="text-xl font-bold font-mono">
              {d.label || d.domain}
            </h1>
            <a
              href={d.siteUrl}
              target="_blank"
              className="text-xs text-accent-blue hover:underline flex items-center gap-1 mt-0.5"
            >
              {d.domain} <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-ghost text-xs"
              onClick={() => syncSitemap.mutate()}
              disabled={syncSitemap.isPending}
            >
              {syncSitemap.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Sync sitemap"
              )}
            </button>
            <button
              className="btn btn-ghost text-xs"
              onClick={() => pullGsc.mutate()}
              disabled={pullGsc.isPending}
            >
              {pullGsc.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Pull GSC"
              )}
            </button>
            <button
              className="btn btn-ghost text-xs"
              onClick={() => checkIndexing.mutate()}
              disabled={checkIndexing.isPending}
            >
              {checkIndexing.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Check indexing"
              )}
            </button>
            <button
              className="btn btn-ghost text-xs"
              onClick={() => crawlLinks.mutate()}
              disabled={crawlLinks.isPending}
            >
              {crawlLinks.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Crawl links"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        <MiniStat
          label="Indeksowanie"
          value={`${pct}%`}
          sub={`${d.indexedPages}/${d.totalPages}`}
          color={pct === 100 ? "#22c55e" : pct > 50 ? "#f59e0b" : "#ef4444"}
        />
        <MiniStat
          label="Kliknięcia (30d)"
          value={fmtNumber(d.totalClicks)}
          color="#06b6d4"
        />
        <MiniStat
          label="Wyświetlenia"
          value={fmtNumber(d.totalImpressions)}
          color="#a855f7"
        />
        <MiniStat
          label="Śr. pozycja"
          value={d.avgPosition ? d.avgPosition.toFixed(1) : "—"}
          color="#3b82f6"
        />
        <MiniStat
          label="Alerty"
          value={d.alerts?.length || 0}
          color="#ef4444"
        />
      </div>

      {/* Traffic chart */}
      {d.dailyStats?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <div className="text-xs font-semibold text-panel-muted mb-3">
            RUCH — 30 DNI
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={d.dailyStats}>
              <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#64748b" }}
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
                tick={{ fontSize: 9, fill: "#64748b" }}
                tickFormatter={fmtNumber}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a2235",
                  border: "1px solid #1e2a3a",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
              />
              <Area
                type="monotone"
                dataKey="clicks"
                stroke="#06b6d4"
                fill="url(#dg)"
                strokeWidth={2}
                name="Kliknięcia"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Indexing breakdown */}
      {d.indexingStats?.length > 0 && (
        <div className="flex gap-3">
          {d.indexingStats.map((s: any) => (
            <button
              key={s.verdict}
              onClick={() => {
                setTab("pages");
                setVerdictFilter(s.verdict === verdictFilter ? "" : s.verdict);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all border",
                verdictFilter === s.verdict
                  ? "border-accent-blue bg-accent-blue/10"
                  : "border-panel-border bg-panel-card hover:bg-panel-hover",
              )}
            >
              <span className={cn("badge", verdictBadge(s.verdict))}>
                {s.verdict}
              </span>
              <span className="font-mono font-bold">{s.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ===== TABS — jedna jedyna sekcja nawigacji ===== */}
      <div className="flex gap-1 border-b border-panel-border">
        {(["pages", "queries", "links", "broken", "orphans"] as Tab[]).map(
          (t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-xs font-medium border-b-2 transition-all -mb-px",
                tab === t
                  ? "border-accent-blue text-accent-blue"
                  : "border-transparent text-panel-muted hover:text-panel-text",
              )}
            >
              {t === "pages" && "Strony"}
              {t === "queries" && "Zapytania"}
              {t === "links" && "Linkowanie"}
              {t === "broken" && "Złamane linki"}
              {t === "orphans" && "Orphan pages"}
            </button>
          ),
        )}
      </div>

      {/* ===== TAB CONTENT ===== */}

      {tab === "pages" && (
        <div>
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-panel-muted" />
              <input
                className="input w-full pl-9"
                placeholder="Szukaj strony..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Status</th>
                  <th>Kliknięcia</th>
                  <th>Wyświetl.</th>
                  <th>Pozycja</th>
                  <th>Linki In</th>
                  <th>Linki Out</th>
                  <th>Sprawdzono</th>
                </tr>
              </thead>
              <tbody>
                {(pagesData?.pages || []).map((p: any) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => {}}>
                    <td className="max-w-[300px] truncate">
                      <a
                        href={p.url}
                        target="_blank"
                        className="text-accent-blue hover:underline"
                      >
                        {p.path}
                      </a>
                    </td>
                    <td>
                      <span
                        className={cn("badge", verdictBadge(p.indexingVerdict))}
                      >
                        {p.indexingVerdict}
                      </span>
                    </td>
                    <td className="text-accent-cyan">{p.clicks}</td>
                    <td>{fmtNumber(p.impressions)}</td>
                    <td>{fmtPosition(p.position)}</td>
                    <td>{p.internalLinksIn}</td>
                    <td>{p.internalLinksOut + p.externalLinksOut}</td>
                    <td className="text-panel-muted">
                      {fmtDate(p.lastChecked)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagesData && (
              <div className="px-4 py-2 text-[10px] text-panel-muted border-t border-panel-border">
                {pagesData.total} stron łącznie
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "queries" && (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Zapytanie</th>
                <th>Kliknięcia</th>
                <th>Wyświetlenia</th>
                <th>CTR</th>
                <th>Pozycja</th>
              </tr>
            </thead>
            <tbody>
              {(queries || []).map((q: any, i: number) => (
                <tr key={i}>
                  <td className="text-panel-text max-w-[400px] truncate">
                    {q.query}
                  </td>
                  <td className="text-accent-cyan font-semibold">{q.clicks}</td>
                  <td>{fmtNumber(q.impressions)}</td>
                  <td>{fmtPercent(q.ctr)}</td>
                  <td>{fmtPosition(q.position)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "links" && linksData && (
        <div className="space-y-4">
          {/* Link stats */}
          <div className="grid grid-cols-5 gap-3">
            <div
              className="stat-card"
              style={{ "--stat-accent": "#3b82f6" } as any}
            >
              <div className="text-lg font-bold font-mono text-accent-blue">
                {linksData.totalInternal}
              </div>
              <div className="text-[10px] text-panel-muted">
                Linki wewnętrzne
              </div>
            </div>
            <div
              className="stat-card"
              style={{ "--stat-accent": "#a855f7" } as any}
            >
              <div className="text-lg font-bold font-mono text-accent-purple">
                {linksData.totalExternal}
              </div>
              <div className="text-[10px] text-panel-muted">
                Linki zewnętrzne
              </div>
            </div>
            <div
              className="stat-card"
              style={{ "--stat-accent": "#06b6d4" } as any}
            >
              <div className="text-lg font-bold font-mono text-accent-cyan">
                {linksData.avgInbound}
              </div>
              <div className="text-[10px] text-panel-muted">
                Śr. linków IN/stronę
              </div>
            </div>
            <div
              className="stat-card"
              style={{ "--stat-accent": "#ef4444" } as any}
            >
              <div className="text-lg font-bold font-mono text-accent-red">
                {linksData.orphans}
              </div>
              <div className="text-[10px] text-panel-muted">Orphan pages</div>
            </div>
            <div
              className="stat-card"
              style={{ "--stat-accent": "#22c55e" } as any}
            >
              <div className="text-lg font-bold font-mono text-accent-green">
                {linksData.total}
              </div>
              <div className="text-[10px] text-panel-muted">
                Stron w sitemapie
              </div>
            </div>
          </div>

          {/* Link magnets */}
          <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
            <div className="px-4 py-2.5 border-b border-panel-border flex items-center gap-2">
              <ArrowDown className="w-3.5 h-3.5 text-accent-green" />
              <span className="text-xs font-semibold">
                Link Magnets — strony z największą liczbą linków przychodzących
              </span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Linki IN</th>
                  <th>Linki OUT</th>
                  <th>Kliknięcia</th>
                  <th>Wyświetlenia</th>
                  <th>Pozycja</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {linksData.byInbound.map((p: any) => (
                  <tr key={p.id}>
                    <td className="max-w-[300px] truncate">
                      <a
                        href={p.url}
                        target="_blank"
                        className="text-accent-blue hover:underline"
                      >
                        {p.path}
                      </a>
                    </td>
                    <td className="text-accent-green font-semibold">
                      {p.internalLinksIn}
                    </td>
                    <td>{p.internalLinksOut + p.externalLinksOut}</td>
                    <td className="text-accent-cyan">{p.clicks}</td>
                    <td>{fmtNumber(p.impressions)}</td>
                    <td>{fmtPosition(p.position)}</td>
                    <td>
                      <span
                        className={cn("badge", verdictBadge(p.indexingVerdict))}
                      >
                        {p.indexingVerdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Need more links */}
          {linksData.needLinks.length > 0 && (
            <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
              <div className="px-4 py-2.5 border-b border-panel-border flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-accent-amber" />
                <span className="text-xs font-semibold">
                  Potrzebują linkowania — strony z ruchem ale mało/brak linków
                  wewnętrznych
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Linki IN</th>
                    <th>Kliknięcia</th>
                    <th>Wyświetlenia</th>
                    <th>Pozycja</th>
                    <th>Rekomendacja</th>
                  </tr>
                </thead>
                <tbody>
                  {linksData.needLinks.map((p: any) => (
                    <tr key={p.id}>
                      <td className="max-w-[300px] truncate">
                        <a
                          href={p.url}
                          target="_blank"
                          className="text-accent-blue hover:underline"
                        >
                          {p.path}
                        </a>
                      </td>
                      <td
                        className={cn(
                          "font-semibold",
                          p.internalLinksIn === 0
                            ? "text-accent-red"
                            : "text-accent-amber",
                        )}
                      >
                        {p.internalLinksIn}
                      </td>
                      <td className="text-accent-cyan">{p.clicks}</td>
                      <td>{fmtNumber(p.impressions)}</td>
                      <td>{fmtPosition(p.position)}</td>
                      <td className="text-[10px] text-panel-dim">
                        {p.internalLinksIn === 0
                          ? "🔴 Brak linków! Dodaj z powiązanych stron"
                          : "🟡 Mało linków — wzmocnij linkowanie"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Most outbound links */}
          <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
            <div className="px-4 py-2.5 border-b border-panel-border flex items-center gap-2">
              <ArrowUp className="w-3.5 h-3.5 text-accent-purple" />
              <span className="text-xs font-semibold">
                Najwięcej linków wychodzących — strony rozsyłające link equity
              </span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Wewnętrzne OUT</th>
                  <th>Zewnętrzne OUT</th>
                  <th>Złamane</th>
                  <th>Linki IN</th>
                </tr>
              </thead>
              <tbody>
                {linksData.byOutbound.map((p: any) => (
                  <tr key={p.id}>
                    <td className="max-w-[300px] truncate">
                      <a
                        href={p.url}
                        target="_blank"
                        className="text-accent-blue hover:underline"
                      >
                        {p.path}
                      </a>
                    </td>
                    <td className="text-accent-blue">{p.internalLinksOut}</td>
                    <td className="text-accent-purple">{p.externalLinksOut}</td>
                    <td
                      className={cn(
                        p.brokenLinksOut > 0
                          ? "text-accent-red font-semibold"
                          : "text-panel-muted",
                      )}
                    >
                      {p.brokenLinksOut}
                    </td>
                    <td>{p.internalLinksIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "broken" && (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          {brokenLinks?.length === 0 ? (
            <div className="p-8 text-center text-panel-muted text-sm">
              Brak złamanych linków
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Źródło</th>
                  <th>Cel</th>
                  <th>Anchor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(brokenLinks || []).map((l: any) => (
                  <tr key={l.id}>
                    <td className="text-panel-text truncate max-w-[200px]">
                      {l.fromPage?.path}
                    </td>
                    <td className="text-accent-red truncate max-w-[300px]">
                      {l.toUrl}
                    </td>
                    <td className="text-panel-muted truncate max-w-[150px]">
                      {l.anchorText || "—"}
                    </td>
                    <td>
                      <span className="badge badge-fail">
                        {l.statusCode || "timeout"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "orphans" && (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          {orphans?.length === 0 ? (
            <div className="p-8 text-center text-panel-muted text-sm">
              Brak orphan pages
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-panel-border text-xs text-panel-muted flex items-center gap-2">
                <FileWarning className="w-3.5 h-3.5" />
                Strony w sitemapie bez żadnego linku wewnętrznego prowadzącego
                do nich
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Status</th>
                    <th>Kliknięcia</th>
                    <th>Pozycja</th>
                  </tr>
                </thead>
                <tbody>
                  {(orphans || []).map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <a
                          href={p.url}
                          target="_blank"
                          className="text-accent-blue hover:underline truncate max-w-[400px] block"
                        >
                          {p.path}
                        </a>
                      </td>
                      <td>
                        <span
                          className={cn(
                            "badge",
                            verdictBadge(p.indexingVerdict),
                          )}
                        >
                          {p.indexingVerdict}
                        </span>
                      </td>
                      <td className="text-accent-cyan">{p.clicks}</td>
                      <td>{fmtPosition(p.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="stat-card" style={{ "--stat-accent": color } as any}>
      <div className="text-lg font-bold font-mono" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-panel-muted mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-panel-dim font-mono">{sub}</div>}
    </div>
  );
}
