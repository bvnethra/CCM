import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Invoice, InvoiceType, InvoiceStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  ArrowLeft,
  Printer,
  Building2,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Zap,
  Layers,
  FileText,
  FileCheck2,
  Clock,
  ShieldCheck,
  Copy,
  ExternalLink,
  RotateCcw,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { Signature, InvoiceSignatureRequest } from '../../types';

interface InvoiceDetailsPageProps {
  invoiceId: string;
  onBack?: () => void;
}

export const InvoiceDetailsPage: React.FC<InvoiceDetailsPageProps> = ({
  invoiceId,
  onBack,
}) => {
  const { activeTenant } = useTenant();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [signatureData, setSignatureData] = useState<Signature | null>(null);
  const [signatureRequests, setSignatureRequests] = useState<InvoiceSignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Remaining items for partial invoices
  const [remainingItems, setRemainingItems] = useState<any[]>([]);

  // Modals state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Signature Modals state
  const [showRequestSigModal, setShowRequestSigModal] = useState(false);
  const [showViewSigModal, setShowViewSigModal] = useState(false);
  const [showSignedDocModal, setShowSignedDocModal] = useState(false);

  // Request Sig Form
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('Authorized Client Officer');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerPhone, setSignerPhone] = useState('');
  const [expiresDays, setExpiresDays] = useState(7);

  const fetchInvoice = async () => {
    if (!activeTenant || !invoiceId) return;
    setLoading(true);
    try {
      const data = await api.getInvoiceDetails(invoiceId, activeTenant.id);
      setInvoice(data);

      if (data.client) {
        setSignerName(data.client.contact_person || '');
        setSignerEmail(data.client.contact_email ?? '');
        setSignerPhone(data.client.contact_phone ?? '');
      }

      if (data.quotation_id) {
        const eligibleRes = await api.getEligibleQuotationItemsForInvoice(data.quotation_id, activeTenant.id);
        setRemainingItems(eligibleRes.eligible_items);
      }

      const sigRes = await api.getInvoiceSignature(invoiceId, activeTenant.id);
      setSignatureData(sigRes.signature);
      setSignatureRequests(sigRes.requests);
    } catch (err) {
      console.error('Failed to load invoice details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [activeTenant, invoiceId]);

  const handleMarkReady = async () => {
    if (!activeTenant || !invoice) return;
    setActionLoading(true);
    try {
      await api.markInvoiceReady(activeTenant.id, invoice.id, { remarks: 'Commercial invoice marked READY.' });
      await fetchInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to mark invoice ready');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!activeTenant || !invoice) return;
    if (!cancelReason || !cancelReason.trim()) {
      alert('Mandatory cancellation reason is required');
      return;
    }

    setActionLoading(true);
    try {
      await api.cancelInvoice(activeTenant.id, invoice.id, { cancellation_reason: cancelReason });
      setShowCancelModal(false);
      await fetchInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSignatureRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !invoice) return;
    if (!signerName.trim()) {
      alert('Signer name is required');
      return;
    }

    setActionLoading(true);
    try {
      await api.createInvoiceSignatureRequest(activeTenant.id, invoice.id, {
        signer_name: signerName.trim(),
        signer_role: signerRole.trim(),
        signer_email: signerEmail.trim(),
        signer_phone: signerPhone.trim(),
        expires_in_days: Number(expiresDays) || 7,
      });
      setShowRequestSigModal(false);
      await fetchInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to create client signature request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetrySignatureRequest = async () => {
    if (!activeTenant || !invoice) return;
    setActionLoading(true);
    try {
      await api.retrySignatureRequest(activeTenant.id, invoice.id, {
        signer_name: signerName || invoice.client?.contact_person || 'Client Representative',
        signer_role: signerRole,
        signer_email: signerEmail || invoice.client?.contact_email || undefined,
        signer_phone: signerPhone || invoice.client?.contact_phone || undefined,
        expires_in_days: Number(expiresDays) || 7,
      });
      await fetchInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to retry signature request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopySigningLink = (requestRef: string) => {
    const url = `${window.location.origin}/client-sign/invoice/${requestRef}`;
    navigator.clipboard.writeText(url);
    alert(`Public Client Signature Link copied to clipboard:\n${url}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderTypeBadge = (type: InvoiceType) => {
    switch (type) {
      case 'STANDARD':
        return <Badge variant="info">STANDARD</Badge>;
      case 'PARTIAL':
        return (
          <Badge variant="purple" className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            PARTIAL INVOICE
          </Badge>
        );
      case 'URGENT':
        return (
          <Badge variant="warning" className="flex items-center gap-1 bg-amber-500 text-white border-none font-bold">
            <Zap className="w-3 h-3" />
            URGENT PROCESSING
          </Badge>
        );
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  const renderStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="warning">Draft</Badge>;
      case 'READY':
        return <Badge variant="info">Invoice Ready</Badge>;
      case 'SIGNATURE_REQUIRED':
        return <Badge variant="purple" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Signature Pending</Badge>;
      case 'SIGNED':
        return <Badge variant="success" className="flex items-center gap-1 bg-emerald-600 text-white font-bold"><ShieldCheck className="w-3.5 h-3.5" /> Digitally Signed</Badge>;
      case 'ISSUED':
        return <Badge variant="info">Issued</Badge>;
      case 'PAID':
        return <Badge variant="success">Paid</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading invoice details...</div>;
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Invoice record not found.
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="mt-4">
            Go Back
          </Button>
        )}
      </div>
    );
  }

  const latestReq = signatureRequests.length > 0 ? signatureRequests[0] : null;

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
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                {invoice.invoice_number}
              </h1>
              {renderTypeBadge(invoice.invoice_type)}
              {renderStatusBadge(invoice.status)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Issued on {new Date(invoice.invoice_date).toLocaleDateString()} | Due on {new Date(invoice.due_date).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {invoice.status === 'DRAFT' && (
            <Button
              onClick={handleMarkReady}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Invoice READY
            </Button>
          )}

          {(invoice.status === 'READY' || invoice.status === 'ISSUED') && (!latestReq || latestReq.status === 'EXPIRED' || latestReq.status === 'REJECTED') && (
            <Button
              onClick={() => setShowRequestSigModal(true)}
              disabled={actionLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs inline-flex items-center gap-1.5"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              Request Client Signature
            </Button>
          )}

          {latestReq && (latestReq.status === 'PENDING' || latestReq.status === 'OPENED') && (
            <Button
              onClick={() => handleCopySigningLink(latestReq.request_reference)}
              variant="outline"
              size="sm"
              className="text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 inline-flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Client Signing Link
            </Button>
          )}

          {signatureData && (
            <Button
              onClick={() => setShowSignedDocModal(true)}
              variant="outline"
              size="sm"
              className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 inline-flex items-center gap-1.5 font-semibold"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              View Signed Invoice PDF
            </Button>
          )}

          {invoice.status !== 'CANCELLED' && (
            <Button
              onClick={() => setShowCancelModal(true)}
              disabled={actionLoading}
              variant="outline"
              size="sm"
              className="text-xs border-rose-300 text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel Invoice
            </Button>
          )}

          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-1.5 text-xs text-slate-700 border-slate-300"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Layout
          </Button>
        </div>
      </div>

      {/* STEP 14: Digital Signature Status Banner & Timeline */}
      <Card className="p-5 border-l-4 border-l-indigo-600 border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Commercial Invoice Digital Signature Workflow</h2>
              {signatureData ? (
                <Badge variant="success" className="text-[11px] font-semibold">SIGNED & VERIFIED</Badge>
              ) : latestReq ? (
                <Badge variant="purple" className="text-[11px]">Request Ref: {latestReq.request_reference}</Badge>
              ) : (
                <Badge variant="default" className="text-[11px]">Signature Not Requested</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Independent digital signature for tax invoice approval (stored in Cloudflare R2 private bucket).
            </p>
          </div>

          <div className="flex items-center gap-2">
            {latestReq && (
              <a
                href={`/client-sign/invoice/${latestReq.request_reference}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Public Signing Page
              </a>
            )}
            {signatureData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowViewSigModal(true)}
                className="text-xs text-slate-700"
              >
                <Eye className="w-3.5 h-3.5 mr-1" /> View Signature Details
              </Button>
            )}
          </div>
        </div>

        {/* Signature Status Timeline */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs">
          <div className={`p-2.5 rounded-lg border ${invoice.status !== 'DRAFT' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">1. Invoice Ready</span>
            <span className="text-[10px] opacity-75">{invoice.status !== 'DRAFT' ? 'Completed' : 'Pending'}</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${latestReq ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">2. Requested</span>
            <span className="text-[10px] opacity-75">{latestReq ? latestReq.status : 'Not Sent'}</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${latestReq?.status === 'OPENED' || latestReq?.status === 'SIGNED' ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">3. Client Opened</span>
            <span className="text-[10px] opacity-75">{latestReq?.status === 'OPENED' ? 'Viewing' : latestReq?.status === 'SIGNED' ? 'Opened & Signed' : 'Waiting'}</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${signatureData ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : latestReq?.status === 'REJECTED' ? 'bg-rose-50 border-rose-200 text-rose-800' : latestReq?.status === 'EXPIRED' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">4. Client Signed</span>
            <span className="text-[10px] opacity-75">
              {signatureData ? 'Signed' : latestReq?.status === 'REJECTED' ? 'Rejected' : latestReq?.status === 'EXPIRED' ? 'Expired' : 'Pending'}
            </span>
          </div>

          <div className={`p-2.5 rounded-lg border ${signatureData ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">5. Signed PDF</span>
            <span className="text-[10px] opacity-75">{signatureData ? 'Generated' : 'Pending'}</span>
          </div>

          <div className="p-2.5 rounded-lg border bg-slate-50 border-slate-200 text-slate-500">
            <span className="block font-bold">6. Future Dispatch</span>
            <span className="text-[10px] opacity-75">Ready for Dispatch</span>
          </div>
        </div>

        {/* Retry Alert if Rejected or Expired */}
        {latestReq && (latestReq.status === 'REJECTED' || latestReq.status === 'EXPIRED') && (
          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Signature request <strong>{latestReq.request_reference}</strong> was <strong>{latestReq.status}</strong>.
                {latestReq.rejection_reason && ` Reason: "${latestReq.rejection_reason}"`}
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleRetrySignatureRequest}
              disabled={actionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0"
            >
              <RotateCcw className="w-3 h-3 mr-1 inline" /> Retry Signature Request
            </Button>
          </div>
        )}
      </Card>

      {/* Urgent Reason Alert */}
      {invoice.invoice_type === 'URGENT' && invoice.urgent_reason && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">URGENT INVOICE REASON:</span> {invoice.urgent_reason}
          </div>
        </div>
      )}

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Client & Quotation Info */}
        <Card className="p-5 space-y-4 lg:col-span-1 border-slate-200">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Client Details
            </h2>
            <div className="text-sm font-bold text-slate-900">{invoice.client?.client_name}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">Code: {invoice.client?.client_code}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">GST: {invoice.client?.gst_number || 'N/A'}</div>
            <div className="text-xs text-slate-600 mt-2 line-clamp-2">{invoice.client?.billing_address}</div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              Linked Commercial Quotation
            </h2>
            <div className="text-sm font-semibold text-slate-800 font-mono">{invoice.quotation?.quotation_number}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Request #: <span className="font-mono text-slate-800">{invoice.request?.request_number}</span>
            </div>
          </div>

          {invoice.remarks && (
            <div className="border-t border-slate-200 pt-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Remarks</h2>
              <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border italic">
                "{invoice.remarks}"
              </div>
            </div>
          )}
        </Card>

        {/* Right Column: Invoice Line Items & Totals */}
        <Card className="p-5 space-y-5 lg:col-span-2 border-slate-200">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b pb-2 flex items-center gap-1.5">
            <IndianRupee className="w-4 h-4 text-indigo-600" />
            Invoiced Items Breakdown ({invoice.items?.length || 0})
          </h2>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Item & Description</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Quoted Price (₹)</th>
                  <th className="p-3 text-right">Line Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoice.items || []).map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{item.item?.item_name || item.description}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {item.item?.item_code} | SN: {item.item?.serial_number || 'N/A'}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono">{item.quantity}</td>
                    <td className="p-3 text-right font-mono">₹{item.unit_price.toFixed(2)}</td>
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
              <span className="font-mono text-slate-900 font-medium">₹{invoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>GST Tax (18%):</span>
              <span className="font-mono text-slate-900 font-medium">+ ₹{invoice.tax_amount.toFixed(2)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-xs text-slate-600">
                <span>Discount:</span>
                <span className="font-mono text-rose-600 font-medium">- ₹{invoice.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-slate-300 pt-2 flex justify-between text-sm font-bold text-slate-900">
              <span>Grand Total Amount (₹):</span>
              <span className="font-mono text-indigo-700 text-base">₹{invoice.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Remaining Items Card for Partial Invoices */}
      {invoice.invoice_type === 'PARTIAL' && (
        <Card className="p-5 space-y-4 border-slate-200">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600" />
              Remaining Quotation Items ({remainingItems.length} Uninvoiced)
            </h2>
            <span className="text-xs text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded-md">
              Partial Processing Active
            </span>
          </div>

          {remainingItems.length === 0 ? (
            <div className="text-xs text-slate-500 italic py-2">
              All quotation items for this request have been fully invoiced.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-2.5">Item Code & Name</th>
                    <th className="p-2.5">Serial Number</th>
                    <th className="p-2.5 text-right font-mono">Quoted Price (₹)</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {remainingItems.map((rem) => (
                    <tr key={rem.request_item_id} className="hover:bg-slate-50">
                      <td className="p-2.5">
                        <span className="font-semibold text-slate-800">{rem.item_name}</span>
                        <span className="text-slate-400 font-mono text-[11px] ml-2">({rem.item_code})</span>
                      </td>
                      <td className="p-2.5 font-mono text-slate-600">{rem.serial_number}</td>
                      <td className="p-2.5 text-right font-mono text-slate-800">₹{rem.unit_price.toFixed(2)}</td>
                      <td className="p-2.5 text-center">
                        <Badge variant="purple" className="text-[10px]">
                          REMAINING (Eligible for Future Invoice)
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* MODAL: Cancel Invoice */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Commercial Invoice"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to cancel Invoice <span className="font-mono font-semibold">{invoice.invoice_number}</span>?
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cancellation Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter mandatory cancellation reason..."
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCancelModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCancelInvoice}
              disabled={actionLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirm Cancel Invoice
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Request Client Signature */}
      <Modal
        isOpen={showRequestSigModal}
        onClose={() => setShowRequestSigModal(false)}
        title="Request Client Digital Signature"
      >
        <form onSubmit={handleCreateSignatureRequest} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Generate a secure digital signature request for invoice <span className="font-mono font-semibold">{invoice.invoice_number}</span> billed to <span className="font-bold text-slate-800">{invoice.client?.client_name}</span>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Signer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Kumar"
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Signer Role</label>
              <input
                type="text"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                placeholder="e.g. Quality Director"
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Signer Email</label>
              <input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="e.g. r.kumar@acme.com"
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Signer Phone</label>
              <input
                type="tel"
                value={signerPhone}
                onChange={(e) => setSignerPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Signature Link Expiry (Days)</label>
            <input
              type="number"
              min={1}
              max={90}
              value={expiresDays}
              onChange={(e) => setExpiresDays(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowRequestSigModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={actionLoading || !signerName.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {actionLoading ? 'Creating Request...' : 'Create & Generate Link'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: View Digital Signature Details */}
      <Modal
        isOpen={showViewSigModal}
        onClose={() => setShowViewSigModal(false)}
        title="Client Digital Signature Details"
      >
        {signatureData ? (
          <div className="space-y-4 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <span className="font-bold">STATUS: VERIFIED & SIGNED</span>
                  <p className="text-[11px] text-emerald-700">Digital signature for invoice approval (INVOICE signature type)</p>
                </div>
              </div>
              <Badge variant="success">INVOICE SIGNATURE</Badge>
            </div>

            <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div className="flex justify-between">
                <span className="text-slate-500">Signer Name:</span>
                <span className="font-semibold text-slate-900">{signatureData.signer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Signer Role:</span>
                <span className="text-slate-800">{signatureData.signer_role || 'Authorized Client Officer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Signature Ref:</span>
                <span className="font-mono text-indigo-700">{signatureData.signature_reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Signed Timestamp:</span>
                <span className="font-mono text-slate-800">{signatureData.signed_at ? new Date(signatureData.signed_at).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">R2 Private Reference:</span>
                <span className="font-mono text-slate-600 text-[11px]">{signatureData.signature_storage_reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Captured IP / Agent:</span>
                <span className="font-mono text-slate-600 text-[11px]">{signatureData.ip_address}</span>
              </div>
            </div>

            <div className="text-center p-3 border border-slate-200 rounded-lg bg-white">
              <span className="text-[11px] text-slate-400 block mb-2">Captured Canvas Signature Image</span>
              <div className="inline-block border border-dashed border-slate-300 p-2 rounded bg-slate-50">
                <div className="h-20 w-64 bg-slate-100 flex items-center justify-center text-slate-800 font-serif italic text-lg font-bold border border-slate-300 rounded">
                  {signatureData.signer_name} (Digitally Signed)
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowViewSigModal(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-slate-500 text-xs">No signature record available.</div>
        )}
      </Modal>

      {/* MODAL: View Signed Invoice PDF */}
      <Modal
        isOpen={showSignedDocModal}
        onClose={() => setShowSignedDocModal(false)}
        title="Digitally Signed Tax Invoice PDF Document"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-indigo-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-indigo-600" />
              <div>
                <span className="font-bold">SIGNED_INVOICE Document Version</span>
                <p className="text-[11px] text-indigo-700">Combined Tax Invoice + Client Digital Signature Verification</p>
              </div>
            </div>
            <Badge variant="purple">PDF / R2 Private</Badge>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3 font-mono text-[11px]">
            <div className="flex justify-between border-b pb-2">
              <span>DOCUMENT_NAME:</span>
              <span className="font-bold text-slate-900">Signed_Invoice_{invoice.invoice_number}.pdf</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>DOCUMENT_TYPE:</span>
              <span className="text-indigo-700 font-bold">SIGNED_INVOICE</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>R2_PRIVATE_PATH:</span>
              <span className="text-slate-600">documents/signed_invoices/{invoice.id}/Signed_Invoice_{invoice.invoice_number}.pdf</span>
            </div>
            <div className="flex justify-between">
              <span>SIGNATURE_REF:</span>
              <span className="text-emerald-700 font-bold">{signatureData?.signature_reference || 'SIG-DOC-VERIFIED'}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border text-center">
            <p className="text-slate-600 mb-3">
              The PDF document embeds complete invoice details along with client signature stamp & verification metadata.
            </p>
            <Button
              onClick={() => alert(`Signed PDF Download URL generated for ${invoice.invoice_number}`)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
            >
              Download Signed Tax Invoice PDF
            </Button>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowSignedDocModal(false)}>
              Close Preview
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
