import { useState } from "react";
import { useAuth, Market } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BarChart3, Mail, MessageCircle, ArrowLeft, ShieldCheck, Globe, CheckCircle2 } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type Method = "email" | "whatsapp";
type Step   = "choose" | "contact" | "otp" | "market";

interface PendingAuth {
  token: string;
  user: ReturnType<typeof useAuth>["user"];
}

const MARKETS: { value: Market; label: string; flag: string; description: string }[] = [
  { value: "United States", flag: "🇺🇸", label: "United States", description: "109 companies · NYSE & NASDAQ" },
  { value: "United Kingdom", flag: "🇬🇧", label: "United Kingdom", description: "25 companies · LSE" },
  { value: "Europe",        flag: "🇪🇺", label: "Europe",         description: "10 companies · Multi-exchange" },
  { value: "India",          flag: "🇮🇳", label: "India",          description: "18 companies · NSE & BSE" },
  { value: "All",            flag: "🌍", label: "All Markets",   description: "185 companies globally" },
];

export default function Login() {
  const { login, setMarket } = useAuth();
  const { toast }            = useToast();

  const [step,        setStep]        = useState<Step>("choose");
  const [method,      setMethod]      = useState<Method>("email");
  const [contact,     setContact]     = useState("");
  const [code,        setCode]        = useState("");
  const [busy,        setBusy]        = useState(false);
  const [devCode,     setDevCode]     = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState<PendingAuth | null>(null);
  const [selected,    setSelected]    = useState<Market | null>(null);

  async function handleSendOtp() {
    if (!contact.trim()) return;
    setBusy(true);
    setDevCode(null);
    try {
      const r = await fetch(`${API}/api/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contact.trim(), type: method }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to send OTP");
      if (data.devCode) setDevCode(data.devCode);
      toast({ title: "Code sent!", description: data.message });
      setStep("otp");
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contact.trim(), type: method, code: code.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Verification failed");
      setPendingAuth({ token: data.token, user: data.user });
      setStep("market");
    } catch (e: unknown) {
      toast({ title: "Wrong code", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function handleMarketConfirm() {
    if (!pendingAuth || !selected) return;
    setMarket(selected);
    login(pendingAuth.token, pendingAuth.user!);
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Investment OS</span>
          </div>
          <p className="text-sm text-slate-400">Hedge-fund grade stock research</p>
        </div>

        <div className="bg-[#1a1d2e] border border-slate-800 rounded-2xl p-7 shadow-2xl">

          {/* ── Step 1: choose method ── */}
          {step === "choose" && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">Sign in</h2>
              <p className="text-sm text-slate-400 mb-6">Choose how you'd like to receive your code</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setMethod("email"); setStep("contact"); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-700 hover:border-indigo-500 hover:bg-indigo-600/10 transition-all group"
                >
                  <Mail className="w-6 h-6 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Email</span>
                </button>
                <button
                  onClick={() => { setMethod("whatsapp"); setStep("contact"); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-700 hover:border-green-500 hover:bg-green-600/10 transition-all group"
                >
                  <MessageCircle className="w-6 h-6 text-slate-400 group-hover:text-green-400 transition-colors" />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">WhatsApp</span>
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: enter contact ── */}
          {step === "contact" && (
            <>
              <button
                onClick={() => setStep("choose")}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h2 className="text-lg font-semibold text-white mb-1">
                {method === "email" ? "Enter your email" : "Enter your WhatsApp number"}
              </h2>
              <p className="text-sm text-slate-400 mb-5">
                We'll send a 6-digit code to verify your identity.
              </p>
              <Input
                type={method === "email" ? "email" : "tel"}
                placeholder={method === "email" ? "you@example.com" : "+1 234 567 8900"}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                className="bg-[#0f1117] border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500 mb-4"
                autoFocus
              />
              <Button
                onClick={handleSendOtp}
                disabled={busy || !contact.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send Code
              </Button>
            </>
          )}

          {/* ── Step 3: enter OTP ── */}
          {step === "otp" && (
            <>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600/20 mx-auto mb-5">
                <ShieldCheck className="w-6 h-6 text-indigo-400" />
              </div>
              <h2 className="text-lg font-semibold text-white text-center mb-1">
                Check your {method === "email" ? "inbox" : "WhatsApp"}
              </h2>
              <p className="text-sm text-slate-400 text-center mb-4">
                Enter the 6-digit code sent to <span className="text-white font-medium">{contact}</span>
              </p>

              {devCode && (
                <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-center">
                  <p className="text-[11px] text-amber-400 uppercase tracking-wider mb-1.5 font-medium">Dev mode — your code</p>
                  <p className="text-2xl font-bold tracking-[0.3em] text-white font-mono">{devCode}</p>
                </div>
              )}

              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                className="bg-[#0f1117] border-slate-700 text-white text-center text-2xl font-bold tracking-[0.4em] placeholder:text-slate-700 focus:border-indigo-500 mb-4"
                autoFocus
              />
              <Button
                onClick={handleVerify}
                disabled={busy || code.length !== 6}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium mb-3"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Verify &amp; Sign In
              </Button>
              <button
                onClick={() => { setCode(""); handleSendOtp(); }}
                className="w-full text-sm text-slate-400 hover:text-white transition-colors"
              >
                Resend code
              </button>
            </>
          )}

          {/* ── Step 4: choose market ── */}
          {step === "market" && (
            <>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-600/20 mx-auto mb-5">
                <Globe className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white text-center mb-1">Choose your market</h2>
              <p className="text-sm text-slate-400 text-center mb-5">
                We'll focus your signals, screener, and portfolio on this market.
                You can change it anytime from the sidebar.
              </p>

              <div className="space-y-2.5 mb-5">
                {MARKETS.map((m) => {
                  const isActive = selected === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setSelected(m.value)}
                      className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border transition-all text-left ${
                        isActive
                          ? "border-indigo-500 bg-indigo-600/15"
                          : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/40"
                      }`}
                    >
                      <span className="text-2xl leading-none">{m.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-tight ${isActive ? "text-white" : "text-slate-300"}`}>
                          {m.label}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{m.description}</p>
                      </div>
                      {isActive && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={handleMarketConfirm}
                disabled={!selected}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                Enter Investment OS
              </Button>
            </>
          )}

        </div>

        <p className="text-xs text-slate-600 text-center mt-6">
          Secure login via one-time password · No password needed
        </p>
      </div>
    </div>
  );
}
