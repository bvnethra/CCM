import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  X,
  Lock,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { AuditLogRow } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const AuditLogsPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id || 'all';

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogsList(tenantId);
      setLogs(data);
    } catch (err) {
      console.error('Failed loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [tenantId]);

  const filtered = logs.filter((log) => {
    if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.user_name.toLowerCase().includes(q) ||
        log.module.toLowerCase().includes(q) ||
        (log.resource_id && log.resource_id.toLowerCase().includes(q))
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
            <Lock className="w-6 h-6 text-slate-700" />
            Audit Trail & Security Log Viewer
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete immutable multi-tenant audit trail documenting user actions, resource creations, status updates, and commercial changes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadLogs}
          className="border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Audit Trail
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, user, entity ID..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="all">All Modules</option>
            <option value="calibration_requests">Calibration Requests</option>
            <option value="item_verifications">Verifications</option>
            <option value="calibration_results">Calibrations</option>
            <option value="quotations">Quotations</option>
            <option value="invoices">Invoices</option>
            <option value="dispatches">Dispatches</option>
            <option value="deliveries">Deliveries</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2.5 text-slate-500 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> Loading audit trail...
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Entity ID</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{log.user_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="info" size="sm">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-[11px]">{log.module}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{log.resource_id || 'N/A'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Payload
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payload Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Audit Payload: {selectedLog.action}</h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-semibold text-slate-700">New Values:</p>
                <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[11px] text-slate-800 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.new_values || {}, null, 2)}
                </pre>
              </div>
              {selectedLog.old_values && (
                <div>
                  <p className="font-semibold text-slate-700">Previous Values:</p>
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[11px] text-slate-800 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.old_values || {}, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="text-right pt-2">
              <Button size="sm" variant="secondary" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
