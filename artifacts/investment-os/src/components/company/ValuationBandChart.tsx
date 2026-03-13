import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import type { PricePoint } from "@workspace/api-client-react";
import { useTheme } from "@/lib/theme";

interface Props {
  priceHistory: PricePoint[];
  marginOfSafety?: number | null;
}

export function ValuationBandChart({ priceHistory, marginOfSafety }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const gridColor     = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
  const tickColor     = isDark ? "#6b7280" : "#4b5563";
  const axisLineColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
  const tooltipBg     = isDark ? "#1a1f2e" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";
  const ivLineColor   = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)";
  const ivLabelColor  = isDark ? "#9ca3af" : "#4b5563";

  if (!priceHistory.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        No price history available.
      </div>
    );
  }

  const latestPrice = priceHistory[priceHistory.length - 1]?.close ?? 0;

  const intrinsicValue =
    marginOfSafety != null && marginOfSafety < 1
      ? latestPrice / (1 - marginOfSafety)
      : null;

  const buyThreshold  = intrinsicValue ? intrinsicValue * 0.75  : null;
  const holdThreshold = intrinsicValue ? intrinsicValue * 1.10  : null;

  const allPrices = priceHistory.map(p => p.close);
  const allValues = [
    ...allPrices,
    ...(intrinsicValue ? [intrinsicValue, buyThreshold!, holdThreshold!] : []),
  ];

  const minY = Math.min(...allValues) * 0.90;
  const maxY = Math.max(...allValues) * 1.10;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
  };

  const tickInterval = Math.max(1, Math.floor(priceHistory.length / 8));

  const zone =
    !intrinsicValue ? null
    : latestPrice < intrinsicValue * 0.75  ? "BUY"
    : latestPrice < intrinsicValue * 1.10  ? "HOLD"
    : "SELL";

  const zoneColor: Record<string, string> = {
    BUY:  "text-emerald-400",
    HOLD: "text-amber-400",
    SELL: "text-red-400",
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          Price vs. intrinsic value (DCF). Shaded zones indicate entry quality.
        </p>
        {zone && intrinsicValue && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-muted-foreground">Intrinsic: <span className="text-foreground">${intrinsicValue.toFixed(2)}</span></span>
            <span className={`font-bold px-2 py-0.5 rounded border ${
              zone === "BUY"  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
              zone === "HOLD" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                                "bg-red-500/10 border-red-500/20 text-red-400"
            }`}>{zone} ZONE</span>
          </div>
        )}
      </div>

      {!intrinsicValue && (
        <p className="text-xs text-amber-400/70 mb-2">No DCF data — run the pipeline to compute intrinsic value.</p>
      )}

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={priceHistory} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            interval={tickInterval}
            tick={{ fill: tickColor, fontSize: 10 }}
            axisLine={{ stroke: axisLineColor }}
            tickLine={false}
          />
          <YAxis
            domain={[minY, maxY]}
            tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
            tick={{ fill: tickColor, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: ivLabelColor }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
          />

          {/* BUY zone — below 75% of intrinsic */}
          {buyThreshold != null && (
            <ReferenceArea y1={minY} y2={buyThreshold} fill="rgba(16, 185, 129, 0.08)" />
          )}
          {/* HOLD zone — 75% to 110% */}
          {buyThreshold != null && holdThreshold != null && (
            <ReferenceArea y1={buyThreshold} y2={holdThreshold} fill="rgba(245, 158, 11, 0.06)" />
          )}
          {/* SELL zone — above 110% */}
          {holdThreshold != null && (
            <ReferenceArea y1={holdThreshold} y2={maxY} fill="rgba(239, 68, 68, 0.06)" />
          )}

          {intrinsicValue != null && (
            <ReferenceLine
              y={intrinsicValue}
              stroke={ivLineColor}
              strokeDasharray="5 3"
              label={{ value: `IV $${intrinsicValue.toFixed(0)}`, fill: ivLabelColor, fontSize: 9, position: "right" }}
            />
          )}
          {buyThreshold != null && (
            <ReferenceLine
              y={buyThreshold}
              stroke="rgba(16, 185, 129, 0.5)"
              strokeDasharray="3 3"
              label={{ value: "75%  BUY", fill: "#10b981", fontSize: 9, position: "right" }}
            />
          )}
          {holdThreshold != null && (
            <ReferenceLine
              y={holdThreshold}
              stroke="rgba(239, 68, 68, 0.5)"
              strokeDasharray="3 3"
              label={{ value: "110%  SELL", fill: "#ef4444", fontSize: 9, position: "right" }}
            />
          )}

          <Line
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {intrinsicValue && (
        <div className="mt-3 flex gap-4 text-xs">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/30 inline-block" />BUY zone (&lt; 75% IV)</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500/15 border border-amber-500/25 inline-block" />HOLD zone (75–110%)</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500/15 border border-red-500/25 inline-block" />SELL zone (&gt; 110%)</div>
        </div>
      )}
    </div>
  );
}
