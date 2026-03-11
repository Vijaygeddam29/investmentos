import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useRunPipeline, 
  useGetPipelineStatus,
  getGetPipelineStatusQueryKey,
  getListScoresQueryKey,
  getListDriftSignalsQueryKey,
  getListOpportunityAlertsQueryKey,
  getListRiskAlertsQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function usePipelineManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  // Poll pipeline status every 3 seconds if isPolling is true
  const { data: status, isError } = useGetPipelineStatus({
    query: {
      enabled: isPolling,
      refetchInterval: isPolling ? 3000 : false,
    }
  });

  const runPipelineMutation = useRunPipeline({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Pipeline Initiated",
          description: "The ETL and scoring engines are now running.",
        });
        setIsPolling(true);
      },
      onError: (error: any) => {
        toast({
          title: "Pipeline Failed to Start",
          description: error.message || "Unknown error occurred.",
          variant: "destructive",
        });
      }
    }
  });

  useEffect(() => {
    if (status) {
      if (!status.running && isPolling) {
        setIsPolling(false);
        // Pipeline finished, invalidate all data queries
        queryClient.invalidateQueries({ queryKey: getListScoresQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListDriftSignalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListOpportunityAlertsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRiskAlertsQueryKey() });
        
        toast({
          title: "Pipeline Complete",
          description: `Processed ${status.tickersProcessed || 0} tickers. Scores updated.`,
          variant: "default",
        });
      }
    }
    if (isError) {
      setIsPolling(false);
    }
  }, [status, isPolling, queryClient, toast, isError]);

  const triggerPipeline = (tickers?: string[]) => {
    runPipelineMutation.mutate({ data: { tickers } });
  };

  return {
    triggerPipeline,
    isStarting: runPipelineMutation.isPending,
    isRunning: isPolling || status?.running,
    status
  };
}
