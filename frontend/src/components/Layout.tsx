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
      {/* Sidebar */}
      <aside className="w-56 bg-panel-surface border-r border-panel-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-panel-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-accent-blue/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-accent-blue" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">SEO Panel</div>
              <div className="text-[10px] text-panel-muted font-mono uppercase tracking-widest">
                Command Center
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150",
                  isActive
                    ? "bg-accent-blue/10 text-accent-blue font-medium"
                    : "text-panel-dim hover:text-panel-text hover:bg-panel-hover/50",
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {item.label === "Alerty" && overview?.alertCount > 0 && (
                <span className="ml-auto text-[10px] font-mono bg-accent-red/20 text-accent-red px-1.5 py-0.5 rounded">
                  {overview.alertCount}
                </span>
              )}
            </NavLink>
          ))}

          <div className="pt-4 pb-2 px-3">
            <div className="text-[10px] uppercase tracking-widest text-panel-muted font-semibold">
              Domeny
            </div>
          </div>

          <DomainsNav />
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-panel-border">
          <div className="text-[10px] text-panel-muted font-mono">
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
    <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
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
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all group",
                isActive
                  ? "bg-panel-hover text-panel-text"
                  : "text-panel-dim hover:text-panel-text hover:bg-panel-hover/30",
              )
            }
          >
            <Globe className="w-3 h-3 shrink-0 opacity-50" />
            <span className="truncate font-mono text-[11px]">
              {d.label || d.domain.replace("www.", "")}
            </span>
            <span
              className={cn(
                "ml-auto text-[10px] font-mono",
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
