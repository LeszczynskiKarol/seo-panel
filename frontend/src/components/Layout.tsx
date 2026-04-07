import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Globe,
  Shield,
  Eye,
  ShoppingCart,
  Bell,
  Zap,
  Lightbulb,
  MessageSquare,
  Activity,
  PiggyBank,
  Clock,
  ChevronDown,
} from "lucide-react";

import { cn } from "../lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/profitability", icon: PiggyBank, label: "Rentowność" },
  { to: "/conversions", icon: ShoppingCart, label: "Konwersje" },
  { to: "/insights", icon: Lightbulb, label: "Insights" },
  { to: "/timeline", icon: Clock, label: "Timeline" },
  { to: "/ai-links", icon: Zap, label: "AI Links" },
  { to: "/watchlist", icon: Eye, label: "Watchlist" },
  { to: "/chat", icon: MessageSquare, label: "SEO Chat" },
  { to: "/api-analytics", icon: Activity, label: "API Claude" },
  { to: "/moz-analytics", icon: Shield, label: "Moz API" },
  { to: "/alerts", icon: Bell, label: "Alerty" },
];

export function Layout() {
  const { data: overview } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-44 bg-panel-surface border-r border-panel-border flex flex-col shrink-0">
        {/* Nav */}
        <nav className="flex-1 flex flex-col px-2 py-2 min-h-0">
          <div className="space-y-0.5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all duration-150",
                    isActive
                      ? "bg-accent-blue/10 text-accent-blue font-medium"
                      : "text-panel-dim hover:text-panel-text hover:bg-panel-hover/50",
                  )
                }
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
                {item.label === "Alerty" && overview?.alertCount > 0 && (
                  <span className="ml-auto text-[9px] font-mono bg-accent-red/20 text-accent-red px-1 py-px rounded">
                    {overview.alertCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          <div className="pt-3 pb-1 px-2">
            <div className="text-[8px] uppercase tracking-widest text-panel-muted font-semibold">
              Domeny
            </div>
          </div>

          <DomainsNav />
        </nav>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-panel-border">
          <div className="text-[9px] text-panel-muted font-mono">
            {overview?.domains || 0} domen · {overview?.totalPages || 0} stron
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-w-0 overflow-x-hidden">
        <div className="animate-fade-in max-w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function DomainsNav() {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("");
  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: api.getDomains,
  });

  if (!domains) return null;

  const filtered = domains.filter((d: any) =>
    (d.label || d.domain).toLowerCase().includes(filter.toLowerCase()),
  );

  const COLLAPSED_COUNT = 5;
  const shown = expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT);
  const hasMore = filtered.length > COLLAPSED_COUNT;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {domains.length > COLLAPSED_COUNT && (
        <div className="px-2 pb-1">
          <input
            type="text"
            placeholder="Szukaj domeny…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input w-full text-[10px] py-1 px-1.5"
          />
        </div>
      )}

      <div
        className={cn(
          "overflow-y-auto transition-all duration-200",
          expanded ? "max-h-[60vh]" : "max-h-[none]",
        )}
      >
        {shown.map((d: any) => {
          const pct =
            d.totalPages > 0
              ? Math.round((d.indexedPages / d.totalPages) * 100)
              : 0;
          return (
            <NavLink
              key={d.id}
              to={`/domains/${d.id}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-all group",
                  isActive
                    ? "bg-panel-hover text-panel-text"
                    : "text-panel-dim hover:text-panel-text hover:bg-panel-hover/30",
                )
              }
            >
              <Globe className="w-2.5 h-2.5 shrink-0 opacity-40" />
              <span className="truncate font-mono">
                {d.label || d.domain.replace("www.", "")}
              </span>
              <span
                className={cn(
                  "ml-auto text-[9px] font-mono",
                  pct === 100
                    ? "text-accent-green"
                    : pct > 50
                      ? "text-accent-amber"
                      : "text-accent-red",
                )}
              >
                {pct}%
              </span>
            </NavLink>
          );
        })}
      </div>

      {hasMore && !filter && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] text-accent-blue hover:text-accent-blue/80 transition-colors cursor-pointer"
        >
          {expanded ? `Zwiń` : `Pokaż wszystkie (${filtered.length})`}
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      )}
    </div>
  );
}
