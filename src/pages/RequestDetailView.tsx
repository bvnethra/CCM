import React, { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList, ShieldCheck, FileText, CheckCircle2, Clock, Wrench, ExternalLink, Download } from 'lucide-react';
import { StatusBadge } from '../components/Common/StatusBadge';
import { WorkflowTimeline } from '../components/Workflow/WorkflowTimeline';
import { DocumentManager } from '../components/Documents/DocumentManager';
import { fetchApi } from '../api/client';
import { CalibrationRequest } from '../types';

interface RequestDetailViewProps {
  requestId: string;
  onBack: () => void;
}

export const RequestDetailView: React.FC<RequestDetailViewProps> = ({ requestId, onBack }) => {
  const [request, setRequest] = useState<CalibrationRequest | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    loadDetail();
  }, [requestId]);

  const loadDetail = async () => {
    const rRes = await fetchApi('/api/requests');
    if (rRes.success) {
      const found = (rRes.data || []).find((r: any) => r.id === requestId);
      if (found) setRequest(found);
    }

    const dRes = await fetchApi('/api/documents');
    if (dRes.success) {
      const docs = (dRes.data || []).filter((d: any) => d.requestId === requestId);
      setDocuments(docs);
    }
  };

  if (!request) {
    return (
      <div className="p-8 text-center text-slate-400">
        Loading Request Traceability details...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-100 font-mono">{request.requestNumber}</h2>
              <StatusBadge status={request.status} size="lg" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Central Multi-Tenant Traceability View</p>
          </div>
        </div>
      </div>

      {/* Visual Workflow Stage Progress */}
      <div className="glass-card p-5 rounded-xl border border-slate-800">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Request Lifecycle Progression</h4>
        <WorkflowTimeline currentStatus={request.status} />
      </div>

      {/* Request Header & Client Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="font-semibold text-slate-100 text-sm">Collection Request & Client Context</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Client Name</span>
              <p className="font-semibold text-slate-200 mt-0.5">{request.clientName}</p>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Collection Agent</span>
              <p className="font-semibold text-slate-200 mt-0.5">{request.collectionAgentName}</p>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Collection Date</span>
              <p className="font-semibold text-slate-200 mt-0.5">{request.collectionDate}</p>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Priority</span>
              <p className="font-semibold text-rose-400 mt-0.5">{request.priority}</p>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Remarks</span>
              <p className="text-slate-300 mt-0.5">{request.remarks || 'None'}</p>
            </div>
          </div>
        </div>

        {/* Private Documents Box */}
        <DocumentManager requestId={request.id} documents={documents} onUploadSuccess={loadDetail} />
      </div>

      {/* Request Items Traceability Table */}
      <div className="glass-card rounded-xl border border-slate-800 p-5 space-y-4">
        <h3 className="font-semibold text-slate-100 text-sm">Child Request Items Traceability</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Item Code</th>
                <th className="p-3">Description</th>
                <th className="p-3">Serial Number</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Item Status</th>
                <th className="p-3">Exception Flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {request.items?.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-mono font-bold text-sky-400">{item.itemCode}</td>
                  <td className="p-3 font-semibold text-slate-100">{item.itemName}</td>
                  <td className="p-3 font-mono text-slate-300">{item.serialNumber}</td>
                  <td className="p-3 font-medium">{item.quantity}</td>
                  <td className="p-3">
                    <StatusBadge status={item.status} size="sm" />
                  </td>
                  <td className="p-3">
                    {item.isFaulty ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-rose-950 text-rose-300 border border-rose-800 rounded font-bold">
                        <Wrench className="w-3 h-3" /> Faulty (Service Req)
                      </span>
                    ) : item.isOutsourced ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-orange-950 text-orange-300 border border-orange-800 rounded font-bold">
                        <ExternalLink className="w-3 h-3" /> Outsourced (Vendor PO)
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Normal Flow</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
