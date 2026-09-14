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
