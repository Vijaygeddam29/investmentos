import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { CompanyDrawer } from "@/components/company/CompanyDrawer";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import {
  Wand2, Loader2, Info, Shield, Rocket, Waves,
  TrendingUp, Globe, ChevronDown, ChevronRight, AlertCircle,
  Zap, AlertTriangle, Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Strategy     = "fortress" | "rocket" | "wave";
type WeightMethod = "equal" | "score" | "risk" | "power";
type MarketCapTier = "all" | "large" | "mid" | "small";

interface BuilderHolding {
  rank:           number;
  ticker:         string;
  name:           string;
  sector:         string;
  country:        string;
  weight:         number;
  compositeScore: number;
  fortressScore:  number | null;
  rocketScore:    number | null;
  waveScore:      number | null;
  entryScore:     number | null;
  marketCap:      number | null;
  volatility:     number | null;
  highValuation:  boolean;
  innovationTier: string | null;
  rationale:      string;
}

interface BuilderResponse {
  holdings:       BuilderHolding[];
  portfolioScore: { fortress: number; rocket: number; wave: number } | null;
  snapshotDate:   string | null;
  universeSize:   number;
  regime:         { name: string; confidence: string } | null;
  params:         Record<string, unknown>;
}

interface CountryOption {
  name: string;
  slug: string;
  count: number;
}

const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", India: "🇮🇳",
  Germany: "🇩🇪", France: "🇫🇷", Italy: "🇮🇹", Japan: "🇯🇵",
  China: "🇨🇳", Taiwan: "🇹🇼", Netherlands: "🇳🇱", Canada: "🇨🇦",
  Australia: "🇦🇺", Brazil: "🇧🇷", Denmark: "🇩🇰", "Hong Kong": "🇭🇰",
  Ireland: "🇮🇪", Israel: "🇮🇱", Singapore: "🇸🇬", Switzerland: "🇨🇭",
  Uruguay: "🇺🇾",
};

function formatMktCap(v?: number | null) {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}T`;
  if (v >= 1)    return `${v.toFixed(1)}B`;
  return `${(v * 1000).toFixed(0)}M`;
}

function ScoreMini({ value, color }: { value: number | null; color: string }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-1.5 min-w-[64px]">
      <div className="h-1.5 w-14 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-muted-foreground">{pct}</span>
    </div>
  );
}

function CountryFlag({ country }: { country: string }) {
  return <span className="text-sm">{COUNTRY_FLAGS[country] ?? "🌐"}</span>;
}

function SummaryCard({
  label, score, icon: Icon, color
}: { label: string; score: number | undefined; icon: React.ElementType; color: string }) {
  const val = score ?? 0;
  const tier = val >= 70 ? "top-tier" : val >= 50 ? "solid" : "developing";
  const tierColor = val >= 70 ? "text-emerald-400" : val >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold font-mono ${tierColor}`}>{val}</span>
        <span className="text-xs text-muted-foreground mb-1">/100</span>
      </div>
      <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color.replace("text-", "bg-").replace("400", "500")}`} style={{ width: `${val}%` }} />
      </div>
      <span className={`text-xs font-medium ${tierColor}`}>{tier}</span>
    </div>
  );
}

export default function PortfolioBuilder() {
  const [strategy, setStrategy]         = useState<Strategy>("rocket");
  const [size, setSize]                 = useState(10);
  const [weightMethod, setWeightMethod] = useState<WeightMethod>("score");
  const [sectorCap, setSectorCap]       = useState(2);
  const [country, setCountry]           = useState("all");
  const [marketCap, setMarketCap]       = useState<MarketCapTier>("all");
  const [hasBuilt, setHasBuilt]         = useState(false);
  const [buildParams, setBuildParams]   = useState<Record<string, unknown> | null>(null);

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const { data: countriesData } = useQuery<{ countries: CountryOption[] }>({
    queryKey: ["portfolio-builder-countries"],
    queryFn: () => customFetch("/api/portfolio/builder/countries"),
    staleTime: 30 * 60 * 1000,
  });

  const { data, isLoading, error } = useQuery<BuilderResponse>({
    queryKey: ["portfolio-builder", buildParams],
    queryFn: () => {
      if (!buildParams) return Promise.resolve({ holdings: [], portfolioScore: null, snapshotDate: null, universeSize: 0, regime: null, params: {} });
      const q = new URLSearchParams({
        strategy:     buildParams.strategy as string,
        size:         String(buildParams.size),
        weightMethod: buildParams.weightMethod as string,
        sectorCap:    String(buildParams.sectorCap),
        country:      buildParams.country as string,
        marketCap:    buildParams.marketCap as string,
      });
      return customFetch(`/api/portfolio/builder?${q}`);
    },
    enabled: hasBuilt && !!buildParams,
    staleTime: 5 * 60 * 1000,
  });

  function handleBuild() {
    setBuildParams({ strategy, size, weightMethod, sectorCap, country, marketCap });
    setHasBuilt(true);
  }

  const holdings = data?.holdings ?? [];
  const score    = data?.portfolioScore;
  const regimeInfo = data?.regime;
  const isPowerLaw = (buildParams?.weightMethod as string) === "power";

  const sectorCounts: Record<string, number> = {};
  for (const h of holdings) {
    sectorCounts[h.sector] = (sectorCounts[h.sector] ?? 0) + 1;
  }

  const countryOptions = countriesData?.countries ?? [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wand2 className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-display font-bold">Portfolio Builder</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Construct an optimal portfolio from our universe using your chosen strategy engine and weighting method.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {regimeInfo && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                regimeInfo.name === "BULL" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                regimeInfo.name === "BEAR" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                regimeInfo.name === "RECOVERY" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                "bg-muted/30 border-border text-muted-foreground"
              }`}>
                <Zap className="w-3.5 h-3.5" />
                <span className="text-xs font-mono font-semibold">{regimeInfo.name}</span>
              </div>
            )}
            {data?.snapshotDate && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 rounded-lg border border-border">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">Snapshot: {data.snapshotDate}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Strategy Engine</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { id: "fortress", label: "Fortress", icon: Shield,  color: "text-blue-400" },
                    { id: "rocket",   label: "Rocket",   icon: Rocket,  color: "text-orange-400" },
                    { id: "wave",     label: "Wave",     icon: Waves,   color: "text-cyan-400" },
                  ] as const).map(({ id, label, icon: Icon, color }) => (
                    <button
                      key={id}
                      onClick={() => setStrategy(id)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs font-medium transition-all ${
                        strategy === id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-muted-foreground/50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${strategy === id ? color : "text-muted-foreground"}`} />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {strategy === "fortress" && "Quality compounders: moat, earnings stability, low debt."}
                  {strategy === "rocket"   && "High-growth: revenue momentum, margin expansion, TAM."}
                  {strategy === "wave"     && "Momentum: price trend, relative strength, flow signals."}
                </p>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
                  Portfolio Size — <span className="text-foreground font-semibold">{size} stocks</span>
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[5, 10, 15, 20, 25].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSize(n)}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium border transition-all ${
                        size === n
                          ? "bg-primary text-white border-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Weighting Method</label>
                <div className="space-y-1.5">
                  {([
                    { id: "equal", label: "Equal weight",          desc: "Each stock gets the same allocation." },
                    { id: "score", label: "Score-proportional",    desc: "Higher scorers get a larger slice." },
                    { id: "risk",  label: "Risk-adjusted",         desc: "Score ÷ volatility — reward per unit risk." },
                    { id: "power", label: "Power Law (α=1.8)",     desc: "Regime-composite, sector-normalised, valuation-checked. Concentrates in highest-conviction names." },
                  ] as const).map(({ id, label, desc }) => (
                    <button
                      key={id}
                      onClick={() => setWeightMethod(id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${
                        weightMethod === id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <div className={`font-medium ${weightMethod === id ? "text-foreground" : "text-muted-foreground"}`}>{label}</div>
                      <div className="text-muted-foreground/70 mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
                  Max Stocks per Sector — <span className="text-foreground font-semibold">{sectorCap}</span>
                </label>
                <input
                  type="range" min={1} max={5} step={1}
                  value={sectorCap}
                  onChange={(e) => setSectorCap(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground font-mono mt-0.5">
                  <span>1 (max diversification)</span>
                  <span>5 (less)</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Country</label>
                <div className="relative">
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full appearance-none bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm pr-8 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">🌐 All Countries</option>
                    {countryOptions.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {COUNTRY_FLAGS[c.name] ?? "🌐"} {c.name} ({c.count})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Market Cap</label>
                <div className="relative">
                  <select
                    value={marketCap}
                    onChange={(e) => setMarketCap(e.target.value as MarketCapTier)}
                    className="w-full appearance-none bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm pr-8 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All ($500M+)</option>
                    <option value="large">Large Cap ($10B+)</option>
                    <option value="mid">Mid Cap ($2B–$10B)</option>
                    <option value="small">Small Cap ($500M–$2B)</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <button
                onClick={handleBuild}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Building…</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Build Portfolio</>
                )}
              </button>
            </div>

            {holdings.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Sector Distribution</h3>
                <div className="space-y-1.5">
                  {Object.entries(sectorCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([sec, count]) => (
                      <div key={sec} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground truncate flex-1">{sec}</span>
                        <div className="flex items-center gap-2 ml-2">
                          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden" style={{ width: `${count * 16}px` }}>
                            <div className="h-full bg-primary/60 rounded-full" style={{ width: "100%" }} />
                          </div>
                          <span className="text-xs font-mono text-foreground w-3">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {isPowerLaw && holdings.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setMethodologyOpen(!methodologyOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Power Law Methodology</h3>
                  {methodologyOpen
                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  }
                </button>
                {methodologyOpen && (
                  <div className="px-4 pb-4 space-y-2 text-xs text-muted-foreground border-t border-border pt-3">
                    <p>Selection uses <strong className="text-foreground">regime-weighted composite</strong> scores ({regimeInfo?.name ?? "NEUTRAL"} regime) rather than single-strategy rank.</p>
                    <p>Weights are <strong className="text-foreground">sector-percentile normalised</strong> (score vs. sector peers) then raised to exponent <strong className="text-foreground">α=1.8</strong>.</p>
                    <p>Companies with PE &gt; 1.5× sector median receive a <strong className="text-foreground">30% weight haircut</strong>.</p>
                    <p>Tickers in secular breakout themes (AI, GLP-1, next-gen platforms) receive a <strong className="text-foreground">15% premium</strong>.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">

            {!hasBuilt && (
              <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Wand2 className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-semibold text-foreground">Configure & Build</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Select a strategy, set your constraints, and hit <em>Build Portfolio</em> to generate hedge-fund-grade stock picks.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-red-400">Could not build portfolio</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Run the pipeline first to generate factor snapshots, then try again.
                  </div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="bg-card border border-border rounded-xl p-6 space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex gap-4 items-center animate-pulse">
                    <div className="w-6 h-3 bg-muted/40 rounded" />
                    <div className="w-16 h-3 bg-muted/40 rounded" />
                    <div className="flex-1 h-3 bg-muted/30 rounded" />
                    <div className="w-20 h-3 bg-muted/40 rounded" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && hasBuilt && score && (
              <div className="grid grid-cols-3 gap-3">
                <SummaryCard label="Fortress Score" score={score.fortress} icon={Shield} color="text-blue-400" />
                <SummaryCard label="Rocket Score"   score={score.rocket}   icon={Rocket} color="text-orange-400" />
                <SummaryCard label="Wave Score"     score={score.wave}     icon={Waves}  color="text-cyan-400" />
              </div>
            )}

            {!isLoading && hasBuilt && data && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Universe: <strong className="text-foreground">{data.universeSize}</strong> eligible stocks</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Selected: <strong className="text-foreground">{holdings.length}</strong></span>
                </div>
              </div>
            )}

            {!isLoading && holdings.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3 w-8">#</th>
                        <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Ticker</th>
                        <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Company</th>
                        <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Sector</th>
                        <th className="text-right text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Score</th>
                        <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Fortress</th>
                        <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Rocket</th>
                        <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Wave</th>
                        <th className="text-right text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Mkt Cap</th>
                        <th className="text-right text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h, i) => {
                        const composite = Math.round(h.compositeScore * 100);
                        const compColor =
                          composite >= 70 ? "text-emerald-400" :
                          composite >= 50 ? "text-amber-400" :
                                           "text-red-400";
                        return (
                          <tr
                            key={h.ticker}
                            className={`border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors ${
                              i % 2 === 0 ? "" : "bg-muted/5"
                            }`}
                            onClick={() => { setSelectedTicker(h.ticker); setDrawerOpen(true); }}
                          >
                            <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{h.rank}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <CountryFlag country={h.country} />
                                <span className="font-mono font-semibold text-foreground text-sm">{h.ticker}</span>
                                {h.innovationTier && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 text-[10px] font-semibold">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    {h.innovationTier}
                                  </span>
                                )}
                                {h.highValuation && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-semibold">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    High PE
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <span className="text-xs text-muted-foreground line-clamp-1 max-w-[180px]">{h.name}</span>
                                {h.rationale && (
                                  <div className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">{h.rationale}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-xs font-normal">{h.sector}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-mono font-bold text-sm ${compColor}`}>{composite}</span>
                            </td>
                            <td className="px-4 py-3">
                              <ScoreMini value={h.fortressScore} color="bg-blue-500" />
                            </td>
                            <td className="px-4 py-3">
                              <ScoreMini value={h.rocketScore} color="bg-orange-500" />
                            </td>
                            <td className="px-4 py-3">
                              <ScoreMini value={h.waveScore} color="bg-cyan-500" />
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-mono text-muted-foreground">
                              {formatMktCap(h.marketCap)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {(h.weight * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!isLoading && hasBuilt && holdings.length === 0 && !error && (
              <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="text-sm font-semibold text-foreground">No stocks match</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try relaxing the country, market cap, or sector cap constraints.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <CompanyDrawer
        ticker={selectedTicker ?? ""}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </Layout>
  );
}
