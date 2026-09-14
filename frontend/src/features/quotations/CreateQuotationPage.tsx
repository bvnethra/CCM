import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Client, CalibrationRequest, ItemMaster, Quotation } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  ArrowLeft,
  FileText,
  Building2,
  IndianRupee,
  Save,
  Plus,
  Trash2,
  History,
  Eye,
  Lock,
} from 'lucide-react';

interface CreateQuotationPageProps {
  onBack?: () => void;
  onSuccess?: (quotationId: string) => void;
  initialClientId?: string;
  initialItemId?: string;
}

interface QuotationItemLine {
  request_item_id?: string;
  item_id: string;
  item_code: string;
  item_name: string;
  serial_number?: string;
  quantity: number;
  standard_cost: number;
  override_cost: string;
  override_reason: string;
  tax_rate: number;
  selected: boolean;
}

export const CreateQuotationPage: React.FC<CreateQuotationPageProps> = ({
  onBack,
  onSuccess,
  initialClientId,
  initialItemId,
}) => {
  const { activeTenant } = useTenant();

  // Mode: STANDALONE or REQUEST_BASED
  const [quotationType, setQuotationType] = useState<'STANDALONE' | 'REQUEST_BASED'>(
    initialItemId ? 'STANDALONE' : 'STANDALONE'
  );

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId || '');
  const [selectedClientHistory, setSelectedClientHistory] = useState<Quotation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewHistoryQuotation, setViewHistoryQuotation] = useState<Quotation | null>(null);

  // Request-based mode state
  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [loadingEligible, setLoadingEligible] = useState(false);

  // Item Master list for Standalone mode
  const [itemMasters, setItemMasters] = useState<ItemMaster[]>([]);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState('');

  // Item lines in draft quotation
  const [itemLines, setItemLines] = useState<QuotationItemLine[]>([]);

  // Common Quotation Fields
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [discountAmount, setDiscountAmount] = useState('0');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load clients & Item Master list
  useEffect(() => {
    const loadMasters = async () => {
      if (!activeTenant) return;
      try {
        const clientData = await api.getClients(activeTenant.id, { status: 'active' });
        setClients(clientData);
        if (!selectedClientId && clientData.length > 0) {
          setSelectedClientId(clientData[0].id);
        }

        const itemsData = await api.getItems(activeTenant.id, { status: 'active' });
        setItemMasters(itemsData);

        // Pre-add initial item if passed from Due List direct action
        if (initialItemId && itemsData.length > 0) {
          const item = itemsData.find((i: ItemMaster) => i.id === initialItemId);
          if (item) {
            setItemLines([
              {
                item_id: item.id,
                item_code: item.item_code,
                item_name: item.item_name,
                quantity: 1,
                standard_cost: item.standard_cost || 1000,
                override_cost: '',
                override_reason: '',
                tax_rate: 18.0,
                selected: true,
              },
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to load master data:', err);
      }
    };
    loadMasters();
  }, [activeTenant]);

  // Load Client Quotation History whenever selected client changes
  useEffect(() => {
    const loadClientHistory = async () => {
      if (!activeTenant || !selectedClientId) {
        setSelectedClientHistory([]);
        return;
      }
      setHistoryLoading(true);
      try {
        const history = await api.getClientQuotationHistory(selectedClientId, activeTenant.id);
        setSelectedClientHistory(history);
      } catch (err) {
        console.error('Failed to load client quotation history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadClientHistory();
  }, [activeTenant, selectedClientId]);

  // Load calibration requests for selected client (Request-Based mode)
  useEffect(() => {
    if (quotationType !== 'REQUEST_BASED') return;
    const loadRequests = async () => {
      if (!activeTenant || !selectedClientId) return;
      try {
        const allReqs = await api.getCalibrationRequests(activeTenant.id);
        const reqs = allReqs.filter((r) => r.client_id === selectedClientId);
        setRequests(reqs);
        if (reqs.length > 0) {
          setSelectedRequestId(reqs[0].id);
        } else {
          setSelectedRequestId('');
          setItemLines([]);
        }
      } catch (err) {
        console.error('Failed to load calibration requests:', err);
      }
    };
    loadRequests();
  }, [activeTenant, selectedClientId, quotationType]);

  // Load eligible items for selected request (Request-Based mode)
  useEffect(() => {
    if (quotationType !== 'REQUEST_BASED' || !selectedRequestId) {
      if (quotationType === 'REQUEST_BASED') setItemLines([]);
      return;
    }
    const loadEligible = async () => {
      if (!activeTenant) return;
      setLoadingEligible(true);
      try {
        const items = await api.getEligibleRequestItemsForQuotation(selectedRequestId, activeTenant.id);
        const mapped: QuotationItemLine[] = items.map((i) => ({
          request_item_id: i.request_item_id,
          item_id: i.item_id,
          item_code: i.item_code,
          item_name: i.item_name,
          serial_number: i.serial_number,
          quantity: i.quantity,
          standard_cost: i.standard_cost,
          override_cost: '',
          override_reason: '',
          tax_rate: 18.0,
          selected: true,
        }));
        setItemLines(mapped);
      } catch (err) {
        console.error('Failed to load eligible items:', err);
      } finally {
        setLoadingEligible(false);
      }
    };
    loadEligible();
  }, [activeTenant, selectedRequestId, quotationType]);

  // Standalone mode: Add Item from Item Master
  const handleAddItemFromMaster = () => {
    if (!selectedItemToAdd) return;
    const master = itemMasters.find((i) => i.id === selectedItemToAdd);
    if (!master) return;

    if (itemLines.some((line) => line.item_id === master.id)) {
      alert('Item already added to quotation lines');
      return;
    }

    setItemLines((prev) => [
      ...prev,
      {
        item_id: master.id,
        item_code: master.item_code,
        item_name: master.item_name,
        quantity: 1,
        standard_cost: master.standard_cost || 1000,
        override_cost: '',
        override_reason: '',
        tax_rate: 18.0,
        selected: true,
      },
    ]);
    setSelectedItemToAdd('');
  };

  const handleRemoveLine = (index: number) => {
    setItemLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, qty: number) => {
    setItemLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, quantity: Math.max(1, qty) } : line))
    );
  };

  const handleOverrideCostChange = (index: number, val: string) => {
    setItemLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, override_cost: val } : line))
    );
  };

  const handleOverrideReasonChange = (index: number, val: string) => {
    setItemLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, override_reason: val } : line))
    );
  };

  const selectedLines = itemLines.filter((l) => l.selected);

  // Calculations
  let subtotal = 0;
  let totalTax = 0;

  selectedLines.forEach((l) => {
    const cost = l.override_cost && !isNaN(parseFloat(l.override_cost)) ? parseFloat(l.override_cost) : l.standard_cost;
    const lineSub = l.quantity * cost;
    const tax = (lineSub * l.tax_rate) / 100;
    subtotal += lineSub;
    totalTax += tax;
  });

  const numDiscount = !isNaN(parseFloat(discountAmount)) ? parseFloat(discountAmount) : 0;
  const grandTotal = Math.max(0, subtotal + totalTax - numDiscount);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const handleSubmit = async () => {
    if (!activeTenant || !selectedClientId) {
      alert('Please select a Client');
      return;
    }

    if (quotationType === 'REQUEST_BASED' && !selectedRequestId) {
      alert('Please select a Calibration Request for Request-Based quotation');
      return;
    }

    if (selectedLines.length === 0) {
      alert('Please add at least one item line to the quotation');
      return;
    }

    // Validate override reasons
    for (const item of selectedLines) {
      if (item.override_cost && item.override_cost.trim() !== '') {
        const numOverride = parseFloat(item.override_cost);
        if (numOverride !== item.standard_cost && (!item.override_reason || !item.override_reason.trim())) {
          alert(`Mandatory override reason is required for item ${item.item_code} when overriding standard cost.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        quotation_type: quotationType,
        request_id: quotationType === 'REQUEST_BASED' ? selectedRequestId : null,
        client_id: selectedClientId,
        valid_until: validUntil,
        currency: 'INR',
        discount_amount: numDiscount,
        remarks,
        items: selectedLines.map((i) => ({
          request_item_id: i.request_item_id || null,
          item_id: i.item_id,
          quantity: i.quantity,
          override_cost: i.override_cost && !isNaN(parseFloat(i.override_cost)) ? parseFloat(i.override_cost) : undefined,
          override_reason: i.override_reason || undefined,
          tax_rate: i.tax_rate,
        })),
      };

      const created = await api.createQuotation(activeTenant.id, payload);
      alert(`Quotation ${created.quotation_number} (${quotationType}) created successfully as DRAFT!`);
      if (onSuccess) onSuccess(created.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create quotation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="text-slate-600 border-slate-300">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              Create Commercial Quotation
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Support both Request-Based (Mode A) and Standalone Quotation (Mode B) workflows.
            </p>
          </div>
        </div>

        {/* Workflow Mode Selector */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setQuotationType('STANDALONE')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              quotationType === 'STANDALONE'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Standalone Quotation (Mode B)
          </button>
          <button
            type="button"
            onClick={() => setQuotationType('REQUEST_BASED')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              quotationType === 'REQUEST_BASED'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Request-Based Quotation (Mode A)
          </button>
        </div>
      </div>

      {/* SECTION 1: Client Selection & Previous Quotation History */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-slate-500 border-b pb-2 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-600" />
          1. Select Client & View Quotation History
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Target Client Master"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">-- Select Client --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.client_code} - {c.client_name}
              </option>
            ))}
          </Select>

          {quotationType === 'REQUEST_BASED' && (
            <Select
              label="Associated Calibration Request"
              value={selectedRequestId}
              onChange={(e) => setSelectedRequestId(e.target.value)}
              disabled={requests.length === 0}
            >
              {requests.length === 0 ? (
                <option value="">No Active Requests for this Client</option>
              ) : (
                requests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.request_number} ({r.status}) - {r.items?.length || 0} items
                  </option>
                ))
              )}
            </Select>
          )}

          {quotationType === 'STANDALONE' && selectedClient && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-slate-900">{selectedClient.client_name}</div>
              <div className="text-slate-500">GST: {selectedClient.gst_number || 'N/A'} | Contact: {selectedClient.contact_person || 'N/A'}</div>
              <div className="text-slate-500">{selectedClient.billing_address}</div>
            </div>
          )}
        </div>

        {/* Previous Client Quotation History Drawer */}
        {selectedClientId && (
          <div className="border-t border-slate-200 pt-4 mt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-600" />
              Previous Quotation History for Client ({selectedClientHistory.length})
            </h3>

            {historyLoading ? (
              <div className="text-xs text-slate-400 italic">Loading quotation history...</div>
            ) : selectedClientHistory.length === 0 ? (
              <div className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-dashed">
                No previous quotations recorded for this client.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Quotation No</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Valid Until</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Amount (₹)</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedClientHistory.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-mono font-bold text-slate-800">{q.quotation_number}</td>
                        <td className="py-1.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${q.quotation_type === 'STANDALONE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {q.quotation_type || 'REQUEST_BASED'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-600">{q.quotation_date}</td>
                        <td className="py-1.5 px-3 text-slate-600">{q.valid_until}</td>
                        <td className="py-1.5 px-3">
                          <Badge variant="info" className="text-[10px]">{q.status}</Badge>
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-semibold">₹{(q.total_amount || 0).toLocaleString()}</td>
                        <td className="py-1.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setViewHistoryQuotation(q)}
                            className="p-1 text-slate-600 hover:text-indigo-600"
                            title="View Historical Quotation (Read Only)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* SECTION 2: Item Lines Selection */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-indigo-600" />
            2. Line Item Selection & Cost Overrides
          </h2>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
            {quotationType === 'STANDALONE' ? 'Mode B: Item Master Picker' : 'Mode A: Eligible Calibrated Items'}
          </span>
        </div>

        {/* Standalone Mode Item Master Picker */}
        {quotationType === 'STANDALONE' && (
          <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <div className="flex-1">
              <Select
                value={selectedItemToAdd}
                onChange={(e) => setSelectedItemToAdd(e.target.value)}
              >
                <option value="">-- Add Item from Item Master --</option>
                {itemMasters.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_code} - {item.item_name} ({item.item_type || 'Instrument'}) | Standard Cost: ₹{item.standard_cost || 1000}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              onClick={handleAddItemFromMaster}
              disabled={!selectedItemToAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </Button>
          </div>
        )}

        {/* Line Items Table */}
        {itemLines.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed">
            {quotationType === 'STANDALONE'
              ? 'No items added yet. Select an item from Item Master above.'
              : loadingEligible
              ? 'Loading eligible calibrated items...'
              : 'No eligible calibrated items available for this request.'}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="py-2.5 px-3">Item Code & Name</th>
                  <th className="py-2.5 px-3 text-center w-24">Qty</th>
                  <th className="py-2.5 px-3 text-right">Standard Cost</th>
                  <th className="py-2.5 px-3 text-right">Override Cost</th>
                  <th className="py-2.5 px-3">Override Reason</th>
                  <th className="py-2.5 px-3 text-right">Final Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Line Total (Inc 18% Tax)</th>
                  {quotationType === 'STANDALONE' && <th className="py-2.5 px-3 text-center w-12">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemLines.map((line, idx) => {
                  const isOverride = line.override_cost !== '' && !isNaN(parseFloat(line.override_cost));
                  const finalCost = isOverride ? parseFloat(line.override_cost) : line.standard_cost;
                  const lineSub = line.quantity * finalCost;
                  const lineTax = (lineSub * line.tax_rate) / 100;
                  const lineTotal = lineSub + lineTax;

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900">{line.item_name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{line.item_code}</div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 1)}
                          className="w-16 text-center text-xs py-1"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">₹{line.standard_cost.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">
                        <Input
                          type="number"
                          placeholder={`₹${line.standard_cost}`}
                          value={line.override_cost}
                          onChange={(e) => handleOverrideCostChange(idx, e.target.value)}
                          className="w-24 text-right text-xs py-1 font-mono border-indigo-200"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="text"
                          placeholder={isOverride ? 'Mandatory override reason...' : 'Optional...'}
                          value={line.override_reason}
                          onChange={(e) => handleOverrideReasonChange(idx, e.target.value)}
                          className={`text-xs py-1 ${isOverride && !line.override_reason ? 'border-red-400 bg-red-50' : ''}`}
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                        ₹{finalCost.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                        ₹{lineTotal.toLocaleString()}
                      </td>
                      {quotationType === 'STANDALONE' && (
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Remove Line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* SECTION 3: Summary & Submit */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-slate-500 border-b pb-2 flex items-center gap-2">
          <Save className="w-4 h-4 text-indigo-600" />
          3. Commercial Summary & Validity
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            type="date"
            label="Valid Until"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />

          <Input
            type="number"
            label="Discount Amount (₹)"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
          />

          <Input
            type="text"
            label="Internal Remarks"
            placeholder="Special terms, payment schedule, etc."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        {/* Totals Box */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1 text-xs text-slate-600">
            <div>Subtotal: <span className="font-mono font-semibold">₹{subtotal.toLocaleString()}</span></div>
            <div>Tax (18% GST): <span className="font-mono font-semibold">₹{totalTax.toLocaleString()}</span></div>
            <div>Discount: <span className="font-mono font-semibold">₹{numDiscount.toLocaleString()}</span></div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Grand Total</div>
            <div className="text-2xl font-bold font-mono text-indigo-700">₹{grandTotal.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {onBack && (
            <Button variant="outline" type="button" onClick={onBack}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selectedLines.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
          >
            {submitting ? 'Creating Quotation...' : `Create ${quotationType === 'STANDALONE' ? 'Standalone' : 'Request-Based'} Quotation (DRAFT)`}
          </Button>
        </div>
      </Card>

      {/* Read-Only History Modal */}
      {viewHistoryQuotation && (
        <Modal
          isOpen={true}
          onClose={() => setViewHistoryQuotation(null)}
          title={`Historical Quotation: ${viewHistoryQuotation.quotation_number}`}
          description="Read-only view of historical quotation record"
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border">
              <div>Type: <span className="font-semibold">{viewHistoryQuotation.quotation_type || 'REQUEST_BASED'}</span></div>
              <div>Status: <span className="font-semibold">{viewHistoryQuotation.status}</span></div>
              <div>Date: <span className="font-semibold">{viewHistoryQuotation.quotation_date}</span></div>
              <div>Total: <span className="font-semibold font-mono">₹{viewHistoryQuotation.total_amount?.toLocaleString()}</span></div>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Historical quotations cannot be modified from the new quotation creation screen.</span>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setViewHistoryQuotation(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
