import { Env, ApiResponse, UserContext } from './types';
import { authenticateRequest, authorizePermission } from './middleware/auth';
import { dbStore } from './services/supabase';
import { recordAuditLog, getAuditLogsForTenant } from './services/audit';
import { generateSignedUrl } from './services/r2';
import { processPDFJob, generateCertificateHTML } from './services/pdf';
import {
  ClientSchema,
  VendorSchema,
  ItemMasterSchema,
  CreateCalibrationRequestSchema,
  VerifyItemSchema,
  PerformCalibrationSchema,
  FaultyServiceSchema,
  VendorOutsourceSchema,
  CreateQuotationSchema,
  ApproveQuotationSchema,
  CreateInvoiceSchema,
  CaptureSignatureSchema,
  CreateDispatchSchema,
  ConfirmDeliverySchema,
} from './schemas';

// Helper response functions
function jsonResponse(data: ApiResponse, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS Preflight OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Public / Login Endpoint
    if (path === '/api/auth/login' && request.method === 'POST') {
      const body: any = await request.json();
      const userEmail = body.email || 'admin@alphametrology.com';
      const tenantId = body.tenantId || 'a0000000-0000-0000-0000-000000000001';

      return jsonResponse({
        success: true,
        data: {
          token: `demo-jwt-token-${Date.now()}`,
          user: {
            id: 'd0000000-0000-0000-0000-000000000001',
            email: userEmail,
            fullName: 'System Admin',
            tenantId,
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
          },
        },
      });
    }

    // Protected Routes Authentication Middleware Check
    const authResult = authenticateRequest(request, env);
    if (authResult instanceof Response) {
      return authResult; // Return 401 Unauthorized Response
    }
    const user: UserContext = authResult;

    // ------------------------------------------------------------------------
    // TENANT SECURITY VALIDATION: Filter db queries strictly by user.tenantId
    // ------------------------------------------------------------------------

    try {
      // GET /api/auth/me
      if (path === '/api/auth/me' && request.method === 'GET') {
        return jsonResponse({ success: true, data: user });
      }

      // CLIENT MASTER API
      if (path === '/api/clients') {
        const forbidden = authorizePermission(user, 'client.view');
        if (forbidden) return forbidden;

        if (request.method === 'GET') {
          const tenantClients = dbStore.clients.filter((c) => c.tenantId === user.tenantId);
          return jsonResponse({ success: true, data: tenantClients });
        }

        if (request.method === 'POST') {
          const forbiddenCreate = authorizePermission(user, 'client.create');
          if (forbiddenCreate) return forbiddenCreate;

          const body = await request.json();
          const parsed = ClientSchema.safeParse(body);
          if (!parsed.success) {
            return jsonResponse({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'Invalid client data', details: parsed.error.format() },
            }, 400);
          }

          const newClient = {
            id: `cli-${Date.now()}`,
            tenantId: user.tenantId,
            organizationId: user.organizationId,
            subOrgId: user.subOrgId,
            ...parsed.data,
            createdBy: user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          dbStore.clients.unshift(newClient);
          recordAuditLog(user, 'CLIENT_CREATED', 'client', newClient.id, newClient.clientCode, null, newClient);
          return jsonResponse({ success: true, data: newClient }, 201);
        }
      }

      // VENDOR MASTER API
      if (path === '/api/vendors') {
        const forbidden = authorizePermission(user, 'vendor.view');
        if (forbidden) return forbidden;

        if (request.method === 'GET') {
          const tenantVendors = dbStore.vendors.filter((v) => v.tenantId === user.tenantId);
          return jsonResponse({ success: true, data: tenantVendors });
        }

        if (request.method === 'POST') {
          const forbiddenCreate = authorizePermission(user, 'vendor.create');
          if (forbiddenCreate) return forbiddenCreate;

          const body = await request.json();
          const parsed = VendorSchema.safeParse(body);
          if (!parsed.success) {
            return jsonResponse({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'Invalid vendor data', details: parsed.error.format() },
            }, 400);
          }

          const newVendor = {
            id: `ven-${Date.now()}`,
            tenantId: user.tenantId,
            organizationId: user.organizationId,
            subOrgId: user.subOrgId,
            ...parsed.data,
            createdAt: new Date().toISOString(),
          };

          dbStore.vendors.unshift(newVendor);
          recordAuditLog(user, 'VENDOR_CREATED', 'vendor', newVendor.id, newVendor.vendorCode, null, newVendor);
          return jsonResponse({ success: true, data: newVendor }, 201);
        }
      }

      // ITEM MASTER API
      if (path === '/api/items') {
        const forbidden = authorizePermission(user, 'item.view');
        if (forbidden) return forbidden;

        if (request.method === 'GET') {
          const tenantItems = dbStore.itemMasters.filter((i) => i.tenantId === user.tenantId);
          return jsonResponse({ success: true, data: tenantItems });
        }

        if (request.method === 'POST') {
          const forbiddenCreate = authorizePermission(user, 'item.create');
          if (forbiddenCreate) return forbiddenCreate;

          const body = await request.json();
          const parsed = ItemMasterSchema.safeParse(body);
          if (!parsed.success) {
            return jsonResponse({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'Invalid item master data', details: parsed.error.format() },
            }, 400);
          }

          const newItem = {
            id: `itm-${Date.now()}`,
            tenantId: user.tenantId,
            organizationId: user.organizationId,
            subOrgId: user.subOrgId,
            ...parsed.data,
            createdAt: new Date().toISOString(),
          };

          dbStore.itemMasters.unshift(newItem);
          recordAuditLog(user, 'ITEM_CREATED', 'item_master', newItem.id, newItem.itemCode, null, newItem);
          return jsonResponse({ success: true, data: newItem }, 201);
        }
      }

      // CALIBRATION REQUESTS API
      if (path === '/api/requests') {
        const forbidden = authorizePermission(user, 'request.view');
        if (forbidden) return forbidden;

        if (request.method === 'GET') {
          const tenantRequests = dbStore.requests.filter((r) => r.tenantId === user.tenantId);
          return jsonResponse({ success: true, data: tenantRequests });
        }

        if (request.method === 'POST') {
          const forbiddenCreate = authorizePermission(user, 'request.create');
          if (forbiddenCreate) return forbiddenCreate;

          const body = await request.json();
          const parsed = CreateCalibrationRequestSchema.safeParse(body);
          if (!parsed.success) {
            return jsonResponse({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload', details: parsed.error.format() },
            }, 400);
          }

          const client = dbStore.clients.find((c) => c.id === parsed.data.clientId && c.tenantId === user.tenantId);
          if (!client) {
            return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } }, 404);
          }

          const reqId = `r-${Date.now()}`;
          const requestNumber = `REQ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

          const requestItems = parsed.data.items.map((itemInput, idx) => {
            const master = dbStore.itemMasters.find((i) => i.id === itemInput.itemId);
            const isAvailable = master?.isAvailable !== false;
            return {
              id: `i-${Date.now()}-${idx}`,
              tenantId: user.tenantId,
              organizationId: user.organizationId,
              subOrgId: user.subOrgId,
              requestId: reqId,
              itemId: itemInput.itemId,
              itemCode: master?.itemCode || 'ITM-UNKNOWN',
              itemName: master?.itemName || 'Calibration Item',
              serialNumber: master?.serialNumber || 'SN-UNK',
              quantity: itemInput.quantity,
              status: isAvailable ? ('COLLECTED' as any) : ('ON_HOLD' as any),
              priority: itemInput.priority,
              isAvailable,
              availabilityStatus: isAvailable ? ('AVAILABLE' as any) : ('UNAVAILABLE' as any),
              availabilityReason: isAvailable ? undefined : 'Item marked unavailable in Master Catalog - Exceptional Hold',
              isFaulty: false,
              isOutsourced: false,
              createdAt: new Date().toISOString(),
            };
          });

          const hasUnavailableItems = requestItems.some((i) => !i.isAvailable);

          const newRequest = {
            id: reqId,
            tenantId: user.tenantId,
            organizationId: user.organizationId,
            subOrgId: user.subOrgId,
            requestNumber,
            clientId: client.id,
            clientName: client.clientName,
            collectionAgentId: user.id,
            collectionAgentName: user.fullName,
            collectionDate: parsed.data.collectionDate,
            priority: parsed.data.priority,
            status: hasUnavailableItems ? ('ON_HOLD' as any) : ('COLLECTED' as any),
            remarks: parsed.data.remarks,
            createdAt: new Date().toISOString(),
            items: requestItems,
          };

          dbStore.requests.unshift(newRequest);
          recordAuditLog(user, 'CALIBRATION_REQUEST_CREATED', 'calibration_request', reqId, requestNumber, null, newRequest);
          return jsonResponse({ success: true, data: newRequest }, 201);
        }
      }

      // LAB QUEUE & VERIFICATION
      if (path === '/api/lab/queue' && request.method === 'GET') {
        const forbidden = authorizePermission(user, 'request.verify');
        if (forbidden) return forbidden;

        const labRequests = dbStore.requests.filter(
          (r) => r.tenantId === user.tenantId && ['COLLECTED', 'LAB_QUEUE', 'VERIFICATION'].includes(r.status)
        );
        return jsonResponse({ success: true, data: labRequests });
      }

      if (path === '/api/requests/verify' && request.method === 'POST') {
        const forbidden = authorizePermission(user, 'request.verify');
        if (forbidden) return forbidden;

        const body = await request.json();
        const parsed = VerifyItemSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid verification data', details: parsed.error.format() },
          }, 400);
        }

        const requestObj = dbStore.requests.find((r) => r.id === parsed.data.requestId && r.tenantId === user.tenantId);
        if (!requestObj) {
          return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } }, 404);
        }

        const verificationRecord = {
          id: `v-${Date.now()}`,
          tenantId: user.tenantId,
          organizationId: user.organizationId,
          subOrgId: user.subOrgId,
          ...parsed.data,
          verifierId: user.id,
          verifiedAt: new Date().toISOString(),
        };

        dbStore.verifications.push(verificationRecord);
        requestObj.status = 'VERIFICATION';

        const reqItem = requestObj.items?.find((i) => i.id === parsed.data.requestItemId);
        if (reqItem) {
          reqItem.status = parsed.data.outcome === 'VERIFIED' ? 'VERIFICATION' : 'DISCREPANCY';
        }

        recordAuditLog(user, 'ITEM_VERIFIED', 'verification', verificationRecord.id, requestObj.requestNumber, null, verificationRecord);
        return jsonResponse({ success: true, data: verificationRecord });
      }

      // CALIBRATION MODULE & DUE LIST
      if (path === '/api/calibrations') {
        if (request.method === 'GET') {
          const tenantCals = dbStore.calibrations.filter((c) => c.tenantId === user.tenantId);
          return jsonResponse({ success: true, data: tenantCals });
        }

        if (request.method === 'POST') {
          const forbidden = authorizePermission(user, 'calibration.create');
          if (forbidden) return forbidden;

          const body = await request.json();
          const parsed = PerformCalibrationSchema.safeParse(body);
          if (!parsed.success) {
            return jsonResponse({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'Invalid calibration entry', details: parsed.error.format() },
            }, 400);
          }

          const certNum = `CERT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
          const calDate = new Date(parsed.data.calibrationDate);
          const nextDueDateObj = new Date(calDate);
          nextDueDateObj.setMonth(nextDueDateObj.getMonth() + parsed.data.calibrationFrequencyMonths);
          const nextDueDate = nextDueDateObj.toISOString().split('T')[0];

          const newCalibration = {
            id: `c-${Date.now()}`,
            tenantId: user.tenantId,
            organizationId: user.organizationId,
            subOrgId: user.subOrgId,
            ...parsed.data,
            technicianId: user.id,
            certificateNumber: certNum,
            nextDueDate,
            createdAt: new Date().toISOString(),
          };

          dbStore.calibrations.push(newCalibration);

          // Update Request & Item Status
          const req = dbStore.requests.find((r) => r.id === parsed.data.requestId);
          if (req) {
            req.status = 'CALIBRATED';
            const reqItem = req.items?.find((i) => i.id === parsed.data.requestItemId);
            if (reqItem) {
              reqItem.status = parsed.data.resultStatus === 'PASS' ? 'CALIBRATED' : (parsed.data.resultStatus as any);
              if (parsed.data.resultStatus === 'FAULTY') reqItem.isFaulty = true;
              if (parsed.data.resultStatus === 'OUTSOURCE') reqItem.isOutsourced = true;
            }
          }

          recordAuditLog(user, 'CALIBRATION_PERFORMED', 'calibration', newCalibration.id, certNum, null, newCalibration);
          return jsonResponse({ success: true, data: newCalibration }, 201);
        }
      }

      if (path === '/api/due-list' && request.method === 'GET') {
        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

        const tenantCals = dbStore.calibrations.filter((c) => c.tenantId === user.tenantId);

        const overdue = tenantCals.filter((c) => c.nextDueDate < today);
        const dueSoon = tenantCals.filter((c) => c.nextDueDate >= today && c.nextDueDate <= thirtyDaysFromNow);
        const active = tenantCals.filter((c) => c.nextDueDate > thirtyDaysFromNow);

        return jsonResponse({
          success: true,
          data: {
            overdue,
            dueSoon,
            active,
            summary: {
              overdueCount: overdue.length,
              dueSoonCount: dueSoon.length,
              activeCount: active.length,
            },
          },
        });
      }

      // FAULTY ITEM & OUTSOURCE HANDLERS
      if (path === '/api/calibrations/faulty' && request.method === 'POST') {
        const body = await request.json();
        const parsed = FaultyServiceSchema.safeParse(body);
        if (!parsed.success) return jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' } }, 400);

        const req = dbStore.requests.find((r) => r.id === parsed.data.requestId);
        if (req) {
          const item = req.items?.find((i) => i.id === parsed.data.requestItemId);
          if (item) {
            item.status = 'FAULTY';
            item.isFaulty = true;
            item.serviceNotes = parsed.data.serviceNotes;
          }
        }

        recordAuditLog(user, 'FAULTY_ITEM_EXCEPTION', 'request_item', parsed.data.requestItemId, req?.requestNumber, null, parsed.data);
        return jsonResponse({ success: true, message: 'Faulty item service workflow recorded' });
      }

      if (path === '/api/calibrations/outsource' && request.method === 'POST') {
        const body = await request.json();
        const parsed = VendorOutsourceSchema.safeParse(body);
        if (!parsed.success) return jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' } }, 400);

        const req = dbStore.requests.find((r) => r.id === parsed.data.requestId);
        if (req) {
          const item = req.items?.find((i) => i.id === parsed.data.requestItemId);
          if (item) {
            item.status = 'OUTSOURCED';
            item.isOutsourced = true;
            item.outsourceVendorId = parsed.data.vendorId;
          }
        }

        recordAuditLog(user, 'OUTSOURCE_VENDOR_PO_CREATED', 'purchase_order', parsed.data.poNumber, req?.requestNumber, null, parsed.data);
        return jsonResponse({ success: true, message: 'Vendor Outsource PO Created' });
      }

      // QUOTATION & COMMERCIAL API
      if (path === '/api/quotations') {
        if (request.method === 'GET') {
          const tenantQuos = dbStore.quotations.filter((q) => q.tenantId === user.tenantId);
          return jsonResponse({ success: true, data: tenantQuos });
        }

        if (request.method === 'POST') {
          const forbidden = authorizePermission(user, 'quotation.create');
          if (forbidden) return forbidden;

          const body = await request.json();
          const parsed = CreateQuotationSchema.safeParse(body);
          if (!parsed.success) return jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid quotation payload' } }, 400);

          let subtotal = 0;
          let taxAmount = 0;

          parsed.data.items.forEach((item) => {
            const line = item.quantity * item.unitPrice;
            subtotal += line;
            taxAmount += line * (item.taxRate / 100);
          });

          const totalAmount = subtotal + taxAmount - parsed.data.discountAmount;
          const quoNum = `QUO-2026-${Math.floor(8000 + Math.random() * 1000)}`;

          const newQuotation = {
            id: `q-${Date.now()}`,
            tenantId: user.tenantId,
            organizationId: user.organizationId,
            subOrgId: user.subOrgId,
            quotationNumber: quoNum,
            ...parsed.data,
            subtotal,
            taxAmount,
            totalAmount,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };

          dbStore.quotations.unshift(newQuotation);
          recordAuditLog(user, 'QUOTATION_CREATED', 'quotation', newQuotation.id, quoNum, null, newQuotation);
          return jsonResponse({ success: true, data: newQuotation }, 201);
        }
      }

      if (path.startsWith('/api/quotations/') && path.endsWith('/approve') && request.method === 'POST') {
        const forbidden = authorizePermission(user, 'quotation.approve');
        if (forbidden) return forbidden;

        const body = await request.json();
        const parsed = ApproveQuotationSchema.safeParse(body);
        if (!parsed.success) return jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid approval data' } }, 400);

        const quo = dbStore.quotations.find((q) => q.id === parsed.data.quotationId && q.tenantId === user.tenantId);
        if (!quo) return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Quotation not found' } }, 404);

        quo.status = parsed.data.status;
        recordAuditLog(user, `QUOTATION_${parsed.data.status}`, 'quotation', quo.id, quo.quotationNumber, null, parsed.data);
        return jsonResponse({ success: true, data: quo });
      }

      // INVOICE API
      if (path === '/api/invoices') {
        if (request.method === 'GET') {
          const tenantInvs = dbStore.invoices.filter((i) => i.tenantId === user.tenantId);
          return jsonResponse({ success: true, data: tenantInvs });
        }

        if (request.method === 'POST') {
          const forbidden = authorizePermission(user, 'invoice.create');
          if (forbidden) return forbidden;

          const body = await request.json();
          const parsed = CreateInvoiceSchema.safeParse(body);
          if (!parsed.success) return jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid invoice payload' } }, 400);

          const invNum = `INV-2026-${Math.floor(7000 + Math.random() * 1000)}`;
          const newInvoice = {
            id: `inv-${Date.now()}`,
            tenantId: user.tenantId,
            organizationId: user.organizationId,
            subOrgId: user.subOrgId,
            invoiceNumber: invNum,
            ...parsed.data,
            invoiceDate: new Date().toISOString().split('T')[0],
            subtotal: 900.00,
            taxAmount: 162.00,
            totalAmount: 1012.00,
            paymentStatus: 'UNPAID',
            createdAt: new Date().toISOString(),
          };

          dbStore.invoices.unshift(newInvoice);

          const req = dbStore.requests.find((r) => r.id === parsed.data.requestId);
          if (req) {
            req.status = 'INVOICE_PO';
          }

          recordAuditLog(user, 'INVOICE_GENERATED', 'invoice', newInvoice.id, invNum, null, newInvoice);
          return jsonResponse({ success: true, data: newInvoice }, 201);
        }
      }

      // DIGITAL SIGNATURE API
      if (path === '/api/signatures' && request.method === 'POST') {
        const forbidden = authorizePermission(user, 'signature.capture');
        if (forbidden) return forbidden;

        const body = await request.json();
        const parsed = CaptureSignatureSchema.safeParse(body);
        if (!parsed.success) return jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid signature payload' } }, 400);

        const sigRecord = {
          id: `sig-${Date.now()}`,
          tenantId: user.tenantId,
          organizationId: user.organizationId,
          subOrgId: user.subOrgId,
          ...parsed.data,
          ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
          signedAt: new Date().toISOString(),
        };

        dbStore.signatures.push(sigRecord);

        const req = dbStore.requests.find((r) => r.id === parsed.data.requestId);
        if (req) {
          req.status = parsed.data.signatureType === 'INVOICE_APPROVAL' ? 'CLIENT_SIGN' : 'DELIVERY_SIGNED';
        }

        recordAuditLog(user, `SIGNATURE_CAPTURED_${parsed.data.signatureType}`, 'signature', sigRecord.id, req?.requestNumber, null, sigRecord);
        return jsonResponse({ success: true, data: sigRecord }, 201);
      }

      // DISPATCH & DELIVERY API
      if (path === '/api/dispatches') {
        if (request.method === 'GET') {
          return jsonResponse({ success: true, data: dbStore.dispatches.filter((d) => d.tenantId === user.tenantId) });
        }

        if (request.method === 'POST') {
          const forbidden = authorizePermission(user, 'dispatch.create');
          if (forbidden) return forbidden;

          const body = await request.json();
          const parsed = CreateDispatchSchema.safeParse(body);
          if (!parsed.success) return jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid dispatch data' } }, 400);

          const dispatchNum = `DSP-2026-${Math.floor(5000 + Math.random() * 1000)}`;
          const newDispatch = {
            id: `dsp-${Date.now()}`,
            tenantId: user.tenantId,
            organizationId: user.organizationId,
            subOrgId: user.subOrgId,
            dispatchNumber: dispatchNum,
            ...parsed.data,
            status: 'DISPATCHED',
            createdAt: new Date().toISOString(),
          };

          dbStore.dispatches.unshift(newDispatch);

          const req = dbStore.requests.find((r) => r.id === parsed.data.requestId);
          if (req) req.status = 'DISPATCHED';

          recordAuditLog(user, 'DISPATCH_CREATED', 'dispatch', newDispatch.id, dispatchNum, null, newDispatch);
          return jsonResponse({ success: true, data: newDispatch }, 201);
        }
      }

      if (path === '/api/deliveries/confirm' && request.method === 'POST') {
        const forbidden = authorizePermission(user, 'delivery.confirm');
        if (forbidden) return forbidden;

        const body = await request.json();
        const parsed = ConfirmDeliverySchema.safeParse(body);
        if (!parsed.success) return jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid delivery data' } }, 400);

        const deliveryRecord = {
          id: `del-${Date.now()}`,
          tenantId: user.tenantId,
          organizationId: user.organizationId,
          subOrgId: user.subOrgId,
          ...parsed.data,
          deliveryStatus: 'DELIVERED',
          completedAt: new Date().toISOString(),
        };

        dbStore.deliveries.push(deliveryRecord);

        const req = dbStore.requests.find((r) => r.id === parsed.data.requestId);
        if (req) {
          const allItemsComplete = req.items?.every((item) =>
            ['COMPLETED', 'DELIVERY_SIGNED', 'CALIBRATED'].includes(item.status) || item.isFaulty || item.isOutsourced
          );
          req.status = allItemsComplete ? 'COMPLETED' : 'PARTIALLY_COMPLETED';
        }

        recordAuditLog(user, 'DELIVERY_CONFIRMED_COMPLETED', 'delivery', deliveryRecord.id, req?.requestNumber, null, deliveryRecord);
        return jsonResponse({ success: true, data: deliveryRecord });
      }

      // DOCUMENTS & SIGNED URLS API
      if (path === '/api/documents') {
        if (request.method === 'GET') {
          return jsonResponse({ success: true, data: dbStore.documents.filter((d) => d.tenantId === user.tenantId) });
        }
        if (request.method === 'POST') {
          const body: any = await request.json();
          const docId = `doc-${Date.now()}`;
          const newDoc = {
            id: docId,
            tenantId: user.tenantId,
            organizationId: user.organizationId,
            subOrgId: user.subOrgId,
            requestId: body.requestId,
            documentType: body.documentType || 'General Proof',
            fileName: body.fileName || 'proof.pdf',
            storageReference: `r2://documents/${user.tenantId}/${docId}_${body.fileName}`,
            mandatory: body.mandatory || false,
            uploadedBy: user.id,
            uploadedAt: new Date().toISOString(),
          };
          dbStore.documents.unshift(newDoc);
          recordAuditLog(user, 'DOCUMENT_UPLOADED', 'document', docId, body.requestId, null, newDoc);
          return jsonResponse({ success: true, data: newDoc }, 201);
        }
      }

      if (path.includes('/signed-url') && request.method === 'GET') {
        const storageRef = url.searchParams.get('ref') || 'r2://documents/sample.pdf';
        const signedUrl = await generateSignedUrl(env, storageRef);
        return jsonResponse({ success: true, data: { signedUrl, expiresAt: new Date(Date.now() + 3600000).toISOString() } });
      }

      // AUDIT TRAIL LOGS API
      if (path === '/api/audit-logs' && request.method === 'GET') {
        const forbidden = authorizePermission(user, 'audit.view');
        if (forbidden) return forbidden;

        const tenantLogs = getAuditLogsForTenant(user.tenantId);
        return jsonResponse({ success: true, data: tenantLogs });
      }

      // PUPPETEER PDF GENERATION WORKFLOW API
      if (path === '/api/pdf/generate' && request.method === 'POST') {
        const body: any = await request.json();
        const html = generateCertificateHTML({
          certificateNumber: body.certificateNumber || 'CERT-2026-DEMO',
          clientName: body.clientName || 'Apex Manufacturing Corp',
          itemName: body.itemName || 'Digital Vernier Caliper',
          serialNumber: body.serialNumber || 'SN-MIT-99120',
          calibrationDate: new Date().toISOString().split('T')[0],
          nextDueDate: '2027-09-12',
          technicianName: user.fullName,
          results: {},
        });

        const r2Ref = await processPDFJob(env, {
          documentType: body.documentType || 'CERTIFICATE',
          entityId: body.entityId || 'c-0001',
          htmlContent: html,
          fileName: `${body.certificateNumber || 'CERT-DEMO'}.pdf`,
        });

        const signedUrl = await generateSignedUrl(env, r2Ref);
        return jsonResponse({ success: true, data: { storageReference: r2Ref, signedUrl } });
      }

      return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'API Route not found' } }, 404);
    } catch (err: any) {
      return jsonResponse({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message || 'Internal Server Error' },
      }, 500);
    }
  },
};
