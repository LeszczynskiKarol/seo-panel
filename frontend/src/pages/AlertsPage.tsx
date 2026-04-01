// frontend/src/pages/AlertsPage.tsx
// v2 — rich filtering, pagination, expandable details, domain/type/date filters

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtDateTime, severityColor, cn } from "../lib/utils";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Filter,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Calendar,
} from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  PAGE_DEINDEXED: "Deindeksacja",
  PAGE_INDEXED: "Zaindeksowano",
  TRAFFIC_DROP: "Spadek ruchu",
  BROKEN_LINK: "Złamany link",
  NEW_PAGE_NOT_INDEXED: "Brak indeksacji",
  POSITION_DROP: "Spadek pozycji",
  CRAWL_ERROR: "Błąd crawla",
  SITEMAP_CHANGE: "Zmiana sitemap",
  CONVERSION_DROP: "Spadek konwersji",
  CONVERSION_SPIKE: "Wzrost konwersji",
  REVENUE_DROP: "Spadek przychodu",
  BACKLINK_NEW: "Nowy backlink",
  BACKLINK_LOST: "Utracony backlink",
  DA_CHANGE: "Zmiana DA",
  MERCHANT_DISAPPROVED: "Produkt odrzucony",
  FEED_APPROVAL_DROP: "Spadek approval",
};

const TYPE_ICON: Record<string, string> = {
  PAGE_DEINDEXED: "🔴",
  PAGE_INDEXED: "✅",
  TRAFFIC_DROP: "📉",
  BROKEN_LINK: "🔗",
  NEW_PAGE_NOT_INDEXED: "⏳",
  POSITION_DROP: "⬇️",
  CRAWL_ERROR: "❌",
  SITEMAP_CHANGE: "🗺️",
  CONVERSION_DROP: "💸",
  CONVERSION_SPIKE: "🚀",
  REVENUE_DROP: "📉",
  BACKLINK_NEW: "🔗✨",
  BACKLINK_LOST: "🔗💔",
  DA_CHANGE: "📊",
  MERCHANT_DISAPPROVED: "🛒❌",
  FEED_APPROVAL_DROP: "🛒📉",
};

const DATE_PRESETS = [
  { label: "Dziś", days: 1 },
  { label: "7 dni", days: 7 },
  { label: "14 dni", days: 14 },
  { label: "30 dni", days: 30 },
  { label: "90 dni", days: 90 },
  { label: "Wszystko", days: 0 },
];

const PAGE_SIZES = [10, 20, 50, 100, 200, 500, 1000];

export function AlertsPage() {
  const qc = useQueryClient();

  // ─── Filters ───
  const [showResolved, setShowResolved] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedSeverities, setSelectedSeverities] = useState<Set<string>>(
    new Set(),
  );
  const [datePreset, setDatePreset] = useState(0); // 0 = all
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ─── Pagination ───
  const [pageSize, setPageSize] = useState(20);
  const [offset, setOffset] = useState(0);

  // ─── Expanded alerts ───
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  // ─── Build query params ───
  const queryParams = useMemo(() => {
    const parts: string[] = [];
    parts.push(`resolved=${showResolved ? "true" : "false"}`);
    parts.push(`limit=${pageSize}`);
    parts.push(`offset=${offset}`);

    if (selectedDomains.size > 0) {
      parts.push(`domains=${Array.from(selectedDomains).join(",")}`);
    }
    if (selectedTypes.size > 0) {
      parts.push(`type=${Array.from(selectedTypes).join(",")}`);
    }
    if (selectedSeverities.size > 0) {
      parts.push(`severity=${Array.from(selectedSeverities).join(",")}`);
    }
    if (searchQuery.trim()) {
      parts.push(`search=${encodeURIComponent(searchQuery.trim())}`);
    }

    // Date range
    if (customDateFrom) {
      parts.push(`dateFrom=${customDateFrom}`);
    } else if (datePreset > 0) {
      const from = new Date(Date.now() - datePreset * 86400000)
        .toISOString()
        .split("T")[0];
      parts.push(`dateFrom=${from}`);
    }
    if (customDateTo) {
      parts.push(`dateTo=${customDateTo}`);
    }

    return parts.join("&");
  }, [
    showResolved,
    selectedDomains,
    selectedTypes,
    selectedSeverities,
    datePreset,
    customDateFrom,
    customDateTo,
    searchQuery,
    pageSize,
    offset,
  ]);

  // ─── Data queries ───
  const { data, isLoading } = useQuery<any>({
    queryKey: ["alerts-v2", queryParams],
    queryFn: () => api.getAlerts(queryParams),
  });

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: () => api.getDomains(),
  });

  const detectAlerts = useMutation({
    mutationFn: () => api.detectAlerts(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-v2"] }),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => api.resolveAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-v2"] }),
  });

  // Handle both old format (array) and new format (object with alerts/total)
  const alerts = Array.isArray(data) ? data : data?.alerts || [];
  const total = Array.isArray(data) ? data?.length || 0 : data?.total || 0;

  const toggleExpand = (id: string) => {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDomain = (id: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setOffset(0);
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
    setOffset(0);
  };

  const toggleSeverity = (sev: string) => {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      next.has(sev) ? next.delete(sev) : next.add(sev);
      return next;
    });
    setOffset(0);
  };

  const clearFilters = () => {
    setSelectedDomains(new Set());
    setSelectedTypes(new Set());
    setSelectedSeverities(new Set());
    setDatePreset(0);
    setCustomDateFrom("");
    setCustomDateTo("");
    setSearchQuery("");
    setOffset(0);
  };

  const hasActiveFilters =
    selectedDomains.size > 0 ||
    selectedTypes.size > 0 ||
    selectedSeverities.size > 0 ||
    datePreset > 0 ||
    customDateFrom ||
    customDateTo ||
    searchQuery;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Alerty</h1>
          <p className="text-sm text-panel-muted mt-0.5">
            {total} {showResolved ? "wszystkich" : "aktywnych"} alertów
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost text-xs flex items-center gap-1.5"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? "Ukryj rozwiązane" : "Pokaż rozwiązane"}
          </button>
          <button
            className={cn(
              "btn btn-ghost text-xs flex items-center gap-1.5",
              showFilters && "bg-accent-blue/10 text-accent-blue",
            )}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtry
            {hasActiveFilters && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-accent-blue" />
            )}
          </button>
          <button
            className="btn btn-primary text-xs flex items-center gap-1.5"
            onClick={() => detectAlerts.mutate()}
            disabled={detectAlerts.isPending}
          >
            {detectAlerts.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            Wykryj alerty
          </button>
        </div>
      </div>

      {/* ═══ FILTERS PANEL ═══ */}
      {showFilters && (
        <div className="bg-panel-card border border-panel-border rounded-lg p-4 space-y-4">
          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-panel-muted" />
              <input
                className="input text-xs pl-9 w-full"
                placeholder="Szukaj w tytule / opisie..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setOffset(0);
                }}
              />
            </div>
            {hasActiveFilters && (
              <button
                className="text-xs text-accent-red hover:underline"
                onClick={clearFilters}
              >
                <X className="w-3 h-3 inline mr-0.5" />
                Wyczyść filtry
              </button>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-3.5 h-3.5 text-panel-muted" />
            <span className="text-[10px] text-panel-muted">Okres:</span>
            {DATE_PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => {
                  setDatePreset(p.days);
                  setCustomDateFrom("");
                  setCustomDateTo("");
                  setOffset(0);
                }}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-mono",
                  datePreset === p.days && !customDateFrom
                    ? "bg-accent-blue/20 text-accent-blue font-semibold"
                    : "text-panel-muted hover:text-panel-text",
                )}
              >
                {p.label}
              </button>
            ))}
            <span className="text-[10px] text-panel-muted ml-2">lub:</span>
            <input
              type="date"
              className="input text-[10px] py-0.5 w-[120px]"
              value={customDateFrom}
              onChange={(e) => {
                setCustomDateFrom(e.target.value);
                setDatePreset(0);
                setOffset(0);
              }}
            />
            <span className="text-[10px] text-panel-muted">–</span>
            <input
              type="date"
              className="input text-[10px] py-0.5 w-[120px]"
              value={customDateTo}
              onChange={(e) => {
                setCustomDateTo(e.target.value);
                setDatePreset(0);
                setOffset(0);
              }}
            />
          </div>

          {/* Domain filter */}
          <div>
            <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-1.5">
              Domeny
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(domains || []).map((d: any) => (
                <button
                  key={d.id}
                  onClick={() => toggleDomain(d.id)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] border transition-all",
                    selectedDomains.has(d.id)
                      ? "bg-accent-blue/10 border-accent-blue/30 text-accent-blue font-semibold"
                      : "border-panel-border text-panel-muted hover:text-panel-text hover:border-panel-muted",
                  )}
                >
                  {d.label || d.domain.replace("www.", "")}
                </button>
              ))}
            </div>
          </div>

          {/* Type + Severity filters side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-1.5">
                Typ alertu
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(TYPE_LABEL).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleType(key)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] border transition-all",
                      selectedTypes.has(key)
                        ? "bg-accent-blue/10 border-accent-blue/30 text-accent-blue"
                        : "border-panel-border text-panel-muted hover:text-panel-text",
                    )}
                  >
                    {TYPE_ICON[key] || "⚠️"} {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[9px] text-panel-muted uppercase tracking-wider mb-1.5">
                Priorytet
              </div>
              <div className="flex gap-1.5">
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => toggleSeverity(sev)}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] border font-semibold transition-all",
                      selectedSeverities.has(sev)
                        ? cn("border-current", severityColor(sev))
                        : "border-panel-border text-panel-muted hover:text-panel-text",
                    )}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PAGE SIZE SELECTOR ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-panel-muted">Pokaż:</span>
          {PAGE_SIZES.map((n) => (
            <button
              key={n}
              onClick={() => {
                setPageSize(n);
                setOffset(0);
              }}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono",
                pageSize === n
                  ? "bg-accent-blue/20 text-accent-blue font-semibold"
                  : "text-panel-muted hover:text-panel-text",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-panel-muted font-mono">
          {offset + 1}–{Math.min(offset + pageSize, total)} z {total}
        </span>
      </div>

      {/* ═══ ALERTS LIST ═══ */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-panel-muted" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-panel-card border border-panel-border rounded-lg p-12 text-center">
          <CheckCircle className="w-8 h-8 text-accent-green mx-auto mb-3 opacity-50" />
          <div className="text-sm text-panel-muted">
            {hasActiveFilters
              ? "Brak alertów pasujących do filtrów"
              : "Brak aktywnych alertów"}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {alerts.map((a: any) => {
            const isExpanded = expandedAlerts.has(a.id);
            const hasDescription = !!a.description;
            const descriptionLines = a.description?.split("\n") || [];
            const isMultiline = descriptionLines.length > 1;

            return (
              <div
                key={a.id}
                className={cn(
                  "bg-panel-card border border-panel-border rounded-lg transition-all",
                  a.isResolved && "opacity-40",
                )}
              >
                {/* Main row */}
                <div
                  className={cn(
                    "p-3.5 flex items-start gap-3",
                    hasDescription && "cursor-pointer hover:bg-panel-hover/20",
                  )}
                  onClick={() => hasDescription && toggleExpand(a.id)}
                >
                  {/* Expand chevron */}
                  <div className="mt-0.5 w-4 shrink-0">
                    {hasDescription ? (
                      isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-panel-muted" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-panel-muted" />
                      )
                    ) : null}
                  </div>

                  {/* Icon */}
                  <div className="text-base shrink-0">
                    {TYPE_ICON[a.type] || "⚠️"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wide",
                          severityColor(a.severity),
                        )}
                      >
                        {a.severity}
                      </span>
                      <span className="text-[10px] text-panel-muted font-mono">
                        {TYPE_LABEL[a.type] || a.type}
                      </span>
                      <span className="text-[10px] text-panel-muted">·</span>
                      <span className="text-[10px] text-panel-muted font-mono">
                        {a.domain?.label || a.domain?.domain}
                      </span>
                    </div>

                    <div className="text-sm font-medium">{a.title}</div>

                    {/* Collapsed preview — first line of description */}
                    {!isExpanded && hasDescription && (
                      <div className="text-[11px] text-panel-dim mt-0.5 truncate">
                        {descriptionLines[0]}
                        {isMultiline && (
                          <span className="text-accent-blue ml-1">
                            +{descriptionLines.length - 1} linii
                          </span>
                        )}
                      </div>
                    )}

                    {a.page && !isExpanded && (
                      <div className="text-[11px] text-accent-blue font-mono mt-0.5">
                        {a.page.path}
                      </div>
                    )}

                    <div className="text-[10px] text-panel-muted mt-1 font-mono">
                      {fmtDateTime(a.createdAt)}
                      {a.isResolved &&
                        ` · Rozwiązano: ${fmtDateTime(a.resolvedAt)}`}
                    </div>
                  </div>

                  {/* Resolve button */}
                  {!a.isResolved && (
                    <button
                      className="btn btn-ghost text-[10px] shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        resolve.mutate(a.id);
                      }}
                      disabled={resolve.isPending}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Rozwiąż
                    </button>
                  )}
                </div>

                {/* ═══ EXPANDED DETAIL ═══ */}
                {isExpanded && hasDescription && (
                  <div className="border-t border-panel-border bg-panel-bg/30 px-4 py-3 ml-[52px]">
                    {a.page && (
                      <div className="text-[11px] text-accent-blue font-mono mb-2">
                        {a.page.url || a.page.path}
                      </div>
                    )}

                    <pre className="text-[11px] text-panel-dim font-mono whitespace-pre-wrap leading-relaxed">
                      {a.description}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ PAGINATION ═══ */}
      {total > pageSize && (
        <div className="flex items-center justify-between pt-2">
          <button
            className="btn btn-ghost text-xs"
            onClick={() => setOffset(Math.max(0, offset - pageSize))}
            disabled={offset === 0}
          >
            ← Poprzednie
          </button>

          <div className="flex gap-1">
            {Array.from(
              { length: Math.min(10, Math.ceil(total / pageSize)) },
              (_, i) => {
                const pageOffset = i * pageSize;
                const isCurrent = offset === pageOffset;
                // Show first, last, and pages around current
                const currentPage = Math.floor(offset / pageSize);
                const totalPages = Math.ceil(total / pageSize);
                if (
                  i > 0 &&
                  i < totalPages - 1 &&
                  Math.abs(i - currentPage) > 2
                ) {
                  if (i === currentPage - 3 || i === currentPage + 3)
                    return (
                      <span key={i} className="text-panel-muted text-xs px-1">
                        ...
                      </span>
                    );
                  return null;
                }
                return (
                  <button
                    key={i}
                    onClick={() => setOffset(pageOffset)}
                    className={cn(
                      "w-7 h-7 rounded text-[10px] font-mono",
                      isCurrent
                        ? "bg-accent-blue text-white font-bold"
                        : "text-panel-muted hover:bg-panel-hover",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              },
            )}
          </div>

          <button
            className="btn btn-ghost text-xs"
            onClick={() => setOffset(offset + pageSize)}
            disabled={offset + pageSize >= total}
          >
            Następne →
          </button>
        </div>
      )}

      {/* Show more button */}
      {alerts.length > 0 &&
        alerts.length < total &&
        offset + pageSize < total && (
          <div className="text-center pt-1">
            <button
              className="text-xs text-accent-blue hover:underline"
              onClick={() => setOffset(offset + pageSize)}
            >
              Pokaż kolejne {Math.min(pageSize, total - offset - pageSize)} →
            </button>
          </div>
        )}
    </div>
  );
}
