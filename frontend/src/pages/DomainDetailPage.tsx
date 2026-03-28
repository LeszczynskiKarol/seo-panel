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
  Star,
  ArrowDown,
  FileWarning,
} from "lucide-react";

type Tab = "pages" | "queries" | "tracked" | "links" | "broken" | "orphans";

export function DomainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pages");
  const [trackUrl, setTrackUrl] = useState("");
  const [trackError, setTrackError] = useState("");
  const [trackSuccess, setTrackSuccess] = useState("");
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

  const { data: domainKeywords } = useQuery({
    queryKey: ["domain-keywords", id],
    queryFn: () => api.getDomainKeywords(id!),
    enabled: !!id && tab === "tracked",
    refetchOnMount: "always",
    staleTime: 0,
  });

  const [newDomainKw, setNewDomainKw] = useState("");

  const addDomainKw = useMutation({
    mutationFn: (kw: string) => api.addDomainKeyword(id!, kw),
    onSuccess: () => {
      setNewDomainKw("");
      qc.invalidateQueries({ queryKey: ["domain-keywords", id] });
    },
  });

  const removeDomainKw = useMutation({
    mutationFn: (kwId: string) => api.removeDomainKeyword(id!, kwId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["domain-keywords", id] }),
  });

  const checkDomainKw = useMutation({
    mutationFn: () => api.checkDomainKeywords(id!),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["domain-keywords", id] }),
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

  const { data: trackedPages } = useQuery({
    queryKey: ["tracked", id],
    queryFn: () => api.getTrackedPages(id!),
    enabled: !!id && tab === "tracked",
  });

  const { data: orphans } = useQuery({
    queryKey: ["orphans", id],
    queryFn: () => api.getOrphanPages(id!),
    enabled: !!id && tab === "orphans",
  });

  const checkKw = useMutation({
    mutationFn: () => api.checkKeywords(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracked", id] }),
  });

  const removeKw = useMutation({
    mutationFn: ({
      domainId,
      pageId,
      kwId,
    }: {
      domainId: string;
      pageId: string;
      kwId: string;
    }) => api.removeKeyword(domainId, pageId, kwId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracked", id] }),
  });

  const toggleTrack = useMutation({
    mutationFn: ({ domainId, pageId }: { domainId: string; pageId: string }) =>
      api.toggleTracked(domainId, pageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages", id] });
      qc.invalidateQueries({ queryKey: ["tracked", id] });
    },
  });

  const addTracked = useMutation({
    mutationFn: (url: string) => api.trackUrl(id!, url),
    onSuccess: (data: any) => {
      setTrackUrl("");
      setTrackError("");
      setTrackSuccess(
        data.message === "already_tracked"
          ? "Strona już jest śledzona"
          : `Dodano: ${data.path}`,
      );
      qc.invalidateQueries({ queryKey: ["tracked", id] });
      qc.invalidateQueries({ queryKey: ["pages", id] });
      setTimeout(() => setTrackSuccess(""), 3000);
    },
    onError: (err: any) => {
      try {
        const parsed = JSON.parse(err.message);
        setTrackError(parsed.message || "Nie znaleziono URL-a");
      } catch {
        setTrackError(
          "Nie znaleziono URL-a w bazie. Sprawdź czy jest w sitemapie.",
        );
      }
      setTrackSuccess("");
    },
  });

  const removeTracked = useMutation({
    mutationFn: (pageId: string) => api.untrackPage(id!, pageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracked", id] });
      qc.invalidateQueries({ queryKey: ["pages", id] });
    },
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
        {(
          ["pages", "queries", "tracked", "links", "broken", "orphans"] as Tab[]
        ).map((t) => (
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
            {t === "tracked" && "Śledzone"}
            {t === "links" && "Linkowanie"}
            {t === "broken" && "Złamane linki"}
            {t === "orphans" && "Orphan pages"}
          </button>
        ))}
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

      {tab === "tracked" && (
        <div className="space-y-4">
          {/* ── DOMAIN KEYWORDS SECTION ── */}
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-accent-cyan" />
                Śledzone frazy kluczowe
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                className="input flex-1"
                placeholder="Dodaj frazę, np. silnik elektryczny 3kw, copywriting cennik..."
                value={newDomainKw}
                onChange={(e) => setNewDomainKw(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  newDomainKw &&
                  addDomainKw.mutate(newDomainKw)
                }
              />
              <button
                className="btn btn-primary text-xs"
                onClick={() => newDomainKw && addDomainKw.mutate(newDomainKw)}
                disabled={addDomainKw.isPending || !newDomainKw}
              >
                {addDomainKw.isPending ? "..." : "Dodaj"}
              </button>
            </div>
            <div className="text-[10px] text-panel-muted mb-3">
              Wpisz frazę → system sprawdzi które strony tej domeny rankują na
              nią w Google.
            </div>

            {!domainKeywords?.length ? (
              <div className="text-xs text-panel-muted text-center py-3">
                Brak śledzonych fraz.
              </div>
            ) : (
              <div className="space-y-2">
                {domainKeywords.map((kw: any) => (
                  <DomainKeywordRow
                    key={kw.id}
                    kw={kw}
                    domainId={id!}
                    onRemove={() => removeDomainKw.mutate(kw.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-panel-border" />

          {/* Add URL form (existing) */}
          <div className="bg-panel-card border border-panel-border rounded-lg p-4">
            <div className="text-xs font-semibold mb-2 flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-accent-amber" />
              Dodaj URL do śledzenia
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Wklej URL lub ścieżkę, np. /blog/artykul lub https://domena.pl/blog/artykul"
                value={trackUrl}
                onChange={(e) => {
                  setTrackUrl(e.target.value);
                  setTrackError("");
                }}
                onKeyDown={(e) =>
                  e.key === "Enter" && trackUrl && addTracked.mutate(trackUrl)
                }
              />
              <button
                className="btn btn-primary text-xs"
                onClick={() => trackUrl && addTracked.mutate(trackUrl)}
                disabled={addTracked.isPending || !trackUrl}
              >
                {addTracked.isPending ? "Sprawdzam..." : "Dodaj"}
              </button>
            </div>
            {trackError && (
              <div className="text-xs text-accent-red mt-2">{trackError}</div>
            )}
            {trackSuccess && (
              <div className="text-xs text-accent-green mt-2">
                {trackSuccess}
              </div>
            )}
            <div className="text-[10px] text-panel-muted mt-1.5">
              URL musi istnieć w sitemapie domeny. Jeśli nie znaleziony —
              kliknij "Sync sitemap" i spróbuj ponownie.
            </div>
          </div>

          {/* Tracked pages list */}
          {!trackedPages?.length ? (
            <div className="bg-panel-card border border-panel-border rounded-lg p-8 text-center text-panel-muted text-sm">
              Brak śledzonych stron. Wklej URL powyżej lub kliknij gwiazdkę przy
              stronie w zakładce "Strony".
            </div>
          ) : (
            trackedPages.map((p: any) => (
              <div
                key={p.id}
                className="bg-panel-card border border-panel-border rounded-lg overflow-hidden"
              >
                {/* Header */}
                <div className="px-5 py-3 border-b border-panel-border flex items-center gap-3">
                  <button
                    onClick={() => removeTracked.mutate(p.id)}
                    title="Usuń ze śledzenia"
                  >
                    <Star className="w-4 h-4 text-accent-amber fill-accent-amber hover:text-accent-red transition-colors" />
                  </button>
                  <a
                    href={p.url}
                    target="_blank"
                    className="text-sm font-mono text-accent-blue hover:underline truncate"
                  >
                    {p.path}
                  </a>
                  <div className="ml-auto flex items-center gap-4 text-xs">
                    <span className="text-panel-muted">
                      poz.{" "}
                      <strong className="text-panel-text">
                        {p.position?.toFixed(1) || "—"}
                      </strong>
                    </span>
                    <span className="text-accent-cyan font-semibold">
                      {p.clicks} kliknięć
                    </span>
                    <span className="text-panel-muted">
                      {p.impressions} wyświetl.
                    </span>
                    <span
                      className={cn(
                        "badge",
                        p.indexingVerdict === "PASS"
                          ? "badge-pass"
                          : p.indexingVerdict === "FAIL"
                            ? "badge-fail"
                            : "badge-unknown",
                      )}
                    >
                      {p.indexingVerdict}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-0 divide-x divide-panel-border">
                  {/* Position chart */}
                  <div className="p-4">
                    <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2">
                      Pozycja — 30 dni
                    </div>
                    {p.history?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={120}>
                        <AreaChart data={p.history}>
                          <defs>
                            <linearGradient
                              id={`pg-${p.id}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#3b82f6"
                                stopOpacity={0.2}
                              />
                              <stop
                                offset="100%"
                                stopColor="#3b82f6"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 8, fill: "#64748b" }}
                            tickFormatter={(d: string) =>
                              new Date(d).toLocaleDateString("pl-PL", {
                                day: "2-digit",
                                month: "2-digit",
                              })
                            }
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            reversed
                            tick={{ fontSize: 8, fill: "#64748b" }}
                            axisLine={false}
                            tickLine={false}
                            width={30}
                            domain={["dataMin - 1", "dataMax + 1"]}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#1a2235",
                              border: "1px solid #1e2a3a",
                              borderRadius: "6px",
                              fontSize: "10px",
                            }}
                            formatter={(v: number) => [
                              v?.toFixed(1),
                              "Pozycja",
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey="position"
                            stroke="#3b82f6"
                            fill={`url(#pg-${p.id})`}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-xs text-panel-muted h-[120px] flex items-center justify-center">
                        Brak danych
                      </div>
                    )}
                  </div>

                  {/* Top queries */}
                  <div className="p-4">
                    <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2">
                      Top zapytania
                    </div>
                    {p.topQueries?.length > 0 ? (
                      <div className="space-y-1.5">
                        {p.topQueries.slice(0, 5).map((q: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-[11px]"
                          >
                            <span className="text-accent-amber font-mono truncate flex-1">
                              "{q.query}"
                            </span>
                            <span className="text-accent-cyan font-semibold shrink-0">
                              {q.clicks}
                            </span>
                            <span className="text-panel-muted shrink-0">
                              poz. {q.position.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-panel-muted">
                        Brak zapytań
                      </div>
                    )}
                  </div>
                </div>

                {/* Events + Backlinks row */}
                {(p.events?.length > 0 || p.backlinks?.length > 0) && (
                  <div className="border-t border-panel-border grid grid-cols-2 gap-0 divide-x divide-panel-border">
                    <div className="p-4">
                      <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2">
                        Ostatnie eventy
                      </div>
                      <div className="space-y-1">
                        {(p.events || []).slice(0, 5).map((e: any) => (
                          <div
                            key={e.id}
                            className="text-[11px] flex items-center gap-2"
                          >
                            <span>
                              {e.type.includes("IMPROVED") ||
                              e.type.includes("TOP")
                                ? "📈"
                                : e.type.includes("DROPPED") ||
                                    e.type.includes("LEFT")
                                  ? "📉"
                                  : e.type.includes("BACKLINK")
                                    ? "🔗"
                                    : "•"}
                            </span>
                            <span className="text-panel-dim truncate">
                              {e.type.replace(/_/g, " ")}
                            </span>
                            <span className="text-panel-muted ml-auto text-[10px]">
                              {new Date(e.createdAt).toLocaleDateString(
                                "pl-PL",
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2">
                        Backlinks ({p.backlinks?.length || 0})
                      </div>
                      <div className="space-y-1">
                        {(p.backlinks || []).slice(0, 5).map((bl: any) => (
                          <div key={bl.id} className="text-[11px]">
                            <a
                              href={bl.sourceUrl}
                              target="_blank"
                              className="text-accent-cyan hover:underline truncate block"
                            >
                              {bl.sourceDomain}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {/* Tracked Keywords */}
                <div className="border-t border-panel-border p-4">
                  <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2">
                    Śledzone frazy
                  </div>

                  {/* Add keyword */}
                  <KeywordInput
                    domainId={id!}
                    pageId={p.id}
                    onAdded={() =>
                      qc.invalidateQueries({ queryKey: ["tracked", id] })
                    }
                  />

                  {p.trackedKeywords?.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {p.trackedKeywords.map((kw: any) => (
                        <div
                          key={kw.id}
                          className="flex items-center gap-2 text-[11px] bg-panel-bg/50 rounded px-2 py-1.5"
                        >
                          <span className="font-mono text-accent-amber font-semibold truncate flex-1">
                            "{kw.keyword}"
                          </span>
                          {kw.position ? (
                            <>
                              <span className="text-panel-muted">poz.</span>
                              <span className="font-mono text-accent-green font-semibold">
                                {kw.position.toFixed(1)}
                              </span>
                              <span className="text-accent-cyan">
                                {kw.clicks} klik.
                              </span>
                              <span className="text-panel-muted">
                                {kw.impressions} imp.
                              </span>
                            </>
                          ) : (
                            <span className="text-panel-muted">
                              nie sprawdzono
                            </span>
                          )}
                          {kw.lastChecked && (
                            <span className="text-[10px] text-panel-muted">
                              {new Date(kw.lastChecked).toLocaleDateString(
                                "pl-PL",
                              )}
                            </span>
                          )}
                          <button
                            onClick={() =>
                              removeKw.mutate({
                                domainId: id!,
                                pageId: p.id,
                                kwId: kw.id,
                              })
                            }
                            className="text-panel-muted hover:text-accent-red text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
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
                      <td className="max-w-[300px] truncate flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTrack.mutate({ domainId: id!, pageId: p.id });
                          }}
                          className="shrink-0"
                        >
                          <Star
                            className={cn(
                              "w-3.5 h-3.5 transition-colors",
                              p.isTracked
                                ? "text-accent-amber fill-accent-amber"
                                : "text-panel-border hover:text-panel-muted",
                            )}
                          />
                        </button>
                        <a
                          href={p.url}
                          target="_blank"
                          className="text-accent-blue hover:underline truncate"
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

function DomainKeywordRow({
  kw,
  domainId,
  onRemove,
}: {
  kw: any;
  domainId: string;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [days, setDays] = useState(30);
  const [compare, setCompare] = useState(false);
  const results = (kw.results || []) as any[];

  const { data: dailyData, isLoading } = useQuery({
    queryKey: ["domain-kw-daily", domainId, kw.id, days],
    queryFn: () => api.getDomainKeywordDaily(domainId, kw.id, days),
    enabled: expanded,
  });

  // Previous period for comparison
  const { data: prevData } = useQuery({
    queryKey: ["domain-kw-daily-prev", domainId, kw.id, days],
    queryFn: () => api.getDomainKeywordDaily(domainId, kw.id, days * 2),
    enabled: expanded && compare,
  });

  // Calculate comparison stats
  const currentStats = dailyData?.daily?.length
    ? {
        clicks: dailyData.daily.reduce((s: number, d: any) => s + d.clicks, 0),
        impressions: dailyData.daily.reduce(
          (s: number, d: any) => s + d.impressions,
          0,
        ),
        avgPosition:
          dailyData.daily.reduce((s: number, d: any) => s + d.position, 0) /
          dailyData.daily.length,
      }
    : null;

  const prevStats =
    compare && prevData?.daily?.length
      ? (() => {
          const allDays = prevData.daily;
          const prevDays = allDays.slice(
            0,
            allDays.length - (dailyData?.daily?.length || 0),
          );
          if (!prevDays.length) return null;
          return {
            clicks: prevDays.reduce((s: number, d: any) => s + d.clicks, 0),
            impressions: prevDays.reduce(
              (s: number, d: any) => s + d.impressions,
              0,
            ),
            avgPosition:
              prevDays.reduce((s: number, d: any) => s + d.position, 0) /
              prevDays.length,
          };
        })()
      : null;

  const pctChange = (curr: number, prev: number) => {
    if (!prev) return null;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const posChange = (curr: number, prev: number) => {
    if (!prev) return null;
    return Math.round((prev - curr) * 10) / 10; // positive = improved
  };

  return (
    <div className="border border-panel-border rounded overflow-hidden">
      <div
        className="px-3 py-2 flex items-center gap-2 bg-panel-bg/30 cursor-pointer hover:bg-panel-hover/20 transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[10px] text-panel-muted">
          {expanded ? "▼" : "▶"}
        </span>
        <span className="font-mono text-accent-amber font-semibold text-xs">
          "{kw.keyword}"
        </span>
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          {kw.bestPosition && (
            <span className="text-panel-muted">
              poz.{" "}
              <strong
                className={cn(
                  kw.bestPosition <= 3
                    ? "text-accent-green"
                    : kw.bestPosition <= 10
                      ? "text-accent-cyan"
                      : kw.bestPosition <= 20
                        ? "text-accent-amber"
                        : "text-accent-red",
                )}
              >
                {kw.bestPosition.toFixed(1)}
              </strong>
            </span>
          )}
          <span className="text-panel-muted">
            <strong className="text-panel-text">{kw.totalPages}</strong> stron
          </span>
          <span className="text-accent-cyan font-semibold">
            {kw.totalClicks} klik.
          </span>
          {kw.lastChecked && (
            <span className="text-[10px] text-panel-muted">
              {fmtDate(kw.lastChecked)}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-panel-muted hover:text-accent-red"
          >
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-panel-border">
          {/* Period selector */}
          <div className="px-3 py-2 flex items-center gap-2 border-b border-panel-border/50 bg-panel-card/50">
            <span className="text-[9px] text-panel-muted uppercase tracking-wider">
              Okres:
            </span>
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-mono transition-all",
                  days === d
                    ? "bg-accent-blue/20 text-accent-blue font-semibold"
                    : "text-panel-muted hover:text-panel-text",
                )}
              >
                {d}d
              </button>
            ))}
            <div className="ml-3 border-l border-panel-border pl-3">
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
            {isLoading && (
              <RefreshCw className="w-3 h-3 animate-spin text-panel-muted ml-auto" />
            )}
          </div>

          {/* Comparison stats */}
          {currentStats && (
            <div className="px-3 py-2 flex gap-4 text-[10px] border-b border-panel-border/50">
              <StatWithDelta
                label="Kliknięcia"
                value={currentStats.clicks}
                prev={prevStats?.clicks}
                compare={compare}
                color="text-accent-cyan"
                positiveGood
              />
              <StatWithDelta
                label="Wyświetlenia"
                value={currentStats.impressions}
                prev={prevStats?.impressions}
                compare={compare}
                color="text-panel-text"
                positiveGood
              />
              <StatWithDelta
                label="Śr. pozycja"
                value={parseFloat(currentStats.avgPosition.toFixed(1))}
                prev={
                  prevStats
                    ? parseFloat(prevStats.avgPosition.toFixed(1))
                    : undefined
                }
                compare={compare}
                color="text-accent-blue"
                positiveGood={false}
                isPosition
              />
              <span className="text-panel-muted ml-auto">
                {dailyData?.startDate} → {dailyData?.endDate}
              </span>
            </div>
          )}

          {/* Charts */}
          {dailyData?.daily?.length > 0 && (
            <div className="p-3 border-b border-panel-border">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-1">
                    Pozycja — {days} dni
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={dailyData.daily}>
                      <defs>
                        <linearGradient
                          id={`dkp-${kw.id}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#3b82f6"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 7, fill: "#64748b" }}
                        tickFormatter={(d: string) => d.slice(5)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        reversed
                        tick={{ fontSize: 7, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        width={25}
                        domain={["dataMin - 1", "dataMax + 1"]}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#1a2235",
                          border: "1px solid #1e2a3a",
                          borderRadius: "4px",
                          fontSize: "9px",
                        }}
                        formatter={(v: number) => [v?.toFixed(1), "Pozycja"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="position"
                        stroke="#3b82f6"
                        fill={`url(#dkp-${kw.id})`}
                        strokeWidth={1.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-1">
                    Kliknięcia — {days} dni
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={dailyData.daily}>
                      <defs>
                        <linearGradient
                          id={`dkc-${kw.id}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#06b6d4"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="#06b6d4"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
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
                        width={25}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#1a2235",
                          border: "1px solid #1e2a3a",
                          borderRadius: "4px",
                          fontSize: "9px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="clicks"
                        stroke="#06b6d4"
                        fill={`url(#dkc-${kw.id})`}
                        strokeWidth={1.5}
                        name="Kliknięcia"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Pages table */}
          {results.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pozycja</th>
                  <th>URL</th>
                  <th>Kliknięcia</th>
                  <th>Wyświetlenia</th>
                  <th>CTR</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any, i: number) => (
                  <tr key={i}>
                    <td
                      className={cn(
                        "font-bold",
                        r.position <= 3
                          ? "text-accent-green"
                          : r.position <= 10
                            ? "text-accent-cyan"
                            : r.position <= 20
                              ? "text-accent-amber"
                              : "text-accent-red",
                      )}
                    >
                      {r.position}
                    </td>
                    <td className="max-w-[300px] truncate">
                      <a
                        href={r.url}
                        target="_blank"
                        className="text-accent-blue hover:underline"
                      >
                        {r.path}
                      </a>
                    </td>
                    <td className="text-accent-cyan">{r.clicks}</td>
                    <td>{fmtNumber(r.impressions)}</td>
                    <td>{fmtPercent(r.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {results.length === 0 && (
            <div className="p-3 text-center text-panel-muted text-xs">
              Brak stron rankujących
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatWithDelta({
  label,
  value,
  prev,
  compare,
  color,
  positiveGood,
  isPosition,
}: {
  label: string;
  value: number;
  prev?: number;
  compare: boolean;
  color: string;
  positiveGood: boolean;
  isPosition?: boolean;
}) {
  const delta =
    compare && prev != null ? (isPosition ? prev - value : value - prev) : null;
  const pct =
    compare && prev
      ? Math.round(((isPosition ? prev - value : value - prev) / prev) * 100)
      : null;
  const isGood = delta != null ? (positiveGood ? delta > 0 : delta > 0) : null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-panel-muted">{label}:</span>
      <strong className={color}>{isPosition ? value.toFixed(1) : value}</strong>
      {delta != null && pct != null && (
        <span
          className={cn(
            "text-[9px] font-mono",
            isGood
              ? "text-accent-green"
              : delta === 0
                ? "text-panel-muted"
                : "text-accent-red",
          )}
        >
          {delta > 0 ? "+" : ""}
          {isPosition ? delta.toFixed(1) : delta} ({pct > 0 ? "+" : ""}
          {pct}%)
        </span>
      )}
    </div>
  );
}

function KeywordInput({
  domainId,
  pageId,
  onAdded,
}: {
  domainId: string;
  pageId: string;
  onAdded: () => void;
}) {
  const [kw, setKw] = useState("");
  const add = useMutation({
    mutationFn: () => api.addKeyword(domainId, pageId, kw),
    onSuccess: () => {
      setKw("");
      onAdded();
    },
  });

  return (
    <div className="flex gap-1.5">
      <input
        className="input text-xs py-1 flex-1"
        placeholder="Dodaj frazę do śledzenia, np. silnik elektryczny 3kw"
        value={kw}
        onChange={(e) => setKw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && kw && add.mutate()}
      />
      <button
        className="btn btn-ghost text-[10px] py-1"
        onClick={() => kw && add.mutate()}
        disabled={add.isPending || !kw}
      >
        {add.isPending ? "..." : "+ Dodaj"}
      </button>
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
