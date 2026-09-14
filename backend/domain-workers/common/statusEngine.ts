// ============================================================================
// CENTRALIZED GMS STATUS DEFINITIONS & TRANSITION ENGINE (STEP 19)
// ============================================================================

export type RequestStatus =
  | 'CREATED'
  | 'COLLECTED'
  | 'LAB_QUEUE'
  | 'RECEIVED_IN_LAB'
  | 'VERIFICATION'
  | 'CALIBRATION'
  | 'CALIBRATED'
  | 'QUOTATION'
  | 'APPROVAL'
  | 'INVOICE'
  | 'CLIENT_SIGN'
  | 'READY_TO_DISPATCH'
  | 'DISPATCHED'
  | 'CLIENT_RECEIVED'
  | 'DELIVERY_SIGNED'
  | 'PARTIALLY_COMPLETED'
  | 'COMPLETED'
  // Exception States
  | 'ON_HOLD'
  | 'DISCREPANCY'
  | 'FAULTY'
  | 'OUTSOURCED'
  | 'REJECTED'
  | 'CANCELLED';

export type RequestItemStatus =
  | 'CREATED'
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'LAB_QUEUE'
  | 'RECEIVED_IN_LAB'
  | 'VERIFICATION'
  | 'VERIFIED'
  | 'CALIBRATION'
  | 'CALIBRATED'
  | 'FAULTY'
  | 'SERVICE_REQUIRED'
  | 'IN_SERVICE'
  | 'OUTSOURCED'
  | 'VENDOR_COMPLETED'
  | 'QUOTATION'
  | 'INVOICED'
  | 'CLIENT_SIGNED'
  | 'READY_FOR_DISPATCH'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type CalibrationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ServiceStatus = 'SERVICE_REQUIRED' | 'AWAITING_CLIENT_APPROVAL' | 'APPROVED' | 'IN_REPAIR' | 'COMPLETED' | 'REJECTED';
export type OutsourceStatus = 'DRAFT' | 'PO_GENERATED' | 'SENT_TO_VENDOR' | 'RECEIVED_FROM_VENDOR' | 'VERIFIED' | 'REJECTED';
export type QuotationStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT' | 'EXPIRED' | 'CANCELLED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type DispatchStatus = 'DRAFT' | 'PREPARED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type DeliveryStatus = 'PENDING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'SIGNED' | 'FAILED';

// Canonical Request Transition Map
const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  CREATED: ['COLLECTED', 'LAB_QUEUE', 'RECEIVED_IN_LAB', 'ON_HOLD', 'DISCREPANCY', 'CANCELLED', 'REJECTED'],
  COLLECTED: ['LAB_QUEUE', 'RECEIVED_IN_LAB', 'VERIFICATION', 'ON_HOLD', 'DISCREPANCY', 'CANCELLED'],
  LAB_QUEUE: ['RECEIVED_IN_LAB', 'VERIFICATION', 'CALIBRATION', 'ON_HOLD', 'FAULTY', 'OUTSOURCED', 'CANCELLED'],
  RECEIVED_IN_LAB: ['VERIFICATION', 'CALIBRATION', 'LAB_QUEUE', 'ON_HOLD', 'DISCREPANCY', 'CANCELLED'],
  VERIFICATION: ['CALIBRATION', 'LAB_QUEUE', 'RECEIVED_IN_LAB', 'ON_HOLD', 'DISCREPANCY', 'FAULTY', 'CANCELLED'],
  CALIBRATION: ['CALIBRATED', 'FAULTY', 'OUTSOURCED', 'ON_HOLD', 'CANCELLED'],
  CALIBRATED: ['QUOTATION', 'APPROVAL', 'INVOICE', 'READY_TO_DISPATCH', 'ON_HOLD', 'CANCELLED'],
  QUOTATION: ['APPROVAL', 'INVOICE', 'ON_HOLD', 'REJECTED', 'CANCELLED'],
  APPROVAL: ['INVOICE', 'QUOTATION', 'ON_HOLD', 'REJECTED', 'CANCELLED'],
  INVOICE: ['CLIENT_SIGN', 'READY_TO_DISPATCH', 'ON_HOLD', 'CANCELLED'],
  CLIENT_SIGN: ['READY_TO_DISPATCH', 'DISPATCHED', 'ON_HOLD', 'CANCELLED'],
  READY_TO_DISPATCH: ['DISPATCHED', 'ON_HOLD', 'CANCELLED'],
  DISPATCHED: ['CLIENT_RECEIVED', 'DELIVERY_SIGNED', 'PARTIALLY_COMPLETED', 'COMPLETED', 'ON_HOLD'],
  CLIENT_RECEIVED: ['DELIVERY_SIGNED', 'PARTIALLY_COMPLETED', 'COMPLETED'],
  DELIVERY_SIGNED: ['PARTIALLY_COMPLETED', 'COMPLETED'],
  PARTIALLY_COMPLETED: ['COMPLETED', 'ON_HOLD', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  // Exception states can transition back to appropriate workflow states or CANCELLED
  ON_HOLD: ['CREATED', 'COLLECTED', 'LAB_QUEUE', 'VERIFICATION', 'CALIBRATION', 'CALIBRATED', 'QUOTATION', 'APPROVAL', 'INVOICE', 'CLIENT_SIGN', 'READY_TO_DISPATCH', 'DISPATCHED', 'CANCELLED'],
  DISCREPANCY: ['CREATED', 'COLLECTED', 'VERIFICATION', 'CANCELLED'],
  FAULTY: ['VERIFICATION', 'CALIBRATION', 'OUTSOURCED', 'CANCELLED'],
  OUTSOURCED: ['CALIBRATED', 'VERIFICATION', 'CANCELLED'],
  REJECTED: ['DRAFT', 'CREATED', 'CANCELLED'],
  CANCELLED: [], // Terminal state
};

// Canonical Request Item Transition Map
const ITEM_TRANSITIONS: Record<RequestItemStatus, RequestItemStatus[]> = {
  CREATED: ['AVAILABLE', 'UNAVAILABLE', 'LAB_QUEUE', 'REJECTED', 'CANCELLED'],
  AVAILABLE: ['LAB_QUEUE', 'VERIFICATION', 'REJECTED', 'CANCELLED'],
  UNAVAILABLE: ['AVAILABLE', 'REJECTED', 'CANCELLED'],
  LAB_QUEUE: ['VERIFICATION', 'CALIBRATION', 'FAULTY', 'OUTSOURCED', 'CANCELLED'],
  VERIFICATION: ['VERIFIED', 'CALIBRATION', 'FAULTY', 'OUTSOURCED', 'CANCELLED'],
  VERIFIED: ['CALIBRATION', 'QUOTATION', 'FAULTY', 'OUTSOURCED', 'CANCELLED'],
  CALIBRATION: ['CALIBRATED', 'FAULTY', 'SERVICE_REQUIRED', 'OUTSOURCED', 'CANCELLED'],
  CALIBRATED: ['QUOTATION', 'INVOICED', 'READY_FOR_DISPATCH', 'COMPLETED', 'CANCELLED'],
  FAULTY: ['SERVICE_REQUIRED', 'IN_SERVICE', 'OUTSOURCED', 'CALIBRATION', 'CANCELLED'],
  SERVICE_REQUIRED: ['IN_SERVICE', 'OUTSOURCED', 'CALIBRATION', 'CANCELLED'],
  IN_SERVICE: ['CALIBRATION', 'VENDOR_COMPLETED', 'FAULTY', 'CANCELLED'],
  OUTSOURCED: ['VENDOR_COMPLETED', 'CALIBRATION', 'CANCELLED'],
  VENDOR_COMPLETED: ['CALIBRATION', 'VERIFIED', 'CALIBRATED', 'CANCELLED'],
  QUOTATION: ['INVOICED', 'CLIENT_SIGNED', 'READY_FOR_DISPATCH', 'CANCELLED'],
  INVOICED: ['CLIENT_SIGNED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'COMPLETED'],
  CLIENT_SIGNED: ['READY_FOR_DISPATCH', 'DISPATCHED', 'DELIVERED', 'COMPLETED'],
  READY_FOR_DISPATCH: ['DISPATCHED', 'DELIVERED', 'COMPLETED'],
  DISPATCHED: ['DELIVERED', 'COMPLETED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Validates a request-level status transition.
 * Returns true if allowed, false if invalid.
 */
export function validateRequestTransition(currentStatus: RequestStatus, targetStatus: RequestStatus): boolean {
  if (currentStatus === targetStatus) return true; // Idempotent
  const allowed = REQUEST_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

/**
 * Validates a request-item-level status transition.
 * Returns true if allowed, false if invalid.
 */
export function validateRequestItemTransition(currentStatus: RequestItemStatus, targetStatus: RequestItemStatus): boolean {
  if (currentStatus === targetStatus) return true;
  const allowed = ITEM_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

/**
 * Server-side helper to record status history entry into DB.
 */
export async function logStatusHistory(
  supabase: any,
  params: {
    tenant_id: string;
    request_id: string;
    request_item_id?: string | null;
    previous_status: string;
    new_status: string;
    changed_by: string;
    remarks?: string | null;
    source_module: string;
  }
) {
  try {
    await supabase.from('request_status_history').insert({
      tenant_id: params.tenant_id,
      request_id: params.request_id,
      request_item_id: params.request_item_id || null,
      previous_status: params.previous_status,
      new_status: params.new_status,
      changed_by: params.changed_by,
      remarks: params.remarks || null,
      source_module: params.source_module,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to write request_status_history:', err);
  }
}
