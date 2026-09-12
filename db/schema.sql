-- ============================================================================
-- CALIBRATION COMMERCIAL MANAGEMENT SYSTEM DATABASE SCHEMA
-- Multi-Tenant PostgreSQL Schema with RLS, Indexes, & Audit Logs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- ENUMS & TYPES
-- ----------------------------------------------------------------------------
CREATE TYPE request_status AS ENUM (
    'CREATED',
    'COLLECTED',
    'LAB_QUEUE',
    'VERIFICATION',
    'CALIBRATION',
    'CALIBRATED',
    'QUOTATION',
    'APPROVAL',
    'INVOICE_PO',
    'CLIENT_SIGN',
    'READY_TO_DISPATCH',
    'DISPATCHED',
    'CLIENT_RECEIVED',
    'DELIVERY_SIGNED',
    'COMPLETED',
    'ON_HOLD',
    'DISCREPANCY',
    'FAULTY',
    'OUTSOURCED',
    'PARTIALLY_COMPLETED',
    'REJECTED',
    'CANCELLED'
);

CREATE TYPE item_verification_outcome AS ENUM (
    'VERIFIED',
    'DISCREPANCY',
    'SHORT',
    'OTHER_EXCEPTION'
);

CREATE TYPE calibration_result_status AS ENUM (
    'PASS',
    'FAIL',
    'FAULTY',
    'OUTSOURCE'
);

CREATE TYPE signature_type AS ENUM (
    'INVOICE_APPROVAL',
    'DELIVERY_RECEIPT'
);

-- ----------------------------------------------------------------------------
-- 1. TENANCY & ORGANIZATIONAL HIERARCHY
-- ----------------------------------------------------------------------------
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE sub_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sub_org_code UNIQUE (organization_id, code)
);

-- ----------------------------------------------------------------------------
-- 2. SECURITY & RBAC
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    module VARCHAR(50) NOT NULL
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ----------------------------------------------------------------------------
-- 3. MASTER DATA
-- ----------------------------------------------------------------------------
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    client_code VARCHAR(50) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    billing_address TEXT NOT NULL,
    gst_tax_info VARCHAR(100),
    contact_person VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_client_tenant_code UNIQUE (tenant_id, client_code)
);

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    vendor_code VARCHAR(50) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    gst_tax_info VARCHAR(100),
    contact_person VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    serviced_categories TEXT[],
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendor_tenant_code UNIQUE (tenant_id, vendor_code)
);

CREATE TABLE item_masters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    client_id UUID REFERENCES clients(id),
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(150),
    model VARCHAR(100),
    serial_number VARCHAR(100) NOT NULL,
    measurement_range VARCHAR(100),
    least_count VARCHAR(50),
    standard_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    calibration_frequency_months INT NOT NULL DEFAULT 12,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_item_tenant_code UNIQUE (tenant_id, item_code)
);

-- ----------------------------------------------------------------------------
-- 4. COLLECTION & REQUESTS
-- ----------------------------------------------------------------------------
CREATE TABLE calibration_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    request_number VARCHAR(50) NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id),
    collection_agent_id UUID NOT NULL REFERENCES users(id),
    collection_date DATE NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL', -- NORMAL, HIGH, URGENT
    status request_status NOT NULL DEFAULT 'CREATED',
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_request_tenant_num UNIQUE (tenant_id, request_number)
);

CREATE TABLE request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES item_masters(id),
    quantity INT NOT NULL DEFAULT 1,
    status request_status NOT NULL DEFAULT 'CREATED',
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    is_faulty BOOLEAN NOT NULL DEFAULT FALSE,
    is_outsourced BOOLEAN NOT NULL DEFAULT FALSE,
    outsource_vendor_id UUID REFERENCES vendors(id),
    service_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. VERIFICATIONS & DOCUMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    verifier_id UUID NOT NULL REFERENCES users(id),
    outcome item_verification_outcome NOT NULL DEFAULT 'VERIFIED',
    physical_match BOOLEAN NOT NULL DEFAULT TRUE,
    condition_notes TEXT,
    discrepancy_details TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    request_id UUID REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID REFERENCES request_items(id) ON DELETE SET NULL,
    document_type VARCHAR(100) NOT NULL, -- Collection Proof, Receipt Proof, Certificate, PO, Invoice, etc.
    file_name VARCHAR(255) NOT NULL,
    storage_reference VARCHAR(500) NOT NULL, -- Cloudflare R2 key
    mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    version INT NOT NULL DEFAULT 1,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. CALIBRATION & CERTIFICATES
-- ----------------------------------------------------------------------------
CREATE TABLE calibrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES users(id),
    calibration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    standard_used VARCHAR(255) NOT NULL,
    measurement_results JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_status calibration_result_status NOT NULL DEFAULT 'PASS',
    calibration_frequency_months INT NOT NULL DEFAULT 12,
    next_due_date DATE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    calibration_id UUID NOT NULL REFERENCES calibrations(id) ON DELETE CASCADE,
    certificate_number VARCHAR(100) NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    storage_reference VARCHAR(500), -- Cloudflare R2 path to PDF
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cert_tenant_num UNIQUE (tenant_id, certificate_number)
);

-- ----------------------------------------------------------------------------
-- 7. COMMERCIAL (QUOTATIONS, POs, INVOICES)
-- ----------------------------------------------------------------------------
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    quotation_number VARCHAR(50) NOT NULL,
    request_id UUID REFERENCES calibration_requests(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES clients(id),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    terms TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, REVISED
    cost_override_reason TEXT,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_quotation_tenant_num UNIQUE (tenant_id, quotation_number)
);

CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    request_item_id UUID REFERENCES request_items(id),
    description VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL,
    is_override BOOLEAN NOT NULL DEFAULT FALSE,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    line_total NUMERIC(12, 2) NOT NULL
);

CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL, -- APPROVED, REJECTED
    comments TEXT,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    po_number VARCHAR(50) NOT NULL,
    request_id UUID REFERENCES calibration_requests(id),
    vendor_id UUID REFERENCES vendors(id),
    client_id UUID REFERENCES clients(id),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_po_tenant_num UNIQUE (tenant_id, po_number)
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    invoice_number VARCHAR(50) NOT NULL,
    request_id UUID REFERENCES calibration_requests(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIAL, PAID
    is_partial_processing BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_invoice_tenant_num UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    request_item_id UUID REFERENCES request_items(id),
    description VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) NOT NULL,
    line_total NUMERIC(12, 2) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 8. EXECUTION (SIGNATURES, DISPATCHES, DELIVERIES)
-- ----------------------------------------------------------------------------
CREATE TABLE signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    signature_type signature_type NOT NULL,
    signer_name VARCHAR(150) NOT NULL,
    signer_email VARCHAR(255),
    signature_data TEXT NOT NULL, -- Base64 SVG/PNG or Storage ref
    ip_address VARCHAR(45),
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dispatches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    dispatch_number VARCHAR(50) NOT NULL,
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id),
    dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    courier_name VARCHAR(150) NOT NULL,
    tracking_number VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DISPATCHED',
    dispatch_proof_ref VARCHAR(500),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dispatch_tenant_num UNIQUE (tenant_id, dispatch_number)
);

CREATE TABLE dispatch_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id),
    quantity INT NOT NULL DEFAULT 1
);

CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by VARCHAR(150) NOT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'DELIVERED',
    delivery_proof_ref VARCHAR(500),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. AUDIT TRAIL
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    sub_org_id UUID REFERENCES sub_organizations(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_reference VARCHAR(100)
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR FAST MULTI-TENANT QUERIES & DUE LISTS
-- ----------------------------------------------------------------------------
CREATE INDEX idx_clients_tenant_org ON clients(tenant_id, organization_id, sub_org_id);
CREATE INDEX idx_vendors_tenant_org ON vendors(tenant_id, organization_id, sub_org_id);
CREATE INDEX idx_items_tenant_code_sn ON item_masters(tenant_id, item_code, serial_number);
CREATE INDEX idx_requests_tenant_status ON calibration_requests(tenant_id, status);
CREATE INDEX idx_requests_client ON calibration_requests(tenant_id, client_id);
CREATE INDEX idx_req_items_status ON request_items(tenant_id, status);
CREATE INDEX idx_calibrations_due_date ON calibrations(tenant_id, next_due_date);
CREATE INDEX idx_quotations_tenant ON quotations(tenant_id, quotation_number);
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id, invoice_number);
CREATE INDEX idx_dispatches_tenant ON dispatches(tenant_id, dispatch_number);
CREATE INDEX idx_audit_tenant_entity ON audit_logs(tenant_id, entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Dynamic tenant setting based policy template
CREATE POLICY tenant_isolation_clients ON clients
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_vendors ON vendors
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_items ON item_masters
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_requests ON calibration_requests
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_calibrations ON calibrations
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_quotations ON quotations
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_invoices ON invoices
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_audit ON audit_logs
    FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
