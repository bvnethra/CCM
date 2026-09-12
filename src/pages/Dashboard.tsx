import React, { useEffect, useState } from 'react';
import { StatCard } from '../components/Common/StatCard';
import { StatusBadge } from '../components/Common/StatusBadge';
import {
  ClipboardList,
  FlaskConical,
  Gauge,
  AlertTriangle,
  Receipt,
  Truck,
  CheckCircle2,
  TrendingUp,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { fetchApi } from '../api/client';
import { CalibrationRequest } from '../types';

interface DashboardProps {
  onNavigate: (tab: string, requestId?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [dueList, setDueList] = useState<any>({ overdueCount: 0, dueSoonCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    const reqRes = await fetchApi('/api/requests');
    if (reqRes.success) setRequests(reqRes.data || []);

    const dueRes = await fetchApi('/api/due-list');
    if (dueRes.success && dueRes.data) {
      setDueList(dueRes.data.summary || {});
    }
    setLoading(false);
  };

  const totalCount = requests.length;
  const labCount = requests.filter((r) => ['COLLECTED', 'LAB_QUEUE', 'VERIFICATION'].includes(r.status)).length;
  const calCount = requests.filter((r) => r.status === 'CALIBRATION').length;
  const commCount = requests.filter((r) => ['QUOTATION', 'INVOICE_PO'].includes(r.status)).length;
  const dispatchCount = requests.filter((r) => ['READY_TO_DISPATCH', 'DISPATCHED'].includes(r.status)).length;
  const completedCount = requests.filter((r) => r.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 rounded-2xl border border-sky-800/40">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Executive Calibration & Commercial Command Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-tenant lifecycle tracking across collection, laboratory verification, calibration, and invoicing.
          </p>
        </div>
        <button
          onClick={() => onNavigate('collection')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-sky-500/20 transition"
        >
          <ClipboardList className="w-4 h-4" /> New Collection Request
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Calibration Workload"
          value={totalCount}
          subtitle="Requests in current tenant"
          icon={ClipboardList}
          color="sky"
          onClick={() => onNavigate('collection')}
        />
        <StatCard
          title="Lab Queue Pending"
          value={labCount}
          subtitle="Items awaiting verification"
          icon={FlaskConical}
          color="indigo"
          onClick={() => onNavigate('lab')}
        />
        <StatCard
          title="Calibration Pending"
          value={calCount}
          subtitle="Technician queue"
          icon={Gauge}
          color="purple"
          onClick={() => onNavigate('calibration')}
        />
        <StatCard
          title="Overdue Calibration Items"
          value={dueList.overdueCount || 0}
          subtitle={`${dueList.dueSoonCount || 0} due in 30 days`}
          icon={AlertTriangle}
          color="rose"
          onClick={() => onNavigate('calibration')}
        />
        <StatCard
          title="Commercial Invoices Pending"
          value={commCount}
          subtitle="Quotations & PO processing"
          icon={Receipt}
          color="amber"
          onClick={() => onNavigate('commercial')}
        />
        <StatCard
          title="Dispatches & Tracking"
          value={dispatchCount}
          subtitle="Active shipments"
          icon={Truck}
          color="indigo"
          onClick={() => onNavigate('dispatch')}
        />
        <StatCard
          title="Completed Lifecycle"
          value={completedCount}
          subtitle="Delivery signed & closed"
          icon={CheckCircle2}
          color="emerald"
          onClick={() => onNavigate('delivery')}
        />
        <StatCard
          title="Tenant RLS Policy"
          value="ENFORCED"
          subtitle="PostgreSQL DB row level isolation"
          icon={TrendingUp}
          color="emerald"
          onClick={() => onNavigate('tenants')}
        />
      </div>

      {/* Workflow Summary & Active Calibration Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Calibration Requests Table */}
        <div className="lg:col-span-2 glass-card p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" /> Recent Calibration Requests
            </h3>
            <button
              onClick={() => onNavigate('collection')}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="p-3">Request No</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {requests.slice(0, 5).map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-sky-400">{req.requestNumber}</td>
                    <td className="p-3 font-medium">{req.clientName}</td>
                    <td className="p-3 text-slate-400">{req.collectionDate}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.priority === 'HIGH' ? 'bg-rose-950 text-rose-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={req.status} size="sm" />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onNavigate('collection', req.id)}
                        className="text-sky-400 hover:underline font-medium text-[11px]"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Multi-Tenant Security & Exception Summary */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="font-semibold text-slate-100 text-sm">Exception Workflow Tracker</h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/40 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-300">Faulty Equipment Repairs</p>
                <p className="text-[11px] text-rose-400/80">Requires client service approval</p>
              </div>
              <span className="px-2 py-1 bg-rose-900/80 text-rose-200 rounded font-bold text-xs">1 Active</span>
            </div>

            <div className="p-3 rounded-lg bg-orange-950/40 border border-orange-800/40 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-orange-300">Vendor Outsourced POs</p>
                <p className="text-[11px] text-orange-400/80">External lab calibration</p>
              </div>
              <span className="px-2 py-1 bg-orange-900/80 text-orange-200 rounded font-bold text-xs">1 Active</span>
            </div>

            <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-800/40 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-sky-300">Partial Processing Invoices</p>
                <p className="text-[11px] text-sky-400/80">Independent item dispatch</p>
              </div>
              <span className="px-2 py-1 bg-sky-900/80 text-sky-200 rounded font-bold text-xs">Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
