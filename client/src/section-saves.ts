/** Exact native section originals; preparation is not save or retry authority. */
import type { JobHuntClient } from './index.ts';
import { record } from './protocol.ts';
import { fail, integer, shape, uuid, journeyResult, operationResult } from './journey-contracts.ts';
import { digest } from './highlight-file-contracts.ts';
import { isNativeJson, stableJsonValue } from './native-json.ts';

export const SECTION_SAVE_OPERATION = 'save_document_section' as const;
export const MAX_SECTION_VALUE_BYTES = 16 * 1024 * 1024;
export const MAX_SECTION_SAVE_BYTES = MAX_SECTION_VALUE_BYTES + 65536;
export type SectionSaveInput = { request_id: string; expected_account_id: string; document_id: string;
  template_slug: string; section: string; expected_revision: number; value: unknown };
export type SectionSaveOriginal = Omit<SectionSaveInput, 'value' | 'template_slug'> & {
  slug: string; source_size: number; source_sha256: string };
const slug = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u.test(v);
const account = (v: unknown): v is string => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
export function sectionSaveOriginal(value: unknown): SectionSaveOriginal {
  shape(value, ['request_id', 'expected_account_id', 'document_id', 'slug', 'section', 'expected_revision', 'source_size', 'source_sha256']);
  if (!uuid(value.request_id) || !uuid(value.document_id) || !account(value.expected_account_id) || !slug(value.slug)
    || typeof value.section !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/u.test(value.section)
    || !integer(value.expected_revision) || !integer(value.source_size, 1, MAX_SECTION_SAVE_BYTES)
    || typeof value.source_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.source_sha256)) fail();
  return value as SectionSaveOriginal;
}
export async function sectionSaveOriginalHash(original: SectionSaveOriginal) {
  return digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(sectionSaveOriginal(original)))));
}
export async function prepareSectionSave(value: SectionSaveInput) {
  shape(value, ['request_id', 'expected_account_id', 'document_id', 'template_slug', 'section', 'expected_revision', 'value']);
  if (!isNativeJson(value) || !uuid(value.request_id) || !uuid(value.document_id) || !account(value.expected_account_id)
    || !slug(value.template_slug) || typeof value.section !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/u.test(value.section)
    || !integer(value.expected_revision) || !Object.hasOwn(value, 'value')) fail();
  // Capture all JSON synchronously before hashing; caller edits during the await
  // cannot change the bytes eventually sent or the compact receipt descriptor.
  const text = JSON.stringify(stableJsonValue({ ...value, request_id: value.request_id.toLowerCase(),
    document_id: value.document_id.toLowerCase(), expected_account_id: 'jh_' + value.expected_account_id.slice(3).toLowerCase() }));
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_SECTION_SAVE_BYTES) fail();
  const body = JSON.parse(text) as SectionSaveInput;
  if (new TextEncoder().encode(JSON.stringify(body.value)).length > MAX_SECTION_VALUE_BYTES) fail();
  const original: SectionSaveOriginal = { request_id: body.request_id, expected_account_id: body.expected_account_id,
    document_id: body.document_id, slug: body.template_slug, section: body.section, expected_revision: body.expected_revision,
    source_size: bytes.length, source_sha256: await digest(bytes) };
  return { text, body, original, payloadHash: await sectionSaveOriginalHash(original) };
}


export type SectionSaveClosure = { request_id: string; document_id: string; payload_hash: string;
  outcome: 'closed' | 'recorded' | 'expired' };
function captureOriginal(input: SectionSaveOriginal) {
  return JSON.parse(JSON.stringify(sectionSaveOriginal(input))) as SectionSaveOriginal;
}
export async function sectionSaveClosureResponse(value: unknown, input: SectionSaveOriginal): Promise<SectionSaveClosure> {
  const original = captureOriginal(input), expectedHash = await sectionSaveOriginalHash(original);
  const parsed = journeyResult(value, (data): data is SectionSaveClosure => record(data)
    && data.request_id === original.request_id && data.document_id === original.document_id
    && data.payload_hash === expectedHash && ['closed', 'recorded', 'expired'].includes(String(data.outcome)));
  if (parsed.outcome !== 'ready' || !parsed.data) fail(true);
  return parsed.data;
}
/** Check/close only. Native career-fact writes remain session-authorized. */
export class SectionSaveClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async check(input: SectionSaveOriginal) {
    const original = captureOriginal(input);
    const args = { operation_name: SECTION_SAVE_OPERATION, request_id: original.request_id,
      expected_payload_hash: await sectionSaveOriginalHash(original) };
    const response = await this.client.request('/api/v1/journey/get_job_hunt_operation?' +
      new URLSearchParams({ arguments: JSON.stringify(args) }));
    const parsed = operationResult(response);
    if (parsed.outcome !== 'ready') fail(true);
    const receipt = parsed.data;
    if (!receipt || receipt.kind !== SECTION_SAVE_OPERATION || receipt.status !== 'succeeded'
      || receipt.resource?.kind !== 'document' || receipt.resource.id !== original.document_id
      || receipt.resource.revision !== original.expected_revision + 1) fail(true);
    return receipt;
  }
  async close(input: SectionSaveOriginal, confirmClose: true) {
    if (confirmClose !== true) fail();
    const original = captureOriginal(input);
    const response = await this.client.request('/api/v1/journey/close_document_section_original_v1',
      { method: 'POST', body: { ...original, confirm_close: true } });
    return sectionSaveClosureResponse(response, original);
  }
}
