import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Client } from '../../types';
import { formatDate } from '../../lib/utils';
import { api } from '../../lib/api';
import { useTenant } from '../../context/TenantContext';
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
  History,
  FileText,
  FileSpreadsheet,
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
  const { activeTenant } = useTenant();
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'HISTORY'>('DETAILS');
  const [history, setHistory] = useState<{ requests: any[]; quotations: any[]; invoices: any[] }>({
    requests: [],
    quotations: [],
    invoices: [],
  });
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!client || !isOpen || !activeTenant) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const data = await api.getClientHistory(client.id, activeTenant.id);
        setHistory(data);
      } catch (err) {
        console.error('Failed to fetch client history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [client, isOpen, activeTenant]);

  if (!client) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Client Profile & History Roll-Up Master"
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
            <Briefcase className="w-3.5 h-3.5" />
            Master Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'HISTORY'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Commercial History Roll-Up ({history.requests.length + history.quotations.length + history.invoices.length})
          </button>
        </div>

        {activeTab === 'DETAILS' ? (
          <>
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
          </>
        ) : (
          /* HISTORY ROLL-UP TAB */
          <div className="space-y-5 text-xs">
            {loadingHistory ? (
              <div className="p-8 text-center text-slate-500">Loading client history roll-up...</div>
            ) : (
              <>
                {/* Section 1: Requests */}
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    1. Calibration Requests ({history.requests.length})
                  </h5>
                  {history.requests.length === 0 ? (
                    <div className="text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-dashed">No calibration requests found.</div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                          <tr>
                            <th className="p-2">Request No</th>
                            <th className="p-2">Date</th>
                            <th className="p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {history.requests.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-blue-700">{r.reference_number}</td>
                              <td className="p-2 text-slate-600">{formatDate(r.date)}</td>
                              <td className="p-2"><Badge variant="info" className="text-[10px]">{r.status}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section 2: Quotations */}
                <div className="space-y-2 border-t pt-3">
                  <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                    2. Commercial Quotations (Standalone & Request-Based) ({history.quotations.length})
                  </h5>
                  {history.quotations.length === 0 ? (
                    <div className="text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-dashed">No quotations found.</div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                          <tr>
                            <th className="p-2">Quotation No</th>
                            <th className="p-2">Type</th>
                            <th className="p-2">Date</th>
                            <th className="p-2">Status</th>
                            <th className="p-2 text-right">Total Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {history.quotations.map((q) => (
                            <tr key={q.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-indigo-700">{q.reference_number}</td>
                              <td className="p-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${q.quotation_type === 'STANDALONE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {q.quotation_type || 'REQUEST_BASED'}
                                </span>
                              </td>
                              <td className="p-2 text-slate-600">{formatDate(q.date)}</td>
                              <td className="p-2"><Badge variant="info" className="text-[10px]">{q.status}</Badge></td>
                              <td className="p-2 text-right font-mono font-semibold">₹{(q.total_amount || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section 3: Invoices */}
                <div className="space-y-2 border-t pt-3">
                  <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                    3. Commercial Invoices ({history.invoices.length})
                  </h5>
                  {history.invoices.length === 0 ? (
                    <div className="text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-dashed">No commercial invoices found.</div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                          <tr>
                            <th className="p-2">Invoice No</th>
                            <th className="p-2">Date</th>
                            <th className="p-2">Status</th>
                            <th className="p-2 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {history.invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-emerald-700">{inv.reference_number}</td>
                              <td className="p-2 text-slate-600">{formatDate(inv.date)}</td>
                              <td className="p-2"><Badge variant="info" className="text-[10px]">{inv.status}</Badge></td>
                              <td className="p-2 text-right font-mono font-semibold">₹{(inv.total_amount || 0).toLocaleString()}</td>
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
