import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Role, Permission } from '../../types';
import { roleFormSchema } from '../../lib/schemas';

export interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; code: string; description?: string | null; permission_ids?: string[] }) => Promise<void>;
  initialData?: Role | null;
  permissions: Permission[];
  tenantName?: string;
}

export const RoleModal: React.FC<RoleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  permissions,
  tenantName,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCode(initialData.code);
      setDescription(initialData.description || '');
      setSelectedPermissionIds(initialData.permissions ? initialData.permissions.map((p) => p.id) : []);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setSelectedPermissionIds([]);
    }
    setErrors({});
  }, [initialData, isOpen]);

  const handlePermissionToggle = (permId: string) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  // Group permissions by module
  const modules = Array.from(new Set(permissions.map((p) => p.module)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parseResult = roleFormSchema.safeParse({
      name,
      code: code.toLowerCase(),
      description: description || undefined,
      permission_ids: selectedPermissionIds,
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
        code: code.toLowerCase(),
        description: description || null,
        permission_ids: selectedPermissionIds,
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
      title={initialData ? 'Edit Role' : 'Create Custom Role'}
      description={`RBAC role definition scoped under: ${tenantName || 'Current Tenant'}`}
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
            label="Role Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Quality Auditor"
            error={errors.name}
            required
          />

          <Input
            label="Role Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase())}
            placeholder="e.g. quality_auditor"
            helperText="Unique lowercase code"
            error={errors.code}
            required
            disabled={!!initialData}
          />
        </div>

        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the responsibilities and scope"
          error={errors.description}
        />

        {/* Permissions Selection grouped by module */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700">
              Assigned Permissions ({selectedPermissionIds.length} selected)
            </label>
            <button
              type="button"
              onClick={() => {
                if (selectedPermissionIds.length === permissions.length) {
                  setSelectedPermissionIds([]);
                } else {
                  setSelectedPermissionIds(permissions.map((p) => p.id));
                }
              }}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
            >
              {selectedPermissionIds.length === permissions.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="space-y-3 max-h-56 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-lg">
            {modules.map((mod) => (
              <div key={mod} className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {mod}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {permissions
                    .filter((p) => p.module === mod)
                    .map((p) => (
                      <label
                        key={p.id}
                        className={`flex items-start gap-2 p-1.5 rounded border text-xs cursor-pointer transition-colors ${
                          selectedPermissionIds.includes(p.id)
                            ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissionIds.includes(p.id)}
                          onChange={() => handlePermissionToggle(p.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{p.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{p.code}</span>
                        </div>
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {initialData ? 'Save Role' : 'Create Role'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
