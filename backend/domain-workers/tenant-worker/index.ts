import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  CreateSubOrganizationSchema,
  UpdateSubOrganizationSchema,
} from './schemas';
import { logAuditEvent } from '../../shared/audit';

type AppVariables = {
  user: AuthenticatedUser;
};

export const tenantWorker = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

// Helper to get Supabase client
function getSupabase(c: any) {
  const url = c.env.SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured in Worker environment.');
  }
  return createClient(url, key);
}

// ==========================================
// 1. TENANTS ENDPOINTS
// ==========================================

// List tenants (Super admins can list all; others can only list their own tenant)
tenantWorker.get('/tenants', async (c) => {
  const user = c.get('user');
  const supabase = getSupabase(c);

  let query = supabase.from('tenants').select('*').order('created_at', { ascending: false });

  if (user.role !== 'super_admin') {
    query = query.eq('id', user.tenantId);
  }

  const { data, error } = await query;
  if (error) return c.json({ success: false, error: error.message }, 500);

  return c.json({ success: true, data });
});

// Get single tenant
tenantWorker.get('/tenants/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const supabase = getSupabase(c);

  if (user.role !== 'super_admin' && user.tenantId !== id) {
    return c.json({ success: false, error: 'Forbidden: Cannot access another tenant' }, 403);
  }

  const { data, error } = await supabase.from('tenants').select('*').eq('id', id).single();
  if (error) return c.json({ success: false, error: error.message }, 404);

  return c.json({ success: true, data });
});

// Create tenant (Super admin only)
tenantWorker.post('/tenants', async (c) => {
  const user = c.get('user');
  if (user.role !== 'super_admin') {
    return c.json({ success: false, error: 'Forbidden: Only super admin can create tenants' }, 403);
  }

  const body = await c.req.json();
  const parsed = CreateTenantSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);
  const { data, error } = await supabase.from('tenants').insert(parsed.data).select().single();
  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: data.id,
    userId: user.userId,
    action: 'CREATE',
    resourceType: 'tenant',
    resourceId: data.id,
    newValues: data,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data }, 201);
});

// Update tenant
tenantWorker.put('/tenants/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (user.role !== 'super_admin' && user.tenantId !== id) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const parsed = UpdateTenantSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);
  const { data: oldData } = await supabase.from('tenants').select('*').eq('id', id).single();
  const { data, error } = await supabase.from('tenants').update(parsed.data).eq('id', id).select().single();
  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: id,
    userId: user.userId,
    action: 'UPDATE',
    resourceType: 'tenant',
    resourceId: id,
    oldValues: oldData,
    newValues: data,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data });
});

// ==========================================
// 2. ORGANIZATIONS ENDPOINTS
// ==========================================

// List organizations (Strictly scoped to user's tenant or requested tenant if super_admin)
tenantWorker.get('/organizations', async (c) => {
  const user = c.get('user');
  const requestedTenant = c.req.query('tenant_id') || user.tenantId;
  const effectiveTenantId = user.role === 'super_admin' ? requestedTenant : user.tenantId;

  const supabase = getSupabase(c);
  const { data, error } = await supabase
    .from('organizations')
    .select('*, sub_organizations(count)')
    .eq('tenant_id', effectiveTenantId)
    .order('created_at', { ascending: false });

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Create organization
tenantWorker.post('/organizations', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = CreateOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const effectiveTenantId = user.role === 'super_admin' && body.tenant_id ? body.tenant_id : user.tenantId;
  const supabase = getSupabase(c);

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      ...parsed.data,
      tenant_id: effectiveTenantId,
    })
    .select()
    .single();

  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: effectiveTenantId,
    userId: user.userId,
    action: 'CREATE',
    resourceType: 'organization',
    resourceId: data.id,
    newValues: data,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data }, 201);
});

// Update organization
tenantWorker.put('/organizations/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);
  // Verify tenant ownership
  const { data: existing } = await supabase.from('organizations').select('*').eq('id', id).single();
  if (!existing) return c.json({ success: false, error: 'Organization not found' }, 404);

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cannot modify organization from another tenant' }, 403);
  }

  const { data, error } = await supabase.from('organizations').update(parsed.data).eq('id', id).select().single();
  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: 'UPDATE',
    resourceType: 'organization',
    resourceId: id,
    oldValues: existing,
    newValues: data,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data });
});

// Delete organization
tenantWorker.delete('/organizations/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const supabase = getSupabase(c);

  const { data: existing } = await supabase.from('organizations').select('*').eq('id', id).single();
  if (!existing) return c.json({ success: false, error: 'Organization not found' }, 404);

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cannot delete organization from another tenant' }, 403);
  }

  const { error } = await supabase.from('organizations').delete().eq('id', id);
  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: 'DELETE',
    resourceType: 'organization',
    resourceId: id,
    oldValues: existing,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, message: 'Organization deleted successfully' });
});

// ==========================================
// 3. SUB-ORGANIZATIONS ENDPOINTS
// ==========================================

// List sub-organizations (filtered by organization_id if provided)
tenantWorker.get('/sub-organizations', async (c) => {
  const user = c.get('user');
  const orgId = c.req.query('organization_id');
  const requestedTenant = c.req.query('tenant_id') || user.tenantId;
  const effectiveTenantId = user.role === 'super_admin' ? requestedTenant : user.tenantId;

  const supabase = getSupabase(c);
  let query = supabase
    .from('sub_organizations')
    .select('*, organization:organizations(id, name, code)')
    .eq('tenant_id', effectiveTenantId)
    .order('created_at', { ascending: false });

  if (orgId) {
    query = query.eq('organization_id', orgId);
  }

  const { data, error } = await query;
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Create sub-organization
tenantWorker.post('/sub-organizations', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = CreateSubOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const effectiveTenantId = user.role === 'super_admin' && body.tenant_id ? body.tenant_id : user.tenantId;
  const supabase = getSupabase(c);

  // Validate that parent organization belongs to the exact same tenant
  const { data: parentOrg } = await supabase
    .from('organizations')
    .select('id, tenant_id')
    .eq('id', parsed.data.organization_id)
    .single();

  if (!parentOrg || parentOrg.tenant_id !== effectiveTenantId) {
    return c.json({ success: false, error: 'Parent organization does not exist in this tenant' }, 400);
  }

  const { data, error } = await supabase
    .from('sub_organizations')
    .insert({
      ...parsed.data,
      tenant_id: effectiveTenantId,
    })
    .select('*, organization:organizations(id, name, code)')
    .single();

  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: effectiveTenantId,
    userId: user.userId,
    action: 'CREATE',
    resourceType: 'sub_organization',
    resourceId: data.id,
    newValues: data,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data }, 201);
});

// Update sub-organization
tenantWorker.put('/sub-organizations/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdateSubOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);
  const { data: existing } = await supabase.from('sub_organizations').select('*').eq('id', id).single();
  if (!existing) return c.json({ success: false, error: 'Sub-organization not found' }, 404);

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cannot modify sub-organization from another tenant' }, 403);
  }

  const { data, error } = await supabase
    .from('sub_organizations')
    .update(parsed.data)
    .eq('id', id)
    .select('*, organization:organizations(id, name, code)')
    .single();

  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: 'UPDATE',
    resourceType: 'sub_organization',
    resourceId: id,
    oldValues: existing,
    newValues: data,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data });
});

// Delete sub-organization
tenantWorker.delete('/sub-organizations/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const supabase = getSupabase(c);

  const { data: existing } = await supabase.from('sub_organizations').select('*').eq('id', id).single();
  if (!existing) return c.json({ success: false, error: 'Sub-organization not found' }, 404);

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cannot delete sub-organization from another tenant' }, 403);
  }

  const { error } = await supabase.from('sub_organizations').delete().eq('id', id);
  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: 'DELETE',
    resourceType: 'sub_organization',
    resourceId: id,
    oldValues: existing,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, message: 'Sub-organization deleted successfully' });
});

// ==========================================
// 4. AUDIT LOGS QUERY ENDPOINT
// ==========================================
tenantWorker.get('/audit-logs', async (c) => {
  const user = c.get('user');
  const supabase = getSupabase(c);
  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);

  if (user.role !== 'super_admin') {
    query = query.eq('tenant_id', user.tenantId);
  }

  const { data, error } = await query;
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});
