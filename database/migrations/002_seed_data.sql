-- ==============================================================================
-- Calibration Commercial Module (CCM) - Step 1: Multi-Tenant Seed Data
-- ==============================================================================

-- 1. SEED TENANTS
INSERT INTO public.tenants (id, name, code, status, settings)
VALUES
    ('11111111-1111-4111-a111-111111111111', 'Acme Calibration Labs', 'ACME-CAL', 'active', '{"timezone": "UTC", "currency": "USD", "complianceStandard": "ISO/IEC 17025"}'::jsonb),
    ('22222222-2222-4222-a222-222222222222', 'Apex Metrology Group', 'APEX-MET', 'active', '{"timezone": "America/New_York", "currency": "USD", "complianceStandard": "ANSI/NCSL Z540.3"}'::jsonb),
    ('33333333-3333-4333-a333-333333333333', 'Vortex Precision Testing', 'VORTEX-PT', 'inactive', '{"timezone": "Europe/London", "currency": "GBP", "complianceStandard": "UKAS LAB 12"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 2. ORGANIZATIONS & SUB-ORGANIZATIONS (Cleared - No default records)

-- 4. INITIAL AUDIT LOGS
INSERT INTO public.audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, new_values, ip_address)
VALUES
    (gen_random_uuid(), '11111111-1111-4111-a111-111111111111', NULL, 'SEED_PROVISION', 'tenant', '11111111-1111-4111-a111-111111111111', '{"name": "Acme Calibration Labs", "code": "ACME-CAL"}'::jsonb, '127.0.0.1'),
    (gen_random_uuid(), '22222222-2222-4222-a222-222222222222', NULL, 'SEED_PROVISION', 'tenant', '22222222-2222-4222-a222-222222222222', '{"name": "Apex Metrology Group", "code": "APEX-MET"}'::jsonb, '127.0.0.1');
