import { ApiResponse } from '../types';

const API_BASE_URL = 'http://localhost:8787'; // Cloudflare worker dev server or direct fallback

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token') || 'dev-token';
  const activeTenantId = localStorage.getItem('tenantId') || 'a0000000-0000-0000-0000-000000000001';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': activeTenantId,
    ...(options.headers as Record<string, string>),
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    // If worker dev server is offline, fallback seamlessly to worker mock responses
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'API connection failed',
      },
    };
  }
}
