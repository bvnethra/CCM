-- ==============================================================================
-- Calibration Commercial Module (CCM) - Step 1: Multi-Tenant Foundation Schema
-- Database: Supabase / PostgreSQL 15+
-- Features: Row Level Security (RLS), Tenancy Isolation, Audit Logging, Cascading
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'org_admin', 'operator', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TENANTS TABLE
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    status tenant_status NOT NULL DEFAULT 'active',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ORGANIZATIONS TABLE (Child of Tenant)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    status tenant_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_org_code UNIQUE (tenant_id, code)
);

-- 5. SUB-ORGANIZATIONS TABLE (Child of Organization and Tenant)
CREATE TABLE IF NOT EXISTS public.sub_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    status tenant_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_suborg_code UNIQUE (organization_id, code)
);

-- 6. USER PROFILES TABLE (Associated with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    sub_organization_id UUID REFERENCES public.sub_organizations(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'viewer',
    status tenant_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. AUDIT LOGS TABLE (Compliance & Traceability)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(50) NOT NULL, -- e.g., INSERT, UPDATE, DELETE, LOGIN
    resource_type VARCHAR(100) NOT NULL, -- e.g., tenant, organization, sub_organization
    resource_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_orgs_tenant_id ON public.organizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suborgs_tenant_id ON public.sub_organizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suborgs_org_id ON public.sub_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON public.user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_res ON public.audit_logs(tenant_id, resource_type, created_at DESC);

-- 9. AUTOMATIC TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_sub_organizations_updated_at ON public.sub_organizations;
CREATE TRIGGER trg_sub_organizations_updated_at BEFORE UPDATE ON public.sub_organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 10. MULTI-TENANT RLS FUNCTIONS
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
DECLARE
    jwt_claim_tenant TEXT;
    resolved_tenant UUID;
BEGIN
    jwt_claim_tenant := current_setting('request.jwt.claims', true)::json->>'tenant_id';
    IF jwt_claim_tenant IS NOT NULL AND jwt_claim_tenant <> '' THEN
        RETURN jwt_claim_tenant::UUID;
    END IF;

    SELECT tenant_id INTO resolved_tenant
    FROM public.user_profiles
    WHERE id = auth.uid();

    RETURN resolved_tenant;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        current_setting('request.jwt.claims', true)::json->>'role' = 'super_admin'
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 11. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 12. RLS POLICIES

-- === TENANTS POLICIES ===
DROP POLICY IF EXISTS "Super admins full access to tenants" ON public.tenants;
CREATE POLICY "Super admins full access to tenants"
    ON public.tenants
    FOR ALL
    USING (public.is_super_admin());

DROP POLICY IF EXISTS "Users can view their assigned tenant" ON public.tenants;
CREATE POLICY "Users can view their assigned tenant"
    ON public.tenants
    FOR SELECT
    USING (id = public.current_tenant_id());

-- === ORGANIZATIONS POLICIES ===
DROP POLICY IF EXISTS "Super admins full access to organizations" ON public.organizations;
CREATE POLICY "Super admins full access to organizations"
    ON public.organizations
    FOR ALL
    USING (public.is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for organizations select" ON public.organizations;
CREATE POLICY "Tenant isolation for organizations select"
    ON public.organizations
    FOR SELECT
    USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for organizations insert" ON public.organizations;
CREATE POLICY "Tenant isolation for organizations insert"
    ON public.organizations
    FOR INSERT
    WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for organizations update" ON public.organizations;
CREATE POLICY "Tenant isolation for organizations update"
    ON public.organizations
    FOR UPDATE
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for organizations delete" ON public.organizations;
CREATE POLICY "Tenant isolation for organizations delete"
    ON public.organizations
    FOR DELETE
    USING (tenant_id = public.current_tenant_id());

-- === SUB-ORGANIZATIONS POLICIES ===
DROP POLICY IF EXISTS "Super admins full access to sub_organizations" ON public.sub_organizations;
CREATE POLICY "Super admins full access to sub_organizations"
    ON public.sub_organizations
    FOR ALL
    USING (public.is_super_admin());

DROP POLICY IF EXISTS "Tenant isolation for sub_organizations select" ON public.sub_organizations;
CREATE POLICY "Tenant isolation for sub_organizations select"
    ON public.sub_organizations
    FOR SELECT
    USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for sub_organizations insert" ON public.sub_organizations;
CREATE POLICY "Tenant isolation for sub_organizations insert"
    ON public.sub_organizations
    FOR INSERT
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = organization_id AND o.tenant_id = public.current_tenant_id()
        )
    );

DROP POLICY IF EXISTS "Tenant isolation for sub_organizations update" ON public.sub_organizations;
CREATE POLICY "Tenant isolation for sub_organizations update"
    ON public.sub_organizations
    FOR UPDATE
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = organization_id AND o.tenant_id = public.current_tenant_id()
        )
    );

DROP POLICY IF EXISTS "Tenant isolation for sub_organizations delete" ON public.sub_organizations;
CREATE POLICY "Tenant isolation for sub_organizations delete"
    ON public.sub_organizations
    FOR DELETE
    USING (tenant_id = public.current_tenant_id());

-- === USER PROFILES POLICIES ===
DROP POLICY IF EXISTS "Super admins full access to profiles" ON public.user_profiles;
CREATE POLICY "Super admins full access to profiles"
    ON public.user_profiles
    FOR ALL
    USING (public.is_super_admin());

DROP POLICY IF EXISTS "Users can view members of their tenant" ON public.user_profiles;
CREATE POLICY "Users can view members of their tenant"
    ON public.user_profiles
    FOR SELECT
    USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- === AUDIT LOGS POLICIES ===
DROP POLICY IF EXISTS "Tenant isolation for audit logs" ON public.audit_logs;
CREATE POLICY "Tenant isolation for audit logs"
    ON public.audit_logs
    FOR SELECT
    USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());
-- ==============================================================================
-- Calibration Commercial Module (CCM) - Step 1: Multi-Tenant Seed Data
-- ==============================================================================

-- 1. SEED TENANTS
INSERT INTO public.tenants (id, name, code, status, settings)
VALUES
    ('11111111-1111-4111-a111-111111111111', 'Acme Calibration Labs', 'ACME-CAL', 'active', '{"timezone": "UTC", "currency": "USD", "complianceStandard": "ISO/IEC 17025"}'::jsonb),
    ('22222222-2222-4222-a222-222222222222', 'Apex Metrology Group', 'APEX-MET', 'active', '{"timezone": "America/New_York", "currency": "USD", "complianceStandard": "ANSI/NCSL Z540.3"}'::jsonb),
    ('33333333-3333-4333-a333-333333333333', 'Vortex Precision Testing', 'VORTEX-PT', 'inactive', '{"timezone": "Europe/London", "currency": "GBP", "complianceStandard": "UKAS LAB 12"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 2. SEED ORGANIZATIONS (Tenant 1: Acme Calibration Labs)
INSERT INTO public.organizations (id, tenant_id, name, code, status)
VALUES
    ('aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa', '11111111-1111-4111-a111-111111111111', 'Acme Aerospace Division', 'ACME-AERO', 'active'),
    ('bbbbbbbb-1111-4bbb-bbbb-bbbbbbbbbbbb', '11111111-1111-4111-a111-111111111111', 'Acme Medical & Bio Calibration', 'ACME-MED', 'active')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 2.1 SEED ORGANIZATIONS (Tenant 2: Apex Metrology Group)
INSERT INTO public.organizations (id, tenant_id, name, code, status)
VALUES
    ('cccccccc-2222-4ccc-cccc-cccccccccccc', '22222222-2222-4222-a222-222222222222', 'Apex Industrial Metrology', 'APEX-IND', 'active'),
    ('dddddddd-2222-4ddd-dddd-dddddddddddd', '22222222-2222-4222-a222-222222222222', 'Apex Cleanroom & Environmental', 'APEX-ENV', 'active')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 3. SEED SUB-ORGANIZATIONS (Child of Acme Aerospace Division)
INSERT INTO public.sub_organizations (id, tenant_id, organization_id, name, code, status)
VALUES
    ('e1111111-aaaa-4111-aaaa-111111111111', '11111111-1111-4111-a111-111111111111', 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa', 'Pressure & Vacuum Testing Lab', 'ACME-AERO-PVT', 'active'),
    ('e1111112-aaaa-4111-aaaa-111111111112', '11111111-1111-4111-a111-111111111111', 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa', 'Avionics & RF Standard Lab', 'ACME-AERO-RF', 'active')
ON CONFLICT (organization_id, code) DO NOTHING;

-- 3.1 SEED SUB-ORGANIZATIONS (Child of Acme Medical)
INSERT INTO public.sub_organizations (id, tenant_id, organization_id, name, code, status)
VALUES
    ('e1111113-bbbb-4111-bbbb-111111111113', '11111111-1111-4111-a111-111111111111', 'bbbbbbbb-1111-4bbb-bbbb-bbbbbbbbbbbb', 'Biomedical Sensor Diagnostic Unit', 'ACME-MED-BSD', 'active')
ON CONFLICT (organization_id, code) DO NOTHING;

-- 3.2 SEED SUB-ORGANIZATIONS (Child of Apex Industrial)
INSERT INTO public.sub_organizations (id, tenant_id, organization_id, name, code, status)
VALUES
    ('e2222221-cccc-4222-cccc-222222222221', '22222222-2222-4222-a222-222222222222', 'cccccccc-2222-4ccc-cccc-cccccccccccc', 'Dimensional Metrology & CMM', 'APEX-IND-CMM', 'active'),
    ('e2222222-cccc-4222-cccc-222222222222', '22222222-2222-4222-a222-222222222222', 'cccccccc-2222-4ccc-cccc-cccccccccccc', 'Torque & Force Standards Lab', 'APEX-IND-TF', 'active')
ON CONFLICT (organization_id, code) DO NOTHING;

-- 4. INITIAL AUDIT LOGS
INSERT INTO public.audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, new_values, ip_address)
VALUES
    (gen_random_uuid(), '11111111-1111-4111-a111-111111111111', NULL, 'SEED_PROVISION', 'tenant', '11111111-1111-4111-a111-111111111111', '{"name": "Acme Calibration Labs", "code": "ACME-CAL"}'::jsonb, '127.0.0.1'),
    (gen_random_uuid(), '22222222-2222-4222-a222-222222222222', NULL, 'SEED_PROVISION', 'tenant', '22222222-2222-4222-a222-222222222222', '{"name": "Apex Metrology Group", "code": "APEX-MET"}'::jsonb, '127.0.0.1');
-- ==============================================================================
-- Calibration Commercial Module (CCM) - Step 2: Auth, Users, Roles & Permissions
-- Database: Supabase / PostgreSQL 15+
-- Features: RBAC, Granular Permissions, User Profiles, Audit Logging, PostgreSQL RLS
-- ==============================================================================

-- 1. EXTEND USER PROFILES
ALTER TABLE IF EXISTS public.user_profiles
ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- 2. ROLES TABLE
-- Supports system-defined global roles (tenant_id IS NULL, is_system = true)
-- and tenant-custom roles (tenant_id = UUID, is_system = false)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_tenant_code UNIQUE (tenant_id, code)
);

-- 3. PERMISSIONS TABLE
-- Master registry of fine-grained capabilities in dot-notation
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ROLE_PERMISSIONS JUNCTION
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);

-- 5. USER_ROLES JUNCTION
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

-- 6. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON public.roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_perms_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_id ON public.user_profiles(organization_id);

-- 7. TRIGGER FOR ROLES UPDATED_AT
DROP TRIGGER IF EXISTS trg_roles_updated_at ON public.roles;
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. HELPER FUNCTION TO CHECK IF AUTHENTICATED USER HAS PERMISSION
CREATE OR REPLACE FUNCTION public.has_permission(required_perm TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    has_perm BOOLEAN := false;
BEGIN
    -- Super admins bypass permission checks
    IF public.is_super_admin() THEN
        RETURN true;
    END IF;

    -- Check direct role_permissions via user_roles or primary user_profiles.role
    SELECT true INTO has_perm
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND p.code = required_perm
    LIMIT 1;

    IF has_perm THEN
        RETURN true;
    END IF;

    -- Also check fallback system role mapping from user_profiles
    SELECT true INTO has_perm
    FROM public.user_profiles up
    JOIN public.roles r ON (r.is_system = true AND r.code = up.role::TEXT)
    JOIN public.role_permissions rp ON r.id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE up.id = auth.uid()
      AND p.code = required_perm
    LIMIT 1;

    RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 9. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 10. RLS POLICIES FOR ROLES
DROP POLICY IF EXISTS "Roles read policy" ON public.roles;
CREATE POLICY "Roles read policy"
    ON public.roles
    FOR SELECT
    USING (
        public.is_super_admin()
        OR is_system = true
        OR tenant_id = public.current_tenant_id()
    );

DROP POLICY IF EXISTS "Roles mutation policy" ON public.roles;
CREATE POLICY "Roles mutation policy"
    ON public.roles
    FOR ALL
    USING (
        public.is_super_admin()
        OR (tenant_id = public.current_tenant_id() AND NOT is_system)
    );

-- 11. RLS POLICIES FOR PERMISSIONS
DROP POLICY IF EXISTS "Permissions read policy" ON public.permissions;
CREATE POLICY "Permissions read policy"
    ON public.permissions
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Permissions mutation policy" ON public.permissions;
CREATE POLICY "Permissions mutation policy"
    ON public.permissions
    FOR ALL
    USING (public.is_super_admin());

-- 12. RLS POLICIES FOR ROLE_PERMISSIONS
DROP POLICY IF EXISTS "Role permissions read policy" ON public.role_permissions;
CREATE POLICY "Role permissions read policy"
    ON public.role_permissions
    FOR SELECT
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.roles r
            WHERE r.id = role_id
              AND (r.is_system = true OR r.tenant_id = public.current_tenant_id())
        )
    );

DROP POLICY IF EXISTS "Role permissions mutation policy" ON public.role_permissions;
CREATE POLICY "Role permissions mutation policy"
    ON public.role_permissions
    FOR ALL
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.roles r
            WHERE r.id = role_id
              AND r.tenant_id = public.current_tenant_id()
              AND NOT r.is_system
        )
    );

-- 13. RLS POLICIES FOR USER_ROLES
DROP POLICY IF EXISTS "User roles read policy" ON public.user_roles;
CREATE POLICY "User roles read policy"
    ON public.user_roles
    FOR SELECT
    USING (
        public.is_super_admin()
        OR tenant_id = public.current_tenant_id()
    );

DROP POLICY IF EXISTS "User roles mutation policy" ON public.user_roles;
CREATE POLICY "User roles mutation policy"
    ON public.user_roles
    FOR ALL
    USING (
        public.is_super_admin()
        OR tenant_id = public.current_tenant_id()
    );

-- 14. SEED PERMISSIONS
INSERT INTO public.permissions (code, name, module, description)
VALUES
    -- Tenant Permissions
    ('tenant.view', 'View Tenants', 'Tenants', 'Permission to view tenant entities'),
    ('tenant.create', 'Create Tenants', 'Tenants', 'Permission to provision new tenants'),
    ('tenant.edit', 'Edit Tenants', 'Tenants', 'Permission to edit tenant configuration'),
    ('tenant.status', 'Toggle Tenant Status', 'Tenants', 'Permission to activate or suspend tenants'),

    -- Organization Permissions
    ('organization.view', 'View Organizations', 'Organizations', 'Permission to view organizations'),
    ('organization.create', 'Create Organizations', 'Organizations', 'Permission to create organizations'),
    ('organization.edit', 'Edit Organizations', 'Organizations', 'Permission to modify organizations'),
    ('organization.delete', 'Delete Organizations', 'Organizations', 'Permission to delete organizations'),

    -- Sub-Organization Permissions
    ('suborganization.view', 'View Facilities', 'SubOrganizations', 'Permission to view sub-organizations'),
    ('suborganization.create', 'Create Facilities', 'SubOrganizations', 'Permission to create facilities'),
    ('suborganization.edit', 'Edit Facilities', 'SubOrganizations', 'Permission to edit facilities'),
    ('suborganization.delete', 'Delete Facilities', 'SubOrganizations', 'Permission to delete facilities'),

    -- User Permissions
    ('user.view', 'View Users', 'Users', 'Permission to view users within tenant'),
    ('user.create', 'Create Users', 'Users', 'Permission to invite and create users'),
    ('user.edit', 'Edit Users', 'Users', 'Permission to modify user details'),
    ('user.status', 'Toggle User Status', 'Users', 'Permission to activate/deactivate users'),
    ('user.delete', 'Delete Users', 'Users', 'Permission to remove user profiles'),

    -- Roles & Permissions
    ('role.view', 'View Roles', 'Roles', 'Permission to view roles and matrix'),
    ('role.create', 'Create Roles', 'Roles', 'Permission to define custom roles'),
    ('role.edit', 'Edit Roles', 'Roles', 'Permission to modify roles and assign permissions'),
    ('role.delete', 'Delete Roles', 'Roles', 'Permission to delete custom roles'),
    ('permission.view', 'View Permissions', 'Permissions', 'Permission to view permissions list'),
    ('permission.assign', 'Assign Permissions', 'Permissions', 'Permission to bind permissions to roles'),

    -- Audit Logs
    ('audit.view', 'View Audit Trail', 'Audit', 'Permission to view immutable compliance events')
ON CONFLICT (code) DO NOTHING;

-- 15. SEED SYSTEM ROLES (Available across tenants)
INSERT INTO public.roles (id, tenant_id, name, code, description, is_system)
VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', NULL, 'Super Admin', 'super_admin', 'Global platform administrator with unrestricted access', true),
    ('aaaaaaaa-0000-0000-0000-000000000002', NULL, 'Tenant Admin', 'tenant_admin', 'Full administrative authority within assigned tenant', true),
    ('aaaaaaaa-0000-0000-0000-000000000003', NULL, 'Organization Admin', 'org_admin', 'Administrator for an organizational branch or facility', true),
    ('aaaaaaaa-0000-0000-0000-000000000004', NULL, 'Manager', 'manager', 'Operational manager overseeing metrology workflows', true),
    ('aaaaaaaa-0000-0000-0000-000000000005', NULL, 'Lab User', 'lab_user', 'Calibration technician and metrology operator', true),
    ('aaaaaaaa-0000-0000-0000-000000000006', NULL, 'Collection Agent', 'collection_agent', 'Field logistics and item receipt agent', true),
    ('aaaaaaaa-0000-0000-0000-000000000007', NULL, 'Commercial User', 'commercial_user', 'Billing, quotations, and contract specialist', true),
    ('aaaaaaaa-0000-0000-0000-000000000008', NULL, 'Dispatch User', 'dispatch_user', 'Equipment dispatch and release coordinator', true),
    ('aaaaaaaa-0000-0000-0000-000000000009', NULL, 'Viewer', 'viewer', 'Read-only access to records and reports', true)
ON CONFLICT DO NOTHING;

-- 16. BIND PERMISSIONS TO SYSTEM ROLES
-- Tenant Admin has all non-global permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'aaaaaaaa-0000-0000-0000-000000000002', p.id
FROM public.permissions p
WHERE p.code NOT IN ('tenant.create', 'tenant.status')
ON CONFLICT DO NOTHING;

-- Org Admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'aaaaaaaa-0000-0000-0000-000000000003', p.id
FROM public.permissions p
WHERE p.code IN (
    'tenant.view', 'organization.view', 'organization.edit',
    'suborganization.view', 'suborganization.create', 'suborganization.edit',
    'user.view', 'user.create', 'user.edit', 'user.status',
    'role.view', 'permission.view', 'audit.view'
)
ON CONFLICT DO NOTHING;

-- Viewer
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'aaaaaaaa-0000-0000-0000-000000000009', p.id
FROM public.permissions p
WHERE p.code LIKE '%.view'
ON CONFLICT DO NOTHING;
-- =====================================================================
-- STEP 3 MIGRATION: CLIENT MASTER + RLS + RBAC PERMISSIONS
-- File: database/migrations/004_client_master.sql
-- =====================================================================

-- 1. CREATE CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES public.sub_organizations(id) ON DELETE SET NULL,
    client_code VARCHAR(50) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    billing_address TEXT,
    gst_number VARCHAR(50),
    contact_person VARCHAR(150),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    status tenant_status NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_client_code UNIQUE (tenant_id, client_code)
);

-- 2. CREATE CLIENTS UPDATED_AT TRIGGER
DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at 
    BEFORE UPDATE ON public.clients 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. INDEXES FOR HIGH-PERFORMANCE TENANT QUERIES
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_sub_org_id ON public.clients(sub_org_id);
CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(tenant_id, client_code);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(tenant_id, client_name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(tenant_id, status);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES FOR CLIENTS

-- Super Admins have full access across tenants
DROP POLICY IF EXISTS "Super admins full access to clients" ON public.clients;
CREATE POLICY "Super admins full access to clients"
    ON public.clients
    FOR ALL
    USING (public.is_super_admin());

-- Tenant Isolation: Users can only SELECT clients within their authorized tenant
DROP POLICY IF EXISTS "Users can view clients of their tenant" ON public.clients;
CREATE POLICY "Users can view clients of their tenant"
    ON public.clients
    FOR SELECT
    USING (
        tenant_id = public.current_tenant_id()
    );

-- Tenant Isolation: Users can only INSERT clients into their authorized tenant
DROP POLICY IF EXISTS "Users can insert clients into their tenant" ON public.clients;
CREATE POLICY "Users can insert clients into their tenant"
    ON public.clients
    FOR INSERT
    WITH CHECK (
        tenant_id = public.current_tenant_id()
    );

-- Tenant Isolation: Users can only UPDATE clients within their authorized tenant
DROP POLICY IF EXISTS "Users can update clients in their tenant" ON public.clients;
CREATE POLICY "Users can update clients in their tenant"
    ON public.clients
    FOR UPDATE
    USING (
        tenant_id = public.current_tenant_id()
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
    );

-- Tenant Isolation: Users can only DELETE clients within their authorized tenant
DROP POLICY IF EXISTS "Users can delete clients in their tenant" ON public.clients;
CREATE POLICY "Users can delete clients in their tenant"
    ON public.clients
    FOR DELETE
    USING (
        tenant_id = public.current_tenant_id()
    );

-- 6. INSERT CLIENT MASTER PERMISSIONS INTO PERMISSIONS TABLE
INSERT INTO public.permissions (code, name, module, description)
VALUES
    ('client.view', 'View Clients', 'client', 'View client directory, profiles, and contact details'),
    ('client.create', 'Create Client', 'client', 'Create and register new client profiles'),
    ('client.edit', 'Edit Client', 'client', 'Update client details, addresses, and tax information'),
    ('client.delete', 'Delete Client', 'client', 'Delete or remove client records from directory'),
    ('client.activate', 'Activate Client', 'client', 'Activate inactive or suspended client accounts'),
    ('client.deactivate', 'Deactivate Client', 'client', 'Deactivate or suspend active client accounts')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name,
    module = EXCLUDED.module,
    description = EXCLUDED.description;

-- 7. MAP CLIENT PERMISSIONS TO STANDARD ROLES
-- Helper function to assign permissions to roles
DO $$
DECLARE
    r_super UUID;
    r_tenant UUID;
    r_org UUID;
    r_manager UUID;
    r_lab UUID;
    r_comm UUID;
    r_disp UUID;
    r_coll UUID;
    r_viewer UUID;
BEGIN
    SELECT id INTO r_super FROM public.roles WHERE code = 'super_admin';
    SELECT id INTO r_tenant FROM public.roles WHERE code = 'tenant_admin';
    SELECT id INTO r_org FROM public.roles WHERE code = 'org_admin';
    SELECT id INTO r_manager FROM public.roles WHERE code = 'manager';
    SELECT id INTO r_lab FROM public.roles WHERE code = 'lab_user';
    SELECT id INTO r_comm FROM public.roles WHERE code = 'commercial_user';
    SELECT id INTO r_disp FROM public.roles WHERE code = 'dispatch_user';
    SELECT id INTO r_coll FROM public.roles WHERE code = 'collection_agent';
    SELECT id INTO r_viewer FROM public.roles WHERE code = 'viewer';

    -- Super Admin: ALL client permissions
    IF r_super IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_super, id FROM public.permissions WHERE module = 'client'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Tenant Admin: ALL client permissions
    IF r_tenant IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_tenant, id FROM public.permissions WHERE module = 'client'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Org Admin: view, create, edit, activate, deactivate
    IF r_org IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_org, id FROM public.permissions 
        WHERE code IN ('client.view', 'client.create', 'client.edit', 'client.activate', 'client.deactivate')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Manager: view, create, edit
    IF r_manager IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_manager, id FROM public.permissions 
        WHERE code IN ('client.view', 'client.create', 'client.edit')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Commercial User: view, create, edit
    IF r_comm IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_comm, id FROM public.permissions 
        WHERE code IN ('client.view', 'client.create', 'client.edit')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Lab User, Dispatch User, Collection Agent, Viewer: view only
    IF r_lab IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_lab, id FROM public.permissions WHERE code = 'client.view'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    IF r_disp IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_disp, id FROM public.permissions WHERE code = 'client.view'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    IF r_coll IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_coll, id FROM public.permissions WHERE code = 'client.view'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    IF r_viewer IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_viewer, id FROM public.permissions WHERE code = 'client.view'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
END $$;

-- 8. SEED INITIAL ENTERPRISE CLIENTS (FOR REAL TENANTS)
INSERT INTO public.clients (
    id, tenant_id, organization_id, sub_org_id, client_code, client_name,
    address_line_1, city, state, country, postal_code, billing_address,
    gst_number, contact_person, contact_email, contact_phone, status
)
VALUES
    -- Acme Calibration Clients
    (
        '44444444-1111-4444-a111-111111111111',
        '11111111-1111-4111-a111-111111111111',
        'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa',
        'e1111111-aaaa-4111-aaaa-111111111111',
        'CLI-AERO-001',
        'Aerospace Dynamics India Pvt Ltd',
        'Plot 42, Electronics City Phase 1',
        'Bengaluru',
        'Karnataka',
        'India',
        '560100',
        'Plot 42, Electronics City Phase 1, Bengaluru, Karnataka 560100',
        '29AABCA1234F1Z5',
        'Rohan Sharma',
        'rohan.sharma@aerodynamics.in',
        '+91 98765 43210',
        'active'
    ),
    (
        '44444444-2222-4444-a111-222222222222',
        '11111111-1111-4111-a111-111111111111',
        'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa',
        'e1111112-aaaa-4111-aaaa-111111111112',
        'CLI-PHARMA-002',
        'BioHealth Pharma Laboratories',
        '78 BioTech Industrial Corridor',
        'Hyderabad',
        'Telangana',
        'India',
        '500034',
        '78 BioTech Industrial Corridor, Hyderabad, Telangana 500034',
        '36AABCB5678G1Z2',
        'Dr. Ananya Reddy',
        'ananya.reddy@biohealth.com',
        '+91 91234 56789',
        'active'
    ),
    (
        '44444444-3333-4444-a111-333333333333',
        '11111111-1111-4111-a111-111111111111',
        'bbbbbbbb-1111-4bbb-bbbb-bbbbbbbbbbbb',
        NULL,
        'CLI-AUTO-003',
        'Precision Auto Components Corp',
        'MIDC Industrial Area, Bhosari',
        'Pune',
        'Maharashtra',
        'India',
        '411026',
        'MIDC Industrial Area, Bhosari, Pune, Maharashtra 411026',
        '27AABCP9012H1Z9',
        'Vikram Patil',
        'vikram.p@precisionauto.co.in',
        '+91 98220 12345',
        'active'
    ),
    -- Apex Metrology Clients (Strict Tenant Isolation)
    (
        '44444444-4444-4444-a111-444444444444',
        '22222222-2222-4222-a222-222222222222',
        'cccccccc-2222-4ccc-cccc-cccccccccccc',
        NULL,
        'CLI-DEF-101',
        'Zenith Defense Systems Ltd',
        'Technology Park, Whitefield',
        'Bengaluru',
        'Karnataka',
        'India',
        '560066',
        'Technology Park, Whitefield, Bengaluru, Karnataka 560066',
        '29AABCZ3456J1Z1',
        'Col. Rajesh Nair',
        'rajesh.nair@zenithdefense.com',
        '+91 94480 98765',
        'active'
    )
ON CONFLICT (id) DO NOTHING;
-- =====================================================================
-- STEP 4 MIGRATION: VENDOR MASTER + RLS + RBAC PERMISSIONS
-- File: database/migrations/005_vendor_master.sql
-- =====================================================================

-- 1. CREATE VENDORS TABLE
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES public.sub_organizations(id) ON DELETE SET NULL,
    vendor_code VARCHAR(50) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    gst_number VARCHAR(50),
    contact_person VARCHAR(150),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    serviced_categories TEXT[] DEFAULT '{}',
    status tenant_status NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_vendor_code UNIQUE (tenant_id, vendor_code)
);

-- 2. CREATE VENDORS UPDATED_AT TRIGGER
DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at 
    BEFORE UPDATE ON public.vendors 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. INDEXES FOR HIGH-PERFORMANCE TENANT QUERIES
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON public.vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_organization_id ON public.vendors(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendors_sub_org_id ON public.vendors(sub_org_id);
CREATE INDEX IF NOT EXISTS idx_vendors_code ON public.vendors(tenant_id, vendor_code);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON public.vendors(tenant_id, vendor_name);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(tenant_id, status);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES FOR VENDORS

-- Super Admins have full access across tenants
DROP POLICY IF EXISTS "Super admins full access to vendors" ON public.vendors;
CREATE POLICY "Super admins full access to vendors"
    ON public.vendors
    FOR ALL
    USING (public.is_super_admin());

-- Tenant Isolation: Users can only SELECT vendors within their authorized tenant
DROP POLICY IF EXISTS "Users can view vendors of their tenant" ON public.vendors;
CREATE POLICY "Users can view vendors of their tenant"
    ON public.vendors
    FOR SELECT
    USING (
        tenant_id = public.current_tenant_id()
    );

-- Tenant Isolation: Users can only INSERT vendors into their authorized tenant
DROP POLICY IF EXISTS "Users can insert vendors into their tenant" ON public.vendors;
CREATE POLICY "Users can insert vendors into their tenant"
    ON public.vendors
    FOR INSERT
    WITH CHECK (
        tenant_id = public.current_tenant_id()
    );

-- Tenant Isolation: Users can only UPDATE vendors within their authorized tenant
DROP POLICY IF EXISTS "Users can update vendors in their tenant" ON public.vendors;
CREATE POLICY "Users can update vendors in their tenant"
    ON public.vendors
    FOR UPDATE
    USING (
        tenant_id = public.current_tenant_id()
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
    );

-- Tenant Isolation: Users can only DELETE vendors within their authorized tenant
DROP POLICY IF EXISTS "Users can delete vendors in their tenant" ON public.vendors;
CREATE POLICY "Users can delete vendors in their tenant"
    ON public.vendors
    FOR DELETE
    USING (
        tenant_id = public.current_tenant_id()
    );

-- 6. INSERT VENDOR MASTER PERMISSIONS INTO PERMISSIONS TABLE
INSERT INTO public.permissions (code, name, module, description)
VALUES
    ('vendor.view', 'View Vendors', 'vendor', 'View vendor directory, capabilities, and contact details'),
    ('vendor.create', 'Create Vendor', 'vendor', 'Create and onboard new external calibration vendors'),
    ('vendor.edit', 'Edit Vendor', 'vendor', 'Update vendor details, serviced categories, and tax info'),
    ('vendor.delete', 'Delete Vendor', 'vendor', 'Delete or remove vendor records from directory'),
    ('vendor.activate', 'Activate Vendor', 'vendor', 'Activate inactive or suspended vendor accounts'),
    ('vendor.deactivate', 'Deactivate Vendor', 'vendor', 'Deactivate or suspend active vendor accounts')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name,
    module = EXCLUDED.module,
    description = EXCLUDED.description;

-- 7. MAP VENDOR PERMISSIONS TO STANDARD ROLES
DO $$
DECLARE
    r_super UUID;
    r_tenant UUID;
    r_org UUID;
    r_manager UUID;
    r_lab UUID;
    r_comm UUID;
    r_disp UUID;
    r_coll UUID;
    r_viewer UUID;
BEGIN
    SELECT id INTO r_super FROM public.roles WHERE code = 'super_admin';
    SELECT id INTO r_tenant FROM public.roles WHERE code = 'tenant_admin';
    SELECT id INTO r_org FROM public.roles WHERE code = 'org_admin';
    SELECT id INTO r_manager FROM public.roles WHERE code = 'manager';
    SELECT id INTO r_lab FROM public.roles WHERE code = 'lab_user';
    SELECT id INTO r_comm FROM public.roles WHERE code = 'commercial_user';
    SELECT id INTO r_disp FROM public.roles WHERE code = 'dispatch_user';
    SELECT id INTO r_coll FROM public.roles WHERE code = 'collection_agent';
    SELECT id INTO r_viewer FROM public.roles WHERE code = 'viewer';

    -- Super Admin: ALL vendor permissions
    IF r_super IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_super, id FROM public.permissions WHERE module = 'vendor'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Tenant Admin: ALL vendor permissions
    IF r_tenant IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_tenant, id FROM public.permissions WHERE module = 'vendor'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Org Admin: view, create, edit, activate, deactivate
    IF r_org IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_org, id FROM public.permissions 
        WHERE code IN ('vendor.view', 'vendor.create', 'vendor.edit', 'vendor.activate', 'vendor.deactivate')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Manager: view, create, edit
    IF r_manager IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_manager, id FROM public.permissions 
        WHERE code IN ('vendor.view', 'vendor.create', 'vendor.edit')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Commercial User: view, create, edit
    IF r_comm IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_comm, id FROM public.permissions 
        WHERE code IN ('vendor.view', 'vendor.create', 'vendor.edit')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- Lab User, Dispatch User, Collection Agent, Viewer: view only
    IF r_lab IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_lab, id FROM public.permissions WHERE code = 'vendor.view'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    IF r_disp IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_disp, id FROM public.permissions WHERE code = 'vendor.view'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    IF r_coll IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_coll, id FROM public.permissions WHERE code = 'vendor.view'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    IF r_viewer IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT r_viewer, id FROM public.permissions WHERE code = 'vendor.view'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
END $$;

-- 8. SEED INITIAL ENTERPRISE VENDORS (FOR REAL TENANTS)
INSERT INTO public.vendors (
    id, tenant_id, organization_id, sub_org_id, vendor_code, vendor_name,
    address_line_1, city, state, country, postal_code,
    gst_number, contact_person, contact_email, contact_phone,
    serviced_categories, status
)
VALUES
    -- Acme Calibration External Calibration Partners
    (
        '55555555-1111-5555-a111-111111111111',
        '11111111-1111-4111-a111-111111111111',
        'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa',
        'e1111111-aaaa-4111-aaaa-111111111111',
        'VEN-NABL-001',
        'National Standard Metrology Labs',
        'Phase 2, Peenya Industrial Area',
        'Bengaluru',
        'Karnataka',
        'India',
        '560058',
        '29AABCN9988E1Z4',
        'Kavita Sundaram',
        'kavita.s@nationalstandards.in',
        '+91 80 2839 0001',
        ARRAY['Thermal', 'Electro-Technical', 'Pressure'],
        'active'
    ),
    (
        '55555555-2222-5555-a111-222222222222',
        '11111111-1111-4111-a111-111111111111',
        'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa',
        NULL,
        'VEN-OPTI-002',
        'Spectra Optical Calibration Services',
        'B-14 Industrial Suburb, Yeshwantpur',
        'Bengaluru',
        'Karnataka',
        'India',
        '560022',
        '29AABCS1122K1Z7',
        'Anil Deshpande',
        'anil@spectraoptics.com',
        '+91 80 2337 4455',
        ARRAY['Optical', 'Dimensional', 'Mass & Volume'],
        'active'
    ),
    (
        '55555555-3333-5555-a111-333333333333',
        '11111111-1111-4111-a111-111111111111',
        'bbbbbbbb-1111-4bbb-bbbb-bbbbbbbbbbbb',
        NULL,
        'VEN-MECH-003',
        'AccuTorque Force & Dynamics Calibration',
        'T-Block, MIDC Pimpri',
        'Pune',
        'Maharashtra',
        'India',
        '411018',
        '27AABCA3344M1Z2',
        'Pooja Kulkarni',
        'pooja@accutorque.co.in',
        '+91 20 2747 8899',
        ARRAY['Mechanical', 'Torque & Force', 'Acoustics'],
        'active'
    ),
    -- Apex Metrology External Calibration Partner (Strict Tenant Isolation)
    (
        '55555555-4444-5555-a111-444444444444',
        '22222222-2222-4222-a222-222222222222',
        'cccccccc-2222-4ccc-cccc-cccccccccccc',
        NULL,
        'VEN-AERO-201',
        'Vanguard Precision Avionics Labs',
        'Aerospace SEZ, Devanahalli',
        'Bengaluru',
        'Karnataka',
        'India',
        '562110',
        '29AABCV5566P1Z9',
        'Wing Cdr. R. Sen (Retd.)',
        'rsen@vanguardprecision.in',
        '+91 80 6712 3456',
        ARRAY['Electro-Technical', 'RF & Microwave', 'Pressure'],
        'active'
    )
ON CONFLICT (id) DO NOTHING;
-- ============================================================================
-- Migration: 006_item_master.sql
-- Description: Step 5 - Item Master (Equipment, Instruments, Master Standards)
-- Tables: public.item_masters
-- Security: Multi-Tenant Row Level Security (RLS) + Granular RBAC Permissions
-- ============================================================================

-- 1. Create item_masters Table
CREATE TABLE IF NOT EXISTS public.item_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES public.sub_organizations(id) ON DELETE SET NULL,
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(100),
    manufacturer VARCHAR(150),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    measurement_range VARCHAR(150),
    least_count VARCHAR(100),
    standard_cost NUMERIC(12, 2) DEFAULT 0.00,
    calibration_frequency INTEGER DEFAULT 12,
    calibration_frequency_unit VARCHAR(20) DEFAULT 'Months',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_item_masters_tenant_code UNIQUE (tenant_id, item_code),
    CONSTRAINT chk_item_masters_cost CHECK (standard_cost >= 0),
    CONSTRAINT chk_item_masters_frequency CHECK (calibration_frequency >= 1),
    CONSTRAINT chk_item_masters_status CHECK (status IN ('active', 'inactive'))
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_item_masters_tenant_id ON public.item_masters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_item_masters_org_id ON public.item_masters(organization_id);
CREATE INDEX IF NOT EXISTS idx_item_masters_sub_org_id ON public.item_masters(sub_org_id);
CREATE INDEX IF NOT EXISTS idx_item_masters_code ON public.item_masters(tenant_id, item_code);
CREATE INDEX IF NOT EXISTS idx_item_masters_name ON public.item_masters(item_name);
CREATE INDEX IF NOT EXISTS idx_item_masters_serial ON public.item_masters(tenant_id, serial_number);
CREATE INDEX IF NOT EXISTS idx_item_masters_status ON public.item_masters(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_item_masters_type ON public.item_masters(tenant_id, item_type);
CREATE INDEX IF NOT EXISTS idx_item_masters_manufacturer ON public.item_masters(tenant_id, manufacturer);

-- 3. Auto-update updated_at Trigger
CREATE OR REPLACE FUNCTION public.set_item_masters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_item_masters_updated_at ON public.item_masters;
CREATE TRIGGER trg_item_masters_updated_at
    BEFORE UPDATE ON public.item_masters
    FOR EACH ROW
    EXECUTE FUNCTION public.set_item_masters_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.item_masters ENABLE ROW LEVEL SECURITY;

-- 5. Multi-Tenant RLS Policies
DROP POLICY IF EXISTS item_masters_tenant_isolation_select ON public.item_masters;
CREATE POLICY item_masters_tenant_isolation_select ON public.item_masters
    FOR SELECT
    USING (
        tenant_id = public.current_tenant_id()
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS item_masters_tenant_isolation_insert ON public.item_masters;
CREATE POLICY item_masters_tenant_isolation_insert ON public.item_masters
    FOR INSERT
    WITH CHECK (
        (tenant_id = public.current_tenant_id() AND public.has_permission('item.create'))
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS item_masters_tenant_isolation_update ON public.item_masters;
CREATE POLICY item_masters_tenant_isolation_update ON public.item_masters
    FOR UPDATE
    USING (
        (tenant_id = public.current_tenant_id() AND (public.has_permission('item.edit') OR public.has_permission('item.activate') OR public.has_permission('item.deactivate')))
        OR public.is_super_admin()
    )
    WITH CHECK (
        (tenant_id = public.current_tenant_id() AND (public.has_permission('item.edit') OR public.has_permission('item.activate') OR public.has_permission('item.deactivate')))
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS item_masters_tenant_isolation_delete ON public.item_masters;
CREATE POLICY item_masters_tenant_isolation_delete ON public.item_masters
    FOR DELETE
    USING (
        (tenant_id = public.current_tenant_id() AND public.has_permission('item.delete'))
        OR public.is_super_admin()
    );

-- 6. Seed RBAC Permissions for Item Master
INSERT INTO public.permissions (code, name, module, description)
VALUES
    ('item.view', 'View Item Master', 'item_masters', 'View item master catalog and specifications'),
    ('item.create', 'Create Item Master', 'item_masters', 'Create and onboard new item master records'),
    ('item.edit', 'Edit Item Master', 'item_masters', 'Edit item master properties and metrology parameters'),
    ('item.delete', 'Delete Item Master', 'item_masters', 'Permanently delete item master records'),
    ('item.activate', 'Activate Item Master', 'item_masters', 'Activate item master for calibration services'),
    ('item.deactivate', 'Deactivate Item Master', 'item_masters', 'Deactivate item master records')
ON CONFLICT (code) DO UPDATE SET
    description = EXCLUDED.description,
    module = EXCLUDED.module;

-- 7. Grant Permissions to System Roles
-- Super Admin / Tenant Admin get all item permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('super_admin', 'tenant_admin')
  AND p.name LIKE 'item.%'
ON CONFLICT DO NOTHING;

-- Org Admin gets view, create, edit, activate, deactivate
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'org_admin'
  AND p.name IN ('item.view', 'item.create', 'item.edit', 'item.activate', 'item.deactivate')
ON CONFLICT DO NOTHING;

-- Manager & Commercial User get view, create, edit
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('manager', 'commercial_user', 'lab_user')
  AND p.name IN ('item.view', 'item.create', 'item.edit')
ON CONFLICT DO NOTHING;

-- Viewer & Collection Agent get view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('viewer', 'collection_agent', 'dispatch_user')
  AND p.name = 'item.view'
ON CONFLICT DO NOTHING;

-- 8. Seed Initial Items for Acme Calibration Labs (Tenant 1)
INSERT INTO public.item_masters (
    id, tenant_id, organization_id, item_code, item_name, item_type, manufacturer, model, serial_number, measurement_range, least_count, standard_cost, calibration_frequency, calibration_frequency_unit, status
) VALUES
(
    '66666666-1111-6666-a111-111111111111',
    '11111111-1111-4111-a111-111111111111',
    'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa',
    'ITM-DMM-001',
    '8.5 Digit Reference Multimeter',
    'Master Standard',
    'Fluke Calibration',
    '8588A',
    'FLK-8588A-98214',
    '0.1 mV to 1000 V / 10 nA to 30 A',
    '0.001 ppm',
    450.00,
    12,
    'Months',
    'active'
),
(
    '66666666-2222-6666-a111-222222222222',
    '11111111-1111-4111-a111-111111111111',
    'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa',
    'ITM-PRS-002',
    'High Precision Pneumatic Pressure Controller',
    'Calibrator',
    'Druck',
    'PACE5000',
    'DRK-PC5K-44109',
    '-1 to 210 bar (-15 to 3000 psi)',
    '0.005% FS',
    380.00,
    12,
    'Months',
    'active'
),
(
    '66666666-3333-6666-a111-333333333333',
    '11111111-1111-4111-a111-111111111111',
    NULL,
    'ITM-TMP-003',
    'Field Metrology Temperature Dry Well',
    'Working Standard',
    'Fluke Hart Scientific',
    '9144',
    'FLK-HS9144-12908',
    '50 °C to 660 °C',
    '0.01 °C',
    295.00,
    12,
    'Months',
    'active'
)
ON CONFLICT (tenant_id, item_code) DO NOTHING;

-- Seed Initial Item for Apex Metrology (Tenant 2)
INSERT INTO public.item_masters (
    id, tenant_id, organization_id, item_code, item_name, item_type, manufacturer, model, serial_number, measurement_range, least_count, standard_cost, calibration_frequency, calibration_frequency_unit, status
) VALUES
(
    '66666666-4444-6666-a222-444444444444',
    '22222222-2222-4222-a222-222222222222',
    'cccccccc-2222-4ccc-cccc-cccccccccccc',
    'ITM-APX-101',
    'Microwave Analog Signal Generator',
    'Master Standard',
    'Keysight Technologies',
    'N5183B',
    'KEY-N5183B-77810',
    '9 kHz to 40 GHz',
    '0.001 Hz',
    620.00,
    24,
    'Months',
    'active'
)
ON CONFLICT (tenant_id, item_code) DO NOTHING;
-- ============================================================================
-- Migration: 007_calibration_request.sql
-- Description: Step 6 - Collection Agent + Calibration Request Creation + Item Availability
-- Tables: public.calibration_requests, public.request_items
-- Security: Multi-Tenant Row Level Security (RLS) + Granular RBAC Permissions
-- ============================================================================

-- 1. Create Sequence for Concurrency-Safe Unique Request Number Generation
CREATE SEQUENCE IF NOT EXISTS public.seq_calibration_request_number START 1 INCREMENT 1;

-- 2. Create calibration_requests Table
CREATE TABLE IF NOT EXISTS public.calibration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES public.sub_organizations(id) ON DELETE SET NULL,
    request_number VARCHAR(50) NOT NULL,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    collection_agent_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    remarks TEXT,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_calibration_requests_tenant_number UNIQUE (tenant_id, request_number),
    CONSTRAINT chk_cal_req_priority CHECK (priority IN ('NORMAL', 'URGENT')),
    CONSTRAINT chk_cal_req_status CHECK (status IN ('CREATED', 'COLLECTED', 'ON_HOLD', 'CANCELLED'))
);

-- 3. Create request_items Table
-- Note: item_available belongs strictly to the request item, NOT the permanent item master.
CREATE TABLE IF NOT EXISTS public.request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.item_masters(id) ON DELETE RESTRICT,
    requested_quantity INTEGER NOT NULL DEFAULT 1,
    item_available VARCHAR(10) NOT NULL DEFAULT 'YES',
    availability_remarks TEXT,
    availability_checked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    availability_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_req_items_quantity CHECK (requested_quantity > 0),
    CONSTRAINT chk_req_items_availability CHECK (item_available IN ('YES', 'NO')),
    CONSTRAINT chk_req_items_unavail_remarks CHECK (
        item_available != 'NO' OR (availability_remarks IS NOT NULL AND length(trim(availability_remarks)) > 0)
    )
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cal_req_tenant_id ON public.calibration_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cal_req_tenant_status ON public.calibration_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cal_req_tenant_client ON public.calibration_requests(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_cal_req_tenant_agent ON public.calibration_requests(tenant_id, collection_agent_id);
CREATE INDEX IF NOT EXISTS idx_cal_req_tenant_number ON public.calibration_requests(tenant_id, request_number);
CREATE INDEX IF NOT EXISTS idx_cal_req_tenant_created ON public.calibration_requests(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cal_req_tenant_colldate ON public.calibration_requests(tenant_id, collection_date DESC);
CREATE INDEX IF NOT EXISTS idx_cal_req_tenant_priority ON public.calibration_requests(tenant_id, priority);

CREATE INDEX IF NOT EXISTS idx_req_items_request_id ON public.request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_req_items_item_id ON public.request_items(item_id);
CREATE INDEX IF NOT EXISTS idx_req_items_tenant_id ON public.request_items(tenant_id);

-- 5. Updated_At Triggers
CREATE OR REPLACE FUNCTION public.set_calibration_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calibration_requests_updated_at ON public.calibration_requests;
CREATE TRIGGER trg_calibration_requests_updated_at
    BEFORE UPDATE ON public.calibration_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_calibration_requests_updated_at();

CREATE OR REPLACE FUNCTION public.set_request_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_request_items_updated_at ON public.request_items;
CREATE TRIGGER trg_request_items_updated_at
    BEFORE UPDATE ON public.request_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_request_items_updated_at();

-- 6. Helper Function: Atomic Unique Request Number Generator (e.g. CAL-2026-000001)
CREATE OR REPLACE FUNCTION public.generate_request_number(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR(4);
    v_seq_val BIGINT;
    v_req_num VARCHAR(50);
BEGIN
    v_year := to_char(CURRENT_DATE, 'YYYY');
    v_seq_val := nextval('public.seq_calibration_request_number');
    v_req_num := 'CAL-' || v_year || '-' || lpad(v_seq_val::text, 6, '0');
    RETURN v_req_num;
END;
$$ LANGUAGE plpgsql;

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.calibration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;

-- 8. Multi-Tenant RLS Policies for calibration_requests
DROP POLICY IF EXISTS calibration_requests_tenant_isolation_select ON public.calibration_requests;
CREATE POLICY calibration_requests_tenant_isolation_select ON public.calibration_requests
    FOR SELECT
    USING (
        tenant_id = public.current_tenant_id()
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS calibration_requests_tenant_isolation_insert ON public.calibration_requests;
CREATE POLICY calibration_requests_tenant_isolation_insert ON public.calibration_requests
    FOR INSERT
    WITH CHECK (
        (tenant_id = public.current_tenant_id() AND (public.has_permission('request.create') OR public.has_permission('collection.create')))
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS calibration_requests_tenant_isolation_update ON public.calibration_requests;
CREATE POLICY calibration_requests_tenant_isolation_update ON public.calibration_requests
    FOR UPDATE
    USING (
        (tenant_id = public.current_tenant_id() AND (public.has_permission('request.edit') OR public.has_permission('request.cancel') OR public.has_permission('collection.edit')))
        OR public.is_super_admin()
    )
    WITH CHECK (
        (tenant_id = public.current_tenant_id() AND (public.has_permission('request.edit') OR public.has_permission('request.cancel') OR public.has_permission('collection.edit')))
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS calibration_requests_tenant_isolation_delete ON public.calibration_requests;
CREATE POLICY calibration_requests_tenant_isolation_delete ON public.calibration_requests
    FOR DELETE
    USING (
        (tenant_id = public.current_tenant_id() AND public.has_permission('request.cancel'))
        OR public.is_super_admin()
    );

-- 9. Multi-Tenant RLS Policies for request_items
DROP POLICY IF EXISTS request_items_tenant_isolation_select ON public.request_items;
CREATE POLICY request_items_tenant_isolation_select ON public.request_items
    FOR SELECT
    USING (
        tenant_id = public.current_tenant_id()
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS request_items_tenant_isolation_insert ON public.request_items;
CREATE POLICY request_items_tenant_isolation_insert ON public.request_items
    FOR INSERT
    WITH CHECK (
        (tenant_id = public.current_tenant_id() AND (public.has_permission('request.create') OR public.has_permission('collection.create')))
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS request_items_tenant_isolation_update ON public.request_items;
CREATE POLICY request_items_tenant_isolation_update ON public.request_items
    FOR UPDATE
    USING (
        (tenant_id = public.current_tenant_id() AND (public.has_permission('request.edit') OR public.has_permission('collection.edit')))
        OR public.is_super_admin()
    )
    WITH CHECK (
        (tenant_id = public.current_tenant_id() AND (public.has_permission('request.edit') OR public.has_permission('collection.edit')))
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS request_items_tenant_isolation_delete ON public.request_items;
CREATE POLICY request_items_tenant_isolation_delete ON public.request_items
    FOR DELETE
    USING (
        (tenant_id = public.current_tenant_id() AND public.has_permission('request.edit'))
        OR public.is_super_admin()
    );

-- 10. Seed RBAC Permissions for Step 6 (Requests & Collection)
INSERT INTO public.permissions (code, name, module, description)
VALUES
    ('request.view', 'View Calibration Requests', 'requests', 'View calibration request list and details'),
    ('request.create', 'Create Calibration Request', 'requests', 'Create and initialize calibration requests'),
    ('request.edit', 'Edit Calibration Request', 'requests', 'Modify calibration request details and metadata'),
    ('request.cancel', 'Cancel Calibration Request', 'requests', 'Cancel calibration requests'),
    ('request.submit', 'Submit Calibration Request', 'requests', 'Submit calibration requests for lab intake'),
    ('request.override_availability', 'Override Request Availability', 'requests', 'Override availability warnings for requests containing unavailable items'),
    ('collection.view', 'View Collections', 'collections', 'View field equipment collection records'),
    ('collection.create', 'Create Collection', 'collections', 'Perform field equipment collection and intake'),
    ('collection.edit', 'Edit Collection', 'collections', 'Update field collection records and quantities')
ON CONFLICT (code) DO UPDATE SET
    description = EXCLUDED.description,
    module = EXCLUDED.module;

-- 11. Grant Permissions to System Roles
-- Super Admin / Tenant Admin get all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('super_admin', 'tenant_admin')
  AND p.name IN (
    'request.view', 'request.create', 'request.edit', 'request.cancel', 'request.submit', 'request.override_availability',
    'collection.view', 'collection.create', 'collection.edit'
  )
ON CONFLICT DO NOTHING;

-- Collection Agent gets view, create, edit, submit, collection.*
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'collection_agent'
  AND p.name IN (
    'request.view', 'request.create', 'request.edit', 'request.submit',
    'collection.view', 'collection.create', 'collection.edit'
  )
ON CONFLICT DO NOTHING;

-- Org Admin & Manager get view, create, edit, cancel, submit, override_availability
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('org_admin', 'manager')
  AND p.name IN (
    'request.view', 'request.create', 'request.edit', 'request.cancel', 'request.submit', 'request.override_availability',
    'collection.view', 'collection.create', 'collection.edit'
  )
ON CONFLICT DO NOTHING;

-- Viewer gets read-only permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'viewer'
  AND p.name IN ('request.view', 'collection.view')
ON CONFLICT DO NOTHING;
-- ============================================================================
-- Migration: 008_lab_queue_intake.sql
-- Description: Step 7 - Lab Queue + Request Intake + Lab Assignment + Status History
-- Tables: public.lab_request_assignments, public.request_status_history
-- Updates: public.calibration_requests status check constraint (LAB_QUEUE, VERIFICATION)
-- Security: Multi-Tenant Row Level Security (RLS) + Granular RBAC Permissions
-- ============================================================================

-- 1. Extend Calibration Request Status Check Constraint
ALTER TABLE public.calibration_requests DROP CONSTRAINT IF EXISTS chk_cal_req_status;
ALTER TABLE public.calibration_requests ADD CONSTRAINT chk_cal_req_status 
    CHECK (status IN ('CREATED', 'COLLECTED', 'LAB_QUEUE', 'VERIFICATION', 'ON_HOLD', 'CANCELLED'));

-- 2. Create Table: lab_request_assignments
-- Tracks operational assignments of calibration requests to Lab Users
CREATE TABLE IF NOT EXISTS public.lab_request_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    assigned_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_lab_assign_status CHECK (status IN ('ACTIVE', 'REASSIGNED', 'COMPLETED'))
);

-- Index for unique active assignment per request
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_lab_assign_active_req 
    ON public.lab_request_assignments(request_id) 
    WHERE status = 'ACTIVE';

-- 3. Create Table: request_status_history
-- Immutable audit log of every lifecycle status transition
CREATE TABLE IF NOT EXISTS public.request_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_lab_assign_tenant ON public.lab_request_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lab_assign_tenant_req ON public.lab_request_assignments(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_lab_assign_tenant_user ON public.lab_request_assignments(tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_lab_assign_status ON public.lab_request_assignments(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_status_hist_tenant ON public.request_status_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_status_hist_tenant_req ON public.request_status_history(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_status_hist_changed_at ON public.request_status_history(tenant_id, changed_at DESC);

-- Composite query indexes on calibration_requests for Lab Queue filtering
CREATE INDEX IF NOT EXISTS idx_cal_req_queue_lookup ON public.calibration_requests(tenant_id, status, priority, collection_date);

-- 5. Updated At Trigger for lab_request_assignments
DROP TRIGGER IF EXISTS trg_lab_assign_updated_at ON public.lab_request_assignments;
CREATE TRIGGER trg_lab_assign_updated_at
    BEFORE UPDATE ON public.lab_request_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Enable Multi-Tenant Row Level Security (RLS)
ALTER TABLE public.lab_request_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for lab_request_assignments
DROP POLICY IF EXISTS rls_lab_assign_select ON public.lab_request_assignments;
CREATE POLICY rls_lab_assign_select ON public.lab_request_assignments
    FOR SELECT
    USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS rls_lab_assign_insert ON public.lab_request_assignments;
CREATE POLICY rls_lab_assign_insert ON public.lab_request_assignments
    FOR INSERT
    WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS rls_lab_assign_update ON public.lab_request_assignments;
CREATE POLICY rls_lab_assign_update ON public.lab_request_assignments
    FOR UPDATE
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 8. RLS Policies for request_status_history
DROP POLICY IF EXISTS rls_status_hist_select ON public.request_status_history;
CREATE POLICY rls_status_hist_select ON public.request_status_history
    FOR SELECT
    USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS rls_status_hist_insert ON public.request_status_history;
CREATE POLICY rls_status_hist_insert ON public.request_status_history
    FOR INSERT
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 9. Register RBAC Permissions for Step 7 (Lab Queue & Intake)
INSERT INTO public.permissions (code, name, module, description)
VALUES
    ('lab.queue.view', 'View Lab Queue', 'Lab', 'Access and view the central laboratory intake queue'),
    ('lab.queue.accept', 'Accept Request', 'Lab', 'Accept assigned calibration requests for lab intake'),
    ('lab.queue.assign', 'Assign Lab Technician', 'Lab', 'Assign requests in lab queue to laboratory technicians'),
    ('lab.queue.reassign', 'Reassign Lab Technician', 'Lab', 'Reassign requests to a different laboratory technician'),
    ('lab.queue.hold', 'Hold Lab Request', 'Lab', 'Place requests in the lab queue on hold with mandatory reason'),
    ('lab.request.view', 'View Lab Request Details', 'Lab', 'View full calibration intake and metrology equipment details'),
    ('lab.request.start_verification', 'Start Verification', 'Lab', 'Promote request from Lab Queue to Verification stage'),
    ('lab.request.override_assignment', 'Override Lab Assignment', 'Lab', 'Accept or process requests assigned to other technicians')
ON CONFLICT (code) DO NOTHING;

-- 10. Map Step 7 Permissions to System Roles
-- Super Admin (* handles all permissions)
-- Tenant Admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'tenant_admin'
  AND p.code IN (
      'lab.queue.view', 'lab.queue.accept', 'lab.queue.assign', 'lab.queue.reassign',
      'lab.queue.hold', 'lab.request.view', 'lab.request.start_verification',
      'lab.request.override_assignment'
  )
ON CONFLICT DO NOTHING;

-- Lab User
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'lab_user'
  AND p.code IN (
      'lab.queue.view', 'lab.queue.accept', 'lab.queue.hold',
      'lab.request.view', 'lab.request.start_verification'
  )
ON CONFLICT DO NOTHING;

-- Lab Manager / Org Admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('manager', 'org_admin')
  AND p.code IN (
      'lab.queue.view', 'lab.queue.accept', 'lab.queue.assign', 'lab.queue.reassign',
      'lab.queue.hold', 'lab.request.view', 'lab.request.start_verification',
      'lab.request.override_assignment'
  )
ON CONFLICT DO NOTHING;
-- ============================================================================
-- CALIBRATION COMMERCIAL MODULE (CCM) - STEP 8 MIGRATION
-- Module: Item Verification + Proof Documents + Private R2 Storage
-- ============================================================================

-- 1. VERIFICATIONS TABLE (ITEM-LEVEL VERIFICATION)
-- Verification is strictly executed at request_item level.
CREATE TABLE IF NOT EXISTS public.verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES public.request_items(id) ON DELETE CASCADE,
    verified_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Item identity check
    item_match_status VARCHAR(30) NOT NULL CHECK (item_match_status IN ('MATCHED', 'NOT_MATCHED')),
    
    -- Serial number check
    serial_match_status VARCHAR(30) NOT NULL CHECK (serial_match_status IN ('MATCHED', 'NOT_MATCHED', 'NOT_APPLICABLE')),
    
    -- Received Quantity & status
    received_quantity INTEGER NOT NULL CHECK (received_quantity >= 0),
    quantity_status VARCHAR(30) NOT NULL CHECK (quantity_status IN ('MATCHED', 'SHORT', 'EXCESS')),
    
    -- Physical condition
    condition_status VARCHAR(30) NOT NULL CHECK (condition_status IN ('GOOD', 'DAMAGED', 'FAULTY', 'OTHER')),
    
    -- Verification outcome
    verification_result VARCHAR(30) NOT NULL CHECK (verification_result IN ('VERIFIED', 'DISCREPANCY', 'SHORT', 'EXCEPTION')),
    discrepancy_reason TEXT NULL,
    remarks TEXT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Unique constraint: Each request item in a tenant has a single active verification record
    CONSTRAINT uq_verifications_request_item UNIQUE (tenant_id, request_item_id)
);

-- 2. DOCUMENTS TABLE (METADATA & R2 STORAGE REFERENCES)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    item_id UUID NULL REFERENCES public.item_masters(id) ON DELETE SET NULL,
    request_item_id UUID NULL REFERENCES public.request_items(id) ON DELETE SET NULL,
    
    -- Document categorization for Step 8
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'COLLECTION_PROOF',
        'RECEIPT_PROOF',
        'PREVIOUS_CERTIFICATE',
        'VERIFICATION_PROOF',
        'OTHER'
    )),
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    storage_reference TEXT NOT NULL,
    mandatory BOOLEAN NOT NULL DEFAULT false,
    
    uploaded_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES FOR HIGH-PERFORMANCE TENANT & QUEUE QUERIES
CREATE INDEX IF NOT EXISTS idx_verifications_tenant_id ON public.verifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_verifications_request ON public.verifications(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_verifications_item ON public.verifications(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_verifications_result ON public.verifications(tenant_id, verification_result);
CREATE INDEX IF NOT EXISTS idx_verifications_verifier ON public.verifications(tenant_id, verified_by);
CREATE INDEX IF NOT EXISTS idx_verifications_verified_at ON public.verifications(tenant_id, verified_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_request ON public.documents(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_documents_item ON public.documents(tenant_id, item_id);
CREATE INDEX IF NOT EXISTS idx_documents_req_item ON public.documents(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(tenant_id, document_type);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON public.documents(tenant_id, uploaded_at DESC);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Verifications RLS
CREATE POLICY verifications_tenant_isolation_select ON public.verifications
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY verifications_tenant_isolation_insert ON public.verifications
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY verifications_tenant_isolation_update ON public.verifications
    FOR UPDATE USING (tenant_id = public.current_tenant_id());

CREATE POLICY verifications_tenant_isolation_delete ON public.verifications
    FOR DELETE USING (tenant_id = public.current_tenant_id());

-- Documents RLS
CREATE POLICY documents_tenant_isolation_select ON public.documents
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY documents_tenant_isolation_insert ON public.documents
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY documents_tenant_isolation_update ON public.documents
    FOR UPDATE USING (tenant_id = public.current_tenant_id());

CREATE POLICY documents_tenant_isolation_delete ON public.documents
    FOR DELETE USING (tenant_id = public.current_tenant_id());

-- 5. REGISTER STEP 8 RBAC PERMISSIONS
INSERT INTO public.permissions (code, name, module, description)
VALUES
    ('verification.view', 'View Verifications', 'Verification', 'Access verification queue and inspect item-level results'),
    ('verification.create', 'Perform Verification', 'Verification', 'Record item identity, serial, quantity, and condition verification'),
    ('verification.edit', 'Modify Verification', 'Verification', 'Update existing item verification records and discrepancy reasons'),
    ('verification.complete', 'Complete Request Verification', 'Verification', 'Finalize request verification and enforce mandatory documents'),
    ('verification.override', 'Override Verification', 'Verification', 'Authorize verification bypass or supervisor exception handling'),
    ('document.view', 'View Proof Documents', 'Documents', 'View and download uploaded proof documents and certificates'),
    ('document.upload', 'Upload Proof Documents', 'Documents', 'Upload proof documents to private Cloudflare R2 storage'),
    ('document.delete', 'Delete Proof Documents', 'Documents', 'Remove proof documents and attachments where permitted'),
    ('document.version', 'Upload Document Version', 'Documents', 'Upload subsequent revisions and version history for documents')
ON CONFLICT (code) DO NOTHING;

-- 6. MAP STEP 8 PERMISSIONS TO SYSTEM ROLES
-- Tenant Admin (all Step 8 permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'tenant_admin'
  AND p.code IN (
      'verification.view', 'verification.create', 'verification.edit', 
      'verification.complete', 'verification.override', 'document.view', 
      'document.upload', 'document.delete', 'document.version'
  )
ON CONFLICT DO NOTHING;

-- Lab User / Operator (core verification, completion, view/upload documents)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('lab_user', 'operator')
  AND p.code IN (
      'verification.view', 'verification.create', 'verification.edit', 
      'verification.complete', 'document.view', 'document.upload', 'document.version'
  )
ON CONFLICT DO NOTHING;

-- Manager / Org Admin (supervisory verification, override, documents)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('manager', 'org_admin')
  AND p.code IN (
      'verification.view', 'verification.create', 'verification.complete', 
      'verification.override', 'document.view', 'document.upload', 'document.version'
  )
ON CONFLICT DO NOTHING;

-- Viewer (view verification, view documents)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'viewer'
  AND p.code IN ('verification.view', 'document.view')
ON CONFLICT DO NOTHING;
-- ============================================================================
-- CALIBRATION COMMERCIAL MODULE (CCM) - STEP 9 MIGRATION
-- Table Schemas: calibrations, calibration_measurements, certificates
-- PostgreSQL Row Level Security (RLS) & Performance Indexes
-- ============================================================================

-- 1. CALIBRATIONS TABLE
CREATE TABLE IF NOT EXISTS calibrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES item_masters(id) ON DELETE CASCADE,
    calibrated_by UUID NOT NULL REFERENCES public.user_profiles(id),
    calibration_started_at TIMESTAMPTZ DEFAULT NOW(),
    calibration_completed_at TIMESTAMPTZ NULL,
    calibration_method TEXT NULL,
    environmental_conditions TEXT NULL,
    result VARCHAR NOT NULL CHECK (result IN ('PASS', 'FAIL', 'ADJUSTED', 'NOT_CALIBRATABLE')),
    remarks TEXT NULL,
    status VARCHAR NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NOT_CALIBRATABLE')),
    calibration_date DATE NULL,
    next_due_date DATE NULL,
    calibration_frequency INTEGER NULL,
    calibration_frequency_unit VARCHAR NULL CHECK (calibration_frequency_unit IN ('MONTHS', 'YEARS', 'DAYS') OR calibration_frequency_unit IS NULL),
    frequency_override BOOLEAN DEFAULT FALSE,
    frequency_override_reason TEXT NULL,
    frequency_overridden_by UUID REFERENCES public.user_profiles(id) NULL,
    frequency_overridden_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_calibrations_tenant_request_item UNIQUE (tenant_id, request_item_id)
);

-- 2. CALIBRATION MEASUREMENTS TABLE
CREATE TABLE IF NOT EXISTS calibration_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    calibration_id UUID NOT NULL REFERENCES calibrations(id) ON DELETE CASCADE,
    measurement_point VARCHAR NOT NULL,
    nominal_value NUMERIC NULL,
    observed_value NUMERIC NULL,
    unit VARCHAR NULL,
    tolerance_min NUMERIC NULL,
    tolerance_max NUMERIC NULL,
    error_value NUMERIC NULL,
    measurement_result VARCHAR NOT NULL CHECK (measurement_result IN ('PASS', 'FAIL', 'NOT_TESTED')),
    remarks TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CERTIFICATES TABLE
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    calibration_id UUID NOT NULL REFERENCES calibrations(id) ON DELETE CASCADE,
    certificate_number VARCHAR NOT NULL,
    document_type VARCHAR NOT NULL DEFAULT 'CALIBRATION_CERTIFICATE',
    file_name VARCHAR NOT NULL,
    storage_reference TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    generated_by UUID NOT NULL REFERENCES public.user_profiles(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_certificates_tenant_cert_version UNIQUE (tenant_id, certificate_number, version)
);

-- ============================================================================
-- DATABASE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_req ON calibrations(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_req_item ON calibrations(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_item ON calibrations(tenant_id, item_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_result ON calibrations(tenant_id, result);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_completed ON calibrations(tenant_id, calibration_completed_at);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_next_due ON calibrations(tenant_id, next_due_date);

CREATE INDEX IF NOT EXISTS idx_calibration_measurements_tenant_cal ON calibration_measurements(tenant_id, calibration_id);

CREATE INDEX IF NOT EXISTS idx_certificates_tenant_cal ON certificates(tenant_id, calibration_id);
CREATE INDEX IF NOT EXISTS idx_certificates_tenant_req_item ON certificates(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_certificates_tenant_cert_num ON certificates(tenant_id, certificate_number);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Calibrations RLS
CREATE POLICY calibrations_tenant_isolation ON calibrations
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_super_admin())
    WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- Calibration Measurements RLS
CREATE POLICY calibration_measurements_tenant_isolation ON calibration_measurements
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_super_admin())
    WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- Certificates RLS
CREATE POLICY certificates_tenant_isolation ON certificates
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_super_admin())
    WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
-- ============================================================================
-- CALIBRATION COMMERCIAL MODULE (CCM) - STEP 10 MIGRATION
-- Table Schemas: service_requests, service_approvals
-- PostgreSQL Row Level Security (RLS) & Performance Indexes
-- ============================================================================

-- 1. SERVICE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    calibration_id UUID NOT NULL REFERENCES calibrations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    service_status VARCHAR NOT NULL DEFAULT 'SERVICE_REQUIRED' CHECK (service_status IN ('SERVICE_REQUIRED', 'AWAITING_CLIENT_APPROVAL', 'APPROVED', 'REJECTED', 'IN_SERVICE', 'SERVICE_COMPLETED', 'CANCELLED')),
    fault_description TEXT NOT NULL,
    service_required BOOLEAN NOT NULL DEFAULT TRUE,
    estimated_service_cost NUMERIC NULL,
    service_remarks TEXT NULL,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id),
    started_by UUID REFERENCES public.user_profiles(id) NULL,
    started_at TIMESTAMPTZ NULL,
    completed_by UUID REFERENCES public.user_profiles(id) NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SERVICE APPROVALS TABLE
CREATE TABLE IF NOT EXISTS service_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    approval_status VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by_client_name VARCHAR NULL,
    approved_by_client_role VARCHAR NULL,
    approval_remarks TEXT NULL,
    approval_reference VARCHAR NULL,
    approved_at TIMESTAMPTZ NULL,
    rejected_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DATABASE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_req ON service_requests(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_req_item ON service_requests(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_cal ON service_requests(tenant_id, calibration_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_client ON service_requests(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_status ON service_requests(tenant_id, service_status);

CREATE INDEX IF NOT EXISTS idx_service_approvals_tenant_req ON service_approvals(tenant_id, service_request_id);
CREATE INDEX IF NOT EXISTS idx_service_approvals_tenant_status ON service_approvals(tenant_id, approval_status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_approvals ENABLE ROW LEVEL SECURITY;

-- Service Requests RLS
CREATE POLICY service_requests_tenant_isolation ON service_requests
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_super_admin())
    WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- Service Approvals RLS
CREATE POLICY service_approvals_tenant_isolation ON service_approvals
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_super_admin())
    WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
-- Migration 012: Vendor Outsourcing Workflow & Purchase Orders
-- Enables vendor outsourcing for calibration items, vendor selection, PO generation, shipment tracking, vendor certificate recording, and main flow reintegration.

-- 1. Create Outsource Status Enum (if not using VARCHAR)
-- Statuses: OUTSOURCE_REQUIRED, VENDOR_SELECTED, PO_DRAFT, PO_ISSUED, SENT_TO_VENDOR, VENDOR_RECEIVED, VENDOR_CALIBRATION, VENDOR_COMPLETED, AWAITING_RETURN, RETURNED, RECEIVED_BACK, REINTEGRATED, VENDOR_FAILED, CANCELLED

-- 2. Create vendor_outsource_requests table
CREATE TABLE IF NOT EXISTS vendor_outsource_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES sub_organizations(id) ON DELETE SET NULL,
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    calibration_id UUID REFERENCES calibrations(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    
    outsource_status VARCHAR(50) NOT NULL DEFAULT 'OUTSOURCE_REQUIRED',
    outsource_reason TEXT NOT NULL,
    vendor_reference VARCHAR(100),
    expected_return_date DATE,
    
    created_by UUID NOT NULL REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    returned_at TIMESTAMPTZ,
    received_by UUID REFERENCES public.user_profiles(id),
    remarks TEXT
);

-- Index for unique active outsourcing per request_item
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_vendor_outsource_item 
ON vendor_outsource_requests (tenant_id, request_item_id) 
WHERE outsource_status NOT IN ('REINTEGRATED', 'CANCELLED');

CREATE INDEX IF NOT EXISTS idx_vendor_outsource_tenant_status ON vendor_outsource_requests (tenant_id, outsource_status);
CREATE INDEX IF NOT EXISTS idx_vendor_outsource_vendor ON vendor_outsource_requests (tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_outsource_request ON vendor_outsource_requests (tenant_id, request_id);

-- 3. Create purchase_orders table (Specifically for Vendor Outsourcing POs)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES sub_organizations(id) ON DELETE SET NULL,
    
    po_number VARCHAR(50) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    request_id UUID REFERENCES calibration_requests(id) ON DELETE CASCADE,
    outsource_request_id UUID REFERENCES vendor_outsource_requests(id) ON DELETE CASCADE,
    
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    
    created_by UUID NOT NULL REFERENCES public.user_profiles(id),
    issued_by UUID REFERENCES public.user_profiles(id),
    issued_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks TEXT,
    
    CONSTRAINT uq_po_number_tenant UNIQUE (tenant_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_po_tenant_status ON purchase_orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders (tenant_id, vendor_id);

-- 4. Create po_items table
CREATE TABLE IF NOT EXISTS po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES item_masters(id) ON DELETE RESTRICT,
    
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON po_items (tenant_id, purchase_order_id);

-- 5. Create vendor_outsource_movements table (Physical Shipment Traceability)
CREATE TABLE IF NOT EXISTS vendor_outsource_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outsource_request_id UUID NOT NULL REFERENCES vendor_outsource_requests(id) ON DELETE CASCADE,
    
    movement_type VARCHAR(40) NOT NULL, -- SEND_TO_VENDOR, RETURN_FROM_VENDOR
    tracking_number VARCHAR(100),
    carrier VARCHAR(100),
    
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    performed_by UUID NOT NULL REFERENCES public.user_profiles(id),
    
    remarks TEXT,
    document_id UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_outsource ON vendor_outsource_movements (tenant_id, outsource_request_id);

-- 6. Create vendor_calibration_records table (External Calibration Event Record)
CREATE TABLE IF NOT EXISTS vendor_calibration_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outsource_request_id UUID NOT NULL REFERENCES vendor_outsource_requests(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    
    vendor_certificate_number VARCHAR(100) NOT NULL,
    vendor_result VARCHAR(30) NOT NULL, -- PASS, FAIL, ADJUSTED, NOT_CALIBRATABLE
    
    calibrated_at DATE,
    report_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    report_document_id UUID,
    remarks TEXT,
    
    created_by UUID NOT NULL REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_cal_records_outsource ON vendor_calibration_records (tenant_id, outsource_request_id);

-- 7. Enable RLS and create isolation policies
ALTER TABLE vendor_outsource_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_outsource_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_calibration_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendor_outsource_requests
CREATE POLICY tenant_isolation_vendor_outsource ON vendor_outsource_requests
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- RLS Policies for purchase_orders
CREATE POLICY tenant_isolation_purchase_orders ON purchase_orders
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- RLS Policies for po_items
CREATE POLICY tenant_isolation_po_items ON po_items
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- RLS Policies for vendor_outsource_movements
CREATE POLICY tenant_isolation_vendor_movements ON vendor_outsource_movements
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- RLS Policies for vendor_calibration_records
CREATE POLICY tenant_isolation_vendor_cal_records ON vendor_calibration_records
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
-- Migration: 013_quotations.sql
-- Step 12: Commercial Quotation Workflow
-- Tables: quotations, quotation_items, quotation_approvals

-- 1. Create Quotations Table
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES public.sub_organizations(id) ON DELETE SET NULL,
    
    quotation_number VARCHAR(50) NOT NULL,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE NOT NULL,
    
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    version_number INT NOT NULL DEFAULT 1,
    parent_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
    
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    
    sent_at TIMESTAMPTZ,
    client_response_at TIMESTAMPTZ,
    
    client_response VARCHAR(20) DEFAULT 'PENDING',
    client_response_remarks TEXT,
    remarks TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_quotations_tenant_number UNIQUE (tenant_id, quotation_number, version_number),
    CONSTRAINT chk_quotation_status CHECK (
        status IN (
            'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_TO_CLIENT', 
            'CLIENT_APPROVED', 'CLIENT_REJECTED', 'EXPIRED', 'CANCELLED'
        )
    ),
    CONSTRAINT chk_client_response CHECK (
        client_response IN ('PENDING', 'APPROVED', 'REJECTED')
    )
);

-- 2. Create Quotation Items Table
CREATE TABLE IF NOT EXISTS public.quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    
    request_item_id UUID NOT NULL REFERENCES public.request_items(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.item_masters(id) ON DELETE CASCADE,
    
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    
    standard_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    override_cost DECIMAL(12, 2),
    final_unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    override_reason TEXT,
    override_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    override_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Quotation Approvals Table
CREATE TABLE IF NOT EXISTS public.quotation_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    
    requested_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    
    approval_remarks TEXT,
    
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    
    CONSTRAINT chk_quotation_approval_status CHECK (
        approval_status IN ('PENDING', 'APPROVED', 'REJECTED')
    )
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_tenant ON public.quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_org ON public.quotations(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_sub_org ON public.quotations(tenant_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_status ON public.quotations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_client ON public.quotations(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_request ON public.quotations(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_quotations_number ON public.quotations(tenant_id, quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON public.quotations(tenant_id, quotation_date);
CREATE INDEX IF NOT EXISTS idx_quotations_valid ON public.quotations(tenant_id, valid_until);
CREATE INDEX IF NOT EXISTS idx_quotations_created ON public.quotations(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_quotation_items_tenant ON public.quotation_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON public.quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_request_item ON public.quotation_items(request_item_id);

CREATE INDEX IF NOT EXISTS idx_quotation_approvals_tenant ON public.quotation_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotation_approvals_quotation ON public.quotation_approvals(quotation_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_approvals ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY tenant_isolation_quotations ON public.quotations
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_quotation_items ON public.quotation_items
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_quotation_approvals ON public.quotation_approvals
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
-- Migration: 014_invoices.sql
-- Step 13: Commercial Invoice Workflow (Standard, Partial & Urgent Invoicing)
-- Tables: invoices, invoice_items

-- 1. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES public.sub_organizations(id) ON DELETE SET NULL,
    
    invoice_number VARCHAR(50) NOT NULL,
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    
    invoice_type VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    urgent_reason TEXT,
    remarks TEXT,
    
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_invoices_tenant_number UNIQUE (tenant_id, invoice_number),
    CONSTRAINT chk_invoice_type CHECK (
        invoice_type IN ('STANDARD', 'PARTIAL', 'URGENT')
    ),
    CONSTRAINT chk_invoice_status CHECK (
        status IN ('DRAFT', 'READY', 'CANCELLED', 'COMPLETED')
    )
);

-- 2. Create Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    
    request_item_id UUID NOT NULL REFERENCES public.request_items(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.item_masters(id) ON DELETE CASCADE,
    quotation_item_id UUID REFERENCES public.quotation_items(id) ON DELETE SET NULL,
    
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    line_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_org ON public.invoices(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_sub_org ON public.invoices(tenant_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON public.invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_type ON public.invoices(tenant_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_client ON public.invoices(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_request ON public.invoices(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_quotation ON public.invoices(tenant_id, quotation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(tenant_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(tenant_id, invoice_date);

CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant ON public.invoice_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_request_item ON public.invoice_items(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_quotation_item ON public.invoice_items(tenant_id, quotation_item_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY tenant_isolation_invoices ON public.invoices
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_invoice_items ON public.invoice_items
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
-- Migration: 015_invoice_signatures.sql
-- Description: Client Digital Signature schema for commercial invoices (Step 14)

-- Table: signatures
CREATE TABLE IF NOT EXISTS signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    sub_org_id UUID,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN ('INVOICE', 'DELIVERY')),
    signature_status VARCHAR(50) NOT NULL CHECK (signature_status IN ('PENDING', 'SIGNED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    signer_name VARCHAR(255) NOT NULL,
    signer_role VARCHAR(255),
    signer_email VARCHAR(255),
    signer_phone VARCHAR(50),
    signature_reference VARCHAR(100) NOT NULL,
    signed_at TIMESTAMPTZ,
    signature_storage_reference TEXT,
    document_id UUID,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: invoice_signature_requests
CREATE TABLE IF NOT EXISTS invoice_signature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    sub_org_id UUID,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    request_reference VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'OPENED', 'SIGNED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID,
    signer_name VARCHAR(255),
    signer_role VARCHAR(255),
    signer_email VARCHAR(255),
    signer_phone VARCHAR(50),
    rejection_reason TEXT,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tenant_request_ref UNIQUE (tenant_id, request_reference)
);

-- Indexes for performance & query isolation
CREATE INDEX IF NOT EXISTS idx_signatures_tenant ON signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_org ON signatures(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_suborg ON signatures(tenant_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_invoice ON signatures(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_client ON signatures(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_status ON signatures(tenant_id, signature_status);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_created ON signatures(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sig_req_tenant ON invoice_signature_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_org ON invoice_signature_requests(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_suborg ON invoice_signature_requests(tenant_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_invoice ON invoice_signature_requests(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_client ON invoice_signature_requests(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_status ON invoice_signature_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_created ON invoice_signature_requests(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_expires ON invoice_signature_requests(tenant_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_ref ON invoice_signature_requests(tenant_id, request_reference);

-- Enable RLS
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_signature_requests ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policies
CREATE POLICY signatures_tenant_isolation ON signatures
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY sig_requests_tenant_isolation ON invoice_signature_requests
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);
-- Migration: 016_dispatches.sql
-- Description: Dispatch, Carrier Tracking, and Client Delivery schema (Step 15)

-- Table: dispatches
CREATE TABLE IF NOT EXISTS dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    sub_org_id UUID,
    dispatch_number VARCHAR(100) NOT NULL,
    request_id UUID NOT NULL REFERENCES calibration_requests(id),
    invoice_id UUID REFERENCES invoices(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    dispatch_type VARCHAR(50) NOT NULL CHECK (dispatch_type IN ('STANDARD', 'PARTIAL', 'URGENT')),
    status VARCHAR(50) NOT NULL DEFAULT 'READY_FOR_DISPATCH' CHECK (status IN ('READY_FOR_DISPATCH', 'PACKING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
    dispatch_date DATE NOT NULL,
    expected_delivery_date DATE,
    carrier_name VARCHAR(255),
    tracking_number VARCHAR(255),
    shipping_address TEXT NOT NULL,
    billing_address TEXT,
    urgent_reason TEXT,
    created_by UUID,
    dispatched_by UUID,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    remarks TEXT,
    CONSTRAINT uq_tenant_dispatch_no UNIQUE (tenant_id, dispatch_number)
);

-- Table: dispatch_items
CREATE TABLE IF NOT EXISTS dispatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL,
    item_id UUID NOT NULL,
    invoice_id UUID,
    invoice_item_id UUID,
    quantity INT NOT NULL DEFAULT 1,
    package_reference VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tenant_dispatch_req_item UNIQUE (tenant_id, request_item_id)
);

-- Table: deliveries
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id),
    recipient_name VARCHAR(255) NOT NULL,
    recipient_role VARCHAR(255),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    delivery_date TIMESTAMPTZ NOT NULL,
    delivery_status VARCHAR(50) NOT NULL CHECK (delivery_status IN ('DELIVERED', 'PARTIALLY_DELIVERED', 'REJECTED', 'RETURNED')),
    proof_of_delivery_storage_ref TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance & tenant isolation
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant ON dispatches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_org ON dispatches(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_suborg ON dispatches(tenant_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_req ON dispatches(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_inv ON dispatches(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_client ON dispatches(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_status ON dispatches(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_created ON dispatches(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_num ON dispatches(tenant_id, dispatch_number);

CREATE INDEX IF NOT EXISTS idx_disp_items_tenant ON dispatch_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_disp_items_tenant_disp ON dispatch_items(tenant_id, dispatch_id);
CREATE INDEX IF NOT EXISTS idx_disp_items_tenant_req_item ON dispatch_items(tenant_id, request_item_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_tenant ON deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_disp ON deliveries(tenant_id, dispatch_id);

-- Enable RLS
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policies
CREATE POLICY dispatches_tenant_isolation ON dispatches
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY dispatch_items_tenant_isolation ON dispatch_items
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY deliveries_tenant_isolation ON deliveries
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);
-- ============================================================================
-- STEP 16 MIGRATION: ANALYTICS, INDEXES & AUDIT INTEGRATION
-- ============================================================================

-- 1. Create Performance Indexes across core entities
CREATE INDEX IF NOT EXISTS idx_requests_tenant_status ON public.calibration_requests (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_tenant_client ON public.calibration_requests (tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_requests_org_suborg ON public.calibration_requests (organization_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_requests_number ON public.calibration_requests (tenant_id, request_number);

CREATE INDEX IF NOT EXISTS idx_req_items_request_id ON public.request_items (request_id);
CREATE INDEX IF NOT EXISTS idx_req_items_tenant_available ON public.request_items (tenant_id, item_available);

CREATE INDEX IF NOT EXISTS idx_verifications_req_item ON public.verifications (tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_req_item ON public.calibrations (tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_certificates_req_item ON public.certificates (tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_due_date ON public.calibrations (tenant_id, next_due_date);

CREATE INDEX IF NOT EXISTS idx_services_req_item ON public.service_requests (tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_outsourcing_req_item ON public.vendor_outsource_requests (tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_vendor_pos_number ON public.purchase_orders (tenant_id, po_number);

CREATE INDEX IF NOT EXISTS idx_quotations_req_id ON public.quotations (tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_quotations_number ON public.quotations (tenant_id, quotation_number);

CREATE INDEX IF NOT EXISTS idx_invoices_req_id ON public.invoices (tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices (tenant_id, invoice_number);

CREATE INDEX IF NOT EXISTS idx_signatures_tenant_type ON public.signatures (tenant_id, signature_type);
CREATE INDEX IF NOT EXISTS idx_dispatches_req_id ON public.dispatches (tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tracking ON public.dispatches (tenant_id, tracking_number);
CREATE INDEX IF NOT EXISTS idx_deliveries_dispatch ON public.deliveries (tenant_id, dispatch_id);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_user ON public.audit_logs (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.audit_logs (tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs (created_at DESC);

-- 2. Audit Trail Extension (ensure ip_address and request_number column exist if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN ip_address VARCHAR(45) DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'request_number'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN request_number VARCHAR(100) DEFAULT NULL;
    END IF;
END $$;
