import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { InvoiceSignatureRequest, Invoice } from '../../types';
import { SignaturePad } from '../../components/ui/SignaturePad';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  FileCheck2,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Send,
} from 'lucide-react';

interface ClientInvoiceSignPageProps {
  requestReference: string;
  onSuccess?: () => void;
}

export const ClientInvoiceSignPage: React.FC<ClientInvoiceSignPageProps> = ({
  requestReference,
}) => {
  const [request, setRequest] = useState<InvoiceSignatureRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerPhone, setSignerPhone] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // Submission / Rejection Modal State
  const [submitting, setSubmitting] = useState(false);
  const [completedState, setCompletedState] = useState<'SIGNED' | 'REJECTED' | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    const loadRequest = async () => {
      setLoading(true);
      setError(null);
      try {
        const reqData = await api.getSignatureRequestByRef(requestReference);
        setRequest(reqData);
        setSignerName(reqData.signer_name || '');
        setSignerRole(reqData.signer_role || '');
        setSignerEmail(reqData.signer_email || '');
        setSignerPhone(reqData.signer_phone || '');

        if (reqData.status === 'PENDING') {
          await api.openSignatureRequest(requestReference);
        }
      } catch (err: any) {
        console.error('Failed to load signature request:', err);
        setError(err.message || 'Signature request link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };
    loadRequest();
  }, [requestReference]);

  const handleSignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim()) {
      alert('Please enter the Signer Name.');
      return;
    }
    if (!signatureData) {
      alert('Please draw your digital signature on the signature pad before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await api.signInvoice(requestReference, {
        signer_name: signerName.trim(),
        signer_role: signerRole.trim(),
        signer_email: signerEmail.trim(),
        signer_phone: signerPhone.trim(),
        signature_data: signatureData,
      });
      setCompletedState('SIGNED');
    } catch (err: any) {
      console.error('Failed to submit digital signature:', err);
      alert(err.message || 'Failed to submit signature');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a mandatory reason for rejecting this signature request.');
      return;
    }

    setRejecting(true);
    try {
      await api.rejectSignatureRequest(requestReference, {
        signer_name: signerName.trim() || 'Client Representative',
        signer_role: signerRole.trim() || 'Authorized Officer',
        rejection_reason: rejectionReason.trim(),
      });
      setShowRejectModal(false);
      setCompletedState('REJECTED');
    } catch (err: any) {
      console.error('Failed to reject signature request:', err);
      alert(err.message || 'Failed to reject request');
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <p className="text-sm font-medium text-slate-600">Loading Client Invoice Portal...</p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <div className="inline-flex p-3 rounded-full bg-amber-50 text-amber-600 mb-3">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Invalid or Expired Request</h2>
          <p className="text-sm text-slate-600 mb-6">{error || 'This digital signature link is no longer valid.'}</p>
          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 font-mono">
            Reference: {requestReference}
          </div>
        </div>
      </div>
    );
  }

  const invoice: Invoice | null = request.invoice || null;

  if (completedState === 'SIGNED' || request.status === 'SIGNED') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-xl shadow-lg border border-emerald-100 p-8 text-center">
          <div className="inline-flex p-4 rounded-full bg-emerald-50 text-emerald-600 mb-4">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Invoice Digitally Signed Successfully</h2>
          <p className="text-sm text-slate-600 mb-6">
            Thank you, <span className="font-semibold text-slate-800">{signerName || request.signer_name}</span>. Your digital signature has been verified and permanently linked to commercial invoice{' '}
            <span className="font-semibold text-indigo-600">{invoice?.invoice_number}</span>.
          </p>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Request Ref:</span>
              <span className="font-mono font-medium text-slate-800">{request.request_reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Number:</span>
              <span className="font-mono font-medium text-slate-800">{invoice?.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Grand Total:</span>
              <span className="font-semibold text-emerald-700">₹{invoice?.total_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Signed Status:</span>
              <span className="text-emerald-600 font-semibold">VERIFIED & SIGNED</span>
            </div>
          </div>

          <p className="text-xs text-slate-400">You may close this browser tab.</p>
        </div>
      </div>
    );
  }

  if (completedState === 'REJECTED' || request.status === 'REJECTED') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-xl shadow-lg border border-red-100 p-8 text-center">
          <div className="inline-flex p-4 rounded-full bg-red-50 text-red-600 mb-4">
            <XCircle className="h-12 w-12" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Signature Request Rejected</h2>
          <p className="text-sm text-slate-600 mb-6">
            You have rejected the digital signature request for invoice{' '}
            <span className="font-semibold text-slate-800">{invoice?.invoice_number}</span>.
          </p>
          <div className="bg-red-50 rounded-lg p-4 mb-6 border border-red-100 text-left text-xs">
            <span className="font-semibold text-red-800 block mb-1">Recorded Reason:</span>
            <p className="text-red-700">{request.rejection_reason || rejectionReason}</p>
          </div>
          <p className="text-xs text-slate-400">The commercial team has been notified.</p>
        </div>
      </div>
    );
  }

  if (request.status === 'EXPIRED') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <div className="inline-flex p-3 rounded-full bg-amber-50 text-amber-600 mb-3">
            <Clock className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Signature Link Expired</h2>
          <p className="text-sm text-slate-600 mb-6">This signature link expired on {new Date(request.expires_at).toLocaleDateString()}. Please contact the calibration provider to issue a new request.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Company Header */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-lg">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Commercial Tax Invoice Portal</h1>
              <p className="text-xs text-slate-500">Official Calibration Commercial Module Client Signing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="purple" className="text-xs py-1 px-2.5">
              <ShieldCheck className="h-3.5 w-3.5 mr-1 inline" /> Invoice Digital Signature Required
            </Badge>
          </div>
        </div>

        {/* Invoice Summary & Details */}
        <Card className="p-6">
          <div className="border-b border-slate-200 pb-4 mb-6 flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Tax Invoice</span>
              <h2 className="text-2xl font-extrabold text-slate-900 mt-0.5">{invoice?.invoice_number}</h2>
              <p className="text-xs text-slate-500 mt-1">Ref: {request.request_reference}</p>
            </div>
            <div className="text-left sm:text-right text-xs space-y-1">
              <div><span className="text-slate-500">Invoice Date:</span> <span className="font-semibold text-slate-800">{invoice?.invoice_date}</span></div>
              <div><span className="text-slate-500">Payment Due:</span> <span className="font-semibold text-slate-800">{invoice?.due_date}</span></div>
              <div><span className="text-slate-500">Currency:</span> <span className="font-semibold text-indigo-600">INR (₹)</span></div>
            </div>
          </div>

          {/* Client & Billing Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="font-bold text-slate-700 block mb-1">Billed To (Client):</span>
              <p className="font-semibold text-slate-900 text-sm">{request.client?.client_name || 'Client Representative'}</p>
              <p className="text-slate-600">{request.client?.billing_address || request.client?.address_line_1}</p>
              <p className="text-slate-500 mt-1">GSTIN: {request.client?.gst_number || 'N/A'}</p>
            </div>
            <div>
              <span className="font-bold text-slate-700 block mb-1">Authorized Contact:</span>
              <p className="text-slate-800 font-medium">{request.client?.contact_person}</p>
              <p className="text-slate-600">{request.client?.contact_email}</p>
              <p className="text-slate-600">{request.client?.contact_phone}</p>
            </div>
          </div>

          {/* Invoice Item Table */}
          <div className="mb-6 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">GST %</th>
                  <th className="py-2.5 px-3 text-right">Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {invoice?.items && invoice.items.length > 0 ? (
                  invoice.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800">{item.description || 'Calibrated Instrument'}</p>
                        <p className="text-[11px] text-slate-400 font-mono">Item Ref: {item.item_id || item.request_item_id}</p>
                      </td>
                      <td className="py-3 px-3 text-center font-medium">{item.quantity}</td>
                      <td className="py-3 px-3 text-right font-mono">₹{item.unit_price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-3 text-right font-mono">{item.tax_rate}%</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                        ₹{item.line_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      Standard calibration services tax invoice items listed
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="flex justify-end border-t border-slate-200 pt-4 mb-6">
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-slate-800">₹{invoice?.subtotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax (18% GST):</span>
                <span className="font-mono font-semibold text-slate-800">₹{invoice?.tax_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {!!invoice?.discount_amount && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span className="font-mono font-semibold">-₹{invoice?.discount_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-300">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-700">₹{invoice?.total_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Digital Signature Form */}
        <Card className="p-6 border-2 border-indigo-200">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-3">
            <FileCheck2 className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Client Digital Signature Capture</h3>
          </div>

          <form onSubmit={handleSignSubmit} className="space-y-6">
            {/* Signer Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Signer Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kumar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Signer Title / Role</label>
                <input
                  type="text"
                  value={signerRole}
                  onChange={(e) => setSignerRole(e.target.value)}
                  placeholder="e.g. Quality Director / Authorized Officer"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Signer Email</label>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="e.g. r.kumar@acme.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Signer Phone</label>
                <input
                  type="tel"
                  value={signerPhone}
                  onChange={(e) => setSignerPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Signature Canvas Pad */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Digital Signature Drawing Pad <span className="text-red-500">*</span>
              </label>
              <SignaturePad
                onSignatureChange={(dataUrl) => setSignatureData(dataUrl)}
                width={650}
                height={190}
              />
            </div>

            {/* Legal Statement */}
            <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <span>
                <strong>Confirmation Notice:</strong> By submitting this digital signature, the client representative confirms verification and authorization of the commercial tax invoice details presented above.
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRejectModal(true)}
                className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-1.5" /> Reject Signature Request
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !signerName.trim() || !signatureData}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6"
              >
                {submitting ? (
                  <>Verifying & Signing...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1.5 inline" /> Submit Digital Signature
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Reject Signature Request Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Signature Request"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Please provide a mandatory reason for rejecting this signature request. The commercial team will review your feedback.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Discrepancy in billing quantity for item #2, requires clarification before signing..."
              className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRejectSubmit}
              disabled={rejecting || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
