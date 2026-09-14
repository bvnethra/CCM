-- ============================================================================
-- STEP 16 MIGRATION: ANALYTICS, INDEXES & AUDIT INTEGRATION
-- ============================================================================

-- 1. Create Performance Indexes across core entities
CREATE INDEX IF NOT EXISTS idx_requests_tenant_status ON public.calibration_requests (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_tenant_client ON public.calibration_requests (tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_requests_org_suborg ON public.calibration_requests (organization_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_requests_number ON public.calibration_requests (tenant_id, request_number);

CREATE INDEX IF NOT EXISTS idx_req_items_request_id ON public.request_items (request_id);
CREATE INDEX IF NOT EXISTS idx_req_items_tenant_available ON public.request_items (tenant_id, item_available);

CREATE INDEX IF NOT EXISTS idx_verifications_req_item ON public.verifications (tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_req_item ON public.calibrations (tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_certificates_req_item ON public.certificates (tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_due_date ON public.calibrations (tenant_id, next_due_date);

CREATE INDEX IF NOT EXISTS idx_services_req_item ON public.service_requests (tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_outsourcing_req_item ON public.vendor_outsource_requests (tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_vendor_pos_number ON public.purchase_orders (tenant_id, po_number);

CREATE INDEX IF NOT EXISTS idx_quotations_req_id ON public.quotations (tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_quotations_number ON public.quotations (tenant_id, quotation_number);

CREATE INDEX IF NOT EXISTS idx_invoices_req_id ON public.invoices (tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices (tenant_id, invoice_number);

CREATE INDEX IF NOT EXISTS idx_signatures_tenant_type ON public.signatures (tenant_id, signature_type);
CREATE INDEX IF NOT EXISTS idx_dispatches_req_id ON public.dispatches (tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tracking ON public.dispatches (tenant_id, tracking_number);
CREATE INDEX IF NOT EXISTS idx_deliveries_dispatch ON public.deliveries (tenant_id, dispatch_id);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_user ON public.audit_logs (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.audit_logs (tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs (created_at DESC);

-- 2. Audit Trail Extension (ensure ip_address and request_number column exist if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN ip_address VARCHAR(45) DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'request_number'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN request_number VARCHAR(100) DEFAULT NULL;
    END IF;
END $$;
