import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useListFactorSnapshots, useSeedUniverse } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { CompanyDrawer } from "@/components/company/CompanyDrawer";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Loader2, Filter, RefreshCw, Sprout, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { countryFilterFn } from "@/lib/country-filter";

function ScoreCell({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = score * 100;
  const color =
    pct >= 70 ? "text-emerald-400" :
    pct >= 50 ? "text-amber-400" :
                "text-red-400";
  return <span className={`font-mono text-xs font-semibold ${color}`}>{score.toFixed(2)}</span>;
}

function formatMarketCap(v?: number | null) {
  if (v == null) return "—";
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}T`;
  if (v >= 1)    return `$${v.toFixed(1)}B`;
  return `$${(v * 1000).toFixed(0)}M`;
}

export default function Screener() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { market } = useAuth();
  const defaultCountry = market !== "All" ? market : "";

  const [sector, setSector]         = useState("");
  const [industry, setIndustry]     = useState("");
  const [country, setCountry]       = useState(defaultCountry);
  const [minFortress, setMinFortress] = useState("");
  const [minRocket, setMinRocket]   = useState("");
  const [minWave, setMinWave]       = useState("");
  const [minEntry, setMinEntry]     = useState("");
  const [mcapMin, setMcapMin]       = useState("");
  const [mcapMax, setMcapMax]       = useState("");
  const [search, setSearch]         = useState("");

  const params = useMemo(() => ({
    sector:          sector   || undefined,
    industry:        industry || undefined,
    country:         country  || undefined,
    min_fortress:    minFortress ? Number(minFortress) : undefined,
    min_rocket:      minRocket   ? Number(minRocket)   : undefined,
    min_wave:        minWave     ? Number(minWave)     : undefined,
    min_entry:       minEntry    ? Number(minEntry)    : undefined,
    market_cap_min:  mcapMin ? Number(mcapMin) : undefined,
    market_cap_max:  mcapMax ? Number(mcapMax) : undefined,
    limit: 200,
  }), [sector, industry, country, minFortress, minRocket, minWave, minEntry, mcapMin, mcapMax]);

  const { data, isLoading, refetch } = useListFactorSnapshots(params, {
    query: { refetchOnWindowFocus: false }
  });

  const { data: allData } = useListFactorSnapshots({ limit: 1000 }, {
    query: { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 }
  });

  const { mutate: seedUniverse, isPending: isSeeding } = useSeedUniverse();

  const allSnapshots = data?.snapshots ?? [];
  const allForOptions = allData?.snapshots ?? [];

  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    allForOptions.forEach(s => { if (s.sector) set.add(s.sector); });
    return [...set].sort();
  }, [allForOptions]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    allForOptions.forEach(s => { if (s.country) set.add(s.country); });
    return [...set].sort();
  }, [allForOptions]);

  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    allForOptions.forEach(s => { if (s.industry) set.add(s.industry); });
    return [...set].sort();
  }, [allForOptions]);

  const snapshots = useMemo(() => {
    if (!search) return allSnapshots;
    const q = search.toLowerCase();
    return allSnapshots.filter(s =>
      s.ticker.toLowerCase().includes(q) ||
      (s.name ?? "").toLowerCase().includes(q) ||
      (s.sector ?? "").toLowerCase().includes(q)
    );
  }, [allSnapshots, search]);

  const hasFilters = sector || industry || country || minFortress || minRocket || minWave || minEntry || mcapMin || mcapMax;

  function clearFilters() {
    setSector(""); setIndustry(""); setCountry("");
    setMinFortress(""); setMinRocket(""); setMinWave(""); setMinEntry("");
    setMcapMin(""); setMcapMax(""); setSearch("");
  }

  function openDrawer(ticker: string) {
    setSelectedTicker(ticker);
    setDrawerOpen(true);
  }

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-5">
        <div className="flex flex-col md:flex-row items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight mb-1">Global Screener</h1>
            <p className="text-muted-foreground text-sm">Filter the factor warehouse across US, UK, and India markets.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => seedUniverse(undefined, { onSuccess: () => refetch() })}
              disabled={isSeeding}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border border-border bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
            >
              {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sprout className="w-3.5 h-3.5" />}
              Seed Universe
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border border-border bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Filters</span>
            {hasFilters && (
              <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-3">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search ticker or name..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-secondary/50 border border-border focus:border-primary/50 outline-none transition-colors placeholder:text-muted-foreground/60"
              />
            </div>

            <Combobox
              options={sectorOptions}
              value={sector}
              onChange={setSector}
              placeholder="All Sectors"
            />

            <Combobox
              options={countryOptions}
              value={country}
              onChange={setCountry}
              placeholder="All Countries"
              filterFn={countryFilterFn}
            />

            <Combobox
              options={industryOptions}
              value={industry}
              onChange={setIndustry}
              placeholder="Industry..."
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Fortress ≥</label>
              <input type="number" min={0} max={1} step={0.05} value={minFortress} onChange={e => setMinFortress(e.target.value)}
                placeholder="0.0" className="w-full px-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border focus:border-emerald-500/50 outline-none placeholder:text-muted-foreground/60" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Rocket ≥</label>
              <input type="number" min={0} max={1} step={0.05} value={minRocket} onChange={e => setMinRocket(e.target.value)}
                placeholder="0.0" className="w-full px-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border focus:border-orange-500/50 outline-none placeholder:text-muted-foreground/60" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Wave ≥</label>
              <input type="number" min={0} max={1} step={0.05} value={minWave} onChange={e => setMinWave(e.target.value)}
                placeholder="0.0" className="w-full px-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border focus:border-cyan-500/50 outline-none placeholder:text-muted-foreground/60" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Entry ≥</label>
              <input type="number" min={0} max={1} step={0.05} value={minEntry} onChange={e => setMinEntry(e.target.value)}
                placeholder="0.0" className="w-full px-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border focus:border-violet-500/50 outline-none placeholder:text-muted-foreground/60" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Mkt Cap Min ($B)</label>
              <input type="number" min={0} step={1} value={mcapMin} onChange={e => setMcapMin(e.target.value)}
                placeholder="0" className="w-full px-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border focus:border-primary/50 outline-none placeholder:text-muted-foreground/60" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Mkt Cap Max ($B)</label>
              <input type="number" min={0} step={1} value={mcapMax} onChange={e => setMcapMax(e.target.value)}
                placeholder="∞" className="w-full px-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border focus:border-primary/50 outline-none placeholder:text-muted-foreground/60" />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/10">
            <span className="text-xs text-muted-foreground font-mono">
              {isLoading ? "Loading..." : `${snapshots.length} companies`}
            </span>
            <span className="text-[11px] text-muted-foreground hidden md:inline">Click a row to drill into company detail</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
              <Search className="w-8 h-8 opacity-30" />
              <p className="text-sm">No results match your filters.</p>
              <p className="text-xs">Try seeding the universe and running the pipeline first, or broaden your filters.</p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear all filters</button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    <th className="text-left px-3 md:px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground sticky left-0 bg-secondary/20 z-10 whitespace-nowrap">Ticker</th>
                    <th className="text-left px-3 md:px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">Name</th>
                    <th className="text-left px-3 md:px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">Sector</th>
                    <th className="text-left px-3 md:px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">Country</th>
                    <th className="text-left px-3 md:px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">CCY</th>
                    <th className="text-right px-3 md:px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">Mkt Cap</th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-mono uppercase tracking-wider text-emerald-600 whitespace-nowrap">Fortress</th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-mono uppercase tracking-wider text-orange-600 whitespace-nowrap">Rocket</th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-mono uppercase tracking-wider text-cyan-600 whitespace-nowrap">Wave</th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-mono uppercase tracking-wider text-violet-600 whitespace-nowrap">Entry</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s, i) => (
                    <tr
                      key={s.ticker}
                      onClick={() => openDrawer(s.ticker)}
                      className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-primary/5 hover:border-primary/20 group ${i % 2 === 0 ? "bg-transparent" : "bg-secondary/10"}`}
                    >
                      <td className="px-3 md:px-4 py-2.5 sticky left-0 bg-card z-10 group-hover:bg-primary/5 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-primary">{s.ticker}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 max-w-[180px]">
                        <span className="text-xs text-foreground truncate block">{s.name ?? "—"}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        {s.sector ? (
                          <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-normal border-border/50">{s.sector}</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">{s.country ?? "—"}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-mono text-muted-foreground">{s.currency ?? "—"}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 text-right whitespace-nowrap">
                        <span className="text-xs font-mono">{formatMarketCap(s.marketCap)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center"><ScoreCell score={s.fortressScore} /></td>
                      <td className="px-3 py-2.5 text-center"><ScoreCell score={s.rocketScore} /></td>
                      <td className="px-3 py-2.5 text-center"><ScoreCell score={s.waveScore} /></td>
                      <td className="px-3 py-2.5 text-center"><ScoreCell score={s.entryScore} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <CompanyDrawer
        ticker={selectedTicker}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </Layout>
  );
}
