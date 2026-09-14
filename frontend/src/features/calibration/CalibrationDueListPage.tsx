import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { DueListItem, Client } from '../../types';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import {
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  Download,
  PlusCircle,
  FileText,
  RefreshCw,
  Building2,
} from 'lucide-react';

interface CalibrationDueListPageProps {
  onCreateRequest?: (clientId?: string, itemId?: string) => void;
  onCreateQuotation?: (clientId?: string, itemId?: string) => void;
}

export const CalibrationDueListPage: React.FC<CalibrationDueListPageProps> = ({
  onCreateRequest,
  onCreateQuotation,
}) => {
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
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [dueDaysRange, setDueDaysRange] = useState<string>('30'); // 7, 15, 30, overdue
  const [searchTerm, setSearchTerm] = useState('');
  const [groupByClient, setGroupByClient] = useState(false);

  const fetchData = async () => {
    if (!activeTenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const clientsData = await api.getClients(activeTenant.id);
      setClients(clientsData || []);

      const res = await api.getCalibrationDueList(activeTenant.id, {
        dueSoonDays: dueDaysRange === 'overdue' ? 0 : parseInt(dueDaysRange) || 30,
        clientId: clientFilter !== 'ALL' ? clientFilter : undefined,
        search: searchTerm || undefined,
      });

      let filtered: DueListItem[] = res.items || [];
      if (dueDaysRange === 'overdue') {
        filtered = filtered.filter((i: DueListItem) => i.due_status === 'OVERDUE');
      } else if (dueDaysRange === '7') {
        filtered = filtered.filter((i: DueListItem) => i.days_remaining >= 0 && i.days_remaining <= 7);
      } else if (dueDaysRange === '15') {
        filtered = filtered.filter((i: DueListItem) => i.days_remaining >= 0 && i.days_remaining <= 15);
      } else if (dueDaysRange === '30') {
        filtered = filtered.filter((i: DueListItem) => i.days_remaining >= 0 && i.days_remaining <= 30);
      }

      setItems(filtered);

      const overdueCount = filtered.filter((i: DueListItem) => i.due_status === 'OVERDUE').length;
      const dueSoonCount = filtered.filter((i: DueListItem) => i.due_status === 'DUE_SOON').length;
      const upcomingCount = filtered.filter((i: DueListItem) => i.due_status === 'UPCOMING').length;

      setMetrics({
        total: filtered.length,
        overdue: overdueCount,
        due_soon: dueSoonCount,
        upcoming: upcomingCount,
      });
    } catch (err) {
      console.error('Failed to fetch due calibration items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTenant, clientFilter, dueDaysRange, searchTerm]);

  // Export to CSV
  const handleExportCSV = () => {
    if (items.length === 0) {
      alert('No due items available to export.');
      return;
    }
    const headers = [
      'Item Code',
      'Item Name',
      'Serial Number',
      'Client Code',
      'Client Name',
      'Last Calibration Date',
      'Next Calibration Due Date',
      'Days Remaining',
      'Due Status',
      'Assigned Vendor',
    ];
    const rows = items.map((i) => [
      `"${i.item_code}"`,
      `"${i.item_name}"`,
      `"${i.serial_number || 'N/A'}"`,
      `"${i.client?.client_code || 'N/A'}"`,
      `"${i.client?.client_name || 'N/A'}"`,
      `"${i.last_calibration_date || 'N/A'}"`,
      `"${i.next_due_date}"`,
      i.days_remaining,
      i.due_status,
      `"${i.vendor?.vendor_name || 'N/A'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `calibration_due_list_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderDueStatusBadge = (item: DueListItem) => {
    if (item.due_status === 'OVERDUE') {
      return (
        <Badge variant="destructive" className="font-mono text-xs">
          OVERDUE ({Math.abs(item.days_remaining)} days)
        </Badge>
      );
    }
    if (item.due_status === 'DUE_SOON') {
      return (
        <Badge variant="warning" className="font-mono text-xs">
          Due in {item.days_remaining} days
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="font-mono text-xs">
        Compliant ({item.days_remaining} days)
      </Badge>
    );
  };

  const columns: Column<DueListItem>[] = [
    {
      header: 'Instrument / Item',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">{row.item_name}</div>
          <div className="text-[11px] font-mono text-slate-500">
            Code: {row.item_code} | SN: {row.serial_number || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Client Master',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800 text-xs flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            {row.client?.client_name || 'Client Entity'}
          </div>
          <div className="text-[11px] font-mono text-slate-500">{row.client?.client_code}</div>
        </div>
      ),
    },
    {
      header: 'Last Calibrated',
      render: (row) => (
        <span className="text-xs font-mono text-slate-600">
          {row.last_calibration_date ? new Date(row.last_calibration_date).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      header: 'Next Due Date',
      render: (row) => (
        <span className="text-xs font-mono font-semibold text-slate-900">
          {new Date(row.next_due_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Due Status',
      render: (row) => renderDueStatusBadge(row),
    },
    {
      header: 'Assigned Vendor (Internal)',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.vendor ? row.vendor.vendor_name : 'Internal Lab'}
        </span>
      ),
    },
    {
      header: 'Direct Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => onCreateRequest && onCreateRequest(row.client_id || row.client?.id, row.item_id)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2 py-1 inline-flex items-center gap-1"
            title="Create Request for this Client & Item"
          >
            <PlusCircle className="w-3 h-3" />
            Create Request
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCreateQuotation && onCreateQuotation(row.client_id || row.client?.id, row.item_id)}
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs px-2 py-1 inline-flex items-center gap-1"
            title="Create Standalone Quotation for this Client & Item"
          >
            <FileText className="w-3 h-3" />
            Create Quotation
          </Button>
        </div>
      ),
    },
  ];

  // Group by client
  const clientGrouped: Record<string, DueListItem[]> = {};
  if (groupByClient) {
    items.forEach((item) => {
      const clientName = item.client?.client_name || 'Unassigned Client';
      if (!clientGrouped[clientName]) clientGrouped[clientName] = [];
      clientGrouped[clientName].push(item);
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Calendar className="w-7 h-7 text-indigo-600" />
            Calibration Due List & Direct Actions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor due equipment, trigger direct Request or Standalone Quotation creation with pre-selected client & items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs inline-flex items-center gap-1.5 border-slate-300"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="text-xs inline-flex items-center gap-1.5 border-slate-300"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Instruments"
          value={metrics.total}
          description="Monitored in catalog"
          icon={<Calendar className="w-5 h-5 text-slate-600" />}
        />
        <StatCard
          title="Overdue Calibration"
          value={metrics.overdue}
          description="Immediate action needed"
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
        />
        <StatCard
          title="Due in Selected Window"
          value={metrics.due_soon}
          description="Approaching due date"
          icon={<Clock className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          title="Upcoming & On Schedule"
          value={metrics.upcoming}
          description="Calibrated & compliant"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        />
      </div>

      {/* Filters Card */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search instrument, code, serial number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <Select
            value={dueDaysRange}
            onChange={(e) => setDueDaysRange(e.target.value)}
            className="w-44 text-sm border-slate-300"
          >
            <option value="overdue">Overdue Items</option>
            <option value="7">Due in 7 Days</option>
            <option value="15">Due in 15 Days</option>
            <option value="30">Due in 30 Days</option>
            <option value="365">All Due Items (365 Days)</option>
          </Select>

          <Select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="w-52 text-sm border-slate-300"
          >
            <option value="ALL">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.client_code} - {c.client_name}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <input
              type="checkbox"
              id="groupByClient"
              checked={groupByClient}
              onChange={(e) => setGroupByClient(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="groupByClient" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
              Group Client-Wise
            </label>
          </div>
        </div>
      </Card>

      {/* Table Display */}
      {groupByClient ? (
        <div className="space-y-6">
          {Object.entries(clientGrouped).map(([clientName, groupItems]) => (
            <Card key={clientName} className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  {clientName}
                </h3>
                <Badge variant="info" className="text-xs">
                  {groupItems.length} items due
                </Badge>
              </div>
              <Table data={groupItems} columns={columns as Column<any>[]} keyExtractor={(item: any) => item.id} isLoading={loading} />
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table data={items} columns={columns as Column<any>[]} keyExtractor={(item: any) => item.id} isLoading={loading} />
        </Card>
      )}
    </div>
  );
};
