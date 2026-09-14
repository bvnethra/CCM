import { z } from 'zod';

export const QuotationItemInputSchema = z.object({
  request_item_id: z.string().uuid(),
  item_id: z.string().uuid(),
  description: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  override_cost: z.number().nonnegative().optional(),
  override_reason: z.string().optional(),
  tax_rate: z.number().nonnegative().default(18),
});

export const CreateQuotationSchema = z.object({
  request_id: z.string().uuid(),
  client_id: z.string().uuid(),
  valid_until: z.string().min(1, 'Valid until date is required'),
  currency: z.string().default('INR'),
  discount_amount: z.number().nonnegative().default(0),
  items: z.array(QuotationItemInputSchema).min(1, 'At least one eligible item must be added'),
  remarks: z.string().optional(),
});

export const SubmitApprovalSchema = z.object({
  approval_remarks: z.string().optional(),
});

export const InternalApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  approval_remarks: z.string().optional(),
});

export const ClientResponseSchema = z.object({
  response: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().optional(),
  reference_number: z.string().optional(),
});

export const CostOverrideSchema = z.object({
  override_cost: z.number().nonnegative('Override cost must be non-negative'),
  override_reason: z.string().min(3, 'Override reason is mandatory when overriding standard cost'),
});

export type CreateQuotationInput = z.infer<typeof CreateQuotationSchema>;
export type QuotationItemInput = z.infer<typeof QuotationItemInputSchema>;
export type SubmitApprovalInput = z.infer<typeof SubmitApprovalSchema>;
export type InternalApprovalInput = z.infer<typeof InternalApprovalSchema>;
export type ClientResponseInput = z.infer<typeof ClientResponseSchema>;
export type CostOverrideInput = z.infer<typeof CostOverrideSchema>;
