import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Tenant, TenantStatus } from '../../types';
import { tenantFormSchema, TenantFormValues } from '../../lib/schemas';
import { Building2, MapPin, UserCheck, ShieldCheck, Mail, Phone, Lock } from 'lucide-react';

export interface TenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TenantFormValues) => Promise<void>;
  initialData?: Tenant | null;
}

export const TenantModal: React.FC<TenantModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [tenantType, setTenantType] = useState('Commercial Calibration Laboratory');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [postalCode, setPostalCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [status, setStatus] = useState<TenantStatus>('active');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR');
  const [complianceStandard, setComplianceStandard] = useState('ISO/IEC 17025');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setCode(initialData.code || '');
      setTenantType(initialData.tenant_type || 'Commercial Calibration Laboratory');
      setRegistrationNumber(initialData.registration_number || '');
      setGstNumber(initialData.gst_number || '');
      setTenantEmail(initialData.tenant_email || '');
      setTenantPhone(initialData.tenant_phone || '');
      setAddressLine1(initialData.address_line_1 || '');
      setAddressLine2(initialData.address_line_2 || '');
      setCity(initialData.city || '');
      setState(initialData.state || '');
      setCountry(initialData.country || 'India');
      setPostalCode(initialData.postal_code || '');
      setAdminName(initialData.admin_name || '');
      setAdminEmail(initialData.admin_email || '');
      setAdminPassword(initialData.admin_password || 'Password123!');
      setStatus(initialData.status || 'active');
      setTimezone(initialData.settings?.timezone || 'Asia/Kolkata');
      setCurrency(initialData.settings?.currency || 'INR');
      setComplianceStandard(initialData.settings?.complianceStandard || 'ISO/IEC 17025');
    } else {
      setName('');
      setCode('');
      setTenantType('Commercial Calibration Laboratory');
      setRegistrationNumber('');
      setGstNumber('');
      setTenantEmail('');
      setTenantPhone('');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setState('');
      setCountry('India');
      setPostalCode('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      setStatus('active');
      setTimezone('Asia/Kolkata');
      setCurrency('INR');
      setComplianceStandard('ISO/IEC 17025');
    }
    setErrors({});
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData: TenantFormValues = {
      name,
      code,
      tenant_type: tenantType,
      registration_number: registrationNumber,
      gst_number: gstNumber,
      tenant_email: tenantEmail,
      tenant_phone: tenantPhone,
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      city,
      state,
      country,
      postal_code: postalCode,
      admin_name: adminName,
      admin_email: adminEmail,
      admin_password: adminPassword,
      status,
      timezone,
      currency,
      complianceStandard,
    };

    const parseResult = tenantFormSchema.safeParse(formData);

    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      parseResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        code: code.toUpperCase(),
      });
      onClose();
    } catch (err: any) {
      setErrors({ form: err.message || 'An error occurred while saving tenant details' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Tenant Profile' : 'Add New Tenant'}
      description="Provision an isolated multi-tenant commercial calibration entity and administrator account"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {errors.form && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errors.form}
          </div>
        )}

        {/* Section 1: Tenant Profile & Identifiers */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>1. Tenant Organization Details</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Tenant Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Calibration Labs Pvt Ltd"
              error={errors.name}
              required
            />

            <Input
              label="Tenant Code / ID"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. ACME-CAL"
              helperText="Unique alphanumeric identifier for multi-tenant isolation"
              error={errors.code}
              required
              disabled={!!initialData}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Tenant Type"
              value={tenantType}
              onChange={(e) => setTenantType(e.target.value)}
              options={[
                { label: 'Commercial Calibration Laboratory', value: 'Commercial Calibration Laboratory' },
                { label: 'Industrial In-House Metrology Lab', value: 'Industrial In-House Metrology Lab' },
                { label: 'OEM Service & Calibration Center', value: 'OEM Service & Calibration Center' },
                { label: 'Secondary Standard Metrology Lab', value: 'Secondary Standard Metrology Lab' },
              ]}
              error={errors.tenant_type}
            />

            <Input
              label="Registration Number"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="e.g. REG-2025-99881"
              error={errors.registration_number}
              required
            />

            <Input
              label="GST Number"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              placeholder="e.g. 27AAAAA0000A1Z5"
              error={errors.gst_number}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Tenant Contact Email"
              type="email"
              value={tenantEmail}
              onChange={(e) => setTenantEmail(e.target.value)}
              placeholder="contact@acmecal.com"
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              error={errors.tenant_email}
              required
            />

            <Input
              label="Tenant Phone Number"
              value={tenantPhone}
              onChange={(e) => setTenantPhone(e.target.value)}
              placeholder="+91 98765 43210"
              leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
              error={errors.tenant_phone}
              required
            />
          </div>
        </div>

        {/* Section 2: Address & Location */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>2. Registered Address & Location</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Address Line 1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Plot 42, Industrial Metrology Zone"
              error={errors.address_line_1}
              required
            />

            <Input
              label="Address Line 2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Phase 2, Electronic City"
              error={errors.address_line_2}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bengaluru"
              error={errors.city}
              required
            />

            <Input
              label="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="Karnataka"
              error={errors.state}
              required
            />

            <Input
              label="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="India"
              error={errors.country}
              required
            />

            <Input
              label="Pincode / Postal Code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="560100"
              error={errors.postal_code}
              required
            />
          </div>
        </div>

        {/* Section 3: Admin Account Provisioning */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-blue-200 pb-2 text-xs font-bold uppercase tracking-wider text-blue-900">
            <UserCheck className="w-4 h-4 text-blue-700" />
            <span>3. Initial Tenant Admin Account</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Admin Full Name"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="e.g. Marcus Vance"
              leftIcon={<UserCheck className="w-4 h-4 text-slate-400" />}
              error={errors.admin_name}
              required
            />

            <Input
              label="Admin Email Address"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="marcus.v@acmecal.com"
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              error={errors.admin_email}
              required
            />

            <Input
              label="Admin Password"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
              helperText="Initial password for admin login"
              error={errors.admin_password}
              required
            />
          </div>
        </div>

        {/* Section 4: Status & Regional Standards */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span>4. Status & Compliance Configuration</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Select
              label="Initial Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TenantStatus)}
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
                { label: 'Suspended', value: 'suspended' },
              ]}
            />

            <Select
              label="Compliance Standard"
              value={complianceStandard}
              onChange={(e) => setComplianceStandard(e.target.value)}
              options={[
                { label: 'ISO/IEC 17025', value: 'ISO/IEC 17025' },
                { label: 'ANSI/NCSL Z540.3', value: 'ANSI/NCSL Z540.3' },
                { label: 'UKAS LAB 12', value: 'UKAS LAB 12' },
                { label: 'Good Lab Practice (GLP)', value: 'GLP' },
              ]}
            />

            <Select
              label="Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={[
                { label: 'Asia/Kolkata (IST)', value: 'Asia/Kolkata' },
                { label: 'UTC', value: 'UTC' },
                { label: 'America/New_York (EST)', value: 'America/New_York' },
                { label: 'Europe/London (GMT)', value: 'Europe/London' },
              ]}
            />

            <Select
              label="Base Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              options={[
                { label: 'INR (₹)', value: 'INR' },
                { label: 'USD ($)', value: 'USD' },
                { label: 'EUR (€)', value: 'EUR' },
                { label: 'GBP (£)', value: 'GBP' },
              ]}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="sticky bottom-0 bg-white pt-4 pb-1 border-t border-slate-100 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {initialData ? 'Save Changes' : 'Provision Tenant Account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
