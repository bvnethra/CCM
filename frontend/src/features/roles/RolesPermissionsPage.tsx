import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { Role, Permission } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RoleModal } from './RoleModal';
import { apiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import {
  ShieldCheck,
  Plus,
  Edit2,
  CheckCircle,
  Key,
  Layers,
  Check,
} from 'lucide-react';

export const RolesPermissionsPage: React.FC = () => {
  const { activeTenant } = useTenant();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [activeTab, setActiveTab] = useState<'roles' | 'matrix'>('roles');
  const [selectedMatrixRole, setSelectedMatrixRole] = useState<string>('role-02'); // Tenant Admin default
  const [rolePermMap, setRolePermMap] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchRolesAndPermissions = async () => {
    if (!activeTenant) return;
    setIsLoading(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        apiClient.getRoles(activeTenant.id),
        apiClient.getPermissions(),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);

      // Load permissions for each role
      const map: Record<string, string[]> = {};
      for (const r of rolesData) {
        const pIds = await apiClient.getRolePermissions(r.id);
        map[r.id] = pIds;
      }
      setRolePermMap(map);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load roles and permissions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesAndPermissions();
    const unsubscribe = apiClient.subscribe(() => {
      fetchRolesAndPermissions();
    });
    return () => unsubscribe();
  }, [activeTenant?.id]);

  const handleCreateOrUpdateRole = async (data: {
    name: string;
    code: string;
    description?: string | null;
    permission_ids?: string[];
  }) => {
    if (!activeTenant) return;
    setActionError(null);

    try {
      if (editingRole) {
        await apiClient.updateRole(editingRole.id, activeTenant.id, data);
        setActionSuccess(`Role "${data.name}" updated.`);
      } else {
        await apiClient.createRole(activeTenant.id, data);
        setActionSuccess(`Role "${data.name}" defined for ${activeTenant.name}.`);
      }
      await fetchRolesAndPermissions();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save role');
    }
  };

  const handleToggleMatrixPermission = async (roleId: string, permissionId: string) => {
    if (!activeTenant) return;
    const current = rolePermMap[roleId] || [];
    const next = current.includes(permissionId)
      ? current.filter((id) => id !== permissionId)
      : [...current, permissionId];

    setRolePermMap((prev) => ({ ...prev, [roleId]: next }));

    try {
      await apiClient.assignRolePermissions(roleId, next, activeTenant.id);
      setActionSuccess('Role permissions updated in real-time.');
      setTimeout(() => setActionSuccess(null), 2500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update role permissions');
    }
  };

  const roleColumns: Column<Role>[] = [
    {
      header: 'Role Name & Scope',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600 font-bold text-xs shadow-2xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{r.name}</span>
              {r.is_system ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                  System
                </span>
              ) : (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                  Custom
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-slate-400">{r.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Description',
      render: (r) => (
        <span className="text-xs text-slate-600 max-w-sm truncate block">
          {r.description || 'No description provided'}
        </span>
      ),
    },
    {
      header: 'Granted Permissions',
      render: (r) => (
        <span className="rounded bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 font-semibold border border-slate-200">
          {rolePermMap[r.id]?.length ?? r.permissions_count ?? 0} Permissions
        </span>
      ),
    },
    {
      header: 'Assigned Users',
      render: (r) => (
        <span className="text-xs text-slate-600 font-medium">
          {r.users_count ?? 0} Users
        </span>
      ),
    },
    {
      header: 'Created',
      render: (r) => (
        <span className="text-xs text-slate-500">{formatDate(r.created_at)}</span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSelectedMatrixRole(r.id);
              setActiveTab('matrix');
            }}
            className="text-xs h-8"
          >
            Edit Matrix
          </Button>

          {!r.is_system && (
            <button
              onClick={() => {
                setEditingRole(r);
                setIsModalOpen(true);
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Edit Role Properties"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Group permissions by module
  const modules = Array.from(new Set(permissions.map((p) => p.module)));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            Roles & Permissions Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure Role-Based Access Control (RBAC) and granular permissions matrix for{' '}
            <strong className="text-slate-800">{activeTenant?.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => {
              setEditingRole(null);
              setIsModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Custom Role
          </Button>
        </div>
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

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'roles'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Roles Directory ({roles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'matrix'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Permission Matrix</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Roles Directory */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <Table
            columns={roleColumns}
            data={roles}
            keyExtractor={(r) => r.id}
            isLoading={isLoading}
            emptyMessage="No roles configured."
            className="border-none shadow-none rounded-none"
          />
        </div>
      )}

      {/* Tab 2: Permission Matrix */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Target Role Selector Card */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Active Role for Permission Assignment
                </label>
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => {
                    const isSelected = selectedMatrixRole === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedMatrixRole(r.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                        }`}
                      >
                        {r.name}
                        {r.is_system && <span className="ml-1 opacity-70 text-[10px]">(System)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-500">
                  Permissions Granted:{' '}
                  <strong className="text-slate-900">
                    {rolePermMap[selectedMatrixRole]?.length || 0}
                  </strong>{' '}
                  / {permissions.length}
                </span>
              </div>
            </div>
          </Card>

          {/* Grouped Permission Matrix Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
            {modules.map((mod) => {
              const modulePerms = permissions.filter((p) => p.module === mod);
              return (
                <div key={mod} className="p-4">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      {mod} Module
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {modulePerms.length} Capabilities
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {modulePerms.map((perm) => {
                      const isGranted = (rolePermMap[selectedMatrixRole] || []).includes(perm.id);
                      return (
                        <div
                          key={perm.id}
                          onClick={() => handleToggleMatrixPermission(selectedMatrixRole, perm.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start justify-between gap-2 select-none ${
                            isGranted
                              ? 'bg-blue-50/60 border-blue-200 shadow-2xs'
                              : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-semibold text-slate-900 block">{perm.name}</span>
                            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                              {perm.code}
                            </span>
                            {perm.description && (
                              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                {perm.description}
                              </p>
                            )}
                          </div>

                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isGranted ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white'
                            }`}
                          >
                            {isGranted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Role Modal */}
      <RoleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdateRole}
        initialData={editingRole}
        permissions={permissions}
        tenantName={activeTenant?.name}
      />
    </div>
  );
};
