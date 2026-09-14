import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Vendor } from '../../types';
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
  Factory,
  Award,
  ShieldCheck,
} from 'lucide-react';

export interface VendorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
  tenantName?: string;
  onEdit?: () => void;
}

export const VendorDetailsModal: React.FC<VendorDetailsModalProps> = ({
  isOpen,
  onClose,
  vendor,
  tenantName,
  onEdit,
}) => {
  if (!vendor) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vendor Master Profile & Capabilities"
      description={`External calibration partner record scoped to tenant: ${tenantName || 'Current Tenant'}`}
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Updated: {formatDate(vendor.updated_at)}</span>
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
                Edit Vendor
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
            <Factory className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-slate-900">{vendor.vendor_name}</h4>
              <Badge
                variant={
                  vendor.status === 'active'
                    ? 'success'
                    : vendor.status === 'inactive'
                    ? 'warning'
                    : 'destructive'
                }
              >
                {vendor.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-blue-700 font-semibold">
                {vendor.vendor_code}
              </span>
              <span>ID: <code className="text-slate-600 text-[11px]">{vendor.id}</code></span>
            </div>
          </div>
        </div>

        {/* Serviced Categories / Disciplines */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
          <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-blue-600" />
            Serviced Calibration Capabilities & Disciplines
          </h5>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Array.isArray(vendor.serviced_categories) && vendor.serviced_categories.length > 0 ? (
              vendor.serviced_categories.map((category) => (
                <span
                  key={category}
                  className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200"
                >
                  {category}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">No specific calibration domains specified.</span>
            )}
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
                  {vendor.contact_person || 'Not specified'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-slate-400 w-12">Email:</span>
                <span className="font-semibold text-slate-900">
                  {vendor.contact_email || 'Not provided'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-slate-400 w-12">Phone:</span>
                <span className="font-semibold text-slate-900">
                  {vendor.contact_phone || 'Not provided'}
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
                  {vendor.organization ? `${vendor.organization.name} (${vendor.organization.code})` : 'Global Tenant Level'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-slate-400 w-16">Facility:</span>
                <span className="font-semibold text-slate-900">
                  {vendor.sub_organization ? vendor.sub_organization.name : 'All Facilities'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Address and Tax Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Physical Address */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              Physical Laboratory Address
            </h5>
            <div className="text-slate-700 leading-relaxed">
              {vendor.address_line_1 ? (
                <>
                  <p>{vendor.address_line_1}</p>
                  {vendor.address_line_2 && <p>{vendor.address_line_2}</p>}
                  <p>
                    {[vendor.city, vendor.state, vendor.postal_code].filter(Boolean).join(', ')}
                  </p>
                  <p className="font-semibold text-slate-900">{vendor.country || 'India'}</p>
                </>
              ) : (
                <p className="text-slate-400 italic">No physical address on file.</p>
              )}
            </div>
          </div>

          {/* Tax Information */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-blue-600" />
              Tax Information
            </h5>
            <div className="space-y-1.5 text-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">GSTIN:</span>
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {vendor.gst_number || 'N/A'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Registered external laboratory partner qualified for purchase order outsourcing workflows.
              </p>
            </div>
          </div>
        </div>

        {/* Audit Footnote */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>Onboarded: {formatDate(vendor.created_at)}</span>
          <span className="font-medium text-emerald-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Verified Vendor Partner
          </span>
        </div>
      </div>
    </Modal>
  );
};
