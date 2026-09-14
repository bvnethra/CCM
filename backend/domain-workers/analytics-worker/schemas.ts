import { z } from 'zod';

export const DashboardFilterSchema = z.object({
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  organization_id: z.string().optional(),
  sub_org_id: z.string().optional(),
  client_id: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'all']).optional(),
  status: z.string().optional(),
  collection_agent_id: z.string().optional(),
  lab_user_id: z.string().optional(),
});

export const DueListQuerySchema = z.object({
  due_status: z.enum(['OVERDUE', 'DUE_SOON', 'UPCOMING', 'ALL']).optional().default('ALL'),
  client_id: z.string().optional(),
  item_type: z.string().optional(),
  manufacturer: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
});

export const ExceptionQuerySchema = z.object({
  exception_type: z.string().optional(),
  client_id: z.string().optional(),
  status: z.string().optional(),
});

export const AuditLogQuerySchema = z.object({
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  user_id: z.string().optional(),
  module: z.string().optional(),
  action: z.string().optional(),
  entity_type: z.string().optional(),
  request_number: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
});

export const GlobalSearchSchema = z.object({
  query: z.string().min(1, 'Search query must be at least 1 character'),
});

export const ReportFilterSchema = z.object({
  report_type: z.enum([
    'CALIBRATION_REQUEST_SUMMARY',
    'CALIBRATION_COMPLETION_SUMMARY',
    'FAULTY_ITEM_REPORT',
    'SERVICE_REPORT',
    'OUTSOURCING_REPORT',
    'QUOTATION_REPORT',
    'INVOICE_REPORT',
    'DISPATCH_REPORT',
    'DELIVERY_REPORT',
    'DUE_CALIBRATION_REPORT',
  ]),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  client_id: z.string().optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
});
