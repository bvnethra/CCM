import React, { useEffect, useState } from 'react';
import { StatCard } from '../components/Common/StatCard';
import { StatusBadge } from '../components/Common/StatusBadge';
import { EmptyState } from '../components/Common/EmptyState';
import {
  ClipboardList,
  FlaskConical,
  Gauge,
  AlertTriangle,
  Receipt,
  Truck,
  CheckCircle2,
  Search,
  Plus,
  ArrowRight,
  Filter,
  Wrench,
  ExternalLink,
  Layers,
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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

  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
      (req.clientName && req.clientName.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 3. CLEAN COMPACT DASHBOARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor requests, laboratory processing, calibration, commercial activities and delivery status.
          </p>
        </div>
        <button
          onClick={() => onNavigate('collection')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" /> New Collection Request
        </button>
      </div>

      {/* 4. COMPACT KPI CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <StatCard
          title="Workload"
          value={totalCount}
          subtitle="Total Requests"
          icon={ClipboardList}
          color="sky"
          onClick={() => onNavigate('collection')}
        />
        <StatCard
          title="Lab Queue"
          value={labCount}
          subtitle="Items Awaiting Verification"
          icon={FlaskConical}
          color="indigo"
          onClick={() => onNavigate('lab')}
        />
        <StatCard
          title="Calibration"
          value={calCount}
          subtitle="Technician Queue"
          icon={Gauge}
          color="purple"
          onClick={() => onNavigate('calibration')}
        />
        <StatCard
          title="Overdue"
          value={dueList.overdueCount || 0}
          subtitle="Require Attention"
          icon={AlertTriangle}
          color="rose"
          onClick={() => onNavigate('calibration')}
        />
        <StatCard
          title="Commercial"
          value={commCount}
          subtitle="Quotation / Invoice"
          icon={Receipt}
          color="amber"
          onClick={() => onNavigate('commercial')}
        />
        <StatCard
          title="Dispatches"
          value={dispatchCount}
          subtitle="Active Shipments"
          icon={Truck}
          color="indigo"
          onClick={() => onNavigate('dispatch')}
        />
        <StatCard
          title="Completed"
          value={completedCount}
          subtitle="Closed Lifecycle"
          icon={CheckCircle2}
          color="emerald"
          onClick={() => onNavigate('delivery')}
        />
      </div>

      {/* 5. MAIN CONTENT TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Recent Calibration Requests */}
        <div className="lg:col-span-2 enterprise-card p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-100">Recent Calibration Requests</h3>
              <p className="text-[11px] text-slate-400">Track active work orders across lab and commercial stages</p>
            </div>

            {/* Filter and Search Controls */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter requests..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg pl-7 pr-3 py-1 focus:outline-none focus:border-sky-500 w-36"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="COLLECTED">Collected</option>
                <option value="LAB_QUEUE">Lab Queue</option>
                <option value="CALIBRATION">Calibration</option>
                <option value="INVOICE_PO">Commercial</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <EmptyState
              title="No Calibration Requests"
              description="There are currently no calibration requests matching your filter criteria for this tenant."
              actionLabel="Create Request"
              onAction={() => onNavigate('collection')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="enterprise-table-header">
                    <th className="p-3">Request No.</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Items</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Availability</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredRequests.slice(0, 7).map((req) => {
                    const hasUnavailable = req.items?.some((i) => i.isAvailable === false);
                    return (
                      <tr key={req.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-mono font-bold text-sky-400">{req.requestNumber}</td>
                        <td className="p-3 font-medium text-slate-200">{req.clientName}</td>
                        <td className="p-3 text-slate-400">{req.items?.length || 0}</td>
                        <td className="p-3 text-slate-400">{req.collectionDate}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.priority === 'HIGH'
                                ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {req.priority}
                          </span>
                        </td>
                        <td className="p-3">
                          <StatusBadge
                            status={hasUnavailable ? 'UNAVAILABLE' : 'AVAILABLE'}
                            type="availability"
                            size="sm"
                          />
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Actionable Exception Summary */}
        <div className="enterprise-card p-4 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-100">Workflow Exceptions</h3>
            <p className="text-[11px] text-slate-400">Actionable items requiring operator attention</p>
          </div>

          <div className="space-y-3">
            {/* Faulty Equipment */}
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-rose-900/40 text-rose-400">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-200">Faulty Equipment</p>
                  <p className="text-[11px] text-rose-400/80">Client service approval required</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('calibration')}
                className="px-2.5 py-1 text-xs bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded font-semibold transition"
              >
                1 View
              </button>
            </div>

            {/* Vendor Outsourced */}
            <div className="p-3 rounded-lg bg-orange-950/30 border border-orange-800/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-orange-900/40 text-orange-400">
                  <ExternalLink className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-orange-200">Vendor Outsourced</p>
                  <p className="text-[11px] text-orange-400/80">External lab calibration POs</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('calibration')}
                className="px-2.5 py-1 text-xs bg-orange-900/60 hover:bg-orange-800 text-orange-200 rounded font-semibold transition"
              >
                1 View
              </button>
            </div>

            {/* Partial Processing */}
            <div className="p-3 rounded-lg bg-sky-950/30 border border-sky-800/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-sky-900/40 text-sky-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-sky-200">Partial Processing</p>
                  <p className="text-[11px] text-sky-400/80">Independent item dispatch</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('commercial')}
                className="px-2.5 py-1 text-xs bg-sky-900/60 hover:bg-sky-800 text-sky-200 rounded font-semibold transition"
              >
                Active
              </button>
            </div>

            {/* Overdue Calibration */}
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-amber-900/40 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-200">Overdue Calibration</p>
                  <p className="text-[11px] text-amber-400/80">Instruments exceeding frequency</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('calibration')}
                className="px-2.5 py-1 text-xs bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded font-semibold transition"
              >
                {dueList.overdueCount || 0} View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
