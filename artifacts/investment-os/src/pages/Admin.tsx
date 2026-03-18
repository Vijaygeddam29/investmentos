import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import {
  Users, Activity, Database, TrendingUp, AlertTriangle,
  MessageSquare, RefreshCw, Play, CheckCircle, XCircle,
  Clock, Shield, BarChart3, Zap,
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

export default function Admin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<any>(null);
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
      const [statsData, usersData] = await Promise.all([
        apiFetch("/api/admin/stats"),
        apiFetch("/api/admin/users"),
      ]);
      setStats(statsData);
      setAllUsers(usersData.users ?? []);
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
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Top stat cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users}       label="Total Users"          value={stats.users.total}            sub={`+${stats.users.last7d} this week`}  color="indigo" />
            <StatCard icon={Database}    label="Tickers in Universe"  value={stats.universe.totalTickers}  sub={`${stats.universe.scoredToday} scored today`} color="sky" />
            <StatCard icon={TrendingUp}  label="Opportunities Found"  value={stats.signals.totalOpportunities} color="green" />
            <StatCard icon={AlertTriangle} label="Risk Signals"       value={stats.signals.totalRisks}     color="amber" />
            <StatCard icon={MessageSquare} label="AI Conversations"   value={stats.chat.totalConversations} color="violet" />
            <StatCard icon={BarChart3}   label="Score Records in DB"  value={stats.universe.totalScoreRows} color="indigo" />
            <StatCard icon={Users}       label="New Users (30 days)"  value={stats.users.last30d}          color="green" />
            <StatCard icon={Zap}         label="New Users (7 days)"   value={stats.users.last7d}           color="sky" />
          </div>
        )}

        {/* Pipeline status + trigger */}
        {stats && (
          <div className="bg-[#1a1f2e] border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Data Pipeline</h2>
              </div>
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
                <div className="text-xs text-slate-500 mb-1">Processed</div>
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
              <div className="space-y-1.5">
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

            <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-600">
              <Clock className="w-3 h-3" />
              Next auto-run: {p?.nextScheduledRun ? new Date(p.nextScheduledRun).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} UTC
            </div>
          </div>
        )}

        {/* Top stocks today */}
        {stats?.universe?.topToday?.length > 0 && (
          <div className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Top Scored Stocks Today</h2>
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

        {/* All users */}
        <div className="bg-[#1a1f2e] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">All Registered Users</h2>
            </div>
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
