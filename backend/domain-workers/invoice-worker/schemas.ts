import { z } from 'zod';

export const InvoiceItemInputSchema = z.object({
  request_item_id: z.string().uuid(),
  item_id: z.string().uuid(),
  quotation_item_id: z.string().uuid().optional(),
  description: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  unit_price: z.number().nonnegative().optional(),
  tax_rate: z.number().nonnegative().default(18),
  discount_amount: z.number().nonnegative().default(0),
});

export const CreateInvoiceSchema = z.object({
  quotation_id: z.string().uuid(),
  invoice_type: z.enum(['STANDARD', 'PARTIAL', 'URGENT']).default('STANDARD'),
  due_date: z.string().min(1, 'Due date is required'),
  currency: z.string().default('INR'),
  urgent_reason: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(InvoiceItemInputSchema).min(1, 'At least one eligible quotation item must be selected'),
});

export const MarkReadySchema = z.object({
  remarks: z.string().optional(),
});

export const CancelInvoiceSchema = z.object({
  cancellation_reason: z.string().min(3, 'Cancellation reason is required'),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type InvoiceItemInput = z.infer<typeof InvoiceItemInputSchema>;
export type MarkReadyInput = z.infer<typeof MarkReadySchema>;
export type CancelInvoiceInput = z.infer<typeof CancelInvoiceSchema>;
