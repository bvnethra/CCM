import { Hono } from 'hono';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  createOutsourceRequestSchema,
  selectVendorSchema,
  createVendorPOSchema,
  sendToVendorSchema,
  vendorReceiveSchema,
  recordVendorCalibrationSchema,
  recordVendorReturnSchema,
  receiveItemBackSchema,
  cancelOutsourceSchema,
} from './schemas';

export const outsourceWorker = new Hono<{
  Bindings: WorkerEnv;
  Variables: { user: AuthenticatedUser };
}>();

const getTenantId = (c: any): string => {
  const user = c.get('user') as AuthenticatedUser;
  return c.req.header('x-tenant-id') || user?.tenantId || user?.tenant_id || '11111111-1111-4111-a111-111111111111';
};

// 1. GET /vendor-outsourcing - List outsourcing requests
outsourceWorker.get('/vendor-outsourcing', async (c) => {
  const tenantId = getTenantId(c);
  const status = c.req.query('status');
  const vendorId = c.req.query('vendor_id');

  return c.json({
    message: 'Vendor outsourcing requests fetched successfully',
    filters: { tenantId, status, vendorId },
  });
});

// 2. GET /vendor-outsourcing/:id
outsourceWorker.get('/vendor-outsourcing/:id', async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param('id');
  return c.json({
    message: 'Outsourcing request details fetched',
    id,
    tenant_id: tenantId,
  });
});

// 3. POST /vendor-outsourcing - Create outsource request
outsourceWorker.post('/vendor-outsourcing', async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const validated = createOutsourceRequestSchema.parse(body);

  return c.json(
    {
      message: 'Vendor outsource request created successfully',
      outsource_request: {
        id: `out-${Date.now()}`,
        tenant_id: tenantId,
        ...validated,
        outsource_status: 'OUTSOURCE_REQUIRED',
        created_at: new Date().toISOString(),
      },
    },
    201
  );
});

// 4. POST /vendor-purchase-orders - Create Vendor PO
outsourceWorker.post('/vendor-purchase-orders', async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const validated = createVendorPOSchema.parse(body);

  const subtotal = validated.items.reduce((acc, item) => acc + item.quantity * item.unit_cost, 0);
  const taxAmount = (subtotal * (validated.tax_rate || 18)) / 100;
  const totalAmount = subtotal + taxAmount;

  const currentYear = new Date().getFullYear();
  const poNumber = `VPO-${currentYear}-${Math.floor(100000 + Math.random() * 900000)}`;

  return c.json(
    {
      message: 'Vendor Purchase Order created successfully',
      purchase_order: {
        id: `po-${Date.now()}`,
        tenant_id: tenantId,
        po_number: poNumber,
        vendor_id: validated.vendor_id,
        request_id: validated.request_id || null,
        outsource_request_id: validated.outsource_request_id || null,
        status: 'DRAFT',
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        items: validated.items.map((it, idx) => ({
          id: `poi-${Date.now()}-${idx}`,
          ...it,
          line_total: it.quantity * it.unit_cost,
        })),
        created_at: new Date().toISOString(),
      },
    },
    201
  );
});

// 5. POST /vendor-purchase-orders/:id/issue - Issue PO
outsourceWorker.post('/vendor-purchase-orders/:id/issue', async (c) => {
  const id = c.req.param('id');
  return c.json({
    message: 'Vendor Purchase Order issued successfully',
    po_id: id,
    status: 'ISSUED',
    issued_at: new Date().toISOString(),
  });
});

export default outsourceWorker;
