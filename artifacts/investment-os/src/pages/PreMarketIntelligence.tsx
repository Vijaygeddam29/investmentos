import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sunrise, RefreshCw, TrendingUp, TrendingDown, Minus,
  Globe, Shield, AlertTriangle, Eye, Zap, ChevronDown, ChevronUp,
} from "lucide-react";

const riskConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  low:      { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "Low Risk" },
  moderate: { color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    label: "Moderate" },
  elevated: { color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   label: "Elevated" },
  high:     { color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30",     label: "High Risk" },
};

function MacroCard({ item }: { item: { ticker: string; price: number | null; changePercent: number | null; label: string } }) {
  const up = (item.changePercent ?? 0) > 0;
  const dn = (item.changePercent ?? 0) < 0;
  const ChangeIcon = up ? TrendingUp : dn ? TrendingDown : Minus;
  const changeColor = up ? "text-emerald-400" : dn ? "text-red-400" : "text-slate-400";
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 flex flex-col gap-1">
      <div className="text-xs text-muted-foreground">{item.label}</div>
      <div className="text-sm font-bold text-white">
        {item.price != null ? item.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "–"}
      </div>
      <div className={`flex items-center gap-1 text-xs font-medium ${changeColor}`}>
        <ChangeIcon className="w-3 h-3" />
        {item.changePercent != null ? `${item.changePercent > 0 ? "+" : ""}${item.changePercent.toFixed(2)}%` : "–"}
      </div>
    </div>
  );
}

export default function PreMarketIntelligence() {
  const qc = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["premarket-today"],
    queryFn: async () => {
      const r = await fetch("/api/intelligence/premarket/today", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
  });

  const { data: macroData } = useQuery({
    queryKey: ["premarket-macro"],
    queryFn: async () => {
      const r = await fetch("/api/intelligence/premarket/macro", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    refetchInterval: 300_000,
  });

  const { data: historyData } = useQuery({
    queryKey: ["premarket-history"],
    queryFn: async () => {
      const r = await fetch("/api/intelligence/premarket/history?limit=10", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    enabled: showHistory,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/intelligence/premarket/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["premarket-today"] });
    },
  });

  const briefing = data?.briefing;
  const risk = briefing?.riskLevel ?? "moderate";
  const rc = riskConfig[risk] ?? riskConfig.moderate;
  const macroItems = macroData?.data ?? [];

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const directionArrow = (d: string) => d === "positive" ? "↑" : d === "negative" ? "↓" : "→";
  const dirColor = (d: string) => d === "positive" ? "text-emerald-400" : d === "negative" ? "text-red-400" : "text-slate-400";

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sunrise className="w-5 h-5 text-amber-400" />
              <h1 className="text-2xl font-bold text-white">Pre-Market Intelligence</h1>
            </div>
            <p className="text-sm text-muted-foreground">{today}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Zap className="w-4 h-4 mr-2" />
              {generateMutation.isPending ? "Generating..." : "Generate Now"}
            </Button>
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && !briefing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-32 rounded-lg bg-slate-800/40 animate-pulse" />)}
          </div>
        )}

        {/* No briefing yet */}
        {!isLoading && !briefing && (
          <div className="text-center py-20">
            <Sunrise className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-lg text-muted-foreground">No briefing for today yet</p>
            <p className="text-sm text-muted-foreground mt-1">Briefings auto-generate Mon–Fri at 06:00 UK time, or click "Generate Now"</p>
            <Button
              className="mt-6 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              <Zap className="w-4 h-4 mr-2" />
              {generateMutation.isPending ? "Generating briefing..." : "Generate Today's Briefing"}
            </Button>
          </div>
        )}

        {/* Main briefing */}
        {briefing && (
          <>
            {/* Risk banner */}
            <div className={`rounded-xl border p-5 ${rc.bg} ${rc.border}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge className={`${rc.bg} ${rc.border} ${rc.color} border font-semibold uppercase tracking-wider`}>
                      {rc.label}
                    </Badge>
                    {briefing.positionSizeMultiplier < 0.95 && (
                      <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-400 bg-violet-500/10">
                        Size at {Math.round(briefing.positionSizeMultiplier * 100)}%
                      </Badge>
                    )}
                  </div>
                  <p className={`text-sm leading-relaxed ${rc.color}`}>{briefing.macroMood}</p>
                </div>
                {briefing.positionSizeMultiplier < 0.85 && (
                  <div className="shrink-0">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Options implications */}
            {briefing.optionsImplications && (
              <Card className="bg-[#1a1f2e] border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-violet-400" />
                    Options Strategy Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{briefing.optionsImplications}</p>
                </CardContent>
              </Card>
            )}

            {/* Sector alerts */}
            {briefing.sectorAlerts?.length > 0 && (
              <Card className="bg-[#1a1f2e] border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    Sector Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {briefing.sectorAlerts.map((s: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/40">
                      <span className={`text-base font-bold ${dirColor(s.direction)} shrink-0`}>
                        {directionArrow(s.direction)}
                      </span>
                      <div>
                        <span className="text-sm font-semibold text-white">{s.sector}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Watch list */}
            {briefing.watchList?.length > 0 && (
              <Card className="bg-[#1a1f2e] border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    Watch List Today
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {briefing.watchList.map((w: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold shrink-0">·</span>
                      <div>
                        <span className="text-sm font-semibold text-white">{w.item}</span>
                        <span className="text-xs text-muted-foreground ml-2">{w.reason}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Live macro data */}
        {macroItems.length > 0 && (
          <Card className="bg-[#1a1f2e] border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white">Live Macro Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {macroItems.map((item: any) => (
                  <MacroCard key={item.ticker} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <div>
          <button
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
            onClick={() => setShowHistory((h) => !h)}
          >
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showHistory ? "Hide" : "View"} previous briefings
          </button>

          {showHistory && historyData?.briefings?.length > 0 && (
            <div className="mt-3 space-y-2">
              {historyData.briefings.map((b: any) => {
                const brc = riskConfig[b.riskLevel] ?? riskConfig.moderate;
                return (
                  <div key={b.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(b.generatedAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                        <Badge variant="outline" className={`text-xs border ${brc.border} ${brc.color} ${brc.bg}`}>
                          {brc.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{b.macroMood}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
