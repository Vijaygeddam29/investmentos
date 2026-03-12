import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useListUniverse, useAddToUniverse, useRemoveFromUniverse } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Loader2, Globe, Search, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function Universe() {
  const [sectorFilter, setSectorFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [appliedSector, setAppliedSector] = useState<string | undefined>(undefined);
  const [appliedCountry, setAppliedCountry] = useState<string | undefined>(undefined);

  const { data, isLoading } = useListUniverse({ sector: appliedSector, country: appliedCountry });
  const removeMutation = useRemoveFromUniverse();
  const addMutation = useAddToUniverse();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ ticker: "", name: "", sector: "" });

  const handleApplyFilters = () => {
    setAppliedSector(sectorFilter.trim() || undefined);
    setAppliedCountry(countryFilter.trim() || undefined);
  };

  const handleClearFilters = () => {
    setSectorFilter("");
    setCountryFilter("");
    setAppliedSector(undefined);
    setAppliedCountry(undefined);
  };

  const hasActiveFilters = !!appliedSector || !!appliedCountry;

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
      <div className="max-w-[1000px] mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">Universe Manager</h1>
              <p className="text-muted-foreground">Manage the pool of {data?.companies?.length || 0} equities scanned by the pipeline.</p>
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
                    onChange={e => setFormData({...formData, ticker: e.target.value.toUpperCase()})}
                    className="uppercase font-mono bg-secondary/50 border-border"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                  <Input 
                    placeholder="e.g. Apple Inc." 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="bg-secondary/50 border-border"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Sector (Optional)</label>
                  <Input 
                    placeholder="e.g. Technology" 
                    value={formData.sector}
                    onChange={e => setFormData({...formData, sector: e.target.value})}
                    className="bg-secondary/50 border-border"
                  />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save to Database"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-border bg-card/50">
          <div className="flex-1 min-w-[160px] space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sector</label>
            <Input
              placeholder="e.g. Technology"
              value={sectorFilter}
              onChange={e => setSectorFilter(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleApplyFilters()}
              className="bg-secondary/50 border-border h-8 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[160px] space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Country</label>
            <Input
              placeholder="e.g. US"
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleApplyFilters()}
              className="bg-secondary/50 border-border h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleApplyFilters} className="h-8 gap-1.5">
              <Search className="w-3.5 h-3.5" /> Filter
            </Button>
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={handleClearFilters} className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/20">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[100px]">Ticker</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  </TableCell>
                </TableRow>
              ) : data?.companies?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Universe is empty. Add companies to begin.
                  </TableCell>
                </TableRow>
              ) : (
                data?.companies.map((company) => (
                  <TableRow key={company.ticker} className="border-border hover:bg-secondary/40">
                    <TableCell className="font-mono font-bold text-primary">{company.ticker}</TableCell>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{company.sector || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemove(company.ticker)}
                        disabled={removeMutation.isPending}
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
    </Layout>
  );
}
