import React from "react";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DomainConversionsTab } from "../components/DomainConversionsTab";
import { IntegrationsTab } from "../components/IntegrationsTab";
import { ProfitabilityTab } from "../components/ProfitabilityTab";
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
  Search,
  ExternalLink,
  FileWarning,
  Star,
  Clock,
  Globe,
} from "lucide-react";

type Tab =
  | "pages"
  | "queries"
  | "profitability"
  | "links"
  | "conversions"
  | "integrations"
  | "broken"
  | "tracked";

export function DomainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [overviewDays, setOverviewDays] = useState<number | null>(30);
  const [overviewStart, setOverviewStart] = useState(
    () => new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
  );
  const [overviewEnd, setOverviewEnd] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [tab, setTab] = useState<Tab>("pages");
  const [trackedDays, setTrackedDays] = useState(30);
  const [trackedCompare, setTrackedCompare] = useState(false);
  const [trackUrl, setTrackUrl] = useState("");
  const [trackError, setTrackError] = useState("");
  const [trackSuccess, setTrackSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("");

  const { data: domainKeywords } = useQuery({
    queryKey: ["domain-keywords", id],
    queryFn: () => api.getDomainKeywords(id!),
    enabled: !!id && tab === "tracked",
    refetchOnMount: "always",
    staleTime: 0,
  });

  const [newDomainKw, setNewDomainKw] = useState("");

  const syncMozMetrics = useMutation({
    mutationFn: async () => {
      await api.syncMozMetrics(id!);
      await api.syncMozBacklinks(id!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domain", id] });
    },
  });

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

  const { data: domain, isLoading } = useQuery({
    queryKey: ["domain", id, overviewStart, overviewEnd],
    queryFn: () => api.getDomain(id!, overviewStart, overviewEnd),
    enabled: !!id,
  });

  const pageParams = new URLSearchParams();
  if (search) pageParams.set("search", search);
  if (verdictFilter) pageParams.set("verdict", verdictFilter);
  pageParams.set("limit", "100");

  const { data: brokenLinks } = useQuery({
    queryKey: ["broken", id],
    queryFn: () => api.getBrokenLinks(id!),
    enabled: !!id && tab === "broken",
  });

  const { data: trackedPages } = useQuery({
    queryKey: ["tracked", id, trackedDays],
    queryFn: () => api.getTrackedPages(id!, trackedDays),
    enabled: !!id && tab === "tracked",
    refetchOnMount: "always",
    staleTime: 0,
  });

  const { data: trackedPagesPrev } = useQuery({
    queryKey: ["tracked-prev", id, trackedDays],
    queryFn: () => api.getTrackedPages(id!, trackedDays * 2),
    enabled: !!id && tab === "tracked" && trackedCompare,
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
              {d.mozDA != null && (
                <span className="text-[10px] font-mono text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded">
                  DA {d.mozDA.toFixed(0)}
                </span>
              )}
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
            <button
              className="btn btn-ghost text-xs"
              onClick={() => syncMozMetrics.mutate()}
              disabled={syncMozMetrics.isPending}
            >
              {syncMozMetrics.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Sync Moz"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Date range picker for overview */}
      <DateRangePicker
        days={overviewDays}
        setDays={setOverviewDays}
        startDate={overviewStart}
        endDate={overviewEnd}
        setStartDate={setOverviewStart}
        setEndDate={setOverviewEnd}
      />

      {/* Stats row — GSC + Indexing */}
      <div className="grid grid-cols-5 gap-3">
        <MiniStat
          label="Indeksowanie"
          value={`${pct}%`}
          sub={`${d.indexedPages}/${d.totalPages}`}
          color={pct === 100 ? "#22c55e" : pct > 50 ? "#f59e0b" : "#ef4444"}
        />
        <MiniStat
          label={`Kliknięcia${overviewDays ? ` (${overviewDays}d)` : ""}`}
          value={fmtNumber(d.rangeClicks ?? d.totalClicks)}
          color="#06b6d4"
        />
        <MiniStat
          label="Wyświetlenia"
          value={fmtNumber(d.rangeImpressions ?? d.totalImpressions)}
          color="#a855f7"
        />
        <MiniStat
          label="Śr. pozycja"
          value={
            d.rangeAvgPosition
              ? d.rangeAvgPosition.toFixed(1)
              : d.avgPosition
                ? d.avgPosition.toFixed(1)
                : "—"
          }
          color="#3b82f6"
        />
        <MiniStat
          label="Alerty"
          value={d.alerts?.length || 0}
          color="#ef4444"
        />
      </div>
      {/* Traffic chart — DualMetricChart with position */}
      {d.dailyStats?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4">
          <DualMetricChart data={d.dailyStats} height={180} showPosition />
        </div>
      )}

      {d.mozDA != null && (
        <div>
          <div className="grid grid-cols-5 gap-3">
            <MiniStat
              label="Domain Authority"
              value={d.mozDA?.toFixed(0) || "—"}
              color={
                d.mozDA >= 40
                  ? "#22c55e"
                  : d.mozDA >= 20
                    ? "#f59e0b"
                    : "#ef4444"
              }
            />
            <MiniStat
              label="Page Authority"
              value={d.mozPA?.toFixed(0) || "—"}
              color="#3b82f6"
            />
            <MiniStat
              label="Spam Score"
              value={d.mozSpamScore?.toFixed(0) || "—"}
              color={
                (d.mozSpamScore || 0) <= 30
                  ? "#22c55e"
                  : (d.mozSpamScore || 0) <= 60
                    ? "#f59e0b"
                    : "#ef4444"
              }
            />
            <MiniStat
              label="External Links"
              value={fmtNumber(d.mozLinks || 0)}
              color="#06b6d4"
            />
            <MiniStat
              label="Linking Domains"
              value={fmtNumber(d.mozDomains || 0)}
              color="#a855f7"
            />
          </div>
          {d.mozLastSync && (
            <div className="text-[9px] text-panel-dim mt-1 text-right">
              Moz sync: {fmtDate(d.mozLastSync)}
            </div>
          )}
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
          [
            "pages",
            "queries",
            "profitability",
            "links",
            "conversions",
            "integrations",
            "broken",
            "tracked",
          ] as Tab[]
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
            {t === "profitability" && "Rentowność"}
            {t === "links" && "Linkowanie"}
            {t === "conversions" && "Konwersje"}
            {t === "integrations" && "Integracje"}
            {t === "broken" && "Złamane linki"}
            {t === "tracked" && "Śledzone"}
          </button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}

      {tab === "pages" && (
        <PagesTab
          domainId={id!}
          search={search}
          setSearch={setSearch}
          verdictFilter={verdictFilter}
        />
      )}

      {tab === "queries" && <QueriesTab domainId={id!} />}
      {tab === "profitability" && <ProfitabilityTab domainId={id!} />}
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

          {/* Period selector for tracked pages */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-[9px] text-panel-muted uppercase tracking-wider">
              Okres:
            </span>
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setTrackedDays(d)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-mono transition-all",
                  trackedDays === d
                    ? "bg-accent-blue/20 text-accent-blue font-semibold"
                    : "text-panel-muted hover:text-panel-text",
                )}
              >
                {d}d
              </button>
            ))}
            <div className="ml-3 border-l border-panel-border pl-3">
              <button
                onClick={() => setTrackedCompare(!trackedCompare)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] transition-all",
                  trackedCompare
                    ? "bg-accent-purple/20 text-accent-purple font-semibold"
                    : "text-panel-muted hover:text-panel-text",
                )}
              >
                vs poprzedni okres
              </button>
            </div>
          </div>

          {/* Tracked pages list */}
          {!trackedPages?.length ? (
            <div className="bg-panel-card border border-panel-border rounded-lg p-8 text-center text-panel-muted text-sm">
              Brak śledzonych stron. Wklej URL powyżej lub kliknij gwiazdkę przy
              stronie w zakładce "Strony".
            </div>
          ) : (
            trackedPages.map((p: any) => {
              // Find prev data for comparison
              const prevPage =
                trackedCompare && trackedPagesPrev
                  ? trackedPagesPrev.find((pp: any) => pp.id === p.id)
                  : null;
              const prevHistory =
                prevPage?.history?.slice(
                  0,
                  prevPage.history.length - (p.history?.length || 0),
                ) || [];

              const currClicks =
                p.history?.reduce(
                  (s: number, h: any) => s + (h.clicks || 0),
                  0,
                ) || 0;
              const prevClicks = prevHistory.reduce(
                (s: number, h: any) => s + (h.clicks || 0),
                0,
              );
              const currAvgPos = p.history?.length
                ? p.history.reduce(
                    (s: number, h: any) => s + (h.position || 0),
                    0,
                  ) / p.history.length
                : null;
              const prevAvgPos = prevHistory.length
                ? prevHistory.reduce(
                    (s: number, h: any) => s + (h.position || 0),
                    0,
                  ) / prevHistory.length
                : null;

              return (
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

                  {/* Comparison stats */}
                  {trackedCompare && prevPage && (
                    <div className="px-5 py-2 border-b border-panel-border/50 flex gap-4 text-[10px]">
                      <StatWithDelta
                        label="Kliknięcia"
                        value={currClicks}
                        prev={prevClicks}
                        compare={true}
                        color="text-accent-cyan"
                        positiveGood
                      />
                      <StatWithDelta
                        label="Śr. pozycja"
                        value={
                          currAvgPos ? parseFloat(currAvgPos.toFixed(1)) : 0
                        }
                        prev={
                          prevAvgPos
                            ? parseFloat(prevAvgPos.toFixed(1))
                            : undefined
                        }
                        compare={true}
                        color="text-accent-blue"
                        positiveGood={false}
                        isPosition
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-0 divide-x divide-panel-border">
                    {/* Metrics chart */}
                    <div className="p-4">
                      <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2">
                        Metryki — {trackedDays} dni
                      </div>
                      {p.history?.length > 0 ? (
                        <DualMetricChart
                          data={p.history}
                          height={120}
                          showPosition
                        />
                      ) : (
                        <div className="text-xs text-panel-muted h-[120px] flex items-center justify-center">
                          Brak danych
                        </div>
                      )}
                    </div>

                    {/* Top queries — CLICKABLE */}
                    <div className="p-4">
                      <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2">
                        Top zapytania — {trackedDays}d
                      </div>
                      {p.topQueries?.length > 0 ? (
                        <div className="space-y-1">
                          {p.topQueries.slice(0, 5).map((q: any, i: number) => (
                            <ClickableQuery
                              key={i}
                              query={q}
                              domainId={id!}
                              pageId={p.id}
                              days={trackedDays}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-panel-muted">
                          Brak zapytań
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tracked Keywords */}
                  <div className="border-t border-panel-border p-4">
                    <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2">
                      Śledzone frazy
                    </div>
                    <KeywordInput
                      domainId={id!}
                      pageId={p.id}
                      onAdded={() =>
                        qc.invalidateQueries({ queryKey: ["tracked", id] })
                      }
                    />
                    {p.trackedKeywords?.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {p.trackedKeywords.map((tkw: any) => (
                          <div
                            key={tkw.id}
                            className="flex items-center gap-2 text-[11px] bg-panel-bg/50 rounded px-2 py-1.5"
                          >
                            <span className="font-mono text-accent-amber font-semibold truncate flex-1">
                              "{tkw.keyword}"
                            </span>
                            {tkw.position ? (
                              <>
                                <span className="text-panel-muted">poz.</span>
                                <span className="font-mono text-accent-green font-semibold">
                                  {tkw.position.toFixed(1)}
                                </span>
                                <span className="text-accent-cyan">
                                  {tkw.clicks} klik.
                                </span>
                              </>
                            ) : (
                              <span className="text-panel-muted">
                                nie sprawdzono
                              </span>
                            )}
                            <button
                              onClick={() =>
                                removeKw.mutate({
                                  domainId: id!,
                                  pageId: p.id,
                                  kwId: tkw.id,
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
              );
            })
          )}
        </div>
      )}
      {tab === "conversions" && <DomainConversionsTab domainId={id!} />}

      {tab === "links" && (
        <div className="space-y-3">
          <ExternalBacklinksTable domainId={id!} />
          <BacklinkTimeline domainId={id!} />
          <MozSection domainId={id!} />
        </div>
      )}

      {tab === "broken" && (
        <div className="bg-panel-card border border-panel-border rounded-lg table-scroll-wrapper">
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

      {tab === "integrations" && <IntegrationsTab domainId={id!} />}
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
              <DualMetricChart
                data={dailyData.daily}
                height={100}
                showPosition
              />
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

function ClickableQuery({
  query: q,
  domainId,
  pageId,
  days,
}: {
  query: any;
  domainId: string;
  pageId: string;
  days: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: dailyData } = useQuery({
    queryKey: ["query-daily", domainId, pageId, q.query, days],
    queryFn: () => api.getQueryDaily(domainId, pageId, q.query, days),
    enabled: expanded,
  });

  return (
    <div>
      <div
        className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-panel-hover/20 rounded px-1 py-0.5 -mx-1 transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[9px] text-panel-muted">
          {expanded ? "▼" : "▶"}
        </span>
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

      {expanded && dailyData?.daily?.length > 0 && (
        <div className="ml-3 mt-1 mb-2 border-l-2 border-panel-border pl-2">
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={dailyData.daily}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 6, fill: "#64748b" }}
                tickFormatter={(d: string) => d.slice(8)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                reversed
                tick={{ fontSize: 6, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={20}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a2235",
                  border: "1px solid #1e2a3a",
                  borderRadius: "4px",
                  fontSize: "8px",
                }}
                formatter={(v: number) => [v?.toFixed(1), "Poz."]}
              />
              <Area
                type="monotone"
                dataKey="position"
                stroke="#f59e0b"
                fill="none"
                strokeWidth={1}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-3 text-[9px] text-panel-muted mt-1">
            <span>
              Klik:{" "}
              <strong className="text-accent-cyan">
                {dailyData.daily.reduce((s: number, d: any) => s + d.clicks, 0)}
              </strong>
            </span>
            <span>
              Wyśw.{" "}
              <strong>
                {dailyData.daily.reduce(
                  (s: number, d: any) => s + d.impressions,
                  0,
                )}
              </strong>
            </span>
            <span>
              Śr. poz:{" "}
              <strong>
                {(
                  dailyData.daily.reduce(
                    (s: number, d: any) => s + d.position,
                    0,
                  ) / dailyData.daily.length
                ).toFixed(1)}
              </strong>
            </span>
          </div>
        </div>
      )}

      {expanded && !dailyData?.daily?.length && dailyData && (
        <div className="ml-3 mt-1 mb-1 text-[9px] text-panel-muted">
          Brak danych dziennych
        </div>
      )}
    </div>
  );
}

function ExternalBacklinksTable({ domainId }: { domainId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["domain-backlinks-table", domainId],
    queryFn: () => api.getDomainBacklinks(domainId),
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (domain: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });
  };

  if (isLoading || !data?.backlinks?.length) return null;

  return (
    <CollapsibleSection
      title="Domeny linkujące do nas"
      icon={<ExternalLink className="w-3.5 h-3.5 text-accent-cyan" />}
      badge={
        <div className="flex gap-3 text-[10px] text-panel-muted">
          <span>
            Aktywne:{" "}
            <strong className="text-accent-green">{data.stats.live}</strong>
          </span>
          <span>
            Utracone:{" "}
            <strong className="text-accent-red">{data.stats.lost}</strong>
          </span>
          <span>
            Domeny:{" "}
            <strong className="text-panel-text">
              {data.stats.uniqueDomains}
            </strong>
          </span>
          <span>
            Moz:{" "}
            <strong className="text-accent-blue">
              {data.backlinks.filter((b: any) => b.source === "MOZ").length}
            </strong>
          </span>
          <span>
            Crawl:{" "}
            <strong className="text-panel-muted">
              {data.backlinks.filter((b: any) => b.source !== "MOZ").length}
            </strong>
          </span>
        </div>
      }
    >
      <table className="data-table">
        <thead>
          <tr>
            <th>Domena źródłowa</th>
            <th>Linków</th>
            <th>DA</th>
            <th>Typ</th>
            <th>Źródło</th>
          </tr>
        </thead>
        <tbody>
          {data.byDomain.map((group: any) => {
            const isOpen = expanded.has(group.domain);
            const topLink = group.links[0];
            const hasMoz = group.links.some((l: any) => l.source === "MOZ");
            const avgDA =
              group.links.reduce(
                (s: number, l: any) => s + (l.mozSourceDA || 0),
                0,
              ) / group.links.length;

            return (
              <React.Fragment key={group.domain}>
                {/* Domain summary row — always visible */}
                <tr
                  className="cursor-pointer hover:bg-panel-hover/20"
                  onClick={() => toggle(group.domain)}
                >
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-panel-muted">
                        {isOpen ? "▼" : "▶"}
                      </span>
                      <Globe className="w-3 h-3 text-accent-cyan shrink-0" />

                      <a
                        href={`https://${group.domain}`}
                        target="_blank"
                        className="text-accent-blue hover:underline font-semibold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {group.domain}
                      </a>
                    </div>
                  </td>
                  <td className="text-accent-cyan font-semibold">
                    {group.count}
                  </td>
                  <td>
                    {avgDA > 0 ? (
                      <span
                        className={cn(
                          "font-mono font-bold text-[10px]",
                          avgDA >= 40
                            ? "text-accent-green"
                            : avgDA >= 20
                              ? "text-accent-amber"
                              : "text-accent-red",
                        )}
                      >
                        {avgDA.toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-panel-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={cn(
                        "badge",
                        group.links.every((l: any) => l.isDofollow)
                          ? "badge-pass"
                          : "badge-neutral",
                      )}
                    >
                      {group.links.filter((l: any) => l.isDofollow).length}do /{" "}
                      {group.links.filter((l: any) => !l.isDofollow).length}no
                    </span>
                  </td>
                  <td>
                    <span
                      className={cn(
                        "text-[9px] font-mono px-1 py-0.5 rounded",
                        hasMoz
                          ? "bg-accent-blue/10 text-accent-blue"
                          : "bg-panel-border/30 text-panel-muted",
                      )}
                    >
                      {hasMoz ? "moz" : "crawl"}
                    </span>
                  </td>
                </tr>

                {/* Expanded — individual links */}
                {isOpen &&
                  group.links.map((bl: any) => (
                    <tr key={bl.id} className="bg-panel-bg/30">
                      <td className="pl-8 max-w-[250px] truncate">
                        <a
                          href={bl.sourceUrl}
                          target="_blank"
                          className="text-panel-dim hover:underline text-[10px]"
                        >
                          {bl.sourceUrl
                            .replace(/^https?:\/\//, "")
                            .slice(0, 60)}
                        </a>
                      </td>
                      <td className="max-w-[180px] truncate">
                        <a
                          href={bl.targetUrl}
                          target="_blank"
                          className="text-accent-blue hover:underline text-[10px]"
                        >
                          {bl.page?.path ||
                            bl.targetUrl.replace(/^https?:\/\/[^/]+/, "")}
                        </a>
                      </td>
                      <td className="text-panel-muted max-w-[120px] truncate text-[10px]">
                        {bl.anchorText || "—"}
                      </td>
                      <td>
                        <span
                          className={cn(
                            "badge",
                            bl.isDofollow ? "badge-pass" : "badge-neutral",
                          )}
                        >
                          {bl.isDofollow ? "do" : "no"}
                        </span>
                      </td>
                      <td className="text-panel-muted text-[10px]">
                        {fmtDate(bl.firstSeen)}
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </CollapsibleSection>
  );
}

function BacklinkTimeline({ domainId }: { domainId: string }) {
  const [viewMode, setViewMode] = useState<"list" | "visual">("visual");
  const { data, isLoading } = useQuery({
    queryKey: ["domain-backlinks-timeline", domainId],
    queryFn: () => api.getDomainBacklinks(domainId),
  });

  if (isLoading || !data?.backlinks?.length) return null;

  // Group by date
  const byDate = new Map<
    string,
    { newCount: number; lostCount: number; links: any[] }
  >();
  for (const bl of data.backlinks) {
    const date = new Date(bl.firstSeen).toISOString().split("T")[0];
    if (!byDate.has(date))
      byDate.set(date, { newCount: 0, lostCount: 0, links: [] });
    const d = byDate.get(date)!;
    d.newCount++;
    d.links.push(bl);
  }
  for (const bl of data.backlinks.filter((b: any) => b.lostAt)) {
    const date = new Date(bl.lostAt).toISOString().split("T")[0];
    if (!byDate.has(date))
      byDate.set(date, { newCount: 0, lostCount: 0, links: [] });
    byDate.get(date)!.lostCount++;
  }

  const chartData = Array.from(byDate.entries())
    .map(([date, d]) => ({
      date,
      new: d.newCount,
      lost: d.lostCount,
      cumulative: 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  for (const d of chartData) {
    cum += d.new - d.lost;
    d.cumulative = cum;
  }

  // Calendar heatmap (last 90 days)
  const calendarDays = [];
  for (let i = 89; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000)
      .toISOString()
      .split("T")[0];
    const d = byDate.get(date);
    calendarDays.push({
      date,
      count: d?.newCount || 0,
      lost: d?.lostCount || 0,
    });
  }

  // Visual timeline data (sorted by date, grouped)
  const timelineEntries = Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 30);

  // Domain colors for visual
  const domainColors: Record<string, string> = {};
  const colors = [
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#a855f7",
    "#06b6d4",
    "#ef4444",
    "#ec4899",
    "#14b8a6",
  ];
  let ci = 0;
  for (const bl of data.backlinks) {
    if (!domainColors[bl.sourceDomain]) {
      domainColors[bl.sourceDomain] = colors[ci % colors.length];
      ci++;
    }
  }

  return (
    <CollapsibleSection
      title="Timeline backlinków"
      icon={<Clock className="w-3.5 h-3.5 text-accent-green" />}
      badge={
        <div className="flex gap-3 text-[10px] text-panel-muted">
          <span>
            Łącznie:{" "}
            <strong className="text-panel-text">{data.stats.total}</strong>
          </span>
          <span>
            Aktywne:{" "}
            <strong className="text-accent-green">{data.stats.live}</strong>
          </span>
          <span>
            Utracone:{" "}
            <strong className="text-accent-red">{data.stats.lost}</strong>
          </span>
        </div>
      }
    >
      {/* View toggle */}
      <div className="px-4 py-2 flex items-center gap-2 border-b border-panel-border/50 bg-panel-card/50">
        {(["visual", "list"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] transition-all",
              viewMode === v
                ? "bg-accent-blue/20 text-accent-blue font-semibold"
                : "text-panel-muted hover:text-panel-text",
            )}
          >
            {v === "visual" ? "Oś czasu" : "Lista"}
          </button>
        ))}
      </div>

      {/* Cumulative chart */}
      {chartData.length > 1 && (
        <div className="p-4 border-b border-panel-border">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
            Backlinki kumulatywnie
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="bl-cum-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
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
                width={20}
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
                dataKey="cumulative"
                stroke="#22c55e"
                fill="url(#bl-cum-grad)"
                strokeWidth={1.5}
                name="Łącznie"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Calendar heatmap */}
      <div className="px-4 py-3 border-b border-panel-border">
        <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
          Mapa aktywności — 90 dni
        </div>
        <div className="flex flex-wrap gap-[3px]">
          {calendarDays.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: +${day.count} nowych${day.lost ? `, -${day.lost} utraconych` : ""}`}
              className={cn(
                "w-[12px] h-[12px] rounded-sm",
                day.count === 0
                  ? "bg-panel-border/30"
                  : day.count <= 2
                    ? "bg-accent-green/25"
                    : day.count <= 5
                      ? "bg-accent-green/45"
                      : "bg-accent-green/65",
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-[8px] text-panel-muted">
          <span>0</span>
          <div className="flex gap-[2px]">
            <div className="w-[8px] h-[8px] rounded-sm bg-panel-border/30" />
            <div className="w-[8px] h-[8px] rounded-sm bg-accent-green/25" />
            <div className="w-[8px] h-[8px] rounded-sm bg-accent-green/45" />
            <div className="w-[8px] h-[8px] rounded-sm bg-accent-green/65" />
          </div>
          <span>5+</span>
        </div>
      </div>

      {/* VISUAL TIMELINE */}
      {viewMode === "visual" && (
        <div className="p-4">
          <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3">
            Oś czasu
          </div>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[60px] top-0 bottom-0 w-px bg-panel-border" />

            {timelineEntries.map(([date, dayData]) => (
              <div key={date} className="relative mb-4">
                {/* Date label */}
                <div className="flex items-start gap-0">
                  <div className="w-[60px] text-[9px] font-mono text-panel-muted pt-0.5 text-right pr-3 shrink-0">
                    {new Date(date).toLocaleDateString("pl-PL", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </div>
                  {/* Dot on line */}
                  <div className="relative z-10 w-3 h-3 rounded-full bg-accent-green border-2 border-panel-bg shrink-0 mt-0.5" />
                  {/* Links */}
                  <div className="ml-3 flex-1 space-y-1">
                    {dayData.links.map((bl: any) => (
                      <div
                        key={bl.id}
                        className="flex items-center gap-2 text-[10px] bg-panel-bg/40 rounded px-2 py-1"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              domainColors[bl.sourceDomain] || "#64748b",
                          }}
                        />
                        <a
                          href={bl.sourceUrl}
                          target="_blank"
                          className="font-mono font-semibold hover:underline truncate"
                          style={{
                            color: domainColors[bl.sourceDomain] || "#64748b",
                          }}
                        >
                          {bl.sourceDomain}
                        </a>
                        <span className="text-panel-muted">→</span>
                        <a
                          href={bl.targetUrl}
                          target="_blank"
                          className="text-accent-blue hover:underline truncate"
                        >
                          {bl.page?.path ||
                            bl.targetUrl.replace(/^https?:\/\/[^/]+/, "")}
                        </a>
                        {bl.anchorText && (
                          <span className="text-panel-dim truncate max-w-[120px]">
                            "{bl.anchorText}"
                          </span>
                        )}
                        <span
                          className={cn(
                            "badge ml-auto shrink-0",
                            bl.isDofollow ? "badge-pass" : "badge-neutral",
                          )}
                        >
                          {bl.isDofollow ? "do" : "no"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Domain legend */}
          <div className="mt-3 pt-3 border-t border-panel-border flex flex-wrap gap-2">
            {Object.entries(domainColors).map(([domain, color]) => (
              <div key={domain} className="flex items-center gap-1 text-[9px]">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-panel-muted font-mono">{domain}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Domena źródłowa</th>
              <th>Cel</th>
              <th>Anchor</th>
              <th>Typ</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...data.backlinks]
              .sort(
                (a: any, b: any) =>
                  new Date(b.firstSeen).getTime() -
                  new Date(a.firstSeen).getTime(),
              )
              .slice(0, 30)
              .map((bl: any) => (
                <tr key={bl.id}>
                  <td className="text-panel-muted">{fmtDate(bl.firstSeen)}</td>
                  <td>
                    <a
                      href={bl.sourceUrl}
                      target="_blank"
                      className="text-accent-blue hover:underline"
                    >
                      {bl.sourceDomain}
                    </a>
                  </td>
                  <td className="max-w-[200px] truncate">
                    <a
                      href={bl.targetUrl}
                      target="_blank"
                      className="text-accent-cyan hover:underline"
                    >
                      {bl.page?.path ||
                        bl.targetUrl.replace(/^https?:\/\/[^/]+/, "")}
                    </a>
                  </td>
                  <td className="text-panel-muted max-w-[100px] truncate">
                    {bl.anchorText || "—"}
                  </td>
                  <td>
                    <span
                      className={cn(
                        "badge",
                        bl.isDofollow ? "badge-pass" : "badge-neutral",
                      )}
                    >
                      {bl.isDofollow ? "do" : "no"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={cn(
                        "badge",
                        bl.isLive ? "badge-pass" : "badge-fail",
                      )}
                    >
                      {bl.isLive ? "live" : "lost"}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </CollapsibleSection>
  );
}

function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
      <div
        className="px-4 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-panel-hover/20 transition-all"
        onClick={() => setOpen(!open)}
      >
        <span className="text-panel-muted">{open ? "▼" : "▶"}</span>
        {icon}
        <span className="text-xs font-semibold">{title}</span>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      {open && <div className="border-t border-panel-border">{children}</div>}
    </div>
  );
}

function PagesTab({
  domainId,
  search,
  setSearch,
  verdictFilter,
}: {
  domainId: string;
  search: string;
  setSearch: (s: string) => void;
  verdictFilter: string;
}) {
  const [days, setDays] = useState<number | null>(30);
  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [expandedQueries, setExpandedQueries] = useState<Set<string>>(
    new Set(),
  );
  const [pageSize, setPageSize] = useState(10);
  const [showCount, setShowCount] = useState(10);
  const [sortCol, setSortCol] = useState<string>("clicks");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const togglePage = (id: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleQuery = (key: string) => {
    setExpandedQueries((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "path" || col === "indexingVerdict" ? "asc" : "desc");
    }
  };

  const handlePageSize = (size: number) => {
    setPageSize(size);
    setShowCount(size);
  };

  const pageParams = new URLSearchParams();
  if (search) pageParams.set("search", search);
  if (verdictFilter) pageParams.set("verdict", verdictFilter);
  pageParams.set("limit", "5000"); // fetch all, sort client-side
  pageParams.set("startDate", startDate);
  pageParams.set("endDate", endDate);

  const { data: pagesData } = useQuery({
    queryKey: ["pages", domainId, search, verdictFilter, startDate, endDate],
    queryFn: () => api.getDomainPages(domainId, pageParams.toString()),
  });

  // Sort pages client-side
  const sortedPages = [...(pagesData?.pages || [])].sort((a: any, b: any) => {
    let aVal = a[sortCol];
    let bVal = b[sortCol];

    // Handle nested: linksOut = internalLinksOut + externalLinksOut
    if (sortCol === "linksOut") {
      aVal = (a.internalLinksOut || 0) + (a.externalLinksOut || 0);
      bVal = (b.internalLinksOut || 0) + (b.externalLinksOut || 0);
    }

    // Nulls last
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    // String comparison
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    // Number comparison
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  const visiblePages =
    pageSize === -1 ? sortedPages : sortedPages.slice(0, showCount);
  const hasMore = pageSize !== -1 && showCount < sortedPages.length;

  const SortHeader = ({
    col,
    label,
    className,
  }: {
    col: string;
    label: string;
    className?: string;
  }) => (
    <th
      className={cn(
        "cursor-pointer hover:text-panel-text select-none",
        className,
      )}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-0.5">
        {label}
        {sortCol === col && (
          <span className="text-accent-blue">
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-panel-muted" />
          <input
            className="input w-full pl-9"
            placeholder="Szukaj strony..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <DateRangePicker
          days={days}
          setDays={setDays}
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-panel-muted">Pokaż:</span>
          {[10, 50, 100, 500].map((n) => (
            <button
              key={n}
              onClick={() => handlePageSize(n)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono transition-all",
                pageSize === n
                  ? "bg-accent-blue/20 text-accent-blue font-semibold"
                  : "text-panel-muted hover:text-panel-text",
              )}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => handlePageSize(-1)}
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-mono transition-all",
              pageSize === -1
                ? "bg-accent-blue/20 text-accent-blue font-semibold"
                : "text-panel-muted hover:text-panel-text",
            )}
          >
            Wszystkie
          </button>
        </div>
      </div>
      <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-4"></th>
              <SortHeader col="path" label="URL" />
              <SortHeader col="indexingVerdict" label="Status" />
              <SortHeader col="clicks" label="Kliknięcia" />
              <SortHeader col="impressions" label="Wyświetl." />
              <SortHeader col="position" label="Pozycja" />
              <SortHeader col="internalLinksIn" label="Linki In" />
              <SortHeader col="linksOut" label="Linki Out" />
              <SortHeader col="lastChecked" label="Sprawdzono" />
            </tr>
          </thead>
          <tbody>
            {visiblePages.map((p: any) => (
              <ExpandablePageRow
                key={p.id}
                p={p}
                domainId={domainId}
                startDate={startDate}
                endDate={endDate}
                expanded={expandedPages.has(p.id)}
                onToggle={() => togglePage(p.id)}
                expandedQueries={expandedQueries}
                toggleQuery={toggleQuery}
              />
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 flex items-center justify-between text-[10px] text-panel-muted border-t border-panel-border">
          <span>
            {visiblePages.length} z {sortedPages.length} stron
            {pagesData?.total &&
              sortedPages.length < pagesData.total &&
              ` (${pagesData.total} łącznie)`}
          </span>
          {hasMore && (
            <button
              onClick={() => setShowCount((c) => c + pageSize)}
              className="text-accent-blue hover:underline font-medium"
            >
              Pokaż kolejne {Math.min(pageSize, sortedPages.length - showCount)}{" "}
              →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpandablePageRow({
  p,
  domainId,
  startDate,
  endDate,
  expanded,
  onToggle,
  expandedQueries,
  toggleQuery,
}: {
  p: any;
  domainId: string;
  startDate: string;
  endDate: string;
  expanded: boolean;
  onToggle: () => void;
  expandedQueries: Set<string>;
  toggleQuery: (key: string) => void;
}) {
  const days = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
  );

  const { data: queryData } = useQuery({
    queryKey: ["page-queries", domainId, p.id, startDate, endDate],
    queryFn: () => api.getPageQueries(domainId, p.id, days, startDate, endDate),
    enabled: expanded,
  });

  return (
    <>
      <tr className="cursor-pointer hover:bg-panel-hover/20" onClick={onToggle}>
        <td className="text-[9px] text-panel-muted w-4">
          {expanded ? "▼" : "▶"}
        </td>{" "}
        <td className="max-w-[300px] truncate">
          <a
            href={p.url}
            target="_blank"
            className="text-accent-blue hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {p.path}
          </a>
          {p.indexingVerdict !== "FAIL" && (
            <RemoveFromIndexButton
              domainId={domainId}
              pageId={p.id}
              path={p.path}
              verdict={p.indexingVerdict}
            />
          )}
        </td>
        <td>
          <span className={cn("badge", verdictBadge(p.indexingVerdict))}>
            {p.indexingVerdict}
          </span>
        </td>
        <td className="text-accent-cyan">{p.clicks}</td>
        <td>{fmtNumber(p.impressions)}</td>
        <td
          className={cn(
            "font-mono",
            p.position && p.position <= 3
              ? "text-accent-green font-bold"
              : p.position && p.position <= 10
                ? "text-accent-cyan"
                : p.position && p.position <= 20
                  ? "text-accent-amber"
                  : "",
          )}
        >
          {fmtPosition(p.position)}
        </td>
        <td>{p.internalLinksIn}</td>
        <td>{p.internalLinksOut + p.externalLinksOut}</td>
        <td className="text-panel-muted">{fmtDate(p.lastChecked)}</td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} className="!whitespace-normal p-0">
            <div className="border-t border-panel-border bg-panel-bg/20 px-4 py-3 overflow-hidden">
              {!queryData?.queries?.length ? (
                <div className="text-xs text-panel-muted text-center py-2">
                  {queryData ? "Brak fraz dla tej strony" : "Ładuję..."}
                </div>
              ) : (
                <>
                  <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
                    Frazy rankujące — {days}d ({queryData.queries.length} fraz)
                  </div>
                  <div className="space-y-1">
                    {queryData.queries.map((q: any, i: number) => {
                      const qKey = `${p.id}:${q.query}`;
                      return (
                        <PageQueryRow
                          key={i}
                          q={q}
                          domainId={domainId}
                          pageId={p.id}
                          startDate={startDate}
                          endDate={endDate}
                          expanded={expandedQueries.has(qKey)}
                          onToggle={() => toggleQuery(qKey)}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PageQueryRow({
  q,
  domainId,
  pageId,
  startDate,
  endDate,
  expanded,
  onToggle,
}: {
  q: any;
  domainId: string;
  pageId: string;
  startDate: string;
  endDate: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const days = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
  );

  const { data: dailyData } = useQuery({
    queryKey: [
      "page-query-daily",
      domainId,
      pageId,
      q.query,
      startDate,
      endDate,
    ],
    queryFn: () =>
      api.getQueryDaily(domainId, pageId, q.query, days, startDate, endDate),
    enabled: expanded,
  });

  return (
    <div>
      <div
        className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-panel-hover/20 rounded px-2 py-1 -mx-2 transition-all"
        onClick={onToggle}
      >
        <span className="text-[9px] text-panel-muted">
          {expanded ? "▼" : "▶"}
        </span>

        <span className="text-accent-amber font-mono truncate flex-1">
          "{q.query}"
        </span>
        <span className="text-accent-cyan font-semibold shrink-0">
          {q.clicks} klik.
        </span>
        <span className="text-panel-muted shrink-0">
          {fmtNumber(q.impressions)} imp.
        </span>
        <span className="text-panel-muted shrink-0">{fmtPercent(q.ctr)}</span>
        <span
          className={cn(
            "font-mono shrink-0",
            q.position <= 3
              ? "text-accent-green font-bold"
              : q.position <= 10
                ? "text-accent-cyan"
                : q.position <= 20
                  ? "text-accent-amber"
                  : "text-accent-red",
          )}
        >
          poz. {q.position}
        </span>
      </div>

      {expanded && dailyData?.daily?.length > 0 && (
        <div className="ml-4 mt-1 mb-2 border-l-2 border-panel-border pl-3">
          <DualMetricChart data={dailyData.daily} height={70} showPosition />
          <div className="text-[8px] text-panel-dim mt-0.5">
            {dailyData.startDate} → {dailyData.endDate}
          </div>
        </div>
      )}

      {expanded && dailyData && !dailyData?.daily?.length && (
        <div className="ml-4 mt-1 mb-1 text-[9px] text-panel-muted">
          Brak danych dziennych
        </div>
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

function QueriesTab({ domainId }: { domainId: string }) {
  const [days, setDays] = useState<number | null>(30);
  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [compare, setCompare] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const limit = 50;

  const toggleRow = (query: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(query) ? next.delete(query) : next.add(query);
      return next;
    });
  };

  const params = new URLSearchParams();
  params.set("startDate", startDate);
  params.set("endDate", endDate);
  params.set("limit", String(limit));
  params.set("offset", String(page * limit));
  if (search) params.set("search", search);

  const { data: queries } = useQuery({
    queryKey: ["queries-tab", domainId, startDate, endDate, page, search],
    queryFn: () => api.getQueries(domainId, params.toString()),
    enabled: !!domainId,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 flex-wrap">
        <DateRangePicker
          days={days}
          setDays={(d) => {
            setDays(d);
            setPage(0);
          }}
          startDate={startDate}
          endDate={endDate}
          setStartDate={(d) => {
            setStartDate(d);
            setPage(0);
          }}
          setEndDate={(d) => {
            setEndDate(d);
            setPage(0);
          }}
        />
        <div className="h-4 w-px bg-panel-border mx-1" />
        <button
          onClick={() => setCompare(!compare)}
          className={cn(
            "px-2 py-0.5 rounded text-[10px]",
            compare
              ? "bg-accent-purple/20 text-accent-purple font-semibold"
              : "text-panel-muted hover:text-panel-text",
          )}
        >
          vs poprzedni okres
        </button>
        <div className="ml-auto relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-panel-muted" />
          <input
            className="input text-xs pl-7 w-48"
            placeholder="Szukaj frazy..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      <div className="bg-panel-card border border-panel-border rounded-lg table-scroll-wrapper">
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
              <ExpandableQueryRow
                key={i}
                query={q}
                domainId={domainId}
                startDate={startDate}
                endDate={endDate}
                compare={compare}
                expanded={expandedRows.has(q.query)}
                onToggle={() => toggleRow(q.query)}
              />
            ))}
          </tbody>
        </table>
        {queries && (
          <div className="px-4 py-2 flex items-center gap-2 text-[10px] text-panel-muted border-t border-panel-border">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="hover:text-panel-text disabled:opacity-30"
            >
              ← Poprzednia
            </button>
            <span>Strona {page + 1}</span>
            <button
              disabled={(queries?.length || 0) < limit}
              onClick={() => setPage((p) => p + 1)}
              className="hover:text-panel-text disabled:opacity-30"
            >
              Następna →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandableQueryRow({
  query: q,
  domainId,
  startDate,
  endDate,
  compare,
  expanded,
  onToggle,
}: {
  query: any;
  domainId: string;
  startDate: string;
  endDate: string;
  compare: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const days = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
  );

  const { data: dailyData } = useQuery({
    queryKey: ["query-daily-global", domainId, q.query, startDate, endDate],
    queryFn: () =>
      api.getQueryDaily(domainId, "", q.query, days, startDate, endDate),
    enabled: expanded,
  });

  return (
    <>
      <tr className="cursor-pointer hover:bg-panel-hover/30" onClick={onToggle}>
        <td className="text-panel-text max-w-[400px] truncate">
          <span className="text-[9px] text-panel-muted mr-1">
            {expanded ? "▼" : "▶"}
          </span>
          {q.query}
        </td>
        <td className="text-accent-cyan font-semibold">{q.clicks}</td>
        <td>{fmtNumber(q.impressions)}</td>
        <td>{fmtPercent(q.ctr)}</td>
        <td>{fmtPosition(q.position)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="!whitespace-normal p-0">
            <div className="bg-panel-bg/30 border-t border-panel-border px-6 py-3 overflow-hidden">
              {dailyData?.daily?.length > 0 ? (
                <DualMetricChart
                  data={dailyData.daily}
                  height={90}
                  showPosition
                />
              ) : dailyData ? (
                <div className="text-xs text-panel-muted">
                  Brak danych dziennych
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DateRangePicker({
  days,
  setDays,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}: {
  days: number | null;
  setDays: (d: number | null) => void;
  startDate: string;
  endDate: string;
  setStartDate: (d: string) => void;
  setEndDate: (d: string) => void;
}) {
  const presets = [7, 14, 30, 90];
  const today = new Date().toISOString().split("T")[0];

  const applyPreset = (d: number) => {
    setDays(d);
    const end = new Date();
    const start = new Date(Date.now() - d * 86400000);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setDays(null); // custom range — deselect presets
  };

  // Calculate displayed range label
  const rangeDays =
    startDate && endDate
      ? Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            86400000,
        )
      : null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9px] text-panel-muted uppercase tracking-wider">
        Okres:
      </span>
      {presets.map((d) => (
        <button
          key={d}
          onClick={() => applyPreset(d)}
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
      <div className="h-4 w-px bg-panel-border mx-1" />
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={startDate}
          max={endDate || today}
          onChange={(e) => handleDateChange(e.target.value, endDate)}
          className="input text-[10px] py-0.5 px-1.5 w-[110px] font-mono"
        />
        <span className="text-[9px] text-panel-muted">→</span>
        <input
          type="date"
          value={endDate}
          min={startDate}
          max={today}
          onChange={(e) => handleDateChange(startDate, e.target.value)}
          className="input text-[10px] py-0.5 px-1.5 w-[110px] font-mono"
        />
      </div>
      {days === null && rangeDays != null && (
        <span className="text-[9px] text-accent-purple font-mono">
          {rangeDays}d
        </span>
      )}
    </div>
  );
}

function DualMetricChart({
  data,
  height = 80,
  showPosition = false,
}: {
  data: any[];
  height?: number;
  showPosition?: boolean;
}) {
  const [visible, setVisible] = useState({
    clicks: true,
    impressions: true,
    position: showPosition,
  });

  const toggle = (key: keyof typeof visible) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Don't allow all off
      if (!next.clicks && !next.impressions && !next.position) return prev;
      return next;
    });
  };

  // Determine which Y axes are needed
  const hasLeft = visible.clicks;
  const hasRight = visible.impressions;
  const hasPosition = visible.position && showPosition;

  return (
    <div>
      {/* Legend — clickable toggles */}
      <div className="flex items-center gap-3 mb-1.5">
        <button
          onClick={() => toggle("clicks")}
          className={cn(
            "flex items-center gap-1 text-[9px] font-mono transition-all rounded px-1.5 py-0.5",
            visible.clicks
              ? "bg-accent-cyan/15 text-accent-cyan"
              : "text-panel-muted line-through opacity-50 hover:opacity-75",
          )}
        >
          <div
            className={cn(
              "w-2 h-2 rounded-sm",
              visible.clicks ? "bg-accent-cyan" : "bg-panel-border",
            )}
          />
          Kliknięcia
        </button>
        <button
          onClick={() => toggle("impressions")}
          className={cn(
            "flex items-center gap-1 text-[9px] font-mono transition-all rounded px-1.5 py-0.5",
            visible.impressions
              ? "bg-accent-purple/15 text-accent-purple"
              : "text-panel-muted line-through opacity-50 hover:opacity-75",
          )}
        >
          <div
            className={cn(
              "w-2 h-2 rounded-sm",
              visible.impressions ? "bg-accent-purple" : "bg-panel-border",
            )}
          />
          Wyświetlenia
        </button>
        {showPosition && (
          <button
            onClick={() => toggle("position")}
            className={cn(
              "flex items-center gap-1 text-[9px] font-mono transition-all rounded px-1.5 py-0.5",
              visible.position
                ? "bg-accent-blue/15 text-accent-blue"
                : "text-panel-muted line-through opacity-50 hover:opacity-75",
            )}
          >
            <div
              className={cn(
                "w-2 h-2 rounded-sm",
                visible.position ? "bg-accent-blue" : "bg-panel-border",
              )}
            />
            Pozycja
          </button>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
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

          {/* Left Y axis — clicks */}
          {hasLeft && (
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 7, fill: "#06b6d4" }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
          )}

          {/* Right Y axis — impressions */}
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 7, fill: "#a855f7" }}
              axisLine={false}
              tickLine={false}
              width={35}
            />
          )}

          {/* Position Y axis — reversed, separate */}
          {hasPosition && !hasLeft && !hasRight && (
            <YAxis
              yAxisId="pos"
              reversed
              tick={{ fontSize: 7, fill: "#3b82f6" }}
              axisLine={false}
              tickLine={false}
              width={25}
              domain={["dataMin - 1", "dataMax + 1"]}
            />
          )}
          {hasPosition && (hasLeft || hasRight) && (
            <YAxis
              yAxisId="pos"
              orientation={hasRight ? "left" : "right"}
              reversed
              tick={{ fontSize: 7, fill: "#3b82f6" }}
              axisLine={false}
              tickLine={false}
              width={25}
              domain={["dataMin - 1", "dataMax + 1"]}
              hide
            />
          )}

          <Tooltip
            contentStyle={{
              background: "#1a2235",
              border: "1px solid #1e2a3a",
              borderRadius: "4px",
              fontSize: "9px",
            }}
            formatter={(value: number, name: string) => {
              if (name === "Pozycja") return [value?.toFixed(1), name];
              return [value, name];
            }}
          />

          {visible.clicks && (
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="clicks"
              stroke="#06b6d4"
              fill="none"
              strokeWidth={1.5}
              name="Kliknięcia"
              dot={false}
            />
          )}

          {visible.impressions && (
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="impressions"
              stroke="#a855f7"
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              name="Wyświetlenia"
              dot={false}
            />
          )}

          {visible.position && showPosition && (
            <Area
              yAxisId={hasPosition && (hasLeft || hasRight) ? "pos" : "pos"}
              type="monotone"
              dataKey="position"
              stroke="#3b82f6"
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="2 2"
              name="Pozycja"
              dot={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="flex gap-3 text-[9px] text-panel-muted mt-1">
        {visible.clicks && (
          <span>
            Klik:{" "}
            <strong className="text-accent-cyan">
              {data.reduce((s, d) => s + (d.clicks || 0), 0)}
            </strong>
          </span>
        )}
        {visible.impressions && (
          <span>
            Wyśw:{" "}
            <strong className="text-accent-purple">
              {data
                .reduce((s, d) => s + (d.impressions || 0), 0)
                .toLocaleString()}
            </strong>
          </span>
        )}
        {visible.position && showPosition && data.length > 0 && (
          <span>
            Śr. poz:{" "}
            <strong className="text-accent-blue">
              {(
                data.reduce((s, d) => s + (d.position || 0), 0) / data.length
              ).toFixed(1)}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}

function MozSection({ domainId }: { domainId: string }) {
  const qc = useQueryClient();
  const { data: moz, isLoading } = useQuery({
    queryKey: ["moz-data", domainId],
    queryFn: () => api.getMozData(domainId),
  });

  if (isLoading) {
    return (
      <div className="bg-panel-card border border-panel-border rounded-lg p-8 text-center">
        <RefreshCw className="w-4 h-4 animate-spin text-panel-muted mx-auto" />
      </div>
    );
  }

  if (!moz) return null;

  // ─── Group backlinks by domain ───
  const backlinks = moz.backlinks || [];
  const byDomain = new Map<string, any[]>();
  for (const bl of backlinks) {
    if (!byDomain.has(bl.sourceDomain)) byDomain.set(bl.sourceDomain, []);
    byDomain.get(bl.sourceDomain)!.push(bl);
  }
  const domainGroups = Array.from(byDomain.entries())
    .map(([domain, links]) => {
      const avgDA =
        links.reduce((s: number, l: any) => s + (l.mozSourceDA || 0), 0) /
        links.length;
      const avgPA =
        links.reduce((s: number, l: any) => s + (l.mozSourcePA || 0), 0) /
        links.length;
      const avgSpam =
        links.reduce((s: number, l: any) => s + (l.mozSourceSpam || 0), 0) /
        links.length;
      return { domain, links, avgDA, avgPA, avgSpam, count: links.length };
    })
    .sort((a, b) => b.avgDA - a.avgDA);

  // ─── Group backlinks by anchor text ───
  const byAnchor = new Map<string, any[]>();
  for (const bl of backlinks) {
    const anchor = bl.anchorText || "(pusty)";
    if (!byAnchor.has(anchor)) byAnchor.set(anchor, []);
    byAnchor.get(anchor)!.push(bl);
  }
  const anchorGroups = Array.from(byAnchor.entries())
    .map(([anchor, links]) => {
      const uniqueDomains = new Set(links.map((l: any) => l.sourceDomain)).size;
      return { anchor, links, uniqueDomains, count: links.length };
    })
    .sort((a, b) => b.uniqueDomains - a.uniqueDomains || b.count - a.count);

  return (
    <div className="space-y-3">
      {/* Moz Backlinks — grouped by domain, COLLAPSED by default */}
      {backlinks.length > 0 && (
        <CollapsibleSection
          title={`Backlinki z Moz — ${moz.stats.total} linków z ${moz.stats.uniqueDomains} domen`}
          icon={<ExternalLink className="w-3.5 h-3.5 text-accent-blue" />}
          badge={
            <div className="flex gap-3 text-[10px] text-panel-muted">
              <span>
                Śr. DA:{" "}
                <strong className="text-accent-green">
                  {moz.stats.avgSourceDA}
                </strong>
              </span>
              <span>
                Dofollow:{" "}
                <strong className="text-accent-cyan">
                  {moz.stats.dofollow}
                </strong>
              </span>
              <span>
                Live:{" "}
                <strong className="text-accent-green">{moz.stats.live}</strong>
              </span>
            </div>
          }
          defaultOpen={false}
        >
          <MozBacklinksGrouped groups={domainGroups} />
        </CollapsibleSection>
      )}

      {/* Anchor text — expandable, COLLAPSED by default */}
      {anchorGroups.length > 0 && (
        <CollapsibleSection
          title={`Dystrybucja anchor text (Moz) — ${anchorGroups.length} unikalnych`}
          icon={<Search className="w-3.5 h-3.5 text-accent-amber" />}
          badge={
            <span className="text-[10px] text-panel-muted">
              {backlinks.length} linków łącznie
            </span>
          }
          defaultOpen={false}
        >
          <MozAnchorsGrouped groups={anchorGroups} />
        </CollapsibleSection>
      )}

      {!moz.mozDA && !backlinks.length && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-6 text-center text-panel-muted text-sm">
          Brak danych Moz. Kliknij "Sync Moz" aby pobrać dane.
        </div>
      )}
    </div>
  );
}

function MozMetricCard({
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

function MozBacklinksGrouped({ groups }: { groups: any[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (domain: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Domena źródłowa</th>
            <th>Linków</th>
            <th>DA</th>
            <th>PA</th>
            <th>Spam</th>
            <th>Typ</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const isOpen = expanded.has(group.domain);
            const doCount = group.links.filter((l: any) => l.isDofollow).length;
            const noCount = group.links.length - doCount;

            return (
              <React.Fragment key={group.domain}>
                {/* Domain summary row */}
                <tr
                  className="cursor-pointer hover:bg-panel-hover/20"
                  onClick={() => toggle(group.domain)}
                >
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-panel-muted">
                        {isOpen ? "▼" : "▶"}
                      </span>
                      <Globe className="w-3 h-3 text-accent-blue shrink-0" />
                      <a
                        href={`https://${group.domain}`}
                        target="_blank"
                        className="text-accent-blue hover:underline font-semibold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {group.domain}
                      </a>
                    </div>
                  </td>
                  <td className="text-accent-cyan font-semibold">
                    {group.count}
                  </td>
                  <td>
                    <span
                      className={cn(
                        "font-mono font-bold",
                        group.avgDA >= 40
                          ? "text-accent-green"
                          : group.avgDA >= 20
                            ? "text-accent-amber"
                            : "text-accent-red",
                      )}
                    >
                      {group.avgDA.toFixed(0)}
                    </span>
                  </td>
                  <td className="text-accent-blue font-mono">
                    {group.avgPA.toFixed(0)}
                  </td>
                  <td
                    className={cn(
                      "font-mono",
                      group.avgSpam <= 30
                        ? "text-accent-green"
                        : group.avgSpam <= 60
                          ? "text-accent-amber"
                          : "text-accent-red",
                    )}
                  >
                    {group.avgSpam.toFixed(0)}
                  </td>
                  <td>
                    <span
                      className={cn(
                        "badge",
                        doCount > 0 && noCount === 0
                          ? "badge-pass"
                          : "badge-neutral",
                      )}
                    >
                      {doCount}do / {noCount}no
                    </span>
                  </td>
                </tr>

                {/* Expanded — individual links */}
                {isOpen &&
                  group.links.map((bl: any) => (
                    <tr key={bl.id} className="bg-panel-bg/30">
                      <td className="pl-8 max-w-[250px] truncate" colSpan={2}>
                        <a
                          href={bl.sourceUrl}
                          target="_blank"
                          className="text-panel-dim hover:underline text-[10px]"
                        >
                          {bl.sourceUrl
                            .replace(/^https?:\/\//, "")
                            .slice(0, 70)}
                        </a>
                      </td>
                      <td colSpan={2} className="max-w-[180px] truncate">
                        <span className="text-[9px] text-panel-muted mr-1">
                          →
                        </span>
                        <a
                          href={bl.targetUrl}
                          target="_blank"
                          className="text-accent-cyan hover:underline text-[10px]"
                        >
                          {bl.page?.path ||
                            bl.targetUrl.replace(/^https?:\/\/[^/]+/, "")}
                        </a>
                      </td>
                      <td className="text-panel-muted max-w-[120px] truncate text-[10px]">
                        {bl.anchorText || "—"}
                      </td>
                      <td>
                        <span
                          className={cn(
                            "badge",
                            bl.isDofollow ? "badge-pass" : "badge-neutral",
                          )}
                        >
                          {bl.isDofollow ? "do" : "no"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MozAnchorsGrouped({ groups }: { groups: any[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (anchor: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(anchor) ? next.delete(anchor) : next.add(anchor);
      return next;
    });
  };

  const maxDomains = groups[0]?.uniqueDomains || 1;

  return (
    <div className="p-4 space-y-1">
      {groups.map((g, i) => {
        const isOpen = expanded.has(g.anchor);
        const pctBar = Math.round((g.uniqueDomains / maxDomains) * 100);

        // Group links by domain for expanded view
        const byDomain = new Map<string, any[]>();
        for (const bl of g.links) {
          if (!byDomain.has(bl.sourceDomain)) byDomain.set(bl.sourceDomain, []);
          byDomain.get(bl.sourceDomain)!.push(bl);
        }
        const domainList = Array.from(byDomain.entries())
          .map(([domain, links]) => ({ domain, links, count: links.length }))
          .sort((a, b) => b.count - a.count);

        return (
          <div key={i}>
            {/* Anchor summary row — clickable */}
            <div
              className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-panel-hover/20 rounded px-2 py-1.5 -mx-2 transition-all"
              onClick={() => toggle(g.anchor)}
            >
              <span className="text-[9px] text-panel-muted">
                {isOpen ? "▼" : "▶"}
              </span>
              <span className="font-mono text-accent-amber truncate w-56">
                "{g.anchor}"
              </span>
              <div className="flex-1 h-1.5 bg-panel-border/30 rounded overflow-hidden">
                <div
                  className="h-full bg-accent-amber/50 rounded"
                  style={{ width: `${Math.max(pctBar, 2)}%` }}
                />
              </div>
              <span className="text-panel-muted shrink-0 w-16 text-right">
                {g.uniqueDomains} domen
              </span>
              <span className="text-panel-dim shrink-0 w-16 text-right">
                {g.count} linków
              </span>
            </div>

            {/* Expanded — domains using this anchor */}
            {isOpen && (
              <div className="ml-6 mt-1 mb-2 border-l-2 border-accent-amber/20 pl-3 space-y-1">
                {domainList.map((dg) => (
                  <MozAnchorDomainGroup
                    key={dg.domain}
                    domain={dg.domain}
                    links={dg.links}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MozAnchorDomainGroup({
  domain,
  links,
}: {
  domain: string;
  links: any[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div
        className="flex items-center gap-2 text-[10px] cursor-pointer hover:bg-panel-hover/20 rounded px-1 py-0.5 transition-all"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[8px] text-panel-muted">{open ? "▼" : "▶"}</span>
        <Globe className="w-2.5 h-2.5 text-accent-blue shrink-0" />
        <a
          href={`https://${domain}`}
          target="_blank"
          className="text-accent-blue hover:underline font-semibold"
          onClick={(e) => e.stopPropagation()}
        >
          {domain}
        </a>
        <span className="text-panel-muted">
          {links.length} {links.length === 1 ? "link" : "linków"}
        </span>
        {links[0]?.mozSourceDA > 0 && (
          <span
            className={cn(
              "font-mono text-[9px]",
              links[0].mozSourceDA >= 40
                ? "text-accent-green"
                : links[0].mozSourceDA >= 20
                  ? "text-accent-amber"
                  : "text-accent-red",
            )}
          >
            DA {links[0].mozSourceDA.toFixed(0)}
          </span>
        )}
        <span
          className={cn(
            "badge ml-auto",
            links.every((l: any) => l.isDofollow)
              ? "badge-pass"
              : "badge-neutral",
          )}
        >
          {links.filter((l: any) => l.isDofollow).length}do
        </span>
      </div>

      {open && (
        <div className="ml-5 mt-0.5 mb-1 space-y-0.5">
          {links.map((bl: any) => (
            <div
              key={bl.id}
              className="flex items-center gap-2 text-[9px] text-panel-dim pl-1"
            >
              <a
                href={bl.sourceUrl}
                target="_blank"
                className="hover:underline truncate flex-1"
              >
                {bl.sourceUrl.replace(/^https?:\/\//, "").slice(0, 60)}
              </a>
              <span className="text-panel-muted">→</span>
              <a
                href={bl.targetUrl}
                target="_blank"
                className="text-accent-cyan hover:underline truncate max-w-[150px]"
              >
                {bl.page?.path || bl.targetUrl.replace(/^https?:\/\/[^/]+/, "")}
              </a>
              <span
                className={cn(
                  "badge",
                  bl.isDofollow ? "badge-pass" : "badge-neutral",
                )}
              >
                {bl.isDofollow ? "do" : "no"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RemoveFromIndexButton({
  domainId,
  pageId,
  path,
  verdict,
}: {
  domainId: string;
  pageId: string;
  path: string;
  verdict: string;
}) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    mutationFn: () => api.removeFromIndex(domainId, pageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages", domainId] });
      setConfirming(false);
    },
  });

  const confirmRemoved = useMutation({
    mutationFn: () => api.confirmRemoved(domainId, pageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", domainId] }),
  });

  if (verdict === "REMOVED") return null;

  if (verdict === "REMOVAL_REQUESTED") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          confirmRemoved.mutate();
        }}
        className="ml-2 text-[9px] text-accent-amber hover:text-accent-green transition-colors"
        title="Potwierdź usunięcie z indeksu"
      >
        ✓ potwierdź usunięcie
      </button>
    );
  }

  if (confirming) {
    return (
      <span
        className="inline-flex items-center gap-1 ml-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[9px] text-accent-red">Usunąć?</span>
        <button
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          className="text-[9px] text-accent-red font-bold hover:underline"
        >
          {remove.isPending ? "..." : "TAK"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[9px] text-panel-muted hover:underline"
        >
          nie
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      className="ml-2 text-[9px] text-panel-dim hover:text-accent-red transition-colors"
      title="Usuń z indeksu Google"
    >
      🗑
    </button>
  );
}
