import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  useListDriftSignals,
  useListOpportunityAlerts,
  useListRiskAlerts,
  useGetMarketRegime,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  ShieldAlert, TrendingUp, AlertTriangle, Activity, ChevronDown, ChevronUp,
  Shield, Rocket, Waves, Info, Zap, Flag, Building2, Globe, Users, Lock,
  AlertCircle, Crown, Target, Eye, BarChart2, Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCompanyIntel } from "@/lib/company-intel";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countryFlag(country: string): string {
  const flags: Record<string, string> = {
    "United States": "🇺🇸", "United Kingdom": "🇬🇧", "India": "🇮🇳",
    "Germany": "🇩🇪", "France": "🇫🇷", "Japan": "🇯🇵", "China": "🇨🇳",
    "Netherlands": "🇳🇱", "Switzerland": "🇨🇭", "Australia": "🇦🇺",
    "Canada": "🇨🇦", "Brazil": "🇧🇷", "Ireland": "🇮🇪", "Spain": "🇪🇸",
    "Italy": "🇮🇹", "Taiwan": "🇹🇼", "South Korea": "🇰🇷", "Singapore": "🇸🇬",
  };
  return flags[country] ?? "🌐";
}

function ScoreBar({ label, value, color, sublabel }: { label: string; value: number | null | undefined; color: string; sublabel?: string }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-0.5">
        <div>
          <span className="text-muted-foreground">{label}</span>
          {sublabel && <span className="text-muted-foreground/50 ml-1">· {sublabel}</span>}
        </div>
        <span className={`font-mono font-semibold ${color}`}>{pct}</span>
      </div>
      <div className="h-1 bg-secondary/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function expectationLabel(score: number | null | undefined): { label: string; color: string; desc: string } {
  if (score == null) return { label: "Unknown", color: "text-muted-foreground", desc: "No data" };
  if (score >= 0.75) return { label: "Euphoric", color: "text-red-400", desc: "Near-perfect outcomes already priced in — significant downside if anything disappoints" };
  if (score >= 0.60) return { label: "Elevated", color: "text-orange-400", desc: "Market expects strong execution — limited upside unless company beats significantly" };
  if (score >= 0.45) return { label: "Moderate", color: "text-amber-400", desc: "Fair expectations — stock can still re-rate meaningfully if results improve" };
  if (score >= 0.30) return { label: "Modest", color: "text-blue-400", desc: "Low expectations built into price — any positive surprise creates upside" };
  return { label: "Depressed", color: "text-emerald-400", desc: "Pessimism is extreme — even mediocre results could trigger a re-rating" };
}

function mispricingLabel(score: number | null | undefined): { label: string; color: string; desc: string } {
  if (score == null) return { label: "Unknown", color: "text-muted-foreground", desc: "No data" };
  if (score >= 0.70) return { label: "Strong Edge", color: "text-emerald-400", desc: "Multiple data points confirm the market is meaningfully wrong — high-conviction setup" };
  if (score >= 0.55) return { label: "Reasonable Edge", color: "text-blue-400", desc: "Evidence-backed thesis — clear identifiable reason for disconnect from fair value" };
  if (score >= 0.40) return { label: "Plausible", color: "text-amber-400", desc: "Some evidence, but thesis is not yet fully confirmed — monitor before sizing up" };
  if (score >= 0.25) return { label: "Weak", color: "text-orange-400", desc: "Market may be pricing correctly — require stronger evidence before committing" };
  return { label: "No Edge", color: "text-red-400", desc: "No compelling reason the market is wrong — avoid or underweight" };
}

function fragilityLabel(score: number | null | undefined): { label: string; color: string; desc: string } {
  if (score == null) return { label: "Unknown", color: "text-muted-foreground", desc: "No data" };
  if (score >= 0.70) return { label: "Very Fragile", color: "text-red-400", desc: "Thesis can break easily — high leverage, weak coverage, volatile margins" };
  if (score >= 0.55) return { label: "Fragile", color: "text-orange-400", desc: "Multiple fragility factors present — keep position sizing small" };
  if (score >= 0.40) return { label: "Moderate", color: "text-amber-400", desc: "Some risks present but manageable — thesis requires monitoring" };
  if (score >= 0.25) return { label: "Robust", color: "text-blue-400", desc: "Strong balance sheet and stable margins — thesis is durable" };
  return { label: "Very Robust", color: "text-emerald-400", desc: "Excellent financial health — thesis can withstand significant shocks" };
}

function positionBandFromScore(portfolioNetScore: number | null | undefined): {
  band: string; label: string; minPct: number; maxPct: number; color: string;
} | null {
  if (portfolioNetScore == null) return null;
  if (portfolioNetScore >= 0.75) return { band: "core",      label: "Core",      minPct: 6,   maxPct: 10,  color: "emerald" };
  if (portfolioNetScore >= 0.60) return { band: "standard",  label: "Standard",  minPct: 3,   maxPct: 5,   color: "blue" };
  if (portfolioNetScore >= 0.45) return { band: "starter",   label: "Starter",   minPct: 1,   maxPct: 2.5, color: "amber" };
  if (portfolioNetScore >= 0.30) return { band: "tactical",  label: "Tactical",  minPct: 0.5, maxPct: 1,   color: "orange" };
  return                               { band: "watchlist", label: "Watchlist", minPct: 0,   maxPct: 0,   color: "red" };
}

// ─── Six-Layer Intelligence Card (Premium) ────────────────────────────────────

function SixLayerIntelligence({ co }: { co: any }) {
  if (!co) return null;

  const hasQualityData  = co.companyQualityScore != null || co.fortressScore != null;
  const hasAdvancedData = co.expectationScore != null || co.mispricingScore != null;

  const qualityPct  = Math.round((co.companyQualityScore ?? co.fortressScore ?? 0) * 100);
  const oppPct      = Math.round((co.stockOpportunityScore ?? co.waveScore ?? 0) * 100);
  const exp         = expectationLabel(co.expectationScore);
  const mis         = mispricingLabel(co.mispricingScore);
  const frag        = fragilityLabel(co.fragilityScore);
  const posBand     = positionBandFromScore(co.portfolioNetScore);
  const netPct      = co.portfolioNetScore != null ? Math.round(co.portfolioNetScore * 100) : null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Crown className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">6-Layer Investment Thesis</span>
        <Badge className="bg-violet-500/15 text-violet-400 hover:bg-violet-500/15 text-[9px] font-bold border border-violet-500/20 ml-auto">
          PREMIUM
        </Badge>
      </div>

      {/* Layer 1 + 2: Existing scores */}
      {hasQualityData && (
        <div className="p-3 rounded-lg bg-secondary/20 border border-border/40 space-y-2">
          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Foundation layers</div>
          <ScoreBar label="Company Quality" value={co.companyQualityScore ?? co.fortressScore} color="text-emerald-400" sublabel="how good is the business" />
          <ScoreBar label="Stock Opportunity" value={co.stockOpportunityScore ?? co.waveScore} color="text-blue-400" sublabel="is now a good entry?" />
        </div>
      )}

      {/* Layers 3–5: Advanced intel (Premium) */}
      <div className={`p-3 rounded-lg border space-y-3 ${hasAdvancedData ? 'bg-violet-500/3 border-violet-500/15' : 'bg-secondary/10 border-border/30'}`}>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
          {!hasAdvancedData && <Lock className="w-3 h-3" />}
          Advanced intelligence layers
        </div>

        {/* Layer 3: Expectation */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground">Layer 3 — Expectation</span>
            </div>
            {co.expectationScore != null && (
              <span className={`text-[11px] font-semibold ${exp.color}`}>{exp.label}</span>
            )}
          </div>
          {co.expectationScore != null ? (
            <>
              <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full ${co.expectationScore >= 0.6 ? 'bg-red-500' : co.expectationScore >= 0.45 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.round(co.expectationScore * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{exp.desc}</p>
            </>
          ) : (
            <div className="text-[10px] text-muted-foreground/40 italic">Run pipeline to compute</div>
          )}
        </div>

        {/* Layer 4: Mispricing */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Target className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground">Layer 4 — Mispricing Evidence</span>
            </div>
            {co.mispricingScore != null && (
              <span className={`text-[11px] font-semibold ${mis.color}`}>{mis.label}</span>
            )}
          </div>
          {co.mispricingScore != null ? (
            <>
              <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full ${co.mispricingScore >= 0.6 ? 'bg-emerald-500' : co.mispricingScore >= 0.45 ? 'bg-blue-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.round(co.mispricingScore * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{mis.desc}</p>
            </>
          ) : (
            <div className="text-[10px] text-muted-foreground/40 italic">Run pipeline to compute</div>
          )}
        </div>

        {/* Layer 5: Fragility */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground">Layer 5 — Thesis Fragility</span>
            </div>
            {co.fragilityScore != null && (
              <span className={`text-[11px] font-semibold ${frag.color}`}>{frag.label}</span>
            )}
          </div>
          {co.fragilityScore != null ? (
            <>
              <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full ${co.fragilityScore >= 0.6 ? 'bg-red-500' : co.fragilityScore >= 0.4 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.round(co.fragilityScore * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{frag.desc}</p>
            </>
          ) : (
            <div className="text-[10px] text-muted-foreground/40 italic">Run pipeline to compute</div>
          )}
        </div>
      </div>

      {/* Layer 6: Portfolio Net Score + Position Band */}
      <div className={`p-3 rounded-lg border ${
        posBand?.band === "core"     ? "bg-emerald-500/5 border-emerald-500/25" :
        posBand?.band === "standard" ? "bg-blue-500/5 border-blue-500/25" :
        posBand?.band === "starter"  ? "bg-amber-500/5 border-amber-500/25" :
        posBand?.band === "tactical" ? "bg-orange-500/5 border-orange-500/25" :
                                       "bg-secondary/10 border-border/30"
      }`}>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-2">
          <BarChart2 className="w-3 h-3" /> Layer 6 — Position Sizing Rule
          <Badge className="bg-violet-500/15 text-violet-400 hover:bg-violet-500/15 text-[9px] border border-violet-500/20 ml-1">PREMIUM</Badge>
        </div>
        {netPct != null && posBand ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-sm font-bold font-mono text-${posBand.color}-400`}>
                  {posBand.label} position
                </span>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {posBand.minPct}–{posBand.maxPct}% of portfolio
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-mono font-bold text-${posBand.color}-400`}>{netPct}</div>
                <div className="text-[9px] text-muted-foreground">net score / 100</div>
              </div>
            </div>
            <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-${posBand.color}-500`}
                style={{ width: `${netPct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              Portfolio net score = 2×Quality + 1×Opportunity + 2×Mispricing − Expectation − Fragility
            </p>
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground/40 italic">Run pipeline to populate</div>
        )}
      </div>
    </div>
  );
}

const FACTOR_CONTEXT: Record<string, { meaning: string; action: string }> = {
  "ROIC": {
    meaning: "Return on Invested Capital has fallen sharply below its own historical average, suggesting the company is deploying capital less efficiently. This can precede margin compression or earnings downgrades.",
    action: "Review whether the deterioration is cyclical or structural. If structural, reduce position sizing or await earnings guidance.",
  },
  "Operating Margin": {
    meaning: "Operating margins are compressing — costs are rising faster than revenue. This may signal pricing pressure, competitive incursion, or cost discipline failures.",
    action: "Check recent earnings call commentary. If management is guiding margin recovery, monitor closely; otherwise trim on bounces.",
  },
  "Gross Margin": {
    meaning: "Gross margin is declining, indicating pricing power erosion or higher input costs. A sustained decline often leads to multiple compression.",
    action: "Track gross margin trend over the next 2 quarters. If below historical trough, initiate a SELL review.",
  },
  "Debt/Equity": {
    meaning: "Leverage is rising significantly above historical norms. Higher debt levels increase interest burden and reduce financial flexibility in downturns.",
    action: "Monitor interest coverage ratio closely. If the company is entering a slow-growth environment, deleveraging risk increases.",
  },
  "FCF Yield": {
    meaning: "Free cash flow yield has dropped sharply, suggesting the business is generating less cash relative to its valuation. May indicate capex intensity or working capital pressure.",
    action: "Verify whether capex is growth-related (acceptable) or maintenance-driven (bearish). Reduce if the FCF decline is persistent.",
  },
  "Interest Coverage": {
    meaning: "The company's ability to service its debt is deteriorating. Coverage below 3× signals meaningful refinancing and liquidity risk.",
    action: "Avoid adding to the position. If coverage falls below 2×, initiate an exit plan.",
  },
  "Insider Selling": {
    meaning: "Insiders are selling heavily relative to buying. While isolated sales can be tax-driven, cluster selling — especially by multiple insiders — often precedes negative news.",
    action: "Cross-reference with upcoming lock-up expirations and earnings dates. Heavy cluster selling near highs is a strong TRIM signal.",
  },
  "Current Ratio": {
    meaning: "Short-term liquidity is constrained — current assets no longer comfortably cover current liabilities. This increases default risk and limits management flexibility.",
    action: "Check credit facility availability and upcoming debt maturities. If cash runway is under 12 months, treat as HIGH RISK.",
  },
};

function getDriftContext(factorName: string | undefined) {
  if (!factorName) return null;
  return FACTOR_CONTEXT[factorName] ?? null;
}

const SECTOR_MACRO: Record<string, string> = {
  "Technology": "AI-driven capex cycle is squeezing margins for non-AI players. Monitor cloud spend growth and gross margin trends closely.",
  "Healthcare": "GLP-1 drugs reshaping the industry; biosimilar competition intensifying for older biologics. Patent cliffs are the key risk factor.",
  "Financial Services": "Net interest margins under pressure as central banks pivot. Fee-based models outperforming; watch credit quality.",
  "Consumer Discretionary": "Consumer spending bifurcation accelerating. Premium brands holding; mid-market facing wallet-share pressure.",
  "Consumer Defensive": "Pricing power normalising after the inflation tailwind. Volume recovery is the next catalyst to watch.",
  "Energy": "Supply discipline from OPEC+ supporting medium-term prices. Energy transition spending accelerating; LNG a structural winner.",
  "Industrials": "Re-shoring and defence spending are secular tailwinds. Supply chain normalisation is deflationary for near-term revenues.",
  "Communication Services": "Streaming profitability improving; digital advertising recovering. AI-generated content is both a risk and opportunity.",
  "Basic Materials": "China stimulus uncertain; commodity prices range-bound. Quality producers with low-cost assets are preferred.",
  "Real Estate": "Rate sensitivity remains high; cap rate compression reversing. Data centres and industrial REITs outperforming.",
  "Utilities": "AI data centre power demand is a genuine secular tailwind. Regulated utilities benefiting from higher allowed returns.",
};

function CompanyIntelPanel({ ticker, co }: { ticker: string; co?: any }) {
  const intel = getCompanyIntel(ticker, co?.sector, co?.industry);

  if (intel) {
    return (
      <div className="space-y-2.5">
        <div className="p-3 rounded-lg bg-secondary/20 border border-border/40">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400" /> About {ticker}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{intel.description}</p>
          <div className="mt-2 text-xs text-muted-foreground/70 font-mono">CEO: {intel.ceo}</div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-lg bg-secondary/20 border border-border/40">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1.5 uppercase tracking-wider">
              <Flag className="w-3 h-3 text-primary" /> Key Products
            </div>
            <ul className="space-y-0.5">
              {intel.keyProducts.slice(0, 4).map((p, i) => (
                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary/60 mt-0.5 shrink-0">•</span>{p}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-secondary/20 border border-border/40">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1.5 uppercase tracking-wider">
              <Users className="w-3 h-3 text-orange-400" /> Competitors
            </div>
            <ul className="space-y-0.5">
              {intel.competitors.slice(0, 3).map((c, i) => (
                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <span className="text-orange-400/60 mt-0.5 shrink-0">•</span>{c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500 mb-1.5 uppercase tracking-wider">
            <Lock className="w-3 h-3" /> Competitive Moat
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{intel.moat}</p>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-500 mb-1.5 uppercase tracking-wider">
            <AlertCircle className="w-3 h-3" /> Key Risk
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{intel.keyRisk}</p>
        </div>
      </div>
    );
  }

  const macro = co?.sector ? SECTOR_MACRO[co.sector] : null;
  if (!macro) return null;

  return (
    <div className="p-3 rounded-lg bg-secondary/20 border border-border/40">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
        <Globe className="w-3.5 h-3.5 text-violet-400" /> {co?.sector ?? ""} sector context
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{macro}</p>
    </div>
  );
}

function RegimeBannerSignals() {
  const { data: regimeData } = useGetMarketRegime();
  const regime = (regimeData as any)?.regime as string | undefined;
  const composite = (regimeData as any)?.compositeScore as number | undefined;
  if (!regime) return null;

  const cfg: Record<string, { label: string; cls: string; tip: string }> = {
    BULL:     { label: "Bull Market",     cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", tip: "Momentum-favoured regime — Rocket overweighted." },
    BEAR:     { label: "Bear Market",     cls: "bg-red-500/10 border-red-500/30 text-red-300",             tip: "Defensive regime — Fortress overweighted." },
    RECOVERY: { label: "Early Recovery",  cls: "bg-blue-500/10 border-blue-500/30 text-blue-300",          tip: "Transitional regime — balanced with growth lean." },
    NEUTRAL:  { label: "Neutral Market",  cls: "bg-secondary border-border text-muted-foreground",         tip: "No clear trend — equal weight applied." },
  };
  const c = cfg[regime] ?? cfg.NEUTRAL;
  return (
    <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border ${c.cls}`}>
      <span className="font-semibold">{c.label}</span>
      <span className="text-[11px] opacity-70">{c.tip}</span>
      {composite != null && <span className="font-mono ml-2">{composite.toFixed(2)}</span>}
    </div>
  );
}

function SignalsLayout({ title, description, icon: Icon, color, children, count }: any) {
  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl border ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">{title}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
            </div>
          </div>
          {count != null && (
            <div className="text-right">
              <div className="text-3xl font-bold font-mono text-foreground">{count}</div>
              <div className="text-xs text-muted-foreground">active signals</div>
            </div>
          )}
        </div>
        <RegimeBannerSignals />
        {children}
      </div>
    </Layout>
  );
}

// ─── Drift Signals ────────────────────────────────────────────────────────────

export function DriftSignals() {
  const { data, isLoading } = useListDriftSignals();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <SignalsLayout
      title="Factor Drift Detector"
      description="Early warning system flagging fundamental deterioration before it reflects in price."
      icon={Activity}
      color="bg-amber-500/10 border-amber-500/30 text-amber-400"
      count={data?.signals.length}
    >
      <div className="space-y-3">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="h-28 bg-secondary/50 animate-pulse rounded-xl" />)
        ) : (data?.signals.length ?? 0) === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl">
            <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No factor drift detected in universe.</p>
          </div>
        ) : (
          data?.signals.map((signal: any, idx: number) => {
            const ctx = getDriftContext(signal.factorName);
            const co  = signal.company;
            const isOpen = expanded.has(idx);
            const pctDelta = (signal.currentValue != null && signal.historicalAvg != null && signal.historicalAvg !== 0)
              ? ((signal.currentValue - signal.historicalAvg) / Math.abs(signal.historicalAvg)) * 100
              : null;

            const frag = fragilityLabel(co?.fragilityScore);
            const mis  = mispricingLabel(co?.mispricingScore);

            return (
              <Card key={idx} className={`border transition-all ${signal.severity === 'high' ? 'border-red-500/30 bg-red-950/10' : 'border-amber-500/20 bg-amber-950/10'}`}>
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${signal.severity === 'high' ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                        <ShieldAlert className={`w-4 h-4 ${signal.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-lg font-mono text-primary">{signal.ticker}</span>
                          {co && <span className="text-sm text-foreground font-medium truncate">{co.name}</span>}
                          <Badge className={signal.severity === 'high'
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/20 text-[11px]'
                            : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-[11px]'}>
                            {signal.severity.toUpperCase()} SEVERITY
                          </Badge>
                        </div>
                        {co && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <span>{countryFlag(co.country)} {co.country}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{co.sector}</span>
                            {co.industry !== "Unknown" && <><span>·</span><span>{co.industry}</span></>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                        {format(new Date(signal.date), 'MMM d, yyyy')}
                      </span>
                      <button
                        onClick={() => toggle(idx)}
                        className="p-1 rounded-lg hover:bg-secondary/60 transition-colors"
                      >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Signal summary */}
                  <div className="mt-3 ml-9">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-[11px] font-mono">{signal.factorName || signal.signalType}</Badge>
                    </div>
                    <p className="text-sm text-foreground/80">{signal.description}</p>

                    {/* Current vs Historical */}
                    {signal.currentValue != null && signal.historicalAvg != null && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="bg-secondary/30 rounded-lg p-2 text-center border border-border/40">
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Current</div>
                          <div className={`text-sm font-mono font-bold ${signal.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                            {signal.currentValue.toFixed(3)}
                          </div>
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-2 text-center border border-border/40">
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Hist Avg</div>
                          <div className="text-sm font-mono text-muted-foreground">{signal.historicalAvg.toFixed(3)}</div>
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-2 text-center border border-border/40">
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Change</div>
                          <div className={`text-sm font-mono font-bold ${(pctDelta ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {pctDelta != null ? `${pctDelta >= 0 ? '+' : ''}${pctDelta.toFixed(1)}%` : '—'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fragility + Mispricing inline preview */}
                    {co && (co.fragilityScore != null || co.mispricingScore != null) && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {co.fragilityScore != null && (
                          <div className={`p-2 rounded-lg border text-center ${frag.color.includes('red') ? 'bg-red-500/5 border-red-500/20' : frag.color.includes('orange') ? 'bg-orange-500/5 border-orange-500/20' : 'bg-secondary/20 border-border/40'}`}>
                            <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Thesis Fragility</div>
                            <div className={`text-xs font-semibold mt-0.5 ${frag.color}`}>{frag.label}</div>
                          </div>
                        )}
                        {co.mispricingScore != null && (
                          <div className={`p-2 rounded-lg border text-center ${mis.color.includes('emerald') ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-secondary/20 border-border/40'}`}>
                            <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Mispricing Edge</div>
                            <div className={`text-xs font-semibold mt-0.5 ${mis.color}`}>{mis.label}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="mt-4 ml-9 space-y-3">
                      {ctx && (
                        <>
                          <div className="p-3 rounded-lg bg-secondary/20 border border-border/40">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                              <Info className="w-3.5 h-3.5 text-blue-400" /> What this means
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{ctx.meaning}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1.5">
                              <Zap className="w-3.5 h-3.5" /> Recommended action
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{ctx.action}</p>
                          </div>
                        </>
                      )}
                      <SixLayerIntelligence co={co} />
                      <CompanyIntelPanel ticker={signal.ticker} co={co} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </SignalsLayout>
  );
}

// ─── Opportunity Alerts ───────────────────────────────────────────────────────

const ENGINE_CFG = {
  fortress: { color: "emerald", label: "Long-Term Compounder", icon: Shield, threshold: 0.70, why: "This company has crossed the Fortress quality threshold — indicating impenetrable moats, high ROIC, and consistent free cash flow generation. Fortress stocks tend to compound quietly and outperform in risk-off environments." },
  rocket:   { color: "orange",  label: "High-Growth Innovator", icon: Rocket, threshold: 0.65, why: "Rocket score has crossed the growth threshold — signalling rapid revenue acceleration, high R&D intensity, and expanding addressable markets. Best suited for growth allocations with 3–5 year time horizons." },
  wave:     { color: "cyan",    label: "Tactical Momentum",     icon: Waves,  threshold: 0.60, why: "Wave score has crossed the momentum threshold — indicating positive price momentum, improving sentiment, and a favourable technical setup. Wave plays are tactical (6–12 month horizon) and require tighter stop losses." },
};

export function OpportunityAlerts() {
  const { data, isLoading } = useListOpportunityAlerts();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <SignalsLayout
      title="Investment Intelligence"
      description="Buy-list candidates evaluated through a 6-layer framework: Quality · Opportunity · Expectation · Mispricing · Fragility · Position Size."
      icon={TrendingUp}
      color="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
      count={data?.alerts.length}
    >
      {/* Premium layer explanation banner */}
      <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/20 flex items-start gap-3">
        <Crown className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-foreground mb-1">
            6-Layer Investment Framework
            <Badge className="ml-2 bg-violet-500/15 text-violet-400 hover:bg-violet-500/15 text-[9px] border border-violet-500/20">PREMIUM</Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Beyond quality and opportunity scores, each alert is now evaluated on <strong className="text-foreground">what the market has priced in</strong> (Expectation), <strong className="text-foreground">why the market is likely wrong</strong> (Mispricing), and <strong className="text-foreground">how robust the thesis is</strong> (Fragility). The Portfolio Net Score drives position sizing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          [1,2,3,4].map(i => <div key={i} className="h-80 bg-secondary/50 animate-pulse rounded-xl" />)
        ) : (data?.alerts.length ?? 0) === 0 ? (
          <div className="col-span-2 p-12 text-center border border-dashed border-border rounded-xl">
            <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No new opportunities detected today. Run the pipeline to refresh.</p>
          </div>
        ) : (
          data?.alerts.map((alert: any, idx: number) => {
            const cfg = ENGINE_CFG[alert.engineType as keyof typeof ENGINE_CFG] ?? ENGINE_CFG.fortress;
            const co  = alert.company;
            const isNew = alert.alertType === "new_threshold_cross";
            const isOpen = expanded.has(idx);
            const entryPct = co?.entryScore != null ? Math.round(co.entryScore * 100) : null;
            const netPct = co?.portfolioNetScore != null ? Math.round(co.portfolioNetScore * 100) : null;
            const posBand = positionBandFromScore(co?.portfolioNetScore);
            const EngineIcon = cfg.icon;
            const c = cfg.color;
            const exp = expectationLabel(co?.expectationScore);
            const mis = mispricingLabel(co?.mispricingScore);
            const frag = fragilityLabel(co?.fragilityScore);

            return (
              <Card key={idx} className={`border-${c}-500/25 bg-${c}-950/5 relative overflow-hidden`}>
                <div className={`absolute inset-0 bg-gradient-to-br from-${c}-500/3 to-transparent pointer-events-none`} />
                <CardContent className="p-5 relative">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg bg-${c}-500/15 shrink-0 mt-0.5`}>
                        <EngineIcon className={`w-4 h-4 text-${c}-400`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-bold text-xl font-mono text-foreground">{alert.ticker}</span>
                          {isNew && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 text-[9px] font-bold">
                              NEW CROSS
                            </Badge>
                          )}
                          <Badge className={`bg-${c}-500/20 text-${c}-400 hover:bg-${c}-500/20 text-[11px]`}>
                            {cfg.label}
                          </Badge>
                        </div>
                        {co && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                            <span>{countryFlag(co.country)}</span>
                            <span className="font-medium text-foreground/70">{co.name}</span>
                            <span>·</span>
                            <span>{co.sector}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Net Score + Position Band */}
                    <div className="text-right shrink-0">
                      {netPct != null && posBand ? (
                        <>
                          <div className={`text-2xl font-mono font-bold text-${posBand.color}-400`}>{netPct}</div>
                          <div className="text-[9px] text-muted-foreground">net score</div>
                          <div className={`text-[10px] font-semibold mt-0.5 text-${posBand.color}-400`}>{posBand.label}</div>
                        </>
                      ) : alert.score != null ? (
                        <>
                          <div className={`text-2xl font-mono font-bold text-${c}-400`}>{(alert.score * 100).toFixed(0)}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">/ 100</div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* 4-factor quick grid */}
                  {co && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="space-y-1">
                        <ScoreBar label="Quality" value={co.companyQualityScore ?? co.fortressScore} color="text-emerald-400" />
                        <ScoreBar label="Opportunity" value={co.stockOpportunityScore ?? co.waveScore} color="text-blue-400" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground flex items-center gap-1"><Eye className="w-2.5 h-2.5" />Expectation</span>
                          {co.expectationScore != null && <span className={`font-semibold ${exp.color}`}>{exp.label}</span>}
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground flex items-center gap-1"><Target className="w-2.5 h-2.5" />Mispricing</span>
                          {co.mispricingScore != null && <span className={`font-semibold ${mis.color}`}>{mis.label}</span>}
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground flex items-center gap-1"><ShieldAlert className="w-2.5 h-2.5" />Fragility</span>
                          {co.fragilityScore != null && <span className={`font-semibold ${frag.color}`}>{frag.label}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Position Band */}
                  {posBand && netPct != null && (
                    <div className={`mb-3 px-3 py-2 rounded-lg border flex items-center justify-between ${
                      posBand.band === "core"     ? "bg-emerald-500/5 border-emerald-500/20" :
                      posBand.band === "standard" ? "bg-blue-500/5 border-blue-500/20" :
                      posBand.band === "starter"  ? "bg-amber-500/5 border-amber-500/20" :
                                                    "bg-secondary/20 border-border/40"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <Star className={`w-3 h-3 text-${posBand.color}-400`} />
                        <span className={`text-xs font-semibold text-${posBand.color}-400`}>{posBand.label} position</span>
                      </div>
                      <span className={`text-[11px] font-mono text-${posBand.color}-400`}>
                        {posBand.minPct}–{posBand.maxPct}% allocation
                      </span>
                    </div>
                  )}

                  {/* Entry timing (fallback) */}
                  {entryPct != null && netPct == null && (
                    <div className={`mb-3 p-2.5 rounded-lg border ${entryPct >= 65 ? 'bg-emerald-500/5 border-emerald-500/20' : entryPct >= 45 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-secondary/20 border-border/40'}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Entry timing</span>
                        <span className={`font-mono font-bold ${entryPct >= 65 ? 'text-emerald-400' : entryPct >= 45 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                          {entryPct >= 65 ? 'FAVOURABLE' : entryPct >= 45 ? 'NEUTRAL' : 'EARLY'} ({entryPct}/100)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Toggle */}
                  <button
                    onClick={() => toggle(idx)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isOpen ? 'Less detail' : 'Full thesis analysis'}
                  </button>

                  {isOpen && (
                    <div className="mt-3 space-y-2.5">
                      {/* Engine rationale */}
                      <div className="p-3 rounded-lg bg-secondary/20 border border-border/40">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                          <Info className="w-3.5 h-3.5 text-blue-400" /> Why this crossed the threshold
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{cfg.why}</p>
                      </div>

                      {/* Full 6-layer intelligence */}
                      <SixLayerIntelligence co={co} />

                      {/* Company intel */}
                      <CompanyIntelPanel ticker={alert.ticker} co={co} />

                      {/* Suggested action */}
                      <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1.5">
                          <Zap className="w-3.5 h-3.5" /> Suggested action
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {posBand?.band === "core"
                            ? `High-conviction setup. Consider a full ${posBand.minPct}–${posBand.maxPct}% core position. This is the type of compound-and-hold candidate that drives long-term outperformance.`
                            : posBand?.band === "standard"
                            ? `Quality opportunity. Initiate a standard ${posBand.minPct}–${posBand.maxPct}% position. Monitor for mispricing evidence to confirm and size up.`
                            : posBand?.band === "starter"
                            ? `Emerging setup. Start small (${posBand.minPct}–${posBand.maxPct}%) and add as the thesis confirms. Avoid full sizing before evidence crystallises.`
                            : entryPct != null && entryPct >= 65
                            ? `Entry timing is favourable (${entryPct}/100). Consider initiating a full position or adding to an existing one.`
                            : entryPct != null && entryPct >= 45
                            ? `Entry timing is neutral (${entryPct}/100). Consider a half position now and scale in on weakness.`
                            : `Quality is confirmed but wait for a better technical entry or add in tranches.`}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </SignalsLayout>
  );
}

// ─── Risk Alerts ──────────────────────────────────────────────────────────────

function parseSeverity(sig: string): "high" | "medium" {
  return sig.startsWith("[HIGH]") ? "high" : "medium";
}
function parseSignalText(sig: string): string {
  return sig.replace(/^\[HIGH\]\s*/, "").replace(/^\[MEDIUM\]\s*/, "");
}

export function RiskAlerts() {
  const { data, isLoading } = useListRiskAlerts();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <SignalsLayout
      title="Risk Alerts"
      description="Critical warnings for companies exhibiting multiple concurrent deterioration signals."
      icon={AlertTriangle}
      color="bg-red-500/10 border-red-500/30 text-red-400"
      count={data?.alerts.length}
    >
      <div className="space-y-3">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="h-24 bg-secondary/50 animate-pulse rounded-xl" />)
        ) : (data?.alerts.length ?? 0) === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl">
            <AlertTriangle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Universe clear of critical risk alerts.</p>
          </div>
        ) : (
          data?.alerts.map((alert: any, idx: number) => {
            const co      = alert.company;
            const isCrit  = alert.riskLevel === "critical";
            const isOpen  = expanded.has(idx);
            const signals: string[] = alert.signals ?? [];
            const highSigs   = signals.filter(s => parseSeverity(s) === "high");
            const mediumSigs = signals.filter(s => parseSeverity(s) === "medium");
            const frag = fragilityLabel(co?.fragilityScore);
            const mis  = mispricingLabel(co?.mispricingScore);

            return (
              <Card key={idx} className={`border transition-all ${isCrit ? 'border-red-500/40 bg-red-950/15' : 'border-orange-500/30 bg-orange-950/10'}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg shrink-0 ${isCrit ? 'bg-red-500/20' : 'bg-orange-500/15'}`}>
                        <AlertTriangle className={`w-4 h-4 ${isCrit ? 'text-red-400' : 'text-orange-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-bold text-lg font-mono text-primary">{alert.ticker}</span>
                          {co && <span className="text-sm font-medium text-foreground/80">{co.name}</span>}
                          <Badge className={isCrit
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/20'
                            : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/20'}>
                            {isCrit ? 'CRITICAL RISK' : 'ELEVATED RISK'}
                          </Badge>
                        </div>
                        {co && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{countryFlag(co.country)} {co.country}</span>
                            <span>·</span>
                            <span>{co.sector}</span>
                            {co.industry !== "Unknown" && <><span>·</span><span>{co.industry}</span></>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className={`text-lg font-bold font-mono ${isCrit ? 'text-red-400' : 'text-orange-400'}`}>
                          {alert.activeSignalCount}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase">signals</div>
                      </div>
                      <button
                        onClick={() => toggle(idx)}
                        className="p-1 rounded-lg hover:bg-secondary/60 transition-colors"
                      >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Signal count pills */}
                  <div className="mt-3 ml-9 flex items-center gap-2 flex-wrap">
                    {highSigs.length > 0 && (
                      <span className="text-[11px] bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5 font-medium">
                        {highSigs.length} High severity
                      </span>
                    )}
                    {mediumSigs.length > 0 && (
                      <span className="text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 font-medium">
                        {mediumSigs.length} Medium severity
                      </span>
                    )}
                    {/* Fragility pill */}
                    {co?.fragilityScore != null && (
                      <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium border ${
                        co.fragilityScore >= 0.6 ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        co.fragilityScore >= 0.4 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-secondary text-muted-foreground border-border/40'
                      }`}>
                        Fragility: {frag.label}
                      </span>
                    )}
                    {co && co.fortressScore != null && (
                      <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium border ${co.fortressScore >= 0.6 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-secondary text-muted-foreground border-border/40'}`}>
                        Quality: {(co.fortressScore * 100).toFixed(0)}/100
                      </span>
                    )}
                    {/* Mispricing pill — even in risk context, mispricing can indicate oversold */}
                    {co?.mispricingScore != null && co.mispricingScore >= 0.55 && (
                      <span className="text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2 py-0.5 font-medium">
                        Possible oversell: {mis.label}
                      </span>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="mt-4 ml-9 space-y-3">
                      {/* Individual signals */}
                      {signals.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-foreground mb-2">Active risk signals</div>
                          <div className="space-y-1.5">
                            {signals.map((sig, si) => {
                              const sev = parseSeverity(sig);
                              const txt = parseSignalText(sig);
                              return (
                                <div key={si} className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${sev === 'high' ? 'bg-red-950/20 border-red-500/20' : 'bg-secondary/20 border-border/40'}`}>
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${sev === 'high' ? 'bg-red-400' : 'bg-amber-400'}`} />
                                  <span className="text-foreground/80 leading-relaxed">{txt}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 6-layer intelligence (shows fragility prominently) */}
                      <SixLayerIntelligence co={co} />

                      {/* Recommended action */}
                      <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 mb-1.5">
                          <Zap className="w-3.5 h-3.5" /> Recommended action
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {isCrit
                            ? "Multiple critical signals warrant immediate portfolio review. Consider reducing position sizing or exiting until fundamental stabilisation is confirmed. Do not average down."
                            : "Elevated concurrent signals require close monitoring. Avoid adding to the position. Set a review trigger on the next earnings release or price break below key support."}
                        </p>
                      </div>

                      {/* Company intelligence */}
                      <CompanyIntelPanel ticker={alert.ticker} co={co} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </SignalsLayout>
  );
}
