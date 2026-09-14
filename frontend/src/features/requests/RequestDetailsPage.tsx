import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Building,
  User,
  Calendar,
  ArrowLeft,
  RefreshCw,
  Package,
  FileCheck,
  Truck,
  PauseCircle,
  PlayCircle,
  XCircle,
  AlertOctagon,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import apiClient, { api } from '../../lib/api';
import { CalibrationRequest, RequestTimelineEvent, ItemProgressRow } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export interface RequestDetailsPageProps {
  requestId: string;
  onBack: () => void;
  onNavigate: (route: string) => void;
}

export const RequestDetailsPage: React.FC<RequestDetailsPageProps> = ({
  requestId,
  onBack,
  onNavigate,
}) => {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id || 'all';

  const [request, setRequest] = useState<CalibrationRequest | null>(null);
  const [timeline, setTimeline] = useState<RequestTimelineEvent[]>([]);
  const [matrix, setMatrix] = useState<ItemProgressRow[]>([]);
  const [commercialSummary, setCommercialSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  // Modals for Step 19 Actions
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqData, timeData, matrixData, commRes] = await Promise.all([
        api.getCalibrationRequest(requestId, tenantId),
        api.getRequestTimeline(requestId, tenantId),
        api.getRequestProgressMatrix(requestId, tenantId),
        apiClient.getCommercialSummary(requestId, tenantId),
      ]);
      setRequest(reqData);
      setTimeline(timeData);
      setMatrix(matrixData);
      if (commRes?.success) setCommercialSummary(commRes.data);
    } catch (err) {
      console.error('Failed loading request details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [requestId, tenantId]);

  const handleEvaluateCompletion = async () => {
    setEvaluating(true);
    try {
      const res = await api.evaluateRequestCompletion(requestId, tenantId);
      await loadData();
      alert(`Completion Evaluation Done!\nNew Status: ${res.newStatus}\nFully Completed: ${res.isFullyCompleted}`);
    } catch (err: any) {
      alert(`Error evaluating completion: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const handleHoldRequest = async () => {
    if (!holdReason.trim()) {
      alert('Please enter a mandatory hold reason.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.holdRequest(requestId, tenantId, holdReason);
      if (res.success) {
        setShowHoldModal(false);
        setHoldReason('');
        await loadData();
      } else {
        alert(res.error || 'Failed to place request on hold');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeRequest = async () => {
    if (!confirm('Are you sure you want to resume this request from hold?')) return;
    setActionLoading(true);
    try {
      const res = await apiClient.resumeRequest(requestId, tenantId, 'Resumed by user action');
      if (res.success) {
        await loadData();
      } else {
        alert(res.error || 'Failed to resume request');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelReason.trim()) {
      alert('Please enter a mandatory cancellation reason.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.cancelRequest(requestId, tenantId, cancelReason);
      if (res.success) {
        setShowCancelModal(false);
        setCancelReason('');
        await loadData();
      } else {
        alert(res.error || 'Failed to cancel request');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow Stages Definition for Tracker
  const stages = [
    { label: 'Collection', key: 'COLLECTED' },
    { label: 'Lab Queue', key: 'LAB_QUEUE' },
    { label: 'Verification', key: 'VERIFICATION' },
    { label: 'Calibration', key: 'CALIBRATION' },
    { label: 'Commercial', key: 'QUOTATION' },
    { label: 'Client Sign', key: 'CLIENT_SIGN' },
    { label: 'Dispatch', key: 'DISPATCHED' },
    { label: 'Delivery', key: 'DELIVERY_SIGNED' },
    { label: 'Completion', key: 'COMPLETED' },
  ];

  const getStageIndex = (status: string) => {
    const map: Record<string, number> = {
      CREATED: 0,
      COLLECTED: 0,
      LAB_QUEUE: 1,
      VERIFICATION: 2,
      VERIFIED: 2,
      CALIBRATION: 3,
      CALIBRATED: 3,
      QUOTATION: 4,
      APPROVAL: 4,
      INVOICE: 4,
      CLIENT_SIGN: 5,
      READY_TO_DISPATCH: 6,
      DISPATCHED: 6,
      CLIENT_RECEIVED: 7,
      DELIVERY_SIGNED: 7,
      PARTIALLY_COMPLETED: 8,
      COMPLETED: 8,
    };
    return map[status] !== undefined ? map[status] : 0;
  };

  if (loading || !request) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Loading request timeline & progress matrix...</span>
        </div>
      </div>
    );
  }

  const currentStageIdx = getStageIndex(request.status);
  const isHold = request.status === 'ON_HOLD';
  const isCancelled = request.status === 'CANCELLED';

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Requests
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Request {request.request_number}
            </h1>
            <Badge
              variant={
                request.status === 'COMPLETED'
                  ? 'success'
                  : isCancelled
                  ? 'destructive'
                  : isHold
                  ? 'warning'
                  : 'info'
              }
            >
              {request.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Registered on {new Date(request.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isHold ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResumeRequest}
              disabled={actionLoading}
              className="border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
            >
              <PlayCircle className="w-4 h-4 mr-1" /> Resume Request
            </Button>
          ) : !isCancelled && request.status !== 'COMPLETED' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHoldModal(true)}
              disabled={actionLoading}
              className="border-slate-300 text-slate-700"
            >
              <PauseCircle className="w-4 h-4 mr-1 text-amber-600" /> Hold Request
            </Button>
          ) : null}

          {!isCancelled && request.status !== 'COMPLETED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              disabled={actionLoading}
              className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
            >
              <XCircle className="w-4 h-4 mr-1 text-red-600" /> Cancel Request
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleEvaluateCompletion}
            disabled={evaluating}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${evaluating ? 'animate-spin' : ''}`} />
            Evaluate Completion
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('dispatches')}
          >
            <Truck className="w-3.5 h-3.5 mr-1.5" /> Dispatches
          </Button>
        </div>
      </div>

      {/* STEP 19 WORKFLOW TRACKER VISUALIZATION */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Workflow Progress Tracker</h3>
          {isHold && <span className="text-xs font-semibold text-amber-600 flex items-center gap-1"><AlertOctagon className="w-3.5 h-3.5" /> Request ON HOLD</span>}
          {isCancelled && <span className="text-xs font-semibold text-red-600 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Request CANCELLED</span>}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
          {stages.map((stg, idx) => {
            const isPassed = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx && !isCancelled;
            return (
              <div
                key={stg.key}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  isCancelled
                    ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                    : isCurrent
                    ? isHold
                      ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-200 font-bold'
                      : 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-200 font-bold'
                    : isPassed
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="text-[10px] font-mono mb-1 text-slate-400">0{idx + 1}</div>
                <div className="text-xs font-semibold truncate">{stg.label}</div>
                <div className="mt-1 text-[10px]">
                  {isPassed ? '✓ Done' : isCurrent ? (isHold ? 'Paused' : 'Active') : 'Pending'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Meta Info Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Client</p>
            <p className="text-xs font-semibold text-slate-900">{request.client?.client_name || 'N/A'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Collection Agent</p>
            <p className="text-xs font-semibold text-slate-900">{request.collection_agent?.full_name || 'Assigned'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Collection Date</p>
            <p className="text-xs font-semibold text-slate-900">{request.collection_date}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Items</p>
            <p className="text-xs font-semibold text-slate-900">{request.items?.length || 0} Instruments</p>
          </div>
        </div>
      </div>

      {/* STEP 20 COMMERCIAL SUMMARY BREAKDOWN */}
      {commercialSummary && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Request Commercial Financial Summary
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Server Calculated</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Calibration</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">₹{(commercialSummary.calibration_charges || 0).toFixed(2)}</p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Approved Service</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">₹{(commercialSummary.service_charges || 0).toFixed(2)}</p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Outsourcing Client</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">₹{(commercialSummary.outsourcing_client_charges || 0).toFixed(2)}</p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Tax ({commercialSummary.tax_rate || 18}%)</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">₹{(commercialSummary.tax_amount || 0).toFixed(2)}</p>
            </div>

            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-[10px] uppercase font-bold text-blue-700">Grand Total</p>
              <p className="font-mono font-extrabold text-blue-900 text-sm mt-0.5">₹{(commercialSummary.grand_total || 0).toFixed(2)}</p>
            </div>

            {/* Vendor Internal Cost: strictly protected by vendor.cost.view permission */}
            {commercialSummary.internal_vendor_cost !== undefined && (
              <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                <p className="text-[10px] uppercase font-bold text-purple-700">Internal Vendor Cost</p>
                <p className="font-mono font-extrabold text-purple-900 text-sm mt-0.5">₹{(commercialSummary.internal_vendor_cost || 0).toFixed(2)}</p>
                <p className="text-[9px] text-purple-600 mt-0.5">Margin: ₹{(commercialSummary.internal_margin || 0).toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Item Progress Matrix & Chronological Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Item-Level Progress Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" />
              Item Progress Matrix
            </h2>
            <span className="text-xs text-slate-500">Stage by Stage Traceability</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Item Details</th>
                    <th className="px-3 py-3">Available</th>
                    <th className="px-3 py-3">Verified</th>
                    <th className="px-3 py-3">Calibration</th>
                    <th className="px-3 py-3">Certificate</th>
                    <th className="px-3 py-3">Dispatched</th>
                    <th className="px-3 py-3">Delivery</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {matrix.map((row) => (
                    <tr key={row.item_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{row.item_code}</div>
                        <div className="text-[11px] text-slate-500">{row.item_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">SN: {row.serial_number}</div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-emerald-600">{row.availability}</td>
                      <td className="px-3 py-3 text-slate-700">{row.verification}</td>
                      <td className="px-3 py-3">
                        <span className={row.calibration.includes('PASS') ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
                          {row.calibration}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700 font-mono text-[11px]">{row.certificate}</td>
                      <td className="px-3 py-3 text-slate-700">{row.dispatch}</td>
                      <td className="px-3 py-3 text-slate-700">{row.delivery}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge
                          variant={row.final_status === 'Completed' ? 'success' : 'info'}
                          size="sm"
                        >
                          {row.final_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Chronological Request Timeline */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Workflow Timeline
          </h2>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-6">
            {timeline.map((evt, idx) => (
              <div key={idx} className="relative flex gap-3 pb-2 last:pb-0">
                {idx !== timeline.length - 1 && (
                  <span
                    className="absolute left-2.5 top-6 -bottom-4 w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex h-5 w-5 flex-none items-center justify-center rounded-full bg-blue-50 border border-blue-500 text-blue-600 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-auto">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-900">{evt.title}</p>
                    <time className="text-[10px] text-slate-400 font-mono">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">{evt.description}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">By: {evt.user_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* HOLD REQUEST MODAL */}
      {showHoldModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Place Request on Hold</h3>
            <p className="text-xs text-slate-600">Provide a mandatory reason for placing this calibration request on hold.</p>
            <textarea
              className="w-full border rounded-md p-2 text-xs h-24 focus:ring-1 focus:ring-blue-500"
              placeholder="E.g., Client clarification required regarding measurement range..."
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowHoldModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleHoldRequest} disabled={actionLoading}>
                Confirm Hold
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL REQUEST MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-red-900">Cancel Calibration Request</h3>
            <p className="text-xs text-slate-600">This action will cancel the request. Mandatory cancellation reason required.</p>
            <textarea
              className="w-full border rounded-md p-2 text-xs h-24 focus:ring-1 focus:ring-red-500"
              placeholder="E.g., Client cancelled purchase order..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCancelModal(false)}>Back</Button>
              <Button variant="destructive" size="sm" onClick={handleCancelRequest} disabled={actionLoading}>
                Cancel Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
