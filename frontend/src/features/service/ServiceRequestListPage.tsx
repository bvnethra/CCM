import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { ServiceRequest, ServiceStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import {
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
} from 'lucide-react';

interface ServiceRequestListPageProps {
  onSelectServiceRequest?: (serviceRequestId: string) => void;
}

export const ServiceRequestListPage: React.FC<ServiceRequestListPageProps> = ({ onSelectServiceRequest }) => {
  const { activeTenant } = useTenant();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchServiceRequests = async () => {
    if (!activeTenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getServiceRequests(activeTenant.id, {
        status: statusFilter,
        search: searchTerm,
      });
      setRequests(res);
    } catch (err) {
      console.error('Failed to fetch service requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceRequests();
  }, [activeTenant, statusFilter, searchTerm]);

  // Metrics computation
  const totalRequests = requests.length;
  const awaitingApproval = requests.filter((r) => r.service_status === 'AWAITING_CLIENT_APPROVAL').length;
  const approvedInService = requests.filter((r) => r.service_status === 'APPROVED' || r.service_status === 'IN_SERVICE').length;
  const completed = requests.filter((r) => r.service_status === 'SERVICE_COMPLETED').length;
  const rejected = requests.filter((r) => r.service_status === 'REJECTED').length;

  const renderStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case 'AWAITING_CLIENT_APPROVAL':
        return <Badge variant="warning">Awaiting Approval</Badge>;
      case 'APPROVED':
        return <Badge variant="purple">Approved</Badge>;
      case 'IN_SERVICE':
        return <Badge variant="info">In Service</Badge>;
      case 'SERVICE_COMPLETED':
        return <Badge variant="success">Service Completed</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Client Rejected</Badge>;
      case 'CANCELLED':
        return <Badge variant="default">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const columns: Column<ServiceRequest>[] = [
    {
      header: 'Service Request ID',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.id}</div>
          <div className="text-xs text-slate-500">{row.request?.request_number || 'N/A'}</div>
        </div>
      ),
    },
    {
      header: 'Item & Serial',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900">{row.request_item?.item?.item_name || 'Item Record'}</div>
          <div className="text-xs text-slate-500 font-mono">
            {row.request_item?.item?.item_code} | SN: {row.request_item?.item?.serial_number || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Client',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800">{row.client?.client_name || 'N/A'}</div>
          <div className="text-xs text-slate-500">{row.client?.client_code}</div>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => renderStatusBadge(row.service_status),
    },
    {
      header: 'Estimated Cost',
      render: (row) => (
        <span className="font-mono text-sm font-semibold text-slate-800">
          {row.estimated_service_cost != null ? `₹${row.estimated_service_cost.toFixed(2)}` : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Created At',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {new Date(row.created_at).toLocaleDateString()} {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelectServiceRequest && onSelectServiceRequest(row.id)}
          className="inline-flex items-center gap-1.5 text-xs"
        >
          View Workspace
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
            <Wrench className="w-7 h-7 text-amber-600" />
            Faulty Items & Service Required
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track failed calibration items, manage vendor/OEM service quotes, record client approval, and process re-calibration returns.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Service Requests"
          value={totalRequests}
          icon={<Wrench className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          title="Awaiting Approval"
          value={awaitingApproval}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          title="Approved / In Service"
          value={approvedInService}
          icon={<Wrench className="w-5 h-5 text-purple-600" />}
        />
        <StatCard
          title="Service Completed"
          value={completed}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title="Client Rejected"
          value={rejected}
          icon={<XCircle className="w-5 h-5 text-rose-600" />}
        />
      </div>

      {/* Filters & Controls */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search request #, item, serial..."
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
                { value: 'AWAITING_CLIENT_APPROVAL', label: 'Awaiting Client Approval' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'IN_SERVICE', label: 'In Service' },
                { value: 'SERVICE_COMPLETED', label: 'Service Completed' },
                { value: 'REJECTED', label: 'Client Rejected' },
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
            Service Required Queue ({requests.length})
          </h2>
        </div>

        <Table<ServiceRequest>
          columns={columns}
          data={requests}
          keyExtractor={(row) => row.id}
          isLoading={loading}
          emptyMessage="No service requests found matching your filter criteria."
        />
      </Card>
    </div>
  );
};
