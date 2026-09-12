import React, { useState } from 'react';
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
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { user, logout, activeTenantId, switchTenant } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navGroups = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'MASTER DATA',
      items: [
        { id: 'clients', label: 'Client Master', icon: Building2 },
        { id: 'vendors', label: 'Vendor Master', icon: Users },
        { id: 'items', label: 'Item Master', icon: Package },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { id: 'collection', label: 'Collection Agent', icon: ClipboardList },
        { id: 'lab', label: 'Lab Queue & Verification', icon: FlaskConical },
        { id: 'calibration', label: 'Calibration & Due List', icon: Gauge },
      ],
    },
    {
      title: 'COMMERCIAL',
      items: [
        { id: 'commercial', label: 'Commercial & Invoices', icon: Receipt },
        { id: 'signatures', label: 'Client Signatures', icon: FileCheck2 },
        { id: 'dispatch', label: 'Dispatch & Courier', icon: Truck },
        { id: 'delivery', label: 'Delivery Confirmation', icon: PackageCheck },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'tenants', label: 'Tenants & Security', icon: Building },
        { id: 'audit', label: 'Audit Trail', icon: History },
      ],
    },
  ];

  // Helper to find current page label for breadcrumb
  let activePageLabel = 'Executive Dashboard';
  navGroups.forEach((g) => {
    const found = g.items.find((i) => i.id === activeTab);
    if (found) activePageLabel = found.label;
  });

  const tenantName =
    activeTenantId === 'a0000000-0000-0000-0000-000000000001'
      ? 'Alpha Metrology Solutions'
      : 'Beta Precision Calibrations';

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-100 font-sans">
      {/* LEFT SIDEBAR (Desktop & Tablet) */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div>
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-xs text-slate-100 tracking-wider">CALIBRATION HQ</h1>
                <p className="text-[10px] text-sky-400 font-semibold tracking-widest uppercase">COMMERCIAL MODULE</p>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Tenant Selector */}
          <div className="p-3 bg-slate-950/80 border-b border-slate-800">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 px-1">
              Active Tenant
            </label>
            <div className="relative">
              <select
                value={activeTenantId}
                onChange={(e) => switchTenant(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 text-xs text-sky-300 font-medium rounded-lg px-2.5 py-1.5 appearance-none focus:outline-none focus:border-sky-500 cursor-pointer pr-7"
              >
                <option value="a0000000-0000-0000-0000-000000000001">Alpha Metrology Solutions</option>
                <option value="a0000000-0000-0000-0000-000000000002">Beta Precision Calibrations</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Grouped Navigation Links */}
          <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-2 text-[10px] font-bold text-slate-400 tracking-wider uppercase">{group.title}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-sky-600/15 text-sky-300 border border-sky-500/30 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3 h-3 text-sky-400" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-sky-950 border border-sky-800 text-sky-300 flex items-center justify-center font-bold text-xs shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.fullName || 'User'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.roles?.[0] || 'Admin'}</p>
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

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* COMPACT TOP HEADER */}
        <header className="h-14 bg-slate-900/90 border-b border-slate-800 px-4 lg:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb & Page Title */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>Enterprise HQ</span>
                <ChevronRight className="w-3 h-3 text-slate-500" />
                <span className="text-slate-200 font-medium">{activePageLabel}</span>
              </div>
              <h2 className="text-sm font-bold text-slate-100 tracking-tight leading-none mt-0.5">
                {activePageLabel}
              </h2>
            </div>
          </div>

          {/* Search, Tenant Badge, Profile */}
          <div className="flex items-center gap-3">
            {/* Global Search */}
            <div className="relative hidden md:block w-48 lg:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Global search requests..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Notification Bell */}
            <button className="relative p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition">
              <Bell className="w-4 h-4" />
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 absolute top-1.5 right-1.5"></span>
            </button>

            {/* Active Tenant Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400 text-[11px]">Tenant:</span>
              <span className="font-semibold text-slate-200 text-[11px]">{tenantName}</span>
            </div>
          </div>
        </header>

        {/* PAGE BODY */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};
