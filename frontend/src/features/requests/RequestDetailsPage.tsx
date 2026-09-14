import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Building,
  User,
  Calendar,
  ArrowLeft,
  RefreshCw,
  Package,
  FileCheck,
  Truck,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { CalibrationRequest, RequestTimelineEvent, ItemProgressRow } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export interface RequestDetailsPageProps {
  requestId: string;
  onBack: () => void;
  onNavigate: (route: string) => void;
}

export const RequestDetailsPage: React.FC<RequestDetailsPageProps> = ({
  requestId,
  onBack,
  onNavigate,
}) => {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id || 'all';

  const [request, setRequest] = useState<CalibrationRequest | null>(null);
  const [timeline, setTimeline] = useState<RequestTimelineEvent[]>([]);
  const [matrix, setMatrix] = useState<ItemProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqData, timeData, matrixData] = await Promise.all([
        api.getCalibrationRequest(requestId, tenantId),
        api.getRequestTimeline(requestId, tenantId),
        api.getRequestProgressMatrix(requestId, tenantId),
      ]);
      setRequest(reqData);
      setTimeline(timeData);
      setMatrix(matrixData);
    } catch (err) {
      console.error('Failed loading request details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [requestId, tenantId]);

  const handleEvaluateCompletion = async () => {
    setEvaluating(true);
    try {
      const res = await api.evaluateRequestCompletion(requestId, tenantId);
      await loadData();
      alert(`Completion Evaluation Done!\nNew Status: ${res.newStatus}\nFully Completed: ${res.isFullyCompleted}`);
    } catch (err: any) {
      alert(`Error evaluating completion: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  if (loading || !request) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Loading request timeline & progress matrix...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Requests
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Request {request.request_number}
            </h1>
            <Badge
              variant={
                request.status === 'COMPLETED'
                  ? 'success'
                  : request.status === 'PARTIALLY_COMPLETED'
                  ? 'warning'
                  : 'info'
              }
            >
              {request.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Registered on {new Date(request.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEvaluateCompletion}
            disabled={evaluating}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${evaluating ? 'animate-spin' : ''}`} />
            Evaluate Completion (Server)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('dispatches')}
          >
            <Truck className="w-3.5 h-3.5 mr-1.5" /> Go to Dispatches
          </Button>
        </div>
      </div>

      {/* Meta Info Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Client</p>
            <p className="text-xs font-semibold text-slate-900">{request.client?.client_name || 'N/A'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Collection Agent</p>
            <p className="text-xs font-semibold text-slate-900">{request.collection_agent?.full_name || 'Assigned'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Collection Date</p>
            <p className="text-xs font-semibold text-slate-900">{request.collection_date}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Items</p>
            <p className="text-xs font-semibold text-slate-900">{request.items?.length || 0} Instruments</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Item Progress Matrix & Chronological Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Item-Level Progress Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" />
              Item Progress Matrix
            </h2>
            <span className="text-xs text-slate-500">Stage by Stage Traceability</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Item Details</th>
                    <th className="px-3 py-3">Available</th>
                    <th className="px-3 py-3">Verified</th>
                    <th className="px-3 py-3">Calibration</th>
                    <th className="px-3 py-3">Certificate</th>
                    <th className="px-3 py-3">Dispatched</th>
                    <th className="px-3 py-3">Delivery</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {matrix.map((row) => (
                    <tr key={row.item_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{row.item_code}</div>
                        <div className="text-[11px] text-slate-500">{row.item_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">SN: {row.serial_number}</div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-emerald-600">{row.availability}</td>
                      <td className="px-3 py-3 text-slate-700">{row.verification}</td>
                      <td className="px-3 py-3">
                        <span className={row.calibration.includes('PASS') ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
                          {row.calibration}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700 font-mono text-[11px]">{row.certificate}</td>
                      <td className="px-3 py-3 text-slate-700">{row.dispatch}</td>
                      <td className="px-3 py-3 text-slate-700">{row.delivery}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge
                          variant={row.final_status === 'Completed' ? 'success' : 'info'}
                          size="sm"
                        >
                          {row.final_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Chronological Request Timeline */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Workflow Timeline
          </h2>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-6">
            {timeline.map((evt, idx) => (
              <div key={idx} className="relative flex gap-3 pb-2 last:pb-0">
                {idx !== timeline.length - 1 && (
                  <span
                    className="absolute left-2.5 top-6 -bottom-4 w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex h-5 w-5 flex-none items-center justify-center rounded-full bg-blue-50 border border-blue-500 text-blue-600 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-auto">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-900">{evt.title}</p>
                    <time className="text-[10px] text-slate-400 font-mono">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">{evt.description}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">By: {evt.user_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
