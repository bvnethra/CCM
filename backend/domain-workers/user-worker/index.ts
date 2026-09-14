import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  CreateUserSchema,
  UpdateUserSchema,
  UpdateUserStatusSchema,
  AssignUserRolesSchema,
} from './schemas';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';

type AppVariables = {
  user: AuthenticatedUser;
};

export const userWorker = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

function getSupabase(c: any) {
  const url = c.env.SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured in Worker environment.');
  }
  return createClient(url, key);
}

// ==========================================
// 1. LIST USERS
// ==========================================
userWorker.get('/users', requirePermission('user.view'), async (c) => {
  const user = c.get('user');
  const search = c.req.query('search')?.toLowerCase();
  const status = c.req.query('status');
  const role = c.req.query('role');
  const organizationId = c.req.query('organization_id');
  const targetTenantId = user.role === 'super_admin' && c.req.query('tenant_id') ? c.req.query('tenant_id')! : user.tenantId;

  const supabase = getSupabase(c);

  let query = supabase
    .from('user_profiles')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_organization_id,
      full_name,
      email,
      phone,
      role,
      status,
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
  if (role && role !== 'all') {
    query = query.eq('role', role);
  }
  if (organizationId && organizationId !== 'all') {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;
  if (error) return c.json({ success: false, error: error.message }, 500);

  let filtered = data || [];
  if (search) {
    filtered = filtered.filter(
      (u: any) =>
        u.full_name?.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search) ||
        u.phone?.toLowerCase().includes(search)
    );
  }

  return c.json({ success: true, data: filtered });
});

// ==========================================
// 2. CREATE USER
// ==========================================
userWorker.post('/users', requirePermission('user.create'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const targetTenantId = user.role === 'super_admin' && body.tenant_id ? body.tenant_id : user.tenantId;
  const supabase = getSupabase(c);

  // Validate Organization belongs to tenant if provided
  if (parsed.data.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, tenant_id')
      .eq('id', parsed.data.organization_id)
      .single();

    if (!org || org.tenant_id !== targetTenantId) {
      return c.json({ success: false, error: 'Specified organization does not belong to this tenant' }, 400);
    }
  }

  // Validate Sub-Organization belongs to tenant and org if provided
  if (parsed.data.sub_organization_id) {
    const { data: subOrg } = await supabase
      .from('sub_organizations')
      .select('id, tenant_id, organization_id')
      .eq('id', parsed.data.sub_organization_id)
      .single();

    if (!subOrg || subOrg.tenant_id !== targetTenantId) {
      return c.json({ success: false, error: 'Specified sub-organization does not belong to this tenant' }, 400);
    }
    if (parsed.data.organization_id && subOrg.organization_id !== parsed.data.organization_id) {
      return c.json({ success: false, error: 'Sub-organization does not match the parent organization' }, 400);
    }
  }

  // Create auth user or simulated profile
  const userId = crypto.randomUUID();

  const profilePayload = {
    id: userId,
    tenant_id: targetTenantId,
    organization_id: parsed.data.organization_id || null,
    sub_organization_id: parsed.data.sub_organization_id || null,
    full_name: parsed.data.full_name,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone || null,
    role: parsed.data.role,
    status: parsed.data.status,
  };

  const { data: createdUser, error: insertError } = await supabase
    .from('user_profiles')
    .insert(profilePayload)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_organization_id,
      full_name,
      email,
      phone,
      role,
      status,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .single();

  if (insertError) {
    return c.json({ success: false, error: insertError.message }, 400);
  }

  // Assign roles if specified
  if (parsed.data.role_ids && parsed.data.role_ids.length > 0) {
    const roleMappings = parsed.data.role_ids.map((rId) => ({
      user_id: userId,
      role_id: rId,
      tenant_id: targetTenantId,
    }));
    await supabase.from('user_roles').insert(roleMappings);
  }

  await logAuditEvent(supabase, {
    tenantId: targetTenantId,
    userId: user.userId,
    action: 'CREATE_USER',
    resourceType: 'user',
    resourceId: userId,
    newValues: {
      email: parsed.data.email,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      organization_id: parsed.data.organization_id,
    },
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: createdUser }, 201);
});

// ==========================================
// 3. GET SINGLE USER
// ==========================================
userWorker.get('/users/:id', requirePermission('user.view'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const supabase = getSupabase(c);

  let query = supabase
    .from('user_profiles')
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_organization_id,
      full_name,
      email,
      phone,
      role,
      status,
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
  if (error || !data) return c.json({ success: false, error: 'User not found or access denied' }, 404);

  // Fetch assigned roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role:roles(id, name, code, description, is_system)')
    .eq('user_id', targetId);

  return c.json({
    success: true,
    data: {
      ...data,
      roles: userRoles ? userRoles.map((ur: any) => ur.role) : [],
    },
  });
});

// ==========================================
// 4. UPDATE USER
// ==========================================
userWorker.put('/users/:id', requirePermission('user.edit'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const body = await c.req.json();
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);

  // Verify tenant ownership
  const { data: existing } = await supabase.from('user_profiles').select('*').eq('id', targetId).single();
  if (!existing) return c.json({ success: false, error: 'User not found' }, 404);

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cannot modify user from another tenant' }, 403);
  }

  // Update profile
  const { data: updated, error } = await supabase
    .from('user_profiles')
    .update(parsed.data)
    .eq('id', targetId)
    .select(`
      id,
      tenant_id,
      organization_id,
      sub_organization_id,
      full_name,
      email,
      phone,
      role,
      status,
      created_at,
      updated_at,
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code)
    `)
    .single();

  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: 'UPDATE_USER',
    resourceType: 'user',
    resourceId: targetId,
    oldValues: existing,
    newValues: updated,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: updated });
});

// ==========================================
// 5. UPDATE USER STATUS (ACTIVATE / DEACTIVATE)
// ==========================================
userWorker.patch('/users/:id/status', requirePermission('user.status'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const body = await c.req.json();
  const parsed = UpdateUserStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);
  const { data: existing } = await supabase.from('user_profiles').select('*').eq('id', targetId).single();
  if (!existing) return c.json({ success: false, error: 'User not found' }, 404);

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cannot modify user from another tenant' }, 403);
  }

  const { data: updated, error } = await supabase
    .from('user_profiles')
    .update({ status: parsed.data.status })
    .eq('id', targetId)
    .select()
    .single();

  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: 'UPDATE_USER_STATUS',
    resourceType: 'user',
    resourceId: targetId,
    oldValues: { status: existing.status },
    newValues: { status: parsed.data.status },
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: updated });
});

// ==========================================
// 6. USER ROLE ASSIGNMENT
// ==========================================
userWorker.get('/users/:id/roles', requirePermission('role.view'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const supabase = getSupabase(c);

  const { data: existing } = await supabase.from('user_profiles').select('tenant_id').eq('id', targetId).single();
  if (!existing || (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId)) {
    return c.json({ success: false, error: 'User not found or access denied' }, 404);
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('role:roles(id, name, code, description, is_system)')
    .eq('user_id', targetId);

  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data: data ? data.map((d: any) => d.role) : [] });
});

userWorker.post('/users/:id/roles', requirePermission('role.edit'), async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id') as string;
  const body = await c.req.json();
  const parsed = AssignUserRolesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);
  const { data: existing } = await supabase.from('user_profiles').select('*').eq('id', targetId).single();
  if (!existing || (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId)) {
    return c.json({ success: false, error: 'User not found or access denied' }, 404);
  }

  // Clear existing and assign new
  await supabase.from('user_roles').delete().eq('user_id', targetId);

  if (parsed.data.role_ids.length > 0) {
    const mappings = parsed.data.role_ids.map((rId) => ({
      user_id: targetId,
      role_id: rId,
      tenant_id: existing.tenant_id,
    }));
    const { error: insertError } = await supabase.from('user_roles').insert(mappings);
    if (insertError) return c.json({ success: false, error: insertError.message }, 400);
  }

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id,
    userId: user.userId,
    action: 'ASSIGN_USER_ROLES',
    resourceType: 'user',
    resourceId: targetId,
    newValues: { role_ids: parsed.data.role_ids },
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, message: 'Roles assigned successfully' });
});
