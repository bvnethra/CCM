import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, ArrowRight, Mail, Server, Database, KeyRound, Lock, UserCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { loginWithCredentials, isLoading } = useAuth();

  const [email, setEmail] = useState('ccmsuperadmin@gmail.com');
  const [password, setPassword] = useState('ccm1234');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const success = await loginWithCredentials(email, password);
    if (success) {
      onLoginSuccess();
    } else {
      setErrorMessage('Invalid Super Admin credentials or authentication error');
    }
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
            Enterprise Multi-Tenant Metrology Platform
          </p>
        </div>

        {/* Login Box */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Super Admin Sign In</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200">
              <UserCheck className="w-3 h-3" />
              Global Platform Portal
            </span>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Super Admin Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ccmsuperadmin@gmail.com"
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
              Sign In as Super Admin
            </Button>
          </form>

          {/* Single Super Admin Credential Helper Badge */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              Super Admin Email: <span className="font-mono text-slate-700 font-semibold">ccmsuperadmin@gmail.com</span>
            </p>
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
