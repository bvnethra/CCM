-- Migration 012: Vendor Outsourcing Workflow & Purchase Orders
-- Enables vendor outsourcing for calibration items, vendor selection, PO generation, shipment tracking, vendor certificate recording, and main flow reintegration.

-- 1. Create Outsource Status Enum (if not using VARCHAR)
-- Statuses: OUTSOURCE_REQUIRED, VENDOR_SELECTED, PO_DRAFT, PO_ISSUED, SENT_TO_VENDOR, VENDOR_RECEIVED, VENDOR_CALIBRATION, VENDOR_COMPLETED, AWAITING_RETURN, RETURNED, RECEIVED_BACK, REINTEGRATED, VENDOR_FAILED, CANCELLED

-- 2. Create vendor_outsource_requests table
CREATE TABLE IF NOT EXISTS vendor_outsource_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES sub_organizations(id) ON DELETE SET NULL,
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    calibration_id UUID REFERENCES calibrations(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    
    outsource_status VARCHAR(50) NOT NULL DEFAULT 'OUTSOURCE_REQUIRED',
    outsource_reason TEXT NOT NULL,
    vendor_reference VARCHAR(100),
    expected_return_date DATE,
    
    created_by UUID NOT NULL REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    returned_at TIMESTAMPTZ,
    received_by UUID REFERENCES public.user_profiles(id),
    remarks TEXT
);

-- Index for unique active outsourcing per request_item
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_vendor_outsource_item 
ON vendor_outsource_requests (tenant_id, request_item_id) 
WHERE outsource_status NOT IN ('REINTEGRATED', 'CANCELLED');

CREATE INDEX IF NOT EXISTS idx_vendor_outsource_tenant_status ON vendor_outsource_requests (tenant_id, outsource_status);
CREATE INDEX IF NOT EXISTS idx_vendor_outsource_vendor ON vendor_outsource_requests (tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_outsource_request ON vendor_outsource_requests (tenant_id, request_id);

-- 3. Create purchase_orders table (Specifically for Vendor Outsourcing POs)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    sub_org_id UUID REFERENCES sub_organizations(id) ON DELETE SET NULL,
    
    po_number VARCHAR(50) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    request_id UUID REFERENCES calibration_requests(id) ON DELETE CASCADE,
    outsource_request_id UUID REFERENCES vendor_outsource_requests(id) ON DELETE CASCADE,
    
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    
    created_by UUID NOT NULL REFERENCES public.user_profiles(id),
    issued_by UUID REFERENCES public.user_profiles(id),
    issued_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks TEXT,
    
    CONSTRAINT uq_po_number_tenant UNIQUE (tenant_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_po_tenant_status ON purchase_orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders (tenant_id, vendor_id);

-- 4. Create po_items table
CREATE TABLE IF NOT EXISTS po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES item_masters(id) ON DELETE RESTRICT,
    
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON po_items (tenant_id, purchase_order_id);

-- 5. Create vendor_outsource_movements table (Physical Shipment Traceability)
CREATE TABLE IF NOT EXISTS vendor_outsource_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outsource_request_id UUID NOT NULL REFERENCES vendor_outsource_requests(id) ON DELETE CASCADE,
    
    movement_type VARCHAR(40) NOT NULL, -- SEND_TO_VENDOR, RETURN_FROM_VENDOR
    tracking_number VARCHAR(100),
    carrier VARCHAR(100),
    
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    performed_by UUID NOT NULL REFERENCES public.user_profiles(id),
    
    remarks TEXT,
    document_id UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_outsource ON vendor_outsource_movements (tenant_id, outsource_request_id);

-- 6. Create vendor_calibration_records table (External Calibration Event Record)
CREATE TABLE IF NOT EXISTS vendor_calibration_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outsource_request_id UUID NOT NULL REFERENCES vendor_outsource_requests(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    
    vendor_certificate_number VARCHAR(100) NOT NULL,
    vendor_result VARCHAR(30) NOT NULL, -- PASS, FAIL, ADJUSTED, NOT_CALIBRATABLE
    
    calibrated_at DATE,
    report_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    report_document_id UUID,
    remarks TEXT,
    
    created_by UUID NOT NULL REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_cal_records_outsource ON vendor_calibration_records (tenant_id, outsource_request_id);

-- 7. Enable RLS and create isolation policies
ALTER TABLE vendor_outsource_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_outsource_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_calibration_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendor_outsource_requests
CREATE POLICY tenant_isolation_vendor_outsource ON vendor_outsource_requests
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- RLS Policies for purchase_orders
CREATE POLICY tenant_isolation_purchase_orders ON purchase_orders
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- RLS Policies for po_items
CREATE POLICY tenant_isolation_po_items ON po_items
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- RLS Policies for vendor_outsource_movements
CREATE POLICY tenant_isolation_vendor_movements ON vendor_outsource_movements
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- RLS Policies for vendor_calibration_records
CREATE POLICY tenant_isolation_vendor_cal_records ON vendor_calibration_records
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
