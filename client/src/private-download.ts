import { JobHuntError } from './protocol.ts';
import type { PreparedDownload } from './package-contracts.ts';
import type { ExportDownload } from './export-contracts.ts';
import type { BundleDownload } from './bundle-contracts.ts';

/** Consume a storage grant separately from authenticated product requests. */
export async function downloadPDF(grant: PreparedDownload, fetchImpl: typeof fetch, timeoutMs: number, allowLoopback = false) {
  if (grant.media_type !== 'application/pdf') throw new JobHuntError('invalid_download');
  return downloadPrivateDocument(grant, fetchImpl, timeoutMs, allowLoopback);
}

export async function downloadPrivateDocument(grant: PreparedDownload | ExportDownload | BundleDownload, fetchImpl: typeof fetch, timeoutMs: number, allowLoopback = false) {
  const text = grant.media_type === 'text/markdown' || grant.media_type === 'text/plain';
  if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'text/markdown', 'text/plain'].includes(grant.media_type) ||
      !Number.isSafeInteger(grant.size_bytes) || grant.size_bytes < (text ? 1 : 5) || grant.size_bytes > 25000000) throw new JobHuntError('invalid_download');
  let url: URL;
  try { url = new URL(grant.url); } catch { throw new JobHuntError('invalid_download'); }
  const remaining = Date.parse(grant.expires_at) - Date.now();
  if (/[\s\\]/u.test(grant.url) || url.username || url.password || url.hash ||
      (url.protocol !== 'https:' && !(allowLoopback && url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname))) ||
      !Number.isFinite(remaining) || remaining <= 0 || remaining > 65000) throw new JobHuntError('invalid_download');
  try {
    const response = await fetchImpl(url, { method: 'GET', credentials: 'omit', redirect: 'error',
      headers: { Accept: grant.media_type }, signal: AbortSignal.timeout(timeoutMs) });
    if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== grant.media_type ||
        (response.headers.has('content-length') && response.headers.get('content-length') !== String(grant.size_bytes))) {
      await response.body?.cancel(); throw new JobHuntError('invalid_download');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new JobHuntError('invalid_download');
    const bytes = new Uint8Array(grant.size_bytes); let length = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        if (length + next.value.byteLength > bytes.byteLength) { await reader.cancel(); throw new JobHuntError('invalid_download'); }
        bytes.set(next.value, length); length += next.value.byteLength;
      }
    } finally { reader.releaseLock(); }
    let signature: boolean;
    if (text) {
      try {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        signature = !!decoded.trim() && !decoded.includes('\u0000');
      } catch { throw new JobHuntError('invalid_download'); }
    } else {
      signature = grant.media_type === 'application/pdf' ? new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-' :
        bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;
    }
    if (length !== bytes.byteLength || !signature) throw new JobHuntError('invalid_download');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== grant.sha256) throw new JobHuntError('download_checksum_mismatch');
    return bytes;
  } catch (error) {
    if (error instanceof JobHuntError) throw error;
    // Provider responses/errors can contain the signed URL or document data.
    throw new JobHuntError('download_failed');
  }
}

/** Decode a bounded private data-image directly; never fetch an image URL. */
export function privateJPEGBytes(chunks: string[]): Uint8Array {
  const invalid = (): never => { throw new JobHuntError('invalid_response'); };
  if (!Array.isArray(chunks) || !chunks.length || chunks.length > 12 || chunks.some(chunk => typeof chunk !== 'string' || chunk.length > 64000)) invalid();
  const encoded = chunks.join(''); const prefix = 'data:image/jpeg;base64,';
  if (!encoded.startsWith(prefix) || encoded.length > 750000) invalid();
  const raw = encoded.slice(prefix.length);
  if (raw.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(raw)) invalid();
  let bytes: Uint8Array;
  try { const data = atob(raw); if (btoa(data) !== raw) invalid(); bytes = Uint8Array.from(data, c => c.charCodeAt(0)); }
  catch { invalid(); }
  if (bytes!.length < 4 || bytes![0] !== 255 || bytes![1] !== 216 || bytes!.at(-2) !== 255 || bytes!.at(-1) !== 217) invalid();
  return bytes!;
}
