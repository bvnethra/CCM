import { z } from 'zod';
import { TenantStatusEnum, UserRoleEnum } from '../tenant-worker/schemas';

export const CreateUserSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(255),
  phone: z.string().trim().max(50).optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().default('Password123!'),
  organization_id: z.string().uuid('Invalid Organization ID').optional().nullable(),
  sub_organization_id: z.string().uuid('Invalid Sub-Organization ID').optional().nullable(),
  role: UserRoleEnum.default('viewer'),
  status: TenantStatusEnum.default('active'),
  role_ids: z.array(z.string().uuid()).optional().default([]),
});

export const UpdateUserSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(255).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  organization_id: z.string().uuid('Invalid Organization ID').optional().nullable(),
  sub_organization_id: z.string().uuid('Invalid Sub-Organization ID').optional().nullable(),
  role: UserRoleEnum.optional(),
  status: TenantStatusEnum.optional(),
});

export const UpdateUserStatusSchema = z.object({
  status: TenantStatusEnum,
});

export const AssignUserRolesSchema = z.object({
  role_ids: z.array(z.string().uuid('Invalid Role ID')),
});
