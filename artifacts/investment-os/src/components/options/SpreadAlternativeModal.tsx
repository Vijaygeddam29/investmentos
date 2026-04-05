import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRightLeft, Layers, Lock } from "lucide-react";

interface SpreadAlt {
  signalId: number;
  ticker: string;
  strategy: string;
  shortStrike: number;
  longStrike: number;
  spreadWidth: number;
  shortPremium: number;
  longPremium: number;
  netCredit: number;
  netCreditPerContract: number;
  maxProfit: number;
  maxLoss: number;
  capital: number;
  returnOnCapital: number;
  expiry: string;
  dte: number;
  liveData: boolean;
  description: string;
}

interface Props {
  signalId: number;
  ticker: string;
  onClose: () => void;
}

export function SpreadAlternativeModal({ signalId, ticker, onClose }: Props) {
  const { data, isLoading, error } = useQuery<SpreadAlt>({
    queryKey: ["spread-alternative", signalId],
    queryFn: async () => {
      const r = await fetch(`/api/options/signals/${signalId}/spread-alternative`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      if (!r.ok) throw new Error("Failed to fetch spread data");
      return r.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const isBullPut = data?.strategy === "BULL_PUT_SPREAD";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#1a1f2e] border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400" />
            Spread Alternative — {ticker}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            A spread limits your max loss by buying a protective leg — less income, but capped risk.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-800/40 animate-pulse" />)}
          </div>
        ) : error || !data ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Could not load spread data. The option chain may not have both legs available.
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {!data.liveData && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Long leg premium estimated — live data unavailable. Final P&L may differ slightly.
              </div>
            )}

            {/* Spread structure */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-white uppercase tracking-wider">
                {isBullPut ? "Bull Put Spread" : "Bear Call Spread"}
              </p>
              <div className="flex items-center justify-between text-sm">
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">SELL (short leg)</p>
                  <p className="text-lg font-bold text-white">${data.shortStrike}</p>
                  <p className="text-[11px] text-emerald-400">+${data.shortPremium.toFixed(2)}/sh</p>
                </div>
                <ArrowRightLeft className="w-5 h-5 text-slate-500 mx-3" />
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">BUY (protection)</p>
                  <p className="text-lg font-bold text-white">${data.longStrike}</p>
                  <p className="text-[11px] text-red-400">−${data.longPremium.toFixed(2)}/sh</p>
                </div>
              </div>
              <div className="border-t border-slate-700 pt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Net credit collected</span>
                <span className="text-base font-bold text-emerald-400">
                  ${data.netCredit.toFixed(2)}/sh · ${data.netCreditPerContract}/contract
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Max profit",        value: `$${data.maxProfit}`,         sub: `stock stays ${isBullPut ? "above" : "below"} $${data.shortStrike}`, color: "text-emerald-400" },
                { label: "Max loss (capped)", value: `$${data.maxLoss}`,           sub: `vs $${(data.shortStrike * 100).toLocaleString()} naked`,            color: "text-red-400"     },
                { label: "Capital required",  value: `$${data.capital}`,           sub: `$${data.spreadWidth} spread × 100`,                                 color: "text-white"       },
                { label: "Return on capital", value: `${data.returnOnCapital}%`,   sub: `${data.dte} DTE · ${data.expiry}`,                                  color: "text-amber-400"   },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
                </div>
              ))}
            </div>

            {/* Plain English */}
            <div className="flex items-start gap-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
              <p className="text-xs text-violet-300 leading-relaxed">{data.description}</p>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Place this spread directly in IBKR as a multi-leg order (sell ${data.shortStrike}{" "}
              {isBullPut ? "put" : "call"}, buy ${data.longStrike} {isBullPut ? "put" : "call"}).
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
