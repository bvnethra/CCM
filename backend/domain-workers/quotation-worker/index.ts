import { Hono } from 'hono';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  CreateQuotationSchema,
  SubmitApprovalSchema,
  InternalApprovalSchema,
  ClientResponseSchema,
  CostOverrideSchema,
} from './schemas';

export const quotationWorker = new Hono<{
  Bindings: WorkerEnv;
  Variables: { user: AuthenticatedUser };
}>();

// Helper to derive tenant context
const getTenantId = (c: any): string => {
  const user = c.get('user') as AuthenticatedUser;
  return c.req.header('x-tenant-id') || user?.tenant_id || 'tenant-acme-corp';
};

// 1. GET /api/v1/quotations - List quotations with filters
quotationWorker.get('/requests', async (c) => {
  const tenantId = getTenantId(c);
  const status = c.req.query('status');
  const search = c.req.query('search');

  return c.json({
    success: true,
    data: [],
    meta: { tenant_id: tenantId, status, search },
  });
});

// 2. GET /api/v1/quotations/eligible-items/:requestId - Retrieve eligible calibrated items for request
quotationWorker.get('/eligible-items/:requestId', async (c) => {
  const tenantId = getTenantId(c);
  const requestId = c.req.param('requestId');

  return c.json({
    success: true,
    data: {
      request_id: requestId,
      tenant_id: tenantId,
      eligible_items: [],
    },
  });
});

// 3. GET /api/v1/quotations/:id - Get quotation details
quotationWorker.get('/requests/:id', async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param('id');

  return c.json({
    success: true,
    data: { id, tenant_id: tenantId },
  });
});

// 4. POST /api/v1/quotations - Create quotation
quotationWorker.post('/requests', async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const parsed = CreateQuotationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  return c.json({
    success: true,
    message: 'Quotation created successfully as DRAFT',
    data: { tenant_id: tenantId, ...parsed.data },
  });
});

// 5. POST /api/v1/quotations/:id/submit-approval - Submit for internal approval
quotationWorker.post('/requests/:id/submit-approval', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = SubmitApprovalSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  return c.json({
    success: true,
    message: 'Quotation submitted for internal approval',
    data: { id, status: 'PENDING_APPROVAL' },
  });
});

// 6. POST /api/v1/quotations/:id/approve - Internal Approval
quotationWorker.post('/requests/:id/approve', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = InternalApprovalSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  return c.json({
    success: true,
    message: 'Quotation internal approval processed',
    data: { id, status: parsed.data.action === 'APPROVE' ? 'APPROVED' : 'DRAFT' },
  });
});

// 7. POST /api/v1/quotations/:id/send - Send quotation to client
quotationWorker.post('/requests/:id/send', async (c) => {
  const id = c.req.param('id');

  return c.json({
    success: true,
    message: 'Quotation status updated to SENT_TO_CLIENT',
    data: { id, status: 'SENT_TO_CLIENT' },
  });
});

// 8. POST /api/v1/quotations/:id/client-response - Record client response
quotationWorker.post('/requests/:id/client-response', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = ClientResponseSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const status = parsed.data.response === 'APPROVED' ? 'CLIENT_APPROVED' : 'CLIENT_REJECTED';

  return c.json({
    success: true,
    message: `Client response recorded as ${status}`,
    data: { id, status },
  });
});

// 9. POST /api/v1/quotations/:id/revise - Create revision
quotationWorker.post('/requests/:id/revise', async (c) => {
  const id = c.req.param('id');

  return c.json({
    success: true,
    message: 'Quotation revision created successfully',
    data: { parent_quotation_id: id, version_number: 2, status: 'DRAFT' },
  });
});

export default quotationWorker;
