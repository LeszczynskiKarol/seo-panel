import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
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
  Search,
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
        {/* Domain picker - ZAWSZE WIDOCZNY NA GÓRZE */}
        <DomainPicker />

        {/* Nav */}
        <nav className="flex-1 flex flex-col px-2 py-2 min-h-0 overflow-y-auto">
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

function DomainPicker() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: api.getDomains,
  });

  // zamknij po kliknięciu poza
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // focus input po otwarciu
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // zamknij po nawigacji
  useEffect(() => {
    setOpen(false);
    setFilter("");
  }, [location.pathname]);

  const activeDomain = domains?.find((d: any) =>
    location.pathname.startsWith(`/domains/${d.id}`),
  );

  const filtered = (domains || []).filter((d: any) =>
    (d.label || d.domain).toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      {/* Trigger button - zawsze widoczny */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 border-b border-panel-border text-left transition-colors cursor-pointer",
          "hover:bg-panel-hover/50",
          open && "bg-panel-hover/50",
        )}
      >
        <Globe className="w-3.5 h-3.5 text-accent-blue shrink-0" />
        <span className="text-[10px] font-mono truncate flex-1">
          {activeDomain
            ? activeDomain.label || activeDomain.domain.replace("www.", "")
            : "Wybierz domenę"}
        </span>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-panel-muted transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown overlay */}
      {open && (
        <div className="absolute top-full left-0 w-64 bg-panel-surface border border-panel-border rounded-b-md shadow-lg z-50 max-h-[70vh] flex flex-col">
          {/* Search */}
          <div className="p-2 border-b border-panel-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-panel-muted" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Szukaj domeny…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="input w-full text-[10px] py-1.5 pl-6 pr-2"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1 p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-[10px] text-panel-muted text-center">
                Brak wyników
              </div>
            ) : (
              filtered.map((d: any) => {
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
                        "flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] transition-all",
                        isActive
                          ? "bg-accent-blue/10 text-accent-blue"
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
                        "ml-auto text-[9px] font-mono shrink-0",
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
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
