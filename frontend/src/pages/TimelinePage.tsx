// frontend/src/pages/TimelinePage.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtDate, cn } from "../lib/utils";
import { RefreshCw, Link2, Star, Globe, Clock } from "lucide-react";

type Tab = "events" | "backlinks";

const EVENT_CONFIG: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  BACKLINK_NEW: {
    icon: "🔗",
    color: "text-accent-green",
    label: "Nowy backlink",
  },
  BACKLINK_LOST: {
    icon: "💔",
    color: "text-accent-red",
    label: "Utracony backlink",
  },
  POSITION_IMPROVED: {
    icon: "📈",
    color: "text-accent-green",
    label: "Wzrost pozycji",
  },
  POSITION_DROPPED: {
    icon: "📉",
    color: "text-accent-red",
    label: "Spadek pozycji",
  },
  ENTERED_TOP3: {
    icon: "🏆",
    color: "text-accent-amber",
    label: "Wejście do TOP 3",
  },
  ENTERED_TOP10: {
    icon: "⬆️",
    color: "text-accent-green",
    label: "Wejście do TOP 10",
  },
  LEFT_TOP10: {
    icon: "⬇️",
    color: "text-accent-red",
    label: "Wypadnięcie z TOP 10",
  },
  PAGE_INDEXED: {
    icon: "✅",
    color: "text-accent-green",
    label: "Zaindeksowana",
  },
  PAGE_DEINDEXED: {
    icon: "🔴",
    color: "text-accent-red",
    label: "Wyindeksowana",
  },
  PAGE_FIRST_CRAWL: {
    icon: "🤖",
    color: "text-accent-cyan",
    label: "Pierwszy crawl",
  },
  PAGE_ADDED_SITEMAP: {
    icon: "🗺️",
    color: "text-accent-blue",
    label: "Dodano do sitemap",
  },
  PAGE_REMOVED_SITEMAP: {
    icon: "🗑️",
    color: "text-accent-red",
    label: "Usunięto z sitemap",
  },
  TRAFFIC_SPIKE: {
    icon: "🚀",
    color: "text-accent-green",
    label: "Skok ruchu",
  },
  TRAFFIC_DROP: { icon: "📉", color: "text-accent-red", label: "Spadek ruchu" },
  INTERNAL_LINK_NEW: {
    icon: "🔗",
    color: "text-accent-blue",
    label: "Nowy link wewnętrzny",
  },
  INTERNAL_LINK_LOST: {
    icon: "💔",
    color: "text-accent-amber",
    label: "Utracony link wewnętrzny",
  },
};

export function TimelinePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("events");
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: api.getDomains,
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["timeline", selectedDomain, typeFilter],
    queryFn: () => {
      if (!selectedDomain) return Promise.resolve([]);
      return api.getDomainTimeline(selectedDomain, 200);
    },
    enabled: tab === "events" && !!selectedDomain,
  });

  const { data: backlinksData, isLoading: backlinksLoading } = useQuery({
    queryKey: ["backlinks", selectedDomain],
    queryFn: () => api.getDomainBacklinks(selectedDomain),
    enabled: tab === "backlinks" && !!selectedDomain,
  });

  const detectAll = useMutation({
    mutationFn: api.detectChanges,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeline"] });
      qc.invalidateQueries({ queryKey: ["backlinks"] });
    },
  });

  const syncBl = useMutation({
    mutationFn: () => api.syncBacklinks(selectedDomain),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backlinks"] }),
  });

  const filteredEvents =
    typeFilter && events
      ? events.filter((e: any) => e.type === typeFilter)
      : events;

  // Group events by date
  const groupedEvents = new Map<string, any[]>();
  for (const e of filteredEvents || []) {
    const date = new Date(e.createdAt).toLocaleDateString("pl-PL");
    if (!groupedEvents.has(date)) groupedEvents.set(date, []);
    groupedEvents.get(date)!.push(e);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Timeline SEO</h1>
          <p className="text-sm text-panel-muted mt-0.5">
            Historia zmian pozycji, backlinków i eventów
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input text-xs py-1.5 min-w-[200px]"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
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
            Wykryj zmiany
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-panel-border">
        <button
          onClick={() => setTab("events")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px",
            tab === "events"
              ? "border-accent-blue text-accent-blue"
              : "border-transparent text-panel-muted hover:text-panel-text",
          )}
        >
          <Clock className="w-3.5 h-3.5" /> Events
        </button>
        <button
          onClick={() => setTab("backlinks")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px",
            tab === "backlinks"
              ? "border-accent-blue text-accent-blue"
              : "border-transparent text-panel-muted hover:text-panel-text",
          )}
        >
          <Link2 className="w-3.5 h-3.5" /> Backlinks
        </button>
      </div>

      {!selectedDomain && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-12 text-center text-panel-muted text-sm">
          Wybierz domenę żeby zobaczyć timeline
        </div>
      )}

      {/* EVENTS TAB */}
      {tab === "events" && selectedDomain && (
        <div className="space-y-4">
          {/* Type filter */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setTypeFilter("")}
              className={cn(
                "badge cursor-pointer",
                !typeFilter ? "badge-pass" : "badge-unknown",
              )}
            >
              Wszystkie ({events?.length || 0})
            </button>
            {Object.entries(EVENT_CONFIG).map(([type, cfg]) => {
              const count = (events || []).filter(
                (e: any) => e.type === type,
              ).length;
              if (count === 0) return null;
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(typeFilter === type ? "" : type)}
                  className={cn(
                    "badge cursor-pointer",
                    typeFilter === type ? "badge-pass" : "badge-unknown",
                  )}
                >
                  {cfg.icon} {cfg.label} ({count})
                </button>
              );
            })}
          </div>

          {eventsLoading ? (
            <Loading />
          ) : !filteredEvents?.length ? (
            <div className="bg-panel-card border border-panel-border rounded-lg p-8 text-center text-panel-muted text-sm">
              Brak eventów. Odpal "Wykryj zmiany" żeby przeskanować dane.
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(groupedEvents.entries()).map(([date, dayEvents]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-xs font-bold text-panel-muted font-mono">
                      {date}
                    </div>
                    <div className="flex-1 h-px bg-panel-border" />
                    <div className="text-[10px] text-panel-muted">
                      {dayEvents.length} eventów
                    </div>
                  </div>
                  <div className="space-y-1.5 pl-4 border-l-2 border-panel-border">
                    {dayEvents.map((e: any) => {
                      const cfg = EVENT_CONFIG[e.type] || {
                        icon: "❓",
                        color: "text-panel-muted",
                        label: e.type,
                      };
                      return (
                        <div
                          key={e.id}
                          className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-panel-hover/30 transition-all"
                        >
                          <span className="text-base shrink-0">{cfg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  cfg.color,
                                )}
                              >
                                {cfg.label}
                              </span>
                              {e.importance >= 3 && (
                                <Star className="w-3 h-3 text-accent-amber fill-accent-amber" />
                              )}
                            </div>
                            {e.page && (
                              <div className="text-[11px] text-accent-blue font-mono truncate mt-0.5">
                                {e.page.path}
                              </div>
                            )}
                            {e.data && (
                              <EventDetail type={e.type} data={e.data} />
                            )}
                          </div>
                          <span className="text-[10px] text-panel-muted font-mono shrink-0">
                            {new Date(e.createdAt).toLocaleTimeString("pl-PL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BACKLINKS TAB */}
      {tab === "backlinks" && selectedDomain && (
        <div className="space-y-4">
          {/* Stats */}
          {backlinksData?.stats && (
            <div className="grid grid-cols-6 gap-3">
              <MiniStat
                label="Wszystkie"
                value={backlinksData.stats.total}
                color="#3b82f6"
              />
              <MiniStat
                label="Aktywne"
                value={backlinksData.stats.live}
                color="#22c55e"
              />
              <MiniStat
                label="Utracone"
                value={backlinksData.stats.lost}
                color="#ef4444"
              />
              <MiniStat
                label="Dofollow"
                value={backlinksData.stats.dofollow}
                color="#06b6d4"
              />
              <MiniStat
                label="Nofollow"
                value={backlinksData.stats.nofollow}
                color="#f59e0b"
              />
              <MiniStat
                label="Uniq. domen"
                value={backlinksData.stats.uniqueDomains}
                color="#a855f7"
              />
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
              Sync backlinks
            </button>
          </div>

          {backlinksLoading ? (
            <Loading />
          ) : !backlinksData?.byDomain?.length ? (
            <div className="bg-panel-card border border-panel-border rounded-lg p-8 text-center text-panel-muted text-sm">
              Brak danych o backlinkach. Odpal crawl linków i sync backlinks.
            </div>
          ) : (
            <div className="space-y-3">
              {backlinksData.byDomain.map((group: any) => (
                <div
                  key={group.domain}
                  className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto"
                >
                  <div className="px-4 py-2.5 border-b border-panel-border flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-accent-cyan" />
                    <span className="text-xs font-mono font-semibold">
                      {group.domain}
                    </span>
                    <span className="ml-auto badge badge-pass">
                      {group.count} linków
                    </span>
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
                      {group.links.slice(0, 10).map((bl: any) => (
                        <tr key={bl.id}>
                          <td className="max-w-[250px] truncate">
                            <a
                              href={bl.sourceUrl}
                              target="_blank"
                              rel="noopener"
                              className="text-accent-blue hover:underline"
                            >
                              {bl.sourceUrl.replace(/^https?:\/\/[^/]+/, "")}
                            </a>
                          </td>
                          <td className="max-w-[200px] truncate">
                            <a
                              href={bl.targetUrl}
                              target="_blank"
                              rel="noopener"
                              className="text-accent-cyan hover:underline"
                            >
                              {bl.page?.path ||
                                bl.targetUrl.replace(/^https?:\/\/[^/]+/, "")}
                            </a>
                          </td>
                          <td className="text-panel-muted max-w-[150px] truncate">
                            {bl.anchorText || "—"}
                          </td>
                          <td>
                            <span
                              className={cn(
                                "badge",
                                bl.isDofollow ? "badge-pass" : "badge-neutral",
                              )}
                            >
                              {bl.isDofollow ? "dofollow" : "nofollow"}
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
                  {group.count > 10 && (
                    <div className="px-4 py-2 text-[10px] text-panel-muted border-t border-panel-border">
                      + {group.count - 10} więcej...
                    </div>
                  )}
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
  if (type.includes("POSITION") || type.includes("TOP")) {
    return (
      <div className="mt-1 text-[11px] space-y-1">
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
            <span className="text-panel-muted">· {data.clicks} kliknięć</span>
          )}
        </div>
        {data.query && (
          <div className="flex items-center gap-1.5 bg-panel-bg/50 rounded px-2 py-1">
            <span className="text-panel-muted">fraza:</span>
            <span className="font-mono text-accent-amber font-semibold">
              "{data.query}"
            </span>
            {data.queryPosition && (
              <span className="text-panel-muted">
                · poz. {data.queryPosition}
              </span>
            )}
            {data.queryClicks > 0 && (
              <span className="text-panel-muted">
                · {data.queryClicks} kliknięć
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (type.includes("BACKLINK")) {
    return (
      <div className="mt-1 text-[11px] space-y-0.5">
        <div className="flex items-center gap-1">
          <span className="text-panel-muted">z:</span>
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noopener"
            className="font-mono text-accent-cyan hover:underline truncate max-w-[400px]"
          >
            {data.sourceUrl}
          </a>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-panel-muted">→</span>
          <a
            href={data.targetUrl}
            target="_blank"
            rel="noopener"
            className="font-mono text-accent-blue hover:underline truncate max-w-[400px]"
          >
            {data.targetUrl}
          </a>
        </div>
        {data.anchor && (
          <div className="text-panel-dim">anchor: "{data.anchor}"</div>
        )}
        {data.recovered && (
          <span className="badge badge-neutral">odzyskany</span>
        )}
      </div>
    );
  }

  return null;
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="stat-card" style={{ "--stat-accent": color } as any}>
      <div className="text-lg font-bold font-mono" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-panel-muted mt-0.5">{label}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
