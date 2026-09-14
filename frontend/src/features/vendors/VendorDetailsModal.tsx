import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Vendor } from '../../types';
import { formatDate } from '../../lib/utils';
import { api } from '../../lib/api';
import { useTenant } from '../../context/TenantContext';
import {
  Building2,
  Mail,
  Phone,
  User,
  MapPin,
  Network,
  Clock,
  Factory,
  Award,
  ShieldCheck,
  History,
  FileCheck,
  ShoppingBag,
  Send,
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
  const { activeTenant } = useTenant();
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'INTERNAL_HISTORY'>('DETAILS');
  const [history, setHistory] = useState<{ purchase_orders: any[]; outsource_requests: any[]; calibration_records: any[] }>({
    purchase_orders: [],
    outsource_requests: [],
    calibration_records: [],
  });
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!vendor || !isOpen || !activeTenant) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const data = await api.getVendorHistory(vendor.id, activeTenant.id);
        setHistory(data);
      } catch (err) {
        console.error('Failed to fetch vendor history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [vendor, isOpen, activeTenant]);

  if (!vendor) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vendor Master Profile & Internal History Roll-Up"
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
        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('DETAILS')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'DETAILS'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            Vendor Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('INTERNAL_HISTORY')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'INTERNAL_HISTORY'
                ? 'border-purple-600 text-purple-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Internal Outsource History ({history.purchase_orders.length + history.outsource_requests.length})
          </button>
        </div>

        {activeTab === 'DETAILS' ? (
          <>
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

              {/* GSTIN / Compliance */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                  Vendor Tax & Registration Details
                </h5>
                <div className="space-y-1.5 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">GSTIN / Tax ID:</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {vendor.gst_number || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* INTERNAL VENDOR HISTORY TAB */
          <div className="space-y-5 text-xs">
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-purple-900 font-medium">
              Internal Vendor History: Vendor outsourcing costs & Purchase Orders are strictly internal and NEVER exposed to clients.
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-slate-500">Loading vendor internal history...</div>
            ) : (
              <>
                {/* Section 1: Purchase Orders */}
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-purple-600" />
                    1. Purchase Orders Issued ({history.purchase_orders.length})
                  </h5>
                  {history.purchase_orders.length === 0 ? (
                    <div className="text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-dashed">No purchase orders recorded for this vendor.</div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                          <tr>
                            <th className="p-2">PO Number</th>
                            <th className="p-2">Date</th>
                            <th className="p-2">Status</th>
                            <th className="p-2 text-right">Internal Cost (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {history.purchase_orders.map((po) => (
                            <tr key={po.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-purple-700">{po.po_number}</td>
                              <td className="p-2 text-slate-600">{formatDate(po.date)}</td>
                              <td className="p-2"><Badge variant="info" className="text-[10px]">{po.status}</Badge></td>
                              <td className="p-2 text-right font-mono font-semibold text-slate-900">₹{(po.total_cost || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section 2: Outsourced Items */}
                <div className="space-y-2 border-t pt-3">
                  <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                    2. Outsourced Requests ({history.outsource_requests.length})
                  </h5>
                  {history.outsource_requests.length === 0 ? (
                    <div className="text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-dashed">No outsourced calibration movements recorded.</div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                          <tr>
                            <th className="p-2">Outsource Request ID</th>
                            <th className="p-2">Status</th>
                            <th className="p-2">Dispatch Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {history.outsource_requests.map((out) => (
                            <tr key={out.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-slate-800">{out.id}</td>
                              <td className="p-2"><Badge variant="info" className="text-[10px]">{out.outsource_status}</Badge></td>
                              <td className="p-2 text-slate-600">{formatDate(out.dispatch_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Audit Footnote */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>Registered: {formatDate(vendor.created_at)}</span>
          <span className="font-medium text-emerald-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Verified External Vendor
          </span>
        </div>
      </div>
    </Modal>
  );
};
