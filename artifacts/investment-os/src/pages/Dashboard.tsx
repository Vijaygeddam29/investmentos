import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyTable } from "@/components/dashboard/CompanyTable";
import { useListScores, ListScoresEngine } from "@workspace/api-client-react";
import { Shield, Rocket, Waves } from "lucide-react";

export default function Dashboard() {
  const { data: fortressData, isLoading: fLoading } = useListScores({ engine: ListScoresEngine.fortress, minScore: 0.6 });
  const { data: rocketData, isLoading: rLoading } = useListScores({ engine: ListScoresEngine.rocket, minScore: 0.6 });
  const { data: waveData, isLoading: wLoading } = useListScores({ engine: ListScoresEngine.wave, minScore: 0.5 });

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight mb-2">Strategy Engines</h1>
          <p className="text-muted-foreground">AI-scored investment candidates across three core strategies.</p>
        </div>

        <Tabs defaultValue="fortress" className="w-full">
          <TabsList className="bg-secondary/50 border border-border p-1 rounded-xl h-14 mb-6 inline-flex">
            <TabsTrigger value="fortress" className="rounded-lg h-full px-6 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-emerald-400 transition-all">
              <Shield className="w-4 h-4 mr-2" />
              Fortress
            </TabsTrigger>
            <TabsTrigger value="rocket" className="rounded-lg h-full px-6 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-orange-400 transition-all">
              <Rocket className="w-4 h-4 mr-2" />
              Rocket
            </TabsTrigger>
            <TabsTrigger value="wave" className="rounded-lg h-full px-6 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-cyan-400 transition-all">
              <Waves className="w-4 h-4 mr-2" />
              Wave
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fortress" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-100/80 flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-400 block mb-1">Long-Term Compounders</strong>
                Companies with impenetrable moats, high ROIC, pristine balance sheets, and consistent cash flow generation. 
                Scores heavily weight Profitability (30%) and Capital Efficiency (20%).
              </div>
            </div>
            <CompanyTable data={fortressData?.scores || []} isLoading={fLoading} />
          </TabsContent>

          <TabsContent value="rocket" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-4 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 text-sm text-orange-100/80 flex items-start gap-3">
              <Rocket className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-orange-400 block mb-1">High-Growth Innovators</strong>
                Founder-led disruptors with high R&D intensity, rapid revenue acceleration, and strong insider ownership.
                Scores heavily weight Growth (30%) and Innovation (30%).
              </div>
            </div>
            <CompanyTable data={rocketData?.scores || []} isLoading={rLoading} />
          </TabsContent>

          <TabsContent value="wave" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-4 p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-sm text-cyan-100/80 flex items-start gap-3">
              <Waves className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-cyan-400 block mb-1">Tactical Momentum</strong>
                Mispriced equities showing technical breakouts and positive sentiment shifts.
                Scores heavily weight Market Momentum (40%) and Valuation (30%).
              </div>
            </div>
            <CompanyTable data={waveData?.scores || []} isLoading={wLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
