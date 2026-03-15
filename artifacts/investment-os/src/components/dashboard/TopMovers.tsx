import { useState } from "react";
import { useListTopMovers, ListTopMoversEngine } from "@workspace/api-client-react";
import { TrendingUp, Shield, Rocket, Waves, Zap } from "lucide-react";
import { Loader2 } from "lucide-react";

const ENGINES: { value: ListTopMoversEngine; label: string; icon: typeof Shield; color: string }[] = [
  { value: ListTopMoversEngine.fortress, label: "Fortress", icon: Shield,  color: "text-emerald-400" },
  { value: ListTopMoversEngine.rocket,   label: "Rocket",   icon: Rocket,  color: "text-orange-400"  },
  { value: ListTopMoversEngine.wave,     label: "Wave",     icon: Waves,   color: "text-cyan-400"    },
  { value: ListTopMoversEngine.entry,    label: "Entry",    icon: Zap,     color: "text-violet-400"  },
];

interface Props {
  onTickerClick?: (ticker: string) => void;
  country?: string;
}

export function TopMovers({ onTickerClick, country }: Props) {
  const [engine, setEngine] = useState<ListTopMoversEngine>(ListTopMoversEngine.fortress);

  const { data, isLoading } = useListTopMovers(
    { engine, limit: 8, min_delta: 0.005, country },
    { query: { refetchOnWindowFocus: false } }
  );

  const movers = data?.movers ?? [];
  const engineInfo = ENGINES.find(e => e.value === engine)!;

  const scoreForEngine = (m: typeof movers[0]) => {
    switch (engine) {
      case ListTopMoversEngine.rocket:  return m.rocketScore;
      case ListTopMoversEngine.wave:    return m.waveScore;
      case ListTopMoversEngine.entry:   return m.entryScore;
      default:                          return m.fortressScore;
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Momentum &amp; Quality Improving</h3>
        </div>
        <div className="flex gap-1">
          {ENGINES.map(e => {
            const Icon = e.icon;
            return (
              <button
                key={e.value}
                onClick={() => setEngine(e.value)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                  engine === e.value
                    ? "bg-secondary border-primary/30 " + e.color
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="w-3 h-3" />
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : movers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
          <TrendingUp className="w-8 h-8 opacity-30" />
          <p>No improving signals detected.</p>
          <p className="text-xs">Run the pipeline multiple times to track score deltas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {movers.map(m => {
            const score = scoreForEngine(m);
            const delta = m.delta ?? 0;
            return (
              <button
                key={m.ticker}
                onClick={() => onTickerClick?.(m.ticker)}
                className="text-left p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <span className="font-mono text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {m.ticker}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    delta >= 0.05 ? "bg-emerald-500/20 text-emerald-400" :
                    delta >= 0.02 ? "bg-blue-500/20 text-blue-400" :
                                    "bg-secondary text-muted-foreground"
                  }`}>
                    +{(delta * 100).toFixed(1)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate mb-1.5">{m.name ?? m.sector ?? "—"}</div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono font-semibold ${engineInfo.color}`}>
                    {score != null ? score.toFixed(2) : "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{m.country ?? ""}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
