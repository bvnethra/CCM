# Calibration Commercial Module (CCM) — Production Deployment Guide

## Architecture Summary

```
+------------------+         +----------------------------+         +-----------------------+
|  React + Vite    |  HTTPS  |  Cloudflare Workers        |  HTTPS  | Supabase PostgreSQL   |
|  Frontend UI     |  -----> |  API Gateway & Workers     |  -----> | (Multi-Tenant RLS)    |
+------------------+         +----------------------------+         +-----------------------+
                                           |
                                           v
                                 +-------------------+
                                 | Cloudflare R2     |
                                 | Private Storage   |
                                 +-------------------+
```

---

## 1. Prerequisites
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **Supabase Account**: Managed PostgreSQL instance
- **Cloudflare Account**: Workers + R2 Storage enabled
- **Wrangler CLI**: `npm install -g wrangler`

---

## 2. Supabase PostgreSQL & RLS Setup

1. Log into your Supabase Dashboard and create a new project.
2. Open the SQL Editor and execute migration files in sequential order from `database/migrations/`:
   ```bash
   001_foundation_tenancy_rls.sql
   002_seed_data.sql
   003_auth_users_roles_permissions.sql
   ...
   017_analytics_and_audit.sql
   ```
3. Copy the database connection URL and Service Role Key from **Project Settings -> API & Database**.

---

## 3. Cloudflare Workers API Gateway Deployment

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Configure Wrangler environment variables in `wrangler.toml`:
   ```toml
   name = "ccm-api-gateway"
   main = "gateway/index.ts"
   compatibility_date = "2024-09-01"

   [vars]
   SUPABASE_URL = "https://your-project-id.supabase.co"
   R2_BUCKET_NAME = "ccm-secure-artifacts"

   [[r2_buckets]]
   binding = "CCM_STORAGE"
   bucket_name = "ccm-secure-artifacts"
   ```
3. Set secret keys in Cloudflare Workers environment:
   ```bash
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   wrangler secret put JWT_SECRET
   ```
4. Deploy the Workers gateway to production:
   ```bash
   wrangler deploy
   ```

---

## 4. Frontend Production Build & Deployment

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Create `.env.production` file:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_GATEWAY_URL=https://api.ccm.internal/v1
   VITE_ENABLE_MOCK_FALLBACK=false
   VITE_APP_ENV=production
   ```
3. Run the TypeScript build and Vite bundle optimizer:
   ```bash
   npm run build
   ```
4. Deploy `dist/` folder to Cloudflare Pages or Vercel:
   ```bash
   npx wrangler pages deploy dist/ --project-name=ccm-frontend
   ```

---

## 5. Post-Deployment Verification Checklist

- [x] Test `GET /health` endpoint returns `{"status":"healthy"}`.
- [x] Verify multi-tenant RLS isolation prevents cross-tenant queries.
- [x] Test client digital invoice signature canvas capture.
- [x] Test dispatch carrier shipment and delivery signature.
- [x] Verify private R2 storage signed URL generation.
- [x] Confirm `evaluateRequestCompletion` server-side engine executes cleanly.
