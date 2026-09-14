import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { UserProfile } from '../../types';
import { formatDate } from '../../lib/utils';
import { Mail, Phone, Building2, Network, ShieldCheck } from 'lucide-react';

export interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  tenantName?: string;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  isOpen,
  onClose,
  user,
  tenantName,
}) => {
  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Account Details"
      description={`Security profile within tenant: ${tenantName || 'Current Tenant'}`}
      maxWidth="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-6">
        {/* User Identity Header */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-2xs">
            {user.full_name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-slate-900">{user.full_name}</h4>
              <Badge
                variant={
                  user.status === 'active'
                    ? 'success'
                    : user.status === 'inactive'
                    ? 'warning'
                    : 'destructive'
                }
              >
                {user.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {user.id}</p>
          </div>
        </div>

        {/* Contact & Organization Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="w-4 h-4 text-blue-600" />
              <span className="text-slate-400">Email:</span>
              <span className="font-semibold text-slate-900">{user.email}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-4 h-4 text-blue-600" />
              <span className="text-slate-400">Phone:</span>
              <span className="font-semibold text-slate-900">{user.phone || 'Not Provided'}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="text-slate-400">Tenant:</span>
              <span className="font-semibold text-slate-900">{tenantName}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Network className="w-4 h-4 text-violet-600" />
              <span className="text-slate-400">Branch:</span>
              <span className="font-semibold text-slate-900">
                {user.organization ? user.organization.name : 'Global Tenant Level'}
              </span>
            </div>
          </div>
        </div>

        {/* Roles & Permissions */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Assigned RBAC Roles
          </h5>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 capitalize">
              Primary: {user.role.replace('_', ' ')}
            </span>
            {user.roles &&
              user.roles.map((r) => (
                <span
                  key={r.id}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200"
                >
                  {r.name}
                </span>
              ))}
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100">
          <span>Created: {formatDate(user.created_at)}</span>
          <span>Last Updated: {formatDate(user.updated_at)}</span>
        </div>
      </div>
    </Modal>
  );
};
