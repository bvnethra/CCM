export interface Env {
  ENVIRONMENT: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  JWT_SECRET: string;
  CALIBRATION_BUCKET?: R2Bucket;
  PDF_QUEUE?: Queue;
}

export interface UserContext {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  organizationId: string;
  subOrgId?: string;
  roles: string[];
  permissions: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export type RequestStatus =
  | 'CREATED'
  | 'COLLECTED'
  | 'LAB_QUEUE'
  | 'VERIFICATION'
  | 'CALIBRATION'
  | 'CALIBRATED'
  | 'QUOTATION'
  | 'APPROVAL'
  | 'INVOICE_PO'
  | 'CLIENT_SIGN'
  | 'READY_TO_DISPATCH'
  | 'DISPATCHED'
  | 'CLIENT_RECEIVED'
  | 'DELIVERY_SIGNED'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'DISCREPANCY'
  | 'FAULTY'
  | 'OUTSOURCED'
  | 'PARTIALLY_COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export interface ClientRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  subOrgId?: string;
  clientCode: string;
  clientName: string;
  address: string;
  billingAddress: string;
  gstTaxInfo?: string;
  contactPerson: string;
  phone: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  subOrgId?: string;
  vendorCode: string;
  vendorName: string;
  address: string;
  gstTaxInfo?: string;
  contactPerson: string;
  phone: string;
  email: string;
  servicedCategories: string[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface ItemMasterRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  subOrgId?: string;
  clientId?: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  measurementRange: string;
  leastCount: string;
  standardCost: number;
  calibrationFrequencyMonths: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface CalibrationRequestRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  subOrgId?: string;
  requestNumber: string;
  clientId: string;
  clientName?: string;
  collectionAgentId: string;
  collectionAgentName?: string;
  collectionDate: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: RequestStatus;
  remarks?: string;
  createdAt: string;
  items?: RequestItemRecord[];
}

export interface RequestItemRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  subOrgId?: string;
  requestId: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  serialNumber?: string;
  quantity: number;
  status: RequestStatus;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  isFaulty: boolean;
  isOutsourced: boolean;
  outsourceVendorId?: string;
  serviceNotes?: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  tenantId: string;
  organizationId?: string;
  subOrgId?: string;
  userId?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  timestamp: string;
  requestReference?: string;
}
