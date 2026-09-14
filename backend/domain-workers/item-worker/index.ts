import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  CreateItemSchema,
  UpdateItemSchema,
  UpdateItemStatusSchema,
} from './schemas';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';

type AppVariables = {
  user: AuthenticatedUser;
};

export const itemWorker = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

function getSupabase(c: any) {
  const url = c.env.SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured in Worker environment.');
  }
  return createClient(url, key);
}

// ==========================================
// 1. LIST ITEMS
// ==========================================
itemWorker.get('/items', requirePermission('item.view'), async (c) => {
  const user = c.get('user');
  const search = c.req.query('search')?.toLowerCase();
  const status = c.req.query('status');
  const itemType = c.req.query('item_type');
  const manufacturer = c.req.query('manufacturer');
  const organizationId = c.req.query('organization_id');
  const subOrgId = c.req.query('sub_org_id');
  const targetTenantId =
    user.role === 'super_admin' && c.req.query('tenant_id')
      ? c.req.query('tenant_id')!
      : user.tenantId;

  const supabase = getSupabase(c);

  let query = supabase
    .from('item_masters')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      item_code,
      item_name,
      item_type,
      manufacturer,
      model,
      serial_number,
      measurement_range,
      least_count,
      standard_cost,
      calibration_frequency,
      calibration_frequency_unit,
      status,
      created_by,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .eq('tenant_id', targetTenantId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (itemType && itemType !== 'all') {
    query = query.eq('item_type', itemType);
  }
  if (manufacturer && manufacturer !== 'all') {
    query = query.eq('manufacturer', manufacturer);
  }
  if (organizationId && organizationId !== 'all') {
    query = query.eq('organization_id', organizationId);
  }
  if (subOrgId && subOrgId !== 'all') {
    query = query.eq('sub_org_id', subOrgId);
  }

  const { data, error } = await query;
  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  let filtered = data || [];

  if (search) {
    filtered = filtered.filter(
      (item: any) =>
        item.item_name?.toLowerCase().includes(search) ||
        item.item_code?.toLowerCase().includes(search) ||
        item.manufacturer?.toLowerCase().includes(search) ||
        item.model?.toLowerCase().includes(search) ||
        item.serial_number?.toLowerCase().includes(search) ||
        item.item_type?.toLowerCase().includes(search) ||
        item.measurement_range?.toLowerCase().includes(search)
    );
  }

  return c.json({ success: true, data: filtered });
});

// ==========================================
// 2. CREATE ITEM
// ==========================================
itemWorker.post('/items', requirePermission('item.create'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = CreateItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const targetTenantId =
    user.role === 'super_admin' && body.tenant_id ? body.tenant_id : user.tenantId;
  const supabase = getSupabase(c);

  // Check unique item_code in tenant
  const { data: existingCode } = await supabase
    .from('item_masters')
    .select('id')
    .eq('tenant_id', targetTenantId)
    .ilike('item_code', parsed.data.item_code.trim())
    .maybeSingle();

  if (existingCode) {
    return c.json(
      {
        success: false,
        error: `Item code "${parsed.data.item_code}" already exists in this tenant. Item codes must be unique per tenant.`,
      },
      400
    );
  }

  // Check unique serial number within tenant if provided
  if (parsed.data.serial_number && parsed.data.serial_number.trim()) {
    const { data: existingSerial } = await supabase
      .from('item_masters')
      .select('id, item_code')
      .eq('tenant_id', targetTenantId)
      .eq('serial_number', parsed.data.serial_number.trim())
      .maybeSingle();

    if (existingSerial) {
      return c.json(
        {
          success: false,
          error: `Serial number "${parsed.data.serial_number}" already exists on item "${existingSerial.item_code}". Serial numbers should be unique per tenant.`,
        },
        400
      );
    }
  }

  const itemData = {
    tenant_id: targetTenantId,
    item_code: parsed.data.item_code.trim().toUpperCase(),
    item_name: parsed.data.item_name.trim(),
    item_type: parsed.data.item_type?.trim() || null,
    manufacturer: parsed.data.manufacturer?.trim() || null,
    model: parsed.data.model?.trim() || null,
    serial_number: parsed.data.serial_number?.trim() || null,
    measurement_range: parsed.data.measurement_range?.trim() || null,
    least_count: parsed.data.least_count?.trim() || null,
    standard_cost: parsed.data.standard_cost,
    calibration_frequency: parsed.data.calibration_frequency,
    calibration_frequency_unit: parsed.data.calibration_frequency_unit,
    organization_id: parsed.data.organization_id || null,
    sub_org_id: parsed.data.sub_org_id || null,
    status: parsed.data.status,
    created_by: user.userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: newItem, error: insertError } = await supabase
    .from('item_masters')
    .insert(itemData)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      item_code,
      item_name,
      item_type,
      manufacturer,
      model,
      serial_number,
      measurement_range,
      least_count,
      standard_cost,
      calibration_frequency,
      calibration_frequency_unit,
      status,
      created_by,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .single();

  if (insertError) {
    return c.json({ success: false, error: insertError.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId: targetTenantId,
    userId: user.userId,
    action: 'CREATE_ITEM',
    resourceType: 'item_masters',
    resourceId: newItem.id,
    newValues: {
      item_code: newItem.item_code,
      item_name: newItem.item_name,
      manufacturer: newItem.manufacturer,
      model: newItem.model,
      serial_number: newItem.serial_number,
      status: newItem.status,
    },
    ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
  });

  return c.json({ success: true, data: newItem }, 201);
});

// ==========================================
// 3. GET ITEM BY ID
// ==========================================
itemWorker.get('/items/:id', requirePermission('item.view'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const targetTenantId =
    user.role === 'super_admin' && c.req.query('tenant_id')
      ? c.req.query('tenant_id')!
      : user.tenantId;

  const supabase = getSupabase(c);

  const { data: item, error } = await supabase
    .from('item_masters')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      item_code,
      item_name,
      item_type,
      manufacturer,
      model,
      serial_number,
      measurement_range,
      least_count,
      standard_cost,
      calibration_frequency,
      calibration_frequency_unit,
      status,
      created_by,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .eq('id', id)
    .eq('tenant_id', targetTenantId)
    .maybeSingle();

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
  if (!item) {
    return c.json({ success: false, error: 'Item master not found or access denied.' }, 404);
  }

  return c.json({ success: true, data: item });
});

// ==========================================
// 4. UPDATE ITEM
// ==========================================
itemWorker.put('/items/:id', requirePermission('item.edit'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const targetTenantId =
    user.role === 'super_admin' && body.tenant_id ? body.tenant_id : user.tenantId;
  const supabase = getSupabase(c);

  // Fetch existing item
  const { data: existing, error: fetchErr } = await supabase
    .from('item_masters')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', targetTenantId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return c.json({ success: false, error: 'Item not found or access denied.' }, 404);
  }

  // Check duplicate item code if being modified
  if (parsed.data.item_code && parsed.data.item_code.trim().toUpperCase() !== existing.item_code) {
    const { data: dup } = await supabase
      .from('item_masters')
      .select('id')
      .eq('tenant_id', targetTenantId)
      .ilike('item_code', parsed.data.item_code.trim())
      .neq('id', id)
      .maybeSingle();

    if (dup) {
      return c.json(
        {
          success: false,
          error: `Item code "${parsed.data.item_code}" already exists in this tenant.`,
        },
        400
      );
    }
  }

  // Check duplicate serial number if being modified
  if (parsed.data.serial_number && parsed.data.serial_number.trim() !== (existing.serial_number || '')) {
    const { data: dupSerial } = await supabase
      .from('item_masters')
      .select('id, item_code')
      .eq('tenant_id', targetTenantId)
      .eq('serial_number', parsed.data.serial_number.trim())
      .neq('id', id)
      .maybeSingle();

    if (dupSerial) {
      return c.json(
        {
          success: false,
          error: `Serial number "${parsed.data.serial_number}" is already registered on item "${dupSerial.item_code}".`,
        },
        400
      );
    }
  }

  const updateData: any = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.item_code) {
    updateData.item_code = parsed.data.item_code.trim().toUpperCase();
  }

  const { data: updatedItem, error: updateError } = await supabase
    .from('item_masters')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', targetTenantId)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      item_code,
      item_name,
      item_type,
      manufacturer,
      model,
      serial_number,
      measurement_range,
      least_count,
      standard_cost,
      calibration_frequency,
      calibration_frequency_unit,
      status,
      created_by,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .single();

  if (updateError) {
    return c.json({ success: false, error: updateError.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId: targetTenantId,
    userId: user.userId,
    action: 'UPDATE_ITEM',
    resourceType: 'item_masters',
    resourceId: id as string,
    oldValues: {
      item_code: existing.item_code,
      item_name: existing.item_name,
      standard_cost: existing.standard_cost,
      status: existing.status,
    },
    newValues: {
      item_code: updatedItem.item_code,
      item_name: updatedItem.item_name,
      standard_cost: updatedItem.standard_cost,
      status: updatedItem.status,
    },
    ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
  });

  return c.json({ success: true, data: updatedItem });
});

// ==========================================
// 5. UPDATE ITEM STATUS (ACTIVATE / DEACTIVATE)
// ==========================================
itemWorker.patch('/items/:id/status', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateItemStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const { status } = parsed.data;
  const requiredPerm = status === 'active' ? 'item.activate' : 'item.deactivate';
  if (user.role !== 'super_admin' && !user.permissions.includes(requiredPerm) && !user.permissions.includes('*')) {
    return c.json(
      {
        success: false,
        error: `Forbidden: Missing required permission [${requiredPerm}] to change item status.`,
      },
      403
    );
  }

  const targetTenantId =
    user.role === 'super_admin' && body.tenant_id ? body.tenant_id : user.tenantId;
  const supabase = getSupabase(c);

  const { data: updatedItem, error } = await supabase
    .from('item_masters')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', targetTenantId)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      item_code,
      item_name,
      item_type,
      manufacturer,
      model,
      serial_number,
      measurement_range,
      least_count,
      standard_cost,
      calibration_frequency,
      calibration_frequency_unit,
      status,
      created_by,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .single();

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId: targetTenantId,
    userId: user.userId,
    action: status === 'active' ? 'ACTIVATE_ITEM' : 'DEACTIVATE_ITEM',
    resourceType: 'item_masters',
    resourceId: id as string,
    newValues: { status },
    ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
  });

  return c.json({ success: true, data: updatedItem });
});

// ==========================================
// 6. DELETE ITEM
// ==========================================
itemWorker.delete('/items/:id', requirePermission('item.delete'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id') as string;
  const targetTenantId =
    user.role === 'super_admin' && c.req.query('tenant_id')
      ? c.req.query('tenant_id')!
      : user.tenantId;

  const supabase = getSupabase(c);

  const { data: existing, error: fetchErr } = await supabase
    .from('item_masters')
    .select('id, item_code, item_name')
    .eq('id', id)
    .eq('tenant_id', targetTenantId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return c.json({ success: false, error: 'Item not found or access denied.' }, 404);
  }

  const { error: deleteErr } = await supabase
    .from('item_masters')
    .delete()
    .eq('id', id)
    .eq('tenant_id', targetTenantId);

  if (deleteErr) {
    return c.json({ success: false, error: deleteErr.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId: targetTenantId,
    userId: user.userId,
    action: 'DELETE_ITEM',
    resourceType: 'item_masters',
    resourceId: id,
    oldValues: existing,
    newValues: null,
    ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
  });

  return c.json({ success: true, message: `Item "${existing.item_code}" deleted successfully.` });
});
