import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { UserProfile, UserRole, TenantStatus, Role } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { UserModal } from './UserModal';
import { UserDetailsModal } from './UserDetailsModal';
import { apiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import {
  Users,
  Plus,
  Search,
  CheckCircle,
  Eye,
  Edit2,
  RotateCcw,
  Network,
  GitFork,
  Power,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { activeTenant, organizations, subOrganizations } = useTenant();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsersAndRoles = async () => {
    if (!activeTenant) return;
    setIsLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([
        apiClient.getUsers(activeTenant.id, {
          search,
          status: statusFilter,
          role: roleFilter,
          organization_id: orgFilter,
        }),
        apiClient.getRoles(activeTenant.id),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRoles();
    const unsubscribe = apiClient.subscribe(() => {
      fetchUsersAndRoles();
    });
    return () => unsubscribe();
  }, [activeTenant?.id, statusFilter, roleFilter, orgFilter]);

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setRoleFilter('all');
    setOrgFilter('all');
    setCurrentPage(1);
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.phone && u.phone.includes(term))
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCreateOrUpdate = async (data: {
    full_name: string;
    email: string;
    phone?: string | null;
    organization_id?: string | null;
    sub_organization_id?: string | null;
    role: UserRole;
    status: TenantStatus;
    role_ids?: string[];
  }) => {
    if (!activeTenant) return;
    setActionError(null);

    try {
      if (editingUser) {
        await apiClient.updateUser(editingUser.id, activeTenant.id, data);
        setActionSuccess(`User "${data.full_name}" updated successfully.`);
      } else {
        await apiClient.createUser(activeTenant.id, data);
        setActionSuccess(`User "${data.full_name}" created under ${activeTenant.name}.`);
      }
      await fetchUsersAndRoles();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save user');
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    if (!activeTenant) return;
    const nextStatus: TenantStatus = user.status === 'active' ? 'inactive' : 'active';

    try {
      await apiClient.updateUserStatus(user.id, activeTenant.id, nextStatus);
      setActionSuccess(`User "${user.full_name}" status set to ${nextStatus}.`);
      await fetchUsersAndRoles();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user status');
    }
  };

  const columns: Column<UserProfile>[] = [
    {
      header: 'User Identity',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-700 font-bold text-xs shadow-2xs">
            {u.full_name.charAt(0)}
          </div>
          <div>
            <span className="font-semibold text-slate-900">{u.full_name}</span>
            <p className="text-xs text-slate-500">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Phone',
      render: (u) => (
        <span className="text-xs text-slate-600 font-medium">{u.phone || '—'}</span>
      ),
    },
    {
      header: 'Branch & Facility',
      render: (u) => {
        const orgName = u.organization?.name || organizations.find((o) => o.id === u.organization_id)?.name;
        const subName = u.sub_organization?.name || subOrganizations.find((s) => s.id === u.sub_organization_id)?.name;

        return (
          <div className="text-xs space-y-0.5">
            {orgName ? (
              <div className="flex items-center gap-1 text-slate-700 font-medium">
                <Network className="w-3 h-3 text-blue-600" />
                <span>{orgName}</span>
              </div>
            ) : (
              <span className="text-slate-400">Global Tenant Level</span>
            )}
            {subName && (
              <div className="flex items-center gap-1 text-[11px] text-slate-500 pl-4">
                <GitFork className="w-2.5 h-2.5 text-blue-500" />
                <span>{subName}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Assigned Role',
      render: (u) => (
        <Badge variant="info" size="sm">
          {u.role.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      header: 'Status',
      render: (u) => (
        <Badge
          variant={
            u.status === 'active'
              ? 'success'
              : u.status === 'inactive'
              ? 'warning'
              : 'destructive'
          }
        >
          {u.status}
        </Badge>
      ),
    },
    {
      header: 'Created',
      render: (u) => (
        <span className="text-xs text-slate-500">{formatDate(u.created_at)}</span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              setViewingUser(u);
              setIsDetailsOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="View User Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              setEditingUser(u);
              setIsModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Edit User"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleToggleStatus(u)}
            className={`p-1.5 rounded-lg transition-colors ${
              u.status === 'active'
                ? 'text-amber-600 hover:bg-amber-50'
                : 'text-emerald-600 hover:bg-emerald-50'
            }`}
            title={u.status === 'active' ? 'Deactivate User' : 'Activate User'}
          >
            <Power className="w-3.5 h-3.5" />
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
            <Users className="w-5 h-5 text-blue-600" />
            User Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage authenticated users, branch assignments, and security roles within{' '}
            <strong className="text-slate-800">{activeTenant?.name}</strong>.
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingUser(null);
            setIsModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add User
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <Input
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { label: 'All Roles', value: 'all' },
              { label: 'Tenant Admin', value: 'tenant_admin' },
              { label: 'Org Admin', value: 'org_admin' },
              { label: 'Manager', value: 'manager' },
              { label: 'Lab User', value: 'lab_user' },
              { label: 'Collection Agent', value: 'collection_agent' },
              { label: 'Commercial User', value: 'commercial_user' },
              { label: 'Dispatch User', value: 'dispatch_user' },
              { label: 'Viewer', value: 'viewer' },
            ]}
          />

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

          <Button
            variant="secondary"
            size="md"
            onClick={handleResetFilters}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* Users Table Container with Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <Table
          columns={columns}
          data={paginatedUsers}
          keyExtractor={(u) => u.id}
          isLoading={isLoading}
          emptyMessage={`No users found under tenant "${activeTenant?.name}".`}
          className="border-none shadow-none rounded-none"
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredUsers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add / Edit User Modal */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingUser}
        organizations={organizations}
        subOrganizations={subOrganizations}
        roles={roles}
        tenantName={activeTenant?.name}
      />

      {/* View User Details Modal */}
      <UserDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        user={viewingUser}
        tenantName={activeTenant?.name}
      />
    </div>
  );
};
