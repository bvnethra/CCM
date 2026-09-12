import React, { useEffect, useState } from 'react';
import { Truck, Plus, Search, MapPin } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { fetchApi } from '../api/client';
import { CalibrationRequest } from '../types';

export const DispatchPage: React.FC = () => {
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedReqId, setSelectedReqId] = useState('');
  const [courierName, setCourierName] = useState('FedEx Express Courier');
  const [trackingNumber, setTrackingNumber] = useState('TRK-9921-8842');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadDispatches();
    loadRequests();
  }, []);

  const loadDispatches = async () => {
    const res = await fetchApi('/api/dispatches');
    if (res.success) setDispatches(res.data || []);
  };

  const loadRequests = async () => {
    const res = await fetchApi('/api/requests');
    if (res.success) {
      setRequests(res.data || []);
      if (res.data && res.data.length > 0) setSelectedReqId(res.data[0].id);
    }
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const req = requests.find((r) => r.id === selectedReqId);
    if (!req) return;

    const payload = {
      requestId: selectedReqId,
      clientId: req.clientId,
      requestItemIds: req.items?.map((i) => i.id) || [],
      courierName,
      trackingNumber,
      dispatchDate,
    };

    const res = await fetchApi('/api/dispatches', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      alert(`Dispatch order ${res.data?.dispatchNumber} created and items marked DISPATCHED!`);
      setIsModalOpen(false);
      loadDispatches();
    } else {
      alert(res.error?.message || 'Dispatch creation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-400" /> Dispatch & Shipping Logistics
          </h2>
          <p className="text-xs text-slate-400">Package calibrated instruments, assign courier logistics, generate tracking numbers.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-500/20 transition"
        >
          <Plus className="w-4 h-4" /> Create Dispatch Order
        </button>
      </div>

      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5">Dispatch No</th>
              <th className="p-3.5">Dispatch Date</th>
              <th className="p-3.5">Courier Name</th>
              <th className="p-3.5">Tracking Number</th>
              <th className="p-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {dispatches.map((dsp) => (
              <tr key={dsp.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3.5 font-mono font-bold text-indigo-400">{dsp.dispatchNumber}</td>
                <td className="p-3.5 text-slate-400">{dsp.dispatchDate}</td>
                <td className="p-3.5 font-semibold text-slate-200">{dsp.courierName}</td>
                <td className="p-3.5 font-mono text-sky-400">{dsp.trackingNumber}</td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-950 text-purple-400 border border-purple-800/60 rounded">
                    {dsp.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Dispatch Shipment">
        <form onSubmit={handleCreateDispatch} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Ready Request *</label>
            <select
              value={selectedReqId}
              onChange={(e) => setSelectedReqId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            >
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.requestNumber} - {r.clientName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Courier Partner *</label>
            <input
              required
              type="text"
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tracking Airway Bill (AWB) *</label>
              <input
                required
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Dispatch Date *</label>
              <input
                required
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs text-slate-400">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">
              Dispatch Shipment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
