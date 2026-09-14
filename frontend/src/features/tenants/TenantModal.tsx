import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Tenant, TenantStatus } from '../../types';
import { tenantFormSchema } from '../../lib/schemas';

export interface TenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    code: string;
    status: TenantStatus;
    settings: { timezone: string; currency: string; complianceStandard: string };
  }) => Promise<void>;
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
  const [status, setStatus] = useState<TenantStatus>('active');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR');
  const [complianceStandard, setComplianceStandard] = useState('ISO/IEC 17025');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCode(initialData.code);
      setStatus(initialData.status);
      setTimezone(initialData.settings?.timezone || 'Asia/Kolkata');
      setCurrency(initialData.settings?.currency || 'INR');
      setComplianceStandard(initialData.settings?.complianceStandard || 'ISO/IEC 17025');
    } else {
      setName('');
      setCode('');
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

    const parseResult = tenantFormSchema.safeParse({
      name,
      code,
      status,
      timezone,
      currency,
      complianceStandard,
    });

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
        name,
        code: code.toUpperCase(),
        status,
        settings: { timezone, currency, complianceStandard },
      });
      onClose();
    } catch (err: any) {
      setErrors({ form: err.message || 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Tenant' : 'Add New Tenant'}
      description="Provision an isolated multi-tenant boundary for a calibration commercial entity"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errors.form}
          </div>
        )}

        <Input
          label="Tenant Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Calibration Labs"
          error={errors.name}
          required
        />

        <Input
          label="Unique Tenant Code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ACME-CAL"
          helperText="Alphanumeric unique identifier for tenant routing"
          error={errors.code}
          required
          disabled={!!initialData}
        />

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            options={[
              { label: 'UTC', value: 'UTC' },
              { label: 'America/New_York (EST)', value: 'America/New_York' },
              { label: 'America/Los_Angeles (PST)', value: 'America/Los_Angeles' },
              { label: 'Europe/London (GMT)', value: 'Europe/London' },
              { label: 'Asia/Kolkata (IST)', value: 'Asia/Kolkata' },
            ]}
          />

          <Select
            label="Base Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { label: 'USD ($)', value: 'USD' },
              { label: 'EUR (€)', value: 'EUR' },
              { label: 'GBP (£)', value: 'GBP' },
              { label: 'INR (₹)', value: 'INR' },
            ]}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {initialData ? 'Save Changes' : 'Add Tenant'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
