import { z } from 'zod';

export const ItemMatchStatusEnum = z.enum(['MATCHED', 'NOT_MATCHED']);
export const SerialMatchStatusEnum = z.enum(['MATCHED', 'NOT_MATCHED', 'NOT_APPLICABLE']);
export const QuantityStatusEnum = z.enum(['MATCHED', 'SHORT', 'EXCESS']);
export const ConditionStatusEnum = z.enum(['GOOD', 'DAMAGED', 'FAULTY', 'OTHER']);
export const VerificationResultEnum = z.enum(['VERIFIED', 'DISCREPANCY', 'SHORT', 'EXCEPTION']);

export const DocumentTypeEnum = z.enum([
  'COLLECTION_PROOF',
  'RECEIPT_PROOF',
  'PREVIOUS_CERTIFICATE',
  'VERIFICATION_PROOF',
  'OTHER',
]);

/**
 * Item-level verification input schema with business rule refinements
 */
export const SubmitVerificationSchema = z
  .object({
    request_id: z.string().uuid('Invalid request ID format'),
    request_item_id: z.string().uuid('Invalid request item ID format'),
    item_match_status: ItemMatchStatusEnum,
    serial_match_status: SerialMatchStatusEnum,
    received_quantity: z.number().int().min(0, 'Received quantity cannot be negative'),
    quantity_status: QuantityStatusEnum,
    condition_status: ConditionStatusEnum,
    verification_result: VerificationResultEnum,
    discrepancy_reason: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    // Rule 1: If item not matched, result cannot be VERIFIED and reason is mandatory
    if (val.item_match_status === 'NOT_MATCHED') {
      if (val.verification_result === 'VERIFIED') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['verification_result'],
          message: 'Verification result cannot be VERIFIED when item is NOT_MATCHED',
        });
      }
      if (!val.discrepancy_reason || val.discrepancy_reason.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discrepancy_reason'],
          message: 'Discrepancy reason is mandatory when item does not match specifications',
        });
      }
    }

    // Rule 2: If serial not matched, result cannot be VERIFIED and reason is mandatory
    if (val.serial_match_status === 'NOT_MATCHED') {
      if (val.verification_result === 'VERIFIED') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['verification_result'],
          message: 'Verification result cannot be VERIFIED when serial number is NOT_MATCHED',
        });
      }
      if (!val.discrepancy_reason || val.discrepancy_reason.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discrepancy_reason'],
          message: 'Discrepancy reason is mandatory when serial number does not match',
        });
      }
    }

    // Rule 3: If quantity is SHORT or EXCESS, result cannot be VERIFIED without documented reason
    if (val.quantity_status !== 'MATCHED') {
      if (val.verification_result === 'VERIFIED') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['verification_result'],
          message: `Verification result cannot be VERIFIED when quantity is ${val.quantity_status}`,
        });
      }
      if (!val.discrepancy_reason || val.discrepancy_reason.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discrepancy_reason'],
          message: `Discrepancy reason is mandatory when received quantity does not match requested quantity`,
        });
      }
    }

    // Rule 4: If condition is DAMAGED/FAULTY/OTHER, result cannot be VERIFIED as normal item
    if (val.condition_status !== 'GOOD') {
      if (val.verification_result === 'VERIFIED') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['verification_result'],
          message: `Item with condition '${val.condition_status}' cannot be verified as normal test item`,
        });
      }
      if (
        (!val.discrepancy_reason || val.discrepancy_reason.trim().length < 3) &&
        (!val.remarks || val.remarks.trim().length < 3)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discrepancy_reason'],
          message: 'Condition details must be documented in discrepancy reason or remarks',
        });
      }
    }
  });

/**
 * Cloudflare R2 Upload Pre-Signed URL Request Schema
 */
export const CreateUploadUrlSchema = z.object({
  request_id: z.string().uuid('Invalid request ID format'),
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().min(1).max(10485760, 'File exceeds maximum 10MB limit'),
  mime_type: z.enum([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ], {
    errorMap: () => ({ message: 'Only PDF and image files (PNG, JPG, JPEG) are permitted' }),
  }),
  document_type: DocumentTypeEnum,
  mandatory: z.boolean().default(false),
  item_id: z.string().uuid().optional().nullable(),
  request_item_id: z.string().uuid().optional().nullable(),
});

/**
 * Confirm uploaded document in PostgreSQL
 */
export const ConfirmDocumentSchema = z.object({
  request_id: z.string().uuid('Invalid request ID format'),
  document_type: DocumentTypeEnum,
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().min(1),
  mime_type: z.string().min(1),
  storage_reference: z.string().min(5),
  mandatory: z.boolean().default(false),
  item_id: z.string().uuid().optional().nullable(),
  request_item_id: z.string().uuid().optional().nullable(),
});

/**
 * Finalize Request Verification Schema
 */
export const CompleteRequestVerificationSchema = z.object({
  remarks: z.string().optional().nullable(),
});
