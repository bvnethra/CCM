import React, { useEffect, useState } from 'react';
import { History, Shield, Search } from 'lucide-react';
import { fetchApi } from '../api/client';
import { AuditLog } from '../types';

export const AuditTrailPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    const res = await fetchApi('/api/audit-logs');
    if (res.success) setLogs(res.data || []);
  };

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.entityType.toLowerCase().includes(search.toLowerCase()) ||
      (l.requestReference && l.requestReference.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-sky-400" /> Immutable System Audit Trail
          </h2>
          <p className="text-xs text-slate-400">
            Recorded audit entries for status transitions, quotation approvals, cost overrides, signatures, and document operations.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Filter audit logs by action, entity, or request reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5">Timestamp</th>
              <th className="p-3.5">User</th>
              <th className="p-3.5">Action Event</th>
              <th className="p-3.5">Entity Type</th>
              <th className="p-3.5">Request Reference</th>
              <th className="p-3.5">Tenant Security Scope</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3.5 text-slate-400 text-[11px]">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="p-3.5 font-medium">{log.userEmail || 'System'}</td>
                <td className="p-3.5 font-mono font-bold text-sky-400">{log.action}</td>
                <td className="p-3.5 text-slate-300 font-medium">{log.entityType}</td>
                <td className="p-3.5 font-mono text-amber-400">{log.requestReference || 'N/A'}</td>
                <td className="p-3.5 font-mono text-[10px] text-slate-500">{log.tenantId.substring(0, 8)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
