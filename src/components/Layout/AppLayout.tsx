import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  ClipboardList,
  FlaskConical,
  Gauge,
  Receipt,
  FileCheck2,
  Truck,
  PackageCheck,
  History,
  LogOut,
  Building,
  Shield,
  Layers,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { user, logout, activeTenantId, switchTenant } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'tenants', label: 'Tenants & Security', icon: Building },
    { id: 'clients', label: 'Client Master', icon: Building2 },
    { id: 'vendors', label: 'Vendor Master', icon: Users },
    { id: 'items', label: 'Item Master', icon: Package },
    { id: 'collection', label: 'Collection Agent', icon: ClipboardList },
    { id: 'lab', label: 'Lab Queue & Verify', icon: FlaskConical },
    { id: 'calibration', label: 'Calibration & Due List', icon: Gauge },
    { id: 'commercial', label: 'Commercial & Invoices', icon: Receipt },
    { id: 'signatures', label: 'Client Signatures', icon: FileCheck2 },
    { id: 'dispatch', label: 'Dispatch & Courier', icon: Truck },
    { id: 'delivery', label: 'Delivery Confirmation', icon: PackageCheck },
    { id: 'audit', label: 'Audit Trail', icon: History },
  ];

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-100">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Brand Header */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Gauge className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-100 tracking-tight">CALIBRATION HQ</h1>
              <p className="text-[10px] text-sky-400 font-semibold tracking-wider">COMMERCIAL MODULE</p>
            </div>
          </div>

          {/* Tenant Switcher Selector */}
          <div className="p-3 bg-slate-950/60 border-b border-slate-800/80">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-2">
              Active Multi-Tenant Context
            </label>
            <select
              value={activeTenantId}
              onChange={(e) => switchTenant(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-sky-300 font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
            >
              <option value="a0000000-0000-0000-0000-000000000001">Alpha Metrology Solutions</option>
              <option value="a0000000-0000-0000-0000-000000000002">Beta Precision Calibrations</option>
            </select>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-250px)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-sky-600/15 text-sky-300 border border-sky-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-sky-950 border border-sky-800 text-sky-300 flex items-center justify-center font-bold text-xs shrink-0">
              {user?.fullName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.roles[0] || 'User'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Layers className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-md text-[11px] text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>RLS Security: Enforced</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Tenant ID: <span className="text-sky-400 font-semibold">{user?.tenantId.substring(0, 8)}...</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};
