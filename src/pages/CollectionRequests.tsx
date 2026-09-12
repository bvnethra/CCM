import React, { useEffect, useState } from 'react';
import { ClipboardList, Plus, Search, Eye, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { StatusBadge } from '../components/Common/StatusBadge';
import { EmptyState } from '../components/Common/EmptyState';
import { RequestDetailView } from './RequestDetailView';
import { fetchApi } from '../api/client';
import { CalibrationRequest, Client, ItemMaster } from '../types';

export const CollectionRequests: React.FC = () => {
  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [itemMasters, setItemMasters] = useState<ItemMaster[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [clientId, setClientId] = useState('');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [remarks, setRemarks] = useState('');

  // Per-item availability state management
  const [itemSelections, setItemSelections] = useState<
    Record<
      string,
      { selected: boolean; isAvailable: boolean; unavailableReason: string; followUpStatus: string }
    >
  >({});

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
    if (iRes.success) {
      const itemsList: ItemMaster[] = iRes.data || [];
      setItemMasters(itemsList);
      // Initialize item selections map
      const initialMap: Record<string, any> = {};
      itemsList.forEach((itm) => {
        initialMap[itm.id] = {
          selected: false,
          isAvailable: itm.isAvailable !== false,
          unavailableReason: itm.availabilityReason || 'Instrument currently out of service',
          followUpStatus: 'Pending Repair',
        };
      });
      setItemSelections(initialMap);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedIds = Object.keys(itemSelections).filter((id) => itemSelections[id]?.selected);

    if (selectedIds.length === 0) {
      alert('Please select at least one instrument item for collection');
      return;
    }

    const payload = {
      clientId,
      collectionDate,
      priority,
      remarks,
      items: selectedIds.map((id) => ({
        itemId: id,
        quantity: 1,
        priority,
        isAvailable: itemSelections[id].isAvailable,
        unavailableReason: itemSelections[id].isAvailable ? undefined : itemSelections[id].unavailableReason,
        followUpStatus: itemSelections[id].isAvailable ? undefined : itemSelections[id].followUpStatus,
      })),
    };

    const res = await fetchApi('/api/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      setIsModalOpen(false);
      loadRequests();
      setRemarks('');
    } else {
      alert(res.error?.message || 'Failed to create collection request');
    }
  };

  const filteredRequests = requests.filter(
    (r) =>
      r.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
      (r.clientName && r.clientName.toLowerCase().includes(search.toLowerCase()))
  );

  if (selectedRequestId) {
    return <RequestDetailView requestId={selectedRequestId} onBack={() => setSelectedRequestId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Collection Agent Work Orders</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Initiate calibration request work orders from client pickup locations with per-item availability checks.
          </p>
        </div>
        <button
          onClick={() => {
            if (clients.length > 0) setClientId(clients[0].id);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Create Collection Request
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search request number or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <EmptyState
          title="No Collection Requests"
          description="There are currently no collection requests found for this tenant."
          actionLabel="Create Collection Request"
          onAction={() => {
            if (clients.length > 0) setClientId(clients[0].id);
            setIsModalOpen(true);
          }}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="enterprise-table-header">
                <th className="p-3.5">Request No</th>
                <th className="p-3.5">Client</th>
                <th className="p-3.5">Collection Date</th>
                <th className="p-3.5">Items Count</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Availability</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredRequests.map((req) => {
                const hasUnavailable = req.items?.some((i) => i.isAvailable === false);
                return (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-mono font-bold text-sky-400">{req.requestNumber}</td>
                    <td className="p-3.5 font-semibold text-slate-100">{req.clientName}</td>
                    <td className="p-3.5 text-slate-400">{req.collectionDate}</td>
                    <td className="p-3.5 font-medium">{req.items?.length || 0} Items</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.priority === 'HIGH'
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {req.priority}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <StatusBadge status={hasUnavailable ? 'UNAVAILABLE' : 'AVAILABLE'} type="availability" size="sm" />
                    </td>
                    <td className="p-3.5">
                      <StatusBadge status={req.status} size="sm" />
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedRequestId(req.id)}
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE COLLECTION REQUEST MODAL WITH ITEM AVAILABILITY TRACKING */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Collection Request" maxWidth="xl">
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

          {/* ITEM AVAILABILITY SELECTION MATRIX */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider">
                ITEM AVAILABILITY CHECK *
              </label>
              <span className="text-[11px] text-slate-400">Tracked independently per instrument item</span>
            </div>

            <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-lg p-3 bg-slate-950 space-y-3">
              {itemMasters.map((item) => {
                const state = itemSelections[item.id] || {
                  selected: false,
                  isAvailable: true,
                  unavailableReason: '',
                  followUpStatus: 'Pending Repair',
                };

                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-lg border transition ${
                      state.selected ? 'bg-slate-900 border-slate-700' : 'bg-slate-950/40 border-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-3 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={state.selected}
                          onChange={(e) =>
                            setItemSelections({
                              ...itemSelections,
                              [item.id]: { ...state, selected: e.target.checked },
                            })
                          }
                          className="rounded border-slate-700 bg-slate-900 text-sky-500"
                        />
                        <div>
                          <strong className="text-sky-400 font-mono">{item.itemCode}</strong> - {item.itemName}{' '}
                          <span className="font-mono text-slate-400 text-[11px]">(SN: {item.serialNumber})</span>
                        </div>
                      </label>

                      {/* ITEM AVAILABILITY YES/NO TOGGLE */}
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase mr-1">AVAILABILITY:</span>
                        <button
                          type="button"
                          onClick={() =>
                            setItemSelections({
                              ...itemSelections,
                              [item.id]: { ...state, isAvailable: true },
                            })
                          }
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition ${
                            state.isAvailable
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          YES
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setItemSelections({
                              ...itemSelections,
                              [item.id]: { ...state, isAvailable: false },
                            })
                          }
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition ${
                            !state.isAvailable
                              ? 'bg-rose-600 text-white border-rose-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          NO
                        </button>
                      </div>
                    </div>

                    {/* IF NO: Show Unavailable Reason, Remarks & Follow-up Status */}
                    {!state.isAvailable && state.selected && (
                      <div className="mt-2.5 p-2 bg-rose-950/20 border border-rose-800/40 rounded-lg space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-rose-300 font-medium">Unavailable Reason *</label>
                            <input
                              type="text"
                              placeholder="e.g. Out of service / Missing probe"
                              value={state.unavailableReason}
                              onChange={(e) =>
                                setItemSelections({
                                  ...itemSelections,
                                  [item.id]: { ...state, unavailableReason: e.target.value },
                                })
                              }
                              className="w-full bg-slate-950 border border-rose-900/60 rounded p-1.5 text-xs text-rose-200"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-rose-300 font-medium">Follow-Up Status *</label>
                            <select
                              value={state.followUpStatus}
                              onChange={(e) =>
                                setItemSelections({
                                  ...itemSelections,
                                  [item.id]: { ...state, followUpStatus: e.target.value },
                                })
                              }
                              className="w-full bg-slate-950 border border-rose-900/60 rounded p-1.5 text-xs text-rose-200"
                            >
                              <option value="Pending Repair">Pending Repair</option>
                              <option value="Awaiting Spare Parts">Awaiting Spare Parts</option>
                              <option value="Client Exceptional Hold">Client Exceptional Hold</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Collection Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Items collected in protective transport cases"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-sm"
            >
              Submit Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
