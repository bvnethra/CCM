export type TenantStatus = 'active' | 'inactive' | 'suspended';
export type UserRole =
  | 'super_admin'
  | 'tenant_admin'
  | 'org_admin'
  | 'manager'
  | 'lab_user'
  | 'collection_agent'
  | 'commercial_user'
  | 'dispatch_user'
  | 'viewer';

export interface Tenant {
  id: string;
  name: string;
  code: string;
  status: TenantStatus;
  settings?: {
    timezone?: string;
    currency?: string;
    complianceStandard?: string;
  };
  created_at: string;
  updated_at: string;
  organizations_count?: number;
}

export interface Organization {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
  sub_organizations_count?: number;
}

export interface SubOrganization {
  id: string;
  tenant_id: string;
  organization_id: string;
  name: string;
  code: string;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
  organization?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface Client {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  client_code: string;
  client_name: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  billing_address?: string | null;
  gst_number?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  status: TenantStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
  sub_organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface Vendor {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  vendor_code: string;
  vendor_name: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  gst_number?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  serviced_categories?: string[] | null;
  status: TenantStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
  sub_organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface ItemMaster {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  item_code: string;
  item_name: string;
  item_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  measurement_range?: string | null;
  least_count?: string | null;
  standard_cost: number;
  calibration_frequency: number;
  calibration_frequency_unit: string;
  status: TenantStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
  sub_organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface UserProfile {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_organization_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
  organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
  sub_organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
  roles?: Role[];
  permissions?: string[];
}

export interface Role {
  id: string;
  tenant_id?: string | null;
  name: string;
  code: string;
  description?: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  permissions_count?: number;
  users_count?: number;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string | null;
  created_at?: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface UserRoleMapping {
  id: string;
  user_id: string;
  role_id: string;
  tenant_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  ip_address?: string | null;
  created_at: string;
}

export type CalibrationRequestPriority = 'NORMAL' | 'URGENT';
export type CalibrationRequestStatus =
  | 'CREATED'
  | 'COLLECTED'
  | 'LAB_QUEUE'
  | 'VERIFICATION'
  | 'VERIFIED'
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
  | 'ON_HOLD'
  | 'DISCREPANCY'
  | 'FAULTY'
  | 'OUTSOURCED'
  | 'REJECTED'
  | 'CANCELLED';

export type InvoiceMode = 'ITEMS_AND_INVOICE' | 'INVOICE_ONLY';
export type OfflineSyncStatus = 'LOCAL_DRAFT' | 'SYNC_PENDING' | 'SYNCED' | 'SYNC_FAILED';
export type ItemAvailability = 'YES' | 'NO';
export type LabAssignmentStatus = 'ACTIVE' | 'REASSIGNED' | 'COMPLETED';

export interface LabRequestAssignment {
  id: string;
  tenant_id: string;
  request_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: string;
  status: LabAssignmentStatus;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_user?: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
  } | null;
  assigned_by_user?: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
  } | null;
}

export interface RequestStatusHistory {
  id: string;
  tenant_id: string;
  request_id: string;
  previous_status?: CalibrationRequestStatus | null;
  new_status: CalibrationRequestStatus;
  changed_by: string;
  changed_at: string;
  remarks?: string | null;
  created_at: string;
  changed_by_user?: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
  } | null;
}

export interface RequestItem {
  id: string;
  request_id: string;
  tenant_id: string;
  item_id: string;
  requested_quantity: number;
  item_available: ItemAvailability;
  availability_remarks?: string | null;
  availability_checked_by?: string | null;
  availability_checked_at?: string | null;
  created_at: string;
  updated_at: string;
  item?: ItemMaster | null;
  checked_by_user?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  verification?: Verification | null;
}

export interface CalibrationRequest {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  request_number: string;
  client_id: string;
  collection_agent_id: string;
  collection_date: string;
  priority: CalibrationRequestPriority;
  status: CalibrationRequestStatus;
  remarks?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  collection_agent?: UserProfile | null;
  created_by_user?: UserProfile | null;
  organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
  sub_organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
  items?: (RequestItem & { verification?: Verification | null })[];
  items_count?: number;
  available_items_count?: number;
  unavailable_items_count?: number;
  current_assignment?: LabRequestAssignment | null;
  assignments?: LabRequestAssignment[];
  status_history?: RequestStatusHistory[];
  documents?: DocumentItem[];
  verifications?: Verification[];
}

export type ItemMatchStatus = 'MATCHED' | 'NOT_MATCHED';
export type SerialMatchStatus = 'MATCHED' | 'NOT_MATCHED' | 'NOT_APPLICABLE';
export type QuantityStatus = 'MATCHED' | 'SHORT' | 'EXCESS';
export type ConditionStatus = 'GOOD' | 'DAMAGED' | 'FAULTY' | 'OTHER';
export type VerificationResult = 'VERIFIED' | 'DISCREPANCY' | 'SHORT' | 'EXCEPTION';
export type DocumentType =
  | 'COLLECTION_PROOF'
  | 'RECEIPT_PROOF'
  | 'PREVIOUS_CERTIFICATE'
  | 'VERIFICATION_PROOF'
  | 'OTHER';

export interface Verification {
  id: string;
  tenant_id: string;
  request_id: string;
  request_item_id: string;
  verified_by: string;
  verified_at: string;
  item_match_status: ItemMatchStatus;
  serial_match_status: SerialMatchStatus;
  quantity_status: QuantityStatus;
  condition_status: ConditionStatus;
  received_quantity: number;
  discrepancy_reason?: string | null;
  verification_result: VerificationResult;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  verified_by_user?: {
    id: string;
    full_name: string;
    email: string;
    role?: string;
  } | null;
  request_item?: RequestItem;
}

export interface DocumentItem {
  id: string;
  tenant_id: string;
  request_id: string;
  item_id?: string | null;
  request_item_id?: string | null;
  document_type: DocumentType;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_reference: string;
  mandatory: boolean;
  uploaded_by: string;
  uploaded_at: string;
  version: number;
  created_at: string;
  updated_at: string;
  uploaded_by_user?: {
    id: string;
    full_name: string;
    email: string;
    role?: string;
  } | null;
  download_url?: string;
}

export interface VerificationQueueItem {
  id: string;
  tenant_id: string;
  request_number: string;
  priority: CalibrationRequestPriority;
  status: CalibrationRequestStatus;
  collection_date: string;
  client_name: string;
  organization_name: string;
  total_items: number;
  verified_items: number;
  discrepant_items: number;
  mandatory_documents_count: number;
  total_documents_count: number;
  can_complete: boolean;
  created_at: string;
  updated_at: string;
  request_id?: string;
  request_item_id?: string;
  item_id?: string;
  item_code?: string;
  item_name?: string;
  serial_number?: string;
  requested_quantity?: number;
  item_available?: ItemAvailability;
  verification_result?: VerificationResult | 'PENDING';
  verification?: Verification | null;
}

// ============================================================================
// STEP 9 TYPES: CALIBRATION, MEASUREMENTS, CERTIFICATES & DUE LIST
// ============================================================================
export type CalibrationResult = 'PASS' | 'FAIL' | 'ADJUSTED' | 'NOT_CALIBRATABLE' | 'OUTSOURCE';
export type CalibrationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NOT_CALIBRATABLE';
export type MeasurementResult = 'PASS' | 'FAIL' | 'NOT_TESTED';
export type DueStatus = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';

export interface CalibrationMeasurement {
  id: string;
  tenant_id: string;
  calibration_id: string;
  measurement_point: string;
  nominal_value?: number | null;
  observed_value?: number | null;
  unit?: string | null;
  tolerance_min?: number | null;
  tolerance_max?: number | null;
  error_value?: number | null;
  measurement_result: MeasurementResult;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Calibration {
  id: string;
  tenant_id: string;
  request_id: string;
  request_item_id: string;
  item_id: string;
  calibrated_by: string;
  calibration_started_at: string;
  calibration_completed_at?: string | null;
  calibration_method?: string | null;
  environmental_conditions?: string | null;
  result: CalibrationResult;
  remarks?: string | null;
  status: CalibrationStatus;
  calibration_date?: string | null;
  next_due_date?: string | null;
  calibration_frequency?: number | null;
  calibration_frequency_unit?: string | null;
  frequency_override?: boolean;
  frequency_override_reason?: string | null;
  frequency_overridden_by?: string | null;
  frequency_overridden_at?: string | null;
  created_at: string;
  updated_at: string;
  calibrated_by_user?: {
    id: string;
    full_name: string;
    email: string;
    role?: string;
  } | null;
  item?: ItemMaster | null;
}

export interface Certificate {
  id: string;
  tenant_id: string;
  request_id: string;
  request_item_id: string;
  calibration_id: string;
  certificate_number: string;
  document_type: string;
  file_name: string;
  storage_reference: string;
  version: number;
  generated_by: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
  generated_by_user?: {
    id: string;
    full_name: string;
    email: string;
    role?: string;
  } | null;
  download_url?: string;
}

export interface CalibrationQueueItem {
  request_id: string;
  request_number: string;
  priority: CalibrationRequestPriority;
  client?: Client | null;
  request_item_id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  serial_number: string;
  verification_result: VerificationResult;
  verified_by: string;
  calibration?: Calibration | null;
  calibration_status: CalibrationStatus;
  calibration_result?: CalibrationResult | null;
  created_at: string;
}

export interface DueListItem {
  id: string;
  request_id: string;
  request_number: string;
  client_id?: string;
  item_id: string;
  item_code: string;
  item_name: string;
  serial_number: string;
  client?: Client | null;
  vendor?: Vendor | null;
  last_calibration_date: string;
  calibration_frequency: number;
  calibration_frequency_unit: string;
  next_due_date: string;
  days_remaining: number;
  due_status: DueStatus;
  result: CalibrationResult;
}

// ============================================================================
// STEP 10 TYPES: FAULTY ITEM, SERVICE REQUIRED & CLIENT APPROVAL
// ============================================================================
export type ServiceStatus =
  | 'SERVICE_REQUIRED'
  | 'AWAITING_CLIENT_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_SERVICE'
  | 'SERVICE_COMPLETED'
  | 'CANCELLED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ServiceApproval {
  id: string;
  tenant_id: string;
  service_request_id: string;
  approval_status: ApprovalStatus;
  approved_by_client_name?: string | null;
  approved_by_client_role?: string | null;
  approval_remarks?: string | null;
  approval_reference?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceRequest {
  id: string;
  tenant_id: string;
  request_id: string;
  request_item_id: string;
  calibration_id: string;
  client_id: string;
  service_status: ServiceStatus;
  fault_description: string;
  service_required: boolean;
  estimated_service_cost?: number | null;
  service_remarks?: string | null;
  created_by: string;
  started_by?: string | null;
  started_at?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  calibration?: Calibration | null;
  request?: CalibrationRequest | null;
  request_item?: RequestItem | null;
  created_by_user?: UserProfile | null;
  started_by_user?: UserProfile | null;
  completed_by_user?: UserProfile | null;
  approvals?: ServiceApproval[];
}

// ============================================================================
// STEP 11 TYPES: VENDOR OUTSOURCING WORKFLOW & PURCHASE ORDERS
// ============================================================================
export type OutsourceStatus =
  | 'OUTSOURCE_REQUIRED'
  | 'VENDOR_SELECTED'
  | 'PO_DRAFT'
  | 'PO_ISSUED'
  | 'SENT_TO_VENDOR'
  | 'VENDOR_RECEIVED'
  | 'VENDOR_CALIBRATION'
  | 'VENDOR_COMPLETED'
  | 'AWAITING_RETURN'
  | 'RETURNED'
  | 'RECEIVED_BACK'
  | 'REINTEGRATED'
  | 'VENDOR_FAILED'
  | 'CANCELLED';

export type POStatus = 'DRAFT' | 'ISSUED' | 'ACKNOWLEDGED' | 'CLOSED' | 'CANCELLED';
export type MovementType = 'SEND_TO_VENDOR' | 'RETURN_FROM_VENDOR';
export type VendorCalibrationResult = 'PASS' | 'FAIL' | 'ADJUSTED' | 'NOT_CALIBRATABLE';

export interface VendorOutsourceRequest {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  request_id: string;
  request_item_id: string;
  calibration_id?: string | null;
  vendor_id: string;
  outsource_status: OutsourceStatus;
  outsource_reason: string;
  vendor_reference?: string | null;
  expected_return_date?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  returned_at?: string | null;
  received_by?: string | null;
  remarks?: string | null;
  vendor?: Vendor | null;
  request?: CalibrationRequest | null;
  request_item?: RequestItem | null;
  calibration?: Calibration | null;
  created_by_user?: UserProfile | null;
  received_by_user?: UserProfile | null;
  purchase_order?: PurchaseOrder | null;
  movements?: VendorOutsourceMovement[];
  vendor_calibration_record?: VendorCalibrationRecord | null;
}

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  po_number: string;
  vendor_id: string;
  request_id?: string | null;
  outsource_request_id?: string | null;
  po_date: string;
  status: POStatus;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  created_by: string;
  issued_by?: string | null;
  issued_at?: string | null;
  created_at: string;
  updated_at: string;
  remarks?: string | null;
  vendor?: Vendor | null;
  request?: CalibrationRequest | null;
  created_by_user?: UserProfile | null;
  issued_by_user?: UserProfile | null;
  items?: POItem[];
}

export interface POItem {
  id: string;
  tenant_id: string;
  purchase_order_id: string;
  request_item_id: string;
  item_id: string;
  description?: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  created_at: string;
  updated_at: string;
  item?: ItemMaster | null;
}

export interface VendorOutsourceMovement {
  id: string;
  tenant_id: string;
  outsource_request_id: string;
  movement_type: MovementType;
  tracking_number?: string | null;
  carrier?: string | null;
  movement_date: string;
  performed_by: string;
  remarks?: string | null;
  document_id?: string | null;
  created_at: string;
  performed_by_user?: UserProfile | null;
}

export interface VendorCalibrationRecord {
  id: string;
  tenant_id: string;
  outsource_request_id: string;
  vendor_id: string;
  vendor_certificate_number: string;
  vendor_result: VendorCalibrationResult;
  calibrated_at?: string | null;
  report_received_at: string;
  report_document_id?: string | null;
  remarks?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_user?: UserProfile | null;
  report_document?: DocumentItem | null;
}

export type QuotationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT_TO_CLIENT'
  | 'CLIENT_APPROVED'
  | 'CLIENT_REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export type QuotationClientResponse = 'PENDING' | 'APPROVED' | 'REJECTED';
export type QuotationApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface QuotationItem {
  id: string;
  tenant_id: string;
  quotation_id: string;
  request_item_id?: string | null;
  item_id: string;
  description?: string | null;
  quantity: number;
  consumed_quantity?: number;
  standard_cost: number;
  override_cost?: number | null;
  final_unit_cost: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  override_reason?: string | null;
  override_by?: string | null;
  override_at?: string | null;
  created_at: string;
  updated_at: string;
  item?: ItemMaster | null;
  request_item?: RequestItem | null;
  calibration_source?: 'INTERNAL' | 'VENDOR';
}

export interface QuotationApproval {
  id: string;
  tenant_id: string;
  quotation_id: string;
  approval_status: QuotationApprovalStatus;
  requested_by: string;
  approved_by?: string | null;
  approval_remarks?: string | null;
  requested_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  requested_by_user?: UserProfile | null;
  approved_by_user?: UserProfile | null;
}

export interface Quotation {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  quotation_number: string;
  quotation_type?: 'STANDALONE' | 'REQUEST_BASED';
  request_id?: string | null;
  client_id: string;
  quotation_date: string;
  valid_until: string;
  status: QuotationStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  version_number: number;
  parent_quotation_id?: string | null;
  created_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  sent_at?: string | null;
  client_response_at?: string | null;
  client_response: QuotationClientResponse;
  client_response_remarks?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  request?: CalibrationRequest | null;
  items?: QuotationItem[];
  approvals?: QuotationApproval[];
  created_by_user?: UserProfile | null;
  approved_by_user?: UserProfile | null;
}

export type InvoiceType = 'STANDARD' | 'PARTIAL' | 'URGENT';
export type InvoiceStatus = 'DRAFT' | 'READY' | 'ISSUED' | 'PAID' | 'SIGNATURE_REQUIRED' | 'SIGNED' | 'CANCELLED' | 'COMPLETED';

export interface InvoiceItem {
  id: string;
  tenant_id: string;
  invoice_id: string;
  request_item_id?: string | null;
  item_id: string;
  quotation_item_id?: string | null;
  description?: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  line_total: number;
  created_at: string;
  updated_at: string;
  item?: ItemMaster | null;
  request_item?: RequestItem | null;
  quotation_item?: QuotationItem | null;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  invoice_number: string;
  quotation_id: string;
  request_id?: string | null;
  client_id: string;
  invoice_date: string;
  due_date: string;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  urgent_reason?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  request?: CalibrationRequest | null;
  quotation?: Quotation | null;
  items?: InvoiceItem[];
  created_by_user?: UserProfile | null;
  signature?: Signature | null;
  signature_request?: InvoiceSignatureRequest | null;
}

export type SignatureType = 'INVOICE' | 'DELIVERY';
export type SignatureStatus = 'PENDING' | 'SIGNED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type SignatureRequestStatus = 'PENDING' | 'OPENED' | 'SIGNED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface Signature {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  invoice_id: string;
  client_id: string;
  signature_type: SignatureType;
  signature_status: SignatureStatus;
  signer_name: string;
  signer_role?: string | null;
  signer_email?: string | null;
  signer_phone?: string | null;
  signature_reference: string;
  signed_at?: string | null;
  signature_storage_reference?: string | null;
  document_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceSignatureRequest {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  invoice_id: string;
  client_id: string;
  request_reference: string;
  status: SignatureRequestStatus;
  requested_at: string;
  expires_at: string;
  created_by?: string | null;
  signer_name?: string | null;
  signer_role?: string | null;
  signer_email?: string | null;
  signer_phone?: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  created_at: string;
  updated_at: string;
  invoice?: Invoice | null;
  client?: Client | null;
}

export type DispatchType = 'STANDARD' | 'PARTIAL' | 'URGENT';
export type DispatchStatus =
  | 'READY_FOR_DISPATCH'
  | 'PACKING'
  | 'PACKED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type DeliveryStatus = 'DELIVERED' | 'PARTIALLY_DELIVERED' | 'REJECTED' | 'RETURNED';

export interface DispatchItem {
  id: string;
  tenant_id: string;
  dispatch_id: string;
  request_item_id: string;
  item_id: string;
  invoice_id?: string | null;
  invoice_item_id?: string | null;
  quantity: number;
  package_reference?: string | null;
  created_at: string;
  updated_at: string;
  item?: ItemMaster | null;
  request_item?: RequestItem | null;
  invoice_item?: InvoiceItem | null;
}

export interface Delivery {
  id: string;
  tenant_id: string;
  dispatch_id: string;
  client_id: string;
  recipient_name: string;
  recipient_role?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  delivery_date: string;
  delivery_status: DeliveryStatus;
  proof_of_delivery_storage_ref?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  signature?: Signature | null;
}

export interface Dispatch {
  id: string;
  tenant_id: string;
  organization_id?: string | null;
  sub_org_id?: string | null;
  dispatch_number: string;
  request_id: string;
  invoice_id?: string | null;
  client_id: string;
  dispatch_type: DispatchType;
  status: DispatchStatus;
  dispatch_date: string;
  expected_delivery_date?: string | null;
  carrier_name?: string | null;
  tracking_number?: string | null;
  shipping_address: string;
  billing_address?: string | null;
  urgent_reason?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  dispatched_by?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  request?: CalibrationRequest | null;
  invoice?: Invoice | null;
  items?: DispatchItem[];
  delivery?: Delivery | null;
  created_by_user?: UserProfile | null;
  dispatched_by_user?: UserProfile | null;
}

// ============================================================================
// STEP 16 TYPES: ANALYTICS, DASHBOARD, EXCEPTION CENTER & GLOBAL SEARCH
// ============================================================================

export interface DashboardSummary {
  totalRequests: number;
  pendingCollection: number;
  labQueue: number;
  pendingVerification: number;
  calibrationInProgress: number;
  faultyItems: number;
  servicePendingApproval: number;
  outsourcedItems: number;
  pendingQuotations: number;
  pendingApprovals: number;
  pendingInvoices: number;
  awaitingClientSignature: number;
  readyForDispatch: number;
  inTransit: number;
  awaitingDelivery: number;
  partiallyCompleted: number;
  completedRequests: number;
}

export interface WorkflowFunnelItem {
  stage: string;
  key: string;
  count: number;
}

export interface OperationException {
  id: string;
  request_number: string;
  client_name: string;
  item_code: string;
  item_name: string;
  serial_number: string;
  exception_type: string;
  created_date: string;
  current_status: string;
  target_route: string;
  action_label: string;
}

export interface DueCalibrationItem {
  id: string;
  item_code: string;
  item_name: string;
  serial_number: string;
  client_name: string;
  last_calibration_date?: string | null;
  next_due_date?: string | null;
  days_remaining: number;
  due_status: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';
  certificate_number: string;
}

export interface RequestTimelineEvent {
  timestamp: string;
  title: string;
  description: string;
  user_name: string;
  status: string;
}

export interface ItemProgressRow {
  item_id: string;
  item_code: string;
  item_name: string;
  serial_number: string;
  availability: string;
  verification: string;
  calibration: string;
  certificate: string;
  dispatch: string;
  delivery: string;
  final_status: string;
}

export interface GlobalSearchResult {
  type: string;
  reference: string;
  client: string;
  status: string;
  route: string;
}

export interface AuditLogRow {
  id: string;
  timestamp: string;
  user_name: string;
  action: string;
  module: string;
  resource_id?: string | null;
  old_values?: any;
  new_values?: any;
}







