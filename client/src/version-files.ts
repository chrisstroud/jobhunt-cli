/** Complete immutable saved content and provenance, separate from latest source. */
import type { JobHuntClient } from './index.ts';
import { JobHuntError, record } from './protocol.ts';
import { integer, journeyResult, shape, uuid } from './journey-contracts.ts';
import { digest } from './highlight-file-contracts.ts';
import { isNativeJson } from './native-json.ts';
export const MAX_VERSION_FILE_BYTES = 2 * 16 * 1024 * 1024 + 65536;
export type VersionFileRead = { document_id: string; version_id: string };
export type VersionFileBoundRead = VersionFileRead & { expected_sha256: string; expected_size_bytes: number };
export type VersionFileChunkRead = VersionFileBoundRead & { chunk_index: number };
export type VersionFileManifest = VersionFileRead & { account_id: string; revision: number | null;
  format: 'jobhunt.document-version/v1'; filename: string; mime: 'application/json'; sha256: string;
  size_bytes: number; chunk_bytes: 24000; chunk_count: number };
export type VersionFileChunk = VersionFileManifest & { chunk_index: number; content_base64: string; chunk_sha256: string };
export type VersionRecord = VersionFileRead & { format: 'jobhunt.document-version/v1'; account_id: string;
  revision: number | null; document_type: string; name: string | null; trigger: string; created_at: string | null;
  content: Record<string, unknown>; metadata: Record<string, unknown> | null };
function invalid(): never { throw new JobHuntError('invalid_response'); }
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const fields = ['account_id', 'document_id', 'version_id', 'revision', 'format', 'filename', 'mime', 'sha256', 'size_bytes', 'chunk_bytes', 'chunk_count'];
export function versionFileRead(value: unknown): VersionFileRead {
  shape(value, ['document_id', 'version_id']);
  if (typeof value.document_id !== 'string' || typeof value.version_id !== 'string' || !uuid(value.document_id) || !uuid(value.version_id)) throw new JobHuntError('invalid_input');
  return { document_id: value.document_id.toLowerCase(), version_id: value.version_id.toLowerCase() };
}
export function versionFileBoundRead(value: unknown): VersionFileBoundRead {
  shape(value, ['document_id', 'version_id', 'expected_sha256', 'expected_size_bytes']);
  const ids = versionFileRead({ document_id: value.document_id, version_id: value.version_id });
  if (!hash(value.expected_sha256) || !integer(value.expected_size_bytes, 1, MAX_VERSION_FILE_BYTES)) throw new JobHuntError('invalid_input');
  return { ...ids, expected_sha256: value.expected_sha256, expected_size_bytes: value.expected_size_bytes as number };
}
function manifest(value: unknown): value is VersionFileManifest {
  if (!record(value)) return false;
  return Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key))
    && typeof value.account_id === 'string' && value.account_id.startsWith('jh_') && uuid(value.account_id.slice(3))
    && uuid(value.document_id) && uuid(value.version_id) && (value.revision === null || integer(value.revision))
    && value.format === 'jobhunt.document-version/v1' && value.mime === 'application/json'
    && value.filename === 'jobhunt-version-' + value.version_id + '.json' && hash(value.sha256)
    && integer(value.size_bytes, 1, MAX_VERSION_FILE_BYTES) && value.chunk_bytes === 24000
    && value.chunk_count === Math.ceil(Number(value.size_bytes) / 24000);
}
export function versionFileManifestResult(value: unknown, input: VersionFileRead) {
  const result = journeyResult(value, manifest);
  if (result.data && (result.data.document_id !== input.document_id || result.data.version_id !== input.version_id)) invalid();
  return result;
}
export async function verifiedVersionRecord(bytes: Uint8Array, metadata: VersionFileManifest): Promise<VersionRecord> {
  if (!manifest(metadata) || bytes.length !== metadata.size_bytes || await digest(bytes) !== metadata.sha256) invalid();
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)); } catch { invalid(); }
  if (!record(value) || Object.keys(value).sort().join() !== 'account_id,content,created_at,document_id,document_type,format,metadata,name,revision,trigger,version_id'
    || ['account_id', 'document_id', 'version_id', 'revision', 'format'].some(key => value[key] !== metadata[key as keyof VersionFileManifest])
    || typeof value.document_type !== 'string' || typeof value.trigger !== 'string' || !(value.name === null || typeof value.name === 'string')
    || !(value.created_at === null || typeof value.created_at === 'string' && Number.isFinite(Date.parse(value.created_at)))
    || !record(value.content) || !(value.metadata === null || record(value.metadata)) || !isNativeJson(value)) invalid();
  const journey = record(value.metadata) ? value.metadata.journey : null;
  if (value.revision !== (record(journey) ? journey.revision ?? null : null)) invalid();
  return value as VersionRecord;
}
export class DocumentVersionFileClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async manifest(input: VersionFileRead) {
    const args = versionFileRead(input);
    return versionFileManifestResult(await this.client.request('/api/v1/journey/get_document_version_file?'
      + new URLSearchParams({ arguments: JSON.stringify(args) })), args);
  }
  async chunk(input: VersionFileChunkRead) {
    shape(input, ['document_id', 'version_id', 'expected_sha256', 'expected_size_bytes', 'chunk_index']);
    const args = versionFileBoundRead({ document_id: input.document_id, version_id: input.version_id,
      expected_sha256: input.expected_sha256, expected_size_bytes: input.expected_size_bytes });
    if (!integer(input.chunk_index, 1, Math.ceil(args.expected_size_bytes / 24000))) throw new JobHuntError('invalid_input');
    const raw = await this.client.request('/api/v1/journey/get_document_version_file_chunk?'
      + new URLSearchParams({ arguments: JSON.stringify({ ...args, chunk_index: input.chunk_index }) }));
    const result = journeyResult(raw, (value): value is VersionFileChunk => {
      if (!record(value)) return false;
      const { chunk_index, content_base64, chunk_sha256, ...base } = value;
      return manifest(base) && chunk_index === input.chunk_index && typeof content_base64 === 'string'
        && content_base64.length >= 4 && content_base64.length <= 32000 && hash(chunk_sha256);
    });
    if (result.data) {
      const data = result.data;
      if (data.document_id !== args.document_id || data.version_id !== args.version_id || data.sha256 !== args.expected_sha256 || data.size_bytes !== args.expected_size_bytes) invalid();
      const part = versionChunkBytes(data);
      if (await digest(part) !== data.chunk_sha256) invalid();
    }
    return result;
  }
  async download(input: VersionFileRead) {
    const result = await this.manifest(input);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
    const metadata = result.data;
    const bytes = await this.client.request('/api/v1/journey/document-version-file?' + new URLSearchParams({
      document_id: metadata.document_id, version_id: metadata.version_id, expected_sha256: metadata.sha256,
      expected_size_bytes: String(metadata.size_bytes) }));
    if (!(bytes instanceof Uint8Array)) invalid();
    await verifiedVersionRecord(bytes, metadata);
    return { ...metadata, bytes, media_type: metadata.mime };
  }
  async downloadChunks(input: VersionFileRead) {
    const result = await this.manifest(input);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
    const metadata = result.data, bytes = new Uint8Array(metadata.size_bytes);
    let offset = 0;
    for (let index = 1; index <= metadata.chunk_count; index++) {
      const response = await this.chunk({ document_id: metadata.document_id, version_id: metadata.version_id,
        expected_sha256: metadata.sha256, expected_size_bytes: metadata.size_bytes, chunk_index: index });
      if (response.outcome !== 'ready' || !response.data) throw new JobHuntError('download_unavailable');
      const { chunk_index: _index, content_base64: _content, chunk_sha256: _hash, ...base } = response.data;
      if (fields.some(key => metadata[key as keyof VersionFileManifest] !== base[key as keyof typeof base])) invalid();
      const part = versionChunkBytes(response.data); bytes.set(part, offset); offset += part.length;
    }
    await verifiedVersionRecord(bytes, metadata);
    return { ...metadata, bytes, media_type: metadata.mime };
  }
}
function versionChunkBytes(value: VersionFileChunk) {
  try {
    const decoded = atob(value.content_base64);
    if (btoa(decoded) !== value.content_base64 || decoded.length !== Math.min(24000, value.size_bytes - (value.chunk_index - 1) * 24000)) invalid();
    return Uint8Array.from(decoded, ch => ch.charCodeAt(0));
  } catch { return invalid(); }
}
