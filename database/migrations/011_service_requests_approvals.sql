-- ============================================================================
-- CALIBRATION COMMERCIAL MODULE (CCM) - STEP 10 MIGRATION
-- Table Schemas: service_requests, service_approvals
-- PostgreSQL Row Level Security (RLS) & Performance Indexes
-- ============================================================================

-- 1. SERVICE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    calibration_id UUID NOT NULL REFERENCES calibrations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    service_status VARCHAR NOT NULL DEFAULT 'SERVICE_REQUIRED' CHECK (service_status IN ('SERVICE_REQUIRED', 'AWAITING_CLIENT_APPROVAL', 'APPROVED', 'REJECTED', 'IN_SERVICE', 'SERVICE_COMPLETED', 'CANCELLED')),
    fault_description TEXT NOT NULL,
    service_required BOOLEAN NOT NULL DEFAULT TRUE,
    estimated_service_cost NUMERIC NULL,
    service_remarks TEXT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    started_by UUID REFERENCES users(id) NULL,
    started_at TIMESTAMPTZ NULL,
    completed_by UUID REFERENCES users(id) NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SERVICE APPROVALS TABLE
CREATE TABLE IF NOT EXISTS service_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    approval_status VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by_client_name VARCHAR NULL,
    approved_by_client_role VARCHAR NULL,
    approval_remarks TEXT NULL,
    approval_reference VARCHAR NULL,
    approved_at TIMESTAMPTZ NULL,
    rejected_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DATABASE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_req ON service_requests(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_req_item ON service_requests(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_cal ON service_requests(tenant_id, calibration_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_client ON service_requests(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_status ON service_requests(tenant_id, service_status);

CREATE INDEX IF NOT EXISTS idx_service_approvals_tenant_req ON service_approvals(tenant_id, service_request_id);
CREATE INDEX IF NOT EXISTS idx_service_approvals_tenant_status ON service_approvals(tenant_id, approval_status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_approvals ENABLE ROW LEVEL SECURITY;

-- Service Requests RLS
CREATE POLICY service_requests_tenant_isolation ON service_requests
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_super_admin())
    WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- Service Approvals RLS
CREATE POLICY service_approvals_tenant_isolation ON service_approvals
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_super_admin())
    WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
