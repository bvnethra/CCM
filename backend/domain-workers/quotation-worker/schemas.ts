import { z } from 'zod';

export const QuotationItemInputSchema = z.object({
  request_item_id: z.string().uuid().nullable().optional(),
  item_id: z.string().uuid(),
  description: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  override_cost: z.number().nonnegative().nullable().optional(),
  override_reason: z.string().nullable().optional(),
  tax_rate: z.number().nonnegative().default(18),
});

export const CreateQuotationSchema = z.object({
  quotation_type: z.enum(['STANDALONE', 'REQUEST_BASED']).default('STANDALONE'),
  request_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid(),
  valid_until: z.string().min(1, 'Valid until date is required'),
  currency: z.string().default('INR'),
  discount_amount: z.number().nonnegative().default(0),
  items: z.array(QuotationItemInputSchema).min(1, 'At least one item must be added'),
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
  response: z.enum(['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']),
  remarks: z.string().optional(),
  reference_number: z.string().optional(),
});

export const CostOverrideSchema = z.object({
  override_cost: z.number().nonnegative('Override cost must be non-negative'),
  override_reason: z.string().min(3, 'Override reason is mandatory when overriding standard cost'),
});

export const CreateRequestFromQuotationSchema = z.object({
  selected_quotation_item_ids: z.array(z.string().uuid()).min(1, 'Select at least one quotation item'),
  collection_agent_id: z.string().uuid().optional(),
  collection_date: z.string().optional(),
  priority: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
  remarks: z.string().optional(),
});

export type CreateQuotationInput = z.infer<typeof CreateQuotationSchema>;
export type QuotationItemInput = z.infer<typeof QuotationItemInputSchema>;
export type SubmitApprovalInput = z.infer<typeof SubmitApprovalSchema>;
export type InternalApprovalInput = z.infer<typeof InternalApprovalSchema>;
export type ClientResponseInput = z.infer<typeof ClientResponseSchema>;
export type CostOverrideInput = z.infer<typeof CostOverrideSchema>;
export type CreateRequestFromQuotationInput = z.infer<typeof CreateRequestFromQuotationSchema>;
