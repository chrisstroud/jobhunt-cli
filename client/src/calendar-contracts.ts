/** Calendar-purpose connections, with no reusable credentials or raw provider errors. */
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, optional, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type CalendarConnectionRead = { connection_id: string; provider?: null } | { connection_id?: null; provider: string };
export type CalendarConnectionList = { page?: number };
export type CalendarConnection = { id: string; provider: string; purpose: 'calendar'; calendar_id: string | null;
  sync_interviews: boolean | null; sync_tasks: boolean | null; sync_enabled: boolean | null; sync_settings: JsonObject;
  stored_sync_settings: JsonObject | null; scopes: string[]; last_synced_at: string | null; has_error: boolean;
  consecutive_errors: number | null; is_expired: boolean; created_at: string | null; updated_at: string | null; fingerprint: string };
export type CalendarConnections = { items: CalendarConnection[]; page: number; total: number; has_more: boolean };
export type CalendarSettings = { sync_interviews?: boolean | null; sync_tasks?: boolean | null; sync_enabled?: boolean | null;
  calendar_id?: string | null; sync_settings?: JsonObject };
export type CalendarConnectionEdit = MutationIntent & { connection_id: string; expected_fingerprint: string };
export type CalendarConnectionUpdate = CalendarConnectionEdit & { settings: CalendarSettings };
export type CalendarDisconnected = { id: string; disconnected: true };
export type AvailableCalendarsRead = { connection_id: string; cursor?: string | null };
export type CalendarChoice = { id: string; name: string; primary: boolean };
export type AvailableCalendars = { connection_id: string; connection_fingerprint: string; items: CalendarChoice[]; next_cursor: string | null };
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const nullableText = (v: unknown) => v === null || typeof v === 'string';
const nullableBool = (v: unknown) => v === null || typeof v === 'boolean';

export function availableInput(v: unknown): AvailableCalendarsRead {
  shape(v, ['connection_id', 'cursor']);
  if (!uuid(v.connection_id) || !optional(v.cursor, value => text(value, 16384) && String(value).length > 0)) fail();
  return v as AvailableCalendarsRead;
}
export const availableResult = (value: unknown, args: AvailableCalendarsRead) => journeyResult(value, (v): v is AvailableCalendars => {
  if (!record(v) || typeof v.connection_id !== 'string' || !same(v.connection_id, args.connection_id) || !digest(v.connection_fingerprint) ||
    !(v.next_cursor === null || (typeof v.next_cursor === 'string' && v.next_cursor.length > 0 && v.next_cursor.length <= 16384)) ||
    !Array.isArray(v.items) || v.items.length > 250 || !v.items.every(item => record(item) && typeof item.id === 'string' && item.id.length > 0 &&
      typeof item.name === 'string' && typeof item.primary === 'boolean' && Object.keys(item).every(key => ['id', 'name', 'primary'].includes(key))) ||
    !Object.keys(v).every(key => ['connection_id', 'connection_fingerprint', 'items', 'next_cursor'].includes(key))) return false;
  return new Set(v.items.map(item => (item as CalendarChoice).id)).size === v.items.length;
});

export function readInput(v: unknown): CalendarConnectionRead {
  shape(v, ['connection_id', 'provider']);
  if ((v.connection_id == null) === (v.provider == null)) fail();
  if (v.connection_id != null ? !uuid(v.connection_id) : !text(v.provider, 50) || !String(v.provider).length) fail(); return v as CalendarConnectionRead;
}
export function listInput(v: unknown): CalendarConnectionList {
  shape(v, ['page']); if (v.page !== undefined && !integer(v.page, 1, 10000)) fail(); return v as CalendarConnectionList;
}
export function editInput(v: unknown, settings = false): CalendarConnectionEdit {
  shape(v, [...intentKeys, 'connection_id', 'expected_fingerprint', ...(settings ? ['settings'] : [])]); intent(v);
  if (!uuid(v.connection_id) || !digest(v.expected_fingerprint)) fail(); return v as CalendarConnectionEdit;
}
export function updateInput(v: unknown): CalendarConnectionUpdate {
  editInput(v, true); if (!record(v)) fail();
  shape(v.settings, ['sync_interviews', 'sync_tasks', 'sync_enabled', 'calendar_id', 'sync_settings']);
  const values = v.settings;
  if (!Object.keys(values).some(key => values[key] !== undefined)) fail();
  for (const key of ['sync_interviews', 'sync_tasks', 'sync_enabled']) if (!optional(values[key], value => typeof value === 'boolean')) fail();
  if (!optional(values.calendar_id, value => text(value, 255))) fail();
  if (values.sync_settings !== undefined && (!record(values.sync_settings) || (values.sync_settings.task_types !== undefined && !record(values.sync_settings.task_types)))) fail();
  return v as CalendarConnectionUpdate;
}
function connection(v: unknown): v is CalendarConnection {
  return record(v) && uuid(v.id) && typeof v.provider === 'string' && v.purpose === 'calendar' && nullableText(v.calendar_id) &&
    nullableBool(v.sync_interviews) && nullableBool(v.sync_tasks) && nullableBool(v.sync_enabled) && record(v.sync_settings) &&
    (v.stored_sync_settings === null || record(v.stored_sync_settings)) && Array.isArray(v.scopes) && v.scopes.every(item => typeof item === 'string') &&
    nullableText(v.last_synced_at) && typeof v.has_error === 'boolean' && (v.consecutive_errors === null || integer(v.consecutive_errors, -2147483648, 2147483647)) &&
    typeof v.is_expired === 'boolean' && nullableText(v.created_at) && nullableText(v.updated_at) && digest(v.fingerprint) &&
    !['user_id', 'access_token', 'refresh_token', '_access_token', '_refresh_token', 'last_error', 'grant_binding'].some(key => Object.hasOwn(v, key));
}
export const connectionResult = (value: unknown, args: CalendarConnectionRead) => journeyResult(value, (v): v is CalendarConnection => connection(v) &&
  (args.connection_id != null ? same(v.id, args.connection_id) : v.provider === args.provider));
export const connectionsResult = (value: unknown, args: CalendarConnectionList) => journeyResult(value, (v): v is CalendarConnections => {
  if (!record(v) || v.page !== (args.page ?? 1) || !integer(v.total, 0) || v.has_more !== ((args.page ?? 1) * 25 < Number(v.total)) ||
    !Array.isArray(v.items) || v.items.length !== Math.min(25, Math.max(0, Number(v.total) - ((args.page ?? 1) - 1) * 25)) || !v.items.every(connection)) return false;
  return new Set(v.items.map(row => row.id)).size === v.items.length;
});
export const disconnectedResult = (value: unknown, args: CalendarConnectionEdit) => journeyResult(value, (v): v is CalendarDisconnected => record(v) &&
  typeof v.id === 'string' && same(v.id, args.connection_id) && v.disconnected === true);
