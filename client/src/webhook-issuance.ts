/** Native webhook creation with recipient-bound local signing-secret delivery. */
import type { JobHuntClient } from './index.ts';
import { JobHuntError, record, type JsonObject } from './protocol.ts';
import { deadline, fail, journeyResult, shape, uuid, type OperationReceipt } from './journey-contracts.ts';
export type WebhookCreationInput = { expected_account_id: string; request_id: string; url: string; events: string[]; recipient_public_key: string };
export type WebhookIssue = WebhookCreationInput & { review_token: string; confirm_create: true };
export type WebhookCreationReview = { recipient_fingerprint: string; review_token: string; expires_at: string };
export type WebhookSigningDeliveryRead = { expected_account_id: string; request_id: string };
export type WebhookSigningDeliveryAck = WebhookSigningDeliveryRead & { recipient_fingerprint: string; confirm_received: true };
export type WebhookSigningDelivery = { subscription_id: string; request_id: string; recipient_fingerprint: string;
  state: 'available' | 'acknowledged' | 'expired' | 'unavailable'; sealed_jwe: string | null; expires_at: string };
export type WebhookCreationResolution = { request_id: string; state: 'closed' | 'recorded' | 'recorded_expired'; subscription_id: string | null };
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const account = (v: unknown) => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const exact = (v: unknown, keys: string[]): v is JsonObject => record(v) && Object.keys(v).length === keys.length && Object.keys(v).every(key => keys.includes(key));
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const operation = (v: unknown): v is OperationReceipt => exact(v, ['id', 'kind', 'status', 'resource', 'retry_after_seconds', 'retry_expires_at']) &&
  uuid(v.id) && v.kind === 'issue_webhook_subscription' && v.status === 'succeeded' && v.resource === null && v.retry_after_seconds === 0 && deadline(v.retry_expires_at);
function readInput(value: unknown): WebhookSigningDeliveryRead {
  shape(value, ['expected_account_id', 'request_id']);
  if (!account(value.expected_account_id) || !uuid(value.request_id)) fail();
  return { ...value, expected_account_id: String(value.expected_account_id).toLowerCase(), request_id: String(value.request_id).toLowerCase() } as WebhookSigningDeliveryRead;
}
export function webhookCreationInput(value: unknown, issuing = false): WebhookCreationInput | WebhookIssue {
  shape(value, ['expected_account_id', 'request_id', 'url', 'events', 'recipient_public_key', ...(issuing ? ['review_token', 'confirm_create'] : [])]);
  readInput({ expected_account_id: value.expected_account_id, request_id: value.request_id });
  if (typeof value.url !== 'string' || [...value.url].length < 1 || [...value.url].length > 2048 || new TextDecoder().decode(new TextEncoder().encode(value.url)) !== value.url ||
    !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 1000 || !value.events.every(e => typeof e === 'string' && e.length > 0 && new TextDecoder().decode(new TextEncoder().encode(e)) === e) ||
    !text(value.recipient_public_key, 1024) || !/^[A-Za-z0-9_-]{500,1024}$/u.test(value.recipient_public_key)) fail();
  if (issuing && (!text(value.review_token, 4096) || value.confirm_create !== true)) fail();
  // Preserve the exact native creation original, including URL whitespace and event order.
  if (new TextEncoder().encode(JSON.stringify(value)).length > 524288) fail();
  return { ...value, expected_account_id: String(value.expected_account_id).toLowerCase(), request_id: String(value.request_id).toLowerCase() } as WebhookCreationInput | WebhookIssue;
}
export async function webhookCreationHash(original: WebhookIssue) {
  const args = webhookCreationInput(original, true);
  const stable = Object.fromEntries(Object.keys(args).sort().map(key => [key, args[key as keyof typeof args]]));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable)))), b => b.toString(16).padStart(2, '0')).join('');
}
function delivery(value: unknown, requestId: string): value is WebhookSigningDelivery {
  return exact(value, ['subscription_id', 'request_id', 'recipient_fingerprint', 'state', 'sealed_jwe', 'expires_at']) && uuid(value.subscription_id) &&
    value.request_id === requestId.toLowerCase() && digest(value.recipient_fingerprint) && deadline(value.expires_at) &&
    ['available', 'acknowledged', 'expired', 'unavailable'].includes(String(value.state)) &&
    (value.state === 'available' ? text(value.sealed_jwe, 4096) && /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){4}$/u.test(value.sealed_jwe) : value.sealed_jwe === null);
}
function result<T>(value: unknown, parse: (v: unknown) => v is T) {
  if (!record(value) || Object.keys(value).some(key => !['outcome', 'data', 'operation', 'revision', 'next_action', 'website_url', 'error'].includes(key))) fail(true);
  const parsed = journeyResult(value, parse);
  if (parsed.operation && !operation(parsed.operation)) fail(true);
  return parsed;
}
export function isWebhookCreationReview(v: unknown, fingerprint: string): v is WebhookCreationReview {
  return exact(v, ['recipient_fingerprint', 'review_token', 'expires_at']) && v.recipient_fingerprint === fingerprint &&
    text(v.review_token, 4096) && deadline(v.expires_at);
}
export { delivery as isWebhookSigningDelivery, operation as isWebhookIssuanceReceipt,
  result as webhookIssuanceResult, recipientFingerprint as webhookRecipientFingerprint };
export class WebhookIssuanceClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  private async readOperation<T>(name: string, args: object, parse: (v: unknown) => v is T) {
    const value = result(await this.client.request('/api/v1/journey/' + name + '?' + new URLSearchParams({ arguments: JSON.stringify(args) })), parse);
    if (value.operation != null) fail(true);
    return value;
  }
  async review(input: WebhookCreationInput) {
    const args = webhookCreationInput(input);
    const fingerprint = await recipientFingerprint(args.recipient_public_key);
    return this.readOperation('review_webhook_creation', args, (v): v is WebhookCreationReview => isWebhookCreationReview(v, fingerprint));
  }
  async issue(input: WebhookIssue) {
    const args = webhookCreationInput(input, true);
    const fingerprint = await recipientFingerprint(args.recipient_public_key);
    const reply = result(await this.client.request('/api/v1/journey/issue_webhook_subscription', { method: 'POST', body: args as unknown as JsonObject }),
      (v): v is WebhookSigningDelivery => delivery(v, args.request_id) && v.recipient_fingerprint === fingerprint);
    if (!operation(reply.operation)) fail(true);
    return reply;
  }
  async get(input: WebhookSigningDeliveryRead) {
    const args = readInput(input);
    return this.readOperation('get_webhook_signing_delivery', args, (v): v is WebhookSigningDelivery => delivery(v, args.request_id));
  }
  async check(original: WebhookIssue) {
    const expected_payload_hash = await webhookCreationHash(original);
    return this.readOperation('check_webhook_creation', { expected_account_id: original.expected_account_id,
      request_id: original.request_id, expected_payload_hash }, operation);
  }
  async acknowledge(input: WebhookSigningDeliveryAck) {
    shape(input, ['expected_account_id', 'request_id', 'recipient_fingerprint', 'confirm_received']);
    readInput({ expected_account_id: input.expected_account_id, request_id: input.request_id });
    if (!digest(input.recipient_fingerprint) || input.confirm_received !== true) fail();
    return result(await this.client.request('/api/v1/journey/acknowledge_webhook_signing_delivery', { method: 'POST', body: input }),
      (v): v is WebhookSigningDelivery => delivery(v, input.request_id) && v.recipient_fingerprint === input.recipient_fingerprint && v.state === 'acknowledged');
  }
  async close(original: WebhookIssue) {
    webhookCreationInput(original, true);
    return result(await this.client.request('/api/v1/journey/close_webhook_creation', { method: 'POST', body: { original, confirm_close: true } as unknown as JsonObject }),
      (v): v is WebhookCreationResolution => exact(v, ['request_id', 'state', 'subscription_id']) && v.request_id === original.request_id.toLowerCase() &&
      ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)) && (v.state === 'closed' ? v.subscription_id === null : v.subscription_id === null || uuid(v.subscription_id)));
  }
}

function encode(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, ''); }
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error();
  const bytes = Uint8Array.from(atob(value.replace(/-/gu, '+').replace(/_/gu, '/') + '='.repeat((-value.length % 4 + 4) % 4)), char => char.charCodeAt(0));
  if (encode(bytes) !== value) throw new Error();
  return bytes;
}
async function recipientFingerprint(publicKey: string) {
  try {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', decode(publicKey))), b => b.toString(16).padStart(2, '0')).join('');
  } catch { return fail(); }
}
export async function createWebhookRecipient(crypto: Crypto = globalThis.crypto) {
  if (!crypto?.subtle) throw new JobHuntError('secure_delivery_unavailable');
  const keys = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, false, ['encrypt', 'decrypt']);
  const der = new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey));
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', der)), byte => byte.toString(16).padStart(2, '0')).join('');
  return { privateKey: keys.privateKey, recipient_public_key: encode(der), recipient_fingerprint: fingerprint };
}
export async function decryptWebhookSigningDelivery(value: WebhookSigningDelivery, expected: WebhookSigningDeliveryRead & { subscription_id: string }, privateKey: CryptoKey, crypto: Crypto = globalThis.crypto): Promise<string> {
  try {
    readInput({ expected_account_id: expected.expected_account_id, request_id: expected.request_id });
    if (!delivery(value, expected.request_id) || value.state !== 'available' || value.subscription_id !== expected.subscription_id || !crypto?.subtle || privateKey.type !== 'private') throw new Error();
    const algorithm = privateKey.algorithm as RsaHashedKeyAlgorithm;
    if (algorithm.name !== 'RSA-OAEP' || algorithm.hash.name !== 'SHA-256' || ![3072, 4096].includes(algorithm.modulusLength) || !privateKey.usages.includes('decrypt')) throw new Error();
    const [protectedPart, wrapped, iv, ciphertext, tag] = value.sealed_jwe!.split('.');
    const header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(protectedPart!))) as unknown;
    if (!exact(header, ['alg', 'enc', 'typ', 'kid', 'account_id', 'request_id', 'subscription_id']) || header.alg !== 'RSA-OAEP-256' || header.enc !== 'A256GCM' ||
      header.typ !== 'jobhunt-webhook-signing+jwe' || header.kid !== value.recipient_fingerprint || header.account_id !== expected.expected_account_id ||
      header.request_id !== expected.request_id.toLowerCase() || header.subscription_id !== expected.subscription_id) throw new Error();
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(header).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
    if (encode(new TextEncoder().encode(canonical)) !== protectedPart) throw new Error();
    const nonce = decode(iv!), authentication = decode(tag!), encrypted = decode(ciphertext!), encryptedKey = decode(wrapped!);
    if (nonce.length !== 12 || authentication.length !== 16 || encrypted.length > 256 || encryptedKey.length !== algorithm.modulusLength / 8) throw new Error();
    const cek = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encryptedKey);
    if (cek.byteLength !== 32) throw new Error();
    const aes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
    const secret = new TextDecoder('utf-8', { fatal: true }).decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce,
      additionalData: new TextEncoder().encode(protectedPart), tagLength: 128 }, aes, new Uint8Array([...encrypted, ...authentication])));
    if (!/^[a-f0-9]{64}$/u.test(secret)) throw new Error();
    return secret;
  } catch { throw new JobHuntError('invalid_credential_delivery'); }
}
