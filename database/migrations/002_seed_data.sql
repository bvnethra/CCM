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

-- 2. SEED ORGANIZATIONS (Tenant 1: Acme Calibration Labs)
INSERT INTO public.organizations (id, tenant_id, name, code, status)
VALUES
    ('aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa', '11111111-1111-4111-a111-111111111111', 'Acme Aerospace Division', 'ACME-AERO', 'active'),
    ('bbbbbbbb-1111-4bbb-bbbb-bbbbbbbbbbbb', '11111111-1111-4111-a111-111111111111', 'Acme Medical & Bio Calibration', 'ACME-MED', 'active')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 2.1 SEED ORGANIZATIONS (Tenant 2: Apex Metrology Group)
INSERT INTO public.organizations (id, tenant_id, name, code, status)
VALUES
    ('cccccccc-2222-4ccc-cccc-cccccccccccc', '22222222-2222-4222-a222-222222222222', 'Apex Industrial Metrology', 'APEX-IND', 'active'),
    ('dddddddd-2222-4ddd-dddd-dddddddddddd', '22222222-2222-4222-a222-222222222222', 'Apex Cleanroom & Environmental', 'APEX-ENV', 'active')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 3. SEED SUB-ORGANIZATIONS (Child of Acme Aerospace Division)
INSERT INTO public.sub_organizations (id, tenant_id, organization_id, name, code, status)
VALUES
    ('sub11111-aaaa-4111-aaaa-111111111111', '11111111-1111-4111-a111-111111111111', 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa', 'Pressure & Vacuum Testing Lab', 'ACME-AERO-PVT', 'active'),
    ('sub11112-aaaa-4111-aaaa-111111111112', '11111111-1111-4111-a111-111111111111', 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa', 'Avionics & RF Standard Lab', 'ACME-AERO-RF', 'active')
ON CONFLICT (organization_id, code) DO NOTHING;

-- 3.1 SEED SUB-ORGANIZATIONS (Child of Acme Medical)
INSERT INTO public.sub_organizations (id, tenant_id, organization_id, name, code, status)
VALUES
    ('sub11113-bbbb-4111-bbbb-111111111113', '11111111-1111-4111-a111-111111111111', 'bbbbbbbb-1111-4bbb-bbbb-bbbbbbbbbbbb', 'Biomedical Sensor Diagnostic Unit', 'ACME-MED-BSD', 'active')
ON CONFLICT (organization_id, code) DO NOTHING;

-- 3.2 SEED SUB-ORGANIZATIONS (Child of Apex Industrial)
INSERT INTO public.sub_organizations (id, tenant_id, organization_id, name, code, status)
VALUES
    ('sub22221-cccc-4222-cccc-222222222221', '22222222-2222-4222-a222-222222222222', 'cccccccc-2222-4ccc-cccc-cccccccccccc', 'Dimensional Metrology & CMM', 'APEX-IND-CMM', 'active'),
    ('sub22222-cccc-4222-cccc-222222222222', '22222222-2222-4222-a222-222222222222', 'cccccccc-2222-4ccc-cccc-cccccccccccc', 'Torque & Force Standards Lab', 'APEX-IND-TF', 'active')
ON CONFLICT (organization_id, code) DO NOTHING;

-- 4. INITIAL AUDIT LOGS
INSERT INTO public.audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, new_values, ip_address)
VALUES
    (gen_random_uuid(), '11111111-1111-4111-a111-111111111111', NULL, 'SEED_PROVISION', 'tenant', '11111111-1111-4111-a111-111111111111', '{"name": "Acme Calibration Labs", "code": "ACME-CAL"}'::jsonb, '127.0.0.1'),
    (gen_random_uuid(), '22222222-2222-4222-a222-222222222222', NULL, 'SEED_PROVISION', 'tenant', '22222222-2222-4222-a222-222222222222', '{"name": "Apex Metrology Group", "code": "APEX-MET"}'::jsonb, '127.0.0.1');
