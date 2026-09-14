import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, ArrowRight, Mail, Server, Database, KeyRound, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { loginWithCredentials, loginAsDemoUser, demoUsers, isLoading } = useAuth();

  const [email, setEmail] = useState('marcus.v@acmecal.com');
  const [password, setPassword] = useState('Password123!');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const success = await loginWithCredentials(email, password);
    if (success) {
      onLoginSuccess();
    } else {
      setErrorMessage('Invalid credentials or authentication error');
    }
  };

  const handleSelectDemo = (userId: string) => {
    loginAsDemoUser(userId);
    onLoginSuccess();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-xs mb-3 text-white">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Calibration Commercial Module
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Enterprise Multi-Tenant Metrology & Calibration Suite
          </p>
        </div>

        {/* Login Box */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Sign in to your account</h3>

          {errorMessage && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@company.com"
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<KeyRound className="w-4 h-4 text-slate-400" />}
              required
            />

            <Button type="submit" className="w-full" isLoading={isLoading} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Sign In
            </Button>
          </form>

          {/* Quick Demo Personas */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quick Demo Role Switcher
              </span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 font-semibold border border-blue-200">
                1-Click
              </span>
            </div>

            <div className="space-y-2">
              {demoUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectDemo(u.id)}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-left text-xs transition-all hover:border-blue-400 hover:bg-blue-50/30"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800">{u.full_name}</span>
                    <span className="text-[11px] text-slate-500">{u.email}</span>
                  </div>
                  <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-slate-200">
                    {u.role === 'super_admin'
                      ? 'Super Admin'
                      : u.role === 'collection_agent'
                      ? 'Collection Agent'
                      : u.role.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security / Architecture Footer Badges */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>Supabase RLS</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>Cloudflare Workers</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Zod & JWT</span>
          </div>
        </div>
      </div>
    </div>
  );
};
