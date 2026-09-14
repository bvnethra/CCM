import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { VendorOutsourceRequest, OutsourceStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import {
  ExternalLink,
  Truck,
  Clock,
  CheckCircle2,
  Search,
  Building,
  FileCheck2,
  Send,
  RotateCcw,
} from 'lucide-react';

interface VendorOutsourceListPageProps {
  onSelectOutsource?: (outsourceId: string) => void;
  onOpenVendorPOs?: () => void;
}

export const VendorOutsourceListPage: React.FC<VendorOutsourceListPageProps> = ({
  onSelectOutsource,
  onOpenVendorPOs,
}) => {
  const { activeTenant } = useTenant();

  const [requests, setRequests] = useState<VendorOutsourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOutsourceRequests = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const res = await api.getVendorOutsourceRequests(activeTenant.id, {
        status: statusFilter,
        search: searchTerm,
      });
      setRequests(res);
    } catch (err) {
      console.error('Failed to fetch vendor outsource requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutsourceRequests();
  }, [activeTenant, statusFilter, searchTerm]);

  // Metric counts
  const totalRequests = requests.length;
  const pendingPO = requests.filter((r) => r.outsource_status === 'OUTSOURCE_REQUIRED' || r.outsource_status === 'VENDOR_SELECTED' || r.outsource_status === 'PO_DRAFT').length;
  const inOutsourcing = requests.filter((r) => r.outsource_status === 'PO_ISSUED' || r.outsource_status === 'SENT_TO_VENDOR' || r.outsource_status === 'VENDOR_RECEIVED' || r.outsource_status === 'VENDOR_CALIBRATION').length;
  const awaitingReturn = requests.filter((r) => r.outsource_status === 'AWAITING_RETURN' || r.outsource_status === 'RECEIVED_BACK').length;
  const reintegrated = requests.filter((r) => r.outsource_status === 'REINTEGRATED').length;

  const renderStatusBadge = (status: OutsourceStatus) => {
    switch (status) {
      case 'OUTSOURCE_REQUIRED':
        return <Badge variant="warning">Outsource Required</Badge>;
      case 'VENDOR_SELECTED':
        return <Badge variant="info">Vendor Selected</Badge>;
      case 'PO_DRAFT':
        return <Badge variant="default">PO Draft</Badge>;
      case 'PO_ISSUED':
        return <Badge variant="purple">PO Issued</Badge>;
      case 'SENT_TO_VENDOR':
        return <Badge variant="info">Sent to Vendor</Badge>;
      case 'VENDOR_RECEIVED':
        return <Badge variant="info">Vendor Received</Badge>;
      case 'VENDOR_CALIBRATION':
        return <Badge variant="purple">In Vendor Cal</Badge>;
      case 'VENDOR_COMPLETED':
        return <Badge variant="success">Vendor Cal Done</Badge>;
      case 'AWAITING_RETURN':
        return <Badge variant="warning">Awaiting Return</Badge>;
      case 'RECEIVED_BACK':
        return <Badge variant="info">Received Back</Badge>;
      case 'REINTEGRATED':
        return <Badge variant="success">Reintegrated (Calibrated)</Badge>;
      case 'VENDOR_FAILED':
        return <Badge variant="destructive">Vendor Failed</Badge>;
      case 'CANCELLED':
        return <Badge variant="default">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const columns: Column<VendorOutsourceRequest>[] = [
    {
      header: 'Outsource ID & Date',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 font-mono text-xs">{row.id}</div>
          <div className="text-[11px] text-slate-500">
            {new Date(row.created_at).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      header: 'Instrument Details',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900">{row.request_item?.item?.item_name || 'Instrument Record'}</div>
          <div className="text-xs text-slate-500 font-mono">
            {row.request_item?.item?.item_code} | SN: {row.request_item?.item?.serial_number || 'N/A'}
          </div>
          <div className="text-[11px] text-slate-400">
            Req #: {row.request?.request_number || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Outsource Vendor',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800 flex items-center gap-1">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            {row.vendor?.vendor_name || 'N/A'}
          </div>
          <div className="text-xs text-slate-500 font-mono">{row.vendor?.vendor_code}</div>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => renderStatusBadge(row.outsource_status),
    },
    {
      header: 'Expected Return',
      render: (row) => (
        <span className="text-xs font-mono text-slate-700">
          {row.expected_return_date ? new Date(row.expected_return_date).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelectOutsource && onSelectOutsource(row.id)}
          className="inline-flex items-center gap-1.5 text-xs"
        >
          Manage Workspace
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
            <Truck className="w-7 h-7 text-indigo-600" />
            Vendor Outsourcing Workflow
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage external primary standard vendor calibration, purchase orders, shipping movements, and main flow reintegration.
          </p>
        </div>

        {onOpenVendorPOs && (
          <Button
            onClick={onOpenVendorPOs}
            variant="outline"
            className="inline-flex items-center gap-2 text-slate-700 border-slate-300"
          >
            <FileCheck2 className="w-4 h-4 text-indigo-600" />
            Vendor Purchase Orders (POs)
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Outsource Requests"
          value={totalRequests}
          icon={<Truck className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          title="Pending Vendor / PO"
          value={pendingPO}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          title="In Vendor Calibration"
          value={inOutsourcing}
          icon={<Send className="w-5 h-5 text-purple-600" />}
        />
        <StatCard
          title="Awaiting Return"
          value={awaitingReturn}
          icon={<RotateCcw className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          title="Reintegrated (Calibrated)"
          value={reintegrated}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        />
      </div>

      {/* Filters & Controls */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search request #, item, vendor..."
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
                { value: 'OUTSOURCE_REQUIRED', label: 'Outsource Required' },
                { value: 'VENDOR_SELECTED', label: 'Vendor Selected' },
                { value: 'PO_ISSUED', label: 'PO Issued' },
                { value: 'SENT_TO_VENDOR', label: 'Sent to Vendor' },
                { value: 'VENDOR_CALIBRATION', label: 'In Vendor Calibration' },
                { value: 'AWAITING_RETURN', label: 'Awaiting Return' },
                { value: 'RECEIVED_BACK', label: 'Received Back' },
                { value: 'REINTEGRATED', label: 'Reintegrated (Calibrated)' },
                { value: 'VENDOR_FAILED', label: 'Vendor Failed' },
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
            Outsourcing Requests ({requests.length})
          </h2>
        </div>

        <Table<VendorOutsourceRequest>
          columns={columns}
          data={requests}
          keyExtractor={(row) => row.id}
          isLoading={loading}
          emptyMessage="No vendor outsourcing requests found matching filter criteria."
        />
      </Card>
    </div>
  );
};
