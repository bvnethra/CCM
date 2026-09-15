import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ItemMaster, Organization, SubOrganization, TenantStatus } from '../../types';
import { itemFormSchema, ItemFormValues } from '../../lib/schemas';
import { Package, Sliders, Calculator, AlertCircle } from 'lucide-react';

export interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ItemFormValues) => Promise<void>;
  initialData?: ItemMaster | null;
  organizations: Organization[];
  subOrganizations: SubOrganization[];
  tenantName?: string;
}

type TabType = 'general' | 'technical' | 'calibration';

const ITEM_TYPES = [
  'Master Standard',
  'Working Standard',
  'Calibrator',
  'Test Equipment',
  'Transducer',
  'Sensor',
  'Gauge',
  'Oscilloscope',
  'Multimeter',
  'Signal Generator',
  'Pressure Controller',
  'Thermometer',
];

const FREQUENCY_UNITS = ['Months', 'Days', 'Weeks', 'Years'];

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  organizations,
  subOrganizations,
  tenantName,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState('Master Standard');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [measurementRange, setMeasurementRange] = useState('');
  const [leastCount, setLeastCount] = useState('');
  const [standardCost, setStandardCost] = useState<number>(0);
  const [calibrationFrequency, setCalibrationFrequency] = useState<number>(12);
  const [calibrationFrequencyUnit, setCalibrationFrequencyUnit] = useState('Months');
  const [organizationId, setOrganizationId] = useState('');
  const [subOrgId, setSubOrgId] = useState('');
  const [status, setStatus] = useState<TenantStatus>('active');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setItemCode(initialData.item_code);
      setItemName(initialData.item_name);
      setItemType(initialData.item_type || 'Master Standard');
      setManufacturer(initialData.manufacturer || '');
      setModel(initialData.model || '');
      setSerialNumber(initialData.serial_number || '');
      setMeasurementRange(initialData.measurement_range || '');
      setLeastCount(initialData.least_count || '');
      setStandardCost(initialData.standard_cost ?? 0);
      setCalibrationFrequency(initialData.calibration_frequency ?? 12);
      setCalibrationFrequencyUnit(initialData.calibration_frequency_unit || 'Months');
      setOrganizationId(initialData.organization_id || '');
      setSubOrgId(initialData.sub_org_id || '');
      setStatus(initialData.status);
    } else {
      setItemCode('');
      setItemName('');
      setItemType('Master Standard');
      setManufacturer('');
      setModel('');
      setSerialNumber('');
      setMeasurementRange('');
      setLeastCount('');
      setStandardCost(0);
      setCalibrationFrequency(12);
      setCalibrationFrequencyUnit('Months');
      setOrganizationId('');
      setSubOrgId('');
      setStatus('active');
    }
    setActiveTab('general');
    setErrors({});
    setApiError(null);
  }, [initialData, isOpen]);

  const filteredSubOrgs = organizationId
    ? subOrganizations.filter((sub) => sub.organization_id === organizationId)
    : subOrganizations;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setApiError(null);

    const payload: ItemFormValues = {
      item_code: itemCode.trim().toUpperCase(),
      item_name: itemName.trim(),
      item_type: itemType.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      model: model.trim() || undefined,
      serial_number: serialNumber.trim() || undefined,
      measurement_range: measurementRange.trim() || undefined,
      least_count: leastCount.trim() || undefined,
      standard_cost: Number(standardCost) || 0,
      calibration_frequency: Number(calibrationFrequency) || 12,
      calibration_frequency_unit: calibrationFrequencyUnit || 'Months',
      organization_id: organizationId || undefined,
      sub_org_id: subOrgId || undefined,
      status,
    };

    const validation = itemFormSchema.safeParse(payload);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);

      // Switch to tab containing the first error
      if (fieldErrors.item_code || fieldErrors.item_name || fieldErrors.organization_id) {
        setActiveTab('general');
      } else if (fieldErrors.manufacturer || fieldErrors.model || fieldErrors.serial_number || fieldErrors.measurement_range) {
        setActiveTab('technical');
      } else if (fieldErrors.standard_cost || fieldErrors.calibration_frequency) {
        setActiveTab('calibration');
      }
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setApiError(err.message || 'An unexpected error occurred while saving the item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Edit Item: ${initialData.item_code}` : 'Register New Item Master'}
      description={
        tenantName
          ? `Tenant-scoped metrology asset registry for ${tenantName}`
          : 'Tenant-scoped metrology asset and equipment master'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {apiError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Validation / Submission Error</p>
              <p className="mt-0.5 text-red-600">{apiError}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            General & Branch
            {(errors.item_code || errors.item_name) && (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('technical')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'technical'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Technical Specs
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calibration')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'calibration'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calculator className="w-4 h-4" />
            Calibration & Cost
            {(errors.standard_cost || errors.calibration_frequency) && (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
        </div>

        {/* TAB 1: General & Branch */}
        {activeTab === 'general' && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Item Code *"
                placeholder="e.g. ITM-DMM-001"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                error={errors.item_code}
                disabled={Boolean(initialData)}
                helperText={initialData ? 'Item codes are immutable once created' : 'Unique identifier within tenant'}
              />

              <Input
                label="Item Name *"
                placeholder="e.g. 8.5 Digit Reference Multimeter"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                error={errors.item_name}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Item Type / Classification"
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                options={ITEM_TYPES.map((t) => ({ label: t, value: t }))}
              />

              <Select
                label="Operational Status *"
                value={status}
                onChange={(e) => setStatus(e.target.value as TenantStatus)}
                options={[
                  { label: 'Active - Qualified for In-House / Outsourced Calibration', value: 'active' },
                  { label: 'Inactive - Offline / Retired', value: 'inactive' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
              <Select
                label="Parent Branch / Organization"
                value={organizationId}
                onChange={(e) => {
                  setOrganizationId(e.target.value);
                  setSubOrgId('');
                }}
                options={[
                  { label: '-- Global Tenant Level (All Branches) --', value: '' },
                  ...organizations.map((org) => ({
                    label: `${org.name} (${org.code})`,
                    value: org.id,
                  })),
                ]}
              />

              <Select
                label="Assigned Facility / Sub-Organization"
                value={subOrgId}
                onChange={(e) => setSubOrgId(e.target.value)}
                disabled={!organizationId || filteredSubOrgs.length === 0}
                options={[
                  { label: '-- No Specific Facility --', value: '' },
                  ...filteredSubOrgs.map((sub) => ({
                    label: `${sub.name} (${sub.code})`,
                    value: sub.id,
                  })),
                ]}
              />
            </div>
          </div>
        )}

        {/* TAB 2: Technical Specifications */}
        {activeTab === 'technical' && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Manufacturer / OEM"
                placeholder="e.g. Fluke Calibration, Keysight, Druck"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                error={errors.manufacturer}
              />

              <Input
                label="Model Number"
                placeholder="e.g. 8588A, PACE5000, 9144"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                error={errors.model}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Serial Number"
                placeholder="e.g. FLK-8588A-98214"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                error={errors.serial_number}
                helperText="Physical equipment asset serial number"
              />

              <Input
                label="Least Count / Resolution"
                placeholder="e.g. 0.001 ppm, 0.01 °C, 0.001 mm"
                value={leastCount}
                onChange={(e) => setLeastCount(e.target.value)}
                error={errors.least_count}
              />
            </div>

            <Input
              label="Measurement Range / Metrology Scope"
              placeholder="e.g. 0.1 mV to 1000 V / 10 nA to 30 A"
              value={measurementRange}
              onChange={(e) => setMeasurementRange(e.target.value)}
              error={errors.measurement_range}
              helperText="Full metrology range calibrated across test points"
            />
          </div>
        )}

        {/* TAB 3: Calibration & Standard Cost */}
        {activeTab === 'calibration' && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Calibration Frequency *"
                type="number"
                min={1}
                step={1}
                placeholder="12"
                value={calibrationFrequency.toString()}
                onChange={(e) => setCalibrationFrequency(parseInt(e.target.value, 10) || 1)}
                error={errors.calibration_frequency}
                helperText="Periodic interval between routine re-calibrations"
              />

              <Select
                label="Frequency Interval Unit *"
                value={calibrationFrequencyUnit}
                onChange={(e) => setCalibrationFrequencyUnit(e.target.value)}
                options={FREQUENCY_UNITS.map((u) => ({ label: u, value: u }))}
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <Input
                label="Base Commercial / Standard Calibration Cost (₹ INR)"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={standardCost.toString()}
                onChange={(e) => setStandardCost(parseFloat(e.target.value) || 0)}
                error={errors.standard_cost}
                helperText="Default commercial price charged when item is added to quotation line items"
              />

              <p className="text-[11px] text-slate-500 leading-relaxed">
                💡 <strong>Commercial Module Integration:</strong> Future Calibration Request line items
                will populate commercial quotations with this standard fee before volume discount rules.
              </p>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-400">
            {activeTab === 'general' && 'Step 1 of 3: Core Identity'}
            {activeTab === 'technical' && 'Step 2 of 3: Equipment Specs'}
            {activeTab === 'calibration' && 'Step 3 of 3: Calibration & Costing'}
          </p>

          <div className="flex items-center gap-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {initialData ? 'Save Changes' : 'Register Item'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
