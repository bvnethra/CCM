# Calibration Commercial Module (CCM) — Database Architecture & RLS Documentation

## Overview

The **Calibration Commercial Module (CCM)** uses PostgreSQL hosted on **Supabase** with multi-tenant row-level security (RLS) policies. Every business entity table is partitioned by `tenant_id` (`UUID`) to guarantee strict cryptographic tenant isolation.

---

## Schema Architecture & Entity Relationship Summary

### Core Foundation & Tenancy
- `tenants` — Global tenant registry (`id`, `name`, `code`, `status`, `settings`).
- `organizations` — High-level enterprise divisions (`id`, `tenant_id`, `name`, `code`).
- `sub_organizations` — Testing labs and regional facilities (`id`, `tenant_id`, `organization_id`, `name`, `code`).
- `users` — System user accounts (`id`, `tenant_id`, `full_name`, `email`, `role`).
- `roles` & `permissions` — RBAC permission matrix.

### Master Data Entities
- `clients` — Client master data (`id`, `tenant_id`, `client_code`, `client_name`, `contact_email`, `gstin`, `payment_terms`).
- `vendors` — Calibration and calibration equipment vendors (`id`, `tenant_id`, `vendor_code`, `vendor_name`, `vendor_type`).
- `item_masters` — Instrument inventory registry (`id`, `tenant_id`, `item_code`, `item_name`, `serial_number`, `manufacturer`, `standard_cost`).

### Operational Calibration Pipeline
- `calibration_requests` — Parent request header (`id`, `tenant_id`, `request_number`, `client_id`, `status`, `priority`).
- `request_items` — Line items for a request (`id`, `tenant_id`, `request_id`, `item_id`, `requested_quantity`, `item_available`).
- `lab_request_assignments` — Lab queue intake and technician assignments.
- `item_verifications` — Physical intake inspection and verification status.
- `documents` — Metadata records for uploaded R2 artifacts (`storage_reference`, `mandatory`, `version`).
- `calibration_results` — Measurement test results (`calibration_result`, `environmental_conditions`).
- `calibration_measurements` — Measurement points and nominal/observed readings.
- `calibration_certificates` — Generated certificates (`certificate_number`, `calibration_date`, `next_due_date`).

### Exception & Secondary Workflows
- `service_requests` & `service_approvals` — Repairs for failed calibrations.
- `vendor_outsourcings` & `vendor_pos` — External lab outsourcing and purchase orders.

### Commercial Pipeline
- `quotations` & `quotation_items` — Commercial quotes (`quotation_number`, `status`, `total_amount`).
- `invoices` & `invoice_items` — Tax invoices (`invoice_number`, `status`, `subtotal`, `tax_amount`, `grand_total`).
- `invoice_signatures` — Client invoice digital signatures (`signature_type = 'INVOICE'`).

### Dispatch & Delivery Pipeline
- `dispatches` & `dispatch_items` — Shipment packing and carrier tracking (`dispatch_number`, `tracking_number`, `status`).
- `deliveries` — Client delivery receipts and delivery digital signatures (`signature_type = 'DELIVERY'`).

### Monitoring & Security
- `audit_logs` — Immutable audit trail (`tenant_id`, `user_id`, `action`, `resource_type`, `old_values`, `new_values`, `ip_address`).
- `request_status_history` — Status transition history (`previous_status`, `new_status`, `remarks`).

---

## Multi-Tenant Row Level Security (RLS) Strategy

Every table enforces the following security pattern:

```sql
-- Enable RLS
ALTER TABLE calibration_requests ENABLE ROW LEVEL SECURITY;

-- Helper function retrieving tenant_id from JWT session context
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
    SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')::UUID,
        '11111111-1111-4111-a111-111111111111'::UUID
    );
$$ LANGUAGE sql STABLE;

-- Unified RLS Policy
CREATE POLICY tenant_isolation_policy ON calibration_requests
    FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
```

---

## Performance Indexes

High-cardinality indexes created in migration `017_analytics_and_audit.sql`:
- `idx_requests_tenant_status` ON `calibration_requests(tenant_id, status)`
- `idx_requests_number` ON `calibration_requests(tenant_id, request_number)`
- `idx_certificates_due_date` ON `calibration_certificates(tenant_id, next_due_date)`
- `idx_invoices_number` ON `invoices(tenant_id, invoice_number)`
- `idx_dispatches_tracking` ON `dispatches(tenant_id, tracking_number)`
- `idx_audit_tenant_user` ON `audit_logs(tenant_id, user_id)`

---

## Migrations History

| File | Description |
| :--- | :--- |
| `001_foundation_tenancy_rls.sql` | Core tenancy, organizations, and RLS helper functions. |
| `002_seed_data.sql` | Demo tenant seeds and initial admin roles. |
| `003_auth_users_roles_permissions.sql` | Users, roles, and permission matrix tables. |
| `004_client_master.sql` | Client master entity table and indexes. |
| `005_vendor_master.sql` | Vendor master entity table. |
| `006_item_master.sql` | Item master inventory entity table. |
| `007_calibration_request.sql` | Calibration request headers and request items. |
| `008_lab_queue_intake.sql` | Lab intake queue and technician assignments. |
| `009_item_verification_documents.sql` | Verifications and document metadata storage. |
| `010_calibration_certificates.sql` | Calibration results, measurements, and certificates. |
| `011_service_requests_approvals.sql` | Service requests and client repair approvals. |
| `012_vendor_outsourcing.sql` | Vendor outsourcing requests and PO tables. |
| `013_quotations.sql` | Commercial quotations and line items. |
| `014_invoices.sql` | Commercial tax invoices and billing line items. |
| `015_invoice_signatures.sql` | Client digital signatures. |
| `016_dispatches.sql` | Shipment dispatches, tracking, and deliveries. |
| `017_analytics_and_audit.sql` | Analytics performance indexes and audit extension. |
