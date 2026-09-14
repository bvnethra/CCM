import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { ServiceRequest, ServiceStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building,
  RotateCcw,
  Play,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';

interface ServiceRequestDetailsPageProps {
  serviceRequestId: string;
  onBack?: () => void;
  onReturnToCalibrationSuccess?: () => void;
}

export const ServiceRequestDetailsPage: React.FC<ServiceRequestDetailsPageProps> = ({
  serviceRequestId,
  onBack,
  onReturnToCalibrationSuccess,
}) => {
  const { activeTenant } = useTenant();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);

  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [clientName, setClientName] = useState('');
  const [clientRole, setClientRole] = useState('');
  const [approvalRef, setApprovalRef] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetails = async () => {
    if (!activeTenant || !serviceRequestId) return;
    setLoading(true);
    try {
      const data = await api.getServiceRequestDetails(serviceRequestId, activeTenant.id);
      setRequest(data);
      if (data.client?.contact_person) {
        setClientName(data.client.contact_person);
      }
    } catch (err) {
      console.error('Failed to load service request details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [activeTenant, serviceRequestId]);

  const handleRecordApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !request) return;

    setApprovalError(null);
    if (approvalDecision === 'REJECTED' && !approvalRemarks.trim()) {
      setApprovalError('Rejection remarks are mandatory when rejecting service.');
      return;
    }
    if (approvalDecision === 'APPROVED' && !clientName.trim()) {
      setApprovalError('Client representative name is required.');
      return;
    }

    setApprovalSubmitting(true);
    try {
      await api.recordClientApproval(activeTenant.id, request.id, {
        approval_status: approvalDecision,
        approved_by_client_name: clientName,
        approved_by_client_role: clientRole,
        approval_remarks: approvalRemarks,
        approval_reference: approvalRef,
      });
      setShowApprovalModal(false);
      await fetchDetails();
    } catch (err: any) {
      setApprovalError(err.message || 'Failed to record client approval');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handleStartService = async () => {
    if (!activeTenant || !request) return;
    setActionLoading(true);
    try {
      await api.startService(activeTenant.id, request.id);
      await fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to start service');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteService = async () => {
    if (!activeTenant || !request) return;
    setActionLoading(true);
    try {
      await api.completeService(activeTenant.id, request.id);
      await fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to complete service');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnToCalibration = async () => {
    if (!activeTenant || !request) return;
    if (!confirm('Are you sure you want to return this serviced item to the Calibration Queue for re-testing?')) {
      return;
    }
    setActionLoading(true);
    try {
      await api.returnToCalibration(activeTenant.id, request.id);
      if (onReturnToCalibrationSuccess) {
        onReturnToCalibrationSuccess();
      } else if (onBack) {
        onBack();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to return item to calibration');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        Loading service request details...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-8 text-center text-slate-600 space-y-4">
        <p>Service request not found or access denied.</p>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back to Service List
          </Button>
        )}
      </div>
    );
  }

  const approval = request.approvals && request.approvals.length > 0 ? request.approvals[0] : null;

  const renderStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case 'AWAITING_CLIENT_APPROVAL':
        return <Badge variant="warning">Awaiting Approval</Badge>;
      case 'APPROVED':
        return <Badge variant="purple">Approved</Badge>;
      case 'IN_SERVICE':
        return <Badge variant="info">In Service</Badge>;
      case 'SERVICE_COMPLETED':
        return <Badge variant="success">Service Completed</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Client Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back Button */}
      {onBack && (
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-700 hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Service Directory
        </Button>
      )}

      {/* Header Banner */}
      <Card className="p-6 border-l-4 border-l-amber-500 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                {request.id}
              </h1>
              {renderStatusBadge(request.service_status)}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Calibration Request #{request.request?.request_number || 'N/A'} | Client: <span className="font-semibold">{request.client?.client_name}</span>
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {request.service_status === 'AWAITING_CLIENT_APPROVAL' && (
              <Button
                onClick={() => setShowApprovalModal(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
              >
                Record Client Approval
              </Button>
            )}

            {request.service_status === 'APPROVED' && (
              <Button
                onClick={handleStartService}
                disabled={actionLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Servicing
              </Button>
            )}

            {request.service_status === 'IN_SERVICE' && (
              <Button
                onClick={handleCompleteService}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium inline-flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete Service
              </Button>
            )}

            {request.service_status === 'SERVICE_COMPLETED' && (
              <Button
                onClick={handleReturnToCalibration}
                disabled={actionLoading}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold inline-flex items-center gap-2 shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Return to Re-Calibration Queue
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fault & Servicing Information */}
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Fault & Service Information
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Fault Description
                </label>
                <p className="mt-1 text-sm font-medium text-slate-900 bg-amber-50/50 p-3 rounded border border-amber-200/60 leading-relaxed">
                  {request.fault_description}
                </p>
              </div>

              {request.service_remarks && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Service Remarks / Recommendations
                  </label>
                  <p className="mt-1 text-sm text-slate-800 bg-slate-50 p-3 rounded border border-slate-200">
                    {request.service_remarks}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Estimated Service Cost
                  </label>
                  <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                    {request.estimated_service_cost != null ? `₹${request.estimated_service_cost.toFixed(2)}` : 'Quote Pending'}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Service Requirement
                  </label>
                  <div className="text-sm font-semibold text-amber-700 mt-0.5">
                    {request.service_required ? 'Service Required (Repair/OEM)' : 'Optional'}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Failed Calibration Context */}
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Calibration Failure Historical Context
            </h2>

            {request.calibration ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 block">Calibration ID</span>
                    <span className="font-mono font-medium text-slate-900">{request.calibration.id}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Calibration Result</span>
                    <Badge variant="destructive">{request.calibration.result}</Badge>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Calibrated By</span>
                    <span className="font-medium text-slate-900">
                      {request.calibration.calibrated_by_user?.full_name || request.calibration.calibrated_by}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Started / Failed Date</span>
                    <span className="text-slate-800">
                      {new Date(request.calibration.calibration_started_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {request.calibration.remarks && (
                  <div className="pt-2">
                    <span className="text-xs text-slate-500 block">Calibration Technician Remarks</span>
                    <p className="text-xs text-slate-700 italic bg-red-50/50 p-2.5 rounded border border-red-100 mt-1">
                      "{request.calibration.remarks}"
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No linked calibration record attached.</p>
            )}
          </Card>

          {/* Client Approval Record Card */}
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
              <FileCheck className="w-5 h-5 text-indigo-600" />
              Client Approval Status & History
            </h2>

            {approval ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 block">Decision</span>
                    <Badge variant={approval.approval_status === 'APPROVED' ? 'success' : approval.approval_status === 'REJECTED' ? 'destructive' : 'warning'}>
                      {approval.approval_status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">PO / Reference #</span>
                    <span className="font-mono font-medium text-slate-900">{approval.approval_reference || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Client Representative</span>
                    <span className="font-medium text-slate-900">
                      {approval.approved_by_client_name || 'N/A'} {approval.approved_by_client_role ? `(${approval.approved_by_client_role})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Decision Date</span>
                    <span className="text-slate-800">
                      {approval.approved_at
                        ? new Date(approval.approved_at).toLocaleDateString()
                        : approval.rejected_at
                        ? new Date(approval.rejected_at).toLocaleDateString()
                        : 'Pending Decision'}
                    </span>
                  </div>
                </div>

                {approval.approval_remarks && (
                  <div className="pt-2">
                    <span className="text-xs text-slate-500 block">Approval / Rejection Remarks</span>
                    <p className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1">
                      {approval.approval_remarks}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500 flex items-center justify-between">
                <span>No approval record submitted yet.</span>
                <Button size="sm" variant="outline" onClick={() => setShowApprovalModal(true)}>
                  Record Approval Now
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar Right Column (1 Col) */}
        <div className="space-y-6">
          {/* Item Specs Card */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b pb-2">
              Item Specifications
            </h3>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-slate-500 block">Item Name</span>
                <span className="font-semibold text-slate-900">{request.request_item?.item?.item_name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Item Code</span>
                <span className="font-mono text-slate-800">{request.request_item?.item?.item_code}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Serial Number</span>
                <span className="font-mono text-slate-800 font-semibold">{request.request_item?.item?.serial_number}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Manufacturer / Model</span>
                <span className="text-slate-800">
                  {request.request_item?.item?.manufacturer || 'N/A'} - {request.request_item?.item?.model || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Measurement Range</span>
                <span className="text-slate-700 text-xs font-mono">{request.request_item?.item?.measurement_range || 'N/A'}</span>
              </div>
            </div>
          </Card>

          {/* Client Details Card */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-slate-500" />
              Client Details
            </h3>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-slate-500 block">Client Name</span>
                <span className="font-semibold text-slate-900">{request.client?.client_name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Client Code</span>
                <span className="font-mono text-slate-800">{request.client?.client_code}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Contact Person</span>
                <span className="text-slate-800">{request.client?.contact_person || 'N/A'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Contact Email</span>
                <span className="text-slate-800 text-xs">{request.client?.contact_email || 'N/A'}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Record Client Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-5 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                Record Client Approval Decision
              </h3>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {approvalError && (
              <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded font-medium">
                {approvalError}
              </div>
            )}

            <form onSubmit={handleRecordApproval} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Approval Decision *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setApprovalDecision('APPROVED')}
                    className={`p-3 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                      approvalDecision === 'APPROVED'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    APPROVE REPAIR
                  </button>

                  <button
                    type="button"
                    onClick={() => setApprovalDecision('REJECTED')}
                    className={`p-3 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                      approvalDecision === 'REJECTED'
                        ? 'border-red-600 bg-red-50 text-red-800 ring-2 ring-red-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-red-600" />
                    REJECT REPAIR
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Client Representative Name {approvalDecision === 'APPROVED' && '*'}
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Rohan Sharma"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="text-sm"
                  required={approvalDecision === 'APPROVED'}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Client Representative Role / Title
                </label>
                <Input
                  type="text"
                  placeholder="e.g. QA Manager / Plant Engineer"
                  value={clientRole}
                  onChange={(e) => setClientRole(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Approval PO / Reference #
                </label>
                <Input
                  type="text"
                  placeholder="e.g. PO-2026-9901"
                  value={approvalRef}
                  onChange={(e) => setApprovalRef(e.target.value)}
                  className="text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Remarks / Notes {approvalDecision === 'REJECTED' && '(Mandatory for Rejection *)'}
                </label>
                <textarea
                  placeholder={
                    approvalDecision === 'REJECTED'
                      ? 'State the reason for rejecting service approval...'
                      : 'Add any specific client constraints or PO notes...'
                  }
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  className="w-full rounded-md border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-20"
                  required={approvalDecision === 'REJECTED'}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <Button variant="outline" type="button" onClick={() => setShowApprovalModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={approvalSubmitting}
                  className={approvalDecision === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                >
                  {approvalSubmitting ? 'Submitting...' : approvalDecision === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
