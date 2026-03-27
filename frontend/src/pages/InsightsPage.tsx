// frontend/src/pages/InsightsPage.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtNumber, fmtPercent, fmtPosition, cn } from "../lib/utils";
import {
  Zap,
  Target,
  GitBranch,
  Timer,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Globe,
  ArrowRight,
} from "lucide-react";

type View =
  | "quick-wins"
  | "content-gaps"
  | "cross-links"
  | "velocity"
  | "stale";

export function InsightsPage() {
  const [view, setView] = useState<View>("quick-wins");
  const [selectedDomain, setSelectedDomain] = useState<string>("");

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: () => api.getDomains(),
  });
  const VIEWS: { key: View; label: string; icon: any }[] = [
    { key: "quick-wins", label: "Quick Wins", icon: Zap },
    { key: "content-gaps", label: "Content Gaps", icon: Target },
    { key: "cross-links", label: "Cross-Domain Links", icon: GitBranch },
    { key: "velocity", label: "Indexing Velocity", icon: Timer },
    { key: "stale", label: "Stale Pages", icon: AlertTriangle },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-panel-muted mt-0.5">
          Zaawansowana analityka SEO — znajdź okazje i problemy
        </p>
      </div>
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-panel-border overflow-x-auto">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-all -mb-px whitespace-nowrap",
              view === v.key
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-panel-muted hover:text-panel-text",
            )}
          >
            <v.icon className="w-3.5 h-3.5" />
            {v.label}
          </button>
        ))}
      </div>
      {/* Domain filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-panel-muted">Domena:</span>
        <select
          className="input text-xs py-1.5"
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
        >
          <option value="">Wszystkie domeny</option>
          {(domains || []).map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.label || d.domain}
            </option>
          ))}
        </select>
      </div>
      {view === "quick-wins" && <QuickWinsView domainId={selectedDomain} />}
      {view === "content-gaps" && <ContentGapsView domainId={selectedDomain} />}
      {view === "cross-links" && <CrossLinksView domainId={selectedDomain} />}
      {view === "velocity" && <VelocityView domainId={selectedDomain} />}
      {view === "stale" && <StalePagesView domainId={selectedDomain} />}{" "}
    </div>
  );
}

// ─── QUICK WINS ──────────────────────────────────────────────
function QuickWinsView({ domainId }: { domainId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["quick-wins", domainId],
    queryFn: () => api.getQuickWins(domainId || undefined),
  });
  if (isLoading) return <Loading />;

  return (
    <div className="space-y-3">
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-accent-amber" />
          <span className="text-sm font-semibold">Quick Wins</span>
        </div>
        <p className="text-xs text-panel-muted">
          Strony na pozycjach 4-20 z dużą liczbą wyświetleń. Optymalizacja tych
          stron (tytuły, treść, linkowanie) może szybko przesunąć je do top 3.
        </p>
      </div>

      <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Domena</th>
              <th>URL</th>
              <th>Pozycja</th>
              <th>Wyświetlenia</th>
              <th>Kliknięcia</th>
              <th>Potencjał</th>
              <th>Wysiłek</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((p: any) => (
              <tr key={p.id}>
                <td className="text-panel-dim text-[10px]">
                  {p.domain?.label || p.domain?.domain}
                </td>
                <td className="max-w-[250px] truncate">
                  <a
                    href={p.url}
                    target="_blank"
                    className="text-accent-blue hover:underline"
                  >
                    {p.path}
                  </a>
                </td>
                <td className="text-accent-amber font-semibold">
                  {fmtPosition(p.position)}
                </td>
                <td>{fmtNumber(p.impressions)}</td>
                <td className="text-accent-cyan">{p.clicks}</td>
                <td className="text-accent-green font-semibold">
                  +{p.potentialClicks}
                </td>
                <td>
                  <span
                    className={cn(
                      "badge",
                      p.effort === "LOW"
                        ? "badge-pass"
                        : p.effort === "MEDIUM"
                          ? "badge-neutral"
                          : "badge-fail",
                    )}
                  >
                    {p.effort}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CONTENT GAPS ────────────────────────────────────────────
function ContentGapsView({ domainId }: { domainId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["content-gaps", domainId],
    queryFn: () => api.getContentGaps(domainId || undefined),
  });

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-3">
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-accent-red" />
          <span className="text-sm font-semibold">Content Gaps</span>
        </div>
        <p className="text-xs text-panel-muted">
          Strony w top 10 z CTR znacznie poniżej oczekiwanej dla danej pozycji.
          Oznacza to że tytuł/meta description nie przyciąga kliknięć — popraw
          je.
        </p>
      </div>

      <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Domena</th>
              <th>URL</th>
              <th>Pozycja</th>
              <th>Actual CTR</th>
              <th>Expected CTR</th>
              <th>Gap</th>
              <th>Stracone kliknięcia</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((p: any) => (
              <tr key={p.id}>
                <td className="text-panel-dim text-[10px]">
                  {p.domain?.label || p.domain?.domain}
                </td>
                <td className="max-w-[250px] truncate">
                  <a
                    href={p.url}
                    target="_blank"
                    className="text-accent-blue hover:underline"
                  >
                    {p.path}
                  </a>
                </td>
                <td>{fmtPosition(p.position)}</td>
                <td className="text-accent-red">{fmtPercent(p.actualCtr)}</td>
                <td className="text-accent-green">
                  {fmtPercent(p.expectedCtr)}
                </td>
                <td className="text-accent-amber">{fmtPercent(p.ctrGap)}</td>
                <td className="text-accent-red font-semibold">
                  -{p.missedClicks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CROSS-DOMAIN LINKS ─────────────────────────────────────
function CrossLinksView({ domainId }: { domainId?: string }) {
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["cross-domain-links"],
    queryFn: api.getCrossDomainLinks,
  });

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: () => api.getDomains(),
  });

  // Filter by selected domain
  const data = (() => {
    if (!domainId || !rawData || !domains) return rawData;
    const selected = domains.find((d: any) => d.id === domainId);
    if (!selected) return rawData;
    const domainName = selected.domain;
    return rawData.filter(
      (pair: any) => pair.from === domainName || pair.to === domainName,
    );
  })();

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-3">
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="w-4 h-4 text-accent-purple" />
          <span className="text-sm font-semibold">Cross-Domain Link Map</span>
        </div>
        <p className="text-xs text-panel-muted">
          Jak Twoje domeny linkują między sobą. Ważne dla strategii satellite
          sites i transferu link equity.
        </p>
      </div>

      {!data || data.length === 0 ? (
        <div className="bg-panel-card border border-panel-border rounded-lg p-12 text-center text-panel-muted text-sm">
          Brak cross-domain linków. Odpal crawl linków żeby zebrać dane.
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((pair: any, i: number) => (
            <div
              key={i}
              className="bg-panel-card border border-panel-border rounded-lg p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-accent-cyan" />
                  <span className="text-sm font-mono font-semibold">
                    {pair.fromLabel || pair.from}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-panel-muted" />
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-accent-green" />
                  <span className="text-sm font-mono font-semibold">
                    {pair.toLabel || pair.to}
                  </span>
                </div>
                <span className="ml-auto badge badge-pass">
                  {pair.links.length} linków
                </span>
              </div>

              <div className="space-y-1">
                {pair.links.slice(0, 5).map((l: any, j: number) => (
                  <div key={j} className="flex items-center gap-3 text-[11px]">
                    <span className="text-panel-dim font-mono truncate w-[200px]">
                      {l.fromPath}
                    </span>
                    <ArrowRight className="w-3 h-3 text-panel-muted shrink-0" />
                    <span className="text-accent-blue font-mono truncate flex-1">
                      {l.toUrl}
                    </span>
                    {l.anchor && (
                      <span className="text-panel-muted truncate max-w-[150px]">
                        "{l.anchor}"
                      </span>
                    )}
                  </div>
                ))}
                {pair.links.length > 5 && (
                  <div className="text-[10px] text-panel-muted">
                    + {pair.links.length - 5} więcej...
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── INDEXING VELOCITY ───────────────────────────────────────
function VelocityView({ domainId }: { domainId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["indexing-velocity", domainId],
    queryFn: () => api.getIndexingVelocity(domainId || undefined),
  });

  if (isLoading) return <Loading />;
  if (!data) return null;

  const d = data;

  return (
    <div className="space-y-3">
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Timer className="w-4 h-4 text-accent-cyan" />
          <span className="text-sm font-semibold">Indexing Velocity</span>
        </div>
        <p className="text-xs text-panel-muted">
          Ile dni zajmuje Google zaindeksowanie Twoich stron od momentu
          zgłoszenia.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div
          className="stat-card"
          style={{ "--stat-accent": "#06b6d4" } as any}
        >
          <div className="text-2xl font-bold font-mono text-accent-cyan">
            {d.avgDays}d
          </div>
          <div className="text-[10px] text-panel-muted mt-0.5">Średni czas</div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#22c55e" } as any}
        >
          <div className="text-2xl font-bold font-mono text-accent-green">
            {d.medianDays}d
          </div>
          <div className="text-[10px] text-panel-muted mt-0.5">Mediana</div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#a855f7" } as any}
        >
          <div className="text-2xl font-bold font-mono text-accent-purple">
            {d.total}
          </div>
          <div className="text-[10px] text-panel-muted mt-0.5">
            Stron z danymi
          </div>
        </div>
        <div
          className="stat-card"
          style={{ "--stat-accent": "#f59e0b" } as any}
        >
          <div className="text-2xl font-bold font-mono text-accent-amber">
            {d.distribution.sameDay}
          </div>
          <div className="text-[10px] text-panel-muted mt-0.5">
            Tego samego dnia
          </div>
        </div>
      </div>

      {/* Distribution */}
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="text-xs font-semibold text-panel-muted mb-3">
          DYSTRYBUCJA
        </div>
        <div className="space-y-2">
          {[
            {
              label: "Tego samego dnia",
              val: d.distribution.sameDay,
              color: "#22c55e",
            },
            {
              label: "Do 3 dni",
              val: d.distribution.within3Days,
              color: "#06b6d4",
            },
            {
              label: "Do 7 dni",
              val: d.distribution.within7Days,
              color: "#3b82f6",
            },
            {
              label: "Do 30 dni",
              val: d.distribution.within30Days,
              color: "#f59e0b",
            },
            {
              label: "Ponad 30 dni",
              val: d.distribution.over30Days,
              color: "#ef4444",
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-[11px] text-panel-dim w-[120px]">
                {item.label}
              </span>
              <div className="flex-1 h-2 bg-panel-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${d.total > 0 ? (item.val / d.total) * 100 : 0}%`,
                    background: item.color,
                  }}
                />
              </div>
              <span className="text-[11px] font-mono w-[40px] text-right">
                {item.val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Slowest */}
      {d.slowest?.length > 0 && (
        <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
          <div className="px-4 py-2 border-b border-panel-border text-xs font-semibold text-panel-muted">
            NAJWOLNIEJ INDEKSOWANE
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Domena</th>
                <th>URL</th>
                <th>Dni do indeksacji</th>
              </tr>
            </thead>
            <tbody>
              {d.slowest.map((p: any, i: number) => (
                <tr key={i}>
                  <td className="text-panel-dim text-[10px]">{p.domain}</td>
                  <td className="max-w-[300px] truncate text-accent-blue">
                    {p.path}
                  </td>
                  <td className="text-accent-red font-semibold">
                    {p.daysToIndex}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── STALE PAGES ─────────────────────────────────────────────
function StalePagesView({ domainId }: { domainId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["stale-pages", domainId],
    queryFn: () => api.getStalePages(domainId || undefined),
  });

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-3">
      <div className="bg-panel-card border border-panel-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-accent-amber" />
          <span className="text-sm font-semibold">Stale Pages</span>
        </div>
        <p className="text-xs text-panel-muted">
          Strony które Google nie crawlował od 30+ dni. Mogą potrzebować fresh
          contentu lub lepszego linkowania wewnętrznego.
        </p>
      </div>

      <div className="bg-panel-card border border-panel-border rounded-lg overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Domena</th>
              <th>URL</th>
              <th>Ostatni crawl</th>
              <th>Kliknięcia</th>
              <th>Wyświetlenia</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((p: any) => (
              <tr key={p.id}>
                <td className="text-panel-dim text-[10px]">
                  {p.domain?.label || p.domain?.domain}
                </td>
                <td className="max-w-[300px] truncate">
                  <a
                    href={p.url}
                    target="_blank"
                    className="text-accent-blue hover:underline"
                  >
                    {p.path}
                  </a>
                </td>
                <td className="text-accent-amber">
                  {p.lastCrawlTime
                    ? new Date(p.lastCrawlTime).toLocaleDateString("pl-PL")
                    : "nigdy"}
                </td>
                <td className="text-accent-cyan">{p.clicks}</td>
                <td>{fmtNumber(p.impressions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
