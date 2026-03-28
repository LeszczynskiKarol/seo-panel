import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtDate, cn } from "../lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  RefreshCw,
  Link2,
  Star,
  Globe,
  Clock,
  Calendar,
  BarChart3,
} from "lucide-react";

type Tab = "events" | "backlinks";
type View = "list" | "chart" | "calendar";

const EVENT_CONFIG: Record<
  string,
  {
    icon: string;
    color: string;
    label: string;
    group: "positive" | "negative" | "neutral";
  }
> = {
  POSITION_IMPROVED: {
    icon: "📈",
    color: "text-accent-green",
    label: "Wzrost pozycji",
    group: "positive",
  },
  ENTERED_TOP10: {
    icon: "⬆️",
    color: "text-accent-green",
    label: "TOP 10",
    group: "positive",
  },
  ENTERED_TOP3: {
    icon: "🏆",
    color: "text-accent-amber",
    label: "TOP 3",
    group: "positive",
  },
  POSITION_DROPPED: {
    icon: "📉",
    color: "text-accent-red",
    label: "Spadek pozycji",
    group: "negative",
  },
  LEFT_TOP10: {
    icon: "⬇️",
    color: "text-accent-red",
    label: "Wypad z TOP 10",
    group: "negative",
  },
  BACKLINK_NEW: {
    icon: "🔗",
    color: "text-accent-cyan",
    label: "Nowy backlink",
    group: "positive",
  },
  BACKLINK_LOST: {
    icon: "💔",
    color: "text-accent-red",
    label: "Utracony backlink",
    group: "negative",
  },
  PAGE_INDEXED: {
    icon: "✅",
    color: "text-accent-green",
    label: "Zaindeksowana",
    group: "positive",
  },
  PAGE_DEINDEXED: {
    icon: "🔴",
    color: "text-accent-red",
    label: "Wyindeksowana",
    group: "negative",
  },
  PAGE_FIRST_CRAWL: {
    icon: "🤖",
    color: "text-accent-cyan",
    label: "Pierwszy crawl",
    group: "neutral",
  },
  PAGE_ADDED_SITEMAP: {
    icon: "🗺️",
    color: "text-accent-blue",
    label: "Nowa w sitemap",
    group: "neutral",
  },
  PAGE_REMOVED_SITEMAP: {
    icon: "🗑️",
    color: "text-accent-red",
    label: "Usunięta z sitemap",
    group: "negative",
  },
  TRAFFIC_SPIKE: {
    icon: "🚀",
    color: "text-accent-green",
    label: "Skok ruchu",
    group: "positive",
  },
  TRAFFIC_DROP: {
    icon: "📉",
    color: "text-accent-red",
    label: "Spadek ruchu",
    group: "negative",
  },
  INTERNAL_LINK_NEW: {
    icon: "🔗",
    color: "text-accent-blue",
    label: "Nowy link wew.",
    group: "neutral",
  },
  INTERNAL_LINK_LOST: {
    icon: "💔",
    color: "text-accent-amber",
    label: "Utracony link wew.",
    group: "negative",
  },
};

export function TimelinePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("events");
  const [view, setView] = useState<View>("chart");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState("");
  const [days, setDays] = useState(30);

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: api.getDomains,
  });
  const { data: allEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["timeline", selectedDomain],
    queryFn: () =>
      selectedDomain
        ? api.getDomainTimeline(selectedDomain, 2000)
        : Promise.resolve([]),
    enabled: tab === "events" && !!selectedDomain,
  });
  const { data: backlinksData, isLoading: backlinksLoading } = useQuery({
    queryKey: ["backlinks", selectedDomain],
    queryFn: () => api.getDomainBacklinks(selectedDomain),
    enabled: tab === "backlinks" && !!selectedDomain,
  });
  const detectAll = useMutation({
    mutationFn: api.detectChanges,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timeline"] }),
  });
  const syncBl = useMutation({
    mutationFn: () => api.syncBacklinks(selectedDomain),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backlinks"] }),
  });

  const sinceDate = new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];
  const events = useMemo(
    () =>
      (allEvents || []).filter(
        (e: any) =>
          new Date(e.createdAt).toISOString().split("T")[0] >= sinceDate,
      ),
    [allEvents, sinceDate],
  );
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events as any[]) c[e.type] = (c[e.type] || 0) + 1;
    return c;
  }, [events]);

  const toggleType = (type: string) => {
    const n = new Set(activeTypes);
    if (n.has(type)) n.delete(type);
    else n.add(type);
    setActiveTypes(n);
    setSelectedDate("");
  };

  const filteredEvents = useMemo(() => {
    let f = events as any[];
    if (activeTypes.size > 0) f = f.filter((e) => activeTypes.has(e.type));
    if (selectedDate)
      f = f.filter(
        (e) =>
          new Date(e.createdAt).toISOString().split("T")[0] === selectedDate,
      );
    return f;
  }, [events, activeTypes, selectedDate]);

  const chartData = useMemo(() => {
    if (!events.length) return [];
    const vis =
      activeTypes.size > 0 ? activeTypes : new Set(Object.keys(EVENT_CONFIG));
    const byDate = new Map<string, any>();
    for (const e of events as any[]) {
      if (!vis.has(e.type)) continue;
      const date = new Date(e.createdAt).toISOString().split("T")[0];
      if (!byDate.has(date))
        byDate.set(date, { date, positive: 0, negative: 0, neutral: 0 });
      const d = byDate.get(date)!;
      d[EVENT_CONFIG[e.type]?.group || "neutral"]++;
    }
    return Array.from(byDate.values()).sort((a: any, b: any) =>
      a.date.localeCompare(b.date),
    );
  }, [events, activeTypes]);

  const calendarData = useMemo(() => {
    const vis =
      activeTypes.size > 0 ? activeTypes : new Set(Object.keys(EVENT_CONFIG));
    const byDate = new Map<
      string,
      { positive: number; negative: number; total: number }
    >();
    for (const e of events as any[]) {
      if (!vis.has(e.type)) continue;
      const date = new Date(e.createdAt).toISOString().split("T")[0];
      if (!byDate.has(date))
        byDate.set(date, { positive: 0, negative: 0, total: 0 });
      const d = byDate.get(date)!;
      d.total++;
      if (EVENT_CONFIG[e.type]?.group === "positive") d.positive++;
      else if (EVENT_CONFIG[e.type]?.group === "negative") d.negative++;
    }
    const r = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000)
        .toISOString()
        .split("T")[0];
      r.push({
        date,
        ...(byDate.get(date) || { positive: 0, negative: 0, total: 0 }),
      });
    }
    return r;
  }, [events, activeTypes, days]);

  const groupedEvents = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of filteredEvents) {
      const d = new Date(e.createdAt).toLocaleDateString("pl-PL");
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(e);
    }
    return m;
  }, [filteredEvents]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Timeline SEO</h1>
          <p className="text-xs text-panel-muted mt-0.5">
            Historia zmian pozycji, backlinków i eventów
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input text-xs py-1.5 min-w-[180px]"
            value={selectedDomain}
            onChange={(e) => {
              setSelectedDomain(e.target.value);
              setSelectedDate("");
              setActiveTypes(new Set());
            }}
          >
            <option value="">Wybierz domenę</option>
            {(domains || []).map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.label || d.domain}
              </option>
            ))}
          </select>
          <button
            className="btn btn-ghost text-xs"
            onClick={() => detectAll.mutate()}
            disabled={detectAll.isPending}
          >
            <RefreshCw
              className={cn(
                "w-3.5 h-3.5 mr-1",
                detectAll.isPending && "animate-spin",
              )}
            />
            Wykryj
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-panel-border">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("events")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px",
              tab === "events"
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-panel-muted",
            )}
          >
            <Clock className="w-3.5 h-3.5" /> Events ({events.length})
          </button>
          <button
            onClick={() => setTab("backlinks")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px",
              tab === "backlinks"
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-panel-muted",
            )}
          >
            <Link2 className="w-3.5 h-3.5" /> Backlinks
          </button>
        </div>
        {tab === "events" && selectedDomain && (
          <div className="flex items-center gap-3 pb-1">
            <div className="flex gap-1">
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDays(d);
                    setSelectedDate("");
                  }}
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
            <div className="w-px h-4 bg-panel-border" />
            <div className="flex gap-1">
              {(
                [
                  ["chart", BarChart3],
                  ["calendar", Calendar],
                  ["list", Clock],
                ] as [View, any][]
              ).map(([v, I]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "p-1.5 rounded",
                    view === v
                      ? "bg-accent-blue/20 text-accent-blue"
                      : "text-panel-muted",
                  )}
                >
                  <I className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!selectedDomain && (
        <div className="bg-panel-card border border-panel-border rounded p-8 text-center text-panel-muted text-sm">
          Wybierz domenę
        </div>
      )}

      {tab === "events" && selectedDomain && (
        <div className="space-y-3">
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => {
                setActiveTypes(new Set());
                setSelectedDate("");
              }}
              className={cn(
                "badge cursor-pointer",
                activeTypes.size === 0 ? "badge-pass" : "badge-unknown",
              )}
            >
              Wszystkie ({events.length})
            </button>
            {Object.entries(EVENT_CONFIG).map(([t, cfg]) => {
              const c = typeCounts[t] || 0;
              if (!c) return null;
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={cn(
                    "badge cursor-pointer",
                    activeTypes.has(t) ? "badge-pass" : "badge-unknown",
                  )}
                >
                  {cfg.icon} {cfg.label} ({c})
                </button>
              );
            })}
            {selectedDate && (
              <button
                onClick={() => setSelectedDate("")}
                className="badge badge-neutral cursor-pointer"
              >
                {selectedDate} ✕
              </button>
            )}
          </div>

          {eventsLoading ? (
            <Loading />
          ) : (
            <>
              {view === "chart" && chartData.length > 0 && (
                <div className="bg-panel-card border border-panel-border rounded p-4">
                  <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-2">
                    Eventy — {days}d{" "}
                    {activeTypes.size > 0
                      ? `(${activeTypes.size} typów)`
                      : "(wszystkie)"}
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={chartData}
                      onClick={(e: any) => {
                        if (e?.activePayload?.[0]?.payload?.date) {
                          setSelectedDate(e.activePayload[0].payload.date);
                          setView("list");
                        }
                      }}
                    >
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
                        formatter={(v: number, n: string) => [
                          v,
                          n === "positive"
                            ? "Pozytywne"
                            : n === "negative"
                              ? "Negatywne"
                              : "Neutralne",
                        ]}
                        labelFormatter={(d) => `${d} (kliknij)`}
                      />
                      <Bar dataKey="positive" stackId="a" fill="#22c55e" />
                      <Bar dataKey="neutral" stackId="a" fill="#3b82f6" />
                      <Bar
                        dataKey="negative"
                        stackId="a"
                        fill="#ef4444"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-4 mt-1 text-[8px] text-panel-muted">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-accent-green" />
                      Pozytywne
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-accent-blue" />
                      Neutralne
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-accent-red" />
                      Negatywne
                    </span>
                  </div>
                </div>
              )}

              {view === "calendar" && (
                <div className="bg-panel-card border border-panel-border rounded p-4">
                  <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-3">
                    Mapa — {days}d
                  </div>
                  <div className="flex flex-wrap gap-[3px]">
                    {calendarData.map((day) => {
                      const isNeg = day.negative > day.positive;
                      const int = Math.min(day.total, 20);
                      return (
                        <button
                          key={day.date}
                          onClick={() => {
                            setSelectedDate(
                              selectedDate === day.date ? "" : day.date,
                            );
                            if (selectedDate !== day.date) setView("list");
                          }}
                          title={`${day.date}: ${day.total} (${day.positive}↑ ${day.negative}↓)`}
                          className={cn(
                            "w-[14px] h-[14px] rounded-sm border",
                            selectedDate === day.date
                              ? "border-accent-blue ring-1 ring-accent-blue"
                              : "border-transparent",
                            day.total === 0
                              ? "bg-panel-border/30"
                              : isNeg
                                ? int > 10
                                  ? "bg-accent-red/60"
                                  : int > 5
                                    ? "bg-accent-red/40"
                                    : "bg-accent-red/20"
                                : int > 10
                                  ? "bg-accent-green/60"
                                  : int > 5
                                    ? "bg-accent-green/40"
                                    : "bg-accent-green/20",
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {events.length > 0 && (
                <div className="flex gap-2">
                  {[
                    {
                      l: "Pozytywne",
                      v: events.filter(
                        (e: any) => EVENT_CONFIG[e.type]?.group === "positive",
                      ).length,
                      c: "#22c55e",
                    },
                    {
                      l: "Negatywne",
                      v: events.filter(
                        (e: any) => EVENT_CONFIG[e.type]?.group === "negative",
                      ).length,
                      c: "#ef4444",
                    },
                    {
                      l: "TOP 3",
                      v: typeCounts["ENTERED_TOP3"] || 0,
                      c: "#f59e0b",
                    },
                    {
                      l: "Backlinki",
                      v:
                        (typeCounts["BACKLINK_NEW"] || 0) +
                        (typeCounts["BACKLINK_LOST"] || 0),
                      c: "#06b6d4",
                    },
                    { l: "Łącznie", v: events.length, c: "#3b82f6" },
                  ].map((s) => (
                    <div
                      key={s.l}
                      className="stat-card flex-1"
                      style={{ "--stat-accent": s.c } as any}
                    >
                      <div
                        className="text-base font-bold font-mono"
                        style={{ color: s.c }}
                      >
                        {s.v}
                      </div>
                      <div className="text-[9px] text-panel-muted">{s.l}</div>
                    </div>
                  ))}
                </div>
              )}

              {(view === "list" || filteredEvents.length > 0) && (
                <div className="space-y-3">
                  {!filteredEvents.length ? (
                    <div className="bg-panel-card border border-panel-border rounded p-6 text-center text-panel-muted text-xs">
                      {selectedDate ? `Brak ${selectedDate}` : "Brak"}
                    </div>
                  ) : (
                    Array.from(groupedEvents.entries()).map(([date, de]) => (
                      <div key={date}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-xs font-bold text-panel-muted font-mono">
                            {date}
                          </div>
                          <div className="flex-1 h-px bg-panel-border" />
                          <div className="text-[10px] text-panel-muted">
                            {de.length}
                          </div>
                        </div>
                        <div className="space-y-1 pl-3 border-l-2 border-panel-border">
                          {de.map((e: any) => {
                            const cfg = EVENT_CONFIG[e.type] || {
                              icon: "❓",
                              color: "text-panel-muted",
                              label: e.type,
                            };
                            return (
                              <div
                                key={e.id}
                                className="flex items-start gap-2 py-1 px-2 rounded hover:bg-panel-hover/30"
                              >
                                <span className="text-sm shrink-0">
                                  {cfg.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "text-[11px] font-semibold",
                                        cfg.color,
                                      )}
                                    >
                                      {cfg.label}
                                    </span>
                                    {e.importance >= 3 && (
                                      <Star className="w-2.5 h-2.5 text-accent-amber fill-accent-amber" />
                                    )}
                                  </div>
                                  {e.page && (
                                    <div className="text-[10px] text-accent-blue font-mono truncate">
                                      {e.page.path}
                                    </div>
                                  )}
                                  {e.data && (
                                    <EventDetail type={e.type} data={e.data} />
                                  )}
                                </div>
                                <span className="text-[9px] text-panel-muted font-mono shrink-0">
                                  {new Date(e.createdAt).toLocaleTimeString(
                                    "pl-PL",
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "backlinks" && selectedDomain && (
        <div className="space-y-4">
          {backlinksData?.stats && (
            <div className="grid grid-cols-6 gap-2">
              {[
                { l: "Wszystkie", v: backlinksData.stats.total, c: "#3b82f6" },
                { l: "Aktywne", v: backlinksData.stats.live, c: "#22c55e" },
                { l: "Utracone", v: backlinksData.stats.lost, c: "#ef4444" },
                {
                  l: "Dofollow",
                  v: backlinksData.stats.dofollow,
                  c: "#06b6d4",
                },
                {
                  l: "Nofollow",
                  v: backlinksData.stats.nofollow,
                  c: "#f59e0b",
                },
                {
                  l: "Domeny",
                  v: backlinksData.stats.uniqueDomains,
                  c: "#a855f7",
                },
              ].map((s) => (
                <div
                  key={s.l}
                  className="stat-card"
                  style={{ "--stat-accent": s.c } as any}
                >
                  <div
                    className="text-base font-bold font-mono"
                    style={{ color: s.c }}
                  >
                    {s.v}
                  </div>
                  <div className="text-[9px] text-panel-muted">{s.l}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button
              className="btn btn-ghost text-xs"
              onClick={() => syncBl.mutate()}
              disabled={syncBl.isPending}
            >
              <RefreshCw
                className={cn(
                  "w-3.5 h-3.5 mr-1",
                  syncBl.isPending && "animate-spin",
                )}
              />
              Sync
            </button>
          </div>
          {backlinksLoading ? (
            <Loading />
          ) : !backlinksData?.byDomain?.length ? (
            <div className="bg-panel-card border border-panel-border rounded p-6 text-center text-panel-muted text-xs">
              Brak
            </div>
          ) : (
            <div className="space-y-2">
              {backlinksData.byDomain.map((g: any) => (
                <div
                  key={g.domain}
                  className="bg-panel-card border border-panel-border rounded overflow-x-auto"
                >
                  <div className="px-3 py-2 border-b border-panel-border flex items-center gap-2">
                    <Globe className="w-3 h-3 text-accent-cyan" />
                    <span className="text-[11px] font-mono font-semibold">
                      {g.domain}
                    </span>
                    <span className="ml-auto badge badge-pass">{g.count}</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Źródło</th>
                        <th>Cel</th>
                        <th>Anchor</th>
                        <th>Typ</th>
                        <th>Status</th>
                        <th>Wykryto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.links.slice(0, 10).map((bl: any) => (
                        <tr key={bl.id}>
                          <td className="max-w-[200px] truncate">
                            <a
                              href={bl.sourceUrl}
                              target="_blank"
                              className="text-accent-blue hover:underline"
                            >
                              {bl.sourceUrl.replace(/^https?:\/\/[^/]+/, "")}
                            </a>
                          </td>
                          <td className="max-w-[150px] truncate">
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
                          <td className="text-panel-muted">
                            {fmtDate(bl.firstSeen)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventDetail({ type, data }: { type: string; data: any }) {
  if (type.includes("POSITION") || type.includes("TOP"))
    return (
      <div className="mt-0.5 text-[10px] space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-panel-muted">poz.</span>
          <span className="font-mono text-accent-red">{data.from}</span>
          <span className="text-panel-muted">→</span>
          <span className="font-mono text-accent-green">{data.to}</span>
          {data.change && (
            <span
              className={cn(
                "font-mono font-semibold",
                data.change > 0 ? "text-accent-green" : "text-accent-red",
              )}
            >
              ({data.change > 0 ? "+" : ""}
              {data.change})
            </span>
          )}
          {data.clicks > 0 && (
            <span className="text-panel-muted">· {data.clicks} klik.</span>
          )}
        </div>
        {data.query && (
          <div className="flex items-center gap-1.5 bg-panel-bg/50 rounded px-1.5 py-0.5 w-fit">
            <span className="text-panel-muted">fraza:</span>
            <span className="font-mono text-accent-amber font-semibold">
              "{data.query}"
            </span>
            {data.queryPosition && (
              <span className="text-panel-muted">
                · poz. {data.queryPosition}
              </span>
            )}
          </div>
        )}
      </div>
    );
  if (type.includes("BACKLINK"))
    return (
      <div className="mt-0.5 text-[10px]">
        <span className="text-panel-muted">z: </span>
        <a
          href={data.sourceUrl}
          target="_blank"
          className="font-mono text-accent-cyan hover:underline"
        >
          {data.sourceUrl}
        </a>
        {data.anchor && (
          <span className="text-panel-dim ml-1">"{data.anchor}"</span>
        )}
      </div>
    );
  return null;
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-4 h-4 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
