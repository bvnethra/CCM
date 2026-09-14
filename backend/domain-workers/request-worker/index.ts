import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { WorkerEnv, AuthenticatedUser, CalibrationRequest } from '../../shared/types';
import {
  CreateCalibrationRequestSchema,
  UpdateCalibrationRequestSchema,
  UpdateCalibrationRequestStatusSchema,
  RequestItemInputSchema,
} from './schemas';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';
import {
  validateRequestTransition,
  validateRequestItemTransition,
  logStatusHistory,
  RequestStatus,
} from '../common/statusEngine';

type AppVariables = {
  user: AuthenticatedUser;
};

export const requestWorker = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

function getSupabase(c: any) {
  const url = c.env.SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured in Worker environment.');
  }
  return createClient(url, key);
}

// ==========================================
// 1. LIST CALIBRATION REQUESTS
// ==========================================
requestWorker.get('/calibration-requests', requirePermission('request.view'), async (c) => {
  const user = c.get('user');
  const search = c.req.query('search')?.toLowerCase();
  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const clientId = c.req.query('client_id');
  const agentId = c.req.query('collection_agent_id');
  const fromDate = c.req.query('from_date');
  const toDate = c.req.query('to_date');

  const targetTenantId =
    user.role === 'super_admin' && c.req.query('tenant_id')
      ? c.req.query('tenant_id')!
      : user.tenantId;

  const supabase = getSupabase(c);

  let query = supabase
    .from('calibration_requests')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      request_number,
      client_id,
      collection_agent_id,
      collection_date,
      priority,
      status,
      remarks,
      created_by,
      created_at,
      updated_at,
      client:clients(id, client_code, client_name, contact_person, contact_email, contact_phone),
      collection_agent:users(id, full_name, email, role),
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code),
      items:request_items(
        id,
        item_id,
        requested_quantity,
        item_available,
        availability_remarks,
        availability_checked_by,
        availability_checked_at
      )
    `)
    .eq('tenant_id', targetTenantId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (priority && priority !== 'all') {
    query = query.eq('priority', priority);
  }
  if (clientId && clientId !== 'all') {
    query = query.eq('client_id', clientId);
  }
  if (agentId && agentId !== 'all') {
    query = query.eq('collection_agent_id', agentId);
  }
  if (fromDate) {
    query = query.gte('collection_date', fromDate);
  }
  if (toDate) {
    query = query.lte('collection_date', toDate);
  }

  const { data, error } = await query;
  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  let requests = (data || []).map((req: any) => {
    const items = req.items || [];
    const itemsCount = items.reduce((acc: number, item: any) => acc + (item.requested_quantity || 1), 0);
    const availableCount = items.filter((item: any) => item.item_available === 'YES').length;
    const unavailableCount = items.filter((item: any) => item.item_available === 'NO').length;

    return {
      ...req,
      items_count: itemsCount,
      available_items_count: availableCount,
      unavailable_items_count: unavailableCount,
    };
  });

  if (search) {
    requests = requests.filter(
      (r: any) =>
        r.request_number?.toLowerCase().includes(search) ||
        r.client?.client_name?.toLowerCase().includes(search) ||
        r.client?.client_code?.toLowerCase().includes(search) ||
        r.collection_agent?.full_name?.toLowerCase().includes(search) ||
        r.remarks?.toLowerCase().includes(search)
    );
  }

  return c.json({
    success: true,
    data: requests,
    total: requests.length,
  });
});

// ==========================================
// 2. CREATE CALIBRATION REQUEST (ATOMIC)
// ==========================================
requestWorker.post('/calibration-requests', requirePermission('request.create'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = CreateCalibrationRequestSchema.safeParse(body);

  if (!parsed.success) {
    const errorMsg = parsed.error.errors.map((e) => e.message).join('; ');
    return c.json({
      success: false,
      error: errorMsg || 'Validation failed',
      details: parsed.error.format(),
    }, 400);
  }

  const payload = parsed.data;
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  // 1. Verify Client belongs to Tenant
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, client_name, client_code, organization_id, sub_org_id, status')
    .eq('id', payload.client_id)
    .eq('tenant_id', tenantId)
    .single();

  if (clientErr || !client) {
    return c.json({ success: false, error: 'Selected client does not exist or does not belong to your tenant.' }, 404);
  }

  if (client.status === 'inactive') {
    return c.json({ success: false, error: 'Cannot create calibration request for an inactive client.' }, 400);
  }

  // 2. Verify all Items belong to Tenant
  const itemIds = payload.items.map((i) => i.item_id);
  const { data: dbItems, error: itemsErr } = await supabase
    .from('item_masters')
    .select('id, item_code, item_name, status')
    .in('id', itemIds)
    .eq('tenant_id', tenantId);

  if (itemsErr || !dbItems || dbItems.length !== itemIds.length) {
    return c.json({
      success: false,
      error: 'One or more selected items do not exist in this tenant or are unauthorized.',
    }, 404);
  }

  // 3. Availability Business Rule
  const hasUnavailableItems = payload.items.some((i) => i.item_available === 'NO');
  if (hasUnavailableItems && !payload.override_availability) {
    const hasOverridePerm = user.permissions.includes('request.override_availability') || user.permissions.includes('*');
    if (!hasOverridePerm) {
      return c.json({
        success: false,
        error: 'Calibration request contains unavailable items. Missing required override permission [request.override_availability].',
      }, 403);
    }
  }

  // 4. Generate Unique Request Number
  const currentYear = new Date().getFullYear();
  let requestNumber = '';

  try {
    const { data: generatedNum } = await supabase.rpc('generate_request_number', { p_tenant_id: tenantId });
    if (generatedNum) {
      requestNumber = generatedNum;
    }
  } catch {
    // Fallback if RPC is pending in migration
  }

  if (!requestNumber) {
    const { count } = await supabase
      .from('calibration_requests')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    const seq = (count || 0) + 1;
    requestNumber = `CAL-${currentYear}-${String(seq).padStart(6, '0')}`;
  }

  // 5. Insert Calibration Request Header
  const requestHeader = {
    tenant_id: tenantId,
    organization_id: client.organization_id || user.organizationId || null,
    sub_org_id: client.sub_org_id || user.subOrganizationId || null,
    request_number: requestNumber,
    client_id: payload.client_id,
    collection_agent_id: user.userId,
    collection_date: payload.collection_date,
    priority: payload.priority,
    status: 'CREATED',
    remarks: payload.remarks || null,
    created_by: user.userId,
  };

  const { data: createdRequest, error: insertReqErr } = await supabase
    .from('calibration_requests')
    .insert(requestHeader)
    .select()
    .single();

  if (insertReqErr || !createdRequest) {
    return c.json({ success: false, error: insertReqErr?.message || 'Failed to create calibration request header' }, 500);
  }

  // 6. Insert Request Items
  const checkedAt = new Date().toISOString();
  const requestItemsToInsert = payload.items.map((item) => ({
    request_id: createdRequest.id,
    tenant_id: tenantId,
    item_id: item.item_id,
    requested_quantity: item.requested_quantity,
    item_available: item.item_available,
    availability_remarks: item.availability_remarks || null,
    availability_checked_by: user.userId,
    availability_checked_at: checkedAt,
  }));

  const { data: insertedItems, error: insertItemsErr } = await supabase
    .from('request_items')
    .insert(requestItemsToInsert)
    .select();

  if (insertItemsErr) {
    // Cleanup orphaned header if items failed
    await supabase.from('calibration_requests').delete().eq('id', createdRequest.id);
    return c.json({ success: false, error: `Failed to insert request items: ${insertItemsErr.message}` }, 500);
  }

  // 7. Audit Trail Logging
  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'CREATE_CALIBRATION_REQUEST',
    resourceType: 'calibration_requests',
    resourceId: createdRequest.id,
    newValues: {
      request_number: requestNumber,
      client_id: payload.client_id,
      priority: payload.priority,
      status: 'CREATED',
      items_count: payload.items.length,
      has_unavailable: hasUnavailableItems,
    },
  });

  return c.json({
    success: true,
    data: {
      ...createdRequest,
      items: insertedItems,
    },
  }, 201);
});

// ==========================================
// 3. GET SINGLE CALIBRATION REQUEST DETAILS
// ==========================================
requestWorker.get('/calibration-requests/:id', requirePermission('request.view'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const targetTenantId = user.tenantId;
  const supabase = getSupabase(c);

  const { data: req, error } = await supabase
    .from('calibration_requests')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      request_number,
      client_id,
      collection_agent_id,
      collection_date,
      priority,
      status,
      remarks,
      created_by,
      created_at,
      updated_at,
      client:clients(id, client_code, client_name, contact_person, contact_email, contact_phone, address_line_1, city, state, postal_code),
      collection_agent:users(id, full_name, email, role),
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code),
      items:request_items(
        id,
        item_id,
        requested_quantity,
        item_available,
        availability_remarks,
        availability_checked_by,
        availability_checked_at,
        created_at,
        item:item_masters(
          id,
          item_code,
          item_name,
          item_type,
          manufacturer,
          model,
          serial_number,
          measurement_range,
          least_count,
          standard_cost
        )
      )
    `)
    .eq('id', id)
    .eq('tenant_id', targetTenantId)
    .single();

  if (error || !req) {
    return c.json({ success: false, error: 'Calibration request not found or access denied.' }, 404);
  }

  const items = req.items || [];
  const itemsCount = items.reduce((acc: number, item: any) => acc + (item.requested_quantity || 1), 0);
  const availableCount = items.filter((item: any) => item.item_available === 'YES').length;
  const unavailableCount = items.filter((item: any) => item.item_available === 'NO').length;

  return c.json({
    success: true,
    data: {
      ...req,
      items_count: itemsCount,
      available_items_count: availableCount,
      unavailable_items_count: unavailableCount,
    },
  });
});

// ==========================================
// 4. UPDATE CALIBRATION REQUEST
// ==========================================
requestWorker.patch('/calibration-requests/:id', requirePermission('request.edit'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateCalibrationRequestSchema.safeParse(body);

  if (!parsed.success) {
    const errorMsg = parsed.error.errors.map((e) => e.message).join('; ');
    return c.json({ success: false, error: errorMsg || 'Validation failed', details: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);

  const { data: existing, error: fetchErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single();

  if (fetchErr || !existing) {
    return c.json({ success: false, error: 'Calibration request not found or access denied' }, 404);
  }

  if (existing.status === 'CANCELLED') {
    return c.json({ success: false, error: 'Cannot modify a cancelled calibration request' }, 400);
  }

  const updates: any = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.priority) updates.priority = parsed.data.priority;
  if (parsed.data.collection_date) updates.collection_date = parsed.data.collection_date;
  if (parsed.data.remarks !== undefined) updates.remarks = parsed.data.remarks;

  const { data: updated, error: updateErr } = await supabase
    .from('calibration_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'UPDATE_CALIBRATION_REQUEST',
    resourceType: 'calibration_requests',
    resourceId: id as string,
    oldValues: existing,
    newValues: updated,
  });

  return c.json({ success: true, data: updated });
});

// ==========================================
// 5. UPDATE REQUEST STATUS (TRANSITIONS)
// ==========================================
requestWorker.patch('/calibration-requests/:id/status', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateCalibrationRequestStatusSchema.safeParse(body);

  if (!parsed.success) {
    const errorMsg = parsed.error.errors.map((e) => e.message).join('; ');
    return c.json({ success: false, error: errorMsg || 'Validation failed', details: parsed.error.format() }, 400);
  }

  const targetStatus = parsed.data.status;
  const isCancelling = targetStatus === 'CANCELLED';

  // Enforce specific permission for cancellation
  if (isCancelling) {
    const hasCancelPerm = user.permissions.includes('request.cancel') || user.permissions.includes('*');
    if (!hasCancelPerm) {
      return c.json({ success: false, error: 'Missing required permission [request.cancel]' }, 403);
    }
  } else {
    const hasEditPerm = user.permissions.includes('request.edit') || user.permissions.includes('*');
    if (!hasEditPerm) {
      return c.json({ success: false, error: 'Missing required permission [request.edit]' }, 403);
    }
  }

  const supabase = getSupabase(c);

  const { data: existing, error: fetchErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single();

  if (fetchErr || !existing) {
    return c.json({ success: false, error: 'Calibration request not found or access denied' }, 404);
  }

  // Validate server-side status transition rules (Step 19)
  const isValidTransition = validateRequestTransition(existing.status as RequestStatus, targetStatus as RequestStatus);
  if (!isValidTransition) {
    return c.json({
      success: false,
      error: `INVALID_STATUS_TRANSITION: Cannot transition request from ${existing.status} to ${targetStatus}`,
      current_status: existing.status,
      target_status: targetStatus,
    }, 409);
  }

  const { data: updated, error: updateErr } = await supabase
    .from('calibration_requests')
    .update({
      status: targetStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  // Record into request_status_history via centralized statusEngine
  await logStatusHistory(supabase, {
    tenant_id: user.tenantId,
    request_id: id,
    previous_status: existing.status,
    new_status: targetStatus,
    changed_by: user.userId,
    remarks: parsed.data.remarks || null,
    source_module: 'request-worker',
  });

  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: isCancelling ? 'CANCEL_CALIBRATION_REQUEST' : 'UPDATE_CALIBRATION_REQUEST_STATUS',
    resourceType: 'calibration_requests',
    resourceId: id as string,
    oldValues: { status: existing.status },
    newValues: { status: targetStatus, remarks: parsed.data.remarks },
  });

  return c.json({ success: true, data: updated });
});

// ==========================================
// 5B. MOVE REQUEST TO LAB QUEUE
// ==========================================
requestWorker.post('/calibration-requests/:id/lab-queue', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const remarks = body?.remarks || 'Transferred to Lab Queue for technician assignment and verification';

  // Permission check
  const hasPerm =
    user.permissions.includes('request.submit') ||
    user.permissions.includes('lab.queue.assign') ||
    user.permissions.includes('*') ||
    user.role === 'collection_agent' ||
    user.role === 'lab_user' ||
    user.role === 'tenant_admin';

  if (!hasPerm) {
    return c.json({ success: false, error: 'Forbidden: Missing permission to move request to lab queue' }, 403);
  }

  const supabase = getSupabase(c);

  // 1. Fetch request
  const { data: request, error: reqErr } = await supabase
    .from('calibration_requests')
    .select(`
      *,
      items:request_items(id, item_id, requested_quantity, item_available)
    `)
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single();

  if (reqErr || !request) {
    return c.json({ success: false, error: 'Calibration request not found' }, 404);
  }

  // 2. Eligibility checks
  if (request.status === 'CANCELLED') {
    return c.json({ success: false, error: 'Cancelled request cannot be moved to Lab Queue' }, 400);
  }

  if (request.status === 'LAB_QUEUE' || request.status === 'VERIFICATION') {
    return c.json({ success: false, error: `Request is already in ${request.status} stage` }, 400);
  }

  const items = request.items || [];
  if (items.length === 0) {
    return c.json({ success: false, error: 'Request must have at least one line item before entering Lab Queue' }, 400);
  }

  const previousStatus = request.status;
  const newStatus = 'LAB_QUEUE';
  const timestamp = new Date().toISOString();

  // 3. Update status to LAB_QUEUE
  const { data: updated, error: updateErr } = await supabase
    .from('calibration_requests')
    .update({
      status: newStatus,
      updated_at: timestamp,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  // 4. Record status history
  await supabase.from('request_status_history').insert({
    tenant_id: user.tenantId,
    request_id: id,
    previous_status: previousStatus,
    new_status: newStatus,
    changed_by: user.userId,
    changed_at: timestamp,
    remarks,
  });

  // 5. Audit event
  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'MOVE_TO_LAB_QUEUE',
    resourceType: 'calibration_requests',
    resourceId: id,
    oldValues: { status: previousStatus },
    newValues: { status: newStatus, remarks },
  });

  return c.json({
    success: true,
    data: updated,
    message: `Request ${request.request_number} successfully moved to Lab Queue.`,
  });
});

// ==========================================
// 6. SUB-RESOURCE: GET REQUEST ITEMS
// ==========================================
requestWorker.get('/calibration-requests/:id/items', requirePermission('request.view'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const supabase = getSupabase(c);

  const { data, error } = await supabase
    .from('request_items')
    .select(`
      id,
      request_id,
      item_id,
      requested_quantity,
      item_available,
      availability_remarks,
      availability_checked_by,
      availability_checked_at,
      created_at,
      updated_at,
      item:item_masters(
        id,
        item_code,
        item_name,
        item_type,
        manufacturer,
        model,
        serial_number,
        measurement_range,
        least_count,
        standard_cost
      )
    `)
    .eq('request_id', id)
    .eq('tenant_id', user.tenantId);

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  return c.json({ success: true, data: data || [] });
});

// ==========================================
// 7. STEP 19: HOLD REQUEST
// ==========================================
requestWorker.post('/calibration-requests/:id/hold', requirePermission('request.hold'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id') || '';
  const body = await c.req.json().catch(() => ({}));
  const holdReason = body.hold_reason || body.reason;

  if (!holdReason) {
    return c.json({ success: false, error: 'Mandatory hold reason is required' }, 400);
  }

  const supabase = getSupabase(c);
  const { data: request, error: fetchErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single();

  if (fetchErr || !request) {
    return c.json({ success: false, error: 'Request not found or access denied' }, 404);
  }

  if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
    return c.json({ success: false, error: `Cannot place request in ${request.status} status on hold` }, 400);
  }

  const timestamp = new Date().toISOString();
  const previousStatus = request.status;

  const { data: updated, error: updateErr } = await supabase
    .from('calibration_requests')
    .update({
      status: 'ON_HOLD',
      hold_reason: holdReason,
      held_by: user.userId,
      held_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  await logStatusHistory(supabase, {
    tenant_id: user.tenantId,
    request_id: id,
    previous_status: previousStatus,
    new_status: 'ON_HOLD',
    changed_by: user.userId,
    remarks: `Request placed on hold: ${holdReason}`,
    source_module: 'request-worker',
  });

  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'REQUEST_ON_HOLD',
    resourceType: 'calibration_requests',
    resourceId: id,
    oldValues: { status: previousStatus },
    newValues: { status: 'ON_HOLD', hold_reason: holdReason },
  });

  return c.json({ success: true, data: updated, message: 'Calibration request placed on hold.' });
});

// ==========================================
// 8. STEP 19: RESUME REQUEST
// ==========================================
requestWorker.post('/calibration-requests/:id/resume', requirePermission('request.resume'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id') || '';
  const body = await c.req.json().catch(() => ({}));
  const resumeRemarks = body.remarks || 'Request resumed from hold state';

  const supabase = getSupabase(c);
  const { data: request, error: fetchErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single();

  if (fetchErr || !request) {
    return c.json({ success: false, error: 'Request not found or access denied' }, 404);
  }

  if (request.status !== 'ON_HOLD') {
    return c.json({ success: false, error: 'Only requests currently ON_HOLD can be resumed' }, 400);
  }

  const targetStatus = 'LAB_QUEUE'; // Default resumed stage
  const timestamp = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabase
    .from('calibration_requests')
    .update({
      status: targetStatus,
      hold_reason: null,
      held_by: null,
      held_at: null,
      updated_at: timestamp,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  await logStatusHistory(supabase, {
    tenant_id: user.tenantId,
    request_id: id,
    previous_status: 'ON_HOLD',
    new_status: targetStatus,
    changed_by: user.userId,
    remarks: resumeRemarks,
    source_module: 'request-worker',
  });

  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'REQUEST_RESUMED',
    resourceType: 'calibration_requests',
    resourceId: id,
    oldValues: { status: 'ON_HOLD', hold_reason: request.hold_reason },
    newValues: { status: targetStatus },
  });

  return c.json({ success: true, data: updated, message: 'Request resumed successfully.' });
});

// ==========================================
// 9. STEP 19: CANCEL REQUEST (SAFE CANCELLATION)
// ==========================================
requestWorker.post('/calibration-requests/:id/cancel', requirePermission('request.cancel'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id') || '';
  const body = await c.req.json().catch(() => ({}));
  const cancellationReason = body.cancellation_reason || body.reason;

  if (!cancellationReason) {
    return c.json({ success: false, error: 'Mandatory cancellation reason is required' }, 400);
  }

  const supabase = getSupabase(c);
  const { data: request, error: fetchErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single();

  if (fetchErr || !request) {
    return c.json({ success: false, error: 'Request not found or access denied' }, 404);
  }

  // Safe cancellation rule: Cannot cancel after irreversible stages (DISPATCHED, CLIENT_RECEIVED, DELIVERY_SIGNED, COMPLETED)
  const irreversibleStates = ['DISPATCHED', 'CLIENT_RECEIVED', 'DELIVERY_SIGNED', 'COMPLETED'];
  if (irreversibleStates.includes(request.status)) {
    return c.json({
      success: false,
      error: `Cannot cancel request in ${request.status} stage after dispatch or completion`,
    }, 400);
  }

  const timestamp = new Date().toISOString();
  const previousStatus = request.status;

  const { data: updated, error: updateErr } = await supabase
    .from('calibration_requests')
    .update({
      status: 'CANCELLED',
      cancellation_reason: cancellationReason,
      cancelled_by: user.userId,
      cancelled_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  await logStatusHistory(supabase, {
    tenant_id: user.tenantId,
    request_id: id,
    previous_status: previousStatus,
    new_status: 'CANCELLED',
    changed_by: user.userId,
    remarks: `Request cancelled: ${cancellationReason}`,
    source_module: 'request-worker',
  });

  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'REQUEST_CANCELLED',
    resourceType: 'calibration_requests',
    resourceId: id,
    oldValues: { status: previousStatus },
    newValues: { status: 'CANCELLED', cancellation_reason: cancellationReason },
  });

  return c.json({ success: true, data: updated, message: 'Request cancelled successfully.' });
});

// ==========================================
// 10. STEP 19: OFFLINE DRAFTS BATCH SYNCHRONIZATION
// ==========================================
requestWorker.post('/calibration-requests/sync-offline-drafts', requirePermission('request.create'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const drafts = body.drafts || [];

  if (!Array.isArray(drafts) || drafts.length === 0) {
    return c.json({ success: false, error: 'No offline drafts provided for synchronization' }, 400);
  }

  const supabase = getSupabase(c);
  const syncResults: any[] = [];

  for (const draft of drafts) {
    try {
      // 1. Revalidate Client ownership and accessibility
      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('id', draft.client_id)
        .eq('tenant_id', user.tenantId)
        .single();

      if (clientErr || !client) {
        syncResults.push({
          draft_id: draft.draft_id,
          sync_status: 'SYNC_FAILED',
          error: `Client validation failed or client not accessible for tenant.`,
        });
        continue;
      }

      // 2. Validate Items
      const draftItems = draft.items || [];
      if (draftItems.length === 0) {
        syncResults.push({
          draft_id: draft.draft_id,
          sync_status: 'SYNC_FAILED',
          error: `Request draft must contain at least one line item.`,
        });
        continue;
      }

      // 3. Generate Request Number
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const requestNumber = `REQ-${year}-${randomSuffix}`;
      const now = new Date().toISOString();

      // 4. Create Calibration Request in DB
      const { data: createdReq, error: createErr } = await supabase
        .from('calibration_requests')
        .insert({
          tenant_id: user.tenantId,
          organization_id: user.organizationId,
          sub_org_id: user.subOrgId || null,
          request_number: requestNumber,
          client_id: draft.client_id,
          collection_agent_id: user.userId,
          collection_date: draft.collection_date || now,
          priority: draft.priority || 'NORMAL',
          status: 'CREATED',
          remarks: draft.remarks ? `[Synced from Offline Draft]: ${draft.remarks}` : '[Synced from Offline Draft]',
          created_by: user.userId,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (createErr || !createdReq) {
        syncResults.push({
          draft_id: draft.draft_id,
          sync_status: 'SYNC_FAILED',
          error: createErr?.message || 'Failed to create request record.',
        });
        continue;
      }

      // 5. Insert Request Line Items
      const itemsToInsert = draftItems.map((item: any) => ({
        tenant_id: user.tenantId,
        request_id: createdReq.id,
        item_id: item.item_id,
        requested_quantity: item.requested_quantity || 1,
        item_available: item.item_available || 'YES',
        availability_remarks: item.availability_remarks || null,
        created_at: now,
        updated_at: now,
      }));

      await supabase.from('request_items').insert(itemsToInsert);

      // Record initial status history
      await logStatusHistory(supabase, {
        tenant_id: user.tenantId,
        request_id: createdReq.id,
        previous_status: 'LOCAL_DRAFT',
        new_status: 'CREATED',
        changed_by: user.userId,
        remarks: 'Synchronized offline collection draft to server',
        source_module: 'request-worker-offline-sync',
      });

      await logAuditEvent(supabase, {
        tenantId: user.tenantId,
        userId: user.userId,
        action: 'OFFLINE_SYNC_COMPLETED',
        resourceType: 'calibration_requests',
        resourceId: createdReq.id,
        oldValues: { draft_id: draft.draft_id },
        newValues: { request_number: requestNumber, status: 'CREATED' },
      });

      syncResults.push({
        draft_id: draft.draft_id,
        request_id: createdReq.id,
        request_number: requestNumber,
        sync_status: 'SYNCED',
      });
    } catch (err: any) {
      syncResults.push({
        draft_id: draft.draft_id,
        sync_status: 'SYNC_FAILED',
        error: err.message || 'Unexpected server error during offline draft synchronization',
      });
    }
  }

  return c.json({
    success: true,
    results: syncResults,
    synced_count: syncResults.filter((r) => r.sync_status === 'SYNCED').length,
    failed_count: syncResults.filter((r) => r.sync_status === 'SYNC_FAILED').length,
  });
});

// ============================================================================
// 11. STEP 20: GET REQUEST COMMERCIAL SUMMARY BREAKDOWN
// ============================================================================
requestWorker.get('/calibration-requests/:requestId/commercial-summary', async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId');
  const supabase = getSupabase(c);

  const canViewVendorCost =
    user.permissions.includes('vendor.cost.view') ||
    user.permissions.includes('*') ||
    user.role === 'tenant_admin' ||
    user.role === 'manager';

  // 1. Fetch Request & Items
  const { data: request, error: reqErr } = await supabase
    .from('calibration_requests')
    .select(`
      *,
      items:request_items(
        id, item_id, requested_quantity,
        item:item_masters(id, item_code, item_name, standard_cost)
      )
    `)
    .eq('id', requestId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (reqErr || !request) {
    return c.json({ success: false, error: 'Request not found' }, 404);
  }

  // 2. Fetch Quotations (Request-based or Standalone linked)
  const { data: quotations } = await supabase
    .from('quotations')
    .select(`
      *,
      items:quotation_items(*)
    `)
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId);

  // 3. Fetch Service Requests
  const { data: serviceRequests } = await supabase
    .from('service_requests')
    .select('*')
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId);

  // 4. Fetch Vendor Outsource Requests
  const { data: outsourceRequests } = await supabase
    .from('vendor_outsource_requests')
    .select('*')
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId);

  // Calculate Breakdown Server-Side
  let calibrationCharges = 0;
  let serviceCharges = 0;
  let outsourcingClientCharges = 0;
  let internalVendorCost = 0;

  // Calibration charges from quotations or item master
  if (quotations && quotations.length > 0) {
    const activeQuotation = quotations[0];
    calibrationCharges = activeQuotation.subtotal || 0;
  } else {
    (request.items || []).forEach((item: any) => {
      const cost = item.item?.standard_cost || 0;
      calibrationCharges += cost * (item.requested_quantity || 1);
    });
  }

  // Approved Service Charges
  (serviceRequests || []).forEach((srv: any) => {
    if (srv.service_status === 'APPROVED' || srv.service_status === 'SERVICE_COMPLETED') {
      serviceCharges += srv.approved_service_cost || srv.service_total_amount || 0;
    }
  });

  // Outsourcing Charges
  (outsourceRequests || []).forEach((out: any) => {
    outsourcingClientCharges += out.client_charge || 0;
    internalVendorCost += out.vendor_cost || 0;
  });

  const subtotal = calibrationCharges + serviceCharges + outsourcingClientCharges;
  const taxRate = 18.0;
  const taxAmount = (subtotal * taxRate) / 100;
  const grandTotal = subtotal + taxAmount;

  const responseData: any = {
    request_id: requestId,
    request_number: request.request_number,
    calibration_charges: calibrationCharges,
    service_charges: serviceCharges,
    outsourcing_client_charges: outsourcingClientCharges,
    other_charges: 0,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    discount_amount: 0,
    grand_total: grandTotal,
  };

  // Vendor cost protection: strictly conceal unless user has explicit vendor.cost.view permission
  if (canViewVendorCost) {
    responseData.internal_vendor_cost = internalVendorCost;
    responseData.internal_margin = subtotal - internalVendorCost;
  }

  return c.json({
    success: true,
    data: responseData,
  });
});


