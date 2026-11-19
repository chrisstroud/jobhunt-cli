/** Complete key permissions travel separately from bounded management summaries. */
import type { JobHuntClient } from './index.ts';
import type { ApiKeyRead, ApiKeyList, ApiKeyRecord, ApiKeyReviewInput } from './api-keys.ts';
import { keyReadInput, keyReviewInput } from './api-keys.ts';
import { record, JobHuntError, type JsonObject } from './protocol.ts';
import { fail, integer, journeyResult, shape, uuid } from './journey-contracts.ts';
export const MAX_API_KEY_SCOPES_FILE_BYTES = 16 * 1024 * 1024 + 65536;
export type ApiKeyScopesFile = { account_id: string; key_id: string; fingerprint: string; format: 'jobhunt.api-key-scopes/v1';
  mime: 'application/json'; filename: 'api-key-permissions.json'; size_bytes: number; chunk_bytes: 24000; chunk_count: number; sha256: string };
export type ApiKeySummary = Omit<ApiKeyRecord, 'scopes'> & { scope_count: number; scopes_file: ApiKeyScopesFile };
export type ApiKeySummaryDirectory = { account_id: string; items: ApiKeySummary[]; after: string | null; next_after: string | null;
  has_more: boolean; total: number; active_quota_used: number; active_quota_limit: 25; observed_at: string };
export type ApiKeySummaryReview = { key: ApiKeySummary; review_token: string; expires_at: string; revokes_current_credential: boolean };
export type ApiKeyScopesRead = ApiKeyRead & { expected_fingerprint: string; expected_sha256: string };
export type ApiKeyScopesChunkRead = ApiKeyScopesRead & { chunk_index: number };
export type ApiKeyScopesChunk = ApiKeyScopesFile & { chunk_index: number; content_base64: string; chunk_sha256: string };
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const account = (v: unknown): v is string => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const exact = (v: unknown, keys: string[]): v is JsonObject => record(v) && Object.keys(v).length === keys.length && Object.keys(v).every(key => keys.includes(key));
const nullable = (v: unknown) => v === null || typeof v === 'string';
const fileKeys = ['account_id', 'key_id', 'fingerprint', 'format', 'mime', 'filename', 'size_bytes', 'chunk_bytes', 'chunk_count', 'sha256'];
export function apiKeyScopesManifest(v: unknown): v is ApiKeyScopesFile {
  return exact(v, fileKeys) && account(v.account_id) && uuid(v.key_id) && hash(v.fingerprint) && v.format === 'jobhunt.api-key-scopes/v1' &&
    v.mime === 'application/json' && v.filename === 'api-key-permissions.json' && integer(v.size_bytes, 1, MAX_API_KEY_SCOPES_FILE_BYTES) &&
    v.chunk_bytes === 24000 && integer(v.chunk_count, 1, Math.ceil(MAX_API_KEY_SCOPES_FILE_BYTES / 24000)) &&
    v.chunk_count === Math.ceil(Number(v.size_bytes) / 24000) && hash(v.sha256);
}
export function apiKeySummary(v: unknown): v is ApiKeySummary {
  return exact(v, ['id', 'name', 'key_prefix', 'tier', 'is_active', 'expires_at', 'revoked_at', 'last_used_at', 'usage_count', 'created_at',
    'status', 'fingerprint', 'is_current_credential', 'scope_count', 'scopes_file']) && uuid(v.id) && typeof v.name === 'string' &&
    typeof v.key_prefix === 'string' && nullable(v.tier) && (v.is_active === null || typeof v.is_active === 'boolean') && nullable(v.expires_at) &&
    nullable(v.revoked_at) && nullable(v.last_used_at) && nullable(v.created_at) && (v.usage_count === null || integer(v.usage_count, -2147483648)) &&
    ['usable', 'expired', 'revoked', 'inactive'].includes(String(v.status)) && hash(v.fingerprint) && typeof v.is_current_credential === 'boolean' &&
    integer(v.scope_count, 0) && apiKeyScopesManifest(v.scopes_file) && v.scopes_file.key_id === v.id && v.scopes_file.fingerprint === v.fingerprint;
}
export function keyScopesReadInput(v: unknown): ApiKeyScopesRead {
  shape(v, ['key_id', 'expected_fingerprint', 'expected_sha256']); keyReadInput({ key_id: v.key_id });
  if (!hash(v.expected_fingerprint) || !hash(v.expected_sha256)) fail();
  return { ...v, key_id: String(v.key_id).toLowerCase() } as ApiKeyScopesRead;
}
export async function keyMetadataDigest(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), b => b.toString(16).padStart(2, '0')).join('');
}
export function verifiedApiKeyScopes(bytes: Uint8Array, metadata: ApiKeyScopesFile): string[] {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(true); }
  if (!exact(value, ['account_id', 'key_id', 'fingerprint', 'format', 'scopes']) || value.account_id !== metadata.account_id ||
    value.key_id !== metadata.key_id || value.fingerprint !== metadata.fingerprint || value.format !== metadata.format ||
    !Array.isArray(value.scopes) || !value.scopes.every(scope => typeof scope === 'string')) fail(true);
  return value.scopes as string[];
}
function result<T>(value: unknown, parse: (v: unknown) => v is T) {
  if (!record(value) || Object.keys(value).some(key => !['outcome', 'data', 'operation', 'revision', 'next_action', 'website_url', 'error'].includes(key)) ||
    value.error != null || value.operation != null || !record(value.next_action) ||
    Object.keys(value.next_action).some(key => !['kind', 'label', 'record_id'].includes(key))) fail(true);
  return journeyResult(value, parse);
}
export class ApiKeyMetadataClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  private async read<T>(name: string, input: object, parse: (v: unknown) => v is T) {
    return result(await this.client.request('/api/v1/journey/' + name + '?' + new URLSearchParams({ arguments: JSON.stringify(input) })), parse);
  }
  async get(input: ApiKeyRead) {
    const args = keyReadInput(input);
    return this.read('get_api_key_summary', args, (v): v is ApiKeySummary => apiKeySummary(v) && v.id === args.key_id.toLowerCase());
  }
  async list(input: ApiKeyList = {}) {
    shape(input, ['after']); if (input.after != null && !uuid(input.after)) fail();
    const after = input.after?.toLowerCase() ?? null;
    return this.read('list_api_key_summaries', { after }, (v): v is ApiKeySummaryDirectory => {
      if (!exact(v, ['account_id', 'items', 'after', 'next_after', 'has_more', 'total', 'active_quota_used', 'active_quota_limit', 'observed_at']) ||
        !account(v.account_id) || v.after !== after || typeof v.has_more !== 'boolean' || !integer(v.total, 0) || !integer(v.active_quota_used, 0) ||
        v.active_quota_limit !== 25 || typeof v.observed_at !== 'string' || !Array.isArray(v.items) || v.items.length > 25 || v.items.length > Number(v.total) ||
        !v.items.every(item => apiKeySummary(item) && item.scopes_file.account_id === v.account_id) ||
        (v.has_more ? v.items.length !== 25 || v.next_after !== v.items[24]?.id : v.next_after !== null)) return false;
      const ids = v.items.map(item => (item as ApiKeySummary).id.toLowerCase());
      return ids.every((id, index) => index ? id > ids[index - 1]! : after === null || id > after);
    });
  }
  async reviewRevocation(input: ApiKeyReviewInput) {
    const args = keyReviewInput(input);
    return this.read('review_api_key_revocation_summary', args, (v): v is ApiKeySummaryReview => exact(v,
      ['key', 'review_token', 'expires_at', 'revokes_current_credential']) && apiKeySummary(v.key) && v.key.id === args.key_id.toLowerCase() &&
      v.key.fingerprint === args.expected_fingerprint && v.key.scopes_file.account_id === args.expected_account_id &&
      typeof v.review_token === 'string' && v.review_token.length > 0 && v.review_token.length <= 4096 && typeof v.expires_at === 'string' &&
      v.revokes_current_credential === v.key.is_current_credential);
  }
  async chunk(input: ApiKeyScopesChunkRead) {
    const { chunk_index, ...source } = input; const args = keyScopesReadInput(source);
    if (!integer(chunk_index, 1, Math.ceil(MAX_API_KEY_SCOPES_FILE_BYTES / 24000))) fail();
    return this.read('get_api_key_scopes_chunk', { ...args, chunk_index }, (v): v is ApiKeyScopesChunk => {
      if (!exact(v, [...fileKeys, 'chunk_index', 'content_base64', 'chunk_sha256'])) return false;
      const manifest = Object.fromEntries(fileKeys.map(key => [key, v[key]]));
      return apiKeyScopesManifest(manifest) && manifest.key_id === args.key_id && manifest.fingerprint === args.expected_fingerprint &&
        manifest.sha256 === args.expected_sha256 && v.chunk_index === chunk_index && chunk_index <= manifest.chunk_count && hash(v.chunk_sha256) &&
        typeof v.content_base64 === 'string' && v.content_base64.length >= 4 && v.content_base64.length <= 32000;
    });
  }
  async downloadScopes(input: ApiKeyRead, transport: 'file' | 'chunks' = 'file') {
    const summary = (await this.get(input)).data;
    if (!summary) throw new JobHuntError('invalid_response');
    return this.downloadReviewedScopes(summary, transport);
  }
  async downloadReviewedScopes(summary: ApiKeySummary, transport: 'file' | 'chunks' = 'file') {
    if (!apiKeySummary(summary)) fail();
    if (!['file', 'chunks'].includes(transport)) fail();
    const metadata = summary.scopes_file;
    let bytes: Uint8Array;
    if (transport === 'file') {
      const value = await this.client.request('/api/v1/journey/api-key-permissions-file?' + new URLSearchParams({ arguments: JSON.stringify({
        key_id: metadata.key_id, expected_fingerprint: metadata.fingerprint, expected_sha256: metadata.sha256 }) }));
      if (!(value instanceof Uint8Array) || value.length !== metadata.size_bytes) fail(true);
      bytes = value;
    } else {
    bytes = new Uint8Array(metadata.size_bytes);
    for (let index = 1; index <= metadata.chunk_count; index++) {
      const part = (await this.chunk({ key_id: metadata.key_id, expected_fingerprint: metadata.fingerprint, expected_sha256: metadata.sha256, chunk_index: index })).data;
      if (!part || fileKeys.some(key => (part as unknown as JsonObject)[key] !== (metadata as unknown as JsonObject)[key])) fail(true);
      let decoded: string; try { decoded = atob(part.content_base64); } catch { fail(true); }
      const chunk = Uint8Array.from(decoded, c => c.charCodeAt(0));
      if (btoa(decoded) !== part.content_base64 || chunk.length !== Math.min(24000, bytes.length - (index - 1) * 24000) ||
        await keyMetadataDigest(chunk) !== part.chunk_sha256) fail(true);
      bytes.set(chunk, (index - 1) * 24000);
    }
    }
    if (await keyMetadataDigest(bytes) !== metadata.sha256) throw new JobHuntError('download_checksum_mismatch');
    const scopes = verifiedApiKeyScopes(bytes, metadata);
    if (scopes.length !== summary.scope_count) fail(true);
    return { summary, bytes, scopes };
  }
}
