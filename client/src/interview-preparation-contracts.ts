/** Native preparation workflows remain distinct from generic full-field replacement. */
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, optional, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';
import { recordResult, summary, type InterviewRecord, type InterviewSummary } from './interview-record-contracts.ts';

export type InterviewPreparationRead = { interview_id: string; expected_application_id?: string | null;
  interviewers_page?: number; tasks_page?: number; rounds_page?: number };
export type InterviewRelatedPage = { items: JsonObject[]; page: number; total: number; has_more: boolean };
export type InterviewPreparation = { record: InterviewRecord; interviewers: InterviewRelatedPage; tasks: InterviewRelatedPage;
  sibling_steps: InterviewRelatedPage; order_fingerprint: string };
export type InterviewFeedback = { rating?: number | null; notes?: string; questions?: unknown[]; followup_needed?: boolean; followup_note?: string };
export type InterviewPreparationChange = MutationIntent & { interview_id: string; application_id: string; expected_revision: number; expected_fingerprint: string;
  change: { action: 'checklist'; checklist: unknown[] } | { action: 'merge_feedback'; feedback: JsonObject } | { action: 'submit_feedback'; feedback: InterviewFeedback } };
export type InterviewRoundsRead = { application_id: string; page?: number };
export type InterviewRounds = { application_id: string; items: InterviewSummary[]; page: number; total: number; has_more: boolean; fingerprint: string };
export type InterviewReorder = MutationIntent & { application_id: string; expected_fingerprint: string } &
  ({ order: string[]; order_chunks?: null } | { order?: null; order_chunks: string[][] });
export type InterviewOrderSaved = { application_id: string; fingerprint: string };
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const pageNumber = (v: unknown) => integer(v, 1, 10000);

export function preparationInput(v: unknown): InterviewPreparationRead {
  shape(v, ['interview_id', 'expected_application_id', 'interviewers_page', 'tasks_page', 'rounds_page']);
  if (!uuid(v.interview_id) || !optional(v.expected_application_id, uuid)) fail();
  for (const key of ['interviewers_page', 'tasks_page', 'rounds_page']) if (v[key] !== undefined && !pageNumber(v[key])) fail();
  return v as InterviewPreparationRead;
}
export function changeInput(v: unknown): InterviewPreparationChange {
  shape(v, [...intentKeys, 'interview_id', 'application_id', 'expected_revision', 'expected_fingerprint', 'change']); intent(v);
  if (!uuid(v.interview_id) || !uuid(v.application_id) || !integer(v.expected_revision) || !digest(v.expected_fingerprint) || !record(v.change)) fail();
  const change = v.change;
  if (change.action === 'checklist') {
    shape(change, ['action', 'checklist']); if (!Array.isArray(change.checklist) || change.checklist.length > 1000) fail();
  } else if (change.action === 'merge_feedback') {
    shape(change, ['action', 'feedback']); if (!record(change.feedback)) fail();
  } else if (change.action === 'submit_feedback') {
    shape(change, ['action', 'feedback']); shape(change.feedback, ['rating', 'notes', 'questions', 'followup_needed', 'followup_note']);
    const f = change.feedback;
    if (!optional(f.rating, value => typeof value === 'number' && Number.isFinite(value)) ||
      (f.notes !== undefined && !text(f.notes, 100000)) || (f.followup_note !== undefined && !text(f.followup_note, 100000)) ||
      (f.questions !== undefined && (!Array.isArray(f.questions) || f.questions.length > 1000)) ||
      (f.followup_needed !== undefined && typeof f.followup_needed !== 'boolean')) fail();
  } else fail();
  return v as InterviewPreparationChange;
}
export function roundsInput(v: unknown): InterviewRoundsRead {
  shape(v, ['application_id', 'page']); if (!uuid(v.application_id) || (v.page !== undefined && !pageNumber(v.page))) fail(); return v as InterviewRoundsRead;
}
export function reorderInput(v: unknown): InterviewReorder {
  shape(v, [...intentKeys, 'application_id', 'expected_fingerprint', 'order', 'order_chunks']); intent(v);
  if (!uuid(v.application_id) || !digest(v.expected_fingerprint) || ((v.order == null) === (v.order_chunks == null))) fail();
  const list = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 1000 && value.every(uuid);
  let identifiers: string[];
  if (v.order != null) { if (!list(v.order)) fail(); identifiers = v.order; }
  else { if (!Array.isArray(v.order_chunks) || v.order_chunks.length > 10 || !v.order_chunks.every(list)) fail(); identifiers = v.order_chunks.flat(); }
  if (new Set(identifiers.map(id => id.toLowerCase())).size !== identifiers.length) fail(); return v as InterviewReorder;
}
function page(v: unknown, number: number, item: (value: unknown) => boolean): v is InterviewRelatedPage {
  return record(v) && v.page === number && integer(v.total, 0) && v.has_more === (number * 25 < Number(v.total)) &&
    Array.isArray(v.items) && v.items.length === Math.min(25, Math.max(0, Number(v.total) - (number - 1) * 25)) && v.items.every(item);
}
const nullableText = (v: unknown) => v === null || typeof v === 'string';
function interviewer(v: unknown) {
  return record(v) && uuid(v.id) && typeof v.name === 'string' && nullableText(v.title) && nullableText(v.email) && nullableText(v.linkedin_url) && !Object.hasOwn(v, 'user_id');
}
function task(v: unknown) { return record(v) && uuid(v.id) && typeof v.title === 'string' && nullableText(v.completed_at) && !Object.hasOwn(v, 'user_id'); }
function sibling(v: unknown) { return record(v) && uuid(v.id) && typeof v.title === 'string' && (v.sort_order === null || integer(v.sort_order, -2147483648, 2147483647)) && typeof v.status === 'string'; }
export const preparationResult = (value: unknown, input: InterviewPreparationRead) => journeyResult(value, (v): v is InterviewPreparation => {
  if (!record(v) || !digest(v.order_fingerprint) || !page(v.interviewers, input.interviewers_page ?? 1, interviewer) ||
    !page(v.tasks, input.tasks_page ?? 1, task) || !page(v.sibling_steps, input.rounds_page ?? 1, sibling)) return false;
  if (!record(v.record) || !record(v.record.interview) || Object.hasOwn(v.record.interview, 'interviewer_ids') || Object.hasOwn(v.record.interview, 'task_ids')) return false;
  try { return Boolean(recordResult({ outcome: 'ready', data: { ...v.record, interview: { ...v.record.interview, interviewer_ids: [] } }, next_action: { kind: 'none', label: '' } }, input.interview_id, input.expected_application_id).data); }
  catch { return false; }
});
export const roundsResult = (value: unknown, input: InterviewRoundsRead) => journeyResult(value, (v): v is InterviewRounds => record(v) &&
  typeof v.application_id === 'string' && same(v.application_id, input.application_id) && digest(v.fingerprint) && page(v, input.page ?? 1,
    item => summary(item) && same(item.application_id, input.application_id)));
export const orderResult = (value: unknown, input: InterviewReorder) => journeyResult(value, (v): v is InterviewOrderSaved => record(v) &&
  typeof v.application_id === 'string' && same(v.application_id, input.application_id) && digest(v.fingerprint));
