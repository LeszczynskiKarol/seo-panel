// frontend/src/components/FinancialHistoryPanel.tsx

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { cn, fmtNumber } from "../lib/utils";
import {
  X,
  RefreshCw,
  ChevronDown,
  ArrowUpCircle,
  ArrowDownCircle,
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
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [sortField, setSortField] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [filterDomain, setFilterDomain] = useState<string>("");

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

                    {/* Actions */}
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingEntry(entry)}
                          className="text-panel-muted hover:text-accent-blue text-[10px] transition-colors"
                          title="Edytuj"
                        >
                          ✎
                        </button>
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
                      </div>
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
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={() => {
            setEditingEntry(null);
            qc.invalidateQueries({ queryKey: ["costs"] });
            qc.invalidateQueries({ queryKey: ["revenues"] });
            qc.invalidateQueries({ queryKey: ["global-summary"] });
          }}
        />
      )}
    </div>
  );
}

// ─── EDIT ENTRY MODAL ───

const COST_CATS_LIST = Object.entries(COST_CATEGORIES);
const REV_CATS_LIST = Object.entries(REVENUE_CATEGORIES);

function EditEntryModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: FinancialEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCost = entry.type === "cost";
  const cats = isCost ? COST_CATS_LIST : REV_CATS_LIST;
  const catsMap = isCost ? COST_CATEGORIES : REVENUE_CATEGORIES;

  const [category, setCategory] = useState(entry.category);
  const [label, setLabel] = useState(entry.label);
  const [amount, setAmount] = useState(String(entry.amount));
  const [date, setDate] = useState(entry.date.split("T")[0]);
  const [isRecurring, setIsRecurring] = useState(entry.isRecurring);
  const [notes, setNotes] = useState(entry.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!label || !amount || !date) return;
    setSaving(true);
    try {
      const data = {
        category,
        label,
        amount: parseFloat(amount),
        date,
        isRecurring,
        notes: notes || null,
      };
      if (isCost) {
        await api.updateCost(entry.id, data);
      } else {
        await api.updateRevenue(entry.id, data);
      }
      onSaved();
    } catch (e: any) {
      console.error("Edit failed:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-panel-card border border-panel-border rounded-xl p-6 w-[480px] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">
            Edytuj {isCost ? "koszt" : "przychód"}
          </h3>
          <button
            onClick={onClose}
            className="text-panel-muted hover:text-panel-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category */}
        <div>
          <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
            Kategoria
          </label>
          <div className="flex flex-wrap gap-1.5">
            {cats
              .filter(([k]) => !(isCost && k === "GOOGLE_ADS"))
              .map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] border transition-all flex items-center gap-1",
                    category === key
                      ? isCost
                        ? "border-accent-blue bg-accent-blue/10 text-accent-blue"
                        : "border-accent-green bg-accent-green/10 text-accent-green"
                      : "border-panel-border text-panel-muted hover:text-panel-text",
                  )}
                >
                  <span>{cat.icon}</span> {cat.label}
                </button>
              ))}
          </div>
        </div>

        {/* Label */}
        <div>
          <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
            Opis
          </label>
          <input
            className="input w-full"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {/* Amount + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
              Kwota (PLN)
            </label>
            <input
              className="input w-full"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
              Data
            </label>
            <input
              className="input w-full"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Recurring */}
        <label className="flex items-center gap-2 text-[11px] text-panel-muted cursor-pointer">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="rounded"
          />
          Powtarzalny miesięcznie
        </label>

        {/* Notes */}
        <div>
          <label className="text-[10px] text-panel-muted uppercase tracking-wider mb-1 block">
            Notatki
          </label>
          <textarea
            className="input w-full h-16 resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost text-xs">
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={!label || !amount || saving}
            className={cn(
              "btn text-xs flex items-center gap-1 text-white",
              isCost
                ? "bg-accent-blue hover:bg-accent-blue/80"
                : "bg-accent-green hover:bg-accent-green/80",
            )}
          >
            {saving ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              "Zapisz zmiany"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
