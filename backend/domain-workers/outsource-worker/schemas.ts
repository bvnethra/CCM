import { z } from 'zod';

export const createOutsourceRequestSchema = z.object({
  request_id: z.string().uuid(),
  request_item_id: z.string().uuid(),
  calibration_id: z.string().uuid().optional(),
  vendor_id: z.string().uuid(),
  outsource_reason: z.string().trim().min(3, 'Outsource reason is mandatory'),
  expected_return_date: z.string().optional(),
  remarks: z.string().optional(),
});

export const selectVendorSchema = z.object({
  vendor_id: z.string().uuid(),
  expected_return_date: z.string().optional(),
  remarks: z.string().optional(),
});

export const createVendorPOSchema = z.object({
  vendor_id: z.string().uuid(),
  request_id: z.string().uuid().optional(),
  outsource_request_id: z.string().uuid().optional(),
  po_date: z.string().optional(),
  tax_rate: z.number().min(0).max(100).optional().default(18), // Default GST 18%
  items: z.array(
    z.object({
      request_item_id: z.string().uuid(),
      item_id: z.string().uuid(),
      description: z.string().optional(),
      quantity: z.number().int().positive(),
      unit_cost: z.number().nonnegative(),
    })
  ).min(1, 'PO must contain at least one line item'),
  remarks: z.string().optional(),
});

export const sendToVendorSchema = z.object({
  carrier: z.string().trim().min(2, 'Carrier name is required'),
  tracking_number: z.string().trim().min(2, 'Tracking number is required'),
  movement_date: z.string().optional(),
  remarks: z.string().optional(),
  document_id: z.string().uuid().optional(),
});

export const vendorReceiveSchema = z.object({
  received_date: z.string().optional(),
  vendor_reference: z.string().optional(),
  remarks: z.string().optional(),
});

export const recordVendorCalibrationSchema = z.object({
  vendor_certificate_number: z.string().trim().min(2, 'Vendor certificate number is required'),
  vendor_result: z.enum(['PASS', 'FAIL', 'ADJUSTED', 'NOT_CALIBRATABLE']),
  calibrated_at: z.string().optional(),
  report_document_id: z.string().uuid().optional(),
  remarks: z.string().optional(),
}).refine(
  (data) => {
    if (data.vendor_result === 'FAIL' || data.vendor_result === 'NOT_CALIBRATABLE') {
      return !!data.remarks && data.remarks.trim().length >= 3;
    }
    return true;
  },
  {
    message: 'Mandatory failure reason/remarks are required for vendor FAIL or NOT_CALIBRATABLE results',
    path: ['remarks'],
  }
);

export const recordVendorReturnSchema = z.object({
  carrier: z.string().trim().min(2, 'Carrier name is required'),
  tracking_number: z.string().trim().min(2, 'Tracking number is required'),
  return_date: z.string().optional(),
  remarks: z.string().optional(),
  document_id: z.string().uuid().optional(),
});

export const receiveItemBackSchema = z.object({
  received_date: z.string().optional(),
  remarks: z.string().optional(),
});

export const cancelOutsourceSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason is mandatory'),
});
