import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Client, CalibrationRequest } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import {
  ArrowLeft,
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Save,
  Building,
} from 'lucide-react';

interface CreateQuotationPageProps {
  onBack?: () => void;
  onSuccess?: (quotationId: string) => void;
}

interface EligibleItemRow {
  request_item_id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  serial_number: string;
  quantity: number;
  calibration_result: string;
  calibration_source: 'INTERNAL' | 'VENDOR';
  standard_cost: number;
  selected: boolean;
  override_cost: string;
  override_reason: string;
  tax_rate: number;
}

export const CreateQuotationPage: React.FC<CreateQuotationPageProps> = ({
  onBack,
  onSuccess,
}) => {
  const { activeTenant } = useTenant();

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');

  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');

  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [discountAmount, setDiscountAmount] = useState('0');
  const [remarks, setRemarks] = useState('');

  const [eligibleItems, setEligibleItems] = useState<EligibleItemRow[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load clients
  useEffect(() => {
    const loadClients = async () => {
      if (!activeTenant) return;
      try {
        const data = await api.getClients(activeTenant.id, { status: 'active' });
        setClients(data);
        if (data.length > 0) {
          setSelectedClientId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load clients:', err);
      }
    };
    loadClients();
  }, [activeTenant]);

  // Load calibration requests for selected client
  useEffect(() => {
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
          setEligibleItems([]);
        }
      } catch (err) {
        console.error('Failed to load calibration requests:', err);
      }
    };
    loadRequests();
  }, [activeTenant, selectedClientId]);

  // Load eligible items for selected request
  useEffect(() => {
    const loadEligible = async () => {
      if (!activeTenant || !selectedRequestId) {
        setEligibleItems([]);
        return;
      }
      setLoadingEligible(true);
      try {
        const items = await api.getEligibleRequestItemsForQuotation(selectedRequestId, activeTenant.id);
        const mapped: EligibleItemRow[] = items.map((i) => ({
          request_item_id: i.request_item_id,
          item_id: i.item_id,
          item_code: i.item_code,
          item_name: i.item_name,
          serial_number: i.serial_number,
          quantity: i.quantity,
          calibration_result: i.calibration_result,
          calibration_source: i.calibration_source,
          standard_cost: i.standard_cost,
          selected: true,
          override_cost: '',
          override_reason: '',
          tax_rate: 18.0,
        }));
        setEligibleItems(mapped);
      } catch (err) {
        console.error('Failed to load eligible items:', err);
      } finally {
        setLoadingEligible(false);
      }
    };
    loadEligible();
  }, [activeTenant, selectedRequestId]);

  const selectedItems = eligibleItems.filter((i) => i.selected);

  // Financial calculations
  let subtotal = 0;
  let totalTax = 0;

  selectedItems.forEach((i) => {
    const cost = i.override_cost && !isNaN(parseFloat(i.override_cost)) ? parseFloat(i.override_cost) : i.standard_cost;
    const lineSub = i.quantity * cost;
    const tax = (lineSub * i.tax_rate) / 100;
    subtotal += lineSub;
    totalTax += tax;
  });

  const numDiscount = !isNaN(parseFloat(discountAmount)) ? parseFloat(discountAmount) : 0;
  const grandTotal = Math.max(0, subtotal + totalTax - numDiscount);

  const handleToggleItem = (reqItemId: string) => {
    setEligibleItems((prev) =>
      prev.map((i) => (i.request_item_id === reqItemId ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleOverrideCostChange = (reqItemId: string, val: string) => {
    setEligibleItems((prev) =>
      prev.map((i) => (i.request_item_id === reqItemId ? { ...i, override_cost: val } : i))
    );
  };

  const handleOverrideReasonChange = (reqItemId: string, val: string) => {
    setEligibleItems((prev) =>
      prev.map((i) => (i.request_item_id === reqItemId ? { ...i, override_reason: val } : i))
    );
  };

  const handleSubmit = async () => {
    if (!activeTenant || !selectedClientId || !selectedRequestId) {
      alert('Please select Client and Calibration Request');
      return;
    }

    if (selectedItems.length === 0) {
      alert('Please select at least one eligible item for the quotation');
      return;
    }

    // Validate override reasons
    for (const item of selectedItems) {
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
        request_id: selectedRequestId,
        client_id: selectedClientId,
        valid_until: validUntil,
        currency: 'INR',
        discount_amount: numDiscount,
        remarks,
        items: selectedItems.map((i) => ({
          request_item_id: i.request_item_id,
          item_id: i.item_id,
          quantity: i.quantity,
          override_cost: i.override_cost && !isNaN(parseFloat(i.override_cost)) ? parseFloat(i.override_cost) : undefined,
          override_reason: i.override_reason || undefined,
          tax_rate: i.tax_rate,
        })),
      };

      const created = await api.createQuotation(activeTenant.id, payload);
      alert(`Quotation ${created.quotation_number} created successfully as DRAFT!`);
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
              Generate quotation for eligible calibrated items in Indian Rupees (₹).
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: Quotation Details */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-slate-500 border-b pb-2 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-600" />
          SECTION 1 — Quotation Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Client <span className="text-rose-500">*</span>
            </label>
            <Select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_name} ({c.client_code})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Calibration Request <span className="text-rose-500">*</span>
            </label>
            <Select
              value={selectedRequestId}
              onChange={(e) => setSelectedRequestId(e.target.value)}
              className="text-sm border-slate-300"
              disabled={requests.length === 0}
            >
              {requests.length === 0 ? (
                <option value="">No active calibration requests found for this client</option>
              ) : (
                requests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.request_number} — {r.status} ({new Date(r.created_at).toLocaleDateString()})
                  </option>
                ))
              )}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Valid Until Date <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
            <Input type="text" value="INR (₹)" readOnly className="bg-slate-100 font-mono text-sm" />
          </div>
        </div>
      </Card>

      {/* SECTION 2: Eligible Items Selection */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-slate-500 border-b pb-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          SECTION 2 — Eligible Calibrated Items ({eligibleItems.length})
        </h2>

        {loadingEligible ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading eligible items...</div>
        ) : eligibleItems.length === 0 ? (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            No eligible calibrated items available for this request. Items must have internal calibration PASS/ADJUSTED or completed Step 11 vendor reintegration.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="p-3 w-10 text-center">Select</th>
                  <th className="p-3">Item Details</th>
                  <th className="p-3">Calib Result & Source</th>
                  <th className="p-3 text-right">Standard Cost (₹)</th>
                  <th className="p-3 text-right">Cost Override (₹)</th>
                  <th className="p-3">Override Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eligibleItems.map((item) => (
                  <tr key={item.request_item_id} className={item.selected ? 'bg-indigo-50/30' : 'bg-white'}>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggleItem(item.request_item_id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{item.item_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {item.item_code} | SN: {item.serial_number}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="success" className="text-[10px]">
                          {item.calibration_result}
                        </Badge>
                        {item.calibration_source === 'VENDOR' ? (
                          <Badge variant="purple" className="text-[10px] flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            VENDOR
                          </Badge>
                        ) : (
                          <Badge variant="info" className="text-[10px]">
                            INTERNAL
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-medium text-slate-800">
                      ₹{item.standard_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right">
                      <Input
                        type="number"
                        placeholder={String(item.standard_cost)}
                        value={item.override_cost}
                        onChange={(e) => handleOverrideCostChange(item.request_item_id, e.target.value)}
                        disabled={!item.selected}
                        className="w-28 text-right font-mono text-xs ml-auto"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        type="text"
                        placeholder={item.override_cost ? 'Mandatory override reason' : 'N/A'}
                        value={item.override_reason}
                        onChange={(e) => handleOverrideReasonChange(item.request_item_id, e.target.value)}
                        disabled={!item.selected || !item.override_cost}
                        className="text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* SECTION 3 & 4: Pricing Summary */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-slate-500 border-b pb-2 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-indigo-600" />
          SECTION 3 — Pricing & Financial Summary (₹)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Amount (₹)</label>
              <Input
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0.00"
                className="text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Terms</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter quotation payment terms or special notes..."
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Selected Items:</span>
              <span className="font-semibold text-slate-800">{selectedItems.length} lines</span>
            </div>

            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-900 font-medium">
                ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between text-xs text-slate-600">
              <span>GST Tax (18%):</span>
              <span className="font-mono text-slate-900 font-medium">
                + ₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between text-xs text-slate-600">
              <span>Commercial Discount:</span>
              <span className="font-mono text-rose-600 font-medium">
                - ₹{numDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="border-t border-slate-300 pt-2 flex justify-between text-sm font-bold text-slate-900">
              <span>Grand Total Amount:</span>
              <span className="font-mono text-indigo-700 text-base">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onBack && (
          <Button variant="outline" onClick={onBack} disabled={submitting}>
            Cancel
          </Button>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting || selectedItems.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {submitting ? 'Creating Quotation...' : 'Create Quotation (Draft)'}
        </Button>
      </div>
    </div>
  );
};
