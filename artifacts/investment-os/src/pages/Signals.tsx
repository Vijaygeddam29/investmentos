import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useListFactorSnapshots } from "@workspace/api-client-react";
import { CompanyDrawer } from "@/components/company/CompanyDrawer";
import { PipelineTimestampBar } from "@/components/pipeline/PipelineTimestampBar";
import {
  Crown, ChevronUp, ChevronDown, ChevronsUpDown, Filter, Globe,
  Loader2, ArrowUpDown, Info, Shield, Rocket, Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Country flags ────────────────────────────────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", "India": "🇮🇳",
  "Germany": "🇩🇪", "France": "🇫🇷", "Japan": "🇯🇵", "China": "🇨🇳",
  "Netherlands": "🇳🇱", "Switzerland": "🇨🇭", "Australia": "🇦🇺",
  "Canada": "🇨🇦", "Brazil": "🇧🇷", "Ireland": "🇮🇪", "Spain": "🇪🇸",
  "Italy": "🇮🇹", "Taiwan": "🇹🇼", "South Korea": "🇰🇷", "Singapore": "🇸🇬",
  "Israel": "🇮🇱", "Denmark": "🇩🇰", "Hong Kong": "🇭🇰", "Uruguay": "🇺🇾",
};

function flagOf(country: string | null | undefined): string {
  if (!country) return "🌐";
  return COUNTRY_FLAGS[country] ?? "🌐";
}

// ─── Score label helpers ──────────────────────────────────────────────────────

function qualityLabel(v: number | null | undefined) {
  if (v == null) return { label: "—", color: "text-muted-foreground" };
  if (v >= 0.70) return { label: "Exceptional", color: "text-emerald-400" };
  if (v >= 0.55) return { label: "Strong",      color: "text-blue-400" };
  if (v >= 0.40) return { label: "Moderate",    color: "text-amber-400" };
  if (v >= 0.25) return { label: "Below Avg",   color: "text-orange-400" };
  return                { label: "Weak",        color: "text-red-400" };
}

function expectationLabel(v: number | null | undefined) {
  if (v == null) return { label: "—", color: "text-muted-foreground" };
  if (v >= 0.75) return { label: "Euphoric",  color: "text-red-400" };
  if (v >= 0.60) return { label: "Elevated",  color: "text-orange-400" };
  if (v >= 0.45) return { label: "Moderate",  color: "text-amber-400" };
  if (v >= 0.30) return { label: "Modest",    color: "text-blue-400" };
  return                { label: "Depressed", color: "text-emerald-400" };
}

function mispricingLabel(v: number | null | undefined) {
  if (v == null) return { label: "—", color: "text-muted-foreground" };
  if (v >= 0.70) return { label: "Strong Edge",  color: "text-emerald-400" };
  if (v >= 0.55) return { label: "Reasonable",   color: "text-blue-400" };
  if (v >= 0.40) return { label: "Plausible",    color: "text-amber-400" };
  if (v >= 0.25) return { label: "Weak",         color: "text-orange-400" };
  return                { label: "No Edge",      color: "text-red-400" };
}

function fragilityLabel(v: number | null | undefined) {
  if (v == null) return { label: "—", color: "text-muted-foreground" };
  if (v >= 0.70) return { label: "Fragile",     color: "text-red-400" };
  if (v >= 0.55) return { label: "Elevated",    color: "text-orange-400" };
  if (v >= 0.40) return { label: "Moderate",    color: "text-amber-400" };
  if (v >= 0.25) return { label: "Robust",      color: "text-blue-400" };
  return                { label: "Very Robust", color: "text-emerald-400" };
}

function bandFromScore(pns: number | null | undefined) {
  if (pns == null) return null;
  if (pns >= 0.75) return { label: "CORE",      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" };
  if (pns >= 0.60) return { label: "STANDARD",  color: "bg-blue-500/15 text-blue-400 border-blue-500/25" };
  if (pns >= 0.45) return { label: "STARTER",   color: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
  if (pns >= 0.30) return { label: "TACTICAL",  color: "bg-orange-500/15 text-orange-400 border-orange-500/25" };
  return                  { label: "WATCHLIST", color: "bg-secondary text-muted-foreground border-border/40" };
}

// ─── Mini score cell ──────────────────────────────────────────────────────────

function ScoreCell({ value, label, color }: { value: number | null | undefined; label: string; color: string }) {
  if (value == null) return <span className="text-muted-foreground/40 text-xs">—</span>;
  return (
    <div>
      <div className={`text-[11px] font-semibold font-mono ${color}`}>{Math.round(value * 100)}</div>
      <div className={`text-[9px] ${color} opacity-70`}>{label}</div>
    </div>
  );
}

// ─── Sortable header ──────────────────────────────────────────────────────────

type SortKey = "portfolioNetScore" | "companyQualityScore" | "stockOpportunityScore"
  | "expectationScore" | "mispricingScore" | "fragilityScore"
  | "fortressScore" | "rocketScore" | "waveScore";

type SortDir = "asc" | "desc";

function SortTh({ label, col, active, dir, onSort, className }: {
  label: string; col: SortKey; active: boolean; dir: SortDir;
  onSort: (c: SortKey) => void; className?: string;
}) {
  return (
    <th
      className={`text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 cursor-pointer hover:text-foreground select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? dir === "desc"
            ? <ChevronDown className="w-3 h-3 text-primary" />
            : <ChevronUp className="w-3 h-3 text-primary" />
          : <ChevronsUpDown className="w-2.5 h-2.5 opacity-30" />}
      </div>
    </th>
  );
}

// ─── Country separator row ────────────────────────────────────────────────────

function CountrySeparator({ country, count, avgNet }: { country: string; count: number; avgNet: number | null }) {
  const flag = flagOf(country);
  return (
    <tr className="bg-muted/15 border-y border-border/40">
      <td colSpan={11} className="px-4 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{flag}</span>
          <span className="text-[11px] font-semibold text-foreground">{country}</span>
          <span className="text-[10px] text-muted-foreground">{count} companies</span>
          {avgNet != null && (
            <span className="text-[10px] text-muted-foreground ml-1">
              avg net score <strong className="text-foreground font-mono">{Math.round(avgNet * 100)}</strong>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = "by-country" | "ranked";

export default function Signals() {
  const [sortKey, setSortKey]   = useState<SortKey>("portfolioNetScore");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("by-country");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [drawerTicker, setDrawerTicker] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useListFactorSnapshots(
    { limit: 500 },
    { query: { refetchOnWindowFocus: false } }
  );

  const snapshots = data?.snapshots ?? [];

  // All unique sectors for filter
  const sectors = useMemo(() => {
    const s = new Set(snapshots.map(r => r.sector).filter(Boolean) as string[]);
    return ["all", ...Array.from(s).sort()];
  }, [snapshots]);

  // Filter by sector
  const filtered = useMemo(() => {
    if (sectorFilter === "all") return snapshots;
    return snapshots.filter(r => r.sector === sectorFilter);
  }, [snapshots, sectorFilter]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortKey] ?? -1;
      const bv = (b as any)[sortKey] ?? -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [filtered, sortKey, sortDir]);

  // Group by country (for by-country view)
  const byCountry = useMemo(() => {
    const map = new Map<string, typeof sorted>();
    for (const s of sorted) {
      const c = s.country ?? "Unknown";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(s);
    }
    // Sort countries by their average portfolioNetScore desc
    return Array.from(map.entries())
      .map(([country, rows]) => {
        const nets = rows.map(r => (r as any).portfolioNetScore as number | null).filter((v): v is number => v != null);
        const avgNet = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : null;
        return { country, rows, avgNet };
      })
      .sort((a, b) => (b.avgNet ?? -1) - (a.avgNet ?? -1));
  }, [sorted]);

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortKey(col);
      setSortDir("desc");
    }
  }

  function openDrawer(ticker: string) {
    setDrawerTicker(ticker);
    setDrawerOpen(true);
  }

  // Stats
  const withNetScore = sorted.filter(r => (r as any).portfolioNetScore != null).length;
  const coreCount    = sorted.filter(r => (r as any).portfolioNetScore >= 0.75).length;
  const buyCount     = sorted.filter(r => (r as any).portfolioNetScore >= 0.60).length;

  const tableHeader = (
    <thead>
      <tr className="border-b border-border/60 bg-muted/10">
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-8 text-left">#</th>
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left">Ticker</th>
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left">Company</th>
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left hidden lg:table-cell">Sector</th>
        <SortTh label="Quality"     col="companyQualityScore"   active={sortKey === "companyQualityScore"}   dir={sortDir} onSort={handleSort} className="text-right" />
        <SortTh label="Opportunity" col="stockOpportunityScore" active={sortKey === "stockOpportunityScore"} dir={sortDir} onSort={handleSort} className="text-right" />
        <SortTh label="Expectation" col="expectationScore"      active={sortKey === "expectationScore"}      dir={sortDir} onSort={handleSort} className="text-right" />
        <SortTh label="Mispricing"  col="mispricingScore"       active={sortKey === "mispricingScore"}       dir={sortDir} onSort={handleSort} className="text-right" />
        <SortTh label="Fragility"   col="fragilityScore"        active={sortKey === "fragilityScore"}        dir={sortDir} onSort={handleSort} className="text-right" />
        <SortTh label="Net Score"   col="portfolioNetScore"     active={sortKey === "portfolioNetScore"}     dir={sortDir} onSort={handleSort} className="text-right" />
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left">Band</th>
      </tr>
    </thead>
  );

  function renderRow(s: any, rank: number) {
    const q  = qualityLabel((s as any).companyQualityScore);
    const op = qualityLabel((s as any).stockOpportunityScore);
    const ex = expectationLabel((s as any).expectationScore);
    const mi = mispricingLabel((s as any).mispricingScore);
    const fr = fragilityLabel((s as any).fragilityScore);
    const pns = (s as any).portfolioNetScore as number | null | undefined;
    const band = bandFromScore(pns);

    return (
      <tr
        key={s.ticker}
        className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
        onClick={() => openDrawer(s.ticker)}
      >
        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground/60">{rank}</td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{flagOf(s.country)}</span>
            <span className="font-mono font-bold text-foreground text-sm">{s.ticker}</span>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[160px]">{s.name ?? s.ticker}</span>
        </td>
        <td className="px-3 py-2.5 hidden lg:table-cell">
          {s.sector && (
            <span className="text-[10px] text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded border border-border/30">
              {s.sector}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-right">
          <ScoreCell value={(s as any).companyQualityScore}   label={q.label}  color={q.color} />
        </td>
        <td className="px-3 py-2.5 text-right">
          <ScoreCell value={(s as any).stockOpportunityScore} label={op.label} color={op.color} />
        </td>
        <td className="px-3 py-2.5 text-right">
          <ScoreCell value={(s as any).expectationScore}      label={ex.label} color={ex.color} />
        </td>
        <td className="px-3 py-2.5 text-right">
          <ScoreCell value={(s as any).mispricingScore}       label={mi.label} color={mi.color} />
        </td>
        <td className="px-3 py-2.5 text-right">
          <ScoreCell value={(s as any).fragilityScore}        label={fr.label} color={fr.color} />
        </td>
        <td className="px-3 py-2.5 text-right">
          {pns != null ? (
            <span className={`text-sm font-mono font-bold ${
              pns >= 0.75 ? "text-emerald-400" :
              pns >= 0.60 ? "text-blue-400" :
              pns >= 0.45 ? "text-amber-400" :
              pns >= 0.30 ? "text-orange-400" : "text-red-400"
            }`}>{Math.round(pns * 100)}</span>
          ) : (
            <span className="text-muted-foreground/30 text-xs">—</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          {band ? (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${band.color}`}>
              {band.label}
            </span>
          ) : (
            <span className="text-muted-foreground/30 text-xs">—</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight mb-1 flex items-center gap-3">
              <Crown className="w-7 h-7 text-violet-400" />
              Investment Intelligence
            </h1>
            <p className="text-muted-foreground text-sm">
              6-layer scoring across the full universe. Click any row to open the Investment Thesis.
            </p>
            <div className="mt-1.5">
              <PipelineTimestampBar />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View mode */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("by-country")}
                className={`text-xs px-3 py-1.5 flex items-center gap-1.5 transition-colors ${viewMode === "by-country" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Globe className="w-3 h-3" />By Country
              </button>
              <button
                onClick={() => setViewMode("ranked")}
                className={`text-xs px-3 py-1.5 flex items-center gap-1.5 transition-colors ${viewMode === "ranked" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <ArrowUpDown className="w-3 h-3" />Ranked
              </button>
            </div>

            {/* Sector filter */}
            <div className="relative">
              <select
                value={sectorFilter}
                onChange={e => setSectorFilter(e.target.value)}
                className="text-xs bg-muted/30 border border-border rounded-lg px-3 py-1.5 pr-7 text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {sectors.map(s => (
                  <option key={s} value={s}>{s === "all" ? "All Sectors" : s}</option>
                ))}
              </select>
              <Filter className="absolute right-2 top-1.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Universe</div>
            <div className="text-xl font-bold">{filtered.length}</div>
            <div className="text-[10px] text-muted-foreground">companies</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Scored</div>
            <div className="text-xl font-bold text-blue-400">{withNetScore}</div>
            <div className="text-[10px] text-muted-foreground">with 6-layer data</div>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Core/Standard</div>
            <div className="text-xl font-bold text-emerald-400">{buyCount}</div>
            <div className="text-[10px] text-muted-foreground">buy-grade positions</div>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Core</div>
            <div className="text-xl font-bold text-violet-400">{coreCount}</div>
            <div className="text-[10px] text-muted-foreground">≥ 75 net score</div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border border-dashed border-border rounded-xl gap-3">
            <Info className="w-8 h-8 opacity-30" />
            <p>No companies found. Run the pipeline to generate scores.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              {viewMode === "ranked" ? (
                <table className="w-full text-sm">
                  {tableHeader}
                  <tbody>
                    {sorted.map((s, i) => renderRow(s, i + 1))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  {tableHeader}
                  <tbody>
                    {byCountry.map(({ country, rows, avgNet }) => (
                      <>
                        <CountrySeparator key={`sep-${country}`} country={country} count={rows.length} avgNet={avgNet} />
                        {rows.map((s, i) => renderRow(s, i + 1))}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Legend */}
            <div className="px-4 py-3 border-t border-border/40 bg-muted/10 flex items-center gap-4 flex-wrap">
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Position bands:</span>
              {[
                { label: "CORE ≥75",     color: "text-emerald-400" },
                { label: "STANDARD ≥60", color: "text-blue-400" },
                { label: "STARTER ≥45",  color: "text-amber-400" },
                { label: "TACTICAL ≥30", color: "text-orange-400" },
                { label: "WATCHLIST",    color: "text-red-400" },
              ].map(b => (
                <span key={b.label} className={`text-[10px] font-semibold ${b.color}`}>{b.label}</span>
              ))}
              <span className="text-[10px] text-muted-foreground/50 ml-auto">Click any row → Investment Thesis</span>
            </div>
          </div>
        )}

      </div>

      <CompanyDrawer
        ticker={drawerTicker}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </Layout>
  );
}
