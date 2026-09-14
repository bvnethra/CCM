import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  PauseCircle,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  History,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { apiClient } from '../../lib/api';
import { CalibrationRequest } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { AssignLabModal } from './AssignLabModal';
import { HoldRequestModal } from './HoldRequestModal';

export interface LabRequestIntakePageProps {
  requestId?: string;
  onBack: () => void;
}

export const LabRequestIntakePage: React.FC<LabRequestIntakePageProps> = ({ requestId, onBack }) => {
  const { currentUser, hasPermission } = useAuth();
  const { activeTenant } = useTenant();

  const [request, setRequest] = useState<CalibrationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);

  const canAccept = hasPermission('lab.queue.accept') || currentUser?.role === 'lab_user';
  const canAssign = hasPermission('lab.queue.assign') || currentUser?.role === 'tenant_admin' || currentUser?.role === 'super_admin';
  const canHold = hasPermission('lab.queue.hold') || currentUser?.role === 'lab_user' || currentUser?.role === 'tenant_admin';
  const canStartVerification = hasPermission('lab.request.start_verification') || currentUser?.role === 'lab_user';

  const loadDetails = async () => {
    if (!requestId || !activeTenant) return;
    setIsLoading(true);
    try {
      const data = await apiClient.getLabRequestDetails(requestId, activeTenant.id);
      setRequest(data);
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to load request intake details', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [requestId, activeTenant]);

  const handleAccept = async () => {
    if (!request || !activeTenant || !currentUser) return;
    try {
      await apiClient.acceptLabRequest(request.id, activeTenant.id, currentUser.id);
      setNotification({
        message: `Request ${request.request_number} accepted by ${currentUser.full_name}.`,
        type: 'success',
      });
      loadDetails();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to accept request', type: 'error' });
    }
  };

  const handleStartVerification = async () => {
    if (!request || !activeTenant || !currentUser) return;
    try {
      const updated = await apiClient.startVerification(request.id, activeTenant.id, currentUser.id);
      setNotification({
        message: `Request ${updated.request_number} moved to VERIFICATION stage.`,
        type: 'success',
      });
      loadDetails();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to start verification', type: 'error' });
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600">Loading request intake details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-8">
        <Card className="p-8 text-center bg-white border border-slate-200">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800">Request Not Found</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            The calibration request could not be located in the lab queue for your tenant.
          </p>
          <div className="mt-5">
            <Button variant="outline" onClick={onBack}>
              Back to Lab Queue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const items = request.items || [];
  const assignments = request.assignments || [];
  const statusHistory = request.status_history || [];
  const unavailableItems = items.filter((i) => i.item_available === 'NO');
  const hasUnavailable = unavailableItems.length > 0;
  const isAssignedToMe = request.current_assignment?.assigned_to === currentUser?.id;
  const isUnassigned = !request.current_assignment;

  return (
    <div className="space-y-6 pb-12">
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
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs underline hover:no-underline font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header & Actions Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Queue
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{request.request_number}</h1>
              {request.priority === 'URGENT' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5" />
                  URGENT
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  NORMAL
                </span>
              )}
              {request.status === 'LAB_QUEUE' && <Badge variant="info">LAB QUEUE</Badge>}
              {request.status === 'VERIFICATION' && <Badge variant="success">READY FOR VERIFICATION</Badge>}
              {request.status === 'ON_HOLD' && <Badge variant="warning">ON HOLD</Badge>}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Registered on {new Date(request.created_at).toLocaleString()} by {request.created_by_user?.full_name || 'Agent'}
            </p>
          </div>
        </div>

        {/* Workflow Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {canAccept && request.status === 'LAB_QUEUE' && (isAssignedToMe || isUnassigned) && (
            <Button variant="primary" size="sm" onClick={() => (isUnassigned ? setIsAssignModalOpen(true) : handleAccept())}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {isUnassigned ? 'Take Request' : 'Accept Request'}
            </Button>
          )}

          {canAssign && request.status !== 'CANCELLED' && (
            <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)}>
              <UserCheck className="w-4 h-4 mr-1.5 text-slate-600" />
              {isUnassigned ? 'Assign Technician' : 'Reassign Technician'}
            </Button>
          )}

          {canStartVerification && request.status === 'LAB_QUEUE' && (
            <Button
              variant="outline"
              size="sm"
              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
              onClick={handleStartVerification}
            >
              <FileCheck2 className="w-4 h-4 mr-1.5 text-emerald-600" />
              Start Verification
            </Button>
          )}

          {canHold && request.status !== 'ON_HOLD' && request.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              size="sm"
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-300"
              onClick={() => setIsHoldModalOpen(true)}
            >
              <PauseCircle className="w-4 h-4 mr-1.5 text-amber-600" />
              Put On Hold
            </Button>
          )}
        </div>
      </div>

      {/* Prominent Availability Warning Box (If any item is NO) */}
      {hasUnavailable && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl shadow-sm flex items-start gap-3.5">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">
              Section 8 Item Availability Notice: {unavailableItems.length} Instrument(s) Marked Unavailable
            </h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              One or more requested equipment items were marked <strong>UNAVAILABLE (NO)</strong> during collection intake. Detailed remarks and physical verification are mandatory prior to calibration scheduling.
            </p>
          </div>
        </div>
      )}

      {/* Grid: Request & Client Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Request & Logistics Information */}
        <Card className="p-5 bg-white border border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            1. Request & Logistics Information
          </h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 block">Request Number</span>
              <span className="font-semibold text-slate-900">{request.request_number}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Scheduled Collection</span>
              <span className="font-medium text-slate-800">{request.collection_date}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Collection Agent</span>
              <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {request.collection_agent?.full_name || 'Assigned Agent'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Collection Agent Email</span>
              <span className="font-medium text-slate-800 text-xs">{request.collection_agent?.email || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Operating Facility</span>
              <span className="font-medium text-slate-800">{request.organization?.name || 'Central Facility'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Sub-Laboratory</span>
              <span className="font-medium text-slate-800">{request.sub_organization?.name || 'General Calibration'}</span>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 block">General Intake Remarks</span>
              <p className="text-xs text-slate-700 italic mt-0.5">
                {request.remarks || 'No special intake remarks provided.'}
              </p>
            </div>
          </div>
        </Card>

        {/* Section 2: Client Information */}
        <Card className="p-5 bg-white border border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            2. Client Master Information
          </h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div className="col-span-2">
              <span className="text-xs text-slate-500 block">Client Name</span>
              <span className="font-semibold text-slate-900">{request.client?.client_name || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Client Code</span>
              <span className="font-mono text-xs font-medium text-slate-800">{request.client?.client_code || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">GST Number</span>
              <span className="font-mono text-xs text-slate-800">{request.client?.gst_number || 'Unregistered'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Contact Person</span>
              <span className="font-medium text-slate-800">{request.client?.contact_person || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Contact Details</span>
              <span className="text-xs text-slate-800 block">{request.client?.contact_phone || '—'}</span>
              <span className="text-xs text-slate-500 block">{request.client?.contact_email || '—'}</span>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 block">Facility Address</span>
              <p className="text-xs text-slate-700 mt-0.5">
                {request.client?.billing_address || request.client?.address_line_1 || 'Standard client facility'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Section 3 & 4: Requested Equipment Lines & Section 8 Availability Audit */}
      <Card className="bg-white border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              3. Requested Equipment & Section 8 Item Availability
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            {items.length} Line Item(s) — {request.available_items_count} Available, {request.unavailable_items_count} Unavailable
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-xs uppercase text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">Item Code / Model</th>
                <th className="py-3 px-4">Instrument Description</th>
                <th className="py-3 px-4">Manufacturer</th>
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4">Dynamic Availability</th>
                <th className="py-3 px-4">Availability Remarks & Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, idx) => {
                const isAvail = item.item_available === 'YES';
                return (
                  <tr key={item.id || idx} className={!isAvail ? 'bg-amber-50/50' : 'hover:bg-slate-50/50'}>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold text-slate-900 block">
                        {item.item?.item_code || 'ITM-N/A'}
                      </span>
                      <span className="text-xs text-slate-500">{item.item?.model || '—'}</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {item.item?.item_name || 'Standard Calibration Item'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {item.item?.manufacturer || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">
                      {item.item?.serial_number || '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900">
                      {item.requested_quantity || 1}
                    </td>
                    <td className="py-3 px-4">
                      {isAvail ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          YES (Available)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          NO (Unavailable)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.availability_remarks ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-slate-800 bg-white/80 p-1.5 rounded border border-slate-200">
                            {item.availability_remarks}
                          </p>
                          <span className="text-[10px] text-slate-500 block">
                            Checked by {item.checked_by_user?.full_name || 'Agent'} at{' '}
                            {item.availability_checked_at ? new Date(item.availability_checked_at).toLocaleDateString() : 'Intake'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No exceptions reported</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Grid: Lab Assignment & Status History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 5: Lab Assignment History */}
        <Card className="p-5 bg-white border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              5. Laboratory Technician Assignment
            </h3>
            {canAssign && (
              <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)}>
                {isUnassigned ? '+ Assign' : 'Reassign'}
              </Button>
            )}
          </div>

          {/* Current Active Assignment */}
          {request.current_assignment ? (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider">Active Technician</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600 text-white">
                  ACTIVE
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {request.current_assignment.assigned_to_user?.full_name || 'Assigned Technician'}
              </p>
              <p className="text-xs text-slate-500">
                Assigned by {request.current_assignment.assigned_by_user?.full_name || 'Admin'} on{' '}
                {new Date(request.current_assignment.assigned_at).toLocaleString()}
              </p>
              {request.current_assignment.remarks && (
                <p className="text-xs text-slate-700 italic mt-2 bg-white/80 p-2 rounded border border-blue-100">
                  "{request.current_assignment.remarks}"
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center mb-4">
              <p className="text-sm text-slate-600 font-medium">No technician assigned yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Click assign to delegate this intake to a lab user.</p>
            </div>
          )}

          {/* Assignment Audit Log */}
          {assignments.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Assignment Audit History</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {assignments.map((asgn) => (
                  <div key={asgn.id} className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-slate-900">{asgn.assigned_to_user?.full_name || 'Technician'}</span>
                      <p className="text-slate-500 text-[11px]">
                        By {asgn.assigned_by_user?.full_name || 'Admin'} on {new Date(asgn.assigned_at).toLocaleDateString()}
                      </p>
                      {asgn.remarks && <p className="text-slate-600 italic mt-1">"{asgn.remarks}"</p>}
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                        asgn.status === 'ACTIVE'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {asgn.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Section 6: Lifecycle Status History & Audit Trail */}
        <Card className="p-5 bg-white border border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            6. Status Transition History & Audit Log
          </h3>

          {statusHistory.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {statusHistory.map((hist, index) => (
                <div key={hist.id || index} className="flex items-start gap-3 text-xs">
                  <div className="mt-0.5 w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  <div className="flex-1 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span>
                        {hist.previous_status ? `${hist.previous_status} → ` : ''}
                        <span className="text-blue-700">{hist.new_status}</span>
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {new Date(hist.changed_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Updated by {hist.changed_by_user?.full_name || 'System Operator'}
                    </p>
                    {hist.remarks && (
                      <p className="text-slate-700 italic mt-1 border-t border-slate-200/60 pt-1">
                        "{hist.remarks}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              Initial request creation logged. Transitions will appear as the request moves through the laboratory workflow.
            </p>
          )}
        </Card>
      </div>

      {/* Assign Modal */}
      {isAssignModalOpen && activeTenant && (
        <AssignLabModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          request={request}
          tenantId={activeTenant.id}
          onSuccess={(techName) => {
            setNotification({
              message: `Request ${request.request_number} successfully assigned to ${techName}.`,
              type: 'success',
            });
            loadDetails();
          }}
        />
      )}

      {/* Hold Modal */}
      {isHoldModalOpen && activeTenant && (
        <HoldRequestModal
          isOpen={isHoldModalOpen}
          onClose={() => setIsHoldModalOpen(false)}
          request={request}
          tenantId={activeTenant.id}
          onSuccess={() => {
            setNotification({
              message: `Request ${request.request_number} placed ON HOLD.`,
              type: 'success',
            });
            loadDetails();
          }}
        />
      )}
    </div>
  );
};
