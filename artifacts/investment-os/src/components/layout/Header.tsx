import { useRef, useState, useEffect, useCallback } from "react";
import { usePipelineManager } from "@/hooks/use-pipeline-manager";
import { Button } from "@/components/ui/button";
import { Play, Loader2, Clock, CheckCircle2, AlertCircle, Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { format } from "date-fns";
import { useSidebarCtx } from "./Layout";

const STEP_LABELS: Record<string, string> = {
  "harvesting": "Ingesting FMP data",
  "scoring": "Computing 120 factors",
  "entry-timing": "Entry timing signal",
  "detecting": "Running detectors",
  "ai-memo": "Writing AI memo",
  "calibrating": "Calibrating universe",
};

export function Header() {
  const { triggerPipeline, isStarting, isRunning, status } = usePipelineManager();
  const { theme, toggle } = useTheme();
  const { isMobile, toggle: toggleSidebar } = useSidebarCtx();

  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLElement>(null);

  const handleScroll = useCallback(() => {
    if (!isMobile) return;
    const main = headerRef.current?.parentElement?.querySelector("main");
    if (!main) return;
    const y = main.scrollTop;
    if (y > 60 && y > lastScrollY.current) {
      setHidden(true);
    } else {
      setHidden(false);
    }
    lastScrollY.current = y;
  }, [isMobile]);

  useEffect(() => {
    const main = headerRef.current?.parentElement?.querySelector("main");
    if (!main || !isMobile) {
      setHidden(false);
      return;
    }
    main.addEventListener("scroll", handleScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleScroll);
  }, [isMobile, handleScroll]);

  const results = status?.results ?? [];
  const currentTicker = status?.currentTicker;
  const currentStep = status?.currentStep;
  const total = status?.totalTickers ?? 0;
  const processed = status?.tickersProcessed ?? 0;

  return (
    <header
      ref={headerRef}
      className={`h-14 md:h-16 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between px-3 md:px-6 sticky top-0 z-20 transition-transform duration-300 ${hidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="flex items-center gap-2 md:gap-4">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-muted-foreground hover:text-foreground -ml-1" aria-label="Open navigation menu">
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <h2 className="text-xs md:text-sm font-mono text-muted-foreground">
          Status: <span className="text-success font-medium">Online</span>
        </h2>
        {status?.lastRun && !isRunning && (
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-md">
            <Clock className="w-3 h-3" />
            Last scan: {format(new Date(status.lastRun), 'MMM d, HH:mm')}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {isRunning && (
          <div className="hidden md:flex items-center gap-3 bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            <div className="text-sm font-mono text-primary">
              {currentTicker ? (
                <span>
                  <span className="font-bold">{currentTicker}</span>
                  {currentStep && (
                    <span className="text-primary/70 ml-2 text-xs">
                      {STEP_LABELS[currentStep] ?? currentStep}
                    </span>
                  )}
                  {total > 0 && (
                    <span className="text-primary/50 ml-2 text-[10px]">
                      {processed}/{total}
                    </span>
                  )}
                </span>
              ) : (
                <span>Initializing pipeline...</span>
              )}
            </div>
          </div>
        )}

        {isRunning && isMobile && (
          <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
        )}

        {!isRunning && results.length > 0 && (
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            {results.filter((r: any) => r.success).length > 0 && (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {results.filter((r: any) => r.success).length} ok
              </span>
            )}
            {results.filter((r: any) => !r.success).length > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />
                {results.filter((r: any) => !r.success).length} failed
              </span>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="text-muted-foreground hover:text-foreground"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <Button
          onClick={() => triggerPipeline()}
          disabled={isStarting || isRunning}
          className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white shadow-lg shadow-primary/20 border-0 text-xs md:text-sm px-3 md:px-4"
          aria-label="Run Pipeline"
        >
          {isStarting || isRunning ? (
            <Loader2 className="w-4 h-4 md:mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 md:mr-2" />
          )}
          <span className="hidden md:inline">Run Pipeline</span>
        </Button>
      </div>
    </header>
  );
}
