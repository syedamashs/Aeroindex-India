import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEMO_ACCOUNTS } from '@/context/AuthContext';
import { Plane, Lock, Mail, ArrowRight, Info } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@aeroindex.gov.in');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      navigate('/dashboard');
    } else {
      setError('Invalid credentials. Use one of the demo accounts below.');
    }
  };

  const fillAccount = (acct: typeof DEMO_ACCOUNTS[number]) => {
    setEmail(acct.email);
    setPassword(acct.password);
    setError('');
  };

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.15) 0%, transparent 50%)',
      }} />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-xl bg-white/10 items-center justify-center mb-4">
            <Plane className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display font-bold text-2xl text-white">AeroIndex India</h1>
          <p className="text-navy-300 text-sm mt-1">National Airfare Price Intelligence Platform</p>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-semibold text-lg text-navy-900 mb-1">Sign In</h2>
          <p className="text-sm text-slate-500 mb-4">Demo authentication for prototype access</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                <Mail className="w-3 h-3" /> Email
              </label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@aeroindex.gov.in"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                <Lock className="w-3 h-3" /> Password
              </label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-danger-600 bg-danger-500/10 rounded-lg px-3 py-2">{error}</div>
            )}

            <button type="submit" className="btn-primary w-full py-2.5">
              Sign In
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mb-3">
              <Info className="w-3 h-3" /> Demo accounts (click to fill)
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.email}
                  onClick={() => fillAccount(acct)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-navy-800">{acct.role}</p>
                      <p className="text-xs text-slate-500">{acct.email}</p>
                    </div>
                    <span className="badge-navy text-xs">{acct.password}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-navy-400 mt-4">
          SIH 2026 • SIH26056 • Prototype authentication
        </p>
      </div>
    </div>
  );
}
