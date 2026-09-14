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
        '22222222-1111-4222-a111-111111111111',
        '33333333-1111-4333-a111-111111111111',
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
        '22222222-1111-4222-a111-111111111111',
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
        '22222222-2222-4222-a111-222222222222',
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
        '11111111-2222-4111-a111-222222222222',
        '22222222-3333-4222-a111-333333333333',
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
