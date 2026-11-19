/** Native extension issuance is owner-authorized; decrypted access stays local. */
import type { JobHuntClient } from './index.ts';
import { JobHuntError, record, type JsonObject } from './protocol.ts';
import { fail, journeyResult, shape, uuid, type OperationReceipt } from './journey-contracts.ts';
export type ExtensionCreationInput = { expected_account_id: string; request_id: string; device_name: string; recipient_public_key: string };
export type ExtensionIssue = ExtensionCreationInput & { review_token: string; confirm_create: true };
export type ExtensionCreationReview = { recipient_fingerprint: string; review_token: string; expires_at: string };
export type ExtensionDeliveryRead = { expected_account_id: string; request_id: string };
export type ExtensionDeliveryAck = ExtensionDeliveryRead & { recipient_fingerprint: string; confirm_received: true };
export type ExtensionDelivery = { connection_id: string; request_id: string; recipient_fingerprint: string;
  state: 'available' | 'acknowledged' | 'expired' | 'unavailable'; sealed_jwe: string | null; expires_at: string };
export type ExtensionCreationResolution = { request_id: string; state: 'closed' | 'recorded' | 'recorded_expired'; connection_id: string | null };
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const account = (v: unknown) => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const exact = (v: unknown, keys: string[]): v is JsonObject => record(v) && Object.keys(v).length === keys.length && Object.keys(v).every(key => keys.includes(key));
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const operation = (v: unknown): v is OperationReceipt => exact(v, ['id', 'kind', 'status', 'resource', 'retry_after_seconds', 'retry_expires_at']) &&
  uuid(v.id) && v.kind === 'issue_extension_connection' && v.status === 'succeeded' && v.resource === null && v.retry_after_seconds === 0 && text(v.retry_expires_at, 64);
function readInput(value: unknown): ExtensionDeliveryRead {
  shape(value, ['expected_account_id', 'request_id']);
  if (!account(value.expected_account_id) || !uuid(value.request_id)) fail();
  return { ...value, request_id: String(value.request_id).toLowerCase() } as ExtensionDeliveryRead;
}
export function extensionCreationInput(value: unknown, issuing = false): ExtensionCreationInput | ExtensionIssue {
  shape(value, ['expected_account_id', 'request_id', 'device_name', 'recipient_public_key', ...(issuing ? ['review_token', 'confirm_create'] : [])]);
  readInput({ expected_account_id: value.expected_account_id, request_id: value.request_id });
  if (typeof value.device_name !== 'string' || !value.device_name.length || new TextEncoder().encode(value.device_name).byteLength > 524288 ||
    !text(value.recipient_public_key, 1024) || !/^[A-Za-z0-9_-]{500,1024}$/u.test(value.recipient_public_key)) fail();
  if (issuing && (!text(value.review_token, 4096) || value.confirm_create !== true)) fail();
  // Preserve the native original exactly; Python owns whitespace semantics.
  return { ...value, request_id: String(value.request_id).toLowerCase() } as ExtensionCreationInput | ExtensionIssue;
}
export async function extensionCreationHash(original: ExtensionIssue) {
  const args = extensionCreationInput(original, true);
  const stable = Object.fromEntries(Object.keys(args).sort().map(key => [key, args[key as keyof typeof args]]));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable)))), b => b.toString(16).padStart(2, '0')).join('');
}
function delivery(value: unknown, requestId: string): value is ExtensionDelivery {
  return exact(value, ['connection_id', 'request_id', 'recipient_fingerprint', 'state', 'sealed_jwe', 'expires_at']) && uuid(value.connection_id) &&
    value.request_id === requestId.toLowerCase() && digest(value.recipient_fingerprint) && text(value.expires_at, 64) &&
    ['available', 'acknowledged', 'expired', 'unavailable'].includes(String(value.state)) &&
    (value.state === 'available' ? text(value.sealed_jwe, 4096) && /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){4}$/u.test(value.sealed_jwe) : value.sealed_jwe === null);
}
function result<T>(value: unknown, parse: (v: unknown) => v is T) {
  if (!record(value) || Object.keys(value).some(key => !['outcome', 'data', 'operation', 'revision', 'next_action', 'website_url', 'error'].includes(key))) fail(true);
  const parsed = journeyResult(value, parse);
  if (parsed.operation && !operation(parsed.operation)) fail(true);
  return parsed;
}
export class ExtensionIssuanceClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  private async readOperation<T>(name: string, args: object, parse: (v: unknown) => v is T) {
    return result(await this.client.request('/api/v1/journey/' + name + '?' + new URLSearchParams({ arguments: JSON.stringify(args) })), parse);
  }
  async review(input: ExtensionCreationInput) {
    const args = extensionCreationInput(input);
    return this.readOperation('review_extension_creation', args, (v): v is ExtensionCreationReview => exact(v,
      ['recipient_fingerprint', 'review_token', 'expires_at']) && digest(v.recipient_fingerprint) && text(v.review_token, 4096) && text(v.expires_at, 64));
  }
  async issue(input: ExtensionIssue) {
    const args = extensionCreationInput(input, true);
    const reply = result(await this.client.request('/api/v1/journey/issue_extension_connection', { method: 'POST', body: args as unknown as JsonObject }),
      (v): v is ExtensionDelivery => delivery(v, args.request_id));
    if (!operation(reply.operation)) fail(true);
    return reply;
  }
  async get(input: ExtensionDeliveryRead) {
    const args = readInput(input);
    return this.readOperation('get_extension_delivery', args, (v): v is ExtensionDelivery => delivery(v, args.request_id));
  }
  async check(original: ExtensionIssue) {
    const expected_payload_hash = await extensionCreationHash(original);
    return this.readOperation('check_extension_creation', { expected_account_id: original.expected_account_id,
      request_id: original.request_id, expected_payload_hash }, operation);
  }
  async acknowledge(input: ExtensionDeliveryAck) {
    shape(input, ['expected_account_id', 'request_id', 'recipient_fingerprint', 'confirm_received']);
    readInput({ expected_account_id: input.expected_account_id, request_id: input.request_id });
    if (!digest(input.recipient_fingerprint) || input.confirm_received !== true) fail();
    return result(await this.client.request('/api/v1/journey/acknowledge_extension_delivery', { method: 'POST', body: input }),
      (v): v is ExtensionDelivery => delivery(v, input.request_id) && v.recipient_fingerprint === input.recipient_fingerprint && v.state === 'acknowledged');
  }
  async close(original: ExtensionIssue) {
    extensionCreationInput(original, true);
    return result(await this.client.request('/api/v1/journey/close_extension_creation', { method: 'POST', body: { original, confirm_close: true } as unknown as JsonObject }),
      (v): v is ExtensionCreationResolution => exact(v, ['request_id', 'state', 'connection_id']) && v.request_id === original.request_id.toLowerCase() &&
      ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)) && (v.state === 'closed' ? v.connection_id === null : v.connection_id === null || uuid(v.connection_id)));
  }
}

function encode(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, ''); }
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error();
  const bytes = Uint8Array.from(atob(value.replace(/-/gu, '+').replace(/_/gu, '/') + '='.repeat((-value.length % 4 + 4) % 4)), char => char.charCodeAt(0));
  if (encode(bytes) !== value) throw new Error();
  return bytes;
}
export async function createExtensionRecipient(crypto: Crypto = globalThis.crypto) {
  if (!crypto?.subtle) throw new JobHuntError('secure_delivery_unavailable');
  const keys = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, false, ['encrypt', 'decrypt']);
  const der = new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey));
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', der)), byte => byte.toString(16).padStart(2, '0')).join('');
  return { privateKey: keys.privateKey, recipient_public_key: encode(der), recipient_fingerprint: fingerprint };
}
export async function decryptExtensionDelivery(value: ExtensionDelivery, expected: ExtensionDeliveryRead & { connection_id: string }, privateKey: CryptoKey, crypto: Crypto = globalThis.crypto): Promise<string> {
  try {
    readInput({ expected_account_id: expected.expected_account_id, request_id: expected.request_id });
    if (!delivery(value, expected.request_id) || value.state !== 'available' || value.connection_id !== expected.connection_id || !crypto?.subtle || privateKey.type !== 'private') throw new Error();
    const algorithm = privateKey.algorithm as RsaHashedKeyAlgorithm;
    if (algorithm.name !== 'RSA-OAEP' || algorithm.hash.name !== 'SHA-256' || ![3072, 4096].includes(algorithm.modulusLength) || !privateKey.usages.includes('decrypt')) throw new Error();
    const [protectedPart, wrapped, iv, ciphertext, tag] = value.sealed_jwe!.split('.');
    const header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(protectedPart!))) as unknown;
    if (!exact(header, ['alg', 'enc', 'typ', 'kid', 'account_id', 'request_id', 'connection_id']) || header.alg !== 'RSA-OAEP-256' || header.enc !== 'A256GCM' ||
      header.typ !== 'jobhunt-extension+jwe' || header.kid !== value.recipient_fingerprint || header.account_id !== expected.expected_account_id ||
      header.request_id !== expected.request_id.toLowerCase() || header.connection_id !== expected.connection_id) throw new Error();
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(header).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
    if (encode(new TextEncoder().encode(canonical)) !== protectedPart) throw new Error();
    const nonce = decode(iv!), authentication = decode(tag!), encrypted = decode(ciphertext!), encryptedKey = decode(wrapped!);
    if (nonce.length !== 12 || authentication.length !== 16 || encrypted.length > 256 || encryptedKey.length !== algorithm.modulusLength / 8) throw new Error();
    const cek = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encryptedKey);
    if (cek.byteLength !== 32) throw new Error();
    const aes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
    const secret = new TextDecoder('utf-8', { fatal: true }).decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce,
      additionalData: new TextEncoder().encode(protectedPart), tagLength: 128 }, aes, new Uint8Array([...encrypted, ...authentication])));
    if (!/^[A-Za-z0-9_-]{64}$/u.test(secret)) throw new Error();
    return secret;
  } catch { throw new JobHuntError('invalid_credential_delivery'); }
}
