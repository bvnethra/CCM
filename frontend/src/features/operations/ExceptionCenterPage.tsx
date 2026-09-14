import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  FileCheck2,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { OperationException } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export interface ExceptionCenterPageProps {
  onNavigate: (route: string) => void;
}

export const ExceptionCenterPage: React.FC<ExceptionCenterPageProps> = ({ onNavigate }) => {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id || 'all';

  const [exceptions, setExceptions] = useState<OperationException[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const data = await api.getOperationExceptions(tenantId);
      setExceptions(data);
    } catch (err) {
      console.error('Failed loading exceptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExceptions();
  }, [tenantId]);

  const filtered = exceptions.filter((exc) => {
    if (typeFilter !== 'all' && exc.exception_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        exc.request_number.toLowerCase().includes(q) ||
        exc.client_name.toLowerCase().includes(q) ||
        exc.item_name.toLowerCase().includes(q) ||
        exc.exception_type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
            Operations Exception & Action Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time monitoring of faulty calibrations, pending service approvals, outsourcing bottlenecks, and unsigned invoices.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadExceptions}
          className="border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Exceptions
        </Button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by request #, client name, item..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="all">All Exception Types</option>
            <option value="Faulty Calibration">Faulty Calibration</option>
            <option value="Outsourcing Pending PO">Outsourcing Pending PO</option>
            <option value="Invoice Pending Signature">Invoice Pending Signature</option>
          </select>
        </div>
      </div>

      {/* Exceptions Grid / Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2.5 text-slate-500 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> Loading exceptions...
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-xl text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Actionable Exceptions Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            All workflows are progressing smoothly. No faulty calibrations or bottleneck approvals require attention.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Exception Details</th>
                  <th className="px-4 py-3">Request & Client</th>
                  <th className="px-4 py-3">Item Info</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((exc) => (
                  <tr key={exc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-none" />
                        <div>
                          <p className="font-bold text-slate-900">{exc.exception_type}</p>
                          <p className="text-[10px] text-slate-400">Log Date: {new Date(exc.created_date).toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{exc.request_number}</div>
                      <div className="text-[11px] text-slate-500">{exc.client_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{exc.item_name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{exc.item_code} • SN: {exc.serial_number}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="warning" size="sm">
                        {exc.current_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigate(exc.target_route.replace('/', ''))}
                        className="border-slate-300 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
                      >
                        <span>{exc.action_label}</span>
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
