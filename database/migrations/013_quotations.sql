-- Migration: 013_quotations.sql
-- Step 12: Commercial Quotation Workflow
-- Tables: quotations, quotation_items, quotation_approvals

-- 1. Create Quotations Table
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES public.sub_organizations(id) ON DELETE SET NULL,
    
    quotation_number VARCHAR(50) NOT NULL,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE NOT NULL,
    
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    version_number INT NOT NULL DEFAULT 1,
    parent_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
    
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    
    sent_at TIMESTAMPTZ,
    client_response_at TIMESTAMPTZ,
    
    client_response VARCHAR(20) DEFAULT 'PENDING',
    client_response_remarks TEXT,
    remarks TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_quotations_tenant_number UNIQUE (tenant_id, quotation_number, version_number),
    CONSTRAINT chk_quotation_status CHECK (
        status IN (
            'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_TO_CLIENT', 
            'CLIENT_APPROVED', 'CLIENT_REJECTED', 'EXPIRED', 'CANCELLED'
        )
    ),
    CONSTRAINT chk_client_response CHECK (
        client_response IN ('PENDING', 'APPROVED', 'REJECTED')
    )
);

-- 2. Create Quotation Items Table
CREATE TABLE IF NOT EXISTS public.quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    
    request_item_id UUID NOT NULL REFERENCES public.calibration_request_items(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    
    standard_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    override_cost DECIMAL(12, 2),
    final_unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    override_reason TEXT,
    override_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    override_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Quotation Approvals Table
CREATE TABLE IF NOT EXISTS public.quotation_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    
    requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    approval_remarks TEXT,
    
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    
    CONSTRAINT chk_quotation_approval_status CHECK (
        approval_status IN ('PENDING', 'APPROVED', 'REJECTED')
    )
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_tenant ON public.quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_org ON public.quotations(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_sub_org ON public.quotations(tenant_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_status ON public.quotations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_client ON public.quotations(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_request ON public.quotations(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_quotations_number ON public.quotations(tenant_id, quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON public.quotations(tenant_id, quotation_date);
CREATE INDEX IF NOT EXISTS idx_quotations_valid ON public.quotations(tenant_id, valid_until);
CREATE INDEX IF NOT EXISTS idx_quotations_created ON public.quotations(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_quotation_items_tenant ON public.quotation_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON public.quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_request_item ON public.quotation_items(request_item_id);

CREATE INDEX IF NOT EXISTS idx_quotation_approvals_tenant ON public.quotation_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotation_approvals_quotation ON public.quotation_approvals(quotation_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_approvals ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY tenant_isolation_quotations ON public.quotations
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_quotation_items ON public.quotation_items
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_quotation_approvals ON public.quotation_approvals
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
