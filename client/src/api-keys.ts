/** Customer key metadata and original revocation; no plaintext credentials. */
import type { JobHuntClient } from './index.ts';
import { ApiKeyIssuanceClient } from './key-delivery.ts';
import { ApiKeyMetadataClient } from './key-metadata.ts';
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, journeyResult, shape, uuid, type JourneyResult, type OperationReceipt } from './journey-contracts.ts';

export type ApiKeyRead = { key_id: string };
export type ApiKeyList = { after?: string | null };
export type ApiKeyRecord = { id: string; name: string; key_prefix: string; tier: string | null; scopes: string[];
  is_active: boolean | null; expires_at: string | null; revoked_at: string | null; last_used_at: string | null;
  usage_count: number | null; created_at: string | null; status: 'usable' | 'expired' | 'revoked' | 'inactive';
  fingerprint: string; is_current_credential: boolean };
export type ApiKeyDirectory = { items: ApiKeyRecord[]; after: string | null; next_after: string | null; has_more: boolean;
  total: number; active_quota_used: number; active_quota_limit: 25; observed_at: string };
export type ApiKeyReviewInput = ApiKeyRead & { expected_account_id: string; expected_fingerprint: string };
export type ApiKeyReview = { key: ApiKeyRecord; review_token: string; expires_at: string; revokes_current_credential: boolean };
export type ApiKeyRevoke = ApiKeyReviewInput & { request_id: string; review_token: string; confirm_revoke: true };
export type ApiKeyRevoked = { id: string; revocation_recorded: true };
export type ApiKeyReceiptInput = { request_id: string; expected_account_id: string };
export type ApiKeyClose = { original: ApiKeyRevoke; confirm_close: true };
export type ApiKeyResolution = { id: string; request_id: string; state: 'closed' | 'recorded' | 'recorded_expired'; operation: OperationReceipt | null };
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const account = (v: unknown) => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const nullableText = (v: unknown) => v === null || typeof v === 'string';
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const exact = (v: unknown, keys: string[]): v is JsonObject => record(v) &&
  Object.keys(v).length === keys.length && Object.keys(v).every(key => keys.includes(key));
const keyFields = ['id', 'name', 'key_prefix', 'tier', 'scopes', 'is_active', 'expires_at', 'revoked_at',
  'last_used_at', 'usage_count', 'created_at', 'status', 'fingerprint', 'is_current_credential'];

export function keyReadInput(v: unknown): ApiKeyRead {
  shape(v, ['key_id']); if (!uuid(v.key_id)) fail(); return v as ApiKeyRead;
}
export function keyReviewInput(v: unknown): ApiKeyReviewInput {
  shape(v, ['key_id', 'expected_account_id', 'expected_fingerprint']);
  if (!uuid(v.key_id) || !account(v.expected_account_id) || !digest(v.expected_fingerprint)) fail();
  return v as ApiKeyReviewInput;
}
export function keyRevokeInput(v: unknown): ApiKeyRevoke {
  shape(v, ['key_id', 'expected_account_id', 'expected_fingerprint', 'request_id', 'review_token', 'confirm_revoke']);
  if (!uuid(v.key_id) || !account(v.expected_account_id) || !digest(v.expected_fingerprint) || !uuid(v.request_id) ||
    typeof v.review_token !== 'string' || !v.review_token.length || v.review_token.length > 4096 || v.confirm_revoke !== true) fail();
  return v as ApiKeyRevoke;
}
export function keyReceiptInput(v: unknown): ApiKeyReceiptInput {
  shape(v, ['request_id', 'expected_account_id']);
  if (!uuid(v.request_id) || !account(v.expected_account_id)) fail(); return v as ApiKeyReceiptInput;
}
export function keyCloseInput(v: unknown): ApiKeyClose {
  shape(v, ['original', 'confirm_close']); keyRevokeInput(v.original);
  if (v.confirm_close !== true) fail(); return v as ApiKeyClose;
}
function keyRecord(v: unknown): v is ApiKeyRecord {
  return exact(v, keyFields) && uuid(v.id) && typeof v.name === 'string' && typeof v.key_prefix === 'string' &&
    nullableText(v.tier) && Array.isArray(v.scopes) && v.scopes.every(scope => typeof scope === 'string') &&
    (v.is_active === null || typeof v.is_active === 'boolean') && nullableText(v.expires_at) && nullableText(v.revoked_at) &&
    nullableText(v.last_used_at) && (v.usage_count === null || integer(v.usage_count, -2147483648)) && nullableText(v.created_at) &&
    ['usable', 'expired', 'revoked', 'inactive'].includes(String(v.status)) && digest(v.fingerprint) && typeof v.is_current_credential === 'boolean';
}
function operation(v: unknown): v is OperationReceipt {
  return record(v) && uuid(v.id) && v.kind === 'revoke_api_key_record' && v.status === 'succeeded' &&
    v.resource === null && v.retry_after_seconds === 0 && typeof v.retry_expires_at === 'string' &&
    Object.keys(v).every(key => ['id', 'kind', 'status', 'resource', 'retry_after_seconds', 'retry_expires_at'].includes(key));
}

function keyResult<T>(value: unknown, parse: (v: unknown) => v is T): JourneyResult<T> {
  if (!record(value) || Object.keys(value).some(key => !['outcome', 'data', 'operation', 'revision', 'next_action', 'website_url', 'error'].includes(key)) ||
    (value.error != null) || (value.operation != null && !operation(value.operation)) ||
    !record(value.next_action) || Object.keys(value.next_action).some(key => !['kind', 'label', 'record_id'].includes(key))) fail(true);
  return journeyResult(value, parse);
}

export class ApiKeyClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  readonly issuance: ApiKeyIssuanceClient;
  readonly metadata: ApiKeyMetadataClient;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; this.issuance = new ApiKeyIssuanceClient(client); this.metadata = new ApiKeyMetadataClient(client); }
  private async readOperation<T>(name: string, args: object, parse: (v: unknown) => v is T): Promise<JourneyResult<T>> {
    return keyResult(await this.client.request('/api/v1/journey/' + name + '?' +
      new URLSearchParams({ arguments: JSON.stringify(args) })), parse);
  }
  async list(input: ApiKeyList = {}) {
    shape(input, ['after']); if (input.after != null && !uuid(input.after)) fail();
    const args = { ...input, ...(input.after == null ? {} : { after: input.after.toLowerCase() }) };
    return this.readOperation('list_api_key_records', args, (v): v is ApiKeyDirectory => {
      if (!exact(v, ['items', 'after', 'next_after', 'has_more', 'total', 'active_quota_used', 'active_quota_limit', 'observed_at']) ||
        v.after !== (args.after ?? null) || typeof v.has_more !== 'boolean' || !integer(v.total, 0) ||
        !integer(v.active_quota_used, 0) || v.active_quota_limit !== 25 || typeof v.observed_at !== 'string' ||
        !Array.isArray(v.items) || v.items.length > 25 || v.items.length > Number(v.total) || !v.items.every(keyRecord) ||
        (v.has_more ? v.items.length !== 25 || v.next_after !== v.items[24]?.id : v.next_after !== null)) return false;
      const ids = v.items.map(item => item.id.toLowerCase());
      return ids.every((id, i) => i ? id > ids[i - 1]! : input.after == null || id > input.after.toLowerCase());
    });
  }
  async get(input: ApiKeyRead) {
    const args = keyReadInput(input);
    return this.readOperation('get_api_key_record', args, (v): v is ApiKeyRecord => keyRecord(v) && same(v.id, args.key_id));
  }
  async reviewRevocation(input: ApiKeyReviewInput) {
    const args = keyReviewInput(input);
    return this.readOperation('review_api_key_revocation', args, (v): v is ApiKeyReview => exact(v,
      ['key', 'review_token', 'expires_at', 'revokes_current_credential']) && keyRecord(v.key) && same(v.key.id, args.key_id) &&
      v.key.fingerprint === args.expected_fingerprint && typeof v.review_token === 'string' && v.review_token.length > 0 &&
      v.review_token.length <= 4096 && typeof v.expires_at === 'string' && v.revokes_current_credential === v.key.is_current_credential);
  }
  async revoke(input: ApiKeyRevoke) {
    const args = keyRevokeInput(input);
    const result = keyResult(await this.client.request('/api/v1/journey/revoke_api_key_record',
      { method: 'POST', body: args as JsonObject }), (v): v is ApiKeyRevoked => exact(v, ['id', 'revocation_recorded']) &&
      typeof v.id === 'string' && same(v.id, args.key_id) && v.revocation_recorded === true);
    if (result.outcome === 'ready' && !operation(result.operation)) fail(true);
    return result;
  }
  async checkRevocation(input: ApiKeyReceiptInput) {
    const args = keyReceiptInput(input);
    return this.readOperation('get_api_key_revocation', args, operation);
  }
  async closeRevocation(input: ApiKeyClose) {
    const args = keyCloseInput(input);
    return keyResult(await this.client.request('/api/v1/journey/close_api_key_revocation',
      { method: 'POST', body: args as JsonObject }), (v): v is ApiKeyResolution => exact(v, ['id', 'request_id', 'state', 'operation']) &&
      typeof v.id === 'string' && same(v.id, args.original.key_id) && typeof v.request_id === 'string' && same(v.request_id, args.original.request_id) &&
      ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)) &&
      (v.state === 'recorded' ? operation(v.operation) : v.operation === null));
  }
}
