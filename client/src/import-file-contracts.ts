/** File transport only; parsing, extraction and fact confirmation are server-owned. */
import { type MutationIntent, intent, intentKeys, shape, fail, text, integer, resourceId, deadline,
  journeyResult } from './journey-contracts.ts';
import { record, JobHuntError } from './protocol.ts';

export const MAX_RESUME_FILE_BYTES = 10 * 1024 * 1024;
export type ResumeFileUpload = MutationIntent;
export type HostResumeFile = { download_url: string; file_id: string; mime_type?: string; file_name?: string };
export type ResumeHostFileImport = MutationIntent & { file: HostResumeFile };
export type ResumeUploadTransport = 'auto' | 'multipart' | 'direct';
export type PrepareResumeFileUpload = MutationIntent & { size_bytes: number; sha256: string; media_type: string };
export type ImportUploadedResume = MutationIntent & { upload_id: string };
export type PrivateResumeUpload = {
  id: string; status: 'awaiting_upload' | 'accepted'; size_bytes: number; sha256: string; media_type: string;
  expires_at: string; import_id?: string | null;
  upload?: { url: string; method: 'PUT'; headers: Record<string, string>; expires_at: string; reusable_until_expiry: true } | null;
};
const checksum = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const media = (value: unknown) => ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(String(value));

export function prepareResumeUploadInput(value: unknown): PrepareResumeFileUpload {
  shape(value, [...intentKeys, 'size_bytes', 'sha256', 'media_type']); intent(value);
  if (!integer(value.size_bytes, 1, MAX_RESUME_FILE_BYTES) || !checksum(value.sha256) || !media(value.media_type)) fail();
  return value as PrepareResumeFileUpload;
}
export function importUploadedResumeInput(value: unknown): ImportUploadedResume {
  shape(value, [...intentKeys, 'upload_id']); intent(value);
  if (!resourceId(value.upload_id)) fail(); return value as ImportUploadedResume;
}
export function privateResumeUploadResult(value: unknown) {
  return journeyResult(value, (v): v is PrivateResumeUpload => {
    if (!record(v) || !resourceId(v.id) || !integer(v.size_bytes, 1, MAX_RESUME_FILE_BYTES) ||
        !checksum(v.sha256) || !media(v.media_type) || !deadline(v.expires_at)) return false;
    if (v.status === 'accepted') return resourceId(v.import_id) && v.upload == null;
    const g = v.upload;
    return v.status === 'awaiting_upload' && v.import_id == null && record(g) && text(g.url, 8192) &&
      g.method === 'PUT' && deadline(g.expires_at) && g.reusable_until_expiry === true && record(g.headers) &&
      Object.keys(g.headers).length === 4 && Object.entries(g.headers).every(([k, val]) =>
        ['Content-Type', 'Content-Length', 'x-amz-meta-sha256', 'x-amz-checksum-sha256'].includes(k) && text(val, 255));
  });
}

/** No product credential, cookies, redirects, response body or automatic retry. */
export async function putResumeBytes(upload: PrivateResumeUpload, bytes: Uint8Array, fetchImpl: typeof fetch,
  timeoutMs: number, allowLoopback: boolean) {
  const grant = upload.upload;
  if (!grant) throw new JobHuntError('invalid_upload');
  let url: URL;
  try { url = new URL(grant.url); } catch { throw new JobHuntError('invalid_upload'); }
  const remaining = Date.parse(grant.expires_at) - Date.now();
  const encoded = btoa(String.fromCharCode(...upload.sha256.match(/../gu)!.map(v => parseInt(v, 16))));
  if (/[\s\\]/u.test(grant.url) || url.username || url.password || url.hash ||
      (url.protocol !== 'https:' && !(allowLoopback && url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname))) ||
      !Number.isFinite(remaining) || remaining <= 0 || remaining > 65000 || bytes.byteLength !== upload.size_bytes ||
      grant.headers['Content-Length'] !== String(upload.size_bytes) || grant.headers['Content-Type'] !== upload.media_type ||
      grant.headers['x-amz-meta-sha256'] !== upload.sha256 || grant.headers['x-amz-checksum-sha256'] !== encoded)
    throw new JobHuntError('invalid_upload');
  try {
    const response = await fetchImpl(url, { method: 'PUT', credentials: 'omit', redirect: 'error',
      headers: grant.headers, body: new Uint8Array(bytes), signal: AbortSignal.timeout(timeoutMs) });
    await response.body?.cancel();
    if (response.status !== 200 && response.status !== 204) throw new JobHuntError('upload_failed');
  } catch { throw new JobHuntError('upload_failed'); }
}

export function resumeFileUploadInput(value: unknown): ResumeFileUpload {
  shape(value, intentKeys); intent(value); return value as ResumeFileUpload;
}
export function resumeHostFileInput(value: unknown): ResumeHostFileImport {
  shape(value, [...intentKeys, 'file']); intent(value);
  shape(value.file, ['download_url', 'file_id', 'mime_type', 'file_name']);
  if (!text(value.file.download_url, 2048) || !(value.file.download_url as string).length ||
      !text(value.file.file_id, 256) || !(value.file.file_id as string).length ||
      (value.file.mime_type !== undefined && !text(value.file.mime_type, 255)) ||
      (value.file.file_name !== undefined && !text(value.file.file_name, 255))) fail();
  // Exact allowed download hosts and SSRF defense belong to the product service.
  return value as ResumeHostFileImport;
}

export function resumeFileKind(bytes: Uint8Array): 'pdf' | 'docx' {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_RESUME_FILE_BYTES) fail();
  if (bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45) return 'pdf';
  if (bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4) return 'docx';
  fail();
}
