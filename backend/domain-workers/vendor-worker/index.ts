import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  CreateVendorSchema,
  UpdateVendorSchema,
  UpdateVendorStatusSchema,
} from './schemas';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';

type AppVariables = {
  user: AuthenticatedUser;
};

export const vendorWorker = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

function getSupabase(c: any) {
  const url = c.env.SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured in Worker environment.');
  }
  return createClient(url, key);
}

// ==========================================
// 1. LIST VENDORS
// ==========================================
vendorWorker.get('/vendors', requirePermission('vendor.view'), async (c) => {
  const user = c.get('user');
  const search = c.req.query('search')?.toLowerCase();
  const status = c.req.query('status');
  const organizationId = c.req.query('organization_id');
  const subOrgId = c.req.query('sub_org_id');
  const category = c.req.query('category');
  const targetTenantId =
    user.role === 'super_admin' && c.req.query('tenant_id')
      ? c.req.query('tenant_id')!
      : user.tenantId;

  const supabase = getSupabase(c);

  let query = supabase
    .from('vendors')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      vendor_code,
      vendor_name,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      gst_number,
      contact_person,
      contact_email,
      contact_phone,
      serviced_categories,
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

  if (category && category !== 'all') {
    filtered = filtered.filter((v: any) =>
      Array.isArray(v.serviced_categories) && v.serviced_categories.includes(category)
    );
  }

  if (search) {
    filtered = filtered.filter(
      (v: any) =>
        v.vendor_name?.toLowerCase().includes(search) ||
        v.vendor_code?.toLowerCase().includes(search) ||
        v.contact_person?.toLowerCase().includes(search) ||
        v.contact_email?.toLowerCase().includes(search) ||
        v.city?.toLowerCase().includes(search) ||
        v.gst_number?.toLowerCase().includes(search) ||
        (Array.isArray(v.serviced_categories) &&
          v.serviced_categories.some((cat: string) => cat.toLowerCase().includes(search)))
    );
  }

  return c.json({ success: true, data: filtered });
});

// ==========================================
// 2. CREATE VENDOR
// ==========================================
vendorWorker.post('/vendors', requirePermission('vendor.create'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = CreateVendorSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const targetTenantId =
    user.role === 'super_admin' && body.tenant_id ? body.tenant_id : user.tenantId;
  const supabase = getSupabase(c);

  // Check unique vendor_code in tenant
  const { data: existingCode } = await supabase
    .from('vendors')
    .select('id')
    .eq('tenant_id', targetTenantId)
    .ilike('vendor_code', parsed.data.vendor_code.trim())
    .maybeSingle();

  if (existingCode) {
    return c.json(
      {
        success: false,
        error: `Vendor code "${parsed.data.vendor_code}" already exists in this tenant. Vendor codes must be unique per tenant.`,
      },
      400
    );
  }

  const vendorData = {
    tenant_id: targetTenantId,
    vendor_code: parsed.data.vendor_code.trim().toUpperCase(),
    vendor_name: parsed.data.vendor_name.trim(),
    contact_person: parsed.data.contact_person?.trim() || null,
    contact_email: parsed.data.contact_email?.trim() || null,
    contact_phone: parsed.data.contact_phone?.trim() || null,
    address_line_1: parsed.data.address_line_1?.trim() || null,
    address_line_2: parsed.data.address_line_2?.trim() || null,
    city: parsed.data.city?.trim() || null,
    state: parsed.data.state?.trim() || null,
    country: parsed.data.country?.trim() || 'India',
    postal_code: parsed.data.postal_code?.trim() || null,
    gst_number: parsed.data.gst_number?.trim() || null,
    serviced_categories: parsed.data.serviced_categories || [],
    organization_id: parsed.data.organization_id || null,
    sub_org_id: parsed.data.sub_org_id || null,
    status: parsed.data.status || 'active',
    created_by: user.userId !== 'usr-dev-session' && user.userId !== 'usr-dev-demo' ? user.userId : null,
  };

  const { data: newVendor, error } = await supabase
    .from('vendors')
    .insert(vendorData)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      vendor_code,
      vendor_name,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      gst_number,
      contact_person,
      contact_email,
      contact_phone,
      serviced_categories,
      status,
      created_by,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .single();

  if (error) {
    return c.json({ success: false, error: error.message }, 400);
  }

  // Audit Log
  await logAuditEvent(supabase, {
    tenantId: targetTenantId,
    userId: user.userId,
    action: 'CREATE_VENDOR',
    resourceType: 'vendors',
    resourceId: newVendor.id,
    newValues: newVendor,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: newVendor }, 201);
});

// ==========================================
// 3. GET SINGLE VENDOR
// ==========================================
vendorWorker.get('/vendors/:id', requirePermission('vendor.view'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const supabase = getSupabase(c);

  let query = supabase
    .from('vendors')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      vendor_code,
      vendor_name,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      gst_number,
      contact_person,
      contact_email,
      contact_phone,
      serviced_categories,
      status,
      created_by,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .eq('id', targetId);

  if (user.role !== 'super_admin') {
    query = query.eq('tenant_id', user.tenantId);
  }

  const { data, error } = await query.single();
  if (error || !data) {
    return c.json({ success: false, error: 'Vendor not found or access denied' }, 404);
  }

  return c.json({ success: true, data });
});

// ==========================================
// 4. UPDATE VENDOR
// ==========================================
vendorWorker.put('/vendors/:id', requirePermission('vendor.edit'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const body = await c.req.json();
  const parsed = UpdateVendorSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);

  const { data: existing } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', targetId)
    .single();

  if (!existing) {
    return c.json({ success: false, error: 'Vendor not found' }, 404);
  }

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cross-tenant modification denied' }, 403);
  }

  // Check unique vendor code if updated
  if (parsed.data.vendor_code && parsed.data.vendor_code !== existing.vendor_code) {
    const { data: dupCode } = await supabase
      .from('vendors')
      .select('id')
      .eq('tenant_id', existing.tenant_id)
      .ilike('vendor_code', parsed.data.vendor_code.trim())
      .neq('id', targetId)
      .maybeSingle();

    if (dupCode) {
      return c.json(
        {
          success: false,
          error: `Vendor code "${parsed.data.vendor_code}" already exists in this tenant.`,
        },
        400
      );
    }
  }

  const updatePayload: Record<string, any> = {};
  if (parsed.data.vendor_code !== undefined) updatePayload.vendor_code = parsed.data.vendor_code.trim().toUpperCase();
  if (parsed.data.vendor_name !== undefined) updatePayload.vendor_name = parsed.data.vendor_name.trim();
  if (parsed.data.contact_person !== undefined) updatePayload.contact_person = parsed.data.contact_person?.trim() || null;
  if (parsed.data.contact_email !== undefined) updatePayload.contact_email = parsed.data.contact_email?.trim() || null;
  if (parsed.data.contact_phone !== undefined) updatePayload.contact_phone = parsed.data.contact_phone?.trim() || null;
  if (parsed.data.address_line_1 !== undefined) updatePayload.address_line_1 = parsed.data.address_line_1?.trim() || null;
  if (parsed.data.address_line_2 !== undefined) updatePayload.address_line_2 = parsed.data.address_line_2?.trim() || null;
  if (parsed.data.city !== undefined) updatePayload.city = parsed.data.city?.trim() || null;
  if (parsed.data.state !== undefined) updatePayload.state = parsed.data.state?.trim() || null;
  if (parsed.data.country !== undefined) updatePayload.country = parsed.data.country?.trim() || 'India';
  if (parsed.data.postal_code !== undefined) updatePayload.postal_code = parsed.data.postal_code?.trim() || null;
  if (parsed.data.gst_number !== undefined) updatePayload.gst_number = parsed.data.gst_number?.trim() || null;
  if (parsed.data.serviced_categories !== undefined) updatePayload.serviced_categories = parsed.data.serviced_categories;
  if (parsed.data.organization_id !== undefined) updatePayload.organization_id = parsed.data.organization_id || null;
  if (parsed.data.sub_org_id !== undefined) updatePayload.sub_org_id = parsed.data.sub_org_id || null;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;

  const { data: updated, error } = await supabase
    .from('vendors')
    .update(updatePayload)
    .eq('id', targetId)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      vendor_code,
      vendor_name,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      gst_number,
      contact_person,
      contact_email,
      contact_phone,
      serviced_categories,
      status,
      created_by,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .single();

  if (error) {
    return c.json({ success: false, error: error.message }, 400);
  }

  // Audit Log
  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: 'UPDATE_VENDOR',
    resourceType: 'vendors',
    resourceId: targetId,
    oldValues: existing,
    newValues: updated,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: updated });
});

// ==========================================
// 5. UPDATE VENDOR STATUS
// ==========================================
vendorWorker.patch('/vendors/:id/status', async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const body = await c.req.json();
  const parsed = UpdateVendorStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const newStatus = parsed.data.status;
  const requiredPermission = newStatus === 'active' ? 'vendor.activate' : 'vendor.deactivate';

  const hasPermission =
    user.role === 'super_admin' ||
    user.permissions.includes('*') ||
    user.permissions.includes(requiredPermission);

  if (!hasPermission) {
    return c.json(
      {
        success: false,
        error: `Forbidden: Missing required permission '${requiredPermission}'`,
      },
      403
    );
  }

  const supabase = getSupabase(c);

  const { data: existing } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', targetId)
    .single();

  if (!existing) {
    return c.json({ success: false, error: 'Vendor not found' }, 404);
  }

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cross-tenant modification denied' }, 403);
  }

  const { data: updated, error } = await supabase
    .from('vendors')
    .update({ status: newStatus })
    .eq('id', targetId)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      vendor_code,
      vendor_name,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      gst_number,
      contact_person,
      contact_email,
      contact_phone,
      serviced_categories,
      status,
      created_by,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .single();

  if (error) {
    return c.json({ success: false, error: error.message }, 400);
  }

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: newStatus === 'active' ? 'ACTIVATE_VENDOR' : 'DEACTIVATE_VENDOR',
    resourceType: 'vendors',
    resourceId: targetId,
    oldValues: { status: existing.status },
    newValues: { status: newStatus },
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: updated });
});

// ==========================================
// 6. DELETE VENDOR
// ==========================================
vendorWorker.delete('/vendors/:id', requirePermission('vendor.delete'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const supabase = getSupabase(c);

  const { data: existing } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', targetId)
    .single();

  if (!existing) {
    return c.json({ success: false, error: 'Vendor not found' }, 404);
  }

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cross-tenant deletion denied' }, 403);
  }

  const { error } = await supabase.from('vendors').delete().eq('id', targetId);
  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: 'DELETE_VENDOR',
    resourceType: 'vendors',
    resourceId: targetId,
    oldValues: existing,
    newValues: null,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, message: 'Vendor deleted successfully' });
});
