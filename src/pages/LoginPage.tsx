import { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Wrench,
  ShoppingBag,
  Navigation,
  KeyRound,
  X,
  Copy,
  Check,
  Clock,
} from "lucide-react";
import { useStore } from "../context/StoreContext";
import { showToast } from "../components/Toast";
import { loadFromSupabase } from "../services/supabaseSync";

// ─── Forgot-password stage machine ───────────────────────────────────────────
type ForgotStage = 'form' | 'pending' | 'approved' | 'rejected';

interface ForgotState {
  stage: ForgotStage;
  requestId: string | null;
  tempPassword: string | null;
  copied: boolean;
  error: string | null;
}

export function LoginPage() {
  const { service } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgot, setForgot] = useState<ForgotState>({
    stage: 'form',
    requestId: null,
    tempPassword: null,
    copied: false,
    error: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // ── Forgot-password polling ──────────────────────────────────────────────
  useEffect(() => {
    if (forgot.stage !== 'pending' || !forgot.requestId) return;

    const requestId = forgot.requestId;

    const poll = async () => {
      try {
        const res = await fetch(`/api/password-reset/${requestId}`);
        const text = await res.text();
        if (!res.ok || !text) {
          console.error('[ForgotPassword] Poll HTTP error:', res.status, text || '(empty body)');
          return;
        }
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          console.error('[ForgotPassword] Poll received non-JSON response:', text.slice(0, 200));
          return;
        }
        console.log('[ForgotPassword] Poll result:', json);

        if (json.status === 'approved') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          // Refresh users from Supabase so the login check sees the updated
          // password written by the admin's approve action.
          try {
            const fresh = await loadFromSupabase();
            if (fresh) service.mergeExternalState(fresh);
          } catch {
            // Non-fatal: if Supabase is unreachable the user can refresh the page
          }
          setForgot((prev) => ({
            ...prev,
            stage: 'approved',
            tempPassword: json.tempPassword,
          }));
        } else if (json.status === 'rejected') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setForgot((prev) => ({ ...prev, stage: 'rejected' }));
        }
      } catch (err) {
        console.error('[ForgotPassword] Poll fetch error:', err);
      }
    };

    // Poll immediately, then every 3 s
    poll();
    pollRef.current = setInterval(poll, 3000);

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [forgot.stage, forgot.requestId]);

  const closeForgotModal = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setShowForgotModal(false);
    setForgotUsername('');
    setForgot({ stage: 'form', requestId: null, tempPassword: null, copied: false, error: null });
  };

  // Restore remembered username
  useEffect(() => {
    const saved = localStorage.getItem("crm_remember_user");
    if (saved) {
      setUsername(saved);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      showToast("warning", "Please enter both username and password.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      try {
        const result = service.login(trimmedUsername, trimmedPassword);
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
        if (!result.user) {
          setError("Invalid username or password.");
          setLoading(false);
          return;
        }

        if (rememberMe) {
          localStorage.setItem("crm_remember_user", trimmedUsername);
        } else {
          localStorage.removeItem("crm_remember_user");
        }

        showToast(
          "success",
          `Welcome, ${result.user.username} (${result.user.role})!`,
        );
      } catch (err) {
        setError(
          `Database Error: ${err instanceof Error ? err.message : String(err)}`,
        );
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen flex">
      {/* ─── LEFT: Branding Panel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden animate-fade-in">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 animate-gradient-drift"
          style={{
            background:
              "linear-gradient(135deg, #0a1628 0%, #0d2b4e 25%, #143b6e 50%, #0d2b4e 75%, #0a1628 100%)",
          }}
        />

        {/* Geometric overlay — subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Glowing orbs */}
        <div className="absolute top-1/4 -left-20 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo / Brand */}
          <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="CyGnuS Logo"
                className="h-12 w-12 object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]"
              />
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  CRM Pro
                </h1>
                <p className="text-xs text-brand-200/70 font-medium tracking-wide">
                  Repair Management System
                </p>
              </div>
            </div>
          </div>

          {/* Center tagline */}
          <div className="animate-slide-up" style={{ animationDelay: "250ms" }}>
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
              Enterprise Repair
              <br />
              <span className="bg-gradient-to-r from-brand-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
                & Operations
              </span>
              <br />
              Management Hub
            </h2>
            <p className="mt-6 text-base text-slate-300/80 max-w-md leading-relaxed">
              Streamline your repair workflow, track inventory, manage
              deliveries, and automate customer notifications — all from a
              single command center.
            </p>
          </div>

          {/* Feature bullets */}
          <div
            className="animate-slide-up space-y-3"
            style={{ animationDelay: "400ms" }}
          >
            {[
              {
                icon: <Wrench className="h-4 w-4" />,
                text: "Full repair lifecycle tracking",
              },
              {
                icon: <ShoppingBag className="h-4 w-4" />,
                text: "Inventory & sales management",
              },
              {
                icon: <Navigation className="h-4 w-4" />,
                text: "Delivery dispatch & monitoring",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm text-slate-300/70"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-brand-300">
                  {f.icon}
                </span>
                {f.text}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="animate-fade-in flex items-center justify-between text-xs text-slate-400/50"
            style={{ animationDelay: "600ms" }}
          >
            <span>CyGnuS SARL · CRM Pro v3</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
              System Online
            </span>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Login Form ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-[#0b0f19] p-6 sm:p-8 lg:p-12 animate-fade-in">
        <div className="w-full max-w-md">
          {/* Logo — always visible above the card header */}
          <div className="mb-7 flex flex-col items-center animate-slide-up">
            <div className="relative">
              <img
                src="/logo.png"
                alt="CyGnuS logo"
                className="h-20 w-20 object-contain drop-shadow-[0_4px_24px_rgba(99,102,241,0.35)]"
              />
            </div>
            <p className="mt-3 text-[11px] font-semibold tracking-widest uppercase text-brand-500 dark:text-brand-400 select-none">
              CyGnuS SARL
            </p>
          </div>

          {/* Header */}
          <div
            className="mb-8 animate-slide-up text-center"
            style={{ animationDelay: "100ms" }}
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Sign in
            </h2>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              Enter your credentials to access the dashboard
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-400 animate-fade-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div
              className="relative animate-slide-up"
              style={{ animationDelay: "150ms" }}
            >
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 select-none">
                Username
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full h-11 rounded-lg border bg-white dark:bg-[#131b2e] pl-10 pr-3 text-sm text-gray-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  style={{
                    borderColor:
                      focusedField === "username" ? "#3b82f6" : undefined,
                  }}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div
              className="relative animate-slide-up"
              style={{ animationDelay: "200ms" }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 select-none">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full h-11 rounded-lg border bg-white dark:bg-[#131b2e] pl-10 pr-10 text-sm text-gray-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  style={{
                    borderColor:
                      focusedField === "password" ? "#3b82f6" : undefined,
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me + Forgot password */}
            <div
              className="flex items-center justify-between animate-slide-up"
              style={{ animationDelay: "250ms" }}
            >
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="h-4 w-4 rounded border border-gray-300 dark:border-slate-600 peer-checked:bg-brand-600 peer-checked:border-brand-600 transition-colors flex items-center justify-center">
                    {rememberMe && (
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
                  Remember me
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotUsername('');
                  setForgot({ stage: 'form', requestId: null, tempPassword: null, copied: false, error: null });
                  setShowForgotModal(true);
                }}
                className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* Sign In button */}
            <div
              className="animate-slide-up"
              style={{ animationDelay: "300ms" }}
            >
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-700 hover:to-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <p
            className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500 animate-fade-in"
            style={{ animationDelay: "500ms" }}
          >
            CRM Pro v3
          </p>
        </div>
      </div>

      {/* ─── Forgot Password Modal ─────────────────────────────── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop — only closeable on form stage */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => forgot.stage === 'form' && closeForgotModal()}
          />

          {/* Panel */}
          <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl p-6 animate-slide-up">

            {/* Close button — always visible */}
            <button
              onClick={closeForgotModal}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* ── STAGE: form ─────────────────────────────────────── */}
            {forgot.stage === 'form' && (
              <>
                <div className="flex flex-col items-center text-center mb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 mb-3">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Forgot Password?</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Enter your username — an admin will be notified and can reset your access.
                  </p>
                </div>

                {forgot.error && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {forgot.error}
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const name = forgotUsername.trim();
                    if (!name) return;

                    setForgot((prev) => ({ ...prev, error: null }));

                    try {
                      console.log('[ForgotPassword] Submitting request for:', name);
                      const res = await fetch('/api/password-reset/request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: name }),
                      });

                      const text = await res.text();
                      if (!text) {
                        throw new Error('Server returned an empty response. Please try again.');
                      }
                      let json;
                      try {
                        json = JSON.parse(text);
                      } catch {
                        throw new Error('Server returned an invalid response. Please try again.');
                      }
                      console.log('[ForgotPassword] Backend response:', json);

                      if (!res.ok || !json.success) {
                        throw new Error(json.error || `Server error ${res.status}`);
                      }

                      // Transition to pending only after requestId is confirmed
                      setForgot((prev) => ({ ...prev, stage: 'pending', requestId: json.requestId }));
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err);
                      console.error('[ForgotPassword] Request failed:', err);
                      setForgot((prev) => ({ ...prev, stage: 'form', error: msg }));
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                      Username
                    </label>
                    <input
                      type="text"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      placeholder="Enter your username"
                      autoFocus
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!forgotUsername.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-700 hover:to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <KeyRound className="h-4 w-4" /> Send Reset Request
                  </button>
                </form>
              </>
            )}

            {/* ── STAGE: pending ──────────────────────────────────── */}
            {forgot.stage === 'pending' && (
              <div className="flex flex-col items-center text-center py-4 gap-5">
                {/* Animated spinner ring */}
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-brand-100 dark:border-brand-900/40" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-500 animate-spin" />
                  <Clock className="h-6 w-6 text-brand-500 dark:text-brand-400" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Request sent successfully.</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Waiting for Admin approval…
                    <br />
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      Please keep this window open.
                    </span>
                  </p>
                </div>

                <div className="w-full rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 text-center">
                  An admin will review your request shortly.<br />
                  This page updates automatically.
                </div>
              </div>
            )}

            {/* ── STAGE: approved ─────────────────────────────────── */}
            {forgot.stage === 'approved' && (
              <div className="flex flex-col items-center text-center gap-4 py-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-7 w-7" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Request Approved!</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Use the temporary password below to sign in, then change it immediately.
                  </p>
                </div>

                {/* Temp password display */}
                <div className="w-full rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1.5">
                    Temporary Password
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-lg font-bold tracking-widest font-mono text-gray-900 dark:text-white select-all break-all">
                      {forgot.tempPassword}
                    </code>
                    <button
                      onClick={() => {
                        if (forgot.tempPassword) {
                          navigator.clipboard.writeText(forgot.tempPassword);
                          setForgot((prev) => ({ ...prev, copied: true }));
                          setTimeout(() => setForgot((prev) => ({ ...prev, copied: false })), 2500);
                        }
                      }}
                      className={`shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                        forgot.copied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-300 dark:hover:bg-emerald-700'
                      }`}
                      title="Copy password"
                    >
                      {forgot.copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
                    </button>
                  </div>
                </div>

                <button
                  onClick={closeForgotModal}
                  className="w-full rounded-lg bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-700 hover:to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all"
                >
                  Sign In Now
                </button>
              </div>
            )}

            {/* ── STAGE: rejected ─────────────────────────────────── */}
            {forgot.stage === 'rejected' && (
              <div className="flex flex-col items-center text-center gap-4 py-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                  <X className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Request Rejected</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Your reset request was declined by the admin. Please contact your administrator directly.
                  </p>
                </div>
                <button
                  onClick={closeForgotModal}
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                >
                  Close
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
