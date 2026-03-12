import { usePipelineManager } from "@/hooks/use-pipeline-manager";
import { Button } from "@/components/ui/button";
import { Play, Loader2, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

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

  const results = status?.results ?? [];
  const lastTicker = results[results.length - 1];
  const currentTicker = status?.currentTicker;
  const currentStep = status?.currentStep;
  const total = status?.totalTickers ?? 0;
  const processed = status?.tickersProcessed ?? 0;

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-mono text-muted-foreground">
          System Status: <span className="text-success font-medium">Online</span>
        </h2>
        {status?.lastRun && !isRunning && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-md">
            <Clock className="w-3 h-3" />
            Last scan: {format(new Date(status.lastRun), 'MMM d, HH:mm')}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isRunning && (
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full">
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

        {!isRunning && results.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
          onClick={() => triggerPipeline()}
          disabled={isStarting || isRunning}
          className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white shadow-lg shadow-primary/20 border-0"
        >
          {isStarting || isRunning ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          Run Pipeline
        </Button>
      </div>
    </header>
  );
}
