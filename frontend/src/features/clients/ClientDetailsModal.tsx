import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Client } from '../../types';
import { formatDate } from '../../lib/utils';
import {
  Building2,
  Mail,
  Phone,
  User,
  MapPin,
  Receipt,
  Network,
  Clock,
  Briefcase,
  FileCheck,
} from 'lucide-react';

export interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  tenantName?: string;
  onEdit?: () => void;
}

export const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({
  isOpen,
  onClose,
  client,
  tenantName,
  onEdit,
}) => {
  if (!client) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Client Profile & Commercial Master"
      description={`Master entity record within tenant: ${tenantName || 'Current Tenant'}`}
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Updated: {formatDate(client.updated_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {onEdit && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
              >
                Edit Client
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header Summary Banner */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-2xs">
            <Briefcase className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-slate-900">{client.client_name}</h4>
              <Badge
                variant={
                  client.status === 'active'
                    ? 'success'
                    : client.status === 'inactive'
                    ? 'warning'
                    : 'destructive'
                }
              >
                {client.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-blue-700 font-semibold">
                {client.client_code}
              </span>
              <span>ID: <code className="text-slate-600 text-[11px]">{client.id}</code></span>
            </div>
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Contact Person Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Primary Contact
            </h5>
            <div className="space-y-2 text-slate-600">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16">Name:</span>
                <span className="font-semibold text-slate-900">
                  {client.contact_person || 'Not specified'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-slate-400 w-12">Email:</span>
                <span className="font-semibold text-slate-900">
                  {client.contact_email || 'Not provided'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-slate-400 w-12">Phone:</span>
                <span className="font-semibold text-slate-900">
                  {client.contact_phone || 'Not provided'}
                </span>
              </div>
            </div>
          </div>

          {/* Organization & Scope Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Operational Scope
            </h5>
            <div className="space-y-2 text-slate-600">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-20">Tenant:</span>
                <span className="font-semibold text-slate-900">{tenantName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Network className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                <span className="text-slate-400 w-16">Branch:</span>
                <span className="font-semibold text-slate-900">
                  {client.organization ? `${client.organization.name} (${client.organization.code})` : 'Global Tenant Level'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-slate-400 w-16">Facility:</span>
                <span className="font-semibold text-slate-900">
                  {client.sub_organization ? client.sub_organization.name : 'All Facilities'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Address and Billing Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Physical Address */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              Physical Address
            </h5>
            <div className="text-slate-700 leading-relaxed">
              {client.address_line_1 ? (
                <>
                  <p>{client.address_line_1}</p>
                  {client.address_line_2 && <p>{client.address_line_2}</p>}
                  <p>
                    {[client.city, client.state, client.postal_code].filter(Boolean).join(', ')}
                  </p>
                  <p className="font-semibold text-slate-900">{client.country || 'India'}</p>
                </>
              ) : (
                <p className="text-slate-400 italic">No physical address on file.</p>
              )}
            </div>
          </div>

          {/* Tax & Billing */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-blue-600" />
              Tax & Billing Details
            </h5>
            <div className="space-y-1.5 text-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">GSTIN:</span>
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {client.gst_number || 'N/A'}
                </span>
              </div>
              <div className="mt-2">
                <span className="text-slate-400 block mb-0.5">Billing Address:</span>
                <p className="text-slate-700 leading-relaxed">
                  {client.billing_address || client.address_line_1 || 'Same as physical address'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Audit & Compliance Footnote */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>Registered: {formatDate(client.created_at)}</span>
          <span className="font-medium text-emerald-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Verified Commercial Master Entity
          </span>
        </div>
      </div>
    </Modal>
  );
};
