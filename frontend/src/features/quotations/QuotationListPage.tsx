import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Quotation, QuotationStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import {
  FileText,
  Plus,
  Search,
  Building2,
  CheckCircle2,
  Clock,
  Send,
  ExternalLink,
} from 'lucide-react';

interface QuotationListPageProps {
  onSelectQuotation?: (quotationId: string) => void;
  onCreateNew?: () => void;
}

export const QuotationListPage: React.FC<QuotationListPageProps> = ({
  onSelectQuotation,
  onCreateNew,
}) => {
  const { activeTenant } = useTenant();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchQuotations = async () => {
    if (!activeTenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getQuotations(activeTenant.id, {
        status: statusFilter,
        quotationType: typeFilter,
        search: searchTerm,
      });
      setQuotations(res);
    } catch (err) {
      console.error('Failed to fetch quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [activeTenant, statusFilter, typeFilter, searchTerm]);

  // Metrics
  const totalQuotations = quotations.length;
  const draftCount = quotations.filter((q) => q.status === 'DRAFT').length;
  const pendingApprovalCount = quotations.filter((q) => q.status === 'PENDING_APPROVAL').length;
  const approvedCount = quotations.filter((q) => q.status === 'APPROVED').length;
  const sentCount = quotations.filter((q) => q.status === 'SENT_TO_CLIENT').length;
  const clientApprovedCount = quotations.filter((q) => q.status === 'CLIENT_APPROVED').length;

  const renderStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="warning">Draft</Badge>;
      case 'PENDING_APPROVAL':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'APPROVED':
        return <Badge variant="info">Approved</Badge>;
      case 'SENT_TO_CLIENT':
        return <Badge variant="purple">Sent to Client</Badge>;
      case 'CLIENT_APPROVED':
        return <Badge variant="success">Client Approved</Badge>;
      case 'CLIENT_REJECTED':
        return <Badge variant="destructive">Client Rejected</Badge>;
      case 'EXPIRED':
        return <Badge variant="default">Expired</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const columns: Column<Quotation>[] = [
    {
      header: 'Quotation Number',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 font-mono text-xs flex items-center gap-1.5">
            {row.quotation_number}
            {row.version_number > 1 && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                v{row.version_number}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            Date: {new Date(row.quotation_date).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      header: 'Type',
      render: (row) => {
        const isStandalone = row.quotation_type === 'STANDALONE' || !row.request_id;
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isStandalone ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
            {isStandalone ? 'STANDALONE' : 'REQUEST_BASED'}
          </span>
        );
      },
    },
    {
      header: 'Client Details',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900 flex items-center gap-1.5 text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {row.client?.client_name || 'Client Record'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {row.client?.client_code} | GST: {row.client?.gst_number || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Request #',
      render: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {row.request?.request_number || (row.quotation_type === 'STANDALONE' || !row.request_id ? <em className="text-purple-600 font-sans">None (Standalone)</em> : 'N/A')}
        </span>
      ),
    },
    {
      header: 'Valid Until',
      render: (row) => (
        <span className="text-xs text-slate-600 font-mono">
          {new Date(row.valid_until).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Total Amount (₹)',
      render: (row) => (
        <div className="font-semibold text-slate-900 font-mono text-right text-xs">
          ₹{row.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      header: 'Actions',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelectQuotation && onSelectQuotation(row.id)}
          className="inline-flex items-center gap-1.5 text-xs"
        >
          View Details
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-indigo-600" />
            Commercial Quotations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage Standalone (Mode B) and Request-Based (Mode A) commercial quotations in Indian Rupees (₹).
          </p>
        </div>

        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Quotation
          </Button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard
          title="Total Quotations"
          value={totalQuotations}
          icon={<FileText className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          title="Drafts"
          value={draftCount}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          title="Pending Approval"
          value={pendingApprovalCount}
          icon={<Clock className="w-5 h-5 text-purple-600" />}
        />
        <StatCard
          title="Approved"
          value={approvedCount}
          icon={<CheckCircle2 className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          title="Sent to Client"
          value={sentCount}
          icon={<Send className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          title="Client Approved"
          value={clientApprovedCount}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        />
      </div>

      {/* Filters & Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search quotation #, client, request..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border-slate-300 w-44"
            >
              <option value="ALL">All Types</option>
              <option value="STANDALONE">Standalone Mode B</option>
              <option value="REQUEST_BASED">Request-Based Mode A</option>
            </Select>

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border-slate-300 w-44"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="SENT_TO_CLIENT">Sent to Client</option>
              <option value="CLIENT_APPROVED">Client Approved</option>
              <option value="CLIENT_REJECTED">Client Rejected</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Quotations List Table */}
      <Card className="p-0 overflow-hidden">
        <Table
          columns={columns}
          data={quotations}
          keyExtractor={(item) => item.id}
          isLoading={loading}
          emptyMessage="No commercial quotations found."
        />
      </Card>
    </div>
  );
};
