import { Hono } from 'hono';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  CreateInvoiceSchema,
  MarkReadySchema,
  CancelInvoiceSchema,
} from './schemas';

export const invoiceWorker = new Hono<{
  Bindings: WorkerEnv;
  Variables: { user: AuthenticatedUser };
}>();

const getTenantId = (c: any): string => {
  const user = c.get('user') as AuthenticatedUser;
  return c.req.header('x-tenant-id') || user?.tenant_id || 'tenant-acme-corp';
};

// 1. GET /api/v1/invoices - List invoices with filters
invoiceWorker.get('/', async (c) => {
  const tenantId = getTenantId(c);
  const status = c.req.query('status');
  const invoiceType = c.req.query('invoice_type');
  const search = c.req.query('search');

  return c.json({
    success: true,
    data: [],
    meta: { tenant_id: tenantId, status, invoice_type: invoiceType, search },
  });
});

// 2. GET /api/v1/invoices/eligible-items/:quotationId - Get eligible items for invoice creation
invoiceWorker.get('/eligible-items/:quotationId', async (c) => {
  const tenantId = getTenantId(c);
  const quotationId = c.req.param('quotationId');

  return c.json({
    success: true,
    data: {
      quotation_id: quotationId,
      tenant_id: tenantId,
      eligible_items: [],
      remaining_items: [],
    },
  });
});

// 3. GET /api/v1/invoices/:id - Get invoice details
invoiceWorker.get('/:id', async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param('id');

  return c.json({
    success: true,
    data: { id, tenant_id: tenantId },
  });
});

// 4. POST /api/v1/invoices - Create invoice (Standard / Partial / Urgent)
invoiceWorker.post('/', async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const parsed = CreateInvoiceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  if (parsed.data.invoice_type === 'URGENT' && (!parsed.data.urgent_reason || !parsed.data.urgent_reason.trim())) {
    return c.json({ success: false, error: 'Mandatory urgent reason is required for URGENT invoice creation' }, 422);
  }

  return c.json({
    success: true,
    message: `Invoice created successfully as DRAFT (${parsed.data.invoice_type})`,
    data: { tenant_id: tenantId, ...parsed.data },
  });
});

// 5. POST /api/v1/invoices/:id/ready - Mark invoice READY
invoiceWorker.post('/:id/ready', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = MarkReadySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  return c.json({
    success: true,
    message: 'Invoice marked as READY',
    data: { id, status: 'READY' },
  });
});

// 6. POST /api/v1/invoices/:id/cancel - Cancel invoice
invoiceWorker.post('/:id/cancel', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = CancelInvoiceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  return c.json({
    success: true,
    message: 'Invoice cancelled',
    data: { id, status: 'CANCELLED', cancellation_reason: parsed.data.cancellation_reason },
  });
});

export default invoiceWorker;
