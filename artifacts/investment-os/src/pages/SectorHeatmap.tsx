import { useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useListFactorSnapshots } from "@workspace/api-client-react";
import { Loader2, LayoutGrid } from "lucide-react";

function scoreColor(score: number): string {
  if (score >= 0.75) return "bg-emerald-500/25 border-emerald-500/30 text-emerald-300";
  if (score >= 0.60) return "bg-emerald-500/12 border-emerald-500/20 text-emerald-400";
  if (score >= 0.45) return "bg-amber-500/15 border-amber-500/25 text-amber-300";
  if (score >= 0.30) return "bg-orange-500/10 border-orange-500/20 text-orange-400";
  return "bg-red-500/8 border-red-500/15 text-red-400";
}

function ScorePill({ label, value, color }: { label: string; value: number | null; color: string }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${color}`}>{value.toFixed(2)}</span>
    </div>
  );
}

function avg(vals: (number | null | undefined)[]): number | null {
  const valid = vals.filter((v): v is number => v != null && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export default function SectorHeatmap() {
  const { data, isLoading } = useListFactorSnapshots(
    { limit: 500 },
    { query: { refetchOnWindowFocus: false } }
  );

  const sectors = useMemo(() => {
    if (!data?.snapshots) return [];

    const map = new Map<string, typeof data.snapshots>();
    for (const s of data.snapshots) {
      const key = s.sector ?? "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }

    return Array.from(map.entries())
      .map(([name, items]) => ({
        name,
        count: items.length,
        fortress: avg(items.map(i => i.fortressScore)),
        rocket:   avg(items.map(i => i.rocketScore)),
        wave:     avg(items.map(i => i.waveScore)),
        entry:    avg(items.map(i => i.entryScore)),
        momentum: avg(items.map(i => i.momentumScore)),
        topTickers: items
          .sort((a, b) => ((b.fortressScore ?? 0) + (b.rocketScore ?? 0)) - ((a.fortressScore ?? 0) + (a.rocketScore ?? 0)))
          .slice(0, 3)
          .map(i => i.ticker),
      }))
      .sort((a, b) => (b.fortress ?? 0) - (a.fortress ?? 0));
  }, [data]);

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight mb-1">Sector Heatmap</h1>
          <p className="text-muted-foreground text-sm">Average factor scores per sector. Darker green = stronger universe coverage.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : sectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3 border border-dashed border-border rounded-xl">
            <LayoutGrid className="w-10 h-10 opacity-30" />
            <p>No sector data available.</p>
            <p className="text-xs">Seed the universe and run the pipeline to see the heatmap.</p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: "Sectors", value: sectors.length.toString(), sub: "tracked" },
                { label: "Companies", value: data?.count?.toString() ?? "—", sub: "scored" },
                { label: "Best Fortress", value: sectors[0]?.name ?? "—", sub: sectors[0]?.fortress?.toFixed(2) ?? "", mono: false },
              ].map(s => (
                <div key={s.label} className="col-span-1 rounded-xl border border-border bg-card p-4 text-center md:col-span-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{s.label}</div>
                  <div className={`text-xl font-bold ${s.mono !== false ? "font-mono" : ""}`}>{s.value}</div>
                  {s.sub && <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sectors.map(s => {
                const fortressColor = s.fortress != null ? scoreColor(s.fortress) : "bg-secondary border-border";
                return (
                  <div
                    key={s.name}
                    className={`rounded-xl border p-4 transition-all hover:scale-[1.01] ${fortressColor}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-sm text-foreground">{s.name}</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.count} companies</p>
                      </div>
                      {s.fortress != null && (
                        <div className={`text-xl font-mono font-bold`}>{s.fortress.toFixed(2)}</div>
                      )}
                    </div>

                    <div className="space-y-1.5 mb-3">
                      <ScorePill label="Fortress" value={s.fortress} color={s.fortress != null ? (s.fortress >= 0.6 ? "text-emerald-400" : "text-amber-400") : ""} />
                      <ScorePill label="Rocket"   value={s.rocket}   color={s.rocket   != null ? (s.rocket   >= 0.6 ? "text-orange-400" : "text-amber-400") : ""} />
                      <ScorePill label="Wave"     value={s.wave}     color={s.wave     != null ? (s.wave     >= 0.5 ? "text-cyan-400"   : "text-blue-400")  : ""} />
                      <ScorePill label="Momentum" value={s.momentum} color={s.momentum != null ? (s.momentum >= 0.5 ? "text-violet-400" : "text-muted-foreground") : ""} />
                    </div>

                    {s.topTickers.length > 0 && (
                      <div className="border-t border-white/10 pt-2.5">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Top picks</p>
                        <div className="flex gap-1 flex-wrap">
                          {s.topTickers.map(t => (
                            <span key={t} className="font-mono text-[9px] px-1.5 py-0.5 bg-black/20 rounded border border-white/10">{t}</span>
                          ))}
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
