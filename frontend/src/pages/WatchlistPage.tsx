// frontend/src/pages/WatchlistPage.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtPercent, fmtNumber, fmtDate, cn } from "../lib/utils";
import {
  RefreshCw,
  Plus,
  Trash2,
  TrendingUp,
  Search,
  Globe,
} from "lucide-react";

export function WatchlistPage() {
  const qc = useQueryClient();
  const [newKw, setNewKw] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<string>("");

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: api.getDomains,
  });

  const { data: keywords, isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: api.getWatchlist,
  });

  const addKw = useMutation({
    mutationFn: (kw: string) => api.addWatchKeyword(kw),
    onSuccess: () => {
      setNewKw("");
      qc.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  const removeKw = useMutation({
    mutationFn: (id: string) => api.removeWatchKeyword(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const checkAll = useMutation({
    mutationFn: api.checkWatchlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Watchlist</h1>
          <p className="text-sm text-panel-muted mt-0.5">
            Śledź pozycje na wybrane frazy kluczowe we wszystkich domenach
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input text-xs py-1.5 min-w-[180px]"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
          >
            <option value="">Wszystkie domeny</option>
            {(domains || []).map((d: any) => (
              <option key={d.id} value={d.domain}>
                {d.label || d.domain}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary text-xs"
            onClick={() => checkAll.mutate()}
            disabled={checkAll.isPending}
          >
            {checkAll.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
            )}
            {checkAll.isPending ? "Sprawdzam..." : "Sprawdź wszystkie"}
          </button>
        </div>
      </div>

      {/* Add keyword */}
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-accent-amber" />
          Dodaj frazę kluczową do śledzenia
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="np. silnik elektryczny 3kw, copywriting cena, praca magisterska psychologia..."
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newKw && addKw.mutate(newKw)}
          />
          <button
            className="btn btn-primary text-xs"
            onClick={() => newKw && addKw.mutate(newKw)}
            disabled={addKw.isPending || !newKw}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Dodaj
          </button>
        </div>
        <div className="text-[10px] text-panel-muted mt-1.5">
          System sprawdzi pozycje we wszystkich 23 domenach. Kliknij "Sprawdź
          wszystkie" po dodaniu.
        </div>
      </div>

      {/* Keywords list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-panel-muted" />
        </div>
      ) : !keywords?.length ? (
        <div className="bg-panel-card border border-panel-border rounded-lg p-12 text-center text-panel-muted text-sm">
          Brak śledzonych fraz. Dodaj frazę powyżej.
        </div>
      ) : (
        <div className="space-y-3">
          {keywords
            .filter((kw: any) => {
              if (!domainFilter) return true;
              const r = (kw.results || []) as any[];
              return r.some((res: any) => res.domainName === domainFilter);
            })
            .map((kw: any) => {
              const allResults = (kw.results || []) as any[];
              const results = domainFilter
                ? allResults.filter((r: any) => r.domainName === domainFilter)
                : allResults;
              const hasResults = allResults.length > 0;
              const isExpanded = expanded === kw.id;

              return (
                <div
                  key={kw.id}
                  className="bg-panel-card border border-panel-border rounded-lg overflow-hidden"
                >
                  {/* Keyword header */}
                  <div
                    className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-panel-hover/30 transition-all"
                    onClick={() => setExpanded(isExpanded ? null : kw.id)}
                  >
                    <span className="text-sm font-mono text-accent-amber font-bold">
                      "{kw.keyword}"
                    </span>

                    <div className="ml-auto flex items-center gap-4 text-xs">
                      {kw.bestPosition && (
                        <span className="text-panel-muted">
                          best:{" "}
                          <strong className="text-accent-green">
                            {kw.bestPosition.toFixed(1)}
                          </strong>
                        </span>
                      )}
                      <span className="text-panel-muted">
                        <strong className="text-panel-text">
                          {results.length}
                        </strong>
                        {domainFilter ? `/${allResults.length}` : ""} stron
                        rankuje
                      </span>
                      {kw.bestDomain && (
                        <span className="text-accent-cyan text-[11px] font-mono">
                          {kw.bestDomain}
                        </span>
                      )}
                      {kw.lastChecked && (
                        <span className="text-[10px] text-panel-muted">
                          {fmtDate(kw.lastChecked)}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeKw.mutate(kw.id);
                        }}
                        className="text-panel-muted hover:text-accent-red transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded — results table */}
                  {isExpanded && results.length > 0 && (
                    <div className="border-t border-panel-border overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Pozycja</th>
                            <th>Domena</th>
                            <th>URL</th>
                            <th>Kliknięcia</th>
                            <th>Wyświetlenia</th>
                            <th>CTR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r: any, i: number) => (
                            <tr key={i}>
                              <td>
                                <span
                                  className={cn(
                                    "font-mono font-bold",
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
                                </span>
                              </td>
                              <td>
                                <div className="flex items-center gap-1.5">
                                  <Globe className="w-3 h-3 text-panel-muted" />
                                  <span className="text-[11px] font-mono">
                                    {r.domain}
                                  </span>
                                </div>
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
                              <td className="text-accent-cyan font-semibold">
                                {r.clicks}
                              </td>
                              <td>{fmtNumber(r.impressions)}</td>
                              <td>{fmtPercent(r.ctr)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Cannibalization warning */}
                      {(() => {
                        const domainCounts = new Map<string, number>();
                        results.forEach((r: any) =>
                          domainCounts.set(
                            r.domainName,
                            (domainCounts.get(r.domainName) || 0) + 1,
                          ),
                        );
                        const cannibalized = Array.from(
                          domainCounts.entries(),
                        ).filter(([, count]) => count > 1);
                        if (cannibalized.length === 0) return null;
                        return (
                          <div className="px-4 py-2 border-t border-panel-border bg-accent-amber/5 text-[11px] text-accent-amber flex items-center gap-2">
                            ⚠️ Kanibalizacja:{" "}
                            {cannibalized
                              .map(([d, c]) => `${d} (${c} stron)`)
                              .join(", ")}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {isExpanded && results.length === 0 && (
                    <div className="border-t border-panel-border p-4 text-center text-panel-muted text-xs">
                      {domainFilter
                        ? `Brak wyników dla ${domainFilter} — ta domena nie rankuje na tę frazę`
                        : 'Brak danych — kliknij "Sprawdź wszystkie" żeby pobrać pozycje'}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
