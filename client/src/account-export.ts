/** Complete native account exports; no private bytes are returned as metadata. */
import type { JobHuntClient } from './index.ts';
import { JobHuntError, record, type JsonObject } from './protocol.ts';
import { calendarDate, journeyResult, shape, uuid } from './journey-contracts.ts';

export type AccountExportRead = { expected_account_id: string; format: 'json' | 'zip'; exported_at?: string | null };
export type AccountExportManifest = {
  account_id: string; format: 'json' | 'zip'; exported_at: string; filename: string;
  mime: 'application/json' | 'application/zip'; size_bytes: number; sha256: string;
  chunk_bytes: 64000; chunk_count: number; record_counts: Record<string, number>;
};
export type AccountExportChunkRead = AccountExportRead & {
  exported_at: string; expected_sha256: string; expected_size_bytes: number; chunk_index: number;
};
export type AccountExportChunk = AccountExportManifest & {
  chunk_index: number; content_base64: string; chunk_sha256: string;
};
const groups = ['user', 'applications', 'resume_templates', 'job_searches', 'contacts', 'companies',
  'tasks', 'interview_steps', 'mutation_receipts', 'resume_imports', 'job_hunt_preferences'];
const fields = ['account_id', 'format', 'exported_at', 'filename', 'mime', 'size_bytes', 'sha256', 'chunk_bytes', 'chunk_count', 'record_counts'];
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const integer = (v: unknown, min = 1): v is number => Number.isSafeInteger(v) && Number(v) >= min;
const account = (v: unknown): v is string => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const timestamp = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 &&
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.test(v) &&
  calendarDate(v.slice(0, 10)) && Number.isFinite(Date.parse(v));
const exact = (v: unknown, keys: string[]): v is JsonObject => record(v) &&
  Object.keys(v).length === keys.length && Object.keys(v).every(key => keys.includes(key));
function fail(response = false): never { throw new JobHuntError(response ? 'invalid_response' : 'invalid_input'); }
export function accountExportInput(v: unknown): AccountExportRead {
  shape(v, ['expected_account_id', 'format', 'exported_at']);
  if (!account(v.expected_account_id) || v.format !== 'json' && v.format !== 'zip' ||
    v.exported_at != null && !timestamp(v.exported_at)) fail();
  return { ...v, expected_account_id: 'jh_' + v.expected_account_id.slice(3).toLowerCase() } as AccountExportRead;
}
function manifestData(v: unknown, input: AccountExportRead, chunk = false): boolean {
  if (!exact(v, chunk ? [...fields, 'chunk_index', 'content_base64', 'chunk_sha256'] : fields)) return false;
  return v.account_id === input.expected_account_id && v.format === input.format && timestamp(v.exported_at) &&
    (input.exported_at == null || v.exported_at === input.exported_at) &&
    v.filename === 'job-search-export-' + v.exported_at.slice(0, 10).replaceAll('-', '') + '.' + input.format &&
    v.mime === (input.format === 'zip' ? 'application/zip' : 'application/json') && integer(v.size_bytes) && digest(v.sha256) &&
    v.chunk_bytes === 64000 && integer(v.chunk_count) && v.chunk_count === Math.ceil(v.size_bytes / 64000) &&
    exact(v.record_counts, groups) && Object.values(v.record_counts).every(n => integer(n, 0));
}
async function hash(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), n => n.toString(16).padStart(2, '0')).join('');
}
function same(left: AccountExportManifest, right: AccountExportManifest) {
  return fields.every(key => key === 'record_counts'
    ? groups.every(group => left.record_counts[group] === right.record_counts[group])
    : left[key as keyof AccountExportManifest] === right[key as keyof AccountExportManifest]);
}
export class AccountExportClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async manifest(input: AccountExportRead) {
    const args = accountExportInput(input);
    return journeyResult(await this.client.request('/api/v1/journey/get_account_export_manifest?' +
      new URLSearchParams({ arguments: JSON.stringify(args) })), (v): v is AccountExportManifest => manifestData(v, args));
  }
  async chunk(input: AccountExportChunkRead) {
    shape(input, ['expected_account_id', 'format', 'exported_at', 'expected_sha256', 'expected_size_bytes', 'chunk_index']);
    const args = { ...input, ...accountExportInput({ expected_account_id: input.expected_account_id,
      format: input.format, exported_at: input.exported_at }) };
    if (!timestamp(args.exported_at) || !digest(args.expected_sha256) || !integer(args.expected_size_bytes) || !integer(args.chunk_index)) fail();
    const result = journeyResult(await this.client.request('/api/v1/journey/get_account_export_chunk?' +
      new URLSearchParams({ arguments: JSON.stringify(args) })), (v): v is AccountExportChunk => record(v) && manifestData(v, args, true) &&
        v.sha256 === args.expected_sha256 && v.size_bytes === args.expected_size_bytes &&
        v.chunk_index === args.chunk_index && args.chunk_index <= Number(v.chunk_count) && digest(v.chunk_sha256) &&
        typeof v.content_base64 === 'string' && v.content_base64.length <= 85336 &&
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(v.content_base64));
    if (result.outcome !== 'ready' || !result.data) fail(true);
    const part = Uint8Array.from(atob(result.data.content_base64), c => c.charCodeAt(0));
    const expected = Math.min(64000, args.expected_size_bytes - (args.chunk_index - 1) * 64000);
    if (part.length !== expected || btoa(String.fromCharCode(...part)) !== result.data.content_base64 ||
      await hash(part) !== result.data.chunk_sha256) throw new JobHuntError('download_checksum_mismatch');
    return result;
  }
  async download(input: AccountExportRead) {
    const args = accountExportInput(input), result = await this.manifest(args);
    if (result.outcome !== 'ready' || !result.data) fail(true);
    const manifest = result.data, chunks: Uint8Array[] = [];
    for (let index = 1; index <= manifest.chunk_count; index++) {
      const response = await this.chunk({ ...args, exported_at: manifest.exported_at,
        expected_sha256: manifest.sha256, expected_size_bytes: manifest.size_bytes, chunk_index: index });
      if (!response.data || !same(response.data, manifest)) fail(true);
      chunks.push(Uint8Array.from(atob(response.data.content_base64), c => c.charCodeAt(0)));
    }
    const bytes = new Uint8Array(manifest.size_bytes); let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
    if (offset !== manifest.size_bytes || await hash(bytes) !== manifest.sha256) throw new JobHuntError('download_checksum_mismatch');
    const final = await this.manifest({ ...args, exported_at: manifest.exported_at });
    if (final.outcome !== 'ready' || !final.data || !same(final.data, manifest)) throw new JobHuntError('revision_conflict');
    return { ...manifest, bytes };
  }
}
