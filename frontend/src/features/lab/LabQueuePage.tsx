import React, { useState, useEffect } from 'react';
import {
  Inbox,
  AlertCircle,
  Clock,
  UserCheck,
  UserMinus,
  Search,
  CheckCircle2,
  ArrowRight,
  Eye,
  PauseCircle,
  RefreshCw,
  AlertTriangle,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { apiClient } from '../../lib/api';
import { CalibrationRequest, UserProfile, Client } from '../../types';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { AssignLabModal } from './AssignLabModal';
import { HoldRequestModal } from './HoldRequestModal';

export interface LabQueuePageProps {
  onOpenIntake?: (requestId: string) => void;
  onNavigateRequests?: () => void;
}

export const LabQueuePage: React.FC<LabQueuePageProps> = ({ onOpenIntake, onNavigateRequests }) => {
  const { currentUser, hasPermission } = useAuth();
  const { activeTenant } = useTenant();

  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [labUsers, setLabUsers] = useState<UserProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState({
    total_queue: 0,
    urgent: 0,
    unassigned: 0,
    assigned: 0,
    on_hold: 0,
  });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<string>('ALL');

  // Modals state
  const [assignModalRequest, setAssignModalRequest] = useState<CalibrationRequest | null>(null);
  const [holdModalRequest, setHoldModalRequest] = useState<CalibrationRequest | null>(null);
  const [receiveModalRequest, setReceiveModalRequest] = useState<CalibrationRequest | null>(null);
  const [receivedQty, setReceivedQty] = useState<number>(1);
  const [expectedQty, setExpectedQty] = useState<number>(1);
  const [receiptRemarks, setReceiptRemarks] = useState<string>('');
  const [receiptSubmitting, setReceiptSubmitting] = useState<boolean>(false);

  const canViewQueue = hasPermission('lab.queue.view') || currentUser?.role === 'lab_user';
  const canAccept = hasPermission('lab.queue.accept') || currentUser?.role === 'lab_user';
  const canAssign = hasPermission('lab.queue.assign') || currentUser?.role === 'tenant_admin' || currentUser?.role === 'super_admin';
  const canHold = hasPermission('lab.queue.hold') || currentUser?.role === 'lab_user' || currentUser?.role === 'tenant_admin';
  const canStartVerification = hasPermission('lab.request.start_verification') || currentUser?.role === 'lab_user';
  const canConfirmReceipt = hasPermission('lab.receipt.confirm') || currentUser?.role === 'lab_user' || currentUser?.role === 'tenant_admin';

  const loadQueueData = async () => {
    if (!activeTenant) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [queueRes, usersRes, clientsRes] = await Promise.all([
        apiClient.getLabQueue(activeTenant.id, {
          status: selectedStatus,
          priority: selectedPriority,
          clientId: selectedClient,
          assignedTo: selectedAssignee,
          search: search || undefined,
          sortBy: 'created_at',
          sortOrder: 'desc',
          page: 1,
          pageSize: 50,
        }),
        apiClient.getTenantLabUsers(activeTenant.id),
        apiClient.getClients(activeTenant.id, {}),
      ]);

      setRequests(queueRes.requests);
      setMetrics(queueRes.metrics);
      setLabUsers(usersRes);
      setClients(clientsRes);
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to load Lab Queue', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueueData();
    const unsubscribe = apiClient.subscribe(() => {
      loadQueueData();
    });
    return () => unsubscribe();
  }, [activeTenant, selectedStatus, selectedPriority, selectedAssignee, selectedClient, search]);

  const handleAccept = async (req: CalibrationRequest) => {
    if (!activeTenant || !currentUser) return;
    try {
      await apiClient.acceptLabRequest(req.id, activeTenant.id, currentUser.id);
      setNotification({
        message: `Request ${req.request_number} accepted by ${currentUser.full_name}.`,
        type: 'success',
      });
      loadQueueData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to accept request', type: 'error' });
    }
  };

  const handleStartVerification = async (req: CalibrationRequest) => {
    if (!activeTenant || !currentUser) return;
    try {
      const updated = await apiClient.startVerification(req.id, activeTenant.id, currentUser.id);
      setNotification({
        message: `Request ${updated.request_number} moved to VERIFICATION stage.`,
        type: 'success',
      });
      loadQueueData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to start verification', type: 'error' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LAB_QUEUE':
        return <Badge variant="info">LAB QUEUE</Badge>;
      case 'VERIFICATION':
        return <Badge variant="success">READY FOR VERIFICATION</Badge>;
      case 'ON_HOLD':
        return <Badge variant="warning">ON HOLD</Badge>;
      case 'COLLECTED':
        return <Badge variant="default">COLLECTED</Badge>;
      case 'CREATED':
        return <Badge variant="default">CREATED</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">CANCELLED</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const columns: Column<CalibrationRequest>[] = [
    {
      header: 'Request #',
      render: (req) => (
        <div className="flex flex-col">
          <button
            onClick={() => onOpenIntake?.(req.id)}
            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left text-sm"
          >
            {req.request_number}
          </button>
          <span className="text-xs text-slate-500 mt-0.5">
            {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      ),
    },
    {
      header: 'Client & Facility',
      render: (req) => (
        <div className="flex flex-col max-w-[200px]">
          <span className="font-medium text-slate-900 truncate text-sm">
            {req.client?.client_name || '—'}
          </span>
          <span className="text-xs text-slate-500 truncate">
            {req.organization?.name || 'Central Facility'}
          </span>
        </div>
      ),
    },
    {
      header: 'Priority',
      render: (req) => (
        <div className="flex items-center gap-1.5">
          {req.priority === 'URGENT' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5" />
              URGENT
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              NORMAL
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Equipment & Availability',
      render: (req) => {
        const total = req.items_count || 1;
        const unavailable = req.unavailable_items_count ?? 0;
        const hasUnavailable = unavailable > 0;

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-slate-900">{total} item(s)</span>
              {hasUnavailable ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium text-[11px]">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  {unavailable} Unavailable
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium text-[11px]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  All Available
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500">
              Coll: {req.collection_date}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Assigned Lab Tech',
      render: (req) => {
        const assignment = req.current_assignment;
        if (!assignment || !assignment.assigned_to_user) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-dashed border-slate-300">
              <UserMinus className="w-3 h-3" />
              Unassigned
            </span>
          );
        }

        const isMe = assignment.assigned_to === currentUser?.id;
        return (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <UserCheck className={`w-3.5 h-3.5 ${isMe ? 'text-blue-600' : 'text-slate-500'}`} />
              {assignment.assigned_to_user.full_name}
              {isMe && <span className="text-[10px] text-blue-600 font-bold">(You)</span>}
            </span>
            <span className="text-[11px] text-slate-500">
              {new Date(assignment.assigned_at).toLocaleDateString()}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Queue Status',
      render: (req) => getStatusBadge(req.status),
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (req) => {
        const isAssignedToMe = req.current_assignment?.assigned_to === currentUser?.id;
        const isUnassigned = !req.current_assignment;

        return (
          <div className="flex items-center justify-end gap-1.5">
            {/* STEP 20: Receive in Lab Button */}
            {canConfirmReceipt && (req.status === 'LAB_QUEUE' || req.status === 'COLLECTED') && (
              <Button
                variant="primary"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => {
                  setReceiveModalRequest(req);
                  const count = req.items?.length || 1;
                  setExpectedQty(count);
                  setReceivedQty(count);
                  setReceiptRemarks('');
                }}
                title="Confirm physical equipment receipt in lab"
              >
                <Inbox className="w-3.5 h-3.5 mr-1" />
                Receive
              </Button>
            )}

            {/* View Details */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenIntake?.(req.id)}
              title="Inspect Request Intake Details"
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              View
            </Button>

            {/* Accept Request Button (For assigned tech or unassigned if self-assigning) */}
            {canAccept && req.status === 'LAB_QUEUE' && (isAssignedToMe || isUnassigned) && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => (isUnassigned ? setAssignModalRequest(req) : handleAccept(req))}
                title="Accept request into lab testing"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {isUnassigned ? 'Take' : 'Accept'}
              </Button>
            )}

            {/* Assign / Reassign Button */}
            {canAssign && req.status !== 'CANCELLED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignModalRequest(req)}
                title={isUnassigned ? 'Assign Technician' : 'Reassign Technician'}
              >
                <UserCheck className="w-3.5 h-3.5 mr-1 text-slate-600" />
                {isUnassigned ? 'Assign' : 'Reassign'}
              </Button>
            )}

            {/* Start Verification Transition */}
            {canStartVerification && req.status === 'LAB_QUEUE' && (
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
                onClick={() => handleStartVerification(req)}
                title="Move request to Verification stage"
              >
                <FileCheck2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Verify
              </Button>
            )}

            {/* Put On Hold */}
            {canHold && req.status !== 'ON_HOLD' && req.status !== 'CANCELLED' && (
              <Button
                variant="outline"
                size="sm"
                className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                onClick={() => setHoldModalRequest(req)}
                title="Put request on hold with documented reason"
              >
                <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  if (!canViewQueue) {
    return (
      <div className="p-8">
        <Card className="p-8 text-center bg-white border border-slate-200">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            You do not have permission to view the Central Laboratory Queue. Please contact your tenant administrator for role assignment.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between shadow-sm border ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs underline hover:no-underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lab Queue</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Central intake queue for calibration instruments, technician task distribution, and verification handoff.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={loadQueueData}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh Queue
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigateRequests?.()}
            leftIcon={<ArrowRight className="w-4 h-4" />}
          >
            All Calibration Requests
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          title="Total in Queue"
          value={metrics.total_queue}
          icon={<Inbox className="w-5 h-5 text-blue-600" />}
          description="Active intake requests"
        />
        <StatCard
          title="Urgent Requests"
          value={metrics.urgent}
          icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          description="High-priority testing"
        />
        <StatCard
          title="Unassigned"
          value={metrics.unassigned}
          icon={<UserMinus className="w-5 h-5 text-amber-600" />}
          description="Awaiting assignment"
        />
        <StatCard
          title="Assigned Techs"
          value={metrics.assigned}
          icon={<UserCheck className="w-5 h-5 text-blue-600" />}
          description="In technician queue"
        />
        <StatCard
          title="On Hold"
          value={metrics.on_hold}
          icon={<Clock className="w-5 h-5 text-purple-600" />}
          description="Awaiting parts/docs"
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-white border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {/* Search */}
          <div className="md:col-span-2">
            <Input
              placeholder="Search request #, client, item code, serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          {/* Queue Status */}
          <div>
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Queue Statuses' },
                { value: 'LAB_QUEUE', label: 'Lab Queue' },
                { value: 'VERIFICATION', label: 'Ready for Verification' },
                { value: 'ON_HOLD', label: 'On Hold' },
              ]}
            />
          </div>

          {/* Priority */}
          <div>
            <Select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Priorities' },
                { value: 'URGENT', label: '⚡ Urgent Only' },
                { value: 'NORMAL', label: 'Normal' },
              ]}
            />
          </div>

          {/* Technician Assignment */}
          <div>
            <Select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Technicians' },
                { value: 'UNASSIGNED', label: '⚠️ Unassigned Only' },
                ...labUsers.map((u) => ({
                  value: u.id,
                  label: u.id === currentUser?.id ? `★ ${u.full_name} (Me)` : u.full_name,
                })),
              ]}
            />
          </div>

          {/* Client Filter */}
          <div>
            <Select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Clients' },
                ...clients.map((c) => ({
                  value: c.id,
                  label: `${c.client_code} - ${c.client_name}`,
                })),
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Main Queue Table */}
      <Card className="bg-white border border-slate-200 overflow-hidden">
        <Table
          columns={columns}
          data={requests}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage={
            search || selectedStatus !== 'ALL' || selectedPriority !== 'ALL' || selectedAssignee !== 'ALL'
              ? 'No queue requests match the active filters.'
              : 'No calibration requests are currently in the laboratory queue.'
          }
        />
      </Card>

      {/* Assign / Reassign Modal */}
      {assignModalRequest && activeTenant && (
        <AssignLabModal
          isOpen={!!assignModalRequest}
          onClose={() => setAssignModalRequest(null)}
          request={assignModalRequest}
          tenantId={activeTenant.id}
          onSuccess={(techName) => {
            setNotification({
              message: `Request ${assignModalRequest.request_number} assigned to ${techName}.`,
              type: 'success',
            });
            loadQueueData();
          }}
        />
      )}

      {/* Hold Modal */}
      {holdModalRequest && activeTenant && (
        <HoldRequestModal
          isOpen={!!holdModalRequest}
          onClose={() => setHoldModalRequest(null)}
          request={holdModalRequest}
          tenantId={activeTenant.id}
          onSuccess={() => {
            setNotification({
              message: `Request ${holdModalRequest.request_number} placed on hold.`,
              type: 'success',
            });
            loadQueueData();
          }}
        />
      )}

      {/* STEP 20: Receive in Lab Modal */}
      {receiveModalRequest && activeTenant && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Inbox className="w-5 h-5 text-indigo-600" />
                Physical Lab Receipt Confirmation
              </h3>
              <button
                onClick={() => setReceiveModalRequest(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 grid grid-cols-2 gap-2">
                <div>Request: <span className="font-bold text-slate-900">{receiveModalRequest.request_number}</span></div>
                <div>Client: <span className="font-semibold text-slate-900">{receiveModalRequest.client?.client_name || 'N/A'}</span></div>
                <div>Priority: <span className="font-semibold text-amber-700">{receiveModalRequest.priority}</span></div>
                <div>Collection Date: <span className="font-mono">{receiveModalRequest.collection_date}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Equipment Qty</label>
                  <Input type="number" readOnly value={expectedQty} className="bg-slate-100 font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Received Quantity *</label>
                  <Input
                    type="number"
                    min={0}
                    value={receivedQty}
                    onChange={(e) => setReceivedQty(parseInt(e.target.value) || 0)}
                    className="font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Physical Condition & Inspection Remarks</label>
                <textarea
                  className="w-full border border-slate-300 rounded-md p-2 text-xs h-20 focus:ring-1 focus:ring-indigo-500"
                  placeholder="E.g., All 5 micrometers received in original protective cases with zero physical damage..."
                  value={receiptRemarks}
                  onChange={(e) => setReceiptRemarks(e.target.value)}
                />
              </div>

              {receivedQty !== expectedQty && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px] font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  Quantity discrepancy detected! Expected {expectedQty}, received {receivedQty}.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!receiptRemarks.trim()) {
                    alert('Mandatory remarks required when marking discrepancy.');
                    return;
                  }
                  setReceiptSubmitting(true);
                  try {
                    const res = await apiClient.recordReceiptDiscrepancy(receiveModalRequest.id, activeTenant.id, {
                      received_quantity: receivedQty,
                      expected_quantity: expectedQty,
                      remarks: receiptRemarks,
                    });
                    if (res.success) {
                      setReceiveModalRequest(null);
                      setNotification({ message: 'Receipt discrepancy recorded.', type: 'error' });
                      loadQueueData();
                    }
                  } finally {
                    setReceiptSubmitting(false);
                  }
                }}
                disabled={receiptSubmitting}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                Mark Discrepancy
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setReceiveModalRequest(null)}>Cancel</Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    setReceiptSubmitting(true);
                    try {
                      const res = await apiClient.confirmLabReceipt(receiveModalRequest.id, activeTenant.id, {
                        received_quantity: receivedQty,
                        expected_quantity: expectedQty,
                        remarks: receiptRemarks || 'Confirmed physical equipment receipt in lab.',
                      });
                      if (res.success) {
                        setReceiveModalRequest(null);
                        setNotification({ message: 'Lab receipt confirmed! Request moved to RECEIVED_IN_LAB.', type: 'success' });
                        loadQueueData();
                      }
                    } finally {
                      setReceiptSubmitting(false);
                    }
                  }}
                  disabled={receiptSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Confirm Receipt
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
