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
