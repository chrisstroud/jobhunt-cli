/** Complete private record files; compact v2 models retain their original limits. */
import { JobHuntError, record, type JsonObject } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, resourceId, shape, uuid, type MutationIntent } from './journey-contracts.ts';
import { resumeHostFileInput, type HostResumeFile } from './import-file-contracts.ts';
import type { ApplicationRecordKind } from './application-record-contracts.ts';
export { digest } from './highlight-file-contracts.ts';

export const MAX_APPLICATION_RECORD_FIELDS_BYTES = 16 * 1024 * 1024;
export type ApplicationRecordFileRead = { application_id: string; kind: ApplicationRecordKind; record_id: string };
export type ApplicationRecordFileDirectory = { application_id: string; kind: ApplicationRecordKind; page?: number; per_page?: number };
export type ApplicationRecordFileIntent = MutationIntent & { expected_account_id: string; application_id: string; expected_revision: number; kind: ApplicationRecordKind; record_id?: string; expected_fingerprint?: string };
export type ApplicationRecordHostFile = ApplicationRecordFileIntent & { source_size: number; source_sha256: string; file: HostResumeFile };
export type ApplicationRecordFileManifest = ApplicationRecordFileRead & { account_id: string; revision: number; fingerprint: string; title: string; filename: string; mime: 'application/json'; format: 'jobhunt.application-record/v1'; size_bytes: number; chunk_bytes: 24000; chunk_count: number; sha256: string };
export type ApplicationRecordFileChunkRead = ApplicationRecordFileRead & { expected_fingerprint: string; expected_sha256: string; chunk_index: number };
export type ApplicationRecordFileChunk = ApplicationRecordFileManifest & { chunk_index: number; content_base64: string; chunk_sha256: string };
export type ApplicationRecordFilePage = { account_id: string; application_id: string; revision: number; kind: ApplicationRecordKind; items: ApplicationRecordFileManifest[]; page: number; per_page: number; pages: number; total: number };
export type ApplicationRecordFileSaved = { application_id: string; record_id: string; current: ApplicationRecordFileManifest | null };
const kinds = ['note', 'task', 'follow-up', 'interview', 'person'];
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const account = (v: unknown): v is string => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const targetKeys = ['application_id', 'kind', 'record_id'];
function target(value: JsonObject) { if (!uuid(value.application_id) || !kinds.includes(String(value.kind)) || !resourceId(value.record_id)) fail(); }
export function recordFileRead(value: unknown): ApplicationRecordFileRead {
  shape(value, targetKeys); target(value); return { ...value, application_id: String(value.application_id).toLowerCase() } as ApplicationRecordFileRead;
}
export function recordFileDirectory(value: unknown): ApplicationRecordFileDirectory {
  shape(value, ['application_id', 'kind', 'page', 'per_page']);
  if (!uuid(value.application_id) || !kinds.includes(String(value.kind)) || value.page !== undefined && !integer(value.page, 1, 10000) || value.per_page !== undefined && !integer(value.per_page, 1, 100)) fail();
  return { ...value, application_id: String(value.application_id).toLowerCase() } as ApplicationRecordFileDirectory;
}
export function recordFileIntent(value: unknown): ApplicationRecordFileIntent {
  shape(value, [...intentKeys, ...targetKeys, 'expected_revision', 'expected_fingerprint']); intent(value);
  if (!account(value.expected_account_id) || !uuid(value.application_id) || !kinds.includes(String(value.kind)) || !integer(value.expected_revision) ||
    (value.record_id == null ? value.expected_fingerprint != null : !resourceId(value.record_id) || !hash(value.expected_fingerprint))) fail();
  return { ...value, application_id: String(value.application_id).toLowerCase() } as ApplicationRecordFileIntent;
}
export function recordHostFile(value: unknown): ApplicationRecordHostFile {
  const keys = [...intentKeys, ...targetKeys, 'expected_revision', 'expected_fingerprint'];
  shape(value, [...keys, 'source_size', 'source_sha256', 'file']);
  const original = recordFileIntent(Object.fromEntries(keys.filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]])));
  resumeHostFileInput({ request_id: value.request_id, expected_account_id: value.expected_account_id, file: value.file });
  if (!integer(value.source_size, 1, MAX_APPLICATION_RECORD_FIELDS_BYTES) || !hash(value.source_sha256)) fail();
  return { ...value, ...original } as ApplicationRecordHostFile;
}
export function recordFileChunkInput(value: unknown): ApplicationRecordFileChunkRead {
  shape(value, [...targetKeys, 'expected_fingerprint', 'expected_sha256', 'chunk_index']); target(value);
  if (!hash(value.expected_fingerprint) || !hash(value.expected_sha256) || !integer(value.chunk_index, 1, Number.MAX_SAFE_INTEGER)) fail();
  return { ...value, application_id: String(value.application_id).toLowerCase() } as ApplicationRecordFileChunkRead;
}
export function manifest(value: unknown): value is ApplicationRecordFileManifest {
  return record(value) && account(value.account_id) && uuid(value.application_id) && kinds.includes(String(value.kind)) && resourceId(value.record_id) &&
    integer(value.revision) && hash(value.fingerprint) && typeof value.title === 'string' && [...value.title].length <= 255 &&
    value.filename === 'application-record-' + value.kind + '-' + value.record_id + '.json' && value.mime === 'application/json' && value.format === 'jobhunt.application-record/v1' &&
    integer(value.size_bytes, 1, Number.MAX_SAFE_INTEGER) && value.chunk_bytes === 24000 && integer(value.chunk_count, 1, Number.MAX_SAFE_INTEGER) &&
    value.chunk_count === Math.ceil(Number(value.size_bytes) / 24000) && hash(value.sha256);
}
export const recordFileManifestResult = (v: unknown) => journeyResult(v, manifest);
export const recordFileSavedResult = (v: unknown) => journeyResult(v, (data): data is ApplicationRecordFileSaved => record(data) && uuid(data.application_id) && resourceId(data.record_id) &&
  (data.current === null || manifest(data.current) && data.current.application_id === data.application_id && data.current.record_id === data.record_id));
export const recordFilePageResult = (v: unknown) => journeyResult(v, (data): data is ApplicationRecordFilePage => record(data) && account(data.account_id) && uuid(data.application_id) && kinds.includes(String(data.kind)) && integer(data.revision) &&
  Array.isArray(data.items) && data.items.length <= 100 && data.items.every(row => manifest(row) && row.account_id === data.account_id && row.application_id === data.application_id && row.kind === data.kind && row.revision === data.revision) &&
  new Set(data.items.map(row => row.record_id)).size === data.items.length && integer(data.page, 1, 10000) && integer(data.per_page, 1, 100) && integer(data.pages, 1, Number.MAX_SAFE_INTEGER) && integer(data.total, 0, Number.MAX_SAFE_INTEGER) &&
  data.pages === Math.max(1, Math.ceil(Number(data.total) / Number(data.per_page))) && Number(data.page) <= Number(data.pages) && data.items.length === Math.min(Number(data.per_page), Math.max(0, Number(data.total) - (Number(data.page) - 1) * Number(data.per_page))));
export const recordFileChunkResult = (v: unknown) => journeyResult(v, (data): data is ApplicationRecordFileChunk => {
  if (!record(data)) return false;
  const extra: Record<string, unknown> = data;
  return manifest(data) && integer(extra.chunk_index, 1, data.chunk_count) && typeof extra.content_base64 === 'string' &&
    extra.content_base64.length >= 4 && extra.content_base64.length <= 32000 && extra.content_base64.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/u.test(extra.content_base64) && hash(extra.chunk_sha256);
});
export function chunkBytes(value: ApplicationRecordFileChunk) {
  let decoded: string; try { decoded = atob(value.content_base64); } catch { throw new JobHuntError('invalid_response'); }
  const part = Uint8Array.from(decoded!, ch => ch.charCodeAt(0));
  if (btoa(decoded!) !== value.content_base64 || part.length !== Math.min(24000, value.size_bytes - (value.chunk_index - 1) * 24000)) throw new JobHuntError('invalid_response');
  return part;
}
export function verifiedRecord(bytes: Uint8Array, metadata: ApplicationRecordFileManifest): JsonObject {
  let value: unknown; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new JobHuntError('invalid_response'); }
  if (!record(value) || ['format', 'account_id', 'application_id', 'revision', 'kind', 'record_id', 'fingerprint'].some(key => value[key] !== metadata[key as keyof ApplicationRecordFileManifest]) || !record(value.fields)) throw new JobHuntError('invalid_response');
  const keys: Record<ApplicationRecordKind, string[]> = { note: ['title', 'body', 'status'], task: ['title', 'body', 'status', 'date'], 'follow-up': ['title', 'body', 'status', 'date', 'reminder_type'], interview: ['title', 'body', 'status', 'date', 'location', 'format', 'participants'], person: ['title', 'body', 'status', 'email', 'phone', 'linkedin_url'] };
  const fields = value.fields;
  if (fields.title !== metadata.title || Object.keys(fields).length !== keys[metadata.kind].length || keys[metadata.kind].some(key => key === 'participants' ? !Array.isArray(fields[key]) || fields[key].some(id => !uuid(id)) : typeof fields[key] !== 'string')) throw new JobHuntError('invalid_response');
  return value;
}
