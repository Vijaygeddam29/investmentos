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
  ChevronDown,
  Check
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useSidebarCtx } from "./Layout";
import { useAuth, type Market } from "@/contexts/AuthContext";

const MARKET_OPTIONS: { value: Market; flag: string; label: string }[] = [
  { value: "United States", flag: "🇺🇸", label: "United States" },
  { value: "United Kingdom", flag: "🇬🇧", label: "United Kingdom" },
  { value: "India",          flag: "🇮🇳", label: "India" },
  { value: "All",            flag: "🌍",  label: "All Markets" },
];

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navGroups = [
  {
    label: "Research",
    items: [
      { icon: LayoutDashboard, label: "Dashboards",     href: "/" },
      { icon: Radio,           label: "Signals",         href: "/signals" },
      { icon: Globe,           label: "Universe",        href: "/universe" },
      { icon: Filter,          label: "Screener",        href: "/screener" },
      { icon: LayoutGrid,      label: "Sector Heatmap", href: "/sector-heatmap" },
    ],
  },
  {
    label: "My Portfolio",
    items: [
      { icon: Briefcase, label: "Portfolio",         href: "/portfolio" },
      { icon: Wand2,     label: "Portfolio Builder", href: "/portfolio/builder" },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { open, isMobile, close } = useSidebarCtx();
  const { user, logout, market, setMarket } = useAuth();

  const displayName = user?.name ?? user?.email ?? user?.phone ?? "Account";
  const displaySub  = user?.email ?? user?.phone ?? "";
  const closeRef = useRef<HTMLButtonElement>(null);
  const [marketOpen, setMarketOpen] = useState(false);

  const currentMarket = MARKET_OPTIONS.find((m) => m.value === market) ?? MARKET_OPTIONS[3];

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

      {/* Market switcher */}
      <div className="px-4 py-3 border-t border-border">
        <div className="text-[10px] font-mono text-muted-foreground mb-1.5 px-1 uppercase tracking-wider">Market</div>
        <div className="relative">
          <button
            onClick={() => setMarketOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-sidebar-accent transition-all text-sm font-medium text-white"
          >
            <span className="text-base leading-none">{currentMarket.flag}</span>
            <span className="flex-1 text-left text-sm">{currentMarket.label}</span>
            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", marketOpen && "rotate-180")} />
          </button>
          {marketOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-[#1a1d2e] border border-border rounded-xl shadow-2xl overflow-hidden z-50">
              {MARKET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setMarket(opt.value); setMarketOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-sidebar-accent transition-colors text-sm"
                >
                  <span className="text-base leading-none">{opt.flag}</span>
                  <span className={cn("flex-1 text-left", opt.value === market ? "text-white font-medium" : "text-slate-300")}>
                    {opt.label}
                  </span>
                  {opt.value === market && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-border space-y-1">
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
