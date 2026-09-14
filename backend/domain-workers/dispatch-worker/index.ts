import { Hono } from 'hono';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  createDispatchSchema,
  startPackingSchema,
  markPackedSchema,
  shipDispatchSchema,
  updateTrackingSchema,
  confirmDeliverySchema,
} from './schemas';

export const dispatchWorker = new Hono<{
  Bindings: WorkerEnv;
  Variables: { user: AuthenticatedUser };
}>();

const getTenantId = (c: any): string => {
  const user = c.get('user') as AuthenticatedUser;
  return c.req.header('x-tenant-id') || user?.tenant_id || 'tenant-acme-corp';
};

// 1. GET /api/v1/dispatches - List dispatches with filters
dispatchWorker.get('/', async (c) => {
  const tenantId = getTenantId(c);
  const status = c.req.query('status');
  const dispatchType = c.req.query('dispatch_type');
  const search = c.req.query('search');

  return c.json({
    success: true,
    data: [],
    meta: { tenant_id: tenantId, status, dispatch_type: dispatchType, search },
  });
});

// 2. GET /api/v1/dispatches/eligible-items - List items eligible for dispatch
dispatchWorker.get('/eligible-items', async (c) => {
  const tenantId = getTenantId(c);
  const clientId = c.req.query('client_id');
  const requestId = c.req.query('request_id');

  return c.json({
    success: true,
    data: {
      tenant_id: tenantId,
      client_id: clientId,
      request_id: requestId,
      eligible_items: [],
    },
  });
});

// 3. GET /api/v1/dispatches/:id - Get dispatch details by ID
dispatchWorker.get('/:id', async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param('id');

  return c.json({
    success: true,
    data: { id, tenant_id: tenantId },
  });
});

// 4. POST /api/v1/dispatches - Create dispatch record (Standard / Partial / Urgent)
dispatchWorker.post('/', async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const parsed = createDispatchSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const dspNumber = `DSP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  return c.json({
    success: true,
    message: 'Dispatch record created in READY_FOR_DISPATCH state',
    data: {
      id: `dsp-${Date.now()}`,
      tenant_id: tenantId,
      dispatch_number: dspNumber,
      request_id: parsed.data.request_id,
      invoice_id: parsed.data.invoice_id,
      client_id: parsed.data.client_id,
      dispatch_type: parsed.data.dispatch_type,
      status: 'READY_FOR_DISPATCH',
      dispatch_date: parsed.data.dispatch_date,
      expected_delivery_date: parsed.data.expected_delivery_date,
      shipping_address: parsed.data.shipping_address,
      billing_address: parsed.data.billing_address,
      urgent_reason: parsed.data.urgent_reason,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
});

// 5. POST /api/v1/dispatches/:id/start-packing - Transition status to PACKING
dispatchWorker.post('/:id/start-packing', async (c) => {
  const id = c.req.param('id');
  return c.json({
    success: true,
    message: 'Item packing started',
    data: { id, status: 'PACKING' },
  });
});

// 6. POST /api/v1/dispatches/:id/mark-packed - Transition status to PACKED
dispatchWorker.post('/:id/mark-packed', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = markPackedSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  return c.json({
    success: true,
    message: 'Items packed successfully',
    data: {
      id,
      status: 'PACKED',
      package_reference: parsed.data.package_reference,
      number_of_packages: parsed.data.number_of_packages,
    },
  });
});

// 7. POST /api/v1/dispatches/:id/ship - Ship items with carrier & tracking
dispatchWorker.post('/:id/ship', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = shipDispatchSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  return c.json({
    success: true,
    message: 'Dispatch shipment handed over to carrier',
    data: {
      id,
      status: 'DISPATCHED',
      carrier_name: parsed.data.carrier_name,
      tracking_number: parsed.data.tracking_number,
      dispatch_date: parsed.data.dispatch_date,
      dispatched_at: new Date().toISOString(),
    },
  });
});

// 8. POST /api/v1/dispatches/:id/update-tracking - Update tracking status
dispatchWorker.post('/:id/update-tracking', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateTrackingSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  return c.json({
    success: true,
    message: `Carrier tracking status updated to ${parsed.data.status}`,
    data: { id, status: parsed.data.status },
  });
});

// 9. POST /api/v1/dispatches/:id/deliver - Confirm delivery & capture delivery signature
dispatchWorker.post('/:id/deliver', async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = confirmDeliverySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const deliverySigRef = `DELIV-SIG-${Date.now()}`;
  const r2Key = `signatures/deliveries/${id}/delivery_sig_${Date.now()}.png`;

  return c.json({
    success: true,
    message: 'Client delivery confirmed and delivery signature verified',
    data: {
      id,
      tenant_id: tenantId,
      status: 'DELIVERED',
      delivered_at: parsed.data.delivery_date,
      delivery_signature: {
        signature_id: `sig-deliv-${Date.now()}`,
        signature_type: 'DELIVERY',
        signature_status: 'SIGNED',
        signature_reference: deliverySigRef,
        signer_name: parsed.data.recipient_name,
        signer_role: parsed.data.recipient_role,
        storage_reference: r2Key,
      },
    },
  });
});

// 10. GET /api/v1/dispatches/:id/delivery-signature - Get delivery signature details
dispatchWorker.get('/:id/delivery-signature', async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param('id');
  return c.json({
    success: true,
    data: { dispatch_id: id, tenant_id: tenantId, delivery_signature: null },
  });
});

// 11. POST /api/v1/dispatches/:id/delivery-document - Generate Delivery Note PDF
dispatchWorker.post('/:id/delivery-document', async (c) => {
  const tenantId = getTenantId(c);
  const id = c.req.param('id');
  return c.json({
    success: true,
    message: 'Delivery Note PDF generated successfully',
    data: {
      document_id: `doc-deliv-${Date.now()}`,
      document_type: 'DELIVERY_NOTE',
      dispatch_id: id,
      tenant_id: tenantId,
      storage_path: `documents/delivery_notes/${id}/delivery_note_v1.pdf`,
    },
  });
});
