// frontend/src/components/IntegrationsTab.tsx

import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { AdsSection } from "./AdsSection";
import {
  fmtNumber,
  fmtPercent,
  fmtDate,
  fmtPosition,
  cn,
  verdictBadge,
} from "../lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  RefreshCw,
  Plug,
  Search,
  Unplug,
  Activity,
  ShoppingCart,
  BarChart3,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  MousePointerClick,
  Eye,
  DollarSign,
  TrendingUp,
  Zap,
  Package,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface Props {
  domainId: string;
}

const PROVIDERS = [
  {
    key: "GOOGLE_ANALYTICS",
    label: "Google Analytics 4",
    icon: BarChart3,
    color: "text-accent-amber",
    bgColor: "bg-accent-amber/10",
    borderColor: "border-accent-amber/20",
    description: "Sesje, użytkownicy, konwersje, przychody, źródła ruchu",
    configField: "propertyId",
    configLabel: "GA4 Property ID",
    configPlaceholder: "properties/123456789",
    configHint:
      "Znajdziesz w GA4 → Admin → Property Details. Wpisz samo ID numeryczne lub pełne properties/...",
  },
  {
    key: "GOOGLE_MERCHANT",
    label: "Google Merchant Center",
    icon: ShoppingCart,
    color: "text-accent-blue",
    bgColor: "bg-accent-blue/10",
    borderColor: "border-accent-blue/20",
    description: "Produkty, statusy feedu, approved/disapproved, performance",
    configField: "merchantId",
    configLabel: "Merchant ID",
    configPlaceholder: "123456789",
    configHint:
      "Numeryczny ID widoczny w URL Merchant Center (np. merchants/123456789 → wpisz 123456789).",
  },
  {
    key: "GOOGLE_ADS",
    label: "Google Ads",
    icon: DollarSign,
    color: "text-accent-green",
    bgColor: "bg-accent-green/10",
    borderColor: "border-accent-green/20",
    description: "Kampanie, koszty, ROAS, konwersje, Shopping Ads",
    configField: "adsCustomerId",
    configLabel: "Customer ID",
    configPlaceholder: "123-456-7890",
    configHint: "Wymaga OAuth2 — wkrótce dostępne.",
    disabled: false,
  },
];

export function IntegrationsTab({ domainId }: Props) {
  const qc = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["integrations", domainId],
    queryFn: () => api.getIntegrations(domainId),
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-panel-muted" />
      </div>
    );
  }

  const intMap = new Map((integrations || []).map((i: any) => [i.provider, i]));

  return (
    <div className="space-y-4">
      <div className="text-[10px] text-panel-muted uppercase tracking-wider flex items-center gap-2">
        <Plug className="w-3.5 h-3.5" />
        Integracje Google — podłącz usługi do tej domeny
      </div>

      {PROVIDERS.map((provider) => {
        const integration = intMap.get(provider.key);
        return (
          <IntegrationCard
            key={provider.key}
            provider={provider}
            integration={integration}
            domainId={domainId}
          />
        );
      })}
    </div>
  );
}

// ─── INTEGRATION CARD ────────────────────────────────────────

function IntegrationCard({
  provider,
  integration,
  domainId,
}: {
  provider: (typeof PROVIDERS)[0];
  integration: any;
  domainId: string;
}) {
  const qc = useQueryClient();
  const [configValue, setConfigValue] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const Icon = provider.icon;

  const addMutation = useMutation({
    mutationFn: (value: string) =>
      api.addIntegration(domainId, {
        provider: provider.key,
        [provider.configField]: value,
      }),
    onSuccess: () => {
      setShowConfig(false);
      setConfigValue("");
      qc.invalidateQueries({ queryKey: ["integrations", domainId] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      api.syncIntegration(domainId, integration.id, { days: 30 }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["integrations", domainId] }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectIntegration(domainId, integration.id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["integrations", domainId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteIntegration(domainId, integration.id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["integrations", domainId] }),
  });

  const isConnected =
    integration && ["ACTIVE", "ERROR"].includes(integration.status);
  const isDisabled = provider.disabled;

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-all",
        isConnected
          ? "border-panel-border bg-panel-card"
          : isDisabled
            ? "border-panel-border/50 bg-panel-card/50 opacity-60"
            : "border-panel-border bg-panel-card",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "px-4 py-3 flex items-center gap-3",
          isConnected && "cursor-pointer hover:bg-panel-hover/10",
        )}
        onClick={() => isConnected && setExpanded(!expanded)}
      >
        <div className={cn("p-2 rounded-lg", provider.bgColor)}>
          <Icon className={cn("w-4 h-4", provider.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{provider.label}</span>
            <StatusBadge status={integration?.status} />
          </div>
          <div className="text-[10px] text-panel-muted mt-0.5">
            {provider.description}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isConnected && (
            <>
              {integration.lastSync && (
                <span className="text-[9px] text-panel-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmtDate(integration.lastSync)}
                </span>
              )}
              <button
                className="btn btn-ghost text-[10px] py-1"
                onClick={(e) => {
                  e.stopPropagation();
                  syncMutation.mutate();
                }}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  "Sync"
                )}
              </button>
              <button
                className="btn btn-danger text-[10px] py-1"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Odłączyć integrację? Dane zostaną zachowane."))
                    disconnectMutation.mutate();
                }}
              >
                <Unplug className="w-3 h-3" />
              </button>
              <span className="text-panel-muted">
                {expanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            </>
          )}

          {!isConnected && !isDisabled && (
            <button
              className="btn btn-primary text-xs"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Plug className="w-3 h-3 mr-1" />
              Podłącz
            </button>
          )}

          {isDisabled && (
            <span className="text-[10px] text-panel-muted bg-panel-border/30 px-2 py-1 rounded">
              Wkrótce
            </span>
          )}

          {integration?.status === "DISCONNECTED" && (
            <button
              className="btn btn-ghost text-[10px] py-1 text-accent-red"
              onClick={() => {
                if (
                  confirm(
                    "Usunąć integrację i WSZYSTKIE dane? Tej operacji nie można cofnąć.",
                  )
                )
                  deleteMutation.mutate();
              }}
            >
              Usuń
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {integration?.status === "ERROR" && integration.lastError && (
        <div className="px-4 py-2 bg-accent-red/5 border-t border-accent-red/10 text-[11px] text-accent-red flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Błąd połączenia</div>
            <div className="text-accent-red/80 mt-0.5">
              {integration.lastError}
            </div>
          </div>
        </div>
      )}

      {/* Config form (not connected) */}
      {showConfig && !isConnected && (
        <div className="px-4 py-3 border-t border-panel-border bg-panel-bg/30">
          <label className="text-[10px] text-panel-muted uppercase tracking-wider block mb-1.5">
            {provider.configLabel}
          </label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder={provider.configPlaceholder}
              value={configValue}
              onChange={(e) => setConfigValue(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                configValue &&
                addMutation.mutate(configValue)
              }
            />
            <button
              className="btn btn-primary text-xs"
              onClick={() => configValue && addMutation.mutate(configValue)}
              disabled={addMutation.isPending || !configValue}
            >
              {addMutation.isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                "Połącz"
              )}
            </button>
          </div>
          <div className="text-[10px] text-panel-muted mt-1.5">
            {provider.configHint}
          </div>
          {addMutation.isError && (
            <div className="text-[10px] text-accent-red mt-1.5">
              {(addMutation.error as any)?.message || "Błąd połączenia"}
            </div>
          )}
        </div>
      )}

      {/* Expanded data dashboard */}
      {expanded && isConnected && (
        <div className="border-t border-panel-border">
          {provider.key === "GOOGLE_ANALYTICS" && (
            <GA4Dashboard domainId={domainId} integration={integration} />
          )}
          {provider.key === "GOOGLE_MERCHANT" && (
            <MerchantDashboard domainId={domainId} integration={integration} />
          )}
          {provider.key === "GOOGLE_ADS" && <AdsSection domainId={domainId} />}
        </div>
      )}
    </div>
  );
}

// ─── STATUS BADGE ────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === "PENDING") return null;

  const map: Record<string, { label: string; className: string; icon: any }> = {
    ACTIVE: {
      label: "Aktywne",
      className: "bg-accent-green/15 text-accent-green",
      icon: CheckCircle,
    },
    ERROR: {
      label: "Błąd",
      className: "bg-accent-red/15 text-accent-red",
      icon: XCircle,
    },
    DISCONNECTED: {
      label: "Odłączono",
      className: "bg-panel-border text-panel-muted",
      icon: Unplug,
    },
  };

  const s = map[status] || map.DISCONNECTED;
  const Icon = s.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold",
        s.className,
      )}
    >
      <Icon className="w-2.5 h-2.5" />
      {s.label}
    </span>
  );
}

// ─── GA4 DASHBOARD ───────────────────────────────────────────

function GA4Dashboard({
  domainId,
  integration,
}: {
  domainId: string;
  integration: any;
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "overview" | "sources" | "landing"
  >("overview");

  // ─── Date range state ───
  const [days, setDays] = useState<number | null>(30);
  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  // ─── Data query — keepPreviousData prevents chart from disappearing ───
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "integration-data",
      domainId,
      integration.id,
      startDate,
      endDate,
    ],
    queryFn: () =>
      api.getIntegrationData(domainId, integration.id, { startDate, endDate }),
    placeholderData: keepPreviousData,
  });

  const { data: realtimeData } = useQuery({
    queryKey: ["integration-realtime", domainId, integration.id],
    queryFn: () => api.getIntegrationRealtime(domainId, integration.id),
    refetchInterval: 30000,
  });

  // Re-sync: pull fresh data from GA4 API for selected date range
  const resyncMutation = useMutation({
    mutationFn: () =>
      api.syncIntegration(domainId, integration.id, { startDate, endDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations", domainId] });
      qc.invalidateQueries({
        queryKey: ["integration-data", domainId, integration.id],
      });
    },
  });

  const cached = integration.cachedData as any;
  const agg = data?.aggregate;

  // Detect if selected range is outside what we have in DB
  const cachedStart = cached?.startDate;
  const cachedEnd = cached?.endDate;
  const needsResync =
    cachedStart &&
    cachedEnd &&
    (startDate < cachedStart || endDate > cachedEnd);

  // ─── Date helpers ───
  const presets = [7, 14, 30, 90, 180, 365];
  const today = new Date().toISOString().split("T")[0];

  const applyPreset = (d: number) => {
    setDays(d);
    setStartDate(
      new Date(Date.now() - d * 86400000).toISOString().split("T")[0],
    );
    setEndDate(today);
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setDays(null);
  };

  const rangeDays = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
  );

  if (isLoading && !cached && !data) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-4 h-4 animate-spin text-panel-muted mx-auto" />
      </div>
    );
  }

  return (
    <div>
      {/* ─── DATE RANGE PICKER + TABS ─── */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-panel-border/50 bg-panel-bg/20 flex-wrap gap-2">
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
          {days === null && (
            <span className="text-[9px] text-accent-purple font-mono">
              {rangeDays}d
            </span>
          )}
          {needsResync && (
            <button
              onClick={() => resyncMutation.mutate()}
              disabled={resyncMutation.isPending}
              className="btn btn-primary text-[10px] py-0.5 px-2"
            >
              {resyncMutation.isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                "Pobierz dane za ten okres"
              )}
            </button>
          )}
          {/* Subtle loading indicator — chart stays visible */}
          {isFetching && !isLoading && (
            <RefreshCw className="w-3 h-3 animate-spin text-accent-blue/50" />
          )}
        </div>
        <div className="flex gap-1">
          {(["overview", "sources", "landing"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] transition-all",
                activeTab === t
                  ? "bg-accent-amber/20 text-accent-amber font-semibold"
                  : "text-panel-muted hover:text-panel-text",
              )}
            >
              {t === "overview" && "Przegląd"}
              {t === "sources" && "Źródła"}
              {t === "landing" && "Landing pages"}
            </button>
          ))}
        </div>
      </div>

      {/* ─── STAT CARDS ─── */}
      <div className="grid grid-cols-6 gap-2 p-4">
        {realtimeData?.activeUsers != null && (
          <div
            className="stat-card"
            style={{ "--stat-accent": "#22c55e" } as any}
          >
            <div className="text-base font-bold font-mono text-accent-green flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {realtimeData.activeUsers}
            </div>
            <div className="text-[9px] text-panel-muted">Teraz online</div>
          </div>
        )}
        <div
          className="stat-card"
          style={{ "--stat-accent": "#06b6d4" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-cyan">
            {fmtNumber(agg?.totalSessions || cached?.sessions || 0)}
          </div>
          <div className="text-[9px] text-panel-muted">
            Sesje{days ? ` (${days}d)` : ""}
          </div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#a855f7" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-purple">
            {fmtNumber(agg?.totalUsers || cached?.users || 0)}
          </div>
          <div className="text-[9px] text-panel-muted">Użytkownicy</div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#3b82f6" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-blue">
            {fmtNumber(agg?.totalPageviews || 0)}
          </div>
          <div className="text-[9px] text-panel-muted">Odsłony</div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#f59e0b" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-amber">
            {agg?.totalConversions || cached?.conversions || 0}
          </div>
          <div className="text-[9px] text-panel-muted">Konwersje</div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#22c55e" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-green">
            {fmtNumber(agg?.totalRevenue || cached?.revenue || 0)} zł
          </div>
          <div className="text-[9px] text-panel-muted">Przychód</div>
        </div>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === "overview" && (
        <div>
          {data?.daily?.length > 0 ? (
            <div className="px-4 pb-4">
              <div className="text-[10px] text-panel-muted mb-1 flex justify-between">
                <span>Sesje, użytkownicy, konwersje</span>
                <span className="font-mono text-panel-dim">
                  {startDate} → {endDate}
                </span>
              </div>
              <GA4Chart data={data.daily} />
            </div>
          ) : !isLoading ? (
            <div className="px-4 pb-4 text-xs text-panel-muted text-center py-6">
              Brak danych za wybrany okres.
              {needsResync &&
                ' Kliknij "Pobierz dane za ten okres" aby pobrać z GA4.'}
            </div>
          ) : null}
        </div>
      )}

      {/* ═══ SOURCES TAB ═══ */}
      {activeTab === "sources" && (
        <div className="px-4 pb-4">
          <SourcesTable sources={data?.bySource || cached?.bySource || []} />
        </div>
      )}

      {/* ═══ LANDING PAGES TAB ═══ */}
      {activeTab === "landing" && (
        <div className="px-4 pb-4">
          <LandingPagesTable
            pages={data?.landingPages || cached?.landingPages || []}
          />
        </div>
      )}
    </div>
  );
}

function GA4Chart({ data }: { data: any[] }) {
  const [visible, setVisible] = useState({
    sessions: true,
    users: true,
    pageviews: false,
    conversions: true,
    revenue: false,
    bounceRate: false,
  });

  const toggle = (key: keyof typeof visible) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  // Left axis: sessions, users, pageviews (big numbers)
  // Right axis: conversions, revenue (small numbers / different scale)
  const hasLeft = visible.sessions || visible.users || visible.pageviews;
  const hasRight = visible.conversions || visible.revenue || visible.bounceRate;

  const metrics = [
    {
      key: "sessions",
      label: "Sesje",
      color: "#06b6d4",
      axis: "left",
      dash: undefined,
    },
    {
      key: "users",
      label: "Użytkownicy",
      color: "#a855f7",
      axis: "left",
      dash: "4 2",
    },
    {
      key: "pageviews",
      label: "Odsłony",
      color: "#3b82f6",
      axis: "left",
      dash: "2 2",
    },
    {
      key: "conversions",
      label: "Konwersje",
      color: "#f59e0b",
      axis: "right",
      dash: undefined,
    },
    {
      key: "revenue",
      label: "Przychód (zł)",
      color: "#22c55e",
      axis: "right",
      dash: "4 2",
    },
    {
      key: "bounceRate",
      label: "Bounce Rate",
      color: "#ef4444",
      axis: "right",
      dash: "2 2",
    },
  ] as const;

  return (
    <div>
      {/* Clickable legend */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => toggle(m.key)}
            className={cn(
              "flex items-center gap-1 text-[9px] font-mono transition-all rounded px-1.5 py-0.5",
              visible[m.key]
                ? "opacity-100"
                : "text-panel-muted line-through opacity-40 hover:opacity-60",
            )}
            style={
              visible[m.key]
                ? { color: m.color, backgroundColor: `${m.color}15` }
                : undefined
            }
          >
            <div
              className="w-2 h-2 rounded-sm"
              style={{ backgroundColor: visible[m.key] ? m.color : "#334155" }}
            />
            {m.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="ga4-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
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
          {hasLeft && (
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 7, fill: "#06b6d4" }}
              axisLine={false}
              tickLine={false}
              width={35}
            />
          )}
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 7, fill: "#f59e0b" }}
              axisLine={false}
              tickLine={false}
              width={35}
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
              if (name === "Bounce Rate")
                return [`${(value * 100).toFixed(1)}%`, name];
              if (name === "Przychód (zł)")
                return [`${value.toFixed(0)} zł`, name];
              return [value, name];
            }}
          />

          {metrics.map((m) =>
            visible[m.key] ? (
              <Area
                key={m.key}
                yAxisId={
                  m.axis === "left" && hasLeft
                    ? "left"
                    : hasRight
                      ? "right"
                      : "left"
                }
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                fill={m.key === "sessions" ? "url(#ga4-fill)" : "none"}
                strokeWidth={1.5}
                strokeDasharray={m.dash}
                name={m.label}
                dot={false}
              />
            ) : null,
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* Summary stats for visible metrics */}
      <div className="flex gap-3 text-[9px] text-panel-muted mt-1 flex-wrap">
        {visible.sessions && (
          <span>
            Sesje:{" "}
            <strong className="text-accent-cyan">
              {fmtNumber(data.reduce((s, d) => s + (d.sessions || 0), 0))}
            </strong>
          </span>
        )}
        {visible.users && (
          <span>
            Użytk.:{" "}
            <strong className="text-accent-purple">
              {fmtNumber(data.reduce((s, d) => s + (d.users || 0), 0))}
            </strong>
          </span>
        )}
        {visible.pageviews && (
          <span>
            Odsłony:{" "}
            <strong className="text-accent-blue">
              {fmtNumber(data.reduce((s, d) => s + (d.pageviews || 0), 0))}
            </strong>
          </span>
        )}
        {visible.conversions && (
          <span>
            Konw.:{" "}
            <strong className="text-accent-amber">
              {data.reduce((s, d) => s + (d.conversions || 0), 0)}
            </strong>
          </span>
        )}
        {visible.revenue && (
          <span>
            Przychód:{" "}
            <strong className="text-accent-green">
              {fmtNumber(data.reduce((s, d) => s + (d.revenue || 0), 0))} zł
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}

function SourcesTable({ sources }: { sources: any[] }) {
  if (!sources.length) {
    return (
      <div className="text-xs text-panel-muted text-center py-4">
        Brak danych o źródłach. Kliknij Sync.
      </div>
    );
  }

  const maxSessions = sources[0]?.sessions || 1;

  return (
    <div>
      <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2">
        Źródła ruchu
      </div>
      <div className="space-y-1.5">
        {sources.map((s: any, i: number) => {
          const pct = Math.round((s.sessions / maxSessions) * 100);
          return (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="font-mono text-panel-text truncate w-48">
                {s.sourceMedium}
              </span>
              <div className="flex-1 h-1.5 bg-panel-border/30 rounded overflow-hidden">
                <div
                  className="h-full bg-accent-cyan/40 rounded"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="text-accent-cyan font-mono font-semibold w-16 text-right shrink-0">
                {fmtNumber(s.sessions)}
              </span>
              <span className="text-panel-muted w-16 text-right shrink-0">
                {s.conversions > 0 ? (
                  <span className="text-accent-amber">
                    {s.conversions} conv.
                  </span>
                ) : (
                  "—"
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// PATCH for IntegrationsTab.tsx — replace the LandingPagesTable function

// Find and replace the existing LandingPagesTable function with this one:

function LandingPagesTable({ pages }: { pages: any[] }) {
  if (!pages.length) {
    return (
      <div className="text-xs text-panel-muted text-center py-4">
        Brak danych. Kliknij Sync aby pobrać landing pages.
      </div>
    );
  }

  return (
    <div>
      <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        Landing pages — GA4 + GSC korelacja
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>URL</th>
              <th className="text-accent-amber">Sesje</th>
              <th className="text-accent-amber">Conv.</th>
              <th className="text-accent-amber">Conv. Rate</th>
              <th className="text-accent-amber">Revenue</th>
              <th className="text-accent-cyan">GSC Clicks</th>
              <th className="text-accent-cyan">GSC Pos.</th>
              <th>Index</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p: any, i: number) => {
              // Handle both formats: correlated (ga4Sessions) and cached (sessions)
              const sessions = p.ga4Sessions ?? p.sessions ?? 0;
              const conversions = p.ga4Conversions ?? p.conversions ?? 0;
              const revenue = p.ga4Revenue ?? p.revenue ?? 0;
              const convRate =
                p.conversionRate ??
                (sessions > 0
                  ? Math.round((conversions / sessions) * 10000) / 100
                  : 0);
              const bounceRate = p.ga4BounceRate ?? p.bounceRate ?? 0;

              return (
                <tr key={i}>
                  <td className="max-w-[250px] truncate">
                    <a
                      href={p.path}
                      target="_blank"
                      className="text-accent-blue hover:underline"
                    >
                      {p.path}
                    </a>
                  </td>
                  <td className="text-accent-amber font-semibold">
                    {fmtNumber(sessions)}
                  </td>
                  <td
                    className={cn(
                      conversions > 0
                        ? "text-accent-green font-semibold"
                        : "text-panel-muted",
                    )}
                  >
                    {conversions}
                  </td>
                  <td
                    className={cn(
                      "font-mono",
                      convRate >= 5
                        ? "text-accent-green"
                        : convRate >= 1
                          ? "text-accent-amber"
                          : "text-panel-muted",
                    )}
                  >
                    {typeof convRate === "number" ? convRate.toFixed(1) : "0"}%
                  </td>
                  <td
                    className={cn(
                      revenue > 0 ? "text-accent-green" : "text-panel-muted",
                    )}
                  >
                    {revenue > 0 ? `${fmtNumber(revenue)} zł` : "—"}
                  </td>
                  <td className="text-accent-cyan">
                    {(p.gscClicks ?? 0) > 0 ? fmtNumber(p.gscClicks) : "—"}
                  </td>
                  <td
                    className={cn(
                      "font-mono",
                      p.gscPosition && p.gscPosition <= 3
                        ? "text-accent-green font-bold"
                        : p.gscPosition && p.gscPosition <= 10
                          ? "text-accent-cyan"
                          : "",
                    )}
                  >
                    {p.gscPosition ? p.gscPosition.toFixed(1) : "—"}
                  </td>
                  <td>
                    {p.indexingVerdict && (
                      <span
                        className={cn("badge", verdictBadge(p.indexingVerdict))}
                      >
                        {p.indexingVerdict}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ZAMIEŃ CAŁY komponent MerchantDashboard w IntegrationsTab.tsx
// ═══════════════════════════════════════════════════════════

function MerchantDashboard({
  domainId,
  integration,
}: {
  domainId: string;
  integration: any;
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "overview" | "products" | "disapproved"
  >("overview");
  const [productSearch, setProductSearch] = useState("");
  const [sortBy, setSortBy] = useState<"clicks" | "impressions" | "price">(
    "clicks",
  );
  const [showCount, setShowCount] = useState(50);

  // Date range state
  const [days, setDays] = useState<number | null>(30);
  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const cached = integration.cachedData as any;

  // Re-sync with custom dates
  const resyncMutation = useMutation({
    mutationFn: () =>
      api.syncIntegration(domainId, integration.id, {
        startDate,
        endDate,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["integrations", domainId] }),
  });

  if (!cached) {
    return (
      <div className="p-6 text-center text-panel-muted text-xs">
        Brak danych. Kliknij Sync aby pobrać.
      </div>
    );
  }

  const total = cached.totalProducts || 0;
  const approved = cached.approved || 0;
  const disapproved = cached.disapproved || 0;
  const pending = cached.pending || 0;
  const allProducts = (cached.topProducts || []) as any[];
  const allDailyPerformance = (cached.dailyPerformance || []) as any[];
  const disapprovedProducts = (cached.disapprovedProducts || []) as any[];

  // Filter daily performance by selected date range
  const dailyPerformance = allDailyPerformance.filter((d: any) => {
    if (!d.date) return false;
    return d.date >= startDate && d.date <= endDate;
  });

  // Recalculate stats for filtered range
  const totalClicks = dailyPerformance.reduce(
    (s: number, d: any) => s + (d.clicks || 0),
    0,
  );
  const totalImpressions = dailyPerformance.reduce(
    (s: number, d: any) => s + (d.impressions || 0),
    0,
  );
  const avgCtr =
    totalImpressions > 0
      ? Math.round((totalClicks / totalImpressions) * 10000) / 100
      : 0;

  // Check if selected range is outside cached data range
  const cachedStart = cached.startDate || allDailyPerformance[0]?.date;
  const cachedEnd =
    cached.endDate || allDailyPerformance[allDailyPerformance.length - 1]?.date;
  const needsResync =
    startDate < (cachedStart || startDate) || endDate > (cachedEnd || endDate);

  // Date range helpers
  const presets = [7, 14, 30, 90];
  const today = new Date().toISOString().split("T")[0];

  const applyPreset = (d: number) => {
    setDays(d);
    setStartDate(
      new Date(Date.now() - d * 86400000).toISOString().split("T")[0],
    );
    setEndDate(today);
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setDays(null);
  };

  const rangeDays = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
  );

  // Filter + sort products
  const filteredProducts = allProducts
    .filter(
      (p: any) =>
        !productSearch ||
        p.title?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.offerId?.toLowerCase().includes(productSearch.toLowerCase()),
    )
    .sort((a: any, b: any) => {
      if (sortBy === "clicks") return (b.clicks || 0) - (a.clicks || 0);
      if (sortBy === "impressions")
        return (b.impressions || 0) - (a.impressions || 0);
      if (sortBy === "price") return (b.priceValue || 0) - (a.priceValue || 0);
      return 0;
    });

  const visibleProducts = filteredProducts.slice(0, showCount);
  const hasMore = showCount < filteredProducts.length;

  return (
    <div>
      {/* ─── DATE RANGE PICKER ─── */}
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap border-b border-panel-border/50 bg-panel-bg/20">
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
        {days === null && (
          <span className="text-[9px] text-accent-purple font-mono">
            {rangeDays}d
          </span>
        )}
        {needsResync && (
          <button
            onClick={() => resyncMutation.mutate()}
            disabled={resyncMutation.isPending}
            className="btn btn-primary text-[10px] py-0.5 px-2 ml-2"
          >
            {resyncMutation.isPending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              "Pobierz dane za ten okres"
            )}
          </button>
        )}
        <div className="ml-auto text-[9px] text-panel-dim flex items-center gap-1">
          <Eye className="w-3 h-3" />
          Dane z free listings (bezpłatne)
        </div>
      </div>

      {/* ─── STAT CARDS ─── */}
      <div className="grid grid-cols-7 gap-2 p-4">
        <div
          className="stat-card"
          style={{ "--stat-accent": "#3b82f6" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-blue">
            {total}
          </div>
          <div className="text-[9px] text-panel-muted">Produktów</div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#22c55e" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-green">
            {approved}
          </div>
          <div className="text-[9px] text-panel-muted">Approved</div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#ef4444" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-red">
            {disapproved}
          </div>
          <div className="text-[9px] text-panel-muted">Disapproved</div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#f59e0b" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-amber">
            {pending}
          </div>
          <div className="text-[9px] text-panel-muted">Pending</div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#06b6d4" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-cyan">
            {fmtNumber(totalClicks)}
          </div>
          <div className="text-[9px] text-panel-muted">
            Kliknięcia{days ? ` (${days}d)` : ""}
          </div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#a855f7" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-purple">
            {fmtNumber(totalImpressions)}
          </div>
          <div className="text-[9px] text-panel-muted">
            Wyświetlenia{days ? ` (${days}d)` : ""}
          </div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#22c55e" } as any}
        >
          <div className="text-base font-bold font-mono text-accent-green">
            {avgCtr}%
          </div>
          <div className="text-[9px] text-panel-muted">CTR</div>
        </div>
      </div>

      {/* ─── APPROVAL BAR ─── */}
      {total > 0 && (
        <div className="px-4 pb-3">
          <div className="h-2 rounded-full bg-panel-border/30 overflow-hidden flex">
            <div
              className="h-full bg-accent-green"
              style={{ width: `${(approved / total) * 100}%` }}
            />
            <div
              className="h-full bg-accent-amber"
              style={{ width: `${(pending / total) * 100}%` }}
            />
            <div
              className="h-full bg-accent-red"
              style={{ width: `${(disapproved / total) * 100}%` }}
            />
          </div>
          <div className="flex gap-4 text-[9px] text-panel-muted mt-1.5">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-accent-green" /> Approved (
              {approved}) — {cached.approvalRate}%
            </span>
            {pending > 0 && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-accent-amber" /> Pending (
                {pending})
              </span>
            )}
            {disapproved > 0 && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-accent-red" /> Disapproved
                ({disapproved})
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── TABS ─── */}
      <div className="px-4 py-2 flex items-center gap-1 border-t border-b border-panel-border/50 bg-panel-bg/20">
        {(["overview", "products", "disapproved"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setActiveTab(t);
              setShowCount(50);
            }}
            className={cn(
              "px-3 py-1 rounded text-[10px] transition-all",
              activeTab === t
                ? "bg-accent-blue/20 text-accent-blue font-semibold"
                : "text-panel-muted hover:text-panel-text",
            )}
          >
            {t === "overview" && "Przegląd"}
            {t === "products" && `Produkty (${total})`}
            {t === "disapproved" && `Odrzucone (${disapproved})`}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === "overview" && (
        <div>
          {dailyPerformance.length > 0 ? (
            <div className="p-4">
              <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>
                  Performance — kliknięcia i wyświetlenia (free listings)
                </span>
                <span className="font-mono text-panel-dim">
                  {startDate} → {endDate}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={dailyPerformance}>
                  <defs>
                    <linearGradient
                      id="mc-clicks-grad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#06b6d4"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 7, fill: "#06b6d4" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 7, fill: "#a855f7" }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
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
                    yAxisId="left"
                    type="monotone"
                    dataKey="clicks"
                    stroke="#06b6d4"
                    fill="url(#mc-clicks-grad)"
                    strokeWidth={1.5}
                    name="Kliknięcia"
                    dot={false}
                  />
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
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-[9px] text-panel-muted mt-1">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-0.5 bg-accent-cyan rounded" />{" "}
                  Kliknięcia:{" "}
                  <strong className="text-accent-cyan">
                    {fmtNumber(totalClicks)}
                  </strong>
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-0.5 bg-accent-purple rounded" />{" "}
                  Wyświetlenia:{" "}
                  <strong className="text-accent-purple">
                    {fmtNumber(totalImpressions)}
                  </strong>
                </span>
                <span>
                  CTR: <strong className="text-accent-green">{avgCtr}%</strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 text-xs text-panel-muted text-center">
              Brak danych performance za wybrany okres.{" "}
              {needsResync
                ? 'Kliknij "Pobierz dane za ten okres" aby pobrać.'
                : ""}
            </div>
          )}

          {/* Top products by clicks */}
          {allProducts.filter((p: any) => p.clicks > 0).length > 0 && (
            <div className="px-4 pb-4">
              <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2">
                Top produkty wg kliknięć (dane za ostatni sync)
              </div>
              <div className="space-y-1">
                {allProducts
                  .filter((p: any) => p.clicks > 0)
                  .slice(0, 15)
                  .map((p: any, i: number) => {
                    const maxClicks =
                      allProducts.filter((pp: any) => pp.clicks > 0)[0]
                        ?.clicks || 1;
                    const pct = Math.round((p.clicks / maxClicks) * 100);
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-[11px]"
                      >
                        <span className="text-panel-muted w-4 text-right shrink-0">
                          {i + 1}.
                        </span>
                        <a
                          href={p.link}
                          target="_blank"
                          className="truncate flex-1 text-accent-blue hover:underline"
                        >
                          {p.title}
                        </a>
                        <div className="w-24 h-1.5 bg-panel-border/30 rounded overflow-hidden shrink-0">
                          <div
                            className="h-full bg-accent-cyan/50 rounded"
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                        <span className="text-accent-cyan font-mono font-semibold w-10 text-right shrink-0">
                          {p.clicks}
                        </span>
                        <span className="text-panel-muted font-mono w-14 text-right shrink-0">
                          {fmtNumber(p.impressions)} imp.
                        </span>
                        <span className="text-panel-dim w-20 text-right shrink-0">
                          {p.price || "—"}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PRODUCTS TAB ═══ */}
      {activeTab === "products" && (
        <div>
          <div className="px-4 py-2 flex items-center gap-2 border-b border-panel-border/50">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-panel-muted" />
              <input
                className="input text-xs pl-7 w-full"
                placeholder="Szukaj produktu..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowCount(50);
                }}
              />
            </div>
            <div className="flex items-center gap-1 text-[9px]">
              <span className="text-panel-muted">Sortuj:</span>
              {[
                { key: "clicks" as const, label: "Kliknięcia" },
                { key: "impressions" as const, label: "Wyświetlenia" },
                { key: "price" as const, label: "Cena" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-all",
                    sortBy === s.key
                      ? "bg-accent-blue/20 text-accent-blue font-semibold"
                      : "text-panel-muted hover:text-panel-text",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produkt</th>
                  <th>Cena</th>
                  <th>Kliknięcia</th>
                  <th>Wyświetlenia</th>
                  <th>CTR</th>
                  <th>Status</th>
                  <th>Dostępność</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((p: any, i: number) => (
                  <tr key={i}>
                    <td className="text-panel-muted text-[9px]">{i + 1}</td>
                    <td className="max-w-[300px]">
                      <a
                        href={p.link}
                        target="_blank"
                        className="text-accent-blue hover:underline truncate block"
                      >
                        {p.title}
                      </a>
                      {p.offerId && (
                        <span className="text-[9px] text-panel-muted font-mono">
                          {p.offerId}
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-panel-text whitespace-nowrap">
                      {p.price || "—"}
                    </td>
                    <td
                      className={cn(
                        "font-mono",
                        p.clicks > 0
                          ? "text-accent-cyan font-semibold"
                          : "text-panel-muted",
                      )}
                    >
                      {p.clicks || 0}
                    </td>
                    <td className="text-panel-text">
                      {fmtNumber(p.impressions || 0)}
                    </td>
                    <td className="text-panel-muted font-mono">
                      {p.impressions > 0
                        ? `${((p.clicks / p.impressions) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td>
                      <span
                        className={cn(
                          "badge",
                          p.verdict === "approved"
                            ? "badge-pass"
                            : p.verdict === "disapproved"
                              ? "badge-fail"
                              : "badge-neutral",
                        )}
                      >
                        {p.verdict}
                      </span>
                    </td>
                    <td className="text-[10px] text-panel-muted">
                      {p.availability === "in stock"
                        ? "W magazynie"
                        : p.availability || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-4 py-2 flex items-center justify-between text-[10px] text-panel-muted border-t border-panel-border">
              <span>
                {visibleProducts.length} z {filteredProducts.length} produktów
                {productSearch && ` (filtrowano z ${total})`}
              </span>
              <div className="flex items-center gap-3">
                {hasMore && (
                  <button
                    onClick={() => setShowCount((c) => c + 50)}
                    className="text-accent-blue hover:underline font-medium"
                  >
                    Pokaż kolejne{" "}
                    {Math.min(50, filteredProducts.length - showCount)} →
                  </button>
                )}
                {filteredProducts.length > 50 &&
                  showCount < filteredProducts.length && (
                    <button
                      onClick={() => setShowCount(filteredProducts.length)}
                      className="text-panel-muted hover:text-panel-text"
                    >
                      Pokaż wszystkie ({filteredProducts.length})
                    </button>
                  )}
                {showCount > 50 && (
                  <button
                    onClick={() => setShowCount(50)}
                    className="text-panel-muted hover:text-panel-text"
                  >
                    Zwiń do 50
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Note about performance data scope */}
          <div className="px-4 py-2 text-[9px] text-panel-dim border-t border-panel-border/30 flex items-center gap-1">
            <Eye className="w-3 h-3" />
            Kliknięcia/wyświetlenia dotyczą free listings (bezpłatne). Dane z
            płatnych kampanii Shopping/PMax → Google Ads (po zatwierdzeniu API).
          </div>
        </div>
      )}

      {/* ═══ DISAPPROVED TAB ═══ */}
      {activeTab === "disapproved" && (
        <div className="p-4">
          {disapprovedProducts.length === 0 ? (
            <div className="text-xs text-accent-green text-center py-6">
              Wszystkie produkty zatwierdzone — brak odrzuconych.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[10px] text-panel-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-accent-red" />
                {disapprovedProducts.length} odrzuconych produktów
              </div>
              {disapprovedProducts.map((p: any, i: number) => (
                <div
                  key={i}
                  className="bg-accent-red/5 border border-accent-red/10 rounded px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-panel-text truncate flex-1">
                      {p.title || p.productId}
                    </span>
                    {p.link && (
                      <a
                        href={p.link}
                        target="_blank"
                        className="text-accent-blue hover:underline text-[10px] shrink-0"
                      >
                        Otwórz
                      </a>
                    )}
                  </div>
                  {p.disapprovedCountries && (
                    <div className="text-[10px] text-accent-red/70 mt-0.5">
                      Odrzucony w: {p.disapprovedCountries}
                    </div>
                  )}
                  {p.issues?.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {p.issues.slice(0, 5).map((issue: any, j: number) => (
                        <div
                          key={j}
                          className="text-[10px] text-accent-red/80 flex items-start gap-1"
                        >
                          <span className="shrink-0">•</span>
                          <span>
                            {issue.description || issue.code}
                            {issue.detail && (
                              <span className="text-panel-muted ml-1">
                                — {issue.detail}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
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
