import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { CalibrationQueueItem, CalibrationStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import {
  SlidersHorizontal,
  Search,
  CheckCircle2,
  Clock,
  Play,
  FileCheck2,
  XCircle,
  ExternalLink,
} from 'lucide-react';

interface CalibrationQueuePageProps {
  onOpenWorkspace?: (requestItemId: string) => void;
}

export const CalibrationQueuePage: React.FC<CalibrationQueuePageProps> = ({ onOpenWorkspace }) => {
  const { activeTenant } = useTenant();

  const [items, setItems] = useState<CalibrationQueueItem[]>([]);
  const [metrics, setMetrics] = useState({
    total_eligible: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    not_calibratable: 0,
  });

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [startingItemId, setStartingItemId] = useState<string | null>(null);

  const fetchQueue = async () => {
    if (!activeTenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getCalibrationQueue(activeTenant.id, {
        status: statusFilter,
        priority: priorityFilter,
        search: searchTerm,
        page,
        pageSize: 15,
      });

      setItems(res.items || []);
      if (res.metrics) setMetrics(res.metrics);
      if (res.pagination) {
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      }
    } catch (err) {
      console.error('Failed to load calibration queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [activeTenant, statusFilter, priorityFilter, searchTerm, page]);

  const handleStartCalibration = async (item: CalibrationQueueItem) => {
    if (!activeTenant) return;
    setStartingItemId(item.request_item_id);
    try {
      await api.startCalibration(activeTenant.id, {
        request_id: item.request_id,
        request_item_id: item.request_item_id,
        item_id: item.item_id,
      });
      if (onOpenWorkspace) {
        onOpenWorkspace(item.request_item_id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start calibration');
    } finally {
      setStartingItemId(null);
    }
  };

  const renderStatusBadge = (status: CalibrationStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="info">In Progress</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      case 'NOT_CALIBRATABLE':
        return <Badge variant="warning">Not Calibratable</Badge>;
      default:
        return <Badge variant="default">Pending Calibration</Badge>;
    }
  };

  const columns: Column<CalibrationQueueItem>[] = [
    {
      header: 'Request #',
      render: (item) => (
        <span className="font-mono font-medium text-slate-900">{item.request_number}</span>
      ),
    },
    {
      header: 'Client',
      render: (item) => (
        <div>
          <div className="font-medium text-slate-800">{item.client?.client_name || 'N/A'}</div>
          <div className="text-xs text-slate-400">{item.client?.client_code || ''}</div>
        </div>
      ),
    },
    {
      header: 'Item Details',
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-900">{item.item_name}</div>
          <div className="text-xs font-mono text-slate-500">{item.item_code}</div>
        </div>
      ),
    },
    {
      header: 'Serial Number',
      render: (item) => (
        <span className="font-mono text-slate-700">{item.serial_number || 'N/A'}</span>
      ),
    },
    {
      header: 'Priority',
      render: (item) =>
        item.priority === 'URGENT' ? (
          <Badge variant="destructive">Urgent</Badge>
        ) : (
          <Badge variant="default">Normal</Badge>
        ),
    },
    {
      header: 'Verification',
      render: () => <Badge variant="success">VERIFIED</Badge>,
    },
    {
      header: 'Calibration Status',
      render: (item) => renderStatusBadge(item.calibration_status),
    },
    {
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (item) =>
        item.calibration_status === 'PENDING' ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleStartCalibration(item)}
            disabled={startingItemId === item.request_item_id}
            className="gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            {startingItemId === item.request_item_id ? 'Starting...' : 'Start Calibration'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenWorkspace && onOpenWorkspace(item.request_item_id)}
            className="gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Workspace
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Title & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calibration Operations & Metrology Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Execute precision measurements, record test points, and issue certified calibration reports for verified instruments.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Verified Eligible"
          value={metrics.total_eligible}
          icon={<FileCheck2 className="w-5 h-5" />}
          description="Passed intake verification"
        />
        <StatCard
          title="Pending Start"
          value={metrics.pending}
          icon={<Clock className="w-5 h-5" />}
          description="Awaiting technician pickup"
        />
        <StatCard
          title="In Progress"
          value={metrics.in_progress}
          icon={<Play className="w-5 h-5" />}
          description="Active measurement recording"
        />
        <StatCard
          title="Calibrated"
          value={metrics.completed}
          icon={<CheckCircle2 className="w-5 h-5" />}
          description="Completed & certified"
        />
        <StatCard
          title="Failed / Blocked"
          value={metrics.failed + metrics.not_calibratable}
          icon={<XCircle className="w-5 h-5" />}
          description="Non-conforming items"
        />
      </div>

      {/* Filters & Controls */}
      <Card>
        <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 border-b border-slate-200">
          <div className="w-full md:w-96 relative">
            <Input
              placeholder="Search request #, client, item code..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 uppercase">Filters:</span>
            </div>

            <Select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              className="w-40"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Start</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </Select>

            <Select
              value={priorityFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriorityFilter(e.target.value)}
              className="w-36"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent Only</option>
              <option value="NORMAL">Normal Priority</option>
            </Select>
          </div>
        </div>

        {/* Table */}
        <Table<CalibrationQueueItem>
          columns={columns}
          data={items}
          keyExtractor={(item) => item.request_item_id}
          isLoading={loading}
          emptyMessage="No verified items found in queue."
        />

        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={15}
            onPageChange={(p: number) => setPage(p)}
          />
        )}
      </Card>
    </div>
  );
};

export default CalibrationQueuePage;
