/** Full private import records, checksum-bound across every read. No record cache. */
import type { JobHuntClient } from './index.ts';
import { JobHuntError, record } from './protocol.ts';
import { fail, integer, journeyResult, shape, uuid } from './journey-contracts.ts';
export const MAX_POSTING_IMPORT_FILE_BYTES = 16 * 1024 * 1024;
export type PostingImportFileRead = { expected_account_id: string; attempt_id: string };
export type PostingImportFileManifest = { account_id: string; attempt_id: string; format: 'jobhunt.posting-import/v1';
  filename: 'posting-import.json'; mime: 'application/json'; sha256: string; size_bytes: number; chunk_bytes: 24000; chunk_count: number };
export type PostingImportFileChunkRead = PostingImportFileRead & { expected_sha256: string; expected_size_bytes: number; chunk_index: number };
export type PostingImportFileChunk = PostingImportFileManifest & { chunk_index: number; content_base64: string; chunk_sha256: string };
const fields = ['account_id','attempt_id','format','filename','mime','sha256','size_bytes','chunk_bytes','chunk_count'];
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
export function postingImportFileInput(value: unknown): PostingImportFileRead {
  shape(value, ['expected_account_id','attempt_id']);
  if (typeof value.expected_account_id !== 'string' || !value.expected_account_id.startsWith('jh_') || !uuid(value.expected_account_id.slice(3)) || !uuid(value.attempt_id)) fail();
  return { expected_account_id: 'jh_' + value.expected_account_id.slice(3).toLowerCase(), attempt_id: String(value.attempt_id).toLowerCase() };
}
function metadata(value: unknown, input: PostingImportFileRead, chunk = false): boolean {
  const keys = chunk ? [...fields, 'chunk_index','content_base64','chunk_sha256'] : fields;
  return record(value) && Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k)) &&
    value.account_id === input.expected_account_id && value.attempt_id === input.attempt_id && value.format === 'jobhunt.posting-import/v1' &&
    value.filename === 'posting-import.json' && value.mime === 'application/json' && digest(value.sha256) &&
    integer(value.size_bytes, 1, MAX_POSTING_IMPORT_FILE_BYTES) && value.chunk_bytes === 24000 &&
    integer(value.chunk_count, 1) && value.chunk_count === Math.ceil(Number(value.size_bytes)/24000);
}
async function hash(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), b => b.toString(16).padStart(2,'0')).join('');
}
export class PostingImportFilesClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async manifest(input: PostingImportFileRead) {
    const args = postingImportFileInput(input);
    return journeyResult(await this.client.request('/api/v1/journey/get_posting_import_file_v1?' + new URLSearchParams({ arguments: JSON.stringify(args) })),
      (v): v is PostingImportFileManifest => metadata(v, args));
  }
  async chunk(input: PostingImportFileChunkRead) {
    shape(input, ['expected_account_id','attempt_id','expected_sha256','expected_size_bytes','chunk_index']);
    const args = { ...input, ...postingImportFileInput({ expected_account_id: input.expected_account_id, attempt_id: input.attempt_id }) };
    if (!digest(args.expected_sha256) || !integer(args.expected_size_bytes, 1, MAX_POSTING_IMPORT_FILE_BYTES) || !integer(args.chunk_index)) fail();
    const result = journeyResult(await this.client.request('/api/v1/journey/get_posting_import_file_chunk_v1?' + new URLSearchParams({ arguments: JSON.stringify(args) })),
      (v): v is PostingImportFileChunk => record(v) && metadata(v, args, true) && v.sha256 === args.expected_sha256 && v.size_bytes === args.expected_size_bytes &&
        v.chunk_index === args.chunk_index && args.chunk_index <= Number(v.chunk_count) && digest(v.chunk_sha256) &&
        typeof v.content_base64 === 'string' && v.content_base64.length <= 32000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(v.content_base64));
    if (result.outcome !== 'ready' || !result.data) fail(true);
    const bytes = Uint8Array.from(atob(result.data.content_base64), c => c.charCodeAt(0));
    const expected = Math.min(24000, args.expected_size_bytes-(args.chunk_index-1)*24000);
    if (bytes.length !== expected || btoa(String.fromCharCode(...bytes)) !== result.data.content_base64 || await hash(bytes) !== result.data.chunk_sha256) throw new JobHuntError('download_checksum_mismatch');
    return result;
  }
  async download(input: PostingImportFileRead) {
    const args = postingImportFileInput(input), first = await this.manifest(args);
    if (first.outcome !== 'ready' || !first.data) fail(true);
    const manifest = first.data, bytes = new Uint8Array(manifest.size_bytes);
    for (let index=1; index<=manifest.chunk_count; index++) {
      const result = await this.chunk({ ...args, expected_sha256: manifest.sha256, expected_size_bytes: manifest.size_bytes, chunk_index: index });
      const part = result.data!;
      if (!fields.every(k => part[k as keyof PostingImportFileManifest] === manifest[k as keyof PostingImportFileManifest])) fail(true);
      bytes.set(Uint8Array.from(atob(part.content_base64), c => c.charCodeAt(0)), (index-1)*24000);
    }
    if (await hash(bytes) !== manifest.sha256) throw new JobHuntError('download_checksum_mismatch');
    return { ...manifest, bytes };
  }
}
