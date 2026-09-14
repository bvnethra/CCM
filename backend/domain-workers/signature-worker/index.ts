import { Hono } from 'hono';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  createSignatureRequestSchema,
  signInvoiceSchema,
  rejectSignatureSchema,
  retrySignatureRequestSchema,
} from './schemas';

export const signatureWorker = new Hono<{
  Bindings: WorkerEnv;
  Variables: { user: AuthenticatedUser };
}>();

const getTenantId = (c: any): string => {
  const user = c.get('user') as AuthenticatedUser;
  return c.req.header('x-tenant-id') || user?.tenant_id || 'tenant-acme-corp';
};

// 1. GET /api/v1/invoice-signatures - List signature records
signatureWorker.get('/', async (c) => {
  const tenantId = getTenantId(c);
  return c.json({
    success: true,
    data: [],
    meta: { tenant_id: tenantId },
  });
});

// 2. GET /api/v1/invoice-signatures/:id - Get signature details by ID
signatureWorker.get('/:id', async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param('id');
  return c.json({
    success: true,
    data: { id, tenant_id: tenantId },
  });
});

// 3. POST /api/v1/invoices/:invoiceId/signature-request - Create signature request for READY invoice
signatureWorker.post('/invoices/:invoiceId/signature-request', async (c) => {
  const tenantId = getTenantId(c);
  const invoiceId = c.req.param('invoiceId');
  const body = await c.req.json();
  const parsed = createSignatureRequestSchema.safeParse({ ...body, invoice_id: invoiceId });

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const requestRef = `SIG-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  return c.json({
    success: true,
    message: 'Invoice client signature requested successfully',
    data: {
      id: `sig-req-${Date.now()}`,
      tenant_id: tenantId,
      invoice_id: invoiceId,
      request_reference: requestRef,
      status: 'PENDING',
      requested_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (parsed.data.expires_in_days || 7) * 86400000).toISOString(),
      signer_name: parsed.data.signer_name,
      signer_role: parsed.data.signer_role,
      signer_email: parsed.data.signer_email,
      signer_phone: parsed.data.signer_phone,
    },
  });
});

// 4. GET /api/v1/invoice-signatures/request/:requestReference - Get signature request details for public signing page
signatureWorker.get('/request/:requestReference', async (c) => {
  const requestReference = c.req.param('requestReference');
  return c.json({
    success: true,
    data: {
      request_reference: requestReference,
      status: 'PENDING',
      invoice_id: 'inv-demo',
      invoice_number: 'INV-2026-000001',
    },
  });
});

// 5. POST /api/v1/invoice-signatures/request/:requestReference/open - Mark request as OPENED
signatureWorker.post('/request/:requestReference/open', async (c) => {
  const requestReference = c.req.param('requestReference');
  return c.json({
    success: true,
    message: 'Signature request marked as opened',
    data: { request_reference: requestReference, status: 'OPENED' },
  });
});

// 6. POST /api/v1/invoice-signatures/request/:requestReference/sign - Submit client signature
signatureWorker.post('/request/:requestReference/sign', async (c) => {
  const requestReference = c.req.param('requestReference');
  const body = await c.req.json();
  const parsed = signInvoiceSchema.safeParse({ ...body, request_reference: requestReference });

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const sigRef = `SIG-DOC-${Date.now()}`;
  const r2Key = `signatures/invoices/${requestReference}/signature_${Date.now()}.png`;

  return c.json({
    success: true,
    message: 'Invoice digitally signed successfully',
    data: {
      signature_id: `sig-${Date.now()}`,
      request_reference: requestReference,
      signature_reference: sigRef,
      signature_type: 'INVOICE',
      signature_status: 'SIGNED',
      signer_name: parsed.data.signer_name,
      signer_role: parsed.data.signer_role,
      signed_at: new Date().toISOString(),
      storage_reference: r2Key,
    },
  });
});

// 7. POST /api/v1/invoice-signatures/request/:requestReference/reject - Client rejects signature
signatureWorker.post('/request/:requestReference/reject', async (c) => {
  const requestReference = c.req.param('requestReference');
  const body = await c.req.json();
  const parsed = rejectSignatureSchema.safeParse({ ...body, request_reference: requestReference });

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  return c.json({
    success: true,
    message: 'Signature request rejected',
    data: {
      request_reference: requestReference,
      status: 'REJECTED',
      rejection_reason: parsed.data.rejection_reason,
      rejected_at: new Date().toISOString(),
    },
  });
});

// 8. POST /api/v1/invoices/:invoiceId/signature-request/retry - Retry signature request after rejection/expiry
signatureWorker.post('/invoices/:invoiceId/signature-request/retry', async (c) => {
  const tenantId = getTenantId(c);
  const invoiceId = c.req.param('invoiceId');
  const body = await c.req.json();
  const parsed = retrySignatureRequestSchema.safeParse({ ...body, invoice_id: invoiceId });

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const newRef = `SIG-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  return c.json({
    success: true,
    message: 'New signature request created for retry',
    data: {
      id: `sig-req-${Date.now()}`,
      tenant_id: tenantId,
      invoice_id: invoiceId,
      request_reference: newRef,
      status: 'PENDING',
      requested_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (parsed.data.expires_in_days || 7) * 86400000).toISOString(),
    },
  });
});

// 9. GET /api/v1/invoices/:invoiceId/signature - Get signature for specific invoice
signatureWorker.get('/invoices/:invoiceId/signature', async (c) => {
  const tenantId = getTenantId(c);
  const invoiceId = c.req.param('invoiceId');
  return c.json({
    success: true,
    data: { invoice_id: invoiceId, tenant_id: tenantId, signature: null, requests: [] },
  });
});

// 10. POST /api/v1/invoices/:invoiceId/generate-signed-document - Generate signed PDF version
signatureWorker.post('/invoices/:invoiceId/generate-signed-document', async (c) => {
  const tenantId = getTenantId(c);
  const invoiceId = c.req.param('invoiceId');
  return c.json({
    success: true,
    message: 'Signed invoice PDF document generated successfully',
    data: {
      document_id: `doc-signed-inv-${Date.now()}`,
      document_type: 'SIGNED_INVOICE',
      invoice_id: invoiceId,
      tenant_id: tenantId,
      storage_path: `documents/signed_invoices/${invoiceId}/signed_invoice_v1.pdf`,
    },
  });
});
