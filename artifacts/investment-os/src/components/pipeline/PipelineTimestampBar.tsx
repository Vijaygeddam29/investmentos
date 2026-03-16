import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, XCircle, Calendar } from "lucide-react";
import { format } from "date-fns";

interface PipelineStatus {
  running: boolean;
  lastRun: string | null;
  lastRunUpdated: number;
  lastRunFailed: number;
  stocksScored: number;
  totalTickers: number;
  tickersProcessed: number;
  currentStep: string | null;
  yfPatchStats: { patched: number; failed: number } | null;
  dataSourceBreakdown: { fmp: number; yahoo: number };
  nextScheduledRun?: string;
  lastAutoRun?: string;
}

export function PipelineTimestampBar({ className }: { className?: string }) {
  const { data } = useQuery<PipelineStatus>({
    queryKey: ["pipeline-status"],
    queryFn: () => customFetch("/api/pipeline/status").then(r => r.json()),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const lastRun     = data?.lastRun ? new Date(data.lastRun) : null;
  const isRunning   = data?.running;
  const updated     = data?.lastRunUpdated ?? 0;
  const failed      = data?.lastRunFailed ?? 0;
  const nextRun     = data?.nextScheduledRun ? new Date(data.nextScheduledRun) : null;

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground ${className ?? ""}`}>
      {isRunning ? (
        <span className="flex items-center gap-1.5 text-amber-400 font-medium">
          <Activity className="w-3 h-3 animate-pulse" />
          Pipeline running · {data?.currentStep ?? "processing"}
          {data?.tickersProcessed != null && data?.totalTickers
            ? ` (${data.tickersProcessed} / ${data.totalTickers})`
            : ""}
        </span>
      ) : lastRun ? (
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>Last pipeline run: <strong className="text-foreground font-mono">{format(lastRun, "dd MMM yyyy")}</strong> at <strong className="text-foreground font-mono">{format(lastRun, "HH:mm")} UTC</strong></span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-muted-foreground/50">
          <AlertTriangle className="w-3 h-3" />
          Pipeline not yet run
        </span>
      )}

      {!isRunning && lastRun && (
        <>
          <span className="text-border hidden sm:inline">·</span>
          <span className="flex items-center gap-1.5 text-emerald-400/80">
            <RefreshCw className="w-3 h-3" />
            {updated} updated
          </span>

          {failed > 0 && (
            <>
              <span className="text-border hidden sm:inline">·</span>
              <span className="flex items-center gap-1.5 text-red-400/80">
                <XCircle className="w-3 h-3" />
                {failed} failed
              </span>
            </>
          )}
        </>
      )}

      {!isRunning && nextRun && (
        <>
          <span className="text-border hidden sm:inline">·</span>
          <span className="flex items-center gap-1.5 text-blue-400/60">
            <Calendar className="w-3 h-3" />
            Auto-run: <strong className="text-foreground/70 font-mono">{format(nextRun, "EEE dd MMM, HH:mm")} UTC</strong>
          </span>
        </>
      )}
    </div>
  );
}
