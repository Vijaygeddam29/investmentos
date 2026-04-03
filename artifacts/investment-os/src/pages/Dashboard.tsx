import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyTable } from "@/components/dashboard/CompanyTable";
import { TopMovers } from "@/components/dashboard/TopMovers";
import { useListScores, useGetMarketRegime, useListAlerts, ListScoresEngine, ListScoresCapTier } from "@workspace/api-client-react";
import { CompanyDrawer } from "@/components/company/CompanyDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Rocket, Waves, TrendingUp, TrendingDown, Minus, RefreshCw, Bell, ChevronDown, Sunrise, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

const CAP_OPTIONS: { value: ListScoresCapTier | "all"; label: string }[] = [
  { value: "all",   label: "All Caps" },
  { value: "top50", label: "Top 50" },
  { value: "large", label: "Large Cap  ($10B+)" },
  { value: "mid",   label: "Mid Cap  ($2B–$10B)" },
  { value: "small", label: "Small Cap  (<$2B)" },
];

const REGIME_CONFIG = {
  BULL:     { label: "Bull Market",     color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", icon: TrendingUp,   desc: "Rocket favoured — momentum stocks lead in risk-on environments." },
  BEAR:     { label: "Bear Market",     color: "text-red-400 border-red-500/30 bg-red-500/10",             icon: TrendingDown, desc: "Fortress favoured — quality and cash flows outperform in drawdowns." },
  RECOVERY: { label: "Recovery",        color: "text-amber-400 border-amber-500/30 bg-amber-500/10",       icon: RefreshCw,    desc: "Rocket/Fortress balanced — early-cycle leaders and defensives both work." },
  NEUTRAL:  { label: "Neutral",         color: "text-slate-400 border-slate-500/30 bg-slate-500/10",       icon: Minus,        desc: "Equal-weight across all three engines until regime clarifies." },
} as const;

const ALERT_ICON: Record<string, string> = {
  VERDICT_CHANGE:    "🔄",
  SCORE_DROP:        "📉",
  SCORE_RISE:        "📈",
  COMPOUNDER_CHANGE: "🏆",
};

export default function Dashboard() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [capTier, setCapTier] = useState<ListScoresCapTier | "all">("all");

  const { market } = useAuth();
  const countryParam = market !== "All" ? market : undefined;
  const capParam = capTier === "all" ? undefined : capTier as ListScoresCapTier;

  const { data: premarketData } = useQuery({
    queryKey: ["premarket-today"],
    queryFn: async () => {
      const r = await fetch("/api/intelligence/premarket/today", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: fortressData, isLoading: fLoading } = useListScores({ engine: ListScoresEngine.fortress, minScore: 0.6, cap_tier: capParam, country: countryParam });
  const { data: rocketData,  isLoading: rLoading } = useListScores({ engine: ListScoresEngine.rocket,  minScore: 0.6, cap_tier: capParam, country: countryParam });
  const { data: waveData,    isLoading: wLoading } = useListScores({ engine: ListScoresEngine.wave,    minScore: 0.5, cap_tier: capParam, country: countryParam });
  const { data: regimeData } = useGetMarketRegime();
  const { data: alertsData } = useListAlerts({ days: 7, limit: 10 });

  const regime = regimeData?.regime ?? "NEUTRAL";
  const regimeCfg = REGIME_CONFIG[regime] ?? REGIME_CONFIG.NEUTRAL;
  const RegimeIcon = regimeCfg.icon;
  const alerts = alertsData?.alerts ?? [];
  const briefing = premarketData?.briefing;

  const riskBannerStyle: Record<string, string> = {
    low:      "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    moderate: "border-blue-500/30 bg-blue-500/5 text-blue-400",
    elevated: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    high:     "border-red-500/30 bg-red-500/5 text-red-400",
  };

  function emptyMsg(engine: "fortress" | "rocket" | "wave"): { title: string; hint: string } {
    if (capTier === "small") {
      if (engine === "fortress") return {
        title: "No small-cap stocks meet the Fortress quality threshold.",
        hint: "Fortress requires sustained profitability, strong cash flow and low debt — rare among companies under $2B. Try the Rocket or Wave tabs for small-cap opportunities.",
      };
      if (engine === "rocket") return {
        title: "No small-cap Rocket candidates right now.",
        hint: "Rocket looks for high-growth momentum. Check back after the next weekly rescore, or switch to Wave for technical signals.",
      };
      return {
        title: "No small-cap Wave signals at this time.",
        hint: "Wave scans for near-term technical momentum. The current market may favour larger-cap names — try 'All Caps' to broaden the search.",
      };
    }
    if (capTier === "mid") {
      if (engine === "fortress") return {
        title: "Very few mid-cap Fortress stocks qualify.",
        hint: "Only companies with consistently high ROIC, strong free cash flow, and a clean balance sheet clear the Fortress bar. Broaden to 'All Caps' to include large-cap leaders.",
      };
    }
    return {
      title: "No companies found for this view.",
      hint: "Try adjusting the cap-size filter or switching strategy engines.",
    };
  }

  function handleTickerClick(ticker: string) {
    setSelectedTicker(ticker);
    setDrawerOpen(true);
  }

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-2">Strategy Engines</h1>
            <p className="text-muted-foreground">AI-scored investment candidates across three core strategies.</p>
          </div>
          {/* Cap-size filter */}
          <div className="relative shrink-0">
            <select
              value={capTier}
              onChange={e => setCapTier(e.target.value as ListScoresCapTier | "all")}
              className="appearance-none bg-card border border-border rounded-lg px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {CAP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* ── Market Regime Banner ── */}
        <div className={`flex items-start gap-4 p-4 rounded-xl border ${regimeCfg.color}`}>
          <RegimeIcon className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-sm">Market Regime: {regimeCfg.label}</span>
              {regimeData && (
                <Badge variant="outline" className="font-mono text-[11px] border-current">
                  SPY MA50 {regimeData.ma50 != null ? `$${regimeData.ma50}` : "—"} · MA200 {regimeData.ma200 != null ? `$${regimeData.ma200}` : "—"}
                </Badge>
              )}
              {regimeData && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  Fortress {Math.round((regimeData.weights?.fortress ?? 0.33) * 100)}% · Rocket {Math.round((regimeData.weights?.rocket ?? 0.33) * 100)}% · Wave {Math.round((regimeData.weights?.wave ?? 0.33) * 100)}%
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{regimeCfg.desc}</p>
          </div>
        </div>

        {/* ── Pre-Market Intelligence Banner ── */}
        {briefing && (
          <Link href="/intelligence">
            <div className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer hover:opacity-90 transition-opacity ${riskBannerStyle[briefing.riskLevel] ?? riskBannerStyle.moderate}`}>
              <Sunrise className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">Today's Intelligence</span>
                  <Badge variant="outline" className="border-current font-mono text-[11px] capitalize">
                    {briefing.riskLevel} risk
                  </Badge>
                  {briefing.positionSizeMultiplier < 0.95 && (
                    <Badge variant="outline" className="border-current font-mono text-[11px]">
                      Size at {Math.round(briefing.positionSizeMultiplier * 100)}%
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{briefing.macroMood}</p>
                {briefing.optionsImplications && (
                  <p className="text-xs mt-0.5 line-clamp-1 opacity-80">{briefing.optionsImplications}</p>
                )}
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
            </div>
          </Link>
        )}

        <Tabs defaultValue="fortress" className="w-full">
          <TabsList className="bg-secondary/50 border border-border p-1 rounded-xl h-14 mb-6 inline-flex">
            <TabsTrigger value="fortress" className="rounded-lg h-full px-6 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-emerald-400 transition-all">
              <Shield className="w-4 h-4 mr-2" />
              Fortress
            </TabsTrigger>
            <TabsTrigger value="rocket" className="rounded-lg h-full px-6 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-orange-400 transition-all">
              <Rocket className="w-4 h-4 mr-2" />
              Rocket
            </TabsTrigger>
            <TabsTrigger value="wave" className="rounded-lg h-full px-6 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-cyan-400 transition-all">
              <Waves className="w-4 h-4 mr-2" />
              Wave
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fortress" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-100/80 flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-400 block mb-1">Long-Term Compounders</strong>
                Companies with impenetrable moats, high ROIC, pristine balance sheets, and consistent cash flow generation.
                Scores heavily weight Profitability (30%) and Capital Efficiency (20%).
              </div>
            </div>
            <CompanyTable data={fortressData?.scores || []} isLoading={fLoading} defaultSortBy="fortressScore" emptyMessage={emptyMsg("fortress")} />
          </TabsContent>

          <TabsContent value="rocket" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-4 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 text-sm text-orange-100/80 flex items-start gap-3">
              <Rocket className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-orange-400 block mb-1">High-Growth Innovators</strong>
                Founder-led disruptors with high R&D intensity, rapid revenue acceleration, and strong insider ownership.
                Scores heavily weight Growth (30%) and Innovation (30%).
              </div>
            </div>
            <CompanyTable data={rocketData?.scores || []} isLoading={rLoading} defaultSortBy="rocketScore" emptyMessage={emptyMsg("rocket")} />
          </TabsContent>

          <TabsContent value="wave" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-4 p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-sm text-cyan-100/80 flex items-start gap-3">
              <Waves className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-cyan-400 block mb-1">Tactical Momentum</strong>
                Mispriced equities showing technical breakouts and positive sentiment shifts.
                Scores heavily weight Market Momentum (40%) and Valuation (30%).
              </div>
            </div>
            <CompanyTable data={waveData?.scores || []} isLoading={wLoading} defaultSortBy="waveScore" emptyMessage={emptyMsg("wave")} />
          </TabsContent>
        </Tabs>

        <TopMovers onTickerClick={handleTickerClick} />

        {/* ── Score Alerts Panel ── */}
        {alerts.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 text-muted-foreground">
              <Bell className="w-4 h-4" />
              Recent Score Alerts (7 days)
            </h3>
            <div className="space-y-2">
              {alerts.slice(0, 8).map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm cursor-pointer hover:bg-secondary/30 transition-colors ${
                    alert.alertType === "SCORE_DROP"
                      ? "border-red-500/20 bg-red-500/5"
                      : alert.alertType === "SCORE_RISE"
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : alert.alertType === "COMPOUNDER_CHANGE"
                      ? "border-amber-500/20 bg-amber-500/5"
                      : "border-blue-500/20 bg-blue-500/5"
                  }`}
                  onClick={() => handleTickerClick(alert.ticker)}
                >
                  <span className="text-base">{ALERT_ICON[alert.alertType] ?? "⚡"}</span>
                  <span className="font-mono font-bold text-xs text-foreground w-14 shrink-0">{alert.ticker}</span>
                  <span className="text-muted-foreground flex-1">{alert.message}</span>
                  <span className="text-[11px] font-mono text-muted-foreground/60 shrink-0">{alert.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <CompanyDrawer
        ticker={selectedTicker}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </Layout>
  );
}
