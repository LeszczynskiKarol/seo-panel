// frontend/src/pages/ProfitabilityPage.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { GlobalProfitabilityPanel } from "../components/GlobalProfitabilityPanel";
import { cn, fmtNumber } from "../lib/utils";
import { ProfitabilityTab } from "../components/ProfitabilityTab";
import { PiggyBank, RefreshCw, Globe } from "lucide-react";

export function ProfitabilityPage() {
  const { data: domains, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: api.getDomains,
  });

  const DOMAIN_ORDER: Record<string, number> = {
    cmn9fo4dn0004qrdye8hjou1g: 1, // Stojan Shop
    cmn9fo4db0001qrdyh34ldxul: 2, // Smart-Edu.ai
    cmn9fo4d50000qrdy96h2sdr6: 3, // MaturaPolski
    cmn9fo4dr0005qrdyj39z8k9e: 4, // Ebook Copywriting
    cmn9fo4df0002qrdywpl8ymwe: 5, // Smart-Copy
    cmn9fo4e50009qrdyog51y31k: 6, // Praca-Magisterska
  };

  const sorted = [...(domains ?? [])]
    .sort((a: any, b: any) => {
      const aOrder = DOMAIN_ORDER[a.id] || 100;
      const bOrder = DOMAIN_ORDER[b.id] || 100;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.label || a.domain).localeCompare(b.label || b.domain, "pl");
    })
    .map((d: any) => ({
      domainId: d.id,
      label: d.label || d.domain.replace("www.", ""),
    }));

  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-5 h-5 animate-spin text-panel-muted" />
      </div>
    );
  }

  // Filter domains that have GA4 or Ads integrations
  const domainsWithIntegrations = sorted;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-accent-green" />
          Rentowność
        </h1>
        <p className="text-sm text-panel-muted mt-0.5">
          Prowizja, koszty Ads, zysk netto — per domena
        </p>
      </div>

      <GlobalProfitabilityPanel />

      {/* Domain selector */}
      <div className="flex gap-2 flex-wrap">
        {domainsWithIntegrations.map((d: any) => (
          <button
            key={d.id}
            onClick={() =>
              setSelectedDomainId(selectedDomainId === d.id ? null : d.id)
            }
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              selectedDomainId === d.id
                ? "border-accent-green bg-accent-green/10 text-accent-green"
                : "border-panel-border bg-panel-card text-panel-muted hover:text-panel-text hover:border-panel-text/20",
            )}
          >
            <Globe className="w-3 h-3" />
            {d.label || d.domain.replace("www.", "")}
          </button>
        ))}
      </div>

      {/* Show profitability for selected domain */}
      {selectedDomainId ? (
        <ProfitabilityTab domainId={selectedDomainId} />
      ) : (
        <AllDomainsProfitability domains={domainsWithIntegrations} />
      )}
    </div>
  );
}

function AllDomainsProfitability({ domains }: { domains: any[] }) {
  const [days, setDays] = useState(30);

  // Fetch profitability for all domains with integrations
  const queries = domains.map((d: any) => ({
    domainId: d.id,
    label: d.label || d.domain.replace("www.", ""),
    domain: d.domain,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">Przegląd wszystkich domen</span>
        <div className="ml-auto flex gap-1">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
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
      </div>

      <div className="space-y-3">
        {queries.map((q) => (
          <DomainProfitCard
            key={q.domainId}
            domainId={q.domainId}
            label={q.label}
            days={days}
          />
        ))}
      </div>
    </div>
  );
}

function DomainProfitCard({
  domainId,
  label,
  days,
}: {
  domainId: string;
  label: string;
  days: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["profitability", domainId, days],
    queryFn: () => api.getProfitability(domainId, days),
  });

  if (isLoading) {
    return (
      <div className="bg-panel-card border border-panel-border rounded-lg p-4 flex items-center gap-3">
        <Globe className="w-4 h-4 text-panel-muted" />
        <span className="text-xs font-semibold">{label}</span>
        <RefreshCw className="w-3 h-3 animate-spin text-panel-muted ml-auto" />
      </div>
    );
  }

  if (!data || (!data.hasGA4 && !data.hasAds)) {
    return (
      <div className="bg-panel-card border border-panel-border rounded-lg p-4 flex items-center gap-3">
        <Globe className="w-4 h-4 text-panel-muted" />
        <span className="text-xs font-semibold text-panel-muted">{label}</span>
        <span className="text-[10px] text-panel-dim ml-auto">
          Brak integracji GA4/Ads
        </span>
      </div>
    );
  }

  const t = data.totals;
  if (t.revenue === 0 && t.adsCost === 0) {
    return (
      <div className="bg-panel-card border border-panel-border rounded-lg p-4 flex items-center gap-3">
        <Globe className="w-4 h-4 text-panel-muted" />
        <span className="text-xs font-semibold text-panel-muted">{label}</span>
        <span className="text-[10px] text-panel-dim ml-auto">
          Brak danych o sprzedaży ({days}d)
        </span>
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="bg-panel-card border border-panel-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-accent-blue" />
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-[10px] text-panel-muted ml-1">{days}d</span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        <MiniStat
          label="Sprzedaż"
          value={`${fmtNumber(Math.round(t.revenue))} zł`}
          color="#a855f7"
        />
        {data.isCommissionBased ? (
          <MiniStat
            label="Prowizja 12%"
            value={`${fmtNumber(Math.round(t.commission))} zł`}
            color="#f59e0b"
          />
        ) : (
          <MiniStat
            label="Przychód"
            value={`${fmtNumber(Math.round(t.revenue))} zł`}
            color="#22c55e"
          />
        )}
        {data.hasAds ? (
          <MiniStat
            label="Koszt Ads"
            value={`${fmtNumber(Math.round(t.adsCost))} zł`}
            color="#ef4444"
          />
        ) : null}
        <MiniStat
          label={t.profit >= 0 ? "Zysk" : "Strata"}
          value={`${t.profit >= 0 ? "+" : ""}${fmtNumber(Math.round(t.profit))} zł`}
          color={t.profit >= 0 ? "#22c55e" : "#ef4444"}
        />
        <MiniStat label="Konwersje" value={t.conversions} color="#06b6d4" />
        <MiniStat
          label="Śr. zamówienie"
          value={`${k.avgOrderValue.toFixed(0)} zł`}
          color="#a855f7"
        />
        {data.hasAds && (
          <MiniStat
            label="CAC"
            value={k.cac > 0 ? `${k.cac.toFixed(2)} zł` : "—"}
            color="#ef4444"
          />
        )}
      </div>

      {/* Channel mini breakdown */}
      {data.channels?.length > 0 && (
        <div className="flex gap-3 text-[10px]">
          {data.channels
            .filter((c: any) => c.revenue > 0)
            .slice(0, 4)
            .map((ch: any) => (
              <div key={ch.channel} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      ch.channel === "Organic"
                        ? "#22c55e"
                        : ch.channel.includes("Paid")
                          ? "#ef4444"
                          : ch.channel === "Direct"
                            ? "#3b82f6"
                            : "#f59e0b",
                  }}
                />
                <span className="text-panel-muted">{ch.channel}:</span>
                <span className="font-mono text-panel-text">
                  {fmtNumber(Math.round(ch.revenue))} zł
                </span>
                <span
                  className={cn(
                    "font-mono font-bold",
                    ch.profit >= 0 ? "text-accent-green" : "text-accent-red",
                  )}
                >
                  ({ch.profit >= 0 ? "+" : ""}
                  {ch.profit.toFixed(0)})
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({
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
