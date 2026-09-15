import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { DashboardSummary, WorkflowFunnelItem } from '../../types';
import {
  Network,
  GitFork,
  ScrollText,
  ShieldCheck,
  ArrowRight,
  ClipboardList,
  FlaskConical,
  FileCheck2,
  Truck,
  AlertTriangle,
  BarChart3,
  CalendarCheck,
} from 'lucide-react';

export interface DashboardOverviewProps {
  onNavigate: (view: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { activeTenant, organizations, subOrganizations } = useTenant();
  const tenantId = activeTenant?.id || 'all';

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [funnel, setFunnel] = useState<WorkflowFunnelItem[]>([]);
  const [_loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [sumData, funData] = await Promise.all([
        api.getDashboardSummary(tenantId),
        api.getWorkflowFunnel(tenantId),
      ]);
      setSummary(sumData);
      setFunnel(funData);
    } catch (err) {
      console.error('Failed loading dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [tenantId]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="info" size="sm">
                Complete Module & Operations Hub Connected
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
              onClick={() => onNavigate('operations-exceptions')}
              size="sm"
              leftIcon={<AlertTriangle className="w-4 h-4 text-white" />}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Action Center
            </Button>
            <Button
              onClick={() => onNavigate('reports')}
              size="sm"
              variant="outline"
              leftIcon={<BarChart3 className="w-4 h-4 text-slate-600" />}
            >
              Reports
            </Button>
            <Button
              onClick={() => onNavigate('calibration-due')}
              size="sm"
              variant="outline"
              leftIcon={<CalendarCheck className="w-4 h-4 text-slate-600" />}
            >
              Due List
            </Button>
            <Button
              onClick={() => onNavigate('dispatches')}
              size="sm"
              variant="outline"
              leftIcon={<Truck className="w-4 h-4 text-slate-600" />}
            >
              Dispatches
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
          </div>
        </div>
      </div>

      {/* Real KPI Metrics Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Requests"
          value={summary?.totalRequests || 0}
          description="Registered calibration requests"
          icon={<ClipboardList className="w-5 h-5 text-blue-600" />}
          change={`${summary?.completedRequests || 0} Fully Completed`}
          changeType="positive"
        />

        <StatCard
          title="Lab Queue & Prep"
          value={(summary?.labQueue || 0) + (summary?.pendingVerification || 0)}
          description="Intake & inspection queue"
          icon={<FlaskConical className="w-5 h-5 text-amber-600" />}
          change={`${summary?.calibrationInProgress || 0} In Calibration`}
          changeType="neutral"
        />

        <StatCard
          title="Carrier In Transit"
          value={summary?.inTransit || 0}
          description="Active shipments & deliveries"
          icon={<Truck className="w-5 h-5 text-purple-600" />}
          change={`${summary?.readyForDispatch || 0} Ready for Dispatch`}
          changeType="positive"
        />

        <StatCard
          title="Action Exceptions"
          value={(summary?.faultyItems || 0) + (summary?.awaitingClientSignature || 0)}
          description="Faulty items & pending signatures"
          icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
          change="Requires Attention"
          changeType="negative"
        />
      </div>

      {/* Workflow Funnel Bar & Hierarchy Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Workflow Funnel & Quick Metrics */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Workflow Funnel (Live Database Counts)" description="Click any stage to filter workflow records">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 pt-2">
              {funnel.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onNavigate('calibration-requests')}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-300 transition-all text-center group"
                >
                  <span className="text-lg font-extrabold text-slate-900 group-hover:text-blue-700">{item.count}</span>
                  <span className="text-[11px] font-semibold text-slate-600 mt-0.5 truncate w-full">{item.stage}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Tenant Hierarchy Structure Card */}
          <Card
            title="Tenant Hierarchy Structure"
            description="Strict parent-child relationships enforced at database level"
          >
            <div className="space-y-4 pt-1">
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

                <div className="mt-4 pl-5 border-l-2 border-slate-200 space-y-3">
                  {organizations.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">No organizations created yet in this tenant.</p>
                  ) : (
                    organizations.map((org) => {
                      const subCount = subOrganizations.filter((s) => s.organization_id === org.id).length;
                      return (
                        <div key={org.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
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

                          <div className="mt-2.5 pl-4 border-l border-slate-100 space-y-1.5">
                            {subOrganizations
                              .filter((s) => s.organization_id === org.id)
                              .map((sub) => (
                                <div key={sub.id} className="flex items-center justify-between text-xs py-1 text-slate-600">
                                  <div className="flex items-center gap-2">
                                    <GitFork className="w-3.5 h-3.5 text-blue-500" />
                                    <span className="text-slate-700">{sub.name}</span>
                                    <span className="text-[10px] font-mono text-slate-400">[{sub.code}]</span>
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
        </div>

        {/* Right 1 Col: Quick Module Navigation */}
        <div className="space-y-4">
          <Card title="Operations Hub" description="Quick access to all module components">
            <div className="space-y-2 pt-1">
              <button
                onClick={() => onNavigate('operations-exceptions')}
                className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs font-medium text-amber-900 hover:border-amber-300 hover:bg-amber-100/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-amber-900">Exception & Action Center</span>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-500" />
              </button>

              <button
                onClick={() => onNavigate('calibration-due')}
                className="flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs font-medium text-blue-900 hover:border-blue-300 hover:bg-blue-100/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <CalendarCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-blue-900">Due Calibration Dashboard</span>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-500" />
              </button>

              <button
                onClick={() => onNavigate('reports')}
                className="flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs font-medium text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-emerald-900">Executive Reports</span>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-500" />
              </button>

              <button
                onClick={() => onNavigate('audit-logs')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <ScrollText className="w-4 h-4 text-slate-600" />
                  <span className="font-semibold text-slate-800">Audit Trail Viewer</span>
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
