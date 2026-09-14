import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { UserCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { CalibrationRequest, UserProfile } from '../../types';
import { apiClient } from '../../lib/api';

interface AssignLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: CalibrationRequest;
  tenantId: string;
  onSuccess: (assignedUserName: string) => void;
}

export const AssignLabModal: React.FC<AssignLabModalProps> = ({
  isOpen,
  onClose,
  request,
  tenantId,
  onSuccess,
}) => {
  const [labUsers, setLabUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReassign = !!request.current_assignment;
  const currentAssigneeName = request.current_assignment?.assigned_to_user?.full_name || 'Assigned Technician';

  useEffect(() => {
    if (!isOpen) {
      setSelectedUserId('');
      setRemarks('');
      setError(null);
      return;
    }

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const users = await apiClient.getTenantLabUsers(tenantId);
        setLabUsers(users);
        if (users.length > 0) {
          // Default to first user who is not currently assigned
          const candidate = users.find((u) => u.id !== request.current_assignment?.assigned_to) || users[0];
          setSelectedUserId(candidate.id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load laboratory technicians');
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadUsers();
  }, [isOpen, tenantId, request]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a laboratory technician.');
      return;
    }

    if (isReassign && (!remarks || remarks.trim().length < 3)) {
      setError('Reassignment reason is required (at least 3 characters).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isReassign) {
        await apiClient.reassignLabRequest(request.id, tenantId, selectedUserId, remarks.trim());
      } else {
        await apiClient.assignLabRequest(request.id, tenantId, selectedUserId, remarks.trim() || null);
      }

      const assignedUser = labUsers.find((u) => u.id === selectedUserId);
      onSuccess(assignedUser?.full_name || 'Technician');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to assign request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReassign ? `Reassign Lab Technician — ${request.request_number}` : `Assign Lab Technician — ${request.request_number}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isReassign && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-sm text-amber-800">
            <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 animate-spin-reverse" />
            <div>
              <span className="font-medium">Currently Assigned: </span>
              <span className="font-semibold">{currentAssigneeName}</span>
              <p className="text-xs text-amber-700 mt-0.5">
                Reassigning will preserve complete audit history and update the active assignment.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Select Laboratory Technician <span className="text-red-500">*</span>
          </label>
          {isLoadingUsers ? (
            <div className="py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
              Loading available lab staff...
            </div>
          ) : (
            <Select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              options={labUsers.map((u) => ({
                value: u.id,
                label: `${u.full_name} (${u.role.replace('_', ' ').toUpperCase()}) - ${u.email}`,
              }))}
            />
          )}
          <p className="text-xs text-slate-500 mt-1">
            Only active technicians and administrators within this tenant can be assigned.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {isReassign ? (
              <>
                Reassignment Reason <span className="text-red-500">*</span>
              </>
            ) : (
              'Assignment Instructions / Remarks (Optional)'
            )}
          </label>
          <Input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={
              isReassign
                ? 'e.g., Technician on leave; reassigning to RF metrology lead'
                : 'e.g., Prioritize pressure calibrator first'
            }
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} leftIcon={<UserCheck className="w-4 h-4" />}>
            {isReassign ? 'Confirm Reassignment' : 'Assign Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
