import { UserContext, AuditLogRecord } from '../types';
import { dbStore } from './supabase';

export function recordAuditLog(
  user: UserContext,
  action: string,
  entityType: string,
  entityId: string,
  requestReference?: string,
  oldValue?: any,
  newValue?: any
): AuditLogRecord {
  const auditEntry: AuditLogRecord = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    tenantId: user.tenantId,
    organizationId: user.organizationId,
    subOrgId: user.subOrgId,
    userId: user.id,
    userEmail: user.email,
    action,
    entityType,
    entityId,
    requestReference: requestReference || 'N/A',
    oldValue,
    newValue,
    timestamp: new Date().toISOString(),
  };

  dbStore.auditLogs.unshift(auditEntry);
  return auditEntry;
}

export function getAuditLogsForTenant(tenantId: string): AuditLogRecord[] {
  return dbStore.auditLogs.filter((log) => log.tenantId === tenantId);
}
