/** Complete compensation bytes; product policy stays in the shared server. */
import { record } from './protocol.ts';
import { deadline, fail, integer, intent, intentKeys, journeyResult, shape, uuid, type MutationIntent } from './journey-contracts.ts';

export const compensationChunkBytes = 24000;
export const compensationMaxBytes = 16 * 1024 * 1024;
export type CompensationRead = { application_id: string };
export type CompensationChunkRead = CompensationRead & { expected_revision: number; expected_sha256: string; chunk_index: number };
export type CompensationManifest = CompensationRead & { account_id: string; revision: number; sha256: string; size_bytes: number;
  chunk_bytes: 24000; chunk_count: number; filename: string; mime: 'application/json' };
export type CompensationChunk = CompensationManifest & { chunk_index: number; base64: string; chunk_sha256: string };
export type CompensationReplaceIntent = MutationIntent & CompensationRead & { expected_revision: number; expected_sha256: string };
export type CompensationPrepare = CompensationReplaceIntent & { source_sha256: string; size_bytes: number };
export type CompensationDraftRead = CompensationRead & { draft_id: string };
export type CompensationDraftWrite = MutationIntent & CompensationDraftRead;
export type CompensationAppend = CompensationDraftWrite & { chunk_index: number; base64: string };
export type CompensationDraft = Omit<CompensationPrepare, 'request_id' | 'expected_account_id'> & { account_id: string; draft_id: string; received_bytes: number;
  next_chunk_index: number; chunk_bytes: 24000; status: 'open' | 'applied' | 'cancelled' | 'expired'; expires_at: string };
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);

export function compensationRead(v: unknown): CompensationRead {
  shape(v, ['application_id']); if (!uuid(v.application_id)) fail(); return v as CompensationRead;
}
export function compensationChunkRead(v: unknown): CompensationChunkRead {
  shape(v, ['application_id', 'expected_revision', 'expected_sha256', 'chunk_index']);
  if (!uuid(v.application_id) || !integer(v.expected_revision) || !digest(v.expected_sha256) || !integer(v.chunk_index, 1, Number.MAX_SAFE_INTEGER)) fail();
  return v as CompensationChunkRead;
}
export function compensationReplaceIntent(v: unknown): CompensationReplaceIntent {
  shape(v, [...intentKeys, 'application_id', 'expected_revision', 'expected_sha256']); intent(v);
  if (!uuid(v.application_id) || !integer(v.expected_revision) || !digest(v.expected_sha256)) fail();
  return v as CompensationReplaceIntent;
}
export function compensationPrepare(v: unknown): CompensationPrepare {
  shape(v, [...intentKeys, 'application_id', 'expected_revision', 'expected_sha256', 'source_sha256', 'size_bytes']);
  const { source_sha256: _source, size_bytes: _size, ...target } = v; compensationReplaceIntent(target);
  if (!digest(v.source_sha256) || !integer(v.size_bytes, 1, compensationMaxBytes)) fail();
  return v as CompensationPrepare;
}
export function compensationDraftRead(v: unknown): CompensationDraftRead {
  shape(v, ['application_id', 'draft_id']);
  if (!uuid(v.application_id) || !uuid(v.draft_id)) fail(); return v as CompensationDraftRead;
}
export function compensationDraftWrite(v: unknown): CompensationDraftWrite {
  shape(v, [...intentKeys, 'application_id', 'draft_id']); intent(v);
  compensationDraftRead({ application_id: v.application_id, draft_id: v.draft_id }); return v as CompensationDraftWrite;
}
export function compensationBytes(value: unknown, response = false): Uint8Array {
  if (typeof value !== 'string' || value.length < 4 || value.length > 32000 || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(value)) fail(response);
  try { const raw = atob(value); if (btoa(raw) !== value) fail(response); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
  catch { return fail(response); }
}
export function compensationAppend(v: unknown): CompensationAppend {
  shape(v, [...intentKeys, 'application_id', 'draft_id', 'chunk_index', 'base64']);
  const { chunk_index: _index, base64: _bytes, ...target } = v; compensationDraftWrite(target);
  if (!integer(v.chunk_index, 1, 700)) fail(); compensationBytes(v.base64); return v as CompensationAppend;
}
export async function compensationDigest(bytes: Uint8Array): Promise<string> {
  const data = Uint8Array.from(bytes);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('');
}
function manifest(v: unknown): v is CompensationManifest {
  return record(v) && typeof v.account_id === 'string' && v.account_id.startsWith('jh_') && uuid(v.account_id.slice(3)) &&
    uuid(v.application_id) && integer(v.revision) && digest(v.sha256) && integer(v.size_bytes, 1, Number.MAX_SAFE_INTEGER) &&
    v.chunk_bytes === 24000 && v.chunk_count === Math.ceil(Number(v.size_bytes) / 24000) &&
    v.filename === 'compensation-' + v.application_id + '.json' && v.mime === 'application/json';
}
export const compensationManifestResult = (v: unknown, args: CompensationRead) => journeyResult(v,
  (d): d is CompensationManifest => manifest(d) && d.application_id === args.application_id.toLowerCase());
export const compensationChunkResult = (v: unknown, args: CompensationChunkRead) => journeyResult(v, (d): d is CompensationChunk => {
  if (!record(d)) return false;
  const part = d;
  if (!manifest(d) || d.application_id !== args.application_id.toLowerCase() || d.revision !== args.expected_revision ||
      d.sha256 !== args.expected_sha256 || part.chunk_index !== args.chunk_index || args.chunk_index > d.chunk_count || !digest(part.chunk_sha256)) return false;
  try { return compensationBytes(part.base64, true).length === Math.min(24000, d.size_bytes - (args.chunk_index - 1) * 24000); }
  catch { return false; }
});
function draft(v: unknown): v is CompensationDraft {
  if (!record(v) || !uuid(v.draft_id) || !uuid(v.application_id) || typeof v.account_id !== 'string' || !v.account_id.startsWith('jh_') ||
      !uuid(v.account_id.slice(3)) || !integer(v.expected_revision) || !digest(v.expected_sha256) || !digest(v.source_sha256) ||
      !integer(v.size_bytes, 1, compensationMaxBytes) || !integer(v.received_bytes, 0, Number(v.size_bytes)) || v.chunk_bytes !== 24000 ||
      !integer(v.next_chunk_index, 1, 701) || !['open', 'applied', 'cancelled', 'expired'].includes(String(v.status)) || !deadline(v.expires_at)) return false;
  return v.next_chunk_index === Math.ceil(Number(v.received_bytes) / 24000) + 1 &&
    (v.received_bytes === v.size_bytes || Number(v.received_bytes) % 24000 === 0);
}
export const compensationDraftResult = (v: unknown, args: CompensationRead & Partial<CompensationDraftRead & CompensationPrepare>) => journeyResult(v,
  (d): d is CompensationDraft => draft(d) && d.application_id === args.application_id.toLowerCase() &&
    (!args.draft_id || d.draft_id === args.draft_id.toLowerCase()) &&
    (!args.expected_account_id || d.account_id === args.expected_account_id) &&
    (['expected_revision', 'expected_sha256', 'source_sha256', 'size_bytes'] as const).every(key => args[key] === undefined || d[key] === args[key]));

/** Stable child request IDs keep a resumed upload tied to its original intent. */
export async function compensationRequestId(root: string, name: string): Promise<string> {
  if (!uuid(root)) fail();
  const namespace = Uint8Array.from(root.replaceAll('-', '').match(/../gu)!, value => Number.parseInt(value, 16));
  const label = new TextEncoder().encode(name); const input = new Uint8Array(namespace.length + label.length);
  input.set(namespace); input.set(label, namespace.length);
  const value = new Uint8Array(await crypto.subtle.digest('SHA-1', input)).slice(0, 16);
  value[6] = (value[6] & 0x0f) | 0x50; value[8] = (value[8] & 0x3f) | 0x80;
  const hex = Array.from(value, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
