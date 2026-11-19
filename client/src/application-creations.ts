/** Complete native creation originals; no career confirmation or implicit identity. */
import type { JobHuntClient } from './index.ts';
import { isNativeJson, stableJsonValue } from './native-json.ts';
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, shape, uuid, journeyResult } from './journey-contracts.ts';
import { resumeHostFileInput, type HostResumeFile } from './import-file-contracts.ts';

export const APPLICATION_CREATION_OPERATION = 'native_create_application_v1' as const;
export const MAX_APPLICATION_CREATION_BYTES = 16 * 1024 * 1024;
export type ApplicationCreationFields = Partial<Omit<import('./index.ts').CreateApplication, 'activity'>> & { activity?: unknown[] | null };
export type ApplicationCreationInput = { request_id: string; expected_account_id: string; application_id: string;
  fields: ApplicationCreationFields; metadata?: import('./index.ts').ApplicationCreationMeta };
export type ApplicationCreationOriginal = Omit<ApplicationCreationInput, 'fields' | 'metadata'> & {
  source_size: number; source_sha256: string; fields_supplied: string[] };
export type ApplicationCreationClosure = { request_id: string; application_id: string; payload_hash: string;
  outcome: 'closed' | 'recorded' | 'expired'; recorded_resource_id: string | null };
export type ApplicationCreationEvidence = { application_id: string; revision: number;
  request_id: string; payload_hash: string };
export type ApplicationCreationReceipt = { id: string; kind: typeof APPLICATION_CREATION_OPERATION; status: 'succeeded';
  resource_type: 'application'; result: { resource_id: string; revision: number; status: 'saved'; related_ids: [] };
  retry_expires_at: string; retry_after_seconds: 0 };
const fields = ['title', 'company_name', 'job_link', 'source', 'job_search', 'status', 'company_id', 'source_contact_id',
  'resume_template_id', 'job_details', 'cover_letter', 'resume_overrides', 'contacts', 'activity'];
const metadataFields = ['import_attempt_id', 'import_confirmed', 'import_review_revision'];
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const account = (value: unknown): value is string => typeof value === 'string' && value.startsWith('jh_') && uuid(value.slice(3));
async function digest(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))),
    byte => byte.toString(16).padStart(2, '0')).join('');
}
function nativeFields(value: unknown, requiresIdentity = true): asserts value is JsonObject {
  shape(value, fields);
  for (const key of requiresIdentity ? ['title', 'company_name'] : []) if (typeof value[key] !== 'string' || !value[key].trim()) fail();
  for (const key of fields.filter(key => !['job_details', 'cover_letter', 'resume_overrides', 'contacts', 'activity'].includes(key))) {
    if (value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string') fail();
  }
  for (const key of ['job_details', 'cover_letter', 'resume_overrides']) if (value[key] != null && !record(value[key])) fail();
  if (value.contacts != null && (!Array.isArray(value.contacts) || !value.contacts.every(record))) fail();
  if (value.activity != null && !Array.isArray(value.activity)) fail();
}
function nativeMetadata(value: unknown) {
  shape(value, metadataFields);
  if (value.import_attempt_id !== undefined && !uuid(value.import_attempt_id)
    || value.import_confirmed !== undefined && typeof value.import_confirmed !== 'boolean'
    || value.import_review_revision !== undefined && !integer(value.import_review_revision, 0, 2147483646)) fail();
}
export function applicationCreationInput(value: unknown): ApplicationCreationInput {
  shape(value, ['request_id', 'expected_account_id', 'application_id', 'fields', 'metadata']);
  if (!uuid(value.request_id) || !uuid(value.application_id) || !account(value.expected_account_id) || !isNativeJson(value)) fail();
  if (value.metadata !== undefined) nativeMetadata(value.metadata);
  nativeFields(value.fields, !(record(value.metadata) && value.metadata.import_attempt_id !== undefined && value.metadata.import_confirmed !== true));
  return value as ApplicationCreationInput;
}
export function applicationCreationOriginal(value: unknown): ApplicationCreationOriginal {
  shape(value, ['request_id', 'expected_account_id', 'application_id', 'source_size', 'source_sha256', 'fields_supplied']);
  if (!uuid(value.request_id) || !uuid(value.application_id) || !account(value.expected_account_id)
    || !integer(value.source_size, 1, MAX_APPLICATION_CREATION_BYTES) || !hash(value.source_sha256)
    || !Array.isArray(value.fields_supplied) || value.fields_supplied.length > fields.length
    || value.fields_supplied.some(key => typeof key !== 'string' || !fields.includes(key))
    || new Set(value.fields_supplied).size !== value.fields_supplied.length
    || value.fields_supplied.join() !== [...value.fields_supplied].sort().join()) fail();
  return value as ApplicationCreationOriginal;
}
export async function applicationCreationOriginalHash(value: ApplicationCreationOriginal) {
  return digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(applicationCreationOriginal(value)))));
}
export async function prepareApplicationCreation(value: ApplicationCreationInput) {
  const input = applicationCreationInput(value);
  const pointer = { request_id: input.request_id.toLowerCase(),
    expected_account_id: 'jh_' + input.expected_account_id.slice(3).toLowerCase(), application_id: input.application_id.toLowerCase() };
  const bodyText = JSON.stringify(stableJsonValue({ data: { type: 'application', attributes: input.fields, ...(input.metadata !== undefined ? { meta: input.metadata } : {}) },
    meta: { application_creation: pointer } }));
  const bytes = new TextEncoder().encode(bodyText), body = JSON.parse(bodyText) as JsonObject;
  const captured = (body.data as JsonObject).attributes as ApplicationCreationFields;
  if (bytes.length > MAX_APPLICATION_CREATION_BYTES) fail();
  const original: ApplicationCreationOriginal = { ...pointer, source_size: bytes.length,
    source_sha256: await digest(bytes), fields_supplied: Object.keys(captured).sort() };
  return { body, bytes, original, payloadHash: await applicationCreationOriginalHash(original) };
}
/** Validate the carrier, not its career policy; preserve whitespace/large JSON numbers exactly. */
export async function prepareApplicationCreationSource(source: Uint8Array) {
  if (!(source instanceof Uint8Array) || !source.length || source.length > MAX_APPLICATION_CREATION_BYTES) fail();
  const bytes = new Uint8Array(source);
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(); }
  shape(value, ['data', 'meta']); shape(value.data, ['type', 'attributes', 'meta']); shape(value.meta, ['application_creation']);
  if (value.data.type !== 'application') fail();
  const pointer = value.meta.application_creation;
  shape(pointer, ['request_id', 'expected_account_id', 'application_id']);
  if (!uuid(pointer.request_id) || !uuid(pointer.application_id) || !account(pointer.expected_account_id)) fail();
  if (value.data.meta !== undefined) nativeMetadata(value.data.meta);
  nativeFields(value.data.attributes, !(record(value.data.meta) && value.data.meta.import_attempt_id !== undefined && value.data.meta.import_confirmed !== true));
  const original = applicationCreationOriginal({ request_id: String(pointer.request_id).toLowerCase(),
    expected_account_id: pointer.expected_account_id, application_id: String(pointer.application_id).toLowerCase(),
    source_size: bytes.length, source_sha256: await digest(bytes), fields_supplied: Object.keys(value.data.attributes).sort() });
  return { bytes, original, payloadHash: await applicationCreationOriginalHash(original) };
}
export function applicationCreationReceipt(value: unknown, original: ApplicationCreationOriginal): ApplicationCreationReceipt {
  if (!record(value) || !uuid(value.id) || value.kind !== APPLICATION_CREATION_OPERATION || value.status !== 'succeeded'
    || value.resource_type !== 'application' || !record(value.result) || value.result.resource_id !== original.application_id
    || value.result.revision !== 1 || value.result.status !== 'saved' || !Array.isArray(value.result.related_ids)
    || value.result.related_ids.length || typeof value.retry_expires_at !== 'string'
    || !Number.isFinite(Date.parse(value.retry_expires_at)) || value.retry_after_seconds !== 0) fail(true);
  return value as ApplicationCreationReceipt;
}
export async function applicationCreationResponse(value: unknown, original: ApplicationCreationOriginal) {
  if (!record(value) || value.ok !== true || !record(value.application_creation)
    || value.application_creation.request_id !== original.request_id || value.application_creation.source_size !== original.source_size
    || value.application_creation.source_sha256 !== original.source_sha256
    || value.application_creation.payload_hash !== await applicationCreationOriginalHash(original)) fail(true);
  return applicationCreationReceipt(value.operation, original);
}
export async function applicationCreationEvidence(value: unknown, original: ApplicationCreationOriginal) {
  const expected = await applicationCreationOriginalHash(original);
  const result = journeyResult(value, (data): data is ApplicationCreationEvidence => record(data)
    && data.application_id === original.application_id && data.request_id === original.request_id
    && data.revision === 1 && data.payload_hash === expected);
  if (!result.data) fail(true);
  return result.data;
}
export async function applicationCreationClosure(value: unknown, original: ApplicationCreationOriginal) {
  const expected = await applicationCreationOriginalHash(original);
  const result = journeyResult(value, (data): data is ApplicationCreationClosure => record(data)
    && data.application_id === original.application_id && data.request_id === original.request_id
    && data.payload_hash === expected && ['closed', 'recorded', 'expired'].includes(String(data.outcome))
    && (data.recorded_resource_id === null || data.recorded_resource_id === original.application_id)
    && (data.outcome !== 'recorded' || data.recorded_resource_id === original.application_id)
    && (data.outcome !== 'closed' || data.recorded_resource_id === null));
  if (!result.data) fail(true);
  return result.data;
}
export class ApplicationCreationClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async create(input: ApplicationCreationInput) {
    const prepared = await prepareApplicationCreation(input);
    const response = await this.client.request('/api/v1/applications/?return=creation-receipt', { method: 'POST', body: prepared.body });
    return { original: prepared.original, operation: await applicationCreationResponse(response, prepared.original) };
  }
  async createSource(source: Uint8Array) {
    const prepared = await prepareApplicationCreationSource(source);
    const response = await this.client.request('/api/v1/applications/?return=creation-receipt',
      { method: 'POST', jsonSource: prepared.bytes });
    return { original: prepared.original, operation: await applicationCreationResponse(response, prepared.original) };
  }
  async check(input: ApplicationCreationOriginal) {
    const original = JSON.parse(JSON.stringify(applicationCreationOriginal(input))) as ApplicationCreationOriginal;
    const response = await this.client.request('/api/v1/journey/get_application_creation_original_v1?'
      + new URLSearchParams({ arguments: JSON.stringify(original) }));
    return applicationCreationEvidence(response, original);
  }
  async close(input: ApplicationCreationOriginal, confirmClose: true) {
    if (confirmClose !== true) fail();
    const original = JSON.parse(JSON.stringify(applicationCreationOriginal(input))) as ApplicationCreationOriginal;
    const response = await this.client.request('/api/v1/journey/close_application_creation_original_v1',
      { method: 'POST', body: { ...original, confirm_close: true } });
    return applicationCreationClosure(response, original);
  }
  async host(input: ApplicationCreationOriginal & { file: HostResumeFile }) {
    const original = applicationCreationOriginal(Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'file')));
    resumeHostFileInput({ request_id: original.request_id, expected_account_id: original.expected_account_id, file: input.file });
    const response = await this.client.request('/api/v1/journey/create_native_application_file_v1', { method: 'POST', body: { ...input } });
    const result = journeyResult(response, (value): value is { application_id: string; revision: number } => record(value)
      && value.application_id === original.application_id && value.revision === 1);
    if (!result.data || !result.operation || result.operation.kind !== APPLICATION_CREATION_OPERATION
      || result.operation.status !== 'succeeded' || result.operation.resource?.id !== original.application_id
      || result.operation.resource.revision !== 1) fail(true);
    return result;
  }
}
