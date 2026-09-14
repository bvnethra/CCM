import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UploadCloud,
  Check,
  AlertCircle,
  Clock,
  ShieldCheck,
  FileCheck2,
  Trash2,
  Download,
  UserCheck,
  Boxes,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { apiClient } from '../../lib/api';
import {
  CalibrationRequest,
  RequestItem,
  DocumentItem,
  ItemMatchStatus,
  SerialMatchStatus,
  QuantityStatus,
  ConditionStatus,
  VerificationResult,
} from '../../types';
import { UploadDocumentModal } from './UploadDocumentModal';

interface RequestVerificationPageProps {
  requestId: string;
  onBack: () => void;
}

interface ItemFormState {
  itemMatchStatus: ItemMatchStatus;
  serialMatchStatus: SerialMatchStatus;
  receivedQuantity: number;
  quantityStatus: QuantityStatus;
  conditionStatus: ConditionStatus;
  verificationResult: VerificationResult;
  discrepancyReason: string;
  remarks: string;
}

export const RequestVerificationPage: React.FC<RequestVerificationPageProps> = ({ requestId, onBack }) => {
  const { currentUser } = useAuth();
  const { activeTenant } = useTenant();
  const [loading, setLoading] = useState<boolean>(true);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [completing, setCompleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [request, setRequest] = useState<CalibrationRequest | null>(null);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [itemForms, setItemForms] = useState<Record<string, ItemFormState>>({});
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [completionRemarks, setCompletionRemarks] = useState<string>('');

  const loadData = async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getRequestVerificationDetails(requestId, activeTenant.id);
      setRequest(res.request as CalibrationRequest);
      setItems(res.items);
      setDocuments(res.documents);

      // Initialize forms for items
      const forms: Record<string, ItemFormState> = {};
      res.items.forEach((item) => {
        const v = item.verification;
        if (v) {
          forms[item.id] = {
            itemMatchStatus: v.item_match_status,
            serialMatchStatus: v.serial_match_status,
            receivedQuantity: v.received_quantity,
            quantityStatus: v.quantity_status,
            conditionStatus: v.condition_status,
            verificationResult: v.verification_result,
            discrepancyReason: v.discrepancy_reason || '',
            remarks: v.remarks || '',
          };
        } else {
          // Defaults for unverified item
          forms[item.id] = {
            itemMatchStatus: 'MATCHED',
            serialMatchStatus: item.item?.serial_number ? 'MATCHED' : 'NOT_APPLICABLE',
            receivedQuantity: item.requested_quantity || 1,
            quantityStatus: 'MATCHED',
            conditionStatus: 'GOOD',
            verificationResult: 'VERIFIED',
            discrepancyReason: '',
            remarks: '',
          };
        }
      });
      setItemForms(forms);
    } catch (err: any) {
      setError(err.message || 'Failed to load verification workspace details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [requestId, activeTenant]);

  const verifiedItemsCount = useMemo(() => {
    return items.filter((i) => i.verification !== null && i.verification !== undefined).length;
  }, [items]);

  const mandatoryDocumentsCount = useMemo(() => {
    return documents.filter((d) => d.mandatory).length;
  }, [documents]);

  const canComplete = useMemo(() => {
    return items.length > 0 && verifiedItemsCount === items.length && mandatoryDocumentsCount > 0 && request?.status !== 'VERIFIED';
  }, [items.length, verifiedItemsCount, mandatoryDocumentsCount, request?.status]);

  const handleFieldChange = (itemId: string, field: keyof ItemFormState, value: any) => {
    setItemForms((prev) => {
      const current = prev[itemId] || {};
      const updated = { ...current, [field]: value };

      // Auto derive quantity status
      if (field === 'receivedQuantity') {
        const item = items.find((i) => i.id === itemId);
        const reqQty = item?.requested_quantity || 1;
        if (value < reqQty) updated.quantityStatus = 'SHORT';
        else if (value > reqQty) updated.quantityStatus = 'EXCESS';
        else updated.quantityStatus = 'MATCHED';
      }

      // Auto derive verification result
      const isDiscrepant =
        updated.itemMatchStatus === 'NOT_MATCHED' ||
        updated.serialMatchStatus === 'NOT_MATCHED' ||
        updated.quantityStatus === 'SHORT' ||
        updated.conditionStatus === 'DAMAGED' ||
        updated.conditionStatus === 'FAULTY';

      if (isDiscrepant) {
        if (updated.quantityStatus === 'SHORT') updated.verificationResult = 'SHORT';
        else if (updated.conditionStatus === 'DAMAGED' || updated.conditionStatus === 'FAULTY') updated.verificationResult = 'DISCREPANCY';
        else updated.verificationResult = 'DISCREPANCY';
      } else {
        updated.verificationResult = 'VERIFIED';
      }

      return { ...prev, [itemId]: updated };
    });
  };

  const handleSaveItemVerification = async (itemId: string) => {
    if (!activeTenant || !currentUser) return;
    const form = itemForms[itemId];
    if (!form) return;

    // Validate discrepancy reason
    const requiresReason =
      form.verificationResult !== 'VERIFIED' ||
      form.itemMatchStatus === 'NOT_MATCHED' ||
      form.serialMatchStatus === 'NOT_MATCHED' ||
      form.quantityStatus === 'SHORT' ||
      form.conditionStatus === 'DAMAGED' ||
      form.conditionStatus === 'FAULTY';

    if (requiresReason && (!form.discrepancyReason || form.discrepancyReason.trim().length < 5)) {
      setError('A discrepancy reason with at least 5 characters is required for mismatched or damaged items.');
      return;
    }

    try {
      setSavingItem(itemId);
      setError(null);
      await apiClient.submitItemVerification({
        tenantId: activeTenant.id,
        requestId,
        requestItemId: itemId,
        verifiedBy: currentUser.id,
        itemMatchStatus: form.itemMatchStatus,
        serialMatchStatus: form.serialMatchStatus,
        receivedQuantity: Number(form.receivedQuantity),
        quantityStatus: form.quantityStatus,
        conditionStatus: form.conditionStatus,
        verificationResult: form.verificationResult,
        discrepancyReason: form.discrepancyReason.trim() || null,
        remarks: form.remarks.trim() || null,
      });

      setSuccessMsg('Item verification recorded successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit item verification.');
    } finally {
      setSavingItem(null);
    }
  };

  const handleCompleteVerification = async () => {
    if (!activeTenant || !currentUser) return;
    if (!canComplete) return;

    try {
      setCompleting(true);
      setError(null);
      await apiClient.completeRequestVerification(
        requestId,
        activeTenant.id,
        currentUser.id,
        completionRemarks.trim() || undefined
      );

      setSuccessMsg('Request verification completed successfully! Status updated to VERIFIED.');
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to complete request verification.');
    } finally {
      setCompleting(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!activeTenant || !currentUser) return;
    if (!confirm('Are you sure you want to remove this document?')) return;

    try {
      await apiClient.deleteDocument(docId, activeTenant.id, currentUser.id);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete document.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Loading item verification workspace...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Calibration Request Not Found</h3>
        <p className="text-sm text-slate-500 mt-1">The request ID could not be loaded or was deleted.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
        >
          Return to Queue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Step 8
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Item Verification Workspace — {request.request_number}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Client: <span className="font-semibold text-slate-700">{request.client?.client_name || 'N/A'}</span> • Org:{' '}
              <span className="font-semibold text-slate-700">{request.organization?.name || 'Central Lab'}</span> • Priority:{' '}
              <span
                className={`font-semibold uppercase ${
                  request.priority === 'URGENT' ? 'text-amber-600' : 'text-slate-600'
                }`}
              >
                {request.priority}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${
              request.status === 'VERIFIED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : request.status === 'VERIFICATION'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            Status: {request.status}
          </span>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-2 shadow-xs"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Proof Document</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <p className="font-semibold">Verification Alert</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
          <div>
            <p className="font-semibold">Success</p>
            <p className="text-xs mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Completion Pre-flight Banner */}
      <div
        className={`p-5 rounded-xl border transition-all ${
          request.status === 'VERIFIED'
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
            : canComplete
            ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
            : 'bg-amber-50/60 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                request.status === 'VERIFIED'
                  ? 'bg-emerald-100 text-emerald-700'
                  : canComplete
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {request.status === 'VERIFIED' ? (
                <ShieldCheck className="w-6 h-6" />
              ) : canComplete ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {request.status === 'VERIFIED'
                  ? 'Request Verification Completed'
                  : canComplete
                  ? 'Verification Ready for Sign-Off'
                  : 'Verification In Progress (Pre-Flight Gates Pending)'}
              </h3>
              <p className="text-xs mt-0.5 opacity-90">
                {request.status === 'VERIFIED'
                  ? 'All items have been verified and mandatory proof documents archived. Ready for Step 9 (Calibration Execution).'
                  : canComplete
                  ? 'All items verified and mandatory proof documents are on file. Click Complete Verification below.'
                  : `Remaining checks: ${
                      verifiedItemsCount < items.length
                        ? `${items.length - verifiedItemsCount} item(s) unverified`
                        : ''
                    }${
                      verifiedItemsCount < items.length && mandatoryDocumentsCount === 0 ? ' • ' : ''
                    }${mandatoryDocumentsCount === 0 ? 'At least 1 mandatory proof document required' : ''}`}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      verifiedItemsCount === items.length ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  Items: {verifiedItemsCount} / {items.length} Verified
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      mandatoryDocumentsCount > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  Mandatory Proof: {mandatoryDocumentsCount} On File
                </span>
              </div>
            </div>
          </div>

          {request.status !== 'VERIFIED' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder="Optional sign-off notes..."
                value={completionRemarks}
                onChange={(e) => setCompletionRemarks(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleCompleteVerification}
                disabled={!canComplete || completing}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 ${
                  canComplete
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                }`}
              >
                {completing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Completing...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Complete Verification</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Item-by-Item Verification Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-indigo-600" />
            <span>Equipment Verification Checklist ({items.length} Items)</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Strict item-level inspection against pickup condition & specs
          </span>
        </div>

        {items.map((reqItem, idx) => {
          const form = itemForms[reqItem.id] || {
            itemMatchStatus: 'MATCHED',
            serialMatchStatus: 'MATCHED',
            receivedQuantity: reqItem.requested_quantity || 1,
            quantityStatus: 'MATCHED',
            conditionStatus: 'GOOD',
            verificationResult: 'VERIFIED',
            discrepancyReason: '',
            remarks: '',
          };
          const v = reqItem.verification;
          const isVerified = Boolean(v);
          const isSaving = savingItem === reqItem.id;

          const requiresReason =
            form.verificationResult !== 'VERIFIED' ||
            form.itemMatchStatus === 'NOT_MATCHED' ||
            form.serialMatchStatus === 'NOT_MATCHED' ||
            form.quantityStatus === 'SHORT' ||
            form.conditionStatus === 'DAMAGED' ||
            form.conditionStatus === 'FAULTY';

          return (
            <div
              key={reqItem.id}
              className={`bg-white rounded-xl border transition-all overflow-hidden ${
                isVerified ? 'border-slate-200 shadow-xs' : 'border-indigo-200 shadow-sm ring-1 ring-indigo-500/10'
              }`}
            >
              {/* Item Header */}
              <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {reqItem.item?.item_name || 'Standard Test Instrument'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span>Model: <strong className="text-slate-700">{reqItem.item?.model || 'N/A'}</strong></span>
                      <span>•</span>
                      <span>Expected Serial #: <strong className="text-slate-700">{reqItem.item?.serial_number || 'Unspecified'}</strong></span>
                      <span>•</span>
                      <span>Requested Qty: <strong className="text-slate-700">{reqItem.requested_quantity}</strong></span>
                      <span>•</span>
                      <span>Agent Availability: <strong className="text-slate-700">{reqItem.item_available}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isVerified ? (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                        v?.verification_result === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : v?.verification_result === 'SHORT'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{v?.verification_result}</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>PENDING INSPECTION</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Item Verification Inspection Form */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. Item Match Status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Item Identity Match <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.itemMatchStatus}
                      onChange={(e) => handleFieldChange(reqItem.id, 'itemMatchStatus', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    >
                      <option value="MATCHED">MATCHED (Identity Confirmed)</option>
                      <option value="NOT_MATCHED">NOT_MATCHED (Wrong Model/Item)</option>
                    </select>
                  </div>

                  {/* 2. Serial Match Status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Serial Number Match <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.serialMatchStatus}
                      onChange={(e) => handleFieldChange(reqItem.id, 'serialMatchStatus', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    >
                      <option value="MATCHED">MATCHED (Plate / Barcode Valid)</option>
                      <option value="NOT_MATCHED">NOT_MATCHED (Mismatch)</option>
                      <option value="NOT_APPLICABLE">NOT_APPLICABLE (No Serial)</option>
                    </select>
                  </div>

                  {/* 3. Received Quantity */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Received Quantity <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={form.receivedQuantity}
                        onChange={(e) => handleFieldChange(reqItem.id, 'receivedQuantity', Number(e.target.value))}
                        className="w-24 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                      />
                      <span
                        className={`text-xs px-2 py-1 rounded font-semibold border ${
                          form.quantityStatus === 'MATCHED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : form.quantityStatus === 'SHORT'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {form.quantityStatus}
                      </span>
                    </div>
                  </div>

                  {/* 4. Physical Condition */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Physical Condition <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.conditionStatus}
                      onChange={(e) => handleFieldChange(reqItem.id, 'conditionStatus', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    >
                      <option value="GOOD">GOOD (No Visible Defects)</option>
                      <option value="DAMAGED">DAMAGED (Cracked/Dented)</option>
                      <option value="FAULTY">FAULTY (Missing Parts / Inoperable)</option>
                      <option value="OTHER">OTHER (See Notes)</option>
                    </select>
                  </div>
                </div>

                {/* Discrepancy Reason Field (Shown or Mandatory if not matched/damaged) */}
                {requiresReason && (
                  <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-lg space-y-1 animate-in fade-in duration-150">
                    <label className="block text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Discrepancy Justification Required *</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Specify root cause of mismatch, damage details, or short count..."
                      value={form.discrepancyReason}
                      onChange={(e) => handleFieldChange(reqItem.id, 'discrepancyReason', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 bg-white placeholder-slate-400"
                    />
                  </div>
                )}

                {/* Remarks & Submit Button */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2 border-t border-slate-100">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Verification Remarks / Optical Observations (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Clean connectors, calibration seal intact..."
                      value={form.remarks}
                      onChange={(e) => handleFieldChange(reqItem.id, 'remarks', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSaveItemVerification(reqItem.id)}
                      disabled={isSaving}
                      className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{isVerified ? 'Update Verification' : 'Verify Item'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Verifier Badge if already verified */}
                {isVerified && v?.verified_by_user && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>
                      Verified by <strong className="text-slate-600">{v.verified_by_user.full_name}</strong> on{' '}
                      {new Date(v.verified_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Proof Documents & Mandatory Compliance Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-indigo-600" />
              <span>Mandatory Proof & Documents ({documents.length} Files)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure private R2 storage with signed URL access and version control
            </p>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload New Document</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-2">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">No Proof Documents Uploaded Yet</p>
            <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">
              At least 1 mandatory proof document (such as Collection Voucher or Verification Photo) must be attached before this request can be verified.
            </p>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              Upload Proof Now
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">{doc.file_name}</p>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full border border-slate-200">
                        v{doc.version}
                      </span>
                      {doc.mandatory && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200">
                          Mandatory Proof
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span>Type: <strong className="text-slate-600">{doc.document_type}</strong></span>
                      <span>•</span>
                      <span>Size: <strong className="text-slate-600">{(doc.file_size / 1024).toFixed(1)} KB</strong></span>
                      <span>•</span>
                      <span>Uploaded by: <strong className="text-slate-600">{doc.uploaded_by_user?.full_name || 'System'}</strong></span>
                      <span>•</span>
                      <span>{new Date(doc.uploaded_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://storage.ccm.internal/download/${encodeURIComponent(doc.storage_reference)}?sig=mock-presigned-token`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        requestId={requestId}
        items={items}
        onDocumentUploaded={loadData}
      />
    </div>
  );
};
