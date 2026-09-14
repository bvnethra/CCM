import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Client, Organization, SubOrganization, TenantStatus } from '../../types';
import { clientFormSchema, ClientFormValues } from '../../lib/schemas';
import { Building2, User, MapPin, Receipt, AlertCircle } from 'lucide-react';

export interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ClientFormValues) => Promise<void>;
  initialData?: Client | null;
  organizations: Organization[];
  subOrganizations: SubOrganization[];
  tenantName?: string;
}

type TabType = 'general' | 'contact' | 'address' | 'billing';

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  organizations,
  subOrganizations,
  tenantName,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [clientCode, setClientCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [postalCode, setPostalCode] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [subOrgId, setSubOrgId] = useState('');
  const [status, setStatus] = useState<TenantStatus>('active');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setClientCode(initialData.client_code);
      setClientName(initialData.client_name);
      setContactPerson(initialData.contact_person || '');
      setContactEmail(initialData.contact_email || '');
      setContactPhone(initialData.contact_phone || '');
      setAddressLine1(initialData.address_line_1 || '');
      setAddressLine2(initialData.address_line_2 || '');
      setCity(initialData.city || '');
      setState(initialData.state || '');
      setCountry(initialData.country || 'India');
      setPostalCode(initialData.postal_code || '');
      setBillingAddress(initialData.billing_address || '');
      setGstNumber(initialData.gst_number || '');
      setOrganizationId(initialData.organization_id || '');
      setSubOrgId(initialData.sub_org_id || '');
      setStatus(initialData.status);
    } else {
      setClientCode('');
      setClientName('');
      setContactPerson('');
      setContactEmail('');
      setContactPhone('');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setState('');
      setCountry('India');
      setPostalCode('');
      setBillingAddress('');
      setGstNumber('');
      setOrganizationId('');
      setSubOrgId('');
      setStatus('active');
    }
    setErrors({});
    setApiError(null);
    setActiveTab('general');
  }, [initialData, isOpen]);

  const filteredSubOrgs = subOrganizations.filter(
    (s) => !organizationId || s.organization_id === organizationId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setApiError(null);

    const formData: ClientFormValues = {
      client_code: clientCode.trim(),
      client_name: clientName.trim(),
      contact_person: contactPerson.trim() || undefined,
      contact_email: contactEmail.trim() || undefined,
      contact_phone: contactPhone.trim() || undefined,
      address_line_1: addressLine1.trim() || undefined,
      address_line_2: addressLine2.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      country: country.trim() || 'India',
      postal_code: postalCode.trim() || undefined,
      billing_address: billingAddress.trim() || undefined,
      gst_number: gstNumber.trim() || undefined,
      organization_id: organizationId || undefined,
      sub_org_id: subOrgId || undefined,
      status,
    };

    const validation = clientFormSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);

      // Auto-switch to tab containing error
      if (fieldErrors.client_code || fieldErrors.client_name || fieldErrors.status) {
        setActiveTab('general');
      } else if (fieldErrors.contact_person || fieldErrors.contact_email || fieldErrors.contact_phone) {
        setActiveTab('contact');
      } else if (fieldErrors.address_line_1 || fieldErrors.city || fieldErrors.postal_code) {
        setActiveTab('address');
      } else if (fieldErrors.gst_number || fieldErrors.billing_address) {
        setActiveTab('billing');
      }
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(validation.data);
      onClose();
    } catch (err: any) {
      setApiError(err.message || 'Failed to save client. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General & Branch', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'contact', label: 'Contact Details', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'address', label: 'Address', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'billing', label: 'Billing & GST', icon: <Receipt className="w-3.5 h-3.5" /> },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Client Profile' : 'Register New Client'}
      description={`Commercial client record scoped to tenant: ${tenantName || 'Current Tenant'}`}
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
                label="Client Code *"
                placeholder="e.g. CLI-AERO-001"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                error={errors.client_code}
                disabled={isSubmitting}
                className="uppercase font-mono"
              />

              <Input
                label="Client Legal Name *"
                placeholder="e.g. Aerospace Dynamics India Pvt Ltd"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                error={errors.client_name}
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
                label="Sub-Organization / Testing Unit"
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
                { label: 'Active - Authorized for Commercial Orders', value: 'active' },
                { label: 'Inactive - Temporary Hold', value: 'inactive' },
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
              placeholder="e.g. Rohan Sharma"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              error={errors.contact_person}
              disabled={isSubmitting}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="email"
                label="Contact Email"
                placeholder="e.g. rohan.sharma@aerodynamics.in"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                error={errors.contact_email}
                disabled={isSubmitting}
              />

              <Input
                label="Contact Phone"
                placeholder="e.g. +91 98765 43210"
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
              placeholder="e.g. Plot 42, Electronics City Phase 1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              error={errors.address_line_1}
              disabled={isSubmitting}
            />

            <Input
              label="Address Line 2 (Optional)"
              placeholder="e.g. Near Tech Park Road, Industrial Area"
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
                placeholder="e.g. 560100"
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

        {/* TAB 4: BILLING & GST */}
        {activeTab === 'billing' && (
          <div className="space-y-4 pt-1">
            <Input
              label="GST / Tax Identification Number (GSTIN)"
              placeholder="e.g. 29AABCA1234F1Z5"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              error={errors.gst_number}
              disabled={isSubmitting}
              className="uppercase font-mono"
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Billing Address
              </label>
              <textarea
                rows={3}
                placeholder="Enter complete legal billing address for invoices and calibration reports..."
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              />
              {errors.billing_address && (
                <p className="mt-1 text-[11px] text-red-600">{errors.billing_address}</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">
                Tax identification (GSTIN) will be used for automated invoicing and calibration certificate validation in commercial steps.
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
              {initialData ? 'Update Client' : 'Register Client'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
