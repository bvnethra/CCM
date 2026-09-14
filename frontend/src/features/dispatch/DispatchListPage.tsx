import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Dispatch, DispatchStatus, DispatchType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Truck,
  Plus,
  Search,
  Box,
  PackageCheck,
  MapPin,
} from 'lucide-react';

interface DispatchListPageProps {
  onSelectDispatch: (id: string) => void;
  onCreateNew: () => void;
}

export const DispatchListPage: React.FC<DispatchListPageProps> = ({
  onSelectDispatch,
  onCreateNew,
}) => {
  const { activeTenant } = useTenant();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const fetchDispatches = async () => {
    if (!activeTenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getDispatches(activeTenant.id, {
        status: statusFilter,
        dispatch_type: typeFilter,
        search,
      });
      setDispatches(data);
    } catch (err) {
      console.error('Failed to fetch dispatches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatches();
  }, [activeTenant, statusFilter, typeFilter, search]);

  // Metrics
  const totalCount = dispatches.length;
  const packingCount = dispatches.filter((d) => d.status === 'PACKING' || d.status === 'READY_FOR_DISPATCH' || d.status === 'PACKED').length;
  const inTransitCount = dispatches.filter((d) => d.status === 'DISPATCHED' || d.status === 'IN_TRANSIT' || d.status === 'OUT_FOR_DELIVERY').length;
  const deliveredCount = dispatches.filter((d) => d.status === 'DELIVERED').length;

  const renderStatusBadge = (status: DispatchStatus) => {
    switch (status) {
      case 'READY_FOR_DISPATCH':
        return <Badge variant="info">Ready for Dispatch</Badge>;
      case 'PACKING':
        return <Badge variant="warning">Packing in Progress</Badge>;
      case 'PACKED':
        return <Badge variant="purple">Packed</Badge>;
      case 'DISPATCHED':
        return <Badge variant="info" className="bg-blue-600 text-white">Dispatched</Badge>;
      case 'IN_TRANSIT':
        return <Badge variant="purple" className="bg-purple-600 text-white">In Transit</Badge>;
      case 'OUT_FOR_DELIVERY':
        return <Badge variant="warning" className="bg-amber-500 text-white font-bold">Out for Delivery</Badge>;
      case 'DELIVERED':
        return <Badge variant="success" className="bg-emerald-600 text-white font-bold">Delivered</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const renderTypeBadge = (type: DispatchType) => {
    switch (type) {
      case 'STANDARD':
        return <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">STANDARD</span>;
      case 'PARTIAL':
        return <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">PARTIAL</span>;
      case 'URGENT':
        return <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">URGENT</span>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Dispatches, Tracking & Delivery
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Item packing, carrier shipment, real-time tracking, and client delivery confirmation
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={onCreateNew}
          className="bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-2 text-xs py-2.5"
        >
          <Plus className="w-4 h-4" />
          Create New Dispatch
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Dispatches</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{totalCount}</h3>
            </div>
            <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Packing & Prep</p>
              <h3 className="text-2xl font-extrabold text-amber-700 mt-1">{packingCount}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Box className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">In Transit / Carrier</p>
              <h3 className="text-2xl font-extrabold text-blue-700 mt-1">{inTransitCount}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Delivered & Signed</p>
              <h3 className="text-2xl font-extrabold text-emerald-700 mt-1">{deliveredCount}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 border-slate-200">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search dispatch #, carrier, tracking #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="READY_FOR_DISPATCH">Ready for Dispatch</option>
              <option value="PACKING">Packing</option>
              <option value="PACKED">Packed</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white text-slate-700"
            >
              <option value="all">All Types</option>
              <option value="STANDARD">Standard</option>
              <option value="PARTIAL">Partial</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Showing {dispatches.length} dispatch records
          </div>
        </div>
      </Card>

      {/* Dispatches Table */}
      <Card className="overflow-hidden border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Dispatch Number</th>
                <th className="p-3.5">Client & Address</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Carrier & Tracking</th>
                <th className="p-3.5 text-center">Items</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Dispatch Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Loading dispatch records...
                  </td>
                </tr>
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No dispatch records found matching your filters.
                  </td>
                </tr>
              ) : (
                dispatches.map((dsp) => (
                  <tr
                    key={dsp.id}
                    onClick={() => onSelectDispatch(dsp.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5">
                      <span className="font-bold text-indigo-600 font-mono">{dsp.dispatch_number}</span>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Req: {dsp.request?.request_number || 'N/A'} | Inv: {dsp.invoice?.invoice_number || 'N/A'}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{dsp.client?.client_name || 'Client'}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{dsp.shipping_address}</div>
                    </td>
                    <td className="p-3.5">{renderTypeBadge(dsp.dispatch_type)}</td>
                    <td className="p-3.5">
                      {dsp.carrier_name ? (
                        <div>
                          <span className="font-semibold text-slate-800">{dsp.carrier_name}</span>
                          <div className="font-mono text-[11px] text-slate-500">TRK: {dsp.tracking_number}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not Assigned</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-mono font-semibold">{dsp.items?.length || 0}</td>
                    <td className="p-3.5">{renderStatusBadge(dsp.status)}</td>
                    <td className="p-3.5 text-right font-mono text-slate-600">{dsp.dispatch_date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
