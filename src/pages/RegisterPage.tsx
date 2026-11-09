import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    const result = await register({
      name: form.name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      password: form.password,
    });
    if (!result.success) {
      setError(result.error || "Registration failed.");
      return;
    }
    navigate("/citizen/dashboard");
  }

  return (
    <div className="min-h-screen bg-navy-975 flex items-center justify-center p-4 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-navy-800/40 via-navy-975 to-navy-975 py-12">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg relative"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-500 mb-4 shadow-xl shadow-gold-500/25">
            <Shield className="w-7 h-7 text-navy-950" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-white">Create Citizen Account</h1>
          <p className="text-slate-400 text-sm mt-1">Register to submit and track your petitions</p>
        </div>

        <div className="card-reference p-7 sm:p-8 bg-surface-card border-surface-border">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update("name", e.target.value)}
                  required
                  placeholder="Your full name"
                  className="w-full bg-surface-input border border-surface-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update("email", e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="w-full bg-surface-input border border-surface-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => update("phone", e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="w-full bg-surface-input border border-surface-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">Residential Address</label>
              <textarea
                value={form.address}
                onChange={e => update("address", e.target.value)}
                placeholder="House No, Street, Area, City - Pincode"
                rows={2}
                className="w-full bg-surface-input border border-surface-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={e => update("password", e.target.value)}
                    required
                    placeholder="Min 6 characters"
                    className="w-full bg-surface-input border border-surface-border rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => update("confirmPassword", e.target.value)}
                  required
                  placeholder="Repeat password"
                  className="w-full bg-surface-input border border-surface-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-navy-600 hover:bg-navy-500 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-md disabled:opacity-50 text-sm mt-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
