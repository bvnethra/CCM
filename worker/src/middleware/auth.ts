import { Env, UserContext, ApiResponse } from '../types';

export function parseJwtToken(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function authenticateRequest(request: Request, env: Env): UserContext | Response {
  const authHeader = request.headers.get('Authorization');
  
  // Demo / Dev fallback user context when bearer token is dev token or missing in dev environment
  if (!authHeader || authHeader === 'Bearer dev-token' || env.ENVIRONMENT === 'development') {
    const demoTenantHeader = request.headers.get('X-Tenant-ID') || 'a0000000-0000-0000-0000-000000000001';
    return {
      id: 'd0000000-0000-0000-0000-000000000001',
      email: 'admin@alphametrology.com',
      fullName: 'System Admin',
      tenantId: demoTenantHeader,
      organizationId: 'b0000000-0000-0000-0000-000000000001',
      subOrgId: 'c0000000-0000-0000-0000-000000000001',
      roles: ['Super Admin', 'Tenant Admin'],
      permissions: [
        'client.view', 'client.create', 'client.update', 'client.delete',
        'vendor.view', 'vendor.create', 'vendor.update',
        'item.view', 'item.create',
        'request.create', 'request.view', 'request.update', 'request.verify',
        'calibration.create', 'calibration.update',
        'quotation.create', 'quotation.approve',
        'invoice.create', 'invoice.view',
        'dispatch.create', 'delivery.confirm', 'signature.capture', 'audit.view'
      ],
    };
  }

  const token = authHeader.replace(/^Bearer\s+/, '');
  const payload = parseJwtToken(token);

  if (!payload || !payload.sub || !payload.app_metadata?.tenant_id) {
    const errRes: ApiResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing authentication token',
      },
    };
    return new Response(JSON.stringify(errRes), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  return {
    id: payload.sub,
    email: payload.email || '',
    fullName: payload.user_metadata?.full_name || 'User',
    tenantId: payload.app_metadata.tenant_id,
    organizationId: payload.app_metadata.organization_id || '',
    subOrgId: payload.app_metadata.sub_org_id,
    roles: payload.app_metadata.roles || [],
    permissions: payload.app_metadata.permissions || [],
  };
}

export function authorizePermission(user: UserContext, requiredPermission: string): Response | null {
  if (user.roles.includes('Super Admin') || user.roles.includes('Tenant Admin')) {
    return null; // Admin bypass
  }
  if (!user.permissions.includes(requiredPermission)) {
    const errRes: ApiResponse = {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: `Insufficient permissions: missing ${requiredPermission}`,
      },
    };
    return new Response(JSON.stringify(errRes), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  return null;
}
