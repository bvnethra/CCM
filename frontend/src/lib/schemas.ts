import { z } from 'zod';

export const userRoleEnum = z.enum([
  'super_admin',
  'tenant_admin',
  'org_admin',
  'manager',
  'lab_user',
  'collection_agent',
  'commercial_user',
  'dispatch_user',
  'viewer',
]);

export const tenantFormSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255),
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only alphanumeric characters, dashes, or underscores'),
  status: z.enum(['active', 'inactive', 'suspended']),
  timezone: z.string().optional().default('UTC'),
  currency: z.string().optional().default('USD'),
  complianceStandard: z.string().optional().default('ISO/IEC 17025'),
});

export type TenantFormValues = z.infer<typeof tenantFormSchema>;

export const organizationFormSchema = z.object({
  name: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(255),
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only alphanumeric characters, dashes, or underscores'),
  status: z.enum(['active', 'inactive', 'suspended']),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

export const subOrganizationFormSchema = z.object({
  organization_id: z.string().min(1, 'Parent organization is required'),
  name: z.string().trim().min(2, 'Sub-organization name must be at least 2 characters').max(255),
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only alphanumeric characters, dashes, or underscores'),
  status: z.enum(['active', 'inactive', 'suspended']),
});

export type SubOrganizationFormValues = z.infer<typeof subOrganizationFormSchema>;

// STEP 2 SCHEMAS

export const userFormSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(255),
  email: z.string().trim().email('Please enter a valid email address'),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  organization_id: z.string().optional().or(z.literal('')),
  sub_organization_id: z.string().optional().or(z.literal('')),
  role: userRoleEnum.default('viewer'),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  role_ids: z.array(z.string()).optional().default([]),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

export const roleFormSchema = z.object({
  name: z.string().trim().min(2, 'Role name must be at least 2 characters').max(100),
  code: z
    .string()
    .trim()
    .min(2, 'Role code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only alphanumeric characters, dashes, or underscores'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  permission_ids: z.array(z.string()).optional().default([]),
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;

// STEP 3 SCHEMAS: CLIENT MASTER

export const clientFormSchema = z.object({
  client_code: z
    .string()
    .trim()
    .min(2, 'Client code must be at least 2 characters')
    .max(50, 'Client code cannot exceed 50 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Client code must contain only alphanumeric characters, dashes, or underscores'),
  client_name: z
    .string()
    .trim()
    .min(2, 'Client name must be at least 2 characters')
    .max(255, 'Client name cannot exceed 255 characters'),
  contact_person: z.string().trim().max(150).optional().or(z.literal('')),
  contact_email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(255)
    .optional()
    .or(z.literal('')),
  contact_phone: z
    .string()
    .trim()
    .max(50)
    .regex(/^[+0-9\s\-().]+$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  address_line_1: z.string().trim().max(500).optional().or(z.literal('')),
  address_line_2: z.string().trim().max(500).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  country: z.string().trim().max(100).default('India'),
  postal_code: z.string().trim().max(20).optional().or(z.literal('')),
  billing_address: z.string().trim().max(1000).optional().or(z.literal('')),
  gst_number: z
    .string()
    .trim()
    .max(50)
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i, 'Invalid GSTIN format (e.g. 29AABCA1234F1Z5)')
    .optional()
    .or(z.literal('')),
  organization_id: z.string().optional().or(z.literal('')),
  sub_org_id: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

// STEP 4 SCHEMAS: VENDOR MASTER

export const vendorFormSchema = z.object({
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
  contact_person: z.string().trim().max(150).optional().or(z.literal('')),
  contact_email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(255)
    .optional()
    .or(z.literal('')),
  contact_phone: z
    .string()
    .trim()
    .max(50)
    .regex(/^[+0-9\s\-().]+$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  address_line_1: z.string().trim().max(500).optional().or(z.literal('')),
  address_line_2: z.string().trim().max(500).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  country: z.string().trim().max(100).default('India'),
  postal_code: z.string().trim().max(20).optional().or(z.literal('')),
  gst_number: z
    .string()
    .trim()
    .max(50)
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i, 'Invalid GSTIN format (e.g. 29AABCN9988E1Z4)')
    .optional()
    .or(z.literal('')),
  serviced_categories: z.array(z.string()).optional().default([]),
  organization_id: z.string().optional().or(z.literal('')),
  sub_org_id: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
});

export type VendorFormValues = z.infer<typeof vendorFormSchema>;

// STEP 5 SCHEMAS: ITEM MASTER

export const itemFormSchema = z.object({
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
  item_type: z.string().trim().max(100).optional().or(z.literal('')),
  manufacturer: z.string().trim().max(150).optional().or(z.literal('')),
  model: z.string().trim().max(100).optional().or(z.literal('')),
  serial_number: z.string().trim().max(100).optional().or(z.literal('')),
  measurement_range: z.string().trim().max(150).optional().or(z.literal('')),
  least_count: z.string().trim().max(100).optional().or(z.literal('')),
  standard_cost: z
    .number({ invalid_type_error: 'Standard cost must be a number' })
    .nonnegative('Standard cost cannot be negative')
    .default(0),
  calibration_frequency: z
    .number({ invalid_type_error: 'Calibration frequency must be a number' })
    .int('Calibration frequency must be an integer')
    .min(1, 'Frequency must be at least 1')
    .default(12),
  calibration_frequency_unit: z.string().trim().max(20).default('Months'),
  organization_id: z.string().optional().or(z.literal('')),
  sub_org_id: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

// STEP 6 SCHEMAS: CALIBRATION REQUESTS & ITEM AVAILABILITY

export const requestItemFormSchema = z.object({
  item_id: z.string().min(1, 'Item ID is required'),
  requested_quantity: z
    .number({ invalid_type_error: 'Quantity must be a valid number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1'),
  item_available: z.enum(['YES', 'NO']),
  availability_remarks: z.string().nullable().optional().or(z.literal('')),
}).refine(
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

export type RequestItemFormValues = z.infer<typeof requestItemFormSchema>;

export const calibrationRequestFormSchema = z.object({
  client_id: z.string().min(1, 'Please select a client'),
  collection_date: z.string().min(1, 'Collection date is required'),
  priority: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
  remarks: z.string().trim().max(1000).nullable().optional().or(z.literal('')),
  items: z.array(requestItemFormSchema).min(1, 'Please select at least one item to request calibration'),
  override_availability: z.boolean().optional().default(false),
});

export type CalibrationRequestFormValues = z.infer<typeof calibrationRequestFormSchema>;
