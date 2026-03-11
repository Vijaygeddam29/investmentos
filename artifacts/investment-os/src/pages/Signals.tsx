import { Layout } from "@/components/layout/Layout";
import { useListDriftSignals, useListOpportunityAlerts, useListRiskAlerts } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ShieldAlert, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function SignalsLayout({ title, description, icon: Icon, children }: any) {
  return (
    <Layout>
      <div className="max-w-[1200px] mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </Layout>
  );
}

export function DriftSignals() {
  const { data, isLoading } = useListDriftSignals();

  return (
    <SignalsLayout 
      title="Factor Drift Detector" 
      description="Early warning system flagging fundamental deterioration before it reflects in price."
      icon={Activity}
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="h-32 bg-secondary/50 animate-pulse rounded-xl" />
        ) : data?.signals.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl">
            <p className="text-muted-foreground">No factor drift detected in universe.</p>
          </div>
        ) : (
          data?.signals.map(signal => (
            <Card key={signal.id} className="bg-card border-border shadow-md">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="p-2 bg-warning/10 rounded-lg shrink-0">
                  <ShieldAlert className="w-5 h-5 text-warning" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg text-primary">{signal.ticker}</span>
                      <Badge variant="outline">{signal.signalType}</Badge>
                      <Badge variant={signal.severity === 'high' ? 'destructive' : 'secondary'}>
                        {signal.severity}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {format(new Date(signal.date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{signal.description}</p>
                  
                  {signal.currentValue !== undefined && signal.historicalAvg !== undefined && (
                    <div className="mt-4 p-3 bg-secondary/30 rounded-lg flex items-center gap-8 border border-border/50">
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Factor</div>
                        <div className="text-sm font-medium">{signal.factorName || signal.signalType}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Current</div>
                        <div className="text-sm font-mono text-warning font-bold">{signal.currentValue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Historical Avg</div>
                        <div className="text-sm font-mono text-muted-foreground">{signal.historicalAvg.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </SignalsLayout>
  );
}

export function OpportunityAlerts() {
  const { data, isLoading } = useListOpportunityAlerts();

  return (
    <SignalsLayout 
      title="Opportunity Detector" 
      description="Surfacing newly detected candidates that cross strict engine thresholds."
      icon={TrendingUp}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          [1,2].map(i => <div key={i} className="h-48 bg-secondary/50 animate-pulse rounded-xl" />)
        ) : data?.alerts.length === 0 ? (
          <div className="col-span-2 p-12 text-center border border-dashed border-border rounded-xl">
            <p className="text-muted-foreground">No new opportunities detected today.</p>
          </div>
        ) : (
          data?.alerts.map(alert => (
            <Card key={alert.id} className="bg-card border-border overflow-hidden relative group hover:border-primary/50 transition-colors">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-2xl font-mono text-foreground">{alert.ticker}</span>
                    <Badge className={
                      alert.engineType === 'rocket' ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/20' :
                      alert.engineType === 'fortress' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' :
                      'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20'
                    }>
                      {alert.engineType.toUpperCase()}
                    </Badge>
                  </div>
                  {alert.score && (
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground uppercase">Score</div>
                      <div className="font-mono font-bold text-lg text-primary">{alert.score.toFixed(2)}</div>
                    </div>
                  )}
                </div>
                <h4 className="font-medium text-sm mb-1">{alert.alertType}</h4>
                <p className="text-sm text-muted-foreground relative z-10">{alert.description}</p>
                <div className="mt-4 text-xs font-mono text-muted-foreground/50">
                  Detected {format(new Date(alert.date), 'MMM d, yyyy')}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </SignalsLayout>
  );
}

export function RiskAlerts() {
  const { data, isLoading } = useListRiskAlerts();

  return (
    <SignalsLayout 
      title="Risk Alerts" 
      description="Critical warnings for companies exhibiting multiple deterioration signals."
      icon={AlertTriangle}
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="h-24 bg-secondary/50 animate-pulse rounded-xl" />
        ) : data?.alerts.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-xl">
            <p className="text-muted-foreground">Universe clear of critical risks.</p>
          </div>
        ) : (
          data?.alerts.map((alert: any) => (
            <div key={alert.id} className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 flex items-center gap-4">
              <div className="w-12 h-12 bg-destructive/20 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-bold text-lg text-foreground">{alert.ticker}</span>
                  <Badge variant="destructive">CRITICAL RISK</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </SignalsLayout>
  );
}
