import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, CheckCircle, XCircle, AlertTriangle, Shield, Settings, RefreshCw, PieChart, TrendingUp, PlusCircle, Trash2, Briefcase, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RiskProfile {
  profitTarget: number;
  maxLossMultiple: number;
  deltaPref: string;
  dteMin: number;
  dteMax: number;
  maxOpenPositions: number;
  marginCapPct: number;
  accountSizeUsd: number | null;
  monthlyIncomeTarget: number | null;
}

const deltaOptions = [
  { value: "conservative", label: "Conservative (0.20 delta)", desc: "Lower premium, higher probability" },
  { value: "moderate",     label: "Moderate (0.30 delta)",     desc: "Balanced premium and probability" },
  { value: "aggressive",   label: "Aggressive (0.40 delta)",   desc: "Higher premium, more assignment risk" },
];

export default function IBKRSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: ibkrStatus, isLoading: ibkrLoading } = useQuery({
    queryKey: ["ibkr-status"],
    queryFn: async () => {
      const r = await fetch("/api/ibkr/status", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
  });

  const { data: riskData, isLoading: riskLoading } = useQuery({
    queryKey: ["risk-profile"],
    queryFn: async () => {
      const r = await fetch("/api/user/risk-profile", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
  });

  const { data: regimeGuidance } = useQuery<{
    regime: string;
    headline: string;
    cashPct: number;
    sharesPct: number;
    optionsPct: number;
    notes: string[];
  }>({
    queryKey: ["regime-guidance"],
    queryFn: async () => {
      const r = await fetch("/api/options/regime-guidance", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    staleTime: 30 * 60 * 1000,
  });

  // The API returns profile fields directly (not nested). Normalize to frontend shape here.
  const profile: RiskProfile = riskData ? {
    profitTarget:       riskData.profitTargetPct       ?? 50,
    maxLossMultiple:    riskData.maxLossMultiple        ?? 2,
    deltaPref:          riskData.deltaPreference        ?? "moderate",
    dteMin:             riskData.dteMin                 ?? 21,
    dteMax:             riskData.dteMax                 ?? 35,
    maxOpenPositions:   riskData.maxPositions           ?? 5,
    marginCapPct:       riskData.marginCapPct           ?? 25,
    accountSizeUsd:     riskData.accountSizeUsd         ?? null,
    monthlyIncomeTarget: riskData.monthlyIncomeTarget   ?? null,
  } : {
    profitTarget: 50,
    maxLossMultiple: 2,
    deltaPref: "moderate",
    dteMin: 21,
    dteMax: 35,
    maxOpenPositions: 5,
    marginCapPct: 25,
    accountSizeUsd: null,
    monthlyIncomeTarget: null,
  };

  const [profitTarget, setProfitTarget]               = useState<number | null>(null);
  const [maxLoss, setMaxLoss]                         = useState<number | null>(null);
  const [deltaPref, setDeltaPref]                     = useState<string | null>(null);
  const [dteMin, setDteMin]                           = useState<number | null>(null);
  const [dteMax, setDteMax]                           = useState<number | null>(null);
  const [maxPositions, setMaxPositions]               = useState<number | null>(null);
  const [marginCap, setMarginCap]                     = useState<number | null>(null);
  const [accountSize, setAccountSize]                 = useState<string>("");
  const [accountSizeTouched, setAccountSizeTouched]   = useState(false);
  const [cashAvailable, setCashAvailable]             = useState<string>("");
  const [cashAvailableTouched, setCashAvailableTouched] = useState(false);
  const [incomeTarget, setIncomeTarget]               = useState<string>("");
  const [incomeTargetTouched, setIncomeTargetTouched] = useState(false);
  const [newHolding, setNewHolding] = useState({ ticker: "", quantity: "", avgCostBasis: "" });

  const pt   = profitTarget  ?? profile.profitTarget;
  const ml   = maxLoss       ?? profile.maxLossMultiple;
  const dp   = deltaPref     ?? profile.deltaPref;
  const dmin = dteMin        ?? profile.dteMin;
  const dmax = dteMax        ?? profile.dteMax;
  const mp   = maxPositions  ?? profile.maxOpenPositions;
  const mc   = marginCap     ?? profile.marginCapPct;
  const it   = incomeTargetTouched
    ? (incomeTarget === "" ? null : parseFloat(incomeTarget))
    : profile.monthlyIncomeTarget;
  const savedAccountSize = riskData?.accountSizeUsd ?? null;
  const as_  = accountSizeTouched
    ? (accountSize === "" ? null : parseFloat(accountSize))
    : savedAccountSize;
  const savedCashAvailable = riskData?.cashAvailableUsd ?? null;
  const ca_  = cashAvailableTouched
    ? (cashAvailable === "" ? null : parseFloat(cashAvailable))
    : savedCashAvailable;

  const updateRiskMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/user/risk-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ios_jwt")}`,
        },
        body: JSON.stringify({
          profitTarget: pt,
          profitTargetPct: pt,
          maxLossMultiple: ml,
          deltaPref: dp,
          deltaPreference: dp,
          dteMin: dmin,
          dteMax: dmax,
          maxOpenPositions: mp,
          maxPositions: mp,
          marginCapPct: mc,
          accountSizeUsd: as_,
          cashAvailableUsd: ca_,
          monthlyIncomeTarget: it,
        }),
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Risk profile saved", description: "Your preferences have been updated." });
      qc.invalidateQueries({ queryKey: ["risk-profile"] });
      qc.invalidateQueries({ queryKey: ["options-risk-dashboard"] });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  // ── Holdings ─────────────────────────────────────────────────────────────────
  const { data: holdingsData, isLoading: holdingsLoading } = useQuery<{ holdings: Array<{ id: number; ticker: string; quantity: number; avgCostBasis: number | null; notes: string | null }> }>({
    queryKey: ["broker-holdings"],
    queryFn: async () => {
      const r = await fetch("/api/broker/holdings", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
  });
  const holdings = holdingsData?.holdings ?? [];

  const addHoldingMutation = useMutation({
    mutationFn: async (body: { ticker: string; quantity: number; avgCostBasis?: number }) => {
      const r = await fetch("/api/broker/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to add holding");
      return d;
    },
    onSuccess: () => {
      setNewHolding({ ticker: "", quantity: "", avgCostBasis: "" });
      qc.invalidateQueries({ queryKey: ["broker-holdings"] });
      qc.invalidateQueries({ queryKey: ["covered-calls"] });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteHoldingMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/broker/holdings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broker-holdings"] });
      qc.invalidateQueries({ queryKey: ["covered-calls"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/ibkr/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
    },
    onSuccess: () => {
      toast({ title: "IBKR disconnected" });
      qc.invalidateQueries({ queryKey: ["ibkr-status"] });
    },
  });

  const connected = ibkrStatus?.connected ?? false;

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Trading Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Connect IBKR and configure your options risk profile</p>
        </div>

        {/* IBKR Connection */}
        <Card className="bg-[#1a1f2e] border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-400" />
              IBKR Account Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ibkrLoading ? (
              <div className="h-12 rounded-lg bg-slate-800/40 animate-pulse" />
            ) : connected ? (
              <>
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-emerald-400">Connected</div>
                    {ibkrStatus?.accountId && (
                      <div className="text-xs text-muted-foreground mt-0.5">Account: {ibkrStatus.accountId}</div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Disconnect
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Live trading is enabled. All approved signals will be placed as limit orders at mid-price via your IBKR account.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-muted-foreground">Not connected</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Connect your IBKR account to enable live order placement</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    IBKR Web API OAuth requires environment credentials (IBKR_CLIENT_ID, IBKR_CLIENT_SECRET, IBKR_REDIRECT_URI).
                    Contact your administrator to configure these.
                  </p>
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={async () => {
                    const r = await fetch("/api/ibkr/connect", {
                      headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
                    });
                    const d = await r.json();
                    if (d.authUrl) window.location.href = d.authUrl;
                    else toast({ title: "IBKR OAuth not configured", description: d.error, variant: "destructive" });
                  }}
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect IBKR Account
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Risk Profile */}
        <Card className="bg-[#1a1f2e] border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-400" />
              Options Risk Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Profit target */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white">Take Profit at</Label>
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">{pt}% of premium</Badge>
              </div>
              <Slider
                value={[pt]}
                onValueChange={([v]) => setProfitTarget(v)}
                min={25} max={90} step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Close position when {pt}% of the premium has been captured</p>
            </div>

            {/* Max loss multiple */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white">Stop Loss at</Label>
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">{ml}× premium</Badge>
              </div>
              <Slider
                value={[ml]}
                onValueChange={([v]) => setMaxLoss(v)}
                min={1} max={5} step={0.5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Exit if position loss reaches {ml}× the initial premium collected</p>
            </div>

            {/* Delta preference */}
            <div className="space-y-2">
              <Label className="text-sm text-white">Delta Preference</Label>
              <div className="grid grid-cols-3 gap-2">
                {deltaOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDeltaPref(opt.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      dp === opt.value
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-xs font-semibold text-white">{opt.label.split(" ")[0]}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* DTE range */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white">Option Expiry Window</Label>
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">{dmin}–{dmax} DTE</Badge>
              </div>
              {/* Preset windows */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: "Weekly",
                    sub: "5–7 days",
                    desc: "Fast income, but requires constant attention. Best when IV is very high.",
                    dteMin: 5, dteMax: 7,
                    activeClass: "border-amber-500 bg-amber-500/10",
                  },
                  {
                    label: "Bi-weekly",
                    sub: "10–15 days",
                    desc: "Good for active traders. Higher premium yield, but less time to recover if it goes against you.",
                    dteMin: 10, dteMax: 15,
                    activeClass: "border-orange-500 bg-orange-500/10",
                  },
                  {
                    label: "Monthly",
                    sub: "21–35 days",
                    desc: "The sweet spot — theta decay accelerates, enough time buffer, manageable attention required. Most recommended.",
                    dteMin: 21, dteMax: 35,
                    activeClass: "border-emerald-500 bg-emerald-500/10",
                    recommended: true,
                  },
                  {
                    label: "45-Day Standard",
                    sub: "38–50 days",
                    desc: "Classic hedge-fund approach. Gives more time for the trade to work. Best for higher-volatility names.",
                    dteMin: 38, dteMax: 50,
                    activeClass: "border-violet-500 bg-violet-500/10",
                  },
                ].map((preset) => {
                  const active = dmin === preset.dteMin && dmax === preset.dteMax;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => { setDteMin(preset.dteMin); setDteMax(preset.dteMax); }}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        active ? preset.activeClass : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">{preset.label}</span>
                        {preset.recommended && (
                          <Badge className="text-[10px] px-1 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            recommended
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{preset.sub}</div>
                      <div className="text-[11px] text-slate-400 mt-1 leading-tight">{preset.desc}</div>
                    </button>
                  );
                })}
              </div>
              {/* Fine-tune sliders */}
              <details className="group">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-white transition-colors">
                  Fine-tune manually (currently {dmin}–{dmax} days)
                </summary>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Minimum DTE</Label>
                    <Slider value={[dmin]} onValueChange={([v]) => setDteMin(v)} min={3} max={60} step={1} className="mt-2" />
                    <p className="text-[11px] text-muted-foreground mt-1">{dmin} days minimum</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Maximum DTE</Label>
                    <Slider value={[dmax]} onValueChange={([v]) => setDteMax(v)} min={7} max={90} step={1} className="mt-2" />
                    <p className="text-[11px] text-muted-foreground mt-1">{dmax} days maximum</p>
                  </div>
                </div>
              </details>
              <p className="text-xs text-muted-foreground">
                The AI will only recommend options expiring within this window. Shorter = more trades to manage; longer = fewer, larger positions.
              </p>
            </div>

            {/* Max positions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white">Max Open Positions</Label>
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">{mp}</Badge>
              </div>
              <Slider
                value={[mp]}
                onValueChange={([v]) => setMaxPositions(v)}
                min={1} max={20} step={1}
                className="w-full"
              />
            </div>

            {/* Account size — used for risk metrics when IBKR is not connected */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white">Total Account Size (NLV)</Label>
                {as_ && <Badge variant="outline" className="text-xs border-emerald-600/50 text-emerald-400">${as_.toLocaleString()}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  placeholder={savedAccountSize?.toString() ?? "e.g. 250000"}
                  value={accountSizeTouched ? accountSize : (savedAccountSize?.toString() ?? "")}
                  onChange={(e) => { setAccountSize(e.target.value); setAccountSizeTouched(true); }}
                  className="bg-slate-800/50 border-slate-600 text-white"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Your total portfolio value (cash + stock holdings). Used as the NLV denominator for all risk calculations when IBKR is not connected.
              </p>
            </div>

            {/* Cash available for selling puts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Cash Available for Options
                </Label>
                {ca_ && <Badge variant="outline" className="text-xs border-emerald-600/50 text-emerald-400">${ca_.toLocaleString()}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  placeholder={savedCashAvailable?.toString() ?? "e.g. 150000"}
                  value={cashAvailableTouched ? cashAvailable : (savedCashAvailable?.toString() ?? "")}
                  onChange={(e) => { setCashAvailable(e.target.value); setCashAvailableTouched(true); }}
                  className="bg-slate-800/50 border-slate-600 text-white"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cash set aside for cash-secured puts — separate from capital tied up in stock holdings. The risk engine uses this as your available buying power.
              </p>
              {as_ && ca_ && ca_ > as_ && (
                <p className="text-xs text-amber-400">⚠️ Cash available exceeds account size — please verify</p>
              )}
            </div>

            {/* Margin cap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white">Margin Cap</Label>
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">{mc}% of account</Badge>
              </div>
              <Slider
                value={[mc]}
                onValueChange={([v]) => setMarginCap(v)}
                min={5} max={75} step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Maximum total margin usage as a percentage of account value</p>
            </div>

            {/* Monthly income target */}
            <div className="space-y-2">
              <Label className="text-sm text-white">Monthly Income Target (optional)</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  placeholder={profile.monthlyIncomeTarget?.toString() ?? "e.g. 2000"}
                  value={incomeTargetTouched ? incomeTarget : (profile.monthlyIncomeTarget?.toString() ?? "")}
                  onChange={(e) => { setIncomeTarget(e.target.value); setIncomeTargetTouched(true); }}
                  className="bg-slate-800/50 border-slate-600 text-white"
                />
              </div>
              <p className="text-xs text-muted-foreground">Shown as a progress bar on the Income Tracker page</p>
            </div>

            <Button
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => updateRiskMutation.mutate()}
              disabled={updateRiskMutation.isPending || riskLoading}
            >
              <Settings className="w-4 h-4 mr-2" />
              {updateRiskMutation.isPending ? "Saving..." : "Save Risk Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Capital Allocation Guidance ────────────────────────────────────── */}
        <Card className="bg-[#1a1f2e] border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-400" />
              Capital Allocation Guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!regimeGuidance ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-slate-800/40 animate-pulse" />)}
              </div>
            ) : (
              <>
                {/* Regime badge + headline */}
                <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{regimeGuidance.regime} regime</span>
                    </div>
                    <p className="text-xs text-blue-300 mt-0.5">{regimeGuidance.headline}</p>
                  </div>
                </div>

                {/* Allocation bars */}
                <div className="space-y-3">
                  {[
                    { label: "Cash / dry powder", pct: regimeGuidance.cashPct, color: "bg-slate-400" },
                    { label: "Shares / equities",  pct: regimeGuidance.sharesPct, color: "bg-blue-500" },
                    { label: "Options income",      pct: regimeGuidance.optionsPct, color: "bg-emerald-500" },
                  ].map(({ label, pct, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-300">{label}</span>
                        <span className="text-xs font-bold text-white tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color} transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick summary grid */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: "Cash", value: `${regimeGuidance.cashPct}%`, color: "text-slate-300" },
                    { label: "Shares", value: `${regimeGuidance.sharesPct}%`, color: "text-blue-400" },
                    { label: "Options", value: `${regimeGuidance.optionsPct}%`, color: "text-emerald-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-800/50 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className={`text-base font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  {regimeGuidance.notes.map((note, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                      <p className="text-xs text-slate-300 leading-relaxed">{note}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  Based on current market regime · Updates with each signal generation run
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Stock Holdings ─────────────────────────────────────────────────── */}
        <Card className="bg-[#1a1f2e] border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                Stock Holdings
              </CardTitle>
              <span className="text-xs text-slate-400">
                {holdings.length} position{holdings.length !== 1 ? "s" : ""}
                {holdings.filter((h) => h.quantity >= 100).length > 0 && (
                  <span className="ml-2 text-emerald-400">
                    · {holdings.filter((h) => h.quantity >= 100).length} eligible for covered calls
                  </span>
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Add your existing stock positions. Holdings with 100+ shares unlock covered call suggestions on the Positions page.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing holdings table */}
            {holdingsLoading ? (
              <div className="space-y-2">
                {[1,2].map((i) => <div key={i} className="h-10 rounded-lg bg-slate-800/40 animate-pulse" />)}
              </div>
            ) : holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No holdings added yet. Add your stock positions below.
              </p>
            ) : (
              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/40">
                      <th className="text-left px-3 py-2 text-xs text-slate-400 font-medium">Ticker</th>
                      <th className="text-right px-3 py-2 text-xs text-slate-400 font-medium">Shares</th>
                      <th className="text-right px-3 py-2 text-xs text-slate-400 font-medium">Avg Cost</th>
                      <th className="text-right px-3 py-2 text-xs text-slate-400 font-medium">Contracts</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => {
                      const contracts = Math.floor(h.quantity / 100);
                      const eligible = h.quantity >= 100;
                      return (
                        <tr key={h.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/20">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{h.ticker}</span>
                              {eligible && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                  CC eligible
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-white tabular-nums">{h.quantity.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">
                            {h.avgCostBasis != null ? `$${h.avgCostBasis.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className={eligible ? "text-emerald-400 font-medium" : "text-slate-500"}>
                              {contracts > 0 ? contracts : "<1"}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => deleteHoldingMutation.mutate(h.id)}
                              disabled={deleteHoldingMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add new holding form */}
            <div className="pt-2">
              <p className="text-xs text-slate-400 font-medium mb-2">Add a holding</p>
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Ticker (e.g. AAPL)"
                  value={newHolding.ticker}
                  onChange={(e) => setNewHolding((h) => ({ ...h, ticker: e.target.value.toUpperCase() }))}
                  className="bg-slate-800/50 border-slate-600 text-white w-32 uppercase placeholder:normal-case placeholder:text-slate-500"
                />
                <Input
                  type="number"
                  placeholder="Shares"
                  value={newHolding.quantity}
                  onChange={(e) => setNewHolding((h) => ({ ...h, quantity: e.target.value }))}
                  className="bg-slate-800/50 border-slate-600 text-white w-28"
                  min="1"
                />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <Input
                    type="number"
                    placeholder="Avg cost (opt.)"
                    value={newHolding.avgCostBasis}
                    onChange={(e) => setNewHolding((h) => ({ ...h, avgCostBasis: e.target.value }))}
                    className="bg-slate-800/50 border-slate-600 text-white pl-7 w-40"
                    min="0.01"
                    step="0.01"
                  />
                </div>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  disabled={!newHolding.ticker || !newHolding.quantity || addHoldingMutation.isPending}
                  onClick={() => {
                    const qty = parseInt(newHolding.quantity, 10);
                    const avgCost = newHolding.avgCostBasis ? parseFloat(newHolding.avgCostBasis) : undefined;
                    addHoldingMutation.mutate({
                      ticker: newHolding.ticker,
                      quantity: qty,
                      avgCostBasis: avgCost,
                    });
                  }}
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                  {addHoldingMutation.isPending ? "Adding…" : "Add"}
                </Button>
              </div>
              {newHolding.quantity && parseInt(newHolding.quantity, 10) >= 100 && (
                <p className="text-xs text-emerald-400 mt-1.5">
                  ✓ {Math.floor(parseInt(newHolding.quantity, 10) / 100)} covered call contract{Math.floor(parseInt(newHolding.quantity, 10) / 100) !== 1 ? "s" : ""} available
                </p>
              )}
              {newHolding.quantity && parseInt(newHolding.quantity, 10) > 0 && parseInt(newHolding.quantity, 10) < 100 && (
                <p className="text-xs text-amber-400 mt-1.5">
                  ⚠️ Need 100 shares for a covered call. {100 - parseInt(newHolding.quantity, 10)} more shares needed.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
