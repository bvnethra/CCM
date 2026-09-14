import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { UserProfile, Organization, SubOrganization, Role, UserRole, TenantStatus } from '../../types';
import { userFormSchema } from '../../lib/schemas';

export interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    full_name: string;
    email: string;
    phone?: string | null;
    organization_id?: string | null;
    sub_organization_id?: string | null;
    role: UserRole;
    status: TenantStatus;
    role_ids?: string[];
  }) => Promise<void>;
  initialData?: UserProfile | null;
  organizations: Organization[];
  subOrganizations: SubOrganization[];
  roles: Role[];
  tenantName?: string;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  organizations,
  subOrganizations,
  roles,
  tenantName,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [subOrganizationId, setSubOrganizationId] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [status, setStatus] = useState<TenantStatus>('active');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.full_name);
      setEmail(initialData.email);
      setPhone(initialData.phone || '');
      setOrganizationId(initialData.organization_id || '');
      setSubOrganizationId(initialData.sub_organization_id || '');
      setRole(initialData.role);
      setStatus(initialData.status);
      setSelectedRoleIds(initialData.roles ? initialData.roles.map((r) => r.id) : []);
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setOrganizationId(organizations[0]?.id || '');
      setSubOrganizationId('');
      setRole('lab_user');
      setStatus('active');
      setSelectedRoleIds([]);
    }
    setErrors({});
  }, [initialData, isOpen, organizations]);

  // Filter sub-orgs by selected organization
  const availableSubOrgs = subOrganizations.filter((s) =>
    organizationId ? s.organization_id === organizationId : true
  );

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parseResult = userFormSchema.safeParse({
      full_name: fullName,
      email,
      phone: phone || undefined,
      organization_id: organizationId || undefined,
      sub_organization_id: subOrganizationId || undefined,
      role,
      status,
      role_ids: selectedRoleIds,
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
        full_name: fullName,
        email: email.toLowerCase(),
        phone: phone || null,
        organization_id: organizationId || null,
        sub_organization_id: subOrganizationId || null,
        role,
        status,
        role_ids: selectedRoleIds,
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
      title={initialData ? 'Edit User Profile' : 'Add New User'}
      description={`User scoped under tenant: ${tenantName || 'Current Tenant'}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errors.form}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. David Chen"
            error={errors.full_name}
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. david.chen@company.com"
            error={errors.email}
            required
            disabled={!!initialData}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone Number (Optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +1 (555) 345-6712"
            error={errors.phone}
          />

          <Select
            label="Primary Role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            options={[
              { label: 'Super Admin', value: 'super_admin' },
              { label: 'Tenant Admin', value: 'tenant_admin' },
              { label: 'Organization Admin', value: 'org_admin' },
              { label: 'Manager', value: 'manager' },
              { label: 'Lab User', value: 'lab_user' },
              { label: 'Collection Agent', value: 'collection_agent' },
              { label: 'Commercial User', value: 'commercial_user' },
              { label: 'Dispatch User', value: 'dispatch_user' },
              { label: 'Viewer', value: 'viewer' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Branch Organization"
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
              setSubOrganizationId('');
            }}
            options={[
              { label: 'None / Global Tenant Level', value: '' },
              ...organizations.map((org) => ({
                label: org.name,
                value: org.id,
              })),
            ]}
          />

          <Select
            label="Facility / Sub-Organization"
            value={subOrganizationId}
            onChange={(e) => setSubOrganizationId(e.target.value)}
            disabled={!organizationId || availableSubOrgs.length === 0}
            options={[
              { label: 'None / Organization Level', value: '' },
              ...availableSubOrgs.map((sub) => ({
                label: sub.name,
                value: sub.id,
              })),
            ]}
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
        </div>

        {/* Assigned RBAC Roles */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700">
            Assigned RBAC Security Roles
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
            {roles.map((r) => (
              <label
                key={r.id}
                className={`flex items-center gap-2 text-xs p-1.5 rounded border cursor-pointer transition-colors ${
                  selectedRoleIds.includes(r.id)
                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRoleIds.includes(r.id)}
                  onChange={() => handleRoleToggle(r.id)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{r.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {initialData ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
