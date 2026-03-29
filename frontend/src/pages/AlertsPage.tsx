import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtDate, fmtDateTime, severityColor, cn } from "../lib/utils";
import { RefreshCw, AlertTriangle, CheckCircle, Filter } from "lucide-react";
import { useState } from "react";

export function AlertsPage() {
  const qc = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);

  const params = showResolved ? "" : "resolved=false";
  const { data: alerts } = useQuery({
    queryKey: ["alerts", params],
    queryFn: () => api.getAlerts(params),
  });

  const detectAlerts = useMutation({
    mutationFn: () => api.detectAlerts(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
  const resolve = useMutation({
    mutationFn: (id: string) => api.resolveAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const typeLabel: Record<string, string> = {
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

  const typeIcon: Record<string, string> = {
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

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Alerty</h1>
          <p className="text-sm text-panel-muted mt-0.5">
            Monitorowanie zmian i problemów
          </p>
        </div>
        <button
          className="btn btn-ghost text-xs flex items-center gap-1.5"
          onClick={() => setShowResolved(!showResolved)}
        >
          <Filter className="w-3.5 h-3.5" />
          {showResolved ? "Ukryj rozwiązane" : "Pokaż rozwiązane"}
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

      {!alerts || alerts.length === 0 ? (
        <div className="bg-panel-card border border-panel-border rounded-lg p-12 text-center">
          <CheckCircle className="w-8 h-8 text-accent-green mx-auto mb-3 opacity-50" />
          <div className="text-sm text-panel-muted">Brak aktywnych alertów</div>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a: any) => (
            <div
              key={a.id}
              className={cn(
                "bg-panel-card border border-panel-border rounded-lg p-4 flex items-start gap-4 transition-all",
                a.isResolved && "opacity-50",
              )}
            >
              <div className="text-lg shrink-0 mt-0.5">
                {typeIcon[a.type] || "⚠️"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide",
                      severityColor(a.severity),
                    )}
                  >
                    {a.severity}
                  </span>
                  <span className="text-[10px] text-panel-muted font-mono">
                    {typeLabel[a.type] || a.type}
                  </span>
                  <span className="text-[10px] text-panel-muted">·</span>
                  <span className="text-[10px] text-panel-muted font-mono">
                    {a.domain?.label || a.domain?.domain}
                  </span>
                </div>

                <div className="text-sm font-medium">{a.title}</div>

                {a.description && (
                  <div className="text-xs text-panel-dim mt-1">
                    {a.description}
                  </div>
                )}

                {a.page && (
                  <div className="text-[11px] text-accent-blue font-mono mt-1">
                    {a.page.path}
                  </div>
                )}

                <div className="text-[10px] text-panel-muted mt-2 font-mono">
                  {fmtDateTime(a.createdAt)}
                  {a.isResolved &&
                    ` · Rozwiązano: ${fmtDateTime(a.resolvedAt)}`}
                </div>
              </div>

              {!a.isResolved && (
                <button
                  className="btn btn-ghost text-[10px] shrink-0"
                  onClick={() => resolve.mutate(a.id)}
                  disabled={resolve.isPending}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Rozwiąż
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
