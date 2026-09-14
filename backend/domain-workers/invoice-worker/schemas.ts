import { z } from 'zod';

export const InvoiceItemInputSchema = z.object({
  line_type: z.enum(['CALIBRATION', 'SERVICE', 'OUTSOURCING', 'OTHER']).default('CALIBRATION'),
  request_item_id: z.string().uuid().optional().nullable(),
  item_id: z.string().uuid().optional().nullable(),
  quotation_item_id: z.string().uuid().optional().nullable(),
  service_request_id: z.string().uuid().optional().nullable(),
  vendor_outsource_request_id: z.string().uuid().optional().nullable(),
  description: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  unit_price: z.number().nonnegative().optional(),
  tax_rate: z.number().nonnegative().default(18),
  discount_amount: z.number().nonnegative().default(0),
});

export const CreateInvoiceSchema = z.object({
  quotation_id: z.string().uuid().optional().nullable(),
  request_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  invoice_mode: z.enum(['ITEMS_AND_INVOICE', 'INVOICE_ONLY']).default('ITEMS_AND_INVOICE'),
  invoice_type: z.enum(['STANDARD', 'PARTIAL', 'URGENT']).default('STANDARD'),
  due_date: z.string().min(1, 'Due date is required'),
  currency: z.string().default('INR'),
  subtotal: z.number().nonnegative().optional(),
  tax_amount: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  total_amount: z.number().nonnegative().optional(),
  urgent_reason: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(InvoiceItemInputSchema).optional().default([]),
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
