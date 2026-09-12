import React, { useEffect, useState } from 'react';
import { FileCheck2, ShieldCheck } from 'lucide-react';
import { SignatureCanvas } from '../components/Workflow/SignatureCanvas';
import { fetchApi } from '../api/client';
import { CalibrationRequest } from '../types';

export const SignatureCapturePage: React.FC = () => {
  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [selectedReqId, setSelectedReqId] = useState('');
  const [signatureType, setSignatureType] = useState<'INVOICE_APPROVAL' | 'DELIVERY_RECEIPT'>('INVOICE_APPROVAL');
  const [signerName, setSignerName] = useState('Robert Vance');
  const [signerEmail, setSignerEmail] = useState('r.vance@apexmanufacturing.com');
  const [savedSignatures, setSavedSignatures] = useState<any[]>([]);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const res = await fetchApi('/api/requests');
    if (res.success) {
      setRequests(res.data || []);
      if (res.data && res.data.length > 0) setSelectedReqId(res.data[0].id);
    }
  };

  const handleSaveSignature = async (signatureDataUrl: string) => {
    const payload = {
      requestId: selectedReqId,
      signatureType,
      signerName,
      signerEmail,
      signatureData: signatureDataUrl,
    };

    const res = await fetchApi('/api/signatures', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      alert(`Client ${signatureType.replace(/_/g, ' ')} signature captured and audit logged!`);
      setSavedSignatures([...savedSignatures, res.data]);
    } else {
      alert(res.error?.message || 'Signature capture failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-purple-400" /> Client Digital Signature Module
          </h2>
          <p className="text-xs text-slate-400">
            Strictly separates Commercial Invoice Signatures from Delivery Receiving Signatures.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signature Capture Form */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">Capture Digital Signature</h3>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Request *</label>
            <select
              value={selectedReqId}
              onChange={(e) => setSelectedReqId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            >
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.requestNumber} - {r.clientName} ({r.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Signature Event Type *</label>
            <select
              value={signatureType}
              onChange={(e: any) => setSignatureType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            >
              <option value="INVOICE_APPROVAL">Invoice Commercial Approval Signature</option>
              <option value="DELIVERY_RECEIPT">Delivery Receipt Signature</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Signer Full Name *</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Signer Email *</label>
              <input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <SignatureCanvas
            onSave={handleSaveSignature}
            label={`Digital Canvas (${signatureType.replace(/_/g, ' ')})`}
          />
        </div>

        {/* Captured Signatures Log */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">Audit Verified Signature Events</h3>
          </div>

          <div className="space-y-3">
            {savedSignatures.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No new signature events captured in current session yet.
              </div>
            ) : (
              savedSignatures.map((sig) => (
                <div key={sig.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-400">{sig.signatureType}</span>
                    <span className="text-[10px] text-slate-500">{sig.signedAt}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <div>Signer: <strong>{sig.signerName}</strong></div>
                    <div className="text-[10px] font-mono text-slate-500">IP: {sig.ipAddress}</div>
                  </div>
                  <img src={sig.signatureData} alt="Signature" className="h-12 bg-white rounded p-1" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
