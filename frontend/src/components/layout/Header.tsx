import React, { useState } from 'react';
import {
  Menu,
  Building,
  LogOut,
  ChevronDown,
  Lock,
  Search,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Badge } from '../ui/Badge';
import { api } from '../../lib/api';
import { GlobalSearchResult } from '../../types';

export interface HeaderProps {
  onMenuToggle: () => void;
  onNavigateToLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, onNavigateToLogin }) => {
  const { currentUser, isSuperAdmin, logout, demoUsers, loginAsDemoUser } = useAuth();
  const { tenants, activeTenant, setActiveTenantId } = useTenant();

  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      {/* Left: Mobile Toggle & Tenant Context */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Tenant Switcher / Context */}
        <div className="relative">
          {isSuperAdmin ? (
            <div>
              <button
                onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs"
              >
                <Building className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-[200px]">
                  {activeTenant ? activeTenant.name : 'Select Tenant'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Tenant Dropdown */}
              {isTenantMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsTenantMenuOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-30">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                      Tenant Context (Super Admin)
                    </div>
                    {tenants.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setActiveTenantId(t.id);
                          setIsTenantMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                          activeTenant?.id === t.id
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{t.code}</span>
                        </div>
                        <Badge
                          size="sm"
                          variant={t.status === 'active' ? 'success' : 'warning'}
                        >
                          {t.status}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            // Locked Tenant Badge for Tenant Admin
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                {activeTenant ? activeTenant.name : 'Tenant Scoped'}
              </span>
              <span className="text-[10px] font-mono rounded bg-white px-1.5 py-0.5 text-blue-700 border border-slate-200 font-medium">
                {activeTenant?.code}
              </span>
            </div>
          )}
        </div>

        {/* Global Search Bar */}
        <div className="hidden lg:flex items-center relative w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={async (e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim().length > 0) {
                const res = await api.globalSearch(val, activeTenant?.id || 'all');
                setSearchResults(res);
                setIsSearchOpen(true);
              } else {
                setSearchResults([]);
                setIsSearchOpen(false);
              }
            }}
            onFocus={() => searchQuery.trim().length > 0 && setIsSearchOpen(true)}
            placeholder="Search request #, client, serial #, invoice #, tracking..."
            className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setIsSearchOpen(false);
              }}
              className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ×
            </button>
          )}

          {/* Search Dropdown Results */}
          {isSearchOpen && searchResults.length > 0 && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setIsSearchOpen(false)} />
              <div className="absolute top-full left-0 mt-2 w-96 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl z-30 max-h-80 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Search Results ({searchResults.length})
                </div>
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                      window.location.hash = res.route;
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-slate-900">{res.reference}</span>
                      <span className="text-[11px] text-slate-500">{res.client} • <span className="font-mono text-blue-600">{res.type}</span></span>
                    </div>
                    <Badge size="sm" variant="info">
                      {res.status}
                    </Badge>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Persona Switcher, Notifications & User Profile */}
      <div className="flex items-center gap-3">
        {/* Quick Demo Role Persona Selector */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium px-1.5">Persona:</span>
          {demoUsers.map((u) => {
            const isCurrent = currentUser?.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => loginAsDemoUser(u.id)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                  isCurrent
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title={`Switch to ${u.full_name} (${u.role})`}
              >
                {u.role === 'super_admin' ? 'Super Admin' : u.email.includes('acme') ? 'Acme Admin' : 'Apex Admin'}
              </button>
            );
          })}
        </div>

        {/* Notification Bell */}
        <button
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-1.5 pr-2.5 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white font-semibold text-xs shadow-2xs">
              {currentUser ? currentUser.full_name.charAt(0) : 'U'}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-900">
                {currentUser?.full_name || 'Guest User'}
              </span>
              <span className="text-[10px] capitalize text-slate-500 font-medium">
                {currentUser?.role.replace('_', ' ') || 'viewer'}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* User Menu Dropdown */}
          {isUserMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setIsUserMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-30">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-900">{currentUser?.full_name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{currentUser?.email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Badge size="sm" variant={isSuperAdmin ? 'purple' : 'info'}>
                      {currentUser?.role.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                <div className="py-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400">
                    Switch Test Persona
                  </div>
                  {demoUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        loginAsDemoUser(u.id);
                        setIsUserMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <span className="truncate font-medium">{u.full_name}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">{u.role === 'super_admin' ? 'Root' : 'Tenant'}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-1 mt-1">
                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                      onNavigateToLogin();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
