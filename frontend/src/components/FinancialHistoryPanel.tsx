// frontend/src/components/FinancialHistoryPanel.tsx

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { cn, fmtNumber } from "../lib/utils";
import {
  Plus,
  X,
  RefreshCw,
  ChevronDown,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  Calendar,
} from "lucide-react";

// ─── CONSTANTS ───

const COST_CATEGORIES: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  GOOGLE_ADS: { label: "Google Ads", icon: "📢", color: "#ef4444" },
  INFRASTRUCTURE: { label: "Infrastruktura", icon: "🖥️", color: "#3b82f6" },
  TAXES: { label: "Podatki", icon: "🏛️", color: "#f59e0b" },
  ZUS: { label: "Składki ZUS", icon: "🏥", color: "#a855f7" },
  TOOLS: { label: "Narzędzia", icon: "🔧", color: "#06b6d4" },
  MARKETING: { label: "Marketing", icon: "📣", color: "#ec4899" },
  OTHER: { label: "Inne koszty", icon: "📋", color: "#64748b" },
};

const REVENUE_CATEGORIES: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  ECOMMERCE: { label: "E-commerce", icon: "🛒", color: "#22c55e" },
  SAAS: { label: "SaaS", icon: "💻", color: "#3b82f6" },
  EBOOK: { label: "Ebooki", icon: "📚", color: "#a855f7" },
  FREELANCE: { label: "Freelance", icon: "✍️", color: "#f59e0b" },
  AFFILIATE: { label: "Afiliacja", icon: "🤝", color: "#06b6d4" },
  CONSULTING: { label: "Konsultacje", icon: "💼", color: "#ec4899" },
  OTHER: { label: "Inne przychody", icon: "📋", color: "#64748b" },
};

const PAGE_SIZES = [12, 20, 50, 100, 500, -1] as const;
type PageSize = (typeof PAGE_SIZES)[number];

function pageSizeLabel(size: PageSize): string {
  return size === -1 ? "Wszystkie" : String(size);
}

type EntryType = "cost" | "revenue";
type FilterType = "all" | "cost" | "revenue";

interface FinancialEntry {
  id: string;
  type: EntryType;
  category: string;
  label: string;
  amount: number;
  date: string;
  domainLabel: string;
  isRecurring: boolean;
  notes: string | null;
}

// ─── MAIN COMPONENT ───

export function FinancialHistoryPanel({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const qc = useQueryClient();
  const [pageSize, setPageSize] = useState<number>(20);
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterDomain, setFilterDomain] = useState<string>("");
  const [sortField, setSortField] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Fetch both costs and revenues
  const { data: costs, isLoading: costsLoading } = useQuery({
    queryKey: ["costs", startDate, endDate],
    queryFn: () => api.getCosts(`startDate=${startDate}&endDate=${endDate}`),
  });

  const { data: revenues, isLoading: revenuesLoading } = useQuery({
    queryKey: ["revenues", startDate, endDate],
    queryFn: () => api.getRevenues(`startDate=${startDate}&endDate=${endDate}`),
  });

  const deleteCost = useMutation({
    mutationFn: (id: string) => api.deleteCost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costs"] });
      qc.invalidateQueries({ queryKey: ["global-summary"] });
    },
  });

  const deleteRevenue = useMutation({
    mutationFn: (id: string) => api.deleteRevenue(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["global-summary"] });
    },
  });

  // Merge and sort
  const allEntries = useMemo<FinancialEntry[]>(() => {
    const costEntries: FinancialEntry[] = (costs || []).map((c: any) => ({
      id: c.id,
      type: "cost" as EntryType,
      category: c.category,
      label: c.label,
      amount: c.amount,
      date: c.date,
      domainLabel: c.domain?.label || c.domain?.domain || "",
      isRecurring: c.isRecurring,
      notes: c.notes,
    }));

    const revEntries: FinancialEntry[] = (revenues || []).map((r: any) => ({
      id: r.id,
      type: "revenue" as EntryType,
      category: r.category,
      label: r.label,
      amount: r.amount,
      date: r.date,
      domainLabel: r.domain?.label || r.domain?.domain || "",
      isRecurring: r.isRecurring,
      notes: r.notes,
    }));

    return [...costEntries, ...revEntries];
  }, [costs, revenues]);

  // Filter
  const filtered = useMemo(() => {
    let entries = allEntries;

    if (filterType !== "all") {
      entries = entries.filter((e) => e.type === filterType);
    }
    if (filterCategory) {
      entries = entries.filter((e) => e.category === filterCategory);
    }
    if (filterDomain) {
      entries = entries.filter((e) =>
        e.domainLabel.toLowerCase().includes(filterDomain.toLowerCase()),
      );
    }

    // Sort
    entries.sort((a, b) => {
      if (sortField === "date") {
        const cmp = a.date.localeCompare(b.date);
        return sortDir === "desc" ? -cmp : cmp;
      } else {
        const cmp = a.amount - b.amount;
        return sortDir === "desc" ? -cmp : cmp;
      }
    });

    return entries;
  }, [
    allEntries,
    filterType,
    filterCategory,
    filterDomain,
    sortField,
    sortDir,
  ]);

  // Pagination
  const displayed =
    pageSize === -1 ? filtered : filtered.slice(0, visibleCount);
  const hasMore = pageSize !== -1 && visibleCount < filtered.length;

  // Update visible count when page size changes
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setVisibleCount(size === -1 ? filtered.length : size);
  };

  const handleShowMore = () => {
    setVisibleCount((prev) =>
      Math.min(prev + (pageSize === -1 ? 50 : pageSize), filtered.length),
    );
  };

  // Stats
  const totalCostsAmount = allEntries
    .filter((e) => e.type === "cost")
    .reduce((s, e) => s + e.amount, 0);
  const totalRevenueAmount = allEntries
    .filter((e) => e.type === "revenue")
    .reduce((s, e) => s + e.amount, 0);

  const isLoading = costsLoading || revenuesLoading;

  if (isLoading) {
    return (
      <div className="bg-panel-card border border-panel-border rounded-lg p-8 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-panel-muted" />
      </div>
    );
  }

  // All categories for filter dropdown
  const allCategories = [
    ...Object.entries(COST_CATEGORIES).map(([k, v]) => ({
      key: k,
      label: v.label,
      icon: v.icon,
      type: "cost",
    })),
    ...Object.entries(REVENUE_CATEGORIES).map(([k, v]) => ({
      key: k,
      label: v.label,
      icon: v.icon,
      type: "revenue",
    })),
  ];

  const toggleSort = (field: "date" | "amount") => {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <div className="bg-panel-card border border-panel-border rounded-lg overflow-hidden">
      {/* ═══ HEADER ═══ */}
      <div className="px-4 py-3 border-b border-panel-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-panel-muted" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Historia finansów
            </span>
            <span className="text-[10px] text-panel-dim font-mono">
              {startDate} → {endDate}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            {/* Totals */}
            <span className="flex items-center gap-1">
              <ArrowDownCircle className="w-3 h-3 text-accent-red" />
              <span className="text-accent-red font-mono font-bold">
                -{fmtNumber(Math.round(totalCostsAmount))} zł
              </span>
            </span>
            <span className="flex items-center gap-1">
              <ArrowUpCircle className="w-3 h-3 text-accent-green" />
              <span className="text-accent-green font-mono font-bold">
                +{fmtNumber(Math.round(totalRevenueAmount))} zł
              </span>
            </span>
            <span className="text-panel-muted">|</span>
            <span className="font-mono text-panel-dim">
              {filtered.length} wpisów
            </span>
          </div>
        </div>

        {/* ═══ FILTERS ROW ═══ */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type filter */}
          <div className="flex gap-0.5 bg-panel-bg/50 rounded p-0.5">
            {(
              [
                { key: "all", label: "Wszystko" },
                { key: "cost", label: "Koszty" },
                { key: "revenue", label: "Przychody" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] transition-all",
                  filterType === f.key
                    ? f.key === "cost"
                      ? "bg-accent-red/20 text-accent-red font-semibold"
                      : f.key === "revenue"
                        ? "bg-accent-green/20 text-accent-green font-semibold"
                        : "bg-accent-blue/20 text-accent-blue font-semibold"
                    : "text-panel-muted hover:text-panel-text",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <select
            className="input text-[10px] py-0.5 w-[160px]"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Wszystkie kategorie</option>
            <optgroup label="Koszty">
              {Object.entries(COST_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Przychody">
              {Object.entries(REVENUE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </optgroup>
          </select>

          {/* Domain search */}
          <input
            className="input text-[10px] py-0.5 w-[140px]"
            placeholder="Szukaj domeny..."
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
          />

          {/* Page size */}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[9px] text-panel-muted">Pokaż:</span>
            {PAGE_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => handlePageSizeChange(size)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-mono transition-all",
                  pageSize === size
                    ? "bg-accent-blue/20 text-accent-blue font-bold"
                    : "text-panel-muted hover:text-panel-text",
                )}
              >
                {pageSizeLabel(size)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ TABLE ═══ */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-panel-muted text-sm">
          Brak wpisów finansowych w tym okresie
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="w-[60px]">Typ</th>
                <th
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("date")}
                >
                  Data{" "}
                  {sortField === "date" && (
                    <span className="text-accent-blue">
                      {sortDir === "desc" ? "↓" : "↑"}
                    </span>
                  )}
                </th>
                <th>Kategoria</th>
                <th>Opis</th>
                <th
                  className="cursor-pointer select-none text-right"
                  onClick={() => toggleSort("amount")}
                >
                  Kwota{" "}
                  {sortField === "amount" && (
                    <span className="text-accent-blue">
                      {sortDir === "desc" ? "↓" : "↑"}
                    </span>
                  )}
                </th>
                <th>Domena</th>
                <th className="w-[30px]"></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((entry) => {
                const isCost = entry.type === "cost";
                const cats = isCost ? COST_CATEGORIES : REVENUE_CATEGORIES;
                const cat = cats[entry.category] || {
                  label: entry.category,
                  icon: "📋",
                  color: "#64748b",
                };

                return (
                  <tr
                    key={`${entry.type}-${entry.id}`}
                    className={cn(
                      "transition-colors",
                      isCost ? "hover:bg-red-500/5" : "hover:bg-green-500/5",
                    )}
                  >
                    {/* Type badge */}
                    <td>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold",
                          isCost
                            ? "bg-accent-red/10 text-accent-red"
                            : "bg-accent-green/10 text-accent-green",
                        )}
                      >
                        {isCost ? (
                          <ArrowDownCircle className="w-2.5 h-2.5" />
                        ) : (
                          <ArrowUpCircle className="w-2.5 h-2.5" />
                        )}
                        {isCost ? "Koszt" : "Przychód"}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="text-panel-muted font-mono text-[11px]">
                      {new Date(entry.date).toLocaleDateString("pl-PL")}
                    </td>

                    {/* Category */}
                    <td>
                      <span className="flex items-center gap-1 text-[10px]">
                        <span>{cat.icon}</span>
                        <span style={{ color: cat.color }}>{cat.label}</span>
                      </span>
                    </td>

                    {/* Label */}
                    <td className="text-panel-text text-[11px] max-w-[250px] truncate">
                      {entry.label}
                      {entry.isRecurring && (
                        <span className="ml-1 text-[8px] text-accent-purple bg-accent-purple/10 px-1 rounded">
                          🔄 cykliczny
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="text-right">
                      <span
                        className={cn(
                          "font-mono font-bold text-[12px]",
                          isCost ? "text-accent-red" : "text-accent-green",
                        )}
                      >
                        {isCost ? "-" : "+"}
                        {fmtNumber(Math.round(entry.amount * 100) / 100)} zł
                      </span>
                    </td>

                    {/* Domain */}
                    <td className="text-panel-muted text-[10px]">
                      {entry.domainLabel || "—"}
                    </td>

                    {/* Delete */}
                    <td>
                      <button
                        onClick={() =>
                          isCost
                            ? deleteCost.mutate(entry.id)
                            : deleteRevenue.mutate(entry.id)
                        }
                        className="text-panel-muted hover:text-accent-red text-[10px] transition-colors"
                        title="Usuń"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ FOOTER — SHOW MORE + SUMMARY ═══ */}
      <div className="px-4 py-3 border-t border-panel-border flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-panel-muted">
          <span>
            Widoczne:{" "}
            <strong className="text-panel-text">{displayed.length}</strong> z{" "}
            <strong className="text-panel-text">{filtered.length}</strong>
          </span>
          {filterType !== "all" || filterCategory || filterDomain ? (
            <button
              onClick={() => {
                setFilterType("all");
                setFilterCategory("");
                setFilterDomain("");
              }}
              className="text-accent-blue hover:text-accent-blue/80 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Wyczyść filtry
            </button>
          ) : null}
        </div>

        {hasMore && (
          <button
            onClick={handleShowMore}
            className="btn btn-ghost text-[10px] flex items-center gap-1"
          >
            <ChevronDown className="w-3 h-3" />
            Pokaż kolejne{" "}
            {Math.min(
              pageSize === -1 ? 50 : pageSize,
              filtered.length - visibleCount,
            )}
          </button>
        )}
      </div>
    </div>
  );
}
