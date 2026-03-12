import { Target, ArrowUpRight, ArrowDownRight, Minus, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface MomentumIndicators {
  currentPrice: number | null;
  rsi14: number | null;
  ma50: number | null;
  ma200: number | null;
  high52w: number | null;
  low52w: number | null;
  rangePosition: number | null;
  pctFrom52wHigh: number | null;
  priceAboveMa50: boolean | null;
  priceAboveMa200: boolean | null;
  goldenCross: boolean | null;
  macdBullish: boolean | null;
  ret1m: number | null;
  ret3m: number | null;
  ret6m: number | null;
  ret1y: number | null;
}

interface EntryExitPanelProps {
  entryTimingScore: number | null;
  momentumIndicators: MomentumIndicators | null;
  valuation: any | null;
}

function pct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(decimals)}%`;
}

function dollar(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}

function SignalRow({ label, value, status, note, tooltip }: {
  label: string;
  value: string;
  status: "green" | "yellow" | "red" | "neutral";
  note: string;
  tooltip?: string;
}) {
  const dot = {
    green:   "bg-emerald-400",
    yellow:  "bg-amber-400",
    red:     "bg-red-400",
    neutral: "bg-slate-500",
  }[status];
  const valueColor = {
    green:   "text-emerald-400",
    yellow:  "text-amber-400",
    red:     "text-red-400",
    neutral: "text-foreground",
  }[status];
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-foreground">{label}</span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">{note}</div>
      </div>
      <span className={`text-xs font-mono font-semibold shrink-0 ${valueColor}`}>{value}</span>
    </div>
  );
}

function PriceLevelRow({ label, value, sub, highlight }: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg ${highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary/30 border border-border"}`}>
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      <div className={`text-sm font-mono font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function ValuationMultiple({ title, value, optimal, isPercentage, highlight }: {
  title: string;
  value: number | null | undefined;
  optimal: string;
  isPercentage?: boolean;
  highlight?: boolean;
}) {
  const formatted = value == null ? "—"
    : isPercentage ? `${(value * 100).toFixed(1)}%`
    : value.toFixed(1);
  return (
    <div className={`rounded-lg border p-2.5 ${highlight ? "border-primary/20 bg-primary/5" : "border-border bg-secondary/30"}`}>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{title}</div>
      <div className={`text-sm font-mono font-bold ${value == null ? "text-muted-foreground" : highlight ? "text-primary" : "text-foreground"}`}>
        {formatted}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">Optimal {optimal}</div>
    </div>
  );
}

export function EntryExitPanel({ entryTimingScore, momentumIndicators: mi, valuation }: EntryExitPanelProps) {
  if (!mi && !valuation) {
    return (
      <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
        No data available. Run the pipeline first.
      </div>
    );
  }

  const price = mi?.currentPrice ?? null;

  // ── Market Cycle ──────────────────────────────────────────────────────────
  const isBull = mi?.goldenCross === true && mi?.priceAboveMa200 === true;
  const isBear = mi?.goldenCross === false && mi?.priceAboveMa200 === false;
  const cycleLabel = isBull ? "Bull Cycle" : isBear ? "Bear Cycle" : "Transitional";
  const cycleColor = isBull
    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
    : isBear
    ? "border-red-500/30 bg-red-500/5 text-red-400"
    : "border-amber-500/30 bg-amber-500/5 text-amber-400";
  const cycleSub = isBull
    ? "MA50 > MA200 (golden cross). Price above 200-day trend. Uptrend intact — favour long positions."
    : isBear
    ? "MA50 < MA200 (death cross). Price below long-term trend. Avoid new entries; reduce risk."
    : "MA50 and MA200 converging. Trend is undefined — wait for confirmation before entering.";

  // ── RSI signal ────────────────────────────────────────────────────────────
  const rsi = mi?.rsi14 ?? null;
  const rsiStatus: "green" | "yellow" | "red" | "neutral" = rsi == null ? "neutral"
    : rsi < 30 ? "green"
    : rsi <= 65 ? "green"
    : rsi <= 75 ? "yellow"
    : "red";
  const rsiNote = rsi == null ? "Not available"
    : rsi < 30 ? "Oversold — potential bounce / high-conviction add zone"
    : rsi <= 45 ? "Mildly oversold — attractive entry window"
    : rsi <= 65 ? "Neutral — healthy entry zone, trend not extended"
    : rsi <= 75 ? "Mildly overbought — monitor; trim if other signals weak"
    : "Overbought — avoid new entries; risk of pullback";

  // ── MA50 signal ───────────────────────────────────────────────────────────
  const ma50Ratio = price && mi?.ma50 ? price / mi.ma50 : null;
  const ma50Status: "green" | "yellow" | "red" | "neutral" = ma50Ratio == null ? "neutral"
    : ma50Ratio >= 0.90 && ma50Ratio < 1.10 ? "green"
    : ma50Ratio >= 1.10 && ma50Ratio < 1.20 ? "yellow"
    : ma50Ratio >= 1.20 ? "red"
    : "yellow";
  const ma50Note = ma50Ratio == null ? "Not available"
    : ma50Ratio < 0.90 ? `${pct(ma50Ratio - 1)} from MA50 — below trend; check for support`
    : ma50Ratio < 1.0 ? `${pct(ma50Ratio - 1)} from MA50 — just below; look for reclaim`
    : ma50Ratio < 1.10 ? `+${pct(ma50Ratio - 1, 1)} above MA50 — ideal entry zone`
    : ma50Ratio < 1.20 ? `+${pct(ma50Ratio - 1, 1)} above MA50 — slightly extended; wait for pullback`
    : `+${pct(ma50Ratio - 1, 1)} above MA50 — overextended; high reversal risk`;

  // ── 52w range signal ──────────────────────────────────────────────────────
  const rp = mi?.rangePosition ?? null;
  const rpStatus: "green" | "yellow" | "red" | "neutral" = rp == null ? "neutral"
    : rp < 0.30 ? "yellow"
    : rp <= 0.80 ? "green"
    : "red";
  const rpNote = rp == null ? "Not available"
    : rp < 0.15 ? "Near 52w low — deep value or distress; verify thesis"
    : rp < 0.30 ? "Lower quartile — potential value zone; confirm fundamentals"
    : rp <= 0.60 ? "Mid-range — balanced risk/reward entry window"
    : rp <= 0.80 ? "Upper-mid range — good momentum; still reasonable entry"
    : rp <= 0.90 ? "Near 52w high — extended; wait for consolidation"
    : "At / near 52w high — momentum peak; exit caution zone";

  // ── MACD signal ───────────────────────────────────────────────────────────
  const macdStatus: "green" | "yellow" | "red" | "neutral" = mi?.macdBullish == null ? "neutral"
    : mi.macdBullish ? "green" : "red";
  const macdNote = mi?.macdBullish == null ? "Not available"
    : mi.macdBullish
    ? "MACD above signal line — bullish momentum. Entry timing confirmed by trend."
    : "MACD below signal line — bearish momentum. Wait for crossover before entering.";

  // ── Price targets ─────────────────────────────────────────────────────────
  const mos = valuation?.marginOfSafety;
  const fairValue = mos != null && price ? price / (1 - mos) : null;
  const upside = fairValue && price ? (fairValue - price) / price : null;
  const entryLow = mi?.ma50 ? mi.ma50 * 0.97 : null;
  const entryHigh = mi?.ma50 ? mi.ma50 * 1.08 : null;
  const stopLoss = mi?.ma200 && price && mi.ma200 < price ? mi.ma200 : price ? price * 0.85 : null;
  const stopLossSub = mi?.ma200 && price && mi.ma200 < price ? "200-day moving average" : "–15% from current price";

  // ── Expected holding period ───────────────────────────────────────────────
  const holdPeriod = isBull
    ? "12–24 months (bull cycle; ride the trend with trailing stop at MA200)"
    : isBear
    ? "Avoid adding; reduce position; re-evaluate on MA50 reclaim"
    : "6–12 months; wait for golden cross before extending position";

  // ── Exit checklist ────────────────────────────────────────────────────────
  const exitSignals = [
    { text: "RSI > 75 (overbought)",           triggered: rsi != null && rsi > 75 },
    { text: "Price >15% above MA50",           triggered: ma50Ratio != null && ma50Ratio > 1.15 },
    { text: "Margin of safety turns negative", triggered: mos != null && mos < 0 },
    { text: "MACD crosses below signal line",  triggered: mi?.macdBullish === false },
    { text: "Price breaks below MA200",        triggered: mi?.priceAboveMa200 === false },
  ];
  const triggeredCount = exitSignals.filter(s => s.triggered).length;

  return (
    <div className="space-y-5">

      {/* ── Entry Score Banner ── */}
      {entryTimingScore != null && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3
          ${entryTimingScore >= 0.70 ? "border-emerald-500/30 bg-emerald-500/5"
          : entryTimingScore >= 0.55 ? "border-amber-500/30 bg-amber-500/5"
          : "border-red-500/30 bg-red-500/5"}`}>
          <div className="flex items-center gap-3">
            <Target className={`w-5 h-5 shrink-0 ${
              entryTimingScore >= 0.70 ? "text-emerald-400"
              : entryTimingScore >= 0.55 ? "text-amber-400"
              : "text-red-400"}`} />
            <div>
              <div className="text-sm font-semibold">
                {entryTimingScore >= 0.70 ? "Strong Entry Signal"
                : entryTimingScore >= 0.55 ? "Moderate — Wait for Better Conditions"
                : "Poor Timing — Higher Risk of Entry Now"}
              </div>
              <div className="text-xs text-muted-foreground">
                Composite: Valuation (40%) + Momentum (35%) + Earnings Revision (25%)
              </div>
            </div>
          </div>
          <div className={`text-2xl font-mono font-bold ${
            entryTimingScore >= 0.70 ? "text-emerald-400"
            : entryTimingScore >= 0.55 ? "text-amber-400"
            : "text-red-400"}`}>
            {entryTimingScore.toFixed(2)}
          </div>
        </div>
      )}

      {/* ── Market Cycle ── */}
      <div>
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Market Cycle & Trend</h4>
        <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${cycleColor}`}>
          {isBull
            ? <ArrowUpRight className="w-5 h-5 shrink-0 mt-0.5" />
            : isBear
            ? <ArrowDownRight className="w-5 h-5 shrink-0 mt-0.5" />
            : <Minus className="w-5 h-5 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <div className="font-semibold text-sm">{cycleLabel}</div>
            <div className="text-xs mt-0.5 opacity-80">{cycleSub}</div>
            {(mi?.ret1m != null || mi?.ret3m != null || mi?.ret6m != null || mi?.ret1y != null) && (
              <div className="flex gap-4 mt-2.5 text-[11px] font-mono">
                {mi?.ret1m != null && (
                  <span>
                    <span className="opacity-60">1M </span>
                    <span className={mi.ret1m >= 0 ? "text-emerald-400" : "text-red-400"}>{pct(mi.ret1m)}</span>
                  </span>
                )}
                {mi?.ret3m != null && (
                  <span>
                    <span className="opacity-60">3M </span>
                    <span className={mi.ret3m >= 0 ? "text-emerald-400" : "text-red-400"}>{pct(mi.ret3m)}</span>
                  </span>
                )}
                {mi?.ret6m != null && (
                  <span>
                    <span className="opacity-60">6M </span>
                    <span className={mi.ret6m >= 0 ? "text-emerald-400" : "text-red-400"}>{pct(mi.ret6m)}</span>
                  </span>
                )}
                {mi?.ret1y != null && (
                  <span>
                    <span className="opacity-60">1Y </span>
                    <span className={mi.ret1y >= 0 ? "text-emerald-400" : "text-red-400"}>{pct(mi.ret1y)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Entry Signals ── */}
      <div>
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Entry Signals — When to Buy</h4>
        <div className="rounded-xl border border-border bg-secondary/20 px-3 divide-y divide-border/30">
          <SignalRow
            label="RSI (14-day)"
            value={rsi != null ? rsi.toFixed(0) : "—"}
            status={rsiStatus}
            note={rsiNote}
            tooltip="Relative Strength Index. Below 30 = oversold (buying opportunity). Above 70 = overbought (risk of pullback). 30–65 = ideal entry zone."
          />
          <SignalRow
            label="Price vs MA50"
            value={ma50Ratio != null ? `${(ma50Ratio * 100).toFixed(0)}%` : "—"}
            status={ma50Status}
            note={ma50Note}
            tooltip="How far the stock is from its 50-day moving average. Within 0–10% above MA50 is the ideal entry zone. >15% above means the move is extended."
          />
          <SignalRow
            label="52-Week Range"
            value={rp != null ? `${(rp * 100).toFixed(0)}th %ile` : "—"}
            status={rpStatus}
            note={rpNote}
            tooltip="Where the current price sits in the last 52 weeks. 30–80th percentile is the sweet spot — momentum without being at a peak."
          />
          <SignalRow
            label="MACD Momentum"
            value={mi?.macdBullish == null ? "—" : mi.macdBullish ? "Bullish" : "Bearish"}
            status={macdStatus}
            note={macdNote}
            tooltip="MACD (12/26/9) histogram. MACD above signal line = positive momentum confirming entry. Below = fading momentum, consider waiting."
          />
        </div>
      </div>

      {/* ── Price Levels ── */}
      {(price != null || entryLow != null || fairValue != null) && (
        <div>
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Price Levels & Targets</h4>
          <div className="grid grid-cols-2 gap-2">
            {price != null && (
              <PriceLevelRow label="Current Price" value={dollar(price)} sub="Live market price" highlight />
            )}
            {mi?.high52w != null && mi?.low52w != null && (
              <PriceLevelRow
                label="52-Week Range"
                value={`${dollar(mi.low52w)} – ${dollar(mi.high52w)}`}
              />
            )}
            {entryLow != null && entryHigh != null && (
              <PriceLevelRow
                label="Ideal Entry Zone"
                value={`${dollar(entryLow)} – ${dollar(entryHigh)}`}
                sub="MA50 ±5–8% band"
              />
            )}
            {stopLoss != null && (
              <PriceLevelRow
                label="Stop-Loss Level"
                value={dollar(stopLoss)}
                sub={stopLossSub}
              />
            )}
            {fairValue != null && (
              <PriceLevelRow
                label="DCF Fair Value"
                value={dollar(fairValue)}
                sub={upside != null ? `Upside to FV: ${pct(upside)}` : undefined}
              />
            )}
            {mi?.ma200 != null && (
              <PriceLevelRow
                label="200-Day MA"
                value={dollar(mi.ma200)}
                sub={mi.priceAboveMa200 ? "Price above — uptrend" : "Price below — downtrend"}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Holding Period ── */}
      <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Suggested Holding Period</div>
        <div className="text-sm text-foreground">{holdPeriod}</div>
      </div>

      {/* ── Exit Checklist ── */}
      <div>
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-2">
          Exit Signals — When to Sell
          {triggeredCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">
              {triggeredCount} triggered
            </span>
          )}
        </h4>
        <div className="rounded-xl border border-border bg-secondary/20 px-3 divide-y divide-border/30">
          {exitSignals.map((s) => (
            <div key={s.text} className="flex items-center gap-3 py-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${s.triggered ? "bg-red-400 animate-pulse" : "bg-slate-600"}`} />
              <span className={`text-xs flex-1 ${s.triggered ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                {s.text}
              </span>
              {s.triggered && (
                <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Active</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Valuation Multiples ── */}
      {valuation && (
        <div>
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Valuation Multiples</h4>
          <div className="grid grid-cols-2 gap-2">
            <ValuationMultiple title="Margin of Safety" value={valuation.marginOfSafety} isPercentage optimal="> 20%" highlight />
            <ValuationMultiple title="FCF Yield"        value={valuation.fcfYield}        isPercentage optimal="> 4%"  highlight />
            <ValuationMultiple title="Forward P/E"      value={valuation.forwardPe}                     optimal="< 20" />
            <ValuationMultiple title="PEG Ratio"        value={valuation.pegRatio}                      optimal="< 1.5" />
            <ValuationMultiple title="EV / EBITDA"      value={valuation.evToEbitda}                    optimal="< 15" />
            <ValuationMultiple title="Price / Book"     value={valuation.priceToBook}                   optimal="< 5" />
          </div>
        </div>
      )}
    </div>
  );
}
