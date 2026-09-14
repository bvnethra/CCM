import { z } from 'zod';
import { TenantStatusEnum } from '../tenant-worker/schemas';

export const CreateItemSchema = z.object({
  item_code: z
    .string()
    .trim()
    .min(2, 'Item code must be at least 2 characters')
    .max(50, 'Item code cannot exceed 50 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Item code must contain only alphanumeric characters, dashes, or underscores'),
  item_name: z
    .string()
    .trim()
    .min(2, 'Item name must be at least 2 characters')
    .max(255, 'Item name cannot exceed 255 characters'),
  item_type: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  manufacturer: z.string().trim().max(150).optional().nullable().or(z.literal('')),
  model: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  serial_number: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  measurement_range: z.string().trim().max(150).optional().nullable().or(z.literal('')),
  least_count: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  standard_cost: z
    .number({ invalid_type_error: 'Standard cost must be a number' })
    .nonnegative('Standard cost must be non-negative (>= 0)')
    .default(0),
  calibration_frequency: z
    .number({ invalid_type_error: 'Calibration frequency must be an integer' })
    .int('Calibration frequency must be a whole number')
    .min(1, 'Calibration frequency must be at least 1')
    .default(12),
  calibration_frequency_unit: z.string().trim().max(20).default('Months'),
  organization_id: z.string().uuid('Invalid Organization ID').optional().nullable().or(z.literal('')),
  sub_org_id: z.string().uuid('Invalid Sub-Organization ID').optional().nullable().or(z.literal('')),
  status: TenantStatusEnum.default('active'),
});

export const UpdateItemSchema = z.object({
  item_code: z
    .string()
    .trim()
    .min(2, 'Item code must be at least 2 characters')
    .max(50, 'Item code cannot exceed 50 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Item code must contain only alphanumeric characters, dashes, or underscores')
    .optional(),
  item_name: z
    .string()
    .trim()
    .min(2, 'Item name must be at least 2 characters')
    .max(255, 'Item name cannot exceed 255 characters')
    .optional(),
  item_type: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  manufacturer: z.string().trim().max(150).optional().nullable().or(z.literal('')),
  model: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  serial_number: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  measurement_range: z.string().trim().max(150).optional().nullable().or(z.literal('')),
  least_count: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  standard_cost: z
    .number({ invalid_type_error: 'Standard cost must be a number' })
    .nonnegative('Standard cost must be non-negative (>= 0)')
    .optional(),
  calibration_frequency: z
    .number({ invalid_type_error: 'Calibration frequency must be an integer' })
    .int('Calibration frequency must be a whole number')
    .min(1, 'Calibration frequency must be at least 1')
    .optional(),
  calibration_frequency_unit: z.string().trim().max(20).optional(),
  organization_id: z.string().uuid('Invalid Organization ID').optional().nullable().or(z.literal('')),
  sub_org_id: z.string().uuid('Invalid Sub-Organization ID').optional().nullable().or(z.literal('')),
  status: TenantStatusEnum.optional(),
});

export const UpdateItemStatusSchema = z.object({
  status: TenantStatusEnum,
});
