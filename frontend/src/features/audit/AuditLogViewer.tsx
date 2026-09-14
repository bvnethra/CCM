import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { AuditLog } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { apiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { ScrollText, RefreshCw, ShieldCheck } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const { activeTenant } = useTenant();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchLogs = async () => {
    if (!activeTenant) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiClient.getAuditLogs(activeTenant.id, isSuperAdmin);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTenant?.id, isSuperAdmin]);

  const totalPages = Math.ceil(logs.length / pageSize) || 1;
  const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<AuditLog>[] = [
    {
      header: 'Action / Event',
      render: (l) => (
        <div className="flex items-center gap-2">
          <Badge
            variant={
              l.action.includes('DELETE')
                ? 'destructive'
                : l.action.includes('UPDATE')
                ? 'warning'
                : 'info'
            }
            size="sm"
          >
            {l.action}
          </Badge>
          <span className="text-xs font-mono text-slate-700 capitalize font-medium">{l.resource_type}</span>
        </div>
      ),
    },
    {
      header: 'Tenant ID',
      render: (l) => (
        <span className="text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
          {l.tenant_id.substring(0, 13)}...
        </span>
      ),
    },
    {
      header: 'Resource ID',
      render: (l) => (
        <span className="text-xs font-mono text-slate-500">
          {l.resource_id.substring(0, 13)}...
        </span>
      ),
    },
    {
      header: 'IP / Origin',
      render: (l) => (
        <span className="text-xs text-slate-500 font-mono">{l.ip_address || '127.0.0.1'}</span>
      ),
    },
    {
      header: 'Timestamp',
      render: (l) => (
        <span className="text-xs text-slate-600 font-medium">{formatDate(l.created_at)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-blue-600" />
            Audit Trail & Compliance Log
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Immutable trace of all tenant, organization, and facility operations.
          </p>
        </div>

        <Button
          onClick={fetchLogs}
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-600" />}
        >
          Refresh Log
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 flex items-center gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <strong className="text-slate-900">Tenant-Scoped Compliance:</strong> Every record mutation is cryptographically bound to the acting user and target tenant ID.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <Table
          columns={columns}
          data={paginatedLogs}
          keyExtractor={(l) => l.id}
          isLoading={isLoading}
          emptyMessage="No audit logs recorded for this tenant yet."
          className="border-none shadow-none rounded-none"
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={logs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};
