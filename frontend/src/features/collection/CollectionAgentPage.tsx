import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import apiClient from '../../lib/api';
import { Client, ItemMaster } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  Trash2,
  UploadCloud,
  FileText,
  Clock,
} from 'lucide-react';

interface OfflineDraftItem {
  item_id: string;
  item_code: string;
  item_name: string;
  requested_quantity: number;
  item_available: 'YES' | 'NO';
  availability_remarks?: string;
}

interface OfflineDraft {
  draft_id: string;
  client_id: string;
  client_name: string;
  collection_date: string;
  priority: 'NORMAL' | 'URGENT';
  remarks?: string;
  items: OfflineDraftItem[];
  created_at: string;
  sync_status: 'LOCAL_DRAFT' | 'SYNC_PENDING' | 'SYNCED' | 'SYNC_FAILED';
  sync_error?: string;
}

export const CollectionAgentPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [clients, setClients] = useState<Client[]>([]);
  const [itemsMaster, setItemsMaster] = useState<ItemMaster[]>([]);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineDraft[]>([]);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Form State
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [remarks, setRemarks] = useState<string>('');
  const [draftItems, setDraftItems] = useState<OfflineDraftItem[]>([]);
  const [newItemId, setNewItemId] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<number>(1);

  // Monitor Network Connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerAutoSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load Local Storage Drafts
    loadOfflineDrafts();
    fetchMasterData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeTenant]);

  const loadOfflineDrafts = () => {
    try {
      const stored = localStorage.getItem(`ccm_offline_drafts_${activeTenant?.id || 'default'}`);
      if (stored) {
        setOfflineDrafts(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load offline drafts:', e);
    }
  };

  const saveOfflineDrafts = (drafts: OfflineDraft[]) => {
    setOfflineDrafts(drafts);
    try {
      localStorage.setItem(`ccm_offline_drafts_${activeTenant?.id || 'default'}`, JSON.stringify(drafts));
    } catch (e) {
      console.error('Failed to save offline drafts:', e);
    }
  };

  const fetchMasterData = async () => {
    if (!activeTenant) return;
    try {
      const clientsList = await apiClient.getClients(activeTenant.id);
      const itemsList = await apiClient.getItems(activeTenant.id);
      setClients(clientsList || []);
      setItemsMaster(itemsList || []);
    } catch (err) {
      console.error('Failed to fetch master data:', err);
    }
  };

  const handleAddItem = () => {
    if (!newItemId) return;
    const masterItem = itemsMaster.find((i) => i.id === newItemId);
    if (!masterItem) return;

    const existingIndex = draftItems.findIndex((i) => i.item_id === newItemId);
    if (existingIndex >= 0) {
      const updated = [...draftItems];
      updated[existingIndex].requested_quantity += newItemQty;
      setDraftItems(updated);
    } else {
      setDraftItems([
        ...draftItems,
        {
          item_id: masterItem.id,
          item_code: masterItem.item_code,
          item_name: masterItem.item_name,
          requested_quantity: newItemQty,
          item_available: 'YES',
        },
      ]);
    }
    setNewItemId('');
    setNewItemQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setDraftItems(draftItems.filter((_, i) => i !== index));
  };

  const handleSubmitCollection = async () => {
    if (!selectedClientId) {
      alert('Please select a Client.');
      return;
    }
    if (draftItems.length === 0) {
      alert('Please add at least one line item.');
      return;
    }

    const clientObj = clients.find((c) => c.id === selectedClientId);
    const newDraft: OfflineDraft = {
      draft_id: `DRAFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      client_id: selectedClientId,
      client_name: clientObj?.client_name || 'Selected Client',
      collection_date: collectionDate,
      priority,
      remarks,
      items: draftItems,
      created_at: new Date().toISOString(),
      sync_status: isOnline ? 'SYNC_PENDING' : 'LOCAL_DRAFT',
    };

    const updatedDrafts = [newDraft, ...offlineDrafts];
    saveOfflineDrafts(updatedDrafts);

    // Reset Form
    setSelectedClientId('');
    setDraftItems([]);
    setRemarks('');

    if (isOnline) {
      await performSync([newDraft]);
    } else {
      setSyncMessage('Request saved locally as DRAFT. Will synchronize automatically when network connection is restored.');
    }
  };

  const triggerAutoSync = async () => {
    const pendingDrafts = offlineDrafts.filter((d) => d.sync_status === 'LOCAL_DRAFT' || d.sync_status === 'SYNC_FAILED');
    if (pendingDrafts.length > 0) {
      await performSync(pendingDrafts);
    }
  };

  const performSync = async (draftsToSync: OfflineDraft[]) => {
    if (!activeTenant || draftsToSync.length === 0) return;
    setSyncing(true);
    setSyncMessage(null);

    try {
      const res = await apiClient.syncOfflineDrafts(activeTenant.id, draftsToSync);
      if (res.success && res.results) {
        let currentDrafts = [...offlineDrafts];
        res.results.forEach((result: any) => {
          const idx = currentDrafts.findIndex((d) => d.draft_id === result.draft_id);
          if (idx >= 0) {
            if (result.sync_status === 'SYNCED') {
              currentDrafts[idx].sync_status = 'SYNCED';
              delete currentDrafts[idx].sync_error;
            } else {
              currentDrafts[idx].sync_status = 'SYNC_FAILED';
              currentDrafts[idx].sync_error = result.error || 'Server validation failed';
            }
          }
        });
        saveOfflineDrafts(currentDrafts);
        setSyncMessage(`Sync complete: ${res.synced_count} synced successfully, ${res.failed_count} failed.`);
      }
    } catch (err: any) {
      console.error('Sync failed:', err);
      setSyncMessage(`Synchronization error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearSynced = () => {
    const remaining = offlineDrafts.filter((d) => d.sync_status !== 'SYNCED');
    saveOfflineDrafts(remaining);
  };

  const pendingCount = offlineDrafts.filter((d) => d.sync_status === 'LOCAL_DRAFT' || d.sync_status === 'SYNC_PENDING').length;
  const failedCount = offlineDrafts.filter((d) => d.sync_status === 'SYNC_FAILED').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner with Connectivity Status */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-6 rounded-lg border border-slate-200 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Collection Agent Field Intake</h1>
            <Badge variant={isOnline ? 'success' : 'destructive'} className="flex items-center gap-1">
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'Online (Server Connected)' : 'Offline (Local Storage Mode)'}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Prepare equipment pickup receipts in real-time or offline with automatic server synchronization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Badge variant="warning" className="text-xs py-1 px-3">
              {pendingCount} Sync Pending
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="destructive" className="text-xs py-1 px-3">
              {failedCount} Sync Failed
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => performSync(offlineDrafts.filter((d) => d.sync_status !== 'SYNCED'))}
            disabled={!isOnline || syncing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Pending ({pendingCount + failedCount})
          </Button>
        </div>
      </div>

      {syncMessage && (
        <div className="p-4 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm flex items-center justify-between">
          <span>{syncMessage}</span>
          <button onClick={() => setSyncMessage(null)} className="text-blue-600 hover:underline text-xs">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Collection Intake Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 bg-slate-50/50 -mx-6 -mt-6 p-4 rounded-t-lg">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                New Field Equipment Intake
              </h2>
            </div>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Client *</label>
                  <Select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    options={[
                      { label: '-- Choose Client --', value: '' },
                      ...clients.map((c) => ({ label: `${c.client_code} - ${c.client_name}`, value: c.id })),
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Collection Date</label>
                  <Input
                    type="date"
                    value={collectionDate}
                    onChange={(e) => setCollectionDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'NORMAL' | 'URGENT')}
                    options={[
                      { label: 'Normal Priority', value: 'NORMAL' },
                      { label: 'Urgent Processing', value: 'URGENT' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Intake Remarks / Instructions</label>
                  <Input
                    placeholder="Physical condition, pickup voucher ref..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>

              {/* Line Items Picker */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Add Equipment Line Items</h3>

                <div className="flex flex-col sm:flex-row gap-3 items-end mb-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Equipment / Item</label>
                    <Select
                      value={newItemId}
                      onChange={(e) => setNewItemId(e.target.value)}
                      options={[
                        { label: '-- Select Item Master --', value: '' },
                        ...itemsMaster.map((i) => ({ label: `${i.item_code} - ${i.item_name}`, value: i.id })),
                      ]}
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Qty</label>
                    <Input
                      type="number"
                      min={1}
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <Button type="button" onClick={handleAddItem} disabled={!newItemId} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </div>

                {/* Added Items Table */}
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-xs text-left text-slate-700">
                    <thead className="bg-slate-100 font-semibold text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Item Code</th>
                        <th className="px-3 py-2">Item Name</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draftItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                            No items added yet. Choose equipment from Item Master above.
                          </td>
                        </tr>
                      ) : (
                        draftItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-mono font-medium text-slate-900">{item.item_code}</td>
                            <td className="px-3 py-2">{item.item_name}</td>
                            <td className="px-3 py-2 text-center font-bold">{item.requested_quantity}</td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => handleRemoveItem(idx)}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  onClick={handleSubmitCollection}
                  disabled={!selectedClientId || draftItems.length === 0}
                  className="w-full sm:w-auto flex items-center gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  {isOnline ? 'Submit Collection Request (Online)' : 'Save Offline Draft (Local Queue)'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Col: Unsynchronized Draft Queue */}
        <div className="space-y-6">
          <Card className="p-4 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Unsynchronized Draft Queue
              </h2>
              {offlineDrafts.some((d) => d.sync_status === 'SYNCED') && (
                <button
                  onClick={handleClearSynced}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Clear Synced
                </button>
              )}
            </div>
            <div className="space-y-3">
              {offlineDrafts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No local drafts currently in queue.
                </p>
              ) : (
                offlineDrafts.map((draft) => (
                  <div
                    key={draft.draft_id}
                    className="p-3 border rounded-lg bg-slate-50 border-slate-200 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{draft.client_name}</span>
                      <Badge
                        variant={
                          draft.sync_status === 'SYNCED'
                            ? 'success'
                            : draft.sync_status === 'SYNC_FAILED'
                            ? 'destructive'
                            : 'warning'
                        }
                        className="text-[10px]"
                      >
                        {draft.sync_status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-slate-500">
                      <span>{draft.items.length} item(s)</span>
                      <span>{new Date(draft.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {draft.sync_error && (
                      <p className="text-[11px] text-red-600 font-medium bg-red-50 p-1.5 rounded border border-red-100">
                        {draft.sync_error}
                      </p>
                    )}

                    {draft.sync_status !== 'SYNCED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => performSync([draft])}
                        disabled={!isOnline || syncing}
                        className="w-full text-[11px] h-7 mt-1 flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Retry Sync
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CollectionAgentPage;
