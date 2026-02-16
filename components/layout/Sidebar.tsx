"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LinkIcon,
  CreditCard,
  ArrowDownCircle,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/user-context";

const allNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/generate", label: "Generate Link", icon: Zap, adminOnly: false },
  { href: "/links", label: "Payment Links", icon: LinkIcon, adminOnly: false },
  { href: "/payments", label: "Payments", icon: CreditCard, adminOnly: false },
  { href: "/down-payments", label: "Down Payments", icon: ArrowDownCircle, adminOnly: false },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const user = useUser();

  const navItems = allNavItems.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-cyber-dark border-r border-cyber-border transition-all duration-300 relative",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-cyber-border">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyber-cyan/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyber-cyan" />
            </div>
            <span className="font-[family-name:var(--font-orbitron)] text-lg font-bold text-white tracking-wider">
              Career<span className="text-cyber-cyan">Growth</span>
            </span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-cyber-cyan/20 flex items-center justify-center mx-auto">
            <Zap className="w-5 h-5 text-cyber-cyan" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                isActive
                  ? "bg-cyber-cyan/10 text-cyber-cyan"
                  : "text-cyber-muted hover:text-cyber-text hover:bg-white/5"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-cyber-cyan rounded-r" />
              )}
              <Icon
                className={cn(
                  "w-5 h-5 flex-shrink-0",
                  isActive
                    ? "text-cyber-cyan"
                    : "text-cyber-muted group-hover:text-cyber-text"
                )}
              />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info + Logout */}
      {user && !collapsed && (
        <div className="px-3 py-3 border-t border-cyber-border">
          <div className="flex items-center gap-3 mb-2 px-1">
            <div className="w-8 h-8 rounded-full bg-cyber-cyan/20 flex items-center justify-center text-xs font-bold text-cyber-cyan flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-cyber-muted capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-cyber-muted hover:text-cyber-red hover:bg-cyber-red/10 transition-all text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      )}
      {user && collapsed && (
        <div className="px-2 py-3 border-t border-cyber-border">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full p-2 rounded-lg text-cyber-muted hover:text-cyber-red hover:bg-cyber-red/10 transition-all"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-cyber-border text-cyber-muted hover:text-cyber-text transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
