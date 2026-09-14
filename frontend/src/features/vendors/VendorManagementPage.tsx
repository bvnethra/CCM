import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Vendor, TenantStatus } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { VendorModal } from './VendorModal';
import { VendorDetailsModal } from './VendorDetailsModal';
import { apiClient } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { VendorFormValues } from '../../lib/schemas';
import {
  Factory,
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

const CATEGORY_OPTIONS = [
  { label: 'All Disciplines', value: 'all' },
  { label: 'Thermal', value: 'Thermal' },
  { label: 'Electro-Technical', value: 'Electro-Technical' },
  { label: 'Mechanical', value: 'Mechanical' },
  { label: 'Pressure', value: 'Pressure' },
  { label: 'Optical', value: 'Optical' },
  { label: 'Dimensional', value: 'Dimensional' },
  { label: 'Mass & Volume', value: 'Mass & Volume' },
  { label: 'Torque & Force', value: 'Torque & Force' },
  { label: 'Acoustics', value: 'Acoustics' },
  { label: 'RF & Microwave', value: 'RF & Microwave' },
];

export const VendorManagementPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { activeTenant, organizations, subOrganizations } = useTenant();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permissions check
  const canCreate = hasPermission('vendor.create');
  const canEdit = hasPermission('vendor.edit');
  const canDelete = hasPermission('vendor.delete');
  const canActivate = hasPermission('vendor.activate');
  const canDeactivate = hasPermission('vendor.deactivate');

  // Load vendors
  const loadVendors = async () => {
    if (!activeTenant) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const data = await apiClient.getVendors(activeTenant.id, {
        search,
        status: selectedStatus,
        organization_id: selectedOrg,
        category: selectedCategory,
      });
      setVendors(data);
    } catch (err: any) {
      console.error('Failed to load vendors:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, [activeTenant?.id, search, selectedStatus, selectedOrg, selectedCategory]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Create / Update Vendor
  const handleCreateOrUpdate = async (values: VendorFormValues) => {
    if (!activeTenant) return;

    if (editingVendor) {
      await apiClient.updateVendor(editingVendor.id, activeTenant.id, values);
      showNotification(`Vendor "${values.vendor_name}" updated successfully.`);
    } else {
      await apiClient.createVendor(activeTenant.id, values);
      showNotification(`Vendor "${values.vendor_name}" registered successfully.`);
    }
    await loadVendors();
  };

  // Status Toggle (Activate / Deactivate)
  const handleToggleStatus = async (vendor: Vendor) => {
    if (!activeTenant) return;
    const nextStatus: TenantStatus = vendor.status === 'active' ? 'inactive' : 'active';

    if (nextStatus === 'active' && !canActivate) {
      showNotification('You do not have permission to activate vendors.', 'error');
      return;
    }
    if (nextStatus !== 'active' && !canDeactivate) {
      showNotification('You do not have permission to deactivate vendors.', 'error');
      return;
    }

    try {
      await apiClient.updateVendorStatus(vendor.id, activeTenant.id, nextStatus);
      showNotification(
        `Vendor "${vendor.vendor_name}" is now ${nextStatus.toUpperCase()}.`
      );
      await loadVendors();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update vendor status.', 'error');
    }
  };

  // Delete Vendor
  const handleDeleteConfirm = async () => {
    if (!activeTenant || !deletingVendor) return;
    try {
      setIsDeleting(true);
      await apiClient.deleteVendor(deletingVendor.id, activeTenant.id);
      showNotification(`Vendor "${deletingVendor.vendor_name}" has been removed.`);
      setDeletingVendor(null);
      await loadVendors();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete vendor.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedStatus('all');
    setSelectedOrg('all');
    setSelectedCategory('all');
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalPages = Math.ceil(vendors.length / pageSize) || 1;
  const paginatedVendors = vendors.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Table Columns
  const columns: Column<Vendor>[] = [
    {
      header: 'Vendor Code',
      render: (vendor: Vendor) => (
        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          {vendor.vendor_code}
        </span>
      ),
      className: 'w-36',
    },
    {
      header: 'Vendor Name',
      render: (vendor: Vendor) => (
        <div>
          <span className="text-xs font-semibold text-slate-900 block">{vendor.vendor_name}</span>
          {vendor.city && (
            <span className="text-[11px] text-slate-500 font-medium">
              {vendor.city}{vendor.state ? `, ${vendor.state}` : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Contact Person',
      render: (vendor: Vendor) => (
        <span className="text-xs text-slate-700 font-medium">
          {vendor.contact_person || <span className="text-slate-400 italic">None specified</span>}
        </span>
      ),
    },
    {
      header: 'Contact Details',
      render: (vendor: Vendor) => (
        <div className="space-y-0.5 text-xs text-slate-600">
          {vendor.contact_email && (
            <div className="flex items-center gap-1.5 truncate max-w-[180px]">
              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{vendor.contact_email}</span>
            </div>
          )}
          {vendor.contact_phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{vendor.contact_phone}</span>
            </div>
          )}
          {!vendor.contact_email && !vendor.contact_phone && (
            <span className="text-slate-400 italic text-[11px]">No contact info</span>
          )}
        </div>
      ),
    },
    {
      header: 'Serviced Categories',
      render: (vendor: Vendor) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {Array.isArray(vendor.serviced_categories) && vendor.serviced_categories.length > 0 ? (
            vendor.serviced_categories.slice(0, 2).map((cat) => (
              <span
                key={cat}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 font-medium border border-slate-200"
              >
                {cat}
              </span>
            )).concat(
              vendor.serviced_categories.length > 2
                ? [<span key="more" className="text-[10px] text-slate-400">+{vendor.serviced_categories.length - 2}</span>]
                : []
            )
          ) : (
            <span className="text-slate-400 text-[11px] italic">General Scope</span>
          )}
        </div>
      ),
    },
    {
      header: 'Branch / Organization',
      render: (vendor: Vendor) => (
        <div className="text-xs">
          {vendor.organization ? (
            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
              <Network className="w-3.5 h-3.5 text-violet-600 shrink-0" />
              <span>{vendor.organization.name}</span>
            </div>
          ) : (
            <span className="text-slate-400 text-[11px]">Global Tenant Level</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      render: (vendor: Vendor) => (
        <Badge
          variant={
            vendor.status === 'active'
              ? 'success'
              : vendor.status === 'inactive'
              ? 'warning'
              : 'destructive'
          }
        >
          {vendor.status}
        </Badge>
      ),
      className: 'w-28',
    },
    {
      header: 'Onboarded',
      render: (vendor: Vendor) => (
        <span className="text-[11px] text-slate-500 font-mono">
          {formatDate(vendor.created_at)}
        </span>
      ),
      className: 'w-28',
    },
    {
      header: 'Actions',
      render: (vendor: Vendor) => (
        <div className="flex items-center gap-1">
          {/* View Details */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setViewingVendor(vendor);
              setIsDetailsOpen(true);
            }}
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5 text-slate-600" />
          </Button>

          {/* Edit Vendor */}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingVendor(vendor);
                setIsFormModalOpen(true);
              }}
              title="Edit Vendor"
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            </Button>
          )}

          {/* Toggle Status */}
          {(canActivate || canDeactivate) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleToggleStatus(vendor)}
              title={vendor.status === 'active' ? 'Deactivate Vendor' : 'Activate Vendor'}
            >
              <Power
                className={`w-3.5 h-3.5 ${
                  vendor.status === 'active'
                    ? 'text-amber-600 hover:text-amber-700'
                    : 'text-emerald-600 hover:text-emerald-700'
                }`}
              />
            </Button>
          )}

          {/* Delete Vendor */}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeletingVendor(vendor)}
              title="Delete Vendor"
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
              <Factory className="w-5 h-5 text-blue-600" />
              Vendor Master
            </h2>
            <Badge variant="info" size="sm">
              {vendors.length} Onboarded
            </Badge>
            <Badge variant="success" size="sm">
              RLS Scoped
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            External calibration partner directory for Outsourcing, Purchase Orders, and Inter-Lab Testing under{' '}
            <span className="font-semibold text-slate-800">{activeTenant?.name}</span>.
          </p>
        </div>

        {canCreate && (
          <Button
            onClick={() => {
              setEditingVendor(null);
              setIsFormModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
            size="md"
          >
            Onboard Vendor
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5 items-end">
          <div className="relative md:col-span-2">
            <Input
              placeholder="Search by vendor name, code, contact person, email, category..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <Select
            label="Branch / Organization"
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

          <Select
            label="Serviced Discipline"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            options={CATEGORY_OPTIONS}
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

      {/* Vendors Table Container with Pagination */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <Table
          columns={columns}
          data={paginatedVendors}
          keyExtractor={(v) => v.id}
          isLoading={isLoading}
          emptyMessage={`No vendor records found under tenant "${activeTenant?.name}".`}
          className="border-none shadow-none rounded-none"
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={vendors.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add / Edit Vendor Modal */}
      <VendorModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingVendor}
        organizations={organizations}
        subOrganizations={subOrganizations}
        tenantName={activeTenant?.name}
      />

      {/* View Vendor Details Modal */}
      <VendorDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        vendor={viewingVendor}
        tenantName={activeTenant?.name}
        onEdit={() => {
          setEditingVendor(viewingVendor);
          setIsFormModalOpen(true);
        }}
      />

      {/* Delete Confirmation Modal */}
      {deletingVendor && (
        <Modal
          isOpen={!!deletingVendor}
          onClose={() => setDeletingVendor(null)}
          title="Delete Vendor Record"
          description="Are you sure you want to permanently delete this vendor?"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setDeletingVendor(null)}
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
                Delete Vendor
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
                  Deleting <strong className="text-slate-900">{deletingVendor.vendor_name}</strong> (
                  <span className="font-mono">{deletingVendor.vendor_code}</span>) will remove their outsourcing partner profile from this tenant.
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
