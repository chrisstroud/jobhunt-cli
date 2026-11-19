/** Full native JSON originals; receipts contain only IDs, hashes and status. */
import type { JobHuntClient } from './index.ts';
import { isNativeJson as jsonValue, stableJsonValue as stable } from './native-json.ts';
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, shape, uuid, journeyResult } from './journey-contracts.ts';
import { resumeHostFileInput, type HostResumeFile } from './import-file-contracts.ts';

export const RESUME_SAVE_OPERATION = 'native_save_resume_profile_v1' as const;
export const MAX_RESUME_SAVE_BYTES = 16 * 1024 * 1024 + 65536;
export type ResumeSaveFields = { expected_revision: number; name?: string; description?: string | null;
  layout?: string | null; content?: JsonObject; is_default?: boolean };
export type ResumeSaveInput = { request_id: string; expected_account_id: string; document_id: string;
  slug: string; fields: ResumeSaveFields };
export type ResumeSaveOriginal = Omit<ResumeSaveInput, 'fields'> & { expected_revision: number;
  source_size: number; source_sha256: string; fields_supplied: string[] };
export type ResumeSaveHostFile = ResumeSaveOriginal & { file: HostResumeFile };
export type ResumeSaveClosure = { request_id: string; document_id: string; payload_hash: string;
  outcome: 'closed' | 'recorded' | 'expired' };
export type ResumeSaveReceipt = { id: string; kind: typeof RESUME_SAVE_OPERATION; status: 'succeeded';
  resource_type: 'document'; result: { resource_id: string; revision: number; status: 'saved'; related_ids: [] };
  retry_expires_at: string; retry_after_seconds: 0 };
const fieldNames = ['name', 'description', 'layout', 'content', 'is_default'];
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const account = (value: unknown): value is string => typeof value === 'string' && value.startsWith('jh_') && uuid(value.slice(3));
const slug = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$/u.test(value);
async function digest(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))),
    byte => byte.toString(16).padStart(2, '0')).join('');
}
export function resumeSaveInput(value: unknown): ResumeSaveInput {
  shape(value, ['request_id', 'expected_account_id', 'document_id', 'slug', 'fields']);
  if (!uuid(value.request_id) || !uuid(value.document_id) || !account(value.expected_account_id) || !slug(value.slug)) fail();
  const fields = value.fields;
  shape(fields, ['expected_revision', ...fieldNames]);
  if (!integer(fields.expected_revision) || !fieldNames.some(key => Object.hasOwn(fields, key)) || !jsonValue(fields)) fail();
  if (fields.name !== undefined && (typeof fields.name !== 'string' || !fields.name.trim()
    || [...fields.name].length > 255 || /\p{C}/u.test(fields.name))) fail();
  if (['description', 'layout'].some(key => fields[key] !== undefined && fields[key] !== null && typeof fields[key] !== 'string')) fail();
  if (Object.hasOwn(fields, 'content') && !record(fields.content)) fail();
  if (Object.hasOwn(fields, 'is_default') && typeof fields.is_default !== 'boolean') fail();
  return value as ResumeSaveInput;
}
export function resumeSaveOriginal(value: unknown): ResumeSaveOriginal {
  shape(value, ['request_id', 'expected_account_id', 'document_id', 'slug', 'expected_revision',
    'source_size', 'source_sha256', 'fields_supplied']);
  if (!uuid(value.request_id) || !uuid(value.document_id) || !account(value.expected_account_id) || !slug(value.slug)
    || !integer(value.expected_revision) || !integer(value.source_size, 1, MAX_RESUME_SAVE_BYTES) || !hash(value.source_sha256)
    || !Array.isArray(value.fields_supplied) || !value.fields_supplied.length || value.fields_supplied.length > 5
    || value.fields_supplied.some(key => typeof key !== 'string' || !fieldNames.includes(key))
    || new Set(value.fields_supplied).size !== value.fields_supplied.length
    || value.fields_supplied.join() !== [...value.fields_supplied].sort().join()) fail();
  return value as ResumeSaveOriginal;
}
export async function resumeSaveOriginalHash(value: ResumeSaveOriginal) {
  return digest(new TextEncoder().encode(JSON.stringify(stable(resumeSaveOriginal(value)))));
}
export async function prepareResumeSave(value: ResumeSaveInput) {
  const input = resumeSaveInput(value);
  const pointer = { request_id: input.request_id.toLowerCase(),
    expected_account_id: 'jh_' + input.expected_account_id.slice(3).toLowerCase(), document_id: input.document_id.toLowerCase() };
  // Snapshot before the first await: a caller cannot change the hashed source
  // while digesting or dispatching it. The HTTP client serializes this same body.
  const text = JSON.stringify(stable({ data: { type: 'resume_template', attributes: input.fields }, meta: { resume_save: pointer } }));
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_RESUME_SAVE_BYTES) fail();
  const body = JSON.parse(text) as JsonObject;
  const fields = (body.data as JsonObject).attributes as ResumeSaveFields;
  const original: ResumeSaveOriginal = { ...pointer, slug: input.slug, expected_revision: fields.expected_revision,
    source_size: bytes.length, source_sha256: await digest(bytes), fields_supplied: Object.keys(fields).filter(key => key !== 'expected_revision').sort() };
  return { body, original, payloadHash: await resumeSaveOriginalHash(original) };
}
export function resumeSaveReceipt(value: unknown, original: ResumeSaveOriginal): ResumeSaveReceipt {
  if (!record(value) || !uuid(value.id) || value.kind !== RESUME_SAVE_OPERATION || value.status !== 'succeeded'
    || value.resource_type !== 'document' || !record(value.result) || value.result.resource_id !== original.document_id
    || !integer(value.result.revision) || Number(value.result.revision) <= original.expected_revision
    || value.result.status !== 'saved' || !Array.isArray(value.result.related_ids) || value.result.related_ids.length
    || typeof value.retry_expires_at !== 'string' || !Number.isFinite(Date.parse(value.retry_expires_at))
    || value.retry_after_seconds !== 0) fail(true);
  return value as ResumeSaveReceipt;
}
export async function resumeSaveResponse(value: unknown, original: ResumeSaveOriginal) {
  if (!record(value) || value.ok !== true || !record(value.resume_save)
    || value.resume_save.request_id !== original.request_id || value.resume_save.source_size !== original.source_size
    || value.resume_save.source_sha256 !== original.source_sha256
    || value.resume_save.payload_hash !== await resumeSaveOriginalHash(original)) fail(true);
  return resumeSaveReceipt(value.operation, original);
}
export async function resumeSaveClosureResponse(value: unknown, original: ResumeSaveOriginal): Promise<ResumeSaveClosure> {
  const expectedHash = await resumeSaveOriginalHash(original);
  const parsed = journeyResult(value, (data): data is ResumeSaveClosure => record(data)
    && data.request_id === original.request_id && data.document_id === original.document_id
    && data.payload_hash === expectedHash && ['closed', 'recorded', 'expired'].includes(String(data.outcome)));
  if (!parsed.data) fail(true);
  return parsed.data;
}
export class ResumeSaveClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async save(input: ResumeSaveInput) {
    const prepared = await prepareResumeSave(input);
    const response = await this.client.request('/api/v1/resume-templates/' + encodeURIComponent(prepared.original.slug) + '?return=receipt',
      { method: 'PATCH', body: prepared.body });
    return { original: prepared.original, operation: await resumeSaveResponse(response, prepared.original) };
  }
  async check(input: ResumeSaveOriginal) {
    const original = resumeSaveOriginal(input);
    const query = new URLSearchParams({ request_id: original.request_id, expected_account_id: original.expected_account_id,
      document_id: original.document_id, expected_payload_hash: await resumeSaveOriginalHash(original) });
    const response = await this.client.request('/api/v1/resume-templates/save-original/status?' + query);
    if (!record(response) || response.ok !== true) fail(true);
    return resumeSaveReceipt(response.operation, original);
  }
  async close(input: ResumeSaveOriginal, confirmClose: true) {
    if (confirmClose !== true) fail();
    const original = JSON.parse(JSON.stringify(resumeSaveOriginal(input))) as ResumeSaveOriginal;
    const response = await this.client.request('/api/v1/journey/close_resume_profile_original_v1',
      { method: 'POST', body: { ...original, confirm_close: true } });
    return resumeSaveClosureResponse(response, original);
  }
  async host(input: ResumeSaveHostFile) {
    const original = resumeSaveOriginal(Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'file')));
    resumeHostFileInput({ request_id: original.request_id, expected_account_id: original.expected_account_id, file: input.file });
    const response = await this.client.request('/api/v1/journey/save_resume_profile_file_v1', { method: 'POST', body: { ...input } });
    const parsed = journeyResult(response, (value): value is { document_id: string; revision: number } => record(value)
      && value.document_id === original.document_id && integer(value.revision) && Number(value.revision) > original.expected_revision);
    if (!parsed.operation || parsed.operation.kind !== RESUME_SAVE_OPERATION || parsed.operation.status !== 'succeeded'
      || parsed.operation.resource?.id !== original.document_id || parsed.operation.resource.revision !== parsed.data?.revision) fail(true);
    return parsed;
  }
}
