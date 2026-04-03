import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, CheckCircle, XCircle, AlertTriangle, Shield, Settings, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RiskProfile {
  profitTarget: number;
  maxLossMultiple: number;
  deltaPref: string;
  dteMin: number;
  dteMax: number;
  maxOpenPositions: number;
  marginCapPct: number;
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

  const profile: RiskProfile = riskData?.profile ?? {
    profitTarget: 50,
    maxLossMultiple: 2,
    deltaPref: "moderate",
    dteMin: 21,
    dteMax: 35,
    maxOpenPositions: 5,
    marginCapPct: 25,
    monthlyIncomeTarget: null,
  };

  const [profitTarget, setProfitTarget]               = useState<number | null>(null);
  const [maxLoss, setMaxLoss]                         = useState<number | null>(null);
  const [deltaPref, setDeltaPref]                     = useState<string | null>(null);
  const [dteMin, setDteMin]                           = useState<number | null>(null);
  const [dteMax, setDteMax]                           = useState<number | null>(null);
  const [maxPositions, setMaxPositions]               = useState<number | null>(null);
  const [marginCap, setMarginCap]                     = useState<number | null>(null);
  const [incomeTarget, setIncomeTarget]               = useState<string>("");
  const [incomeTargetTouched, setIncomeTargetTouched] = useState(false);

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
          maxLossMultiple: ml,
          deltaPref: dp,
          dteMin: dmin,
          dteMax: dmax,
          maxOpenPositions: mp,
          marginCapPct: mc,
          monthlyIncomeTarget: it,
        }),
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Risk profile saved", description: "Your preferences have been updated." });
      qc.invalidateQueries({ queryKey: ["risk-profile"] });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white">Days to Expiry (DTE) Range</Label>
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">{dmin}–{dmax} days</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Minimum</Label>
                  <Slider value={[dmin]} onValueChange={([v]) => setDteMin(v)} min={7} max={60} step={1} className="mt-2" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Maximum</Label>
                  <Slider value={[dmax]} onValueChange={([v]) => setDteMax(v)} min={14} max={90} step={1} className="mt-2" />
                </div>
              </div>
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
      </div>
    </Layout>
  );
}
