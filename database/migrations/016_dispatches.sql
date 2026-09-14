-- Migration: 016_dispatches.sql
-- Description: Dispatch, Carrier Tracking, and Client Delivery schema (Step 15)

-- Table: dispatches
CREATE TABLE IF NOT EXISTS dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    organization_id UUID,
    sub_org_id UUID,
    dispatch_number VARCHAR(100) NOT NULL,
    request_id UUID NOT NULL REFERENCES calibration_requests(id),
    invoice_id UUID REFERENCES invoices(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    dispatch_type VARCHAR(50) NOT NULL CHECK (dispatch_type IN ('STANDARD', 'PARTIAL', 'URGENT')),
    status VARCHAR(50) NOT NULL DEFAULT 'READY_FOR_DISPATCH' CHECK (status IN ('READY_FOR_DISPATCH', 'PACKING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
    dispatch_date DATE NOT NULL,
    expected_delivery_date DATE,
    carrier_name VARCHAR(255),
    tracking_number VARCHAR(255),
    shipping_address TEXT NOT NULL,
    billing_address TEXT,
    urgent_reason TEXT,
    created_by UUID,
    dispatched_by UUID,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    remarks TEXT,
    CONSTRAINT uq_tenant_dispatch_no UNIQUE (tenant_id, dispatch_number)
);

-- Table: dispatch_items
CREATE TABLE IF NOT EXISTS dispatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL,
    item_id UUID NOT NULL,
    invoice_id UUID,
    invoice_item_id UUID,
    quantity INT NOT NULL DEFAULT 1,
    package_reference VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tenant_dispatch_req_item UNIQUE (tenant_id, request_item_id)
);

-- Table: deliveries
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id),
    recipient_name VARCHAR(255) NOT NULL,
    recipient_role VARCHAR(255),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    delivery_date TIMESTAMPTZ NOT NULL,
    delivery_status VARCHAR(50) NOT NULL CHECK (delivery_status IN ('DELIVERED', 'PARTIALLY_DELIVERED', 'REJECTED', 'RETURNED')),
    proof_of_delivery_storage_ref TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance & tenant isolation
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant ON dispatches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_org ON dispatches(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_suborg ON dispatches(tenant_id, sub_org_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_req ON dispatches(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_inv ON dispatches(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_client ON dispatches(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_status ON dispatches(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_created ON dispatches(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dispatches_tenant_num ON dispatches(tenant_id, dispatch_number);

CREATE INDEX IF NOT EXISTS idx_disp_items_tenant ON dispatch_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_disp_items_tenant_disp ON dispatch_items(tenant_id, dispatch_id);
CREATE INDEX IF NOT EXISTS idx_disp_items_tenant_req_item ON dispatch_items(tenant_id, request_item_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_tenant ON deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_disp ON deliveries(tenant_id, dispatch_id);

-- Enable RLS
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policies
CREATE POLICY dispatches_tenant_isolation ON dispatches
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY dispatch_items_tenant_isolation ON dispatch_items
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY deliveries_tenant_isolation ON deliveries
    FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);
