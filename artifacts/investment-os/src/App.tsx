import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import Dashboard from "@/pages/Dashboard";
import { DriftSignals, OpportunityAlerts, RiskAlerts } from "@/pages/Signals";
import Universe from "@/pages/Universe";
import Screener from "@/pages/Screener";
import SectorHeatmap from "@/pages/SectorHeatmap";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/signals/drift" component={DriftSignals} />
      <Route path="/signals/opportunities" component={OpportunityAlerts} />
      <Route path="/signals/risk" component={RiskAlerts} />
      <Route path="/universe" component={Universe} />
      <Route path="/screener" component={Screener} />
      <Route path="/sector-heatmap" component={SectorHeatmap} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
