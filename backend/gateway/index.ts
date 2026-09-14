import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WorkerEnv, AuthenticatedUser, UserRole } from '../shared/types';
import { tenantWorker } from '../domain-workers/tenant-worker';
import { authWorker } from '../domain-workers/auth-worker';
import { userWorker } from '../domain-workers/user-worker';
import { roleWorker } from '../domain-workers/role-worker';
import { clientWorker } from '../domain-workers/client-worker';
import { vendorWorker } from '../domain-workers/vendor-worker';
import { itemWorker } from '../domain-workers/item-worker';
import { requestWorker } from '../domain-workers/request-worker';
import { labWorker } from '../domain-workers/lab-worker';
import { verificationWorker } from '../domain-workers/verification-worker';
import { calibrationWorker } from '../domain-workers/calibration-worker';
import { serviceWorker } from '../domain-workers/service-worker';
import { outsourceWorker } from '../domain-workers/outsource-worker';
import { quotationWorker } from '../domain-workers/quotation-worker';
import { invoiceWorker } from '../domain-workers/invoice-worker';
import { signatureWorker } from '../domain-workers/signature-worker';
import { dispatchWorker } from '../domain-workers/dispatch-worker';
import { analyticsWorker } from '../domain-workers/analytics-worker';
import { StorageService } from '../shared/storage';

const app = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthenticatedUser } }>();

// 1. CORS & Request Correlation Middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-client-role', 'x-request-id'],
  exposeHeaders: ['Content-Length', 'x-request-id'],
  maxAge: 86400,
}));

// Request Correlation ID & Structured Logging Middleware
app.use('*', async (c, next) => {
  const reqId = c.req.header('x-request-id') || `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  c.header('x-request-id', reqId);
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const user = c.get('user');
  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId: reqId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: duration,
    tenantId: user?.tenantId || 'unauthenticated',
    userId: user?.userId || 'anonymous',
  }));
});

// 2. Health & Gateway Diagnostics
app.get('/', (c) => {
  return c.json({
    service: 'Calibration Commercial Module (CCM) API Gateway',
    version: '8.0.0',
    step: 'Step 8: Item Verification + Proof + Mandatory Documents',
    status: 'online',
    architecture: 'Cloudflare Workers (Edge) + Supabase Multi-Tenant RLS + RBAC',
    endpoints: {
      auth: {
        login: 'POST /api/v1/auth/login',
        logout: 'POST /api/v1/auth/logout',
        session: 'GET /api/v1/auth/session',
      },
      labVerification: {
        queue: 'GET /api/v1/lab/verification',
        workspace: 'GET /api/v1/lab/verification/:requestId',
        submit: 'POST /api/v1/verifications',
        get: 'GET /api/v1/verifications/:id',
        complete: 'POST /api/v1/lab/verification/:requestId/complete',
        uploadUrl: 'POST /api/v1/documents/upload-url',
        confirmDoc: 'POST /api/v1/documents',
        listDocs: 'GET /api/v1/documents',
        downloadUrl: 'GET /api/v1/documents/:id/download-url',
      },
      labQueue: {
        queue: 'GET /api/v1/lab/queue',
        details: 'GET /api/v1/lab/queue/:requestId',
        accept: 'POST /api/v1/lab/queue/:requestId/accept',
        assign: 'POST /api/v1/lab/queue/:requestId/assign',
        reassign: 'POST /api/v1/lab/queue/:requestId/reassign',
        startVerification: 'POST /api/v1/lab/queue/:requestId/start-verification',
        hold: 'POST /api/v1/lab/queue/:requestId/hold',
        users: 'GET /api/v1/lab/users',
        assignments: 'GET /api/v1/lab/assignments/:requestId',
        moveToQueue: 'POST /api/v1/calibration-requests/:id/lab-queue',
      },
      calibrationRequests: {
        list: 'GET /api/v1/calibration-requests',
        create: 'POST /api/v1/calibration-requests',
        get: 'GET /api/v1/calibration-requests/:id',
        update: 'PATCH /api/v1/calibration-requests/:id',
        status: 'PATCH /api/v1/calibration-requests/:id/status',
        items: 'GET /api/v1/calibration-requests/:id/items',
      },
      items: {
        list: 'GET /api/v1/items',
        create: 'POST /api/v1/items',
        get: 'GET /api/v1/items/:id',
        update: 'PUT /api/v1/items/:id',
        status: 'PATCH /api/v1/items/:id/status',
        delete: 'DELETE /api/v1/items/:id',
      },
      clients: {
        list: 'GET /api/v1/clients',
        create: 'POST /api/v1/clients',
        get: 'GET /api/v1/clients/:id',
        update: 'PUT /api/v1/clients/:id',
        status: 'PATCH /api/v1/clients/:id/status',
        delete: 'DELETE /api/v1/clients/:id',
      },
      vendors: {
        list: 'GET /api/v1/vendors',
        create: 'POST /api/v1/vendors',
        get: 'GET /api/v1/vendors/:id',
        update: 'PUT /api/v1/vendors/:id',
        status: 'PATCH /api/v1/vendors/:id/status',
        delete: 'DELETE /api/v1/vendors/:id',
      },
      users: {
        list: 'GET /api/v1/users',
        create: 'POST /api/v1/users',
        get: 'GET /api/v1/users/:id',
        update: 'PUT /api/v1/users/:id',
        status: 'PATCH /api/v1/users/:id/status',
        roles: 'GET/POST /api/v1/users/:id/roles',
      },
      roles: {
        list: 'GET /api/v1/roles',
        create: 'POST /api/v1/roles',
        update: 'PUT /api/v1/roles/:id',
        permissions: 'GET/POST /api/v1/roles/:id/permissions',
      },
      permissions: {
        list: 'GET /api/v1/permissions',
      },
      tenancy: {
        tenants: '/api/v1/tenants',
        organizations: '/api/v1/organizations',
        subOrganizations: '/api/v1/sub-organizations',
        auditLogs: '/api/v1/audit-logs',
      },
      storage: '/api/v1/storage/signed-url',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Helper for default role permissions
function getDefaultPermissions(role: UserRole): string[] {
  if (role === 'super_admin') {
    return ['*'];
  }
  if (role === 'tenant_admin') {
    return [
      'tenant.view',
      'organization.view', 'organization.create', 'organization.edit', 'organization.delete',
      'suborganization.view', 'suborganization.create', 'suborganization.edit', 'suborganization.delete',
      'user.view', 'user.create', 'user.edit', 'user.status', 'user.delete',
      'role.view', 'role.create', 'role.edit', 'role.delete',
      'permission.view', 'permission.assign',
      'client.view', 'client.create', 'client.edit', 'client.delete', 'client.activate', 'client.deactivate',
      'vendor.view', 'vendor.create', 'vendor.edit', 'vendor.delete', 'vendor.activate', 'vendor.deactivate',
      'item.view', 'item.create', 'item.edit', 'item.delete', 'item.activate', 'item.deactivate',
      'request.view', 'request.create', 'request.edit', 'request.cancel', 'request.submit', 'request.override_availability',
      'collection.view', 'collection.create', 'collection.edit',
      'lab.queue.view', 'lab.queue.accept', 'lab.queue.assign', 'lab.queue.reassign', 'lab.queue.hold',
      'lab.request.view', 'lab.request.start_verification', 'lab.request.override_assignment',
      'verification.view', 'verification.create', 'verification.edit', 'verification.complete', 'verification.override',
      'calibration.view', 'calibration.create', 'calibration.edit', 'calibration.complete', 'calibration.override', 'calibration.due_list.view',
      'certificate.view', 'certificate.generate', 'certificate.regenerate',
      'service.view', 'service.create', 'service.edit', 'service.request_approval', 'service.approve', 'service.start', 'service.complete', 'service.return_to_calibration', 'service.cancel',
      'document.view', 'document.upload', 'document.delete', 'document.version',
      'audit.view',
    ];
  }
  if (role === 'collection_agent') {
    return [
      'tenant.view', 'organization.view', 'suborganization.view',
      'client.view',
      'item.view',
      'request.view', 'request.create', 'request.edit', 'request.submit',
      'collection.view', 'collection.create', 'collection.edit',
      'document.view', 'document.upload',
    ];
  }
  if (role === 'lab_user') {
    return [
      'tenant.view', 'organization.view', 'suborganization.view',
      'client.view',
      'item.view',
      'request.view',
      'collection.view',
      'lab.queue.view', 'lab.queue.accept', 'lab.queue.hold',
      'lab.request.view', 'lab.request.start_verification',
      'verification.view', 'verification.create', 'verification.edit', 'verification.complete',
      'calibration.view', 'calibration.create', 'calibration.edit', 'calibration.complete', 'calibration.due_list.view',
      'certificate.view', 'certificate.generate',
      'service.view', 'service.create', 'service.edit', 'service.approve', 'service.start', 'service.complete', 'service.return_to_calibration',
      'document.view', 'document.upload', 'document.version',
    ];
  }
  if (role === 'org_admin' || role === 'manager') {
    return [
      'organization.view', 'organization.edit',
      'suborganization.view', 'suborganization.create', 'suborganization.edit',
      'user.view', 'user.create', 'user.edit', 'user.status',
      'role.view', 'permission.view',
      'client.view', 'client.create', 'client.edit', 'client.activate', 'client.deactivate',
      'vendor.view', 'vendor.create', 'vendor.edit', 'vendor.activate', 'vendor.deactivate',
      'item.view', 'item.create', 'item.edit', 'item.activate', 'item.deactivate',
      'request.view', 'request.create', 'request.edit', 'request.cancel', 'request.submit', 'request.override_availability',
      'collection.view', 'collection.create', 'collection.edit',
      'lab.queue.view', 'lab.queue.accept', 'lab.queue.assign', 'lab.queue.reassign', 'lab.queue.hold',
      'lab.request.view', 'lab.request.start_verification', 'lab.request.override_assignment',
      'verification.view', 'verification.create', 'verification.complete', 'verification.override',
      'document.view', 'document.upload', 'document.version',
      'audit.view',
    ];
  }
  if (role === 'commercial_user') {
    return [
      'tenant.view', 'organization.view', 'suborganization.view',
      'user.view', 'role.view', 'permission.view',
      'client.view', 'client.create', 'client.edit',
      'vendor.view', 'vendor.create', 'vendor.edit',
      'item.view', 'item.create', 'item.edit',
      'request.view', 'request.create', 'request.edit', 'request.cancel', 'request.submit',
      'collection.view', 'collection.create', 'collection.edit',
    ];
  }
  return [
    'tenant.view', 'organization.view', 'suborganization.view',
    'user.view', 'role.view', 'permission.view',
    'client.view',
    'vendor.view',
    'item.view',
    'request.view',
    'collection.view',
  ];
}

// 3. Authentication & Multi-Tenant Context Middleware
app.use('/api/v1/*', async (c, next) => {
  // Public exempt routes
  if (c.req.path === '/api/v1/health' || c.req.path === '/api/v1/auth/login') {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  const tenantIdHeader = c.req.header('x-tenant-id');
  const clientRoleHeader = c.req.header('x-client-role') as UserRole | undefined;

  let resolvedUser: AuthenticatedUser;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      if (token.includes('.')) {
        const parts = token.split('.');
        const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadJson);

        const userRole = (payload.role as UserRole) || clientRoleHeader || 'tenant_admin';

        resolvedUser = {
          userId: payload.sub || payload.id || 'usr-default',
          email: payload.email || 'user@ccm.internal',
          role: userRole,
          tenantId: tenantIdHeader || payload.tenant_id || '11111111-1111-4111-a111-111111111111',
          organizationId: payload.organization_id || null,
          permissions: payload.permissions || getDefaultPermissions(userRole),
        };
      } else {
        const userRole = clientRoleHeader || 'super_admin';
        resolvedUser = {
          userId: 'usr-dev-session',
          email: 'dev@ccm.internal',
          role: userRole,
          tenantId: tenantIdHeader || '11111111-1111-4111-a111-111111111111',
          permissions: getDefaultPermissions(userRole),
        };
      }
    } catch {
      const userRole = clientRoleHeader || 'super_admin';
      resolvedUser = {
        userId: 'usr-dev-session',
        email: 'dev@ccm.internal',
        role: userRole,
        tenantId: tenantIdHeader || '11111111-1111-4111-a111-111111111111',
        permissions: getDefaultPermissions(userRole),
      };
    }
  } else {
    const userRole = clientRoleHeader || 'super_admin';
    resolvedUser = {
      userId: 'usr-dev-demo',
      email: 'demo@ccm.internal',
      role: userRole,
      tenantId: tenantIdHeader || '11111111-1111-4111-a111-111111111111',
      permissions: getDefaultPermissions(userRole),
    };
  }

  c.set('user', resolvedUser);
  await next();
});

// 4. Mount Domain Workers under /api/v1
app.route('/api/v1', authWorker);
app.route('/api/v1', userWorker);
app.route('/api/v1', roleWorker);
app.route('/api/v1', tenantWorker);
app.route('/api/v1', clientWorker);
app.route('/api/v1', vendorWorker);
app.route('/api/v1', itemWorker);
app.route('/api/v1', requestWorker);
app.route('/api', requestWorker);
app.route('/api/v1', labWorker);
app.route('/api', labWorker);
app.route('/api/v1', verificationWorker);
app.route('/api', verificationWorker);
app.route('/api/v1', calibrationWorker);
app.route('/api', calibrationWorker);
app.route('/api/v1', serviceWorker);
app.route('/api', serviceWorker);
app.route('/api/v1', outsourceWorker);
app.route('/api', outsourceWorker);
app.route('/api/v1', quotationWorker);
app.route('/api', quotationWorker);
app.route('/api/v1', invoiceWorker);
app.route('/api', invoiceWorker);
app.route('/api/v1/invoice-signatures', signatureWorker);
app.route('/api/v1', signatureWorker);
app.route('/api', signatureWorker);
app.route('/api/v1/dispatches', dispatchWorker);
app.route('/api/v1', dispatchWorker);
app.route('/api', dispatchWorker);
app.route('/api/v1', analyticsWorker);
app.route('/api', analyticsWorker);

// 5. Cloudflare R2 Private / Signed URL API
app.post('/api/v1/storage/signed-url', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { fileName, category = 'certificates' } = body;

  if (!fileName) {
    return c.json({ success: false, error: 'fileName is required' }, 400);
  }

  const storage = new StorageService(c.env.CCM_STORAGE);
  const objectKey = storage.getIsolatedKey(user.tenantId, category, fileName);

  return c.json({
    success: true,
    data: {
      objectKey,
      uploadUrl: `https://storage.ccm.internal/upload/${objectKey}`,
      signedDownloadUrl: `https://storage.ccm.internal/download/${objectKey}?expires=3600`,
      tenantId: user.tenantId,
      category,
    },
  });
});

// 6. Global 404 & Error Handling
app.notFound((c) => {
  return c.json({ success: false, error: `Route not found: ${c.req.method} ${c.req.path}` }, 404);
});

app.onError((err, c) => {
  console.error('[API GATEWAY UNHANDLED ERROR]', err);
  return c.json({
    success: false,
    error: err.message || 'Internal Server Error',
  }, 500);
});

export default app;
