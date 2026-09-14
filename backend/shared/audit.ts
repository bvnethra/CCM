import { SupabaseClient } from '@supabase/supabase-js';

export interface AuditLogInput {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function logAuditEvent(supabase: SupabaseClient, entry: AuditLogInput): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      tenant_id: entry.tenantId || '11111111-1111-4111-a111-111111111111',
      user_id: entry.userId || null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      old_values: entry.oldValues || null,
      new_values: entry.newValues || null,
      ip_address: entry.ipAddress || null,
    });

    if (error) {
      console.error('[AUDIT LOG ERROR]', error.message);
    }
  } catch (err) {
    console.error('[AUDIT LOG UNHANDLED ERROR]', err);
  }
}
