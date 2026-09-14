import React, { useState } from 'react';
import { useTenant } from '../../context/TenantContext';
import { Organization, TenantStatus } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { OrganizationModal } from './OrganizationModal';
import { apiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import {
  Network,
  Plus,
  Search,
  CheckCircle,
  Building2,
  Trash2,
  Edit2,
  GitFork,
  RotateCcw,
} from 'lucide-react';

export const OrganizationManagementPage: React.FC = () => {
  const { activeTenant, organizations, refreshData, isLoading } = useTenant();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOrgs.length / pageSize) || 1;
  const paginatedOrgs = filteredOrgs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCreateOrUpdate = async (data: { name: string; code: string; status: TenantStatus }) => {
    if (!activeTenant) return;
    setActionError(null);

    try {
      if (editingOrg) {
        await apiClient.updateOrganization(editingOrg.id, activeTenant.id, data);
        setActionSuccess(`Organization "${data.name}" updated successfully.`);
      } else {
        await apiClient.createOrganization(activeTenant.id, data);
        setActionSuccess(`Organization "${data.name}" created under ${activeTenant.name}.`);
      }
      await refreshData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save organization');
    }
  };

  const handleDelete = async (org: Organization) => {
    if (!activeTenant) return;
    if (
      !window.confirm(
        `Are you sure you want to delete organization "${org.name}"? All nested sub-organizations and facilities will also be deleted!`
      )
    ) {
      return;
    }

    try {
      await apiClient.deleteOrganization(org.id, activeTenant.id);
      setActionSuccess(`Organization "${org.name}" deleted.`);
      await refreshData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete organization');
    }
  };

  const columns: Column<Organization>[] = [
    {
      header: 'Organization',
      render: (o) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600 font-bold text-xs shadow-2xs">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-900">{o.name}</span>
            <p className="text-xs font-mono text-slate-400">{o.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Parent Tenant',
      render: () => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <Building2 className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-medium">{activeTenant?.name}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (o) => (
        <Badge
          variant={
            o.status === 'active'
              ? 'success'
              : o.status === 'inactive'
              ? 'warning'
              : 'destructive'
          }
        >
          {o.status}
        </Badge>
      ),
    },
    {
      header: 'Sub-Organizations',
      render: (o) => (
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 border border-slate-200 flex items-center gap-1 w-fit font-medium">
          <GitFork className="w-3 h-3 text-blue-600" />
          {o.sub_organizations_count ?? 0} Facilities
        </span>
      ),
    },
    {
      header: 'Created',
      render: (o) => (
        <span className="text-xs text-slate-500">{formatDate(o.created_at)}</span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (o) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              setEditingOrg(o);
              setIsModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Edit Organization"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleDelete(o)}
            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete Organization"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
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
            <Network className="w-5 h-5 text-blue-600" />
            Organization Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Scoped strictly under active tenant: <strong className="text-slate-800">{activeTenant?.name}</strong>
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingOrg(null);
            setIsModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Organization
        </Button>
      </div>

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-2">
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:flex-1">
            <Input
              placeholder="Search organizations by name or code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <div className="w-full sm:w-48">
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

      {/* Organizations Table with Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <Table
          columns={columns}
          data={paginatedOrgs}
          keyExtractor={(o) => o.id}
          isLoading={isLoading}
          emptyMessage={`No organizations found under tenant "${activeTenant?.name}". Create one above.`}
          className="border-none shadow-none rounded-none"
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredOrgs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal Dialog */}
      <OrganizationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingOrg}
        tenantName={activeTenant?.name}
      />
    </div>
  );
};
