/** Common wire contracts for the product's versioned operations. */
import { JobHuntError, record, type JsonObject } from './protocol.ts';

export type MutationIntent = { request_id: string; expected_account_id?: string | null };
export type OperationReceipt = {
  id: string; status: 'pending' | 'running' | 'succeeded' | 'failed'; kind: string;
  resource?: { id: string; kind: string; label: string; revision: number | null; website_url?: string | null } | null;
  related_ids?: string[] | null;
  retry_after_seconds: number; retry_expires_at: string; error?: { code: string; message: string } | null;
};
export type JourneyResult<T> = { outcome: 'ready' | 'pending' | 'needs_input' | 'conflict' | 'failed'; data: T | null;
  operation?: OperationReceipt | null; revision?: number | null; website_url?: string | null;
  next_action: { kind: string; label: string; record_id?: string | null }; error?: { code: string; message: string } | null };

export const integer = (value: unknown, minimum = 1, maximum = 2147483647) => Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
// Match the server's Unicode character limits, including supplementary planes.
export const text = (value: unknown, maximum: number) => typeof value === 'string' && [...value].length <= maximum && !value.includes('\0');
export const uuid = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(value);
export const resourceId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u.test(value);
export const optional = (value: unknown, check: (v: unknown) => boolean) => value === undefined || value === null || check(value);
export function fail(response = false): never { throw new JobHuntError(response ? 'invalid_response' : 'invalid_input'); }
export function shape(value: unknown, keys: string[]): asserts value is JsonObject {
  if (!record(value) || Object.keys(value).some(key => !keys.includes(key))) fail();
}
export function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number(value.slice(0, 4)) >= 1 && Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
export function deadline(value: unknown) {
  return calendarDate(value) || (typeof value === 'string' && value.length <= 40 && calendarDate(value.slice(0, 10)) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && Number.isFinite(Date.parse(value)));
}
export const intentKeys = ['request_id', 'expected_account_id'];
export function intent(value: JsonObject) {
  if (!uuid(value.request_id) || !optional(value.expected_account_id, value => typeof value === 'string' && value.startsWith('jh_') && uuid(value.slice(3)))) fail();
}
export function isOperationReceipt(value: unknown): value is OperationReceipt {
  if (!record(value) || !uuid(value.id) || !['pending', 'running', 'succeeded', 'failed'].includes(String(value.status)) ||
      !text(value.kind, 100) || !integer(value.retry_after_seconds, 0, 900) || !deadline(value.retry_expires_at)) return false;
  if (value.related_ids != null && (!Array.isArray(value.related_ids) || value.related_ids.length > 20 || !value.related_ids.every(resourceId))) return false;
  if (value.resource != null) {
    const r = value.resource;
    if (!record(r) || !text(r.id, 256) || !text(r.kind, 40) || !text(r.label, 255) || !(r.revision === null || integer(r.revision))) return false;
  }
  return true;
}
export function journeyResult<T>(value: unknown, data: (value: unknown) => value is T): JourneyResult<T> {
  if (!record(value) || !['ready', 'pending', 'needs_input', 'conflict', 'failed'].includes(String(value.outcome)) ||
      !record(value.next_action) || !text(value.next_action.kind, 40) || !text(value.next_action.label, 255) ||
      !optional(value.revision, value => integer(value)) || !optional(value.operation, isOperationReceipt) ||
      (value.data !== null && !data(value.data)) || (value.outcome === 'ready' && value.data === null) ||
      (value.outcome === 'pending' && !isOperationReceipt(value.operation))) fail(true);
  if (value.outcome === 'failed' || value.outcome === 'conflict') {
    if (!record(value.error) || typeof value.error.code !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/u.test(value.error.code)) fail(true);
    throw new JobHuntError(value.error.code, value.outcome === 'conflict' ? 409 : 502);
  }
  return value as unknown as JourneyResult<T>;
}
export const operationResult = (value: unknown) => journeyResult(value, isOperationReceipt);
