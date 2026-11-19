import { WebhookJobClient } from './webhook-jobs.ts';
import { WebhookMetadataClient } from './webhook-files.ts';
import { WebhookChangeClient } from './webhook-changes.ts';
import { WebhookIssuanceClient } from './webhook-issuance.ts';
import { WebhookFieldClient } from './webhook-fields.ts';
import type { JobHuntClient } from './index.ts';
import { JobHuntError, record } from './protocol.ts';
import { journeyResult, uuid } from './journey-contracts.ts';

export type WebhookRead = { expected_account_id: string };
export type WebhookPageRead = WebhookRead & { after?: string | null };
export type WebhookSubscriptionRead = WebhookRead & { subscription_id: string };
export type WebhookDeliveryRead = WebhookSubscriptionRead & { delivery_id: string };
export type WebhookDeliveryPageRead = WebhookSubscriptionRead & { after?: string | null };
export type WebhookSubscription = { id: string; url: string; events: string[]; is_active: boolean | null;
  consecutive_failures: number; last_triggered_at: string | null; created_at: string | null; updated_at: string | null };
export type WebhookDelivery = { id: string; subscription_id: string; event_type: string | null;
  response_status: number | null; attempt_count: number | null; success: boolean | null;
  error_message: string | null; delivered_at: string | null; created_at: string | null };
export type WebhookSubscriptionItem = Omit<WebhookSubscription, 'url' | 'events'>;
export type WebhookDeliveryItem = Omit<WebhookDelivery, 'error_message'>;
export type WebhookPage<T> = { account_id: string; items: T[]; after: string | null; next_after: string | null; has_more: boolean; total: number };
export type WebhookDeliveryPage = WebhookPage<WebhookDeliveryItem> & { subscription_id: string };
const exact = (v: unknown, fields: string[]) => record(v) && Object.keys(v).length === fields.length && Object.keys(v).every(k => fields.includes(k));
const text = (v: unknown) => v === null || typeof v === 'string';
const time = (v: unknown) => v === null || typeof v === 'string' && Number.isFinite(Date.parse(v));
const integer = (v: unknown) => v === null || Number.isSafeInteger(v);
function input<T>(value: T, required: string[], optional: string[] = []): T {
  if (!record(value) || Object.keys(value).some(k => !required.includes(k) && !optional.includes(k)) || required.some(k => !(k in value)) ||
      typeof value.expected_account_id !== 'string' || !value.expected_account_id.startsWith('jh_') || !uuid(value.expected_account_id.slice(3)) ||
      ['subscription_id', 'delivery_id', 'after'].some(k => value[k] != null && !uuid(value[k])) ||
      ['subscription_id', 'delivery_id'].some(k => k in value && !uuid(value[k]))) throw new JobHuntError('invalid_input');
  return { ...value, expected_account_id: value.expected_account_id.toLowerCase(),
    ...Object.fromEntries(['subscription_id', 'delivery_id', 'after'].filter(k => typeof value[k] === 'string').map(k => [k, String(value[k]).toLowerCase()])) } as T;
}
function subscription(v: unknown): v is WebhookSubscription {
  return record(v) && exact(v, ['id', 'url', 'events', 'is_active', 'consecutive_failures', 'last_triggered_at', 'created_at', 'updated_at']) &&
    uuid(v.id) && typeof v.url === 'string' && Array.isArray(v.events) && v.events.every(e => typeof e === 'string') &&
    (v.is_active === null || typeof v.is_active === 'boolean') && Number.isSafeInteger(v.consecutive_failures) &&
    time(v.last_triggered_at) && time(v.created_at) && time(v.updated_at);
}
function subscriptionItem(v: unknown): v is WebhookSubscriptionItem {
  return record(v) && exact(v, ['id', 'is_active', 'consecutive_failures', 'last_triggered_at', 'created_at', 'updated_at']) && subscription({ ...v, url: '', events: [] });
}
function deliveryItem(v: unknown): v is WebhookDeliveryItem {
  return record(v) && exact(v, ['id', 'subscription_id', 'event_type', 'response_status', 'attempt_count', 'success', 'delivered_at', 'created_at']) && delivery({ ...v, error_message: null });
}
function delivery(v: unknown): v is WebhookDelivery {
  return record(v) && exact(v, ['id', 'subscription_id', 'event_type', 'response_status', 'attempt_count', 'success', 'error_message', 'delivered_at', 'created_at']) &&
    uuid(v.id) && uuid(v.subscription_id) && text(v.event_type) && integer(v.response_status) && integer(v.attempt_count) &&
    (v.success === null || typeof v.success === 'boolean') && text(v.error_message) && time(v.delivered_at) && time(v.created_at);
}
function page<T extends { id: string }>(v: unknown, args: WebhookPageRead, check: (row: unknown) => row is T, extra: string[] = []): v is WebhookPage<T> {
  if (!record(v) || !exact(v, ['account_id', 'items', 'after', 'next_after', 'has_more', 'total', ...extra]) || v.account_id !== args.expected_account_id ||
      v.after !== (args.after ?? null) || !Array.isArray(v.items) || v.items.length > 25 || !v.items.every(check) ||
      !Number.isSafeInteger(v.total) || Number(v.total) < v.items.length || typeof v.has_more !== 'boolean') return false;
  const items = v.items as T[];
  if (items.some((r, i) => i ? r.id <= items[i - 1].id : args.after != null && r.id <= args.after)) return false;
  return v.has_more ? items.length === 25 && v.next_after === items[24].id && Number(v.total) > 25 : v.next_after === null;
}
export class WebhookClient {
  readonly jobs: WebhookJobClient;
  readonly fields: WebhookFieldClient;
  readonly issuance: WebhookIssuanceClient;
  readonly changes: WebhookChangeClient;
  readonly metadata: WebhookMetadataClient;
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) {
    this.jobs = new WebhookJobClient(client); this.client = client; this.fields = new WebhookFieldClient(client); this.metadata = new WebhookMetadataClient(client); this.changes = new WebhookChangeClient(client); this.issuance = new WebhookIssuanceClient(client); }
  private async read<T>(operation: string, args: object, check: (v: unknown) => v is T) {
    const value = await this.client.request('/api/v1/journey/' + operation + '?' + new URLSearchParams({ arguments: JSON.stringify(args) }));
    if (!record(value) || Object.keys(value).some(k => !['outcome', 'data', 'operation', 'revision', 'next_action', 'website_url', 'error'].includes(k)) || value.operation != null) throw new JobHuntError('invalid_response');
    return journeyResult(value, check);
  }
  list(args: WebhookPageRead) {
    args = input(args, ['expected_account_id'], ['after']);
    return this.read('list_webhook_subscriptions', args, (v): v is WebhookPage<WebhookSubscriptionItem> => page(v, args, subscriptionItem));
  }
  get(args: WebhookSubscriptionRead) {
    args = input(args, ['expected_account_id', 'subscription_id']);
    return this.read('get_webhook_subscription', args, (v): v is WebhookSubscription => subscription(v) && v.id === args.subscription_id);
  }
  deliveries(args: WebhookDeliveryPageRead) {
    args = input(args, ['expected_account_id', 'subscription_id'], ['after']);
    return this.read('list_webhook_deliveries', args, (v): v is WebhookDeliveryPage => record(v) && v.subscription_id === args.subscription_id && page(v, args, deliveryItem, ['subscription_id']) && v.items.every(row => row.subscription_id === args.subscription_id));
  }
  delivery(args: WebhookDeliveryRead) {
    args = input(args, ['expected_account_id', 'subscription_id', 'delivery_id']);
    return this.read('get_webhook_delivery', args, (v): v is WebhookDelivery => delivery(v) && v.id === args.delivery_id && v.subscription_id === args.subscription_id);
  }
}
