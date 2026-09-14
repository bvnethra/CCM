import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Tenant, TenantStatus } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { TenantModal } from './TenantModal';
import { apiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import {
  Building2,
  Plus,
  Search,
  CheckCircle,
  Shield,
  Edit2,
  Lock,
  RotateCcw,
} from 'lucide-react';

export const TenantManagementPage: React.FC = () => {
  const { isSuperAdmin, currentUser } = useAuth();
  const { tenants, activeTenant, setActiveTenantId, refreshData, isLoading } = useTenant();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('newest');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSortOrder('newest');
    setCurrentPage(1);
  };

  const filteredTenants = tenants
    .filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortOrder === 'name') return a.name.localeCompare(b.name);
      if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const totalPages = Math.ceil(filteredTenants.length / pageSize) || 1;
  const paginatedTenants = filteredTenants.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCreateOrUpdate = async (data: {
    name: string;
    code: string;
    status: TenantStatus;
    settings: { timezone: string; currency: string; complianceStandard: string };
  }) => {
    if (editingTenant) {
      await apiClient.updateTenant(editingTenant.id, data);
      setActionSuccess(`Tenant "${data.name}" updated successfully.`);
    } else {
      await apiClient.createTenant(data);
      setActionSuccess(`Tenant "${data.name}" created and provisioned.`);
    }
    await refreshData();
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    const nextStatus: TenantStatus = tenant.status === 'active' ? 'inactive' : 'active';
    await apiClient.updateTenant(tenant.id, { status: nextStatus });
    setActionSuccess(`Tenant "${tenant.name}" status updated to ${nextStatus}.`);
    await refreshData();
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const columns: Column<Tenant>[] = [
    {
      header: 'Tenant Entity',
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600 font-bold text-xs shadow-2xs">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{t.name}</span>
              {activeTenant?.id === t.id && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-slate-400">{t.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (t) => (
        <Badge
          variant={
            t.status === 'active'
              ? 'success'
              : t.status === 'inactive'
              ? 'warning'
              : 'destructive'
          }
        >
          {t.status}
        </Badge>
      ),
    },
    {
      header: 'Compliance Standard',
      render: (t) => (
        <span className="text-xs text-slate-600 font-medium">
          {t.settings?.complianceStandard || 'ISO/IEC 17025'}
        </span>
      ),
    },
    {
      header: 'Child Orgs',
      render: (t) => (
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium border border-slate-200">
          {t.organizations_count ?? 0} Orgs
        </span>
      ),
    },
    {
      header: 'Created',
      render: (t) => (
        <span className="text-xs text-slate-500">{formatDate(t.created_at)}</span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          {isSuperAdmin && (
            <Button
              size="sm"
              variant={activeTenant?.id === t.id ? 'primary' : 'secondary'}
              onClick={() => setActiveTenantId(t.id)}
              className="text-xs h-8"
            >
              {activeTenant?.id === t.id ? 'Active' : 'Switch Context'}
            </Button>
          )}

          <button
            onClick={() => {
              setEditingTenant(t);
              setIsModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Edit Tenant"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => handleToggleStatus(t)}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                t.status === 'active'
                  ? 'text-amber-600 hover:bg-amber-50'
                  : 'text-emerald-600 hover:bg-emerald-50'
              }`}
              title={t.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
            >
              {t.status === 'active' ? 'Suspend' : 'Activate'}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Tenant Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Top-level enterprise accounts with complete Row Level Security data isolation.
          </p>
        </div>

        {isSuperAdmin ? (
          <Button
            onClick={() => {
              setEditingTenant(null);
              setIsModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Tenant
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Tenant Scoped Mode</span>
          </div>
        )}
      </div>

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Security Info Card */}
      {!isSuperAdmin && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Signed in as <strong className="text-slate-900">{currentUser?.full_name}</strong>. Access is restricted strictly to{' '}
              <strong className="text-blue-700">{activeTenant?.name}</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <div className="flex flex-col lg:flex-row items-center gap-3">
          <div className="w-full lg:flex-1">
            <Input
              placeholder="Search by tenant name or code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { label: 'All Statuses', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
                { label: 'Suspended', value: 'suspended' },
              ]}
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { label: 'Newest First', value: 'newest' },
                { label: 'Oldest First', value: 'oldest' },
                { label: 'By Name (A-Z)', value: 'name' },
              ]}
            />
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={handleResetFilters}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            className="w-full sm:w-auto"
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* Tenants Table Container with Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <Table
          columns={columns}
          data={paginatedTenants}
          keyExtractor={(t) => t.id}
          isLoading={isLoading}
          emptyMessage="No tenants found matching your filter criteria."
          className="border-none shadow-none rounded-none"
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTenants.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal Dialog */}
      <TenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingTenant}
      />
    </div>
  );
};
