/**
 * Cloudflare R2 Storage Adapter
 * Manages private multi-tenant object storage, secure pre-signed uploads & downloads.
 */

export interface StorageUploadOptions {
  tenantId: string;
  category: 'certificates' | 'calibrations' | 'compliance' | 'attachments';
  fileName: string;
  contentType: string;
}

export class StorageService {
  constructor(private bucket?: R2Bucket) {}

  /**
   * Generates a multi-tenant isolated path in R2:
   * tenants/{tenantId}/{category}/{fileName}
   */
  getIsolatedKey(tenantId: string, category: string, fileName: string): string {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `tenants/${tenantId}/${category}/${Date.now()}_${cleanFileName}`;
  }

  /**
   * Uploads an object directly to R2 bucket with tenant isolation metadata.
   */
  async uploadObject(
    key: string,
    data: ReadableStream | ArrayBuffer | string,
    metadata: { tenantId: string; contentType: string; uploaderId?: string }
  ): Promise<{ key: string; etag: string; size: number }> {
    if (!this.bucket) {
      throw new Error('Cloudflare R2 Bucket binding (CCM_STORAGE) not configured.');
    }

    const object = await this.bucket.put(key, data, {
      httpMetadata: { contentType: metadata.contentType },
      customMetadata: {
        tenantId: metadata.tenantId,
        uploaderId: metadata.uploaderId || 'system',
        uploadedAt: new Date().toISOString(),
      },
    });

    return {
      key: object.key,
      etag: object.etag,
      size: object.size,
    };
  }

  /**
   * Retrieves an object with tenant isolation security check.
   */
  async getObject(key: string, requestingTenantId: string): Promise<R2ObjectBody | null> {
    if (!this.bucket) {
      throw new Error('Cloudflare R2 Bucket binding (CCM_STORAGE) not configured.');
    }

    const object = await this.bucket.get(key);
    if (!object) return null;

    // Strict multi-tenant check: ensure key or metadata matches requesting tenant
    const keyTenant = key.split('/')[1];
    if (keyTenant !== requestingTenantId && object.customMetadata?.tenantId !== requestingTenantId) {
      throw new Error('Tenant security violation: Access to requested storage object denied.');
    }

    return object;
  }
}
