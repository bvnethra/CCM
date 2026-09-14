-- ============================================================================
-- CALIBRATION COMMERCIAL MODULE (CCM) - STEP 8 MIGRATION
-- Module: Item Verification + Proof Documents + Private R2 Storage
-- ============================================================================

-- 1. VERIFICATIONS TABLE (ITEM-LEVEL VERIFICATION)
-- Verification is strictly executed at request_item level.
CREATE TABLE IF NOT EXISTS public.verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES public.request_items(id) ON DELETE CASCADE,
    verified_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Item identity check
    item_match_status VARCHAR(30) NOT NULL CHECK (item_match_status IN ('MATCHED', 'NOT_MATCHED')),
    
    -- Serial number check
    serial_match_status VARCHAR(30) NOT NULL CHECK (serial_match_status IN ('MATCHED', 'NOT_MATCHED', 'NOT_APPLICABLE')),
    
    -- Received Quantity & status
    received_quantity INTEGER NOT NULL CHECK (received_quantity >= 0),
    quantity_status VARCHAR(30) NOT NULL CHECK (quantity_status IN ('MATCHED', 'SHORT', 'EXCESS')),
    
    -- Physical condition
    condition_status VARCHAR(30) NOT NULL CHECK (condition_status IN ('GOOD', 'DAMAGED', 'FAULTY', 'OTHER')),
    
    -- Verification outcome
    verification_result VARCHAR(30) NOT NULL CHECK (verification_result IN ('VERIFIED', 'DISCREPANCY', 'SHORT', 'EXCEPTION')),
    discrepancy_reason TEXT NULL,
    remarks TEXT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Unique constraint: Each request item in a tenant has a single active verification record
    CONSTRAINT uq_verifications_request_item UNIQUE (tenant_id, request_item_id)
);

-- 2. DOCUMENTS TABLE (METADATA & R2 STORAGE REFERENCES)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    item_id UUID NULL REFERENCES public.item_masters(id) ON DELETE SET NULL,
    request_item_id UUID NULL REFERENCES public.request_items(id) ON DELETE SET NULL,
    
    -- Document categorization for Step 8
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'COLLECTION_PROOF',
        'RECEIPT_PROOF',
        'PREVIOUS_CERTIFICATE',
        'VERIFICATION_PROOF',
        'OTHER'
    )),
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    storage_reference TEXT NOT NULL,
    mandatory BOOLEAN NOT NULL DEFAULT false,
    
    uploaded_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES FOR HIGH-PERFORMANCE TENANT & QUEUE QUERIES
CREATE INDEX IF NOT EXISTS idx_verifications_tenant_id ON public.verifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_verifications_request ON public.verifications(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_verifications_item ON public.verifications(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_verifications_result ON public.verifications(tenant_id, verification_result);
CREATE INDEX IF NOT EXISTS idx_verifications_verifier ON public.verifications(tenant_id, verified_by);
CREATE INDEX IF NOT EXISTS idx_verifications_verified_at ON public.verifications(tenant_id, verified_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_request ON public.documents(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_documents_item ON public.documents(tenant_id, item_id);
CREATE INDEX IF NOT EXISTS idx_documents_req_item ON public.documents(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(tenant_id, document_type);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON public.documents(tenant_id, uploaded_at DESC);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Verifications RLS
CREATE POLICY verifications_tenant_isolation_select ON public.verifications
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY verifications_tenant_isolation_insert ON public.verifications
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY verifications_tenant_isolation_update ON public.verifications
    FOR UPDATE USING (tenant_id = public.current_tenant_id());

CREATE POLICY verifications_tenant_isolation_delete ON public.verifications
    FOR DELETE USING (tenant_id = public.current_tenant_id());

-- Documents RLS
CREATE POLICY documents_tenant_isolation_select ON public.documents
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY documents_tenant_isolation_insert ON public.documents
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY documents_tenant_isolation_update ON public.documents
    FOR UPDATE USING (tenant_id = public.current_tenant_id());

CREATE POLICY documents_tenant_isolation_delete ON public.documents
    FOR DELETE USING (tenant_id = public.current_tenant_id());

-- 5. REGISTER STEP 8 RBAC PERMISSIONS
INSERT INTO public.permissions (id, code, name, module, description)
VALUES
    ('p57', 'verification.view', 'View Verifications', 'Verification', 'Access verification queue and inspect item-level results'),
    ('p58', 'verification.create', 'Perform Verification', 'Verification', 'Record item identity, serial, quantity, and condition verification'),
    ('p59', 'verification.edit', 'Modify Verification', 'Verification', 'Update existing item verification records and discrepancy reasons'),
    ('p60', 'verification.complete', 'Complete Request Verification', 'Verification', 'Finalize request verification and enforce mandatory documents'),
    ('p61', 'verification.override', 'Override Verification', 'Verification', 'Authorize verification bypass or supervisor exception handling'),
    ('p62', 'document.view', 'View Proof Documents', 'Documents', 'View and download uploaded proof documents and certificates'),
    ('p63', 'document.upload', 'Upload Proof Documents', 'Documents', 'Upload proof documents to private Cloudflare R2 storage'),
    ('p64', 'document.delete', 'Delete Proof Documents', 'Documents', 'Remove proof documents and attachments where permitted'),
    ('p65', 'document.version', 'Upload Document Version', 'Documents', 'Upload subsequent revisions and version history for documents')
ON CONFLICT (id) DO NOTHING;

-- 6. MAP STEP 8 PERMISSIONS TO SYSTEM ROLES
-- Tenant Admin (all Step 8 permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'role-02', p.id FROM public.permissions p WHERE p.id IN ('p57', 'p58', 'p59', 'p60', 'p61', 'p62', 'p63', 'p64', 'p65')
ON CONFLICT DO NOTHING;

-- Lab User (core verification, completion, view/upload documents)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'role-05', p.id FROM public.permissions p WHERE p.id IN ('p57', 'p58', 'p59', 'p60', 'p62', 'p63', 'p65')
ON CONFLICT DO NOTHING;

-- Manager (supervisory verification, override, documents)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'role-04', p.id FROM public.permissions p WHERE p.id IN ('p57', 'p58', 'p60', 'p61', 'p62', 'p63', 'p65')
ON CONFLICT DO NOTHING;

-- Organization Admin (view verification, view documents)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'role-03', p.id FROM public.permissions p WHERE p.id IN ('p57', 'p62')
ON CONFLICT DO NOTHING;
