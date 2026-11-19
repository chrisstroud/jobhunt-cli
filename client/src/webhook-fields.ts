/** Bounded private files transport native fields; Python services own policy. */
import type { JobHuntClient } from './index.ts';
import { JobHuntError, record, type JsonObject } from './protocol.ts';
import { fail, integer, shape, uuid, type OperationReceipt } from './journey-contracts.ts';
import { resumeHostFileInput, type HostResumeFile } from './import-file-contracts.ts';
import { isWebhookCreationReview, isWebhookIssuanceReceipt, isWebhookSigningDelivery,
  webhookIssuanceResult, webhookRecipientFingerprint, type WebhookCreationReview,
  type WebhookSigningDelivery, type WebhookCreationResolution } from './webhook-issuance.ts';
import { isWebhookChangeReceipt, isWebhookChangeReview, isWebhookChangeSaved, webhookChangeResult,
  type WebhookChangeReview, type WebhookChangeSaved, type WebhookChangeResolution } from './webhook-changes.ts';

export const MAX_WEBHOOK_FIELDS_BYTES = 16 * 1024 * 1024;
type Source = { expected_account_id: string; request_id: string; source_sha256: string; source_size: number };
export type WebhookFieldCreation = Source & { recipient_public_key: string };
export type WebhookFieldIssue = WebhookFieldCreation & { review_token: string; confirm_create: true };
export type WebhookFieldUpdate = Source & { subscription_id: string; action: 'update'; expected_metadata_sha256: string };
export type WebhookFieldOriginal = WebhookFieldUpdate & { review_token: string; confirm_change: true };
type Input = WebhookFieldCreation | WebhookFieldIssue | WebhookFieldUpdate | WebhookFieldOriginal;
type Hosted<T> = T & { file: HostResumeFile };
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const exact = (v: unknown, keys: string[]): v is JsonObject => record(v) && Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k));
export function webhookFieldInput(value: unknown, creating: true, confirmed?: false): WebhookFieldCreation;
export function webhookFieldInput(value: unknown, creating: true, confirmed: true): WebhookFieldIssue;
export function webhookFieldInput(value: unknown, creating: false, confirmed?: false): WebhookFieldUpdate;
export function webhookFieldInput(value: unknown, creating: false, confirmed: true): WebhookFieldOriginal;
export function webhookFieldInput(value: unknown, creating: boolean, confirmed = false): Input {
  const consent = creating ? 'confirm_create' : 'confirm_change';
  shape(value, ['expected_account_id', 'request_id', 'source_sha256', 'source_size',
    ...(creating ? ['recipient_public_key'] : ['subscription_id', 'action', 'expected_metadata_sha256']), ...(confirmed ? ['review_token', consent] : [])]);
  if (typeof value.expected_account_id !== 'string' || !value.expected_account_id.startsWith('jh_') || !uuid(value.expected_account_id.slice(3)) ||
    !uuid(value.request_id) || !digest(value.source_sha256) || !integer(value.source_size, 2, MAX_WEBHOOK_FIELDS_BYTES)) fail();
  if (creating ? typeof value.recipient_public_key !== 'string' || !/^[A-Za-z0-9_-]{500,1024}$/u.test(value.recipient_public_key)
    : !uuid(value.subscription_id) || value.action !== 'update' || !digest(value.expected_metadata_sha256)) fail();
  if (confirmed && (typeof value.review_token !== 'string' || !value.review_token.length || value.review_token.length > 4096 || value[consent] !== true)) fail();
  return { ...value, expected_account_id: value.expected_account_id.toLowerCase(), request_id: String(value.request_id).toLowerCase(),
    ...(!creating ? { subscription_id: String(value.subscription_id).toLowerCase() } : {}) } as Input;
}
export async function webhookFieldFile(bytes: Uint8Array, creating: boolean, expected?: { source_size: number; source_sha256: string }) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 2 || bytes.length > MAX_WEBHOOK_FIELDS_BYTES) fail();
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), b => b.toString(16).padStart(2, '0')).join('');
  if (expected && (expected.source_size !== bytes.length || expected.source_sha256 !== sha256)) throw new JobHuntError('source_file_changed', 409);
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!record(value) || !Object.keys(value).length || Object.keys(value).some(k => !['url', 'events', ...(!creating ? ['is_active'] : [])].includes(k)) ||
      creating && (!('url' in value) || !('events' in value)) || 'url' in value && typeof value.url !== 'string' ||
      'events' in value && (!Array.isArray(value.events) || !value.events.length || !value.events.every(e => typeof e === 'string' && e.length > 0)) ||
      'is_active' in value && typeof value.is_active !== 'boolean') throw Error();
  } catch { throw new JobHuntError('invalid_input'); }
  return { source_size: bytes.length, source_sha256: sha256 };
}
export async function webhookFieldHash(original: WebhookFieldIssue | WebhookFieldOriginal) {
  const args = 'recipient_public_key' in original ? webhookFieldInput(original, true, true) : webhookFieldInput(original, false, true);
  const canonical = JSON.stringify(Object.fromEntries(Object.keys(args).sort().map(k => [k, args[k as keyof typeof args]])));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))), b => b.toString(16).padStart(2, '0')).join('');
}
export class WebhookFieldClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  private async upload(path: string, args: Input, bytes: Uint8Array) {
    await webhookFieldFile(bytes, 'recipient_public_key' in args, args);
    const form = new FormData(); form.set('intent', JSON.stringify(args));
    form.set('attributes', new Blob([new Uint8Array(bytes)], { type: 'application/json' }), 'webhook-fields.json');
    return this.client.request('/api/v1/journey/' + path, { method: 'POST', body: form });
  }
  private host(value: Hosted<WebhookFieldCreation>, creating: true, confirmed: false): Hosted<WebhookFieldCreation>;
  private host(value: Hosted<WebhookFieldIssue>, creating: true, confirmed: true): Hosted<WebhookFieldIssue>;
  private host(value: Hosted<WebhookFieldUpdate>, creating: false, confirmed: false): Hosted<WebhookFieldUpdate>;
  private host(value: Hosted<WebhookFieldOriginal>, creating: false, confirmed: true): Hosted<WebhookFieldOriginal>;
  private host(value: Hosted<Input>, creating: boolean, confirmed: boolean): Hosted<Input> {
    if (!record(value)) fail();
    const { file, ...input } = value;
    const args = creating ? confirmed ? webhookFieldInput(input, true, true) : webhookFieldInput(input, true)
      : confirmed ? webhookFieldInput(input, false, true) : webhookFieldInput(input, false);
    resumeHostFileInput({ expected_account_id: args.expected_account_id, request_id: args.request_id, file });
    return { ...args, file };
  }
  private async creationReview(value: unknown, args: WebhookFieldCreation) {
    const fingerprint = await webhookRecipientFingerprint(args.recipient_public_key);
    const reply = webhookIssuanceResult(value, (v): v is WebhookCreationReview => isWebhookCreationReview(v, fingerprint));
    if (reply.operation != null) fail(true);
    return reply;
  }
  private async issued(value: unknown, args: WebhookFieldIssue) {
    const fingerprint = await webhookRecipientFingerprint(args.recipient_public_key);
    const reply = webhookIssuanceResult(value, (v): v is WebhookSigningDelivery => isWebhookSigningDelivery(v, args.request_id) && v.recipient_fingerprint === fingerprint);
    if (!isWebhookIssuanceReceipt(reply.operation)) fail(true);
    return reply;
  }
  private reviewed(value: unknown, args: WebhookFieldUpdate) {
    const reply = webhookChangeResult(value, (v): v is WebhookChangeReview => isWebhookChangeReview(v, args));
    if (reply.operation != null) fail(true);
    return reply;
  }
  private updated(value: unknown, args: WebhookFieldOriginal) {
    const reply = webhookChangeResult(value, (v): v is WebhookChangeSaved => isWebhookChangeSaved(v, args));
    if (!isWebhookChangeReceipt(reply.operation, args)) fail(true);
    return reply;
  }
  async reviewCreation(input: WebhookFieldCreation, bytes: Uint8Array) {
    const args = webhookFieldInput(input, true);
    return this.creationReview(await this.upload('webhook-fields-creation-review', args, bytes), args);
  }
  async issue(input: WebhookFieldIssue, bytes: Uint8Array) {
    const args = webhookFieldInput(input, true, true);
    return this.issued(await this.upload('webhook-fields-issue', args, bytes), args);
  }
  async reviewUpdate(input: WebhookFieldUpdate, bytes: Uint8Array) {
    const args = webhookFieldInput(input, false);
    return this.reviewed(await this.upload('webhook-fields-update-review', args, bytes), args);
  }
  async update(input: WebhookFieldOriginal, bytes: Uint8Array) {
    const args = webhookFieldInput(input, false, true);
    return this.updated(await this.upload('webhook-fields-update', args, bytes), args);
  }
  async reviewHostCreation(input: Hosted<WebhookFieldCreation>) {
    const args = this.host(input, true, false);
    return this.creationReview(await this.client.request('/api/v1/journey/review_webhook_fields_file_creation?' + new URLSearchParams({ arguments: JSON.stringify(args) })), args);
  }
  async issueHost(input: Hosted<WebhookFieldIssue>) {
    const args = this.host(input, true, true);
    return this.issued(await this.client.request('/api/v1/journey/issue_webhook_fields_file', { method: 'POST', body: args as unknown as JsonObject }), args);
  }
  async reviewHostUpdate(input: Hosted<WebhookFieldUpdate>) {
    const args = this.host(input, false, false);
    return this.reviewed(await this.client.request('/api/v1/journey/review_webhook_fields_file_update?' + new URLSearchParams({ arguments: JSON.stringify(args) })), args);
  }
  async updateHost(input: Hosted<WebhookFieldOriginal>) {
    const args = this.host(input, false, true);
    return this.updated(await this.client.request('/api/v1/journey/update_webhook_fields_file', { method: 'POST', body: args as unknown as JsonObject }), args);
  }
  async checkCreation(input: WebhookFieldIssue) {
    const args = webhookFieldInput(input, true, true), query = { expected_account_id: args.expected_account_id, request_id: args.request_id, expected_payload_hash: await webhookFieldHash(args) };
    const reply = webhookIssuanceResult(await this.client.request('/api/v1/journey/check_webhook_creation?' + new URLSearchParams({ arguments: JSON.stringify(query) })), isWebhookIssuanceReceipt);
    if (reply.operation != null) fail(true);
    return reply;
  }
  async checkUpdate(input: WebhookFieldOriginal) {
    const args = webhookFieldInput(input, false, true), query = { expected_account_id: args.expected_account_id, request_id: args.request_id, action: args.action, expected_payload_hash: await webhookFieldHash(args) };
    const reply = webhookChangeResult(await this.client.request('/api/v1/journey/check_webhook_change?' + new URLSearchParams({ arguments: JSON.stringify(query) })), (v): v is OperationReceipt => isWebhookChangeReceipt(v, args));
    if (reply.operation != null) fail(true);
    return reply;
  }
  async closeCreation(input: WebhookFieldIssue) {
    const original = webhookFieldInput(input, true, true);
    const reply = webhookIssuanceResult(await this.client.request('/api/v1/journey/close_webhook_fields_file_creation', { method: 'POST', body: { original, confirm_close: true } }),
      (v): v is WebhookCreationResolution => exact(v, ['request_id', 'state', 'subscription_id']) && v.request_id === original.request_id &&
        ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)) && (v.state === 'closed' ? v.subscription_id === null : v.subscription_id === null || uuid(v.subscription_id)));
    if (reply.operation != null) fail(true);
    return reply;
  }
  async closeUpdate(input: WebhookFieldOriginal) {
    const original = webhookFieldInput(input, false, true);
    const reply = webhookChangeResult(await this.client.request('/api/v1/journey/close_webhook_fields_file_update', { method: 'POST', body: { original, confirm_close: true } }),
      (v): v is WebhookChangeResolution => exact(v, ['request_id', 'state', 'operation']) && v.request_id === original.request_id &&
        ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)) && (v.state === 'recorded' ? isWebhookChangeReceipt(v.operation, original) : v.operation === null));
    if (reply.operation != null) fail(true);
    return reply;
  }
}
