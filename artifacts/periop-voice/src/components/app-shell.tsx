import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { UserButton } from "@clerk/react";
import {
  LayoutDashboard, Users, Stethoscope, Phone, Bell, FileText, Settings, ChevronLeft, ChevronRight, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useListAlerts } from "@workspace/api-client-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Procedures", href: "/procedures", icon: Stethoscope },
  { label: "Call Queue", href: "/calls", icon: Phone },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Templates", href: "/templates", icon: FileText },
];

const adminItems = [
  { label: "Staff Users", href: "/admin/users", icon: ShieldCheck },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();
  const { data: me } = useGetMe();
  const { data: alerts } = useListAlerts({ acknowledged: false } as any);
  const unresolvedCount = alerts?.filter(a => !(a as any).acknowledged).length ?? 0;
  const isAdmin = me?.role === "admin";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-sidebar transition-all duration-200 shrink-0",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center h-14 border-b border-sidebar-border px-3 gap-2.5", collapsed && "justify-center px-0")}>
          <img src="/logo.svg" alt="PeriOp Voice" className="w-7 h-7 shrink-0" />
          {!collapsed && (
            <span className="text-sm font-semibold text-sidebar-foreground tracking-tight">PeriOp Voice</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-1.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            const isAlerts = href === "/alerts";
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors relative",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
                {isAlerts && unresolvedCount > 0 && (
                  <span className={cn(
                    "ml-auto text-xs font-semibold bg-destructive text-destructive-foreground rounded-full min-w-4 h-4 flex items-center justify-center px-1",
                    collapsed && "absolute -top-0.5 -right-0.5 ml-0"
                  )}>
                    {unresolvedCount > 99 ? "99+" : unresolvedCount}
                  </span>
                )}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="mt-2 mb-1 px-2.5">
                {!collapsed && (
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Admin</span>
                )}
                <div className="border-t border-sidebar-border mt-1" />
              </div>

              {adminItems.map(({ label, href, icon: Icon }) => {
                const active = location === href || location.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>{label}</span>}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className={cn("border-t border-sidebar-border p-2 flex items-center gap-2", collapsed && "justify-center")}>
          <UserButton afterSignOutUrl="/" />
          {!collapsed && me && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {me.firstName || me.email?.split("@")[0]}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{me.role}</p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          data-testid="sidebar-toggle"
          className="border-t border-sidebar-border flex items-center justify-center h-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors text-xs"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
