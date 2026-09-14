import { z } from 'zod';
import { TenantStatusEnum } from '../tenant-worker/schemas';

export const CreateVendorSchema = z.object({
  vendor_code: z
    .string()
    .trim()
    .min(2, 'Vendor code must be at least 2 characters')
    .max(50, 'Vendor code cannot exceed 50 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Vendor code must contain only alphanumeric characters, dashes, or underscores'),
  vendor_name: z
    .string()
    .trim()
    .min(2, 'Vendor name must be at least 2 characters')
    .max(255, 'Vendor name cannot exceed 255 characters'),
  contact_person: z.string().trim().max(150).optional().nullable(),
  contact_email: z
    .string()
    .trim()
    .email('Invalid email address format')
    .max(255)
    .optional()
    .nullable()
    .or(z.literal('')),
  contact_phone: z
    .string()
    .trim()
    .max(50)
    .regex(/^[+0-9\s\-().]+$/, 'Invalid phone number format')
    .optional()
    .nullable()
    .or(z.literal('')),
  address_line_1: z.string().trim().max(500).optional().nullable(),
  address_line_2: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().default('India'),
  postal_code: z.string().trim().max(20).optional().nullable(),
  gst_number: z
    .string()
    .trim()
    .max(50)
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i, 'Invalid GSTIN format (e.g. 29AABCN9988E1Z4)')
    .optional()
    .nullable()
    .or(z.literal('')),
  serviced_categories: z.array(z.string().trim()).optional().default([]),
  organization_id: z.string().uuid('Invalid Organization ID').optional().nullable().or(z.literal('')),
  sub_org_id: z.string().uuid('Invalid Sub-Organization ID').optional().nullable().or(z.literal('')),
  status: TenantStatusEnum.default('active'),
});

export const UpdateVendorSchema = z.object({
  vendor_code: z
    .string()
    .trim()
    .min(2, 'Vendor code must be at least 2 characters')
    .max(50, 'Vendor code cannot exceed 50 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Vendor code must contain only alphanumeric characters, dashes, or underscores')
    .optional(),
  vendor_name: z
    .string()
    .trim()
    .min(2, 'Vendor name must be at least 2 characters')
    .max(255, 'Vendor name cannot exceed 255 characters')
    .optional(),
  contact_person: z.string().trim().max(150).optional().nullable(),
  contact_email: z
    .string()
    .trim()
    .email('Invalid email address format')
    .max(255)
    .optional()
    .nullable()
    .or(z.literal('')),
  contact_phone: z
    .string()
    .trim()
    .max(50)
    .regex(/^[+0-9\s\-().]+$/, 'Invalid phone number format')
    .optional()
    .nullable()
    .or(z.literal('')),
  address_line_1: z.string().trim().max(500).optional().nullable(),
  address_line_2: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  postal_code: z.string().trim().max(20).optional().nullable(),
  gst_number: z
    .string()
    .trim()
    .max(50)
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i, 'Invalid GSTIN format (e.g. 29AABCN9988E1Z4)')
    .optional()
    .nullable()
    .or(z.literal('')),
  serviced_categories: z.array(z.string().trim()).optional(),
  organization_id: z.string().uuid('Invalid Organization ID').optional().nullable().or(z.literal('')),
  sub_org_id: z.string().uuid('Invalid Sub-Organization ID').optional().nullable().or(z.literal('')),
  status: TenantStatusEnum.optional(),
});

export const UpdateVendorStatusSchema = z.object({
  status: TenantStatusEnum,
});
