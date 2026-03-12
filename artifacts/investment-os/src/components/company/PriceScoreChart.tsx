import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PricePoint, ScoreHistoryPoint } from "@workspace/api-client-react";

interface Props {
  priceHistory: PricePoint[];
  scoreHistory: ScoreHistoryPoint[];
}

export function PriceScoreChart({ priceHistory, scoreHistory }: Props) {
  if (!priceHistory.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        No price history available. Run the pipeline first.
      </div>
    );
  }

  const scoreByDate = new Map(scoreHistory.map(s => [s.date, s]));

  const data = priceHistory.map(p => ({
    date: p.date,
    price: p.close,
    fortress: scoreByDate.get(p.date)?.fortressScore ?? null,
    rocket:   scoreByDate.get(p.date)?.rocketScore ?? null,
    wave:     scoreByDate.get(p.date)?.waveScore ?? null,
  }));

  const hasScores = scoreHistory.length > 0;
  const latestScore = scoreHistory[scoreHistory.length - 1];

  const chartData = hasScores && scoreHistory.length === 1
    ? data.map(d => ({
        ...d,
        fortress: latestScore?.fortressScore ?? null,
        rocket:   latestScore?.rocketScore ?? null,
        wave:     latestScore?.waveScore ?? null,
      }))
    : data;

  const minPrice = Math.min(...priceHistory.map(p => p.close)) * 0.95;
  const maxPrice = Math.max(...priceHistory.map(p => p.close)) * 1.05;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
  };

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <div className="w-full">
      <p className="text-xs text-muted-foreground mb-3">
        Price history (left axis) overlaid with strategy scores (right axis, 0–1 scale).
        {!hasScores && " Run the pipeline to overlay score history."}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            interval={tickInterval}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="price"
            orientation="left"
            domain={[minPrice, maxPrice]}
            tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          {hasScores && (
            <YAxis
              yAxisId="score"
              orientation="right"
              domain={[0, 1]}
              tickFormatter={v => v.toFixed(1)}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
          )}
          <Tooltip
            contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: "#9ca3af" }}
            formatter={(value: number, name: string) => {
              if (name === "price") return [`$${value.toFixed(2)}`, "Price"];
              if (name === "fortress") return [value?.toFixed(3) ?? "—", "Fortress"];
              if (name === "rocket")   return [value?.toFixed(3) ?? "—", "Rocket"];
              if (name === "wave")     return [value?.toFixed(3) ?? "—", "Wave"];
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) => {
              const map: Record<string, string> = { price: "Price", fortress: "Fortress", rocket: "Rocket", wave: "Wave" };
              return map[value] ?? value;
            }}
          />
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke="#3b82f6"
            strokeWidth={1.5}
            fill="url(#priceGrad)"
            dot={false}
            activeDot={{ r: 3 }}
          />
          {hasScores && (
            <>
              <Line yAxisId="score" type="monotone" dataKey="fortress" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray={scoreHistory.length === 1 ? "4 2" : undefined} />
              <Line yAxisId="score" type="monotone" dataKey="rocket"   stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray={scoreHistory.length === 1 ? "4 2" : undefined} />
              <Line yAxisId="score" type="monotone" dataKey="wave"     stroke="#06b6d4" strokeWidth={1.5} dot={false} strokeDasharray={scoreHistory.length === 1 ? "4 2" : undefined} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
