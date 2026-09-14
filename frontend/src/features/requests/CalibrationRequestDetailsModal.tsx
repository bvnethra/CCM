import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CalibrationRequest, CalibrationRequestStatus } from '../../types';
import {
  Building2,
  Calendar,
  UserCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Package,
  AlertCircle,
  MapPin,
  Mail,
  Phone,
} from 'lucide-react';

export interface CalibrationRequestDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: CalibrationRequest | null;
  onStatusChange?: (id: string, status: CalibrationRequestStatus, remarks?: string) => Promise<void>;
  canEdit?: boolean;
}

export const CalibrationRequestDetailsModal: React.FC<CalibrationRequestDetailsModalProps> = ({
  isOpen,
  onClose,
  request,
  onStatusChange,
  canEdit = true,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusRemarks, setStatusRemarks] = useState('');
  const [showStatusPrompt, setShowStatusPrompt] = useState<CalibrationRequestStatus | null>(null);

  if (!request) return null;

  const handleStatusTransition = async (newStatus: CalibrationRequestStatus) => {
    if (!onStatusChange) return;
    setIsUpdating(true);
    try {
      await onStatusChange(request.id, newStatus, statusRemarks || undefined);
      setShowStatusPrompt(null);
      setStatusRemarks('');
    } catch (err) {
      console.error('Status transition failed', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const items = request.items || [];
  const unavailableCount = items.filter((i) => i.item_available === 'NO').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Calibration Request Details — ${request.request_number}`}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Header Badges Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/10 border border-blue-600/20 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-slate-900">{request.request_number}</span>
                <Badge
                  variant={
                    request.status === 'COLLECTED'
                      ? 'success'
                      : request.status === 'CREATED'
                      ? 'info'
                      : request.status === 'ON_HOLD'
                      ? 'warning'
                      : 'destructive'
                  }
                >
                  {request.status}
                </Badge>
                <Badge variant={request.priority === 'URGENT' ? 'destructive' : 'default'} size="sm">
                  {request.priority}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Client: <span className="font-medium text-slate-800">{request.client?.client_name || 'N/A'}</span> (
                {request.client?.client_code || 'N/A'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Total Items:</span>
            <Badge variant="purple" size="sm">
              {request.items_count || items.length} Units
            </Badge>
            {unavailableCount > 0 ? (
              <Badge variant="warning" size="sm">
                {unavailableCount} Unavailable
              </Badge>
            ) : (
              <Badge variant="success" size="sm">
                All Available
              </Badge>
            )}
          </div>
        </div>

        {/* Unavailable Alert Banner */}
        {unavailableCount > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notice: Section 8 Request Item Unavailability Tracked</p>
              <p className="mt-0.5 text-amber-800">
                {unavailableCount} item(s) in this intake batch are flagged as UNAVAILABLE. Equipment master definition remains active in the permanent Item Master catalog.
              </p>
            </div>
          </div>
        )}

        {/* Overview & Client Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          {/* Logistics & Scope Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-900 font-semibold">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Logistics & Scope</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-[11px] text-slate-400 block">Collection Date:</span>
                <span className="font-semibold text-slate-800">{request.collection_date}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Collection Agent:</span>
                <span className="font-semibold text-slate-800">{request.collection_agent?.full_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Branch Facility:</span>
                <span className="text-slate-800">{request.organization?.name || 'Main Laboratory Facility'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Intake Created At:</span>
                <span className="text-slate-800 font-mono text-[11px]">{new Date(request.created_at).toLocaleString()}</span>
              </div>
            </div>

            {request.remarks && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 block">Remarks & Precautions:</span>
                <p className="text-slate-700 italic mt-0.5">{request.remarks}</p>
              </div>
            )}
          </div>

          {/* Client Account Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-900 font-semibold">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Client Details</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{request.client?.client_name}</span>
                <Badge variant="info" size="sm">{request.client?.client_code}</Badge>
              </div>
              <div className="text-slate-600 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>{request.client?.contact_person || 'No contact person'}</span>
              </div>
              <div className="text-slate-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{request.client?.contact_email || 'No email registered'}</span>
                {request.client?.contact_phone && (
                  <>
                    <span>•</span>
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{request.client?.contact_phone}</span>
                  </>
                )}
              </div>
              <div className="text-slate-600 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>
                  {request.client?.address_line_1 || 'Registered commercial address'}, {request.client?.city || ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Requested Items & Availability Table */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Requested Equipment & Inspection Audit ({items.length} Records)</span>
            </h4>
            <span className="text-[11px] text-slate-400">Section 8 Dynamic Request Availability</span>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Equipment</th>
                    <th className="py-2.5 px-3">Manufacturer & Model</th>
                    <th className="py-2.5 px-3">Serial No</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3">Availability</th>
                    <th className="py-2.5 px-3">Remarks / Reason</th>
                    <th className="py-2.5 px-3">Checked At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                        No equipment items attached to this calibration request.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const isAvailable = item.item_available === 'YES';
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            !isAvailable ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">
                              {item.item?.item_name || 'Equipment Unit'}
                            </div>
                            <span className="font-mono text-[10px] text-blue-600">
                              {item.item?.item_code || 'ITM-UNKNOWN'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {item.item?.manufacturer || 'Standard'} {item.item?.model ? `• ${item.item.model}` : ''}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                            {item.item?.serial_number || 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-800">
                            {item.requested_quantity}
                          </td>
                          <td className="py-2.5 px-3">
                            {isAvailable ? (
                              <Badge variant="success" size="sm">
                                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                                Available
                              </Badge>
                            ) : (
                              <Badge variant="destructive" size="sm">
                                <XCircle className="w-3 h-3 inline mr-1" />
                                Unavailable
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {item.availability_remarks ? (
                              <span className="text-rose-700 font-medium">{item.availability_remarks}</span>
                            ) : (
                              <span className="text-slate-400 italic">Verified normal</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {item.availability_checked_at
                              ? new Date(item.availability_checked_at).toLocaleDateString()
                              : 'At intake'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Status Prompt Dialog (if action clicked) */}
        {showStatusPrompt && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-3 animate-in fade-in">
            <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <span>Confirm Transition: Set status to {showStatusPrompt}</span>
            </h5>
            <input
              type="text"
              placeholder="Optional status transition remark..."
              value={statusRemarks}
              onChange={(e) => setStatusRemarks(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:outline-hidden focus:border-blue-600"
            />
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowStatusPrompt(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant={showStatusPrompt === 'CANCELLED' ? 'destructive' : 'primary'}
                onClick={() => handleStatusTransition(showStatusPrompt)}
                isLoading={isUpdating}
              >
                Confirm Update
              </Button>
            </div>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-200 pt-4 gap-3">
          <div className="flex items-center gap-2">
            {canEdit && request.status === 'CREATED' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowStatusPrompt('COLLECTED')}
                  disabled={isUpdating}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                  Mark Collected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowStatusPrompt('ON_HOLD')}
                  disabled={isUpdating}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600 mr-1" />
                  Put On Hold
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowStatusPrompt('CANCELLED')}
                  disabled={isUpdating}
                >
                  Cancel Request
                </Button>
              </>
            )}

            {canEdit && request.status === 'COLLECTED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowStatusPrompt('ON_HOLD')}
                disabled={isUpdating}
              >
                Put On Hold
              </Button>
            )}

            {canEdit && request.status === 'ON_HOLD' && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowStatusPrompt('COLLECTED')}
                disabled={isUpdating}
              >
                Resume & Mark Collected
              </Button>
            )}
          </div>

          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
