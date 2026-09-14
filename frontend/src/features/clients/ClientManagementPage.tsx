import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Client, TenantStatus } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { ClientModal } from './ClientModal';
import { ClientDetailsModal } from './ClientDetailsModal';
import { apiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { ClientFormValues } from '../../lib/schemas';
import {
  Briefcase,
  Plus,
  Search,
  CheckCircle,
  Eye,
  Edit2,
  RotateCcw,
  Network,
  Power,
  Trash2,
  Mail,
  Phone,
  AlertTriangle,
} from 'lucide-react';

export const ClientManagementPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { activeTenant, organizations, subOrganizations } = useTenant();

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permissions check
  const canCreate = hasPermission('client.create');
  const canEdit = hasPermission('client.edit');
  const canDelete = hasPermission('client.delete');
  const canActivate = hasPermission('client.activate');
  const canDeactivate = hasPermission('client.deactivate');

  // Load clients
  const loadClients = async () => {
    if (!activeTenant) return;
    try {
      setIsLoading(true);
      const data = await apiClient.getClients(activeTenant.id, {
        search,
        status: selectedStatus,
        organization_id: selectedOrg,
      });
      setClients(data);
    } catch (err: any) {
      console.error('Failed to load clients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [activeTenant?.id, search, selectedStatus, selectedOrg]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Create / Update Client
  const handleCreateOrUpdate = async (values: ClientFormValues) => {
    if (!activeTenant) return;

    if (editingClient) {
      await apiClient.updateClient(editingClient.id, activeTenant.id, values);
      showNotification(`Client "${values.client_name}" updated successfully.`);
    } else {
      await apiClient.createClient(activeTenant.id, values);
      showNotification(`Client "${values.client_name}" registered successfully.`);
    }
    await loadClients();
  };

  // Status Toggle (Activate / Deactivate)
  const handleToggleStatus = async (client: Client) => {
    if (!activeTenant) return;
    const nextStatus: TenantStatus = client.status === 'active' ? 'inactive' : 'active';

    if (nextStatus === 'active' && !canActivate) {
      showNotification('You do not have permission to activate clients.', 'error');
      return;
    }
    if (nextStatus !== 'active' && !canDeactivate) {
      showNotification('You do not have permission to deactivate clients.', 'error');
      return;
    }

    try {
      await apiClient.updateClientStatus(client.id, activeTenant.id, nextStatus);
      showNotification(
        `Client "${client.client_name}" is now ${nextStatus.toUpperCase()}.`
      );
      await loadClients();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update client status.', 'error');
    }
  };

  // Delete Client
  const handleDeleteConfirm = async () => {
    if (!activeTenant || !deletingClient) return;
    try {
      setIsDeleting(true);
      await apiClient.deleteClient(deletingClient.id, activeTenant.id);
      showNotification(`Client "${deletingClient.client_name}" has been removed.`);
      setDeletingClient(null);
      await loadClients();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete client.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedStatus('all');
    setSelectedOrg('all');
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalPages = Math.ceil(clients.length / pageSize) || 1;
  const paginatedClients = clients.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Table Columns
  const columns: Column<Client>[] = [
    {
      header: 'Client Code',
      render: (client: Client) => (
        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          {client.client_code}
        </span>
      ),
      className: 'w-36',
    },
    {
      header: 'Client Name',
      render: (client: Client) => (
        <div>
          <span className="text-xs font-semibold text-slate-900 block">{client.client_name}</span>
          {client.city && (
            <span className="text-[11px] text-slate-500 font-medium">
              {client.city}{client.state ? `, ${client.state}` : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Contact Person',
      render: (client: Client) => (
        <span className="text-xs text-slate-700 font-medium">
          {client.contact_person || <span className="text-slate-400 italic">None specified</span>}
        </span>
      ),
    },
    {
      header: 'Contact Details',
      render: (client: Client) => (
        <div className="space-y-0.5 text-xs text-slate-600">
          {client.contact_email && (
            <div className="flex items-center gap-1.5 truncate max-w-[180px]">
              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{client.contact_email}</span>
            </div>
          )}
          {client.contact_phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{client.contact_phone}</span>
            </div>
          )}
          {!client.contact_email && !client.contact_phone && (
            <span className="text-slate-400 italic text-[11px]">No contact info</span>
          )}
        </div>
      ),
    },
    {
      header: 'Branch / Organization',
      render: (client: Client) => (
        <div className="text-xs">
          {client.organization ? (
            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
              <Network className="w-3.5 h-3.5 text-violet-600 shrink-0" />
              <span>{client.organization.name}</span>
            </div>
          ) : (
            <span className="text-slate-400 text-[11px]">Global Tenant Level</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      render: (client: Client) => (
        <Badge
          variant={
            client.status === 'active'
              ? 'success'
              : client.status === 'inactive'
              ? 'warning'
              : 'destructive'
          }
        >
          {client.status}
        </Badge>
      ),
      className: 'w-28',
    },
    {
      header: 'Registered',
      render: (client: Client) => (
        <span className="text-[11px] text-slate-500 font-mono">
          {formatDate(client.created_at)}
        </span>
      ),
      className: 'w-28',
    },
    {
      header: 'Actions',
      render: (client: Client) => (
        <div className="flex items-center gap-1">
          {/* View Details */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setViewingClient(client);
              setIsDetailsOpen(true);
            }}
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5 text-slate-600" />
          </Button>

          {/* Edit Client */}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingClient(client);
                setIsFormModalOpen(true);
              }}
              title="Edit Client"
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            </Button>
          )}

          {/* Toggle Status */}
          {(canActivate || canDeactivate) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleToggleStatus(client)}
              title={client.status === 'active' ? 'Deactivate Client' : 'Activate Client'}
            >
              <Power
                className={`w-3.5 h-3.5 ${
                  client.status === 'active'
                    ? 'text-amber-600 hover:text-amber-700'
                    : 'text-emerald-600 hover:text-emerald-700'
                }`}
              />
            </Button>
          )}

          {/* Delete Client */}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeletingClient(client)}
              title="Delete Client"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 hover:text-rose-700" />
            </Button>
          )}
        </div>
      ),
      className: 'w-36 text-right',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3.5 text-xs font-semibold shadow-sm border transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              Client Master
            </h2>
            <Badge variant="info" size="sm">
              {clients.length} Registered
            </Badge>
            <Badge variant="success" size="sm">
              RLS Scoped
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Commercial enterprise client directory for Calibration Requests, Quotations, and Testing Orders under{' '}
            <span className="font-semibold text-slate-800">{activeTenant?.name}</span>.
          </p>
        </div>

        {canCreate && (
          <Button
            onClick={() => {
              setEditingClient(null);
              setIsFormModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
            size="md"
          >
            Register Client
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 items-end">
          <div className="relative md:col-span-2">
            <Input
              placeholder="Search by client name, code, contact person, email, GST..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <Select
            label="Organization / Branch"
            value={selectedOrg}
            onChange={(e) => {
              setSelectedOrg(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { label: 'All Organizations', value: 'all' },
              ...organizations.map((org) => ({
                label: org.name,
                value: org.id,
              })),
            ]}
          />

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                label="Account Status"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
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
              className="mt-5"
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Clients Table Container with Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <Table
          columns={columns}
          data={paginatedClients}
          keyExtractor={(c) => c.id}
          isLoading={isLoading}
          emptyMessage={`No client records found under tenant "${activeTenant?.name}".`}
          className="border-none shadow-none rounded-none"
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={clients.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add / Edit Client Modal */}
      <ClientModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingClient}
        organizations={organizations}
        subOrganizations={subOrganizations}
        tenantName={activeTenant?.name}
      />

      {/* View Client Details Modal */}
      <ClientDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        client={viewingClient}
        tenantName={activeTenant?.name}
        onEdit={() => {
          setEditingClient(viewingClient);
          setIsFormModalOpen(true);
        }}
      />

      {/* Delete Confirmation Modal */}
      {deletingClient && (
        <Modal
          isOpen={!!deletingClient}
          onClose={() => setDeletingClient(null)}
          title="Delete Client Record"
          description="Are you sure you want to permanently delete this client?"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setDeletingClient(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                isLoading={isDeleting}
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Delete Client
              </Button>
            </div>
          }
        >
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Irreversible Deletion</p>
                <p className="mt-0.5">
                  Deleting <strong className="text-slate-900">{deletingClient.client_name}</strong> (
                  <span className="font-mono">{deletingClient.client_code}</span>) will remove their commercial profile from this tenant.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              This action will be permanently recorded in the tenant audit trail.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
