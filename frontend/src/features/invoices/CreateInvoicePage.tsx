import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Quotation, InvoiceType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import {
  ArrowLeft,
  FileCheck2,
  Building2,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Save,
  Zap,
  Layers,
} from 'lucide-react';

interface CreateInvoicePageProps {
  onBack?: () => void;
  onSuccess?: (invoiceId: string) => void;
}

interface QuotationItemRow {
  quotation_item_id: string;
  request_item_id?: string | null;
  item_id: string;
  item_code: string;
  item_name: string;
  serial_number: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
  is_already_invoiced: boolean;
  selected: boolean;
}

export const CreateInvoicePage: React.FC<CreateInvoicePageProps> = ({
  onBack,
  onSuccess,
}) => {
  const { activeTenant } = useTenant();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState('');

  const [invoiceMode, setInvoiceMode] = useState<'ITEMS_AND_INVOICE' | 'INVOICE_ONLY'>('ITEMS_AND_INVOICE');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('STANDARD');
  const [urgentReason, setUrgentReason] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [remarks, setRemarks] = useState('');
  const [customTotalAmount, setCustomTotalAmount] = useState<number>(0);

  const [itemRows, setItemRows] = useState<QuotationItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load Client Approved Quotations
  useEffect(() => {
    const loadQuotations = async () => {
      if (!activeTenant) return;
      try {
        const data = await api.getQuotations(activeTenant.id, { status: 'CLIENT_APPROVED' });
        setQuotations(data);
        if (data.length > 0) {
          setSelectedQuotationId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load approved quotations:', err);
      }
    };
    loadQuotations();
  }, [activeTenant]);

  // Load eligible items when quotation changes
  useEffect(() => {
    const loadItems = async () => {
      if (!activeTenant || !selectedQuotationId) {
        setItemRows([]);
        return;
      }
      setLoadingItems(true);
      try {
        const res = await api.getEligibleQuotationItemsForInvoice(selectedQuotationId, activeTenant.id);
        
        const eligibleMapped: QuotationItemRow[] = res.eligible_items.map((i) => ({
          quotation_item_id: i.quotation_item_id,
          request_item_id: i.request_item_id,
          item_id: i.item_id,
          item_code: i.item_code,
          item_name: i.item_name,
          serial_number: i.serial_number,
          quantity: i.quantity,
          unit_price: i.unit_price,
          tax_rate: i.tax_rate,
          line_total: i.line_total,
          is_already_invoiced: false,
          selected: true,
        }));

        const alreadyMapped: QuotationItemRow[] = res.already_invoiced_items.map((i) => ({
          quotation_item_id: i.quotation_item_id,
          request_item_id: i.request_item_id,
          item_id: i.item_id,
          item_code: i.item_code,
          item_name: i.item_name,
          serial_number: i.serial_number,
          quantity: i.quantity,
          unit_price: i.unit_price,
          tax_rate: i.tax_rate,
          line_total: i.line_total,
          is_already_invoiced: true,
          selected: false,
        }));

        setItemRows([...eligibleMapped, ...alreadyMapped]);
      } catch (err) {
        console.error('Failed to load quotation items for invoice:', err);
      } finally {
        setLoadingItems(false);
      }
    };
    loadItems();
  }, [activeTenant, selectedQuotationId]);

  const selectedQuotation = quotations.find((q) => q.id === selectedQuotationId);
  const eligibleSelectableItems = itemRows.filter((i) => !i.is_already_invoiced);
  const selectedItems = eligibleSelectableItems.filter((i) => i.selected);

  // Financial calculations
  let subtotal = 0;
  let totalTax = 0;

  selectedItems.forEach((i) => {
    const lineSub = i.quantity * i.unit_price;
    const tax = (lineSub * i.tax_rate) / 100;
    subtotal += lineSub;
    totalTax += tax;
  });

  const grandTotal = subtotal + totalTax;

  const handleToggleItem = (qItemId: string) => {
    setItemRows((prev) =>
      prev.map((i) => (i.quotation_item_id === qItemId && !i.is_already_invoiced ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleSelectAll = () => {
    setItemRows((prev) =>
      prev.map((i) => (!i.is_already_invoiced ? { ...i, selected: true } : i))
    );
  };

  const handleDeselectAll = () => {
    setItemRows((prev) =>
      prev.map((i) => (!i.is_already_invoiced ? { ...i, selected: false } : i))
    );
  };

  const handleSubmit = async () => {
    if (!activeTenant || !selectedQuotationId) {
      alert('Please select a Client Approved Quotation');
      return;
    }

    if (invoiceMode === 'ITEMS_AND_INVOICE' && selectedItems.length === 0) {
      alert('Please select at least one eligible quotation item for ITEMS_AND_INVOICE mode');
      return;
    }

    if (invoiceType === 'URGENT' && (!urgentReason || !urgentReason.trim())) {
      alert('Mandatory urgent reason is required for URGENT invoice processing');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        quotation_id: selectedQuotationId,
        invoice_mode: invoiceMode,
        invoice_type: invoiceType,
        due_date: dueDate,
        currency: 'INR',
        urgent_reason: invoiceType === 'URGENT' ? urgentReason : undefined,
        remarks,
        subtotal: invoiceMode === 'INVOICE_ONLY' ? (customTotalAmount || selectedQuotation?.total_amount || 0) : subtotal,
        tax_amount: invoiceMode === 'INVOICE_ONLY' ? 0 : totalTax,
        total_amount: invoiceMode === 'INVOICE_ONLY' ? (customTotalAmount || selectedQuotation?.total_amount || 0) : grandTotal,
        items: invoiceMode === 'ITEMS_AND_INVOICE' ? selectedItems.map((i) => ({
          request_item_id: i.request_item_id,
          item_id: i.item_id,
          quotation_item_id: i.quotation_item_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          tax_rate: i.tax_rate,
        })) : [],
      };

      const created = await api.createInvoice(activeTenant.id, payload);
      alert(`Invoice ${created.invoice_number} created successfully as DRAFT (${created.invoice_type})!`);
      if (onSuccess) onSuccess(created.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create invoice');
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
              <FileCheck2 className="w-6 h-6 text-indigo-600" />
              Create Commercial Invoice
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate Standard, Partial, or Urgent invoice against Client Approved Quotations.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: Select Approved Quotation */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-slate-500 border-b pb-2 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-600" />
          SECTION 1 — Select Client Approved Quotation
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Quotation <span className="text-rose-500">*</span>
            </label>
            <Select
              value={selectedQuotationId}
              onChange={(e) => setSelectedQuotationId(e.target.value)}
              className="text-sm border-slate-300"
              disabled={quotations.length === 0}
            >
              {quotations.length === 0 ? (
                <option value="">No Client Approved quotations available</option>
              ) : (
                quotations.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quotation_number} (v{q.version_number}) — {q.client?.client_name || 'Client'} (Total: ₹{q.total_amount.toFixed(2)})
                  </option>
                ))
              )}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Due Date <span className="text-rose-500">*</span></label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        {selectedQuotation && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-wrap gap-4 text-slate-600">
            <div>Client: <span className="font-semibold text-slate-900">{selectedQuotation.client?.client_name}</span></div>
            <div>Request #: <span className="font-mono text-slate-900">{selectedQuotation.request?.request_number}</span></div>
            <div>Quoted Amount: <span className="font-mono font-semibold text-slate-900">₹{selectedQuotation.total_amount.toFixed(2)}</span></div>
            <div>Approved On: <span className="font-mono text-slate-900">{selectedQuotation.client_response_at ? new Date(selectedQuotation.client_response_at).toLocaleDateString() : 'Yes'}</span></div>
          </div>
        )}
      </Card>

      {/* SECTION 2: Invoice Mode & Processing Type */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 border-b pb-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          SECTION 2 — Invoice Mode & Commercial Type
        </h2>

        {/* Invoice Mode Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">Invoice Granularity Mode</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => setInvoiceMode('ITEMS_AND_INVOICE')}
              className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                invoiceMode === 'ITEMS_AND_INVOICE' ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold' : 'border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 text-sm">
                <input type="radio" name="invMode" checked={invoiceMode === 'ITEMS_AND_INVOICE'} readOnly />
                ITEMS + INVOICE MODE
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Maintains full item-level traceability. Line items correspond directly to request & quotation items.
              </p>
            </div>

            <div
              onClick={() => setInvoiceMode('INVOICE_ONLY')}
              className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                invoiceMode === 'INVOICE_ONLY' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 font-semibold' : 'border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 text-sm">
                <input type="radio" name="invMode" checked={invoiceMode === 'INVOICE_ONLY'} readOnly />
                INVOICE-ONLY MODE
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Generates commercial invoice header & total amount without forcing item-level line items.
              </p>
            </div>
          </div>

          {invoiceMode === 'INVOICE_ONLY' && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 mt-2">
              <label className="block text-xs font-semibold text-emerald-900 mb-1">
                Custom Header Total Amount (₹) — Optional (Defaults to Quotation Total ₹{selectedQuotation?.total_amount || 0})
              </label>
              <Input
                type="number"
                min={0}
                placeholder={`Default: ${selectedQuotation?.total_amount || 0}`}
                value={customTotalAmount || ''}
                onChange={(e) => setCustomTotalAmount(parseFloat(e.target.value) || 0)}
                className="bg-white text-xs font-mono"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
          <label
            onClick={() => setInvoiceType('STANDARD')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              invoiceType === 'STANDARD' ? 'border-indigo-600 bg-indigo-50/40' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
              <input type="radio" name="invType" checked={invoiceType === 'STANDARD'} readOnly />
              STANDARD (Full)
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Invoice all eligible quotation lines for the complete request.
            </p>
          </label>

          <label
            onClick={() => setInvoiceType('PARTIAL')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              invoiceType === 'PARTIAL' ? 'border-purple-600 bg-purple-50/40' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold text-sm text-purple-900">
              <input type="radio" name="invType" checked={invoiceType === 'PARTIAL'} readOnly />
              PARTIAL INVOICE
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Invoice selected items now. Remaining items continue independently.
            </p>
          </label>

          <label
            onClick={() => setInvoiceType('URGENT')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              invoiceType === 'URGENT' ? 'border-amber-500 bg-amber-50/40' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold text-sm text-amber-900">
              <input type="radio" name="invType" checked={invoiceType === 'URGENT'} readOnly />
              <Zap className="w-4 h-4 text-amber-600" />
              URGENT PROCESSING
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Invoice urgently completed items immediately without waiting.
            </p>
          </label>
        </div>

        {invoiceType === 'URGENT' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mandatory Urgent Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={urgentReason}
              onChange={(e) => setUrgentReason(e.target.value)}
              placeholder="Provide business justification for urgent processing..."
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>
        )}
      </Card>

      {/* SECTION 3: Item Selection & Duplicate Check */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            SECTION 3 — Quotation Items Selection ({itemRows.length})
          </h2>

          {eligibleSelectableItems.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Button size="sm" variant="outline" onClick={handleSelectAll} className="h-7 text-xs">
                Select All Eligible
              </Button>
              <Button size="sm" variant="outline" onClick={handleDeselectAll} className="h-7 text-xs">
                Deselect All
              </Button>
            </div>
          )}
        </div>

        {loadingItems ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading quotation items...</div>
        ) : itemRows.length === 0 ? (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            No quotation items found for this quotation.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="p-3 w-10 text-center">Select</th>
                  <th className="p-3">Item Details</th>
                  <th className="p-3 text-center">Invoicing Status</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Quoted Price (₹)</th>
                  <th className="p-3 text-right">Line Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemRows.map((item) => (
                  <tr key={item.quotation_item_id} className={item.is_already_invoiced ? 'bg-slate-50/70 opacity-60' : item.selected ? 'bg-indigo-50/30' : 'bg-white'}>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        disabled={item.is_already_invoiced}
                        onChange={() => handleToggleItem(item.quotation_item_id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{item.item_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {item.item_code} | SN: {item.serial_number}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {item.is_already_invoiced ? (
                        <Badge variant="default" className="text-[10px] bg-slate-200 text-slate-700">
                          ALREADY INVOICED
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px]">
                          ELIGIBLE
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono">{item.quantity}</td>
                    <td className="p-3 text-right font-mono font-medium text-slate-800">
                      ₹{item.unit_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-slate-900">
                      ₹{item.line_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* SECTION 4: Financial Summary */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-slate-500 border-b pb-2 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-indigo-600" />
          SECTION 4 — Financial Summary (₹)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Remarks / Notes</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter internal or client notes for this commercial invoice..."
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Selected Lines:</span>
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
          {submitting ? 'Creating Invoice...' : `Create Invoice (${invoiceType})`}
        </Button>
      </div>
    </div>
  );
};
