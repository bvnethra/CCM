import { z } from 'zod';

export const createSignatureRequestSchema = z.object({
  invoice_id: z.string().uuid(),
  signer_name: z.string().min(1, 'Signer name is required'),
  signer_role: z.string().optional(),
  signer_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  signer_phone: z.string().optional(),
  expires_in_days: z.number().int().min(1).max(90).default(7),
});

export const signInvoiceSchema = z.object({
  request_reference: z.string().min(1, 'Request reference is required'),
  signer_name: z.string().min(1, 'Signer name is required'),
  signer_role: z.string().optional(),
  signer_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  signer_phone: z.string().optional(),
  signature_data: z.string().min(10, 'Signature drawing data is required'),
});

export const rejectSignatureSchema = z.object({
  request_reference: z.string().min(1, 'Request reference is required'),
  signer_name: z.string().min(1, 'Signer name is required'),
  signer_role: z.string().optional(),
  rejection_reason: z.string().min(3, 'Rejection reason is required'),
});

export const retrySignatureRequestSchema = z.object({
  invoice_id: z.string().uuid(),
  signer_name: z.string().min(1, 'Signer name is required'),
  signer_role: z.string().optional(),
  signer_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  signer_phone: z.string().optional(),
  expires_in_days: z.number().int().min(1).max(90).default(7),
});

export type CreateSignatureRequestInput = z.infer<typeof createSignatureRequestSchema>;
export type SignInvoiceInput = z.infer<typeof signInvoiceSchema>;
export type RejectSignatureInput = z.infer<typeof rejectSignatureSchema>;
export type RetrySignatureRequestInput = z.infer<typeof retrySignatureRequestSchema>;
