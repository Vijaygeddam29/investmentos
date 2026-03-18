import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import {
  Users, Activity, Database, TrendingUp, AlertTriangle,
  MessageSquare, RefreshCw, Play, CheckCircle, XCircle,
  Clock, Shield, BarChart3, Zap, Eye, MousePointer, Timer,
  Radio, Server,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeader() {
  const token = localStorage.getItem("ios_jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function StatCard({ icon: Icon, label, value, sub, color = "indigo" }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-400 bg-indigo-500/10",
    green:  "text-green-400 bg-green-500/10",
    amber:  "text-amber-400 bg-amber-500/10",
    red:    "text-red-400 bg-red-500/10",
    sky:    "text-sky-400 bg-sky-500/10",
    violet: "text-violet-400 bg-violet-500/10",
  };
  return (
    <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 75 ? "text-green-400" : pct >= 60 ? "text-indigo-400" : pct >= 45 ? "text-violet-400" : "text-slate-500";
  return <span className={`font-mono text-sm font-bold ${color}`}>{pct}</span>;
}

function SectionHeader({ icon: Icon, title, color = "text-indigo-400" }: { icon: any; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{title}</h2>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function PageLabel({ page }: { page: string }) {
  const labels: Record<string, string> = {
    "/":                  "Dashboard",
    "/signals":           "Signals",
    "/signals/drift":     "Drift Signals",
    "/signals/opportunities": "Opportunities",
    "/signals/risk":      "Risk Signals",
    "/universe":          "Universe",
    "/screener":          "Screener",
    "/sector-heatmap":    "Sector Heatmap",
    "/portfolio":         "Portfolio",
    "/portfolio/builder": "Portfolio Builder",
    "/admin":             "Admin Console",
  };
  return <span>{labels[page] ?? page}</span>;
}

export default function Admin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const isAdmin = user?.email === "vijay@marketlifes.com";

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!isAdmin) { navigate("/"); return; }
  }, [user, isAdmin, navigate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, usersData, analyticsData] = await Promise.all([
        apiFetch("/api/admin/stats"),
        apiFetch("/api/admin/users"),
        apiFetch("/api/admin/analytics"),
      ]);
      setStats(statsData);
      setAllUsers(usersData.users ?? []);
      setAnalytics(analyticsData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function triggerPipeline() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const r = await apiFetch("/api/admin/pipeline/trigger", { method: "POST" });
      setTriggerMsg(r.message ?? "Pipeline started");
      setTimeout(loadData, 3000);
    } catch (e: any) {
      setTriggerMsg(`Error: ${e.message}`);
    } finally {
      setTriggering(false);
    }
  }

  if (!isAdmin) return null;

  const p = stats?.pipeline;
  const pipelinePct = p?.totalTickers ? Math.round(p.tickersProcessed / p.totalTickers * 100) : 0;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest">Admin Console</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
            <p className="text-slate-500 text-sm mt-1">Real-time stats — visible only to you</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm font-mono">
            {error}
          </div>
        )}

        {/* ── SECTION: Users & Platform ───────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users}         label="Total Users"           value={stats.users.total}                 sub={`+${stats.users.last7d} this week`}       color="indigo" />
            <StatCard icon={Database}      label="Universe Tickers"      value={stats.universe.totalTickers}       sub={`${stats.universe.scoredToday} scored today`} color="sky" />
            <StatCard icon={TrendingUp}    label="Opportunities"         value={stats.signals.totalOpportunities}  color="green" />
            <StatCard icon={AlertTriangle} label="Risk Signals"          value={stats.signals.totalRisks}          color="amber" />
            <StatCard icon={MessageSquare} label="AI Conversations"      value={stats.chat.totalConversations}     color="violet" />
            <StatCard icon={BarChart3}     label="Score Records"         value={stats.universe.totalScoreRows}     color="indigo" />
            <StatCard icon={Users}         label="New (30 days)"         value={stats.users.last30d}               color="green" />
            <StatCard icon={Zap}           label="New (7 days)"          value={stats.users.last7d}                color="sky" />
          </div>
        )}

        {/* ── SECTION: User Engagement ────────────────────────────────── */}
        <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-6 space-y-6">
          <SectionHeader icon={Eye} title="User Engagement" color="text-sky-400" />

          {analytics ? (
            <>
              {/* Headline numbers */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/3 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-sky-400">{analytics.activeNow}</div>
                  <div className="text-xs text-slate-500 mt-1">Active now</div>
                  <div className="text-xs text-slate-600">(last 5 min)</div>
                </div>
                <div className="bg-white/3 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{analytics.sessions?.today ?? 0}</div>
                  <div className="text-xs text-slate-500 mt-1">Sessions today</div>
                </div>
                <div className="bg-white/3 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{analytics.sessions?.week ?? 0}</div>
                  <div className="text-xs text-slate-500 mt-1">Sessions this week</div>
                </div>
                <div className="bg-white/3 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{analytics.sessions?.month ?? 0}</div>
                  <div className="text-xs text-slate-500 mt-1">Sessions this month</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Top pages */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MousePointer className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Most Visited Pages (30 days)</span>
                  </div>
                  <div className="space-y-2">
                    {analytics.topPages?.length > 0 ? analytics.topPages.map((r: any, i: number) => {
                      const max = analytics.topPages[0].views;
                      const pct = Math.round(r.views / max * 100);
                      return (
                        <div key={r.page} className="flex items-center gap-3">
                          <span className="text-xs text-slate-600 w-4 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs text-slate-300 truncate"><PageLabel page={r.page} /></span>
                              <span className="text-xs text-slate-500 ml-2 flex-shrink-0">{r.views} views</span>
                            </div>
                            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full bg-sky-500/60" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    }) : <p className="text-xs text-slate-600">No data yet — tracking starts from now.</p>}
                  </div>
                </div>

                {/* Time on page */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Timer className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Time on Page</span>
                  </div>
                  <div className="space-y-2">
                    {analytics.avgDuration?.length > 0 ? analytics.avgDuration.map((r: any) => (
                      <div key={r.page} className="flex items-center justify-between py-1 border-b border-white/3">
                        <span className="text-xs text-slate-300"><PageLabel page={r.page} /></span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-amber-400">{formatDuration(r.avgMs)}</span>
                          <span className="text-xs text-slate-600">({r.samples} sessions)</span>
                        </div>
                      </div>
                    )) : <p className="text-xs text-slate-600">No data yet — tracking starts from now.</p>}
                  </div>
                </div>
              </div>

              {/* Daily trend sparkline (14 days) */}
              {analytics.dailyTrend?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Daily Sessions (14 days)</span>
                  </div>
                  <div className="flex items-end gap-1 h-12">
                    {(() => {
                      const maxVal = Math.max(...analytics.dailyTrend.map((d: any) => Number(d.sessions)));
                      return analytics.dailyTrend.map((d: any) => {
                        const h = maxVal > 0 ? Math.round(Number(d.sessions) / maxVal * 100) : 0;
                        return (
                          <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.sessions} sessions`}>
                            <div className="w-full rounded-sm bg-indigo-500/40 hover:bg-indigo-400/60 transition-colors" style={{ height: `${Math.max(h, 4)}%` }} />
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-700">{analytics.dailyTrend[0]?.day}</span>
                    <span className="text-xs text-slate-700">{analytics.dailyTrend[analytics.dailyTrend.length - 1]?.day}</span>
                  </div>
                </div>
              )}

              {/* Recent activity feed */}
              {analytics.recentActivity?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Radio className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Page Views</span>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {analytics.recentActivity.map((e: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/3">
                        <span className="text-xs font-mono text-slate-600 flex-shrink-0">{new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0 font-mono">{e.sessionId.slice(-6)}</span>
                        <span className="text-xs text-slate-300"><PageLabel page={e.page} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">Loading engagement data…</p>
          )}
        </div>

        {/* ── SECTION: Data Pipeline ──────────────────────────────────── */}
        {stats && (
          <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader icon={Activity} title="Data Pipeline" />
              <div className="flex items-center gap-3">
                {p?.running ? (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Running — {p.currentTicker} / {p.currentStep}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    Idle
                  </span>
                )}
                <button
                  onClick={triggerPipeline}
                  disabled={triggering || p?.running}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                >
                  <Play className="w-3 h-3" />
                  {triggering ? "Starting…" : "Run Now"}
                </button>
              </div>
            </div>

            {triggerMsg && (
              <div className="mb-4 text-xs text-indigo-300 bg-indigo-500/10 rounded-lg px-3 py-2">{triggerMsg}</div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">Last Run</div>
                <div className="text-sm text-white">{p?.lastRun ? new Date(p.lastRun).toLocaleString("en-GB") : "Never"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Updated</div>
                <div className="text-sm text-white">{p?.lastRunUpdated ?? 0} tickers</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Failed</div>
                <div className={`text-sm font-bold ${(p?.lastRunFailed ?? 0) > 0 ? "text-red-400" : "text-green-400"}`}>
                  {p?.lastRunFailed ?? 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Data Sources</div>
                <div className="text-sm text-white">
                  YF: {p?.dataSourceBreakdown?.yahoo ?? 0} · FMP: {p?.dataSourceBreakdown?.fmp ?? 0}
                </div>
              </div>
            </div>

            {p?.running && p.totalTickers > 0 && (
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Progress: {p.tickersProcessed} / {p.totalTickers}</span>
                  <span>{pipelinePct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
                    style={{ width: `${pipelinePct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Clock className="w-3 h-3" />
              Next auto-run: {p?.nextScheduledRun ? new Date(p.nextScheduledRun).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} UTC
            </div>
          </div>
        )}

        {/* ── SECTION: Stock Coverage ─────────────────────────────────── */}
        {stats?.universe?.topToday?.length > 0 && (
          <div className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <SectionHeader icon={TrendingUp} title="Top Scored Stocks Today" color="text-green-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-6 py-3 text-xs font-mono text-slate-500 uppercase">Ticker</th>
                    <th className="text-left px-6 py-3 text-xs font-mono text-slate-500 uppercase">Company</th>
                    <th className="text-left px-6 py-3 text-xs font-mono text-slate-500 uppercase">Sector</th>
                    <th className="text-center px-6 py-3 text-xs font-mono text-slate-500 uppercase">Fortress</th>
                    <th className="text-center px-6 py-3 text-xs font-mono text-slate-500 uppercase">Rocket</th>
                    <th className="text-center px-6 py-3 text-xs font-mono text-slate-500 uppercase">Wave</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.universe.topToday.map((s: any) => (
                    <tr key={s.ticker} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-6 py-3 font-bold text-white font-mono">{s.ticker}</td>
                      <td className="px-6 py-3 text-slate-300 text-xs max-w-[180px] truncate">{s.company ?? "—"}</td>
                      <td className="px-6 py-3 text-slate-500 text-xs">{s.sector ?? "—"}</td>
                      <td className="px-6 py-3 text-center"><ScoreBadge score={s.fortressScore ?? 0} /></td>
                      <td className="px-6 py-3 text-center"><ScoreBadge score={s.rocketScore ?? 0} /></td>
                      <td className="px-6 py-3 text-center"><ScoreBadge score={s.waveScore ?? 0} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SECTION: API Server Metrics ─────────────────────────────── */}
        {stats?.apiMetrics && (
          <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-6 space-y-5">
            <SectionHeader icon={Server} title="API Server Metrics" color="text-violet-400" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/3 rounded-lg p-4">
                <div className="text-xl font-bold text-white">{stats.apiMetrics.totalRequests.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">Total requests</div>
              </div>
              <div className="bg-white/3 rounded-lg p-4">
                <div className={`text-xl font-bold ${stats.apiMetrics.errorRate > 5 ? "text-red-400" : "text-green-400"}`}>
                  {stats.apiMetrics.errorRate}%
                </div>
                <div className="text-xs text-slate-500 mt-1">Error rate</div>
              </div>
              <div className="bg-white/3 rounded-lg p-4">
                <div className="text-xl font-bold text-white">{stats.apiMetrics.avgResponseMs}ms</div>
                <div className="text-xs text-slate-500 mt-1">Avg response</div>
              </div>
              <div className="bg-white/3 rounded-lg p-4">
                <div className="text-xl font-bold text-amber-400">{stats.apiMetrics.totalErrors}</div>
                <div className="text-xs text-slate-500 mt-1">Server errors</div>
              </div>
            </div>
            {stats.apiMetrics.topEndpoints?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Top Endpoints</div>
                <div className="space-y-1">
                  {stats.apiMetrics.topEndpoints.slice(0, 8).map((e: any) => (
                    <div key={e.endpoint} className="flex items-center gap-3 py-1.5 border-b border-white/3">
                      <span className="text-xs font-mono text-slate-400 flex-1 truncate">{e.endpoint}</span>
                      <span className="text-xs text-slate-300 flex-shrink-0">{e.hits.toLocaleString()} hits</span>
                      <span className="text-xs font-mono text-amber-400/70 flex-shrink-0">{e.avgMs}ms</span>
                      {e.errors > 0 && <span className="text-xs text-red-400 flex-shrink-0">{e.errors} err</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs text-slate-600">
              Uptime since: {stats.apiMetrics.uptimeSince ? new Date(stats.apiMetrics.uptimeSince).toLocaleString("en-GB") : "—"}
            </div>
          </div>
        )}

        {/* ── SECTION: All Users ──────────────────────────────────────── */}
        <div className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <SectionHeader icon={Users} title="All Registered Users" />
            <span className="text-xs text-slate-500">{allUsers.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-3 text-xs font-mono text-slate-500 uppercase">#</th>
                  <th className="text-left px-6 py-3 text-xs font-mono text-slate-500 uppercase">Email / Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-mono text-slate-500 uppercase">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-mono text-slate-500 uppercase">Verified</th>
                  <th className="text-left px-6 py-3 text-xs font-mono text-slate-500 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u, i) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-6 py-3 text-slate-600 text-xs">{i + 1}</td>
                    <td className="px-6 py-3 text-slate-300 font-mono text-xs">{u.email ?? u.phone ?? "—"}</td>
                    <td className="px-6 py-3 text-slate-400 text-xs">{u.name ?? "—"}</td>
                    <td className="px-6 py-3">
                      {u.verified
                        ? <CheckCircle className="w-4 h-4 text-green-400" />
                        : <XCircle className="w-4 h-4 text-slate-600" />}
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {new Date(u.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
                {allUsers.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-600 text-sm">No users yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </Layout>
  );
}
