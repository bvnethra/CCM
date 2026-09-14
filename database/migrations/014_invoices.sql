-- Migration: 014_invoices.sql
-- Step 13: Commercial Invoice Workflow (Standard, Partial & Urgent Invoicing)
-- Tables: invoices, invoice_items

-- 1. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES public.sub_organizations(id) ON DELETE SET NULL,
    
    invoice_number VARCHAR(50) NOT NULL,
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.calibration_requests(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    
    invoice_type VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    urgent_reason TEXT,
    remarks TEXT,
    
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_invoices_tenant_number UNIQUE (tenant_id, invoice_number),
    CONSTRAINT chk_invoice_type CHECK (
        invoice_type IN ('STANDARD', 'PARTIAL', 'URGENT')
    ),
    CONSTRAINT chk_invoice_status CHECK (
        status IN ('DRAFT', 'READY', 'CANCELLED', 'COMPLETED')
    )
);

-- 2. Create Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    
    request_item_id UUID NOT NULL REFERENCES public.request_items(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.item_masters(id) ON DELETE CASCADE,
    quotation_item_id UUID REFERENCES public.quotation_items(id) ON DELETE SET NULL,
    
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    line_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_org ON public.invoices(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_sub_org ON public.invoices(tenant_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON public.invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_type ON public.invoices(tenant_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_client ON public.invoices(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_request ON public.invoices(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_quotation ON public.invoices(tenant_id, quotation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(tenant_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(tenant_id, invoice_date);

CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant ON public.invoice_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_request_item ON public.invoice_items(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_quotation_item ON public.invoice_items(tenant_id, quotation_item_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY tenant_isolation_invoices ON public.invoices
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_invoice_items ON public.invoice_items
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
