/** Saved-item admission facts, never a claim of external delivery. */
import { record } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';
import { reviewResult as calendarReviewResult, selectionInput, type CalendarChangeReview, type CalendarChangeSelection } from './calendar-change-contracts.ts';

export type CalendarHandoffRead = { handoff_id: string };
export type CalendarHandoffsRead = { page?: number; include_admitted?: boolean };
export type CalendarHandoffState = { id: string; selection: CalendarChangeSelection;
  status: 'pending' | 'running' | 'failed' | 'queued' | 'resolved' | 'needs_review';
  admission: 'not_admitted' | 'confirmed' | 'unconfirmed'; change_id: string | null;
  failure_code: 'source_or_access_changed' | 'handoff_unavailable' | 'receipt_conflict' | null;
  can_review: boolean; can_resolve: boolean; fingerprint: string };
export type CalendarHandoffs = { items: CalendarHandoffState[]; page: number; total: number; has_more: boolean };
export type CalendarHandoffReviewInput = CalendarHandoffRead & { expected_fingerprint: string };
export type CalendarHandoffReview = { handoff: CalendarHandoffState; review: CalendarChangeReview };
export type ResumeCalendarHandoff = MutationIntent & CalendarHandoffReviewInput & { expected_account_id: string; review_token: string };
export type ResolveCalendarHandoff = MutationIntent & CalendarHandoffReviewInput & { expected_account_id: string; confirm_leave_unchanged: true };
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).every(key => names.includes(key));
export function readInput(v: unknown): CalendarHandoffRead {
  shape(v, ['handoff_id']); if (!uuid(v.handoff_id)) fail(); return {...v,handoff_id:String(v.handoff_id).toLowerCase()} as CalendarHandoffRead;
}
export function listInput(v: unknown): CalendarHandoffsRead {
  shape(v, ['page', 'include_admitted']);
  if ((v.page !== undefined && !integer(v.page, 1, 10000)) || (v.include_admitted !== undefined && typeof v.include_admitted !== 'boolean')) fail();
  return v as CalendarHandoffsRead;
}
export function reviewInput(v: unknown): CalendarHandoffReviewInput {
  shape(v, ['handoff_id', 'expected_fingerprint']);
  if (!uuid(v.handoff_id) || !hash(v.expected_fingerprint)) fail(); return {...v,handoff_id:String(v.handoff_id).toLowerCase()} as CalendarHandoffReviewInput;
}
export function mutationInput(v: unknown, leave = false): ResumeCalendarHandoff | ResolveCalendarHandoff {
  shape(v, [...intentKeys, 'handoff_id', 'expected_fingerprint', ...(leave ? ['confirm_leave_unchanged'] : ['review_token'])]); intent(v);
  if (!uuid(v.handoff_id) || !hash(v.expected_fingerprint) || typeof v.expected_account_id !== 'string' ||
    (leave ? v.confirm_leave_unchanged !== true : !text(v.review_token, 8192) || !String(v.review_token).length)) fail();
  return {...v,handoff_id:String(v.handoff_id).toLowerCase()} as ResumeCalendarHandoff | ResolveCalendarHandoff;
}
export function state(v: unknown): v is CalendarHandoffState {
  if (!record(v) || !keys(v, ['id', 'selection', 'status', 'admission', 'change_id', 'failure_code', 'can_review', 'can_resolve', 'fingerprint']) ||
    !uuid(v.id) || !record(v.selection) || v.selection.recover_of != null || !['sync', 'status', 'remove'].includes(String(v.selection.action)) ||
    !['pending', 'running', 'failed', 'queued', 'resolved', 'needs_review'].includes(String(v.status)) ||
    !['not_admitted', 'confirmed', 'unconfirmed'].includes(String(v.admission)) || !(v.change_id === null || uuid(v.change_id)) ||
    !(v.failure_code === null || ['source_or_access_changed', 'handoff_unavailable', 'receipt_conflict'].includes(String(v.failure_code))) ||
    typeof v.can_review !== 'boolean' || typeof v.can_resolve !== 'boolean' || !hash(v.fingerprint)) return false;
  try { selectionInput(v.selection); } catch { return false; }
  if ((v.admission === 'confirmed') !== (v.status === 'queued' && uuid(v.change_id))) return false;
  if (v.admission === 'not_admitted' && v.change_id !== null) return false;
  if (v.admission === 'unconfirmed' && !['needs_review', 'resolved'].includes(String(v.status))) return false;
  if (v.status === 'needs_review' && v.admission !== 'unconfirmed') return false;
  return v.can_review === (v.status === 'failed' && v.admission === 'not_admitted') &&
    v.can_resolve === (v.admission !== 'confirmed' && !['queued', 'resolved'].includes(String(v.status)));
}
export const stateResult = (value: unknown, id: string) => {
  const result = journeyResult(value, (v): v is CalendarHandoffState => state(v) && v.id === id);
  if (result.data && result.operation?.resource?.id !== undefined && result.operation.resource.id !== id) fail(true);
  return result;
};
export const listResult = (value: unknown, args: CalendarHandoffsRead) => journeyResult(value, (v): v is CalendarHandoffs => record(v) &&
  keys(v, ['items', 'page', 'total', 'has_more']) && v.page === (args.page ?? 1) && integer(v.total, 0) &&
  v.has_more === ((args.page ?? 1) * 25 < Number(v.total)) && Array.isArray(v.items) &&
  v.items.length === Math.min(25, Math.max(0, Number(v.total) - ((args.page ?? 1) - 1) * 25)) &&
  v.items.every(state) && new Set(v.items.map(item => (item as CalendarHandoffState).id)).size === v.items.length);
export const reviewResult = (value: unknown, args: CalendarHandoffReviewInput) => journeyResult(value, (v): v is CalendarHandoffReview => {
  if (!record(v) || !keys(v, ['handoff', 'review']) || !state(v.handoff) || v.handoff.id !== args.handoff_id ||
    v.handoff.fingerprint !== args.expected_fingerprint || !v.handoff.can_review || !record(v.review) || !record(v.review.selection)) return false;
  const a = v.handoff.selection, b = v.review.selection;
  if (a.source_id !== b.source_id || a.source_kind !== b.source_kind || a.connection_id !== b.connection_id || b.recover_of != null) return false;
  try { return !!calendarReviewResult({ outcome: 'ready', data: v.review, next_action: { kind: 'none', label: '' } }, selectionInput(b)).data; }
  catch { return false; }
});
