import React, { useEffect, useState } from 'react';
import { FlaskConical, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';
import { fetchApi } from '../api/client';
import { CalibrationRequest } from '../types';

export const LabQueue: React.FC = () => {
  const [labRequests, setLabRequests] = useState<CalibrationRequest[]>([]);
  const [selectedReq, setSelectedReq] = useState<CalibrationRequest | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [outcome, setOutcome] = useState<'VERIFIED' | 'DISCREPANCY' | 'SHORT' | 'OTHER_EXCEPTION'>('VERIFIED');
  const [physicalMatch, setPhysicalMatch] = useState(true);
  const [conditionNotes, setConditionNotes] = useState('All physical dimensions and serial numbers match specification sheet');

  useEffect(() => {
    loadLabQueue();
  }, []);

  const loadLabQueue = async () => {
    const res = await fetchApi('/api/lab/queue');
    if (res.success) setLabRequests(res.data || []);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !selectedItem) return;

    const payload = {
      requestId: selectedReq.id,
      requestItemId: selectedItem.id,
      outcome,
      physicalMatch,
      conditionNotes,
    };

    const res = await fetchApi('/api/requests/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      alert(`Item ${selectedItem.itemCode} verified successfully! Status updated in lab queue.`);
      setIsModalOpen(false);
      loadLabQueue();
    } else {
      alert(res.error?.message || 'Verification failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-400" /> Laboratory Reception & Item Verification
          </h2>
          <p className="text-xs text-slate-400">Receive items in lab, verify physical condition, check mandatory proofs before calibration.</p>
        </div>
      </div>

      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5">Request No</th>
              <th className="p-3.5">Client</th>
              <th className="p-3.5">Collection Agent</th>
              <th className="p-3.5">Priority</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Items Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {labRequests.map((req) => (
              <tr key={req.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3.5 font-mono font-bold text-sky-400">{req.requestNumber}</td>
                <td className="p-3.5 font-semibold text-slate-100">{req.clientName}</td>
                <td className="p-3.5 text-slate-400">{req.collectionAgentName}</td>
                <td className="p-3.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    req.priority === 'HIGH' ? 'bg-rose-950 text-rose-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {req.priority}
                  </span>
                </td>
                <td className="p-3.5">
                  <StatusBadge status={req.status} />
                </td>
                <td className="p-3.5 text-right space-x-2">
                  {req.items?.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedReq(req);
                        setSelectedItem(item);
                        setIsModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 rounded-md font-medium transition"
                    >
                      Verify {item.itemCode || 'Item'}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Verify Received Instrument">
        {selectedItem && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1 text-xs">
              <p className="text-slate-400">Request: <strong className="text-sky-400 font-mono">{selectedReq?.requestNumber}</strong></p>
              <p className="text-slate-400">Item: <strong className="text-slate-200">{selectedItem.itemName}</strong></p>
              <p className="text-slate-400">Expected Serial No: <strong className="text-slate-200 font-mono">{selectedItem.serialNumber}</strong></p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Verification Outcome *</label>
              <select
                value={outcome}
                onChange={(e: any) => setOutcome(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              >
                <option value="VERIFIED">VERIFIED (Matches Specification)</option>
                <option value="DISCREPANCY">DISCREPANCY (Mismatch Serial/Damaged)</option>
                <option value="SHORT">SHORT (Missing Parts)</option>
                <option value="OTHER_EXCEPTION">OTHER EXCEPTION</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="phys"
                checked={physicalMatch}
                onChange={(e) => setPhysicalMatch(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-sky-500"
              />
              <label htmlFor="phys" className="text-xs text-slate-300 cursor-pointer">
                Confirm physical match and visual inspection passed
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Condition Notes & Verification Proof</label>
              <textarea
                rows={3}
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
              >
                Confirm Item Verification
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
