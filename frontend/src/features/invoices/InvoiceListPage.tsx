import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Invoice, InvoiceType, InvoiceStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import {
  FileCheck2,
  Plus,
  Search,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Zap,
  Layers,
} from 'lucide-react';

interface InvoiceListPageProps {
  onSelectInvoice?: (invoiceId: string) => void;
  onCreateNew?: () => void;
}

export const InvoiceListPage: React.FC<InvoiceListPageProps> = ({
  onSelectInvoice,
  onCreateNew,
}) => {
  const { activeTenant } = useTenant();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchInvoices = async () => {
    if (!activeTenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getInvoices(activeTenant.id, {
        status: statusFilter,
        invoiceType: typeFilter,
        search: searchTerm,
      });
      setInvoices(res);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [activeTenant, statusFilter, typeFilter, searchTerm]);

  // Metrics
  const totalInvoices = invoices.length;
  const draftCount = invoices.filter((i) => i.status === 'DRAFT').length;
  const readyCount = invoices.filter((i) => i.status === 'READY').length;
  const partialCount = invoices.filter((i) => i.invoice_type === 'PARTIAL').length;
  const urgentCount = invoices.filter((i) => i.invoice_type === 'URGENT').length;
  const cancelledCount = invoices.filter((i) => i.status === 'CANCELLED').length;

  const renderTypeBadge = (type: InvoiceType) => {
    switch (type) {
      case 'STANDARD':
        return <Badge variant="info">STANDARD</Badge>;
      case 'PARTIAL':
        return (
          <Badge variant="purple" className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            PARTIAL
          </Badge>
        );
      case 'URGENT':
        return (
          <Badge variant="warning" className="flex items-center gap-1 bg-amber-500 text-white border-none font-bold">
            <Zap className="w-3 h-3" />
            URGENT
          </Badge>
        );
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  const renderStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="warning">Draft</Badge>;
      case 'READY':
        return <Badge variant="success">READY (Signed PDF Ready)</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const columns: Column<Invoice>[] = [
    {
      header: 'Invoice Number & Date',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 font-mono text-xs flex items-center gap-1.5">
            {row.invoice_number}
          </div>
          <div className="text-[11px] text-slate-500">
            Issued: {new Date(row.invoice_date).toLocaleDateString()} | Due: {new Date(row.due_date).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      header: 'Client Details',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {row.client?.client_name || 'Client Record'}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {row.client?.client_code} | GST: {row.client?.gst_number || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Quotation / Request',
      render: (row) => (
        <div>
          <div className="font-mono text-xs font-semibold text-indigo-700">
            {row.quotation?.quotation_number || 'Quotation'}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Req: {row.request?.request_number || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Type',
      render: (row) => renderTypeBadge(row.invoice_type),
    },
    {
      header: 'Total Amount (₹)',
      render: (row) => (
        <div className="font-semibold text-slate-900 font-mono text-right">
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
          onClick={() => onSelectInvoice && onSelectInvoice(row.id)}
          className="inline-flex items-center gap-1.5 text-xs"
        >
          View Invoice
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
            <FileCheck2 className="w-7 h-7 text-indigo-600" />
            Commercial Invoices Workflow
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate standard, partial, and urgent commercial invoices in Indian Rupees (₹) with quotation price snapshot protection.
          </p>
        </div>

        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </Button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard
          title="Total Invoices"
          value={totalInvoices}
          icon={<FileCheck2 className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          title="Draft Invoices"
          value={draftCount}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          title="Ready Invoices"
          value={readyCount}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title="Partial Invoices"
          value={partialCount}
          icon={<Layers className="w-5 h-5 text-purple-600" />}
        />
        <StatCard
          title="Urgent Invoices"
          value={urgentCount}
          icon={<Zap className="w-5 h-5 text-amber-500" />}
        />
        <StatCard
          title="Cancelled Invoices"
          value={cancelledCount}
          icon={<AlertCircle className="w-5 h-5 text-rose-600" />}
        />
      </div>

      {/* Filters & Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search invoice #, client, quotation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border-slate-300"
            >
              <option value="ALL">All Types</option>
              <option value="STANDARD">Standard</option>
              <option value="PARTIAL">Partial</option>
              <option value="URGENT">Urgent</option>
            </Select>

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="READY">Ready</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Invoices Table */}
      <Card className="p-0 overflow-hidden border border-slate-200">
        <Table
          columns={columns}
          data={invoices}
          keyExtractor={(row) => row.id}
          isLoading={loading}
          emptyMessage="No commercial invoices found."
        />
      </Card>
    </div>
  );
};
