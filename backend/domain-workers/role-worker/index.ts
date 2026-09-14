import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  AssignRolePermissionsSchema,
} from './schemas';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';

type AppVariables = {
  user: AuthenticatedUser;
};

export const roleWorker = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

function getSupabase(c: any) {
  const url = c.env.SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured in Worker environment.');
  }
  return createClient(url, key);
}

// ==========================================
// 1. LIST ROLES
// ==========================================
roleWorker.get('/roles', requirePermission('role.view'), async (c) => {
  const user = c.get('user');
  const targetTenantId = user.role === 'super_admin' && c.req.query('tenant_id') ? c.req.query('tenant_id')! : user.tenantId;

  const supabase = getSupabase(c);

  // Return both system roles and tenant-scoped roles
  const { data: roles, error } = await supabase
    .from('roles')
    .select(`
      id,
      tenant_id,
      name,
      code,
      description,
      is_system,
      created_at,
      updated_at,
      role_permissions(count),
      user_roles(count)
    `)
    .or(`is_system.eq.true,tenant_id.eq.${targetTenantId}`)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true });

  if (error) return c.json({ success: false, error: error.message }, 500);

  const formatted = (roles || []).map((r: any) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    name: r.name,
    code: r.code,
    description: r.description,
    is_system: r.is_system,
    created_at: r.created_at,
    updated_at: r.updated_at,
    permissions_count: r.role_permissions?.[0]?.count ?? 0,
    users_count: r.user_roles?.[0]?.count ?? 0,
  }));

  return c.json({ success: true, data: formatted });
});

// ==========================================
// 2. CREATE CUSTOM ROLE
// ==========================================
roleWorker.post('/roles', requirePermission('role.create'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = CreateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const targetTenantId = user.role === 'super_admin' && body.tenant_id ? body.tenant_id : user.tenantId;
  const supabase = getSupabase(c);

  const { data: newRole, error } = await supabase
    .from('roles')
    .insert({
      name: parsed.data.name,
      code: parsed.data.code.toLowerCase(),
      description: parsed.data.description || null,
      tenant_id: targetTenantId,
      is_system: false,
    })
    .select()
    .single();

  if (error) return c.json({ success: false, error: error.message }, 400);

  // Assign permissions if provided
  if (parsed.data.permission_ids && parsed.data.permission_ids.length > 0) {
    const rolePerms = parsed.data.permission_ids.map((pId) => ({
      role_id: newRole.id,
      permission_id: pId,
    }));
    await supabase.from('role_permissions').insert(rolePerms);
  }

  await logAuditEvent(supabase, {
    tenantId: targetTenantId,
    userId: user.userId,
    action: 'CREATE_ROLE',
    resourceType: 'role',
    resourceId: newRole.id,
    newValues: newRole,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: newRole }, 201);
});

// ==========================================
// 3. UPDATE ROLE
// ==========================================
roleWorker.put('/roles/:id', requirePermission('role.edit'), async (c) => {
  const user = c.get('user');
  const roleId = c.req.param('id') as string;
  const body = await c.req.json();
  const parsed = UpdateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);
  const { data: existing } = await supabase.from('roles').select('*').eq('id', roleId).single();
  if (!existing) return c.json({ success: false, error: 'Role not found' }, 404);

  if (existing.is_system && user.role !== 'super_admin') {
    return c.json({ success: false, error: 'Forbidden: System roles cannot be modified' }, 403);
  }

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cannot modify role from another tenant' }, 403);
  }

  const { data: updated, error } = await supabase
    .from('roles')
    .update(parsed.data)
    .eq('id', roleId)
    .select()
    .single();

  if (error) return c.json({ success: false, error: error.message }, 400);

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id || user.tenantId,
    userId: user.userId,
    action: 'UPDATE_ROLE',
    resourceType: 'role',
    resourceId: roleId,
    oldValues: existing,
    newValues: updated,
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, data: updated });
});

// ==========================================
// 4. LIST PERMISSIONS
// ==========================================
roleWorker.get('/permissions', requirePermission('permission.view'), async (c) => {
  const supabase = getSupabase(c);

  const { data: permissions, error } = await supabase
    .from('permissions')
    .select('*')
    .order('module', { ascending: true })
    .order('name', { ascending: true });

  if (error) return c.json({ success: false, error: error.message }, 500);

  return c.json({ success: true, data: permissions || [] });
});

// ==========================================
// 5. GET PERMISSIONS FOR ROLE
// ==========================================
roleWorker.get('/roles/:id/permissions', requirePermission('permission.view'), async (c) => {
  const roleId = c.req.param('id') as string;
  const supabase = getSupabase(c);

  const { data: rolePerms, error } = await supabase
    .from('role_permissions')
    .select('permission:permissions(*)')
    .eq('role_id', roleId);

  if (error) return c.json({ success: false, error: error.message }, 500);

  return c.json({
    success: true,
    data: (rolePerms || []).map((rp: any) => rp.permission).filter(Boolean),
  });
});

// ==========================================
// 6. ASSIGN PERMISSIONS TO ROLE
// ==========================================
roleWorker.post('/roles/:id/permissions', requirePermission('permission.assign'), async (c) => {
  const user = c.get('user');
  const roleId = c.req.param('id') as string;
  const body = await c.req.json();
  const parsed = AssignRolePermissionsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400);
  }

  const supabase = getSupabase(c);
  const { data: existing } = await supabase.from('roles').select('*').eq('id', roleId).single();
  if (!existing) return c.json({ success: false, error: 'Role not found' }, 404);

  if (existing.is_system && user.role !== 'super_admin') {
    return c.json({ success: false, error: 'Forbidden: Cannot reassign system role permissions' }, 403);
  }

  if (user.role !== 'super_admin' && existing.tenant_id !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cannot modify role from another tenant' }, 403);
  }

  // Clear existing permissions and replace
  await supabase.from('role_permissions').delete().eq('role_id', roleId);

  if (parsed.data.permission_ids.length > 0) {
    const mappings = parsed.data.permission_ids.map((pId) => ({
      role_id: roleId,
      permission_id: pId,
    }));
    const { error: insertError } = await supabase.from('role_permissions').insert(mappings);
    if (insertError) return c.json({ success: false, error: insertError.message }, 400);
  }

  await logAuditEvent(supabase, {
    tenantId: existing.tenant_id || user.tenantId,
    userId: user.userId,
    action: 'ASSIGN_ROLE_PERMISSIONS',
    resourceType: 'role',
    resourceId: roleId,
    newValues: { permission_ids: parsed.data.permission_ids },
    ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
  });

  return c.json({ success: true, message: 'Permissions updated successfully' });
});
