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

export interface User {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  tenantName?: string;
  organizationId: string;
  subOrgId?: string;
  roles: string[];
  permissions: string[];
}

export interface Client {
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
  createdAt: string;
}

export interface Vendor {
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

export interface ItemMaster {
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
  isAvailable: boolean;
  availabilityReason?: string;
  createdAt: string;
}

export interface RequestItem {
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
  isAvailable: boolean;
  availabilityStatus?: 'AVAILABLE' | 'UNAVAILABLE' | 'ON_HOLD';
  availabilityReason?: string;
  isFaulty: boolean;
  isOutsourced: boolean;
  outsourceVendorId?: string;
  serviceNotes?: string;
  createdAt: string;
}

export interface CalibrationRequest {
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
  items?: RequestItem[];
}

export interface CalibrationRecord {
  id: string;
  tenantId: string;
  requestId: string;
  requestItemId: string;
  technicianId: string;
  calibrationDate: string;
  standardUsed: string;
  measurementResults: any;
  resultStatus: 'PASS' | 'FAIL' | 'FAULTY' | 'OUTSOURCE';
  calibrationFrequencyMonths: number;
  nextDueDate: string;
  certificateNumber: string;
  remarks?: string;
}

export interface Quotation {
  id: string;
  tenantId: string;
  quotationNumber: string;
  requestId?: string;
  clientId: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  terms?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISED';
  costOverrideReason?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  requestId?: string;
  clientId: string;
  invoiceDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  isPartialProcessing: boolean;
  createdAt: string;
}

export interface AuditLog {
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
