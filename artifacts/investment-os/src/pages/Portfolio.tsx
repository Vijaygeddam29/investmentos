import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import * as XLSX from "xlsx";
import { Layout } from "@/components/layout/Layout";
import {
  Upload, Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, XCircle, ChevronDown, FileText, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Types ────────────────────────────────────────────────────────────────────
type Action = "ADD" | "HOLD" | "TRIM" | "SELL";

interface HoldingAnalysis {
  id: number;
  ticker: string;
  name: string;
  sector: string | null;
  shares: number;
  purchasePrice: number;
  purchaseDate: string | null;
  notes: string | null;
  currentPrice: number | null;
  priceSource: "live" | "cache" | "none";
  costBasis: number;
  currentValue: number | null;
  unrealisedPnl: number | null;
  pnlPct: number | null;
  qualityScore: number | null;
  fortressScore: number | null;
  rocketScore: number | null;
  waveScore: number | null;
  entryTimingScore: number | null;
  marginOfSafety: number | null;
  peRatio: number | null;
  priceToBook: number | null;
  action: Action;
  rationale: string;
  urgency: "high" | "medium" | "low";
}

interface PortfolioSummary {
  totalCost: number;
  totalCurrentValue: number | null;
  totalPnl: number | null;
  totalPnlPct: number | null;
  portfolioQuality: number | null;
  actionCounts: Record<Action, number>;
  holdingCount: number;
}

interface PortfolioResponse {
  holdings: HoldingAnalysis[];
  summary: PortfolioSummary | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, decimals = 2, prefix = "") {
  if (n == null || isNaN(n)) return "—";
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtPct(n: number | null | undefined) {
  if (n == null || isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(2)}%`;
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const ACTION_CONFIG: Record<Action, {
  label: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
  border: string;
  description: string;
}> = {
  ADD: {
    label: "Add More",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    description: "High quality + favourable timing. Thesis intact.",
  },
  HOLD: {
    label: "Hold",
    icon: <Minus className="w-3.5 h-3.5" />,
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    border: "border-blue-500/30",
    description: "Solid quality. No urgency to change position.",
  },
  TRIM: {
    label: "Trim",
    icon: <TrendingDown className="w-3.5 h-3.5" />,
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
    description: "Overbought or softening quality. Lock in gains.",
  },
  SELL: {
    label: "Sell",
    icon: <XCircle className="w-3.5 h-3.5" />,
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
    description: "Thesis broken or quality degraded.",
  },
};

function ScoreBar({ value, label }: { value: number | null; label: string }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.round(value * 100);
  const color =
    pct >= 65 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct >= 38 ? "bg-amber-500" : "bg-red-500";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-default">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{pct}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}: {pct}/100
      </TooltipContent>
    </Tooltip>
  );
}

function ActionBadge({ action }: { action: Action }) {
  const cfg = ACTION_CONFIG[action];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Shared row parsing ────────────────────────────────────────────────────────
type ParsedRow = { ticker: string; shares: number; purchasePrice: number; purchaseDate?: string };

function findColIdx(headers: string[], patterns: string[]): number {
  return headers.findIndex((h) => patterns.some((p) => h.includes(p) || h === p));
}

function rowsFromObjects(objects: Record<string, unknown>[]): ParsedRow[] {
  if (!objects.length) return [];
  const keys = Object.keys(objects[0]).map((k) => k.toLowerCase().trim());
  const tickerIdx   = findColIdx(keys, ["ticker", "symbol", "stock", "code"]);
  const sharesIdx   = findColIdx(keys, ["share", "qty", "quantity", "units", "amount"]);
  const priceIdx    = findColIdx(keys, ["price", "cost", "purchase_price", "buyprice", "avg price", "avgprice", "average"]);
  const dateIdx     = findColIdx(keys, ["date", "purchase date", "buy date"]);
  const currencyIdx = findColIdx(keys, ["currency", "curr", "ccy", "fx"]);
  if (tickerIdx < 0 || sharesIdx < 0 || priceIdx < 0) return [];
  const origKeys = Object.keys(objects[0]);
  return objects.map((obj) => {
    const vals = origKeys.map((k) => String(obj[k] ?? "").trim());
    let price = parseFloat(vals[priceIdx] ?? "0");

    // GBX = British pence — divide by 100 to get GBP
    if (currencyIdx >= 0) {
      const ccy = (vals[currencyIdx] ?? "").toUpperCase().trim();
      if (ccy === "GBX" || ccy === "GBP PENCE" || ccy === "PENCE") {
        price = price / 100;
      }
    }

    return {
      ticker:        vals[tickerIdx]?.toUpperCase() ?? "",
      shares:        parseFloat(vals[sharesIdx] ?? "0"),
      purchasePrice: price,
      purchaseDate:  dateIdx >= 0 ? vals[dateIdx] : undefined,
    };
  }).filter((r) => r.ticker && r.shares > 0 && r.purchasePrice > 0);
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────
function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/['"]/g, ""));
  const objects: Record<string, unknown>[] = lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/['"]/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
  });
  return rowsFromObjects(objects);
}

// ─── Excel parsing ────────────────────────────────────────────────────────────
function parseExcel(buffer: ArrayBuffer): ParsedRow[] {
  const workbook   = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName  = workbook.SheetNames[0];
  const sheet      = workbook.Sheets[sheetName];
  const objects    = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rowsFromObjects(objects);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Portfolio() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [csvError, setCsvError]     = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual form state
  const [form, setForm] = useState({ ticker: "", shares: "", purchasePrice: "", purchaseDate: "", notes: "" });

  // ── API calls ────────────────────────────────────────────────────────────────
  const { data, isLoading, isFetching, error } = useQuery<PortfolioResponse>({
    queryKey: ["portfolio"],
    queryFn: () => customFetch("/api/portfolio"),
    refetchOnWindowFocus: false,
  });

  const addHolding = useMutation({
    mutationFn: (body: object) =>
      customFetch("/api/portfolio/holdings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      setForm({ ticker: "", shares: "", purchasePrice: "", purchaseDate: "", notes: "" });
      setShowAddForm(false);
    },
  });

  const uploadPortfolio = useMutation({
    mutationFn: (rows: object[]) =>
      customFetch("/api/portfolio/upload", { method: "POST", body: JSON.stringify({ rows }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
  });

  const deleteHolding = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/portfolio/holdings/${id}`, { method: "DELETE", responseType: "text" } as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
  });

  const clearPortfolio = useMutation({
    mutationFn: () => customFetch("/api/portfolio", { method: "DELETE", responseType: "text" } as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
  });

  // ── File handling — supports CSV, TSV and Excel (.xlsx / .xls) ───────────────
  const handleRows = useCallback((rows: ParsedRow[]) => {
    if (!rows.length) {
      setCsvError(
        "Could not read any holdings from that file. Make sure it has columns named Ticker (or Symbol), Shares (or Qty), and Price (or PurchasePrice)."
      );
      return;
    }
    setCsvError(null);
    uploadPortfolio.mutate(rows);
  }, [uploadPortfolio]);

  const isExcel = (name: string) => /\.(xlsx|xls|xlsm)$/i.test(name);

  const handleFile = useCallback((file: File) => {
    setCsvError(null);
    if (isExcel(file.name)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const buffer = ev.target?.result as ArrayBuffer;
          handleRows(parseExcel(buffer));
        } catch {
          setCsvError("Could not read the Excel file. Please check the format and try again.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => handleRows(parseCSV(ev.target?.result as string));
      reader.readAsText(file);
    }
  }, [handleRows]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFile(file);
    e.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    handleFile(file);
  }, [handleFile]);

  // ── Submit manual form ────────────────────────────────────────────────────────
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addHolding.mutate({
      ticker: form.ticker.toUpperCase(),
      shares: parseFloat(form.shares),
      purchasePrice: parseFloat(form.purchasePrice),
      purchaseDate: form.purchaseDate || null,
      notes: form.notes || null,
    });
  };

  const holdings  = data?.holdings ?? [];
  const summary   = data?.summary ?? null;
  const isEmpty   = !isLoading && !error && holdings.length === 0;

  const actionOrder: Action[] = ["SELL", "TRIM", "ADD", "HOLD"];
  const sorted = [...holdings].sort((a, b) => {
    const urgencyVal = { high: 0, medium: 1, low: 2 };
    const aOrder = actionOrder.indexOf(a.action);
    const bOrder = actionOrder.indexOf(b.action);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return urgencyVal[a.urgency] - urgencyVal[b.urgency];
  });

  return (
    <Layout>
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">My Portfolio</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your holdings and get hedge-fund-grade action recommendations powered by 120 factors.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {holdings.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => { if (confirm("Clear all holdings?")) clearPortfolio.mutate(); }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Clear All
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["portfolio"] })}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Holding
            </Button>
          </div>
        </div>

        {/* ── Add Holding Form ────────────────────────────────────────────── */}
        {showAddForm && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm text-foreground">Add a holding manually</h2>
              <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ticker *</Label>
                <Input placeholder="AAPL" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} required className="h-8 text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Shares *</Label>
                <Input type="number" step="any" placeholder="10" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} required className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Purchase Price *</Label>
                <Input type="number" step="any" placeholder="150.00" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} required className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Purchase Date</Label>
                <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Input placeholder="Optional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="h-8 text-sm" />
              </div>
              <Button type="submit" size="sm" className="h-8" disabled={addHolding.isPending}>
                {addHolding.isPending ? "Adding…" : "Add"}
              </Button>
            </form>
            {addHolding.isError && (
              <p className="text-xs text-destructive mt-2">{String(addHolding.error)}</p>
            )}
          </div>
        )}

        {/* ── CSV Upload Area ─────────────────────────────────────────────── */}
        <div
          className={`rounded-xl border-2 border-dashed transition-colors p-6 text-center cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls,.xlsm" className="hidden" onChange={handleFileChange} />
          <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Drop an Excel or CSV file here, or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports <span className="font-mono text-primary">.xlsx</span>, <span className="font-mono text-primary">.xls</span>, and <span className="font-mono text-primary">.csv</span> files.
            Columns needed: <span className="font-mono text-primary">Ticker</span> (or Symbol), <span className="font-mono text-primary">Shares</span> (or Qty), <span className="font-mono text-primary">Price</span> — Date is optional. Importing replaces your existing portfolio.
          </p>
          {csvError && <p className="text-xs text-destructive mt-2">{csvError}</p>}
          {uploadPortfolio.isPending && <p className="text-xs text-muted-foreground mt-2 animate-pulse">Uploading & analysing…</p>}
        </div>

        {/* ── CSV Template Download ────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              const csv = "Ticker,Shares,PurchasePrice,PurchaseDate\nAAPL,10,150.00,2023-01-15\nMSFT,5,280.00,2022-06-01\nNVDA,8,450.00,2023-03-10\n";
              const a   = document.createElement("a");
              a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
              a.download = "portfolio_template.csv";
              a.click();
            }}
          >
            <FileText className="w-3.5 h-3.5" /> Download CSV template
          </button>
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Value */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Portfolio Value</p>
              <p className="text-xl font-bold text-foreground font-mono">
                {fmtCurrency(summary.totalCurrentValue ?? summary.totalCost)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Cost: {fmtCurrency(summary.totalCost)}</p>
            </div>
            {/* Total P&L */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Unrealised P&amp;L</p>
              <p className={`text-xl font-bold font-mono ${
                (summary.totalPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
              }`}>
                {fmtCurrency(summary.totalPnl)}
              </p>
              <p className={`text-xs mt-0.5 ${(summary.totalPnlPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {fmtPct(summary.totalPnlPct)}
              </p>
            </div>
            {/* Portfolio Quality */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Portfolio Quality</p>
              {summary.portfolioQuality != null ? (
                <>
                  <p className="text-xl font-bold font-mono text-foreground">
                    {Math.round(summary.portfolioQuality * 100)}<span className="text-sm text-muted-foreground">/100</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {summary.portfolioQuality >= 0.65 ? "High quality" : summary.portfolioQuality >= 0.50 ? "Moderate quality" : "Below average"}
                  </p>
                </>
              ) : (
                <p className="text-xl font-bold text-muted-foreground">—</p>
              )}
            </div>
            {/* Action breakdown */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-2">Action Summary</p>
              <div className="flex flex-wrap gap-1.5">
                {(["ADD", "HOLD", "TRIM", "SELL"] as Action[]).map((a) => {
                  const count = summary.actionCounts[a];
                  if (!count) return null;
                  const cfg = ACTION_CONFIG[a];
                  return (
                    <span key={a} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {count} {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Holdings Table ──────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Loading portfolio…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load portfolio. Please try refreshing.
          </div>
        )}

        {isEmpty && (
          <div className="rounded-xl border border-border bg-card/50 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No holdings yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Upload a CSV or add holdings manually. Each position will be scored against 120 factors and given a clear action.
            </p>
          </div>
        )}

        {sorted.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Legend */}
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-4 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Holdings — {sorted.length} positions</span>
              <div className="flex items-center gap-3 ml-auto flex-wrap">
                {(["ADD", "HOLD", "TRIM", "SELL"] as Action[]).map((a) => {
                  const cfg = ACTION_CONFIG[a];
                  return (
                    <span key={a} className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className={`w-2 h-2 rounded-full ${a === "ADD" ? "bg-emerald-400" : a === "HOLD" ? "bg-blue-400" : a === "TRIM" ? "bg-amber-400" : "bg-red-400"}`} />
                      {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-border">
              {sorted.map((h) => {
                const cfg       = ACTION_CONFIG[h.action];
                const isExpanded = expandedId === h.id;
                const pnlColor  = (h.pnlPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400";

                return (
                  <div key={h.id} className="group">
                    {/* Main row */}
                    <div
                      className="grid items-center gap-4 px-5 py-3.5 hover:bg-muted/20 cursor-pointer transition-colors"
                      style={{ gridTemplateColumns: "1fr 2fr auto auto auto auto auto auto" }}
                      onClick={() => setExpandedId(isExpanded ? null : h.id)}
                    >
                      {/* Ticker + name */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-foreground">{h.ticker}</span>
                          {h.urgency === "high" && h.action !== "HOLD" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">High urgency — act soon</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{h.name}</p>
                      </div>

                      {/* P&L */}
                      <div className="text-right">
                        <p className={`text-sm font-semibold font-mono ${pnlColor}`}>{fmtPct(h.pnlPct)}</p>
                        <p className={`text-xs font-mono ${pnlColor}`}>{fmtCurrency(h.unrealisedPnl)}</p>
                      </div>

                      {/* Cost basis & current value */}
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-muted-foreground">{h.shares} @ {fmt(h.purchasePrice, 2, "$")}</p>
                        <p className="text-xs text-foreground font-mono">{fmtCurrency(h.costBasis)}</p>
                      </div>

                      {/* Current price */}
                      <div className="text-right hidden lg:block">
                        <div className="flex items-center justify-end gap-1">
                          <p className="text-xs text-muted-foreground">Now</p>
                          {h.priceSource === "live" && (
                            <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 leading-none">LIVE</span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-foreground">{h.currentPrice != null ? `$${h.currentPrice.toFixed(2)}` : "—"}</p>
                      </div>

                      {/* Quality score */}
                      <div className="hidden lg:block">
                        <p className="text-xs text-muted-foreground mb-0.5">Quality</p>
                        <ScoreBar value={h.qualityScore} label="Quality" />
                      </div>

                      {/* Action badge */}
                      <div>
                        <ActionBadge action={h.action} />
                      </div>

                      {/* Expand arrow */}
                      <button className="text-muted-foreground hover:text-foreground p-1" onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : h.id); }}>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>

                      {/* Delete (always rightmost) */}
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                        onClick={(e) => { e.stopPropagation(); deleteHolding.mutate(h.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className={`px-5 py-4 border-t border-border/50 ${cfg.bg} bg-opacity-50`}>
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Rationale */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <ActionBadge action={h.action} />
                              <span className={`text-xs ${cfg.text} font-medium`}>
                                {h.urgency === "high" ? "High urgency" : h.urgency === "medium" ? "Medium urgency" : "Low urgency"}
                              </span>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed">{h.rationale}</p>
                          </div>

                          {/* Scores */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Engine Scores</p>
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Fortress</span>
                                  <ScoreBar value={h.fortressScore} label="Fortress (quality)" />
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Rocket</span>
                                  <ScoreBar value={h.rocketScore} label="Rocket (growth)" />
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Wave</span>
                                  <ScoreBar value={h.waveScore} label="Wave (momentum)" />
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Entry Timing</span>
                                  <ScoreBar value={h.entryTimingScore} label="Entry Timing" />
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5">Valuation</p>
                              <div className="space-y-1.5">
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">Margin of Safety</span>
                                  <span className={`text-xs font-mono ${(h.marginOfSafety ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {h.marginOfSafety != null ? fmtPct(h.marginOfSafety) : "—"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">P/E Ratio</span>
                                  <span className="text-xs font-mono text-foreground">{fmt(h.peRatio, 1)}x</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs text-muted-foreground">P/B Ratio</span>
                                  <span className="text-xs font-mono text-foreground">{fmt(h.priceToBook, 1)}x</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── How it works ────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">How recommendations are generated</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(["ADD", "HOLD", "TRIM", "SELL"] as Action[]).map((a) => {
              const cfg = ACTION_CONFIG[a];
              return (
                <div key={a} className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
                  <div className={`flex items-center gap-1.5 mb-1.5 ${cfg.text}`}>
                    {cfg.icon}
                    <span className="text-xs font-semibold">{cfg.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{cfg.description}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Quality score = Fortress × 40% + Rocket × 35% + Wave × 25%. Entry Timing and unrealised P&L are used to fine-tune between ADD and TRIM. All data is sourced from FMP / Yahoo Finance via the live pipeline.
          </p>
        </div>

      </div>
    </div>
    </Layout>
  );
}
