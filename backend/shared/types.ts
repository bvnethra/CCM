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
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
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

export type CalibrationRequestPriority = 'NORMAL' | 'URGENT';
export type CalibrationRequestStatus = 'CREATED' | 'COLLECTED' | 'LAB_QUEUE' | 'VERIFICATION' | 'ON_HOLD' | 'CANCELLED';
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
  items?: RequestItem[];
  items_count?: number;
  available_items_count?: number;
  unavailable_items_count?: number;
  current_assignment?: LabRequestAssignment | null;
  assignments?: LabRequestAssignment[];
  status_history?: RequestStatusHistory[];
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
  created_at: string;
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
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}

export interface WorkerEnv {
  ENVIRONMENT?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  JWT_SECRET?: string;
  CCM_STORAGE?: R2Bucket;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenant_id?: string;
  organizationId?: string | null;
  subOrganizationId?: string | null;
  subOrgId?: string | null;
  permissions: string[];
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
    role: string;
  } | null;
  request_item?: any;
}

export interface DocumentMetadata {
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
  } | null;
  download_url?: string;
}
