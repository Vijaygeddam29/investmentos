import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { TrendingDown, DollarSign, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioPoint {
  day: number;
  pnl: number;
  theoretical: number;
}

interface Scenario {
  label: string;
  dte: number;
  strike: number;
  premium: number;
  premiumPerContract: number;
  annualizedROC: number;
  capitalRequired: number;
  probabilityProfit: number | null;
  iv: number | null;
  delta: number | null;
  curve: ScenarioPoint[];
  color: string;
}

interface ScenariosResult {
  ticker: string;
  currentPrice: number;
  compareBy: "dte" | "premium";
  scenarios: Scenario[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  ticker: string;
  strategy?: string;
}

// ─── Chart data builder ───────────────────────────────────────────────────────

function buildChartData(scenarios: Scenario[]): Record<string, number | undefined>[] {
  if (!scenarios.length) return [];
  const maxDte = Math.max(...scenarios.map((s) => s.dte));
  const rows: Record<string, number | undefined>[] = [];
  for (let day = 0; day <= maxDte; day++) {
    const row: Record<string, number | undefined> = { day };
    for (const s of scenarios) {
      const pt = s.curve.find((p) => p.day === day);
      row[s.label] = pt ? Math.round(pt.pnl * 100) / 100 : undefined;
    }
    rows.push(row);
  }
  return rows;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1420] border border-slate-700 rounded-lg px-3 py-2 text-xs space-y-1">
      <p className="text-muted-foreground">Day {label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">${p.value?.toFixed(0)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Metric row ───────────────────────────────────────────────────────────────

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center space-y-0.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${color ?? "text-white"}`}>{value}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScenarioCompareModal({ open, onClose, ticker, strategy }: Props) {
  const [compareBy, setCompareBy] = useState<"dte" | "premium">("dte");
  const side = strategy === "SELL_CALL" ? "call" : "put";

  const { data, isLoading, error } = useQuery<ScenariosResult>({
    queryKey: ["options-scenarios", ticker, compareBy, side],
    queryFn: async () => {
      const r = await fetch(
        `/api/options/scenarios/${ticker}?compareBy=${compareBy}&side=${side}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` } },
      );
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed to load scenarios");
      return r.json();
    },
    enabled: open && !!ticker,
    staleTime: 15 * 60 * 1000,
  });

  const scenarios = data?.scenarios ?? [];
  const chartData = buildChartData(scenarios);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-[#0f1420] border-slate-700 text-white p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-emerald-400" />
            Scenario Comparison — {ticker}
            {data?.currentPrice && (
              <span className="text-muted-foreground text-sm font-normal ml-1">
                @ ${data.currentPrice.toFixed(2)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="px-6 pt-3 pb-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Compare by:</span>
          <button
            onClick={() => setCompareBy("dte")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              compareBy === "dte"
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                : "text-muted-foreground border border-slate-700 hover:border-slate-600"
            }`}
          >
            DTE (7 / 15 / 30 days)
          </button>
          <button
            onClick={() => setCompareBy("premium")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              compareBy === "premium"
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                : "text-muted-foreground border border-slate-700 hover:border-slate-600"
            }`}
          >
            Premium level ($3 / $4.50 / $6 per share)
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Fetching live option chain data…
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-red-400 text-sm">
              {(error as Error).message}
            </div>
          )}

          {!isLoading && !error && scenarios.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No scenario data available for {ticker}
            </div>
          )}

          {!isLoading && scenarios.length > 0 && (
            <>
              {/* Theta decay chart */}
              <div className="rounded-xl bg-slate-900/50 border border-slate-700/50 p-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Theta decay P&amp;L per contract (x-axis = days from open, y-axis = profit $)
                  · Dot = 50% profit target
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      label={{ value: "Days", position: "insideBottomRight", offset: -5, fill: "#64748b", fontSize: 10 }}
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      tickFormatter={(v) => `$${v}`}
                      width={45}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    />
                    {/* 50% profit target reference */}
                    {scenarios.map((s) => (
                      <ReferenceLine
                        key={`ref50-${s.label}`}
                        y={Math.round(s.premiumPerContract * 0.5)}
                        stroke={s.color}
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                      />
                    ))}
                    {/* Max-loss stop (lose 1× premium = net -premium) */}
                    {scenarios.length > 0 && (
                      <ReferenceLine
                        y={-Math.round(scenarios[0].premiumPerContract)}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        strokeOpacity={0.7}
                        label={{ value: "Max loss stop", position: "insideTopLeft", fill: "#ef4444", fontSize: 10 }}
                      />
                    )}
                    {scenarios.map((s) => (
                      <Line
                        key={s.label}
                        type="monotone"
                        dataKey={s.label}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground mt-1 text-center">
                  Dashed lines = 50% profit target per scenario · Theta decay modelled with square-root-of-time approximation
                </p>
              </div>

              {/* 3-column comparison table */}
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${scenarios.length}, 1fr)` }}>
                {scenarios.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border p-4 space-y-3"
                    style={{
                      borderColor: `${s.color}40`,
                      backgroundColor: `${s.color}08`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-sm font-bold text-white">{s.label}</span>
                    </div>

                    <div className="space-y-2">
                      <MetricCell
                        label="Strike"
                        value={`$${s.strike.toFixed(2)}`}
                        color="text-white"
                      />
                      <MetricCell
                        label="Premium / contract"
                        value={`$${s.premiumPerContract.toFixed(0)}`}
                        color="text-emerald-400"
                      />
                      <MetricCell
                        label="Annualised ROC"
                        value={`${s.annualizedROC.toFixed(1)}%`}
                        color={s.annualizedROC >= 20 ? "text-emerald-400" : s.annualizedROC >= 10 ? "text-amber-400" : "text-slate-400"}
                      />
                      <MetricCell
                        label="Capital required"
                        value={`$${s.capitalRequired.toLocaleString()}`}
                      />
                      <MetricCell
                        label="Prob of profit"
                        value={s.probabilityProfit != null ? `${s.probabilityProfit}%` : "–"}
                        color={
                          s.probabilityProfit != null && s.probabilityProfit >= 70
                            ? "text-emerald-400"
                            : s.probabilityProfit != null && s.probabilityProfit >= 50
                              ? "text-amber-400"
                              : "text-slate-400"
                        }
                      />
                      {s.iv != null && (
                        <MetricCell label="IV" value={`${s.iv}%`} />
                      )}
                      <MetricCell
                        label="50% profit day"
                        value={`≈ day ${Math.round(s.dte * 0.75)}`}
                        color="text-blue-400"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                Data from Yahoo Finance · Prices are indicative, not guaranteed · Always confirm before trading
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
