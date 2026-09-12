import React, { useEffect, useState } from 'react';
import { PackageCheck, CheckCircle2, FileCheck } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { SignatureCanvas } from '../components/Workflow/SignatureCanvas';
import { fetchApi } from '../api/client';

export const DeliveryPage: React.FC = () => {
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<any | null>(null);

  const [receivedBy, setReceivedBy] = useState('Robert Vance');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliverySignature, setDeliverySignature] = useState('');

  useEffect(() => {
    loadDispatches();
  }, []);

  const loadDispatches = async () => {
    const res = await fetchApi('/api/dispatches');
    if (res.success) setDispatches(res.data || []);
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatch) return;
    if (!deliverySignature) {
      alert('Mandatory receiving delivery signature is required before completing request!');
      return;
    }

    const payload = {
      dispatchId: selectedDispatch.id,
      requestId: selectedDispatch.requestId,
      receivedBy,
      deliverySignatureData: deliverySignature,
      receivedDate,
    };

    const res = await fetchApi('/api/deliveries/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      alert(`Delivery confirmed and parent request updated to COMPLETED!`);
      setIsModalOpen(false);
      loadDispatches();
    } else {
      alert(res.error?.message || 'Delivery confirmation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-emerald-400" /> Client Delivery Confirmation & Handover
          </h2>
          <p className="text-xs text-slate-400">
            Confirm item receiving event, capture mandatory delivery signature, complete work order lifecycle.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5">Dispatch No</th>
              <th className="p-3.5">Courier & AWB</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Handover Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {dispatches.map((dsp) => (
              <tr key={dsp.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3.5 font-mono font-bold text-indigo-400">{dsp.dispatchNumber}</td>
                <td className="p-3.5">
                  <div className="font-semibold text-slate-200">{dsp.courierName}</div>
                  <div className="text-[11px] font-mono text-sky-400">{dsp.trackingNumber}</div>
                </td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-950 text-purple-400 border border-purple-800/60 rounded">
                    {dsp.status}
                  </span>
                </td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => {
                      setSelectedDispatch(dsp);
                      setIsModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition"
                  >
                    Confirm Delivery & Complete Request
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Confirm Delivery & Capture Receiving Signature">
        <form onSubmit={handleConfirmDelivery} className="space-y-4">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
            <p className="text-slate-400">Dispatch Reference: <strong className="text-indigo-400 font-mono">{selectedDispatch?.dispatchNumber}</strong></p>
            <p className="text-slate-400">Courier: <strong className="text-slate-200">{selectedDispatch?.courierName}</strong> (AWB: {selectedDispatch?.trackingNumber})</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Received By (Client Rep) *</label>
              <input
                required
                type="text"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Received Date *</label>
              <input
                required
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <SignatureCanvas
            onSave={(data) => setDeliverySignature(data)}
            label="Mandatory Delivery Receiving Signature *"
          />

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs text-slate-400">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!deliverySignature}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
            >
              Complete Work Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
