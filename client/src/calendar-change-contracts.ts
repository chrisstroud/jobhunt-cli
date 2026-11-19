/** Reviewed native calendar delivery; state contains no source or provider bodies. */
import { record } from './protocol.ts';
import { deadline, fail, integer, intent, intentKeys, journeyResult, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type CalendarChangeSelection = { connection_id: string; source_kind: 'interview' | 'task'; source_id: string;
  action?: 'sync' | 'status' | 'remove'; recover_of?: string | null };
export type CalendarChangeReview = { selection: CalendarChangeSelection; mode: 'create' | 'update' | 'remove'; calendar_id: string;
  event_id: string | null; source_fingerprint: string; event_fingerprint: string; fingerprint: string; review_token: string;
  status_prefix: '' | 'Done' | 'Skipped'; previous_event_retained: boolean };
export type QueueCalendarChange = MutationIntent & { review_token: string };
export type CalendarChangeRead = { change_id: string };
export type CancelCalendarChange = MutationIntent & CalendarChangeRead & { expected_account_id: string; confirm_cancel: true };
export type ResolveCalendarChange = MutationIntent & CalendarChangeRead & { expected_account_id: string; expected_fingerprint: string; confirm_leave_unchanged: true };
export type CalendarChangeState = { id: string; selection: CalendarChangeSelection; mode: 'create' | 'update' | 'remove'; calendar_id: string;
  event_id: string; status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'needs_review' | 'resolved';
  provider_state: 'not_started' | 'unknown' | 'confirmed' | 'refused'; local_state: 'pending' | 'applied' | 'unchanged' | 'needs_review';
  failure_code: string | null;
  can_cancel: boolean; resolved_by: string | null; resolution: 'followup' | 'left_unchanged' | null; fingerprint: string };
export type CalendarChangesRead = { source_kind?: 'interview' | 'task' | null; source_id?: string | null; page?: number };
export type CalendarChanges = { items: CalendarChangeState[]; page: number; total: number; has_more: boolean };
export type UpcomingCalendarRead = { connection_id: string; cursor?: string | null };
export type UpcomingCalendarSources = { connection_id: string; as_of: string; fingerprint: string;
  items: { source_kind: 'interview' | 'task'; source_id: string }[]; total: number; interviews: number; tasks: number; offset: number; next_cursor: string | null };
export type QueueCalendarChanges = MutationIntent & { review_tokens: string[] };
export type CalendarBatchItem = { request_id: string; change: CalendarChangeState | null; error: { code: string; message: string; retry_after_seconds?: number | null } | null };
export type CalendarBatchQueued = { batch_id: string; items: CalendarBatchItem[]; accepted: number; rejected: number };
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(key => allowed.includes(key));
const kinds = ['interview', 'task'];
const modes = ['create', 'update', 'remove'];
const actions = ['sync', 'status', 'remove'];

export function selectionInput(v: unknown): CalendarChangeSelection {
  shape(v, ['connection_id', 'source_kind', 'source_id', 'action', 'recover_of']);
  if (!uuid(v.connection_id) || !uuid(v.source_id) || !kinds.includes(String(v.source_kind)) ||
    (v.action !== undefined && !actions.includes(String(v.action))) ||
    (v.recover_of != null && !uuid(v.recover_of)) || (v.recover_of && v.action === 'status')) fail();
  return v as CalendarChangeSelection;
}
export function readInput(v: unknown): CalendarChangeRead {
  shape(v, ['change_id']); if (!uuid(v.change_id)) fail(); return v as CalendarChangeRead;
}
export function queueInput(v: unknown): QueueCalendarChange {
  shape(v, [...intentKeys, 'review_token']); intent(v);
  if (!text(v.review_token, 8192) || !String(v.review_token).length) fail(); return v as QueueCalendarChange;
}
export function controlInput(v: unknown, resolve = false): CancelCalendarChange | ResolveCalendarChange {
  shape(v, [...intentKeys, 'change_id', ...(resolve ? ['expected_fingerprint', 'confirm_leave_unchanged'] : ['confirm_cancel'])]); intent(v);
  if (!uuid(v.change_id) || typeof v.expected_account_id !== 'string' ||
    (resolve ? !digest(v.expected_fingerprint) || v.confirm_leave_unchanged !== true : v.confirm_cancel !== true)) fail();
  return v as CancelCalendarChange | ResolveCalendarChange;
}
export function listInput(v: unknown): CalendarChangesRead {
  shape(v, ['source_kind', 'source_id', 'page']);
  if ((v.source_kind == null) !== (v.source_id == null) || (v.source_id != null && (!uuid(v.source_id) || !kinds.includes(String(v.source_kind)))) ||
    (v.page !== undefined && !integer(v.page, 1, 10000))) fail(); return v as CalendarChangesRead;
}
function selection(v: unknown): v is CalendarChangeSelection {
  if (!record(v) || !keys(v, ['connection_id', 'source_kind', 'source_id', 'action', 'recover_of']) || !uuid(v.connection_id) || !uuid(v.source_id) ||
    !kinds.includes(String(v.source_kind)) || (v.action !== undefined && !actions.includes(String(v.action))) || !(v.recover_of == null || uuid(v.recover_of))) return false;
  return !(v.recover_of && v.action === 'status');
}
function state(v: unknown): v is CalendarChangeState {
  if (!(record(v) && keys(v, ['id', 'selection', 'mode', 'calendar_id', 'event_id', 'status', 'provider_state', 'local_state', 'failure_code', 'can_cancel', 'resolved_by', 'resolution', 'fingerprint']) &&
    uuid(v.id) && selection(v.selection) && modes.includes(String(v.mode)) && typeof v.calendar_id === 'string' && v.calendar_id.length > 0 && typeof v.event_id === 'string' && v.event_id.length > 0 &&
    ['pending', 'running', 'succeeded', 'failed', 'cancelled', 'needs_review', 'resolved'].includes(String(v.status)) &&
    ['not_started', 'unknown', 'confirmed', 'refused'].includes(String(v.provider_state)) && ['pending', 'applied', 'unchanged', 'needs_review'].includes(String(v.local_state)) &&
    typeof v.can_cancel === 'boolean' && (!v.can_cancel || (v.status === 'pending' && v.provider_state === 'not_started')) &&
    (v.failure_code === null || (typeof v.failure_code === 'string' && /^[a-z][a-z0-9._-]{0,63}$/u.test(v.failure_code))) &&
    (v.resolved_by === null || uuid(v.resolved_by)) && (v.resolution === null || ['followup', 'left_unchanged'].includes(String(v.resolution))) && digest(v.fingerprint))) return false;
  if (!selection(v.selection) || (v.selection.action === 'remove') !== (v.mode === 'remove') || (v.selection.action === 'status' && v.mode !== 'update')) return false;
  if (v.status === 'succeeded' && (v.provider_state !== 'confirmed' || !['applied', 'unchanged'].includes(String(v.local_state)))) return false;
  if (v.status === 'needs_review' && (!['unknown', 'confirmed'].includes(String(v.provider_state)) || v.local_state !== 'needs_review')) return false;
  if (v.status === 'cancelled' && (v.provider_state !== 'not_started' || v.local_state !== 'unchanged')) return false;
  if (v.status === 'resolved' && (v.resolution === null || (v.resolution === 'followup' ? !uuid(v.resolved_by) : v.resolved_by !== null))) return false;
  return true;
}
export const reviewResult = (value: unknown, args: CalendarChangeSelection) => journeyResult(value, (v): v is CalendarChangeReview => record(v) &&
  keys(v, ['selection', 'mode', 'calendar_id', 'event_id', 'source_fingerprint', 'event_fingerprint', 'fingerprint', 'review_token', 'status_prefix', 'previous_event_retained']) &&
  selection(v.selection) && same(v.selection.source_id, args.source_id) && same(v.selection.connection_id, args.connection_id) && v.selection.source_kind === args.source_kind &&
  (v.selection.action ?? 'sync') === (args.action ?? 'sync') && (args.recover_of ? typeof v.selection.recover_of === 'string' && same(v.selection.recover_of, args.recover_of) : v.selection.recover_of == null) && modes.includes(String(v.mode)) &&
  ((v.selection.action === 'remove') === (v.mode === 'remove')) && (v.selection.action !== 'status' || v.mode === 'update') &&
  typeof v.calendar_id === 'string' && v.calendar_id.length > 0 && (v.mode === 'create' ? v.event_id === null : typeof v.event_id === 'string' && v.event_id.length > 0) &&
  digest(v.source_fingerprint) && digest(v.event_fingerprint) && digest(v.fingerprint) && text(v.review_token, 8192) && String(v.review_token).length > 0 &&
  ['', 'Done', 'Skipped'].includes(String(v.status_prefix)) && typeof v.previous_event_retained === 'boolean');
export function stateResult(value: unknown, id?: string) {
  // Reading a failed delivery is a successful status read. Keep the bounded
  // provider/local facts, as for the existing export-job status contract.
  const failedState = record(value) && value.outcome === 'failed' && record(value.data) &&
    ['failed', 'needs_review'].includes(String(value.data.status)) && record(value.error) && value.error.code === 'processing_failed' && text(value.error.message, 1000);
  const result = journeyResult(failedState ? { ...value, outcome: 'ready' } : value, (v): v is CalendarChangeState => state(v) && (!id || same(v.id, id)));
  if (result.data && result.operation && (!result.operation.resource || !same(result.operation.resource.id, result.data.id))) fail(true);
  return failedState ? { ...result, outcome: 'failed' as const } : result;
}
export const listResult = (value: unknown, args: CalendarChangesRead) => journeyResult(value, (v): v is CalendarChanges => record(v) &&
  keys(v, ['items', 'page', 'total', 'has_more']) && v.page === (args.page ?? 1) && integer(v.total, 0) &&
  v.has_more === ((args.page ?? 1) * 25 < Number(v.total)) && Array.isArray(v.items) &&
  v.items.length === Math.min(25, Math.max(0, Number(v.total) - ((args.page ?? 1) - 1) * 25)) && v.items.every(item => state(item) &&
    (!args.source_id || (same(item.selection.source_id, args.source_id) && item.selection.source_kind === args.source_kind))) &&
  new Set(v.items.map(item => (item as CalendarChangeState).id)).size === v.items.length);

export function upcomingInput(v: unknown): UpcomingCalendarRead {
  shape(v, ['connection_id', 'cursor']);
  if (!uuid(v.connection_id) || (v.cursor != null && (!text(v.cursor, 8192) || !String(v.cursor).length))) fail();
  return v as UpcomingCalendarRead;
}
export const upcomingResult = (value: unknown, args: UpcomingCalendarRead) => journeyResult(value, (v): v is UpcomingCalendarSources => {
  if (!record(v) || !keys(v, ['connection_id', 'as_of', 'fingerprint', 'items', 'total', 'interviews', 'tasks', 'offset', 'next_cursor']) ||
    !uuid(v.connection_id) || !same(String(v.connection_id), args.connection_id) || !deadline(v.as_of) || !digest(v.fingerprint) ||
    !integer(v.total, 0) || !integer(v.interviews, 0) || !integer(v.tasks, 0) || Number(v.interviews) + Number(v.tasks) !== v.total ||
    !integer(v.offset, 0) || Number(v.offset) % 20 || (args.cursor == null && v.offset !== 0) ||
    (v.next_cursor !== null && (!text(v.next_cursor, 8192) || !String(v.next_cursor).length || v.next_cursor === args.cursor)) ||
    (v.next_cursor !== null) !== (Number(v.offset) + 20 < Number(v.total)) ||
    !Array.isArray(v.items) || v.items.length !== Math.min(20, Math.max(0, Number(v.total) - Number(v.offset))) ||
    !v.items.every(item => record(item) && keys(item, ['source_kind', 'source_id']) && kinds.includes(String(item.source_kind)) && uuid(item.source_id))) return false;
  return new Set(v.items.map(item => (item as { source_kind: string; source_id: string }).source_kind + ':' + (item as { source_id: string }).source_id)).size === v.items.length;
});
export function batchInput(v: unknown): QueueCalendarChanges {
  shape(v, [...intentKeys, 'review_tokens']); intent(v);
  if (!Array.isArray(v.review_tokens) || !v.review_tokens.length || v.review_tokens.length > 20 ||
    !v.review_tokens.every(token => text(token, 8192) && String(token).length > 0) || new Set(v.review_tokens).size !== v.review_tokens.length) fail();
  return v as QueueCalendarChanges;
}
export function batchResult(value: unknown, args: QueueCalendarChanges) {
  const result = journeyResult(value, (v): v is CalendarBatchQueued => {
    if (!record(v) || !keys(v, ['batch_id', 'items', 'accepted', 'rejected']) || !uuid(v.batch_id) ||
      !integer(v.accepted, 0, 20) || !integer(v.rejected, 0, 20) || Number(v.accepted) + Number(v.rejected) !== args.review_tokens.length ||
      !Array.isArray(v.items) || v.items.length !== args.review_tokens.length || !v.items.every(item => {
        if (!record(item) || !keys(item, ['request_id', 'change', 'error']) || !uuid(item.request_id)) return false;
        if (item.change !== null) return state(item.change) && item.error === null;
        return record(item.error) && keys(item.error, ['code', 'message', 'retry_after_seconds']) &&
          ['authentication_required', 'account_changed', 'insufficient_scope', 'access_unavailable', 'not_found', 'invalid_input', 'revision_conflict',
            'request_id_conflict', 'source_unavailable', 'processing_failed', 'rate_limited', 'retry_expired'].includes(String(item.error.code)) &&
          text(item.error.message, 1000) && String(item.error.message).length > 0 && (item.error.retry_after_seconds == null || integer(item.error.retry_after_seconds, 0, 900));
      })) return false;
    return v.items.filter(item => (item as CalendarBatchItem).change !== null).length === v.accepted &&
      new Set(v.items.map(item => (item as CalendarBatchItem).request_id)).size === v.items.length;
  });
  if (result.data && result.operation && (!result.operation.resource || !same(result.operation.resource.id, result.data.batch_id))) fail(true);
  return result;
}
