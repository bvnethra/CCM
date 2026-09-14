-- ============================================================================
-- CALIBRATION COMMERCIAL MODULE (CCM) - STEP 18 MIGRATION
-- Standalone Quotation Flow, History Roll-Ups, and Dynamic RBAC Permissions
-- ============================================================================

-- 1. Update public.quotations Table Schema
-- Allow request_id to be NULLABLE for Standalone Quotations
ALTER TABLE public.quotations ALTER COLUMN request_id DROP NOT NULL;

-- Add quotation_type column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotations' AND column_name = 'quotation_type'
    ) THEN
        ALTER TABLE public.quotations 
        ADD COLUMN quotation_type VARCHAR(30) NOT NULL DEFAULT 'STANDALONE' 
        CHECK (quotation_type IN ('STANDALONE', 'REQUEST_BASED'));
    END IF;
END $$;

-- 2. Update public.quotation_items Table Schema
-- Allow request_item_id to be NULLABLE for Standalone Quotations
ALTER TABLE public.quotation_items ALTER COLUMN request_item_id DROP NOT NULL;

-- Add consumed_quantity for partial consumption tracking in future Calibration Requests
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_items' AND column_name = 'consumed_quantity'
    ) THEN
        ALTER TABLE public.quotation_items 
        ADD COLUMN consumed_quantity INTEGER NOT NULL DEFAULT 0 
        CHECK (consumed_quantity >= 0);
    END IF;
END $$;

-- 3. Register Dynamic RBAC Permissions for Step 18
INSERT INTO public.permissions (code, name, module, description)
VALUES
    ('quotation.view', 'View Quotations', 'Quotations', 'View standalone and request-based quotation records'),
    ('quotation.create', 'Create Quotations', 'Quotations', 'Create standalone or request-based commercial quotations'),
    ('quotation.edit', 'Edit Quotations', 'Quotations', 'Edit draft quotation details and line items'),
    ('quotation.submit', 'Submit Quotations', 'Quotations', 'Submit quotations for mandatory Lab Approver gate'),
    ('quotation.approve', 'Approve Quotations', 'Quotations', 'Lab Approver gate authorization to approve quotations'),
    ('quotation.reject', 'Reject Quotations', 'Quotations', 'Reject submitted quotations with mandatory remarks'),
    ('quotation.send', 'Send Quotation to Client', 'Quotations', 'Transmit approved quotation to client and generate PDF'),
    ('quotation.cancel', 'Cancel Quotations', 'Quotations', 'Cancel draft or active quotations'),
    ('quotation.history.view', 'View Quotation History', 'Quotations', 'View complete quotation revision history and client response audit'),
    ('quotation.override_cost', 'Override Line Item Cost', 'Quotations', 'Override standard cost from Item Master with mandatory reason')
ON CONFLICT (code) DO NOTHING;

-- 4. Map Step 18 Permissions to Roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'tenant_admin'
  AND p.code IN (
      'quotation.view', 'quotation.create', 'quotation.edit', 'quotation.submit',
      'quotation.approve', 'quotation.reject', 'quotation.send', 'quotation.cancel',
      'quotation.history.view', 'quotation.override_cost'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('manager', 'org_admin')
  AND p.code IN (
      'quotation.view', 'quotation.create', 'quotation.edit', 'quotation.submit',
      'quotation.approve', 'quotation.reject', 'quotation.send', 'quotation.cancel',
      'quotation.history.view', 'quotation.override_cost'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('commercial_user', 'operator', 'lab_user')
  AND p.code IN (
      'quotation.view', 'quotation.create', 'quotation.edit', 'quotation.submit',
      'quotation.send', 'quotation.history.view'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'viewer'
  AND p.code IN ('quotation.view', 'quotation.history.view')
ON CONFLICT DO NOTHING;

-- 5. Additional Performance Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_type ON public.quotations(tenant_id, quotation_type);
CREATE INDEX IF NOT EXISTS idx_quotation_items_item_id ON public.quotation_items(tenant_id, item_id);
