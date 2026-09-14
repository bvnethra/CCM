# Calibration Commercial Module (CCM)
## Step 1: Project Foundation + Tenant / Organization / Sub-Organization

This repository contains **Step 1** of the Calibration Commercial Module (CCM), an enterprise-grade, multi-tenant metrology and calibration platform designed with strict tenant data isolation, PostgreSQL Row Level Security (RLS), Cloudflare Workers API Gateway, and a modern React + TypeScript + Tailwind CSS dashboard.

---

## 1. Architecture Overview

```
                      [ Client Browser (React + Vite + Tailwind) ]
                                          |
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
             [ Cloudflare Workers API Gateway ]   [ Supabase Client Direct ]
             * JWT & Tenancy Validation Headers   * Direct RLS Protected
             * CORS & Rate Limiting Routing       * Supabase Auth
             * Cloudflare R2 Pre-Signed Tokens    * User Profile Lookups
                        |                                   |
                        v                                   v
             [ Domain Workers: Tenant Worker ]              |
             * Zod Input Validation                         |
             * Audit Log Ingestion                          |
                        |                                   |
                        +-----------------+-----------------+
                                          |
                                          v
                      [ Supabase / PostgreSQL 15 Database ]
                      * Row Level Security (RLS) Active
                      * current_tenant_id() & is_super_admin()
                      * Tenants -> Organizations -> Sub-Organizations
                      * Audit Logging Triggers
```

---

## 2. Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Zod
- **Backend**: Cloudflare Workers, Hono, REST API Gateway, Domain Workers
- **Database**: PostgreSQL 15, Supabase, Row Level Security (RLS), Triggers, Functions
- **Validation & Security**: Zod runtime validation, JWT authentication, RBAC, Multi-Tenant Boundary Enforcement, Audit Trail
- **Storage**: Cloudflare R2 with isolated multi-tenant folder paths & pre-signed URL architecture

---

## 3. Database Schema & Multi-Tenant Hierarchy

### Data Model & Relationships
```
   +-----------------------------------------------------------+
   |                       tenants                             |
   | id (UUID PK), name, code (UQ), status, settings, cr, up   |
   +-----------------------------------------------------------+
                                 |
                                 | 1:N (ON DELETE CASCADE)
                                 v
   +-----------------------------------------------------------+
   |                    organizations                          |
   | id (UUID PK), tenant_id (FK), name, code, status, cr, up  |
   | UNIQUE (tenant_id, code)                                  |
   +-----------------------------------------------------------+
                                 |
                                 | 1:N (ON DELETE CASCADE)
                                 v
   +-----------------------------------------------------------+
   |                  sub_organizations                        |
   | id (UUID PK), tenant_id (FK), organization_id (FK),       |
   | name, code, status, cr, up                                |
   | UNIQUE (organization_id, code)                            |
   +-----------------------------------------------------------+
```

### Supporting Tables
- **`user_profiles`**: Links `auth.users(id)` to `tenant_id`, `organization_id`, `role`, and `status`.
- **`audit_logs`**: Logs all lifecycle events (`action`, `resource_type`, `resource_id`, `old_values`, `new_values`, `ip_address`, `tenant_id`, `user_id`).

### Row Level Security (RLS) Policies
PostgreSQL RLS is enabled on all tables. Queries automatically resolve tenancy through:
- `current_tenant_id()`: Inspects `request.jwt.claims ->> 'tenant_id'`, falling back to `user_profiles.tenant_id`.
- `is_super_admin()`: Verifies if the request carries `super_admin` permissions.

1. **`tenants` table**:
   - `SELECT`: Restricted to `id = current_tenant_id()` (or super admin).
   - `INSERT / UPDATE / DELETE`: Super Admin only.
2. **`organizations` table**:
   - `SELECT / INSERT / UPDATE / DELETE`: Restricted to `tenant_id = current_tenant_id()`.
3. **`sub_organizations` table**:
   - `SELECT / DELETE`: Restricted to `tenant_id = current_tenant_id()`.
   - `INSERT / UPDATE`: Restricted to `tenant_id = current_tenant_id()` AND validates that `organization_id` belongs to the exact same tenant.
4. **`audit_logs` table**:
   - `SELECT`: Restricted to `tenant_id = current_tenant_id()`.

---

## 4. API Endpoints (Cloudflare Workers API Gateway)

### Base Gateway: `http://localhost:8787/api/v1`

| Method | Route | Description | Auth Scope |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | API Gateway health check | Public |
| `GET` | `/api/v1/tenants` | List accessible tenants | Super Admin / Scoped Tenant |
| `POST` | `/api/v1/tenants` | Provision new tenant | Super Admin |
| `GET` | `/api/v1/tenants/:id` | Get tenant details | Scoped Tenant / Super Admin |
| `PUT` | `/api/v1/tenants/:id` | Update tenant properties | Scoped Tenant / Super Admin |
| `GET` | `/api/v1/organizations` | List organizations | Tenant Scoped |
| `POST` | `/api/v1/organizations` | Create organization | Tenant Scoped |
| `PUT` | `/api/v1/organizations/:id` | Update organization | Tenant Scoped |
| `DELETE` | `/api/v1/organizations/:id` | Delete organization & cascade | Tenant Scoped |
| `GET` | `/api/v1/sub-organizations` | List sub-organizations / labs | Tenant Scoped |
| `POST` | `/api/v1/sub-organizations` | Create sub-organization / lab | Tenant Scoped & Org Verified |
| `PUT` | `/api/v1/sub-organizations/:id` | Update sub-organization | Tenant Scoped |
| `DELETE` | `/api/v1/sub-organizations/:id` | Delete sub-organization | Tenant Scoped |
| `GET` | `/api/v1/audit-logs` | Retrieve audit events | Tenant Scoped |
| `POST` | `/api/v1/storage/signed-url` | Generate Cloudflare R2 Pre-Signed URL | Tenant Isolated Path |

---

## 5. How to Run the Project

### Prerequisites
- Node.js v18+ (tested on Node v24)
- npm v9+

### Frontend Dashboard
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (already prepared)
npm install

# Start development server
npm run dev
```
The frontend will start at `http://localhost:3000`.

### Backend Cloudflare Workers API Gateway
```bash
# Navigate to backend directory
cd backend

# Install dependencies (already prepared)
npm install

# Start local Cloudflare Workers simulator
npm run dev
```
The API Gateway will start at `http://localhost:8787`.

---

## 6. Demo Persona Quick-Switching (Testing Multi-Tenancy)

The application includes 3 built-in demo personas for instant zero-dependency testing of multi-tenant security:

1. **Elena Rostova (Super Admin)**:
   - Full global visibility.
   - Can view and provision new tenants.
   - Has access to the **Tenant Switcher** dropdown in the top header to inspect any tenant's isolated data.
2. **Marcus Vance (Tenant Admin - Acme Calibration Labs)**:
   - Locked to `Acme Calibration Labs` (`ACME-CAL`).
   - Can only view and manage Acme's organizations (Aerospace, Medical) and sub-orgs (Pressure & Vacuum, RF, Biomedical).
   - Cannot see or access Apex Metrology's data.
3. **Sarah Lin (Tenant Admin - Apex Metrology Group)**:
   - Locked to `Apex Metrology Group` (`APEX-MET`).
   - Can only view Apex's organizations (Industrial, Cleanroom) and sub-orgs (CMM, Torque & Force).
   - Cannot see or access Acme's data.

---

## 7. Configuration & Environment Variables

Copy `.env.example` to `.env` in both root, `backend/`, and `frontend/`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key

# API Gateway
VITE_API_GATEWAY_URL=http://localhost:8787/api/v1

# Cloudflare R2
R2_BUCKET_NAME=ccm-secure-artifacts
R2_ACCOUNT_ID=your-account-id
```
