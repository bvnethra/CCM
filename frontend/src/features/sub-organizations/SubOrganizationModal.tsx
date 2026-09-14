import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { SubOrganization, Organization, TenantStatus } from '../../types';
import { subOrganizationFormSchema } from '../../lib/schemas';

export interface SubOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { organization_id: string; name: string; code: string; status: TenantStatus }) => Promise<void>;
  initialData?: SubOrganization | null;
  organizations: Organization[];
  tenantName?: string;
}

export const SubOrganizationModal: React.FC<SubOrganizationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  organizations,
  tenantName,
}) => {
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<TenantStatus>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setOrganizationId(initialData.organization_id);
      setName(initialData.name);
      setCode(initialData.code);
      setStatus(initialData.status);
    } else {
      setOrganizationId(organizations[0]?.id || '');
      setName('');
      setCode('');
      setStatus('active');
    }
    setErrors({});
  }, [initialData, isOpen, organizations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parseResult = subOrganizationFormSchema.safeParse({
      organization_id: organizationId,
      name,
      code,
      status,
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
        organization_id: organizationId,
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
      title={initialData ? 'Edit Facility / Sub-Organization' : 'Create Facility / Sub-Organization'}
      description={`Testing facility scoped under tenant: ${tenantName || 'Current Tenant'}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errors.form}
          </div>
        )}

        <Select
          label="Parent Organization"
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          options={organizations.map((org) => ({
            label: `${org.name} (${org.code})`,
            value: org.id,
          }))}
          disabled={!!initialData || organizations.length === 0}
          error={errors.organization_id}
          helperText="Only organizations from your current tenant are selectable"
        />

        <Input
          label="Facility / Lab Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pressure & Vacuum Testing Lab"
          error={errors.name}
          required
        />

        <Input
          label="Facility Code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ACME-AERO-PVT"
          helperText="Unique facility identifier within the organization"
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
          <Button type="submit" isLoading={isSubmitting} disabled={organizations.length === 0}>
            {initialData ? 'Save Changes' : 'Create Sub-Organization'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
