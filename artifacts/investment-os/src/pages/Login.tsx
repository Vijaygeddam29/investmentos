import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BarChart3, Mail, MessageCircle, ArrowLeft, ShieldCheck } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type Method  = "email" | "whatsapp";
type Step    = "choose" | "contact" | "otp";

export default function Login() {
  const { login }    = useAuth();
  const { toast }    = useToast();

  const [step,    setStep]    = useState<Step>("choose");
  const [method,  setMethod]  = useState<Method>("email");
  const [contact, setContact] = useState("");
  const [code,    setCode]    = useState("");
  const [busy,    setBusy]    = useState(false);

  async function handleSendOtp() {
    if (!contact.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contact.trim(), type: method }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to send OTP");
      toast({ title: "Code sent!", description: data.message });
      setStep("otp");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
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
      login(data.token, data.user);
    } catch (e: any) {
      toast({ title: "Wrong code", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
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
              <h2 className="text-lg font-semibold text-white text-center mb-1">Check your {method === "email" ? "inbox" : "WhatsApp"}</h2>
              <p className="text-sm text-slate-400 text-center mb-6">
                Enter the 6-digit code sent to <span className="text-white font-medium">{contact}</span>
              </p>
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
        </div>

        <p className="text-xs text-slate-600 text-center mt-6">
          Secure login via one-time password · No password needed
        </p>
      </div>
    </div>
  );
}
