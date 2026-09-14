import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Quotation, QuotationStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import {
  ArrowLeft,
  FileText,
  Printer,
  Building2,
  CheckCircle2,
  Send,
  RotateCcw,
  IndianRupee,
  ShieldCheck,
  UserCheck,
  FilePlus,
} from 'lucide-react';

interface QuotationDetailsPageProps {
  quotationId: string;
  onBack?: () => void;
  onRevisionSuccess?: (newQuotationId: string) => void;
}

export const QuotationDetailsPage: React.FC<QuotationDetailsPageProps> = ({
  quotationId,
  onBack,
  onRevisionSuccess,
}) => {
  const { activeTenant } = useTenant();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitRemarks, setSubmitRemarks] = useState('');

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [approvalRemarks, setApprovalRemarks] = useState('');

  const [showClientResponseModal, setShowClientResponseModal] = useState(false);
  const [clientResponse, setClientResponse] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [clientRemarks, setClientRemarks] = useState('');

  // Create Request from Standalone Quotation state
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false);
  const [selectedItemsForRequest, setSelectedItemsForRequest] = useState<Record<string, number>>({});

  const fetchQuotation = async () => {
    if (!activeTenant || !quotationId) return;
    setLoading(true);
    try {
      const data = await api.getQuotationDetails(quotationId, activeTenant.id);
      setQuotation(data);

      // Initialize items for request conversion
      if (data.items) {
        const initialMap: Record<string, number> = {};
        data.items.forEach((item) => {
          const avail = item.quantity - (item.consumed_quantity || 0);
          if (avail > 0) initialMap[item.id] = avail;
        });
        setSelectedItemsForRequest(initialMap);
      }
    } catch (err) {
      console.error('Failed to load quotation details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotation();
  }, [activeTenant, quotationId]);

  const handleSubmitForApproval = async () => {
    if (!activeTenant || !quotation) return;
    setActionLoading(true);
    try {
      await api.submitQuotationForApproval(activeTenant.id, quotation.id, { remarks: submitRemarks });
      setShowSubmitModal(false);
      await fetchQuotation();
    } catch (err: any) {
      alert(err.message || 'Failed to submit quotation for approval');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInternalApproval = async () => {
    if (!activeTenant || !quotation) return;
    if (approvalAction === 'REJECT' && (!approvalRemarks || !approvalRemarks.trim())) {
      alert('Mandatory rejection remarks are required when rejecting a quotation');
      return;
    }

    setActionLoading(true);
    try {
      await api.approveInternalQuotation(activeTenant.id, quotation.id, {
        action: approvalAction,
        remarks: approvalRemarks,
      });
      setShowApprovalModal(false);
      await fetchQuotation();
    } catch (err: any) {
      alert(err.message || 'Failed to process internal approval');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendToClient = async () => {
    if (!activeTenant || !quotation) return;
    setActionLoading(true);
    try {
      await api.sendQuotationToClient(activeTenant.id, quotation.id);
      await fetchQuotation();
    } catch (err: any) {
      alert(err.message || 'Failed to send quotation to client');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordClientResponse = async () => {
    if (!activeTenant || !quotation) return;
    setActionLoading(true);
    try {
      await api.recordClientQuotationResponse(activeTenant.id, quotation.id, {
        response: clientResponse,
        remarks: clientRemarks,
      });
      setShowClientResponseModal(false);
      await fetchQuotation();
    } catch (err: any) {
      alert(err.message || 'Failed to record client response');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRevision = async () => {
    if (!activeTenant || !quotation) return;
    if (!confirm(`Create Revision v${quotation.version_number + 1} for Quotation ${quotation.quotation_number}?`)) return;

    setActionLoading(true);
    try {
      const revised = await api.createQuotationRevision(activeTenant.id, quotation.id);
      alert(`Quotation Revision ${revised.quotation_number} v${revised.version_number} created successfully as DRAFT!`);
      if (onRevisionSuccess) onRevisionSuccess(revised.id);
      else await fetchQuotation();
    } catch (err: any) {
      alert(err.message || 'Failed to create revision');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRequestFromQuotationSubmit = async () => {
    if (!activeTenant || !quotation) return;
    const itemsToConvert = Object.entries(selectedItemsForRequest)
      .filter(([_, qty]) => qty > 0)
      .map(([quotation_item_id, quantity]) => ({ quotation_item_id, quantity }));

    if (itemsToConvert.length === 0) {
      alert('Please select at least one item and quantity to convert into a Calibration Request.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.createRequestFromQuotation(activeTenant.id, quotation.id, itemsToConvert);
      alert(`Calibration Request ${res.requestNumber} successfully created from Quotation ${quotation.quotation_number}!`);
      setShowCreateRequestModal(false);
      await fetchQuotation();
    } catch (err: any) {
      alert(err.message || 'Failed to create request from quotation');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const renderStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="warning">Draft</Badge>;
      case 'PENDING_APPROVAL':
        return <Badge variant="warning">Pending Internal Approval</Badge>;
      case 'APPROVED':
        return <Badge variant="info">Approved Internally</Badge>;
      case 'SENT_TO_CLIENT':
        return <Badge variant="purple">Sent to Client</Badge>;
      case 'CLIENT_APPROVED':
        return <Badge variant="success">Client Approved</Badge>;
      case 'CLIENT_REJECTED':
        return <Badge variant="destructive">Client Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading quotation details...</div>;
  }

  if (!quotation) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Quotation record not found.
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="mt-4">
            Go Back
          </Button>
        )}
      </div>
    );
  }

  const isStandalone = quotation.quotation_type === 'STANDALONE' || !quotation.request_id;
  const canCreateRequest = isStandalone && (quotation.status === 'APPROVED' || quotation.status === 'SENT_TO_CLIENT' || quotation.status === 'CLIENT_APPROVED');

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="text-slate-600 border-slate-300">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                {quotation.quotation_number}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-xs font-semibold">
                Version {quotation.version_number}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${isStandalone ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                {isStandalone ? 'STANDALONE QUOTATION' : 'REQUEST-BASED QUOTATION'}
              </span>
              {renderStatusBadge(quotation.status)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {new Date(quotation.created_at).toLocaleDateString()} | Valid until {new Date(quotation.valid_until).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {canCreateRequest && (
            <Button
              onClick={() => setShowCreateRequestModal(true)}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs inline-flex items-center gap-1.5"
            >
              <FilePlus className="w-3.5 h-3.5" />
              Create Request from Quotation
            </Button>
          )}

          {quotation.status === 'DRAFT' && (
            <Button
              onClick={() => setShowSubmitModal(true)}
              disabled={actionLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Submit for Approval
            </Button>
          )}

          {quotation.status === 'PENDING_APPROVAL' && (
            <Button
              onClick={() => {
                setApprovalAction('APPROVE');
                setShowApprovalModal(true);
              }}
              disabled={actionLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs inline-flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Lab Approval Action
            </Button>
          )}

          {quotation.status === 'APPROVED' && (
            <Button
              onClick={handleSendToClient}
              disabled={actionLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Send Quotation to Client
            </Button>
          )}

          {quotation.status === 'SENT_TO_CLIENT' && (
            <Button
              onClick={() => setShowClientResponseModal(true)}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Record Client Response
            </Button>
          )}

          {(quotation.status === 'APPROVED' || quotation.status === 'SENT_TO_CLIENT' || quotation.status === 'CLIENT_REJECTED') && (
            <Button
              onClick={handleCreateRevision}
              disabled={actionLoading}
              variant="outline"
              size="sm"
              className="text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Create Revision (v{quotation.version_number + 1})
            </Button>
          )}

          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-1.5 text-xs text-slate-700 border-slate-300"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF Layout
          </Button>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Client & Request Info */}
        <Card className="p-5 space-y-4 lg:col-span-1 border-slate-200">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Client Details
            </h2>
            <div className="text-sm font-bold text-slate-900">{quotation.client?.client_name}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">Code: {quotation.client?.client_code}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">GST: {quotation.client?.gst_number || 'N/A'}</div>
            <div className="text-xs text-slate-600 mt-2 line-clamp-2">{quotation.client?.billing_address}</div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              Calibration Request Reference
            </h2>
            {isStandalone ? (
              <div className="text-xs text-purple-700 bg-purple-50 p-2.5 rounded-lg border border-purple-200 font-semibold">
                Standalone Quotation (No Direct Request Reference)
              </div>
            ) : (
              <div>
                <div className="text-sm font-semibold text-slate-800 font-mono">{quotation.request?.request_number}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Priority: <span className="font-semibold">{quotation.request?.priority}</span>
                </div>
              </div>
            )}
          </div>

          {quotation.client_response !== 'PENDING' && (
            <div className="border-t border-slate-200 pt-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Client Response Record
              </h2>
              <Badge variant={quotation.client_response === 'APPROVED' ? 'success' : 'destructive'}>
                CLIENT {quotation.client_response}
              </Badge>
              {quotation.client_response_at && (
                <div className="text-[11px] text-slate-500 mt-1">
                  Recorded: {new Date(quotation.client_response_at).toLocaleString()}
                </div>
              )}
              {quotation.client_response_remarks && (
                <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border mt-2 italic">
                  "{quotation.client_response_remarks}"
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Right Column: Line Items & Totals */}
        <Card className="p-5 space-y-5 lg:col-span-2 border-slate-200">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b pb-2 flex items-center gap-1.5">
            <IndianRupee className="w-4 h-4 text-indigo-600" />
            Quotation Line Items ({quotation.items?.length || 0})
          </h2>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Item & Description</th>
                  <th className="p-3 text-right">Qty</th>
                  {isStandalone && <th className="p-3 text-right">Converted Qty</th>}
                  <th className="p-3 text-right">Unit Cost (₹)</th>
                  <th className="p-3 text-right">Line Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(quotation.items || []).map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{item.item?.item_name || item.description}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {item.item?.item_code} | Type: {item.item?.item_type || 'N/A'}
                      </div>
                      {item.override_cost && (
                        <div className="text-[10px] text-amber-700 font-mono mt-0.5">
                          Overridden from ₹{item.standard_cost.toFixed(2)} ({item.override_reason})
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold">{item.quantity}</td>
                    {isStandalone && (
                      <td className="p-3 text-right font-mono text-emerald-700 font-semibold">
                        {item.consumed_quantity || 0} / {item.quantity}
                      </td>
                    )}
                    <td className="p-3 text-right font-mono">₹{item.final_unit_cost.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-semibold text-slate-900">
                      ₹{item.line_total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 max-w-md ml-auto">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-900 font-medium">₹{quotation.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>GST Tax (18%):</span>
              <span className="font-mono text-slate-900 font-medium">+ ₹{quotation.tax_amount.toFixed(2)}</span>
            </div>
            {quotation.discount_amount > 0 && (
              <div className="flex justify-between text-xs text-slate-600">
                <span>Discount:</span>
                <span className="font-mono text-rose-600 font-medium">- ₹{quotation.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-slate-300 pt-2 flex justify-between text-sm font-bold text-slate-900">
              <span>Total Amount (₹):</span>
              <span className="font-mono text-indigo-700 text-base">₹{quotation.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Internal Approval History */}
      {quotation.approvals && quotation.approvals.length > 0 && (
        <Card className="p-5 space-y-4 border-slate-200">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b pb-2 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Internal Lab Approval History Log
          </h2>

          <div className="space-y-3">
            {quotation.approvals.map((app) => (
              <div key={app.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={app.approval_status === 'APPROVED' ? 'success' : app.approval_status === 'REJECTED' ? 'destructive' : 'warning'}>
                      {app.approval_status}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-800">
                      Requested by {app.requested_by_user?.full_name || 'Lab Tech'}
                    </span>
                  </div>
                  {app.approval_remarks && (
                    <div className="text-xs text-slate-600 mt-1 italic">"{app.approval_remarks}"</div>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {app.approved_at ? `Actioned: ${new Date(app.approved_at).toLocaleString()}` : `Requested: ${new Date(app.requested_at).toLocaleString()}`}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* MODAL 1: Submit for Approval */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Quotation for Lab Approver Gate"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Submit Quotation <span className="font-mono font-semibold">{quotation.quotation_number}</span> to authorized Lab Approver for mandatory approval gate before client delivery.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks (Optional)</label>
            <textarea
              rows={3}
              value={submitRemarks}
              onChange={(e) => setSubmitRemarks(e.target.value)}
              placeholder="Enter remarks for Lab Approver..."
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowSubmitModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmitForApproval} disabled={actionLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Submit Now
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: Internal Approval Action */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title="Lab Approver Gate Decision"
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="radio"
                name="approvalAction"
                value="APPROVE"
                checked={approvalAction === 'APPROVE'}
                onChange={() => setApprovalAction('APPROVE')}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              Approve Quotation
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-rose-700 cursor-pointer">
              <input
                type="radio"
                name="approvalAction"
                value="REJECT"
                checked={approvalAction === 'REJECT'}
                onChange={() => setApprovalAction('REJECT')}
                className="text-rose-600 focus:ring-rose-500"
              />
              Reject & Return to Draft
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Approval Remarks {approvalAction === 'REJECT' && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              rows={3}
              value={approvalRemarks}
              onChange={(e) => setApprovalRemarks(e.target.value)}
              placeholder={approvalAction === 'REJECT' ? 'Mandatory rejection reason...' : 'Optional approval notes...'}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowApprovalModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleInternalApproval}
              disabled={actionLoading}
              className={approvalAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
            >
              Submit {approvalAction}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Record Client Response */}
      <Modal
        isOpen={showClientResponseModal}
        onClose={() => setShowClientResponseModal(false)}
        title="Record Client Quotation Decision"
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-emerald-800 cursor-pointer">
              <input
                type="radio"
                name="clientResponse"
                value="APPROVED"
                checked={clientResponse === 'APPROVED'}
                onChange={() => setClientResponse('APPROVED')}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              Client Approved
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-rose-700 cursor-pointer">
              <input
                type="radio"
                name="clientResponse"
                value="REJECTED"
                checked={clientResponse === 'REJECTED'}
                onChange={() => setClientResponse('REJECTED')}
                className="text-rose-600 focus:ring-rose-500"
              />
              Client Rejected
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Response Remarks / Ref #</label>
            <textarea
              rows={3}
              value={clientRemarks}
              onChange={(e) => setClientRemarks(e.target.value)}
              placeholder="Enter client PO reference or feedback remarks..."
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowClientResponseModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRecordClientResponse}
              disabled={actionLoading}
              className={clientResponse === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
            >
              Record Decision
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: Create Request from Standalone Quotation */}
      <Modal
        isOpen={showCreateRequestModal}
        onClose={() => setShowCreateRequestModal(false)}
        title="Create Calibration Request from Standalone Quotation"
        description="Select eligible quotation lines and quantities to convert into a new Calibration Request."
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-purple-900">
            <span className="font-semibold">Partial Usage Supported:</span> Unconverted quotation items will remain available for future requests.
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {(quotation.items || []).map((item) => {
              const maxAvail = item.quantity - (item.consumed_quantity || 0);
              const currentQty = selectedItemsForRequest[item.id] || 0;

              return (
                <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">{item.item?.item_name || item.description}</div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      {item.item?.item_code} | Total Qty: {item.quantity} | Already Consumed: {item.consumed_quantity || 0}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-slate-600 font-semibold">Qty to Request:</label>
                    <Input
                      type="number"
                      min="0"
                      max={maxAvail}
                      disabled={maxAvail <= 0}
                      value={currentQty}
                      onChange={(e) =>
                        setSelectedItemsForRequest((prev) => ({
                          ...prev,
                          [item.id]: Math.min(maxAvail, Math.max(0, parseInt(e.target.value) || 0)),
                        }))
                      }
                      className="w-20 text-center font-mono text-xs py-1"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreateRequestModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateRequestFromQuotationSubmit}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {actionLoading ? 'Creating Request...' : 'Create Calibration Request'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
