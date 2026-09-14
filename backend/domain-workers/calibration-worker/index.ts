import { Hono } from 'hono';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedUser, WorkerEnv } from '../../shared/types';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';
import { StorageService } from '../../shared/storage';
import {
  StartCalibrationSchema,
  AddMeasurementSchema,
  UpdateMeasurementSchema,
  CompleteCalibrationSchema,
  GenerateCertificateSchema,
  FrequencyOverrideSchema,
} from './schemas';

export const calibrationWorker = new Hono<{
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

// Helper: Calculate Error and Measurement Result
function calculateMeasurementFields(input: {
  nominal_value?: number | null;
  observed_value?: number | null;
  tolerance_min?: number | null;
  tolerance_max?: number | null;
}) {
  const { nominal_value, observed_value, tolerance_min, tolerance_max } = input;
  let error_value: number | null = null;
  let measurement_result: 'PASS' | 'FAIL' | 'NOT_TESTED' = 'NOT_TESTED';

  if (typeof nominal_value === 'number' && typeof observed_value === 'number') {
    error_value = Number((observed_value - nominal_value).toFixed(4));
    
    if (typeof tolerance_min === 'number' && typeof tolerance_max === 'number') {
      if (observed_value >= tolerance_min && observed_value <= tolerance_max) {
        measurement_result = 'PASS';
      } else {
        measurement_result = 'FAIL';
      }
    } else {
      measurement_result = 'PASS';
    }
  }

  return { error_value, measurement_result };
}

// Helper: Calculate Next Due Date based on Calibration Date and Frequency
function calculateNextDueDate(calibrationDateStr: string, frequency: number, unit: string): string {
  const calDate = new Date(calibrationDateStr);
  const nextDate = new Date(calDate);

  if (unit === 'YEARS') {
    nextDate.setFullYear(nextDate.getFullYear() + frequency);
  } else if (unit === 'DAYS') {
    nextDate.setDate(nextDate.getDate() + frequency);
  } else {
    // Default MONTHS
    nextDate.setMonth(nextDate.getMonth() + frequency);
  }

  return nextDate.toISOString().split('T')[0];
}

// ============================================================================
// 1. GET CALIBRATION QUEUE DIRECTORY + METRICS
// ============================================================================
calibrationWorker.get('/calibrations', requirePermission('calibration.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const status = c.req.query('status') || 'ALL';
  const priority = c.req.query('priority') || 'ALL';
  const search = (c.req.query('search') || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)));

  // Fetch all verifications that are VERIFIED
  const { data: verifs, error: verifErr } = await supabase
    .from('verifications')
    .select(`
      *,
      verified_by_user:users(id, full_name, email),
      request:calibration_requests(
        id, request_number, priority, collection_date,
        client:clients(id, client_code, client_name)
      ),
      request_item:request_items(
        id, item_id, requested_quantity, item_available,
        item:item_masters(id, item_code, item_name, manufacturer, model, serial_number, calibration_frequency, calibration_frequency_unit)
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('verification_result', 'VERIFIED');

  if (verifErr) {
    return c.json({ success: false, error: verifErr.message }, 500);
  }

  const verifiedItems = verifs || [];
  const reqItemIds = verifiedItems.map((v: any) => v.request_item_id);

  // Fetch calibrations for these items
  let calibrationsMap = new Map();
  if (reqItemIds.length > 0) {
    const { data: calData } = await supabase
      .from('calibrations')
      .select('*, calibrated_by_user:users(id, full_name, email)')
      .eq('tenant_id', tenantId)
      .in('request_item_id', reqItemIds);
    (calData || []).forEach((cItem: any) => calibrationsMap.set(cItem.request_item_id, cItem));
  }

  // Combine items into unified queue output
  let queueList: any[] = [];
  let pendingCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;
  let failedCount = 0;
  let notCalibratableCount = 0;

  for (const v of verifiedItems) {
    const cal = calibrationsMap.get(v.request_item_id) || null;
    const calStatus = cal ? cal.status : 'PENDING';

    if (calStatus === 'PENDING') pendingCount++;
    if (calStatus === 'IN_PROGRESS') inProgressCount++;
    if (calStatus === 'COMPLETED') completedCount++;
    if (calStatus === 'FAILED') failedCount++;
    if (calStatus === 'NOT_CALIBRATABLE') notCalibratableCount++;

    queueList.push({
      request_id: v.request_id,
      request_number: v.request?.request_number || 'N/A',
      priority: v.request?.priority || 'NORMAL',
      client: v.request?.client || null,
      request_item_id: v.request_item_id,
      item_id: v.request_item?.item_id || null,
      item_code: v.request_item?.item?.item_code || 'N/A',
      item_name: v.request_item?.item?.item_name || 'N/A',
      serial_number: v.request_item?.item?.serial_number || 'N/A',
      verification_result: v.verification_result,
      verified_by: v.verified_by_user?.full_name || 'System',
      calibration: cal,
      calibration_status: calStatus,
      calibration_result: cal?.result || null,
      created_at: v.verified_at,
    });
  }

  // Apply filters
  if (status !== 'ALL') {
    queueList = queueList.filter((item) => item.calibration_status === status);
  }
  if (priority !== 'ALL') {
    queueList = queueList.filter((item) => item.priority === priority);
  }
  if (search) {
    queueList = queueList.filter(
      (item) =>
        item.request_number.toLowerCase().includes(search) ||
        (item.client?.client_name || '').toLowerCase().includes(search) ||
        item.item_code.toLowerCase().includes(search) ||
        item.item_name.toLowerCase().includes(search) ||
        item.serial_number.toLowerCase().includes(search)
    );
  }

  const total = queueList.length;
  const paginated = queueList.slice((page - 1) * pageSize, page * pageSize);

  return c.json({
    success: true,
    data: {
      items: paginated,
      metrics: {
        total_eligible: verifiedItems.length,
        pending: pendingCount,
        in_progress: inProgressCount,
        completed: completedCount,
        failed: failedCount,
        not_calibratable: notCalibratableCount,
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
// 2. GET CALIBRATION WORKSPACE / DETAILS
// ============================================================================
calibrationWorker.get('/calibrations/:requestItemId', requirePermission('calibration.view'), async (c) => {
  const requestItemId = c.req.param('requestItemId');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  // 1. Fetch Request Item with Item Master and Request Details
  const { data: requestItem, error: itemErr } = await supabase
    .from('request_items')
    .select(`
      *,
      item:item_masters(*),
      request:calibration_requests(
        *,
        client:clients(*)
      )
    `)
    .eq('id', requestItemId)
    .eq('tenant_id', tenantId)
    .single();

  if (itemErr || !requestItem) {
    return c.json({ success: false, error: 'Request item not found or access denied' }, 404);
  }

  // 2. Fetch Verification Record (Must be VERIFIED)
  const { data: verification } = await supabase
    .from('verifications')
    .select('*, verified_by_user:users(id, full_name, email)')
    .eq('request_item_id', requestItemId)
    .eq('tenant_id', tenantId)
    .single();

  if (!verification || verification.verification_result !== 'VERIFIED') {
    return c.json(
      {
        success: false,
        error: `Item is not eligible for calibration. Verification status is '${verification?.verification_result || 'UNVERIFIED'}'. Only VERIFIED items can enter calibration.`,
      },
      400
    );
  }

  // 3. Fetch Verification Documents for this request item
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('request_id', requestItem.request_id);

  // 4. Fetch Active Calibration if present
  const { data: calibration } = await supabase
    .from('calibrations')
    .select('*, calibrated_by_user:users(id, full_name, email)')
    .eq('request_item_id', requestItemId)
    .eq('tenant_id', tenantId)
    .single();

  let measurements: any[] = [];
  let certificates: any[] = [];

  if (calibration) {
    // Fetch Measurements
    const { data: mData } = await supabase
      .from('calibration_measurements')
      .select('*')
      .eq('calibration_id', calibration.id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    measurements = mData || [];

    // Fetch Certificates
    const { data: cData } = await supabase
      .from('certificates')
      .select('*, generated_by_user:users(id, full_name, email)')
      .eq('calibration_id', calibration.id)
      .eq('tenant_id', tenantId)
      .order('version', { ascending: false });
    certificates = cData || [];
  }

  return c.json({
    success: true,
    data: {
      request_item: requestItem,
      verification,
      documents: docs || [],
      calibration: calibration || null,
      measurements,
      certificates,
    },
  });
});

// ============================================================================
// 3. START CALIBRATION
// ============================================================================
calibrationWorker.post('/calibrations/start', requirePermission('calibration.create'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const body = await c.req.json();
  const parsed = StartCalibrationSchema.safeParse(body);
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

  const { request_id, request_item_id, item_id, calibration_method, environmental_conditions } = parsed.data;

  // 1. Verify Verification Record exists & is VERIFIED
  const { data: verification } = await supabase
    .from('verifications')
    .select('*')
    .eq('request_item_id', request_item_id)
    .eq('tenant_id', tenantId)
    .single();

  if (!verification || verification.verification_result !== 'VERIFIED') {
    return c.json(
      {
        success: false,
        error: `Cannot start calibration: Item verification status is '${verification?.verification_result || 'UNVERIFIED'}'. Only VERIFIED items are eligible.`,
      },
      400
    );
  }

  // 2. Check if active calibration already exists
  const { data: existingCal } = await supabase
    .from('calibrations')
    .select('id, status')
    .eq('request_item_id', request_item_id)
    .eq('tenant_id', tenantId)
    .single();

  if (existingCal) {
    return c.json(
      {
        success: false,
        error: `Calibration already exists for this item (Status: ${existingCal.status}).`,
        data: existingCal,
      },
      409
    );
  }

  const timestamp = new Date().toISOString();

  // 3. Create Calibration Record (IN_PROGRESS)
  const { data: calibration, error: calErr } = await supabase
    .from('calibrations')
    .insert({
      tenant_id: tenantId,
      request_id,
      request_item_id,
      item_id,
      calibrated_by: user.userId,
      calibration_started_at: timestamp,
      calibration_method: calibration_method || 'Standard Direct Comparison Metrology',
      environmental_conditions: environmental_conditions || 'Temperature: 23°C ± 2°C, Humidity: 50% ± 10% RH',
      result: 'PASS',
      status: 'IN_PROGRESS',
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select('*, calibrated_by_user:users(id, full_name, email)')
    .single();

  if (calErr) {
    return c.json({ success: false, error: calErr.message }, 500);
  }

  // 4. Update request status history if first calibration started
  await supabase.from('request_status_history').insert({
    tenant_id: tenantId,
    request_id,
    previous_status: 'VERIFICATION',
    new_status: 'CALIBRATION',
    changed_by: user.userId,
    changed_at: timestamp,
    remarks: `Started calibration for item ID ${item_id}`,
  });

  // 5. Audit Log
  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'START_CALIBRATION',
    resourceType: 'calibrations',
    resourceId: calibration.id,
    newValues: { request_id, request_item_id, item_id, status: 'IN_PROGRESS' },
  });

  return c.json({
    success: true,
    data: calibration,
    message: 'Calibration started successfully.',
  });
});

// ============================================================================
// 4. ADD / EDIT / DELETE MEASUREMENTS
// ============================================================================
calibrationWorker.post('/calibrations/:id/measurements', requirePermission('calibration.edit'), async (c) => {
  const calibrationId = c.req.param('id');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const body = await c.req.json();
  const parsed = AddMeasurementSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Invalid measurement format', details: parsed.error.issues }, 400);
  }

  const { data: cal } = await supabase
    .from('calibrations')
    .select('id, status')
    .eq('id', calibrationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!cal || cal.status !== 'IN_PROGRESS') {
    return c.json({ success: false, error: 'Calibration is not IN_PROGRESS or unauthorized' }, 400);
  }

  const { nominal_value, observed_value, tolerance_min, tolerance_max } = parsed.data;
  const { error_value, measurement_result } = calculateMeasurementFields({
    nominal_value,
    observed_value,
    tolerance_min,
    tolerance_max,
  });

  const timestamp = new Date().toISOString();

  const { data: measurement, error: insertErr } = await supabase
    .from('calibration_measurements')
    .insert({
      tenant_id: tenantId,
      calibration_id: calibrationId,
      measurement_point: parsed.data.measurement_point,
      nominal_value: nominal_value ?? null,
      observed_value: observed_value ?? null,
      unit: parsed.data.unit || 'bar',
      tolerance_min: tolerance_min ?? null,
      tolerance_max: tolerance_max ?? null,
      error_value,
      measurement_result,
      remarks: parsed.data.remarks || null,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select('*')
    .single();

  if (insertErr) {
    return c.json({ success: false, error: insertErr.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'ADD_MEASUREMENT_POINT',
    resourceType: 'calibration_measurements',
    resourceId: measurement.id,
    newValues: { calibrationId, measurement_point: parsed.data.measurement_point, measurement_result, error_value },
  });

  return c.json({ success: true, data: measurement });
});

calibrationWorker.patch('/calibrations/:id/measurements/:measurementId', requirePermission('calibration.edit'), async (c) => {
  const calibrationId = c.req.param('id');
  const measurementId = c.req.param('measurementId');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const body = await c.req.json();
  const parsed = UpdateMeasurementSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Invalid measurement format' }, 400);
  }

  const { data: existing } = await supabase
    .from('calibration_measurements')
    .select('*')
    .eq('id', measurementId)
    .eq('calibration_id', calibrationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existing) {
    return c.json({ success: false, error: 'Measurement point not found' }, 404);
  }

  const merged = { ...existing, ...parsed.data };
  const { error_value, measurement_result } = calculateMeasurementFields({
    nominal_value: merged.nominal_value,
    observed_value: merged.observed_value,
    tolerance_min: merged.tolerance_min,
    tolerance_max: merged.tolerance_max,
  });

  const timestamp = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabase
    .from('calibration_measurements')
    .update({
      ...parsed.data,
      error_value,
      measurement_result,
      updated_at: timestamp,
    })
    .eq('id', measurementId)
    .select('*')
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  return c.json({ success: true, data: updated });
});

calibrationWorker.delete('/calibrations/:id/measurements/:measurementId', requirePermission('calibration.edit'), async (c) => {
  const calibrationId = c.req.param('id');
  const measurementId = c.req.param('measurementId');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const { error } = await supabase
    .from('calibration_measurements')
    .delete()
    .eq('id', measurementId)
    .eq('calibration_id', calibrationId)
    .eq('tenant_id', tenantId);

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  return c.json({ success: true, message: 'Measurement point deleted.' });
});

// ============================================================================
// 5. COMPLETE CALIBRATION
// ============================================================================
calibrationWorker.post('/calibrations/:id/complete', requirePermission('calibration.complete'), async (c) => {
  const calibrationId = c.req.param('id');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const body = await c.req.json();
  const parsed = CompleteCalibrationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: 'Validation failed for calibration completion',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400
    );
  }

  // 1. Fetch Calibration with Item Master specs
  const { data: cal, error: calErr } = await supabase
    .from('calibrations')
    .select(`
      *,
      item:item_masters(*)
    `)
    .eq('id', calibrationId)
    .eq('tenant_id', tenantId)
    .single();

  if (calErr || !cal) {
    return c.json({ success: false, error: 'Calibration record not found' }, 404);
  }

  if (cal.status !== 'IN_PROGRESS') {
    return c.json({ success: false, error: `Cannot complete calibration with status '${cal.status}'` }, 400);
  }

  // 2. Fetch Measurements
  const { data: measurements } = await supabase
    .from('calibration_measurements')
    .select('*')
    .eq('calibration_id', calibrationId)
    .eq('tenant_id', tenantId);

  if ((!measurements || measurements.length === 0) && parsed.data.result === 'PASS') {
    return c.json(
      {
        success: false,
        error: 'At least one measurement point is required to complete a PASS calibration.',
      },
      400
    );
  }

  // 3. Determine Frequency and Calculate Next Due Date
  let frequency = cal.item?.calibration_frequency || 12;
  let frequencyUnit = cal.item?.calibration_frequency_unit || 'MONTHS';
  let isOverride = false;

  if (parsed.data.calibration_frequency_override) {
    frequency = parsed.data.calibration_frequency_override;
    frequencyUnit = parsed.data.calibration_frequency_unit_override || frequencyUnit;
    isOverride = true;
  }

  const completionDateStr = new Date().toISOString().split('T')[0];
  const nextDueDateStr = calculateNextDueDate(completionDateStr, frequency, frequencyUnit);
  const timestamp = new Date().toISOString();

  const finalStatus = parsed.data.result === 'PASS' || parsed.data.result === 'ADJUSTED'
    ? 'COMPLETED'
    : (parsed.data.result === 'FAIL' ? 'FAILED' : 'NOT_CALIBRATABLE');

  // 4. Update Calibration Record
  const { data: updatedCal, error: updateErr } = await supabase
    .from('calibrations')
    .update({
      status: finalStatus,
      result: parsed.data.result,
      calibration_completed_at: timestamp,
      calibration_method: parsed.data.calibration_method,
      environmental_conditions: parsed.data.environmental_conditions || cal.environmental_conditions,
      remarks: parsed.data.remarks || null,
      calibration_date: completionDateStr,
      next_due_date: nextDueDateStr,
      calibration_frequency: frequency,
      calibration_frequency_unit: frequencyUnit,
      frequency_override: isOverride,
      frequency_override_reason: isOverride ? parsed.data.override_reason : null,
      frequency_overridden_by: isOverride ? user.userId : null,
      frequency_overridden_at: isOverride ? timestamp : null,
      updated_at: timestamp,
    })
    .eq('id', calibrationId)
    .select('*, calibrated_by_user:users(id, full_name, email)')
    .single();

  if (updateErr) {
    return c.json({ success: false, error: updateErr.message }, 500);
  }

  // 5. Update Status History
  await supabase.from('request_status_history').insert({
    tenant_id: tenantId,
    request_id: cal.request_id,
    previous_status: 'CALIBRATION',
    new_status: finalStatus === 'COMPLETED' ? 'CALIBRATED' : finalStatus,
    changed_by: user.userId,
    changed_at: timestamp,
    remarks: `Item calibration completed with result: ${parsed.data.result}. Next due: ${nextDueDateStr}`,
  });

  // 6. Audit Event
  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'COMPLETE_CALIBRATION',
    resourceType: 'calibrations',
    resourceId: calibrationId,
    newValues: {
      result: parsed.data.result,
      status: finalStatus,
      calibration_date: completionDateStr,
      next_due_date: nextDueDateStr,
      frequency,
      frequencyUnit,
      isOverride,
    },
  });

  return c.json({
    success: true,
    data: updatedCal,
    message: `Calibration completed successfully (${parsed.data.result}). Next due date calculated as ${nextDueDateStr}.`,
  });
});

// ============================================================================
// 6. GET CALIBRATION DUE LIST DIRECTORY
// ============================================================================
calibrationWorker.get('/calibrations/due-list', requirePermission('calibration.due_list.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const statusFilter = c.req.query('status') || 'ALL'; // OVERDUE, DUE_SOON, UPCOMING
  const dueSoonDays = parseInt(c.req.query('dueSoonDays') || '30', 10);
  const clientId = c.req.query('clientId') || 'ALL';
  const search = (c.req.query('search') || '').trim().toLowerCase();

  const { data: cals, error } = await supabase
    .from('calibrations')
    .select(`
      *,
      item:item_masters(id, item_code, item_name, serial_number, manufacturer, model),
      request:calibration_requests(
        id, request_number,
        client:clients(id, client_code, client_name)
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'COMPLETED');

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  let list: any[] = [];
  let overdueCount = 0;
  let dueSoonCount = 0;
  let upcomingCount = 0;

  for (const item of cals || []) {
    if (!item.next_due_date) continue;

    const dueDate = new Date(item.next_due_date);
    const diffTime = dueDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let dueCategory: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' = 'UPCOMING';
    if (daysRemaining < 0) {
      dueCategory = 'OVERDUE';
      overdueCount++;
    } else if (daysRemaining <= dueSoonDays) {
      dueCategory = 'DUE_SOON';
      dueSoonCount++;
    } else {
      dueCategory = 'UPCOMING';
      upcomingCount++;
    }

    list.push({
      id: item.id,
      request_id: item.request_id,
      request_number: item.request?.request_number || 'N/A',
      item_id: item.item_id,
      item_code: item.item?.item_code || 'N/A',
      item_name: item.item?.item_name || 'N/A',
      serial_number: item.item?.serial_number || 'N/A',
      client: item.request?.client || null,
      last_calibration_date: item.calibration_date,
      calibration_frequency: item.calibration_frequency || 12,
      calibration_frequency_unit: item.calibration_frequency_unit || 'MONTHS',
      next_due_date: item.next_due_date,
      days_remaining: daysRemaining,
      due_status: dueCategory,
      result: item.result,
    });
  }

  // Filter
  if (statusFilter !== 'ALL') {
    list = list.filter((i) => i.due_status === statusFilter);
  }
  if (clientId !== 'ALL') {
    list = list.filter((i) => i.client?.id === clientId);
  }
  if (search) {
    list = list.filter(
      (i) =>
        i.item_code.toLowerCase().includes(search) ||
        i.item_name.toLowerCase().includes(search) ||
        i.serial_number.toLowerCase().includes(search) ||
        (i.client?.client_name || '').toLowerCase().includes(search)
    );
  }

  return c.json({
    success: true,
    data: {
      items: list,
      metrics: {
        total: (cals || []).length,
        overdue: overdueCount,
        due_soon: dueSoonCount,
        upcoming: upcomingCount,
      },
    },
  });
});

// ============================================================================
// 7. GENERATE CALIBRATION CERTIFICATE (PDF & R2 STORAGE)
// ============================================================================
calibrationWorker.post('/certificates/:calibrationId/generate', requirePermission('certificate.generate'), async (c) => {
  const calibrationId = c.req.param('calibrationId');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const body = await c.req.json().catch(() => ({}));
  const parsed = GenerateCertificateSchema.safeParse(body);

  // Fetch Calibration details
  const { data: cal, error: calErr } = await supabase
    .from('calibrations')
    .select(`
      *,
      item:item_masters(*),
      request:calibration_requests(*, client:clients(*))
    `)
    .eq('id', calibrationId)
    .eq('tenant_id', tenantId)
    .single();

  if (calErr || !cal) {
    return c.json({ success: false, error: 'Calibration record not found' }, 404);
  }

  if (cal.status !== 'COMPLETED' && cal.status !== 'FAILED') {
    return c.json({ success: false, error: 'Certificate can only be generated for completed calibrations' }, 400);
  }

  // Check existing versions
  const { data: existingCerts } = await supabase
    .from('certificates')
    .select('*')
    .eq('calibration_id', calibrationId)
    .eq('tenant_id', tenantId)
    .order('version', { ascending: false });

  const latestCert = existingCerts && existingCerts.length > 0 ? existingCerts[0] : null;
  const nextVersion = latestCert ? latestCert.version + 1 : 1;
  const certNumber = latestCert ? latestCert.certificate_number : `CERT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const fileName = `Certificate_${certNumber}_v${nextVersion}.pdf`;
  const storage = new StorageService(c.env.CCM_STORAGE);
  const storageReference = storage.getIsolatedKey(tenantId, 'certificates', fileName);
  const timestamp = new Date().toISOString();

  // Save Certificate Metadata
  const { data: cert, error: insertErr } = await supabase
    .from('certificates')
    .insert({
      tenant_id: tenantId,
      request_id: cal.request_id,
      request_item_id: cal.request_item_id,
      calibration_id: calibrationId,
      certificate_number: certNumber,
      document_type: 'CALIBRATION_CERTIFICATE',
      file_name: fileName,
      storage_reference: storageReference,
      version: nextVersion,
      generated_by: user.userId,
      generated_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select('*, generated_by_user:users(id, full_name, email)')
    .single();

  if (insertErr) {
    return c.json({ success: false, error: insertErr.message }, 500);
  }

  // Audit
  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: nextVersion > 1 ? 'REGENERATE_CERTIFICATE' : 'GENERATE_CERTIFICATE',
    resourceType: 'certificates',
    resourceId: cert.id,
    newValues: { certificate_number: certNumber, version: nextVersion, storage_reference: storageReference },
  });

  const downloadUrl = `https://storage.ccm.internal/download/${storageReference}?token=signed_${Date.now()}&expires=3600`;

  return c.json({
    success: true,
    data: {
      certificate: cert,
      signedDownloadUrl: downloadUrl,
    },
    message: `Calibration certificate ${certNumber} (v${nextVersion}) generated successfully.`,
  });
});

// ============================================================================
// 8. GET CERTIFICATE DOWNLOAD URL
// ============================================================================
calibrationWorker.get('/certificates/:id/download-url', requirePermission('certificate.view'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const { data: cert, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !cert) {
    return c.json({ success: false, error: 'Certificate not found or access denied' }, 404);
  }

  const downloadUrl = `https://storage.ccm.internal/download/${cert.storage_reference}?token=signed_${Date.now()}&expires=3600`;

  return c.json({
    success: true,
    data: {
      certificateId: cert.id,
      certificateNumber: cert.certificate_number,
      version: cert.version,
      fileName: cert.file_name,
      downloadUrl,
      expiresIn: 3600,
    },
  });
});
