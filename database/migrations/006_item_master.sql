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
INSERT INTO public.permissions (id, name, description, module, created_at)
VALUES
    (gen_random_uuid(), 'item.view', 'View item master catalog and specifications', 'item_masters', now()),
    (gen_random_uuid(), 'item.create', 'Create and onboard new item master records', 'item_masters', now()),
    (gen_random_uuid(), 'item.edit', 'Edit item master properties and metrology parameters', 'item_masters', now()),
    (gen_random_uuid(), 'item.delete', 'Permanently delete item master records', 'item_masters', now()),
    (gen_random_uuid(), 'item.activate', 'Activate item master for calibration services', 'item_masters', now()),
    (gen_random_uuid(), 'item.deactivate', 'Deactivate item master records', 'item_masters', now())
ON CONFLICT (name) DO UPDATE SET
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
