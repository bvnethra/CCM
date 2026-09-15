import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Clock,
  Layers,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { apiClient } from '../../lib/api';
import { VerificationQueueItem } from '../../types';

interface VerificationQueuePageProps {
  onSelectRequest: (requestId: string) => void;
}

export const VerificationQueuePage: React.FC<VerificationQueuePageProps> = ({ onSelectRequest }) => {
  const { isSuperAdmin } = useAuth();
  const { activeTenant } = useTenant();
  const [queueItems, setQueueItems] = useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadQueue = async () => {
    if (!activeTenant) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await apiClient.getVerificationQueue(
        isSuperAdmin ? 'all' : activeTenant.id,
        {
          search: search.trim() || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        }
      );
      setQueueItems(data);
    } catch (err) {
      console.error('Failed to load verification queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [activeTenant, isSuperAdmin, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadQueue();
  };

  // Metrics computation
  const stats = useMemo(() => {
    const totalRequests = queueItems.length;
    const inVerification = queueItems.filter((i) => i.status === 'VERIFICATION').length;
    const totalVerifiedItems = queueItems.reduce((acc, i) => acc + i.verified_items, 0);
    const totalItems = queueItems.reduce((acc, i) => acc + i.total_items, 0);
    const discrepantItems = queueItems.reduce((acc, i) => acc + i.discrepant_items, 0);
    const readyForSignOff = queueItems.filter((i) => i.can_complete).length;

    return {
      totalRequests,
      inVerification,
      totalVerifiedItems,
      totalItems,
      discrepantItems,
      readyForSignOff,
    };
  }, [queueItems]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Item Verification & Proof Documents
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Perform item-level verification, physical condition inspections, and validate mandatory proof documents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadQueue}
            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-xs"
            title="Refresh Verification Queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 5 High-Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: In Verification */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">In Verification</p>
            <p className="text-lg font-bold text-slate-900">{stats.inVerification}</p>
          </div>
        </div>

        {/* Card 2: Items Progress */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Items Inspected</p>
            <p className="text-lg font-bold text-slate-900">
              {stats.totalVerifiedItems}{' '}
              <span className="text-xs font-normal text-slate-400">/ {stats.totalItems}</span>
            </p>
          </div>
        </div>

        {/* Card 3: Discrepancies */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Discrepant / Short</p>
            <p className="text-lg font-bold text-rose-600">{stats.discrepantItems}</p>
          </div>
        </div>

        {/* Card 4: Ready for Sign-Off */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Ready for Sign-Off</p>
            <p className="text-lg font-bold text-emerald-600">{stats.readyForSignOff}</p>
          </div>
        </div>

        {/* Card 5: Total Requests Tracked */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg border border-slate-200">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Tracked</p>
            <p className="text-lg font-bold text-slate-900">{stats.totalRequests}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search request #, client name, or division..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shrink-0"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Status Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
          >
            <option value="ALL">All Verification Requests</option>
            <option value="VERIFICATION">In Verification</option>
            <option value="LAB_QUEUE">Lab Queue</option>
            <option value="VERIFIED">Verified & Signed Off</option>
          </select>
        </div>
      </div>

      {/* Queue Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium">Fetching verification records...</p>
          </div>
        ) : queueItems.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">No verification requests found</p>
            <p className="text-xs text-slate-400 mt-1">
              Requests moved from Lab Queue to Verification will appear in this workspace.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3">Request Details</th>
                  <th className="px-4 py-3">Client & Division</th>
                  <th className="px-4 py-3">Collection Date</th>
                  <th className="px-4 py-3">Item Verification Progress</th>
                  <th className="px-4 py-3">Discrepancy Status</th>
                  <th className="px-4 py-3">Proof Documents</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {queueItems.map((item) => {
                  const percent =
                    item.total_items > 0 ? Math.round((item.verified_items / item.total_items) * 100) : 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Request Details */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.request_number}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              item.priority === 'URGENT'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {item.priority}
                          </span>
                        </div>
                      </td>

                      {/* Client & Org */}
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="font-bold text-slate-800">{item.client_name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.organization_name}</p>
                        </div>
                      </td>

                      {/* Collection Date */}
                      <td className="px-4 py-3.5 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.collection_date || 'N/A'}</span>
                        </div>
                      </td>

                      {/* Items Verification Progress */}
                      <td className="px-4 py-3.5">
                        <div className="w-36">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-slate-700">
                              {item.verified_items} / {item.total_items}
                            </span>
                            <span className="text-slate-400">{percent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className={`h-full rounded-full transition-all ${
                                percent === 100
                                  ? 'bg-emerald-500'
                                  : percent > 0
                                  ? 'bg-indigo-600'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Discrepancy Status */}
                      <td className="px-4 py-3.5">
                        {item.discrepant_items > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                            <span>{item.discrepant_items} Discrepancy</span>
                          </span>
                        ) : item.verified_items > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>No Issues</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Unchecked</span>
                        )}
                      </td>

                      {/* Proof Documents */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{item.total_documents_count} Files</span>
                          {item.mandatory_documents_count > 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Mandatory On File
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Missing Mandatory
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            item.status === 'VERIFIED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.status === 'VERIFICATION'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => onSelectRequest(item.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ml-auto shadow-xs ${
                            item.can_complete
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          <span>{item.status === 'VERIFIED' ? 'View Details' : 'Verify Items'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
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
    </div>
  );
};
