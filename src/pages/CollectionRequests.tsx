import React, { useEffect, useState } from 'react';
import { ClipboardList, Plus, Search, Eye } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';
import { RequestDetailView } from './RequestDetailView';
import { fetchApi } from '../api/client';
import { CalibrationRequest, Client, ItemMaster } from '../types';

export const CollectionRequests: React.FC = () => {
  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [itemMasters, setItemMasters] = useState<ItemMaster[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [clientId, setClientId] = useState('');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [remarks, setRemarks] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  useEffect(() => {
    loadRequests();
    loadMasters();
  }, []);

  const loadRequests = async () => {
    const res = await fetchApi('/api/requests');
    if (res.success) setRequests(res.data || []);
  };

  const loadMasters = async () => {
    const cRes = await fetchApi('/api/clients');
    if (cRes.success) setClients(cRes.data || []);

    const iRes = await fetchApi('/api/items');
    if (iRes.success) setItemMasters(iRes.data || []);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItemIds.length === 0) {
      alert('Please select at least one instrument item to collect');
      return;
    }

    const payload = {
      clientId,
      collectionDate,
      priority,
      remarks,
      items: selectedItemIds.map((id) => ({
        itemId: id,
        quantity: 1,
        priority,
      })),
    };

    const res = await fetchApi('/api/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setIsModalOpen(false);
      loadRequests();
      setSelectedItemIds([]);
      setRemarks('');
    } else {
      alert(res.error?.message || 'Failed to create collection request');
    }
  };

  if (selectedRequestId) {
    return <RequestDetailView requestId={selectedRequestId} onBack={() => setSelectedRequestId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-sky-400" /> Collection Agent Work orders
          </h2>
          <p className="text-xs text-slate-400">Initiate calibration request work orders from client pickup locations.</p>
        </div>
        <button
          onClick={() => {
            if (clients.length > 0) setClientId(clients[0].id);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-sky-500/20 transition"
        >
          <Plus className="w-4 h-4" /> Create Collection Request
        </button>
      </div>

      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5">Request No</th>
              <th className="p-3.5">Client</th>
              <th className="p-3.5">Collection Date</th>
              <th className="p-3.5">Items Count</th>
              <th className="p-3.5">Priority</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {requests.map((req) => (
              <tr key={req.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3.5 font-mono font-bold text-sky-400">{req.requestNumber}</td>
                <td className="p-3.5 font-semibold text-slate-100">{req.clientName}</td>
                <td className="p-3.5 text-slate-400">{req.collectionDate}</td>
                <td className="p-3.5 font-medium">{req.items?.length || 0} Items</td>
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
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => setSelectedRequestId(req.id)}
                    className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium text-xs"
                  >
                    <Eye className="w-3.5 h-3.5" /> Traceability
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Collection Request">
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Client *</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clientName} ({c.clientCode})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Collection Date *</label>
              <input
                required
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Priority *</label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              >
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-slate-300">Select Items & Availability Check *</label>
              <span className="text-[10px] text-sky-400 font-mono">Server-Side Availability Validation Active</span>
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-lg p-3 bg-slate-950 space-y-2.5">
              {itemMasters.map((item) => {
                const isAvailable = item.isAvailable !== false;
                return (
                  <label key={item.id} className="flex items-center justify-between text-xs text-slate-300 cursor-pointer hover:bg-slate-900/60 p-1.5 rounded transition">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedItemIds([...selectedItemIds, item.id]);
                          else setSelectedItemIds(selectedItemIds.filter((id) => id !== item.id));
                        }}
                        className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                      />
                      <span>
                        <strong className="text-sky-400 font-mono">{item.itemCode}</strong> - {item.itemName} (SN: <span className="font-mono text-slate-400">{item.serialNumber}</span>)
                      </span>
                    </div>
                    <div>
                      {isAvailable ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded">
                          AVAILABLE: YES
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800/60 rounded">
                          AVAILABLE: NO (Hold)
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Collection Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Items collected in padded transport cases"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
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
              className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg"
            >
              Submit Collection Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
