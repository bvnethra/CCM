import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Vendor, Organization, SubOrganization, TenantStatus } from '../../types';
import { vendorFormSchema, VendorFormValues } from '../../lib/schemas';
import { Building2, User, MapPin, Award, AlertCircle, Check } from 'lucide-react';

export interface VendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VendorFormValues) => Promise<void>;
  initialData?: Vendor | null;
  organizations: Organization[];
  subOrganizations: SubOrganization[];
  tenantName?: string;
}

type TabType = 'general' | 'contact' | 'address' | 'capabilities';

const STANDARD_CATEGORIES = [
  'Thermal',
  'Electro-Technical',
  'Mechanical',
  'Pressure',
  'Optical',
  'Dimensional',
  'Mass & Volume',
  'Torque & Force',
  'Acoustics',
  'RF & Microwave',
  'Biomedical',
];

export const VendorModal: React.FC<VendorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  organizations,
  subOrganizations,
  tenantName,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [vendorCode, setVendorCode] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [postalCode, setPostalCode] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [servicedCategories, setServicedCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [subOrgId, setSubOrgId] = useState('');
  const [status, setStatus] = useState<TenantStatus>('active');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setVendorCode(initialData.vendor_code);
      setVendorName(initialData.vendor_name);
      setContactPerson(initialData.contact_person || '');
      setContactEmail(initialData.contact_email || '');
      setContactPhone(initialData.contact_phone || '');
      setAddressLine1(initialData.address_line_1 || '');
      setAddressLine2(initialData.address_line_2 || '');
      setCity(initialData.city || '');
      setState(initialData.state || '');
      setCountry(initialData.country || 'India');
      setPostalCode(initialData.postal_code || '');
      setGstNumber(initialData.gst_number || '');
      setServicedCategories(initialData.serviced_categories || []);
      setOrganizationId(initialData.organization_id || '');
      setSubOrgId(initialData.sub_org_id || '');
      setStatus(initialData.status);
    } else {
      setVendorCode('');
      setVendorName('');
      setContactPerson('');
      setContactEmail('');
      setContactPhone('');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setState('');
      setCountry('India');
      setPostalCode('');
      setGstNumber('');
      setServicedCategories([]);
      setOrganizationId('');
      setSubOrgId('');
      setStatus('active');
    }
    setCustomCategory('');
    setErrors({});
    setApiError(null);
    setActiveTab('general');
  }, [initialData, isOpen]);

  const filteredSubOrgs = subOrganizations.filter(
    (s) => !organizationId || s.organization_id === organizationId
  );

  const toggleCategory = (cat: string) => {
    if (servicedCategories.includes(cat)) {
      setServicedCategories(servicedCategories.filter((c) => c !== cat));
    } else {
      setServicedCategories([...servicedCategories, cat]);
    }
  };

  const addCustomCategory = () => {
    const trimmed = customCategory.trim();
    if (trimmed && !servicedCategories.includes(trimmed)) {
      setServicedCategories([...servicedCategories, trimmed]);
      setCustomCategory('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setApiError(null);

    const formData: VendorFormValues = {
      vendor_code: vendorCode.trim(),
      vendor_name: vendorName.trim(),
      contact_person: contactPerson.trim() || undefined,
      contact_email: contactEmail.trim() || undefined,
      contact_phone: contactPhone.trim() || undefined,
      address_line_1: addressLine1.trim() || undefined,
      address_line_2: addressLine2.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      country: country.trim() || 'India',
      postal_code: postalCode.trim() || undefined,
      gst_number: gstNumber.trim() || undefined,
      serviced_categories: servicedCategories,
      organization_id: organizationId || undefined,
      sub_org_id: subOrgId || undefined,
      status,
    };

    const validation = vendorFormSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);

      // Auto-switch to tab containing error
      if (fieldErrors.vendor_code || fieldErrors.vendor_name || fieldErrors.status) {
        setActiveTab('general');
      } else if (fieldErrors.contact_person || fieldErrors.contact_email || fieldErrors.contact_phone) {
        setActiveTab('contact');
      } else if (fieldErrors.address_line_1 || fieldErrors.city || fieldErrors.postal_code) {
        setActiveTab('address');
      } else if (fieldErrors.gst_number || fieldErrors.serviced_categories) {
        setActiveTab('capabilities');
      }
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(validation.data);
      onClose();
    } catch (err: any) {
      setApiError(err.message || 'Failed to save vendor. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General & Branch', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'contact', label: 'Contact Details', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'address', label: 'Address', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'capabilities', label: 'Capabilities & GST', icon: <Award className="w-3.5 h-3.5" /> },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Vendor Profile' : 'Onboard New Vendor'}
      description={`External calibration vendor scoped to tenant: ${tenantName || 'Current Tenant'}`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {apiError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Operation Failed</p>
              <p>{apiError}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-1 pb-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                  isActive
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: GENERAL & BRANCH */}
        {activeTab === 'general' && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Vendor Code *"
                placeholder="e.g. VEN-NABL-001"
                value={vendorCode}
                onChange={(e) => setVendorCode(e.target.value)}
                error={errors.vendor_code}
                disabled={isSubmitting}
                className="uppercase font-mono"
              />

              <Input
                label="Vendor Entity Name *"
                placeholder="e.g. National Standard Metrology Labs"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                error={errors.vendor_name}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Parent Branch / Organization"
                value={organizationId}
                onChange={(e) => {
                  setOrganizationId(e.target.value);
                  setSubOrgId('');
                }}
                disabled={isSubmitting}
                options={[
                  { label: '-- Global Tenant Level (All Branches) --', value: '' },
                  ...organizations.map((org) => ({
                    label: `${org.name} (${org.code})`,
                    value: org.id,
                  })),
                ]}
              />

              <Select
                label="Sub-Organization / Facility"
                value={subOrgId}
                onChange={(e) => setSubOrgId(e.target.value)}
                disabled={isSubmitting}
                options={[
                  { label: '-- No Specific Facility --', value: '' },
                  ...filteredSubOrgs.map((sub) => ({
                    label: `${sub.name} (${sub.code})`,
                    value: sub.id,
                  })),
                ]}
              />
            </div>

            <Select
              label="Account Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TenantStatus)}
              disabled={isSubmitting}
              options={[
                { label: 'Active - Qualified for Outsourced Calibration', value: 'active' },
                { label: 'Inactive - Disqualified / Temporary Hold', value: 'inactive' },
                { label: 'Suspended - Prohibited', value: 'suspended' },
              ]}
            />
          </div>
        )}

        {/* TAB 2: CONTACT DETAILS */}
        {activeTab === 'contact' && (
          <div className="space-y-4 pt-1">
            <Input
              label="Primary Contact Person"
              placeholder="e.g. Kavita Sundaram"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              error={errors.contact_person}
              disabled={isSubmitting}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="email"
                label="Contact Email"
                placeholder="e.g. kavita.s@nationalstandards.in"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                error={errors.contact_email}
                disabled={isSubmitting}
              />

              <Input
                label="Contact Phone"
                placeholder="e.g. +91 80 2839 0001"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                error={errors.contact_phone}
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        {/* TAB 3: PHYSICAL ADDRESS */}
        {activeTab === 'address' && (
          <div className="space-y-4 pt-1">
            <Input
              label="Address Line 1"
              placeholder="e.g. Phase 2, Peenya Industrial Area"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              error={errors.address_line_1}
              disabled={isSubmitting}
            />

            <Input
              label="Address Line 2 (Optional)"
              placeholder="e.g. Near Outer Ring Road Junction"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              error={errors.address_line_2}
              disabled={isSubmitting}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="City"
                placeholder="e.g. Bengaluru"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                error={errors.city}
                disabled={isSubmitting}
              />

              <Input
                label="State"
                placeholder="e.g. Karnataka"
                value={state}
                onChange={(e) => setState(e.target.value)}
                error={errors.state}
                disabled={isSubmitting}
              />

              <Input
                label="Postal Code"
                placeholder="e.g. 560058"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                error={errors.postal_code}
                disabled={isSubmitting}
              />
            </div>

            <Input
              label="Country"
              placeholder="e.g. India"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              error={errors.country}
              disabled={isSubmitting}
            />
          </div>
        )}

        {/* TAB 4: CAPABILITIES & GST */}
        {activeTab === 'capabilities' && (
          <div className="space-y-4 pt-1">
            <Input
              label="GST / Tax Identification Number (GSTIN)"
              placeholder="e.g. 29AABCN9988E1Z4"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              error={errors.gst_number}
              disabled={isSubmitting}
              className="uppercase font-mono"
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Serviced Calibration Disciplines / Capabilities
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {STANDARD_CATEGORIES.map((cat) => {
                  const isSelected = servicedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Add custom capability */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add another custom discipline (e.g. Hardness)..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomCategory();
                    }
                  }}
                  className="flex-1 text-xs"
                />
                <Button type="button" variant="secondary" size="sm" onClick={addCustomCategory}>
                  Add Tag
                </Button>
              </div>

              {/* Selected Categories List */}
              {servicedCategories.length > 0 && (
                <div className="mt-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Selected Disciplines ({servicedCategories.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {servicedCategories.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs text-slate-800 border border-slate-200 font-medium"
                      >
                        {c}
                        <button
                          type="button"
                          onClick={() => toggleCategory(c)}
                          className="text-slate-400 hover:text-slate-700 font-bold ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">
                Outsourced Purchase Orders (Step 8+) will reference these vendor capability domains for dispatching items beyond in-house laboratory testing scope.
              </p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Section {tabs.findIndex((t) => t.id === activeTab) + 1} of 4</span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {initialData ? 'Update Vendor' : 'Onboard Vendor'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
