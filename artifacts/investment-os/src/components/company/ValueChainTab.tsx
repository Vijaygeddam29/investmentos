import { useEffect, type ReactNode } from "react";
import {
  Loader2,
  Package,
  Users,
  Settings,
  Layers,
  TrendingUp,
  ArrowUpDown,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCompanyValueChain,
  useGenerateCompanyValueChain,
  getGetCompanyValueChainQueryKey,
} from "@workspace/api-client-react";

interface SectionMeta {
  key: string;
  label: string;
  icon: ReactNode;
  color: string;
}

const VC_SECTIONS: SectionMeta[] = [
  {
    key: "upstreamInputs",
    label: "Upstream / Inputs",
    icon: <Package className="w-4 h-4" />,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    key: "peopleTalent",
    label: "People & Talent",
    icon: <Users className="w-4 h-4" />,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    key: "productionOperations",
    label: "Production & Operations",
    icon: <Settings className="w-4 h-4" />,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    key: "productsServices",
    label: "Products & Services",
    icon: <Layers className="w-4 h-4" />,
    color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  {
    key: "customerDemand",
    label: "Customer Demand",
    icon: <TrendingUp className="w-4 h-4" />,
    color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  {
    key: "demandSupplyChain",
    label: "Demand \u2192 Supply Chain",
    icon: <ArrowUpDown className="w-4 h-4" />,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  {
    key: "bottlenecksRisks",
    label: "Key Bottlenecks & Risks",
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
  },
];

function SectionSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
      <Skeleton className="h-5 w-40 rounded-md" />
      <Skeleton className="h-3.5 w-full rounded" />
      <Skeleton className="h-3.5 w-[92%] rounded" />
      <Skeleton className="h-3.5 w-[85%] rounded" />
    </div>
  );
}

export function ValueChainTab({ ticker }: { ticker: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading: isFetching } = useGetCompanyValueChain(ticker, {
    query: { staleTime: 60 * 60 * 1000 },
  });

  const generateMutation = useGenerateCompanyValueChain({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetCompanyValueChainQueryKey(ticker),
        });
      },
    },
  });

  const isGenerating = generateMutation.isPending;
  const content = data?.content as Record<string, string> | null | undefined;
  const hasContent = !!content;
  const isFresh = data?.fresh ?? false;

  useEffect(() => {
    if (!isFetching && !isGenerating) {
      if (!hasContent || !isFresh) {
        generateMutation.mutate({ ticker });
      }
    }
  }, [isFetching, hasContent, isFresh, isGenerating, ticker]);

  const showSkeleton = isFetching || (!hasContent && isGenerating);

  if (showSkeleton) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full rounded-xl" />
        {VC_SECTIONS.map((s) => (
          <SectionSkeleton key={s.key} />
        ))}
        <p className="text-center text-xs text-muted-foreground/60 pt-1 animate-pulse">
          Generating Value Chain analysis…
        </p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {content.oneLiner && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground leading-relaxed italic">
            "{content.oneLiner}"
          </p>
        </div>
      )}

      {VC_SECTIONS.map(({ key, label, icon, color }) => (
        <div
          key={key}
          className="rounded-xl border border-border bg-secondary/20 p-4"
        >
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold mb-3 ${color}`}
          >
            {icon}
            {label}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {content[key] || "—"}
          </p>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        {data?.generatedAt && (
          <span className="text-[10px] font-mono text-muted-foreground/50">
            Generated{" "}
            {new Date(data.generatedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground ml-auto"
          onClick={() => generateMutation.mutate({ ticker })}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Regenerate
        </Button>
      </div>
    </div>
  );
}
