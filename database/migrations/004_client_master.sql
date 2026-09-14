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
