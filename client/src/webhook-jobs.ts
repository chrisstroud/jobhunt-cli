/** Typed existing-worker facts and explicitly reviewed synthetic test/reconciliation. */
import type { JobHuntClient } from './index.ts';
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, operationResult, shape, uuid, type OperationReceipt } from './journey-contracts.ts';
import { webhookChangeResult, type WebhookChangeResolution } from './webhook-changes.ts';
type Target = { expected_account_id: string; subscription_id: string };
export type WebhookTestPlan = Target & { request_id: string; expected_metadata_sha256: string };
export type WebhookTestOriginal = WebhookTestPlan & { review_token: string; confirm_send: true };
export type WebhookReconcilePlan = Target & { request_id: string; job_id: string; expected_fingerprint: string };
export type WebhookReconcileOriginal = WebhookReconcilePlan & { review_token: string; confirm_reconcile: true };
export type WebhookJobRead = Target & { job_id: string };
export type WebhookJobPageRead = Target & { after?: string | null };
export type WebhookJobReview = { subscription_id: string; review_token: string; expires_at: string };
export type WebhookJobState = { job_id: string; subscription_id: string; request_id: string | null; kind: 'test' | 'event';
  job_state: 'pending' | 'running' | 'retry' | 'succeeded' | 'failed'; receiver_state: 'not_started' | 'unconfirmed' | 'confirmed' | 'inconsistent';
  delivery_id: string | null; response_status: number | null; attempt_count: number; max_attempts: number;
  next_attempt_at: string | null; lease_expires_at: string | null; failure_code: string | null; can_reconcile: boolean; fingerprint: string };
export type WebhookJobPage = { account_id: string; subscription_id: string; items: WebhookJobState[];
  after: string | null; next_after: string | null; has_more: boolean; total: number };
type Original = WebhookTestOriginal | WebhookReconcileOriginal;
type Plan = WebhookTestPlan | WebhookReconcilePlan;
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const exact = (v: unknown, keys: string[]): v is JsonObject => record(v) && Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k));
const stamp = (v: unknown) => v === null || typeof v === 'string' && Number.isFinite(Date.parse(v));
function target(value: unknown, extras: string[], optional: string[] = []): Target & Record<string, unknown> {
  shape(value, ['expected_account_id', 'subscription_id', ...extras, ...optional]);
  if (typeof value.expected_account_id !== 'string' || !value.expected_account_id.startsWith('jh_') || !uuid(value.expected_account_id.slice(3)) || !uuid(value.subscription_id) ||
    ['job_id', 'request_id'].some(key => key in value && !uuid(value[key])) || extras.some(key => !(key in value))) fail();
  return { ...value, expected_account_id: value.expected_account_id.toLowerCase(), subscription_id: String(value.subscription_id).toLowerCase(),
    ...Object.fromEntries(['job_id', 'request_id'].filter(key => key in value).map(key => [key, String(value[key]).toLowerCase()])) } as Target & Record<string, unknown>;
}
export function webhookTestInput(value: unknown, confirmed = false): WebhookTestPlan | WebhookTestOriginal {
  const args = target(value, ['request_id', 'expected_metadata_sha256', ...(confirmed ? ['review_token', 'confirm_send'] : [])]);
  if (!record(args) || !digest(args.expected_metadata_sha256) || confirmed && (args.confirm_send !== true || typeof args.review_token !== 'string' || !args.review_token.length || args.review_token.length > 4096)) fail();
  return args as WebhookTestOriginal;
}
export function webhookReconcileInput(value: unknown, confirmed = false): WebhookReconcilePlan | WebhookReconcileOriginal {
  const args = target(value, ['request_id', 'job_id', 'expected_fingerprint', ...(confirmed ? ['review_token', 'confirm_reconcile'] : [])]);
  if (!record(args) || !digest(args.expected_fingerprint) || confirmed && (args.confirm_reconcile !== true || typeof args.review_token !== 'string' || !args.review_token.length || args.review_token.length > 4096)) fail();
  return args as WebhookReconcileOriginal;
}
export async function webhookJobOriginalHash(input: Original) {
  const args = 'job_id' in input ? webhookReconcileInput(input, true) : webhookTestInput(input, true);
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(args).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))), b => b.toString(16).padStart(2, '0')).join('');
}
export function isWebhookJobState(value: unknown, subscriptionId: string, jobId?: string): value is WebhookJobState {
  if (!exact(value, ['job_id', 'subscription_id', 'request_id', 'kind', 'job_state', 'receiver_state', 'delivery_id', 'response_status', 'attempt_count',
    'max_attempts', 'next_attempt_at', 'lease_expires_at', 'failure_code', 'can_reconcile', 'fingerprint']) || !uuid(value.job_id) || jobId != null && value.job_id !== jobId ||
    value.subscription_id !== subscriptionId || !(value.request_id === null || uuid(value.request_id)) || !['test', 'event'].includes(String(value.kind)) ||
    !['pending', 'running', 'retry', 'succeeded', 'failed'].includes(String(value.job_state)) || !['not_started', 'unconfirmed', 'confirmed', 'inconsistent'].includes(String(value.receiver_state)) ||
    !(value.delivery_id === null || uuid(value.delivery_id)) || !(value.response_status === null || integer(value.response_status, 100, 599)) ||
    !integer(value.attempt_count, 0, 2147483647) || !integer(value.max_attempts, 1, 100) || !stamp(value.next_attempt_at) || !stamp(value.lease_expires_at) ||
    !(value.failure_code === null || typeof value.failure_code === 'string' && /^[a-z0-9._-]{1,64}$/u.test(value.failure_code)) || typeof value.can_reconcile !== 'boolean' || !digest(value.fingerprint)) return false;
  return !(value.receiver_state === 'confirmed' && (!uuid(value.delivery_id) || !integer(value.response_status, 200, 299)) ||
    value.can_reconcile && (value.receiver_state !== 'confirmed' || value.job_state === 'succeeded'));
}
const operation = (v: unknown, name: string): v is OperationReceipt => {
  if (!record(v) || v.kind !== name || v.resource !== null) return false;
  try { return operationResult({ outcome: 'ready', data: v, next_action: { kind: 'none', label: '' } }).data !== null; } catch { return false; }
};
export class WebhookJobClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  private read(name: string, args: object) { return this.client.request('/api/v1/journey/' + name + '?' + new URLSearchParams({ arguments: JSON.stringify(args) })); }
  private write(name: string, args: object) { return this.client.request('/api/v1/journey/' + name, { method: 'POST', body: args as JsonObject }); }
  async list(input: WebhookJobPageRead) {
    const args = target(input, [], ['after']) as WebhookJobPageRead;
    if (!(args.after == null || uuid(args.after))) fail();
    if (args.after) args.after = args.after.toLowerCase();
    return webhookChangeResult(await this.read('list_webhook_delivery_jobs', args), (v): v is WebhookJobPage => exact(v, ['account_id', 'subscription_id', 'items', 'after', 'next_after', 'has_more', 'total']) &&
      v.account_id === args.expected_account_id && v.subscription_id === args.subscription_id && Array.isArray(v.items) && v.items.length <= 25 &&
      v.items.every(row => isWebhookJobState(row, args.subscription_id)) && new Set(v.items.map(row => row.job_id)).size === v.items.length &&
      v.after === (args.after ?? null) && (v.next_after === null || uuid(v.next_after)) && typeof v.has_more === 'boolean' &&
      (v.has_more ? v.items.length === 25 && v.next_after === v.items.at(-1)?.job_id : v.next_after === null) && integer(v.total, v.items.length, 2147483647));
  }
  async get(input: WebhookJobRead) {
    const args = target(input, ['job_id']) as WebhookJobRead;
    return webhookChangeResult(await this.read('get_webhook_delivery_job', args), (v): v is WebhookJobState => isWebhookJobState(v, args.subscription_id, args.job_id));
  }
  private async review(input: Plan, test: boolean) {
    const args = test ? webhookTestInput(input) : webhookReconcileInput(input);
    const reply = webhookChangeResult(await this.read(test ? 'review_webhook_test' : 'review_webhook_delivery_reconciliation', args),
      (v): v is WebhookJobReview => exact(v, ['subscription_id', 'review_token', 'expires_at']) && v.subscription_id === args.subscription_id &&
        typeof v.review_token === 'string' && v.review_token.length > 0 && v.review_token.length <= 4096 && typeof v.expires_at === 'string' && Number.isFinite(Date.parse(v.expires_at)));
    if (reply.operation != null) fail(true); return reply;
  }
  reviewTest(input: WebhookTestPlan) { return this.review(input, true); }
  reviewReconciliation(input: WebhookReconcilePlan) { return this.review(input, false); }
  private async apply(input: Original, test: boolean) {
    const args = test ? webhookTestInput(input, true) : webhookReconcileInput(input, true), name = test ? 'send_webhook_test' : 'reconcile_webhook_delivery';
    const reply = webhookChangeResult(await this.write(name, args), (v): v is WebhookJobState => isWebhookJobState(v, args.subscription_id, 'job_id' in args ? args.job_id : undefined) && (!test || v.request_id === args.request_id && v.kind === 'test'));
    if (!operation(reply.operation, name)) fail(true); return reply;
  }
  sendTest(input: WebhookTestOriginal) { return this.apply(input, true); }
  reconcile(input: WebhookReconcileOriginal) { return this.apply(input, false); }
  private async check(input: Original, test: boolean) {
    const args = test ? webhookTestInput(input, true) : webhookReconcileInput(input, true), name = test ? 'send_webhook_test' : 'reconcile_webhook_delivery';
    const query = { expected_account_id: args.expected_account_id, subscription_id: args.subscription_id, request_id: args.request_id,
      expected_payload_hash: await webhookJobOriginalHash(args as Original) };
    const reply = webhookChangeResult(await this.read(test ? 'check_webhook_test' : 'check_webhook_delivery_reconciliation', query), (v): v is OperationReceipt => operation(v, name));
    if (reply.operation != null) fail(true); return reply;
  }
  checkTest(input: WebhookTestOriginal) { return this.check(input, true); }
  checkReconciliation(input: WebhookReconcileOriginal) { return this.check(input, false); }
  private async close(input: Original, test: boolean) {
    const args = test ? webhookTestInput(input, true) : webhookReconcileInput(input, true), name = test ? 'send_webhook_test' : 'reconcile_webhook_delivery';
    const reply = webhookChangeResult(await this.write(test ? 'close_webhook_test' : 'close_webhook_delivery_reconciliation', { original: args, confirm_close: true }),
      (v): v is WebhookChangeResolution => exact(v, ['request_id', 'state', 'operation']) && v.request_id === args.request_id &&
        ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)) && (v.state === 'recorded' ? operation(v.operation, name) : v.operation === null));
    if (reply.operation != null) fail(true); return reply;
  }
  closeTest(input: WebhookTestOriginal) { return this.close(input, true); }
  closeReconciliation(input: WebhookReconcileOriginal) { return this.close(input, false); }
}
