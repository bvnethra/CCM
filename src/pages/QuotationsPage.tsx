import React, { useEffect, useState } from 'react';
import { Receipt, Plus, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { fetchApi } from '../api/client';
import { Quotation, Client } from '../types';

export const QuotationsPage: React.FC = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [clientId, setClientId] = useState('');
  const [discountAmount, setDiscountAmount] = useState(50);
  const [terms, setTerms] = useState('Net 30 Days. Calibration certificates delivered upon payment confirmation.');
  const [costOverrideReason, setCostOverrideReason] = useState('Volume corporate discount applied per contract');

  useEffect(() => {
    loadQuotations();
    loadClients();
  }, []);

  const loadQuotations = async () => {
    const res = await fetchApi('/api/quotations');
    if (res.success) setQuotations(res.data || []);
  };

  const loadClients = async () => {
    const res = await fetchApi('/api/clients');
    if (res.success) {
      setClients(res.data || []);
      if (res.data && res.data.length > 0) setClientId(res.data[0].id);
    }
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      clientId,
      items: [
        { description: 'Dimensional Calibration Service', quantity: 2, unitPrice: 150.0, isOverride: true, taxRate: 18 },
        { description: 'Electrical Multimeter Calibration', quantity: 1, unitPrice: 450.0, isOverride: false, taxRate: 18 },
      ],
      discountAmount,
      terms,
      costOverrideReason,
    };

    const res = await fetchApi('/api/quotations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      alert(`Quotation ${res.data?.quotationNumber} created successfully!`);
      setIsModalOpen(false);
      loadQuotations();
    } else {
      alert(res.error?.message || 'Quotation creation failed');
    }
  };

  const handleApprove = async (quotationId: string, status: 'APPROVED' | 'REJECTED') => {
    const res = await fetchApi(`/api/quotations/${quotationId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ quotationId, status }),
    });

    if (res.success) {
      alert(`Quotation status updated to ${status}`);
      loadQuotations();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" /> Commercial Quotations & Pricing Overrides
          </h2>
          <p className="text-xs text-slate-400">Generate request-linked or standalone commercial quotations with auditable cost overrides.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-semibold rounded-lg shadow-lg shadow-amber-500/20 transition"
        >
          <Plus className="w-4 h-4" /> Create Commercial Quotation
        </button>
      </div>

      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5">Quotation No</th>
              <th className="p-3.5">Subtotal</th>
              <th className="p-3.5">Tax (18%)</th>
              <th className="p-3.5">Discount</th>
              <th className="p-3.5">Total Amount</th>
              <th className="p-3.5">Cost Override Reason</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Approval Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {quotations.map((quo) => (
              <tr key={quo.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3.5 font-mono font-bold text-amber-400">{quo.quotationNumber}</td>
                <td className="p-3.5 font-mono text-slate-300">${quo.subtotal.toFixed(2)}</td>
                <td className="p-3.5 font-mono text-slate-400">${quo.taxAmount.toFixed(2)}</td>
                <td className="p-3.5 font-mono text-rose-400">-${quo.discountAmount.toFixed(2)}</td>
                <td className="p-3.5 font-mono font-bold text-emerald-400 text-sm">${quo.totalAmount.toFixed(2)}</td>
                <td className="p-3.5 text-slate-400 text-[11px] max-w-xs truncate">{quo.costOverrideReason || 'Standard Tariff'}</td>
                <td className="p-3.5">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    quo.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                  }`}>
                    {quo.status}
                  </span>
                </td>
                <td className="p-3.5 text-right space-x-2">
                  {quo.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleApprove(quo.id, 'APPROVED')}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-medium hover:bg-emerald-500 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprove(quo.id, 'REJECTED')}
                        className="px-2 py-1 bg-rose-950 text-rose-300 border border-rose-800 rounded text-[11px] font-medium hover:bg-rose-900 transition"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Commercial Quotation">
        <form onSubmit={handleCreateQuotation} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Client *</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.clientName} ({c.clientCode})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Discount Amount ($)</label>
              <input
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Cost Override Reason (Auditable) *</label>
              <input
                required
                type="text"
                value={costOverrideReason}
                onChange={(e) => setCostOverrideReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Terms & Conditions</label>
            <textarea
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs text-slate-400">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg">
              Save Quotation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
