-- ============================================================================
-- CALIBRATION COMMERCIAL MODULE (CCM) - STEP 20 MIGRATION
-- Lab Receipts, Service Commercial Charges, Invoice Line Types & Commercial Summary
-- ============================================================================

-- 1. Create public.lab_receipts Table
CREATE TABLE IF NOT EXISTS public.lab_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES public.sub_organizations(id) ON DELETE SET NULL,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    received_by UUID NOT NULL REFERENCES public.users(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    receipt_status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED' CHECK (receipt_status IN ('PENDING', 'RECEIVED', 'DISCREPANCY', 'REJECTED')),
    received_quantity INTEGER NOT NULL DEFAULT 1 CHECK (received_quantity >= 0),
    expected_quantity INTEGER NOT NULL DEFAULT 1 CHECK (expected_quantity >= 0),
    receipt_remarks TEXT DEFAULT NULL,
    receipt_proof_document_id UUID DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Extend public.service_requests with Commercial Charge Columns
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_requests' AND column_name = 'service_unit_cost'
    ) THEN
        ALTER TABLE public.service_requests ADD COLUMN service_unit_cost NUMERIC(12,2) DEFAULT 0.00 CHECK (service_unit_cost >= 0);
        ALTER TABLE public.service_requests ADD COLUMN service_quantity INTEGER DEFAULT 1 CHECK (service_quantity >= 1);
        ALTER TABLE public.service_requests ADD COLUMN service_tax_rate NUMERIC(5,2) DEFAULT 18.00 CHECK (service_tax_rate >= 0);
        ALTER TABLE public.service_requests ADD COLUMN service_tax_amount NUMERIC(12,2) DEFAULT 0.00 CHECK (service_tax_amount >= 0);
        ALTER TABLE public.service_requests ADD COLUMN service_discount_amount NUMERIC(12,2) DEFAULT 0.00 CHECK (service_discount_amount >= 0);
        ALTER TABLE public.service_requests ADD COLUMN service_total_amount NUMERIC(12,2) DEFAULT 0.00 CHECK (service_total_amount >= 0);
        ALTER TABLE public.service_requests ADD COLUMN approved_service_cost NUMERIC(12,2) DEFAULT 0.00 CHECK (approved_service_cost >= 0);
        ALTER TABLE public.service_requests ADD COLUMN is_billed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Extend public.invoice_items with line_type and cross-references
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_items' AND column_name = 'line_type'
    ) THEN
        ALTER TABLE public.invoice_items 
        ADD COLUMN line_type VARCHAR(30) NOT NULL DEFAULT 'CALIBRATION' 
        CHECK (line_type IN ('CALIBRATION', 'SERVICE', 'OUTSOURCING', 'OTHER'));

        ALTER TABLE public.invoice_items ADD COLUMN service_request_id UUID REFERENCES public.service_requests(id) DEFAULT NULL;
        ALTER TABLE public.invoice_items ADD COLUMN vendor_outsource_request_id UUID REFERENCES public.vendor_outsource_requests(id) DEFAULT NULL;
    END IF;
END $$;

-- 4. Register Step 20 Dynamic RBAC Permissions
INSERT INTO public.permissions (code, name, module, description)
VALUES
    ('lab.receipt.view', 'View Lab Receipts', 'Lab Operations', 'View physical lab equipment intake receipt records'),
    ('lab.receipt.confirm', 'Confirm Lab Receipt', 'Lab Operations', 'Confirm physical receipt of equipment in lab queue'),
    ('lab.receipt.discrepancy', 'Record Receipt Discrepancy', 'Lab Operations', 'Log quantity or physical condition discrepancies upon lab receipt'),
    ('service.charge.view', 'View Service Commercial Charges', 'Service', 'View billable service charges and repair estimations'),
    ('service.charge.create', 'Create Service Charge', 'Service', 'Estimate and record billable service charges for faulty items'),
    ('service.charge.edit', 'Edit Service Charge', 'Service', 'Edit billable service charges prior to client approval'),
    ('service.charge.approve', 'Approve Service Charge', 'Service', 'Approve billable service charges for client invoicing'),
    ('commercial.summary.view', 'View Request Commercial Summary', 'Commercial', 'View commercial financial breakdown of requests'),
    ('vendor.cost.view', 'View Vendor Internal Cost', 'Outsourcing', 'View internal vendor PO costs and outsourcing margins'),
    ('vendor.cost.edit', 'Edit Vendor Internal Cost', 'Outsourcing', 'Edit internal vendor PO costs and commercial rates')
ON CONFLICT (code) DO NOTHING;

-- Map Permissions to Roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('tenant_admin', 'org_admin', 'manager')
  AND p.code IN (
      'lab.receipt.view', 'lab.receipt.confirm', 'lab.receipt.discrepancy',
      'service.charge.view', 'service.charge.create', 'service.charge.edit', 'service.charge.approve',
      'commercial.summary.view', 'vendor.cost.view', 'vendor.cost.edit'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('lab_user', 'operator')
  AND p.code IN ('lab.receipt.view', 'lab.receipt.confirm', 'lab.receipt.discrepancy', 'service.charge.view', 'service.charge.create')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'commercial_user'
  AND p.code IN ('service.charge.view', 'service.charge.approve', 'commercial.summary.view')
ON CONFLICT DO NOTHING;

-- 5. Performance Indexes for Step 20
CREATE INDEX IF NOT EXISTS idx_lab_receipts_request ON public.lab_receipts(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_billed ON public.service_requests(tenant_id, is_billed);
CREATE INDEX IF NOT EXISTS idx_invoice_items_line_type ON public.invoice_items(tenant_id, line_type);
