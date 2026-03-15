import { useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useListFactorSnapshots } from "@workspace/api-client-react";
import { Loader2, LayoutGrid, TrendingUp, TrendingDown, Minus, Globe, BarChart2, Filter } from "lucide-react";

const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", "India": "🇮🇳",
  "Germany": "🇩🇪", "France": "🇫🇷", "Japan": "🇯🇵", "China": "🇨🇳",
  "Netherlands": "🇳🇱", "Switzerland": "🇨🇭", "Australia": "🇦🇺",
  "Canada": "🇨🇦", "Brazil": "🇧🇷", "Ireland": "🇮🇪", "Spain": "🇪🇸",
  "Italy": "🇮🇹", "Taiwan": "🇹🇼", "South Korea": "🇰🇷", "Singapore": "🇸🇬",
  "Israel": "🇮🇱", "Denmark": "🇩🇰", "Hong Kong": "🇭🇰", "Uruguay": "🇺🇾",
};

// ─── Sector Macro Context ─────────────────────────────────────────────────────
const SECTOR_MACRO: Record<string, { outlook: string; tailwinds: string[]; headwinds: string[]; bias: "bullish" | "neutral" | "cautious" }> = {
  "Technology": {
    outlook: "AI infrastructure buildout driving exceptional capex by hyperscalers. Software companies with AI integration are repricing upward while legacy players face disruption.",
    tailwinds: ["AI adoption accelerating", "Cloud migration ongoing", "Strong enterprise IT budgets"],
    headwinds: ["Margin pressure for non-AI players", "Valuation multiple compression risk", "Regulatory scrutiny on big tech"],
    bias: "bullish",
  },
  "Healthcare": {
    outlook: "GLP-1 drugs reshaping obesity and cardiometabolic categories. Biosimilar competition intensifying for legacy biologics. Medtech benefiting from robotic surgery adoption.",
    tailwinds: ["GLP-1 market expanding rapidly", "Aging population demographics", "Gene therapy breakthroughs"],
    headwinds: ["Patent cliffs for major biologics", "Drug pricing reform risk", "Clinical trial failure rates"],
    bias: "bullish",
  },
  "Financial Services": {
    outlook: "Net interest margins peaked but remain elevated vs history. Asset managers and exchanges benefiting from market volatility. Credit quality normalising from COVID lows.",
    tailwinds: ["Capital markets activity recovering", "Private credit expansion", "Fintech disruption creating winners"],
    headwinds: ["Rate cuts compressing NIMs", "Commercial real estate credit risk", "Basel III capital requirements"],
    bias: "neutral",
  },
  "Consumer Discretionary": {
    outlook: "Consumer spending bifurcating sharply. Premium brands retaining pricing power while mid-market faces wallet-share competition from value alternatives.",
    tailwinds: ["Luxury demand structurally robust", "E-commerce share gains continuing", "Travel & experiences recovering"],
    headwinds: ["Student loan repayment resuming", "Credit card delinquencies rising", "Housing affordability crimping discretionary budgets"],
    bias: "cautious",
  },
  "Consumer Defensive": {
    outlook: "Volume recovery is the next catalyst after years of price-led growth. Private label competition intensifying as consumers trade down.",
    tailwinds: ["Pricing power normalising gradually", "Emerging market middle class growth", "Portfolio mix shift to premium"],
    headwinds: ["Private label share gains", "Input cost volatility", "Slowing unit volume growth"],
    bias: "neutral",
  },
  "Energy": {
    outlook: "OPEC+ supply discipline has stabilised prices in the $70–90 range. LNG a structural long-term winner given European energy independence drive.",
    tailwinds: ["LNG demand structurally higher", "Energy transition capex creating winners", "Dividends and buybacks improving"],
    headwinds: ["China demand uncertainty", "Renewable energy substitution long-term", "Carbon pricing risk"],
    bias: "neutral",
  },
  "Industrials": {
    outlook: "Re-shoring, defence spending, and infrastructure investment are secular tailwinds. Aerospace and defence backlogs at record levels.",
    tailwinds: ["Defence budgets rising globally", "Infrastructure bill spending ramping", "Re-shoring of semiconductor and pharma manufacturing"],
    headwinds: ["Supply chain normalisation is deflationary", "Labour cost inflation", "China slowdown affecting capital goods demand"],
    bias: "bullish",
  },
  "Communication Services": {
    outlook: "Streaming segment reaching profitability inflection. Digital advertising recovering strongly. AI-generated content both a risk (disruption) and opportunity (monetisation).",
    tailwinds: ["Streaming profitability turning positive", "Digital ad recovery", "AI-driven content recommendation"],
    headwinds: ["Cord-cutting accelerating", "Regulatory pressure on social media", "Content cost inflation"],
    bias: "neutral",
  },
  "Basic Materials": {
    outlook: "China stimulus remains uncertain, keeping commodity prices range-bound. Quality producers with low-cost assets preferred; specialty chemicals recovering.",
    tailwinds: ["Energy transition metals demand (copper, lithium)", "Specialty chemicals recovery", "M&A consolidation"],
    headwinds: ["China property sector weakness", "USD strength pressure on commodity prices", "Overcapacity in certain materials"],
    bias: "cautious",
  },
  "Real Estate": {
    outlook: "Rate sensitivity remains the dominant factor. Data centres and industrial REITs outperforming on structural demand; office and retail remain challenged.",
    tailwinds: ["AI data centre power demand", "Industrial REIT e-commerce tailwind", "Rate cuts improving cap rates"],
    headwinds: ["Office occupancy structurally lower", "Commercial mortgage maturity wall", "Higher interest expense burden"],
    bias: "cautious",
  },
  "Utilities": {
    outlook: "AI data centre electricity demand is a genuine multi-decade tailwind for regulated utilities. Rate cuts will re-rate the sector upward.",
    tailwinds: ["Data centre power demand", "Rate cuts improving valuations", "Clean energy transition spending"],
    headwinds: ["High debt loads at elevated rates", "Regulatory uncertainty on rate increases", "Grid infrastructure investment gap"],
    bias: "bullish",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avg(vals: (number | null | undefined)[]): number | null {
  const valid = vals.filter((v): v is number => v != null && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function strengthLabel(score: number | null): { label: string; color: string; bg: string; border: string } {
  if (score == null) return { label: "No Data", color: "text-muted-foreground", bg: "bg-secondary/30", border: "border-border/40" };
  if (score >= 0.72) return { label: "LEADING",    color: "text-emerald-300", bg: "bg-emerald-950/30", border: "border-emerald-500/30" };
  if (score >= 0.60) return { label: "ABOVE AVG",  color: "text-emerald-400", bg: "bg-emerald-950/15", border: "border-emerald-500/20" };
  if (score >= 0.48) return { label: "AVERAGE",    color: "text-amber-400",   bg: "bg-amber-950/15",   border: "border-amber-500/20"   };
  if (score >= 0.36) return { label: "BELOW AVG",  color: "text-orange-400",  bg: "bg-orange-950/15",  border: "border-orange-500/20"  };
  return               { label: "LAGGING",    color: "text-red-400",     bg: "bg-red-950/15",     border: "border-red-500/20"     };
}

function biasColor(bias: "bullish" | "neutral" | "cautious") {
  if (bias === "bullish")  return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (bias === "cautious") return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  return "text-amber-400 bg-amber-500/10 border-amber-500/20";
}

function BiasIcon({ bias }: { bias: "bullish" | "neutral" | "cautious" }) {
  if (bias === "bullish")  return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  if (bias === "cautious") return <TrendingDown className="w-3 h-3 text-orange-400" />;
  return <Minus className="w-3 h-3 text-amber-400" />;
}

function ScoreRow({ label, value, barColor }: { label: string; value: number | null; barColor: string }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono font-semibold w-5 text-right ${barColor.replace("bg-", "text-")}`}>{pct}</span>
    </div>
  );
}

type ViewMode = "sector" | "country";

export default function SectorHeatmap() {
  const [viewMode, setViewMode]         = useState<ViewMode>("sector");
  const [countryFilter, setCountryFilter] = useState("all");
  const [sectorFilter, setSectorFilter]   = useState("all");

  const { data, isLoading } = useListFactorSnapshots(
    { limit: 500 },
    { query: { refetchOnWindowFocus: false } }
  );

  const allSnapshots = data?.snapshots ?? [];

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSnapshots) if (s.country && s.country !== "Unknown") set.add(s.country);
    return Array.from(set).sort();
  }, [allSnapshots]);

  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSnapshots) if (s.sector && s.sector !== "Unknown") set.add(s.sector);
    return Array.from(set).sort();
  }, [allSnapshots]);

  const filteredForSector = useMemo(() =>
    countryFilter === "all" ? allSnapshots : allSnapshots.filter(s => s.country === countryFilter),
  [allSnapshots, countryFilter]);

  const filteredForCountry = useMemo(() =>
    sectorFilter === "all" ? allSnapshots : allSnapshots.filter(s => s.sector === sectorFilter),
  [allSnapshots, sectorFilter]);

  const sectors = useMemo(() => {
    if (!filteredForSector.length) return [];

    const map = new Map<string, typeof filteredForSector>();
    for (const s of filteredForSector) {
      const key = s.sector ?? "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }

    return Array.from(map.entries())
      .map(([name, items]) => {
        const fortress  = avg(items.map(i => i.fortressScore));
        const rocket    = avg(items.map(i => i.rocketScore));
        const wave      = avg(items.map(i => i.waveScore));
        const momentum  = avg(items.map(i => i.momentumScore));
        const entry     = avg(items.map(i => i.entryScore));
        const composite = fortress != null && rocket != null && wave != null
          ? fortress * 0.4 + rocket * 0.35 + wave * 0.25
          : fortress ?? 0;
        return {
          name,
          count:      items.length,
          fortress,
          rocket,
          wave,
          entry,
          momentum,
          composite,
          topTickers: items
            .sort((a, b) => ((b.fortressScore ?? 0) + (b.rocketScore ?? 0)) - ((a.fortressScore ?? 0) + (a.rocketScore ?? 0)))
            .slice(0, 3)
            .map(i => i.ticker),
          macro: SECTOR_MACRO[name] ?? null,
        };
      })
      .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0));
  }, [filteredForSector]);

  const countries = useMemo(() => {
    if (!filteredForCountry.length) return [];

    const map = new Map<string, typeof filteredForCountry>();
    for (const s of filteredForCountry) {
      const key = s.country ?? "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }

    return Array.from(map.entries())
      .map(([name, items]) => {
        const fortress  = avg(items.map(i => i.fortressScore));
        const rocket    = avg(items.map(i => i.rocketScore));
        const wave      = avg(items.map(i => i.waveScore));
        const momentum  = avg(items.map(i => i.momentumScore));
        const composite = fortress != null && rocket != null && wave != null
          ? fortress * 0.4 + rocket * 0.35 + wave * 0.25
          : fortress ?? 0;
        // sectors represented
        const sectorCounts = new Map<string, number>();
        for (const s of items) {
          if (s.sector) sectorCounts.set(s.sector, (sectorCounts.get(s.sector) ?? 0) + 1);
        }
        const topSectors = Array.from(sectorCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
        return {
          name,
          flag: COUNTRY_FLAGS[name] ?? "🌐",
          count: items.length,
          fortress,
          rocket,
          wave,
          momentum,
          composite,
          topSectors,
          topTickers: items
            .sort((a, b) => ((b.fortressScore ?? 0) + (b.rocketScore ?? 0)) - ((a.fortressScore ?? 0) + (a.rocketScore ?? 0)))
            .slice(0, 5)
            .map(i => i.ticker),
        };
      })
      .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0));
  }, [filteredForCountry]);

  const topSector    = sectors[0];
  const bottomSector = sectors[sectors.length - 1];
  const totalCos     = sectors.reduce((s, sec) => s + sec.count, 0);

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight mb-1">Sector Heatmap</h1>
            <p className="text-muted-foreground text-sm">Composite engine scores across all sectors and geographies.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Country filter */}
            <div className="relative">
              <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
                className="text-xs bg-muted/30 border border-border rounded-lg px-3 py-1.5 pr-7 text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Countries</option>
                {availableCountries.map(c => (
                  <option key={c} value={c}>{COUNTRY_FLAGS[c] ?? "🌐"} {c}</option>
                ))}
              </select>
              <Globe className="absolute right-2 top-1.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* Sector filter */}
            <div className="relative">
              <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
                className="text-xs bg-muted/30 border border-border rounded-lg px-3 py-1.5 pr-7 text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Sectors</option>
                {availableSectors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <Filter className="absolute right-2 top-1.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* View mode toggle */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("sector")}
                className={`text-xs px-3 py-1.5 flex items-center gap-1.5 transition-colors ${viewMode === "sector" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <BarChart2 className="w-3 h-3" />By Sector
              </button>
              <button
                onClick={() => setViewMode("country")}
                className={`text-xs px-3 py-1.5 flex items-center gap-1.5 transition-colors ${viewMode === "country" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Globe className="w-3 h-3" />By Country
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : sectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3 border border-dashed border-border rounded-xl">
            <LayoutGrid className="w-10 h-10 opacity-30" />
            <p>No sector data available. Run the pipeline first.</p>
          </div>
        ) : viewMode === "country" ? (
          <>
            {/* Country summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Countries</div>
                <div className="text-2xl font-bold">{countries.filter(c => c.name !== "Unknown").length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">in universe</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Companies</div>
                <div className="text-2xl font-bold">{totalCos}</div>
                <div className="text-xs text-muted-foreground mt-0.5">scored</div>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Leading Market</div>
                <div className="font-bold text-emerald-400 text-sm">{countries[0]?.flag} {countries[0]?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">composite {countries[0]?.composite != null ? (countries[0].composite * 100).toFixed(0) : "—"}/100</div>
              </div>
              <div className="rounded-xl border border-orange-500/20 bg-orange-950/10 p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Lagging Market</div>
                <div className="font-bold text-orange-400 text-sm">{countries.filter(c => c.name !== "Unknown").slice(-1)[0]?.flag} {countries.filter(c => c.name !== "Unknown").slice(-1)[0]?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">composite {countries.slice(-1)[0]?.composite != null ? (countries.slice(-1)[0].composite * 100).toFixed(0) : "—"}/100</div>
              </div>
            </div>

            {/* Country cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {countries.filter(c => c.name !== "Unknown").map((c, rank) => {
                const str = strengthLabel(c.composite);
                return (
                  <div key={c.name} className={`rounded-xl border p-4 transition-all hover:scale-[1.005] ${str.bg} ${str.border}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-muted-foreground">#{rank + 1}</span>
                          <span className="text-xl">{c.flag}</span>
                          <h3 className="font-semibold text-sm text-foreground">{c.name}</h3>
                        </div>
                        <div className="text-[9px] text-muted-foreground">{c.count} companies</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-mono font-bold ${str.color}`}>
                          {c.composite != null ? (c.composite * 100).toFixed(0) : "—"}
                        </div>
                        <div className={`text-[9px] font-semibold uppercase tracking-wide ${str.color}`}>{str.label}</div>
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <ScoreRow label="Fortress"  value={c.fortress}  barColor="bg-emerald-500" />
                      <ScoreRow label="Rocket"    value={c.rocket}    barColor="bg-orange-500"  />
                      <ScoreRow label="Wave"      value={c.wave}      barColor="bg-cyan-500"    />
                      {c.momentum != null && (
                        <ScoreRow label="Momentum" value={c.momentum} barColor="bg-violet-500"  />
                      )}
                    </div>
                    {c.topTickers.length > 0 && (
                      <div className="border-t border-white/8 pt-2.5 mb-2">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Top picks</p>
                        <div className="flex gap-1 flex-wrap">
                          {c.topTickers.map(t => (
                            <span key={t} className="font-mono text-[10px] px-2 py-0.5 bg-black/25 rounded border border-white/10 text-foreground/80">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {c.topSectors.length > 0 && (
                      <div className="border-t border-white/8 pt-2.5">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Key sectors</p>
                        <div className="flex gap-1 flex-wrap">
                          {c.topSectors.map(s => (
                            <span key={s} className="text-[9px] px-1.5 py-0.5 bg-secondary/50 rounded border border-border/30 text-muted-foreground">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Sectors</div>
                <div className="text-2xl font-bold">{sectors.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">tracked</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Companies</div>
                <div className="text-2xl font-bold">{totalCos}</div>
                <div className="text-xs text-muted-foreground mt-0.5">scored</div>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Leading Sector</div>
                <div className="font-bold text-emerald-400 text-sm">{topSector?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">composite {topSector?.composite != null ? (topSector.composite * 100).toFixed(0) : "—"}/100</div>
              </div>
              <div className="rounded-xl border border-orange-500/20 bg-orange-950/10 p-4 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Lagging Sector</div>
                <div className="font-bold text-orange-400 text-sm">{bottomSector?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">composite {bottomSector?.composite != null ? (bottomSector.composite * 100).toFixed(0) : "—"}/100</div>
              </div>
            </div>

            {/* Heatmap grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {sectors.filter(s => s.name !== "Unknown").map((s, rank) => {
                const str  = strengthLabel(s.composite);
                const mac  = s.macro;
                return (
                  <div key={s.name} className={`rounded-xl border p-4 transition-all hover:scale-[1.005] ${str.bg} ${str.border}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-muted-foreground">#{rank + 1}</span>
                          <h3 className="font-semibold text-sm text-foreground">{s.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground">{s.count} companies</span>
                          {mac && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium flex items-center gap-0.5 ${biasColor(mac.bias)}`}>
                              <BiasIcon bias={mac.bias} />
                              {mac.bias.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-mono font-bold ${str.color}`}>
                          {s.composite != null ? (s.composite * 100).toFixed(0) : "—"}
                        </div>
                        <div className={`text-[9px] font-semibold uppercase tracking-wide ${str.color}`}>{str.label}</div>
                      </div>
                    </div>

                    {/* Score bars */}
                    <div className="space-y-1.5 mb-3">
                      <ScoreRow label="Fortress"  value={s.fortress}  barColor="bg-emerald-500" />
                      <ScoreRow label="Rocket"    value={s.rocket}    barColor="bg-orange-500"  />
                      <ScoreRow label="Wave"      value={s.wave}      barColor="bg-cyan-500"    />
                      {s.momentum != null && (
                        <ScoreRow label="Momentum" value={s.momentum} barColor="bg-violet-500"  />
                      )}
                    </div>

                    {/* Top tickers */}
                    {s.topTickers.length > 0 && (
                      <div className="border-t border-white/8 pt-2.5 mb-3">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Top picks</p>
                        <div className="flex gap-1 flex-wrap">
                          {s.topTickers.map(t => (
                            <span key={t} className="font-mono text-[10px] px-2 py-0.5 bg-black/25 rounded border border-white/10 text-foreground/80">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Macro context */}
                    {mac && (
                      <div className="border-t border-white/8 pt-2.5">
                        <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{mac.outlook}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <div className="text-[9px] text-emerald-400 font-medium mb-1">Tailwinds</div>
                            {mac.tailwinds.slice(0, 2).map((t, i) => (
                              <div key={i} className="text-[9px] text-muted-foreground flex items-start gap-1 mb-0.5">
                                <span className="text-emerald-500 shrink-0">↑</span>{t}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="text-[9px] text-red-400 font-medium mb-1">Headwinds</div>
                            {mac.headwinds.slice(0, 2).map((h, i) => (
                              <div key={i} className="text-[9px] text-muted-foreground flex items-start gap-1 mb-0.5">
                                <span className="text-red-500 shrink-0">↓</span>{h}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
