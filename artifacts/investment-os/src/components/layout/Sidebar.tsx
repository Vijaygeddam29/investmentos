import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Radio,
  Globe,
  Filter,
  LayoutGrid,
  Briefcase,
  Wand2,
  Settings,
  X,
  LogOut,
  User,
  Shield,
  TrendingDown,
  Activity,
  DollarSign,
  Sunrise,
  Link2,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useSidebarCtx } from "./Layout";
import { useAuth } from "@/contexts/AuthContext";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navGroups = [
  {
    label: "Research",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",      href: "/" },
      { icon: Sunrise,         label: "Pre-Market",     href: "/intelligence" },
      { icon: Radio,           label: "Signals",         href: "/signals" },
      { icon: Globe,           label: "Universe",        href: "/universe" },
      { icon: Filter,          label: "Screener",        href: "/screener" },
      { icon: LayoutGrid,      label: "Sector Heatmap", href: "/sector-heatmap" },
    ],
  },
  {
    label: "Options Income",
    items: [
      { icon: TrendingDown, label: "Options Signals", href: "/options/signals" },
      { icon: Activity,     label: "Positions",       href: "/options/positions" },
      { icon: DollarSign,   label: "Income Tracker",  href: "/options/income" },
    ],
  },
  {
    label: "My Portfolio",
    items: [
      { icon: Briefcase, label: "Portfolio",         href: "/portfolio" },
      { icon: Wand2,     label: "Portfolio Builder", href: "/portfolio/builder" },
      { icon: Link2,     label: "Connect IBKR",      href: "/settings/ibkr" },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { open, isMobile, close } = useSidebarCtx();
  const { user, logout } = useAuth();

  const displayName = user?.name ?? user?.email ?? user?.phone ?? "Account";
  const displaySub  = user?.email ?? user?.phone ?? "";
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !isMobile) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isMobile, close]);

  const sidebarContent = (
    <div className={cn(
      "w-64 border-r border-border bg-sidebar flex flex-col h-screen overflow-hidden flex-shrink-0",
      isMobile && "relative"
    )}>
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
        </div>
        <span className="font-display font-bold text-lg tracking-tight text-white">Investment<span className="text-primary">OS</span></span>
        {isMobile && (
          <button ref={closeRef} onClick={close} className="ml-auto p-1 rounded-lg hover:bg-sidebar-accent transition-colors" aria-label="Close navigation menu">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="text-xs font-mono text-muted-foreground mb-2 px-2 uppercase tracking-wider">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={isMobile ? close : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "w-4 h-4 transition-colors flex-shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                    )} />
                    {item.label}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-1">
        {user?.email === "vijay@marketlifes.com" && (
          <Link
            href="/admin"
            onClick={isMobile ? close : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium transition-all duration-150",
              location === "/admin"
                ? "bg-indigo-500/15 text-indigo-400"
                : "text-indigo-400/60 hover:bg-indigo-500/10 hover:text-indigo-400"
            )}
          >
            <Shield className="w-4 h-4" />
            Admin Console
          </Link>
        )}
        <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150">
          <Settings className="w-4 h-4" />
          Settings
        </button>
        {user && (
          <>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{displayName}</div>
                {displaySub && displaySub !== displayName && (
                  <div className="text-[10px] text-muted-foreground truncate">{displaySub}</div>
                )}
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-red-900/30 hover:text-red-400 transition-all duration-150"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {open && (
          <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
            <div className="relative z-[70] animate-in slide-in-from-left duration-200">
              {sidebarContent}
            </div>
          </div>
        )}
      </>
    );
  }

  return sidebarContent;
}
