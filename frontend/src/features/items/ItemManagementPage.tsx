import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { ItemMaster, TenantStatus } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { ItemModal } from './ItemModal';
import { ItemDetailsModal } from './ItemDetailsModal';
import { apiClient } from '../../lib/api';
import { ItemFormValues } from '../../lib/schemas';
import {
  Package,
  Plus,
  Search,
  CheckCircle,
  Eye,
  Edit2,
  RotateCcw,
  Power,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

const ITEM_TYPES_FILTER = [
  { label: 'All Equipment Types', value: 'all' },
  { label: 'Master Standard', value: 'Master Standard' },
  { label: 'Working Standard', value: 'Working Standard' },
  { label: 'Calibrator', value: 'Calibrator' },
  { label: 'Test Equipment', value: 'Test Equipment' },
  { label: 'Transducer', value: 'Transducer' },
  { label: 'Sensor', value: 'Sensor' },
  { label: 'Gauge', value: 'Gauge' },
];

export const ItemManagementPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { activeTenant, organizations, subOrganizations } = useTenant();

  const [items, setItems] = useState<ItemMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
  const [viewingItem, setViewingItem] = useState<ItemMaster | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ItemMaster | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Role permissions
  const canCreate = hasPermission('item.create');
  const canEdit = hasPermission('item.edit');
  const canDelete = hasPermission('item.delete');
  const canActivate = hasPermission('item.activate');
  const canDeactivate = hasPermission('item.deactivate');

  const fetchItems = async () => {
    if (!activeTenant) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const data = await apiClient.getItems(activeTenant.id, {
        search: search || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        item_type: selectedType !== 'all' ? selectedType : undefined,
        manufacturer: selectedManufacturer !== 'all' ? selectedManufacturer : undefined,
        organization_id: selectedOrg !== 'all' ? selectedOrg : undefined,
      });
      setItems(data);
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to fetch items', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeTenant?.id, search, selectedStatus, selectedOrg, selectedType, selectedManufacturer]);

  // Subscribe to updates
  useEffect(() => {
    const unsubscribe = apiClient.subscribe(() => {
      fetchItems();
    });
    return () => unsubscribe();
  }, [activeTenant?.id, search, selectedStatus, selectedOrg, selectedType, selectedManufacturer]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Extract unique manufacturers for dropdown filter
  const manufacturerOptions = [
    { label: 'All Manufacturers', value: 'all' },
    ...Array.from(new Set(items.map((i) => i.manufacturer).filter(Boolean))).map((m) => ({
      label: m!,
      value: m!,
    })),
  ];

  // Pagination calculations
  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedStatus('all');
    setSelectedOrg('all');
    setSelectedType('all');
    setSelectedManufacturer('all');
    setCurrentPage(1);
  };

  const handleCreateOrUpdateItem = async (formData: ItemFormValues) => {
    if (!activeTenant) return;
    if (editingItem) {
      await apiClient.updateItem(editingItem.id, activeTenant.id, formData);
      setNotification({ message: `Item "${formData.item_code}" updated successfully.`, type: 'success' });
      setEditingItem(null);
    } else {
      await apiClient.createItem(activeTenant.id, {
        item_code: formData.item_code,
        item_name: formData.item_name,
        item_type: formData.item_type || null,
        manufacturer: formData.manufacturer || null,
        model: formData.model || null,
        serial_number: formData.serial_number || null,
        measurement_range: formData.measurement_range || null,
        least_count: formData.least_count || null,
        standard_cost: formData.standard_cost,
        calibration_frequency: formData.calibration_frequency,
        calibration_frequency_unit: formData.calibration_frequency_unit,
        status: formData.status,
        organization_id: formData.organization_id || null,
        sub_org_id: formData.sub_org_id || null,
      });
      setNotification({ message: `Item "${formData.item_code}" onboarded successfully.`, type: 'success' });
      setIsCreateModalOpen(false);
    }
    fetchItems();
  };

  const handleToggleStatus = async (item: ItemMaster) => {
    if (!activeTenant) return;
    const nextStatus: TenantStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await apiClient.updateItemStatus(item.id, activeTenant.id, nextStatus);
      setNotification({
        message: `Item "${item.item_code}" is now ${nextStatus}.`,
        type: 'success',
      });
      fetchItems();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to update item status', type: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete || !activeTenant) return;
    try {
      setIsDeleting(true);
      await apiClient.deleteItem(itemToDelete.id, activeTenant.id);
      setNotification({
        message: `Item "${itemToDelete.item_code}" deleted successfully.`,
        type: 'success',
      });
      setItemToDelete(null);
      fetchItems();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to delete item', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<ItemMaster>[] = [
    {
      header: 'Item Code',
      render: (row) => (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
          {row.item_code}
        </span>
      ),
    },
    {
      header: 'Item Name',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">{row.item_name}</div>
          {row.organization && (
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <span>{row.organization.name}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Type',
      render: (row) => (
        <Badge variant={row.item_type === 'Master Standard' ? 'info' : 'default'} size="sm">
          {row.item_type || 'Standard'}
        </Badge>
      ),
    },
    {
      header: 'Manufacturer & Model',
      render: (row) => (
        <div className="text-xs">
          <span className="font-medium text-slate-800">{row.manufacturer || '—'}</span>
          {row.model && <span className="text-slate-400 font-mono ml-1.5">[{row.model}]</span>}
        </div>
      ),
    },
    {
      header: 'Serial No.',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.serial_number || '—'}
        </span>
      ),
    },
    {
      header: 'Range & Least Count',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-700 font-medium">{row.measurement_range || '—'}</div>
          {row.least_count && (
            <div className="text-[11px] text-slate-400 font-mono">LC: {row.least_count}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Standard Cost',
      render: (row) => (
        <span className="text-xs font-semibold text-emerald-700">
          ₹{Number(row.standard_cost || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Frequency',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.calibration_frequency} {row.calibration_frequency_unit || 'M'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'default'} size="sm">
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-current" />
          {row.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewingItem(row)}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {canEdit && (
            <button
              onClick={() => setEditingItem(row)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit Item"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {((row.status === 'active' && canDeactivate) || (row.status === 'inactive' && canActivate)) && (
            <button
              onClick={() => handleToggleStatus(row)}
              className={`p-1.5 rounded transition-colors ${
                row.status === 'active'
                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
              }`}
              title={row.status === 'active' ? 'Deactivate Item' : 'Activate Item'}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}

          {canDelete && (
            <button
              onClick={() => setItemToDelete(row)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete Item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`flex items-center gap-2 p-3.5 rounded-lg border text-xs shadow-xs animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Item Master
            </h1>
            <Badge variant="info" size="sm">
              {items.length} Registered
            </Badge>
            <Badge variant="success" size="sm">
              RLS Scoped
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Catalog of test equipment, reference calibrators, and measurement standards under{' '}
            <span className="font-semibold text-slate-700">{activeTenant?.name}</span>.
          </p>
        </div>

        {canCreate && (
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Item
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <Card>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Input
                placeholder="Search by code, name, manufacturer, model, serial..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>

            <div>
              <Select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setCurrentPage(1);
                }}
                options={ITEM_TYPES_FILTER}
              />
            </div>

            <div>
              <Select
                value={selectedOrg}
                onChange={(e) => {
                  setSelectedOrg(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { label: 'All Organizations', value: 'all' },
                  ...organizations.map((org) => ({
                    label: `${org.name} (${org.code})`,
                    value: org.id,
                  })),
                ]}
              />
            </div>

            <div>
              <Select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { label: 'All Statuses', value: 'all' },
                  { label: 'Active Only', value: 'active' },
                  { label: 'Inactive Only', value: 'inactive' },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Filter Manufacturer:</span>
              <select
                value={selectedManufacturer}
                onChange={(e) => {
                  setSelectedManufacturer(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {manufacturerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {(search || selectedStatus !== 'all' || selectedOrg !== 'all' || selectedType !== 'all' || selectedManufacturer !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card>
        <Table
          columns={columns}
          data={paginatedItems}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No equipment or item master records found matching your filter criteria."
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={items.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* Create / Edit Modal */}
      {(isCreateModalOpen || editingItem) && (
        <ItemModal
          isOpen={isCreateModalOpen || Boolean(editingItem)}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingItem(null);
          }}
          onSubmit={handleCreateOrUpdateItem}
          initialData={editingItem}
          organizations={organizations}
          subOrganizations={subOrganizations}
          tenantName={activeTenant?.name}
        />
      )}

      {/* Details View Modal */}
      {viewingItem && (
        <ItemDetailsModal
          isOpen={Boolean(viewingItem)}
          onClose={() => setViewingItem(null)}
          item={viewingItem}
          canEdit={canEdit}
          onEdit={() => {
            const item = viewingItem;
            setViewingItem(null);
            setEditingItem(item);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <Modal
          isOpen={Boolean(itemToDelete)}
          onClose={() => setItemToDelete(null)}
          title="Delete Item Master Record"
          description={`Confirm deletion of ${itemToDelete.item_code} (${itemToDelete.item_name})`}
          maxWidth="sm"
        >
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-red-200 bg-red-50/70 p-3.5 flex items-start gap-2.5 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Permanent Deletion Warning</p>
                <p className="mt-0.5 leading-relaxed">
                  Deleting item <strong>{itemToDelete.item_code}</strong> will permanently remove it from the
                  equipment master catalog. Any future calibration requests referencing this item will fail validation.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteConfirm}
                isLoading={isDeleting}
              >
                Delete Item
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
