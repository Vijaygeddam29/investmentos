import { usePipelineManager } from "@/hooks/use-pipeline-manager";
import { Button } from "@/components/ui/button";
import { Play, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";

export function Header() {
  const { triggerPipeline, isStarting, isRunning, status } = usePipelineManager();

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-mono text-muted-foreground">
          System Status: <span className="text-success font-medium">Online</span>
        </h2>
        {status?.lastRun && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-md">
            <Clock className="w-3 h-3" />
            Last Scan: {format(new Date(status.lastRun), 'HH:mm:ss')}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isRunning && (
          <div className="flex items-center gap-3 text-sm font-mono bg-primary/10 text-primary px-4 py-1.5 rounded-full border border-primary/20">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing {status?.tickersProcessed || 0} tickers...</span>
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
