/** Recipient-encrypted issuance. Decryption is local; never return its secret to a model. */
import type { JobHuntClient } from './index.ts';
import { JobHuntError, record, type JsonObject } from './protocol.ts';
import { fail, integer, journeyResult, shape, uuid, type JourneyResult, type OperationReceipt } from './journey-contracts.ts';
import { resumeHostFileInput, type HostResumeFile } from './import-file-contracts.ts';

export type ApiKeyAttributes = { name: string; scopes: string[]; tier?: 'free' | 'paid' | 'partner' | 'agent'; expires_at?: string | null };
export type ApiKeyCreationReviewInput = { expected_account_id: string; request_id: string; attributes: ApiKeyAttributes; recipient_public_key: string };
export type ApiKeyIssue = ApiKeyCreationReviewInput & { review_token: string; confirm_create: true };
export type ApiKeyCreationReview = { recipient_fingerprint: string; active_quota_used: number; active_quota_limit: 25; review_token: string; expires_at: string };
export type ApiKeyDeliveryRead = { expected_account_id: string; request_id: string };
export type ApiKeyDeliveryAck = ApiKeyDeliveryRead & { recipient_fingerprint: string; confirm_received: true };
export type ApiKeyCreationClose = { original: ApiKeyIssue; confirm_close: true };
export type ApiKeyDelivery = { key_id: string; request_id: string; recipient_fingerprint: string;
  state: 'available' | 'acknowledged' | 'expired' | 'unavailable'; sealed_jwe: string | null; expires_at: string };
export type ApiKeyCreationResolution = { request_id: string; state: 'closed' | 'recorded' | 'recorded_expired'; key_id: string | null };
export const MAX_API_KEY_ATTRIBUTES_BYTES = 16 * 1024 * 1024;
export type ApiKeyFileReviewInput = ApiKeyDeliveryRead & { source_sha256: string; source_size: number; recipient_public_key: string };
export type ApiKeyFileIssue = ApiKeyFileReviewInput & { review_token: string; confirm_create: true };
export type ApiKeyFileHostReview = ApiKeyFileReviewInput & { file: HostResumeFile };
export type ApiKeyFileHostIssue = ApiKeyFileIssue & { file: HostResumeFile };
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const account = (v: unknown) => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const exact = (v: unknown, keys: string[]): v is JsonObject => record(v) && Object.keys(v).length === keys.length && Object.keys(v).every(key => keys.includes(key));
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const operation = (v: unknown): v is OperationReceipt => exact(v, ['id', 'kind', 'status', 'resource', 'retry_after_seconds', 'retry_expires_at']) &&
  uuid(v.id) && v.kind === 'issue_api_key_record' && v.status === 'succeeded' && v.resource === null && v.retry_after_seconds === 0 && text(v.retry_expires_at, 64);
function readInput(value: unknown): ApiKeyDeliveryRead {
  shape(value, ['expected_account_id', 'request_id']);
  if (!account(value.expected_account_id) || !uuid(value.request_id)) fail();
  return value as ApiKeyDeliveryRead;
}
export function keyFileCreationInput(value: unknown, issuing = false): ApiKeyFileReviewInput | ApiKeyFileIssue {
  shape(value, ['expected_account_id', 'request_id', 'source_sha256', 'source_size', 'recipient_public_key', ...(issuing ? ['review_token', 'confirm_create'] : [])]);
  readInput({ expected_account_id: value.expected_account_id, request_id: value.request_id });
  if (!digest(value.source_sha256) || !integer(value.source_size, 2, MAX_API_KEY_ATTRIBUTES_BYTES) || !text(value.recipient_public_key, 1024) ||
    !/^[A-Za-z0-9_-]{500,1024}$/u.test(value.recipient_public_key)) fail();
  if (issuing && (!text(value.review_token, 4096) || value.confirm_create !== true)) fail();
  return value as ApiKeyFileReviewInput | ApiKeyFileIssue;
}
export async function apiKeyAttributeFile(bytes: Uint8Array, expected?: { source_size: number; source_sha256: string }) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 2 || bytes.length > MAX_API_KEY_ATTRIBUTES_BYTES) fail();
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), byte => byte.toString(16).padStart(2, '0')).join('');
  if (expected && (expected.source_size !== bytes.length || expected.source_sha256 !== sha256)) throw new JobHuntError('source_file_changed', 409);
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!record(value) || Object.keys(value).some(key => !['name', 'scopes', 'tier', 'expires_at'].includes(key)) ||
      // Native Python owns trimming and field limits; JS trim differs for some
      // Unicode whitespace. File transport must not reject native-valid names.
      typeof value.name !== 'string' ||
      value.scopes !== undefined && (!Array.isArray(value.scopes) || !value.scopes.every(scope => typeof scope === 'string' && scope.length > 0)) ||
      value.tier !== undefined && !['free', 'paid', 'partner', 'agent'].includes(String(value.tier)) ||
      value.expires_at !== undefined && value.expires_at !== null && typeof value.expires_at !== 'string') throw new Error();
  } catch { throw new JobHuntError('invalid_input'); }
  return { source_size: bytes.length, source_sha256: sha256 };
}
export function keyCreationInput(value: unknown, issuing = false): ApiKeyCreationReviewInput | ApiKeyIssue {
  shape(value, ['expected_account_id', 'request_id', 'attributes', 'recipient_public_key', ...(issuing ? ['review_token', 'confirm_create'] : [])]);
  if (!account(value.expected_account_id) || !uuid(value.request_id) || !text(value.recipient_public_key, 1024) ||
    !/^[A-Za-z0-9_-]{500,1024}$/u.test(value.recipient_public_key)) fail();
  shape(value.attributes, ['name', 'scopes', 'tier', 'expires_at']);
  const attr = value.attributes;
  // Pydantic/native Python limits count Unicode code points, not UTF-16 units.
  if (typeof attr.name !== 'string' || Array.from(attr.name).length < 1 || Array.from(attr.name).length > 255 ||
    !Array.isArray(attr.scopes) || !attr.scopes.every(scope => text(scope, 524288)) ||
    attr.tier !== undefined && !['free', 'paid', 'partner', 'agent'].includes(String(attr.tier)) ||
    attr.expires_at !== undefined && attr.expires_at !== null && !text(attr.expires_at, 64)) fail();
  if (issuing && (!text(value.review_token, 4096) || value.confirm_create !== true)) fail();
  return value as ApiKeyCreationReviewInput | ApiKeyIssue;
}
function delivery(value: unknown, requestId: string): value is ApiKeyDelivery {
  return exact(value, ['key_id', 'request_id', 'recipient_fingerprint', 'state', 'sealed_jwe', 'expires_at']) && uuid(value.key_id) &&
    value.request_id === requestId.toLowerCase() && digest(value.recipient_fingerprint) && text(value.expires_at, 64) &&
    ['available', 'acknowledged', 'expired', 'unavailable'].includes(String(value.state)) &&
    (value.state === 'available' ? text(value.sealed_jwe, 4096) && /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){4}$/u.test(value.sealed_jwe) : value.sealed_jwe === null);
}
function result<T>(value: unknown, parse: (v: unknown) => v is T): JourneyResult<T> {
  if (!record(value) || Object.keys(value).some(key => !['outcome', 'data', 'operation', 'revision', 'next_action', 'website_url', 'error'].includes(key)) ||
    value.error != null || value.operation != null && !operation(value.operation) || !record(value.next_action) ||
    Object.keys(value.next_action).some(key => !['kind', 'label', 'record_id'].includes(key))) fail(true);
  return journeyResult(value, parse);
}
export class ApiKeyIssuanceClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  private async readOperation<T>(name: string, args: object, parse: (v: unknown) => v is T) {
    return result(await this.client.request('/api/v1/journey/' + name + '?' + new URLSearchParams({ arguments: JSON.stringify(args) })), parse);
  }
  async review(input: ApiKeyCreationReviewInput) {
    const args = keyCreationInput(input);
    return this.readOperation('review_api_key_creation', args, (v): v is ApiKeyCreationReview => exact(v,
      ['recipient_fingerprint', 'active_quota_used', 'active_quota_limit', 'review_token', 'expires_at']) && digest(v.recipient_fingerprint) &&
      integer(v.active_quota_used, 0) && v.active_quota_limit === 25 && text(v.review_token, 4096) && text(v.expires_at, 64));
  }
  async issue(input: ApiKeyIssue) {
    const args = keyCreationInput(input, true);
    const reply = result(await this.client.request('/api/v1/journey/issue_api_key_record', { method: 'POST', body: args as unknown as JsonObject }),
      (v): v is ApiKeyDelivery => delivery(v, args.request_id));
    if (!operation(reply.operation)) fail(true);
    return reply;
  }
  async get(input: ApiKeyDeliveryRead) {
    const args = readInput(input);
    return this.getDelivery(args);
  }
  private async getDelivery(args: ApiKeyDeliveryRead) {
    return this.readOperation('get_api_key_delivery', args, (v): v is ApiKeyDelivery => delivery(v, args.request_id));
  }
  async acknowledge(input: ApiKeyDeliveryAck) {
    shape(input, ['expected_account_id', 'request_id', 'recipient_fingerprint', 'confirm_received']);
    readInput({ expected_account_id: input.expected_account_id, request_id: input.request_id });
    if (!digest(input.recipient_fingerprint) || input.confirm_received !== true) fail();
    return result(await this.client.request('/api/v1/journey/acknowledge_api_key_delivery', { method: 'POST', body: input }),
      (v): v is ApiKeyDelivery => delivery(v, input.request_id) && v.recipient_fingerprint === input.recipient_fingerprint && v.state === 'acknowledged');
  }
  async close(input: ApiKeyCreationClose) {
    shape(input, ['original', 'confirm_close']); keyCreationInput(input.original, true);
    if (input.confirm_close !== true) fail();
    return result(await this.client.request('/api/v1/journey/close_api_key_creation', { method: 'POST', body: input as unknown as JsonObject }),
      (v): v is ApiKeyCreationResolution => exact(v, ['request_id', 'state', 'key_id']) && v.request_id === input.original.request_id.toLowerCase() &&
      ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)) && (v.state === 'closed' ? v.key_id === null : v.key_id === null || uuid(v.key_id)));
  }
  private async attributesUpload<T>(path: string, input: ApiKeyFileReviewInput | ApiKeyFileIssue, bytes: Uint8Array, parse: (value: unknown) => value is T) {
    await apiKeyAttributeFile(bytes, input);
    const form = new FormData(); form.set('intent', JSON.stringify(input));
    form.set('attributes', new Blob([new Uint8Array(bytes)], { type: 'application/json' }), 'api-key-attributes.json');
    return result(await this.client.request('/api/v1/journey/' + path, { method: 'POST', body: form }), parse);
  }
  async reviewFile(input: ApiKeyFileReviewInput, bytes: Uint8Array) {
    const args = keyFileCreationInput(input) as ApiKeyFileReviewInput;
    return this.attributesUpload('api-key-attributes-review', args, bytes, (v): v is ApiKeyCreationReview => exact(v,
      ['recipient_fingerprint', 'active_quota_used', 'active_quota_limit', 'review_token', 'expires_at']) && digest(v.recipient_fingerprint) &&
      integer(v.active_quota_used, 0) && v.active_quota_limit === 25 && text(v.review_token, 4096) && text(v.expires_at, 64));
  }
  async issueFile(input: ApiKeyFileIssue, bytes: Uint8Array) {
    const args = keyFileCreationInput(input, true) as ApiKeyFileIssue;
    const reply = await this.attributesUpload('api-key-attributes-issue', args, bytes, (v): v is ApiKeyDelivery => delivery(v, args.request_id));
    if (!operation(reply.operation)) fail(true);
    return reply;
  }
  async reviewHostFile(input: ApiKeyFileHostReview) {
    shape(input, ['expected_account_id', 'request_id', 'source_sha256', 'source_size', 'recipient_public_key', 'file']);
    const { file, ...raw } = input; const args = keyFileCreationInput(raw) as ApiKeyFileReviewInput;
    resumeHostFileInput({ expected_account_id: args.expected_account_id, request_id: args.request_id, file });
    return this.readOperation('review_api_key_fields_file', { ...args, file }, (v): v is ApiKeyCreationReview => exact(v,
      ['recipient_fingerprint', 'active_quota_used', 'active_quota_limit', 'review_token', 'expires_at']) && digest(v.recipient_fingerprint) &&
      integer(v.active_quota_used, 0) && v.active_quota_limit === 25 && text(v.review_token, 4096) && text(v.expires_at, 64));
  }
  async issueHostFile(input: ApiKeyFileHostIssue) {
    shape(input, ['expected_account_id', 'request_id', 'source_sha256', 'source_size', 'recipient_public_key', 'review_token', 'confirm_create', 'file']);
    const { file, ...raw } = input; const args = keyFileCreationInput(raw, true) as ApiKeyFileIssue;
    resumeHostFileInput({ expected_account_id: args.expected_account_id, request_id: args.request_id, file });
    const reply = result(await this.client.request('/api/v1/journey/issue_api_key_fields_file', { method: 'POST', body: { ...args, file } as unknown as JsonObject }),
      (v): v is ApiKeyDelivery => delivery(v, args.request_id));
    if (!operation(reply.operation)) fail(true);
    return reply;
  }
  async closeFile(input: { original: ApiKeyFileIssue; confirm_close: true }) {
    shape(input, ['original', 'confirm_close']); keyFileCreationInput(input.original, true);
    if (input.confirm_close !== true) fail();
    return result(await this.client.request('/api/v1/journey/close_api_key_fields_file_creation', { method: 'POST', body: input as unknown as JsonObject }),
      (v): v is ApiKeyCreationResolution => exact(v, ['request_id', 'state', 'key_id']) && v.request_id === input.original.request_id.toLowerCase() &&
      ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)) && (v.state === 'closed' ? v.key_id === null : v.key_id === null || uuid(v.key_id)));
  }
}

function encode(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, ''); }
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error();
  const bytes = Uint8Array.from(atob(value.replace(/-/gu, '+').replace(/_/gu, '/') + '='.repeat((-value.length % 4 + 4) % 4)), char => char.charCodeAt(0));
  if (encode(bytes) !== value) throw new Error();
  return bytes;
}
export async function createApiKeyRecipient(crypto: Crypto = globalThis.crypto) {
  if (!crypto?.subtle) throw new JobHuntError('secure_delivery_unavailable');
  const keys = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, false, ['encrypt', 'decrypt']);
  const der = new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey));
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', der)), byte => byte.toString(16).padStart(2, '0')).join('');
  return { privateKey: keys.privateKey, recipient_public_key: encode(der), recipient_fingerprint: fingerprint };
}
export async function decryptApiKeyDelivery(value: ApiKeyDelivery, expected: ApiKeyDeliveryRead & { key_id: string }, privateKey: CryptoKey, crypto: Crypto = globalThis.crypto): Promise<string> {
  try {
    readInput({ expected_account_id: expected.expected_account_id, request_id: expected.request_id });
    if (!delivery(value, expected.request_id) || value.state !== 'available' || value.key_id !== expected.key_id || !crypto?.subtle || privateKey.type !== 'private') throw new Error();
    const algorithm = privateKey.algorithm as RsaHashedKeyAlgorithm;
    if (algorithm.name !== 'RSA-OAEP' || algorithm.hash.name !== 'SHA-256' || ![3072, 4096].includes(algorithm.modulusLength) || !privateKey.usages.includes('decrypt')) throw new Error();
    const [protectedPart, wrapped, iv, ciphertext, tag] = value.sealed_jwe!.split('.');
    const header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(protectedPart!))) as unknown;
    if (!exact(header, ['alg', 'enc', 'typ', 'kid', 'account_id', 'request_id', 'key_id']) || header.alg !== 'RSA-OAEP-256' || header.enc !== 'A256GCM' ||
      header.typ !== 'jobhunt-api-key+jwe' || header.kid !== value.recipient_fingerprint || header.account_id !== expected.expected_account_id ||
      header.request_id !== expected.request_id.toLowerCase() || header.key_id !== expected.key_id) throw new Error();
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(header).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
    if (encode(new TextEncoder().encode(canonical)) !== protectedPart) throw new Error();
    const nonce = decode(iv!), authentication = decode(tag!), encrypted = decode(ciphertext!), encryptedKey = decode(wrapped!);
    if (nonce.length !== 12 || authentication.length !== 16 || encrypted.length > 256 || encryptedKey.length !== algorithm.modulusLength / 8) throw new Error();
    const cek = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encryptedKey);
    if (cek.byteLength !== 32) throw new Error();
    const aes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
    const secret = new TextDecoder('utf-8', { fatal: true }).decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce,
      additionalData: new TextEncoder().encode(protectedPart), tagLength: 128 }, aes, new Uint8Array([...encrypted, ...authentication])));
    if (!/^jsk_live_[a-f0-9]{32}$/u.test(secret)) throw new Error();
    return secret;
  } catch { throw new JobHuntError('invalid_credential_delivery'); }
}
