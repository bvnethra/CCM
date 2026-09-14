-- ============================================================================
-- CALIBRATION COMMERCIAL MODULE (CCM) - STEP 19 MIGRATION
-- GMS Status Reconciliation, Hold/Resume, Cancellation, Invoice Modes & Integrity
-- ============================================================================

-- 1. Ensure public.calibration_requests has cancellation and hold columns
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calibration_requests' AND column_name = 'cancellation_reason'
    ) THEN
        ALTER TABLE public.calibration_requests ADD COLUMN cancellation_reason TEXT DEFAULT NULL;
        ALTER TABLE public.calibration_requests ADD COLUMN cancelled_by UUID REFERENCES public.users(id) DEFAULT NULL;
        ALTER TABLE public.calibration_requests ADD COLUMN cancelled_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calibration_requests' AND column_name = 'hold_reason'
    ) THEN
        ALTER TABLE public.calibration_requests ADD COLUMN hold_reason TEXT DEFAULT NULL;
        ALTER TABLE public.calibration_requests ADD COLUMN held_by UUID REFERENCES public.users(id) DEFAULT NULL;
        ALTER TABLE public.calibration_requests ADD COLUMN held_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- 2. Ensure public.request_items has hold columns
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'request_items' AND column_name = 'hold_reason'
    ) THEN
        ALTER TABLE public.request_items ADD COLUMN hold_reason TEXT DEFAULT NULL;
        ALTER TABLE public.request_items ADD COLUMN held_by UUID REFERENCES public.users(id) DEFAULT NULL;
        ALTER TABLE public.request_items ADD COLUMN held_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- 3. Ensure public.invoices has invoice_mode column
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'invoice_mode'
    ) THEN
        ALTER TABLE public.invoices 
        ADD COLUMN invoice_mode VARCHAR(30) NOT NULL DEFAULT 'ITEMS_AND_INVOICE' 
        CHECK (invoice_mode IN ('ITEMS_AND_INVOICE', 'INVOICE_ONLY'));
    END IF;
END $$;

-- 4. Offline metadata tracking on public.collection_requests
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'collection_requests' AND column_name = 'offline_draft_id'
    ) THEN
        ALTER TABLE public.collection_requests ADD COLUMN offline_draft_id VARCHAR(100) DEFAULT NULL;
        ALTER TABLE public.collection_requests ADD COLUMN sync_status VARCHAR(30) NOT NULL DEFAULT 'SYNCED' CHECK (sync_status IN ('LOCAL_DRAFT', 'SYNC_PENDING', 'SYNCED', 'SYNC_FAILED'));
    END IF;
END $$;

-- 5. Register Dynamic RBAC Permissions for Step 19
INSERT INTO public.permissions (code, name, module, description)
VALUES
    ('request.hold', 'Hold Request', 'Requests', 'Put calibration request or request item on hold'),
    ('request.resume', 'Resume Request', 'Requests', 'Resume request or request item from hold'),
    ('request.cancel', 'Cancel Request', 'Requests', 'Cancel calibration request with required audit reason'),
    ('system.integrity_view', 'View System Data Integrity', 'System', 'Run and view backend data integrity diagnostic checks')
ON CONFLICT (code) DO NOTHING;

-- Map Step 19 Permissions to Roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('tenant_admin', 'org_admin', 'manager')
  AND p.code IN ('request.hold', 'request.resume', 'request.cancel', 'system.integrity_view')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('operator', 'lab_user', 'commercial_user')
  AND p.code IN ('request.hold', 'request.resume')
ON CONFLICT DO NOTHING;

-- 6. Indexes for Step 19 Status and Diagnostic Queries
CREATE INDEX IF NOT EXISTS idx_requests_status_hold ON public.calibration_requests(tenant_id, status) WHERE status = 'ON_HOLD';
CREATE INDEX IF NOT EXISTS idx_request_items_status ON public.request_items(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_mode ON public.invoices(tenant_id, invoice_mode);
