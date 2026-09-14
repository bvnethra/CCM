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
