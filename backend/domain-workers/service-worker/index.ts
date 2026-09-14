import { Hono } from 'hono';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedUser, WorkerEnv } from '../../shared/types';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';
import {
  CreateServiceRequestSchema,
  UpdateServiceRequestSchema,
  RecordApprovalSchema,
  CompleteServiceSchema,
} from './schemas';

export const serviceWorker = new Hono<{
  Bindings: WorkerEnv;
  Variables: { user: AuthenticatedUser };
}>();

function getSupabase(c: any): SupabaseClient {
  const env = c.env as WorkerEnv;
  const url = env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || 'placeholder-key';
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ============================================================================
// 1. GET SERVICE REQUESTS DIRECTORY + METRICS
// ============================================================================
serviceWorker.get('/service-requests', requirePermission('service.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const status = c.req.query('status') || 'ALL';
  const clientId = c.req.query('clientId') || 'ALL';
  const search = (c.req.query('search') || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)));

  let query = supabase
    .from('service_requests')
    .select(`
      *,
      client:clients(id, client_code, client_name),
      calibration:calibrations(id, result, calibration_date, calibration_method),
      request:calibration_requests(id, request_number, priority),
      request_item:request_items(
        id, item_id,
        item:item_masters(id, item_code, item_name, serial_number, manufacturer, model)
      ),
      created_by_user:users(id, full_name, email)
    `)
    .eq('tenant_id', tenantId);

  if (status !== 'ALL') {
    query = query.eq('service_status', status);
  }
  if (clientId !== 'ALL') {
    query = query.eq('client_id', clientId);
  }

  const { data: rawList, error } = await query;
  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  let list = rawList || [];

  // Metrics
  let serviceRequiredCount = 0;
  let awaitingApprovalCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let inServiceCount = 0;
  let serviceCompletedCount = 0;

  for (const s of list) {
    if (s.service_status === 'SERVICE_REQUIRED') serviceRequiredCount++;
    if (s.service_status === 'AWAITING_CLIENT_APPROVAL') awaitingApprovalCount++;
    if (s.service_status === 'APPROVED') approvedCount++;
    if (s.service_status === 'REJECTED') rejectedCount++;
    if (s.service_status === 'IN_SERVICE') inServiceCount++;
    if (s.service_status === 'SERVICE_COMPLETED') serviceCompletedCount++;
  }

  if (search) {
    list = list.filter(
      (s: any) =>
        (s.request?.request_number || '').toLowerCase().includes(search) ||
        (s.client?.client_name || '').toLowerCase().includes(search) ||
        (s.request_item?.item?.item_code || '').toLowerCase().includes(search) ||
        (s.request_item?.item?.item_name || '').toLowerCase().includes(search) ||
        (s.request_item?.item?.serial_number || '').toLowerCase().includes(search)
    );
  }

  const total = list.length;
  const paginated = list.slice((page - 1) * pageSize, page * pageSize);

  return c.json({
    success: true,
    data: {
      items: paginated,
      metrics: {
        total,
        service_required: serviceRequiredCount,
        awaiting_approval: awaitingApprovalCount,
        approved: approvedCount,
        rejected: rejectedCount,
        in_service: inServiceCount,
        service_completed: serviceCompletedCount,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    },
  });
});

// ============================================================================
// 2. CREATE SERVICE REQUEST (FOR FAULTY / FAILED CALIBRATION ITEM)
// ============================================================================
serviceWorker.post('/service-requests', requirePermission('service.create'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const body = await c.req.json();
  const parsed = CreateServiceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400
    );
  }

  const { request_id, request_item_id, calibration_id, fault_description, estimated_service_cost, service_remarks } = parsed.data;

  // 1. Verify calibration exists and belongs to tenant
  const { data: cal, error: calErr } = await supabase
    .from('calibrations')
    .select('*, request:calibration_requests(client_id)')
    .eq('id', calibration_id)
    .eq('tenant_id', tenantId)
    .single();

  if (calErr || !cal) {
    return c.json({ success: false, error: 'Calibration record not found or access denied' }, 404);
  }

  // 2. Eligibility Gate: Calibration result must indicate FAIL or NOT_CALIBRATABLE
  if (cal.result === 'PASS') {
    return c.json(
      {
        success: false,
        error: 'Cannot create a service request for an item that successfully PASSED calibration.',
      },
      400
    );
  }

  // 3. Ensure no active service request already exists for this calibration
  const { data: existingService } = await supabase
    .from('service_requests')
    .select('id, service_status')
    .eq('calibration_id', calibration_id)
    .eq('tenant_id', tenantId)
    .not('service_status', 'eq', 'CANCELLED')
    .single();

  if (existingService) {
    return c.json(
      {
        success: false,
        error: `Active service request already exists for this item (Status: ${existingService.service_status}).`,
        data: existingService,
      },
      409
    );
  }

  const timestamp = new Date().toISOString();
  const clientId = cal.request?.client_id || cal.client_id;

  // 4. Create Service Request
  const { data: serviceReq, error: insertErr } = await supabase
    .from('service_requests')
    .insert({
      tenant_id: tenantId,
      request_id,
      request_item_id,
      calibration_id,
      client_id: clientId,
      service_status: 'SERVICE_REQUIRED',
      fault_description,
      service_required: true,
      estimated_service_cost: estimated_service_cost ?? null,
      service_remarks: service_remarks || null,
      created_by: user.userId,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select(`
      *,
      client:clients(id, client_code, client_name),
      calibration:calibrations(id, result, calibration_date),
      created_by_user:users(id, full_name, email)
    `)
    .single();

  if (insertErr) {
    return c.json({ success: false, error: insertErr.message }, 500);
  }

  // 5. Create initial approval record (PENDING)
  await supabase.from('service_approvals').insert({
    tenant_id: tenantId,
    service_request_id: serviceReq.id,
    approval_status: 'PENDING',
    created_at: timestamp,
    updated_at: timestamp,
  });

  // 6. Record Status History
  await supabase.from('request_status_history').insert({
    tenant_id: tenantId,
    request_id,
    previous_status: 'CALIBRATION',
    new_status: 'ON_HOLD',
    changed_by: user.userId,
    changed_at: timestamp,
    remarks: `Service required for faulty item. Fault: ${fault_description.substring(0, 50)}...`,
  });

  // 7. Audit Log
  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'CREATE_SERVICE_REQUEST',
    resourceType: 'service_requests',
    resourceId: serviceReq.id,
    newValues: { request_id, request_item_id, calibration_id, fault_description, estimated_service_cost },
  });

  return c.json({
    success: true,
    data: serviceReq,
    message: 'Service request created successfully.',
  });
});

// ============================================================================
// 3. GET SINGLE SERVICE REQUEST DETAILS WORKSPACE
// ============================================================================
serviceWorker.get('/service-requests/:id', requirePermission('service.view'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  // Fetch service request
  const { data: serviceReq, error } = await supabase
    .from('service_requests')
    .select(`
      *,
      client:clients(*),
      calibration:calibrations(*, calibrated_by_user:users(id, full_name, email)),
      request:calibration_requests(*),
      request_item:request_items(*, item:item_masters(*)),
      created_by_user:users(id, full_name, email),
      started_by_user:users(id, full_name, email),
      completed_by_user:users(id, full_name, email)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !serviceReq) {
    return c.json({ success: false, error: 'Service request not found or access denied' }, 404);
  }

  // Fetch measurements from failed calibration
  const { data: measurements } = await supabase
    .from('calibration_measurements')
    .select('*')
    .eq('calibration_id', serviceReq.calibration_id)
    .eq('tenant_id', tenantId);

  // Fetch approval history
  const { data: approvals } = await supabase
    .from('service_approvals')
    .select('*')
    .eq('service_request_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  // Fetch service documents
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('request_id', serviceReq.request_id)
    .eq('tenant_id', tenantId);

  return c.json({
    success: true,
    data: {
      service_request: serviceReq,
      measurements: measurements || [],
      approvals: approvals || [],
      documents: docs || [],
    },
  });
});

// ============================================================================
// 4. RECORD CLIENT APPROVAL (APPROVED OR REJECTED)
// ============================================================================
serviceWorker.post('/service-requests/:id/approval', requirePermission('service.approve'), async (c) => {
  const id = c.req.param('id') || '';
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const body = await c.req.json();
  const parsed = RecordApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: 'Validation failed for client approval',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400
    );
  }

  const { data: serviceReq, error: fetchErr } = await supabase
    .from('service_requests')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !serviceReq) {
    return c.json({ success: false, error: 'Service request not found' }, 404);
  }

  if (serviceReq.service_status !== 'SERVICE_REQUIRED' && serviceReq.service_status !== 'AWAITING_CLIENT_APPROVAL') {
    return c.json(
      {
        success: false,
        error: `Cannot record approval for service request with status '${serviceReq.service_status}'`,
      },
      400
    );
  }

  const timestamp = new Date().toISOString();
  const newStatus = parsed.data.approval_status; // APPROVED or REJECTED

  // Update Service Request status
  const { data: updatedReq, error: updateErr } = await supabase
    .from('service_requests')
    .update({
      service_status: newStatus,
      updated_at: timestamp,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  // Create approval history entry
  const { data: approvalRecord } = await supabase
    .from('service_approvals')
    .insert({
      tenant_id: tenantId,
      service_request_id: id,
      approval_status: newStatus,
      approved_by_client_name: parsed.data.approved_by_client_name || null,
      approved_by_client_role: parsed.data.approved_by_client_role || null,
      approval_remarks: parsed.data.approval_remarks || null,
      approval_reference: parsed.data.approval_reference || null,
      approved_at: newStatus === 'APPROVED' ? timestamp : null,
      rejected_at: newStatus === 'REJECTED' ? timestamp : null,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select('*')
    .single();

  // Audit event
  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: newStatus === 'APPROVED' ? 'APPROVE_SERVICE_REQUEST' : 'REJECT_SERVICE_REQUEST',
    resourceType: 'service_requests',
    resourceId: id,
    newValues: {
      approval_status: newStatus,
      approved_by_client_name: parsed.data.approved_by_client_name,
      approval_remarks: parsed.data.approval_remarks,
    },
  });

  return c.json({
    success: true,
    data: {
      service_request: updatedReq,
      approval: approvalRecord,
    },
    message: `Service request recorded as ${newStatus}.`,
  });
});

// ============================================================================
// 5. START SERVICE OPERATION
// ============================================================================
serviceWorker.post('/service-requests/:id/start', requirePermission('service.start'), async (c) => {
  const id = c.req.param('id') || '';
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const { data: serviceReq, error: fetchErr } = await supabase
    .from('service_requests')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !serviceReq) {
    return c.json({ success: false, error: 'Service request not found' }, 404);
  }

  if (serviceReq.service_status !== 'APPROVED') {
    return c.json(
      {
        success: false,
        error: `Service can only be started when status is APPROVED (Current: '${serviceReq.service_status}').`,
      },
      400
    );
  }

  const timestamp = new Date().toISOString();

  const { data: updatedReq, error: updateErr } = await supabase
    .from('service_requests')
    .update({
      service_status: 'IN_SERVICE',
      started_by: user.userId,
      started_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'START_SERVICE_OPERATION',
    resourceType: 'service_requests',
    resourceId: id,
    newValues: { status: 'IN_SERVICE', started_at: timestamp },
  });

  return c.json({
    success: true,
    data: updatedReq,
    message: 'Service operation started (IN_SERVICE).',
  });
});

// ============================================================================
// 6. COMPLETE SERVICE OPERATION
// ============================================================================
serviceWorker.post('/service-requests/:id/complete', requirePermission('service.complete'), async (c) => {
  const id = c.req.param('id') || '';
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const body = await c.req.json().catch(() => ({}));
  const parsed = CompleteServiceSchema.safeParse(body);

  const { data: serviceReq, error: fetchErr } = await supabase
    .from('service_requests')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !serviceReq) {
    return c.json({ success: false, error: 'Service request not found' }, 404);
  }

  if (serviceReq.service_status !== 'IN_SERVICE') {
    return c.json(
      {
        success: false,
        error: `Service can only be completed when status is IN_SERVICE (Current: '${serviceReq.service_status}').`,
      },
      400
    );
  }

  const timestamp = new Date().toISOString();
  const remarks = parsed.success && parsed.data.service_remarks ? parsed.data.service_remarks : serviceReq.service_remarks;

  const { data: updatedReq, error: updateErr } = await supabase
    .from('service_requests')
    .update({
      service_status: 'SERVICE_COMPLETED',
      completed_by: user.userId,
      completed_at: timestamp,
      service_remarks: remarks,
      updated_at: timestamp,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'COMPLETE_SERVICE_OPERATION',
    resourceType: 'service_requests',
    resourceId: id,
    newValues: { status: 'SERVICE_COMPLETED', completed_at: timestamp, remarks },
  });

  return c.json({
    success: true,
    data: updatedReq,
    message: 'Service operation completed successfully.',
  });
});

// ============================================================================
// 7. RETURN ITEM TO CALIBRATION (ELIGIBLE FOR RE-CALIBRATION)
// ============================================================================
serviceWorker.post('/service-requests/:id/return-to-calibration', requirePermission('service.return_to_calibration'), async (c) => {
  const id = c.req.param('id') || '';
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const { data: serviceReq, error: fetchErr } = await supabase
    .from('service_requests')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !serviceReq) {
    return c.json({ success: false, error: 'Service request not found' }, 404);
  }

  if (serviceReq.service_status !== 'SERVICE_COMPLETED') {
    return c.json(
      {
        success: false,
        error: `Only completed services can be returned for re-calibration (Current status: '${serviceReq.service_status}').`,
      },
      400
    );
  }

  const timestamp = new Date().toISOString();

  // Delete previous calibration to allow clean re-calibration start in Step 9
  await supabase
    .from('calibrations')
    .delete()
    .eq('id', serviceReq.calibration_id)
    .eq('tenant_id', tenantId);

  // Record status transition
  await supabase.from('request_status_history').insert({
    tenant_id: tenantId,
    request_id: serviceReq.request_id,
    previous_status: 'ON_HOLD',
    new_status: 'VERIFIED',
    changed_by: user.userId,
    changed_at: timestamp,
    remarks: 'Service completed. Item returned for re-calibration cycle.',
  });

  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'RETURN_TO_CALIBRATION',
    resourceType: 'service_requests',
    resourceId: id,
    newValues: { request_item_id: serviceReq.request_item_id, returned_at: timestamp },
  });

  return c.json({
    success: true,
    message: 'Item returned to calibration queue. Ready for new calibration cycle.',
  });
});

// ============================================================================
// 10. STEP 20: RECORD / EDIT SERVICE COMMERCIAL CHARGES
// ============================================================================
serviceWorker.post('/service-requests/:id/commercial-charge', requirePermission('service.charge.create'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const id = c.req.param('id') || '';
  const body = await c.req.json();

  const unitCost = parseFloat(body.service_unit_cost) || 0;
  const quantity = parseInt(body.service_quantity) || 1;
  const taxRate = parseFloat(body.service_tax_rate) !== undefined ? parseFloat(body.service_tax_rate) : 18.00;
  const discountAmount = parseFloat(body.service_discount_amount) || 0;

  // Server-side calculation (source of truth)
  const subtotal = unitCost * quantity;
  const netSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = (netSubtotal * taxRate) / 100;
  const totalAmount = netSubtotal + taxAmount;

  const supabase = getSupabase(c);

  const { data: serviceReq, error: fetchErr } = await supabase
    .from('service_requests')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !serviceReq) {
    return c.json({ success: false, error: 'Service request not found or access denied' }, 404);
  }

  const { data: updated, error: updateErr } = await supabase
    .from('service_requests')
    .update({
      service_unit_cost: unitCost,
      service_quantity: quantity,
      service_tax_rate: taxRate,
      service_tax_amount: taxAmount,
      service_discount_amount: discountAmount,
      service_total_amount: totalAmount,
      approved_service_cost: totalAmount, // Default approved cost matches estimated total
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'SERVICE_CHARGE_CREATED',
    resourceType: 'service_requests',
    resourceId: id,
    newValues: { service_unit_cost: unitCost, quantity, taxAmount, totalAmount },
  });

  return c.json({
    success: true,
    data: updated,
    message: 'Service commercial charges successfully recorded and calculated server-side.',
  });
});

