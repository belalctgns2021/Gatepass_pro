import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Shield,
  Lock,
  Mail,
  UserCheck,
  Building,
  KeyRound,
  ArrowRight,
  MapPin,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemo, loginWithGoogle, gates } = useAuth();
  const [email, setEmail] = useState<string>('admin@example.com');
  const [password, setPassword] = useState<string>('admin123');
  const [selectedGate, setSelectedGate] = useState<string>('gate_main');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);

  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await login(email, password, selectedGate);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle(selectedGate);
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDemoClick = async (role: 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'SECURITY') => {
    setErrorMessage('');
    try {
      await loginAsDemo(role);
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background industrial pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-emerald-500 items-center justify-center text-slate-950 shadow-xl mb-4">
          <Shield className="h-9 w-9" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">FactoryPass</h1>
        <p className="text-xs uppercase tracking-widest text-emerald-400 font-extrabold mt-1">
          Gate Security & Visitor Management System
        </p>
        <p className="text-xs text-slate-400 mt-2 font-medium">
          Feng Qun Manufacturing Complex
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-slate-900 py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-800 space-y-6">
          {/* Quick 1-Click Demo Accounts Selector */}
          <div>
            <span className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Quick One-Click Demo Login
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleDemoClick('SECURITY')}
                className="p-2.5 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/50 rounded-xl text-center transition group cursor-pointer"
              >
                <div className="text-emerald-300 font-bold text-xs">Security</div>
                <div className="text-[10px] text-emerald-400/80">Guard Scan</div>
              </button>
              <button
                type="button"
                onClick={() => handleDemoClick('ADMIN')}
                className="p-2.5 bg-purple-950/70 hover:bg-purple-900 border border-purple-600/50 rounded-xl text-center transition group cursor-pointer"
              >
                <div className="text-purple-300 font-bold text-xs">Admin</div>
                <div className="text-[10px] text-purple-400/80">Full Control</div>
              </button>
              <button
                type="button"
                onClick={() => handleDemoClick('MANAGER')}
                className="p-2.5 bg-amber-950/70 hover:bg-amber-900 border border-amber-600/50 rounded-xl text-center transition group cursor-pointer"
              >
                <div className="text-amber-300 font-bold text-xs">Manager</div>
                <div className="text-[10px] text-amber-400/80">Approve Passes</div>
              </button>
              <button
                type="button"
                onClick={() => handleDemoClick('RECEPTION')}
                className="p-2.5 bg-blue-950/70 hover:bg-blue-900 border border-blue-600/50 rounded-xl text-center transition group cursor-pointer"
              >
                <div className="text-blue-300 font-bold text-xs">Reception</div>
                <div className="text-[10px] text-blue-400/80">HR Pass Desk</div>
              </button>
            </div>

            {/* Google Sign-In with Firebase Auth */}
            <div className="mt-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2.5 cursor-pointer border border-slate-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isGoogleLoading ? 'Connecting to Firebase...' : 'Sign in with Google (Firebase Auth)'}</span>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-600 rounded-xl text-xs text-rose-200 font-semibold text-center">
              {errorMessage}
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-900 text-slate-500 font-semibold">Or Sign In with Credentials</span>
            </div>
          </div>

          {/* Standard Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Guard Duty Station */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Gate / Duty Station</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <select
                  value={selectedGate}
                  onChange={(e) => setSelectedGate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {gates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.gate_name} ({g.gate_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Station'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Test credentials reference hint */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400">
            <span className="font-bold text-slate-300 block mb-0.5">Development Credentials:</span>
            <div>Admin: <span className="font-mono text-emerald-400">admin@example.com</span> / <span className="font-mono text-slate-300">admin123</span></div>
            <div>Reception: <span className="font-mono text-blue-400">reception@example.com</span> / <span className="font-mono text-slate-300">reception123</span></div>
            <div>Security: <span className="font-mono text-amber-400">security@example.com</span> / <span className="font-mono text-slate-300">security123</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
