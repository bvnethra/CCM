import { z } from 'zod';

export const RequestItemInputSchema = z.object({
  item_id: z.string().min(1, 'Valid item ID is required'),
  requested_quantity: z.number().int('Quantity must be an integer').positive('Quantity must be greater than 0').optional(),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be greater than 0').optional(),
  item_available: z.enum(['YES', 'NO'], {
    errorMap: () => ({ message: "Availability must be either 'YES' or 'NO'" }),
  }),
  availability_remarks: z.string().optional().nullable(),
}).refine(
  (data) => (data.requested_quantity !== undefined && data.requested_quantity > 0) || (data.quantity !== undefined && data.quantity > 0),
  {
    message: 'Quantity must be greater than 0',
    path: ['requested_quantity'],
  }
).refine(
  (data) => {
    if (data.item_available === 'NO') {
      return !!data.availability_remarks && data.availability_remarks.trim().length > 0;
    }
    return true;
  },
  {
    message: 'Availability remarks are mandatory when an item is marked unavailable (NO)',
    path: ['availability_remarks'],
  }
);

export const CreateCalibrationRequestSchema = z.object({
  client_id: z.string().min(1, 'Valid client ID is required'),
  collection_date: z.string().min(1, 'Collection date is required'),
  priority: z.enum(['NORMAL', 'URGENT'], {
    errorMap: () => ({ message: "Priority must be either 'NORMAL' or 'URGENT'" }),
  }).default('NORMAL'),
  remarks: z.string().optional().nullable(),
  items: z.array(RequestItemInputSchema).min(1, 'At least one item must be included in the calibration request'),
  override_availability: z.boolean().optional().default(false),
});

export const UpdateCalibrationRequestSchema = z.object({
  priority: z.enum(['NORMAL', 'URGENT']).optional(),
  collection_date: z.string().min(1).optional(),
  remarks: z.string().optional().nullable(),
});

export const UpdateCalibrationRequestStatusSchema = z.object({
  status: z.enum(['CREATED', 'COLLECTED', 'ON_HOLD', 'CANCELLED'], {
    errorMap: () => ({ message: "Status must be 'CREATED', 'COLLECTED', 'ON_HOLD', or 'CANCELLED'" }),
  }),
  remarks: z.string().optional().nullable(),
});

export type RequestItemInput = z.infer<typeof RequestItemInputSchema>;
export type CreateCalibrationRequestInput = z.infer<typeof CreateCalibrationRequestSchema>;
export type UpdateCalibrationRequestInput = z.infer<typeof UpdateCalibrationRequestSchema>;
export type UpdateCalibrationRequestStatusInput = z.infer<typeof UpdateCalibrationRequestStatusSchema>;
