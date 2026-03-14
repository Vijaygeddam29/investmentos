import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import { DriftSignals, OpportunityAlerts, RiskAlerts } from "@/pages/Signals";
import Universe from "@/pages/Universe";
import Screener from "@/pages/Screener";
import SectorHeatmap from "@/pages/SectorHeatmap";
import Portfolio from "@/pages/Portfolio";
import PortfolioBuilder from "@/pages/PortfolioBuilder";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect to="/login" />;

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/signals/drift" component={DriftSignals} />
      <Route path="/signals/opportunities" component={OpportunityAlerts} />
      <Route path="/signals/risk" component={RiskAlerts} />
      <Route path="/universe" component={Universe} />
      <Route path="/screener" component={Screener} />
      <Route path="/sector-heatmap" component={SectorHeatmap} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/portfolio/builder" component={PortfolioBuilder} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route>
        <ProtectedRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
