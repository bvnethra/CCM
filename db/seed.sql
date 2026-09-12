-- ============================================================================
-- CALIBRATION COMMERCIAL MANAGEMENT SYSTEM DEMO SEED DATA
-- ============================================================================

-- TENANTS
INSERT INTO tenants (id, code, name, status) VALUES
('a0000000-0000-0000-0000-000000000001', 'TENANT-ALPHA', 'Alpha Metrology Solutions Ltd.', 'ACTIVE'),
('a0000000-0000-0000-0000-000000000002', 'TENANT-BETA', 'Beta Precision Calibrations Inc.', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- ORGANIZATIONS
INSERT INTO organizations (id, tenant_id, code, name) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ORG-HQ-01', 'Alpha Industrial Calibration HQ'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'ORG-WEST-02', 'Alpha West Coast Testing Lab'),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'ORG-BETA-01', 'Beta Testing Facilities')
ON CONFLICT (id) DO NOTHING;

-- SUB ORGANIZATIONS
INSERT INTO sub_organizations (id, tenant_id, organization_id, code, name) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'SUB-DIM-01', 'Dimensional Calibration Dept'),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'SUB-ELEC-02', 'Electrical & Thermal Lab')
ON CONFLICT (id) DO NOTHING;

-- USERS
INSERT INTO users (id, tenant_id, organization_id, sub_org_id, email, full_name, status) VALUES
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'admin@alphametrology.com', 'System Admin', 'ACTIVE'),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'agent.smith@alphametrology.com', 'Agent Agent Smith (Collection)', 'ACTIVE'),
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'tech.john@alphametrology.com', 'John Doe (Lead Technician)', 'ACTIVE'),
('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'comm.jane@alphametrology.com', 'Jane Commercial Manager', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- PERMISSIONS
INSERT INTO permissions (code, description, module) VALUES
('client.view', 'View client records', 'Client'),
('client.create', 'Create client records', 'Client'),
('client.update', 'Update client records', 'Client'),
('client.delete', 'Delete client records', 'Client'),
('vendor.view', 'View vendor records', 'Vendor'),
('vendor.create', 'Create vendor records', 'Vendor'),
('vendor.update', 'Update vendor records', 'Vendor'),
('item.view', 'View item master', 'Item'),
('item.create', 'Create item master', 'Item'),
('request.create', 'Create calibration request', 'Collection'),
('request.view', 'View requests', 'Collection'),
('request.update', 'Update requests', 'Collection'),
('request.verify', 'Verify items in lab queue', 'Lab'),
('calibration.create', 'Perform calibration', 'Calibration'),
('calibration.update', 'Update calibration results', 'Calibration'),
('quotation.create', 'Create commercial quotation', 'Commercial'),
('quotation.approve', 'Approve commercial quotation', 'Commercial'),
('invoice.create', 'Create commercial invoice', 'Commercial'),
('invoice.view', 'View invoices', 'Commercial'),
('dispatch.create', 'Create dispatch order', 'Dispatch'),
('delivery.confirm', 'Confirm item delivery', 'Delivery'),
('signature.capture', 'Capture digital signatures', 'Execution'),
('audit.view', 'View system audit log', 'Audit')
ON CONFLICT (code) DO NOTHING;

-- CLIENTS
INSERT INTO clients (id, tenant_id, organization_id, sub_org_id, client_code, client_name, address, billing_address, gst_tax_info, contact_person, phone, email, status) VALUES
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'CLI-1001', 'Apex Manufacturing Corp', '124 Industrial Parkway, Bldg 4, Sector 12', '124 Industrial Parkway, HQ Suite', '27AAACA1234A1Z5', 'Robert Vance', '+1 555-0192', 'r.vance@apexmanufacturing.com', 'ACTIVE'),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'CLI-1002', 'Precision Aerospace Dynamics', '89 Tech Park Blvd, Wing A', '89 Tech Park Blvd, Wing A', '27BBBCB5678B1Z2', 'Sarah Jenkins', '+1 555-0482', 's.jenkins@padynamics.com', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- VENDORS
INSERT INTO vendors (id, tenant_id, organization_id, sub_org_id, vendor_code, vendor_name, address, gst_tax_info, contact_person, phone, email, serviced_categories, status) VALUES
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'VEN-2001', 'National Metrology Standards Lab', '77 National Highway, Block C', '27VEN9999123Z', 'Dr. Aris Thorne', '+1 555-9081', 'support@nationalmetrology.org', ARRAY['High Voltage', 'Laser Optics'], 'ACTIVE'),
('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'VEN-2002', 'Precision Repair Services Inc', '405 Repair Ave, Zone 3', '27REPAIR888Z', 'Mike Miller', '+1 555-3321', 'mike@precisionrepair.com', ARRAY['Dimensional Service', 'Pressure Gauge Overhaul'], 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- ITEM MASTERS
INSERT INTO item_masters (id, tenant_id, organization_id, sub_org_id, client_id, item_code, item_name, item_type, manufacturer, model, serial_number, measurement_range, least_count, standard_cost, calibration_frequency_months, status) VALUES
('g0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'ITM-001', 'Digital Vernier Caliper 200mm', 'Dimensional', 'Mitutoyo', '500-196-30', 'SN-MIT-99120', '0 - 200 mm', '0.01 mm', 150.00, 12, 'ACTIVE'),
('g0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'ITM-002', 'Digital Multimeter 6.5 Digit', 'Electrical', 'Fluke', '8846A', 'SN-FLK-44321', '0 - 1000V DC', '0.0001V', 450.00, 12, 'ACTIVE'),
('g0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'ITM-003', 'Pressure Transmitter 0-100 Bar', 'Pressure', 'WIKA', 'A-10', 'SN-WIK-88712', '0 - 100 Bar', '0.1 Bar', 300.00, 6, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- CALIBRATION REQUESTS
INSERT INTO calibration_requests (id, tenant_id, organization_id, sub_org_id, request_number, client_id, collection_agent_id, collection_date, priority, status, remarks) VALUES
('r0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'REQ-2026-001', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '2026-09-10', 'HIGH', 'INVOICE_PO', 'Urgent batch calibration for quarterly audit'),
('r0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'REQ-2026-002', 'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', '2026-09-11', 'NORMAL', 'LAB_QUEUE', 'Regular routine maintenance')
ON CONFLICT (id) DO NOTHING;

-- REQUEST ITEMS
INSERT INTO request_items (id, tenant_id, organization_id, sub_org_id, request_id, item_id, quantity, status, priority, is_faulty, is_outsourced) VALUES
('i0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', 1, 'CALIBRATED', 'HIGH', FALSE, FALSE),
('i0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000002', 1, 'FAULTY', 'HIGH', TRUE, FALSE),
('i0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000003', 1, 'OUTSOURCED', 'NORMAL', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- VERIFICATIONS
INSERT INTO verifications (id, tenant_id, organization_id, sub_org_id, request_id, request_item_id, verifier_id, outcome, physical_match, condition_notes) VALUES
('v0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'i0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'VERIFIED', TRUE, 'All physical dimensions and serial numbers match specification sheet')
ON CONFLICT (id) DO NOTHING;

-- CALIBRATIONS
INSERT INTO calibrations (id, tenant_id, organization_id, sub_org_id, request_id, request_item_id, technician_id, calibration_date, standard_used, measurement_results, result_status, calibration_frequency_months, next_due_date, remarks) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'i0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', '2026-09-12', 'Gauge Block Set Class 0 (SN-GB-992)', '{"points": [{"nominal": 10.0, "actual": 10.001, "error": 0.001}, {"nominal": 50.0, "actual": 50.002, "error": 0.002}, {"nominal": 100.0, "actual": 100.002, "error": 0.002}]}', 'PASS', 12, '2027-09-12', 'Calibrated within acceptable ISO/IEC 17025 tolerance limits')
ON CONFLICT (id) DO NOTHING;

-- CERTIFICATES
INSERT INTO certificates (id, tenant_id, organization_id, sub_org_id, calibration_id, certificate_number, issue_date, storage_reference) VALUES
('cert-0000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'CERT-2026-9901', '2026-09-12', 'r2://certificates/2026/CERT-2026-9901.pdf')
ON CONFLICT (id) DO NOTHING;

-- QUOTATIONS
INSERT INTO quotations (id, tenant_id, organization_id, sub_org_id, quotation_number, request_id, client_id, subtotal, tax_amount, discount_amount, total_amount, terms, status, created_by) VALUES
('q0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'QUO-2026-8801', 'r0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 900.00, 162.00, 50.00, 1012.00, 'Net 30 Days. Calibration certificates delivered upon payment confirmation.', 'APPROVED', 'd0000000-0000-0000-0000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- INVOICES
INSERT INTO invoices (id, tenant_id, organization_id, sub_org_id, invoice_number, request_id, client_id, invoice_date, subtotal, tax_amount, discount_amount, total_amount, payment_status, is_partial_processing, created_by) VALUES
('inv00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'INV-2026-7701', 'r0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2026-09-12', 900.00, 162.00, 50.00, 1012.00, 'UNPAID', TRUE, 'd0000000-0000-0000-0000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- AUDIT LOGS
INSERT INTO audit_logs (id, tenant_id, organization_id, sub_org_id, user_id, action, entity_type, entity_id, request_reference, old_value, new_value) VALUES
('aud00000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'QUOTATION_APPROVED', 'quotation', 'q0000000-0000-0000-0000-000000000001', 'REQ-2026-001', '{"status": "PENDING"}', '{"status": "APPROVED"}')
ON CONFLICT (id) DO NOTHING;
