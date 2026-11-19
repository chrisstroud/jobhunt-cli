/** Complete private native metadata; source-bound chunks never mix revisions. */
import type { JobHuntClient } from './index.ts';
import { JobHuntError, record } from './protocol.ts';
import { journeyResult, uuid } from './journey-contracts.ts';
export type WebhookFileRead = { expected_account_id: string; subscription_id: string; delivery_id?: string | null };
export type WebhookFileManifest = { account_id: string; subscription_id: string; delivery_id: string | null;
  filename: 'webhook-metadata.json'; mime: 'application/json'; size_bytes: number; sha256: string; chunk_bytes: 64000; chunk_count: number };
export type WebhookFileChunkRead = WebhookFileRead & { expected_sha256: string; expected_size_bytes: number; chunk_index: number };
export type WebhookFileChunk = WebhookFileManifest & { chunk_index: number; content_base64: string; chunk_sha256: string };
const fields = ['account_id', 'subscription_id', 'delivery_id', 'filename', 'mime', 'size_bytes', 'sha256', 'chunk_bytes', 'chunk_count'];
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const exact = (v: unknown, keys: string[]) => record(v) && Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k));
export function webhookFileInput(v: unknown): WebhookFileRead {
  if (!record(v) || Object.keys(v).some(k => !['expected_account_id', 'subscription_id', 'delivery_id'].includes(k)) ||
    typeof v.expected_account_id !== 'string' || !v.expected_account_id.startsWith('jh_') || !uuid(v.expected_account_id.slice(3)) ||
    !uuid(v.subscription_id) || v.delivery_id != null && !uuid(v.delivery_id)) throw new JobHuntError('invalid_input');
  return { expected_account_id: v.expected_account_id.toLowerCase(), subscription_id: String(v.subscription_id).toLowerCase(),
    ...(v.delivery_id == null ? {} : { delivery_id: String(v.delivery_id).toLowerCase() }) };
}
function valid(v: unknown, args: WebhookFileRead, chunk = false): boolean {
  return record(v) && exact(v, chunk ? [...fields, 'chunk_index', 'content_base64', 'chunk_sha256'] : fields) &&
    v.account_id === args.expected_account_id && v.subscription_id === args.subscription_id && v.delivery_id === (args.delivery_id ?? null) &&
    v.filename === 'webhook-metadata.json' && v.mime === 'application/json' && integer(v.size_bytes) && digest(v.sha256) &&
    v.chunk_bytes === 64000 && integer(v.chunk_count) && v.chunk_count === Math.ceil(v.size_bytes / 64000);
}
const same = (a: WebhookFileManifest, b: WebhookFileManifest) => fields.every(k => a[k as keyof WebhookFileManifest] === b[k as keyof WebhookFileManifest]);
const hash = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), b => b.toString(16).padStart(2, '0')).join('');
export class WebhookMetadataClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async manifest(input: WebhookFileRead) {
    const args = webhookFileInput(input);
    return journeyResult(await this.client.request('/api/v1/journey/get_webhook_metadata_file?' + new URLSearchParams({ arguments: JSON.stringify(args) })),
      (v): v is WebhookFileManifest => valid(v, args));
  }
  async chunk(input: WebhookFileChunkRead) {
    const base = webhookFileInput({ expected_account_id: input.expected_account_id, subscription_id: input.subscription_id, ...(input.delivery_id == null ? {} : { delivery_id: input.delivery_id }) });
    if (!record(input) || Object.keys(input).some(k => !['expected_account_id', 'subscription_id', 'delivery_id', 'expected_sha256', 'expected_size_bytes', 'chunk_index'].includes(k)) || !digest(input.expected_sha256) || !integer(input.expected_size_bytes) || !integer(input.chunk_index)) throw new JobHuntError('invalid_input');
    const args = { ...base, expected_sha256: input.expected_sha256, expected_size_bytes: input.expected_size_bytes, chunk_index: input.chunk_index };
    const result = journeyResult(await this.client.request('/api/v1/journey/get_webhook_metadata_file_chunk?' + new URLSearchParams({ arguments: JSON.stringify(args) })),
      (v): v is WebhookFileChunk => record(v) && valid(v, base, true) && v.sha256 === input.expected_sha256 && v.size_bytes === input.expected_size_bytes &&
        v.chunk_index === input.chunk_index && v.chunk_index <= Number(v.chunk_count) && typeof v.content_base64 === 'string' && v.content_base64.length <= 85336 && digest(v.chunk_sha256));
    if (result.data) {
      try {
        const raw = atob(result.data.content_base64), bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
        const expected = input.chunk_index === result.data.chunk_count ? result.data.size_bytes - (input.chunk_index - 1) * 64000 : 64000;
        if (btoa(raw) !== result.data.content_base64 || bytes.length !== expected || await hash(bytes) !== result.data.chunk_sha256) throw Error();
      } catch { throw new JobHuntError('download_checksum_mismatch'); }
    }
    return result;
  }
  async download(input: WebhookFileRead) {
    const args = webhookFileInput(input), first = await this.manifest(args);
    if (first.outcome !== 'ready' || !first.data) throw new JobHuntError('source_unavailable');
    const manifest = first.data, bytes = new Uint8Array(manifest.size_bytes); let offset = 0;
    for (let index = 1; index <= manifest.chunk_count; index++) {
      const value = await this.chunk({ ...args, expected_sha256: manifest.sha256, expected_size_bytes: manifest.size_bytes, chunk_index: index });
      if (value.outcome !== 'ready' || !value.data || !same(value.data, manifest)) throw new JobHuntError('revision_conflict');
      const part = Uint8Array.from(atob(value.data.content_base64), c => c.charCodeAt(0)); bytes.set(part, offset); offset += part.length;
    }
    if (offset !== manifest.size_bytes || await hash(bytes) !== manifest.sha256) throw new JobHuntError('download_checksum_mismatch');
    const final = await this.manifest(args);
    if (final.outcome !== 'ready' || !final.data || !same(final.data, manifest)) throw new JobHuntError('revision_conflict');
    return { ...manifest, bytes };
  }
}
