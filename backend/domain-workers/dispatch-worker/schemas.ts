import { z } from 'zod';

export const createDispatchSchema = z.object({
  request_id: z.string().uuid(),
  invoice_id: z.string().uuid().optional(),
  client_id: z.string().uuid(),
  dispatch_type: z.enum(['STANDARD', 'PARTIAL', 'URGENT']),
  dispatch_date: z.string().min(1, 'Dispatch date is required'),
  expected_delivery_date: z.string().optional(),
  shipping_address: z.string().min(5, 'Valid shipping address is required'),
  billing_address: z.string().optional(),
  urgent_reason: z.string().optional(),
  remarks: z.string().optional(),
  selected_item_ids: z.array(z.string().uuid()).min(1, 'At least one item must be selected for dispatch'),
}).refine(
  (data) => {
    if (data.dispatch_type === 'URGENT' && (!data.urgent_reason || !data.urgent_reason.trim())) {
      return false;
    }
    return true;
  },
  {
    message: 'Mandatory urgent reason is required for URGENT dispatches',
    path: ['urgent_reason'],
  }
);

export const startPackingSchema = z.object({
  remarks: z.string().optional(),
});

export const markPackedSchema = z.object({
  package_reference: z.string().min(1, 'Package reference or box ID is required'),
  number_of_packages: z.number().int().min(1).default(1),
  packing_remarks: z.string().optional(),
});

export const shipDispatchSchema = z.object({
  carrier_name: z.string().min(1, 'Carrier name is required'),
  tracking_number: z.string().min(1, 'Tracking number is required'),
  dispatch_date: z.string().min(1, 'Dispatch date is required'),
  expected_delivery_date: z.string().optional(),
  remarks: z.string().optional(),
});

export const updateTrackingSchema = z.object({
  status: z.enum(['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']),
  carrier_notes: z.string().optional(),
});

export const confirmDeliverySchema = z.object({
  recipient_name: z.string().min(1, 'Recipient name is required'),
  recipient_role: z.string().optional(),
  recipient_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  recipient_phone: z.string().optional(),
  delivery_date: z.string().min(1, 'Delivery date is required'),
  delivery_signature_data: z.string().min(10, 'Delivery digital signature drawing is required'),
  remarks: z.string().optional(),
});

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
export type StartPackingInput = z.infer<typeof startPackingSchema>;
export type MarkPackedInput = z.infer<typeof markPackedSchema>;
export type ShipDispatchInput = z.infer<typeof shipDispatchSchema>;
export type UpdateTrackingInput = z.infer<typeof updateTrackingSchema>;
export type ConfirmDeliveryInput = z.infer<typeof confirmDeliverySchema>;
