/** Reviewed configuration changes. Signing secrets and event bodies never cross this contract. */
import type { JobHuntClient } from './index.ts';
import { record, type JsonObject } from './protocol.ts';
import { fail, journeyResult, operationResult, shape, uuid, type OperationReceipt } from './journey-contracts.ts';

export type WebhookAttributes = { url?: string; events?: string[]; is_active?: boolean };
type Selection = { expected_account_id: string; subscription_id: string; request_id: string; expected_metadata_sha256: string };
export type WebhookChangePlan = Selection & ({ action: 'update'; attributes: WebhookAttributes } | { action: 'delete'; attributes?: null });
export type WebhookChangeOriginal = WebhookChangePlan & { review_token: string; confirm_change: true };
export type WebhookChangeReview = { subscription_id: string; action: 'update' | 'delete'; metadata_sha256: string;
  delivery_count: number; queued_job_count: number; review_token: string; expires_at: string };
export type WebhookChangeSaved = { id: string; action: 'update' | 'delete'; recorded: true };
export type WebhookChangeResolution = { request_id: string; state: 'closed' | 'recorded' | 'recorded_expired'; operation: OperationReceipt | null };
const fields = ['expected_account_id', 'subscription_id', 'request_id', 'expected_metadata_sha256', 'action', 'attributes'];
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const exact = (v: unknown, keys: string[]): v is JsonObject => record(v) && Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k));
const text = (v: unknown): v is string => typeof v === 'string' && new TextDecoder().decode(new TextEncoder().encode(v)) === v;
function parse(value: unknown, original: boolean): WebhookChangePlan | WebhookChangeOriginal {
  shape(value, original ? [...fields, 'review_token', 'confirm_change'] : fields);
  if (typeof value.expected_account_id !== 'string' || !value.expected_account_id.startsWith('jh_') || !uuid(value.expected_account_id.slice(3)) ||
    !uuid(value.subscription_id) || !uuid(value.request_id) || !digest(value.expected_metadata_sha256) || !['update', 'delete'].includes(String(value.action))) fail();
  if (value.action === 'update') {
    const attrs = value.attributes;
    shape(attrs, ['url', 'events', 'is_active']);
    if (!Object.keys(attrs).length || 'url' in attrs && (!text(attrs.url) || [...attrs.url].length < 1 || [...attrs.url].length > 2048) ||
      'events' in attrs && (!Array.isArray(attrs.events) || !attrs.events.length || attrs.events.length > 1000 || !attrs.events.every(e => text(e) && e.length)) ||
      'is_active' in attrs && typeof attrs.is_active !== 'boolean') fail();
  } else if ('attributes' in value && value.attributes !== null) fail();
  if (original && (!text(value.review_token) || !value.review_token.length || value.review_token.length > 4096 || value.confirm_change !== true)) fail();
  const result = { ...value, expected_account_id: 'jh_' + value.expected_account_id.slice(3).toLowerCase(),
    subscription_id: String(value.subscription_id).toLowerCase(), request_id: String(value.request_id).toLowerCase(),
    ...(record(value.attributes) ? { attributes: { ...value.attributes } } : {}) };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 524288) fail();
  return result as WebhookChangeOriginal | WebhookChangePlan;
}
export const webhookChangePlan = (v: unknown) => parse(v, false) as WebhookChangePlan;
export const webhookChangeOriginal = (v: unknown) => parse(v, true) as WebhookChangeOriginal;
function stable(v: unknown): unknown {
  return Array.isArray(v) ? v.map(stable) : record(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
}
export async function webhookChangeHash(original: WebhookChangeOriginal) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(webhookChangeOriginal(original))));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
function receipt(v: unknown, args: Pick<WebhookChangeOriginal, 'action'>): v is OperationReceipt {
  if (!record(v) || Object.keys(v).some(k => !['id', 'kind', 'status', 'resource', 'retry_after_seconds', 'retry_expires_at', 'error'].includes(k)) ||
    v.kind !== (args.action === 'update' ? 'update_webhook_subscription' : 'delete_webhook_subscription') || v.status !== 'succeeded' ||
    v.resource !== null || v.error != null || v.retry_after_seconds !== 0) return false;
  try { return operationResult({ outcome: 'ready', data: v, next_action: { kind: 'none', label: '' } }).data !== null; }
  catch { return false; }
}
function result<T>(value: unknown, check: (v: unknown) => v is T) {
  if (!record(value) || Object.keys(value).some(k => !['outcome', 'data', 'operation', 'revision', 'next_action', 'website_url', 'error'].includes(k))) fail(true);
  return journeyResult(value, check);
}
export { receipt as isWebhookChangeReceipt, result as webhookChangeResult };
export function isWebhookChangeReview(v: unknown, args: Pick<WebhookChangePlan, 'subscription_id' | 'action' | 'expected_metadata_sha256'>): v is WebhookChangeReview {
  return exact(v, ['subscription_id', 'action', 'metadata_sha256', 'delivery_count', 'queued_job_count', 'review_token', 'expires_at']) &&
    v.subscription_id === args.subscription_id && v.action === args.action && v.metadata_sha256 === args.expected_metadata_sha256 &&
    Number.isSafeInteger(v.delivery_count) && Number(v.delivery_count) >= 0 && Number.isSafeInteger(v.queued_job_count) && Number(v.queued_job_count) >= 0 &&
    text(v.review_token) && v.review_token.length > 0 && v.review_token.length <= 4096 && typeof v.expires_at === 'string' && Number.isFinite(Date.parse(v.expires_at));
}
export function isWebhookChangeSaved(v: unknown, args: Pick<WebhookChangePlan, 'subscription_id' | 'action'>): v is WebhookChangeSaved {
  return exact(v, ['id', 'action', 'recorded']) && v.id === args.subscription_id && v.action === args.action && v.recorded === true;
}
export class WebhookChangeClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async review(input: WebhookChangePlan) {
    const args = webhookChangePlan(input);
    const value = result(await this.client.request('/api/v1/journey/review_webhook_change?' + new URLSearchParams({ arguments: JSON.stringify(args) })),
      (v): v is WebhookChangeReview => isWebhookChangeReview(v, args));
    if (value.operation != null) fail(true);
    return value;
  }
  async apply(input: WebhookChangeOriginal) {
    const args = webhookChangeOriginal(input), name = args.action === 'update' ? 'update_webhook_subscription' : 'delete_webhook_subscription';
    const value = result(await this.client.request('/api/v1/journey/' + name, { method: 'POST', body: args }),
      (v): v is WebhookChangeSaved => isWebhookChangeSaved(v, args));
    if (!receipt(value.operation, args)) fail(true);
    return value;
  }
  async check(input: WebhookChangeOriginal) {
    const args = webhookChangeOriginal(input), query = { expected_account_id: args.expected_account_id, request_id: args.request_id,
      action: args.action, expected_payload_hash: await webhookChangeHash(args) };
    const value = result(await this.client.request('/api/v1/journey/check_webhook_change?' + new URLSearchParams({ arguments: JSON.stringify(query) })),
      (v): v is OperationReceipt => receipt(v, args));
    if (value.operation != null) fail(true);
    return value;
  }
  async close(input: WebhookChangeOriginal) {
    const args = webhookChangeOriginal(input);
    const value = result(await this.client.request('/api/v1/journey/close_webhook_change', { method: 'POST', body: { original: args, confirm_close: true } }),
      (v): v is WebhookChangeResolution => exact(v, ['request_id', 'state', 'operation']) && v.request_id === args.request_id &&
        ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)) && (v.state === 'recorded' ? receipt(v.operation, args) : v.operation === null));
    if (value.operation != null) fail(true);
    return value;
  }
}
