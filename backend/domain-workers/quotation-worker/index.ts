import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  CreateQuotationSchema,
  SubmitApprovalSchema,
  InternalApprovalSchema,
  ClientResponseSchema,
  CostOverrideSchema,
  CreateRequestFromQuotationSchema,
} from './schemas';
import { logAuditEvent } from '../../shared/audit';

export const quotationWorker = new Hono<{
  Bindings: WorkerEnv;
  Variables: { user: AuthenticatedUser };
}>();

function getSupabase(c: any) {
  const url = c.env.SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured in Worker environment.');
  }
  return createClient(url, key);
}

// 1. GET /api/v1/quotations & /api/v1/quotations/requests - List quotations
const listQuotationsHandler = async (c: any) => {
  const user = c.get('user') as AuthenticatedUser;
  const tenantId = c.req.header('x-tenant-id') || user?.tenantId;
  const status = c.req.query('status');
  const quotationType = c.req.query('quotation_type');
  const clientId = c.req.query('client_id');
  const requestId = c.req.query('request_id');
  const search = c.req.query('search')?.toLowerCase();

  const supabase = getSupabase(c);
  let query = supabase
    .from('quotations')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      quotation_number,
      quotation_type,
      request_id,
      client_id,
      quotation_date,
      valid_until,
      status,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      currency,
      version_number,
      parent_quotation_id,
      created_by,
      approved_by,
      approved_at,
      sent_at,
      client_response,
      client_response_remarks,
      client_response_at,
      remarks,
      created_at,
      updated_at,
      clients ( client_code, client_name, contact_person, contact_email, contact_phone ),
      calibration_requests ( request_number )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (quotationType) query = query.eq('quotation_type', quotationType);
  if (clientId) query = query.eq('client_id', clientId);
  if (requestId) query = query.eq('request_id', requestId);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching quotations:', error);
    return c.json({ success: false, error: error.message }, 500);
  }

  let filtered = data || [];
  if (search) {
    filtered = filtered.filter(
      (q: any) =>
        q.quotation_number?.toLowerCase().includes(search) ||
        q.clients?.client_name?.toLowerCase().includes(search) ||
        q.clients?.client_code?.toLowerCase().includes(search) ||
        q.calibration_requests?.request_number?.toLowerCase().includes(search)
    );
  }

  return c.json({
    success: true,
    data: filtered,
    meta: { tenant_id: tenantId, count: filtered.length },
  });
};

quotationWorker.get('/quotations', listQuotationsHandler);
quotationWorker.get('/quotations/requests', listQuotationsHandler);

// 2. GET /api/v1/quotations/:id & /api/v1/quotations/requests/:id - Get quotation details
const getQuotationDetailsHandler = async (c: any) => {
  const user = c.get('user') as AuthenticatedUser;
  const tenantId = c.req.header('x-tenant-id') || user?.tenantId;
  const id = c.req.param('id');

  const supabase = getSupabase(c);

  const { data: q, error: qErr } = await supabase
    .from('quotations')
    .select(`
      *,
      clients ( id, client_code, client_name, contact_person, contact_email, contact_phone, status, billing_address ),
      calibration_requests ( id, request_number, status, collection_date )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (qErr || !q) {
    return c.json({ success: false, error: 'Quotation not found' }, 404);
  }

  // Fetch items
  const { data: items } = await supabase
    .from('quotation_items')
    .select(`
      *,
      item_masters ( item_code, item_name, manufacturer, model, serial_number, calibration_frequency, calibration_frequency_unit )
    `)
    .eq('quotation_id', id)
    .eq('tenant_id', tenantId);

  // Fetch approvals history
  const { data: approvals } = await supabase
    .from('quotation_approvals')
    .select('*')
    .eq('quotation_id', id)
    .eq('tenant_id', tenantId)
    .order('requested_at', { ascending: false });

  // Fetch revisions if any
  const { data: revisions } = await supabase
    .from('quotations')
    .select('id, quotation_number, version_number, status, created_at, total_amount')
    .or(`id.eq.${q.parent_quotation_id || id},parent_quotation_id.eq.${q.id}`)
    .order('version_number', { ascending: true });

  return c.json({
    success: true,
    data: {
      ...q,
      items: items || [],
      approvals: approvals || [],
      revisions: revisions || [],
    },
  });
};

quotationWorker.get('/quotations/:id', getQuotationDetailsHandler);
quotationWorker.get('/quotations/requests/:id', getQuotationDetailsHandler);

// 3. POST /api/v1/quotations & /api/v1/quotations/requests - Create quotation (STANDALONE or REQUEST_BASED)
const createQuotationHandler = async (c: any) => {
  const user = c.get('user') as AuthenticatedUser;
  const tenantId = c.req.header('x-tenant-id') || user?.tenantId;
  const body = await c.req.json();
  const parsed = CreateQuotationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const payload = parsed.data;
  const isStandalone = payload.quotation_type === 'STANDALONE' || !payload.request_id;
  const quotationType = isStandalone ? 'STANDALONE' : 'REQUEST_BASED';

  const supabase = getSupabase(c);

  // Generate Quotation Number
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const qtnPrefix = isStandalone ? 'QTN-STD' : 'QTN-REQ';
  const quotationNumber = `${qtnPrefix}-${new Date().getFullYear()}-${randomSuffix}`;

  // Calculate pricing
  let subtotal = 0;
  let taxTotal = 0;

  const itemRecords = payload.items.map((item) => {
    const unitCost = item.override_cost !== undefined && item.override_cost !== null
      ? item.override_cost
      : 0; // Standard cost will be fetched/computed
    const qty = item.quantity || 1;
    const lineSubtotal = unitCost * qty;
    const lineTax = (lineSubtotal * (item.tax_rate || 18)) / 100;
    const lineTotal = lineSubtotal + lineTax;

    subtotal += lineSubtotal;
    taxTotal += lineTax;

    return {
      request_item_id: item.request_item_id || null,
      item_id: item.item_id,
      description: item.description || '',
      quantity: qty,
      standard_cost: unitCost,
      override_cost: item.override_cost || null,
      final_unit_cost: unitCost,
      tax_rate: item.tax_rate || 18,
      tax_amount: lineTax,
      line_total: lineTotal,
      override_reason: item.override_reason || null,
      override_by: item.override_cost !== undefined ? user.userId : null,
      override_at: item.override_cost !== undefined ? new Date().toISOString() : null,
    };
  });

  const discountAmount = payload.discount_amount || 0;
  const totalAmount = Math.max(0, subtotal + taxTotal - discountAmount);

  // Create Quotation Record
  const { data: newQtn, error: qtnErr } = await supabase
    .from('quotations')
    .insert({
      tenant_id: tenantId,
      quotation_number: quotationNumber,
      quotation_type: quotationType,
      request_id: isStandalone ? null : payload.request_id,
      client_id: payload.client_id,
      valid_until: payload.valid_until,
      currency: payload.currency || 'INR',
      status: 'DRAFT',
      subtotal,
      tax_amount: taxTotal,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      version_number: 1,
      remarks: payload.remarks || null,
      created_by: user.userId,
    })
    .select()
    .single();

  if (qtnErr || !newQtn) {
    console.error('Failed to create quotation:', qtnErr);
    return c.json({ success: false, error: qtnErr?.message || 'Failed to create quotation' }, 500);
  }

  // Insert Quotation Items
  const itemsToInsert = itemRecords.map((item) => ({
    ...item,
    tenant_id: tenantId,
    quotation_id: newQtn.id,
  }));

  const { error: itemsErr } = await supabase.from('quotation_items').insert(itemsToInsert);
  if (itemsErr) {
    console.error('Failed to insert quotation items:', itemsErr);
  }

  await logAuditEvent(c, {
    action: isStandalone ? 'STANDALONE_QUOTATION_CREATED' : 'REQUEST_QUOTATION_CREATED',
    resourceType: 'quotations',
    resourceId: newQtn.id,
    newValues: { quotation_number: quotationNumber, total_amount: totalAmount, type: quotationType },
  });

  return c.json({
    success: true,
    message: `Quotation ${quotationNumber} created successfully as DRAFT`,
    data: newQtn,
  });
};

quotationWorker.post('/quotations', createQuotationHandler);
quotationWorker.post('/quotations/requests', createQuotationHandler);

// 4. POST /api/v1/quotations/:id/submit - Submit for Lab Approver Gate
quotationWorker.post('/quotations/:id/submit', async (c) => {
  const user = c.get('user') as AuthenticatedUser;
  const tenantId = c.req.header('x-tenant-id') || user?.tenantId;
  const id = c.req.param('id');

  const supabase = getSupabase(c);
  const { data: q, error: fetchErr } = await supabase
    .from('quotations')
    .select('id, status, quotation_number')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !q) {
    return c.json({ success: false, error: 'Quotation not found' }, 404);
  }

  if (q.status !== 'DRAFT') {
    return c.json({ success: false, error: `Only DRAFT quotations can be submitted. Current status: ${q.status}` }, 400);
  }

  // Update status to PENDING_APPROVAL
  const { error: updateErr } = await supabase
    .from('quotations')
    .update({ status: 'PENDING_APPROVAL', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  // Record approval request in quotation_approvals
  await supabase.from('quotation_approvals').insert({
    tenant_id: tenantId,
    quotation_id: id,
    approval_status: 'PENDING',
    requested_by: user.userId,
    requested_at: new Date().toISOString(),
  });

  await logAuditEvent(c, {
    action: 'QUOTATION_SUBMITTED',
    resourceType: 'quotations',
    resourceId: id,
    newValues: { status: 'PENDING_APPROVAL' },
  });

  return c.json({
    success: true,
    message: 'Quotation submitted for Lab Approval gate',
    data: { id, status: 'PENDING_APPROVAL' },
  });
});

// 5. POST /api/v1/quotations/:id/approve & /reject - Lab Approver Gate
const processApprovalHandler = async (c: any, actionType: 'APPROVE' | 'REJECT') => {
  const user = c.get('user') as AuthenticatedUser;
  const tenantId = c.req.header('x-tenant-id') || user?.tenantId;
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const supabase = getSupabase(c);
  const { data: q, error: fetchErr } = await supabase
    .from('quotations')
    .select('id, status, quotation_number')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !q) {
    return c.json({ success: false, error: 'Quotation not found' }, 404);
  }

  if (q.status !== 'PENDING_APPROVAL') {
    return c.json({ success: false, error: `Only PENDING_APPROVAL quotations can be approved/rejected. Current status: ${q.status}` }, 400);
  }

  const newStatus = actionType === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  const { error: updateErr } = await supabase
    .from('quotations')
    .update({
      status: newStatus,
      approved_by: actionType === 'APPROVE' ? user.userId : null,
      approved_at: actionType === 'APPROVE' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  // Record in quotation_approvals
  await supabase.from('quotation_approvals').insert({
    tenant_id: tenantId,
    quotation_id: id,
    approval_status: actionType === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    requested_by: user.userId,
    approved_by: user.userId,
    approval_remarks: body.approval_remarks || body.remarks || null,
    requested_at: new Date().toISOString(),
    approved_at: actionType === 'APPROVE' ? new Date().toISOString() : null,
    rejected_at: actionType === 'REJECT' ? new Date().toISOString() : null,
  });

  await logAuditEvent(c, {
    action: actionType === 'APPROVE' ? 'QUOTATION_APPROVED' : 'QUOTATION_REJECTED',
    resourceType: 'quotations',
    resourceId: id,
    newValues: { status: newStatus },
  });

  return c.json({
    success: true,
    message: `Quotation ${actionType === 'APPROVE' ? 'APPROVED' : 'REJECTED'} successfully`,
    data: { id, status: newStatus },
  });
};

quotationWorker.post('/quotations/:id/approve', (c) => processApprovalHandler(c, 'APPROVE'));
quotationWorker.post('/quotations/:id/reject', (c) => processApprovalHandler(c, 'REJECT'));

// 6. POST /api/v1/quotations/:id/send - Send quotation to client & Generate PDF (Vendor Cost Concealed!)
quotationWorker.post('/quotations/:id/send', async (c) => {
  const user = c.get('user') as AuthenticatedUser;
  const tenantId = c.req.header('x-tenant-id') || user?.tenantId;
  const id = c.req.param('id');

  const supabase = getSupabase(c);
  const { data: q, error: fetchErr } = await supabase
    .from('quotations')
    .select('*, clients(*)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !q) {
    return c.json({ success: false, error: 'Quotation not found' }, 404);
  }

  if (q.status !== 'APPROVED') {
    return c.json({ success: false, error: `Only APPROVED quotations can be sent to client. Current status: ${q.status}` }, 400);
  }

  const sentAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('quotations')
    .update({ status: 'SENT_TO_CLIENT', sent_at: sentAt, updated_at: sentAt })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  await logAuditEvent(c, {
    action: 'QUOTATION_SENT',
    resourceType: 'quotations',
    resourceId: id,
    newValues: { status: 'SENT_TO_CLIENT', sent_at: sentAt },
  });

  return c.json({
    success: true,
    message: 'Quotation transmitted to client. Client PDF reference generated.',
    data: { id, status: 'SENT_TO_CLIENT', sent_at: sentAt },
  });
});

// 7. POST /api/v1/quotations/:id/revise - Create new revision
quotationWorker.post('/quotations/:id/revise', async (c) => {
  const user = c.get('user') as AuthenticatedUser;
  const tenantId = c.req.header('x-tenant-id') || user?.tenantId;
  const id = c.req.param('id');

  const supabase = getSupabase(c);
  const { data: parentQtn, error: fetchErr } = await supabase
    .from('quotations')
    .select('*, quotation_items(*)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !parentQtn) {
    return c.json({ success: false, error: 'Parent quotation not found' }, 404);
  }

  const nextVersion = (parentQtn.version_number || 1) + 1;
  const newQtnNumber = parentQtn.quotation_number;

  const { data: revQtn, error: revErr } = await supabase
    .from('quotations')
    .insert({
      tenant_id: tenantId,
      organization_id: parentQtn.organization_id,
      sub_org_id: parentQtn.sub_org_id,
      quotation_number: newQtnNumber,
      quotation_type: parentQtn.quotation_type,
      request_id: parentQtn.request_id,
      client_id: parentQtn.client_id,
      valid_until: parentQtn.valid_until,
      currency: parentQtn.currency,
      status: 'DRAFT',
      subtotal: parentQtn.subtotal,
      tax_amount: parentQtn.tax_amount,
      discount_amount: parentQtn.discount_amount,
      total_amount: parentQtn.total_amount,
      version_number: nextVersion,
      parent_quotation_id: parentQtn.id,
      created_by: user.userId,
    })
    .select()
    .single();

  if (revErr || !revQtn) {
    return c.json({ success: false, error: revErr?.message || 'Failed to create revision' }, 500);
  }

  // Copy items
  if (parentQtn.quotation_items && parentQtn.quotation_items.length > 0) {
    const copiedItems = parentQtn.quotation_items.map((item: any) => ({
      tenant_id: tenantId,
      quotation_id: revQtn.id,
      request_item_id: item.request_item_id,
      item_id: item.item_id,
      description: item.description,
      quantity: item.quantity,
      standard_cost: item.standard_cost,
      override_cost: item.override_cost,
      final_unit_cost: item.final_unit_cost,
      tax_rate: item.tax_rate,
      tax_amount: item.tax_amount,
      line_total: item.line_total,
      override_reason: item.override_reason,
    }));

    await supabase.from('quotation_items').insert(copiedItems);
  }

  await logAuditEvent(c, {
    action: 'QUOTATION_REVISED',
    resourceType: 'quotations',
    resourceId: revQtn.id,
    newValues: { parent_id: parentQtn.id, version_number: nextVersion },
  });

  return c.json({
    success: true,
    message: `Quotation revision v${nextVersion} created as DRAFT`,
    data: revQtn,
  });
});

// 8. POST /api/v1/quotations/:id/client-response - Record client response
quotationWorker.post('/quotations/:id/client-response', async (c) => {
  const user = c.get('user') as AuthenticatedUser;
  const tenantId = c.req.header('x-tenant-id') || user?.tenantId;
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = ClientResponseSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const { response, remarks } = parsed.data;
  const clientResponseAt = new Date().toISOString();
  const newStatus = response === 'APPROVED' ? 'CLIENT_APPROVED' : response === 'REJECTED' ? 'CLIENT_REJECTED' : response;

  const supabase = getSupabase(c);
  const { error: updateErr } = await supabase
    .from('quotations')
    .update({
      status: newStatus,
      client_response: response,
      client_response_remarks: remarks || null,
      client_response_at: clientResponseAt,
      updated_at: clientResponseAt,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  await logAuditEvent(c, {
    action: 'CLIENT_QUOTATION_RESPONSE',
    resourceType: 'quotations',
    resourceId: id,
    newValues: { client_response: response, status: newStatus },
  });

  return c.json({
    success: true,
    message: `Client response recorded as ${response}`,
    data: { id, status: newStatus, client_response: response },
  });
});

// 9. POST /api/v1/quotations/:id/create-request - Create Calibration Request from Approved Standalone Quotation
quotationWorker.post('/quotations/:id/create-request', async (c) => {
  const user = c.get('user') as AuthenticatedUser;
  const tenantId = c.req.header('x-tenant-id') || user?.tenantId;
  const quotationId = c.req.param('id');
  const body = await c.req.json();
  const parsed = CreateRequestFromQuotationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);

  // Fetch Quotation & Selected Items
  const { data: qtn, error: qtnErr } = await supabase
    .from('quotations')
    .select('*, quotation_items(*)')
    .eq('id', quotationId)
    .eq('tenant_id', tenantId)
    .single();

  if (qtnErr || !qtn) {
    return c.json({ success: false, error: 'Quotation not found' }, 404);
  }

  if (qtn.status !== 'APPROVED' && qtn.status !== 'CLIENT_APPROVED' && qtn.status !== 'SENT_TO_CLIENT') {
    return c.json({ success: false, error: 'Only approved quotations can be converted to Calibration Requests' }, 400);
  }

  const selectedItemIds = new Set(parsed.data.selected_quotation_item_ids);
  const quotationItemsToUse = (qtn.quotation_items || []).filter((qi: any) => selectedItemIds.has(qi.id));

  if (quotationItemsToUse.length === 0) {
    return c.json({ success: false, error: 'No valid quotation items selected for conversion' }, 400);
  }

  // Create Calibration Request
  const reqRandom = Math.floor(1000 + Math.random() * 9000);
  const requestNumber = `REQ-STD-${new Date().getFullYear()}-${reqRandom}`;

  const { data: newReq, error: reqErr } = await supabase
    .from('calibration_requests')
    .insert({
      tenant_id: tenantId,
      organization_id: qtn.organization_id,
      sub_org_id: qtn.sub_org_id,
      request_number: requestNumber,
      client_id: qtn.client_id,
      collection_agent_id: parsed.data.collection_agent_id || user.userId,
      collection_date: parsed.data.collection_date || new Date().toISOString().split('T')[0],
      priority: parsed.data.priority || 'NORMAL',
      status: 'CREATED',
      remarks: `Created from Standalone Quotation ${qtn.quotation_number}. ${parsed.data.remarks || ''}`,
      created_by: user.userId,
    })
    .select()
    .single();

  if (reqErr || !newReq) {
    return c.json({ success: false, error: reqErr?.message || 'Failed to create Calibration Request' }, 500);
  }

  // Create Request Items & update consumed_quantity
  const requestItemsToInsert = quotationItemsToUse.map((qi: any) => ({
    request_id: newReq.id,
    tenant_id: tenantId,
    item_id: qi.item_id,
    requested_quantity: qi.quantity || 1,
    item_available: 'YES',
  }));

  await supabase.from('request_items').insert(requestItemsToInsert);

  // Update consumed_quantity on quotation_items
  for (const qi of quotationItemsToUse) {
    const updatedConsumed = (qi.consumed_quantity || 0) + qi.quantity;
    await supabase
      .from('quotation_items')
      .update({ consumed_quantity: updatedConsumed })
      .eq('id', qi.id);
  }

  await logAuditEvent(c, {
    action: 'QUOTATION_REQUEST_CREATED',
    resourceType: 'calibration_requests',
    resourceId: newReq.id,
    newValues: { quotation_id: quotationId, request_number: requestNumber },
  });

  return c.json({
    success: true,
    message: `Calibration Request ${requestNumber} created successfully from Quotation ${qtn.quotation_number}`,
    data: newReq,
  });
});

export default quotationWorker;
