import React, { useState } from 'react';
import { FileText, Download, ExternalLink, ShieldCheck, Upload } from 'lucide-react';
import { fetchApi } from '../../api/client';

interface DocumentManagerProps {
  requestId?: string;
  documents?: any[];
  onUploadSuccess?: () => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  requestId,
  documents = [],
  onUploadSuccess,
}) => {
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const handleDownloadSignedUrl = async (doc: any) => {
    setLoadingDocId(doc.id);
    const res = await fetchApi(`/api/documents/${doc.id}/signed-url?ref=${encodeURIComponent(doc.storageReference)}`);
    if (res.success && res.data) {
      // Simulate controlled signed URL access
      alert(`R2 Signed URL generated (Valid for 60 min):\n${res.data.signedUrl}`);
    }
    setLoadingDocId(null);
  };

  const handleMockUpload = async () => {
    const fileName = prompt('Enter document file name:', 'calibration_report_signed.pdf');
    if (!fileName) return;

    const res = await fetchApi('/api/documents', {
      method: 'POST',
      body: JSON.stringify({
        requestId,
        documentType: 'Calibration Certificate / Proof',
        fileName,
        mandatory: true,
      }),
    });

    if (res.success) {
      alert('Document uploaded securely to Cloudflare R2 bucket!');
      if (onUploadSuccess) onUploadSuccess();
    }
  };

  return (
    <div className="glass-card p-5 rounded-xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-400" />
          <h4 className="font-semibold text-slate-100">Private Cloudflare R2 Document Storage</h4>
        </div>
        <button
          onClick={handleMockUpload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sky-950 border border-sky-800/80 text-sky-300 hover:bg-sky-900 rounded-lg transition"
        >
          <Upload className="w-3.5 h-3.5" /> Upload Document
        </button>
      </div>

      <div className="divide-y divide-slate-800/60">
        {documents.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            No document proofs attached yet. All uploaded objects are stored privately in Cloudflare R2.
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-sky-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-200">{doc.fileName}</p>
                    {doc.mandatory && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded">
                        Mandatory
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">{doc.documentType} • Version {doc.version || 1}</p>
                </div>
              </div>

              <button
                onClick={() => handleDownloadSignedUrl(doc)}
                disabled={loadingDocId === doc.id}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                {loadingDocId === doc.id ? 'Generating...' : 'Get Signed URL'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
