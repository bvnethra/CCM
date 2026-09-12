import React, { useEffect, useState } from 'react';
import { Receipt, Plus, FileText, CheckCircle2 } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { fetchApi } from '../api/client';
import { Invoice, CalibrationRequest } from '../types';

export const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [isPartialProcessing, setIsPartialProcessing] = useState(true);

  useEffect(() => {
    loadInvoices();
    loadRequests();
  }, []);

  const loadInvoices = async () => {
    const res = await fetchApi('/api/invoices');
    if (res.success) setInvoices(res.data || []);
  };

  const loadRequests = async () => {
    const res = await fetchApi('/api/requests');
    if (res.success) {
      setRequests(res.data || []);
      if (res.data && res.data.length > 0) setSelectedRequestId(res.data[0].id);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const req = requests.find((r) => r.id === selectedRequestId);
    if (!req) return;

    const payload = {
      requestId: selectedRequestId,
      clientId: req.clientId,
      requestItemIds: req.items?.map((i) => i.id) || [],
      discountAmount: 50,
      isPartialProcessing,
    };

    const res = await fetchApi('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      alert(`Invoice ${res.data?.invoiceNumber} generated!`);
      setIsModalOpen(false);
      loadInvoices();
    } else {
      alert(res.error?.message || 'Invoice generation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" /> Commercial Invoices & Partial Billing
          </h2>
          <p className="text-xs text-slate-400">Generate commercial tax invoices with support for partial request item processing.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-500/20 transition"
        >
          <Plus className="w-4 h-4" /> Generate Invoice
        </button>
      </div>

      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5">Invoice No</th>
              <th className="p-3.5">Invoice Date</th>
              <th className="p-3.5">Subtotal</th>
              <th className="p-3.5">Tax (18%)</th>
              <th className="p-3.5">Discount</th>
              <th className="p-3.5">Total Amount</th>
              <th className="p-3.5">Processing Mode</th>
              <th className="p-3.5">Payment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3.5 font-mono font-bold text-emerald-400">{inv.invoiceNumber}</td>
                <td className="p-3.5 text-slate-400">{inv.invoiceDate}</td>
                <td className="p-3.5 font-mono text-slate-300">${inv.subtotal.toFixed(2)}</td>
                <td className="p-3.5 font-mono text-slate-400">${inv.taxAmount.toFixed(2)}</td>
                <td className="p-3.5 font-mono text-rose-400">-${inv.discountAmount.toFixed(2)}</td>
                <td className="p-3.5 font-mono font-bold text-emerald-400 text-sm">${inv.totalAmount.toFixed(2)}</td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-sky-950 text-sky-300 border border-sky-800/60 rounded">
                    {inv.isPartialProcessing ? 'Partial Item Processing' : 'Full Request Batch'}
                  </span>
                </td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800/60 rounded">
                    {inv.paymentStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Generate Commercial Invoice">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Parent Request *</label>
            <select
              value={selectedRequestId}
              onChange={(e) => setSelectedRequestId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            >
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.requestNumber} - {r.clientName} ({r.items?.length || 0} Items)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <input
              type="checkbox"
              id="partial"
              checked={isPartialProcessing}
              onChange={(e) => setIsPartialProcessing(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-sky-500"
            />
            <label htmlFor="partial" className="text-xs text-slate-300 cursor-pointer">
              Enable <strong>Partial Item Processing</strong> (Allows completed items to proceed independently)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs text-slate-400">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg">
              Create Invoice
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
