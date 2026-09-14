import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { WorkerEnv, AuthenticatedUser } from '../../shared/types';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';

type AppVariables = {
  user: AuthenticatedUser;
};

export const systemWorker = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>();

function getSupabase(c: any) {
  const url = c.env.SUPABASE_URL;
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY || c.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured in Worker environment.');
  }
  return createClient(url, key);
}

// ============================================================================
// SYSTEM DATA INTEGRITY DIAGNOSTIC ENDPOINT (STEP 19)
// ============================================================================
systemWorker.get('/data-integrity', requirePermission('system.integrity_view'), async (c) => {
  const user = c.get('user');
  const supabase = getSupabase(c);

  const targetTenantId =
    user.role === 'super_admin' && c.req.query('tenant_id')
      ? c.req.query('tenant_id')!
      : user.tenantId;

  const diagnostics: Record<string, any> = {
    checked_at: new Date().toISOString(),
    tenant_id: targetTenantId,
    issues_found: 0,
    categories: {},
  };

  try {
    // 1. Orphan Request Items (request_items without valid request)
    const { data: reqItems } = await supabase
      .from('request_items')
      .select('id, request_id, tenant_id')
      .eq('tenant_id', targetTenantId);

    const { data: requests } = await supabase
      .from('calibration_requests')
      .select('id')
      .eq('tenant_id', targetTenantId);

    const validReqIds = new Set((requests || []).map((r) => r.id));
    const orphanReqItems = (reqItems || []).filter((item) => !validReqIds.has(item.request_id));

    diagnostics.categories.orphan_request_items = {
      count: orphanReqItems.length,
      items: orphanReqItems.slice(0, 10),
    };

    // 2. Orphan Quotation Items (quotation_items without valid quotation)
    const { data: qItems } = await supabase
      .from('quotation_items')
      .select('id, quotation_id, tenant_id')
      .eq('tenant_id', targetTenantId);

    const { data: quotations } = await supabase
      .from('quotations')
      .select('id')
      .eq('tenant_id', targetTenantId);

    const validQIds = new Set((quotations || []).map((q) => q.id));
    const orphanQuotationItems = (qItems || []).filter((item) => !validQIds.has(item.quotation_id));

    diagnostics.categories.orphan_quotation_items = {
      count: orphanQuotationItems.length,
      items: orphanQuotationItems.slice(0, 10),
    };

    // 3. Duplicate Request Numbers
    const { data: reqNumbers } = await supabase
      .from('calibration_requests')
      .select('request_number')
      .eq('tenant_id', targetTenantId);

    const reqNumCounts: Record<string, number> = {};
    (reqNumbers || []).forEach((r) => {
      reqNumCounts[r.request_number] = (reqNumCounts[r.request_number] || 0) + 1;
    });
    const duplicateReqNumbers = Object.entries(reqNumCounts)
      .filter(([_, count]) => count > 1)
      .map(([num, count]) => ({ request_number: num, count }));

    diagnostics.categories.duplicate_request_numbers = {
      count: duplicateReqNumbers.length,
      items: duplicateReqNumbers,
    };

    // 4. Duplicate Quotation Numbers
    const { data: qNumbers } = await supabase
      .from('quotations')
      .select('quotation_number')
      .eq('tenant_id', targetTenantId);

    const qNumCounts: Record<string, number> = {};
    (qNumbers || []).forEach((q) => {
      qNumCounts[q.quotation_number] = (qNumCounts[q.quotation_number] || 0) + 1;
    });
    const duplicateQuotationNumbers = Object.entries(qNumCounts)
      .filter(([_, count]) => count > 1)
      .map(([num, count]) => ({ quotation_number: num, count }));

    diagnostics.categories.duplicate_quotation_numbers = {
      count: duplicateQuotationNumbers.length,
      items: duplicateQuotationNumbers,
    };

    // 5. Total issues sum
    diagnostics.issues_found =
      orphanReqItems.length +
      orphanQuotationItems.length +
      duplicateReqNumbers.length +
      duplicateQuotationNumbers.length;

    await logAuditEvent(supabase, {
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'RUN_SYSTEM_INTEGRITY_DIAGNOSTIC',
      resourceType: 'system',
      resourceId: targetTenantId,
      newValues: { issues_found: diagnostics.issues_found },
    });

    return c.json({
      success: true,
      data: diagnostics,
      message: diagnostics.issues_found === 0 ? 'System data integrity check passed with zero issues.' : `System diagnostic detected ${diagnostics.issues_found} issues.`,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'System diagnostic check failed' }, 500);
  }
});
