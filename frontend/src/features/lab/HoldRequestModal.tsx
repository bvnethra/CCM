import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PauseCircle, AlertTriangle } from 'lucide-react';
import { CalibrationRequest } from '../../types';
import { apiClient } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface HoldRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: CalibrationRequest;
  tenantId: string;
  onSuccess: () => void;
}

export const HoldRequestModal: React.FC<HoldRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  tenantId,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 3) {
      setError('Please provide a specific hold reason (at least 3 characters).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.holdLabRequest(
        request.id,
        tenantId,
        reason.trim(),
        currentUser?.id || 'sys'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to place request on hold');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Place Request On Hold — ${request.request_number}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Laboratory Hold Protocol</p>
            <p className="text-xs text-amber-700 mt-1">
              Placing this request on hold halts active processing while preserving all intake details and assignments. A clear reason must be documented for client and audit traceability.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Hold Reason <span className="text-red-500">*</span>
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Awaiting OEM technical manual or replacement sensor connector"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 border-amber-600"
            isLoading={isSubmitting}
            leftIcon={<PauseCircle className="w-4 h-4" />}
          >
            Confirm Hold
          </Button>
        </div>
      </form>
    </Modal>
  );
};
