import { z } from 'zod';

export const TenantStatusEnum = z.enum(['active', 'inactive', 'suspended']);
export const UserRoleEnum = z.enum(['super_admin', 'tenant_admin', 'org_admin', 'operator', 'viewer']);

// Tenant Validation Schemas
export const CreateTenantSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255),
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only alphanumeric characters, dashes, or underscores'),
  status: TenantStatusEnum.default('active'),
  settings: z.record(z.unknown()).optional().default({}),
});

export const UpdateTenantSchema = CreateTenantSchema.partial();

// Organization Validation Schemas
export const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(255),
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only alphanumeric characters, dashes, or underscores'),
  status: TenantStatusEnum.default('active'),
});

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();

// Sub-Organization Validation Schemas
export const CreateSubOrganizationSchema = z.object({
  organization_id: z.string().uuid('Valid parent Organization ID is required'),
  name: z.string().trim().min(2, 'Sub-organization name must be at least 2 characters').max(255),
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only alphanumeric characters, dashes, or underscores'),
  status: TenantStatusEnum.default('active'),
});

export const UpdateSubOrganizationSchema = CreateSubOrganizationSchema.partial().omit({ organization_id: true });
