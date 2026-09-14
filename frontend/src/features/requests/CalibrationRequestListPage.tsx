import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
  CalibrationRequest,
  Client,
  ItemMaster,
  CalibrationRequestStatus,
  CalibrationRequestPriority,
  ItemAvailability,
} from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { CreateCalibrationRequestModal } from './CreateCalibrationRequestModal';
import { CalibrationRequestDetailsModal } from './CalibrationRequestDetailsModal';
import { apiClient } from '../../lib/api';
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle,
  Eye,
  Clock,
  AlertTriangle,
  RotateCcw,
  PackageCheck,
  Ban,
  FlaskConical,
} from 'lucide-react';

const STATUS_FILTERS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Created (Pending Collection)', value: 'CREATED' },
  { label: 'Collected (In Transit/Intake)', value: 'COLLECTED' },
  { label: 'In Lab Queue', value: 'LAB_QUEUE' },
  { label: 'In Verification', value: 'VERIFICATION' },
  { label: 'On Hold', value: 'ON_HOLD' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const PRIORITY_FILTERS = [
  { label: 'All Priorities', value: 'all' },
  { label: 'Normal Priority', value: 'NORMAL' },
  { label: 'Urgent (Expedited)', value: 'URGENT' },
];

export interface CalibrationRequestListPageProps {
  onOpenLabQueue?: () => void;
  onOpenLabIntake?: (requestId: string) => void;
  onOpenRequestDetails?: (requestId: string) => void;
}

export const CalibrationRequestListPage: React.FC<CalibrationRequestListPageProps> = ({
  onOpenLabQueue,
  onOpenLabIntake,
  onOpenRequestDetails: _onOpenRequestDetails,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const { activeTenant } = useTenant();
  const userRole = currentUser?.role || 'viewer';

  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<ItemMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CalibrationRequest | null>(null);
  const [cancelModalData, setCancelModalData] = useState<CalibrationRequest | null>(null);
  const [cancelRemarks, setCancelRemarks] = useState('');

  const canCreate = hasPermission('request.create') || hasPermission('collection.create') || userRole === 'collection_agent';
  const canEdit = hasPermission('request.edit') || hasPermission('collection.edit') || userRole === 'collection_agent';
  const canCancel = hasPermission('request.cancel') || userRole === 'tenant_admin' || userRole === 'super_admin';

  const loadData = async () => {
    if (!activeTenant) return;
    setIsLoading(true);
    try {
      const [reqData, clientData, itemData] = await Promise.all([
        apiClient.getCalibrationRequests({
          tenantId: activeTenant.id,
          userRole: userRole,
          search: search || undefined,
          status: selectedStatus,
          priority: selectedPriority,
          clientId: selectedClient,
        }),
        apiClient.getClients(activeTenant.id, {}),
        apiClient.getItems(activeTenant.id, { status: 'active' }),
      ]);
      setRequests(reqData);
      setClients(clientData);
      setItems(itemData);
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to fetch calibration requests', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = apiClient.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [activeTenant, userRole, selectedStatus, selectedPriority, selectedClient, search]);

  const handleCreateSubmit = async (data: {
    client_id: string;
    collection_date: string;
    priority: CalibrationRequestPriority;
    remarks?: string | null;
    items: Array<{
      item_id: string;
      requested_quantity: number;
      item_available: ItemAvailability;
      availability_remarks?: string | null;
    }>;
    override_availability?: boolean;
  }) => {
    if (!activeTenant || !currentUser) return;
    try {
      const created = await apiClient.createCalibrationRequest(data, activeTenant.id, currentUser.id);
      setNotification({
        message: `Calibration request ${created.request_number} created successfully.`,
        type: 'success',
      });
      setIsCreateModalOpen(false);
      setSelectedRequest(created);
    } catch (err: any) {
      throw err;
    }
  };

  const handleStatusChange = async (id: string, newStatus: CalibrationRequestStatus, rem?: string) => {
    if (!activeTenant) return;
    try {
      const updated = await apiClient.updateCalibrationRequestStatus(id, activeTenant.id, newStatus, rem);
      setNotification({
        message: `Request ${updated.request_number} status updated to ${newStatus}.`,
        type: 'success',
      });
      if (selectedRequest?.id === id) {
        setSelectedRequest(updated);
      }
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to update request status', type: 'error' });
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalData || !activeTenant) return;
    try {
      await apiClient.cancelCalibrationRequest(cancelModalData.id, activeTenant.id, cancelRemarks || 'Cancelled by agent');
      setNotification({
        message: `Calibration request ${cancelModalData.request_number} has been cancelled.`,
        type: 'success',
      });
      setCancelModalData(null);
      setCancelRemarks('');
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to cancel request', type: 'error' });
    }
  };

  const handleMoveToLabQueue = async (req: CalibrationRequest) => {
    if (!activeTenant || !currentUser) return;
    try {
      const updated = await apiClient.moveToLabQueue(
        req.id,
        activeTenant.id,
        currentUser.id,
        'Dispatched from Collection to Central Lab Queue'
      );
      setNotification({
        message: `Calibration request ${updated.request_number} transferred to Lab Queue.`,
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to transfer to Lab Queue', type: 'error' });
    }
  };

  // Metrics Counters
  const totalCount = requests.length;
  const createdCount = requests.filter((r) => r.status === 'CREATED').length;
  const collectedCount = requests.filter((r) => r.status === 'COLLECTED').length;
  const urgentCount = requests.filter((r) => r.priority === 'URGENT' && r.status !== 'CANCELLED').length;
  const onHoldCount = requests.filter((r) => r.status === 'ON_HOLD').length;

  // Pagination slicing
  const totalPages = Math.ceil(requests.length / pageSize) || 1;
  const displayedRequests = requests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<CalibrationRequest>[] = [
    {
      header: 'Request No.',
      render: (req: CalibrationRequest) => (
        <div>
          <button
            onClick={() => setSelectedRequest(req)}
            className="font-mono text-xs font-bold text-blue-600 hover:underline text-left block"
          >
            {req.request_number}
          </button>
          <span className="text-[10px] text-slate-400 font-normal">
            {new Date(req.created_at).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      header: 'Client',
      render: (req: CalibrationRequest) => (
        <div>
          <span className="font-semibold text-slate-900 block text-xs truncate max-w-[180px]">
            {req.client?.client_name || 'Client Unit'}
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {req.client?.client_code || 'N/A'}
          </span>
        </div>
      ),
    },
    {
      header: 'Collection Agent',
      render: (req: CalibrationRequest) => (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
            {req.collection_agent?.full_name?.charAt(0) || 'A'}
          </div>
          <div>
            <span className="text-xs font-medium text-slate-800 block">
              {req.collection_agent?.full_name || 'Assigned Agent'}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-mono">
              {req.collection_agent?.role?.replace('_', ' ') || 'agent'}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Collection Date',
      render: (req: CalibrationRequest) => (
        <span className="text-xs text-slate-700 font-medium whitespace-nowrap">
          {req.collection_date}
        </span>
      ),
    },
    {
      header: 'Priority',
      render: (req: CalibrationRequest) => (
        <Badge
          variant={req.priority === 'URGENT' ? 'destructive' : 'default'}
          size="sm"
        >
          {req.priority === 'URGENT' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
          {req.priority}
        </Badge>
      ),
    },
    {
      header: 'Items & Availability',
      render: (req: CalibrationRequest) => {
        const unavailable = req.unavailable_items_count || 0;
        const totalItems = req.items_count || (req.items ? req.items.length : 0);

        return (
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-800">
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </span>
            <div>
              {unavailable > 0 ? (
                <Badge variant="warning" size="sm">
                  {unavailable} Unavailable
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  All Available
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      render: (req: CalibrationRequest) => {
        let variant: 'success' | 'warning' | 'destructive' | 'info' | 'default' = 'default';
        if (req.status === 'COLLECTED') variant = 'success';
        if (req.status === 'CREATED') variant = 'info';
        if (req.status === 'LAB_QUEUE') variant = 'default';
        if (req.status === 'VERIFICATION') variant = 'success';
        if (req.status === 'ON_HOLD') variant = 'warning';
        if (req.status === 'CANCELLED') variant = 'destructive';

        return (
          <div className="flex flex-col gap-0.5">
            <Badge variant={variant}>{req.status.replace('_', ' ')}</Badge>
            {req.status === 'LAB_QUEUE' && req.current_assignment?.assigned_to_user && (
              <span className="text-[10px] text-slate-500 font-mono">
                Tech: {req.current_assignment.assigned_to_user.full_name}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (req: CalibrationRequest) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedRequest(req)}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
          >
            View
          </Button>

          {(req.status === 'CREATED' || req.status === 'COLLECTED') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMoveToLabQueue(req)}
              title="Transfer request to Central Lab Queue"
              className="text-blue-700 hover:bg-blue-50 border-blue-200"
              leftIcon={<FlaskConical className="w-3.5 h-3.5 text-blue-600" />}
            >
              To Lab
            </Button>
          )}

          {(req.status === 'LAB_QUEUE' || req.status === 'VERIFICATION') && onOpenLabIntake && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenLabIntake(req.id)}
              title="Open in Lab Queue Intake"
              className="text-purple-700 hover:bg-purple-50 border-purple-200"
              leftIcon={<FlaskConical className="w-3.5 h-3.5 text-purple-600" />}
            >
              Lab
            </Button>
          )}

          {canCancel &&
            req.status !== 'CANCELLED' &&
            req.status !== 'COLLECTED' &&
            req.status !== 'LAB_QUEUE' &&
            req.status !== 'VERIFICATION' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCancelModalData(req);
                  setCancelRemarks('');
                }}
                title="Cancel Request"
                className="text-rose-600 hover:bg-rose-50 hover:border-rose-300"
              >
                <Ban className="w-3.5 h-3.5" />
              </Button>
            )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-xs font-semibold shadow-xs transition-all ${
            notification.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Calibration Requests</h1>
            <Badge variant="purple" size="sm">Step 6</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Intake logistics, instrument availability check, and calibration batch requests for {activeTenant?.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenLabQueue && (
            <Button
              variant="outline"
              onClick={onOpenLabQueue}
              leftIcon={<FlaskConical className="w-4 h-4 text-blue-600" />}
            >
              Lab Queue (Step 7)
            </Button>
          )}
          {canCreate && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New Calibration Request
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Requests
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Active tenant requests</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Created (Pending)
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{createdCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Awaiting field pickup</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Collected
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{collectedCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Instruments in custody</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Urgent & Hold
            </span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">
            {urgentCount} <span className="text-xs font-normal text-slate-400">({onHoldCount} on hold)</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Expedited priority queue</span>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 border-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by request number, client name, agent, or remarks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-600 focus:outline-hidden"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-600 focus:outline-hidden"
            >
              {PRIORITY_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            <select
              value={selectedClient}
              onChange={(e) => {
                setSelectedClient(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-600 focus:outline-hidden max-w-[160px] truncate"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.client_name}</option>
              ))}
            </select>

            {(search || selectedStatus !== 'all' || selectedPriority !== 'all' || selectedClient !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedStatus('all');
                  setSelectedPriority('all');
                  setSelectedClient('all');
                  setCurrentPage(1);
                }}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card className="overflow-hidden border-slate-200 shadow-2xs">
        <Table
          columns={columns}
          data={displayedRequests}
          keyExtractor={(req) => req.id}
          isLoading={isLoading}
          emptyMessage="No calibration requests found matching your filter criteria."
        />

        {/* Pagination Bar */}
        {requests.length > pageSize && (
          <div className="border-t border-slate-200 p-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={requests.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      {/* Create Modal Wizard */}
      <CreateCalibrationRequestModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        clients={clients}
        items={items}
        currentUserName={currentUser?.full_name || 'Collection Agent'}
        currentUserId={currentUser?.id || 'usr-default'}
      />

      {/* Details Inspection Modal */}
      <CalibrationRequestDetailsModal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        onStatusChange={handleStatusChange}
        canEdit={canEdit}
      />

      {/* Cancel Confirmation Modal */}
      {cancelModalData && (
        <Modal
          isOpen={!!cancelModalData}
          onClose={() => setCancelModalData(null)}
          title={`Cancel Calibration Request — ${cancelModalData.request_number}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-rose-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Confirm Cancellation</p>
                <p className="mt-0.5 text-rose-800">
                  Are you sure you want to cancel request <strong>{cancelModalData.request_number}</strong> for client{' '}
                  <strong>{cancelModalData.client?.client_name}</strong>? This action will mark all associated request items as cancelled.
                </p>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Cancellation Reason / Note
              </label>
              <textarea
                value={cancelRemarks}
                onChange={(e) => setCancelRemarks(e.target.value)}
                rows={3}
                placeholder="Reason for cancellation (e.g. client requested postponement, equipment damaged beyond repair)..."
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-rose-600 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
              <Button variant="outline" onClick={() => setCancelModalData(null)}>
                Keep Request
              </Button>
              <Button variant="destructive" onClick={handleConfirmCancel}>
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
