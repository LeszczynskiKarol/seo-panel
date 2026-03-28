import { Outlet, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Globe,
  Eye,
  Bell,
  Activity,
  Lightbulb,
  Clock,
} from "lucide-react";

import { cn } from "../lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/insights", icon: Lightbulb, label: "Insights" },
  { to: "/timeline", icon: Clock, label: "Timeline" },
  { to: "/watchlist", icon: Eye, label: "Watchlist" },
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
        {/* Logo */}
        <div className="px-3 py-3 border-b border-panel-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent-blue/20 flex items-center justify-center">
              <Activity className="w-3 h-3 text-accent-blue" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-tight">SEO Panel</div>
              <div className="text-[8px] text-panel-muted font-mono uppercase tracking-widest">
                Command Center
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-0.5">
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
      <main className="flex-1 overflow-y-auto">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function DomainsNav() {
  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: api.getDomains,
  });

  if (!domains) return null;

  return (
    <div className="space-y-px max-h-[400px] overflow-y-auto">
      {domains.map((d: any) => {
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
  );
}
