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
