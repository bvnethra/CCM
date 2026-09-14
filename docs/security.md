# Calibration Commercial Module (CCM) — Security Architecture & RLS Documentation

## Security Overview

The **Calibration Commercial Module (CCM)** implements multi-tenant enterprise security. Defense-in-depth is enforced across API Gateway JWT validation, RBAC permission checks, Zod request body validation, Supabase PostgreSQL Row-Level Security (RLS), private Cloudflare R2 storage, and immutable audit trail logging.

---

## 1. Authentication & JWT Session Architecture

- **Token Standard**: HMAC SHA-256 JWT containing `sub`, `email`, `role`, `tenant_id`, `organization_id`, and `permissions`.
- **Session Resolution**: Middleware verifies `Authorization: Bearer <TOKEN>` and extracts tenant context (`x-tenant-id`).
- **Cryptographic Isolation**: Unauthenticated requests return `401 Unauthorized`. Unauthorized role actions return `403 Forbidden`.

---

## 2. Role-Based Access Control (RBAC) Permission Matrix

Server-side permission middleware checks permissions before any API worker execution:

| Role | Key Permissions |
| :--- | :--- |
| **super_admin** | Full global root access (`*`). Can switch tenant contexts. |
| **tenant_admin** | Full tenant admin access across master data, requests, lab, commercial, dispatches, audit logs. |
| **collection_agent** | Request creation, client lookup, item availability checks, document uploads. |
| **lab_user** | Lab queue intake, item verification, calibration execution, certificate generation, service requests. |
| **commercial_user**| Client master, vendor master, quotations, invoices, signature requests. |

---

## 3. Supabase Row Level Security (RLS) Penetration Defense

All database tables enforce RLS policies evaluating `current_tenant_id()` derived from the session context:

```sql
CREATE POLICY tenant_isolation_policy ON calibration_requests
    FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
```

### Verified Security Guarantees:
- **URL Tampering Defense**: Changing `requestId`, `clientId`, or `invoiceId` in frontend URLs fails at RLS level if the resource belongs to another tenant.
- **Header Injection Defense**: Frontend `tenant_id` claims sent in body/query parameters are ignored. Tenant identity is strictly derived from the authenticated JWT session context on the server.
- **Cross-Tenant Leakage**: Zero data visibility or mutation across tenant boundaries.

---

## 4. Private Cloudflare R2 Storage & Signed URLs

- **Public Access Blocked**: Cloudflare R2 bucket (`ccm-secure-artifacts`) is completely private. Direct public access is disabled.
- **Object Key Isolation**: Files are stored under tenant-isolated paths: `tenants/{tenantId}/{category}/{fileName}`.
- **Signed URLs**: Temporary signed URLs with expiration timestamps (e.g., 3600 seconds) are issued exclusively to authenticated users with valid permissions.

---

## 5. Input Validation & Zod Schemas

All incoming request payloads are validated using Zod schemas before processing:
- Numeric ranges (e.g., positive quantities, standard cost $\ge 0$, tax rates $0-100\%$).
- Mandatory fields (e.g., urgent reason required when `dispatch_type === 'URGENT'`).
- Sanitized strings preventing SQL injection or HTML/XSS script execution.

---

## 6. Audit Trail Logging

Sensitive actions automatically write immutable records to `audit_logs`:
- Action type (`CREATE_CALIBRATION_REQUEST`, `CONFIRM_DELIVERY`, `INVOICE_SIGNED`).
- User ID & Full Name.
- Tenant ID.
- Resource type & ID.
- Previous values & New values diff payload.
- Correlation `X-Request-ID`.
