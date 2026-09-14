-- Migration: 015_invoice_signatures.sql
-- Description: Client Digital Signature schema for commercial invoices (Step 14)

-- Table: signatures
CREATE TABLE IF NOT EXISTS signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    sub_org_id UUID,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN ('INVOICE', 'DELIVERY')),
    signature_status VARCHAR(50) NOT NULL CHECK (signature_status IN ('PENDING', 'SIGNED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    signer_name VARCHAR(255) NOT NULL,
    signer_role VARCHAR(255),
    signer_email VARCHAR(255),
    signer_phone VARCHAR(50),
    signature_reference VARCHAR(100) NOT NULL,
    signed_at TIMESTAMPTZ,
    signature_storage_reference TEXT,
    document_id UUID,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: invoice_signature_requests
CREATE TABLE IF NOT EXISTS invoice_signature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    sub_org_id UUID,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    request_reference VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'OPENED', 'SIGNED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID,
    signer_name VARCHAR(255),
    signer_role VARCHAR(255),
    signer_email VARCHAR(255),
    signer_phone VARCHAR(50),
    rejection_reason TEXT,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tenant_request_ref UNIQUE (tenant_id, request_reference)
);

-- Indexes for performance & query isolation
CREATE INDEX IF NOT EXISTS idx_signatures_tenant ON signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_org ON signatures(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_suborg ON signatures(tenant_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_invoice ON signatures(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_client ON signatures(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_status ON signatures(tenant_id, signature_status);
CREATE INDEX IF NOT EXISTS idx_signatures_tenant_created ON signatures(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sig_req_tenant ON invoice_signature_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_org ON invoice_signature_requests(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_suborg ON invoice_signature_requests(tenant_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_invoice ON invoice_signature_requests(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_client ON invoice_signature_requests(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_status ON invoice_signature_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_created ON invoice_signature_requests(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_expires ON invoice_signature_requests(tenant_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sig_req_tenant_ref ON invoice_signature_requests(tenant_id, request_reference);

-- Enable RLS
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_signature_requests ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policies
CREATE POLICY signatures_tenant_isolation ON signatures
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY sig_requests_tenant_isolation ON invoice_signature_requests
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);
