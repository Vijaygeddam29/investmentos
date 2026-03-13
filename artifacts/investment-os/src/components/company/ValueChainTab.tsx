import type { ReactNode } from "react";
import { Loader2, Link2, Users, Zap, Shield, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";

interface ValueChainData {
  oneLiner: string;
  supplyChain: string;
  customerStickiness: string;
  keyPeople: string;
  competitiveMoat: string;
  growthCatalysts: string;
  riskNarratives: string;
  generatedAt?: string;
}

const VC_SECTIONS: { key: keyof ValueChainData; label: string; icon: ReactNode; color: string }[] = [
  { key: "competitiveMoat",    label: "Competitive Moat",    icon: <Shield className="w-4 h-4" />,        color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  { key: "customerStickiness", label: "Customer Stickiness", icon: <Users className="w-4 h-4" />,         color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { key: "supplyChain",        label: "Supply Chain",        icon: <Link2 className="w-4 h-4" />,         color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { key: "keyPeople",          label: "Key People",          icon: <Users className="w-4 h-4" />,         color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { key: "growthCatalysts",    label: "Growth Catalysts",    icon: <Zap className="w-4 h-4" />,           color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  { key: "riskNarratives",     label: "Risk Narratives",     icon: <AlertTriangle className="w-4 h-4" />, color: "text-red-400 bg-red-500/10 border-red-500/20" },
];

export function ValueChainTab({ ticker }: { ticker: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ valueChain: ValueChainData | null; cached: boolean }>({
    queryKey: ["value-chain", ticker],
    queryFn: () => customFetch(`/api/companies/${ticker}/value-chain`),
    staleTime: 60 * 60 * 1000,
  });

  const generateMutation = useMutation({
    mutationFn: () => customFetch(`/api/companies/${ticker}/value-chain`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["value-chain", ticker] }),
  });

  const vc = data?.valueChain;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!vc) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
          <Link2 className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground mb-1">No Value Chain Story yet</h3>
          <p className="text-sm text-muted-foreground max-w-[300px]">
            Generate an AI-powered narrative covering supply chain, customer stickiness, key people, competitive moat, growth catalysts, and risk narratives.
          </p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="gap-2"
        >
          {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {generateMutation.isPending ? "Generating…" : "Generate Value Chain Story"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-medium text-foreground leading-relaxed italic">"{vc.oneLiner}"</p>
      </div>

      {VC_SECTIONS.map(({ key, label, icon, color }) => (
        <div key={key} className="rounded-xl border border-border bg-secondary/20 p-4">
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold mb-3 ${color}`}>
            {icon}{label}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{String(vc[key])}</p>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        {vc.generatedAt && (
          <span className="text-[10px] font-mono text-muted-foreground/50">
            Generated {new Date(vc.generatedAt).toLocaleString()}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground ml-auto"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Regenerate
        </Button>
      </div>
    </div>
  );
}
