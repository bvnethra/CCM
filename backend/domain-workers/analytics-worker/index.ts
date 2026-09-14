import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  DashboardFilterSchema,
  DueListQuerySchema,
  ExceptionQuerySchema,
  AuditLogQuerySchema,
  GlobalSearchSchema,
  ReportFilterSchema,
} from './schemas';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';

type AppVariables = {
  user: AuthenticatedUser;
};

export const analyticsWorker = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

function getSupabase(c: any) {
  const url = c.env.SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured in Worker environment.');
  }
  return createClient(url, key);
}

// ==========================================
// 1. DASHBOARD SUMMARY METRICS
// ==========================================
analyticsWorker.get('/dashboard/summary', requirePermission('request.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  // Query counts grouped by status from calibration_requests
  const { data: reqs, error } = await supabase
    .from('calibration_requests')
    .select('id, status, priority, created_at')
    .eq('tenant_id', tenantId);

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  const requests = reqs || [];

  // Query auxiliary tables for accurate metrics
  const { count: faultyCount } = await supabase
    .from('calibration_results')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('calibration_result', 'FAIL');

  const { count: serviceApprovalCount } = await supabase
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('approval_status', 'PENDING_APPROVAL');

  const { count: outsourceCount } = await supabase
    .from('vendor_outsourcings')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  const { count: pendingQuotesCount } = await supabase
    .from('quotations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'DRAFT');

  const { count: pendingApprovalsCount } = await supabase
    .from('quotations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'SENT_TO_CLIENT');

  const { count: pendingInvoicesCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'ISSUED');

  const { count: awaitingClientSignCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'CLIENT_SIGNATURE_PENDING');

  const { count: readyForDispatchCount } = await supabase
    .from('dispatches')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'READY_FOR_DISPATCH');

  const { count: inTransitCount } = await supabase
    .from('dispatches')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status', ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']);

  const summary = {
    totalRequests: requests.length,
    pendingCollection: requests.filter((r) => r.status === 'CREATED').length,
    labQueue: requests.filter((r) => r.status === 'LAB_QUEUE').length,
    pendingVerification: requests.filter((r) => r.status === 'VERIFICATION').length,
    calibrationInProgress: requests.filter((r) => r.status === 'CALIBRATION').length,
    faultyItems: faultyCount || 0,
    servicePendingApproval: serviceApprovalCount || 0,
    outsourcedItems: outsourceCount || 0,
    pendingQuotations: pendingQuotesCount || 0,
    pendingApprovals: pendingApprovalsCount || 0,
    pendingInvoices: pendingInvoicesCount || 0,
    awaitingClientSignature: awaitingClientSignCount || 0,
    readyForDispatch: readyForDispatchCount || 0,
    inTransit: inTransitCount || 0,
    awaitingDelivery: inTransitCount || 0,
    partiallyCompleted: requests.filter((r) => r.status === 'PARTIALLY_COMPLETED').length,
    completedRequests: requests.filter((r) => r.status === 'COMPLETED').length,
  };

  return c.json({ success: true, data: summary });
});

// ==========================================
// 2. DASHBOARD WORKFLOW FUNNEL
// ==========================================
analyticsWorker.get('/dashboard/workflow', requirePermission('request.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const { data: requests, error } = await supabase
    .from('calibration_requests')
    .select('status')
    .eq('tenant_id', tenantId);

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  const reqs = requests || [];

  const funnel = [
    { stage: 'Requests Created', key: 'CREATED', count: reqs.filter((r) => ['CREATED', 'COLLECTED'].includes(r.status)).length },
    { stage: 'Lab Queue', key: 'LAB_QUEUE', count: reqs.filter((r) => r.status === 'LAB_QUEUE').length },
    { stage: 'Verification', key: 'VERIFICATION', count: reqs.filter((r) => r.status === 'VERIFICATION').length },
    { stage: 'Calibration', key: 'CALIBRATION', count: reqs.filter((r) => ['CALIBRATION', 'CALIBRATED'].includes(r.status)).length },
    { stage: 'Commercial', key: 'QUOTATION', count: reqs.filter((r) => ['QUOTATION', 'APPROVAL', 'INVOICE'].includes(r.status)).length },
    { stage: 'Client Signature', key: 'CLIENT_SIGN', count: reqs.filter((r) => r.status === 'CLIENT_SIGN').length },
    { stage: 'Dispatch', key: 'DISPATCH', count: reqs.filter((r) => ['READY_TO_DISPATCH', 'DISPATCHED'].includes(r.status)).length },
    { stage: 'Delivery', key: 'DELIVERY', count: reqs.filter((r) => ['CLIENT_RECEIVED', 'DELIVERY_SIGNED'].includes(r.status)).length },
    { stage: 'Completed', key: 'COMPLETED', count: reqs.filter((r) => ['COMPLETED', 'PARTIALLY_COMPLETED'].includes(r.status)).length },
  ];

  return c.json({ success: true, data: funnel });
});

// ==========================================
// 3. EXCEPTION / ACTION CENTER
// ==========================================
analyticsWorker.get('/operations/exceptions', requirePermission('request.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const exceptions: any[] = [];

  // 1. Faulty Calibrations needing Service Approval
  const { data: faultyCals } = await supabase
    .from('calibration_results')
    .select(`
      id, request_id, request_item_id, created_at,
      request:calibration_requests(request_number, client:clients(client_name)),
      item:request_items(item:item_masters(item_code, item_name, serial_number))
    `)
    .eq('tenant_id', tenantId)
    .eq('calibration_result', 'FAIL');

  (faultyCals || []).forEach((fc: any) => {
    exceptions.push({
      id: `exc-faulty-${fc.id}`,
      request_number: fc.request?.request_number || 'N/A',
      client_name: fc.request?.client?.client_name || 'N/A',
      item_code: fc.item?.item?.item_code || 'N/A',
      item_name: fc.item?.item?.item_name || 'N/A',
      serial_number: fc.item?.item?.serial_number || 'N/A',
      exception_type: 'Faulty Calibration',
      created_date: fc.created_at,
      current_status: 'SERVICE_REQUIRED',
      target_route: '/service-requests',
      action_label: 'Review Service Flow',
    });
  });

  // 2. Outsourcing Pending Vendor PO
  const { data: outsources } = await supabase
    .from('vendor_outsourcings')
    .select(`
      id, request_id, created_at, status,
      request:calibration_requests(request_number, client:clients(client_name)),
      item:request_items(item:item_masters(item_code, item_name, serial_number))
    `)
    .eq('tenant_id', tenantId)
    .in('status', ['OUTSOURCE_PENDING', 'PO_CREATED']);

  (outsources || []).forEach((os: any) => {
    exceptions.push({
      id: `exc-outsource-${os.id}`,
      request_number: os.request?.request_number || 'N/A',
      client_name: os.request?.client?.client_name || 'N/A',
      item_code: os.item?.item?.item_code || 'N/A',
      item_name: os.item?.item?.item_name || 'N/A',
      serial_number: os.item?.item?.serial_number || 'N/A',
      exception_type: 'Outsourcing Pending PO',
      created_date: os.created_at,
      current_status: os.status,
      target_route: '/vendor-outsourcing',
      action_label: 'Manage Outsourcing',
    });
  });

  // 3. Invoices Pending Client Digital Signature
  const { data: pendingSigs } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, created_at, status, request_id,
      client:clients(client_name),
      request:calibration_requests(request_number)
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'CLIENT_SIGNATURE_PENDING');

  (pendingSigs || []).forEach((inv: any) => {
    exceptions.push({
      id: `exc-sig-${inv.id}`,
      request_number: inv.request?.request_number || 'N/A',
      client_name: inv.client?.client_name || 'N/A',
      item_code: 'INVOICE',
      item_name: `Invoice #${inv.invoice_number}`,
      serial_number: inv.invoice_number,
      exception_type: 'Invoice Pending Signature',
      created_date: inv.created_at,
      current_status: 'CLIENT_SIGNATURE_PENDING',
      target_route: '/invoices',
      action_label: 'Capture Signature',
    });
  });

  return c.json({ success: true, data: exceptions });
});

// Also alias under /dashboard/exceptions
analyticsWorker.get('/dashboard/exceptions', requirePermission('request.view'), async (c) => {
  return c.req.raw ? analyticsWorker.fetch(new Request(c.req.raw.url.replace('/dashboard/exceptions', '/operations/exceptions'), c.req.raw)) : c.json({ success: false }, 400);
});

// ==========================================
// 4. DUE CALIBRATION LIST
// ==========================================
analyticsWorker.get('/calibration/due-list', requirePermission('calibration.due_list.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const dueStatus = c.req.query('due_status') || 'ALL';
  const clientId = c.req.query('client_id');
  const supabase = getSupabase(c);

  let query = supabase
    .from('calibration_certificates')
    .select(`
      id,
      certificate_number,
      calibration_date,
      next_due_date,
      created_at,
      request_item:request_items(
        id,
        item:item_masters(
          id, item_code, item_name, item_type, manufacturer, model, serial_number
        ),
        request:calibration_requests(
          id, request_number, client:clients(id, client_name, client_code)
        )
      )
    `)
    .eq('tenant_id', tenantId)
    .order('next_due_date', { ascending: true });

  const { data: certs, error } = await query;

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueList = (certs || [])
    .map((cert: any) => {
      const dueDate = cert.next_due_date ? new Date(cert.next_due_date) : null;
      let daysRemaining = 0;
      let calculatedStatus = 'UPCOMING';

      if (dueDate) {
        const diffTime = dueDate.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          calculatedStatus = 'OVERDUE';
        } else if (daysRemaining <= 30) {
          calculatedStatus = 'DUE_SOON';
        } else {
          calculatedStatus = 'UPCOMING';
        }
      }

      return {
        id: cert.id,
        item_code: cert.request_item?.item?.item_code || 'N/A',
        item_name: cert.request_item?.item?.item_name || 'N/A',
        serial_number: cert.request_item?.item?.serial_number || 'N/A',
        client_name: cert.request_item?.request?.client?.client_name || 'N/A',
        last_calibration_date: cert.calibration_date,
        next_due_date: cert.next_due_date,
        days_remaining: daysRemaining,
        due_status: calculatedStatus,
        certificate_number: cert.certificate_number,
      };
    })
    .filter((item: any) => {
      if (dueStatus !== 'ALL' && item.due_status !== dueStatus) return false;
      if (clientId && clientId !== 'all' && item.client_id !== clientId) return false;
      return true;
    });

  return c.json({ success: true, data: dueList });
});

// ==========================================
// 5. SERVER-SIDE WORKFLOW COMPLETION ENGINE
// ==========================================
analyticsWorker.post('/calibration-requests/:id/evaluate-completion', requirePermission('request.edit'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('id');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  // 1. Fetch Request & Items
  const { data: request, error: reqErr } = await supabase
    .from('calibration_requests')
    .select('id, request_number, status')
    .eq('id', requestId)
    .eq('tenant_id', tenantId)
    .single();

  if (reqErr || !request) {
    return c.json({ success: false, error: 'Calibration request not found' }, 404);
  }

  const { data: items, error: itemsErr } = await supabase
    .from('request_items')
    .select('id, item_available')
    .eq('request_id', requestId)
    .eq('tenant_id', tenantId);

  if (itemsErr || !items || items.length === 0) {
    return c.json({ success: false, error: 'No items found for evaluation' }, 400);
  }

  // 2. Inspect each item's completion status across tables
  const itemEvaluations = await Promise.all(
    items.map(async (item) => {
      // a) Verification
      const { data: ver } = await supabase
        .from('item_verifications')
        .select('id, verification_status')
        .eq('request_item_id', item.id)
        .maybeSingle();

      // b) Calibration OR Outsource
      const { data: cal } = await supabase
        .from('calibration_results')
        .select('id, calibration_result')
        .eq('request_item_id', item.id)
        .maybeSingle();

      const { data: out } = await supabase
        .from('vendor_outsourcings')
        .select('id, status')
        .eq('request_item_id', item.id)
        .maybeSingle();

      // c) Dispatch & Delivery
      const { data: dispItem } = await supabase
        .from('dispatch_items')
        .select('id, dispatch_id')
        .eq('request_item_id', item.id)
        .maybeSingle();

      let isDelivered = false;
      if (dispItem) {
        const { data: del } = await supabase
          .from('deliveries')
          .select('id, status')
          .eq('dispatch_id', dispItem.dispatch_id)
          .maybeSingle();
        if (del && del.status === 'DELIVERED') {
          isDelivered = true;
        }
      }

      // Evaluation criteria for complete item:
      // Available + Verified + (Pass Calibration OR Returned Outsource) + Delivered
      const isVerified = ver && (ver.verification_status === 'COMPLETED' || ver.verification_status === 'VERIFIED');
      const isCalibratedOrOutsourced =
        (cal && cal.calibration_result === 'PASS') ||
        (out && out.status === 'REINTEGRATED');

      const isCompleted = item.item_available === 'YES' && isVerified && isCalibratedOrOutsourced && isDelivered;

      return {
        itemId: item.id,
        isCompleted,
        isDelivered,
      };
    })
  );

  const completedItemsCount = itemEvaluations.filter((i) => i.isCompleted).length;
  const totalItems = items.length;

  let newStatus = request.status;
  if (completedItemsCount === totalItems) {
    newStatus = 'COMPLETED';
  } else if (completedItemsCount > 0 || itemEvaluations.some((i) => i.isDelivered)) {
    newStatus = 'PARTIALLY_COMPLETED';
  }

  // Update status if changed
  if (newStatus !== request.status) {
    await supabase
      .from('calibration_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    await logAuditEvent(supabase, {
      tenantId,
      userId: user.userId,
      action: 'EVALUATE_REQUEST_COMPLETION',
      resourceType: 'calibration_requests',
      resourceId: requestId,
      oldValues: { status: request.status },
      newValues: { status: newStatus, completedItemsCount, totalItems },
    });
  }

  return c.json({
    success: true,
    data: {
      requestId,
      requestNumber: request.request_number,
      previousStatus: request.status,
      newStatus,
      completedItemsCount,
      totalItems,
      isFullyCompleted: newStatus === 'COMPLETED',
    },
  });
});

// ==========================================
// 6. REQUEST TIMELINE & ITEM PROGRESS MATRIX
// ==========================================
analyticsWorker.get('/calibration-requests/:id/timeline', requirePermission('request.view'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('id');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  // Fetch status history + audit logs for request
  const { data: statusHistory } = await supabase
    .from('request_status_history')
    .select('*, changed_by_user:users(full_name)')
    .eq('request_id', requestId)
    .order('changed_at', { ascending: true });

  const timelineEvents = (statusHistory || []).map((sh: any) => ({
    timestamp: sh.changed_at,
    title: `Status: ${sh.new_status}`,
    description: sh.remarks || `Status transitioned from ${sh.previous_status} to ${sh.new_status}`,
    user_name: sh.changed_by_user?.full_name || 'System User',
    status: sh.new_status,
  }));

  return c.json({ success: true, data: timelineEvents });
});

analyticsWorker.get('/calibration-requests/:id/progress', requirePermission('request.view'), async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('id');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const { data: items } = await supabase
    .from('request_items')
    .select(`
      id, item_available, availability_remarks,
      item:item_masters(id, item_code, item_name, serial_number)
    `)
    .eq('request_id', requestId)
    .eq('tenant_id', tenantId);

  const progressMatrix = await Promise.all(
    (items || []).map(async (item: any) => {
      const { data: ver } = await supabase
        .from('item_verifications')
        .select('verification_status')
        .eq('request_item_id', item.id)
        .maybeSingle();

      const { data: cal } = await supabase
        .from('calibration_results')
        .select('calibration_result')
        .eq('request_item_id', item.id)
        .maybeSingle();

      const { data: cert } = await supabase
        .from('calibration_certificates')
        .select('certificate_number')
        .eq('request_item_id', item.id)
        .maybeSingle();

      const { data: dispItem } = await supabase
        .from('dispatch_items')
        .select('dispatch_id')
        .eq('request_item_id', item.id)
        .maybeSingle();

      let deliveryStatus = 'Pending';
      if (dispItem) {
        const { data: del } = await supabase
          .from('deliveries')
          .select('status')
          .eq('dispatch_id', dispItem.dispatch_id)
          .maybeSingle();
        if (del) deliveryStatus = del.status;
      }

      return {
        item_id: item.id,
        item_code: item.item?.item_code || 'N/A',
        item_name: item.item?.item_name || 'N/A',
        serial_number: item.item?.serial_number || 'N/A',
        availability: item.item_available === 'YES' ? '✓ Available' : 'Unavailable',
        verification: ver ? `✓ ${ver.verification_status}` : 'Pending',
        calibration: cal ? `✓ ${cal.calibration_result}` : 'Pending',
        certificate: cert ? `✓ ${cert.certificate_number}` : 'Pending',
        dispatch: dispItem ? '✓ Dispatched' : 'Pending',
        delivery: deliveryStatus === 'DELIVERED' ? '✓ Delivered' : deliveryStatus,
        final_status: deliveryStatus === 'DELIVERED' ? 'Completed' : 'In Progress',
      };
    })
  );

  return c.json({ success: true, data: progressMatrix });
});

// ==========================================
// 7. AUDIT LOG VIEWER
// ==========================================
analyticsWorker.get('/audit-logs', requirePermission('audit.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select(`
      id, user_id, action, resource_type, resource_id, old_values, new_values, created_at,
      user:users(full_name, email)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  const formattedLogs = (logs || []).map((l: any) => ({
    id: l.id,
    timestamp: l.created_at,
    user_name: l.user?.full_name || l.user?.email || 'System',
    action: l.action,
    module: l.resource_type,
    resource_id: l.resource_id,
    old_values: l.old_values,
    new_values: l.new_values,
  }));

  return c.json({ success: true, data: formattedLogs });
});

// ==========================================
// 8. GLOBAL SEARCH
// ==========================================
analyticsWorker.get('/global-search', requirePermission('request.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const queryStr = c.req.query('q')?.toLowerCase().trim();
  const supabase = getSupabase(c);

  if (!queryStr || queryStr.length < 1) {
    return c.json({ success: true, data: [] });
  }

  const results: any[] = [];

  // Search Requests
  const { data: reqs } = await supabase
    .from('calibration_requests')
    .select('id, request_number, status, client:clients(client_name)')
    .eq('tenant_id', tenantId)
    .ilike('request_number', `%${queryStr}%`)
    .limit(5);

  (reqs || []).forEach((r: any) => {
    results.push({
      type: 'Calibration Request',
      reference: r.request_number,
      client: r.client?.client_name || 'N/A',
      status: r.status,
      route: `/calibration-requests/${r.id}`,
    });
  });

  // Search Clients
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_code, client_name, status')
    .eq('tenant_id', tenantId)
    .or(`client_name.ilike.%${queryStr}%,client_code.ilike.%${queryStr}%`)
    .limit(5);

  (clients || []).forEach((cl: any) => {
    results.push({
      type: 'Client',
      reference: `${cl.client_code} - ${cl.client_name}`,
      client: cl.client_name,
      status: cl.status,
      route: '/clients',
    });
  });

  // Search Invoices
  const { data: invs } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, client:clients(client_name)')
    .eq('tenant_id', tenantId)
    .ilike('invoice_number', `%${queryStr}%`)
    .limit(5);

  (invs || []).forEach((inv: any) => {
    results.push({
      type: 'Invoice',
      reference: inv.invoice_number,
      client: inv.client?.client_name || 'N/A',
      status: inv.status,
      route: `/invoices/${inv.id}`,
    });
  });

  // Search Dispatches
  const { data: disps } = await supabase
    .from('dispatches')
    .select('id, dispatch_number, tracking_number, status, client:clients(client_name)')
    .eq('tenant_id', tenantId)
    .or(`dispatch_number.ilike.%${queryStr}%,tracking_number.ilike.%${queryStr}%`)
    .limit(5);

  (disps || []).forEach((d: any) => {
    results.push({
      type: 'Dispatch',
      reference: `${d.dispatch_number} (${d.tracking_number || 'No Tracking'})`,
      client: d.client?.client_name || 'N/A',
      status: d.status,
      route: `/dispatches/${d.id}`,
    });
  });

  return c.json({ success: true, data: results });
});

// ==========================================
// 9. REPORTING DATA EXPORT
// ==========================================
analyticsWorker.get('/reports', requirePermission('request.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const reportType = c.req.query('report_type') || 'CALIBRATION_REQUEST_SUMMARY';
  const supabase = getSupabase(c);

  const { data: reqs } = await supabase
    .from('calibration_requests')
    .select(`
      request_number, collection_date, priority, status, created_at,
      client:clients(client_name)
    `)
    .eq('tenant_id', tenantId);

  const reportData = (reqs || []).map((r: any) => ({
    request_number: r.request_number,
    client: r.client?.client_name || 'N/A',
    collection_date: r.collection_date,
    priority: r.priority,
    status: r.status,
    created_at: r.created_at,
  }));

  return c.json({ success: true, data: reportData });
});
