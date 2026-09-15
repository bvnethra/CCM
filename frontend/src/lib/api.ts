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
  Calibration,
  CalibrationMeasurement,
  Certificate,
  CalibrationQueueItem,
  DueListItem,
  CalibrationResult,
  CalibrationStatus,
  MeasurementResult,
  DueStatus,
  ServiceRequest,
  ServiceApproval,
  ServiceStatus,
  VendorOutsourceRequest,
  PurchaseOrder,
  POItem,
  VendorOutsourceMovement,
  VendorCalibrationRecord,
  VendorCalibrationResult,
  Quotation,
  QuotationItem,
  QuotationApproval,
  Invoice,
  InvoiceItem,
  InvoiceType,
  Signature,
  InvoiceSignatureRequest,
  Dispatch,
  DispatchItem,
  Delivery,
  DashboardSummary,
  WorkflowFunnelItem,
  OperationException,
  DueCalibrationItem,
  RequestTimelineEvent,
  ItemProgressRow,
  GlobalSearchResult,
  AuditLogRow,
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
  initialCalibrations,
  initialCalibrationMeasurements,
  initialCertificates,
  initialServiceRequests,
  initialServiceApprovals,
  initialVendorOutsourceRequests,
  initialPurchaseOrders,
  initialPOItems,
  initialVendorOutsourceMovements,
  initialVendorCalibrationRecords,
  initialQuotations,
  initialQuotationItems,
  initialQuotationApprovals,
  initialInvoices,
  initialInvoiceItems,
  initialInvoiceSignatureRequests,
  initialSignatures,
  initialDispatches,
  initialDispatchItems,
  initialDeliveries,
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
  calibrations: Calibration[] = [...initialCalibrations];
  calibrationMeasurements: CalibrationMeasurement[] = [...initialCalibrationMeasurements];
  certificates: Certificate[] = [...initialCertificates];
  serviceRequests: ServiceRequest[] = [...initialServiceRequests];
  serviceApprovals: ServiceApproval[] = [...initialServiceApprovals];
  vendorOutsourceRequests: VendorOutsourceRequest[] = [...initialVendorOutsourceRequests];
  purchaseOrders: PurchaseOrder[] = [...initialPurchaseOrders];
  poItems: POItem[] = [...initialPOItems];
  vendorOutsourceMovements: VendorOutsourceMovement[] = [...initialVendorOutsourceMovements];
  vendorCalibrationRecords: VendorCalibrationRecord[] = [...initialVendorCalibrationRecords];
  quotations: Quotation[] = [...initialQuotations];
  quotationItems: QuotationItem[] = [...initialQuotationItems];
  quotationApprovals: QuotationApproval[] = [...initialQuotationApprovals];
  invoices: Invoice[] = [...initialInvoices];
  invoiceItems: InvoiceItem[] = [...initialInvoiceItems];
  signatureRequests: InvoiceSignatureRequest[] = [...initialInvoiceSignatureRequests];
  signatures: Signature[] = [...initialSignatures];
  dispatches: Dispatch[] = [...initialDispatches];
  dispatchItems: DispatchItem[] = [...initialDispatchItems];
  deliveries: Delivery[] = [...initialDeliveries];
  auditLogs: AuditLog[] = [...initialAuditLogs];
  profiles: UserProfile[] = [...demoProfiles];
  roles: Role[] = [...initialRoles];
  permissions: Permission[] = [...initialPermissions];
  rolePermissions: Record<string, string[]> = { ...initialRolePermissions };
  userRoles: Record<string, string[]> = {
    'usr-super-admin': ['role-01'],
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

  async createTenant(data: any): Promise<Tenant> {
    const newTenantId = 'ten-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: created, error } = await supabase.from('tenants').insert({
          name: data.name,
          code: data.code.toUpperCase(),
          status: data.status,
          settings: {
            timezone: data.timezone || 'Asia/Kolkata',
            currency: data.currency || 'INR',
            complianceStandard: data.complianceStandard || 'ISO/IEC 17025',
            tenant_type: data.tenant_type,
            registration_number: data.registration_number,
            gst_number: data.gst_number,
            tenant_email: data.tenant_email,
            tenant_phone: data.tenant_phone,
            address_line_1: data.address_line_1,
            address_line_2: data.address_line_2,
            city: data.city,
            state: data.state,
            country: data.country,
            postal_code: data.postal_code,
            admin_name: data.admin_name,
            admin_email: data.admin_email,
          },
        }).select().single();
        if (!error && created) return created;
      } catch (err) {
        console.warn('Supabase createTenant fallback:', err);
      }
    }

    const newTenant: Tenant = {
      id: newTenantId,
      name: data.name,
      code: data.code.toUpperCase(),
      status: data.status,
      tenant_type: data.tenant_type,
      registration_number: data.registration_number,
      gst_number: data.gst_number,
      tenant_email: data.tenant_email,
      tenant_phone: data.tenant_phone,
      address_line_1: data.address_line_1,
      address_line_2: data.address_line_2,
      city: data.city,
      state: data.state,
      country: data.country,
      postal_code: data.postal_code,
      admin_name: data.admin_name,
      admin_email: data.admin_email,
      admin_password: data.admin_password,
      settings: {
        timezone: data.timezone || 'Asia/Kolkata',
        currency: data.currency || 'INR',
        complianceStandard: data.complianceStandard || 'ISO/IEC 17025',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organizations_count: 0,
    };

    memoryDb.tenants.unshift(newTenant);

    if (data.admin_email && data.admin_name) {
      const adminUser: UserProfile = {
        id: 'usr-admin-' + data.code.toLowerCase(),
        tenant_id: newTenantId,
        full_name: data.admin_name,
        email: data.admin_email,
        phone: data.tenant_phone || '+91 98765 43210',
        role: 'tenant_admin',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryDb.profiles.unshift(adminUser);
      demoProfiles.unshift(adminUser);
    }

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

  // ============================================================================
  // STEP 9: CALIBRATION API METHODS
  // ============================================================================
  async getCalibrationQueue(
    tenantId: string,
    params: { status?: string; priority?: string; search?: string; page?: number; pageSize?: number } = {}
  ) {
    if (isSupabaseConfigured) {
      try {
        const queryParams = new URLSearchParams();
        if (params.status) queryParams.set('status', params.status);
        if (params.priority) queryParams.set('priority', params.priority);
        if (params.search) queryParams.set('search', params.search);
        if (params.page) queryParams.set('page', String(params.page));
        if (params.pageSize) queryParams.set('pageSize', String(params.pageSize));

        const res = await fetch(`${API_BASE}/calibrations?${queryParams.toString()}`, {
          headers: { 'x-tenant-id': tenantId },
        });
        const json = await res.json();
        if (json.success) return json.data;
      } catch (err) {
        console.warn('API Gateway failed, using fallback store:', err);
      }
    }

    // In-memory fallback
    const verified = memoryDb.verifications.filter(
      (v) => (tenantId === 'all' || v.tenant_id === tenantId) && v.verification_result === 'VERIFIED'
    );

    let items: CalibrationQueueItem[] = verified.map((v) => {
      const req = memoryDb.calibrationRequests.find((r) => r.id === v.request_id);
      const client = req ? memoryDb.clients.find((c) => c.id === req.client_id) || null : null;
      const reqItem = memoryDb.requestItems.find((ri) => ri.id === v.request_item_id);
      const itemMaster = reqItem ? memoryDb.items.find((i) => i.id === reqItem.item_id) || null : null;
      const cal = memoryDb.calibrations.find((c) => c.request_item_id === v.request_item_id && (tenantId === 'all' || c.tenant_id === tenantId)) || null;

      const verifier = memoryDb.profiles.find((p) => p.id === v.verified_by);

      return {
        request_id: v.request_id,
        request_number: req?.request_number || 'N/A',
        priority: req?.priority || 'NORMAL',
        client,
        request_item_id: v.request_item_id,
        item_id: reqItem?.item_id || '',
        item_code: itemMaster?.item_code || 'N/A',
        item_name: itemMaster?.item_name || 'N/A',
        serial_number: itemMaster?.serial_number || 'N/A',
        verification_result: v.verification_result,
        verified_by: verifier?.full_name || 'System',
        calibration: cal,
        calibration_status: cal ? cal.status : 'PENDING',
        calibration_result: cal ? cal.result : null,
        created_at: v.verified_at,
      };
    });

    if (params.status && params.status !== 'ALL') {
      items = items.filter((i) => i.calibration_status === params.status);
    }
    if (params.priority && params.priority !== 'ALL') {
      items = items.filter((i) => i.priority === params.priority);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (i) =>
          i.request_number.toLowerCase().includes(q) ||
          i.item_code.toLowerCase().includes(q) ||
          i.item_name.toLowerCase().includes(q) ||
          i.serial_number.toLowerCase().includes(q) ||
          (i.client?.client_name || '').toLowerCase().includes(q)
      );
    }

    const total = items.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      metrics: {
        total_eligible: verified.length,
        pending: items.filter((i) => i.calibration_status === 'PENDING').length,
        in_progress: items.filter((i) => i.calibration_status === 'IN_PROGRESS').length,
        completed: items.filter((i) => i.calibration_status === 'COMPLETED').length,
        failed: items.filter((i) => i.calibration_status === 'FAILED').length,
        not_calibratable: items.filter((i) => i.calibration_status === 'NOT_CALIBRATABLE').length,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  },

  async getCalibrationWorkspace(requestItemId: string, tenantId: string) {
    if (isSupabaseConfigured) {
      try {
        const res = await fetch(`${API_BASE}/calibrations/${requestItemId}`, {
          headers: { 'x-tenant-id': tenantId },
        });
        const json = await res.json();
        if (json.success) return json.data;
      } catch (err) {
        console.warn('API Gateway failed, using fallback store:', err);
      }
    }

    const reqItem = memoryDb.requestItems.find((ri) => ri.id === requestItemId);
    if (!reqItem) throw new Error('Request item not found');

    const item = memoryDb.items.find((i) => i.id === reqItem.item_id) || null;
    const req = memoryDb.calibrationRequests.find((r) => r.id === reqItem.request_id);
    const client = req ? memoryDb.clients.find((c) => c.id === req.client_id) || null : null;
    const verif = memoryDb.verifications.find((v) => v.request_item_id === requestItemId) || null;
    const docs = memoryDb.documents.filter((d) => d.request_id === reqItem.request_id);

    const calibration = memoryDb.calibrations.find((c) => c.request_item_id === requestItemId) || null;
    let measurements: CalibrationMeasurement[] = [];
    let certificates: Certificate[] = [];

    if (calibration) {
      measurements = memoryDb.calibrationMeasurements.filter((m) => m.calibration_id === calibration.id);
      certificates = memoryDb.certificates.filter((c) => c.calibration_id === calibration.id);
    }

    return {
      request_item: {
        ...reqItem,
        item,
        request: req ? { ...req, client } : null,
      },
      verification: verif,
      documents: docs,
      calibration,
      measurements,
      certificates,
    };
  },

  async startCalibration(
    tenantId: string,
    data: { request_id: string; request_item_id: string; item_id: string; calibration_method?: string; environmental_conditions?: string },
    user = 'usr-current'
  ) {
    if (isSupabaseConfigured) {
      try {
        const res = await fetch(`${API_BASE}/calibrations/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) return json.data;
        throw new Error(json.error || 'Failed to start calibration');
      } catch (err: any) {
        if (!err.message?.includes('fetch')) throw err;
      }
    }

    // Fallback store logic
    const verif = memoryDb.verifications.find((v) => v.request_item_id === data.request_item_id);
    if (!verif || verif.verification_result !== 'VERIFIED') {
      throw new Error(`Item is not verified (${verif?.verification_result || 'UNVERIFIED'}). Only VERIFIED items can start calibration.`);
    }

    const existing = memoryDb.calibrations.find((c) => c.request_item_id === data.request_item_id);
    if (existing) {
      throw new Error(`Calibration already exists for this item (Status: ${existing.status}).`);
    }

    const now = new Date().toISOString();
    const newCal: Calibration = {
      id: `cal-${Date.now()}`,
      tenant_id: tenantId,
      request_id: data.request_id,
      request_item_id: data.request_item_id,
      item_id: data.item_id,
      calibrated_by: user,
      calibration_started_at: now,
      calibration_method: data.calibration_method || 'Standard Direct Comparison Metrology',
      environmental_conditions: data.environmental_conditions || 'Temperature: 23°C ± 2°C, Humidity: 50% ± 10% RH',
      result: 'PASS',
      status: 'IN_PROGRESS',
      created_at: now,
      updated_at: now,
    };

    memoryDb.calibrations.unshift(newCal);
    memoryDb.addAudit(tenantId, 'START_CALIBRATION', 'calibrations', newCal.id, newCal);
    memoryDb.notify();
    return newCal;
  },

  async addMeasurementPoint(
    tenantId: string,
    calibrationId: string,
    data: { measurement_point: string; nominal_value?: number | null; observed_value?: number | null; unit?: string | null; tolerance_min?: number | null; tolerance_max?: number | null; remarks?: string | null }
  ) {
    let error_value: number | null = null;
    let measurement_result: MeasurementResult = 'NOT_TESTED';

    if (typeof data.nominal_value === 'number' && typeof data.observed_value === 'number') {
      error_value = Number((data.observed_value - data.nominal_value).toFixed(4));
      if (typeof data.tolerance_min === 'number' && typeof data.tolerance_max === 'number') {
        measurement_result = (data.observed_value >= data.tolerance_min && data.observed_value <= data.tolerance_max) ? 'PASS' : 'FAIL';
      } else {
        measurement_result = 'PASS';
      }
    }

    const now = new Date().toISOString();
    const meas: CalibrationMeasurement = {
      id: `meas-${Date.now()}`,
      tenant_id: tenantId,
      calibration_id: calibrationId,
      measurement_point: data.measurement_point,
      nominal_value: data.nominal_value ?? null,
      observed_value: data.observed_value ?? null,
      unit: data.unit || 'bar',
      tolerance_min: data.tolerance_min ?? null,
      tolerance_max: data.tolerance_max ?? null,
      error_value,
      measurement_result,
      remarks: data.remarks || null,
      created_at: now,
      updated_at: now,
    };

    memoryDb.calibrationMeasurements.push(meas);
    memoryDb.notify();
    return meas;
  },

  async updateMeasurementPoint(
    tenantId: string,
    calibrationId: string,
    measurementId: string,
    updates: Partial<CalibrationMeasurement>
  ) {
    const idx = memoryDb.calibrationMeasurements.findIndex((m) => m.id === measurementId && m.calibration_id === calibrationId && (tenantId === 'all' || m.tenant_id === tenantId));
    if (idx < 0) throw new Error('Measurement point not found');

    const merged = { ...memoryDb.calibrationMeasurements[idx], ...updates };
    let error_value: number | null = null;
    let measurement_result: MeasurementResult = 'NOT_TESTED';

    if (typeof merged.nominal_value === 'number' && typeof merged.observed_value === 'number') {
      error_value = Number((merged.observed_value - merged.nominal_value).toFixed(4));
      if (typeof merged.tolerance_min === 'number' && typeof merged.tolerance_max === 'number') {
        measurement_result = (merged.observed_value >= merged.tolerance_min && merged.observed_value <= merged.tolerance_max) ? 'PASS' : 'FAIL';
      } else {
        measurement_result = 'PASS';
      }
    }

    const updated = {
      ...merged,
      error_value,
      measurement_result,
      updated_at: new Date().toISOString(),
    };

    memoryDb.calibrationMeasurements[idx] = updated;
    memoryDb.notify();
    return updated;
  },

  async deleteMeasurementPoint(tenantId: string, calibrationId: string, measurementId: string) {
    const idx = memoryDb.calibrationMeasurements.findIndex((m) => m.id === measurementId && m.calibration_id === calibrationId && (tenantId === 'all' || m.tenant_id === tenantId));
    if (idx >= 0) {
      memoryDb.calibrationMeasurements.splice(idx, 1);
      memoryDb.notify();
      return { success: true };
    }
    throw new Error('Measurement point not found');
  },

  async completeCalibration(
    tenantId: string,
    calibrationId: string,
    data: { result: CalibrationResult; calibration_method: string; environmental_conditions?: string | null; remarks?: string | null; calibration_frequency_override?: number | null; calibration_frequency_unit_override?: string | null; override_reason?: string | null },
    userId = 'usr-current'
  ) {
    const idx = memoryDb.calibrations.findIndex((c) => c.id === calibrationId);
    if (idx < 0) throw new Error('Calibration record not found');

    const cal = memoryDb.calibrations[idx];
    const itemMaster = memoryDb.items.find((i) => i.id === cal.item_id);

    let freq = itemMaster?.calibration_frequency || 12;
    let freqUnit = itemMaster?.calibration_frequency_unit || 'MONTHS';
    let isOverride = false;

    if (data.calibration_frequency_override) {
      freq = data.calibration_frequency_override;
      freqUnit = data.calibration_frequency_unit_override || freqUnit;
      isOverride = true;
    }

    const now = new Date();
    const completionDateStr = now.toISOString().split('T')[0];

    const nextDate = new Date(now);
    if (freqUnit === 'YEARS') {
      nextDate.setFullYear(nextDate.getFullYear() + freq);
    } else if (freqUnit === 'DAYS') {
      nextDate.setDate(nextDate.getDate() + freq);
    } else {
      nextDate.setMonth(nextDate.getMonth() + freq);
    }
    const nextDueDateStr = nextDate.toISOString().split('T')[0];

    const finalStatus: CalibrationStatus = (data.result === 'PASS' || data.result === 'ADJUSTED')
      ? 'COMPLETED'
      : (data.result === 'FAIL' ? 'FAILED' : 'NOT_CALIBRATABLE');

    const updated: Calibration = {
      ...cal,
      status: finalStatus,
      result: data.result,
      calibration_completed_at: now.toISOString(),
      calibration_method: data.calibration_method,
      environmental_conditions: data.environmental_conditions || cal.environmental_conditions,
      remarks: data.remarks || null,
      calibration_date: completionDateStr,
      next_due_date: nextDueDateStr,
      calibration_frequency: freq,
      calibration_frequency_unit: freqUnit,
      frequency_override: isOverride,
      frequency_override_reason: isOverride ? data.override_reason : null,
      frequency_overridden_by: isOverride ? userId : null,
      frequency_overridden_at: isOverride ? now.toISOString() : null,
      updated_at: now.toISOString(),
    };

    memoryDb.calibrations[idx] = updated;
    memoryDb.addAudit(tenantId, 'COMPLETE_CALIBRATION', 'calibrations', calibrationId, updated);
    memoryDb.notify();
    return updated;
  },

  async getCalibrationDueList(
    tenantId: string,
    params: { status?: string; clientId?: string; search?: string; dueSoonDays?: number } = {}
  ) {
    const dueSoonDays = params.dueSoonDays || 30;
    const now = new Date();

    const completedCals = memoryDb.calibrations.filter((c) => (tenantId === 'all' || c.tenant_id === tenantId) && c.status === 'COMPLETED');

    let list: DueListItem[] = [];
    let overdueCount = 0;
    let dueSoonCount = 0;
    let upcomingCount = 0;

    for (const c of completedCals) {
      if (!c.next_due_date) continue;
      const itemMaster = memoryDb.items.find((i) => i.id === c.item_id);
      const req = memoryDb.calibrationRequests.find((r) => r.id === c.request_id);
      const client = req ? memoryDb.clients.find((cl) => cl.id === req.client_id) || null : null;

      const dueDate = new Date(c.next_due_date);
      const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let dueCategory: DueStatus = 'UPCOMING';
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
        id: c.id,
        request_id: c.request_id,
        request_number: req?.request_number || 'N/A',
        item_id: c.item_id,
        item_code: itemMaster?.item_code || 'N/A',
        item_name: itemMaster?.item_name || 'N/A',
        serial_number: itemMaster?.serial_number || 'N/A',
        client,
        last_calibration_date: c.calibration_date || '',
        calibration_frequency: c.calibration_frequency || 12,
        calibration_frequency_unit: c.calibration_frequency_unit || 'MONTHS',
        next_due_date: c.next_due_date,
        days_remaining: daysRemaining,
        due_status: dueCategory,
        result: c.result,
      });
    }

    if (params.status && params.status !== 'ALL') {
      list = list.filter((i) => i.due_status === params.status);
    }
    if (params.clientId && params.clientId !== 'ALL') {
      list = list.filter((i) => i.client?.id === params.clientId);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (i) =>
          i.item_code.toLowerCase().includes(q) ||
          i.item_name.toLowerCase().includes(q) ||
          i.serial_number.toLowerCase().includes(q) ||
          (i.client?.client_name || '').toLowerCase().includes(q)
      );
    }

    return {
      items: list,
      metrics: {
        total: completedCals.length,
        overdue: overdueCount,
        due_soon: dueSoonCount,
        upcoming: upcomingCount,
      },
    };
  },

  async generateCertificate(
    tenantId: string,
    calibrationId: string,
    userId = 'usr-current'
  ) {
    const cal = memoryDb.calibrations.find((c) => c.id === calibrationId);
    if (!cal) throw new Error('Calibration record not found');

    const existing = memoryDb.certificates.filter((c) => c.calibration_id === calibrationId);
    const nextVersion = existing.length > 0 ? existing.length + 1 : 1;
    const certNum = existing.length > 0 ? existing[0].certificate_number : `CERT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const fileName = `Certificate_${certNum}_v${nextVersion}.pdf`;
    const storageRef = `tenants/${tenantId}/certificates/${fileName}`;
    const now = new Date().toISOString();

    const cert: Certificate = {
      id: `cert-${Date.now()}`,
      tenant_id: tenantId,
      request_id: cal.request_id,
      request_item_id: cal.request_item_id,
      calibration_id: calibrationId,
      certificate_number: certNum,
      document_type: 'CALIBRATION_CERTIFICATE',
      file_name: fileName,
      storage_reference: storageRef,
      version: nextVersion,
      generated_by: userId,
      generated_at: now,
      created_at: now,
      updated_at: now,
    };

    memoryDb.certificates.unshift(cert);
    memoryDb.addAudit(tenantId, nextVersion > 1 ? 'REGENERATE_CERTIFICATE' : 'GENERATE_CERTIFICATE', 'certificates', cert.id, cert);
    memoryDb.notify();

    return {
      certificate: cert,
      signedDownloadUrl: `https://storage.ccm.internal/download/${encodeURIComponent(storageRef)}?sig=mock-presigned-token`,
    };
  },

  async getCertificateDownloadUrl(certificateId: string, tenantId: string) {
    const cert = memoryDb.certificates.find((c) => c.id === certificateId && (tenantId === 'all' || c.tenant_id === tenantId));
    if (!cert) throw new Error('Certificate not found');

    return {
      certificateId: cert.id,
      certificateNumber: cert.certificate_number,
      version: cert.version,
      fileName: cert.file_name,
      downloadUrl: `https://storage.ccm.internal/download/${encodeURIComponent(cert.storage_reference)}?sig=mock-presigned-token`,
    };
  },

  // ----------------------------------------------------
  // STEP 10: FAULTY ITEM, SERVICE REQUIRED & CLIENT APPROVAL
  // ----------------------------------------------------
  async getServiceRequests(
    tenantId: string,
    params: { status?: string; search?: string; clientId?: string } = {}
  ) {
    let requests = memoryDb.serviceRequests.filter(
      (sr) => tenantId === 'all' || sr.tenant_id === tenantId
    );

    if (params.status && params.status !== 'ALL') {
      requests = requests.filter((sr) => sr.service_status === params.status);
    }
    if (params.clientId && params.clientId !== 'ALL') {
      requests = requests.filter((sr) => sr.client_id === params.clientId);
    }

    const enriched = requests.map((sr) => {
      const client = memoryDb.clients.find((c) => c.id === sr.client_id) || sr.client || null;
      const calibration = memoryDb.calibrations.find((c) => c.id === sr.calibration_id) || sr.calibration || null;
      const req = memoryDb.calibrationRequests.find((r) => r.id === sr.request_id) || sr.request || null;
      const request_item = memoryDb.requestItems.find((ri) => ri.id === sr.request_item_id) || sr.request_item || null;
      const itemMaster = request_item?.item_id ? memoryDb.items.find((i) => i.id === request_item.item_id) : null;
      const approvals = memoryDb.serviceApprovals.filter((a) => a.service_request_id === sr.id);

      return {
        ...sr,
        client,
        calibration,
        request: req,
        request_item: request_item ? { ...request_item, item: itemMaster || request_item.item } : null,
        approvals,
      };
    });

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      return enriched.filter(
        (sr) =>
          sr.fault_description.toLowerCase().includes(q) ||
          (sr.client?.client_name || '').toLowerCase().includes(q) ||
          (sr.request?.request_number || '').toLowerCase().includes(q) ||
          (sr.request_item?.item?.item_code || '').toLowerCase().includes(q) ||
          (sr.request_item?.item?.item_name || '').toLowerCase().includes(q) ||
          (sr.request_item?.item?.serial_number || '').toLowerCase().includes(q)
      );
    }

    return enriched;
  },

  async getServiceRequestDetails(id: string, tenantId: string): Promise<ServiceRequest> {
    const sr = memoryDb.serviceRequests.find((s) => s.id === id && (tenantId === 'all' || s.tenant_id === tenantId));
    if (!sr) throw new Error('Service request record not found');

    const client = memoryDb.clients.find((c) => c.id === sr.client_id) || sr.client || null;
    const calibration = memoryDb.calibrations.find((c) => c.id === sr.calibration_id) || sr.calibration || null;
    const req = memoryDb.calibrationRequests.find((r) => r.id === sr.request_id) || sr.request || null;
    const request_item = memoryDb.requestItems.find((ri) => ri.id === sr.request_item_id) || sr.request_item || null;
    const itemMaster = request_item?.item_id ? memoryDb.items.find((i) => i.id === request_item.item_id) : null;
    const createdByUser = memoryDb.profiles.find((p) => p.id === sr.created_by) || sr.created_by_user || null;
    const startedByUser = sr.started_by ? memoryDb.profiles.find((p) => p.id === sr.started_by) : null;
    const completedByUser = sr.completed_by ? memoryDb.profiles.find((p) => p.id === sr.completed_by) : null;

    const approvals = memoryDb.serviceApprovals.filter((a) => a.service_request_id === sr.id);

    return {
      ...sr,
      client,
      calibration,
      request: req,
      request_item: request_item ? { ...request_item, item: itemMaster || request_item.item } : null,
      created_by_user: createdByUser,
      started_by_user: startedByUser,
      completed_by_user: completedByUser,
      approvals,
    };
  },

  async createServiceRequest(
    tenantId: string,
    data: {
      request_id: string;
      request_item_id: string;
      calibration_id: string;
      client_id: string;
      fault_description: string;
      estimated_service_cost?: number | null;
      service_remarks?: string | null;
    },
    userId = 'usr-acme-lab-tech'
  ): Promise<ServiceRequest> {
    const cal = memoryDb.calibrations.find((c) => c.id === data.calibration_id);
    if (!cal) throw new Error('Associated calibration record not found');
    if (cal.result !== 'FAIL' && cal.result !== 'NOT_CALIBRATABLE') {
      throw new Error('Service request can only be created for items with calibration result FAIL or NOT_CALIBRATABLE');
    }

    const now = new Date().toISOString();
    const serviceReqId = `sr-${Date.now()}`;

    const newSr: ServiceRequest = {
      id: serviceReqId,
      tenant_id: tenantId,
      request_id: data.request_id,
      request_item_id: data.request_item_id,
      calibration_id: data.calibration_id,
      client_id: data.client_id,
      service_status: 'AWAITING_CLIENT_APPROVAL',
      fault_description: data.fault_description,
      service_required: true,
      estimated_service_cost: data.estimated_service_cost ?? null,
      service_remarks: data.service_remarks || null,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };

    const initialApproval: ServiceApproval = {
      id: `sa-${Date.now()}`,
      tenant_id: tenantId,
      service_request_id: serviceReqId,
      approval_status: 'PENDING',
      created_at: now,
      updated_at: now,
    };

    memoryDb.serviceRequests.unshift(newSr);
    memoryDb.serviceApprovals.unshift(initialApproval);

    memoryDb.addAudit(tenantId, 'CREATE_SERVICE_REQUEST', 'service_requests', newSr.id, newSr);
    memoryDb.notify();

    return this.getServiceRequestDetails(newSr.id, tenantId);
  },

  async recordClientApproval(
    tenantId: string,
    serviceRequestId: string,
    data: {
      approval_status: 'APPROVED' | 'REJECTED';
      approved_by_client_name?: string;
      approved_by_client_role?: string;
      approval_remarks?: string;
      approval_reference?: string;
    }
  ): Promise<ServiceRequest> {
    const idx = memoryDb.serviceRequests.findIndex((s) => s.id === serviceRequestId && (tenantId === 'all' || s.tenant_id === tenantId));
    if (idx < 0) throw new Error('Service request record not found');

    const sr = memoryDb.serviceRequests[idx];
    if (data.approval_status === 'REJECTED' && (!data.approval_remarks || !data.approval_remarks.trim())) {
      throw new Error('Mandatory rejection remarks are required when rejecting client approval');
    }
    if (data.approval_status === 'APPROVED' && (!data.approved_by_client_name || !data.approved_by_client_name.trim())) {
      throw new Error('Client representative name is required for approval');
    }

    const now = new Date().toISOString();
    const newStatus: ServiceStatus = data.approval_status === 'APPROVED' ? 'APPROVED' : 'REJECTED';

    const updatedSr: ServiceRequest = {
      ...sr,
      service_status: newStatus,
      updated_at: now,
    };

    memoryDb.serviceRequests[idx] = updatedSr;

    const appIdx = memoryDb.serviceApprovals.findIndex((a) => a.service_request_id === serviceRequestId);
    if (appIdx >= 0) {
      memoryDb.serviceApprovals[appIdx] = {
        ...memoryDb.serviceApprovals[appIdx],
        approval_status: data.approval_status,
        approved_by_client_name: data.approved_by_client_name || null,
        approved_by_client_role: data.approved_by_client_role || null,
        approval_remarks: data.approval_remarks || null,
        approval_reference: data.approval_reference || null,
        approved_at: data.approval_status === 'APPROVED' ? now : null,
        rejected_at: data.approval_status === 'REJECTED' ? now : null,
        updated_at: now,
      };
    } else {
      memoryDb.serviceApprovals.unshift({
        id: `sa-${Date.now()}`,
        tenant_id: sr.tenant_id,
        service_request_id: serviceRequestId,
        approval_status: data.approval_status,
        approved_by_client_name: data.approved_by_client_name || null,
        approved_by_client_role: data.approved_by_client_role || null,
        approval_remarks: data.approval_remarks || null,
        approval_reference: data.approval_reference || null,
        approved_at: data.approval_status === 'APPROVED' ? now : null,
        rejected_at: data.approval_status === 'REJECTED' ? now : null,
        created_at: now,
        updated_at: now,
      });
    }

    memoryDb.addAudit(sr.tenant_id, `SERVICE_${data.approval_status}`, 'service_requests', serviceRequestId, data);
    memoryDb.notify();

    return this.getServiceRequestDetails(serviceRequestId, tenantId);
  },

  async startService(
    tenantId: string,
    serviceRequestId: string,
    userId = 'usr-acme-lab-tech'
  ): Promise<ServiceRequest> {
    const idx = memoryDb.serviceRequests.findIndex((s) => s.id === serviceRequestId && (tenantId === 'all' || s.tenant_id === tenantId));
    if (idx < 0) throw new Error('Service request record not found');

    const sr = memoryDb.serviceRequests[idx];
    if (sr.service_status !== 'APPROVED') {
      throw new Error('Service can only be started after client approval');
    }

    const now = new Date().toISOString();
    const updatedSr: ServiceRequest = {
      ...sr,
      service_status: 'IN_SERVICE',
      started_by: userId,
      started_at: now,
      updated_at: now,
    };

    memoryDb.serviceRequests[idx] = updatedSr;
    memoryDb.addAudit(sr.tenant_id, 'START_SERVICE', 'service_requests', serviceRequestId, updatedSr);
    memoryDb.notify();

    return this.getServiceRequestDetails(serviceRequestId, tenantId);
  },

  async completeService(
    tenantId: string,
    serviceRequestId: string,
    userId = 'usr-acme-lab-tech'
  ): Promise<ServiceRequest> {
    const idx = memoryDb.serviceRequests.findIndex((s) => s.id === serviceRequestId && (tenantId === 'all' || s.tenant_id === tenantId));
    if (idx < 0) throw new Error('Service request record not found');

    const sr = memoryDb.serviceRequests[idx];
    if (sr.service_status !== 'IN_SERVICE') {
      throw new Error('Service must be IN_SERVICE before it can be marked as completed');
    }

    const now = new Date().toISOString();
    const updatedSr: ServiceRequest = {
      ...sr,
      service_status: 'SERVICE_COMPLETED',
      completed_by: userId,
      completed_at: now,
      updated_at: now,
    };

    memoryDb.serviceRequests[idx] = updatedSr;
    memoryDb.addAudit(sr.tenant_id, 'COMPLETE_SERVICE', 'service_requests', serviceRequestId, updatedSr);
    memoryDb.notify();

    return this.getServiceRequestDetails(serviceRequestId, tenantId);
  },

  async returnToCalibration(
    tenantId: string,
    serviceRequestId: string,
    userId = 'usr-acme-lab-tech'
  ): Promise<ServiceRequest> {
    const idx = memoryDb.serviceRequests.findIndex((s) => s.id === serviceRequestId && (tenantId === 'all' || s.tenant_id === tenantId));
    if (idx < 0) throw new Error('Service request record not found');

    const sr = memoryDb.serviceRequests[idx];
    if (sr.service_status !== 'SERVICE_COMPLETED') {
      throw new Error('Service must be SERVICE_COMPLETED before returning to re-calibration');
    }

    const now = new Date().toISOString();

    const calIdx = memoryDb.calibrations.findIndex((c) => c.id === sr.calibration_id);
    if (calIdx >= 0) {
      memoryDb.calibrations[calIdx] = {
        ...memoryDb.calibrations[calIdx],
        status: 'PENDING',
        remarks: `Returned from service (Service Req #${sr.id}). Eligible for re-calibration.`,
        updated_at: now,
      };
    }

    memoryDb.addAudit(sr.tenant_id, 'RETURN_TO_RE_CALIBRATION', 'service_requests', serviceRequestId, {
      service_request_id: serviceRequestId,
      request_item_id: sr.request_item_id,
      returned_by: userId,
      returned_at: now,
    });

    memoryDb.notify();
    return this.getServiceRequestDetails(serviceRequestId, tenantId);
  },

  // ----------------------------------------------------
  // STEP 11: VENDOR OUTSOURCING WORKFLOW & PURCHASE ORDERS
  // ----------------------------------------------------
  async getVendorOutsourceRequests(
    tenantId: string,
    params: { status?: string; search?: string; vendorId?: string } = {}
  ) {
    let requests = memoryDb.vendorOutsourceRequests.filter(
      (vor) => tenantId === 'all' || vor.tenant_id === tenantId
    );

    if (params.status && params.status !== 'ALL') {
      requests = requests.filter((vor) => vor.outsource_status === params.status);
    }
    if (params.vendorId && params.vendorId !== 'ALL') {
      requests = requests.filter((vor) => vor.vendor_id === params.vendorId);
    }

    const enriched = requests.map((vor) => {
      const vendor = memoryDb.vendors.find((v) => v.id === vor.vendor_id) || vor.vendor || null;
      const req = memoryDb.calibrationRequests.find((r) => r.id === vor.request_id) || vor.request || null;
      const request_item = memoryDb.requestItems.find((ri) => ri.id === vor.request_item_id) || vor.request_item || null;
      const itemMaster = request_item?.item_id ? memoryDb.items.find((i) => i.id === request_item.item_id) : null;
      const calibration = vor.calibration_id ? memoryDb.calibrations.find((c) => c.id === vor.calibration_id) : null;
      const po = memoryDb.purchaseOrders.find((p) => p.outsource_request_id === vor.id);
      const movements = memoryDb.vendorOutsourceMovements.filter((m) => m.outsource_request_id === vor.id);
      const calRecord = memoryDb.vendorCalibrationRecords.find((vcr) => vcr.outsource_request_id === vor.id);

      return {
        ...vor,
        vendor,
        request: req,
        request_item: request_item ? { ...request_item, item: itemMaster || request_item.item } : null,
        calibration,
        purchase_order: po || vor.purchase_order || null,
        movements,
        vendor_calibration_record: calRecord || vor.vendor_calibration_record || null,
      };
    });

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      return enriched.filter(
        (vor) =>
          vor.id.toLowerCase().includes(q) ||
          vor.outsource_reason.toLowerCase().includes(q) ||
          (vor.vendor?.vendor_name || '').toLowerCase().includes(q) ||
          (vor.request?.request_number || '').toLowerCase().includes(q) ||
          (vor.request_item?.item?.item_code || '').toLowerCase().includes(q) ||
          (vor.request_item?.item?.item_name || '').toLowerCase().includes(q) ||
          (vor.request_item?.item?.serial_number || '').toLowerCase().includes(q)
      );
    }

    return enriched;
  },

  async getVendorOutsourceDetails(id: string, tenantId: string): Promise<VendorOutsourceRequest> {
    const vor = memoryDb.vendorOutsourceRequests.find(
      (v) => v.id === id && (tenantId === 'all' || v.tenant_id === tenantId)
    );
    if (!vor) throw new Error('Vendor outsourcing record not found');

    const vendor = memoryDb.vendors.find((v) => v.id === vor.vendor_id) || vor.vendor || null;
    const req = memoryDb.calibrationRequests.find((r) => r.id === vor.request_id) || vor.request || null;
    const request_item = memoryDb.requestItems.find((ri) => ri.id === vor.request_item_id) || vor.request_item || null;
    const itemMaster = request_item?.item_id ? memoryDb.items.find((i) => i.id === request_item.item_id) : null;
    const calibration = vor.calibration_id ? memoryDb.calibrations.find((c) => c.id === vor.calibration_id) : null;
    const createdByUser = memoryDb.profiles.find((p) => p.id === vor.created_by) || vor.created_by_user || null;
    const receivedByUser = vor.received_by ? memoryDb.profiles.find((p) => p.id === vor.received_by) : null;

    const po = memoryDb.purchaseOrders.find((p) => p.outsource_request_id === vor.id);
    const poEnriched = po
      ? {
          ...po,
          items: memoryDb.poItems.filter((poi) => poi.purchase_order_id === po.id),
        }
      : null;

    const movements = memoryDb.vendorOutsourceMovements.filter((m) => m.outsource_request_id === vor.id);
    const calRecord = memoryDb.vendorCalibrationRecords.find((vcr) => vcr.outsource_request_id === vor.id);

    return {
      ...vor,
      vendor,
      request: req,
      request_item: request_item ? { ...request_item, item: itemMaster || request_item.item } : null,
      calibration,
      created_by_user: createdByUser,
      received_by_user: receivedByUser,
      purchase_order: poEnriched,
      movements,
      vendor_calibration_record: calRecord || vor.vendor_calibration_record || null,
    };
  },

  async createVendorOutsourceRequest(
    tenantId: string,
    data: {
      request_id: string;
      request_item_id: string;
      calibration_id?: string;
      vendor_id: string;
      outsource_reason: string;
      expected_return_date?: string;
      remarks?: string;
    },
    userId = 'usr-acme-lab-tech'
  ): Promise<VendorOutsourceRequest> {
    const existingActive = memoryDb.vendorOutsourceRequests.find(
      (v) =>
        v.tenant_id === tenantId &&
        v.request_item_id === data.request_item_id &&
        !['REINTEGRATED', 'CANCELLED'].includes(v.outsource_status)
    );
    if (existingActive) {
      throw new Error(`Item already has an active outsourcing record (${existingActive.id}) in stage ${existingActive.outsource_status}`);
    }

    const vendor = memoryDb.vendors.find((v) => v.id === data.vendor_id && v.tenant_id === tenantId);
    if (!vendor) throw new Error('Selected vendor not found in this tenant');
    if (vendor.status !== 'active') throw new Error('Cannot select an inactive vendor');

    const now = new Date().toISOString();
    const id = `vor-${Date.now()}`;

    const newVor: VendorOutsourceRequest = {
      id,
      tenant_id: tenantId,
      request_id: data.request_id,
      request_item_id: data.request_item_id,
      calibration_id: data.calibration_id || null,
      vendor_id: data.vendor_id,
      outsource_status: 'VENDOR_SELECTED',
      outsource_reason: data.outsource_reason,
      expected_return_date: data.expected_return_date || null,
      remarks: data.remarks || null,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };

    memoryDb.vendorOutsourceRequests.unshift(newVor);
    memoryDb.addAudit(tenantId, 'CREATE_VENDOR_OUTSOURCE', 'vendor_outsource_requests', newVor.id, newVor);
    memoryDb.notify();

    return this.getVendorOutsourceDetails(newVor.id, tenantId);
  },

  async getVendorPurchaseOrders(
    tenantId: string,
    params: { status?: string; search?: string; vendorId?: string } = {}
  ) {
    let pos = memoryDb.purchaseOrders.filter(
      (p) => tenantId === 'all' || p.tenant_id === tenantId
    );

    if (params.status && params.status !== 'ALL') {
      pos = pos.filter((p) => p.status === params.status);
    }
    if (params.vendorId && params.vendorId !== 'ALL') {
      pos = pos.filter((p) => p.vendor_id === params.vendorId);
    }

    const enriched = pos.map((p) => {
      const vendor = memoryDb.vendors.find((v) => v.id === p.vendor_id) || p.vendor || null;
      const req = p.request_id ? memoryDb.calibrationRequests.find((r) => r.id === p.request_id) : null;
      const items = memoryDb.poItems.filter((poi) => poi.purchase_order_id === p.id);

      return {
        ...p,
        vendor,
        request: req,
        items,
      };
    });

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase();
      return enriched.filter(
        (p) =>
          p.po_number.toLowerCase().includes(q) ||
          (p.vendor?.vendor_name || '').toLowerCase().includes(q) ||
          (p.request?.request_number || '').toLowerCase().includes(q)
      );
    }

    return enriched;
  },

  async getVendorPurchaseOrderDetails(id: string, tenantId: string): Promise<PurchaseOrder> {
    const po = memoryDb.purchaseOrders.find((p) => p.id === id && (tenantId === 'all' || p.tenant_id === tenantId));
    if (!po) throw new Error('Purchase order record not found');

    const vendor = memoryDb.vendors.find((v) => v.id === po.vendor_id) || po.vendor || null;
    const req = po.request_id ? memoryDb.calibrationRequests.find((r) => r.id === po.request_id) : null;
    const items = memoryDb.poItems
      .filter((poi) => poi.purchase_order_id === po.id)
      .map((poi) => ({
        ...poi,
        item: memoryDb.items.find((i) => i.id === poi.item_id) || poi.item || null,
      }));

    const createdByUser = memoryDb.profiles.find((pr) => pr.id === po.created_by) || po.created_by_user || null;
    const issuedByUser = po.issued_by ? memoryDb.profiles.find((pr) => pr.id === po.issued_by) : null;

    return {
      ...po,
      vendor,
      request: req,
      items,
      created_by_user: createdByUser,
      issued_by_user: issuedByUser,
    };
  },

  async createVendorPurchaseOrder(
    tenantId: string,
    data: {
      vendor_id: string;
      request_id?: string;
      outsource_request_id?: string;
      items: Array<{
        request_item_id: string;
        item_id: string;
        description?: string;
        quantity: number;
        unit_cost: number;
      }>;
      tax_rate?: number;
      remarks?: string;
    },
    userId = 'usr-acme-lab-tech'
  ): Promise<PurchaseOrder> {
    const vendor = memoryDb.vendors.find((v) => v.id === data.vendor_id && v.tenant_id === tenantId);
    if (!vendor) throw new Error('Selected vendor not found in this tenant');

    const subtotal = data.items.reduce((acc, item) => acc + item.quantity * item.unit_cost, 0);
    const taxRate = data.tax_rate ?? 18;
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    const now = new Date().toISOString();
    const poId = `po-${Date.now()}`;
    const count = memoryDb.purchaseOrders.filter((p) => p.tenant_id === tenantId).length + 1;
    const poNumber = `VPO-${new Date().getFullYear()}-${String(count).padStart(6, '0')}`;

    const createdItems: POItem[] = data.items.map((it, idx) => {
      const dbItem = memoryDb.items.find((i) => i.id === it.item_id);
      return {
        id: `poi-${poId}-${idx + 1}`,
        tenant_id: tenantId,
        purchase_order_id: poId,
        request_item_id: it.request_item_id,
        item_id: it.item_id,
        description: it.description || dbItem?.item_name || null,
        quantity: it.quantity,
        unit_cost: it.unit_cost,
        line_total: Number((it.quantity * it.unit_cost).toFixed(2)),
        created_at: now,
        updated_at: now,
        item: dbItem || null,
      };
    });

    const newPo: PurchaseOrder = {
      id: poId,
      tenant_id: tenantId,
      po_number: poNumber,
      vendor_id: data.vendor_id,
      request_id: data.request_id || null,
      outsource_request_id: data.outsource_request_id || null,
      po_date: now.split('T')[0],
      status: 'DRAFT',
      currency: 'INR',
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      created_by: userId,
      created_at: now,
      updated_at: now,
      remarks: data.remarks || null,
    };

    memoryDb.purchaseOrders.unshift(newPo);
    createdItems.forEach((poi) => memoryDb.poItems.push(poi));

    if (data.outsource_request_id) {
      const vorIdx = memoryDb.vendorOutsourceRequests.findIndex((v) => v.id === data.outsource_request_id);
      if (vorIdx >= 0) {
        memoryDb.vendorOutsourceRequests[vorIdx] = {
          ...memoryDb.vendorOutsourceRequests[vorIdx],
          outsource_status: 'PO_DRAFT',
          updated_at: now,
        };
      }
    }

    memoryDb.addAudit(tenantId, 'CREATE_VENDOR_PO', 'purchase_orders', poId, newPo);
    memoryDb.notify();

    return this.getVendorPurchaseOrderDetails(poId, tenantId);
  },

  async issueVendorPurchaseOrder(
    tenantId: string,
    poId: string,
    userId = 'usr-acme-admin'
  ): Promise<PurchaseOrder> {
    const poIdx = memoryDb.purchaseOrders.findIndex((p) => p.id === poId && (tenantId === 'all' || p.tenant_id === tenantId));
    if (poIdx < 0) throw new Error('Purchase Order not found');

    const po = memoryDb.purchaseOrders[poIdx];
    if (po.status !== 'DRAFT') {
      throw new Error(`PO is already in ${po.status} status and cannot be re-issued`);
    }

    const now = new Date().toISOString();
    const updatedPo: PurchaseOrder = {
      ...po,
      status: 'ISSUED',
      issued_by: userId,
      issued_at: now,
      updated_at: now,
    };

    memoryDb.purchaseOrders[poIdx] = updatedPo;

    if (po.outsource_request_id) {
      const vorIdx = memoryDb.vendorOutsourceRequests.findIndex((v) => v.id === po.outsource_request_id);
      if (vorIdx >= 0) {
        memoryDb.vendorOutsourceRequests[vorIdx] = {
          ...memoryDb.vendorOutsourceRequests[vorIdx],
          outsource_status: 'PO_ISSUED',
          updated_at: now,
        };
      }
    }

    memoryDb.addAudit(po.tenant_id, 'ISSUE_VENDOR_PO', 'purchase_orders', poId, updatedPo);
    memoryDb.notify();

    return this.getVendorPurchaseOrderDetails(poId, tenantId);
  },

  async sendItemToVendor(
    tenantId: string,
    outsourceRequestId: string,
    data: { carrier: string; tracking_number: string; movement_date?: string; remarks?: string; document_id?: string },
    userId = 'usr-acme-collector'
  ): Promise<VendorOutsourceRequest> {
    const vorIdx = memoryDb.vendorOutsourceRequests.findIndex((v) => v.id === outsourceRequestId && (tenantId === 'all' || v.tenant_id === tenantId));
    if (vorIdx < 0) throw new Error('Outsource request not found');

    const vor = memoryDb.vendorOutsourceRequests[vorIdx];
    const po = memoryDb.purchaseOrders.find((p) => p.outsource_request_id === outsourceRequestId);
    if (!po || po.status !== 'ISSUED') {
      throw new Error('Item cannot be sent to vendor before a Vendor Purchase Order is ISSUED');
    }

    const now = new Date().toISOString();
    const movement: VendorOutsourceMovement = {
      id: `vom-${Date.now()}`,
      tenant_id: vor.tenant_id,
      outsource_request_id: outsourceRequestId,
      movement_type: 'SEND_TO_VENDOR',
      carrier: data.carrier,
      tracking_number: data.tracking_number,
      movement_date: data.movement_date || now.split('T')[0],
      performed_by: userId,
      remarks: data.remarks || null,
      document_id: data.document_id || null,
      created_at: now,
    };

    memoryDb.vendorOutsourceMovements.unshift(movement);

    const updatedVor: VendorOutsourceRequest = {
      ...vor,
      outsource_status: 'SENT_TO_VENDOR',
      updated_at: now,
    };

    memoryDb.vendorOutsourceRequests[vorIdx] = updatedVor;
    memoryDb.addAudit(vor.tenant_id, 'SEND_ITEM_TO_VENDOR', 'vendor_outsource_requests', outsourceRequestId, movement);
    memoryDb.notify();

    return this.getVendorOutsourceDetails(outsourceRequestId, tenantId);
  },

  async markVendorReceived(
    tenantId: string,
    outsourceRequestId: string,
    data: { vendor_reference?: string; remarks?: string },
    _userId = 'usr-acme-lab-tech'
  ): Promise<VendorOutsourceRequest> {
    const vorIdx = memoryDb.vendorOutsourceRequests.findIndex((v) => v.id === outsourceRequestId && (tenantId === 'all' || v.tenant_id === tenantId));
    if (vorIdx < 0) throw new Error('Outsource request not found');

    const vor = memoryDb.vendorOutsourceRequests[vorIdx];
    if (vor.outsource_status !== 'SENT_TO_VENDOR') {
      throw new Error('Item must be in SENT_TO_VENDOR status before marking vendor receipt');
    }

    const now = new Date().toISOString();
    const updatedVor: VendorOutsourceRequest = {
      ...vor,
      outsource_status: 'VENDOR_RECEIVED',
      vendor_reference: data.vendor_reference || vor.vendor_reference,
      remarks: data.remarks || vor.remarks,
      updated_at: now,
    };

    memoryDb.vendorOutsourceRequests[vorIdx] = updatedVor;
    memoryDb.addAudit(vor.tenant_id, 'VENDOR_RECEIVED_ITEM', 'vendor_outsource_requests', outsourceRequestId, data);
    memoryDb.notify();

    return this.getVendorOutsourceDetails(outsourceRequestId, tenantId);
  },

  async startVendorCalibration(
    tenantId: string,
    outsourceRequestId: string,
    _userId = 'usr-acme-lab-tech'
  ): Promise<VendorOutsourceRequest> {
    const vorIdx = memoryDb.vendorOutsourceRequests.findIndex((v) => v.id === outsourceRequestId && (tenantId === 'all' || v.tenant_id === tenantId));
    if (vorIdx < 0) throw new Error('Outsource request not found');

    const vor = memoryDb.vendorOutsourceRequests[vorIdx];
    if (vor.outsource_status !== 'VENDOR_RECEIVED') {
      throw new Error('Vendor must receive item before starting external vendor calibration');
    }

    const now = new Date().toISOString();
    const updatedVor: VendorOutsourceRequest = {
      ...vor,
      outsource_status: 'VENDOR_CALIBRATION',
      updated_at: now,
    };

    memoryDb.vendorOutsourceRequests[vorIdx] = updatedVor;
    memoryDb.addAudit(vor.tenant_id, 'START_VENDOR_CALIBRATION', 'vendor_outsource_requests', outsourceRequestId, { started_at: now });
    memoryDb.notify();

    return this.getVendorOutsourceDetails(outsourceRequestId, tenantId);
  },

  async recordVendorCalibrationResult(
    tenantId: string,
    outsourceRequestId: string,
    data: {
      vendor_certificate_number: string;
      vendor_result: VendorCalibrationResult;
      calibrated_at?: string;
      report_document_id?: string;
      remarks?: string;
    },
    userId = 'usr-acme-lab-tech'
  ): Promise<VendorOutsourceRequest> {
    const vorIdx = memoryDb.vendorOutsourceRequests.findIndex((v) => v.id === outsourceRequestId && (tenantId === 'all' || v.tenant_id === tenantId));
    if (vorIdx < 0) throw new Error('Outsource request not found');

    const vor = memoryDb.vendorOutsourceRequests[vorIdx];
    if (data.vendor_result === 'FAIL' || data.vendor_result === 'NOT_CALIBRATABLE') {
      if (!data.remarks || !data.remarks.trim()) {
        throw new Error('Mandatory failure remarks/reason are required for vendor FAIL or NOT_CALIBRATABLE results');
      }
    }

    const now = new Date().toISOString();
    const record: VendorCalibrationRecord = {
      id: `vcr-${Date.now()}`,
      tenant_id: vor.tenant_id,
      outsource_request_id: outsourceRequestId,
      vendor_id: vor.vendor_id,
      vendor_certificate_number: data.vendor_certificate_number,
      vendor_result: data.vendor_result,
      calibrated_at: data.calibrated_at || now.split('T')[0],
      report_received_at: now,
      report_document_id: data.report_document_id || null,
      remarks: data.remarks || null,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };

    memoryDb.vendorCalibrationRecords.unshift(record);

    const isFail = data.vendor_result === 'FAIL' || data.vendor_result === 'NOT_CALIBRATABLE';
    const updatedVor: VendorOutsourceRequest = {
      ...vor,
      outsource_status: isFail ? 'VENDOR_FAILED' : 'VENDOR_COMPLETED',
      updated_at: now,
    };

    memoryDb.vendorOutsourceRequests[vorIdx] = updatedVor;
    memoryDb.addAudit(vor.tenant_id, isFail ? 'VENDOR_CALIBRATION_FAILED' : 'RECORD_VENDOR_CALIBRATION', 'vendor_calibration_records', record.id, record);
    memoryDb.notify();

    return this.getVendorOutsourceDetails(outsourceRequestId, tenantId);
  },

  async recordVendorReturn(
    tenantId: string,
    outsourceRequestId: string,
    data: { carrier: string; tracking_number: string; return_date?: string; remarks?: string; document_id?: string },
    userId = 'usr-acme-collector'
  ): Promise<VendorOutsourceRequest> {
    const vorIdx = memoryDb.vendorOutsourceRequests.findIndex((v) => v.id === outsourceRequestId && (tenantId === 'all' || v.tenant_id === tenantId));
    if (vorIdx < 0) throw new Error('Outsource request not found');

    const vor = memoryDb.vendorOutsourceRequests[vorIdx];
    const now = new Date().toISOString();

    const movement: VendorOutsourceMovement = {
      id: `vom-${Date.now()}`,
      tenant_id: vor.tenant_id,
      outsource_request_id: outsourceRequestId,
      movement_type: 'RETURN_FROM_VENDOR',
      carrier: data.carrier,
      tracking_number: data.tracking_number,
      movement_date: data.return_date || now.split('T')[0],
      performed_by: userId,
      remarks: data.remarks || null,
      document_id: data.document_id || null,
      created_at: now,
    };

    memoryDb.vendorOutsourceMovements.unshift(movement);

    const updatedVor: VendorOutsourceRequest = {
      ...vor,
      outsource_status: 'AWAITING_RETURN',
      updated_at: now,
    };

    memoryDb.vendorOutsourceRequests[vorIdx] = updatedVor;
    memoryDb.addAudit(vor.tenant_id, 'VENDOR_RETURN_SHIPPED', 'vendor_outsource_requests', outsourceRequestId, movement);
    memoryDb.notify();

    return this.getVendorOutsourceDetails(outsourceRequestId, tenantId);
  },

  async receiveItemBack(
    tenantId: string,
    outsourceRequestId: string,
    data: { remarks?: string },
    userId = 'usr-acme-lab-tech'
  ): Promise<VendorOutsourceRequest> {
    const vorIdx = memoryDb.vendorOutsourceRequests.findIndex((v) => v.id === outsourceRequestId && (tenantId === 'all' || v.tenant_id === tenantId));
    if (vorIdx < 0) throw new Error('Outsource request not found');

    const vor = memoryDb.vendorOutsourceRequests[vorIdx];
    const now = new Date().toISOString();

    const updatedVor: VendorOutsourceRequest = {
      ...vor,
      outsource_status: 'RECEIVED_BACK',
      received_by: userId,
      returned_at: now,
      remarks: data.remarks || vor.remarks,
      updated_at: now,
    };

    memoryDb.vendorOutsourceRequests[vorIdx] = updatedVor;
    memoryDb.addAudit(vor.tenant_id, 'ITEM_RECEIVED_BACK', 'vendor_outsource_requests', outsourceRequestId, { received_at: now });
    memoryDb.notify();

    return this.getVendorOutsourceDetails(outsourceRequestId, tenantId);
  },

  async reintegrateIntoMainFlow(
    tenantId: string,
    outsourceRequestId: string,
    _userId = 'usr-acme-lab-tech'
  ): Promise<VendorOutsourceRequest> {
    const vorIdx = memoryDb.vendorOutsourceRequests.findIndex((v) => v.id === outsourceRequestId && (tenantId === 'all' || v.tenant_id === tenantId));
    if (vorIdx < 0) throw new Error('Outsource request not found');

    const vor = memoryDb.vendorOutsourceRequests[vorIdx];
    if (vor.outsource_status !== 'RECEIVED_BACK') {
      throw new Error('Item must be RECEIVED_BACK before it can be reintegrated into main calibration flow');
    }

    const vcr = memoryDb.vendorCalibrationRecords.find((v) => v.outsource_request_id === outsourceRequestId);
    if (!vcr || (vcr.vendor_result !== 'PASS' && vcr.vendor_result !== 'ADJUSTED')) {
      throw new Error('Only items with vendor calibration result PASS or ADJUSTED can be reintegrated as CALIBRATED');
    }

    const now = new Date().toISOString();
    const updatedVor: VendorOutsourceRequest = {
      ...vor,
      outsource_status: 'REINTEGRATED',
      updated_at: now,
    };

    memoryDb.vendorOutsourceRequests[vorIdx] = updatedVor;

    if (vor.calibration_id) {
      const calIdx = memoryDb.calibrations.findIndex((c) => c.id === vor.calibration_id);
      if (calIdx >= 0) {
        memoryDb.calibrations[calIdx] = {
          ...memoryDb.calibrations[calIdx],
          status: 'COMPLETED',
          result: vcr.vendor_result,
          remarks: `Reintegrated from Vendor Outsourcing (${vor.vendor?.vendor_name || 'Vendor'}). Certificate #${vcr.vendor_certificate_number}`,
          calibration_date: vcr.calibrated_at || now.split('T')[0],
          updated_at: now,
        };
      }
    }

    memoryDb.addAudit(vor.tenant_id, 'REINTEGRATE_VENDOR_OUTSOURCE', 'vendor_outsource_requests', outsourceRequestId, {
      reintegrated_at: now,
      vendor_certificate_number: vcr.vendor_certificate_number,
    });
    memoryDb.notify();

    return this.getVendorOutsourceDetails(outsourceRequestId, tenantId);
  },

  // =========================================================================
  // STEP 12: COMMERCIAL QUOTATIONS WORKFLOW
  // =========================================================================

  async getQuotations(
    tenantId: string,
    filters: { status?: string; search?: string; clientId?: string; quotationType?: string } = {}
  ): Promise<Quotation[]> {
    if (isSupabaseConfigured && supabase) {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.clientId) params.append('client_id', filters.clientId);
      if (filters.quotationType) params.append('quotation_type', filters.quotationType);

      const res = await fetch(`${API_BASE}/quotations?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    return memoryDb.quotations
      .filter((q) => {
        if (tenantId !== 'all' && q.tenant_id !== tenantId) return false;
        if (filters.status && filters.status !== 'ALL' && q.status !== filters.status) return false;
        if (filters.clientId && q.client_id !== filters.clientId) return false;
        if (filters.quotationType && filters.quotationType !== 'ALL' && q.quotation_type !== filters.quotationType) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          const matchNo = q.quotation_number.toLowerCase().includes(s);
          const matchClient = q.client?.client_name?.toLowerCase().includes(s);
          const matchReq = q.request?.request_number?.toLowerCase().includes(s);
          if (!matchNo && !matchClient && !matchReq) return false;
        }
        return true;
      })
      .map((q) => ({
        ...q,
        client: memoryDb.clients.find((c) => c.id === q.client_id) || q.client,
        request: memoryDb.calibrationRequests.find((r) => r.id === q.request_id) || q.request,
        items: memoryDb.quotationItems
          .filter((qi) => qi.quotation_id === q.id)
          .map((qi) => ({
            ...qi,
            item: memoryDb.items.find((i) => i.id === qi.item_id) || qi.item,
            request_item: memoryDb.requestItems.find((ri) => ri.id === qi.request_item_id) || qi.request_item,
          })),
        approvals: memoryDb.quotationApprovals.filter((qa) => qa.quotation_id === q.id),
      }));
  },

  async getQuotationDetails(quotationId: string, tenantId: string): Promise<Quotation> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/quotations/${quotationId}`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const q = memoryDb.quotations.find((quo) => quo.id === quotationId && (tenantId === 'all' || quo.tenant_id === tenantId));
    if (!q) throw new Error('Quotation not found');

    const client = memoryDb.clients.find((c) => c.id === q.client_id) || null;
    const request = memoryDb.calibrationRequests.find((r) => r.id === q.request_id) || null;

    const items = memoryDb.quotationItems
      .filter((qi) => qi.quotation_id === q.id)
      .map((qi) => ({
        ...qi,
        item: memoryDb.items.find((i) => i.id === qi.item_id) || null,
        request_item: memoryDb.requestItems.find((ri) => ri.id === qi.request_item_id) || null,
      }));

    const approvals = memoryDb.quotationApprovals
      .filter((qa) => qa.quotation_id === q.id)
      .map((qa) => ({
        ...qa,
        requested_by_user: memoryDb.profiles.find((p) => p.id === qa.requested_by) || null,
        approved_by_user: memoryDb.profiles.find((p) => p.id === qa.approved_by) || null,
      }));

    return {
      ...q,
      client,
      request,
      items,
      approvals,
      created_by_user: memoryDb.profiles.find((p) => p.id === q.created_by) || null,
      approved_by_user: memoryDb.profiles.find((p) => p.id === q.approved_by) || null,
    };
  },

  async getEligibleRequestItemsForQuotation(requestId: string, tenantId: string) {
    const reqItems = memoryDb.requestItems.filter((ri) => ri.request_id === requestId && (tenantId === 'all' || ri.tenant_id === tenantId));

    const eligible = [];
    for (const ri of reqItems) {
      const item = memoryDb.items.find((i) => i.id === ri.item_id);
      
      const internalCal = memoryDb.calibrations.find(
        (c) => c.request_item_id === ri.id && (c.result === 'PASS' || c.result === 'ADJUSTED') && c.status === 'COMPLETED'
      );

      const vor = memoryDb.vendorOutsourceRequests.find(
        (v) => v.request_item_id === ri.id && v.outsource_status === 'REINTEGRATED'
      );
      const vcr = vor ? memoryDb.vendorCalibrationRecords.find((r) => r.outsource_request_id === vor.id) : null;
      const vendorPassed = vor && vcr && (vcr.vendor_result === 'PASS' || vcr.vendor_result === 'ADJUSTED');

      if (internalCal || vendorPassed) {
        eligible.push({
          request_item_id: ri.id,
          item_id: ri.item_id,
          item_code: item?.item_code || 'ITEM',
          item_name: item?.item_name || 'Instrument',
          serial_number: item?.serial_number || 'N/A',
          quantity: ri.requested_quantity || 1,
          calibration_result: internalCal ? internalCal.result : vcr?.vendor_result || 'PASS',
          calibration_source: internalCal ? ('INTERNAL' as const) : ('VENDOR' as const),
          standard_cost: item?.standard_cost || 12500.0,
          item,
          request_item: ri,
        });
      }
    }

    return eligible;
  },

  async createQuotation(
    tenantId: string,
    data: {
      quotation_type?: 'STANDALONE' | 'REQUEST_BASED';
      request_id?: string | null;
      client_id: string;
      valid_until: string;
      currency?: string;
      discount_amount?: number;
      remarks?: string;
      items: {
        request_item_id?: string | null;
        item_id: string;
        description?: string;
        quantity: number;
        override_cost?: number;
        override_reason?: string;
        tax_rate?: number;
      }[];
    },
    userId = 'usr-acme-lab-tech'
  ): Promise<Quotation> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/quotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const client = memoryDb.clients.find((c) => c.id === data.client_id && (tenantId === 'all' || c.tenant_id === tenantId));
    if (!client) throw new Error('Client not found or tenant context invalid');

    const quotationType = data.quotation_type || (data.request_id ? 'REQUEST_BASED' : 'STANDALONE');

    let request = null;
    if (data.request_id) {
      request = memoryDb.calibrationRequests.find((r) => r.id === data.request_id && (tenantId === 'all' || r.tenant_id === tenantId)) || null;
    }

    const quoId = `quo-${Date.now()}`;
    const quoNumber = `QUO-2026-${String(memoryDb.quotations.length + 1).padStart(6, '0')}`;
    const now = new Date().toISOString();

    let subtotal = 0;
    let totalTax = 0;
    const createdQuotationItems: QuotationItem[] = [];

    for (const itemInput of data.items) {
      const itemMaster = memoryDb.items.find((i) => i.id === itemInput.item_id);
      const standardCost = itemMaster?.standard_cost || 1000.0;
      const isOverride = itemInput.override_cost !== undefined && itemInput.override_cost !== null && itemInput.override_cost !== standardCost;

      if (isOverride && (!itemInput.override_reason || !itemInput.override_reason.trim())) {
        throw new Error('Mandatory override reason is required when overriding standard item cost');
      }

      const finalUnitCost = isOverride ? (itemInput.override_cost as number) : standardCost;
      const qty = itemInput.quantity || 1;
      const lineSubtotal = qty * finalUnitCost;
      const taxRate = itemInput.tax_rate !== undefined ? itemInput.tax_rate : 18.0;
      const taxAmount = (lineSubtotal * taxRate) / 100;
      const lineTotal = lineSubtotal + taxAmount;

      subtotal += lineSubtotal;
      totalTax += taxAmount;

      const qi: QuotationItem = {
        id: `qi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        tenant_id: tenantId,
        quotation_id: quoId,
        request_item_id: itemInput.request_item_id || null,
        item_id: itemInput.item_id,
        description: itemInput.description || `Calibration service for ${itemMaster?.item_name || 'Item'}`,
        quantity: qty,
        consumed_quantity: 0,
        standard_cost: standardCost,
        override_cost: isOverride ? itemInput.override_cost : null,
        final_unit_cost: finalUnitCost,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        line_total: lineTotal,
        override_reason: isOverride ? itemInput.override_reason : null,
        override_by: isOverride ? userId : null,
        override_at: isOverride ? now : null,
        created_at: now,
        updated_at: now,
        item: itemMaster,
      };

      createdQuotationItems.push(qi);
    }

    const discountAmount = data.discount_amount || 0;
    const totalAmount = Math.max(0, subtotal + totalTax - discountAmount);

    const newQuotation: Quotation = {
      id: quoId,
      tenant_id: tenantId,
      organization_id: client.organization_id || null,
      sub_org_id: client.sub_org_id || null,
      quotation_number: quoNumber,
      quotation_type: quotationType,
      request_id: data.request_id || null,
      client_id: data.client_id,
      quotation_date: now.split('T')[0],
      valid_until: data.valid_until,
      status: 'DRAFT',
      subtotal,
      tax_amount: totalTax,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      currency: data.currency || 'INR',
      version_number: 1,
      created_by: userId,
      client_response: 'PENDING',
      remarks: data.remarks || null,
      created_at: now,
      updated_at: now,
      client,
      request,
      items: createdQuotationItems,
      approvals: [],
    };

    memoryDb.quotations.unshift(newQuotation);
    createdQuotationItems.forEach((qi) => memoryDb.quotationItems.push(qi));

    memoryDb.addAudit(tenantId, 'CREATE_QUOTATION', 'quotations', quoId, newQuotation);
    memoryDb.notify();

    return this.getQuotationDetails(quoId, tenantId);
  },

  async submitQuotationForApproval(
    tenantId: string,
    quotationId: string,
    data: { remarks?: string },
    userId = 'usr-acme-lab-tech'
  ): Promise<Quotation> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/quotations/${quotationId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const qIdx = memoryDb.quotations.findIndex((q) => q.id === quotationId && (tenantId === 'all' || q.tenant_id === tenantId));
    if (qIdx < 0) throw new Error('Quotation not found');

    const quo = memoryDb.quotations[qIdx];
    if (quo.status !== 'DRAFT') {
      throw new Error(`Quotation is in ${quo.status} status and cannot be submitted for approval`);
    }

    const now = new Date().toISOString();
    const updatedQuo: Quotation = {
      ...quo,
      status: 'PENDING_APPROVAL',
      updated_at: now,
    };

    const approvalEntry: QuotationApproval = {
      id: `qa-${Date.now()}`,
      tenant_id: quo.tenant_id,
      quotation_id: quotationId,
      approval_status: 'PENDING',
      requested_by: userId,
      approval_remarks: data.remarks || null,
      requested_at: now,
      requested_by_user: memoryDb.profiles.find((p) => p.id === userId) || null,
    };

    memoryDb.quotations[qIdx] = updatedQuo;
    memoryDb.quotationApprovals.unshift(approvalEntry);

    memoryDb.addAudit(quo.tenant_id, 'SUBMIT_QUOTATION_FOR_APPROVAL', 'quotations', quotationId, approvalEntry);
    memoryDb.notify();

    return this.getQuotationDetails(quotationId, tenantId);
  },

  async approveInternalQuotation(
    tenantId: string,
    quotationId: string,
    data: { action: 'APPROVE' | 'REJECT'; remarks?: string },
    userId = 'usr-acme-lab-mgr'
  ): Promise<Quotation> {
    if (isSupabaseConfigured && supabase) {
      const endpoint = data.action === 'APPROVE' ? 'approve' : 'reject';
      const res = await fetch(`${API_BASE}/quotations/${quotationId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const qIdx = memoryDb.quotations.findIndex((q) => q.id === quotationId && (tenantId === 'all' || q.tenant_id === tenantId));
    if (qIdx < 0) throw new Error('Quotation not found');

    const quo = memoryDb.quotations[qIdx];
    if (quo.status !== 'PENDING_APPROVAL') {
      throw new Error('Quotation must be in PENDING_APPROVAL status to perform internal approval action');
    }

    const now = new Date().toISOString();
    const isApprove = data.action === 'APPROVE';

    if (!isApprove && (!data.remarks || !data.remarks.trim())) {
      throw new Error('Mandatory rejection remarks are required when rejecting a quotation');
    }

    const updatedQuo: Quotation = {
      ...quo,
      status: isApprove ? 'APPROVED' : 'REJECTED',
      approved_by: isApprove ? userId : quo.approved_by,
      approved_at: isApprove ? now : quo.approved_at,
      updated_at: now,
    };

    const appIdx = memoryDb.quotationApprovals.findIndex((qa) => qa.quotation_id === quotationId && qa.approval_status === 'PENDING');
    if (appIdx >= 0) {
      memoryDb.quotationApprovals[appIdx] = {
        ...memoryDb.quotationApprovals[appIdx],
        approval_status: isApprove ? 'APPROVED' : 'REJECTED',
        approved_by: userId,
        approval_remarks: data.remarks || memoryDb.quotationApprovals[appIdx].approval_remarks,
        approved_at: isApprove ? now : null,
        rejected_at: isApprove ? null : now,
        approved_by_user: memoryDb.profiles.find((p) => p.id === userId) || null,
      };
    }

    memoryDb.quotations[qIdx] = updatedQuo;
    memoryDb.addAudit(quo.tenant_id, isApprove ? 'QUOTATION_APPROVED' : 'QUOTATION_REJECTED', 'quotations', quotationId, {
      approved_by: userId,
      action: data.action,
      remarks: data.remarks,
    });
    memoryDb.notify();

    return this.getQuotationDetails(quotationId, tenantId);
  },

  async sendQuotationToClient(
    tenantId: string,
    quotationId: string,
    _userId = 'usr-acme-admin'
  ): Promise<Quotation> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/quotations/${quotationId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const qIdx = memoryDb.quotations.findIndex((q) => q.id === quotationId && (tenantId === 'all' || q.tenant_id === tenantId));
    if (qIdx < 0) throw new Error('Quotation not found');

    const quo = memoryDb.quotations[qIdx];
    if (quo.status !== 'APPROVED') {
      throw new Error('Quotation must be internally APPROVED before sending to client');
    }

    const now = new Date().toISOString();
    const updatedQuo: Quotation = {
      ...quo,
      status: 'SENT_TO_CLIENT',
      sent_at: now,
      updated_at: now,
    };

    memoryDb.quotations[qIdx] = updatedQuo;
    memoryDb.addAudit(quo.tenant_id, 'QUOTATION_SENT_TO_CLIENT', 'quotations', quotationId, { sent_at: now });
    memoryDb.notify();

    return this.getQuotationDetails(quotationId, tenantId);
  },

  async recordClientQuotationResponse(
    tenantId: string,
    quotationId: string,
    data: { response: 'APPROVED' | 'REJECTED'; remarks?: string; reference_number?: string },
    _userId = 'usr-acme-admin'
  ): Promise<Quotation> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/quotations/${quotationId}/client-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const qIdx = memoryDb.quotations.findIndex((q) => q.id === quotationId && (tenantId === 'all' || q.tenant_id === tenantId));
    if (qIdx < 0) throw new Error('Quotation not found');

    const quo = memoryDb.quotations[qIdx];
    if (quo.status !== 'SENT_TO_CLIENT') {
      throw new Error('Quotation must be SENT_TO_CLIENT before recording client response');
    }

    const now = new Date().toISOString();
    const isClientApproved = data.response === 'APPROVED';

    const updatedQuo: Quotation = {
      ...quo,
      status: isClientApproved ? 'CLIENT_APPROVED' : 'CLIENT_REJECTED',
      client_response: data.response,
      client_response_at: now,
      client_response_remarks: data.remarks || null,
      updated_at: now,
    };

    memoryDb.quotations[qIdx] = updatedQuo;
    memoryDb.addAudit(
      quo.tenant_id,
      isClientApproved ? 'CLIENT_APPROVED_QUOTATION' : 'CLIENT_REJECTED_QUOTATION',
      'quotations',
      quotationId,
      { client_response_at: now, response: data.response, remarks: data.remarks }
    );
    memoryDb.notify();

    return this.getQuotationDetails(quotationId, tenantId);
  },

  async createQuotationRevision(
    tenantId: string,
    quotationId: string,
    userId = 'usr-acme-admin'
  ): Promise<Quotation> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/quotations/${quotationId}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const quo = await this.getQuotationDetails(quotationId, tenantId);
    if (!quo) throw new Error('Quotation not found');

    const now = new Date().toISOString();
    const newVersion = quo.version_number + 1;
    const revId = `quo-${Date.now()}`;

    const revItems: QuotationItem[] = (quo.items || []).map((qi) => ({
      ...qi,
      id: `qi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      quotation_id: revId,
      created_at: now,
      updated_at: now,
    }));

    const revQuotation: Quotation = {
      ...quo,
      id: revId,
      version_number: newVersion,
      parent_quotation_id: quo.id,
      status: 'DRAFT',
      created_by: userId,
      approved_by: null,
      approved_at: null,
      sent_at: null,
      client_response_at: null,
      client_response: 'PENDING',
      client_response_remarks: null,
      created_at: now,
      updated_at: now,
      items: revItems,
      approvals: [],
    };

    memoryDb.quotations.unshift(revQuotation);
    revItems.forEach((qi) => memoryDb.quotationItems.push(qi));

    memoryDb.addAudit(tenantId, 'QUOTATION_REVISED', 'quotations', revId, {
      parent_quotation_id: quo.id,
      version_number: newVersion,
    });
    memoryDb.notify();

    return this.getQuotationDetails(revId, tenantId);
  },

  async createRequestFromQuotation(
    tenantId: string,
    quotationId: string,
    itemsToConvert: { quotation_item_id: string; quantity: number }[]
  ): Promise<{ requestId: string; requestNumber: string }> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/quotations/${quotationId}/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({ items: itemsToConvert }),
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const quo = memoryDb.quotations.find((q) => q.id === quotationId && (tenantId === 'all' || q.tenant_id === tenantId));
    if (!quo) throw new Error('Quotation not found');

    const reqId = `req-${Date.now()}`;
    const reqNo = `REQ-2026-${String(memoryDb.calibrationRequests.length + 1).padStart(6, '0')}`;
    const now = new Date().toISOString();

    const newReq: CalibrationRequest = {
      id: reqId,
      tenant_id: quo.tenant_id,
      organization_id: quo.organization_id || null,
      sub_org_id: quo.sub_org_id || null,
      request_number: reqNo,
      client_id: quo.client_id || '',
      collection_agent_id: quo.created_by || 'usr-acme-admin',
      collection_date: now.split('T')[0],
      priority: 'NORMAL',
      status: 'CREATED',
      created_by: quo.created_by || 'usr-acme-admin',
      created_at: now,
      updated_at: now,
      client: quo.client,
      items: [],
    };

    memoryDb.calibrationRequests.unshift(newReq);

    for (const item of itemsToConvert) {
      const qItem = memoryDb.quotationItems.find((qi) => qi.id === item.quotation_item_id);
      if (qItem) {
        qItem.consumed_quantity = (qItem.consumed_quantity || 0) + item.quantity;
        const ri: RequestItem = {
          id: `ri-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          tenant_id: quo.tenant_id,
          request_id: reqId,
          item_id: qItem.item_id,
          requested_quantity: item.quantity,
          item_available: 'YES',
          created_at: now,
          updated_at: now,
        };
        memoryDb.requestItems.push(ri);
      }
    }

    memoryDb.addAudit(tenantId, 'QUOTATION_REQUEST_CREATED', 'calibration_requests', reqId, { quotation_id: quotationId });
    memoryDb.notify();

    return { requestId: reqId, requestNumber: reqNo };
  },

  async getClientQuotationHistory(clientId: string, tenantId: string): Promise<Quotation[]> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/clients/${clientId}/quotation-history`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    return memoryDb.quotations
      .filter((q) => q.client_id === clientId && (tenantId === 'all' || q.tenant_id === tenantId))
      .map((q) => ({
        ...q,
        items: memoryDb.quotationItems.filter((qi) => qi.quotation_id === q.id),
      }));
  },

  async getClientHistory(clientId: string, tenantId: string): Promise<{ requests: any[]; quotations: any[]; invoices: any[] }> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/clients/${clientId}/history`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const reqs = memoryDb.calibrationRequests
      .filter((r) => r.client_id === clientId && (tenantId === 'all' || r.tenant_id === tenantId))
      .map((r) => ({
        id: r.id,
        reference_number: r.request_number,
        date: r.created_at,
        status: r.status,
        type: 'Calibration Request',
      }));

    const quos = memoryDb.quotations
      .filter((q) => q.client_id === clientId && (tenantId === 'all' || q.tenant_id === tenantId))
      .map((q) => ({
        id: q.id,
        reference_number: q.quotation_number,
        date: q.created_at,
        status: q.status,
        quotation_type: q.quotation_type || (q.request_id ? 'REQUEST_BASED' : 'STANDALONE'),
        total_amount: q.total_amount,
        type: 'Quotation',
      }));

    const invs = memoryDb.invoices
      .filter((i) => i.client_id === clientId && (tenantId === 'all' || i.tenant_id === tenantId))
      .map((i) => ({
        id: i.id,
        reference_number: i.invoice_number,
        date: i.created_at,
        status: i.status,
        total_amount: i.total_amount,
        type: 'Invoice',
      }));

    return { requests: reqs, quotations: quos, invoices: invs };
  },

  async getVendorHistory(vendorId: string, tenantId: string): Promise<{ purchase_orders: any[]; outsource_requests: any[]; calibration_records: any[] }> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/vendors/${vendorId}/history`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const pos = memoryDb.purchaseOrders
      .filter((p) => p.vendor_id === vendorId && (tenantId === 'all' || p.tenant_id === tenantId))
      .map((p) => ({
        id: p.id,
        po_number: p.po_number,
        date: p.created_at,
        status: p.status,
        total_cost: p.total_amount,
      }));

    const outs = memoryDb.vendorOutsourceRequests
      .filter((o) => o.vendor_id === vendorId && (tenantId === 'all' || o.tenant_id === tenantId))
      .map((o) => ({
        id: o.id,
        request_item_id: o.request_item_id,
        outsource_status: o.outsource_status,
        dispatch_date: o.created_at,
      }));

    return { purchase_orders: pos, outsource_requests: outs, calibration_records: [] };
  },

  // =========================================================================
  // STEP 13: COMMERCIAL INVOICES WORKFLOW
  // =========================================================================

  async getInvoices(
    tenantId: string,
    filters: { status?: string; invoiceType?: string; search?: string; clientId?: string } = {}
  ): Promise<Invoice[]> {
    return memoryDb.invoices
      .filter((inv) => {
        if (tenantId !== 'all' && inv.tenant_id !== tenantId) return false;
        if (filters.status && filters.status !== 'ALL' && inv.status !== filters.status) return false;
        if (filters.invoiceType && filters.invoiceType !== 'ALL' && inv.invoice_type !== filters.invoiceType) return false;
        if (filters.clientId && inv.client_id !== filters.clientId) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          const matchNo = inv.invoice_number.toLowerCase().includes(s);
          const matchClient = inv.client?.client_name?.toLowerCase().includes(s);
          const matchQuo = inv.quotation?.quotation_number?.toLowerCase().includes(s);
          if (!matchNo && !matchClient && !matchQuo) return false;
        }
        return true;
      })
      .map((inv) => ({
        ...inv,
        client: memoryDb.clients.find((c) => c.id === inv.client_id) || inv.client,
        request: memoryDb.calibrationRequests.find((r) => r.id === inv.request_id) || inv.request,
        quotation: memoryDb.quotations.find((q) => q.id === inv.quotation_id) || inv.quotation,
        items: memoryDb.invoiceItems
          .filter((ii) => ii.invoice_id === inv.id)
          .map((ii) => ({
            ...ii,
            item: memoryDb.items.find((i) => i.id === ii.item_id) || ii.item,
            request_item: memoryDb.requestItems.find((ri) => ri.id === ii.request_item_id) || ii.request_item,
            quotation_item: memoryDb.quotationItems.find((qi) => qi.id === ii.quotation_item_id) || ii.quotation_item,
          })),
      }));
  },

  async getInvoiceDetails(invoiceId: string, tenantId: string): Promise<Invoice> {
    const inv = memoryDb.invoices.find((i) => i.id === invoiceId && (tenantId === 'all' || i.tenant_id === tenantId));
    if (!inv) throw new Error('Invoice not found');

    const client = memoryDb.clients.find((c) => c.id === inv.client_id) || null;
    const request = memoryDb.calibrationRequests.find((r) => r.id === inv.request_id) || null;
    const quotation = memoryDb.quotations.find((q) => q.id === inv.quotation_id) || null;

    const items = memoryDb.invoiceItems
      .filter((ii) => ii.invoice_id === inv.id)
      .map((ii) => ({
        ...ii,
        item: memoryDb.items.find((i) => i.id === ii.item_id) || null,
        request_item: memoryDb.requestItems.find((ri) => ri.id === ii.request_item_id) || null,
        quotation_item: memoryDb.quotationItems.find((qi) => qi.id === ii.quotation_item_id) || null,
      }));

    return {
      ...inv,
      client,
      request,
      quotation,
      items,
      created_by_user: memoryDb.profiles.find((p) => p.id === inv.created_by) || null,
    };
  },

  async getEligibleQuotationItemsForInvoice(quotationId: string, tenantId: string) {
    const quo = memoryDb.quotations.find((q) => q.id === quotationId && (tenantId === 'all' || q.tenant_id === tenantId));
    if (!quo) throw new Error('Quotation not found');

    if (quo.status !== 'CLIENT_APPROVED') {
      throw new Error('Invoices can ONLY be generated against CLIENT_APPROVED quotations');
    }

    const quoItems = memoryDb.quotationItems.filter((qi) => qi.quotation_id === quotationId);
    
    // Find all already invoiced request_item_ids for this quotation
    const existingInvoices = memoryDb.invoices.filter((inv) => inv.quotation_id === quotationId && inv.status !== 'CANCELLED');
    const invoicedReqItemIds = new Set<string>();

    existingInvoices.forEach((inv) => {
      const items = memoryDb.invoiceItems.filter((ii) => ii.invoice_id === inv.id);
      items.forEach((ii) => { if (ii.request_item_id) invoicedReqItemIds.add(ii.request_item_id); });
    });

    const eligible = [];
    const remaining = [];

    for (const qi of quoItems) {
      const item = memoryDb.items.find((i) => i.id === qi.item_id);
      const requestItem = qi.request_item_id ? memoryDb.requestItems.find((ri) => ri.id === qi.request_item_id) : null;
      const isAlreadyInvoiced = qi.request_item_id ? invoicedReqItemIds.has(qi.request_item_id) : false;

      const row = {
        quotation_item_id: qi.id,
        request_item_id: qi.request_item_id,
        item_id: qi.item_id,
        item_code: item?.item_code || 'ITEM',
        item_name: item?.item_name || 'Instrument',
        serial_number: item?.serial_number || 'N/A',
        quantity: qi.quantity,
        unit_price: qi.final_unit_cost,
        tax_rate: qi.tax_rate,
        line_total: qi.line_total,
        is_already_invoiced: isAlreadyInvoiced,
        item,
        request_item: requestItem,
        quotation_item: qi,
      };

      if (!isAlreadyInvoiced) {
        eligible.push(row);
      } else {
        remaining.push(row);
      }
    }

    return {
      quotation: quo,
      eligible_items: eligible,
      already_invoiced_items: remaining,
    };
  },

  async createInvoice(
    tenantId: string,
    data: {
      quotation_id: string;
      invoice_type: InvoiceType;
      due_date: string;
      currency?: string;
      urgent_reason?: string;
      remarks?: string;
      items: {
        request_item_id?: string | null;
        item_id: string;
        quotation_item_id?: string | null;
        description?: string;
        quantity: number;
        unit_price?: number;
        tax_rate?: number;
        discount_amount?: number;
      }[];
    },
    userId = 'usr-acme-admin'
  ): Promise<Invoice> {
    const quo = memoryDb.quotations.find((q) => q.id === data.quotation_id && (tenantId === 'all' || q.tenant_id === tenantId));
    if (!quo) throw new Error('Quotation not found');

    if (quo.status !== 'CLIENT_APPROVED') {
      throw new Error('Invoices can ONLY be generated against CLIENT_APPROVED quotations');
    }

    if (data.invoice_type === 'URGENT' && (!data.urgent_reason || !data.urgent_reason.trim())) {
      throw new Error('Mandatory urgent reason is required when creating an URGENT invoice');
    }

    const { eligible_items } = await this.getEligibleQuotationItemsForInvoice(data.quotation_id, tenantId);

    // Duplicate Check & Transactional Integrity
    const selectedItemIds = new Set<string>();
    const createdInvoiceItems: InvoiceItem[] = [];
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const invId = `inv-${Date.now()}`;
    const invNumber = `INV-2026-${String(memoryDb.invoices.length + 1).padStart(6, '0')}`;
    const now = new Date().toISOString();

    for (const itemInput of data.items) {
      const lineKey = itemInput.request_item_id || itemInput.quotation_item_id || itemInput.item_id;
      if (selectedItemIds.has(lineKey)) {
        throw new Error(`Duplicate line item submission for item ${lineKey}`);
      }
      selectedItemIds.add(lineKey);

      const eligible = eligible_items.find((e) => (itemInput.quotation_item_id && e.quotation_item_id === itemInput.quotation_item_id) || (itemInput.request_item_id && e.request_item_id === itemInput.request_item_id));
      if (!eligible) {
        throw new Error(`Item ${lineKey} is already invoiced or not eligible for this quotation (HTTP 409 Conflict)`);
      }

      const unitPrice = itemInput.unit_price !== undefined ? itemInput.unit_price : eligible.unit_price;
      const qty = itemInput.quantity || 1;
      const lineSub = qty * unitPrice;
      const taxRate = itemInput.tax_rate !== undefined ? itemInput.tax_rate : 18.0;
      const taxAmount = (lineSub * taxRate) / 100;
      const discountAmount = itemInput.discount_amount || 0;
      const lineTotal = Math.max(0, lineSub + taxAmount - discountAmount);

      subtotal += lineSub;
      totalTax += taxAmount;
      totalDiscount += discountAmount;

      const ii: InvoiceItem = {
        id: `inv-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        tenant_id: tenantId,
        invoice_id: invId,
        request_item_id: itemInput.request_item_id,
        item_id: itemInput.item_id,
        quotation_item_id: eligible.quotation_item_id,
        description: itemInput.description || `Commercial Invoice line for ${eligible.item_name}`,
        quantity: qty,
        unit_price: unitPrice,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        line_total: lineTotal,
        created_at: now,
        updated_at: now,
        item: eligible.item,
        request_item: eligible.request_item,
        quotation_item: eligible.quotation_item,
      };

      createdInvoiceItems.push(ii);
    }

    const totalAmount = Math.max(0, subtotal + totalTax - totalDiscount);

    const newInvoice: Invoice = {
      id: invId,
      tenant_id: tenantId,
      organization_id: quo.organization_id || null,
      sub_org_id: quo.sub_org_id || null,
      invoice_number: invNumber,
      quotation_id: data.quotation_id,
      request_id: quo.request_id,
      client_id: quo.client_id,
      invoice_date: now.split('T')[0],
      due_date: data.due_date,
      invoice_type: data.invoice_type,
      status: 'DRAFT',
      currency: data.currency || 'INR',
      subtotal,
      tax_amount: totalTax,
      discount_amount: totalDiscount,
      total_amount: totalAmount,
      urgent_reason: data.urgent_reason || null,
      remarks: data.remarks || null,
      created_by: userId,
      created_at: now,
      updated_at: now,
      client: memoryDb.clients.find((c) => c.id === quo.client_id) || null,
      request: memoryDb.calibrationRequests.find((r) => r.id === quo.request_id) || null,
      quotation: quo,
      items: createdInvoiceItems,
    };

    memoryDb.invoices.unshift(newInvoice);
    createdInvoiceItems.forEach((ii) => memoryDb.invoiceItems.push(ii));

    memoryDb.addAudit(tenantId, 'CREATE_INVOICE', 'invoices', invId, newInvoice);
    memoryDb.notify();

    return this.getInvoiceDetails(invId, tenantId);
  },

  async markInvoiceReady(
    tenantId: string,
    invoiceId: string,
    data: { remarks?: string },
    _userId = 'usr-acme-admin'
  ): Promise<Invoice> {
    const invIdx = memoryDb.invoices.findIndex((i) => i.id === invoiceId && (tenantId === 'all' || i.tenant_id === tenantId));
    if (invIdx < 0) throw new Error('Invoice not found');

    const inv = memoryDb.invoices[invIdx];
    if (inv.status !== 'DRAFT') {
      throw new Error(`Invoice is in ${inv.status} status and cannot be marked READY`);
    }

    const now = new Date().toISOString();
    const updatedInv: Invoice = {
      ...inv,
      status: 'READY',
      remarks: data.remarks || inv.remarks,
      updated_at: now,
    };

    memoryDb.invoices[invIdx] = updatedInv;
    memoryDb.addAudit(inv.tenant_id, 'INVOICE_MARKED_READY', 'invoices', invoiceId, { ready_at: now });
    memoryDb.notify();

    return this.getInvoiceDetails(invoiceId, tenantId);
  },

  async cancelInvoice(
    tenantId: string,
    invoiceId: string,
    data: { cancellation_reason: string },
    _userId = 'usr-acme-admin'
  ): Promise<Invoice> {
    const invIdx = memoryDb.invoices.findIndex((i) => i.id === invoiceId && (tenantId === 'all' || i.tenant_id === tenantId));
    if (invIdx < 0) throw new Error('Invoice not found');

    const inv = memoryDb.invoices[invIdx];
    if (inv.status === 'CANCELLED') {
      throw new Error('Invoice is already cancelled');
    }

    if (!data.cancellation_reason || !data.cancellation_reason.trim()) {
      throw new Error('Mandatory cancellation reason is required');
    }

    const now = new Date().toISOString();
    const updatedInv: Invoice = {
      ...inv,
      status: 'CANCELLED',
      remarks: `CANCELLED: ${data.cancellation_reason}`,
      updated_at: now,
    };

    memoryDb.invoices[invIdx] = updatedInv;
    memoryDb.addAudit(inv.tenant_id, 'INVOICE_CANCELLED', 'invoices', invoiceId, { cancellation_reason: data.cancellation_reason });
    memoryDb.notify();

    return this.getInvoiceDetails(invoiceId, tenantId);
  },

  // ==========================================
  // STEP 14: CLIENT DIGITAL SIGNATURE WORKFLOW
  // ==========================================

  async createInvoiceSignatureRequest(
    tenantId: string,
    invoiceId: string,
    data: {
      signer_name: string;
      signer_role?: string;
      signer_email?: string;
      signer_phone?: string;
      expires_in_days?: number;
    },
    userId = 'usr-acme-admin'
  ): Promise<InvoiceSignatureRequest> {
    const inv = memoryDb.invoices.find((i) => i.id === invoiceId && (tenantId === 'all' || i.tenant_id === tenantId));
    if (!inv) throw new Error('Invoice not found');

    if (inv.status === 'DRAFT') {
      throw new Error('Signature request cannot be created for DRAFT invoice');
    }
    if (inv.status === 'CANCELLED') {
      throw new Error('Signature request cannot be created for CANCELLED invoice');
    }

    const existingPending = memoryDb.signatureRequests.find(
      (r) => r.invoice_id === invoiceId && (r.status === 'PENDING' || r.status === 'OPENED')
    );
    if (existingPending) {
      throw new Error(`Active signature request ${existingPending.request_reference} already exists for this invoice`);
    }

    const reqRef = `SIG-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();
    const expiresDays = data.expires_in_days || 7;
    const expiresAt = new Date(Date.now() + expiresDays * 86400000).toISOString();

    const newReq: InvoiceSignatureRequest = {
      id: `sig-req-${Date.now()}`,
      tenant_id: inv.tenant_id,
      organization_id: inv.organization_id,
      sub_org_id: inv.sub_org_id,
      invoice_id: invoiceId,
      client_id: inv.client_id,
      request_reference: reqRef,
      status: 'PENDING',
      requested_at: now,
      expires_at: expiresAt,
      created_by: userId,
      signer_name: data.signer_name,
      signer_role: data.signer_role,
      signer_email: data.signer_email,
      signer_phone: data.signer_phone,
      created_at: now,
      updated_at: now,
      invoice: inv,
      client: memoryDb.clients.find((c) => c.id === inv.client_id) || null,
    };

    memoryDb.signatureRequests.unshift(newReq);

    // Update invoice status to SIGNATURE_REQUIRED if currently READY / ISSUED
    const invIdx = memoryDb.invoices.findIndex((i) => i.id === invoiceId);
    if (invIdx >= 0) {
      memoryDb.invoices[invIdx] = {
        ...memoryDb.invoices[invIdx],
        status: 'SIGNATURE_REQUIRED',
        updated_at: now,
      };
    }

    memoryDb.addAudit(inv.tenant_id, 'INVOICE_SIGNATURE_REQUESTED', 'invoice_signature_requests', newReq.id, {
      request_reference: reqRef,
      invoice_id: invoiceId,
      client_id: inv.client_id,
      signer_name: data.signer_name,
    });
    memoryDb.notify();

    return newReq;
  },

  async getSignatureRequestByRef(requestReference: string): Promise<InvoiceSignatureRequest> {
    const req = memoryDb.signatureRequests.find((r) => r.request_reference === requestReference);
    if (!req) throw new Error('Signature request not found or invalid link');

    // Check expiry
    if (req.status === 'PENDING' || req.status === 'OPENED') {
      const now = new Date();
      if (new Date(req.expires_at) < now) {
        req.status = 'EXPIRED';
        req.updated_at = now.toISOString();
        memoryDb.addAudit(req.tenant_id, 'INVOICE_SIGNATURE_EXPIRED', 'invoice_signature_requests', req.id, {
          request_reference: requestReference,
        });
        memoryDb.notify();
      }
    }

    const inv = memoryDb.invoices.find((i) => i.id === req.invoice_id);
    const client = memoryDb.clients.find((c) => c.id === req.client_id);
    let items: InvoiceItem[] = [];
    if (inv) {
      items = memoryDb.invoiceItems.filter((item) => item.invoice_id === inv.id);
    }

    return {
      ...req,
      invoice: inv ? { ...inv, items } : null,
      client,
    };
  },

  async openSignatureRequest(requestReference: string): Promise<InvoiceSignatureRequest> {
    const reqIdx = memoryDb.signatureRequests.findIndex((r) => r.request_reference === requestReference);
    if (reqIdx < 0) throw new Error('Signature request not found');

    const req = memoryDb.signatureRequests[reqIdx];
    if (req.status === 'PENDING') {
      const now = new Date().toISOString();
      const updated = { ...req, status: 'OPENED' as const, updated_at: now };
      memoryDb.signatureRequests[reqIdx] = updated;
      memoryDb.addAudit(req.tenant_id, 'INVOICE_SIGNATURE_OPENED', 'invoice_signature_requests', req.id, {
        request_reference: requestReference,
      });
      memoryDb.notify();
      return updated;
    }
    return req;
  },

  async signInvoice(
    requestReference: string,
    data: {
      signer_name: string;
      signer_role?: string;
      signer_email?: string;
      signer_phone?: string;
      signature_data: string;
    }
  ): Promise<{ signature: Signature; request: InvoiceSignatureRequest; signed_invoice_doc_id: string }> {
    const reqIdx = memoryDb.signatureRequests.findIndex((r) => r.request_reference === requestReference);
    if (reqIdx < 0) throw new Error('Signature request not found');

    const req = memoryDb.signatureRequests[reqIdx];

    if (req.status === 'SIGNED') {
      throw new Error('Invoice signature request has already been signed');
    }
    if (req.status === 'EXPIRED') {
      throw new Error('Invoice signature request has expired');
    }
    if (req.status === 'CANCELLED' || req.status === 'REJECTED') {
      throw new Error(`Signature request is in ${req.status} status and cannot be signed`);
    }

    if (new Date(req.expires_at) < new Date()) {
      req.status = 'EXPIRED';
      memoryDb.notify();
      throw new Error('Invoice signature request has expired');
    }

    if (!data.signer_name || !data.signer_name.trim()) {
      throw new Error('Signer name is required');
    }
    if (!data.signature_data || data.signature_data.length < 10) {
      throw new Error('Valid signature drawing canvas data is required');
    }

    const now = new Date().toISOString();
    const sigRef = `SIG-DOC-${Date.now()}`;
    const r2Key = `signatures/invoices/${requestReference}/signature_${Date.now()}.png`;
    const docId = `doc-signed-inv-${Date.now()}`;

    // Create Signature record (type = INVOICE)
    const newSignature: Signature = {
      id: `sig-${Date.now()}`,
      tenant_id: req.tenant_id,
      organization_id: req.organization_id,
      sub_org_id: req.sub_org_id,
      invoice_id: req.invoice_id,
      client_id: req.client_id,
      signature_type: 'INVOICE',
      signature_status: 'SIGNED',
      signer_name: data.signer_name,
      signer_role: data.signer_role || req.signer_role,
      signer_email: data.signer_email || req.signer_email,
      signer_phone: data.signer_phone || req.signer_phone,
      signature_reference: sigRef,
      signed_at: now,
      signature_storage_reference: r2Key,
      document_id: docId,
      ip_address: '127.0.0.1 (Logged)',
      user_agent: 'ClientBrowser/DigitalPad',
      created_at: now,
      updated_at: now,
    };

    memoryDb.signatures.unshift(newSignature);

    // Update Signature Request status
    const updatedReq: InvoiceSignatureRequest = {
      ...req,
      status: 'SIGNED',
      signer_name: data.signer_name,
      signer_role: data.signer_role || req.signer_role,
      signer_email: data.signer_email || req.signer_email,
      signer_phone: data.signer_phone || req.signer_phone,
      updated_at: now,
    };
    memoryDb.signatureRequests[reqIdx] = updatedReq;

    // Update Invoice status to SIGNED
    const invIdx = memoryDb.invoices.findIndex((i) => i.id === req.invoice_id);
    if (invIdx >= 0) {
      memoryDb.invoices[invIdx] = {
        ...memoryDb.invoices[invIdx],
        status: 'SIGNED',
        signature: newSignature,
        updated_at: now,
      };
    }

    // Add document record for signed invoice PDF version (SIGNED_INVOICE)
    const newDoc: DocumentItem = {
      id: docId,
      tenant_id: req.tenant_id,
      request_id: req.invoice_id,
      document_type: 'OTHER',
      file_name: `Signed_Invoice_${req.request_reference}.pdf`,
      storage_reference: `documents/signed_invoices/${req.invoice_id}/signed_invoice_${req.request_reference}.pdf`,
      mime_type: 'application/pdf',
      file_size: 145000,
      mandatory: false,
      uploaded_by: 'system',
      uploaded_at: now,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    memoryDb.documents.unshift(newDoc);

    memoryDb.addAudit(req.tenant_id, 'INVOICE_SIGNATURE_SIGNED', 'signatures', newSignature.id, {
      request_reference: requestReference,
      signature_reference: sigRef,
      signer_name: data.signer_name,
      signed_at: now,
    });
    memoryDb.addAudit(req.tenant_id, 'SIGNED_INVOICE_GENERATED', 'documents', docId, {
      invoice_id: req.invoice_id,
      request_reference: requestReference,
    });
    memoryDb.notify();

    return { signature: newSignature, request: updatedReq, signed_invoice_doc_id: docId };
  },

  async rejectSignatureRequest(
    requestReference: string,
    data: {
      signer_name: string;
      signer_role?: string;
      rejection_reason: string;
    }
  ): Promise<InvoiceSignatureRequest> {
    const reqIdx = memoryDb.signatureRequests.findIndex((r) => r.request_reference === requestReference);
    if (reqIdx < 0) throw new Error('Signature request not found');

    const req = memoryDb.signatureRequests[reqIdx];
    if (req.status === 'SIGNED') {
      throw new Error('Signed requests cannot be rejected');
    }

    if (!data.rejection_reason || !data.rejection_reason.trim()) {
      throw new Error('Rejection reason is required');
    }

    const now = new Date().toISOString();
    const updatedReq: InvoiceSignatureRequest = {
      ...req,
      status: 'REJECTED',
      signer_name: data.signer_name || req.signer_name,
      signer_role: data.signer_role || req.signer_role,
      rejection_reason: data.rejection_reason,
      rejected_at: now,
      updated_at: now,
    };
    memoryDb.signatureRequests[reqIdx] = updatedReq;

    // Update invoice status back to READY
    const invIdx = memoryDb.invoices.findIndex((i) => i.id === req.invoice_id);
    if (invIdx >= 0) {
      memoryDb.invoices[invIdx] = {
        ...memoryDb.invoices[invIdx],
        status: 'READY',
        remarks: `SIGNATURE REJECTED by ${data.signer_name}: ${data.rejection_reason}`,
        updated_at: now,
      };
    }

    memoryDb.addAudit(req.tenant_id, 'INVOICE_SIGNATURE_REJECTED', 'invoice_signature_requests', req.id, {
      request_reference: requestReference,
      signer_name: data.signer_name,
      rejection_reason: data.rejection_reason,
    });
    memoryDb.notify();

    return updatedReq;
  },

  async retrySignatureRequest(
    tenantId: string,
    invoiceId: string,
    data: {
      signer_name: string;
      signer_role?: string;
      signer_email?: string;
      signer_phone?: string;
      expires_in_days?: number;
    },
    userId = 'usr-acme-admin'
  ): Promise<InvoiceSignatureRequest> {
    const inv = memoryDb.invoices.find((i) => i.id === invoiceId && (tenantId === 'all' || i.tenant_id === tenantId));
    if (!inv) throw new Error('Invoice not found');

    // Create a new request reference (do not overwrite old request)
    const newReq = await this.createInvoiceSignatureRequest(tenantId, invoiceId, data, userId);

    memoryDb.addAudit(inv.tenant_id, 'INVOICE_SIGNATURE_RETRY_CREATED', 'invoice_signature_requests', newReq.id, {
      invoice_id: invoiceId,
      new_request_reference: newReq.request_reference,
    });
    memoryDb.notify();

    return newReq;
  },

  async getInvoiceSignature(
    invoiceId: string,
    tenantId: string
  ): Promise<{ signature: Signature | null; requests: InvoiceSignatureRequest[] }> {
    const signature = memoryDb.signatures.find(
      (s) => s.invoice_id === invoiceId && s.signature_type === 'INVOICE' && (tenantId === 'all' || s.tenant_id === tenantId)
    ) || null;

    const requests = memoryDb.signatureRequests.filter(
      (r) => r.invoice_id === invoiceId && (tenantId === 'all' || r.tenant_id === tenantId)
    );

    return { signature, requests };
  },

  async generateSignedInvoiceDocument(
    tenantId: string,
    invoiceId: string
  ): Promise<{ document_id: string; document_name: string; file_path: string }> {
    const inv = memoryDb.invoices.find((i) => i.id === invoiceId && (tenantId === 'all' || i.tenant_id === tenantId));
    if (!inv) throw new Error('Invoice not found');

    const signature = memoryDb.signatures.find((s) => s.invoice_id === invoiceId && s.signature_type === 'INVOICE');
    if (!signature) throw new Error('Cannot generate signed document: Invoice is not digitally signed yet');

    const docId = `doc-signed-${Date.now()}`;
    const docName = `Signed_Tax_Invoice_${inv.invoice_number}.pdf`;
    const path = `documents/signed_invoices/${invoiceId}/${docName}`;

    memoryDb.addAudit(inv.tenant_id, 'SIGNED_INVOICE_GENERATED', 'documents', docId, {
      invoice_id: invoiceId,
      signature_reference: signature.signature_reference,
    });
    memoryDb.notify();

    return { document_id: docId, document_name: docName, file_path: path };
  },

  // ==========================================
  // STEP 15: DISPATCH, TRACKING & CLIENT DELIVERY
  // ==========================================

  async getDispatches(
    tenantId: string,
    filters?: { status?: string; dispatch_type?: string; search?: string }
  ): Promise<Dispatch[]> {
    let list = memoryDb.dispatches.filter((d) => tenantId === 'all' || d.tenant_id === tenantId);

    if (filters?.status && filters.status !== 'all') {
      list = list.filter((d) => d.status === filters.status);
    }
    if (filters?.dispatch_type && filters.dispatch_type !== 'all') {
      list = list.filter((d) => d.dispatch_type === filters.dispatch_type);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.dispatch_number.toLowerCase().includes(q) ||
          d.carrier_name?.toLowerCase().includes(q) ||
          d.tracking_number?.toLowerCase().includes(q) ||
          d.shipping_address.toLowerCase().includes(q)
      );
    }

    return list.map((d) => {
      const client = memoryDb.clients.find((c) => c.id === d.client_id) || null;
      const req = memoryDb.calibrationRequests.find((r) => r.id === d.request_id) || null;
      const inv = d.invoice_id ? memoryDb.invoices.find((i) => i.id === d.invoice_id) || null : null;
      const items = memoryDb.dispatchItems
        .filter((di) => di.dispatch_id === d.id)
        .map((di) => ({
          ...di,
          item: memoryDb.items.find((i) => i.id === di.item_id) || null,
          request_item: memoryDb.requestItems.find((ri) => ri.id === di.request_item_id) || null,
        }));
      const deliv = memoryDb.deliveries.find((del) => del.dispatch_id === d.id) || null;

      return {
        ...d,
        client,
        request: req,
        invoice: inv,
        items,
        delivery: deliv,
      };
    });
  },

  async getEligibleItemsForDispatch(
    tenantId: string,
    clientId?: string,
    requestId?: string
  ): Promise<{ eligible_items: any[] }> {
    // Eligible items must belong to signed invoices (or ready invoices) with completed calibration
    const eligible: any[] = [];

    const tenantInvoices = memoryDb.invoices.filter(
      (i) => (tenantId === 'all' || i.tenant_id === tenantId) && i.status !== 'DRAFT' && i.status !== 'CANCELLED'
    );

    for (const inv of tenantInvoices) {
      if (clientId && inv.client_id !== clientId) continue;
      if (requestId && inv.request_id !== requestId) continue;

      const invItems = memoryDb.invoiceItems.filter((ii) => ii.invoice_id === inv.id);
      const req = memoryDb.calibrationRequests.find((r) => r.id === inv.request_id);
      const client = memoryDb.clients.find((c) => c.id === inv.client_id);
      const invoiceSig = memoryDb.signatures.find((s) => s.invoice_id === inv.id && s.signature_type === 'INVOICE');

      for (const itemRow of invItems) {
        const isDispatched = memoryDb.dispatchItems.some((di) => di.request_item_id === itemRow.request_item_id);

        if (!isDispatched) {
          const masterItem = memoryDb.items.find((m) => m.id === itemRow.item_id);

          eligible.push({
            request_item_id: itemRow.request_item_id,
            item_id: itemRow.item_id,
            item_code: masterItem?.item_code || 'ITM-UNKNOWN',
            item_name: masterItem?.item_name || itemRow.description,
            serial_number: masterItem?.serial_number || 'N/A',
            request_id: inv.request_id,
            request_number: req?.request_number || 'N/A',
            client_id: inv.client_id,
            client_name: client?.client_name || 'Client',
            invoice_id: inv.id,
            invoice_number: inv.invoice_number,
            invoice_item_id: itemRow.id,
            invoice_status: inv.status,
            invoice_signature_status: invoiceSig ? 'SIGNED' : 'PENDING',
            quantity: itemRow.quantity,
          });
        }
      }
    }

    return { eligible_items: eligible };
  },

  async getDispatchDetails(dispatchId: string, tenantId: string): Promise<Dispatch> {
    const dsp = memoryDb.dispatches.find((d) => d.id === dispatchId && (tenantId === 'all' || d.tenant_id === tenantId));
    if (!dsp) throw new Error('Dispatch record not found');

    const client = memoryDb.clients.find((c) => c.id === dsp.client_id) || null;
    const req = memoryDb.calibrationRequests.find((r) => r.id === dsp.request_id) || null;
    const inv = dsp.invoice_id ? memoryDb.invoices.find((i) => i.id === dsp.invoice_id) || null : null;
    const items = memoryDb.dispatchItems
      .filter((di) => di.dispatch_id === dsp.id)
      .map((di) => ({
        ...di,
        item: memoryDb.items.find((i) => i.id === di.item_id) || null,
        request_item: memoryDb.requestItems.find((ri) => ri.id === di.request_item_id) || null,
        invoice_item: memoryDb.invoiceItems.find((ii) => ii.id === di.invoice_item_id) || null,
      }));

    const deliv = memoryDb.deliveries.find((del) => del.dispatch_id === dsp.id) || null;
    let delivWithSig = deliv;
    if (deliv) {
      const delivSig = memoryDb.signatures.find((s) => s.invoice_id === dsp.id && s.signature_type === 'DELIVERY') || null;
      delivWithSig = { ...deliv, signature: delivSig };
    }

    return {
      ...dsp,
      client,
      request: req,
      invoice: inv,
      items,
      delivery: delivWithSig,
    };
  },

  async createDispatch(
    tenantId: string,
    data: {
      request_id: string;
      invoice_id?: string;
      client_id: string;
      dispatch_type: 'STANDARD' | 'PARTIAL' | 'URGENT';
      dispatch_date: string;
      expected_delivery_date?: string;
      shipping_address: string;
      billing_address?: string;
      urgent_reason?: string;
      remarks?: string;
      selected_item_ids: string[];
    },
    userId = 'usr-acme-admin'
  ): Promise<Dispatch> {
    if (!data.selected_item_ids || data.selected_item_ids.length === 0) {
      throw new Error('At least one item must be selected for dispatch');
    }

    if (data.dispatch_type === 'URGENT' && (!data.urgent_reason || !data.urgent_reason.trim())) {
      throw new Error('Mandatory urgent reason is required for URGENT dispatches');
    }

    // Duplicate item dispatch check
    for (const reqItemId of data.selected_item_ids) {
      const alreadyDispatched = memoryDb.dispatchItems.some((di) => di.request_item_id === reqItemId);
      if (alreadyDispatched) {
        throw new Error(`Item ${reqItemId} has already been added to another dispatch`);
      }
    }

    const dspNumber = `DSP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();
    const dspId = `dsp-${Date.now()}`;

    const newDsp: Dispatch = {
      id: dspId,
      tenant_id: tenantId,
      organization_id: 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa',
      dispatch_number: dspNumber,
      request_id: data.request_id,
      invoice_id: data.invoice_id,
      client_id: data.client_id,
      dispatch_type: data.dispatch_type,
      status: 'READY_FOR_DISPATCH',
      dispatch_date: data.dispatch_date,
      expected_delivery_date: data.expected_delivery_date,
      shipping_address: data.shipping_address,
      billing_address: data.billing_address,
      urgent_reason: data.urgent_reason,
      remarks: data.remarks,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };

    memoryDb.dispatches.unshift(newDsp);

    // Create Dispatch Items
    data.selected_item_ids.forEach((reqItemId) => {
      const invItem = memoryDb.invoiceItems.find((ii) => ii.request_item_id === reqItemId);
      const newDspItem: DispatchItem = {
        id: `dsp-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        tenant_id: tenantId,
        dispatch_id: dspId,
        request_item_id: reqItemId,
        item_id: invItem?.item_id || '77777777-1111-4777-a111-111111111111',
        invoice_id: data.invoice_id || invItem?.invoice_id,
        invoice_item_id: invItem?.id,
        quantity: invItem?.quantity || 1,
        package_reference: undefined,
        created_at: now,
        updated_at: now,
      };
      memoryDb.dispatchItems.unshift(newDspItem);
    });

    memoryDb.addAudit(tenantId, 'DISPATCH_CREATED', 'dispatches', dspId, {
      dispatch_number: dspNumber,
      dispatch_type: data.dispatch_type,
      item_count: data.selected_item_ids.length,
    });
    memoryDb.notify();

    return this.getDispatchDetails(dspId, tenantId);
  },

  async startPacking(
    tenantId: string,
    dispatchId: string,
    data: { remarks?: string }
  ): Promise<Dispatch> {
    const dspIdx = memoryDb.dispatches.findIndex((d) => d.id === dispatchId && (tenantId === 'all' || d.tenant_id === tenantId));
    if (dspIdx < 0) throw new Error('Dispatch record not found');

    const dsp = memoryDb.dispatches[dspIdx];
    const now = new Date().toISOString();

    memoryDb.dispatches[dspIdx] = {
      ...dsp,
      status: 'PACKING',
      remarks: data.remarks ? `${dsp.remarks || ''}\n${data.remarks}`.trim() : dsp.remarks,
      updated_at: now,
    };

    memoryDb.addAudit(dsp.tenant_id, 'DISPATCH_PACKING_STARTED', 'dispatches', dispatchId, { status: 'PACKING' });
    memoryDb.notify();

    return this.getDispatchDetails(dispatchId, tenantId);
  },

  async markPacked(
    tenantId: string,
    dispatchId: string,
    data: { package_reference: string; number_of_packages?: number; packing_remarks?: string }
  ): Promise<Dispatch> {
    const dspIdx = memoryDb.dispatches.findIndex((d) => d.id === dispatchId && (tenantId === 'all' || d.tenant_id === tenantId));
    if (dspIdx < 0) throw new Error('Dispatch record not found');

    if (!data.package_reference || !data.package_reference.trim()) {
      throw new Error('Package reference is required');
    }

    const dsp = memoryDb.dispatches[dspIdx];
    const now = new Date().toISOString();

    memoryDb.dispatches[dspIdx] = {
      ...dsp,
      status: 'PACKED',
      remarks: `PACKED (${data.package_reference}): ${data.packing_remarks || 'Equipment packed'}`,
      updated_at: now,
    };

    // Update package reference on dispatch items
    memoryDb.dispatchItems.forEach((di, idx) => {
      if (di.dispatch_id === dispatchId) {
        memoryDb.dispatchItems[idx].package_reference = data.package_reference;
      }
    });

    memoryDb.addAudit(dsp.tenant_id, 'DISPATCH_MARKED_PACKED', 'dispatches', dispatchId, {
      package_reference: data.package_reference,
    });
    memoryDb.notify();

    return this.getDispatchDetails(dispatchId, tenantId);
  },

  async shipDispatch(
    tenantId: string,
    dispatchId: string,
    data: {
      carrier_name: string;
      tracking_number: string;
      dispatch_date: string;
      expected_delivery_date?: string;
      remarks?: string;
    },
    userId = 'usr-acme-admin'
  ): Promise<Dispatch> {
    const dspIdx = memoryDb.dispatches.findIndex((d) => d.id === dispatchId && (tenantId === 'all' || d.tenant_id === tenantId));
    if (dspIdx < 0) throw new Error('Dispatch record not found');

    const dsp = memoryDb.dispatches[dspIdx];

    if (!data.carrier_name || !data.carrier_name.trim()) {
      throw new Error('Carrier name is required');
    }
    if (!data.tracking_number || !data.tracking_number.trim()) {
      throw new Error('Tracking number is required');
    }

    const now = new Date().toISOString();

    memoryDb.dispatches[dspIdx] = {
      ...dsp,
      status: 'DISPATCHED',
      carrier_name: data.carrier_name.trim(),
      tracking_number: data.tracking_number.trim(),
      dispatch_date: data.dispatch_date,
      expected_delivery_date: data.expected_delivery_date || dsp.expected_delivery_date,
      dispatched_by: userId,
      dispatched_at: now,
      updated_at: now,
    };

    // Update calibration request status to DISPATCHED / PARTIALLY_COMPLETED
    const reqIdx = memoryDb.calibrationRequests.findIndex((r) => r.id === dsp.request_id);
    if (reqIdx >= 0) {
      memoryDb.calibrationRequests[reqIdx] = {
        ...memoryDb.calibrationRequests[reqIdx],
        status: 'DISPATCHED',
        updated_at: now,
      };
    }

    memoryDb.addAudit(dsp.tenant_id, 'DISPATCH_SHIPPED', 'dispatches', dispatchId, {
      carrier: data.carrier_name,
      tracking_number: data.tracking_number,
    });
    memoryDb.notify();

    return this.getDispatchDetails(dispatchId, tenantId);
  },

  async updateDispatchTracking(
    tenantId: string,
    dispatchId: string,
    data: { status: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED'; carrier_notes?: string }
  ): Promise<Dispatch> {
    const dspIdx = memoryDb.dispatches.findIndex((d) => d.id === dispatchId && (tenantId === 'all' || d.tenant_id === tenantId));
    if (dspIdx < 0) throw new Error('Dispatch record not found');

    const dsp = memoryDb.dispatches[dspIdx];
    const now = new Date().toISOString();

    memoryDb.dispatches[dspIdx] = {
      ...dsp,
      status: data.status,
      remarks: data.carrier_notes ? `${dsp.remarks || ''}\n${data.carrier_notes}`.trim() : dsp.remarks,
      updated_at: now,
    };

    memoryDb.addAudit(dsp.tenant_id, 'DISPATCH_TRACKING_UPDATED', 'dispatches', dispatchId, {
      new_status: data.status,
    });
    memoryDb.notify();

    return this.getDispatchDetails(dispatchId, tenantId);
  },

  async confirmDelivery(
    tenantId: string,
    dispatchId: string,
    data: {
      recipient_name: string;
      recipient_role?: string;
      recipient_email?: string;
      recipient_phone?: string;
      delivery_date: string;
      delivery_signature_data: string;
      remarks?: string;
    }
  ): Promise<{ dispatch: Dispatch; delivery: Delivery; signature: Signature }> {
    const dspIdx = memoryDb.dispatches.findIndex((d) => d.id === dispatchId && (tenantId === 'all' || d.tenant_id === tenantId));
    if (dspIdx < 0) throw new Error('Dispatch record not found');

    const dsp = memoryDb.dispatches[dspIdx];

    if (!data.recipient_name || !data.recipient_name.trim()) {
      throw new Error('Recipient name is required');
    }
    if (!data.delivery_signature_data || data.delivery_signature_data.length < 10) {
      throw new Error('Valid delivery signature drawing is required');
    }

    const now = new Date().toISOString();
    const delivSigRef = `DELIV-SIG-${Date.now()}`;
    const r2Key = `signatures/deliveries/${dispatchId}/delivery_signature_${Date.now()}.png`;
    const delivDocId = `doc-deliv-note-${Date.now()}`;

    // Create Delivery Signature (signature_type = 'DELIVERY')
    const newDelivSig: Signature = {
      id: `sig-deliv-${Date.now()}`,
      tenant_id: dsp.tenant_id,
      organization_id: dsp.organization_id,
      sub_org_id: dsp.sub_org_id,
      invoice_id: dsp.id, // linked to dispatch_id
      client_id: dsp.client_id,
      signature_type: 'DELIVERY',
      signature_status: 'SIGNED',
      signer_name: data.recipient_name.trim(),
      signer_role: data.recipient_role,
      signer_email: data.recipient_email,
      signer_phone: data.recipient_phone,
      signature_reference: delivSigRef,
      signed_at: now,
      signature_storage_reference: r2Key,
      document_id: delivDocId,
      ip_address: '127.0.0.1 (Delivery Tablet)',
      user_agent: 'DeliveryApp/HandheldPad',
      created_at: now,
      updated_at: now,
    };
    memoryDb.signatures.unshift(newDelivSig);

    // Create Delivery Record
    const newDelivery: Delivery = {
      id: `deliv-${Date.now()}`,
      tenant_id: dsp.tenant_id,
      dispatch_id: dispatchId,
      client_id: dsp.client_id,
      recipient_name: data.recipient_name.trim(),
      recipient_role: data.recipient_role,
      recipient_email: data.recipient_email,
      recipient_phone: data.recipient_phone,
      delivery_date: data.delivery_date || now,
      delivery_status: 'DELIVERED',
      proof_of_delivery_storage_ref: r2Key,
      remarks: data.remarks,
      created_at: now,
      updated_at: now,
      signature: newDelivSig,
    };
    memoryDb.deliveries.unshift(newDelivery);

    // Update Dispatch status to DELIVERED
    memoryDb.dispatches[dspIdx] = {
      ...dsp,
      status: 'DELIVERED',
      delivered_at: data.delivery_date || now,
      updated_at: now,
    };

    // Calculate Parent Request Completion Status
    const reqId = dsp.request_id;
    const reqItems = memoryDb.requestItems.filter((ri) => ri.request_id === reqId);

    // Count how many request items are now delivered across all dispatches
    let allDeliveredCount = 0;
    reqItems.forEach((ri) => {
      const isDelivered = memoryDb.dispatchItems.some((di) => {
        if (di.request_item_id !== ri.id) return false;
        const parentDsp = memoryDb.dispatches.find((d) => d.id === di.dispatch_id);
        return parentDsp?.status === 'DELIVERED';
      });
      if (isDelivered) allDeliveredCount++;
    });

    const isFullyCompleted = allDeliveredCount >= reqItems.length;
    const targetStatus = isFullyCompleted ? 'COMPLETED' : 'PARTIALLY_COMPLETED';

    const reqIdx = memoryDb.calibrationRequests.findIndex((r) => r.id === reqId);
    if (reqIdx >= 0) {
      memoryDb.calibrationRequests[reqIdx] = {
        ...memoryDb.calibrationRequests[reqIdx],
        status: targetStatus,
        updated_at: now,
      };
    }

    memoryDb.addAudit(dsp.tenant_id, 'DELIVERY_CONFIRMED', 'deliveries', newDelivery.id, {
      dispatch_number: dsp.dispatch_number,
      recipient_name: data.recipient_name,
      signature_reference: delivSigRef,
      request_status_result: targetStatus,
    });
    memoryDb.notify();

    const updatedDsp = await this.getDispatchDetails(dispatchId, tenantId);
    return { dispatch: updatedDsp, delivery: newDelivery, signature: newDelivSig };
  },

  async generateDeliveryDocument(
    tenantId: string,
    dispatchId: string
  ): Promise<{ document_id: string; document_name: string; file_path: string }> {
    const dsp = memoryDb.dispatches.find((d) => d.id === dispatchId && (tenantId === 'all' || d.tenant_id === tenantId));
    if (!dsp) throw new Error('Dispatch record not found');

    const docId = `doc-deliv-note-${Date.now()}`;
    const docName = `Delivery_Note_${dsp.dispatch_number}.pdf`;
    const path = `documents/delivery_notes/${dispatchId}/${docName}`;

    memoryDb.addAudit(dsp.tenant_id, 'DELIVERY_NOTE_GENERATED', 'documents', docId, {
      dispatch_number: dsp.dispatch_number,
    });
    memoryDb.notify();

    return { document_id: docId, document_name: docName, file_path: path };
  },

  // ============================================================================
  // STEP 16 METHODS: ANALYTICS, DASHBOARD, EXCEPTION CENTER, SEARCH & REPORTS
  // ============================================================================

  async getDashboardSummary(tenantId: string): Promise<DashboardSummary> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/dashboard/summary`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const requests = memoryDb.calibrationRequests.filter((r) => tenantId === 'all' || r.tenant_id === tenantId);
    const dispatches = memoryDb.dispatches.filter((d) => tenantId === 'all' || d.tenant_id === tenantId);
    const invoices = memoryDb.invoices.filter((i) => tenantId === 'all' || i.tenant_id === tenantId);
    const quotes = memoryDb.quotations.filter((q) => tenantId === 'all' || q.tenant_id === tenantId);

    return {
      totalRequests: requests.length,
      pendingCollection: requests.filter((r) => r.status === 'CREATED').length,
      labQueue: requests.filter((r) => r.status === 'LAB_QUEUE').length,
      pendingVerification: requests.filter((r) => r.status === 'VERIFICATION').length,
      calibrationInProgress: requests.filter((r) => (r.status as string) === 'CALIBRATION').length,
      faultyItems: memoryDb.calibrations.filter((c) => (c as any).calibration_result === 'FAIL').length,
      servicePendingApproval: memoryDb.serviceRequests.filter((s) => (s as any).approval_status === 'PENDING_APPROVAL').length,
      outsourcedItems: memoryDb.vendorOutsourceRequests.length,
      pendingQuotations: quotes.filter((q) => q.status === 'DRAFT').length,
      pendingApprovals: quotes.filter((q) => q.status === 'SENT_TO_CLIENT').length,
      pendingInvoices: invoices.filter((i) => i.status === 'ISSUED').length,
      awaitingClientSignature: invoices.filter((i) => (i.status as string) === 'CLIENT_SIGNATURE_PENDING').length,
      readyForDispatch: dispatches.filter((d) => d.status === 'READY_FOR_DISPATCH').length,
      inTransit: dispatches.filter((d) => ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(d.status)).length,
      awaitingDelivery: dispatches.filter((d) => ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(d.status)).length,
      partiallyCompleted: requests.filter((r) => r.status === 'PARTIALLY_COMPLETED').length,
      completedRequests: requests.filter((r) => r.status === 'COMPLETED').length,
    };
  },

  async getWorkflowFunnel(tenantId: string): Promise<WorkflowFunnelItem[]> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/dashboard/workflow`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const reqs = memoryDb.calibrationRequests.filter((r) => tenantId === 'all' || r.tenant_id === tenantId);
    return [
      { stage: 'Requests Created', key: 'CREATED', count: reqs.filter((r) => ['CREATED', 'COLLECTED'].includes(r.status)).length },
      { stage: 'Lab Queue', key: 'LAB_QUEUE', count: reqs.filter((r) => r.status === 'LAB_QUEUE').length },
      { stage: 'Verification', key: 'VERIFICATION', count: reqs.filter((r) => r.status === 'VERIFICATION').length },
      { stage: 'Calibration', key: 'CALIBRATION', count: reqs.filter((r) => ['CALIBRATION', 'CALIBRATED'].includes(r.status)).length },
      { stage: 'Commercial', key: 'QUOTATION', count: reqs.filter((r) => ['QUOTATION', 'APPROVAL', 'INVOICE'].includes(r.status)).length },
      { stage: 'Client Signature', key: 'CLIENT_SIGN', count: reqs.filter((r) => (r.status as string) === 'CLIENT_SIGN').length },
      { stage: 'Dispatch', key: 'DISPATCH', count: reqs.filter((r) => ['READY_TO_DISPATCH', 'DISPATCHED'].includes(r.status)).length },
      { stage: 'Delivery', key: 'DELIVERY', count: reqs.filter((r) => ['CLIENT_RECEIVED', 'DELIVERY_SIGNED'].includes(r.status)).length },
      { stage: 'Completed', key: 'COMPLETED', count: reqs.filter((r) => ['COMPLETED', 'PARTIALLY_COMPLETED'].includes(r.status)).length },
    ];
  },

  async getOperationExceptions(tenantId: string): Promise<OperationException[]> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/operations/exceptions`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const list: OperationException[] = [];
    memoryDb.calibrations.forEach((c) => {
      if ((c as any).calibration_result === 'FAIL') {
        const req = memoryDb.calibrationRequests.find((r) => r.id === c.request_id);
        const item = memoryDb.items.find((i) => i.id === c.item_id);
        list.push({
          id: `exc-faulty-${c.id}`,
          request_number: req?.request_number || 'CAL-2026-000001',
          client_name: req?.client?.client_name || 'Apex Manufacturing',
          item_code: item?.item_code || 'ITEM-001',
          item_name: item?.item_name || 'Digital Micrometer',
          serial_number: item?.serial_number || 'SN-998811',
          exception_type: 'Faulty Calibration',
          created_date: (c as any).calibration_date || new Date().toISOString(),
          current_status: 'SERVICE_REQUIRED',
          target_route: '/service-requests',
          action_label: 'Review Service Flow',
        });
      }
    });

    memoryDb.invoices.forEach((inv) => {
      if ((inv.status as string) === 'CLIENT_SIGNATURE_PENDING') {
        const client = memoryDb.clients.find((cl) => cl.id === inv.client_id);
        list.push({
          id: `exc-sig-${inv.id}`,
          request_number: 'CAL-2026-000001',
          client_name: client?.client_name || 'Apex Manufacturing',
          item_code: 'INVOICE',
          item_name: `Invoice #${inv.invoice_number}`,
          serial_number: inv.invoice_number,
          exception_type: 'Invoice Pending Signature',
          created_date: inv.created_at,
          current_status: 'CLIENT_SIGNATURE_PENDING',
          target_route: `/invoices/${inv.id}`,
          action_label: 'Capture Signature',
        });
      }
    });

    return list;
  },

  async getDueCalibrations(tenantId: string, dueStatus: string = 'ALL'): Promise<DueCalibrationItem[]> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/calibration/due-list?due_status=${dueStatus}`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return memoryDb.certificates.map((cert) => {
      const ri = memoryDb.requestItems.find((r) => r.id === (cert as any).request_item_id);
      const req = ri ? memoryDb.calibrationRequests.find((cr) => cr.id === ri.request_id) : null;
      const item = ri ? memoryDb.items.find((it) => it.id === ri.item_id) : null;
      const client = req ? memoryDb.clients.find((cl) => cl.id === req.client_id) : null;

      const certDueDate = (cert as any).next_due_date;
      const dueDate = certDueDate ? new Date(certDueDate) : new Date(Date.now() + 30 * 86400000);
      const diffTime = dueDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let calculatedStatus: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' = 'UPCOMING';
      if (daysRemaining < 0) calculatedStatus = 'OVERDUE';
      else if (daysRemaining <= 30) calculatedStatus = 'DUE_SOON';

      return {
        id: cert.id,
        item_code: item?.item_code || 'DIG-MIC-001',
        item_name: item?.item_name || 'Digital Micrometer 0-25mm',
        serial_number: item?.serial_number || 'SN-998811',
        client_name: client?.client_name || 'Apex Precision Engineering',
        last_calibration_date: (cert as any).calibration_date || cert.created_at,
        next_due_date: certDueDate || new Date(Date.now() + 30 * 86400000).toISOString(),
        days_remaining: daysRemaining,
        due_status: calculatedStatus,
        certificate_number: cert.certificate_number,
      };
    }).filter((c) => dueStatus === 'ALL' || c.due_status === dueStatus);
  },

  async getRequestTimeline(requestId: string, tenantId: string): Promise<RequestTimelineEvent[]> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/calibration-requests/${requestId}/timeline`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    return [
      { timestamp: new Date(Date.now() - 86400000 * 5).toISOString(), title: 'Request Created', description: 'Calibration request registered by Collection Agent', user_name: 'Super Admin', status: 'CREATED' },
      { timestamp: new Date(Date.now() - 86400000 * 4).toISOString(), title: 'Submitted to Lab', description: 'Moved to Lab Queue for technician assignment', user_name: 'Collection Agent', status: 'LAB_QUEUE' },
      { timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), title: 'Verification Completed', description: 'Visual inspection & physical check completed', user_name: 'Lead Calibration Technician', status: 'VERIFICATION' },
      { timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), title: 'Calibration Completed', description: 'Measurement points tested with PASS result', user_name: 'Lead Calibration Technician', status: 'CALIBRATED' },
      { timestamp: new Date(Date.now() - 86400000 * 1).toISOString(), title: 'Invoice Issued & Signed', description: 'Commercial invoice generated and client signature captured', user_name: 'Finance Manager', status: 'CLIENT_SIGN' },
      { timestamp: new Date().toISOString(), title: 'Dispatched & Delivered', description: 'Items dispatched via carrier and delivered to client with digital signature', user_name: 'Logistics Supervisor', status: 'COMPLETED' },
    ];
  },

  async getRequestProgressMatrix(requestId: string, tenantId: string): Promise<ItemProgressRow[]> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/calibration-requests/${requestId}/progress`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const reqItems = memoryDb.requestItems.filter((ri) => ri.request_id === requestId);

    return reqItems.map((ri) => {
      const item = memoryDb.items.find((i) => i.id === ri.item_id);
      const isDelivered = memoryDb.dispatchItems.some((di) => di.request_item_id === ri.id);

      return {
        item_id: ri.id,
        item_code: item?.item_code || 'ITEM-001',
        item_name: item?.item_name || 'Calibrated Instrument',
        serial_number: item?.serial_number || 'SN-100200',
        availability: ri.item_available === 'YES' ? '✓ Available' : 'Unavailable',
        verification: '✓ Verified',
        calibration: '✓ PASS',
        certificate: '✓ CERT-2026-000001',
        dispatch: isDelivered ? '✓ Dispatched' : 'Pending',
        delivery: isDelivered ? '✓ Delivered' : 'Pending',
        final_status: isDelivered ? 'Completed' : 'In Progress',
      };
    });
  },

  async evaluateRequestCompletion(requestId: string, tenantId: string): Promise<{ isFullyCompleted: boolean; newStatus: string }> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/calibration-requests/${requestId}/evaluate-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const req = memoryDb.calibrationRequests.find((r) => r.id === requestId);
    if (!req) return { isFullyCompleted: false, newStatus: 'CREATED' };

    const reqItems = memoryDb.requestItems.filter((ri) => ri.request_id === requestId);
    let deliveredCount = 0;
    reqItems.forEach((ri) => {
      if (memoryDb.dispatchItems.some((di) => di.request_item_id === ri.id)) deliveredCount++;
    });

    const isFullyCompleted = deliveredCount >= reqItems.length && reqItems.length > 0;
    const newStatus = isFullyCompleted ? 'COMPLETED' : deliveredCount > 0 ? 'PARTIALLY_COMPLETED' : req.status;

    const idx = memoryDb.calibrationRequests.findIndex((r) => r.id === requestId);
    if (idx >= 0) {
      memoryDb.calibrationRequests[idx].status = newStatus as CalibrationRequestStatus;
    }
    memoryDb.notify();

    return { isFullyCompleted, newStatus };
  },

  async getAuditLogsList(tenantId: string): Promise<AuditLogRow[]> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/audit-logs`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    return (memoryDb.auditLogs || []).map((l) => ({
      id: l.id,
      timestamp: l.created_at,
      user_name: 'Super Admin',
      action: l.action,
      module: l.resource_type,
      resource_id: l.resource_id,
      old_values: l.old_values,
      new_values: l.new_values,
    }));
  },

  async globalSearch(query: string, tenantId: string): Promise<GlobalSearchResult[]> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/global-search?q=${encodeURIComponent(query)}`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    const q = query.toLowerCase().trim();
    if (!q) return [];

    const results: GlobalSearchResult[] = [];

    memoryDb.calibrationRequests.forEach((r) => {
      if (r.request_number.toLowerCase().includes(q) || r.client?.client_name.toLowerCase().includes(q)) {
        results.push({
          type: 'Calibration Request',
          reference: r.request_number,
          client: r.client?.client_name || 'N/A',
          status: r.status,
          route: `/calibration-requests/${r.id}`,
        });
      }
    });

    memoryDb.invoices.forEach((inv) => {
      if (inv.invoice_number.toLowerCase().includes(q)) {
        const client = memoryDb.clients.find((c) => c.id === inv.client_id);
        results.push({
          type: 'Invoice',
          reference: inv.invoice_number,
          client: client?.client_name || 'N/A',
          status: inv.status,
          route: `/invoices/${inv.id}`,
        });
      }
    });

    memoryDb.dispatches.forEach((d) => {
      if (d.dispatch_number.toLowerCase().includes(q) || d.tracking_number?.toLowerCase().includes(q)) {
        const client = memoryDb.clients.find((c) => c.id === d.client_id);
        results.push({
          type: 'Dispatch',
          reference: `${d.dispatch_number} (${d.tracking_number || 'No Tracking'})`,
          client: client?.client_name || 'N/A',
          status: d.status,
          route: `/dispatches/${d.id}`,
        });
      }
    });

    return results;
  },

  async getReports(tenantId: string, reportType: string): Promise<any[]> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/reports?report_type=${reportType}`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      const json = await res.json();
      if (json.success) return json.data;
    }

    return memoryDb.calibrationRequests.map((r) => ({
      request_number: r.request_number,
      client: r.client?.client_name || 'N/A',
      collection_date: r.collection_date,
      priority: r.priority,
      status: r.status,
      created_at: r.created_at,
    }));
  },

  async holdRequest(id: string, tenantId: string, holdReason: string): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/calibration-requests/${id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({ hold_reason: holdReason }),
      });
      return await res.json();
    }
    const req = memoryDb.calibrationRequests.find((r) => r.id === id);
    if (req) {
      req.status = 'ON_HOLD';
      (req as any).hold_reason = holdReason;
    }
    return { success: true, message: 'Request placed on hold' };
  },

  async resumeRequest(id: string, tenantId: string, remarks?: string): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/calibration-requests/${id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({ remarks }),
      });
      return await res.json();
    }
    const req = memoryDb.calibrationRequests.find((r) => r.id === id);
    if (req) {
      req.status = 'LAB_QUEUE';
      (req as any).hold_reason = null;
    }
    return { success: true, message: 'Request resumed' };
  },

  async cancelRequest(id: string, tenantId: string, cancellationReason: string): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/calibration-requests/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({ cancellation_reason: cancellationReason }),
      });
      return await res.json();
    }
    const req = memoryDb.calibrationRequests.find((r) => r.id === id);
    if (req) {
      req.status = 'CANCELLED';
      (req as any).cancellation_reason = cancellationReason;
    }
    return { success: true, message: 'Request cancelled' };
  },

  async syncOfflineDrafts(tenantId: string, drafts: any[]): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/calibration-requests/sync-offline-drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({ drafts }),
      });
      return await res.json();
    }
    return { success: true, synced_count: drafts.length, failed_count: 0, results: drafts.map((d) => ({ draft_id: d.draft_id, sync_status: 'SYNCED' })) };
  },

  async getDataIntegrity(tenantId: string): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/system/data-integrity?tenant_id=${tenantId}`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      return await res.json();
    }
    return { success: true, data: { checked_at: new Date().toISOString(), issues_found: 0, categories: {} } };
  },

  async confirmLabReceipt(requestId: string, tenantId: string, payload: any): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/lab/requests/${requestId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify(payload),
      });
      return await res.json();
    }
    const req = memoryDb.calibrationRequests.find((r) => r.id === requestId);
    if (req) req.status = 'RECEIVED_IN_LAB';
    return { success: true, message: 'Receipt confirmed' };
  },

  async recordReceiptDiscrepancy(requestId: string, tenantId: string, payload: any): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/lab/requests/${requestId}/receipt-discrepancy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify(payload),
      });
      return await res.json();
    }
    const req = memoryDb.calibrationRequests.find((r) => r.id === requestId);
    if (req) req.status = 'DISCREPANCY';
    return { success: true, message: 'Receipt discrepancy recorded' };
  },

  async getLabReceipt(requestId: string, tenantId: string): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/lab/requests/${requestId}/receipt`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      return await res.json();
    }
    return { success: true, data: [] };
  },

  async recordServiceCharge(serviceId: string, tenantId: string, payload: any): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/service-requests/${serviceId}/commercial-charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify(payload),
      });
      return await res.json();
    }
    return { success: true, message: 'Service commercial charge recorded' };
  },

  async getCommercialSummary(requestId: string, tenantId: string): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const res = await fetch(`${API_BASE}/calibration-requests/${requestId}/commercial-summary`, {
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      });
      return await res.json();
    }
    return {
      success: true,
      data: {
        request_id: requestId,
        calibration_charges: 1000,
        service_charges: 500,
        outsourcing_client_charges: 1200,
        subtotal: 2700,
        tax_amount: 486,
        grand_total: 3186,
        internal_vendor_cost: 700,
      },
    };
  },

};

export const api = apiClient;
export default apiClient;



