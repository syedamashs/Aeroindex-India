import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, DEMO_ACCOUNTS } from '@/context/AuthContext';
import { Plane, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, Sparkles } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('admin@aeroindex.gov.in');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const ok = await login(email, password);
      if (ok) {
        const requestedPath = (location.state as { from?: unknown } | null)?.from;
        const destination = typeof requestedPath === 'string'
          && requestedPath.startsWith('/')
          && !requestedPath.startsWith('//')
          ? requestedPath
          : '/dashboard';
        navigate(destination, { replace: true });
      } else {
        setError('Invalid credentials. Select one of the verified demo personas below.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillAccount = (acct: typeof DEMO_ACCOUNTS[number]) => {
    setEmail(acct.email);
    setPassword(acct.password);
    setError('');
  };

  return (
    <div className="login-page min-h-screen bg-navy-950 flex flex-col justify-between p-6 relative overflow-hidden">
      {/* Mesh Glow Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(34,197,94,0.25) 0%, transparent 60%), radial-gradient(circle at 80% 70%, rgba(56,189,248,0.2) 0%, transparent 60%)',
      }} />

      {/* Top Brand Tag */}
      <div className="relative z-10 flex items-center justify-between max-w-md w-full mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <span>← Return to Overview</span>
        </button>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
          <Sparkles className="w-3 h-3" />
          SIH 2026 Prototype
        </span>
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto my-auto">
        {/* Logo & Headline */}
        <div className="login-brand text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-navy-800 to-navy-600 items-center justify-center mb-4 shadow-xl ring-1 ring-white/20">
            <Plane className="w-7 h-7 text-accent-400" />
          </div>
          <h1 className="font-display font-extrabold text-2xl lg:text-3xl text-white tracking-tight">
            AeroIndex India
          </h1>
          <p className="text-navy-300 text-xs mt-1">National Airfare Price Intelligence Command Terminal</p>
        </div>

        {/* Login Glass Card */}
        <div className="login-card bg-navy-900/90 backdrop-blur-xl border border-navy-700/80 rounded-2xl p-7 shadow-2xl space-y-5">
          <div>
            <h2 className="font-display font-bold text-lg text-white">Authorized Access Terminal</h2>
            <p className="text-xs text-slate-400 mt-0.5">Secure single sign-on for DGCA, MoCA & public analysts</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Identity Identifier / Email</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-navy-700 bg-navy-950/80 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 transition"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter identity email"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Passkey Authentication</span>
              </label>
              <input
                type="password"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-navy-700 bg-navy-950/80 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 transition font-mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="login-submit w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-accent-500 to-emerald-600 text-navy-950 hover:opacity-95 font-extrabold text-xs tracking-wide transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Authorize & Enter Command'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Accounts Pill Selectors */}
          <div className="pt-4 border-t border-navy-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <UserCheck className="w-3.5 h-3.5 text-accent-400" />
                Select Demo Role Persona:
              </span>
              <span className="text-[10px] text-slate-500">Click to fill</span>
            </div>

            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acct) => {
                const isSelected = email === acct.email;
                return (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => fillAccount(acct)}
                    className={`login-role w-full text-left px-3.5 py-2 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-accent-500/60 bg-accent-500/10 text-white shadow-sm'
                        : 'border-navy-800 bg-navy-950/40 text-slate-300 hover:bg-navy-800/60'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">{acct.role}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{acct.email}</p>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-navy-800 text-accent-400 border border-navy-700">
                      {acct.password}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Spec */}
      <div className="relative z-10 text-center text-xs text-slate-500">
        <div className="inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
          <span>Role-Based Access Control Spec • SIH 2026</span>
        </div>
      </div>
    </div>
  );
}
