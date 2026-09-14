import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Client, DispatchType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  ArrowLeft,
  Building2,
  MapPin,
  FileCheck2,
} from 'lucide-react';

interface CreateDispatchPageProps {
  onBack: () => void;
  onSuccess: (dispatchId: string) => void;
}

export const CreateDispatchPage: React.FC<CreateDispatchPageProps> = ({
  onBack,
  onSuccess,
}) => {
  const { activeTenant } = useTenant();
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Form State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [dispatchType, setDispatchType] = useState<DispatchType>('STANDARD');
  const [urgentReason, setUrgentReason] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
  );
  const [shippingAddress, setShippingAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [remarks, setRemarks] = useState('');

  // Eligible Items
  const [eligibleItems, setEligibleItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadClients = async () => {
      if (!activeTenant) return;
      setLoadingClients(true);
      try {
        const clientList = await api.getClients(activeTenant.id);
        setClients(clientList);
        if (clientList.length > 0) {
          setSelectedClientId(clientList[0].id);
          setShippingAddress(clientList[0].billing_address || clientList[0].address_line_1 || '');
          setBillingAddress(clientList[0].billing_address || clientList[0].address_line_1 || '');
        }
      } catch (err) {
        console.error('Failed to load clients:', err);
      } finally {
        setLoadingClients(false);
      }
    };
    loadClients();
  }, [activeTenant]);

  useEffect(() => {
    const loadItems = async () => {
      if (!activeTenant || !selectedClientId) return;
      setLoadingItems(true);
      try {
        const res = await api.getEligibleItemsForDispatch(activeTenant.id, selectedClientId);
        setEligibleItems(res.eligible_items);
        setSelectedItemIds(res.eligible_items.map((i: any) => i.request_item_id));
      } catch (err) {
        console.error('Failed to load eligible items:', err);
      } finally {
        setLoadingItems(false);
      }
    };
    loadItems();
  }, [activeTenant, selectedClientId]);

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setShippingAddress(client.billing_address || client.address_line_1 || '');
      setBillingAddress(client.billing_address || client.address_line_1 || '');
    }
  };

  const toggleItemSelect = (requestItemId: string) => {
    if (selectedItemIds.includes(requestItemId)) {
      setSelectedItemIds(selectedItemIds.filter((id) => id !== requestItemId));
    } else {
      setSelectedItemIds([...selectedItemIds, requestItemId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedItemIds.length === eligibleItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(eligibleItems.map((i) => i.request_item_id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !selectedClientId) return;

    if (selectedItemIds.length === 0) {
      alert('Please select at least one eligible item to create a dispatch.');
      return;
    }

    if (dispatchType === 'URGENT' && (!urgentReason || !urgentReason.trim())) {
      alert('Mandatory urgent reason is required for URGENT dispatches.');
      return;
    }

    if (!shippingAddress || !shippingAddress.trim()) {
      alert('Valid shipping address is required.');
      return;
    }

    const firstItem = eligibleItems.find((i) => selectedItemIds.includes(i.request_item_id));

    setSubmitting(true);
    try {
      const newDsp = await api.createDispatch(
        activeTenant.id,
        {
          request_id: firstItem?.request_id || '77777777-1111-7777-a111-111111111111',
          invoice_id: firstItem?.invoice_id,
          client_id: selectedClientId,
          dispatch_type: dispatchType,
          dispatch_date: dispatchDate,
          expected_delivery_date: expectedDeliveryDate,
          shipping_address: shippingAddress.trim(),
          billing_address: billingAddress.trim(),
          urgent_reason: dispatchType === 'URGENT' ? urgentReason.trim() : undefined,
          remarks: remarks.trim(),
          selected_item_ids: selectedItemIds,
        }
      );

      onSuccess(newDsp.id);
    } catch (err: any) {
      console.error('Failed to create dispatch:', err);
      alert(err.message || 'Failed to create dispatch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="text-slate-600 border-slate-300">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Dispatch Record</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Step 15: Item selection, shipping address snapshot, and packing initialization
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Client & Dispatch Metadata */}
        <Card className="p-6 space-y-4 border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            1. Client & Dispatch Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select Client <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                disabled={loadingClients}
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client_name} ({c.client_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dispatch Type</label>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setDispatchType('STANDARD')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold border transition-colors ${
                    dispatchType === 'STANDARD'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  STANDARD
                </button>
                <button
                  type="button"
                  onClick={() => setDispatchType('PARTIAL')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold border transition-colors ${
                    dispatchType === 'PARTIAL'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  PARTIAL
                </button>
                <button
                  type="button"
                  onClick={() => setDispatchType('URGENT')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold border transition-colors ${
                    dispatchType === 'URGENT'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  URGENT
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dispatch Date</label>
              <input
                type="date"
                required
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {dispatchType === 'URGENT' && (
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-xs">
              <label className="block font-bold text-amber-900 mb-1">
                Mandatory Urgent Dispatch Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={urgentReason}
                onChange={(e) => setUrgentReason(e.target.value)}
                placeholder="e.g. Critical aerospace production line restart requested by client..."
                className="w-full p-2 border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          )}
        </Card>

        {/* Section 2: Shipping Address */}
        <Card className="p-6 space-y-4 border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-600" />
            2. Delivery & Shipping Address Snapshot
          </h2>

          <div className="text-xs space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Registered Shipping Address <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Enter complete shipping address including building, street, city, state, and postal code..."
                className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dispatch Remarks (Optional)</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any special handling or courier instructions..."
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </Card>

        {/* Section 3: Select Eligible Calibrated & Invoiced Items */}
        <Card className="p-6 space-y-4 border-slate-200">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-indigo-600" />
              3. Select Eligible Calibrated & Signed-Invoiced Items ({eligibleItems.length} Available)
            </h2>
            {eligibleItems.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {selectedItemIds.length === eligibleItems.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {loadingItems ? (
            <div className="p-6 text-center text-xs text-slate-500">Loading eligible dispatch items...</div>
          ) : eligibleItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              No eligible items found for this client. Items must have completed calibration and belong to an issued/signed invoice.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-3 text-center">Select</th>
                    <th className="p-3">Item Code & Name</th>
                    <th className="p-3">Serial Number</th>
                    <th className="p-3 font-mono">Request Number</th>
                    <th className="p-3 font-mono">Invoice Number</th>
                    <th className="p-3 text-center">Invoice Sig Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eligibleItems.map((item) => {
                    const selected = selectedItemIds.includes(item.request_item_id);
                    return (
                      <tr
                        key={item.request_item_id}
                        onClick={() => toggleItemSelect(item.request_item_id)}
                        className={`hover:bg-slate-50 cursor-pointer ${
                          selected ? 'bg-indigo-50/50 font-medium' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{item.item_name}</div>
                          <div className="text-[11px] font-mono text-slate-500">{item.item_code}</div>
                        </td>
                        <td className="p-3 font-mono text-slate-700">{item.serial_number}</td>
                        <td className="p-3 font-mono text-slate-600">{item.request_number}</td>
                        <td className="p-3 font-mono font-semibold text-indigo-600">{item.invoice_number}</td>
                        <td className="p-3 text-center">
                          <Badge variant="success" className="text-[10px]">
                            {item.invoice_signature_status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Selected: <span className="font-bold text-slate-800">{selectedItemIds.length} items</span> for dispatch
          </div>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={onBack}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || selectedItemIds.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6"
            >
              {submitting ? 'Creating Dispatch...' : 'Create & Initialize Packing'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
