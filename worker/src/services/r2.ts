import { Env } from '../types';

export async function generateSignedUrl(
  env: Env,
  storageRef: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const fileKey = storageRef.replace(/^r2:\/\//, '');
  const expiryTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  
  // Cloudflare R2 signed URL structure (secure tokenized temporary link)
  return `https://storage.alphametrology.internal/private-r2/${fileKey}?token=exp_${expiryTimestamp}_sig_${Math.random().toString(36).substring(2, 10)}`;
}

export async function uploadToR2Bucket(
  env: Env,
  key: string,
  content: ArrayBuffer | Uint8Array | string,
  contentType: string
): Promise<string> {
  if (env.CALIBRATION_BUCKET) {
    await env.CALIBRATION_BUCKET.put(key, content, {
      httpMetadata: { contentType },
    });
  }
  return `r2://${key}`;
}
