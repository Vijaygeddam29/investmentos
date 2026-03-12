import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Activity, 
  Lightbulb, 
  AlertTriangle, 
  Globe,
  Filter,
  LayoutGrid,
  Briefcase,
  Wand2,
  Settings
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navGroups = [
  {
    label: "Research",
    items: [
      { icon: LayoutDashboard, label: "Dashboards",     href: "/" },
      { icon: Activity,        label: "Drift Signals",  href: "/signals/drift" },
      { icon: Lightbulb,       label: "Opportunities",  href: "/signals/opportunities" },
      { icon: AlertTriangle,   label: "Risk Alerts",    href: "/signals/risk" },
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

  return (
    <div className="w-64 border-r border-border bg-sidebar flex flex-col h-screen overflow-hidden flex-shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
        </div>
        <span className="font-display font-bold text-lg tracking-tight text-white">Investment<span className="text-primary">OS</span></span>
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

      <div className="p-4 border-t border-border">
        <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150">
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </div>
  );
}
