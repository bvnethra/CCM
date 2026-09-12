import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Gauge, Shield, Lock, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('admin@alphametrology.com');
  const [tenantId, setTenantId] = useState('a0000000-0000-0000-0000-000000000001');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, tenantId);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-slate-800 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 mx-auto flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Gauge className="w-7 h-7 text-slate-950 font-bold" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Calibration Commercial HQ</h2>
          <p className="text-xs text-slate-400">Production-Quality Multi-Tenant Enterprise Application</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Tenant Enterprise *
            </label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-sky-300 font-semibold rounded-xl p-3 focus:outline-none focus:border-sky-500"
            >
              <option value="a0000000-0000-0000-0000-000000000001">Alpha Metrology Solutions Ltd. (Tenant A)</option>
              <option value="a0000000-0000-0000-0000-000000000002">Beta Precision Calibrations Inc. (Tenant B)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              User Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl p-3 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Password *
            </label>
            <input
              type="password"
              required
              value="••••••••••••"
              readOnly
              className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-400 rounded-xl p-3 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
              <Shield className="w-3.5 h-3.5" /> Supabase JWT Auth
            </span>
            <span className="text-[11px] text-slate-500">PostgreSQL RLS Active</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition"
          >
            {isLoading ? 'Authenticating...' : 'Sign In to Workspace'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
