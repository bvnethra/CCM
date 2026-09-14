import { Context, Next } from 'hono';
import { AuthenticatedUser, UserRole } from '../shared/types';

/**
 * RBAC Permission Middleware for Cloudflare Workers
 * Enforces strict server-side authorization checks.
 */
export function requirePermission(permissionCode: string) {
  return async (c: Context<{ Variables: { user: AuthenticatedUser } }>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ success: false, error: 'Unauthorized: Authentication session required' }, 401);
    }

    // Super Admin has universal access
    if (user.role === 'super_admin') {
      return next();
    }

    // Check if permission exists in user's granted permissions
    if (!user.permissions || !user.permissions.includes(permissionCode)) {
      return c.json(
        {
          success: false,
          error: `Forbidden: Missing required permission [${permissionCode}]`,
          requiredPermission: permissionCode,
        },
        403
      );
    }

    await next();
  };
}

/**
 * Role-Based Access Control Middleware
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (c: Context<{ Variables: { user: AuthenticatedUser } }>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ success: false, error: 'Unauthorized: Authentication required' }, 401);
    }

    if (user.role === 'super_admin' || allowedRoles.includes(user.role)) {
      return next();
    }

    return c.json(
      {
        success: false,
        error: `Forbidden: Role [${user.role}] is not authorized for this operation`,
      },
      403
    );
  };
}

/**
 * Validates cross-tenant isolation
 */
export function validateTenantAccess(user: AuthenticatedUser, targetTenantId: string): boolean {
  if (user.role === 'super_admin') return true;
  return user.tenantId === targetTenantId;
}
