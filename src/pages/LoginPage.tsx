import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Loader2, KeyRound, Mail, CheckCircle, ArrowRight } from "lucide-react";
import { useAuth, DEMO_CREDENTIALS } from "@/lib/auth";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || "Login failed.");
      return;
    }
    const stored = JSON.parse(localStorage.getItem("petition_ai_user") || "{}");
    const role = stored.role;
    if (role === "citizen") navigate("/citizen/dashboard");
    else if (role === "officer") navigate("/officer/dashboard");
    else if (role === "admin") navigate("/admin/dashboard");
    else navigate("/");
  }

  function fillDemo(cred: typeof DEMO_CREDENTIALS[0]) {
    setEmail(cred.email);
    setPassword(cred.password);
    setError("");
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setResetLoading(false);
    setResetSent(true);
  }

  if (showForgot) {
    return (
      <div className="min-h-screen bg-navy-975 flex items-center justify-center p-4 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-navy-800/40 via-navy-975 to-navy-975">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-500 mb-4 shadow-xl shadow-gold-500/20">
              <KeyRound className="w-7 h-7 text-navy-950" />
            </div>
            <h1 className="font-display text-2xl font-extrabold text-white">Reset Password</h1>
            <p className="text-slate-400 text-sm mt-1">Enter your email to receive a reset link</p>
          </div>
          <div className="card-reference p-7 sm:p-8 bg-surface-card border-surface-border">
            {resetSent ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-display font-bold text-white mb-2">Check Your Email</h3>
                <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                  We've sent a password reset link to <strong className="text-white">{resetEmail}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => { setShowForgot(false); setResetSent(false); setResetEmail(""); }}
                  className="btn-royal w-full"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      required
                      placeholder="Enter your registered email"
                      className="w-full bg-surface-input border border-surface-border rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="btn-royal w-full py-3"
                >
                  {resetLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : "Send Reset Link"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="w-full text-sm text-slate-400 hover:text-white py-2 transition-colors"
                >
                  Back to Sign In
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-975 flex items-center justify-center p-4 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-navy-800/40 via-navy-975 to-navy-975">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-500 mb-4 shadow-xl shadow-gold-500/25">
            <Shield className="w-7 h-7 text-navy-950" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-white">PetitionAI Portal</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="card-reference p-7 sm:p-8 bg-surface-card border-surface-border">
          {/* Demo Quick Fill */}
          <div className="mb-6">
            <p className="text-[11px] font-bold text-slate-400 mb-2.5 uppercase tracking-wider">Quick Demo Login</p>
            <div className="flex gap-2">
              {DEMO_CREDENTIALS.map(c => (
                <button
                  key={c.role}
                  type="button"
                  onClick={() => fillDemo(c)}
                  className="flex-1 text-xs border border-surface-border bg-surface-cardLighter/60 rounded-xl py-2.5 font-semibold text-slate-200 hover:bg-surface-cardLighter hover:text-white hover:border-navy-500 transition-all capitalize active:scale-[0.98]"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-950/50 border border-red-500/50 text-red-300 text-sm px-4 py-2.5 rounded-xl font-medium"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className="w-full bg-surface-input border border-surface-border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-200">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full bg-surface-input border border-surface-border rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-navy-600 hover:bg-navy-500 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-md disabled:opacity-50 text-sm mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            No account?{" "}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
              Register as Citizen
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6 tracking-wide select-none">
          Protected by JWT Authentication · Role-Based Access Control
        </p>
      </motion.div>
    </div>
  );
}
