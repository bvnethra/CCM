import {
  Tenant,
  Organization,
  SubOrganization,
  AuditLog,
  UserProfile,
  TenantStatus,
  UserRole,
  Role,
  Permission,
  Client,
  Vendor,
  ItemMaster,
  CalibrationRequest,
  RequestItem,
  CalibrationRequestStatus,
  CalibrationRequestPriority,
  ItemAvailability,
  LabRequestAssignment,
  RequestStatusHistory,
  Verification,
  DocumentItem,
  VerificationResult,
  ItemMatchStatus,
  SerialMatchStatus,
  QuantityStatus,
  ConditionStatus,
  DocumentType,
  VerificationQueueItem,
} from '../types';
import {
  initialTenants,
  initialOrganizations,
  initialSubOrganizations,
  initialAuditLogs,
  demoProfiles,
  initialRoles,
  initialPermissions,
  initialRolePermissions,
  initialClients,
  initialVendors,
  initialItems,
  initialCalibrationRequests,
  initialRequestItems,
  initialLabAssignments,
  initialStatusHistory,
  initialVerifications,
  initialDocuments,
} from './mockData';
import { supabase, isSupabaseConfigured } from './supabase';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_GATEWAY_URL : '') || 'http://localhost:8787/api/v1';

// In-Memory Reactive Multi-Tenant Store (Mirrors Supabase & PostgreSQL RLS)
class MemoryStore {
  tenants: Tenant[] = [...initialTenants];
  organizations: Organization[] = [...initialOrganizations];
  subOrganizations: SubOrganization[] = [...initialSubOrganizations];
  clients: Client[] = [...initialClients];
  vendors: Vendor[] = [...initialVendors];
  items: ItemMaster[] = [...initialItems];
  calibrationRequests: CalibrationRequest[] = [...initialCalibrationRequests];
  requestItems: RequestItem[] = [...initialRequestItems];
  labAssignments: LabRequestAssignment[] = [...initialLabAssignments];
  statusHistory: RequestStatusHistory[] = [...initialStatusHistory];
  verifications: Verification[] = [...initialVerifications];
  documents: DocumentItem[] = [...initialDocuments];
  auditLogs: AuditLog[] = [...initialAuditLogs];
  profiles: UserProfile[] = [...demoProfiles];
  roles: Role[] = [...initialRoles];
  permissions: Permission[] = [...initialPermissions];
  rolePermissions: Record<string, string[]> = { ...initialRolePermissions };
  userRoles: Record<string, string[]> = {
    'usr-super-admin': ['role-01'],
    'usr-acme-admin': ['role-02'],
    'usr-acme-lab-tech': ['role-05'],
    'usr-acme-collector': ['role-06'],
    'usr-apex-admin': ['role-02'],
    'usr-apex-manager': ['role-04'],
  };
  listeners: Set<() => void> = new Set();

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  notify() {
    this.listeners.forEach((fn) => fn());
  }

  addAudit(tenantId: string, action: string, resourceType: string, resourceId: string, newVals?: any, oldVals?: any) {
    const entry: AuditLog = {
      id: 'aud-' + Math.random().toString(36).substring(2, 9),
      tenant_id: tenantId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldVals || null,
      new_values: newVals || null,
      ip_address: '127.0.0.1 (Session)',
      created_at: new Date().toISOString(),
    };
    this.auditLogs.unshift(entry);
  }
}

const memoryDb = new MemoryStore();

// ==========================================
// API CLIENT IMPLEMENTATION
// ==========================================

export const apiClient = {
  subscribe: (fn: () => void) => memoryDb.subscribe(fn),

  // ----------------------------------------------------
  // TENANTS
  // ----------------------------------------------------
  async getTenants(userRole: string, currentTenantId: string): Promise<Tenant[]> {
    if (isSupabaseConfigured && supabase) {
      const query = userRole === 'super_admin'
        ? supabase.from('tenants').select('*').order('created_at', { ascending: false })
        : supabase.from('tenants').select('*').eq('id', currentTenantId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    }

    if (userRole === 'super_admin') {
      return memoryDb.tenants.map(t => ({
        ...t,
        organizations_count: memoryDb.organizations.filter(o => o.tenant_id === t.id).length
      }));
    }
    return memoryDb.tenants
      .filter((t) => t.id === currentTenantId)
      .map(t => ({
        ...t,
        organizations_count: memoryDb.organizations.filter(o => o.tenant_id === t.id).length
      }));
  },

  async createTenant(data: { name: string; code: string; status: TenantStatus; settings?: any }): Promise<Tenant> {
    if (isSupabaseConfigured && supabase) {
      const { data: created, error } = await supabase.from('tenants').insert(data).select().single();
      if (error) throw new Error(error.message);
      return created;
    }

    const newTenant: Tenant = {
      id: 'ten-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
      name: data.name,
      code: data.code.toUpperCase(),
      status: data.status,
      settings: data.settings || { timezone: 'UTC', currency: 'USD' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organizations_count: 0,
    };

    memoryDb.tenants.unshift(newTenant);
    memoryDb.addAudit(newTenant.id, 'CREATE_TENANT', 'tenant', newTenant.id, newTenant);
    memoryDb.notify();
    return newTenant;
  },

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant> {
    const existing = memoryDb.tenants.find((t) => t.id === id);
    if (!existing) throw new Error('Tenant not found');

    const updated: Tenant = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    memoryDb.tenants = memoryDb.tenants.map((t) => (t.id === id ? updated : t));
    memoryDb.addAudit(id, 'UPDATE_TENANT', 'tenant', id, updated, existing);
    memoryDb.notify();
    return updated;
  },

  // ----------------------------------------------------
  // ORGANIZATIONS
  // ----------------------------------------------------
  async getOrganizations(tenantId: string): Promise<Organization[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }

    return memoryDb.organizations
      .filter((org) => org.tenant_id === tenantId)
      .map(org => ({
        ...org,
        sub_organizations_count: memoryDb.subOrganizations.filter(s => s.organization_id === org.id).length
      }));
  },

  async createOrganization(tenantId: string, data: { name: string; code: string; status: TenantStatus }): Promise<Organization> {
    if (isSupabaseConfigured && supabase) {
      const { data: created, error } = await supabase
        .from('organizations')
        .insert({ ...data, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return created;
    }

    const newOrg: Organization = {
      id: 'org-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
      tenant_id: tenantId,
      name: data.name,
      code: data.code.toUpperCase(),
      status: data.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sub_organizations_count: 0,
    };

    memoryDb.organizations.unshift(newOrg);
    memoryDb.addAudit(tenantId, 'CREATE_ORGANIZATION', 'organization', newOrg.id, newOrg);
    memoryDb.notify();
    return newOrg;
  },

  async updateOrganization(id: string, tenantId: string, updates: Partial<Organization>): Promise<Organization> {
    const existing = memoryDb.organizations.find((o) => o.id === id && o.tenant_id === tenantId);
    if (!existing) throw new Error('Organization not found or access denied');

    const updated: Organization = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    memoryDb.organizations = memoryDb.organizations.map((o) => (o.id === id ? updated : o));
    memoryDb.addAudit(tenantId, 'UPDATE_ORGANIZATION', 'organization', id, updated, existing);
    memoryDb.notify();
    return updated;
  },

  async deleteOrganization(id: string, tenantId: string): Promise<void> {
    const existing = memoryDb.organizations.find((o) => o.id === id && o.tenant_id === tenantId);
    if (!existing) throw new Error('Organization not found or access denied');

    memoryDb.subOrganizations = memoryDb.subOrganizations.filter((s) => s.organization_id !== id);
    memoryDb.organizations = memoryDb.organizations.filter((o) => o.id !== id);
    memoryDb.addAudit(tenantId, 'DELETE_ORGANIZATION', 'organization', id, null, existing);
    memoryDb.notify();
  },

  // ----------------------------------------------------
  // SUB-ORGANIZATIONS
  // ----------------------------------------------------
  async getSubOrganizations(tenantId: string, organizationId?: string): Promise<SubOrganization[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('sub_organizations').select('*, organization:organizations(id, name, code)').eq('tenant_id', tenantId);
      if (organizationId) query = query.eq('organization_id', organizationId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    }

    return memoryDb.subOrganizations
      .filter((s) => {
        const matchesTenant = s.tenant_id === tenantId;
        const matchesOrg = organizationId ? s.organization_id === organizationId : true;
        return matchesTenant && matchesOrg;
      })
      .map((s) => {
        const parentOrg = memoryDb.organizations.find((o) => o.id === s.organization_id);
        return {
          ...s,
          organization: parentOrg ? { id: parentOrg.id, name: parentOrg.name, code: parentOrg.code } : undefined,
        };
      });
  },

  async createSubOrganization(
    tenantId: string,
    data: { organization_id: string; name: string; code: string; status: TenantStatus }
  ): Promise<SubOrganization> {
    const parentOrg = memoryDb.organizations.find((o) => o.id === data.organization_id && o.tenant_id === tenantId);
    if (!parentOrg) {
      throw new Error('Security Error: Parent organization does not exist or belongs to another tenant.');
    }

    const newSubOrg: SubOrganization = {
      id: 'sub-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
      tenant_id: tenantId,
      organization_id: data.organization_id,
      name: data.name,
      code: data.code.toUpperCase(),
      status: data.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organization: {
        id: parentOrg.id,
        name: parentOrg.name,
        code: parentOrg.code,
      },
    };

    memoryDb.subOrganizations.unshift(newSubOrg);
    memoryDb.addAudit(tenantId, 'CREATE_SUB_ORGANIZATION', 'sub_organization', newSubOrg.id, newSubOrg);
    memoryDb.notify();
    return newSubOrg;
  },

  async updateSubOrganization(id: string, tenantId: string, updates: Partial<SubOrganization>): Promise<SubOrganization> {
    const existing = memoryDb.subOrganizations.find((s) => s.id === id && s.tenant_id === tenantId);
    if (!existing) throw new Error('Sub-organization not found or access denied');

    const updated: SubOrganization = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    memoryDb.subOrganizations = memoryDb.subOrganizations.map((s) => (s.id === id ? updated : s));
    memoryDb.addAudit(tenantId, 'UPDATE_SUB_ORGANIZATION', 'sub_organization', id, updated, existing);
    memoryDb.notify();
    return updated;
  },

  async deleteSubOrganization(id: string, tenantId: string): Promise<void> {
    const existing = memoryDb.subOrganizations.find((s) => s.id === id && s.tenant_id === tenantId);
    if (!existing) throw new Error('Sub-organization not found or access denied');

    memoryDb.subOrganizations = memoryDb.subOrganizations.filter((s) => s.id !== id);
    memoryDb.addAudit(tenantId, 'DELETE_SUB_ORGANIZATION', 'sub_organization', id, null, existing);
    memoryDb.notify();
  },

  // ----------------------------------------------------
  // USERS (STEP 2)
  // ----------------------------------------------------
  async getUsers(tenantId: string, params?: { search?: string; status?: string; role?: string; organization_id?: string }): Promise<UserProfile[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('user_profiles')
        .select('*, organization:organizations(id, name, code), sub_organization:sub_organizations(id, name, code)')
        .eq('tenant_id', tenantId);

      if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
      if (params?.role && params.role !== 'all') query = query.eq('role', params.role);
      if (params?.organization_id && params.organization_id !== 'all') query = query.eq('organization_id', params.organization_id);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    }

    // STRICT MULTI-TENANT ISOLATION:
    // Only return users belonging to the active tenant
    return memoryDb.profiles
      .filter((u) => {
        const matchesTenant = u.tenant_id === tenantId;
        const matchesStatus = !params?.status || params.status === 'all' || u.status === params.status;
        const matchesRole = !params?.role || params.role === 'all' || u.role === params.role;
        const matchesOrg = !params?.organization_id || params.organization_id === 'all' || u.organization_id === params.organization_id;
        const matchesSearch = !params?.search ||
          u.full_name.toLowerCase().includes(params.search.toLowerCase()) ||
          u.email.toLowerCase().includes(params.search.toLowerCase()) ||
          (u.phone && u.phone.includes(params.search));

        return matchesTenant && matchesStatus && matchesRole && matchesOrg && matchesSearch;
      })
      .map((u) => {
        const org = memoryDb.organizations.find((o) => o.id === u.organization_id);
        const sub = memoryDb.subOrganizations.find((s) => s.id === u.sub_organization_id);
        const userRoleIds = memoryDb.userRoles[u.id] || [];
        const roles = memoryDb.roles.filter((r) => userRoleIds.includes(r.id));
        return {
          ...u,
          organization: org ? { id: org.id, name: org.name, code: org.code } : null,
          sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
          roles,
        };
      });
  },

  async createUser(
    tenantId: string,
    data: {
      full_name: string;
      email: string;
      phone?: string | null;
      organization_id?: string | null;
      sub_organization_id?: string | null;
      role: UserRole;
      status: TenantStatus;
      role_ids?: string[];
    }
  ): Promise<UserProfile> {
    // Validate organization belongs to tenant
    if (data.organization_id) {
      const org = memoryDb.organizations.find((o) => o.id === data.organization_id && o.tenant_id === tenantId);
      if (!org) throw new Error('Parent organization does not belong to this tenant.');
    }

    const newUserId = 'usr-' + Math.random().toString(36).substring(2, 9);
    const org = data.organization_id ? memoryDb.organizations.find((o) => o.id === data.organization_id) : null;
    const sub = data.sub_organization_id ? memoryDb.subOrganizations.find((s) => s.id === data.sub_organization_id) : null;

    const newUser: UserProfile = {
      id: newUserId,
      tenant_id: tenantId,
      full_name: data.full_name,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      organization_id: data.organization_id || null,
      sub_organization_id: data.sub_organization_id || null,
      role: data.role,
      status: data.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
    };

    memoryDb.profiles.unshift(newUser);

    if (data.role_ids && data.role_ids.length > 0) {
      memoryDb.userRoles[newUserId] = data.role_ids;
    }

    memoryDb.addAudit(tenantId, 'CREATE_USER', 'user', newUserId, newUser);
    memoryDb.notify();
    return newUser;
  },

  async updateUser(
    id: string,
    tenantId: string,
    updates: Partial<UserProfile> & { role_ids?: string[] }
  ): Promise<UserProfile> {
    const existing = memoryDb.profiles.find((u) => u.id === id && u.tenant_id === tenantId);
    if (!existing) throw new Error('User not found or access denied across tenants');

    const updated: UserProfile = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.role_ids) {
      memoryDb.userRoles[id] = updates.role_ids;
    }

    memoryDb.profiles = memoryDb.profiles.map((u) => (u.id === id ? updated : u));
    memoryDb.addAudit(tenantId, 'UPDATE_USER', 'user', id, updated, existing);
    memoryDb.notify();
    return updated;
  },

  async updateUserStatus(id: string, tenantId: string, status: TenantStatus): Promise<UserProfile> {
    const existing = memoryDb.profiles.find((u) => u.id === id && u.tenant_id === tenantId);
    if (!existing) throw new Error('User not found or access denied across tenants');

    const updated: UserProfile = {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    };

    memoryDb.profiles = memoryDb.profiles.map((u) => (u.id === id ? updated : u));
    memoryDb.addAudit(tenantId, 'UPDATE_USER_STATUS', 'user', id, { status }, { status: existing.status });
    memoryDb.notify();
    return updated;
  },

  async deleteUser(id: string, tenantId: string): Promise<void> {
    const existing = memoryDb.profiles.find((u) => u.id === id && u.tenant_id === tenantId);
    if (!existing) throw new Error('User not found or access denied across tenants');

    memoryDb.profiles = memoryDb.profiles.filter((u) => u.id !== id);
    delete memoryDb.userRoles[id];
    memoryDb.addAudit(tenantId, 'DELETE_USER', 'user', id, null, existing);
    memoryDb.notify();
  },

  // ----------------------------------------------------
  // ROLES & PERMISSIONS (STEP 2)
  // ----------------------------------------------------
  async getRoles(tenantId: string): Promise<Role[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .or(`is_system.eq.true,tenant_id.eq.${tenantId}`)
        .order('is_system', { ascending: false })
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    }

    // Return system roles + tenant roles
    return memoryDb.roles
      .filter((r) => r.is_system || r.tenant_id === tenantId)
      .map((r) => {
        const perms = memoryDb.rolePermissions[r.id] || [];
        const assignedUsers = Object.entries(memoryDb.userRoles).filter(([_, rIds]) => rIds.includes(r.id)).length;
        return {
          ...r,
          permissions_count: perms.length,
          users_count: assignedUsers,
        };
      });
  },

  async createRole(
    tenantId: string,
    data: { name: string; code: string; description?: string | null; permission_ids?: string[] }
  ): Promise<Role> {
    const newRoleId = 'role-' + Math.random().toString(36).substring(2, 9);
    const newRole: Role = {
      id: newRoleId,
      tenant_id: tenantId,
      name: data.name,
      code: data.code.toLowerCase(),
      description: data.description || null,
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      permissions_count: data.permission_ids?.length || 0,
      users_count: 0,
    };

    memoryDb.roles.push(newRole);

    if (data.permission_ids && data.permission_ids.length > 0) {
      memoryDb.rolePermissions[newRoleId] = data.permission_ids;
    }

    memoryDb.addAudit(tenantId, 'CREATE_ROLE', 'role', newRoleId, newRole);
    memoryDb.notify();
    return newRole;
  },

  async updateRole(
    id: string,
    tenantId: string,
    updates: Partial<Role> & { permission_ids?: string[] }
  ): Promise<Role> {
    const existing = memoryDb.roles.find((r) => r.id === id);
    if (!existing) throw new Error('Role not found');
    if (existing.is_system && updates.name && updates.name !== existing.name) {
      throw new Error('System roles cannot have their name or code modified');
    }

    const updated: Role = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.permission_ids) {
      memoryDb.rolePermissions[id] = updates.permission_ids;
      updated.permissions_count = updates.permission_ids.length;
    }

    memoryDb.roles = memoryDb.roles.map((r) => (r.id === id ? updated : r));
    memoryDb.addAudit(tenantId, 'UPDATE_ROLE', 'role', id, updated, existing);
    memoryDb.notify();
    return updated;
  },

  async getPermissions(): Promise<Permission[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('permissions').select('*').order('module', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    }
    return [...memoryDb.permissions];
  },

  async getRolePermissions(roleId: string): Promise<string[]> {
    return memoryDb.rolePermissions[roleId] || [];
  },

  async assignRolePermissions(roleId: string, permissionIds: string[], tenantId: string): Promise<void> {
    const role = memoryDb.roles.find((r) => r.id === roleId);
    if (!role) throw new Error('Role not found');

    memoryDb.rolePermissions[roleId] = permissionIds;
    memoryDb.roles = memoryDb.roles.map((r) =>
      r.id === roleId ? { ...r, permissions_count: permissionIds.length } : r
    );

    memoryDb.addAudit(tenantId, 'ASSIGN_ROLE_PERMISSIONS', 'role', roleId, { permission_ids: permissionIds });
    memoryDb.notify();
  },

  async getUserRoles(userId: string): Promise<string[]> {
    return memoryDb.userRoles[userId] || [];
  },

  async assignUserRoles(userId: string, roleIds: string[], tenantId: string): Promise<void> {
    memoryDb.userRoles[userId] = roleIds;
    memoryDb.addAudit(tenantId, 'ASSIGN_USER_ROLES', 'user', userId, { role_ids: roleIds });
    memoryDb.notify();
  },

  // ----------------------------------------------------
  // CLIENT MASTER (STEP 3)
  // ----------------------------------------------------
  async getClients(
    tenantId: string,
    params?: {
      search?: string;
      status?: string;
      organization_id?: string;
      sub_org_id?: string;
    }
  ): Promise<Client[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('clients')
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
      if (params?.organization_id && params.organization_id !== 'all') query = query.eq('organization_id', params.organization_id);
      if (params?.sub_org_id && params.sub_org_id !== 'all') query = query.eq('sub_org_id', params.sub_org_id);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      let filtered = data || [];
      if (params?.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          (c: any) =>
            c.client_name?.toLowerCase().includes(s) ||
            c.client_code?.toLowerCase().includes(s) ||
            c.contact_person?.toLowerCase().includes(s) ||
            c.contact_email?.toLowerCase().includes(s) ||
            c.city?.toLowerCase().includes(s) ||
            c.gst_number?.toLowerCase().includes(s)
        );
      }
      return filtered;
    }

    // STRICT MULTI-TENANT ISOLATION FALLBACK
    return memoryDb.clients
      .filter((c) => {
        const matchesTenant = c.tenant_id === tenantId;
        const matchesStatus = !params?.status || params.status === 'all' || c.status === params.status;
        const matchesOrg = !params?.organization_id || params.organization_id === 'all' || c.organization_id === params.organization_id;
        const matchesSubOrg = !params?.sub_org_id || params.sub_org_id === 'all' || c.sub_org_id === params.sub_org_id;
        const matchesSearch = !params?.search ||
          c.client_name.toLowerCase().includes(params.search.toLowerCase()) ||
          c.client_code.toLowerCase().includes(params.search.toLowerCase()) ||
          (c.contact_person && c.contact_person.toLowerCase().includes(params.search.toLowerCase())) ||
          (c.contact_email && c.contact_email.toLowerCase().includes(params.search.toLowerCase())) ||
          (c.city && c.city.toLowerCase().includes(params.search.toLowerCase())) ||
          (c.gst_number && c.gst_number.toLowerCase().includes(params.search.toLowerCase()));

        return matchesTenant && matchesStatus && matchesOrg && matchesSubOrg && matchesSearch;
      })
      .map((c) => {
        const org = memoryDb.organizations.find((o) => o.id === c.organization_id);
        const sub = memoryDb.subOrganizations.find((s) => s.id === c.sub_org_id);
        return {
          ...c,
          organization: org ? { id: org.id, name: org.name, code: org.code } : null,
          sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
        };
      });
  },

  async getClient(id: string, tenantId: string): Promise<Client> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) throw new Error(error?.message || 'Client not found or access denied');
      return data;
    }

    const client = memoryDb.clients.find((c) => c.id === id && c.tenant_id === tenantId);
    if (!client) throw new Error('Client not found or access denied');

    const org = memoryDb.organizations.find((o) => o.id === client.organization_id);
    const sub = memoryDb.subOrganizations.find((s) => s.id === client.sub_org_id);
    return {
      ...client,
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
    };
  },

  async createClient(
    tenantId: string,
    data: Omit<Client, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>
  ): Promise<Client> {
    // Check unique client code within tenant
    const existing = memoryDb.clients.find(
      (c) => c.tenant_id === tenantId && c.client_code.toUpperCase() === data.client_code.trim().toUpperCase()
    );
    if (existing) {
      throw new Error(`Client code "${data.client_code}" already exists in this tenant. Client codes must be unique per tenant.`);
    }

    if (isSupabaseConfigured && supabase) {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          ...data,
          tenant_id: tenantId,
          client_code: data.client_code.trim().toUpperCase(),
        })
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .single();

      if (error) throw new Error(error.message);
      return newClient;
    }

    const newId = 'cli-' + Math.random().toString(36).substring(2, 9);
    const org = data.organization_id ? memoryDb.organizations.find((o) => o.id === data.organization_id) : null;
    const sub = data.sub_org_id ? memoryDb.subOrganizations.find((s) => s.id === data.sub_org_id) : null;

    const newRecord: Client = {
      ...data,
      id: newId,
      tenant_id: tenantId,
      client_code: data.client_code.trim().toUpperCase(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
    };

    memoryDb.clients.unshift(newRecord);
    memoryDb.addAudit(tenantId, 'CREATE_CLIENT', 'clients', newId, newRecord);
    memoryDb.notify();
    return newRecord;
  },

  async updateClient(id: string, tenantId: string, data: Partial<Client>): Promise<Client> {
    if (data.client_code) {
      const dup = memoryDb.clients.find(
        (c) => c.tenant_id === tenantId && c.id !== id && c.client_code.toUpperCase() === data.client_code!.trim().toUpperCase()
      );
      if (dup) {
        throw new Error(`Client code "${data.client_code}" already exists in this tenant.`);
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data: updated, error } = await supabase
        .from('clients')
        .update({
          ...data,
          client_code: data.client_code ? data.client_code.trim().toUpperCase() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .single();

      if (error) throw new Error(error.message);
      return updated;
    }

    const index = memoryDb.clients.findIndex((c) => c.id === id && c.tenant_id === tenantId);
    if (index === -1) throw new Error('Client not found or access denied');

    const existing = memoryDb.clients[index];
    const org = data.organization_id ? memoryDb.organizations.find((o) => o.id === data.organization_id) : existing.organization;
    const sub = data.sub_org_id ? memoryDb.subOrganizations.find((s) => s.id === data.sub_org_id) : existing.sub_organization;

    const updated: Client = {
      ...existing,
      ...data,
      client_code: data.client_code ? data.client_code.trim().toUpperCase() : existing.client_code,
      updated_at: new Date().toISOString(),
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
    };

    memoryDb.clients[index] = updated;
    memoryDb.addAudit(tenantId, 'UPDATE_CLIENT', 'clients', id, updated, existing);
    memoryDb.notify();
    return updated;
  },

  async updateClientStatus(id: string, tenantId: string, status: TenantStatus): Promise<Client> {
    if (isSupabaseConfigured && supabase) {
      const { data: updated, error } = await supabase
        .from('clients')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .single();

      if (error) throw new Error(error.message);
      return updated;
    }

    const index = memoryDb.clients.findIndex((c) => c.id === id && c.tenant_id === tenantId);
    if (index === -1) throw new Error('Client not found or access denied');

    const existing = memoryDb.clients[index];
    const updated: Client = {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    };

    memoryDb.clients[index] = updated;
    memoryDb.addAudit(tenantId, status === 'active' ? 'ACTIVATE_CLIENT' : 'DEACTIVATE_CLIENT', 'clients', id, { status }, { status: existing.status });
    memoryDb.notify();
    return updated;
  },

  async deleteClient(id: string, tenantId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw new Error(error.message);
      return;
    }

    const existing = memoryDb.clients.find((c) => c.id === id && c.tenant_id === tenantId);
    if (!existing) throw new Error('Client not found or access denied');

    memoryDb.clients = memoryDb.clients.filter((c) => c.id !== id);
    memoryDb.addAudit(tenantId, 'DELETE_CLIENT', 'clients', id, null, existing);
    memoryDb.notify();
  },

  // ----------------------------------------------------
  // VENDOR MASTER (STEP 4)
  // ----------------------------------------------------
  async getVendors(
    tenantId: string,
    params?: {
      search?: string;
      status?: string;
      organization_id?: string;
      sub_org_id?: string;
      category?: string;
    }
  ): Promise<Vendor[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('vendors')
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
      if (params?.organization_id && params.organization_id !== 'all') query = query.eq('organization_id', params.organization_id);
      if (params?.sub_org_id && params.sub_org_id !== 'all') query = query.eq('sub_org_id', params.sub_org_id);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      let filtered = data || [];

      if (params?.category && params.category !== 'all') {
        filtered = filtered.filter((v: any) =>
          Array.isArray(v.serviced_categories) && v.serviced_categories.includes(params.category)
        );
      }

      if (params?.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          (v: any) =>
            v.vendor_name?.toLowerCase().includes(s) ||
            v.vendor_code?.toLowerCase().includes(s) ||
            v.contact_person?.toLowerCase().includes(s) ||
            v.contact_email?.toLowerCase().includes(s) ||
            v.city?.toLowerCase().includes(s) ||
            v.gst_number?.toLowerCase().includes(s) ||
            (Array.isArray(v.serviced_categories) &&
              v.serviced_categories.some((cat: string) => cat.toLowerCase().includes(s)))
        );
      }
      return filtered;
    }

    // STRICT MULTI-TENANT ISOLATION FALLBACK
    return memoryDb.vendors
      .filter((v) => {
        const matchesTenant = v.tenant_id === tenantId;
        const matchesStatus = !params?.status || params.status === 'all' || v.status === params.status;
        const matchesOrg = !params?.organization_id || params.organization_id === 'all' || v.organization_id === params.organization_id;
        const matchesSubOrg = !params?.sub_org_id || params.sub_org_id === 'all' || v.sub_org_id === params.sub_org_id;
        const matchesCategory = !params?.category || params.category === 'all' ||
          (Array.isArray(v.serviced_categories) && v.serviced_categories.includes(params.category));
        const matchesSearch = !params?.search ||
          v.vendor_name.toLowerCase().includes(params.search.toLowerCase()) ||
          v.vendor_code.toLowerCase().includes(params.search.toLowerCase()) ||
          (v.contact_person && v.contact_person.toLowerCase().includes(params.search.toLowerCase())) ||
          (v.contact_email && v.contact_email.toLowerCase().includes(params.search.toLowerCase())) ||
          (v.city && v.city.toLowerCase().includes(params.search.toLowerCase())) ||
          (v.gst_number && v.gst_number.toLowerCase().includes(params.search.toLowerCase())) ||
          (Array.isArray(v.serviced_categories) &&
            v.serviced_categories.some((cat) => cat.toLowerCase().includes(params.search!.toLowerCase())));

        return matchesTenant && matchesStatus && matchesOrg && matchesSubOrg && matchesCategory && matchesSearch;
      })
      .map((v) => {
        const org = memoryDb.organizations.find((o) => o.id === v.organization_id);
        const sub = memoryDb.subOrganizations.find((s) => s.id === v.sub_org_id);
        return {
          ...v,
          organization: org ? { id: org.id, name: org.name, code: org.code } : null,
          sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
        };
      });
  },

  async getVendor(id: string, tenantId: string): Promise<Vendor> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('vendors')
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) throw new Error(error?.message || 'Vendor not found or access denied');
      return data;
    }

    const vendor = memoryDb.vendors.find((v) => v.id === id && v.tenant_id === tenantId);
    if (!vendor) throw new Error('Vendor not found or access denied');

    const org = memoryDb.organizations.find((o) => o.id === vendor.organization_id);
    const sub = memoryDb.subOrganizations.find((s) => s.id === vendor.sub_org_id);
    return {
      ...vendor,
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
    };
  },

  async createVendor(
    tenantId: string,
    data: Omit<Vendor, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>
  ): Promise<Vendor> {
    // Check unique vendor code within tenant
    const existing = memoryDb.vendors.find(
      (v) => v.tenant_id === tenantId && v.vendor_code.toUpperCase() === data.vendor_code.trim().toUpperCase()
    );
    if (existing) {
      throw new Error(`Vendor code "${data.vendor_code}" already exists in this tenant. Vendor codes must be unique per tenant.`);
    }

    if (isSupabaseConfigured && supabase) {
      const { data: newVendor, error } = await supabase
        .from('vendors')
        .insert({
          ...data,
          tenant_id: tenantId,
          vendor_code: data.vendor_code.trim().toUpperCase(),
        })
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .single();

      if (error) throw new Error(error.message);
      return newVendor;
    }

    const newId = 'ven-' + Math.random().toString(36).substring(2, 9);
    const org = data.organization_id ? memoryDb.organizations.find((o) => o.id === data.organization_id) : null;
    const sub = data.sub_org_id ? memoryDb.subOrganizations.find((s) => s.id === data.sub_org_id) : null;

    const newRecord: Vendor = {
      ...data,
      id: newId,
      tenant_id: tenantId,
      vendor_code: data.vendor_code.trim().toUpperCase(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
    };

    memoryDb.vendors.unshift(newRecord);
    memoryDb.addAudit(tenantId, 'CREATE_VENDOR', 'vendors', newId, newRecord);
    memoryDb.notify();
    return newRecord;
  },

  async updateVendor(id: string, tenantId: string, data: Partial<Vendor>): Promise<Vendor> {
    if (data.vendor_code) {
      const dup = memoryDb.vendors.find(
        (v) => v.tenant_id === tenantId && v.id !== id && v.vendor_code.toUpperCase() === data.vendor_code!.trim().toUpperCase()
      );
      if (dup) {
        throw new Error(`Vendor code "${data.vendor_code}" already exists in this tenant.`);
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data: updated, error } = await supabase
        .from('vendors')
        .update({
          ...data,
          vendor_code: data.vendor_code ? data.vendor_code.trim().toUpperCase() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .single();

      if (error) throw new Error(error.message);
      return updated;
    }

    const index = memoryDb.vendors.findIndex((v) => v.id === id && v.tenant_id === tenantId);
    if (index === -1) throw new Error('Vendor not found or access denied');

    const existing = memoryDb.vendors[index];
    const org = data.organization_id ? memoryDb.organizations.find((o) => o.id === data.organization_id) : existing.organization;
    const sub = data.sub_org_id ? memoryDb.subOrganizations.find((s) => s.id === data.sub_org_id) : existing.sub_organization;

    const updated: Vendor = {
      ...existing,
      ...data,
      vendor_code: data.vendor_code ? data.vendor_code.trim().toUpperCase() : existing.vendor_code,
      updated_at: new Date().toISOString(),
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
    };

    memoryDb.vendors[index] = updated;
    memoryDb.addAudit(tenantId, 'UPDATE_VENDOR', 'vendors', id, updated, existing);
    memoryDb.notify();
    return updated;
  },

  async updateVendorStatus(id: string, tenantId: string, status: TenantStatus): Promise<Vendor> {
    if (isSupabaseConfigured && supabase) {
      const { data: updated, error } = await supabase
        .from('vendors')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .single();

      if (error) throw new Error(error.message);
      return updated;
    }

    const index = memoryDb.vendors.findIndex((v) => v.id === id && v.tenant_id === tenantId);
    if (index === -1) throw new Error('Vendor not found or access denied');

    const existing = memoryDb.vendors[index];
    const updated: Vendor = {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    };

    memoryDb.vendors[index] = updated;
    memoryDb.addAudit(tenantId, status === 'active' ? 'ACTIVATE_VENDOR' : 'DEACTIVATE_VENDOR', 'vendors', id, { status }, { status: existing.status });
    memoryDb.notify();
    return updated;
  },

  async deleteVendor(id: string, tenantId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw new Error(error.message);
      return;
    }

    const existing = memoryDb.vendors.find((v) => v.id === id && v.tenant_id === tenantId);
    if (!existing) throw new Error('Vendor not found or access denied');

    memoryDb.vendors = memoryDb.vendors.filter((v) => v.id !== id);
    memoryDb.addAudit(tenantId, 'DELETE_VENDOR', 'vendors', id, null, existing);
    memoryDb.notify();
  },

  // ----------------------------------------------------
  // ITEM MASTER (STEP 5)
  // ----------------------------------------------------
  async getItems(
    tenantId: string,
    params?: {
      search?: string;
      status?: string;
      item_type?: string;
      manufacturer?: string;
      organization_id?: string;
      sub_org_id?: string;
    }
  ): Promise<ItemMaster[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('item_masters')
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (params?.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }
      if (params?.item_type && params.item_type !== 'all') {
        query = query.eq('item_type', params.item_type);
      }
      if (params?.manufacturer && params.manufacturer !== 'all') {
        query = query.eq('manufacturer', params.manufacturer);
      }
      if (params?.organization_id && params.organization_id !== 'all') {
        query = query.eq('organization_id', params.organization_id);
      }
      if (params?.sub_org_id && params.sub_org_id !== 'all') {
        query = query.eq('sub_org_id', params.sub_org_id);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      let items = data || [];
      if (params?.search) {
        const s = params.search.toLowerCase();
        items = items.filter(
          (i: any) =>
            i.item_name?.toLowerCase().includes(s) ||
            i.item_code?.toLowerCase().includes(s) ||
            i.manufacturer?.toLowerCase().includes(s) ||
            i.model?.toLowerCase().includes(s) ||
            i.serial_number?.toLowerCase().includes(s) ||
            i.measurement_range?.toLowerCase().includes(s)
        );
      }
      return items;
    }

    return memoryDb.items
      .filter((item) => {
        const matchesTenant = item.tenant_id === tenantId;
        const matchesStatus = !params?.status || params.status === 'all' || item.status === params.status;
        const matchesType = !params?.item_type || params.item_type === 'all' || item.item_type === params.item_type;
        const matchesMfr = !params?.manufacturer || params.manufacturer === 'all' || item.manufacturer === params.manufacturer;
        const matchesOrg = !params?.organization_id || params.organization_id === 'all' || item.organization_id === params.organization_id;
        const matchesSubOrg = !params?.sub_org_id || params.sub_org_id === 'all' || item.sub_org_id === params.sub_org_id;

        const matchesSearch =
          !params?.search ||
          item.item_name.toLowerCase().includes(params.search.toLowerCase()) ||
          item.item_code.toLowerCase().includes(params.search.toLowerCase()) ||
          (item.manufacturer && item.manufacturer.toLowerCase().includes(params.search.toLowerCase())) ||
          (item.model && item.model.toLowerCase().includes(params.search.toLowerCase())) ||
          (item.serial_number && item.serial_number.toLowerCase().includes(params.search.toLowerCase())) ||
          (item.item_type && item.item_type.toLowerCase().includes(params.search.toLowerCase())) ||
          (item.measurement_range && item.measurement_range.toLowerCase().includes(params.search.toLowerCase()));

        return matchesTenant && matchesStatus && matchesType && matchesMfr && matchesOrg && matchesSubOrg && matchesSearch;
      })
      .map((item) => {
        const org = memoryDb.organizations.find((o) => o.id === item.organization_id);
        const sub = memoryDb.subOrganizations.find((s) => s.id === item.sub_org_id);
        return {
          ...item,
          organization: org ? { id: org.id, name: org.name, code: org.code } : null,
          sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
        };
      });
  },

  async getItem(id: string, tenantId: string): Promise<ItemMaster> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('item_masters')
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) throw new Error(error?.message || 'Item not found or access denied');
      return data;
    }

    const item = memoryDb.items.find((i) => i.id === id && i.tenant_id === tenantId);
    if (!item) throw new Error('Item not found or access denied');

    const org = memoryDb.organizations.find((o) => o.id === item.organization_id);
    const sub = memoryDb.subOrganizations.find((s) => s.id === item.sub_org_id);
    return {
      ...item,
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
    };
  },

  async createItem(
    tenantId: string,
    data: Omit<ItemMaster, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>
  ): Promise<ItemMaster> {
    // Check unique item code in tenant
    const existing = memoryDb.items.find(
      (i) => i.tenant_id === tenantId && i.item_code.toUpperCase() === data.item_code.trim().toUpperCase()
    );
    if (existing) {
      throw new Error(`Item code "${data.item_code}" already exists in this tenant. Item codes must be unique per tenant.`);
    }

    // Check unique serial number if provided
    if (data.serial_number && data.serial_number.trim()) {
      const existingSerial = memoryDb.items.find(
        (i) => i.tenant_id === tenantId && i.serial_number && i.serial_number.trim().toUpperCase() === data.serial_number!.trim().toUpperCase()
      );
      if (existingSerial) {
        throw new Error(`Serial number "${data.serial_number}" already registered on item "${existingSerial.item_code}". Serial numbers should be unique.`);
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data: newItem, error } = await supabase
        .from('item_masters')
        .insert({
          ...data,
          tenant_id: tenantId,
          item_code: data.item_code.trim().toUpperCase(),
        })
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .single();

      if (error) throw new Error(error.message);
      return newItem;
    }

    const newId = 'itm-' + Math.random().toString(36).substring(2, 9);
    const org = data.organization_id ? memoryDb.organizations.find((o) => o.id === data.organization_id) : null;
    const sub = data.sub_org_id ? memoryDb.subOrganizations.find((s) => s.id === data.sub_org_id) : null;

    const newRecord: ItemMaster = {
      ...data,
      id: newId,
      tenant_id: tenantId,
      item_code: data.item_code.trim().toUpperCase(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
    };

    memoryDb.items.unshift(newRecord);
    memoryDb.addAudit(tenantId, 'CREATE_ITEM', 'item_masters', newId, newRecord);
    memoryDb.notify();
    return newRecord;
  },

  async updateItem(id: string, tenantId: string, data: Partial<ItemMaster>): Promise<ItemMaster> {
    if (data.item_code) {
      const dup = memoryDb.items.find(
        (i) => i.tenant_id === tenantId && i.id !== id && i.item_code.toUpperCase() === data.item_code!.trim().toUpperCase()
      );
      if (dup) {
        throw new Error(`Item code "${data.item_code}" already exists in this tenant.`);
      }
    }

    if (data.serial_number && data.serial_number.trim()) {
      const dupSerial = memoryDb.items.find(
        (i) => i.tenant_id === tenantId && i.id !== id && i.serial_number && i.serial_number.trim().toUpperCase() === data.serial_number!.trim().toUpperCase()
      );
      if (dupSerial) {
        throw new Error(`Serial number "${data.serial_number}" already registered on item "${dupSerial.item_code}".`);
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data: updated, error } = await supabase
        .from('item_masters')
        .update({
          ...data,
          item_code: data.item_code ? data.item_code.trim().toUpperCase() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .single();

      if (error) throw new Error(error.message);
      return updated;
    }

    const index = memoryDb.items.findIndex((i) => i.id === id && i.tenant_id === tenantId);
    if (index === -1) throw new Error('Item not found or access denied');

    const existing = memoryDb.items[index];
    const org = data.organization_id ? memoryDb.organizations.find((o) => o.id === data.organization_id) : existing.organization;
    const sub = data.sub_org_id ? memoryDb.subOrganizations.find((s) => s.id === data.sub_org_id) : existing.sub_organization;

    const updated: ItemMaster = {
      ...existing,
      ...data,
      item_code: data.item_code ? data.item_code.trim().toUpperCase() : existing.item_code,
      updated_at: new Date().toISOString(),
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      sub_organization: sub ? { id: sub.id, name: sub.name, code: sub.code } : null,
    };

    memoryDb.items[index] = updated;
    memoryDb.addAudit(tenantId, 'UPDATE_ITEM', 'item_masters', id, updated, existing);
    memoryDb.notify();
    return updated;
  },

  async updateItemStatus(id: string, tenantId: string, status: TenantStatus): Promise<ItemMaster> {
    if (isSupabaseConfigured && supabase) {
      const { data: updated, error } = await supabase
        .from('item_masters')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code)
        `)
        .single();

      if (error) throw new Error(error.message);
      return updated;
    }

    const index = memoryDb.items.findIndex((i) => i.id === id && i.tenant_id === tenantId);
    if (index === -1) throw new Error('Item not found or access denied');

    const existing = memoryDb.items[index];
    const updated: ItemMaster = {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    };

    memoryDb.items[index] = updated;
    memoryDb.addAudit(tenantId, status === 'active' ? 'ACTIVATE_ITEM' : 'DEACTIVATE_ITEM', 'item_masters', id, { status }, { status: existing.status });
    memoryDb.notify();
    return updated;
  },

  async deleteItem(id: string, tenantId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('item_masters')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw new Error(error.message);
      return;
    }

    const existing = memoryDb.items.find((i) => i.id === id && i.tenant_id === tenantId);
    if (!existing) throw new Error('Item not found or access denied');

    memoryDb.items = memoryDb.items.filter((i) => i.id !== id);
    memoryDb.addAudit(tenantId, 'DELETE_ITEM', 'item_masters', id, null, existing);
    memoryDb.notify();
  },

  // ----------------------------------------------------
  // CALIBRATION REQUESTS & ITEM AVAILABILITY (STEP 6)
  // ----------------------------------------------------
  async getCalibrationRequests(
    filterOrTenantId:
      | string
      | {
          tenantId: string;
          userRole?: string;
          search?: string;
          status?: string;
          priority?: string;
          clientId?: string;
          agentId?: string;
          fromDate?: string;
          toDate?: string;
        },
    optionalParams?: {
      userRole?: string;
      search?: string;
      status?: string;
      priority?: string;
      clientId?: string;
      agentId?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<CalibrationRequest[]> {
    const filters =
      typeof filterOrTenantId === 'string'
        ? {
            tenantId: filterOrTenantId,
            userRole: optionalParams?.userRole || 'tenant_admin',
            ...optionalParams,
          }
        : {
            userRole: 'tenant_admin',
            ...filterOrTenantId,
          };

    if (isSupabaseConfigured && supabase) {
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
            availability_checked_at
          )
        `)
        .order('created_at', { ascending: false });

      if (filters.userRole !== 'super_admin') {
        query = query.eq('tenant_id', filters.tenantId);
      }
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }
      if (filters.clientId && filters.clientId !== 'all') {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters.agentId && filters.agentId !== 'all') {
        query = query.eq('collection_agent_id', filters.agentId);
      }
      if (filters.fromDate) {
        query = query.gte('collection_date', filters.fromDate);
      }
      if (filters.toDate) {
        query = query.lte('collection_date', filters.toDate);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data || []).map((req: any) => {
        const items = req.items || [];
        const itemsCount = items.reduce((acc: number, item: any) => acc + (item.requested_quantity || 1), 0);
        const availableCount = items.filter((item: any) => item.item_available === 'YES').length;
        const unavailableCount = items.filter((item: any) => item.item_available === 'NO').length;
        return {
          ...req,
          items_count: itemsCount,
          available_items_count: availableCount,
          unavailable_items_count: unavailableCount,
        };
      });
    }

    let results = memoryDb.calibrationRequests;
    if (filters.userRole !== 'super_admin') {
      results = results.filter((r) => r.tenant_id === filters.tenantId);
    }
    if (filters.status && filters.status !== 'all') {
      results = results.filter((r) => r.status === filters.status);
    }
    if (filters.priority && filters.priority !== 'all') {
      results = results.filter((r) => r.priority === filters.priority);
    }
    if (filters.clientId && filters.clientId !== 'all') {
      results = results.filter((r) => r.client_id === filters.clientId);
    }
    if (filters.agentId && filters.agentId !== 'all') {
      results = results.filter((r) => r.collection_agent_id === filters.agentId);
    }
    if (filters.fromDate) {
      results = results.filter((r) => r.collection_date >= filters.fromDate!);
    }
    if (filters.toDate) {
      results = results.filter((r) => r.collection_date <= filters.toDate!);
    }
    if (filters.search && typeof filters.search === 'string') {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (r) =>
          r.request_number.toLowerCase().includes(q) ||
          r.client?.client_name.toLowerCase().includes(q) ||
          r.client?.client_code.toLowerCase().includes(q) ||
          r.collection_agent?.full_name.toLowerCase().includes(q) ||
          (r.remarks && r.remarks.toLowerCase().includes(q))
      );
    }

    return results.map((r) => {
      const items = memoryDb.requestItems.filter((ri) => ri.request_id === r.id);
      const itemsCount = items.reduce((acc, ri) => acc + (ri.requested_quantity || 1), 0);
      const availableCount = items.filter((ri) => ri.item_available === 'YES').length;
      const unavailableCount = items.filter((ri) => ri.item_available === 'NO').length;
      return {
        ...r,
        items,
        items_count: itemsCount,
        available_items_count: availableCount,
        unavailable_items_count: unavailableCount,
      };
    });
  },

  async getCalibrationRequest(id: string, tenantId: string): Promise<CalibrationRequest> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('calibration_requests')
        .select(`
          *,
          client:clients(*),
          collection_agent:users(*),
          organization:organizations(id, name, code),
          sub_organization:sub_organizations(id, name, code),
          items:request_items(
            *,
            item:item_masters(*)
          )
        `)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) throw new Error(error.message);
      return data;
    }

    const req = memoryDb.calibrationRequests.find((r) => r.id === id && r.tenant_id === tenantId);
    if (!req) throw new Error('Calibration request not found or access denied');

    const items = memoryDb.requestItems
      .filter((ri) => ri.request_id === id)
      .map((ri) => ({
        ...ri,
        item: memoryDb.items.find((item) => item.id === ri.item_id) || ri.item,
      }));

    const itemsCount = items.reduce((acc, ri) => acc + (ri.requested_quantity || 1), 0);
    const availableCount = items.filter((ri) => ri.item_available === 'YES').length;
    const unavailableCount = items.filter((ri) => ri.item_available === 'NO').length;

    return {
      ...req,
      items,
      items_count: itemsCount,
      available_items_count: availableCount,
      unavailable_items_count: unavailableCount,
    };
  },

  async createCalibrationRequest(
    firstArg: any,
    secondArg: any,
    thirdArg?: string
  ): Promise<CalibrationRequest> {
    const isFirstTenant = typeof firstArg === 'string';
    const tenantId: string = isFirstTenant ? firstArg : secondArg;
    const data: {
      client_id: string;
      collection_date: string;
      priority: CalibrationRequestPriority;
      remarks?: string | null;
      items: Array<{
        item_id: string;
        requested_quantity: number;
        item_available: ItemAvailability;
        availability_remarks?: string | null;
      }>;
      override_availability?: boolean;
    } = isFirstTenant ? secondArg : firstArg;
    const userId: string = (isFirstTenant ? thirdArg : thirdArg) || 'usr-super-admin';

    const client = memoryDb.clients.find((c) => c.id === data.client_id && c.tenant_id === tenantId);
    if (!client) throw new Error('Selected client not found or unauthorized');

    // Verify all items belong to tenant
    for (const itemInput of data.items) {
      const dbItem = memoryDb.items.find((i) => i.id === itemInput.item_id && i.tenant_id === tenantId);
      if (!dbItem) throw new Error(`Item ${itemInput.item_id} does not exist in this tenant`);
      if (itemInput.item_available === 'NO' && (!itemInput.availability_remarks || !itemInput.availability_remarks.trim())) {
        throw new Error(`Item "${dbItem.item_name}" is unavailable, remarks are mandatory`);
      }
    }

    const user = memoryDb.profiles.find((p) => p.id === userId) || memoryDb.profiles[0];
    const newId = 'req-' + Math.random().toString(36).substring(2, 9);
    const currentYear = new Date().getFullYear();
    const count = memoryDb.calibrationRequests.filter((r) => r.tenant_id === tenantId).length + 1;
    const requestNumber = `CAL-${currentYear}-${String(count).padStart(6, '0')}`;
    const timestamp = new Date().toISOString();

    const createdItems: RequestItem[] = data.items.map((itemInput, idx) => {
      const dbItem = memoryDb.items.find((i) => i.id === itemInput.item_id);
      return {
        id: `ri-${newId}-${idx + 1}`,
        request_id: newId,
        tenant_id: tenantId,
        item_id: itemInput.item_id,
        requested_quantity: itemInput.requested_quantity,
        item_available: itemInput.item_available,
        availability_remarks: itemInput.availability_remarks || null,
        availability_checked_by: user.id,
        availability_checked_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
        item: dbItem || null,
        checked_by_user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
        },
      };
    });

    const newRequest: CalibrationRequest = {
      id: newId,
      tenant_id: tenantId,
      organization_id: client.organization_id || null,
      sub_org_id: client.sub_org_id || null,
      request_number: requestNumber,
      client_id: data.client_id,
      collection_agent_id: user.id,
      collection_date: data.collection_date,
      priority: data.priority,
      status: 'CREATED',
      remarks: data.remarks || null,
      created_by: user.id,
      created_at: timestamp,
      updated_at: timestamp,
      client,
      collection_agent: user,
      created_by_user: user,
      organization: client.organization || null,
      sub_organization: client.sub_organization || null,
      items: createdItems,
      items_count: createdItems.reduce((acc, ri) => acc + ri.requested_quantity, 0),
      available_items_count: createdItems.filter((ri) => ri.item_available === 'YES').length,
      unavailable_items_count: createdItems.filter((ri) => ri.item_available === 'NO').length,
    };

    memoryDb.calibrationRequests.unshift(newRequest);
    createdItems.forEach((ri) => memoryDb.requestItems.push(ri));

    memoryDb.addAudit(tenantId, 'CREATE_CALIBRATION_REQUEST', 'calibration_requests', newId, {
      request_number: requestNumber,
      client_id: data.client_id,
      priority: data.priority,
      status: 'CREATED',
      items_count: createdItems.length,
    });

    memoryDb.notify();
    return newRequest;
  },

  async updateCalibrationRequest(
    id: string,
    tenantId: string,
    data: { priority?: CalibrationRequestPriority; collection_date?: string; remarks?: string | null }
  ): Promise<CalibrationRequest> {
    const index = memoryDb.calibrationRequests.findIndex((r) => r.id === id && r.tenant_id === tenantId);
    if (index === -1) throw new Error('Calibration request not found or access denied');

    const existing = memoryDb.calibrationRequests[index];
    if (existing.status === 'CANCELLED') throw new Error('Cannot update a cancelled request');

    const updated: CalibrationRequest = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };

    memoryDb.calibrationRequests[index] = updated;
    memoryDb.addAudit(tenantId, 'UPDATE_CALIBRATION_REQUEST', 'calibration_requests', id, updated, existing);
    memoryDb.notify();
    return updated;
  },

  async updateCalibrationRequestStatus(
    id: string,
    second: any,
    third?: any,
    fourth?: any
  ): Promise<CalibrationRequest> {
    const isDirectStatus = ['CREATED', 'COLLECTED', 'ON_HOLD', 'CANCELLED'].includes(second);
    const status: CalibrationRequestStatus = isDirectStatus ? second : third;
    const tenantId: string | undefined = isDirectStatus ? undefined : second;
    const remarks: string | null = isDirectStatus ? third : fourth;

    const index = memoryDb.calibrationRequests.findIndex(
      (r) => r.id === id && (!tenantId || r.tenant_id === tenantId)
    );
    if (index === -1) throw new Error('Calibration request not found or access denied');

    const existing = memoryDb.calibrationRequests[index];
    const updated: CalibrationRequest = {
      ...existing,
      status,
      remarks: remarks !== undefined ? remarks : existing.remarks,
      updated_at: new Date().toISOString(),
    };

    memoryDb.calibrationRequests[index] = updated;
    const action = status === 'CANCELLED' ? 'CANCEL_CALIBRATION_REQUEST' : 'UPDATE_CALIBRATION_REQUEST_STATUS';
    memoryDb.addAudit(existing.tenant_id, action, 'calibration_requests', id, { status, remarks }, { status: existing.status });
    memoryDb.notify();
    return updated;
  },

  async cancelCalibrationRequest(id: string, second?: string, third?: string): Promise<CalibrationRequest> {
    const isSecondTenantId = typeof second === 'string' && (/^[0-9a-fA-F-]{32,36}$/.test(second) || second.startsWith('t'));
    const tenantId = isSecondTenantId ? second : undefined;
    const remarks = isSecondTenantId ? third : second;
    if (tenantId) {
      return this.updateCalibrationRequestStatus(id, tenantId, 'CANCELLED', remarks);
    }
    return this.updateCalibrationRequestStatus(id, 'CANCELLED', remarks);
  },

  async getRequestItems(requestId: string, tenantId?: string): Promise<RequestItem[]> {
    return memoryDb.requestItems
      .filter((ri) => ri.request_id === requestId && (!tenantId || ri.tenant_id === tenantId))
      .map((ri) => ({
        ...ri,
        item: memoryDb.items.find((item) => item.id === ri.item_id) || ri.item,
      }));
  },

  // ----------------------------------------------------
  // LAB QUEUE & INTAKE (STEP 7)
  // ----------------------------------------------------
  async getLabQueue(
    tenantId: string,
    params?: {
      status?: string;
      priority?: string;
      clientId?: string;
      assignedTo?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      pageSize?: number;
    }
  ): Promise<{
    requests: CalibrationRequest[];
    metrics: {
      total_queue: number;
      urgent: number;
      unassigned: number;
      assigned: number;
      on_hold: number;
    };
    total: number;
  }> {
    let requests = memoryDb.calibrationRequests
      .filter((r) => r.tenant_id === tenantId)
      .map((r) => {
        const items = memoryDb.requestItems.filter((ri) => ri.request_id === r.id);
        const activeAssignment = memoryDb.labAssignments.find(
          (a) => a.request_id === r.id && a.status === 'ACTIVE'
        ) || null;
        const assignedUser = activeAssignment
          ? memoryDb.profiles.find((p) => p.id === activeAssignment.assigned_to)
          : null;
        const currentAssignment = activeAssignment
          ? {
              ...activeAssignment,
              assigned_to_user: assignedUser
                ? {
                    id: assignedUser.id,
                    full_name: assignedUser.full_name,
                    email: assignedUser.email,
                    role: assignedUser.role,
                  }
                : null,
            }
          : null;

        return {
          ...r,
          items,
          items_count: items.reduce((acc, ri) => acc + (ri.requested_quantity || 1), 0),
          available_items_count: items.filter((ri) => ri.item_available === 'YES').length,
          unavailable_items_count: items.filter((ri) => ri.item_available === 'NO').length,
          current_assignment: currentAssignment,
        };
      });

    // Default to queue statuses (LAB_QUEUE, VERIFICATION, ON_HOLD)
    if (params?.status && params.status !== 'ALL') {
      requests = requests.filter((r) => r.status === params.status);
    } else {
      requests = requests.filter((r) => ['LAB_QUEUE', 'VERIFICATION', 'ON_HOLD'].includes(r.status));
    }

    if (params?.priority && params.priority !== 'ALL') {
      requests = requests.filter((r) => r.priority === params.priority);
    }

    if (params?.clientId && params.clientId !== 'ALL') {
      requests = requests.filter((r) => r.client_id === params.clientId);
    }

    if (params?.assignedTo === 'UNASSIGNED') {
      requests = requests.filter((r) => !r.current_assignment);
    } else if (params?.assignedTo && params.assignedTo !== 'ALL') {
      requests = requests.filter((r) => r.current_assignment?.assigned_to === params.assignedTo);
    }

    if (params?.search && typeof params.search === 'string' && params.search.trim()) {
      const q = params.search.toLowerCase();
      requests = requests.filter(
        (r) =>
          r.request_number.toLowerCase().includes(q) ||
          r.client?.client_name?.toLowerCase().includes(q) ||
          r.client?.client_code?.toLowerCase().includes(q) ||
          r.current_assignment?.assigned_to_user?.full_name?.toLowerCase().includes(q) ||
          (r.items || []).some(
            (it) =>
              it.item?.item_code?.toLowerCase().includes(q) ||
              it.item?.item_name?.toLowerCase().includes(q) ||
              it.item?.serial_number?.toLowerCase().includes(q)
          )
      );
    }

    // Compute Metrics
    const total_queue = requests.length;
    const urgent = requests.filter((r) => r.priority === 'URGENT').length;
    const unassigned = requests.filter((r) => !r.current_assignment).length;
    const assigned = requests.filter((r) => !!r.current_assignment).length;
    const on_hold = requests.filter((r) => r.status === 'ON_HOLD').length;

    // Sorting
    const sortBy = params?.sortBy || 'created_at';
    const sortOrder = params?.sortOrder || 'desc';
    requests.sort((a: any, b: any) => {
      let aVal = a[sortBy] || '';
      let bVal = b[sortBy] || '';
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.max(1, params?.pageSize || 20);
    const paginated = requests.slice((page - 1) * pageSize, page * pageSize);

    return {
      requests: paginated,
      metrics: {
        total_queue,
        urgent,
        unassigned,
        assigned,
        on_hold,
      },
      total: requests.length,
    };
  },

  async getLabRequestDetails(requestId: string, tenantId: string): Promise<CalibrationRequest> {
    const request = memoryDb.calibrationRequests.find((r) => r.id === requestId && r.tenant_id === tenantId);
    if (!request) throw new Error('Calibration request not found in lab queue');

    const items = memoryDb.requestItems
      .filter((ri) => ri.request_id === requestId)
      .map((ri) => ({
        ...ri,
        item: memoryDb.items.find((it) => it.id === ri.item_id) || ri.item,
        checked_by_user: memoryDb.profiles.find((p) => p.id === ri.availability_checked_by) || null,
      }));

    const assignments = memoryDb.labAssignments
      .filter((a) => a.request_id === requestId && a.tenant_id === tenantId)
      .map((a) => {
        const assignedTo = memoryDb.profiles.find((p) => p.id === a.assigned_to);
        const assignedBy = memoryDb.profiles.find((p) => p.id === a.assigned_by);
        return {
          ...a,
          assigned_to_user: assignedTo
            ? { id: assignedTo.id, full_name: assignedTo.full_name, email: assignedTo.email, role: assignedTo.role }
            : null,
          assigned_by_user: assignedBy
            ? { id: assignedBy.id, full_name: assignedBy.full_name, email: assignedBy.email, role: assignedBy.role }
            : null,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const activeAssignment = assignments.find((a) => a.status === 'ACTIVE') || null;

    const statusHistory = memoryDb.statusHistory
      .filter((sh) => sh.request_id === requestId && sh.tenant_id === tenantId)
      .map((sh) => {
        const changedBy = memoryDb.profiles.find((p) => p.id === sh.changed_by);
        return {
          ...sh,
          changed_by_user: changedBy
            ? { id: changedBy.id, full_name: changedBy.full_name, email: changedBy.email, role: changedBy.role }
            : null,
        };
      })
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

    return {
      ...request,
      items,
      items_count: items.reduce((acc, ri) => acc + (ri.requested_quantity || 1), 0),
      available_items_count: items.filter((ri) => ri.item_available === 'YES').length,
      unavailable_items_count: items.filter((ri) => ri.item_available === 'NO').length,
      current_assignment: activeAssignment,
      assignments,
      status_history: statusHistory,
    };
  },

  async moveToLabQueue(
    requestId: string,
    tenantId: string,
    remarks?: string | null,
    userId?: string
  ): Promise<CalibrationRequest> {
    const index = memoryDb.calibrationRequests.findIndex((r) => r.id === requestId && r.tenant_id === tenantId);
    if (index === -1) throw new Error('Calibration request not found');

    const existing = memoryDb.calibrationRequests[index];
    if (existing.status === 'CANCELLED') throw new Error('Cancelled request cannot enter the Lab Queue');
    if (existing.status === 'LAB_QUEUE' || existing.status === 'VERIFICATION') {
      throw new Error(`Request is already in ${existing.status} stage`);
    }

    const items = memoryDb.requestItems.filter((ri) => ri.request_id === requestId);
    if (items.length === 0) throw new Error('Request must have at least one line item before entering Lab Queue');

    const previousStatus = existing.status;
    const newStatus: CalibrationRequestStatus = 'LAB_QUEUE';
    const timestamp = new Date().toISOString();
    const effectiveUserId = userId || 'usr-super-admin';

    const updated: CalibrationRequest = {
      ...existing,
      status: newStatus,
      updated_at: timestamp,
    };

    memoryDb.calibrationRequests[index] = updated;

    // Record status history
    memoryDb.statusHistory.unshift({
      id: `sh-${Date.now()}`,
      tenant_id: tenantId,
      request_id: requestId,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by: effectiveUserId,
      changed_at: timestamp,
      remarks: remarks || 'Transferred to Lab Queue for technician assignment and verification',
      created_at: timestamp,
    });

    memoryDb.addAudit(tenantId, 'MOVE_TO_LAB_QUEUE', 'calibration_requests', requestId, {
      request_number: existing.request_number,
      previous_status: previousStatus,
      new_status: newStatus,
      remarks,
    });

    memoryDb.notify();
    return updated;
  },

  async assignLabRequest(
    requestId: string,
    tenantId: string,
    assignedToUserId: string,
    remarks?: string | null,
    userId?: string
  ): Promise<LabRequestAssignment> {
    const request = memoryDb.calibrationRequests.find((r) => r.id === requestId && r.tenant_id === tenantId);
    if (!request) throw new Error('Calibration request not found');
    if (request.status === 'CANCELLED') throw new Error('Cannot assign a cancelled request');

    const targetUser = memoryDb.profiles.find((p) => p.id === assignedToUserId && p.tenant_id === tenantId);
    if (!targetUser) throw new Error('Target technician does not exist in this tenant');
    if (targetUser.status !== 'active') throw new Error('Cannot assign to an inactive technician');

    // Mark previous active assignment as REASSIGNED if present
    const existingActive = memoryDb.labAssignments.find(
      (a) => a.request_id === requestId && a.tenant_id === tenantId && a.status === 'ACTIVE'
    );
    if (existingActive) {
      existingActive.status = 'REASSIGNED';
      existingActive.updated_at = new Date().toISOString();
    }

    const timestamp = new Date().toISOString();
    const effectiveUserId = userId || 'usr-super-admin';

    const newAssignment: LabRequestAssignment = {
      id: `asgn-${Date.now()}`,
      tenant_id: tenantId,
      request_id: requestId,
      assigned_to: assignedToUserId,
      assigned_by: effectiveUserId,
      assigned_at: timestamp,
      status: 'ACTIVE',
      remarks: remarks || null,
      created_at: timestamp,
      updated_at: timestamp,
      assigned_to_user: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        email: targetUser.email,
        role: targetUser.role,
      },
    };

    memoryDb.labAssignments.unshift(newAssignment);

    memoryDb.addAudit(tenantId, 'LAB_ASSIGN_REQUEST', 'lab_request_assignments', newAssignment.id, {
      request_number: request.request_number,
      assigned_to: targetUser.full_name,
      assigned_to_id: targetUser.id,
      remarks,
    });

    memoryDb.notify();
    return newAssignment;
  },

  async reassignLabRequest(
    requestId: string,
    tenantId: string,
    newAssignedToUserId: string,
    remarks: string,
    userId?: string
  ): Promise<LabRequestAssignment> {
    const request = memoryDb.calibrationRequests.find((r) => r.id === requestId && r.tenant_id === tenantId);
    if (!request) throw new Error('Calibration request not found');

    const newAssignee = memoryDb.profiles.find((p) => p.id === newAssignedToUserId && p.tenant_id === tenantId);
    if (!newAssignee) throw new Error('Selected technician does not exist in this tenant');

    const prevAssignment = memoryDb.labAssignments.find(
      (a) => a.request_id === requestId && a.tenant_id === tenantId && a.status === 'ACTIVE'
    );
    if (prevAssignment) {
      prevAssignment.status = 'REASSIGNED';
      prevAssignment.remarks = `Reassigned: ${remarks}`;
      prevAssignment.updated_at = new Date().toISOString();
    }

    const timestamp = new Date().toISOString();
    const effectiveUserId = userId || 'usr-super-admin';

    const newAssignment: LabRequestAssignment = {
      id: `asgn-${Date.now()}`,
      tenant_id: tenantId,
      request_id: requestId,
      assigned_to: newAssignedToUserId,
      assigned_by: effectiveUserId,
      assigned_at: timestamp,
      status: 'ACTIVE',
      remarks,
      created_at: timestamp,
      updated_at: timestamp,
      assigned_to_user: {
        id: newAssignee.id,
        full_name: newAssignee.full_name,
        email: newAssignee.email,
        role: newAssignee.role,
      },
    };

    memoryDb.labAssignments.unshift(newAssignment);

    memoryDb.addAudit(tenantId, 'LAB_REASSIGN_REQUEST', 'lab_request_assignments', newAssignment.id, {
      request_number: request.request_number,
      new_assigned_to: newAssignee.full_name,
      reassignment_reason: remarks,
    });

    memoryDb.notify();
    return newAssignment;
  },

  async acceptLabRequest(requestId: string, tenantId: string, userId: string): Promise<void> {
    const request = memoryDb.calibrationRequests.find((r) => r.id === requestId && r.tenant_id === tenantId);
    if (!request) throw new Error('Calibration request not found');

    const activeAssign = memoryDb.labAssignments.find(
      (a) => a.request_id === requestId && a.tenant_id === tenantId && a.status === 'ACTIVE'
    );

    const user = memoryDb.profiles.find((p) => p.id === userId);
    const isAssigned = activeAssign && activeAssign.assigned_to === userId;
    const isSuperOrAdmin = user && (user.role === 'tenant_admin' || user.role === 'super_admin' || user.role === 'manager');

    if (!isAssigned && !isSuperOrAdmin) {
      throw new Error('Only the assigned technician or an authorized manager can accept this request');
    }

    memoryDb.addAudit(tenantId, 'LAB_ACCEPT_REQUEST', 'calibration_requests', requestId, {
      request_number: request.request_number,
      accepted_by: user?.full_name || userId,
      accepted_at: new Date().toISOString(),
    });

    memoryDb.notify();
  },

  async startVerification(
    requestId: string,
    tenantId: string,
    userId: string
  ): Promise<CalibrationRequest> {
    const index = memoryDb.calibrationRequests.findIndex((r) => r.id === requestId && r.tenant_id === tenantId);
    if (index === -1) throw new Error('Calibration request not found');

    const existing = memoryDb.calibrationRequests[index];
    if (existing.status !== 'LAB_QUEUE' && existing.status !== 'ON_HOLD') {
      throw new Error(`Invalid transition: Request must be in LAB_QUEUE to start verification (currently: ${existing.status})`);
    }

    const previousStatus = existing.status;
    const newStatus: CalibrationRequestStatus = 'VERIFICATION';
    const timestamp = new Date().toISOString();

    const updated: CalibrationRequest = {
      ...existing,
      status: newStatus,
      updated_at: timestamp,
    };

    memoryDb.calibrationRequests[index] = updated;

    memoryDb.statusHistory.unshift({
      id: `sh-${Date.now()}`,
      tenant_id: tenantId,
      request_id: requestId,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by: userId,
      changed_at: timestamp,
      remarks: 'Intake verified and ready for laboratory verification stage',
      created_at: timestamp,
    });

    memoryDb.addAudit(tenantId, 'LAB_START_VERIFICATION', 'calibration_requests', requestId, {
      request_number: existing.request_number,
      previous_status: previousStatus,
      new_status: newStatus,
    });

    memoryDb.notify();
    return updated;
  },

  async holdLabRequest(
    requestId: string,
    tenantId: string,
    holdReason: string,
    userId: string
  ): Promise<CalibrationRequest> {
    if (!holdReason || holdReason.trim().length < 3) {
      throw new Error('Hold reason is mandatory (at least 3 characters)');
    }

    const index = memoryDb.calibrationRequests.findIndex((r) => r.id === requestId && r.tenant_id === tenantId);
    if (index === -1) throw new Error('Calibration request not found');

    const existing = memoryDb.calibrationRequests[index];
    if (existing.status === 'CANCELLED') throw new Error('Cannot put a cancelled request on hold');

    const previousStatus = existing.status;
    const newStatus: CalibrationRequestStatus = 'ON_HOLD';
    const timestamp = new Date().toISOString();

    const updated: CalibrationRequest = {
      ...existing,
      status: newStatus,
      remarks: holdReason.trim(),
      updated_at: timestamp,
    };

    memoryDb.calibrationRequests[index] = updated;

    memoryDb.statusHistory.unshift({
      id: `sh-${Date.now()}`,
      tenant_id: tenantId,
      request_id: requestId,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by: userId,
      changed_at: timestamp,
      remarks: holdReason.trim(),
      created_at: timestamp,
    });

    memoryDb.addAudit(tenantId, 'LAB_HOLD_REQUEST', 'calibration_requests', requestId, {
      request_number: existing.request_number,
      previous_status: previousStatus,
      new_status: newStatus,
      hold_reason: holdReason.trim(),
    });

    memoryDb.notify();
    return updated;
  },

  async getTenantLabUsers(tenantId: string): Promise<UserProfile[]> {
    return memoryDb.profiles.filter(
      (p) =>
        p.tenant_id === tenantId &&
        ['lab_user', 'tenant_admin', 'manager', 'org_admin'].includes(p.role) &&
        p.status === 'active'
    );
  },

  async getLabAssignments(requestId: string, tenantId: string): Promise<LabRequestAssignment[]> {
    return memoryDb.labAssignments
      .filter((a) => a.request_id === requestId && a.tenant_id === tenantId)
      .map((a) => {
        const assignedTo = memoryDb.profiles.find((p) => p.id === a.assigned_to);
        const assignedBy = memoryDb.profiles.find((p) => p.id === a.assigned_by);
        return {
          ...a,
          assigned_to_user: assignedTo
            ? { id: assignedTo.id, full_name: assignedTo.full_name, email: assignedTo.email, role: assignedTo.role }
            : null,
          assigned_by_user: assignedBy
            ? { id: assignedBy.id, full_name: assignedBy.full_name, email: assignedBy.email, role: assignedBy.role }
            : null,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getRequestStatusHistory(requestId: string, tenantId: string): Promise<RequestStatusHistory[]> {
    return memoryDb.statusHistory
      .filter((sh) => sh.request_id === requestId && sh.tenant_id === tenantId)
      .map((sh) => {
        const changedBy = memoryDb.profiles.find((p) => p.id === sh.changed_by);
        return {
          ...sh,
          changed_by_user: changedBy
            ? { id: changedBy.id, full_name: changedBy.full_name, email: changedBy.email, role: changedBy.role }
            : null,
        };
      })
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  },

  // ----------------------------------------------------
  // AUDIT LOGS
  // ----------------------------------------------------
  async getAuditLogs(tenantId: string, isSuperAdmin: boolean): Promise<AuditLog[]> {
    if (isSuperAdmin) {
      return [...memoryDb.auditLogs];
    }
    return memoryDb.auditLogs.filter((l) => l.tenant_id === tenantId);
  },

  // ----------------------------------------------------
  // CLOUDFLARE R2 SIGNED URL GENERATION
  // ----------------------------------------------------
  async getR2SignedUrl(fileName: string, category = 'certificates') {
    try {
      const response = await fetch(`${API_BASE}/storage/signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, category }),
      });
      if (!response.ok) throw new Error('Failed to generate signed URL from API Gateway');
      return await response.json();
    } catch {
      return {
        success: true,
        data: {
          objectKey: `tenants/mock-tenant/${category}/${Date.now()}_${fileName}`,
          uploadUrl: `https://storage.ccm.internal/upload/${fileName}`,
          signedDownloadUrl: `https://storage.ccm.internal/download/${fileName}?signature=mock-token`,
        },
      };
    }
  },
  // ----------------------------------------------------
  // STEP 8: ITEM VERIFICATION + PROOF + MANDATORY DOCUMENTS
  // ----------------------------------------------------
  async getVerificationQueue(
    tenantId: string,
    options?: { search?: string; status?: string }
  ): Promise<VerificationQueueItem[]> {
    // If super admin or matching tenant
    const requests = memoryDb.calibrationRequests.filter(
      (r) => (r.tenant_id === tenantId || tenantId === 'all') && (options?.status ? r.status === options.status : ['VERIFICATION', 'LAB_QUEUE', 'VERIFIED'].includes(r.status))
    );

    const queueItems: VerificationQueueItem[] = requests.map((req) => {
      const items = memoryDb.requestItems.filter((ri) => ri.request_id === req.id);
      const reqVerifications = memoryDb.verifications.filter(
        (v) => v.request_id === req.id && (tenantId === 'all' || v.tenant_id === req.tenant_id)
      );
      const reqDocs = memoryDb.documents.filter(
        (d) => d.request_id === req.id && (tenantId === 'all' || d.tenant_id === req.tenant_id)
      );

      const totalItems = items.length;
      const verifiedItems = items.filter((ri) => reqVerifications.some((v) => v.request_item_id === ri.id)).length;
      const discrepantItems = reqVerifications.filter((v) => v.verification_result === 'DISCREPANCY' || v.verification_result === 'SHORT').length;
      const mandatoryDocs = reqDocs.filter((d) => d.mandatory).length;
      const canComplete = totalItems > 0 && verifiedItems === totalItems && mandatoryDocs > 0;

      const client = memoryDb.clients.find((c) => c.id === req.client_id) || req.client || null;
      const org = memoryDb.organizations.find((o) => o.id === req.organization_id) || req.organization || null;

      return {
        id: req.id,
        tenant_id: req.tenant_id,
        request_number: req.request_number,
        priority: req.priority,
        status: req.status,
        collection_date: req.collection_date,
        client_name: client?.client_name || 'Unknown Client',
        organization_name: org?.name || 'Central Metrology',
        total_items: totalItems,
        verified_items: verifiedItems,
        discrepant_items: discrepantItems,
        mandatory_documents_count: mandatoryDocs,
        total_documents_count: reqDocs.length,
        can_complete: canComplete,
        created_at: req.created_at,
        updated_at: req.updated_at,
      };
    });

    if (options?.search) {
      const q = options.search.toLowerCase();
      return queueItems.filter(
        (item) =>
          item.request_number.toLowerCase().includes(q) ||
          item.client_name.toLowerCase().includes(q) ||
          item.organization_name.toLowerCase().includes(q)
      );
    }

    return queueItems.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  },

  async getRequestVerificationDetails(requestId: string, tenantId: string) {
    const request = memoryDb.calibrationRequests.find(
      (r) => r.id === requestId && (tenantId === 'all' || r.tenant_id === tenantId)
    );
    if (!request) {
      throw new Error(`Calibration request not found: ${requestId}`);
    }

    const items = memoryDb.requestItems.filter((ri) => ri.request_id === requestId);
    const verifications = memoryDb.verifications.filter((v) => v.request_id === requestId);
    const documents = memoryDb.documents
      .filter((d) => d.request_id === requestId)
      .map((doc) => {
        const uploader = memoryDb.profiles.find((p) => p.id === doc.uploaded_by);
        return {
          ...doc,
          uploaded_by_user: uploader
            ? { id: uploader.id, full_name: uploader.full_name, email: uploader.email, role: uploader.role }
            : null,
        };
      })
      .sort((a, b) => b.version - a.version);

    const client = memoryDb.clients.find((c) => c.id === request.client_id) || request.client || null;
    const org = memoryDb.organizations.find((o) => o.id === request.organization_id) || request.organization || null;
    const subOrg = memoryDb.subOrganizations.find((s) => s.id === request.sub_org_id) || request.sub_organization || null;
    const agent = memoryDb.profiles.find((p) => p.id === request.collection_agent_id) || request.collection_agent || null;

    const itemsWithDetails = items.map((item) => {
      const itemMaster = memoryDb.items.find((im) => im.id === item.item_id) || item.item;
      const verification = verifications.find((v) => v.request_item_id === item.id) || null;
      let verifier = null;
      if (verification) {
        const p = memoryDb.profiles.find((pr) => pr.id === verification.verified_by);
        if (p) {
          verifier = { id: p.id, full_name: p.full_name, email: p.email, role: p.role };
        }
      }

      return {
        ...item,
        item: itemMaster,
        verification: verification ? { ...verification, verified_by_user: verifier } : null,
      };
    });

    const totalItems = itemsWithDetails.length;
    const verifiedItems = itemsWithDetails.filter((i) => i.verification !== null).length;
    const mandatoryDocs = documents.filter((d) => d.mandatory).length;
    const canComplete = totalItems > 0 && verifiedItems === totalItems && mandatoryDocs > 0;

    return {
      request: {
        ...request,
        client,
        organization: org,
        sub_organization: subOrg,
        collection_agent: agent,
      },
      items: itemsWithDetails,
      documents,
      verifications,
      stats: {
        total_items: totalItems,
        verified_items: verifiedItems,
        pending_items: totalItems - verifiedItems,
        mandatory_documents_count: mandatoryDocs,
        total_documents_count: documents.length,
        can_complete: canComplete,
      },
    };
  },

  async submitItemVerification(data: {
    tenantId: string;
    requestId: string;
    requestItemId: string;
    verifiedBy: string;
    itemMatchStatus: ItemMatchStatus;
    serialMatchStatus: SerialMatchStatus;
    receivedQuantity: number;
    quantityStatus: QuantityStatus;
    conditionStatus: ConditionStatus;
    verificationResult: VerificationResult;
    discrepancyReason?: string | null;
    remarks?: string | null;
  }): Promise<Verification> {
    const existingIndex = memoryDb.verifications.findIndex(
      (v) => v.tenant_id === data.tenantId && v.request_item_id === data.requestItemId
    );

    const now = new Date().toISOString();
    const verifier = memoryDb.profiles.find((p) => p.id === data.verifiedBy);

    const verificationRecord: Verification = {
      id: existingIndex >= 0 ? memoryDb.verifications[existingIndex].id : `ver-${Date.now()}`,
      tenant_id: data.tenantId,
      request_id: data.requestId,
      request_item_id: data.requestItemId,
      verified_by: data.verifiedBy,
      verified_at: now,
      item_match_status: data.itemMatchStatus,
      serial_match_status: data.serialMatchStatus,
      received_quantity: data.receivedQuantity,
      quantity_status: data.quantityStatus,
      condition_status: data.conditionStatus,
      verification_result: data.verificationResult,
      discrepancy_reason: data.discrepancyReason || null,
      remarks: data.remarks || null,
      created_at: existingIndex >= 0 ? memoryDb.verifications[existingIndex].created_at : now,
      updated_at: now,
      verified_by_user: verifier
        ? { id: verifier.id, full_name: verifier.full_name, email: verifier.email, role: verifier.role }
        : null,
    };

    if (existingIndex >= 0) {
      memoryDb.verifications[existingIndex] = verificationRecord;
    } else {
      memoryDb.verifications.push(verificationRecord);
    }

    // Add audit log
    memoryDb.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      tenant_id: data.tenantId,
      user_id: data.verifiedBy,
      action: 'VERIFICATION_SUBMITTED',
      resource_type: 'verifications',
      resource_id: verificationRecord.id,
      new_values: {
        request_id: data.requestId,
        request_item_id: data.requestItemId,
        result: data.verificationResult,
        condition: data.conditionStatus,
      },
      ip_address: '127.0.0.1',
      created_at: now,
    });

    return verificationRecord;
  },

  async completeRequestVerification(
    requestId: string,
    tenantId: string,
    completedBy: string,
    remarks?: string
  ): Promise<CalibrationRequest> {
    const request = memoryDb.calibrationRequests.find(
      (r) => r.id === requestId && (tenantId === 'all' || r.tenant_id === tenantId)
    );
    if (!request) throw new Error('Calibration request not found');

    const items = memoryDb.requestItems.filter((ri) => ri.request_id === requestId);
    const verifications = memoryDb.verifications.filter((v) => v.request_id === requestId);
    const documents = memoryDb.documents.filter((d) => d.request_id === requestId && d.mandatory);

    if (verifications.length < items.length) {
      throw new Error(`Cannot complete verification: Only ${verifications.length}/${items.length} items verified`);
    }

    if (documents.length === 0) {
      throw new Error('Cannot complete verification: At least one mandatory proof document must be uploaded');
    }

    const now = new Date().toISOString();
    const prevStatus = request.status;
    request.status = 'VERIFIED';
    request.updated_at = now;

    // Record status history
    const user = memoryDb.profiles.find((p) => p.id === completedBy);
    memoryDb.statusHistory.unshift({
      id: `sh-${Date.now()}`,
      tenant_id: request.tenant_id,
      request_id: requestId,
      previous_status: prevStatus,
      new_status: 'VERIFIED',
      changed_by: completedBy,
      changed_at: now,
      remarks: remarks || 'All items verified and mandatory proof documents validated.',
      created_at: now,
      changed_by_user: user
        ? { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
        : null,
    });

    // Add audit log
    memoryDb.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      tenant_id: request.tenant_id,
      user_id: completedBy,
      action: 'REQUEST_VERIFIED',
      resource_type: 'calibration_requests',
      resource_id: requestId,
      old_values: { status: prevStatus },
      new_values: { status: 'VERIFIED', remarks },
      ip_address: '127.0.0.1',
      created_at: now,
    });

    return request;
  },

  async getUploadUrl(data: {
    tenantId: string;
    requestId: string;
    itemId?: string;
    requestItemId?: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    documentType: DocumentType;
    mandatory?: boolean;
  }) {
    const timestamp = Date.now();
    const safeName = data.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageReference = `tenants/${data.tenantId}/requests/${data.requestId}/${data.documentType}_${timestamp}_${safeName}`;

    return {
      uploadUrl: `https://mock-r2-storage.ccm.internal/upload?key=${encodeURIComponent(storageReference)}`,
      storageReference,
      fileName: data.fileName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      documentType: data.documentType,
      mandatory: data.mandatory ?? false,
    };
  },

  async confirmDocumentUpload(data: {
    tenantId: string;
    requestId: string;
    itemId?: string;
    requestItemId?: string;
    documentType: DocumentType;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageReference: string;
    mandatory?: boolean;
    uploadedBy: string;
  }): Promise<DocumentItem> {
    const existing = memoryDb.documents.filter(
      (d) => d.tenant_id === data.tenantId && d.request_id === data.requestId && d.document_type === data.documentType
    );
    const nextVersion = existing.length > 0 ? Math.max(...existing.map((e) => e.version)) + 1 : 1;

    const now = new Date().toISOString();
    const uploader = memoryDb.profiles.find((p) => p.id === data.uploadedBy);

    const doc: DocumentItem = {
      id: `doc-${Date.now()}`,
      tenant_id: data.tenantId,
      request_id: data.requestId,
      item_id: data.itemId || null,
      request_item_id: data.requestItemId || null,
      document_type: data.documentType,
      file_name: data.fileName,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      storage_reference: data.storageReference,
      mandatory: data.mandatory ?? false,
      uploaded_by: data.uploadedBy,
      uploaded_at: now,
      version: nextVersion,
      created_at: now,
      updated_at: now,
      uploaded_by_user: uploader
        ? { id: uploader.id, full_name: uploader.full_name, email: uploader.email, role: uploader.role }
        : null,
    };

    memoryDb.documents.unshift(doc);

    // Audit log
    memoryDb.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      tenant_id: data.tenantId,
      user_id: data.uploadedBy,
      action: 'DOCUMENT_UPLOADED',
      resource_type: 'documents',
      resource_id: doc.id,
      new_values: {
        request_id: data.requestId,
        file_name: data.fileName,
        document_type: data.documentType,
        version: nextVersion,
        mandatory: data.mandatory,
      },
      ip_address: '127.0.0.1',
      created_at: now,
    });

    return doc;
  },

  async getDocuments(tenantId: string, requestId: string, documentType?: DocumentType): Promise<DocumentItem[]> {
    return memoryDb.documents
      .filter((d) => (tenantId === 'all' || d.tenant_id === tenantId) && d.request_id === requestId && (!documentType || d.document_type === documentType))
      .map((d) => {
        const uploader = memoryDb.profiles.find((p) => p.id === d.uploaded_by);
        return {
          ...d,
          uploaded_by_user: uploader
            ? { id: uploader.id, full_name: uploader.full_name, email: uploader.email, role: uploader.role }
            : null,
        };
      })
      .sort((a, b) => b.version - a.version);
  },

  async getDocumentDownloadUrl(documentId: string, tenantId: string) {
    const doc = memoryDb.documents.find((d) => d.id === documentId && (tenantId === 'all' || d.tenant_id === tenantId));
    if (!doc) throw new Error('Document not found');
    return {
      downloadUrl: `https://storage.ccm.internal/download/${encodeURIComponent(doc.storage_reference)}?sig=mock-presigned-token`,
      document: doc,
    };
  },

  async deleteDocument(documentId: string, tenantId: string, deletedBy = 'usr-current') {
    const index = memoryDb.documents.findIndex((d) => d.id === documentId && (tenantId === 'all' || d.tenant_id === tenantId));
    if (index === 0 || index > 0) {
      const doc = memoryDb.documents[index];
      memoryDb.documents.splice(index, 1);

      memoryDb.auditLogs.unshift({
        id: `audit-${Date.now()}`,
        tenant_id: doc.tenant_id,
        user_id: deletedBy,
        action: 'DOCUMENT_DELETED',
        resource_type: 'documents',
        resource_id: documentId,
        new_values: { file_name: doc.file_name, document_type: doc.document_type },
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString(),
      });
      return { success: true };
    }
    throw new Error('Document not found');
  },
};
