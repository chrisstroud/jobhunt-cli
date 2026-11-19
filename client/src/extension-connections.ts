import { ExtensionIssuanceClient } from './extension-delivery.ts';
/** Browser extension connections are distinct from scoped developer API keys. */
import type { JobHuntClient } from './index.ts';
import { record, type JsonObject } from './protocol.ts';
import { fail, journeyResult, shape, uuid, type OperationReceipt } from './journey-contracts.ts';
export type ExtensionConnection = { account_id: string; id: string; device_name: string | null; created_at: string | null;
  last_used_at: string | null; expires_at: string | null; revoked: boolean | null; is_expired: boolean;
  status: 'usable' | 'expired' | 'revoked' | 'inactive'; fingerprint: string };
export type ExtensionDirectory = { account_id: string; items: ExtensionConnection[]; after: string | null; next_after: string | null; has_more: boolean; total: number; observed_at: string };
export type ExtensionRevokeReview = { token_id: string; expected_account_id: string; expected_fingerprint: string };
export type ExtensionRevoke = ExtensionRevokeReview & { request_id: string; review_token: string; confirm_revoke: true };
export type ExtensionReview = { connection: ExtensionConnection; review_token: string; expires_at: string };
export type ExtensionResolution = { id: string; request_id: string; state: 'closed' | 'recorded' | 'recorded_expired'; operation: OperationReceipt | null };
const account = (v: unknown): v is string => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const exact = (v: unknown, fields: string[]): v is JsonObject => record(v) && Object.keys(v).length === fields.length && Object.keys(v).every(key => fields.includes(key));
const optionalText = (v: unknown) => v === null || typeof v === 'string';
function connection(v: unknown): v is ExtensionConnection {
  return exact(v, ['account_id', 'id', 'device_name', 'created_at', 'last_used_at', 'expires_at', 'revoked', 'is_expired', 'status', 'fingerprint']) &&
    account(v.account_id) && uuid(v.id) && ['device_name', 'created_at', 'last_used_at', 'expires_at'].every(key => optionalText(v[key])) &&
    (v.revoked === null || typeof v.revoked === 'boolean') && typeof v.is_expired === 'boolean' &&
    v.status === (v.revoked ? 'revoked' : v.revoked !== false ? 'inactive' : v.is_expired ? 'expired' : 'usable') && digest(v.fingerprint);
}
function directory(v: unknown): v is ExtensionDirectory {
  if (!exact(v, ['account_id', 'items', 'after', 'next_after', 'has_more', 'total', 'observed_at']) || !Array.isArray(v.items)) return false;
  const items = v.items;
  return account(v.account_id) && items.length <= 25 && items.every(row => connection(row) && row.account_id === v.account_id) &&
    (v.after === null || uuid(v.after)) && (v.next_after === null || uuid(v.next_after)) && typeof v.has_more === 'boolean' &&
    v.has_more === (v.next_after !== null) && (!v.has_more || items.length === 25 && v.next_after === items[24].id) &&
    Number.isSafeInteger(v.total) && Number(v.total) >= items.length && typeof v.observed_at === 'string' &&
    items.every((row, index) => (!index || row.id > items[index - 1].id) && (v.after === null || row.id > String(v.after)));
}
export function extensionReviewInput(value: unknown): ExtensionRevokeReview {
  shape(value, ['token_id', 'expected_account_id', 'expected_fingerprint']);
  if (!uuid(value.token_id) || !account(value.expected_account_id) || !digest(value.expected_fingerprint)) fail();
  return { ...value, token_id: String(value.token_id).toLowerCase(), expected_account_id: 'jh_' + value.expected_account_id.slice(3).toLowerCase() } as ExtensionRevokeReview;
}
export function extensionRevokeInput(value: unknown): ExtensionRevoke {
  shape(value, ['token_id', 'expected_account_id', 'expected_fingerprint', 'request_id', 'review_token', 'confirm_revoke']);
  const reviewed = extensionReviewInput({ token_id: value.token_id, expected_account_id: value.expected_account_id, expected_fingerprint: value.expected_fingerprint });
  if (!uuid(value.request_id) || typeof value.review_token !== 'string' || !value.review_token.length || value.review_token.length > 4096 || value.confirm_revoke !== true) fail();
  return { ...value, ...reviewed, request_id: String(value.request_id).toLowerCase() } as ExtensionRevoke;
}
export async function extensionOriginalHash(value: ExtensionRevoke) {
  const input = extensionRevokeInput(value), stable = Object.fromEntries(Object.keys(input).sort().map(key => [key, input[key as keyof ExtensionRevoke]]));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable)))), byte => byte.toString(16).padStart(2, '0')).join('');
}
function operation(value: unknown): value is OperationReceipt {
  if (!record(value) || Object.keys(value).some(key => !['id', 'kind', 'status', 'resource', 'retry_after_seconds', 'retry_expires_at', 'error'].includes(key)) || value.error != null) return false;
  try { const parsed = journeyResult({ outcome: 'ready', data: true, operation: value, next_action: { kind: 'none', label: '' } }, (v): v is true => v === true);
    return Boolean(parsed.operation && parsed.operation.kind === 'revoke_extension_connection' && parsed.operation.status === 'succeeded' && parsed.operation.resource === null);
  } catch { return false; }
}
function result<T>(value: unknown, parse: (v: unknown) => v is T) {
  if (!record(value) || Object.keys(value).some(key => !['outcome', 'data', 'operation', 'revision', 'next_action', 'website_url', 'error'].includes(key))) fail(true);
  const output = journeyResult(value, parse);
  if (output.operation && !operation(output.operation)) fail(true);
  return output;
}
export class ExtensionConnectionsClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  readonly issuance: ExtensionIssuanceClient;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; this.issuance = new ExtensionIssuanceClient(client); }
  async list(input: { after?: string | null } = {}) {
    shape(input, ['after']); if (input.after !== undefined && input.after !== null && !uuid(input.after)) fail();
    const after = input.after?.toLowerCase() ?? null;
    return result(await this.client.request('/api/v1/journey/list_extension_connections?' + new URLSearchParams({ arguments: JSON.stringify({ after }) })),
      (v): v is ExtensionDirectory => directory(v) && v.after === after);
  }
  async get(input: { token_id: string }) {
    shape(input, ['token_id']); if (!uuid(input.token_id)) fail(); const token_id = input.token_id.toLowerCase();
    return result(await this.client.request('/api/v1/journey/get_extension_connection?' + new URLSearchParams({ arguments: JSON.stringify({ token_id }) })),
      (v): v is ExtensionConnection => connection(v) && v.id === token_id);
  }
  async review(input: ExtensionRevokeReview) {
    const args = extensionReviewInput(input);
    return result(await this.client.request('/api/v1/journey/review_extension_revocation?' + new URLSearchParams({ arguments: JSON.stringify(args) })),
      (v): v is ExtensionReview => exact(v, ['connection', 'review_token', 'expires_at']) && connection(v.connection) &&
        v.connection.id === args.token_id && v.connection.account_id === args.expected_account_id && v.connection.fingerprint === args.expected_fingerprint &&
        typeof v.review_token === 'string' && v.review_token.length > 0 && v.review_token.length <= 4096 && typeof v.expires_at === 'string');
  }
  async revoke(input: ExtensionRevoke) {
    const args = extensionRevokeInput(input);
    const value = result(await this.client.request('/api/v1/journey/revoke_extension_connection', { method: 'POST', body: args }),
      (v): v is { id: string; revocation_recorded: true } => exact(v, ['id', 'revocation_recorded']) && v.id === args.token_id && v.revocation_recorded === true);
    if (!value.operation) fail(true); return value;
  }
  async check(input: ExtensionRevoke) {
    const original = extensionRevokeInput(input), args = { expected_account_id: original.expected_account_id, request_id: original.request_id, expected_payload_hash: await extensionOriginalHash(original) };
    return result(await this.client.request('/api/v1/journey/check_extension_revocation?' + new URLSearchParams({ arguments: JSON.stringify(args) })), operation);
  }
  async close(input: ExtensionRevoke) {
    const original = extensionRevokeInput(input);
    return result(await this.client.request('/api/v1/journey/close_extension_revocation', { method: 'POST', body: { original, confirm_close: true } }),
      (v): v is ExtensionResolution => exact(v, ['id', 'request_id', 'state', 'operation']) && v.id === original.token_id && v.request_id === original.request_id &&
        (v.state === 'recorded' ? operation(v.operation) : ['closed', 'recorded_expired'].includes(String(v.state)) && v.operation === null));
  }
}
