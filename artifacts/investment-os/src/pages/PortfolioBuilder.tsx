import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { CompanyDrawer } from "@/components/company/CompanyDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import {
  Wand2, Loader2, Info, Shield, Rocket, Waves,
  TrendingUp, Globe, ChevronDown, ChevronRight, AlertCircle,
  Zap, AlertTriangle, Sparkles, Crown, Star, Eye, Target,
  Plus, Search, X, Trash2, Lock, Unlock, Brain, Layers
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Strategy     = "fortress" | "rocket" | "wave";
type WeightMethod = "equal" | "score" | "risk" | "power";
type MarketCapTier = "all" | "large" | "mid" | "small";

interface BuilderHolding {
  rank:           number;
  ticker:         string;
  name:           string;
  sector:                string;
  country:               string;
  weight:                number;
  compositeScore:        number;
  fortressScore:         number | null;
  rocketScore:           number | null;
  waveScore:             number | null;
  entryScore:            number | null;
  marketCap:             number | null;
  volatility:            number | null;
  highValuation:         boolean;
  innovationTier:        string | null;
  rationale:             string;
  portfolioNetScore:     number | null;
  expectationScore:      number | null;
  mispricingScore:       number | null;
  fragilityScore:        number | null;
  companyQualityScore:   number | null;
  stockOpportunityScore: number | null;
  positionBand:          { band: string; label: string; minPct: number; maxPct: number } | null;
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

interface SearchResult {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  marketCap: number | null;
  fortressScore: number | null;
  rocketScore: number | null;
  waveScore: number | null;
  portfolioNetScore: number | null;
  companyQualityScore: number | null;
  stockOpportunityScore: number | null;
  expectationScore: number | null;
  mispricingScore: number | null;
  fragilityScore: number | null;
}

interface ManualHolding extends BuilderHolding {
  isManual: boolean;
}

const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", India: "🇮🇳",
  Germany: "🇩🇪", France: "🇫🇷", Italy: "🇮🇹", Japan: "🇯🇵",
  China: "🇨🇳", Taiwan: "🇹🇼", Netherlands: "🇳🇱", Canada: "🇨🇦",
  Australia: "🇦🇺", Brazil: "🇧🇷", Denmark: "🇩🇰", "Hong Kong": "🇭🇰",
  Ireland: "🇮🇪", Israel: "🇮🇱", Singapore: "🇸🇬", Switzerland: "🇨🇭",
  Uruguay: "🇺🇾",
};

type LayerKey = "companyQualityScore" | "stockOpportunityScore" | "expectationScore" | "mispricingScore" | "fragilityScore" | "portfolioNetScore";

const LAYER_DEFS: readonly { key: LayerKey; label: string; short: string; color: string; textColor: string }[] = [
  { key: "companyQualityScore",   label: "Quality",     short: "Q",  color: "bg-violet-500",  textColor: "text-violet-400" },
  { key: "stockOpportunityScore", label: "Opportunity",  short: "O",  color: "bg-blue-500",    textColor: "text-blue-400" },
  { key: "expectationScore",      label: "Expectation",  short: "E",  color: "bg-cyan-500",    textColor: "text-cyan-400" },
  { key: "mispricingScore",       label: "Mispricing",   short: "M",  color: "bg-amber-500",   textColor: "text-amber-400" },
  { key: "fragilityScore",        label: "Fragility",    short: "F",  color: "bg-red-500",     textColor: "text-red-400" },
  { key: "portfolioNetScore",     label: "Net Score",    short: "N",  color: "bg-emerald-500", textColor: "text-emerald-400" },
];

function derivePositionBand(netScore: number | null): BuilderHolding["positionBand"] {
  if (netScore == null) return null;
  if (netScore >= 0.75) return { band: "core",      label: "Core",      minPct: 6,   maxPct: 10  };
  if (netScore >= 0.60) return { band: "standard",  label: "Standard",  minPct: 3,   maxPct: 5   };
  if (netScore >= 0.45) return { band: "starter",   label: "Starter",   minPct: 1,   maxPct: 2.5 };
  if (netScore >= 0.30) return { band: "tactical",  label: "Tactical",  minPct: 0.5, maxPct: 1   };
  return                       { band: "watchlist", label: "Watchlist", minPct: 0,   maxPct: 0   };
}

function normalizeWeightsTo100(weights: Record<string, number>, locked: Set<string>): Record<string, number> {
  const result = { ...weights };
  const total = Object.values(result).reduce((s, w) => s + w, 0);
  if (Math.abs(total - 100) < 0.05) return result;

  const allTickers = Object.keys(result);
  const unlockedTickers = allTickers.filter((t) => !locked.has(t));

  if (unlockedTickers.length === 0) {
    if (total <= 0 || allTickers.length === 0) return result;
    const scale = 100 / total;
    for (const t of allTickers) result[t] = parseFloat(((result[t] ?? 0) * scale).toFixed(1));
    const finalTotal = Object.values(result).reduce((s, w) => s + w, 0);
    const residual = parseFloat((100 - finalTotal).toFixed(1));
    if (Math.abs(residual) >= 0.05) {
      result[allTickers[0]] = parseFloat(((result[allTickers[0]] ?? 0) + residual).toFixed(1));
    }
    return result;
  }

  const lockedTotal = Object.entries(result)
    .filter(([t]) => locked.has(t))
    .reduce((s, [, w]) => s + w, 0);
  const unlockedTotal = unlockedTickers.reduce((s, t) => s + (result[t] ?? 0), 0);
  const target = 100 - lockedTotal;

  if (unlockedTotal <= 0) {
    const each = parseFloat((target / unlockedTickers.length).toFixed(1));
    for (const t of unlockedTickers) result[t] = each;
  } else {
    const scale = target / unlockedTotal;
    for (const t of unlockedTickers) {
      result[t] = parseFloat(((result[t] ?? 0) * scale).toFixed(1));
    }
  }

  const finalTotal = Object.values(result).reduce((s, w) => s + w, 0);
  const residual = parseFloat((100 - finalTotal).toFixed(1));
  if (Math.abs(residual) >= 0.05) {
    result[unlockedTickers[0]] = parseFloat(((result[unlockedTickers[0]] ?? 0) + residual).toFixed(1));
  }

  return result;
}

function formatMktCap(v?: number | null) {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}T`;
  if (v >= 1)    return `${v.toFixed(1)}B`;
  return `${(v * 1000).toFixed(0)}M`;
}

function LayerBar({ value, color }: { value: number | null; color: string }) {
  if (value == null) return <span className="text-muted-foreground text-[10px]">—</span>;
  const pct = Math.round(value * 100);
  const barColor =
    pct >= 70 ? "bg-emerald-500" :
    pct >= 50 ? "bg-amber-500" :
    "bg-red-500";
  return (
    <div className="flex items-center gap-1 min-w-[48px]">
      <div className="h-1 w-8 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground w-5 text-right">{pct}</span>
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
    <div className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className={`text-2xl font-bold font-mono ${tierColor}`}>{val}</span>
        <span className="text-[10px] text-muted-foreground mb-0.5">/100</span>
      </div>
      <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color.replace("text-", "bg-").replace("400", "500")}`} style={{ width: `${val}%` }} />
      </div>
    </div>
  );
}

function IntelligenceSummaryCard({ holdings, weights }: { holdings: ManualHolding[]; weights: Record<string, number> }) {
  if (!holdings.length) return null;

  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0) || 1;

  const layerAvgs = LAYER_DEFS.map((layer) => {
    let weightedSum = 0;
    let totalW = 0;
    for (const h of holdings) {
      const val: number | null = h[layer.key];
      const w = weights[h.ticker] ?? 0;
      if (val != null && w > 0) {
        weightedSum += val * w;
        totalW += w;
      }
    }
    return {
      ...layer,
      avg: totalW > 0 ? Math.round((weightedSum / totalW) * 100) : null,
    };
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-violet-400" />
        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Portfolio Intelligence Summary</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">weighted avg across {holdings.length} holdings</span>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {layerAvgs.map((l) => (
          <div key={l.key} className="text-center">
            <div className="text-[10px] text-muted-foreground mb-1">{l.label}</div>
            <div className={`text-lg font-bold font-mono ${
              l.avg == null ? "text-muted-foreground" :
              l.avg >= 70 ? "text-emerald-400" :
              l.avg >= 50 ? "text-amber-400" : "text-red-400"
            }`}>
              {l.avg ?? "—"}
            </div>
            {l.avg != null && (
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden mt-1">
                <div className={`h-full rounded-full ${l.color}`} style={{ width: `${l.avg}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddStockPanel({
  onAdd,
  existingTickers,
}: {
  onAdd: (result: SearchResult) => void;
  existingTickers: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchData, isLoading: searching } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["portfolio-search", query],
    queryFn: () => customFetch(`/api/portfolio/builder/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 1,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const results = (searchData?.results ?? []).filter((r) => !existingTickers.has(r.ticker));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-primary/40 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Stock
      </button>
      {open && (
        <div className="absolute top-10 right-0 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by ticker or name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button onClick={() => { setOpen(false); setQuery(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {searching && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />Searching...
              </div>
            )}
            {!searching && query.length >= 1 && results.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">No results found</div>
            )}
            {results.map((r) => {
              const net = r.portfolioNetScore != null ? Math.round(r.portfolioNetScore * 100) : null;
              return (
                <button
                  key={r.ticker}
                  onClick={() => { onAdd(r); setQuery(""); setOpen(false); }}
                  className="w-full px-3 py-2.5 text-left hover:bg-muted/20 transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CountryFlag country={r.country} />
                      <span className="font-mono font-semibold text-sm text-foreground">{r.ticker}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {net != null && (
                        <span className={`font-mono text-xs font-bold ${
                          net >= 70 ? "text-emerald-400" : net >= 50 ? "text-amber-400" : "text-red-400"
                        }`}>
                          Net {net}
                        </span>
                      )}
                      <Plus className="w-3 h-3 text-primary" />
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {r.sector} · {formatMktCap(r.marketCap)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortfolioBuilder() {
  const { market } = useAuth();

  const [strategy, setStrategy]         = useState<Strategy>("rocket");
  const [size, setSize]                 = useState(10);
  const [weightMethod, setWeightMethod] = useState<WeightMethod>("score");
  const [sectorCap, setSectorCap]       = useState(2);
  const [country, setCountry]           = useState(market !== "All" ? market : "all");
  const [marketCap, setMarketCap]       = useState<MarketCapTier>("all");
  const [hasBuilt, setHasBuilt]         = useState(false);
  const [buildParams, setBuildParams]   = useState<Record<string, unknown> | null>(null);

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const [manualWeights, setManualWeights] = useState<Record<string, number>>({});
  const [lockedWeights, setLockedWeights] = useState<Set<string>>(new Set());
  const [manualMode, setManualMode]       = useState(false);
  const [manualHoldings, setManualHoldings] = useState<ManualHolding[]>([]);

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

  useEffect(() => {
    if (data?.holdings?.length && !manualMode) {
      const apiHoldings: ManualHolding[] = data.holdings.map((h) => ({ ...h, isManual: false }));
      setManualHoldings(apiHoldings);
      const wMap: Record<string, number> = {};
      for (const h of data.holdings) {
        wMap[h.ticker] = parseFloat((h.weight * 100).toFixed(1));
      }
      setManualWeights(wMap);
      setLockedWeights(new Set());
    }
  }, [data?.holdings]);

  function handleBuild() {
    setManualMode(false);
    setBuildParams({ strategy, size, weightMethod, sectorCap, country, marketCap });
    setHasBuilt(true);
  }

  const handleWeightChange = useCallback((ticker: string, newVal: string) => {
    const parsed = parseFloat(newVal);
    if (isNaN(parsed) || parsed < 0) return;

    setManualMode(true);
    setManualWeights((prev) => {
      const oldVal = prev[ticker] ?? 0;
      const delta = parsed - oldVal;
      const next = { ...prev, [ticker]: parsed };

      const otherTickers = Object.keys(next).filter((t) => t !== ticker && !lockedWeights.has(t));
      if (otherTickers.length > 0 && Math.abs(delta) > 0.01) {
        const otherTotal = otherTickers.reduce((s, t) => s + (next[t] ?? 0), 0);
        if (otherTotal > 0) {
          for (const t of otherTickers) {
            const share = (next[t] ?? 0) / otherTotal;
            next[t] = Math.max(0, parseFloat(((next[t] ?? 0) - delta * share).toFixed(1)));
          }
        }
      }
      return normalizeWeightsTo100(next, lockedWeights);
    });
  }, [lockedWeights]);

  const redistributeWeights = useCallback(() => {
    setManualWeights((prev) => {
      const next = { ...prev };
      const lockedTotal = Array.from(lockedWeights).reduce((s, t) => s + (next[t] ?? 0), 0);
      const unlockedTickers = Object.keys(next).filter((t) => !lockedWeights.has(t));
      const remaining = Math.max(0, 100 - lockedTotal);

      if (unlockedTickers.length === 0) return next;
      const each = parseFloat((remaining / unlockedTickers.length).toFixed(1));
      for (const t of unlockedTickers) {
        next[t] = each;
      }
      return next;
    });
  }, [lockedWeights]);

  const resetToAiWeights = useCallback(() => {
    if (data?.holdings?.length) {
      const wMap: Record<string, number> = {};
      for (const h of data.holdings) {
        wMap[h.ticker] = parseFloat((h.weight * 100).toFixed(1));
      }
      const apiHoldings: ManualHolding[] = data.holdings.map((h) => ({ ...h, isManual: false }));
      setManualHoldings(apiHoldings);
      setManualWeights(wMap);
      setLockedWeights(new Set());
      setManualMode(false);
    }
  }, [data?.holdings]);

  const toggleLock = useCallback((ticker: string) => {
    setLockedWeights((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }, []);

  const removeHolding = useCallback((ticker: string) => {
    setManualMode(true);
    setManualHoldings((prev) => prev.filter((h) => h.ticker !== ticker));
    setManualWeights((prev) => {
      const freedWeight = prev[ticker] ?? 0;
      const next = { ...prev };
      delete next[ticker];

      const remaining = Object.keys(next).filter((t) => !lockedWeights.has(t));
      if (remaining.length > 0 && freedWeight > 0) {
        const remainingTotal = remaining.reduce((s, t) => s + (next[t] ?? 0), 0);
        for (const t of remaining) {
          const share = remainingTotal > 0 ? (next[t] ?? 0) / remainingTotal : 1 / remaining.length;
          next[t] = parseFloat(((next[t] ?? 0) + freedWeight * share).toFixed(1));
        }
      }
      return normalizeWeightsTo100(next, lockedWeights);
    });
    setLockedWeights((prev) => {
      const next = new Set(prev);
      next.delete(ticker);
      return next;
    });
  }, [lockedWeights]);

  const handleAddStock = useCallback((result: SearchResult) => {
    setManualMode(true);
    const newHolding: ManualHolding = {
      rank: manualHoldings.length + 1,
      ticker: result.ticker,
      name: result.name,
      sector: result.sector,
      country: result.country,
      weight: 0,
      compositeScore: result.portfolioNetScore ?? 0,
      fortressScore: result.fortressScore,
      rocketScore: result.rocketScore,
      waveScore: result.waveScore,
      entryScore: null,
      marketCap: result.marketCap,
      volatility: null,
      highValuation: false,
      innovationTier: null,
      rationale: "Manually added",
      portfolioNetScore: result.portfolioNetScore,
      expectationScore: result.expectationScore,
      mispricingScore: result.mispricingScore,
      fragilityScore: result.fragilityScore,
      companyQualityScore: result.companyQualityScore,
      stockOpportunityScore: result.stockOpportunityScore,
      positionBand: derivePositionBand(result.portfolioNetScore),
      isManual: true,
    };
    const defaultWeight = 2;
    setManualHoldings((prev) => [...prev, newHolding]);
    setManualWeights((prev) => {
      const next = { ...prev, [result.ticker]: defaultWeight };
      const otherTickers = Object.keys(prev).filter((t) => !lockedWeights.has(t));
      const otherTotal = otherTickers.reduce((s, t) => s + (prev[t] ?? 0), 0);
      if (otherTickers.length > 0 && otherTotal > 0) {
        for (const t of otherTickers) {
          const share = (prev[t] ?? 0) / otherTotal;
          next[t] = Math.max(0, parseFloat(((prev[t] ?? 0) - defaultWeight * share).toFixed(1)));
        }
      }
      return normalizeWeightsTo100(next, lockedWeights);
    });
  }, [manualHoldings, lockedWeights]);

  const holdings = manualHoldings;
  const score    = data?.portfolioScore;
  const regimeInfo = data?.regime;
  const isPowerLaw = (buildParams?.weightMethod as string) === "power";

  const totalWeight = useMemo(() =>
    Object.values(manualWeights).reduce((s, w) => s + w, 0),
    [manualWeights]
  );

  const weightDelta = useMemo(() => parseFloat((100 - totalWeight).toFixed(1)), [totalWeight]);

  const sectorCounts: Record<string, number> = {};
  for (const h of holdings) {
    sectorCounts[h.sector] = (sectorCounts[h.sector] ?? 0) + 1;
  }

  const existingTickers = useMemo(() => new Set(holdings.map((h) => h.ticker)), [holdings]);

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
                    { id: "power", label: "Power Law (α=1.8)",     desc: "Regime-composite, sector-normalised, valuation-checked." },
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

            {!isLoading && hasBuilt && holdings.length > 0 && (
              <IntelligenceSummaryCard holdings={holdings} weights={manualWeights} />
            )}

            {!isLoading && hasBuilt && data && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Universe: <strong className="text-foreground">{data.universeSize}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Selected: <strong className="text-foreground">{holdings.length}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span className={`font-mono font-semibold ${
                      Math.abs(weightDelta) < 0.2 ? "text-emerald-400" : "text-amber-400"
                    }`}>
                      {totalWeight.toFixed(1)}% allocated
                    </span>
                    {Math.abs(weightDelta) >= 0.2 && (
                      <span className="text-amber-400 text-[10px]">({weightDelta > 0 ? "+" : ""}{weightDelta.toFixed(1)}% to go)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {manualMode && (
                    <>
                      <button
                        onClick={resetToAiWeights}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Wand2 className="w-3 h-3" />
                        Rebalance
                      </button>
                      <button
                        onClick={redistributeWeights}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
                      >
                        <Target className="w-3 h-3" />
                        Even out unlocked
                      </button>
                    </>
                  )}
                  <AddStockPanel onAdd={handleAddStock} existingTickers={existingTickers} />
                </div>
              </div>
            )}

            {!isLoading && holdings.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-6">#</th>
                        <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5">Ticker</th>
                        <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5">Company</th>
                        <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5">Sector</th>
                        {LAYER_DEFS.map((l) => (
                          <th key={l.key} className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-1 py-2.5" title={l.label}>
                            <span className={l.textColor}>{l.short}</span>
                          </th>
                        ))}
                        <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5">Band</th>
                        <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5">Mkt Cap</th>
                        <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-2 py-2.5 min-w-[90px]">
                          Weight %
                        </th>
                        <th className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-1 py-2.5 w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows: React.ReactNode[] = [];
                        let lastCountry: string | null = null;

                        holdings.forEach((h, i) => {
                          const countryName = h.country || "Unknown";
                          const countryFlag = COUNTRY_FLAGS[countryName] ?? "🌐";

                          if (countryName !== lastCountry) {
                            const countryHoldings = holdings.filter(x => (x.country || "Unknown") === countryName);
                            const totalW = countryHoldings.reduce((s, x) => s + (manualWeights[x.ticker] ?? 0), 0);
                            rows.push(
                              <tr key={`sep-${countryName}`} className="bg-muted/15 border-y border-border/40">
                                <td colSpan={14} className="px-3 py-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base leading-none">{countryFlag}</span>
                                    <span className="text-[11px] font-semibold text-foreground">{countryName}</span>
                                    <span className="text-[10px] text-muted-foreground">{countryHoldings.length} stocks</span>
                                    <span className="text-[10px] text-muted-foreground ml-1">
                                      total <strong className="text-foreground font-mono">{totalW.toFixed(1)}%</strong>
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                            lastCountry = countryName;
                          }

                          const netPct = h.portfolioNetScore != null ? Math.round(h.portfolioNetScore * 100) : null;
                          const pb = h.positionBand;
                          const bandColor =
                            pb?.band === "core"      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                            pb?.band === "standard"  ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
                            pb?.band === "starter"   ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                            pb?.band === "tactical"  ? "bg-orange-500/15 text-orange-400 border-orange-500/20" :
                            pb?.band === "watchlist" ? "bg-secondary text-muted-foreground border-border/40" :
                                                        "bg-secondary text-muted-foreground border-border/40";
                          const curWeight = manualWeights[h.ticker] ?? 0;
                          const isLocked = lockedWeights.has(h.ticker);

                          const bandBorderColor =
                            pb?.band === "core"      ? "border-l-emerald-500/60" :
                            pb?.band === "standard"  ? "border-l-blue-500/60" :
                            pb?.band === "starter"   ? "border-l-amber-500/60" :
                            pb?.band === "tactical"  ? "border-l-orange-500/60" :
                            pb?.band === "watchlist" ? "border-l-red-500/60" :
                            h.isManual               ? "border-l-primary/40" :
                                                       "border-l-transparent";

                          rows.push(
                            <tr
                              key={h.ticker}
                              className={`border-b border-border/50 hover:bg-muted/20 transition-colors border-l-2 ${bandBorderColor} ${
                                i % 2 === 0 ? "" : "bg-muted/5"
                              }`}
                            >
                              <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">{i + 1}</td>
                              <td
                                className="px-3 py-2.5 cursor-pointer"
                                onClick={() => { setSelectedTicker(h.ticker); setDrawerOpen(true); }}
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <CountryFlag country={h.country} />
                                  <span className="font-mono font-semibold text-foreground text-sm hover:text-primary transition-colors">{h.ticker}</span>
                                  {h.innovationTier && (
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-violet-500/15 text-violet-400 text-[9px] font-semibold">
                                      <Sparkles className="w-2 h-2" />
                                      {h.innovationTier}
                                    </span>
                                  )}
                                  {h.highValuation && (
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-semibold">
                                      <AlertTriangle className="w-2 h-2" />
                                      Rich
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="text-xs text-muted-foreground line-clamp-1 max-w-[120px]">{h.name}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">{h.sector}</Badge>
                              </td>
                              {LAYER_DEFS.map((l) => (
                                <td key={l.key} className="px-1 py-2.5">
                                  <LayerBar value={h[l.key]} color={l.color} />
                                </td>
                              ))}
                              <td className="px-3 py-2.5">
                                {pb ? (
                                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${bandColor}`}>
                                    <Star className="w-2 h-2" />
                                    {pb.label}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right text-[10px] font-mono text-muted-foreground">
                                {formatMktCap(h.marketCap)}
                              </td>
                              <td className="px-2 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleLock(h.ticker); }}
                                    className={`p-0.5 rounded transition-colors ${isLocked ? "text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                                    title={isLocked ? "Unlock weight" : "Lock weight"}
                                  >
                                    {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={curWeight}
                                    onChange={(e) => handleWeightChange(h.ticker, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`w-14 text-right bg-muted/30 border rounded px-1.5 py-0.5 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-primary ${
                                      isLocked ? "border-amber-500/30 text-amber-400" : "border-border text-foreground"
                                    }`}
                                  />
                                  <span className="text-[10px] text-muted-foreground">%</span>
                                </div>
                              </td>
                              <td className="px-1 py-2.5 text-center">
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeHolding(h.ticker); }}
                                  className="p-0.5 rounded text-muted-foreground/30 hover:text-red-400 transition-colors"
                                  title="Remove from portfolio"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        });

                        return rows;
                      })()}
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
        onOpenChange={(v) => setDrawerOpen(v)}
      />
    </Layout>
  );
}
