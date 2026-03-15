import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Activity, Clock, Database, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PipelineStatus {
  running: boolean;
  lastRun: string | null;
  stocksScored: number;
  totalTickers: number;
  tickersProcessed: number;
  currentStep: string | null;
  yfPatchStats: { patched: number; failed: number } | null;
  dataSourceBreakdown: { fmp: number; yahoo: number };
}

export function PipelineTimestampBar({ className }: { className?: string }) {
  const { data } = useQuery<PipelineStatus>({
    queryKey: ["pipeline-status"],
    queryFn: () => customFetch("/api/pipeline/status").then(r => r.json()),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const lastRun = data?.lastRun ? new Date(data.lastRun) : null;
  const stocksScored = data?.stocksScored ?? data?.totalTickers ?? 0;
  const yfPatch = data?.yfPatchStats;
  const isRunning = data?.running;

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground ${className ?? ""}`}>
      {isRunning ? (
        <span className="flex items-center gap-1.5 text-amber-400">
          <Activity className="w-3 h-3 animate-pulse" />
          Pipeline running · {data?.currentStep ?? "processing"}
          {data?.tickersProcessed != null && data?.totalTickers
            ? ` (${data.tickersProcessed}/${data.totalTickers})`
            : ""}
        </span>
      ) : lastRun ? (
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          Last updated {formatDistanceToNow(lastRun, { addSuffix: true })}
          <span className="text-border">·</span>
          <Clock className="w-3 h-3" />
          {lastRun.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          {" "}
          {lastRun.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} UTC
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-muted-foreground/50">
          <AlertTriangle className="w-3 h-3" />
          Pipeline not yet run
        </span>
      )}

      {stocksScored > 0 && (
        <>
          <span className="text-border hidden sm:inline">·</span>
          <span className="flex items-center gap-1.5">
            <Database className="w-3 h-3" />
            {stocksScored} stocks scored
          </span>
        </>
      )}

      {yfPatch && yfPatch.patched > 0 && (
        <>
          <span className="text-border hidden sm:inline">·</span>
          <span className="flex items-center gap-1.5 text-blue-400/70">
            YF backfill: {yfPatch.patched} companies enriched
          </span>
        </>
      )}
    </div>
  );
}
