import { useState, useMemo, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { useListUniverse, useRemoveFromUniverse, useSeedUniverse } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Loader2, X, Download, CheckCircle2, Clock, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CompanyDrawer } from "@/components/company/CompanyDrawer";
import { Combobox } from "@/components/ui/combobox";
import { countryFilterFn } from "@/lib/country-filter";

const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", "UK": "🇬🇧", India: "🇮🇳",
  Germany: "🇩🇪", France: "🇫🇷", Italy: "🇮🇹", China: "🇨🇳",
  Taiwan: "🇹🇼", Netherlands: "🇳🇱", Canada: "🇨🇦", Australia: "🇦🇺",
  Brazil: "🇧🇷", Denmark: "🇩🇰", "Hong Kong": "🇭🇰", Ireland: "🇮🇪",
  Israel: "🇮🇱", Singapore: "🇸🇬", Switzerland: "🇨🇭", Uruguay: "🇺🇾",
  US: "🇺🇸",
};

type CompanyRow = {
  ticker: string;
  name: string;
  sector?: string;
  industry?: string;
  country?: string;
  exchange?: string;
  source?: string;
  scored?: boolean;
  marketCap?: number;
};

export default function Universe() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);

  const { market } = useAuth();
  const defaultMarketCountry = market !== "All" ? market : undefined;

  const [sectorFilter, setSectorFilter]     = useState("");
  const [countryFilter, setCountryFilter]   = useState(market !== "All" ? market : "");
  const [appliedSector, setAppliedSector]   = useState<string | undefined>(undefined);
  const [appliedCountry, setAppliedCountry] = useState<string | undefined>(defaultMarketCountry);

  const { data, isLoading } = useListUniverse({ sector: appliedSector, country: appliedCountry });
  const { data: allData }   = useListUniverse({});
  const removeMutation      = useRemoveFromUniverse();
  const seedMutation        = useSeedUniverse();
  const queryClient         = useQueryClient();
  const { toast }           = useToast();

  const [addTicker, setAddTicker]   = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    (allData as any)?.companies?.forEach((c: any) => { if (c.sector) set.add(c.sector); });
    return [...set].sort();
  }, [allData]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    (allData as any)?.companies?.forEach((c: any) => { if (c.country) set.add(c.country); });
    return [...set].sort().map((name: string) => `${COUNTRY_FLAGS[name] ?? "🌐"} ${name}`);
  }, [allData]);

  function countryOptionToValue(opt: string) {
    return opt.replace(/^[^ ]+ /, "");
  }

  const hasActiveFilters = !!appliedSector || !!appliedCountry;

  function handleApplyFilters() {
    setAppliedSector(sectorFilter || undefined);
    setAppliedCountry(countryFilter ? countryOptionToValue(countryFilter) : undefined);
  }

  function handleClearFilters() {
    setSectorFilter("");
    setCountryFilter("");
    setAppliedSector(undefined);
    setAppliedCountry(undefined);
  }

  const handleRemove = (ticker: string) => {
    removeMutation.mutate(
      { ticker },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/universe"] });
          toast({ title: "Removed", description: `${ticker} removed from universe.` });
        },
      }
    );
  };

  const handleQuickAdd = async () => {
    const ticker = addTicker.trim().toUpperCase();
    if (!ticker) return;
    setAddLoading(true);
    try {
      const res = await customFetch(`/api/universe/quick-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast({ title: "Not found", description: body.error || `Could not validate "${ticker}"`, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/universe"] });
      if (body.alreadyExists) {
        toast({ title: "Already tracking", description: `${ticker} is already in your universe.` });
      } else {
        toast({
          title: `${ticker} added`,
          description: `${body.company?.name ?? ticker} added. Scoring will begin in the background.`,
        });
      }
      setAddTicker("");
    } catch {
      toast({ title: "Error", description: "Failed to add ticker. Please try again.", variant: "destructive" });
    } finally {
      setAddLoading(false);
      addInputRef.current?.focus();
    }
  };

  const handleSeedCompounders = () => {
    seedMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: ["/api/universe"] });
        toast({
          title: "Compounders imported",
          description: `${data?.added ?? 0} new companies added (${data?.skipped ?? 0} already existed). Run the pipeline to score them.`,
        });
      },
      onError: () => {
        toast({ title: "Import failed", description: "Could not import compounders.", variant: "destructive" });
      },
    });
  };

  const companies: CompanyRow[] = (data as any)?.companies ?? [];
  const totalCount   = companies.length;
  const customCount  = companies.filter(c => c.source === "user_added").length;
  const pendingCount = companies.filter(c => c.source === "user_added" && !c.scored).length;

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        <div className="flex-none border-b border-border bg-card px-6 py-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">Research Universe</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {totalCount} companies tracked
                {customCount > 0 && (
                  <> · <span className="text-amber-500 font-medium">{customCount} custom</span></>
                )}
                {pendingCount > 0 && (
                  <> · <span className="text-blue-400">{pendingCount} pending score</span></>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedCompounders}
              disabled={seedMutation.isPending}
              className="text-xs shrink-0"
            >
              {seedMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <Download className="w-3.5 h-3.5 mr-1.5" />}
              Import Compounders
            </Button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={addInputRef}
                placeholder="Add ticker (e.g. NVDA, AAON)…"
                value={addTicker}
                onChange={e => setAddTicker(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter") handleQuickAdd(); }}
                className="pl-8 h-8 text-sm font-mono"
                disabled={addLoading}
              />
            </div>
            <Button
              size="sm"
              onClick={handleQuickAdd}
              disabled={!addTicker.trim() || addLoading}
              className="h-8 text-xs px-3"
            >
              {addLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Plus className="w-3.5 h-3.5" />}
              <span className="ml-1.5">Add to Universe</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Combobox
              options={sectorOptions}
              value={sectorFilter}
              onChange={setSectorFilter}
              placeholder="Sector"
              className="w-44 h-8 text-xs"
            />
            <Combobox
              options={countryOptions}
              value={countryFilter}
              onChange={setCountryFilter}
              placeholder="Country"
              filterFn={countryFilterFn}
              className="w-48 h-8 text-xs"
            />
            <Button size="sm" variant="secondary" onClick={handleApplyFilters} className="h-8 text-xs">
              Apply
            </Button>
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={handleClearFilters} className="h-8 text-xs text-muted-foreground">
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-28 font-semibold text-xs">Ticker</TableHead>
                <TableHead className="font-semibold text-xs">Name</TableHead>
                <TableHead className="font-semibold text-xs">Sector</TableHead>
                <TableHead className="font-semibold text-xs">Country</TableHead>
                <TableHead className="font-semibold text-xs">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
                    {hasActiveFilters
                      ? "No companies match your filters."
                      : "Universe is empty — add a ticker above or click Import Compounders."}
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <TableRow
                    key={company.ticker}
                    className="border-border hover:bg-secondary/40 group cursor-pointer"
                    onClick={() => { setSelectedTicker(company.ticker); setDrawerOpen(true); }}
                  >
                    <TableCell className="font-mono font-bold text-primary sticky left-0 bg-card z-10 group-hover:bg-secondary/40 whitespace-nowrap">
                      {company.ticker}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap text-sm">{company.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{company.sector || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {company.country ? (
                        <span className="flex items-center gap-1.5">
                          <span>{COUNTRY_FLAGS[company.country] ?? "🌐"}</span>
                          <span>{company.country}</span>
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {company.source === "user_added" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-amber-500/50 text-amber-500 bg-amber-500/10 font-medium"
                          >
                            Custom
                          </Badge>
                        )}
                        {company.scored ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Scored</span>
                          </span>
                        ) : company.source === "user_added" ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-blue-400">
                            <Clock className="w-3 h-3 animate-pulse" />
                            <span>Pending</span>
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleRemove(company.ticker); }}
                        disabled={removeMutation.isPending}
                        aria-label={`Remove ${company.ticker}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CompanyDrawer
        ticker={selectedTicker}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </Layout>
  );
}
