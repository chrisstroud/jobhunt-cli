/** Complete native creation originals; no career confirmation or implicit identity. */
import type { JobHuntClient } from './index.ts';
import { isNativeJson, stableJsonValue } from './native-json.ts';
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, shape, uuid, journeyResult } from './journey-contracts.ts';
import { resumeHostFileInput, type HostResumeFile } from './import-file-contracts.ts';

export const DOCUMENT_CREATION_OPERATION = 'native_create_document_v1' as const;
export const MAX_NATIVE_DOCUMENT_BYTES = 16 * 1024 * 1024;
export const MAX_DOCUMENT_CREATION_BYTES = MAX_NATIVE_DOCUMENT_BYTES + 65536;
export type DocumentCreationFields = { name: string; content: JsonObject; description?: string | null;
  layout?: string | null; is_default?: boolean; archetype?: 'structured' | 'letter' | 'reference' | 'statement';
  document_subtype?: string | null; contact_profile_id?: string | null };
export type DocumentCreationInput = { request_id: string; expected_account_id: string; document_id: string;
  fields: DocumentCreationFields };
export type DocumentCreationOriginal = Omit<DocumentCreationInput, 'fields'> & {
  source_size: number; source_sha256: string; fields_supplied: string[] };
export type DocumentCreationClosure = { request_id: string; document_id: string; payload_hash: string;
  outcome: 'closed' | 'recorded' | 'expired' };
export type DocumentCreationEvidence = { document_id: string; slug: string; revision: number;
  request_id: string; payload_hash: string };
export type DocumentCreationReceipt = { id: string; kind: typeof DOCUMENT_CREATION_OPERATION; status: 'succeeded';
  resource_type: 'document'; result: { resource_id: string; revision: number; status: 'saved'; related_ids: [] };
  retry_expires_at: string; retry_after_seconds: 0 };
const fields = ['name', 'content', 'description', 'layout', 'is_default', 'archetype', 'document_subtype', 'contact_profile_id'];
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const account = (value: unknown): value is string => typeof value === 'string' && value.startsWith('jh_') && uuid(value.slice(3));
async function digest(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))),
    byte => byte.toString(16).padStart(2, '0')).join('');
}
export function documentCreationSlug(documentId: string) {
  if (!uuid(documentId)) fail();
  return 'resume-' + documentId.toLowerCase().replaceAll('-', '');
}
export function documentCreationInput(value: unknown): DocumentCreationInput {
  shape(value, ['request_id', 'expected_account_id', 'document_id', 'fields']);
  if (!uuid(value.request_id) || !uuid(value.document_id) || !account(value.expected_account_id)) fail();
  const data = value.fields;
  shape(data, fields);
  if (!isNativeJson(data) || typeof data.name !== 'string' || !data.name.trim()
    || [...data.name].length > 255 || /\p{C}/u.test(data.name) || !record(data.content)) fail();
  if (['description', 'layout', 'document_subtype'].some(key => Object.hasOwn(data, key)
    && data[key] !== null && typeof data[key] !== 'string')) fail();
  if (['layout', 'document_subtype'].some(key => typeof data[key] === 'string' && [...data[key] as string].length > 50)) fail();
  if (Object.hasOwn(data, 'is_default') && typeof data.is_default !== 'boolean') fail();
  if (Object.hasOwn(data, 'archetype') && !['structured', 'letter', 'reference', 'statement'].includes(String(data.archetype))) fail();
  if (Object.hasOwn(data, 'contact_profile_id') && data.contact_profile_id !== null && !uuid(data.contact_profile_id)) fail();
  return value as DocumentCreationInput;
}
export function documentCreationOriginal(value: unknown): DocumentCreationOriginal {
  shape(value, ['request_id', 'expected_account_id', 'document_id', 'source_size', 'source_sha256', 'fields_supplied']);
  if (!uuid(value.request_id) || !uuid(value.document_id) || !account(value.expected_account_id)
    || !integer(value.source_size, 1, MAX_DOCUMENT_CREATION_BYTES) || !hash(value.source_sha256)
    || !Array.isArray(value.fields_supplied) || value.fields_supplied.length < 2 || value.fields_supplied.length > fields.length
    || value.fields_supplied.some(key => typeof key !== 'string' || !fields.includes(key))
    || !value.fields_supplied.includes('name') || !value.fields_supplied.includes('content')
    || new Set(value.fields_supplied).size !== value.fields_supplied.length
    || value.fields_supplied.join() !== [...value.fields_supplied].sort().join()) fail();
  return value as DocumentCreationOriginal;
}
export async function documentCreationOriginalHash(value: DocumentCreationOriginal) {
  return digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(documentCreationOriginal(value)))));
}
export async function prepareDocumentCreation(value: DocumentCreationInput) {
  const input = documentCreationInput(value);
  const pointer = { request_id: input.request_id.toLowerCase(),
    expected_account_id: 'jh_' + input.expected_account_id.slice(3).toLowerCase(), document_id: input.document_id.toLowerCase() };
  const bodyText = JSON.stringify(stableJsonValue({ data: { type: 'resume_template', attributes: input.fields },
    meta: { document_creation: pointer } }));
  const bytes = new TextEncoder().encode(bodyText), body = JSON.parse(bodyText) as JsonObject;
  const captured = (body.data as JsonObject).attributes as DocumentCreationFields;
  if (bytes.length > MAX_DOCUMENT_CREATION_BYTES
    || new TextEncoder().encode(JSON.stringify(captured.content)).length > MAX_NATIVE_DOCUMENT_BYTES) fail();
  const original: DocumentCreationOriginal = { ...pointer, source_size: bytes.length,
    source_sha256: await digest(bytes), fields_supplied: Object.keys(captured).sort() };
  return { body, bytes, original, payloadHash: await documentCreationOriginalHash(original) };
}
/** Validate the carrier, not its career policy; preserve whitespace/large JSON numbers exactly. */
export async function prepareDocumentCreationSource(source: Uint8Array) {
  if (!(source instanceof Uint8Array) || !source.length || source.length > MAX_DOCUMENT_CREATION_BYTES) fail();
  const bytes = new Uint8Array(source);
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(); }
  shape(value, ['data', 'meta']); shape(value.data, ['type', 'attributes']); shape(value.meta, ['document_creation']);
  if (value.data.type !== 'resume_template') fail();
  const pointer = value.meta.document_creation;
  shape(pointer, ['request_id', 'expected_account_id', 'document_id']);
  if (!uuid(pointer.request_id) || !uuid(pointer.document_id) || !account(pointer.expected_account_id)) fail();
  shape(value.data.attributes, fields);
  if (typeof value.data.attributes.name !== 'string' || !record(value.data.attributes.content)) fail();
  const original = documentCreationOriginal({ request_id: String(pointer.request_id).toLowerCase(),
    expected_account_id: pointer.expected_account_id, document_id: String(pointer.document_id).toLowerCase(),
    source_size: bytes.length, source_sha256: await digest(bytes), fields_supplied: Object.keys(value.data.attributes).sort() });
  return { bytes, original, payloadHash: await documentCreationOriginalHash(original) };
}
export function documentCreationReceipt(value: unknown, original: DocumentCreationOriginal): DocumentCreationReceipt {
  if (!record(value) || !uuid(value.id) || value.kind !== DOCUMENT_CREATION_OPERATION || value.status !== 'succeeded'
    || value.resource_type !== 'document' || !record(value.result) || value.result.resource_id !== original.document_id
    || value.result.revision !== 1 || value.result.status !== 'saved' || !Array.isArray(value.result.related_ids)
    || value.result.related_ids.length || typeof value.retry_expires_at !== 'string'
    || !Number.isFinite(Date.parse(value.retry_expires_at)) || value.retry_after_seconds !== 0) fail(true);
  return value as DocumentCreationReceipt;
}
export async function documentCreationResponse(value: unknown, original: DocumentCreationOriginal) {
  if (!record(value) || value.ok !== true || !record(value.document_creation)
    || value.document_creation.request_id !== original.request_id || value.document_creation.source_size !== original.source_size
    || value.document_creation.source_sha256 !== original.source_sha256
    || value.document_creation.payload_hash !== await documentCreationOriginalHash(original)) fail(true);
  return documentCreationReceipt(value.operation, original);
}
export async function documentCreationEvidence(value: unknown, original: DocumentCreationOriginal) {
  const expected = await documentCreationOriginalHash(original);
  const result = journeyResult(value, (data): data is DocumentCreationEvidence => record(data)
    && data.document_id === original.document_id && data.request_id === original.request_id
    && data.slug === documentCreationSlug(original.document_id) && data.revision === 1 && data.payload_hash === expected);
  if (!result.data) fail(true);
  return result.data;
}
export async function documentCreationClosure(value: unknown, original: DocumentCreationOriginal) {
  const expected = await documentCreationOriginalHash(original);
  const result = journeyResult(value, (data): data is DocumentCreationClosure => record(data)
    && data.document_id === original.document_id && data.request_id === original.request_id
    && data.payload_hash === expected && ['closed', 'recorded', 'expired'].includes(String(data.outcome)));
  if (!result.data) fail(true);
  return result.data;
}
export class DocumentCreationClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async create(input: DocumentCreationInput) {
    const prepared = await prepareDocumentCreation(input);
    const response = await this.client.request('/api/v1/resume-templates/?return=receipt', { method: 'POST', body: prepared.body });
    return { original: prepared.original, operation: await documentCreationResponse(response, prepared.original) };
  }
  async createSource(source: Uint8Array) {
    const prepared = await prepareDocumentCreationSource(source);
    const response = await this.client.request('/api/v1/resume-templates/?return=receipt',
      { method: 'POST', jsonSource: prepared.bytes });
    return { original: prepared.original, operation: await documentCreationResponse(response, prepared.original) };
  }
  async check(input: DocumentCreationOriginal) {
    const original = documentCreationOriginal(input);
    const response = await this.client.request('/api/v1/journey/get_document_creation_original_v1?'
      + new URLSearchParams({ arguments: JSON.stringify(original) }));
    return documentCreationEvidence(response, original);
  }
  async close(input: DocumentCreationOriginal, confirmClose: true) {
    if (confirmClose !== true) fail();
    const original = JSON.parse(JSON.stringify(documentCreationOriginal(input))) as DocumentCreationOriginal;
    const response = await this.client.request('/api/v1/journey/close_document_creation_original_v1',
      { method: 'POST', body: { ...original, confirm_close: true } });
    return documentCreationClosure(response, original);
  }
  async host(input: DocumentCreationOriginal & { file: HostResumeFile }) {
    const original = documentCreationOriginal(Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'file')));
    resumeHostFileInput({ request_id: original.request_id, expected_account_id: original.expected_account_id, file: input.file });
    const response = await this.client.request('/api/v1/journey/create_native_document_file_v1', { method: 'POST', body: { ...input } });
    const result = journeyResult(response, (value): value is { document_id: string; slug: string; revision: number } => record(value)
      && value.document_id === original.document_id && value.slug === documentCreationSlug(original.document_id) && value.revision === 1);
    if (!result.data || !result.operation || result.operation.kind !== DOCUMENT_CREATION_OPERATION
      || result.operation.status !== 'succeeded' || result.operation.resource?.id !== original.document_id
      || result.operation.resource.revision !== 1) fail(true);
    return result;
  }
}
