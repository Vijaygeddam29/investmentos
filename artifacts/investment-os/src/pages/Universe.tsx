import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useListUniverse, useAddToUniverse, useRemoveFromUniverse } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Loader2, Globe, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CompanyDrawer } from "@/components/company/CompanyDrawer";
import { Combobox } from "@/components/ui/combobox";
import { countryFilterFn } from "@/lib/country-filter";

const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", India: "🇮🇳",
  Germany: "🇩🇪", France: "🇫🇷", Italy: "🇮🇹", China: "🇨🇳",
  Taiwan: "🇹🇼", Netherlands: "🇳🇱", Canada: "🇨🇦", Australia: "🇦🇺",
  Brazil: "🇧🇷", Denmark: "🇩🇰", "Hong Kong": "🇭🇰", Ireland: "🇮🇪",
  Israel: "🇮🇱", Singapore: "🇸🇬", Switzerland: "🇨🇭", Uruguay: "🇺🇾",
};

export default function Universe() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { market } = useAuth();
  const defaultMarketCountry = market !== "All" ? market : undefined;

  const [sectorFilter, setSectorFilter]   = useState("");
  const [countryFilter, setCountryFilter] = useState(market !== "All" ? market : "");
  const [appliedSector, setAppliedSector] = useState<string | undefined>(undefined);
  const [appliedCountry, setAppliedCountry] = useState<string | undefined>(defaultMarketCountry);

  const { data, isLoading } = useListUniverse({ sector: appliedSector, country: appliedCountry });
  const { data: allData }   = useListUniverse({});
  const removeMutation = useRemoveFromUniverse();
  const addMutation    = useAddToUniverse();
  const queryClient    = useQueryClient();
  const { toast }      = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ ticker: "", name: "", sector: "" });

  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    allData?.companies?.forEach(c => { if (c.sector) set.add(c.sector); });
    return [...set].sort();
  }, [allData]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    allData?.companies?.forEach(c => { if (c.country) set.add(c.country); });
    return [...set].sort().map(name => `${COUNTRY_FLAGS[name] ?? "🌐"} ${name}`);
  }, [allData]);

  function countryOptionToValue(opt: string) {
    return opt.replace(/^[^ ]+ /, "");
  }

  const hasActiveFilters = !!appliedSector || !!appliedCountry;

  function handleApplyFilters() {
    setAppliedSector(sectorFilter || undefined);
    setAppliedCountry(
      countryFilter ? countryOptionToValue(countryFilter) : undefined
    );
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
        }
      }
    );
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ticker || !formData.name) return;

    addMutation.mutate(
      { data: formData },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/universe"] });
          setIsOpen(false);
          setFormData({ ticker: "", name: "", sector: "" });
          toast({ title: "Added", description: `${formData.ticker} added to universe.` });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">Universe Manager</h1>
              <p className="text-muted-foreground">
                Manage the pool of{" "}
                <strong className="text-foreground">{data?.companies?.length ?? 0}</strong> equities scanned by the pipeline.
              </p>
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Add Ticker
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add to Universe</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Ticker Symbol</label>
                  <Input
                    placeholder="e.g. AAPL"
                    value={formData.ticker}
                    onChange={e => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                    className="uppercase font-mono bg-secondary/50 border-border"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                  <Input
                    placeholder="e.g. Apple Inc."
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="bg-secondary/50 border-border"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Sector (Optional)</label>
                  <Combobox
                    options={sectorOptions}
                    value={formData.sector}
                    onChange={v => setFormData({ ...formData, sector: v })}
                    placeholder="Select sector…"
                  />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save to Database"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-border bg-card/50">
          <div className="flex-1 min-w-[160px] space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sector</label>
            <Combobox
              options={sectorOptions}
              value={sectorFilter}
              onChange={setSectorFilter}
              placeholder="All Sectors"
            />
          </div>

          <div className="flex-1 min-w-[180px] space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Country</label>
            <Combobox
              options={countryOptions}
              value={countryFilter}
              onChange={setCountryFilter}
              placeholder="All Countries"
              filterFn={countryFilterFn}
            />
          </div>

          <div className="flex gap-2 pb-0.5">
            <Button size="sm" onClick={handleApplyFilters} className="h-8 gap-1.5">
              Filter
            </Button>
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={handleClearFilters} className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/20">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[100px] sticky left-0 bg-secondary/30 z-10 whitespace-nowrap">Ticker</TableHead>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Sector</TableHead>
                  <TableHead className="whitespace-nowrap">Country</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : data?.companies?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {hasActiveFilters ? "No companies match your filters." : "Universe is empty. Add companies to begin."}
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.companies.map((company) => (
                    <TableRow key={company.ticker} className="border-border hover:bg-secondary/40 group cursor-pointer" onClick={() => { setSelectedTicker(company.ticker); setDrawerOpen(true); }}>
                      <TableCell className="font-mono font-bold text-primary sticky left-0 bg-card z-10 group-hover:bg-secondary/40 whitespace-nowrap hover:underline">{company.ticker}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{company.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{company.sector || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {company.country ? (
                          <span className="flex items-center gap-1.5">
                            <span>{COUNTRY_FLAGS[company.country] ?? "🌐"}</span>
                            <span>{company.country}</span>
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); handleRemove(company.ticker); }}
                          disabled={removeMutation.isPending}
                          aria-label={`Remove ${company.ticker}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
