import React, { useState } from 'react';
import { useTenant } from '../../context/TenantContext';
import { SubOrganization, TenantStatus } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { SubOrganizationModal } from './SubOrganizationModal';
import { apiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import {
  GitFork,
  Plus,
  Search,
  CheckCircle,
  Network,
  Trash2,
  Edit2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

export const SubOrganizationManagementPage: React.FC = () => {
  const { activeTenant, organizations, subOrganizations, refreshData, isLoading } = useTenant();

  const [search, setSearch] = useState('');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubOrg, setEditingSubOrg] = useState<SubOrganization | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const handleResetFilters = () => {
    setSearch('');
    setSelectedOrgFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const filteredSubs = subOrganizations.filter((sub) => {
    const matchesSearch =
      sub.name.toLowerCase().includes(search.toLowerCase()) ||
      sub.code.toLowerCase().includes(search.toLowerCase());
    const matchesOrg = selectedOrgFilter === 'all' || sub.organization_id === selectedOrgFilter;
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchesSearch && matchesOrg && matchesStatus;
  });

  const totalPages = Math.ceil(filteredSubs.length / pageSize) || 1;
  const paginatedSubs = filteredSubs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCreateOrUpdate = async (data: {
    organization_id: string;
    name: string;
    code: string;
    status: TenantStatus;
  }) => {
    if (!activeTenant) return;
    setActionError(null);

    try {
      if (editingSubOrg) {
        await apiClient.updateSubOrganization(editingSubOrg.id, activeTenant.id, {
          name: data.name,
          code: data.code,
          status: data.status,
        });
        setActionSuccess(`Sub-organization "${data.name}" updated successfully.`);
      } else {
        await apiClient.createSubOrganization(activeTenant.id, data);
        setActionSuccess(`Sub-organization "${data.name}" created.`);
      }
      await refreshData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save sub-organization');
    }
  };

  const handleDelete = async (sub: SubOrganization) => {
    if (!activeTenant) return;
    if (!window.confirm(`Are you sure you want to delete sub-organization "${sub.name}"?`)) {
      return;
    }

    try {
      await apiClient.deleteSubOrganization(sub.id, activeTenant.id);
      setActionSuccess(`Sub-organization "${sub.name}" removed.`);
      await refreshData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete sub-organization');
    }
  };

  const columns: Column<SubOrganization>[] = [
    {
      header: 'Sub-Organization / Facility',
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600 font-bold text-xs shadow-2xs">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-900">{s.name}</span>
            <p className="text-xs font-mono text-slate-400">{s.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Parent Organization',
      render: (s) => {
        const parent = organizations.find((o) => o.id === s.organization_id) || s.organization;
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
            <Network className="w-3.5 h-3.5 text-blue-600" />
            <span>{parent?.name || 'Unknown'}</span>
          </div>
        );
      },
    },
    {
      header: 'Tenant Context',
      render: () => (
        <span className="text-xs text-slate-600">{activeTenant?.name}</span>
      ),
    },
    {
      header: 'Status',
      render: (s) => (
        <Badge
          variant={
            s.status === 'active'
              ? 'success'
              : s.status === 'inactive'
              ? 'warning'
              : 'destructive'
          }
        >
          {s.status}
        </Badge>
      ),
    },
    {
      header: 'Created',
      render: (s) => (
        <span className="text-xs text-slate-500">{formatDate(s.created_at)}</span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              setEditingSubOrg(s);
              setIsModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Edit Sub-Organization"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleDelete(s)}
            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete Sub-Organization"
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
            <GitFork className="w-5 h-5 text-blue-600" />
            Sub-Organization / Facility Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Calibration laboratories and testing units nested under organizations within{' '}
            <strong className="text-slate-800">{activeTenant?.name}</strong>.
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingSubOrg(null);
            setIsModalOpen(true);
          }}
          disabled={organizations.length === 0}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Sub-Organization
        </Button>
      </div>

      {organizations.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            You need at least one parent organization in this tenant before creating sub-organizations or facilities.
          </span>
        </div>
      )}

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
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1">
            <Input
              placeholder="Search facilities by name or code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="w-full md:w-56">
            <Select
              value={selectedOrgFilter}
              onChange={(e) => {
                setSelectedOrgFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { label: 'All Parent Organizations', value: 'all' },
                ...organizations.map((org) => ({
                  label: org.name,
                  value: org.id,
                })),
              ]}
            />
          </div>

          <div className="w-full md:w-40">
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
            className="w-full md:w-auto"
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* Sub-Organizations Table with Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <Table
          columns={columns}
          data={paginatedSubs}
          keyExtractor={(s) => s.id}
          isLoading={isLoading}
          emptyMessage={`No sub-organizations found in tenant "${activeTenant?.name}".`}
          className="border-none shadow-none rounded-none"
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredSubs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal Dialog */}
      <SubOrganizationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingSubOrg}
        organizations={organizations}
        tenantName={activeTenant?.name}
      />
    </div>
  );
};
