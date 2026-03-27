import { NavLink } from "react-router-dom";
import { Package, Plus, Route, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", icon: Package, label: "Orders" },
  { to: "/create", icon: Plus, label: "New Order" },
  { to: "/routes", icon: Route, label: "Routes" },
  { to: "/guidance", icon: Navigation, label: "Rider" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold tracking-tight">dispatch</span>
            <nav className="hidden sm:flex items-center gap-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )
                  }
                >
                  <link.icon className="h-3.5 w-3.5" />
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="text-xs text-muted-foreground">demo mode</div>
        </div>
      </header>
      {/* Mobile nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 border-t bg-background z-50">
        <div className="flex justify-around py-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 text-[10px] px-3 py-1 transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 pb-20 sm:pb-6">{children}</main>
    </div>
  );
}