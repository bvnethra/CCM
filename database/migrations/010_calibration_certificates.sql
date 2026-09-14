-- ============================================================================
-- CALIBRATION COMMERCIAL MODULE (CCM) - STEP 9 MIGRATION
-- Table Schemas: calibrations, calibration_measurements, certificates
-- PostgreSQL Row Level Security (RLS) & Performance Indexes
-- ============================================================================

-- 1. CALIBRATIONS TABLE
CREATE TABLE IF NOT EXISTS calibrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES item_masters(id) ON DELETE CASCADE,
    calibrated_by UUID NOT NULL REFERENCES public.user_profiles(id),
    calibration_started_at TIMESTAMPTZ DEFAULT NOW(),
    calibration_completed_at TIMESTAMPTZ NULL,
    calibration_method TEXT NULL,
    environmental_conditions TEXT NULL,
    result VARCHAR NOT NULL CHECK (result IN ('PASS', 'FAIL', 'ADJUSTED', 'NOT_CALIBRATABLE')),
    remarks TEXT NULL,
    status VARCHAR NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NOT_CALIBRATABLE')),
    calibration_date DATE NULL,
    next_due_date DATE NULL,
    calibration_frequency INTEGER NULL,
    calibration_frequency_unit VARCHAR NULL CHECK (calibration_frequency_unit IN ('MONTHS', 'YEARS', 'DAYS') OR calibration_frequency_unit IS NULL),
    frequency_override BOOLEAN DEFAULT FALSE,
    frequency_override_reason TEXT NULL,
    frequency_overridden_by UUID REFERENCES public.user_profiles(id) NULL,
    frequency_overridden_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_calibrations_tenant_request_item UNIQUE (tenant_id, request_item_id)
);

-- 2. CALIBRATION MEASUREMENTS TABLE
CREATE TABLE IF NOT EXISTS calibration_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    calibration_id UUID NOT NULL REFERENCES calibrations(id) ON DELETE CASCADE,
    measurement_point VARCHAR NOT NULL,
    nominal_value NUMERIC NULL,
    observed_value NUMERIC NULL,
    unit VARCHAR NULL,
    tolerance_min NUMERIC NULL,
    tolerance_max NUMERIC NULL,
    error_value NUMERIC NULL,
    measurement_result VARCHAR NOT NULL CHECK (measurement_result IN ('PASS', 'FAIL', 'NOT_TESTED')),
    remarks TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CERTIFICATES TABLE
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES calibration_requests(id) ON DELETE CASCADE,
    request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    calibration_id UUID NOT NULL REFERENCES calibrations(id) ON DELETE CASCADE,
    certificate_number VARCHAR NOT NULL,
    document_type VARCHAR NOT NULL DEFAULT 'CALIBRATION_CERTIFICATE',
    file_name VARCHAR NOT NULL,
    storage_reference TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    generated_by UUID NOT NULL REFERENCES public.user_profiles(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_certificates_tenant_cert_version UNIQUE (tenant_id, certificate_number, version)
);

-- ============================================================================
-- DATABASE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_req ON calibrations(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_req_item ON calibrations(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_item ON calibrations(tenant_id, item_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_result ON calibrations(tenant_id, result);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_completed ON calibrations(tenant_id, calibration_completed_at);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant_next_due ON calibrations(tenant_id, next_due_date);

CREATE INDEX IF NOT EXISTS idx_calibration_measurements_tenant_cal ON calibration_measurements(tenant_id, calibration_id);

CREATE INDEX IF NOT EXISTS idx_certificates_tenant_cal ON certificates(tenant_id, calibration_id);
CREATE INDEX IF NOT EXISTS idx_certificates_tenant_req_item ON certificates(tenant_id, request_item_id);
CREATE INDEX IF NOT EXISTS idx_certificates_tenant_cert_num ON certificates(tenant_id, certificate_number);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Calibrations RLS
CREATE POLICY calibrations_tenant_isolation ON calibrations
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_super_admin())
    WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- Calibration Measurements RLS
CREATE POLICY calibration_measurements_tenant_isolation ON calibration_measurements
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_super_admin())
    WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- Certificates RLS
CREATE POLICY certificates_tenant_isolation ON certificates
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_super_admin())
    WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
