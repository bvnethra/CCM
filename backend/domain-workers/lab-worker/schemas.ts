import { z } from 'zod';

export const AssignLabRequestSchema = z.object({
  assigned_to: z.string().min(1, 'Assigned technician user ID is required'),
  remarks: z.string().trim().max(1000).optional().nullable(),
});

export const ReassignLabRequestSchema = z.object({
  new_assigned_to: z.string().min(1, 'New assigned technician user ID is required'),
  remarks: z.string().trim().min(3, 'Reassignment reason/remarks are required').max(1000),
});

export const HoldLabRequestSchema = z.object({
  hold_reason: z.string().trim().min(3, 'Hold reason is mandatory (at least 3 characters)').max(1000),
});

export const MoveToLabQueueSchema = z.object({
  remarks: z.string().trim().max(1000).optional().nullable(),
});

export type AssignLabRequestInput = z.infer<typeof AssignLabRequestSchema>;
export type ReassignLabRequestInput = z.infer<typeof ReassignLabRequestSchema>;
export type HoldLabRequestInput = z.infer<typeof HoldLabRequestSchema>;
export type MoveToLabQueueInput = z.infer<typeof MoveToLabQueueSchema>;
