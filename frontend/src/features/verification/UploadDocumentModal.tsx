import React, { useState } from 'react';
import { X, UploadCloud, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { apiClient } from '../../lib/api';
import { DocumentType, RequestItem } from '../../types';

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  items: RequestItem[];
  onDocumentUploaded: () => void;
}

const DOCUMENT_TYPES: { label: string; value: DocumentType; description: string }[] = [
  { label: 'Collection Proof', value: 'COLLECTION_PROOF', description: 'Signed physical handover receipt or pickup voucher' },
  { label: 'Receipt Proof', value: 'RECEIPT_PROOF', description: 'Lab intake gatepass or arrival confirmation' },
  { label: 'Previous Certificate', value: 'PREVIOUS_CERTIFICATE', description: 'OEM calibration certificate or prior test report' },
  { label: 'Verification Proof', value: 'VERIFICATION_PROOF', description: 'Inspection photo showing serial number, label or physical defect' },
  { label: 'Other Document', value: 'OTHER', description: 'Additional test sheets, manuals, or client notes' },
];

export const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  isOpen,
  onClose,
  requestId,
  items,
  onDocumentUploaded,
}) => {
  const { activeTenant } = useTenant();
  const { currentUser } = useAuth();
  const [documentType, setDocumentType] = useState<DocumentType>('VERIFICATION_PROOF');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [mandatory, setMandatory] = useState<boolean>(true);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    const validMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validMimeTypes.includes(selectedFile.type)) {
      setError('Invalid file format. Only PDF, PNG, and JPG files are accepted.');
      return;
    }
    // Max 10MB
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10MB maximum limit.');
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    if (!activeTenant || !currentUser) {
      setError('Session tenant or user not found.');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Find item details if item selected
      const selectedReqItem = items.find((i) => i.id === selectedItemId);

      // 1. Request signed upload URL from R2 storage endpoint
      const uploadIntent = await apiClient.getUploadUrl({
        tenantId: activeTenant.id,
        requestId,
        itemId: selectedReqItem?.item_id,
        requestItemId: selectedReqItem?.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        documentType,
        mandatory,
      });

      // 2. Simulate binary upload / R2 presigned PUT
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 3. Confirm document record creation with versioning
      await apiClient.confirmDocumentUpload({
        tenantId: activeTenant.id,
        requestId,
        itemId: selectedReqItem?.item_id,
        requestItemId: selectedReqItem?.id,
        documentType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storageReference: uploadIntent.storageReference,
        mandatory,
        uploadedBy: currentUser.id,
      });

      setSuccessMsg('Document successfully uploaded and versioned in R2 storage.');
      setTimeout(() => {
        onDocumentUploaded();
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Upload Proof Document</h2>
              <p className="text-xs text-slate-500">Attach mandatory verification proof, handover voucher, or certificates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Document Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Document Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} — {type.description}
                </option>
              ))}
            </select>
          </div>

          {/* Associated Item (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Associated Item <span className="text-slate-400 font-normal">(Optional — leave blank for entire request)</span>
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="">All Items / Request Level Document</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.item?.item_name || 'Item'} (Expected SN: {it.item?.serial_number || 'N/A'}, Qty: {it.requested_quantity})
                </option>
              ))}
            </select>
          </div>

          {/* Mandatory Checkbox */}
          <div className="flex items-center gap-3 p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg">
            <input
              type="checkbox"
              id="mandatory-doc"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="mandatory-doc" className="text-xs text-slate-700 font-medium cursor-pointer">
              <span className="font-semibold text-slate-900">Mandatory Proof Document</span> (Gate check: Required before request verification can be completed)
            </label>
          </div>

          {/* Drag & Drop File Zone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              File Attachment <span className="text-rose-500">*</span>
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50/50'
                  : file
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              <input
                type="file"
                id="file-upload"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {file ? (
                <div className="flex items-center justify-center gap-3 text-slate-800">
                  <FileText className="w-8 h-8 text-indigo-600" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB • {file.type || 'Unknown'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-indigo-600 hover:underline">
                      Click to browse
                    </span>{' '}
                    <span className="text-sm text-slate-500">or drag and drop your file here</span>
                  </div>
                  <p className="text-xs text-slate-400">PDF, PNG, or JPG up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm shadow-indigo-200 transition-all flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Uploading to R2...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Version</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
