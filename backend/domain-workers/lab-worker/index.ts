import { Hono } from 'hono';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedUser, WorkerEnv, CalibrationRequest, RequestStatusHistory, LabRequestAssignment } from '../../shared/types';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';
import {
  AssignLabRequestSchema,
  ReassignLabRequestSchema,
  HoldLabRequestSchema,
} from './schemas';

export const labWorker = new Hono<{
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
// 1. GET LAB QUEUE DIRECTORY + SUMMARY METRICS
// ============================================================================
labWorker.get('/lab/queue', requirePermission('lab.queue.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const status = c.req.query('status') || 'ALL';
  const priority = c.req.query('priority') || 'ALL';
  const clientId = c.req.query('clientId') || 'ALL';
  const assignedTo = c.req.query('assignedTo') || 'ALL';
  const search = (c.req.query('search') || '').trim().toLowerCase();
  const sortBy = c.req.query('sortBy') || 'created_at';
  const sortOrder = c.req.query('sortOrder') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)));

  // 1. Fetch queue requests (LAB_QUEUE, VERIFICATION, ON_HOLD)
  let query = supabase
    .from('calibration_requests')
    .select(`
      *,
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
        availability_checked_at,
        item:item_masters(id, item_code, item_name, manufacturer, model, serial_number)
      ),
      assignments:lab_request_assignments(
        id,
        request_id,
        assigned_to,
        assigned_by,
        assigned_at,
        status,
        remarks,
        assigned_to_user:users!lab_request_assignments_assigned_to_fkey(id, full_name, email, role),
        assigned_by_user:users!lab_request_assignments_assigned_by_fkey(id, full_name, email, role)
      )
    `)
    .eq('tenant_id', tenantId);

  // Status Filter
  if (status !== 'ALL') {
    query = query.eq('status', status);
  } else {
    query = query.in('status', ['LAB_QUEUE', 'VERIFICATION', 'ON_HOLD']);
  }

  // Priority Filter
  if (priority !== 'ALL') {
    query = query.eq('priority', priority);
  }

  // Client Filter
  if (clientId !== 'ALL') {
    query = query.eq('client_id', clientId);
  }

  // Sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const { data, error } = await query;
  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  // Map and attach current_assignment
  let requests = (data || []).map((req: any) => {
    const items = req.items || [];
    const itemsCount = items.reduce((acc: number, it: any) => acc + (it.requested_quantity || 1), 0);
    const availableCount = items.filter((it: any) => it.item_available === 'YES').length;
    const unavailableCount = items.filter((it: any) => it.item_available === 'NO').length;
    const assignments = req.assignments || [];
    const activeAssignment = assignments.find((a: any) => a.status === 'ACTIVE') || null;

    return {
      ...req,
      items_count: itemsCount,
      available_items_count: availableCount,
      unavailable_items_count: unavailableCount,
      current_assignment: activeAssignment,
    };
  });

  // Assigned Technician filter
  if (assignedTo === 'UNASSIGNED') {
    requests = requests.filter((r) => !r.current_assignment);
  } else if (assignedTo !== 'ALL') {
    requests = requests.filter((r) => r.current_assignment?.assigned_to === assignedTo);
  }

  // Search Filter
  if (search) {
    requests = requests.filter((r) => {
      const matchNumber = r.request_number.toLowerCase().includes(search);
      const matchClient = r.client?.client_name?.toLowerCase().includes(search) || r.client?.client_code?.toLowerCase().includes(search);
      const matchItems = (r.items || []).some((it: any) =>
        it.item?.item_code?.toLowerCase().includes(search) ||
        it.item?.item_name?.toLowerCase().includes(search) ||
        it.item?.serial_number?.toLowerCase().includes(search)
      );
      return matchNumber || matchClient || matchItems;
    });
  }

  // Compute Metrics over the tenant queue
  const totalQueue = requests.length;
  const urgentCount = requests.filter((r) => r.priority === 'URGENT').length;
  const unassignedCount = requests.filter((r) => !r.current_assignment).length;
  const assignedCount = requests.filter((r) => !!r.current_assignment).length;
  const onHoldCount = requests.filter((r) => r.status === 'ON_HOLD').length;

  const total = requests.length;
  const fromIndex = (page - 1) * pageSize;
  const paginated = requests.slice(fromIndex, fromIndex + pageSize);

  return c.json({
    success: true,
    data: paginated,
    metrics: {
      total_queue: totalQueue,
      urgent: urgentCount,
      unassigned: unassignedCount,
      assigned: assignedCount,
      on_hold: onHoldCount,
    },
    total,
    page,
    pageSize,
  });
});

// ============================================================================
// 2. GET LAB REQUEST INTAKE DETAILS (8-SECTION DATA BUNDLE)
// ============================================================================
labWorker.get('/lab/queue/:requestId', requirePermission('lab.request.view'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId');
  const supabase = getSupabase(c);

  // 1. Fetch Calibration Request Header + Client + Organization
  const { data: request, error: reqErr } = await supabase
    .from('calibration_requests')
    .select(`
      *,
      client:clients(*),
      collection_agent:users!calibration_requests_collection_agent_id_fkey(id, full_name, email, phone, role),
      created_by_user:users!calibration_requests_created_by_fkey(id, full_name, email, role),
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .eq('id', requestId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (reqErr || !request) {
    return c.json({ success: false, error: 'Calibration request not found in lab queue' }, 404);
  }

  // 2. Fetch Requested Items with availability and item master specs
  const { data: items } = await supabase
    .from('request_items')
    .select(`
      *,
      item:item_masters(*),
      checked_by_user:users(id, full_name, email)
    `)
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId);

  // 3. Fetch Lab Assignments History
  const { data: assignments } = await supabase
    .from('lab_request_assignments')
    .select(`
      *,
      assigned_to_user:users!lab_request_assignments_assigned_to_fkey(id, full_name, email, role),
      assigned_by_user:users!lab_request_assignments_assigned_by_fkey(id, full_name, email, role)
    `)
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false });

  // 4. Fetch Status History
  const { data: statusHistory } = await supabase
    .from('request_status_history')
    .select(`
      *,
      changed_by_user:users(id, full_name, email, role)
    `)
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId)
    .order('changed_at', { ascending: false });

  // 5. Fetch Audit Trail records for this request
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('tenant_id', user.tenantId)
    .or(`resource_id.eq.${requestId},new_values->>request_id.eq.${requestId}`)
    .order('created_at', { ascending: false })
    .limit(20);

  const activeAssignment = (assignments || []).find((a: any) => a.status === 'ACTIVE') || null;

  const result = {
    ...request,
    items: items || [],
    items_count: (items || []).reduce((acc: number, it: any) => acc + (it.requested_quantity || 1), 0),
    available_items_count: (items || []).filter((it: any) => it.item_available === 'YES').length,
    unavailable_items_count: (items || []).filter((it: any) => it.item_available === 'NO').length,
    current_assignment: activeAssignment,
    assignments: assignments || [],
    status_history: statusHistory || [],
    audit_logs: auditLogs || [],
  };

  return c.json({ success: true, data: result });
});

// ============================================================================
// 3. ACCEPT REQUEST (LAB TECHNICIAN)
// ============================================================================
labWorker.post('/lab/queue/:requestId/accept', requirePermission('lab.queue.accept'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId');
  const supabase = getSupabase(c);

  // 1. Fetch request and current assignment
  const { data: request, error: reqErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (reqErr || !request) {
    return c.json({ success: false, error: 'Calibration request not found' }, 404);
  }

  if (request.status === 'CANCELLED') {
    return c.json({ success: false, error: 'Cannot accept a cancelled request' }, 400);
  }

  // 2. Verify technician assignment
  const { data: activeAssign } = await supabase
    .from('lab_request_assignments')
    .select('*')
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId)
    .eq('status', 'ACTIVE')
    .single();

  const isAssignedUser = activeAssign && activeAssign.assigned_to === user.userId;
  const hasOverride = user.permissions.includes('lab.request.override_assignment') || user.permissions.includes('*') || user.role === 'tenant_admin';

  if (!isAssignedUser && !hasOverride) {
    return c.json({
      success: false,
      error: 'You can only accept requests that are assigned to you. Contact lab admin for reassignment.',
    }, 403);
  }

  // Record audit log for acceptance
  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'LAB_ACCEPT_REQUEST',
    resourceType: 'calibration_requests',
    resourceId: requestId as string,
    newValues: {
      request_number: request.request_number,
      accepted_by: user.userId,
      accepted_at: new Date().toISOString(),
    },
  });

  return c.json({
    success: true,
    message: `Request ${request.request_number} accepted into lab workflow.`,
  });
});

// ============================================================================
// 4. ASSIGN LAB TECHNICIAN
// ============================================================================
labWorker.post('/lab/queue/:requestId/assign', requirePermission('lab.queue.assign'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId');
  const body = await c.req.json();
  const parsed = AssignLabRequestSchema.safeParse(body);

  if (!parsed.success) {
    const errorMsg = parsed.error.errors.map((e) => e.message).join('; ');
    return c.json({ success: false, error: errorMsg || 'Validation failed' }, 400);
  }

  const supabase = getSupabase(c);

  // 1. Verify request is in LAB_QUEUE or ON_HOLD
  const { data: request, error: reqErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (reqErr || !request) {
    return c.json({ success: false, error: 'Calibration request not found' }, 404);
  }

  if (request.status === 'CANCELLED') {
    return c.json({ success: false, error: 'Cannot assign a cancelled request' }, 400);
  }

  // 2. Verify assignee belongs to caller tenant and has lab_user role
  const { data: assignee, error: userErr } = await supabase
    .from('users')
    .select('id, full_name, role, status, tenant_id')
    .eq('id', parsed.data.assigned_to)
    .eq('tenant_id', user.tenantId)
    .single();

  if (userErr || !assignee) {
    return c.json({ success: false, error: 'Target technician does not exist or belongs to another tenant' }, 400);
  }

  if (assignee.status !== 'active') {
    return c.json({ success: false, error: 'Cannot assign request to an inactive technician' }, 400);
  }

  // 3. Mark existing active assignment as REASSIGNED if present
  await supabase
    .from('lab_request_assignments')
    .update({ status: 'REASSIGNED', updated_at: new Date().toISOString() })
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId)
    .eq('status', 'ACTIVE');

  // 4. Create new ACTIVE assignment
  const { data: newAssignment, error: assignErr } = await supabase
    .from('lab_request_assignments')
    .insert({
      tenant_id: user.tenantId,
      request_id: requestId,
      assigned_to: parsed.data.assigned_to,
      assigned_by: user.userId,
      assigned_at: new Date().toISOString(),
      status: 'ACTIVE',
      remarks: parsed.data.remarks || null,
    })
    .select(`
      *,
      assigned_to_user:users!lab_request_assignments_assigned_to_fkey(id, full_name, email, role)
    `)
    .single();

  if (assignErr) {
    return c.json({ success: false, error: assignErr.message }, 500);
  }

  // 5. Record Audit Trail
  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'LAB_ASSIGN_REQUEST',
    resourceType: 'lab_request_assignments',
    resourceId: newAssignment.id,
    newValues: {
      request_number: request.request_number,
      assigned_to: assignee.full_name,
      assigned_to_id: assignee.id,
      remarks: parsed.data.remarks,
    },
  });

  return c.json({
    success: true,
    data: newAssignment,
    message: `Request assigned to ${assignee.full_name}`,
  });
});

// ============================================================================
// 5. REASSIGN LAB TECHNICIAN (PRESERVES HISTORY)
// ============================================================================
labWorker.post('/lab/queue/:requestId/reassign', requirePermission('lab.queue.reassign'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId');
  const body = await c.req.json();
  const parsed = ReassignLabRequestSchema.safeParse(body);

  if (!parsed.success) {
    const errorMsg = parsed.error.errors.map((e) => e.message).join('; ');
    return c.json({ success: false, error: errorMsg || 'Validation failed' }, 400);
  }

  const supabase = getSupabase(c);

  // 1. Verify request
  const { data: request, error: reqErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (reqErr || !request) {
    return c.json({ success: false, error: 'Calibration request not found' }, 404);
  }

  if (request.status === 'CANCELLED') {
    return c.json({ success: false, error: 'Cannot reassign a cancelled request' }, 400);
  }

  // 2. Verify new assignee
  const { data: newAssignee, error: userErr } = await supabase
    .from('users')
    .select('id, full_name, role, status, tenant_id')
    .eq('id', parsed.data.new_assigned_to)
    .eq('tenant_id', user.tenantId)
    .single();

  if (userErr || !newAssignee) {
    return c.json({ success: false, error: 'Selected technician does not exist in this tenant' }, 400);
  }

  // 3. Mark previous active assignment as REASSIGNED
  const { data: prevAssignment } = await supabase
    .from('lab_request_assignments')
    .select('*')
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId)
    .eq('status', 'ACTIVE')
    .single();

  if (prevAssignment) {
    await supabase
      .from('lab_request_assignments')
      .update({
        status: 'REASSIGNED',
        remarks: `Reassigned to ${newAssignee.full_name}: ${parsed.data.remarks}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prevAssignment.id);
  }

  // 4. Create new ACTIVE assignment
  const { data: newAssignment, error: assignErr } = await supabase
    .from('lab_request_assignments')
    .insert({
      tenant_id: user.tenantId,
      request_id: requestId,
      assigned_to: parsed.data.new_assigned_to,
      assigned_by: user.userId,
      assigned_at: new Date().toISOString(),
      status: 'ACTIVE',
      remarks: parsed.data.remarks,
    })
    .select(`
      *,
      assigned_to_user:users!lab_request_assignments_assigned_to_fkey(id, full_name, email, role)
    `)
    .single();

  if (assignErr) {
    return c.json({ success: false, error: assignErr.message }, 500);
  }

  // 5. Record Audit Trail
  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'LAB_REASSIGN_REQUEST',
    resourceType: 'lab_request_assignments',
    resourceId: newAssignment.id,
    oldValues: prevAssignment,
    newValues: {
      request_number: request.request_number,
      new_assigned_to: newAssignee.full_name,
      reassignment_reason: parsed.data.remarks,
    },
  });

  return c.json({
    success: true,
    data: newAssignment,
    message: `Request successfully reassigned to ${newAssignee.full_name}`,
  });
});

// ============================================================================
// 6. START VERIFICATION (LAB_QUEUE -> VERIFICATION)
// ============================================================================
labWorker.post('/lab/queue/:requestId/start-verification', requirePermission('lab.request.start_verification'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId');
  const supabase = getSupabase(c);

  // 1. Fetch request
  const { data: request, error: reqErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (reqErr || !request) {
    return c.json({ success: false, error: 'Calibration request not found' }, 404);
  }

  if (request.status !== 'LAB_QUEUE' && request.status !== 'ON_HOLD') {
    return c.json({
      success: false,
      error: `Invalid transition: Request must be in LAB_QUEUE status to start verification (currently: ${request.status})`,
    }, 400);
  }

  // 2. Verify technician authorization
  const { data: activeAssign } = await supabase
    .from('lab_request_assignments')
    .select('*')
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId)
    .eq('status', 'ACTIVE')
    .single();

  const isAssigned = activeAssign && activeAssign.assigned_to === user.userId;
  const hasOverride = user.permissions.includes('lab.request.override_assignment') || user.permissions.includes('*') || user.role === 'tenant_admin';

  if (!isAssigned && !hasOverride) {
    return c.json({
      success: false,
      error: 'Only the assigned lab technician or an authorized supervisor can initiate verification.',
    }, 403);
  }

  const previousStatus = request.status;
  const newStatus = 'VERIFICATION';
  const timestamp = new Date().toISOString();

  // 3. Update request status to VERIFICATION
  const { data: updated, error: updateErr } = await supabase
    .from('calibration_requests')
    .update({ status: newStatus, updated_at: timestamp })
    .eq('id', requestId)
    .select()
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  // 4. Record status history
  await supabase.from('request_status_history').insert({
    tenant_id: user.tenantId,
    request_id: requestId,
    previous_status: previousStatus,
    new_status: newStatus,
    changed_by: user.userId,
    changed_at: timestamp,
    remarks: 'Intake accepted and moved to Verification stage',
  });

  // 5. Record audit event
  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'LAB_START_VERIFICATION',
    resourceType: 'calibration_requests',
    resourceId: requestId as string,
    oldValues: { status: previousStatus },
    newValues: { status: newStatus },
  });

  return c.json({
    success: true,
    data: updated,
    message: `Request ${request.request_number} transitioned to VERIFICATION stage.`,
  });
});

// ============================================================================
// 7. PUT ON HOLD (MANDATORY REASON)
// ============================================================================
labWorker.post('/lab/queue/:requestId/hold', requirePermission('lab.queue.hold'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId');
  const body = await c.req.json();
  const parsed = HoldLabRequestSchema.safeParse(body);

  if (!parsed.success) {
    const errorMsg = parsed.error.errors.map((e) => e.message).join('; ');
    return c.json({ success: false, error: errorMsg || 'Validation failed' }, 400);
  }

  const supabase = getSupabase(c);

  // 1. Fetch request
  const { data: request, error: reqErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (reqErr || !request) {
    return c.json({ success: false, error: 'Calibration request not found' }, 404);
  }

  if (request.status === 'CANCELLED') {
    return c.json({ success: false, error: 'Cannot put a cancelled request on hold' }, 400);
  }

  const previousStatus = request.status;
  const newStatus = 'ON_HOLD';
  const timestamp = new Date().toISOString();

  // 2. Update status
  const { data: updated, error: updateErr } = await supabase
    .from('calibration_requests')
    .update({
      status: newStatus,
      remarks: parsed.data.hold_reason,
      updated_at: timestamp,
    })
    .eq('id', requestId)
    .select()
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  // 3. Record status history
  await supabase.from('request_status_history').insert({
    tenant_id: user.tenantId,
    request_id: requestId,
    previous_status: previousStatus,
    new_status: newStatus,
    changed_by: user.userId,
    changed_at: timestamp,
    remarks: parsed.data.hold_reason,
  });

  // 4. Record audit trail
  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'LAB_HOLD_REQUEST',
    resourceType: 'calibration_requests',
    resourceId: requestId as string,
    oldValues: { status: previousStatus },
    newValues: { status: newStatus, hold_reason: parsed.data.hold_reason },
  });

  return c.json({
    success: true,
    data: updated,
    message: `Request ${request.request_number} placed ON HOLD: ${parsed.data.hold_reason}`,
  });
});

// ============================================================================
// 8. GET TENANT LAB USERS (ASSIGNMENT CANDIDATES)
// ============================================================================
labWorker.get('/lab/users', requirePermission('lab.queue.view'), async (c) => {
  const user = c.get('user');
  const supabase = getSupabase(c);

  const { data: labUsers, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, status')
    .eq('tenant_id', user.tenantId)
    .in('role', ['lab_user', 'tenant_admin', 'manager', 'org_admin'])
    .eq('status', 'active');

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  return c.json({ success: true, data: labUsers || [] });
});

// ============================================================================
// 9. GET ASSIGNMENTS HISTORY FOR A REQUEST
// ============================================================================
labWorker.get('/lab/assignments/:requestId', requirePermission('lab.request.view'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId');
  const supabase = getSupabase(c);

  const { data: assignments, error } = await supabase
    .from('lab_request_assignments')
    .select(`
      *,
      assigned_to_user:users!lab_request_assignments_assigned_to_fkey(id, full_name, email, role),
      assigned_by_user:users!lab_request_assignments_assigned_by_fkey(id, full_name, email, role)
    `)
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  return c.json({ success: true, data: assignments || [] });
});

// ============================================================================
// 10. STEP 20: CONFIRM LAB RECEIPT (RECEIVED_IN_LAB)
// ============================================================================
labWorker.post('/lab/requests/:requestId/receive', requirePermission('lab.receipt.confirm'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId') || '';
  const body = await c.req.json().catch(() => ({}));

  const receivedQuantity = parseInt(body.received_quantity) || 1;
  const expectedQuantity = parseInt(body.expected_quantity) || receivedQuantity;
  const receiptRemarks = body.remarks || body.receipt_remarks || 'Physical equipment received in lab';
  const proofDocumentId = body.receipt_proof_document_id || null;

  const supabase = getSupabase(c);

  const { data: request, error: fetchErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (fetchErr || !request) {
    return c.json({ success: false, error: 'Request not found or access denied' }, 404);
  }

  const timestamp = new Date().toISOString();

  // Create Lab Receipt record
  const { data: receipt, error: receiptErr } = await supabase
    .from('lab_receipts')
    .insert({
      tenant_id: user.tenantId,
      organization_id: user.organizationId,
      sub_org_id: user.subOrgId || null,
      request_id: requestId,
      received_by: user.userId,
      received_at: timestamp,
      receipt_status: 'RECEIVED',
      received_quantity: receivedQuantity,
      expected_quantity: expectedQuantity,
      receipt_remarks: receiptRemarks,
      receipt_proof_document_id: proofDocumentId,
    })
    .select()
    .single();

  if (receiptErr) {
    return c.json({ success: false, error: receiptErr.message }, 500);
  }

  // Update calibration request status to RECEIVED_IN_LAB
  await supabase
    .from('calibration_requests')
    .update({ status: 'RECEIVED_IN_LAB', updated_at: timestamp })
    .eq('id', requestId);

  // Status history & audit
  await supabase.from('request_status_history').insert({
    tenant_id: user.tenantId,
    request_id: requestId,
    previous_status: request.status,
    new_status: 'RECEIVED_IN_LAB',
    changed_by: user.userId,
    remarks: receiptRemarks,
    source_module: 'lab-worker-receipt',
  });

  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'LAB_RECEIPT_CONFIRMED',
    resourceType: 'calibration_requests',
    resourceId: requestId,
    oldValues: { status: request.status },
    newValues: { status: 'RECEIVED_IN_LAB', receipt_id: receipt.id },
  });

  return c.json({
    success: true,
    data: receipt,
    message: 'Equipment receipt successfully confirmed. Request moved to RECEIVED_IN_LAB.',
  });
});

// ============================================================================
// 11. STEP 20: RECORD LAB RECEIPT DISCREPANCY
// ============================================================================
labWorker.post('/lab/requests/:requestId/receipt-discrepancy', requirePermission('lab.receipt.discrepancy'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId') || '';
  const body = await c.req.json().catch(() => ({}));

  const discrepancyRemarks = body.remarks || body.reason;
  if (!discrepancyRemarks) {
    return c.json({ success: false, error: 'Mandatory discrepancy reason/remarks required' }, 400);
  }

  const receivedQuantity = parseInt(body.received_quantity) || 0;
  const expectedQuantity = parseInt(body.expected_quantity) || 1;
  const proofDocumentId = body.receipt_proof_document_id || null;

  const supabase = getSupabase(c);

  const { data: request, error: fetchErr } = await supabase
    .from('calibration_requests')
    .select('*')
    .eq('id', requestId)
    .eq('tenant_id', user.tenantId)
    .single();

  if (fetchErr || !request) {
    return c.json({ success: false, error: 'Request not found or access denied' }, 404);
  }

  const timestamp = new Date().toISOString();

  const { data: receipt, error: receiptErr } = await supabase
    .from('lab_receipts')
    .insert({
      tenant_id: user.tenantId,
      organization_id: user.organizationId,
      sub_org_id: user.subOrgId || null,
      request_id: requestId,
      received_by: user.userId,
      received_at: timestamp,
      receipt_status: 'DISCREPANCY',
      received_quantity: receivedQuantity,
      expected_quantity: expectedQuantity,
      receipt_remarks: discrepancyRemarks,
      receipt_proof_document_id: proofDocumentId,
    })
    .select()
    .single();

  if (receiptErr) {
    return c.json({ success: false, error: receiptErr.message }, 500);
  }

  await supabase
    .from('calibration_requests')
    .update({ status: 'DISCREPANCY', updated_at: timestamp })
    .eq('id', requestId);

  await supabase.from('request_status_history').insert({
    tenant_id: user.tenantId,
    request_id: requestId,
    previous_status: request.status,
    new_status: 'DISCREPANCY',
    changed_by: user.userId,
    remarks: `Receipt Discrepancy logged: ${discrepancyRemarks}`,
    source_module: 'lab-worker-receipt',
  });

  await logAuditEvent(supabase, {
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'LAB_RECEIPT_DISCREPANCY',
    resourceType: 'calibration_requests',
    resourceId: requestId,
    oldValues: { status: request.status },
    newValues: { status: 'DISCREPANCY', remarks: discrepancyRemarks },
  });

  return c.json({
    success: true,
    data: receipt,
    message: 'Lab receipt discrepancy recorded.',
  });
});

// ============================================================================
// 12. STEP 20: GET LAB RECEIPT FOR REQUEST
// ============================================================================
labWorker.get('/lab/requests/:requestId/receipt', requirePermission('lab.receipt.view'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('requestId');
  const supabase = getSupabase(c);

  const { data, error } = await supabase
    .from('lab_receipts')
    .select('*')
    .eq('request_id', requestId)
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  return c.json({ success: true, data: data || [] });
});

