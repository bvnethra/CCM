import { z } from 'zod';

export const CreateServiceRequestSchema = z.object({
  request_id: z.string().uuid('Invalid request ID format'),
  request_item_id: z.string().uuid('Invalid request item ID format'),
  calibration_id: z.string().uuid('Invalid calibration ID format'),
  fault_description: z.string().min(5, 'Fault description must be at least 5 characters'),
  estimated_service_cost: z.number().min(0, 'Estimated cost cannot be negative').optional().nullable(),
  service_remarks: z.string().optional().nullable(),
});

export const UpdateServiceRequestSchema = z.object({
  fault_description: z.string().min(5, 'Fault description must be at least 5 characters').optional(),
  estimated_service_cost: z.number().min(0, 'Estimated cost cannot be negative').optional().nullable(),
  service_remarks: z.string().optional().nullable(),
});

export const RecordApprovalSchema = z.object({
  approval_status: z.enum(['APPROVED', 'REJECTED'], {
    required_error: 'Approval status must be APPROVED or REJECTED',
  }),
  approved_by_client_name: z.string().optional().nullable(),
  approved_by_client_role: z.string().optional().nullable(),
  approval_reference: z.string().optional().nullable(),
  approval_remarks: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.approval_status === 'APPROVED') {
      return Boolean(data.approved_by_client_name && data.approved_by_client_name.trim().length > 0);
    }
    return true;
  },
  {
    message: 'Client approver name is required when approving a service request',
    path: ['approved_by_client_name'],
  }
).refine(
  (data) => {
    if (data.approval_status === 'REJECTED') {
      return Boolean(data.approval_remarks && data.approval_remarks.trim().length > 0);
    }
    return true;
  },
  {
    message: 'Rejection remarks are mandatory when rejecting a service request',
    path: ['approval_remarks'],
  }
);

export const CompleteServiceSchema = z.object({
  service_remarks: z.string().optional().nullable(),
});
