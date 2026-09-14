import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { DueListItem, Client } from '../../types';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';

interface CalibrationDueListPageProps {
  onCreateRequest?: () => void;
}

export const CalibrationDueListPage: React.FC<CalibrationDueListPageProps> = ({ onCreateRequest }) => {
  const { activeTenant } = useTenant();

  const [items, setItems] = useState<DueListItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    overdue: 0,
    due_soon: 0,
    upcoming: 0,
  });

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dueSoonDays, setDueSoonDays] = useState(30);

  const fetchData = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const clientsData = await api.getClients(activeTenant.id);
      setClients(clientsData || []);

      const res = await api.getCalibrationDueList(activeTenant.id, {
        status: statusFilter,
        clientId: clientFilter,
        search: searchTerm,
        dueSoonDays,
      });

      setItems(res.items || []);
      if (res.metrics) setMetrics(res.metrics);
    } catch (err) {
      console.error('Failed to load calibration due list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTenant, statusFilter, clientFilter, searchTerm, dueSoonDays]);

  const renderDueBadge = (item: DueListItem) => {
    if (item.due_status === 'OVERDUE') {
      return (
        <Badge variant="destructive">
          OVERDUE ({Math.abs(item.days_remaining)} days ago)
        </Badge>
      );
    }
    if (item.due_status === 'DUE_SOON') {
      return (
        <Badge variant="warning">
          DUE SOON ({item.days_remaining} days left)
        </Badge>
      );
    }
    return (
      <Badge variant="success">
        UPCOMING ({item.days_remaining} days)
      </Badge>
    );
  };

  const columns: Column<DueListItem>[] = [
    {
      header: 'Item Code & Name',
      render: (item) => (
        <div>
          <div className="font-bold text-slate-900">{item.item_name}</div>
          <div className="text-xs font-mono text-slate-500">{item.item_code}</div>
        </div>
      ),
    },
    {
      header: 'Serial Number',
      render: (item) => (
        <span className="font-mono text-slate-800">{item.serial_number || 'N/A'}</span>
      ),
    },
    {
      header: 'Client',
      render: (item) => (
        <div>
          <div className="font-medium text-slate-800">{item.client?.client_name || 'Internal'}</div>
          <div className="text-xs text-slate-400">{item.client?.client_code || ''}</div>
        </div>
      ),
    },
    {
      header: 'Last Calibrated',
      render: (item) => (
        <span>{item.last_calibration_date ? new Date(item.last_calibration_date).toLocaleDateString() : 'N/A'}</span>
      ),
    },
    {
      header: 'Frequency',
      render: (item) => (
        <span className="font-medium text-slate-800">{item.calibration_frequency} {item.calibration_frequency_unit}</span>
      ),
    },
    {
      header: 'Next Due Date',
      render: (item) => (
        <span className="font-mono font-bold text-slate-900">{new Date(item.next_due_date).toLocaleDateString()}</span>
      ),
    },
    {
      header: 'Recalibration Status',
      render: (item) => renderDueBadge(item),
    },
    {
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: () => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCreateRequest && onCreateRequest()}
          className="gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Create Request
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calibration Due List & Recalibration Planner</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track instrument expiration dates, monitor upcoming recalibration schedules, and prevent overdue metrology compliance risks.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overdue Instruments"
          value={metrics.overdue}
          icon={<AlertTriangle className="w-5 h-5" />}
          description="Requires immediate recalibration"
        />
        <StatCard
          title={`Due Soon (≤ ${dueSoonDays} Days)`}
          value={metrics.due_soon}
          icon={<Clock className="w-5 h-5" />}
          description="Upcoming expiration window"
        />
        <StatCard
          title="Upcoming Compliant"
          value={metrics.upcoming}
          icon={<CheckCircle2 className="w-5 h-5" />}
          description="Valid calibration status"
        />
        <StatCard
          title="Total Active Inventory"
          value={metrics.total}
          icon={<Calendar className="w-5 h-5" />}
          description="Tracked equipment master"
        />
      </div>

      {/* Filters Toolbar */}
      <Card>
        <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 border-b border-slate-200">
          <div className="w-full md:w-96 relative">
            <Input
              placeholder="Search item code, name, serial #, client..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 uppercase">Filter:</span>
            </div>

            <Select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              className="w-40"
            >
              <option value="ALL">All Statuses</option>
              <option value="OVERDUE">Overdue Only</option>
              <option value="DUE_SOON">Due Soon Only</option>
              <option value="UPCOMING">Upcoming Only</option>
            </Select>

            <Select
              value={clientFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClientFilter(e.target.value)}
              className="w-48"
            >
              <option value="ALL">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_name}
                </option>
              ))}
            </Select>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Threshold:</span>
              <Select
                value={String(dueSoonDays)}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDueSoonDays(parseInt(e.target.value, 10))}
                className="w-24 text-xs"
              >
                <option value="15">15 Days</option>
                <option value="30">30 Days</option>
                <option value="60">60 Days</option>
                <option value="90">90 Days</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Due List Table */}
        <Table<DueListItem>
          columns={columns}
          data={items}
          keyExtractor={(item) => item.id}
          isLoading={loading}
          emptyMessage="No instruments match the selected due threshold or filter criteria."
        />
      </Card>
    </div>
  );
};

export default CalibrationDueListPage;
