import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { PurchaseOrder, POStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  Search,
  ExternalLink,
  Building,
  ArrowLeft,
} from 'lucide-react';

interface VendorPOListPageProps {
  onSelectPO?: (poId: string) => void;
  onBackToOutsourcing?: () => void;
}

export const VendorPOListPage: React.FC<VendorPOListPageProps> = ({
  onSelectPO,
  onBackToOutsourcing,
}) => {
  const { activeTenant } = useTenant();

  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPOs = async () => {
    if (!activeTenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getVendorPurchaseOrders(activeTenant.id, {
        status: statusFilter,
        search: searchTerm,
      });
      setPos(res);
    } catch (err) {
      console.error('Failed to fetch vendor purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPOs();
  }, [activeTenant, statusFilter, searchTerm]);

  // Metrics
  const totalPOs = pos.length;
  const draftPOs = pos.filter((p) => p.status === 'DRAFT').length;
  const issuedPOs = pos.filter((p) => p.status === 'ISSUED').length;
  const totalPOValue = pos.reduce((acc, p) => acc + (p.total_amount || 0), 0);

  const renderStatusBadge = (status: POStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="warning">Draft</Badge>;
      case 'ISSUED':
        return <Badge variant="purple">Issued</Badge>;
      case 'ACKNOWLEDGED':
        return <Badge variant="info">Acknowledged</Badge>;
      case 'CLOSED':
        return <Badge variant="success">Closed</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const columns: Column<PurchaseOrder>[] = [
    {
      header: 'PO Number & Date',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 font-mono">{row.po_number}</div>
          <div className="text-xs text-slate-500">{new Date(row.po_date).toLocaleDateString()}</div>
        </div>
      ),
    },
    {
      header: 'Outsource Vendor',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900 flex items-center gap-1">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            {row.vendor?.vendor_name || 'N/A'}
          </div>
          <div className="text-xs text-slate-500 font-mono">{row.vendor?.vendor_code}</div>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      header: 'Subtotal / Tax',
      render: (row) => (
        <div className="text-xs font-mono text-slate-600">
          <div>Sub: ₹{row.subtotal.toFixed(2)}</div>
          <div>Tax: ₹{row.tax_amount.toFixed(2)}</div>
        </div>
      ),
    },
    {
      header: 'Total Amount',
      render: (row) => (
        <span className="font-mono text-sm font-bold text-emerald-700">
          ₹{row.total_amount.toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelectPO && onSelectPO(row.id)}
          className="inline-flex items-center gap-1.5 text-xs"
        >
          View PO
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
          {onBackToOutsourcing && (
            <button
              onClick={onBackToOutsourcing}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Vendor Outsourcing
            </button>
          )}
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileCheck2 className="w-7 h-7 text-indigo-600" />
            Vendor Purchase Orders (POs)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Commercial Purchase Orders issued to external vendors specifically for outsourcing calibration services.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Purchase Orders"
          value={totalPOs}
          icon={<FileCheck2 className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          title="Draft POs"
          value={draftPOs}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          title="Issued POs"
          value={issuedPOs}
          icon={<CheckCircle2 className="w-5 h-5 text-purple-600" />}
        />
        <StatCard
          title="Total Outsource PO Value"
          value={`₹${totalPOValue.toFixed(2)}`}
          icon={<FileCheck2 className="w-5 h-5 text-emerald-600" />}
        />
      </div>

      {/* Filters & Controls */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search PO #, vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
              Filter Status:
            </label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'ISSUED', label: 'Issued' },
                { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
                { value: 'CLOSED', label: 'Closed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
              className="w-full md:w-56 text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            Vendor Purchase Orders ({pos.length})
          </h2>
        </div>

        <Table<PurchaseOrder>
          columns={columns}
          data={pos}
          keyExtractor={(row) => row.id}
          isLoading={loading}
          emptyMessage="No vendor purchase orders found matching filter criteria."
        />
      </Card>
    </div>
  );
};
