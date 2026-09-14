import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  CreateClientSchema,
  UpdateClientSchema,
  UpdateClientStatusSchema,
} from './schemas';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';

type AppVariables = {
  user: AuthenticatedUser;
};

export const clientWorker = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

function getSupabase(c: any) {
  const url = c.env.SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured in Worker environment.');
  }
  return createClient(url, key);
}

// ==========================================
// 1. LIST CLIENTS
// ==========================================
clientWorker.get('/clients', requirePermission('client.view'), async (c) => {
  const user = c.get('user');
  const search = c.req.query('search')?.toLowerCase();
  const status = c.req.query('status');
  const organizationId = c.req.query('organization_id');
  const subOrgId = c.req.query('sub_org_id');
  const targetTenantId =
    user.role === 'super_admin' && c.req.query('tenant_id')
      ? c.req.query('tenant_id')!
      : user.tenantId;

  const supabase = getSupabase(c);

  let query = supabase
    .from('clients')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      client_code,
      client_name,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      billing_address,
      gst_number,
      contact_person,
      contact_email,
      contact_phone,
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
  if (search) {
    filtered = filtered.filter(
      (cl: any) =>
        cl.client_name?.toLowerCase().includes(search) ||
        cl.client_code?.toLowerCase().includes(search) ||
        cl.contact_person?.toLowerCase().includes(search) ||
        cl.contact_email?.toLowerCase().includes(search) ||
        cl.city?.toLowerCase().includes(search) ||
        cl.gst_number?.toLowerCase().includes(search)
    );
  }

  return c.json({ success: true, data: filtered });
});

// ==========================================
// 2. CREATE CLIENT
// ==========================================
clientWorker.post('/clients', requirePermission('client.create'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = CreateClientSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const targetTenantId =
    user.role === 'super_admin' && body.tenant_id ? body.tenant_id : user.tenantId;
  const supabase = getSupabase(c);

  // Check unique client_code in tenant
  const { data: existingCode } = await supabase
    .from('clients')
    .select('id')
    .eq('tenant_id', targetTenantId)
    .ilike('client_code', parsed.data.client_code.trim())
    .maybeSingle();

  if (existingCode) {
    return c.json(
      {
        success: false,
        error: `Client code "${parsed.data.client_code}" already exists in this tenant. Client codes must be unique per tenant.`,
      },
      400
    );
  }

  const clientData = {
    tenant_id: targetTenantId,
    client_code: parsed.data.client_code.trim().toUpperCase(),
    client_name: parsed.data.client_name.trim(),
    contact_person: parsed.data.contact_person?.trim() || null,
    contact_email: parsed.data.contact_email?.trim() || null,
    contact_phone: parsed.data.contact_phone?.trim() || null,
    address_line_1: parsed.data.address_line_1?.trim() || null,
    address_line_2: parsed.data.address_line_2?.trim() || null,
    city: parsed.data.city?.trim() || null,
    state: parsed.data.state?.trim() || null,
    country: parsed.data.country?.trim() || 'India',
    postal_code: parsed.data.postal_code?.trim() || null,
    billing_address: parsed.data.billing_address?.trim() || null,
    gst_number: parsed.data.gst_number?.trim() || null,
    organization_id: parsed.data.organization_id || null,
    sub_org_id: parsed.data.sub_org_id || null,
    status: parsed.data.status || 'active',
    created_by: user.userId !== 'usr-dev-session' && user.userId !== 'usr-dev-demo' ? user.userId : null,
  };

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert(clientData)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      client_code,
      client_name,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      billing_address,
      gst_number,
      contact_person,
      contact_email,
      contact_phone,
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
    action: 'CREATE_CLIENT',
    resourceType: 'clients',
    resourceId: newClient.id,
    newValues: newClient,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: newClient }, 201);
});

// ==========================================
// 3. GET SINGLE CLIENT
// ==========================================
clientWorker.get('/clients/:id', requirePermission('client.view'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const supabase = getSupabase(c);

  let query = supabase
    .from('clients')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      client_code,
      client_name,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      billing_address,
      gst_number,
      contact_person,
      contact_email,
      contact_phone,
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
    return c.json({ success: false, error: 'Client not found or access denied' }, 404);
  }

  return c.json({ success: true, data });
});

// ==========================================
// 4. UPDATE CLIENT
// ==========================================
clientWorker.put('/clients/:id', requirePermission('client.edit'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const body = await c.req.json();
  const parsed = UpdateClientSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);

  // Fetch existing record to check ownership
  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .eq('id', targetId)
    .single();

  if (!existing) {
    return c.json({ success: false, error: 'Client not found' }, 404);
  }

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cross-tenant modification denied' }, 403);
  }

  // Check unique client code if updated
  if (parsed.data.client_code && parsed.data.client_code !== existing.client_code) {
    const { data: dupCode } = await supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', existing.tenant_id)
      .ilike('client_code', parsed.data.client_code.trim())
      .neq('id', targetId)
      .maybeSingle();

    if (dupCode) {
      return c.json(
        {
          success: false,
          error: `Client code "${parsed.data.client_code}" already exists in this tenant.`,
        },
        400
      );
    }
  }

  const updatePayload: Record<string, any> = {};
  if (parsed.data.client_code !== undefined) updatePayload.client_code = parsed.data.client_code.trim().toUpperCase();
  if (parsed.data.client_name !== undefined) updatePayload.client_name = parsed.data.client_name.trim();
  if (parsed.data.contact_person !== undefined) updatePayload.contact_person = parsed.data.contact_person?.trim() || null;
  if (parsed.data.contact_email !== undefined) updatePayload.contact_email = parsed.data.contact_email?.trim() || null;
  if (parsed.data.contact_phone !== undefined) updatePayload.contact_phone = parsed.data.contact_phone?.trim() || null;
  if (parsed.data.address_line_1 !== undefined) updatePayload.address_line_1 = parsed.data.address_line_1?.trim() || null;
  if (parsed.data.address_line_2 !== undefined) updatePayload.address_line_2 = parsed.data.address_line_2?.trim() || null;
  if (parsed.data.city !== undefined) updatePayload.city = parsed.data.city?.trim() || null;
  if (parsed.data.state !== undefined) updatePayload.state = parsed.data.state?.trim() || null;
  if (parsed.data.country !== undefined) updatePayload.country = parsed.data.country?.trim() || 'India';
  if (parsed.data.postal_code !== undefined) updatePayload.postal_code = parsed.data.postal_code?.trim() || null;
  if (parsed.data.billing_address !== undefined) updatePayload.billing_address = parsed.data.billing_address?.trim() || null;
  if (parsed.data.gst_number !== undefined) updatePayload.gst_number = parsed.data.gst_number?.trim() || null;
  if (parsed.data.organization_id !== undefined) updatePayload.organization_id = parsed.data.organization_id || null;
  if (parsed.data.sub_org_id !== undefined) updatePayload.sub_org_id = parsed.data.sub_org_id || null;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;

  const { data: updated, error } = await supabase
    .from('clients')
    .update(updatePayload)
    .eq('id', targetId)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      client_code,
      client_name,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      billing_address,
      gst_number,
      contact_person,
      contact_email,
      contact_phone,
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
    action: 'UPDATE_CLIENT',
    resourceType: 'clients',
    resourceId: targetId,
    oldValues: existing,
    newValues: updated,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: updated });
});

// ==========================================
// 5. UPDATE CLIENT STATUS
// ==========================================
clientWorker.patch('/clients/:id/status', async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const body = await c.req.json();
  const parsed = UpdateClientStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const newStatus = parsed.data.status;
  const requiredPermission = newStatus === 'active' ? 'client.activate' : 'client.deactivate';

  // Permission check
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
    .from('clients')
    .select('*')
    .eq('id', targetId)
    .single();

  if (!existing) {
    return c.json({ success: false, error: 'Client not found' }, 404);
  }

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cross-tenant modification denied' }, 403);
  }

  const { data: updated, error } = await supabase
    .from('clients')
    .update({ status: newStatus })
    .eq('id', targetId)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_org_id,
      client_code,
      client_name,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      billing_address,
      gst_number,
      contact_person,
      contact_email,
      contact_phone,
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
    action: newStatus === 'active' ? 'ACTIVATE_CLIENT' : 'DEACTIVATE_CLIENT',
    resourceType: 'clients',
    resourceId: targetId,
    oldValues: { status: existing.status },
    newValues: { status: newStatus },
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: updated });
});

// ==========================================
// 6. DELETE CLIENT
// ==========================================
clientWorker.delete('/clients/:id', requirePermission('client.delete'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const supabase = getSupabase(c);

  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .eq('id', targetId)
    .single();

  if (!existing) {
    return c.json({ success: false, error: 'Client not found' }, 404);
  }

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cross-tenant deletion denied' }, 403);
  }

  const { error } = await supabase.from('clients').delete().eq('id', targetId);
  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: 'DELETE_CLIENT',
    resourceType: 'clients',
    resourceId: targetId,
    oldValues: existing,
    newValues: null,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, message: 'Client deleted successfully' });
});

// ==========================================
// 7. GET CLIENT QUOTATION HISTORY
// ==========================================
clientWorker.get('/clients/:id/quotation-history', requirePermission('client.view'), async (c) => {
  const user = c.get('user');
  const clientId = c.req.param('id');
  const supabase = getSupabase(c);

  const { data: qtns, error } = await supabase
    .from('quotations')
    .select(`
      id,
      quotation_number,
      quotation_type,
      quotation_date,
      valid_until,
      status,
      total_amount,
      currency,
      created_by,
      created_at
    `)
    .eq('client_id', clientId)
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  return c.json({ success: true, data: qtns || [] });
});

// ==========================================
// 8. GET CLIENT COMPLETE HISTORY ROLL-UP
// ==========================================
clientWorker.get('/clients/:id/history', requirePermission('client.view'), async (c) => {
  const user = c.get('user');
  const clientId = c.req.param('id');
  const supabase = getSupabase(c);

  const [reqRes, qtnRes, invRes] = await Promise.all([
    supabase
      .from('calibration_requests')
      .select('id, request_number, created_at, status, priority')
      .eq('client_id', clientId)
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false }),

    supabase
      .from('quotations')
      .select('id, quotation_number, quotation_type, quotation_date, status, total_amount, currency')
      .eq('client_id', clientId)
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false }),

    supabase
      .from('invoices')
      .select('id, invoice_number, invoice_type, invoice_date, status, total_amount, currency')
      .eq('client_id', clientId)
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false }),
  ]);

  return c.json({
    success: true,
    data: {
      requests: reqRes.data || [],
      quotations: qtnRes.data || [],
      invoices: invRes.data || [],
    },
  });
});
