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

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tenantIdHeader = request.headers.get('x-tenant-id');
    if (!tenantIdHeader) {
      return new Response(JSON.stringify({ error: 'Bad Request: x-tenant-id header required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // 1. GET /api/v1/vendor-outsourcing - List outsourcing requests
      if (method === 'GET' && path === '/api/v1/vendor-outsourcing') {
        const status = url.searchParams.get('status');
        const vendorId = url.searchParams.get('vendor_id');

        return new Response(
          JSON.stringify({
            message: 'Vendor outsourcing requests fetched successfully',
            filters: { tenantId: tenantIdHeader, status, vendorId },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 2. GET /api/v1/vendor-outsourcing/:id
      if (method === 'GET' && path.match(/^\/api\/v1\/vendor-outsourcing\/[a-f0-9-]+$/i)) {
        const id = path.split('/')[4];
        return new Response(
          JSON.stringify({
            message: 'Outsourcing request details fetched',
            id,
            tenant_id: tenantIdHeader,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 3. POST /api/v1/vendor-outsourcing - Create outsource request
      if (method === 'POST' && path === '/api/v1/vendor-outsourcing') {
        const body = await request.json();
        const validated = createOutsourceRequestSchema.parse(body);

        return new Response(
          JSON.stringify({
            message: 'Vendor outsource request created successfully',
            outsource_request: {
              id: `out-${Date.now()}`,
              tenant_id: tenantIdHeader,
              ...validated,
              outsource_status: 'OUTSOURCE_REQUIRED',
              created_at: new Date().toISOString(),
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 4. POST /api/v1/vendor-purchase-orders - Create Vendor PO
      if (method === 'POST' && path === '/api/v1/vendor-purchase-orders') {
        const body = await request.json();
        const validated = createVendorPOSchema.parse(body);

        // Server-side financial calculations
        const subtotal = validated.items.reduce((acc, item) => acc + item.quantity * item.unit_cost, 0);
        const taxAmount = (subtotal * (validated.tax_rate || 18)) / 100;
        const totalAmount = subtotal + taxAmount;

        const currentYear = new Date().getFullYear();
        const poNumber = `VPO-${currentYear}-${Math.floor(100000 + Math.random() * 900000)}`;

        return new Response(
          JSON.stringify({
            message: 'Vendor Purchase Order created successfully',
            purchase_order: {
              id: `po-${Date.now()}`,
              tenant_id: tenantIdHeader,
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
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 5. POST /api/v1/vendor-purchase-orders/:id/issue - Issue PO
      if (method === 'POST' && path.match(/^\/api\/v1\/vendor-purchase-orders\/[a-f0-9-]+\/issue$/i)) {
        const id = path.split('/')[4];
        return new Response(
          JSON.stringify({
            message: 'Vendor Purchase Order issued successfully',
            po_id: id,
            status: 'ISSUED',
            issued_at: new Date().toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: 'Validation or server error',
          details: err.errors || err.message,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
