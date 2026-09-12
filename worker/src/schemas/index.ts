import { z } from 'zod';

export const ClientSchema = z.object({
  clientCode: z.string().min(2, 'Client Code is required'),
  clientName: z.string().min(2, 'Client Name is required'),
  address: z.string().min(5, 'Address is required'),
  billingAddress: z.string().min(5, 'Billing Address is required'),
  gstTaxInfo: z.string().optional(),
  contactPerson: z.string().min(2, 'Contact Person is required'),
  phone: z.string().min(5, 'Phone number is required'),
  email: z.string().email('Valid Email is required'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const VendorSchema = z.object({
  vendorCode: z.string().min(2, 'Vendor Code is required'),
  vendorName: z.string().min(2, 'Vendor Name is required'),
  address: z.string().min(5, 'Address is required'),
  gstTaxInfo: z.string().optional(),
  contactPerson: z.string().min(2, 'Contact Person is required'),
  phone: z.string().min(5, 'Phone number is required'),
  email: z.string().email('Valid Email is required'),
  servicedCategories: z.array(z.string()).default([]),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const ItemMasterSchema = z.object({
  itemCode: z.string().min(2, 'Item Code is required'),
  itemName: z.string().min(2, 'Item Name is required'),
  itemType: z.string().min(2, 'Item Type is required'),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  model: z.string().min(1, 'Model is required'),
  serialNumber: z.string().min(1, 'Serial Number is required'),
  measurementRange: z.string().optional(),
  leastCount: z.string().optional(),
  standardCost: z.number().min(0, 'Standard cost must be >= 0'),
  calibrationFrequencyMonths: z.number().int().min(1).default(12),
  clientId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const CreateRequestItemSchema = z.object({
  itemId: z.string().uuid('Valid item ID required'),
  quantity: z.number().int().min(1).default(1),
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
});

export const CreateCalibrationRequestSchema = z.object({
  clientId: z.string().uuid('Client ID is required'),
  collectionDate: z.string().min(1, 'Collection Date is required'),
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  remarks: z.string().optional(),
  items: z.array(CreateRequestItemSchema).min(1, 'At least one request item is required'),
});

export const VerifyItemSchema = z.object({
  requestId: z.string().uuid(),
  requestItemId: z.string().uuid(),
  outcome: z.enum(['VERIFIED', 'DISCREPANCY', 'SHORT', 'OTHER_EXCEPTION']),
  physicalMatch: z.boolean(),
  conditionNotes: z.string().optional(),
  discrepancyDetails: z.string().optional(),
});

export const PerformCalibrationSchema = z.object({
  requestId: z.string().uuid(),
  requestItemId: z.string().uuid(),
  calibrationDate: z.string(),
  standardUsed: z.string().min(2, 'Standard used is required'),
  measurementResults: z.record(z.any()),
  resultStatus: z.enum(['PASS', 'FAIL', 'FAULTY', 'OUTSOURCE']),
  calibrationFrequencyMonths: z.number().int().min(1).default(12),
  remarks: z.string().optional(),
});

export const FaultyServiceSchema = z.object({
  requestId: z.string().uuid(),
  requestItemId: z.string().uuid(),
  action: z.enum(['REQUEST_SERVICE', 'CLIENT_APPROVED', 'CLIENT_REJECTED']),
  serviceNotes: z.string(),
});

export const VendorOutsourceSchema = z.object({
  requestId: z.string().uuid(),
  requestItemId: z.string().uuid(),
  vendorId: z.string().uuid(),
  poNumber: z.string(),
  poAmount: z.number(),
  notes: z.string().optional(),
});

export const QuotationItemSchema = z.object({
  requestItemId: z.string().uuid().optional(),
  description: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  isOverride: z.boolean().default(false),
  taxRate: z.number().default(18),
});

export const CreateQuotationSchema = z.object({
  requestId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  items: z.array(QuotationItemSchema).min(1),
  discountAmount: z.number().default(0),
  terms: z.string().optional(),
  costOverrideReason: z.string().optional(),
});

export const ApproveQuotationSchema = z.object({
  quotationId: z.string().uuid(),
  status: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().optional(),
});

export const CreateInvoiceSchema = z.object({
  requestId: z.string().uuid(),
  clientId: z.string().uuid(),
  requestItemIds: z.array(z.string().uuid()).min(1),
  discountAmount: z.number().default(0),
  isPartialProcessing: z.boolean().default(false),
});

export const CaptureSignatureSchema = z.object({
  requestId: z.string().uuid(),
  signatureType: z.enum(['INVOICE_APPROVAL', 'DELIVERY_RECEIPT']),
  signerName: z.string().min(2, 'Signer Name is required'),
  signerEmail: z.string().email().optional(),
  signatureData: z.string().min(10, 'Signature data is required'),
});

export const CreateDispatchSchema = z.object({
  requestId: z.string().uuid(),
  clientId: z.string().uuid(),
  requestItemIds: z.array(z.string().uuid()).min(1),
  courierName: z.string().min(2, 'Courier Name is required'),
  trackingNumber: z.string().min(2, 'Tracking Number is required'),
  dispatchDate: z.string(),
});

export const ConfirmDeliverySchema = z.object({
  dispatchId: z.string().uuid(),
  requestId: z.string().uuid(),
  receivedBy: z.string().min(2, 'Received By name is required'),
  deliverySignatureData: z.string().min(10, 'Delivery Signature is required'),
  receivedDate: z.string(),
});
