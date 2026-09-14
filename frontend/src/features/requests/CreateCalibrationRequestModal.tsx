import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Client, ItemMaster, CalibrationRequestPriority, ItemAvailability } from '../../types';
import {
  Building,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Search,
  PackageCheck,
  AlertCircle,
} from 'lucide-react';

export interface CreateCalibrationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    client_id: string;
    collection_date: string;
    priority: CalibrationRequestPriority;
    remarks?: string | null;
    items: Array<{
      item_id: string;
      requested_quantity: number;
      item_available: ItemAvailability;
      availability_remarks?: string | null;
    }>;
    override_availability?: boolean;
  }) => Promise<void>;
  clients: Client[];
  items: ItemMaster[];
  currentUserName: string;
  currentUserId?: string;
}

interface SelectedItemConfig {
  item: ItemMaster;
  requested_quantity: number;
  item_available: ItemAvailability;
  availability_remarks: string;
}

export const CreateCalibrationRequestModal: React.FC<CreateCalibrationRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  clients,
  items,
  currentUserName,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Client
  const [clientId, setClientId] = useState<string>('');

  // Step 2: Collection Details
  const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<CalibrationRequestPriority>('NORMAL');
  const [remarks, setRemarks] = useState<string>('');

  // Step 3 & 4: Items & Availability
  const [itemSearch, setItemSearch] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [itemConfigs, setItemConfigs] = useState<Record<string, SelectedItemConfig>>({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setClientId(clients[0]?.id || '');
      setCollectionDate(new Date().toISOString().split('T')[0]);
      setPriority('NORMAL');
      setRemarks('');
      setItemSearch('');
      setSelectedItemIds([]);
      setItemConfigs({});
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, clients]);

  const selectedClient = clients.find((c) => c.id === clientId);

  const toggleItemSelection = (item: ItemMaster) => {
    if (selectedItemIds.includes(item.id)) {
      setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
      setItemConfigs((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } else {
      setSelectedItemIds((prev) => [...prev, item.id]);
      setItemConfigs((prev) => ({
        ...prev,
        [item.id]: {
          item,
          requested_quantity: 1,
          item_available: 'YES',
          availability_remarks: '',
        },
      }));
    }
  };

  const updateItemQuantity = (itemId: string, qty: number) => {
    if (qty < 1) return;
    setItemConfigs((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        requested_quantity: qty,
      },
    }));
  };

  const updateItemAvailability = (itemId: string, availability: ItemAvailability) => {
    setItemConfigs((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        item_available: availability,
        // Clear remarks if changed back to YES
        availability_remarks: availability === 'YES' ? '' : prev[itemId]?.availability_remarks || '',
      },
    }));
  };

  const updateItemRemarks = (itemId: string, rem: string) => {
    setItemConfigs((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        availability_remarks: rem,
      },
    }));
  };

  const validateStep = (currentStep: number): boolean => {
    setErrorMessage(null);
    if (currentStep === 1) {
      if (!clientId) {
        setErrorMessage('Please select a client to proceed.');
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      if (!collectionDate) {
        setErrorMessage('Collection date is required.');
        return false;
      }
      return true;
    }
    if (currentStep === 3) {
      if (selectedItemIds.length === 0) {
        setErrorMessage('Please select at least one item from the catalog.');
        return false;
      }
      return true;
    }
    if (currentStep === 4) {
      // Validate all items have qty > 0 and if NO, remarks are mandatory
      for (const id of selectedItemIds) {
        const cfg = itemConfigs[id];
        if (!cfg || cfg.requested_quantity < 1) {
          setErrorMessage('All items must have a quantity of at least 1.');
          return false;
        }
        if (cfg.item_available === 'NO' && (!cfg.availability_remarks || !cfg.availability_remarks.trim())) {
          setErrorMessage(`Item "${cfg.item.item_name}" is marked Unavailable. Availability remarks are mandatory.`);
          return false;
        }
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    const payload = {
      client_id: clientId,
      collection_date: collectionDate,
      priority,
      remarks: remarks || null,
      items: selectedItemIds.map((id) => ({
        item_id: id,
        requested_quantity: itemConfigs[id].requested_quantity,
        item_available: itemConfigs[id].item_available,
        availability_remarks: itemConfigs[id].availability_remarks || null,
      })),
      override_availability: true,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create calibration request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const q = itemSearch.toLowerCase();
    return (
      item.item_name.toLowerCase().includes(q) ||
      item.item_code.toLowerCase().includes(q) ||
      (item.manufacturer && item.manufacturer.toLowerCase().includes(q)) ||
      (item.serial_number && item.serial_number.toLowerCase().includes(q))
    );
  });

  const unavailableCount = selectedItemIds.filter((id) => itemConfigs[id]?.item_available === 'NO').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Calibration Request"
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Client' },
              { num: 2, label: 'Logistics' },
              { num: 3, label: 'Select Items' },
              { num: 4, label: 'Availability' },
              { num: 5, label: 'Review & Submit' },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    step === s.num
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : step > s.num
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span
                  className={`text-xs hidden sm:inline font-medium ${
                    step === s.num ? 'text-slate-900 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {s.label}
                </span>
                {s.num < 5 && <div className="hidden md:block w-8 h-px bg-slate-200 mx-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-semibold">Validation Required</p>
              <p className="mt-0.5 text-rose-700">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 1: SELECT CLIENT */}
        {/* ======================================================== */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Select Calibration Client</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose the commercial client for whom the instrument calibration request is being initiated.
              </p>
            </div>

            <Select
              label="Client Name & Account"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">-- Choose Client --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_name} ({c.client_code})
                </option>
              ))}
            </Select>

            {selectedClient && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-slate-900">{selectedClient.client_name}</span>
                    <Badge variant="info" size="sm">{selectedClient.client_code}</Badge>
                  </div>
                  <Badge variant={selectedClient.status === 'active' ? 'success' : 'warning'} size="sm">
                    {selectedClient.status.toUpperCase()}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Contact Person:</span>
                    <span className="font-medium text-slate-800">{selectedClient.contact_person || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Email & Phone:</span>
                    <span className="font-medium text-slate-800">
                      {selectedClient.contact_email || 'N/A'} {selectedClient.contact_phone ? `• ${selectedClient.contact_phone}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Address:</span>
                    <span className="font-medium text-slate-800">
                      {selectedClient.address_line_1 || 'Registered facility'}, {selectedClient.city || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">GSTIN:</span>
                    <span className="font-mono text-slate-800">{selectedClient.gst_number || 'Unregistered / Exempt'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: COLLECTION DETAILS */}
        {/* ======================================================== */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Logistics & Collection Parameters</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Set priority service levels, physical collection date, and intake remarks.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Collection Agent
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
                  <div className="h-5 w-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {currentUserName.charAt(0)}
                  </div>
                  <span className="font-medium">{currentUserName}</span>
                  <span className="ml-auto text-[10px] text-slate-400 font-mono">Current User</span>
                </div>
              </div>

              <Input
                label="Collection Date"
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                leftIcon={<Calendar className="w-4 h-4 text-slate-400" />}
                required
              />
            </div>

            {/* Priority Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Service Priority Level
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPriority('NORMAL')}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                    priority === 'NORMAL'
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>NORMAL PRIORITY</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1">
                    Standard lab calibration SLA (3–5 business days). Regular commercial rates.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('URGENT')}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                    priority === 'URGENT'
                      ? 'border-rose-600 bg-rose-50/50 ring-2 ring-rose-600/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>URGENT (EXPEDITED)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1">
                    Emergency priority turnaround (24–48 hours). Premium commercial calibration rates.
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Collection Remarks / Instructions
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Provide details on physical intake, transport precautions, box numbers, or client requests..."
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: SELECT ITEMS FROM ITEM MASTER */}
        {/* ======================================================== */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Select Equipment from Master Catalog</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pick the instruments being collected from client premises for calibration.
                </p>
              </div>
              <Badge variant="purple" size="sm">
                {selectedItemIds.length} {selectedItemIds.length === 1 ? 'Item' : 'Items'} Selected
              </Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search equipment by code, name, manufacturer, model, serial..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No equipment matched your search query in this tenant.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItemSelection(item)}
                      className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{item.item_name}</span>
                            <span className="font-mono text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {item.item_code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{item.manufacturer || 'Standard'}</span>
                            {item.model && <span>• Model: {item.model}</span>}
                            {item.serial_number && <span className="font-mono">• S/N: {item.serial_number}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        <span className="font-semibold text-slate-700">₹{Number(item.standard_cost || 0).toFixed(2)}</span>
                        <span className="block text-[10px] text-slate-400">Freq: {item.calibration_frequency} {item.calibration_frequency_unit}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: ITEM DETAILS & AVAILABILITY CHECK */}
        {/* ======================================================== */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Item Quantities & Physical Availability</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect each physical instrument. Mark availability YES/NO. Note: Availability is scoped to this request only.
                </p>
              </div>
              {unavailableCount > 0 && (
                <Badge variant="warning" size="sm">
                  {unavailableCount} Unavailable {unavailableCount === 1 ? 'Item' : 'Items'}
                </Badge>
              )}
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {selectedItemIds.map((id) => {
                const cfg = itemConfigs[id];
                if (!cfg) return null;
                const isUnavailable = cfg.item_available === 'NO';

                return (
                  <div
                    key={id}
                    className={`rounded-xl border p-4 transition-all ${
                      isUnavailable
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">{cfg.item.item_name}</span>
                          <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {cfg.item.item_code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {cfg.item.manufacturer} • Model: {cfg.item.model || 'N/A'} • Serial:{' '}
                          <span className="font-mono">{cfg.item.serial_number || 'N/A'}</span>
                        </p>
                      </div>

                      {/* Quantity Input */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-600">Qty:</label>
                        <input
                          type="number"
                          min={1}
                          value={cfg.requested_quantity}
                          onChange={(e) => updateItemQuantity(id, parseInt(e.target.value) || 1)}
                          className="w-16 rounded-md border border-slate-200 px-2 py-1 text-center text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Availability Toggle */}
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-medium text-slate-700 block">
                          Equipment Available for Calibration?
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {isUnavailable
                            ? 'Equipment cannot be calibrated in this batch. Reason is mandatory.'
                            : 'Equipment is present, accessible, and ready for lab intake.'}
                        </span>
                      </div>

                      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                        <button
                          type="button"
                          onClick={() => updateItemAvailability(id, 'YES')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                            cfg.item_available === 'YES'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>YES</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItemAvailability(id, 'NO')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                            cfg.item_available === 'NO'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>NO</span>
                        </button>
                      </div>
                    </div>

                    {/* Availability Remarks */}
                    {isUnavailable && (
                      <div className="mt-3 pt-3 border-t border-amber-200/60 animate-in fade-in">
                        <label className="block text-xs font-semibold text-rose-800 mb-1">
                          Availability Remarks * <span className="font-normal text-rose-600">(Mandatory for unavailable equipment)</span>
                        </label>
                        <input
                          type="text"
                          value={cfg.availability_remarks}
                          onChange={(e) => updateItemRemarks(id, e.target.value)}
                          placeholder="State reason (e.g., in active use on production line, battery leakage, missing power module)..."
                          className="w-full rounded-md border border-rose-300 bg-white p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 5: REVIEW & SUBMISSION */}
        {/* ======================================================== */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Review Request Summary</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Confirm all intake parameters and equipment items before generating the calibration request.
              </p>
            </div>

            {/* Warning if items are unavailable */}
            {unavailableCount > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Notice: Request Contains Unavailable Equipment</p>
                  <p className="mt-0.5 text-amber-800">
                    {unavailableCount} of {selectedItemIds.length} items are marked as <strong>UNAVAILABLE</strong>. They will be registered in the request with audit remarks for commercial resolution.
                  </p>
                </div>
              </div>
            )}

            {/* Request Summary Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Client:</span>
                  <span className="font-semibold text-slate-900">{selectedClient?.client_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Collection Agent:</span>
                  <span className="font-semibold text-slate-900">{currentUserName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Collection Date:</span>
                  <span className="font-semibold text-slate-900">{collectionDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Priority:</span>
                  <Badge variant={priority === 'URGENT' ? 'destructive' : 'info'} size="sm">
                    {priority}
                  </Badge>
                </div>
              </div>

              {remarks && (
                <div className="border-t border-slate-200/80 pt-2.5 text-xs">
                  <span className="text-slate-400 block text-[11px]">Intake Remarks:</span>
                  <p className="text-slate-800 mt-0.5 italic">{remarks}</p>
                </div>
              )}
            </div>

            {/* Items Summary Table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-100/70 px-4 py-2.5 text-xs font-semibold text-slate-700 flex items-center justify-between border-b border-slate-200">
                <span>Requested Equipment ({selectedItemIds.length} Items)</span>
                <span className="text-slate-500 font-normal">
                  Total Qty: {selectedItemIds.reduce((sum, id) => sum + (itemConfigs[id]?.requested_quantity || 1), 0)}
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                {selectedItemIds.map((id) => {
                  const cfg = itemConfigs[id];
                  if (!cfg) return null;
                  const isAvailable = cfg.item_available === 'YES';

                  return (
                    <div key={id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{cfg.item.item_name}</span>
                          <span className="font-mono text-[10px] text-slate-500">[{cfg.item.item_code}]</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Qty: <span className="font-semibold text-slate-700">{cfg.requested_quantity}</span> • S/N:{' '}
                          <span className="font-mono">{cfg.item.serial_number || 'N/A'}</span>
                        </p>
                        {!isAvailable && cfg.availability_remarks && (
                          <p className="text-[11px] text-rose-700 mt-0.5">
                            Reason: {cfg.availability_remarks}
                          </p>
                        )}
                      </div>

                      <div>
                        {isAvailable ? (
                          <Badge variant="success" size="sm">Available</Badge>
                        ) : (
                          <Badge variant="destructive" size="sm">Unavailable</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}

          {step < 5 ? (
            <Button
              type="button"
              onClick={handleNext}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              leftIcon={<PackageCheck className="w-4 h-4" />}
            >
              Create Calibration Request
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
