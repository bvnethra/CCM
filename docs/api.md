# Calibration Commercial Module (CCM) — API Reference Documentation

## Base URL & Gateway
- **Development API Gateway**: `http://localhost:8787/api/v1`
- **Production Edge Gateway**: `https://api.ccm.internal/v1`
- **Correlation Header**: `X-Request-ID` (Returned on all responses)

---

## Authentication & Headers
All requests must include:
- `Authorization: Bearer <JWT_TOKEN>`
- `x-tenant-id: <TENANT_UUID>`
- `Content-Type: application/json`

---

## Summary of Core API Endpoints

### 1. Authentication & Session
- `POST /auth/login` — Authenticate user and issue tenant-scoped JWT token.
- `GET /auth/session` — Retrieve current authenticated profile & permissions.
- `POST /auth/logout` — Revoke active session token.

### 2. Master Data APIs
- `GET /clients` — List clients (supports search, pagination).
- `POST /clients` — Create new client.
- `GET /vendors` — List vendors.
- `POST /vendors` — Create vendor profile.
- `GET /items` — List item inventory.
- `POST /items` — Add instrument item master record.

### 3. Calibration Request & Lab Queue APIs
- `GET /calibration-requests` — List calibration requests.
- `POST /calibration-requests` — Create request with line items and availability flags.
- `GET /calibration-requests/:id` — Request header and line items.
- `POST /calibration-requests/:id/lab-queue` — Move request to Lab Queue.
- `GET /lab/queue` — List lab intake queue.
- `POST /lab/queue/:requestId/assign` — Assign technician to request.
- `POST /verifications` — Submit item physical verification & document checks.

### 4. Calibration Operations APIs
- `POST /calibrations` — Record calibration measurements & PASS/FAIL result.
- `POST /certificates` — Generate calibration certificate & next due date.
- `GET /calibration/due-list` — List upcoming and overdue calibrations.

### 5. Service & Outsourcing APIs
- `POST /service-requests` — Create service repair request for failed calibration.
- `POST /service-requests/:id/approve` — Record client approval for repair.
- `POST /vendor-outsourcings` — Initiate vendor outsourcing flow.
- `POST /vendor-pos` — Issue vendor Purchase Order.

### 6. Commercial Quotations & Invoices APIs
- `GET /quotations` — List quotations.
- `POST /quotations` — Create quotation snapshot from request items.
- `POST /quotations/:id/approve` — Client quotation approval.
- `GET /invoices` — List tax invoices.
- `POST /invoices` — Generate tax invoice from approved quotation.
- `POST /invoices/:id/request-signature` — Generate client invoice signing URL.
- `POST /invoices/:id/sign` — Capture client canvas signature (`signature_type = 'INVOICE'`).

### 7. Dispatch & Delivery APIs
- `GET /dispatches` — List shipment dispatches.
- `POST /dispatches` — Create packing dispatch (`STANDARD`, `PARTIAL`, `URGENT`).
- `POST /dispatches/:id/ship` — Ship dispatch with carrier and tracking number.
- `POST /dispatches/:id/deliver` — Client delivery confirmation & canvas signature (`signature_type = 'DELIVERY'`).

### 8. Analytics & Completion Engine APIs
- `GET /dashboard/summary` — Aggregate metrics for operations dashboard.
- `GET /dashboard/workflow` — Workflow funnel counts across 10 stages.
- `GET /operations/exceptions` — Actionable bottleneck exceptions list.
- `GET /calibration-requests/:id/timeline` — Unified chronological timeline.
- `GET /calibration-requests/:id/progress` — Item progress matrix across stages.
- `POST /calibration-requests/:id/evaluate-completion` — Server-side completion engine.
- `GET /global-search?q=<QUERY>` — Cross-entity search.
- `GET /audit-logs` — Security audit trail viewer.
- `GET /reports?report_type=<TYPE>` — Data export for executive reports.

---

## Standard Response Format

### Success Response (HTTP 200 / 201)
```json
{
  "success": true,
  "data": {},
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### Error Response (HTTP 400 / 401 / 403 / 404 / 500)
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Missing required permission [request.cancel]"
  }
}
```
