import { z } from 'zod';

export const CreateRoleSchema = z.object({
  name: z.string().trim().min(2, 'Role name must be at least 2 characters').max(100),
  code: z
    .string()
    .trim()
    .min(2, 'Role code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only alphanumeric characters, dashes, or underscores'),
  description: z.string().trim().max(500).optional().nullable(),
  permission_ids: z.array(z.string().uuid('Invalid Permission ID')).optional().default([]),
});

export const UpdateRoleSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

export const AssignRolePermissionsSchema = z.object({
  permission_ids: z.array(z.string().uuid('Invalid Permission ID')),
});
