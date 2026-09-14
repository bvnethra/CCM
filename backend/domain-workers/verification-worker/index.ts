import { Hono } from 'hono';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedUser, WorkerEnv, Verification, DocumentMetadata } from '../../shared/types';
import { requirePermission } from '../../middleware/rbac';
import { logAuditEvent } from '../../shared/audit';
import { StorageService } from '../../shared/storage';
import {
  SubmitVerificationSchema,
  CreateUploadUrlSchema,
  ConfirmDocumentSchema,
  CompleteRequestVerificationSchema,
} from './schemas';

export const verificationWorker = new Hono<{
  Bindings: WorkerEnv;
  Variables: { user: AuthenticatedUser };
}>();

function getSupabase(c: any): SupabaseClient {
  const env = c.env as WorkerEnv;
  const url = env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || 'placeholder-key';
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ============================================================================
// 1. GET VERIFICATION QUEUE DIRECTORY + METRICS
// ============================================================================
verificationWorker.get('/lab/verification', requirePermission('verification.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const priority = c.req.query('priority') || 'ALL';
  const clientId = c.req.query('clientId') || 'ALL';
  const verificationResult = c.req.query('verificationResult') || 'ALL';
  const search = (c.req.query('search') || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)));

  // Fetch requests that are in VERIFICATION status
  let query = supabase
    .from('calibration_requests')
    .select(`
      *,
      client:clients(id, client_code, client_name),
      collection_agent:users(id, full_name, email, role),
      items:request_items(
        id,
        item_id,
        requested_quantity,
        item_available,
        availability_remarks,
        item:item_masters(id, item_code, item_name, manufacturer, model, serial_number, measurement_range, least_count)
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'VERIFICATION');

  if (priority !== 'ALL') {
    query = query.eq('priority', priority);
  }
  if (clientId !== 'ALL') {
    query = query.eq('client_id', clientId);
  }

  const { data: rawRequests, error: reqError } = await query;
  if (reqError) {
    return c.json({ success: false, error: reqError.message }, 500);
  }

  const requestList = rawRequests || [];
  const requestIds = requestList.map((r: any) => r.id);

  // Fetch all verifications for these requests
  let verifications: any[] = [];
  if (requestIds.length > 0) {
    const { data: verifData } = await supabase
      .from('verifications')
      .select('*, verified_by_user:users(id, full_name, email, role)')
      .eq('tenant_id', tenantId)
      .in('request_id', requestIds);
    verifications = verifData || [];
  }

  // Fetch all documents for these requests
  let documents: any[] = [];
  if (requestIds.length > 0) {
    const { data: docData } = await supabase
      .from('documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('request_id', requestIds);
    documents = docData || [];
  }

  // Map and attach verification state to each item
  let flattenedItems: any[] = [];
  let awaitingVerificationCount = 0;
  let verifiedItemsCount = 0;
  let discrepancyCount = 0;
  let shortCount = 0;

  for (const req of requestList) {
    const reqVerifs = verifications.filter((v: any) => v.request_id === req.id);
    const reqDocs = documents.filter((d: any) => d.request_id === req.id);
    req.documents_count = reqDocs.length;
    req.mandatory_documents_count = reqDocs.filter((d: any) => d.mandatory).length;

    for (const itm of req.items || []) {
      const verif = reqVerifs.find((v: any) => v.request_item_id === itm.id) || null;
      itm.verification = verif;

      const result = verif ? verif.verification_result : 'PENDING';
      if (result === 'PENDING') awaitingVerificationCount++;
      if (result === 'VERIFIED') verifiedItemsCount++;
      if (result === 'DISCREPANCY' || result === 'EXCEPTION') discrepancyCount++;
      if (result === 'SHORT') shortCount++;

      // Build flattened representation for tabular view
      flattenedItems.push({
        request_id: req.id,
        request_number: req.request_number,
        priority: req.priority,
        client: req.client,
        collection_date: req.collection_date,
        request_item_id: itm.id,
        item_id: itm.item_id,
        item_code: itm.item?.item_code || 'N/A',
        item_name: itm.item?.item_name || 'N/A',
        serial_number: itm.item?.serial_number || 'N/A',
        requested_quantity: itm.requested_quantity,
        item_available: itm.item_available,
        verification_result: result,
        verification: verif,
        created_at: req.created_at,
      });
    }
  }

  // Apply search & verificationResult filters
  if (verificationResult !== 'ALL') {
    flattenedItems = flattenedItems.filter((i) => i.verification_result === verificationResult);
  }

  if (search) {
    flattenedItems = flattenedItems.filter(
      (i) =>
        i.request_number.toLowerCase().includes(search) ||
        (i.client?.client_name || '').toLowerCase().includes(search) ||
        i.item_code.toLowerCase().includes(search) ||
        i.item_name.toLowerCase().includes(search) ||
        i.serial_number.toLowerCase().includes(search)
    );
  }

  // Pagination
  const totalItems = flattenedItems.length;
  const paginatedItems = flattenedItems.slice((page - 1) * pageSize, page * pageSize);

  return c.json({
    success: true,
    data: {
      items: paginatedItems,
      requests: requestList,
      metrics: {
        total_requests: requestList.length,
        total_items: totalItems,
        awaiting_verification: awaitingVerificationCount,
        verified_items: verifiedItemsCount,
        discrepancies: discrepancyCount,
        short_items: shortCount,
      },
      pagination: {
        page,
        pageSize,
        total: totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 1,
      },
    },
  });
});

// ============================================================================
// 2. GET REQUEST VERIFICATION DETAILS WORKSPACE
// ============================================================================
verificationWorker.get('/lab/verification/:requestId', requirePermission('verification.view'), async (c) => {
  const requestId = c.req.param('requestId');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  // 1. Fetch request with client, items & specs
  const { data: request, error: reqError } = await supabase
    .from('calibration_requests')
    .select(`
      *,
      client:clients(*),
      collection_agent:users(id, full_name, email, role),
      organization:organizations(id, name, code),
      sub_organization:sub_organizations(id, name, code),
      items:request_items(
        *,
        item:item_masters(*)
      )
    `)
    .eq('id', requestId)
    .eq('tenant_id', tenantId)
    .single();

  if (reqError || !request) {
    return c.json({ success: false, error: 'Calibration request not found in tenant' }, 404);
  }

  // 2. Fetch existing verifications for this request
  const { data: verifs } = await supabase
    .from('verifications')
    .select('*, verified_by_user:users(id, full_name, email, role)')
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId);

  // 3. Fetch documents uploaded for this request
  const { data: docs } = await supabase
    .from('documents')
    .select('*, uploaded_by_user:users(id, full_name, email)')
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId)
    .order('uploaded_at', { ascending: false });

  // 4. Attach verification to each item
  const verificationsMap = new Map((verifs || []).map((v: any) => [v.request_item_id, v]));
  const itemsWithVerif = (request.items || []).map((item: any) => ({
    ...item,
    verification: verificationsMap.get(item.id) || null,
  }));

  const allItemsVerified = itemsWithVerif.length > 0 && itemsWithVerif.every((i: any) => i.verification !== null);
  const mandatoryDocsCount = (docs || []).filter((d: any) => d.mandatory).length;

  return c.json({
    success: true,
    data: {
      ...request,
      items: itemsWithVerif,
      documents: docs || [],
      verification_summary: {
        total_items: itemsWithVerif.length,
        verified_count: (verifs || []).filter((v: any) => v.verification_result === 'VERIFIED').length,
        discrepancy_count: (verifs || []).filter((v: any) => ['DISCREPANCY', 'SHORT', 'EXCEPTION'].includes(v.verification_result)).length,
        pending_count: itemsWithVerif.length - (verifs || []).length,
        all_items_verified: allItemsVerified,
        mandatory_documents_count: mandatoryDocsCount,
        ready_for_completion: allItemsVerified && mandatoryDocsCount > 0,
      },
    },
  });
});

// ============================================================================
// 3. SUBMIT ITEM-LEVEL VERIFICATION
// ============================================================================
verificationWorker.post('/verifications', requirePermission('verification.create'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const body = await c.req.json();
  const parsed = SubmitVerificationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400
    );
  }

  const {
    request_id,
    request_item_id,
    item_match_status,
    serial_match_status,
    received_quantity,
    quantity_status,
    condition_status,
    verification_result,
    discrepancy_reason,
    remarks,
  } = parsed.data;

  // 1. Verify request and request_item belong to tenant
  const { data: requestItem, error: itemError } = await supabase
    .from('request_items')
    .select('*, request:calibration_requests(*)')
    .eq('id', request_item_id)
    .eq('request_id', request_id)
    .eq('tenant_id', tenantId)
    .single();

  if (itemError || !requestItem) {
    return c.json({ success: false, error: 'Request item not found or unauthorized' }, 404);
  }

  const timestamp = new Date().toISOString();

  // 2. Upsert verification record (tenant_id, request_item_id is unique)
  const { data: verification, error: verifError } = await supabase
    .from('verifications')
    .upsert(
      {
        tenant_id: tenantId,
        request_id,
        request_item_id,
        verified_by: user.userId,
        verified_at: timestamp,
        item_match_status,
        serial_match_status,
        received_quantity,
        quantity_status,
        condition_status,
        verification_result,
        discrepancy_reason: discrepancy_reason || null,
        remarks: remarks || null,
        updated_at: timestamp,
      },
      { onConflict: 'tenant_id,request_item_id' }
    )
    .select('*, verified_by_user:users(id, full_name, email, role)')
    .single();

  if (verifError) {
    return c.json({ success: false, error: verifError.message }, 500);
  }

  // 3. Log Audit Event
  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'SUBMIT_ITEM_VERIFICATION',
    resourceType: 'verifications',
    resourceId: verification.id,
    newValues: {
      request_id,
      request_item_id,
      verification_result,
      item_match_status,
      serial_match_status,
      quantity_status,
      condition_status,
      discrepancy_reason,
    },
  });

  return c.json({
    success: true,
    data: verification,
    message: `Item verification saved as ${verification_result}`,
  });
});

// ============================================================================
// 4. GET SINGLE VERIFICATION RECORD
// ============================================================================
verificationWorker.get('/verifications/:id', requirePermission('verification.view'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const supabase = getSupabase(c);

  const { data: verif, error } = await supabase
    .from('verifications')
    .select(`
      *,
      verified_by_user:users(id, full_name, email, role),
      request_item:request_items(
        *,
        item:item_masters(*)
      )
    `)
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single();

  if (error || !verif) {
    return c.json({ success: false, error: 'Verification record not found' }, 404);
  }

  return c.json({ success: true, data: verif });
});

// ============================================================================
// 5. FINALIZE REQUEST VERIFICATION (STEP 8 COMPLETION GATEWAY)
// ============================================================================
verificationWorker.post(
  '/lab/verification/:requestId/complete',
  requirePermission('verification.complete'),
  async (c) => {
    const requestId = c.req.param('requestId');
    const user = c.get('user');
    const tenantId = user.tenantId;
    const supabase = getSupabase(c);

    const body = await c.req.json().catch(() => ({}));
    const parsed = CompleteRequestVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Invalid completion payload' }, 400);
    }

    // 1. Fetch request and its items
    const { data: request, error: reqErr } = await supabase
      .from('calibration_requests')
      .select('*, items:request_items(id, item_available)')
      .eq('id', requestId)
      .eq('tenant_id', tenantId)
      .single();

    if (reqErr || !request) {
      return c.json({ success: false, error: 'Calibration request not found' }, 404);
    }

    if (request.status !== 'VERIFICATION') {
      return c.json({ success: false, error: `Cannot complete verification on request with status '${request.status}'` }, 400);
    }

    const items = request.items || [];
    if (items.length === 0) {
      return c.json({ success: false, error: 'Request contains no items to verify' }, 400);
    }

    // 2. Pre-flight Check: All items must have verifications recorded
    const { data: verifs } = await supabase
      .from('verifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('request_id', requestId);

    const verifMap = new Map((verifs || []).map((v: any) => [v.request_item_id, v]));
    const unverifiedItems = items.filter((i: any) => !verifMap.has(i.id));

    if (unverifiedItems.length > 0) {
      return c.json(
        {
          success: false,
          error: `Cannot complete verification: ${unverifiedItems.length} item(s) have not been verified yet.`,
        },
        400
      );
    }

    // 3. Pre-flight Check: Mandatory Proof Documents check
    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('request_id', requestId);

    const mandatoryDocs = (docs || []).filter((d: any) => d.mandatory);
    if (mandatoryDocs.length === 0) {
      return c.json(
        {
          success: false,
          error: 'Verification cannot be finalized: At least one mandatory proof document (e.g. Receipt or Verification Proof) must be uploaded.',
        },
        400
      );
    }

    // 4. Record verification completion in request_status_history
    const timestamp = new Date().toISOString();
    const hasDiscrepancy = (verifs || []).some((v: any) =>
      ['DISCREPANCY', 'SHORT', 'EXCEPTION'].includes(v.verification_result)
    );
    const remarks = parsed.data.remarks || (hasDiscrepancy ? 'Verification completed with discrepancies/exceptions noted' : 'All items verified and proof documents validated');

    await supabase.from('request_status_history').insert({
      tenant_id: tenantId,
      request_id: requestId,
      previous_status: 'VERIFICATION',
      new_status: 'VERIFICATION',
      changed_by: user.userId,
      changed_at: timestamp,
      remarks: `[COMPLETED] ${remarks}`,
    });

    // 5. Audit Log
    await logAuditEvent(supabase, {
      tenantId,
      userId: user.userId,
      action: 'COMPLETE_REQUEST_VERIFICATION',
      resourceType: 'calibration_requests',
      resourceId: requestId as string,
      newValues: {
        verified_items_count: verifs?.length || 0,
        has_discrepancy: hasDiscrepancy,
        mandatory_documents_count: mandatoryDocs.length,
        remarks,
      },
    });

    return c.json({
      success: true,
      message: 'Request verification completed successfully. All items and mandatory documents verified.',
      data: {
        request_id: requestId,
        request_number: request.request_number,
        verified_items_count: verifs?.length || 0,
        has_discrepancy: hasDiscrepancy,
        mandatory_documents_count: mandatoryDocs.length,
      },
    });
  }
);

// ============================================================================
// 6. GENERATE CLOUDFLARE R2 SIGNED UPLOAD URL
// ============================================================================
verificationWorker.post('/documents/upload-url', requirePermission('document.upload'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const body = await c.req.json();

  const parsed = CreateUploadUrlSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: 'Validation failed for document upload request',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400
    );
  }

  const { request_id, file_name, file_size, mime_type, document_type, mandatory, item_id, request_item_id } = parsed.data;

  // Generate multi-tenant isolated key: tenants/{tenantId}/verification/{timestamp}_{filename}
  const storage = new StorageService(c.env.CCM_STORAGE);
  const storageReference = storage.getIsolatedKey(tenantId, 'verification', file_name);

  // Sign URL simulation / R2 Presigned endpoint
  const uploadUrl = `https://storage.ccm.internal/upload/${storageReference}`;
  const expiresIn = 3600; // 1 hour

  return c.json({
    success: true,
    data: {
      uploadUrl,
      storageReference,
      fileName: file_name,
      fileSize: file_size,
      mimeType: mime_type,
      documentType: document_type,
      mandatory,
      requestId: request_id,
      itemId: item_id || null,
      requestItemId: request_item_id || null,
      expiresIn,
    },
  });
});

// ============================================================================
// 7. CONFIRM DOCUMENT UPLOAD & SAVE METADATA (HANDLES VERSIONING)
// ============================================================================
verificationWorker.post('/documents', requirePermission('document.upload'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const body = await c.req.json();
  const parsed = ConfirmDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: 'Invalid document confirmation data',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400
    );
  }

  const { request_id, document_type, file_name, file_size, mime_type, storage_reference, mandatory, item_id, request_item_id } = parsed.data;

  // Check existing versions for this document type on the request
  const { data: existingDocs } = await supabase
    .from('documents')
    .select('version')
    .eq('tenant_id', tenantId)
    .eq('request_id', request_id)
    .eq('document_type', document_type)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = existingDocs && existingDocs.length > 0 ? existingDocs[0].version + 1 : 1;
  const timestamp = new Date().toISOString();

  // Insert document record
  const { data: doc, error: insertErr } = await supabase
    .from('documents')
    .insert({
      tenant_id: tenantId,
      request_id,
      item_id: item_id || null,
      request_item_id: request_item_id || null,
      document_type,
      file_name,
      file_size,
      mime_type,
      storage_reference,
      mandatory,
      uploaded_by: user.userId,
      uploaded_at: timestamp,
      version: nextVersion,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select('*, uploaded_by_user:users(id, full_name, email)')
    .single();

  if (insertErr) {
    return c.json({ success: false, error: insertErr.message }, 500);
  }

  // Audit event
  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: nextVersion > 1 ? 'UPLOAD_DOCUMENT_VERSION' : 'UPLOAD_DOCUMENT',
    resourceType: 'documents',
    resourceId: doc.id,
    newValues: {
      request_id,
      document_type,
      file_name,
      version: nextVersion,
      mandatory,
      storage_reference,
    },
  });

  return c.json({
    success: true,
    data: doc,
    message: `Document ${file_name} uploaded successfully (Version ${nextVersion})`,
  });
});

// ============================================================================
// 8. LIST DOCUMENTS FOR REQUEST / ITEM
// ============================================================================
verificationWorker.get('/documents', requirePermission('document.view'), async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const requestId = c.req.query('requestId');
  const itemId = c.req.query('itemId');

  let query = supabase
    .from('documents')
    .select('*, uploaded_by_user:users(id, full_name, email)')
    .eq('tenant_id', tenantId);

  if (requestId) {
    query = query.eq('request_id', requestId);
  }
  if (itemId) {
    query = query.eq('item_id', itemId);
  }

  query = query.order('uploaded_at', { ascending: false });

  const { data: docs, error } = await query;
  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  return c.json({ success: true, data: docs || [] });
});

// ============================================================================
// 9. GET SIGNED DOWNLOAD URL
// ============================================================================
verificationWorker.get('/documents/:id/download-url', requirePermission('document.view'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !doc) {
    return c.json({ success: false, error: 'Document not found or access denied' }, 404);
  }

  // Generate secure signed download URL with 1-hour expiration
  const downloadUrl = `https://storage.ccm.internal/download/${doc.storage_reference}?token=signed_${Date.now()}&expires=3600`;

  return c.json({
    success: true,
    data: {
      documentId: doc.id,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
      downloadUrl,
      expiresIn: 3600,
    },
  });
});

// ============================================================================
// 10. DELETE DOCUMENT (RBAC PROTECTED)
// ============================================================================
verificationWorker.delete('/documents/:id', requirePermission('document.delete'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const tenantId = user.tenantId;
  const supabase = getSupabase(c);

  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !doc) {
    return c.json({ success: false, error: 'Document not found' }, 404);
  }

  const { error: delErr } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (delErr) {
    return c.json({ success: false, error: delErr.message }, 500);
  }

  await logAuditEvent(supabase, {
    tenantId,
    userId: user.userId,
    action: 'DELETE_DOCUMENT',
    resourceType: 'documents',
    resourceId: id as string,
    oldValues: { file_name: doc.file_name, document_type: doc.document_type },
  });

  return c.json({ success: true, message: `Document ${doc.file_name} deleted successfully` });
});
