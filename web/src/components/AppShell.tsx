import type { ReactNode } from "react";

import { Compass, Navigation, Package, Plus, Route } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { ConnectionPill } from "@/components/ConnectionPill";
import { useApiHealth } from "@/hooks/use-api-health";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", icon: Package, label: "Control" },
  { to: "/create", icon: Plus, label: "New Order" },
  { to: "/routes", icon: Route, label: "Routes" },
  { to: "/guidance", icon: Navigation, label: "Guidance" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const health = useApiHealth();

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.14),transparent_38%),radial-gradient(circle_at_top_right,rgba(180,83,9,0.12),transparent_34%)]" />
      <header className="sticky top-0 z-50 border-b border-white/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Delivery orchestration</p>
              <h1 className="text-sm font-semibold tracking-tight text-foreground">Dispatch Control Surface</h1>
            </div>
          </div>
          <nav className="hidden items-center gap-1 rounded-full border border-white/70 bg-white/80 p-1 shadow-sm md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <ConnectionPill online={health.isSuccess} />
            <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs text-muted-foreground">{location.pathname}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-8 md:pb-10">{children}</main>

      <nav className="fixed inset-x-3 bottom-3 z-50 rounded-[1.25rem] border border-white/70 bg-white/90 p-2 shadow-[0_20px_40px_-20px_rgba(15,23,42,0.45)] backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
