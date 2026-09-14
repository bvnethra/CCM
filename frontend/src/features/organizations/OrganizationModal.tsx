import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Organization, TenantStatus } from '../../types';
import { organizationFormSchema } from '../../lib/schemas';

export interface OrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; code: string; status: TenantStatus }) => Promise<void>;
  initialData?: Organization | null;
  tenantName?: string;
}

export const OrganizationModal: React.FC<OrganizationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  tenantName,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<TenantStatus>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCode(initialData.code);
      setStatus(initialData.status);
    } else {
      setName('');
      setCode('');
      setStatus('active');
    }
    setErrors({});
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parseResult = organizationFormSchema.safeParse({ name, code, status });

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
      title={initialData ? 'Edit Organization' : 'Create Organization'}
      description={`Sub-division scoped under tenant: ${tenantName || 'Current Tenant'}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errors.form}
          </div>
        )}

        <Input
          label="Organization Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aerospace Division"
          error={errors.name}
          required
        />

        <Input
          label="Organization Code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ACME-AERO"
          helperText="Unique code within this tenant"
          error={errors.code}
          required
        />

        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TenantStatus)}
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
            { label: 'Suspended', value: 'suspended' },
          ]}
        />

        <div className="mt-6 flex justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {initialData ? 'Save Changes' : 'Create Organization'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
