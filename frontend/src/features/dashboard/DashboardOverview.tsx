import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  Building2,
  Network,
  GitFork,
  ScrollText,
  ShieldCheck,
  ArrowRight,
  Plus,
  Users,
  KeyRound,
  Briefcase,
  Factory,
  Package,
  ClipboardList,
  FlaskConical,
  FileCheck2,
  Truck,
} from 'lucide-react';

export interface DashboardOverviewProps {
  onNavigate: (view: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { isSuperAdmin, currentUser, demoUsers } = useAuth();
  const { tenants, activeTenant, organizations, subOrganizations } = useTenant();

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="info" size="sm">
                Step 1–15: Complete Commercial Module Pipeline Connected
              </Badge>
              <Badge variant="success" size="sm">
                PostgreSQL RLS + Cloudflare R2
              </Badge>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
              Welcome back, {currentUser?.full_name}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Current Tenant:{' '}
              <span className="font-semibold text-slate-800">{activeTenant?.name || 'Loading tenant...'}</span>{' '}
              <span className="font-mono text-slate-400">({activeTenant?.code})</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              onClick={() => onNavigate('dispatches')}
              size="sm"
              leftIcon={<Truck className="w-4 h-4 text-white" />}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Dispatches & Delivery (Step 15)
            </Button>
            <Button
              onClick={() => onNavigate('invoices')}
              size="sm"
              variant="outline"
              leftIcon={<FileCheck2 className="w-4 h-4 text-slate-600" />}
            >
              Invoices
            </Button>
            <Button
              onClick={() => onNavigate('quotations')}
              size="sm"
              variant="outline"
              leftIcon={<ScrollText className="w-4 h-4 text-slate-600" />}
            >
              Quotations
            </Button>
            <Button
              onClick={() => onNavigate('lab-verification')}
              size="sm"
              variant="outline"
              leftIcon={<FileCheck2 className="w-4 h-4 text-slate-600" />}
            >
              Verification
            </Button>
            <Button
              onClick={() => onNavigate('lab-queue')}
              size="sm"
              variant="outline"
              leftIcon={<FlaskConical className="w-4 h-4 text-slate-600" />}
            >
              Lab Queue
            </Button>
            <Button
              onClick={() => onNavigate('calibration-requests')}
              size="sm"
              variant="outline"
              leftIcon={<ClipboardList className="w-4 h-4 text-slate-600" />}
            >
              Requests
            </Button>
            <Button
              onClick={() => onNavigate('items')}
              size="sm"
              variant="outline"
              leftIcon={<Package className="w-4 h-4 text-slate-600" />}
            >
              Item Master
            </Button>
            <Button
              onClick={() => onNavigate('clients')}
              size="sm"
              variant="outline"
              leftIcon={<Briefcase className="w-4 h-4 text-slate-600" />}
            >
              Clients
            </Button>
            <Button
              onClick={() => onNavigate('vendors')}
              size="sm"
              variant="outline"
              leftIcon={<Factory className="w-4 h-4 text-slate-600" />}
            >
              Vendors
            </Button>
            {isSuperAdmin && (
              <Button
                onClick={() => onNavigate('tenants')}
                size="sm"
                variant="secondary"
                leftIcon={<Plus className="w-4 h-4 text-slate-600" />}
              >
                New Tenant
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tenants"
          value={tenants.length}
          description={isSuperAdmin ? 'Global tenants provisioned' : 'Current tenant context'}
          icon={<Building2 className="w-5 h-5" />}
          change={isSuperAdmin ? `${tenants.filter((t) => t.status === 'active').length} Active` : 'Current Tenant'}
          changeType="positive"
        />

        <StatCard
          title="Total Organizations"
          value={organizations.length}
          description="In active tenant"
          icon={<Network className="w-5 h-5" />}
          change={`${organizations.filter((o) => o.status === 'active').length} Active`}
          changeType="positive"
        />

        <StatCard
          title="Total Sub-Organizations"
          value={subOrganizations.length}
          description="Labs & Testing Units"
          icon={<GitFork className="w-5 h-5" />}
          change="Hierarchically Linked"
          changeType="neutral"
        />

        <StatCard
          title="Total Users"
          value={demoUsers.length}
          description="Provisioned Profiles"
          icon={<Users className="w-5 h-5" />}
          change="Role-Based (RBAC)"
          changeType="positive"
        />
      </div>

      {/* Hierarchy & Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenant Hierarchy Structure Card */}
        <Card
          title="Tenant Hierarchy Structure"
          description="Strict parent-child relationships enforced at database level"
          className="lg:col-span-2"
        >
          <div className="space-y-4 pt-1">
            {/* Tenant Root Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-2xs">
                    T
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{activeTenant?.name}</h4>
                    <p className="text-xs text-slate-500 font-mono">Tenant Code: {activeTenant?.code}</p>
                  </div>
                </div>
                <Badge variant="success">Tenant Root</Badge>
              </div>

              {/* Organizations Level */}
              <div className="mt-4 pl-5 border-l-2 border-slate-200 space-y-3">
                {organizations.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No organizations created yet in this tenant.</p>
                ) : (
                  organizations.map((org) => {
                    const subCount = subOrganizations.filter((s) => s.organization_id === org.id).length;
                    return (
                      <div
                        key={org.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Network className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-slate-800">{org.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">[{org.code}]</span>
                          </div>
                          <span className="text-[11px] rounded bg-slate-100 px-2 py-0.5 text-slate-600 font-medium">
                            {subCount} Facilities
                          </span>
                        </div>

                        {/* Sub-Organizations Level */}
                        <div className="mt-2.5 pl-4 border-l border-slate-100 space-y-1.5">
                          {subOrganizations
                            .filter((s) => s.organization_id === org.id)
                            .map((sub) => (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between text-xs py-1 text-slate-600"
                              >
                                <div className="flex items-center gap-2">
                                  <GitFork className="w-3.5 h-3.5 text-blue-500" />
                                  <span className="text-slate-700">{sub.name}</span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    [{sub.code}]
                                  </span>
                                </div>
                                <Badge size="sm" variant={sub.status === 'active' ? 'success' : 'warning'}>
                                  {sub.status}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Module Navigation & Settings */}
        <div className="space-y-4">
          <Card title="Quick Navigation" description="Jump directly to entity management">
            <div className="space-y-2 pt-1">
              <button
                onClick={() => onNavigate('clients')}
                className="flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs font-medium text-blue-900 hover:border-blue-300 hover:bg-blue-100/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-blue-900">Client Master</span>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-500" />
              </button>

              <button
                onClick={() => onNavigate('vendors')}
                className="flex w-full items-center justify-between rounded-lg border border-purple-200 bg-purple-50/50 p-3 text-xs font-medium text-purple-900 hover:border-purple-300 hover:bg-purple-100/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Factory className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-purple-900">Vendor Master</span>
                </div>
                <ArrowRight className="w-4 h-4 text-purple-500" />
              </button>

              <button
                onClick={() => onNavigate('items')}
                className="flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs font-medium text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-emerald-900">Item Master</span>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-500" />
              </button>

              <button
                onClick={() => onNavigate('tenants')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">Tenants Directory</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate('organizations')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Network className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">Organizations</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate('sub-organizations')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <GitFork className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">Sub-Organizations (Labs)</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate('users')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">User Management</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate('roles')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">Roles & Permissions</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate('audit-logs')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <ScrollText className="w-4 h-4 text-slate-600" />
                  <span className="font-semibold text-slate-800">Audit Trail</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </Card>

          {/* Clean Security Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Security & Isolation</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every database operation is filtered by <code className="text-blue-700 font-mono text-[11px] bg-blue-50 px-1 py-0.5 rounded">current_tenant_id()</code>.
              Tenant A is cryptographically isolated from Tenant B.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
