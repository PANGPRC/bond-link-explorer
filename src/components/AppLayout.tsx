import { NavLink, Outlet } from "react-router-dom";
import { Activity, Search, Database, ChevronRight } from "lucide-react";
import { getRateLimitInfo } from "@/lib/api";
import { useEffect, useState } from "react";

const navItems = [
  { to: "/bond-query", label: "Bond Query", icon: Search },
  { to: "/bond-crud", label: "Bond CRUD", icon: Database },
  { to: "/health-check", label: "Health Check", icon: Activity },
];

export default function AppLayout() {
  const [rateInfo, setRateInfo] = useState({ remaining: 20, total: 20, used: 0, resetIn: 0 });

  useEffect(() => {
    const interval = setInterval(() => setRateInfo(getRateLimitInfo()), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-sidebar flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <h1 className="text-sidebar-primary-foreground font-semibold text-lg tracking-tight">
            Bond Manager
          </h1>
          <p className="text-sidebar-foreground text-xs mt-1 opacity-60">Data Management System</p>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
            </NavLink>
          ))}
        </nav>

        {/* Rate limit indicator */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground opacity-60 mb-2">API Rate Limit</div>
          <div className="w-full bg-sidebar-accent rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${(rateInfo.remaining / rateInfo.total) * 100}%`,
                backgroundColor: rateInfo.remaining > 5 ? "hsl(var(--success))" : "hsl(var(--destructive))",
              }}
            />
          </div>
          <div className="text-xs text-sidebar-foreground opacity-50 mt-1">
            {rateInfo.remaining}/{rateInfo.total} remaining
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
