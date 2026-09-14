import { z } from 'zod';

export const StartCalibrationSchema = z.object({
  request_id: z.string().uuid('Invalid request ID format'),
  request_item_id: z.string().uuid('Invalid request item ID format'),
  item_id: z.string().uuid('Invalid item ID format'),
  calibration_method: z.string().optional(),
  environmental_conditions: z.string().optional(),
});

export const AddMeasurementSchema = z.object({
  measurement_point: z.string().min(1, 'Measurement point name is required'),
  nominal_value: z.number().optional().nullable(),
  observed_value: z.number().optional().nullable(),
  unit: z.string().optional().nullable(),
  tolerance_min: z.number().optional().nullable(),
  tolerance_max: z.number().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const UpdateMeasurementSchema = AddMeasurementSchema.partial();

export const CompleteCalibrationSchema = z.object({
  result: z.enum(['PASS', 'FAIL', 'ADJUSTED', 'NOT_CALIBRATABLE'], {
    required_error: 'Calibration result is required',
  }),
  calibration_method: z.string().min(1, 'Calibration method is required'),
  environmental_conditions: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  calibration_frequency_override: z.number().optional().nullable(),
  calibration_frequency_unit_override: z.enum(['MONTHS', 'YEARS', 'DAYS']).optional().nullable(),
  override_reason: z.string().optional().nullable(),
});

export const GenerateCertificateSchema = z.object({
  certificate_number: z.string().optional(),
  override_existing: z.boolean().optional().default(false),
  regeneration_reason: z.string().optional(),
});

export const FrequencyOverrideSchema = z.object({
  calibration_frequency: z.number().min(1, 'Frequency must be a positive integer'),
  calibration_frequency_unit: z.enum(['MONTHS', 'YEARS', 'DAYS']),
  reason: z.string().min(3, 'Override reason is required'),
});
