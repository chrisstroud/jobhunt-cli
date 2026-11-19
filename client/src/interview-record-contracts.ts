/** Full interview records; partial fields preserve omission and native clear semantics. */
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, optional, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type InterviewFields = { title?: string; step_type?: string | null; notes?: string | null; location?: string | null;
  format?: string | null; status_override?: string | null; tags?: string[] | null; scheduled_at?: string | null;
  scheduled_end_at?: string | null; completed_at?: string | null; skipped_at?: string | null; sort_order?: number | null;
  prep_checklist?: unknown[] | null; feedback?: JsonObject | null; duration_minutes?: number | null;
  task_ids?: string[] | null; interviewer_ids?: string[] | null };
export type InterviewRecordRead = { interview_id: string; expected_application_id?: string | null };
export type InterviewRecordList = { application_id?: string | null; page?: number };
export type InterviewRecord = { id: string; application_id: string; search_id: string | null; revision: number; fingerprint: string; interview: JsonObject };
export type InterviewSummary = Omit<InterviewRecord, 'interview'> & { title: string; step_type: string | null;
  scheduled_at: string | null; scheduled_end_at: string | null; status: string; is_system: boolean };
export type InterviewDirectory = { items: InterviewSummary[]; page: number; total: number; has_more: boolean };
export type InterviewCreate = MutationIntent & { application_id: string; fields: InterviewFields & { title: string } };
export type InterviewUpdate = MutationIntent & { interview_id: string; application_id: string; expected_revision: number; expected_fingerprint: string; fields: InterviewFields };
export type InterviewDelete = Omit<InterviewUpdate, 'fields'>;
export type InterviewRemoved = { id: string; application_id: string; deleted: true; calendar_cleanup: 'not_scheduled' | 'pending' | 'succeeded' | 'failed' };

const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const nullableId = (v: unknown) => v === null || uuid(v);
const nullableText = (v: unknown) => v === null || typeof v === 'string';
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const keys = ['title', 'step_type', 'notes', 'location', 'format', 'status_override', 'tags', 'scheduled_at', 'scheduled_end_at',
  'completed_at', 'skipped_at', 'sort_order', 'prep_checklist', 'feedback', 'duration_minutes', 'task_ids', 'interviewer_ids'];

export function fieldsInput(v: unknown): InterviewFields {
  shape(v, keys);
  if (!Object.keys(v).some(key => v[key] !== undefined)) fail();
  if (v.title !== undefined && (!text(v.title, 255) || !String(v.title).trim())) fail();
  for (const [key, maximum] of [['step_type', 50], ['notes', 100000], ['location', 100000], ['format', 30], ['status_override', 20],
    ['scheduled_at', 40], ['scheduled_end_at', 40], ['completed_at', 40], ['skipped_at', 40]] as const) {
    if (!optional(v[key], value => text(value, maximum))) fail();
  }
  for (const key of ['sort_order', 'duration_minutes']) if (!optional(v[key], value => integer(value, -2147483648, 2147483647))) fail();
  for (const key of ['tags', 'task_ids', 'interviewer_ids']) {
    if (!optional(v[key], value => Array.isArray(value) && value.length <= 1000 && value.every(key === 'tags' ? item => typeof item === 'string' : uuid))) fail();
  }
  if (!optional(v.prep_checklist, value => Array.isArray(value) && value.length <= 1000) || !optional(v.feedback, record)) fail();
  try { JSON.stringify(v); } catch { fail(); }
  return v as InterviewFields;
}
export function readInput(v: unknown): InterviewRecordRead {
  shape(v, ['interview_id', 'expected_application_id']);
  if (!uuid(v.interview_id) || !optional(v.expected_application_id, uuid)) fail(); return v as InterviewRecordRead;
}
export function listInput(v: unknown): InterviewRecordList {
  shape(v, ['application_id', 'page']);
  if (!optional(v.application_id, uuid) || (v.page !== undefined && !integer(v.page, 1, 10000))) fail(); return v as InterviewRecordList;
}
export function createInput(v: unknown): InterviewCreate {
  shape(v, [...intentKeys, 'application_id', 'fields']); intent(v);
  if (!uuid(v.application_id)) fail(); fieldsInput(v.fields);
  if (!record(v.fields) || typeof v.fields.title !== 'string') fail(); return v as InterviewCreate;
}
function reviewed(v: unknown, fields: boolean): asserts v is JsonObject {
  shape(v, [...intentKeys, 'application_id', 'interview_id', 'expected_revision', 'expected_fingerprint', ...(fields ? ['fields'] : [])]); intent(v);
  if (!uuid(v.application_id) || !uuid(v.interview_id) || !integer(v.expected_revision) || !digest(v.expected_fingerprint)) fail();
  if (fields) fieldsInput(v.fields);
}
export function updateInput(v: unknown): InterviewUpdate { reviewed(v, true); return v as InterviewUpdate; }
export function deleteInput(v: unknown): InterviewDelete { reviewed(v, false); return v as InterviewDelete; }
function identity(v: unknown): v is Omit<InterviewRecord, 'interview'> & JsonObject {
  return record(v) && uuid(v.id) && uuid(v.application_id) && nullableId(v.search_id) && integer(v.revision) && digest(v.fingerprint);
}
function full(v: unknown): v is InterviewRecord {
  if (!identity(v) || !record(v)) return false;
  const body = v.interview;
  return record(body) && body.id === v.id && body.application_id === v.application_id && !Object.hasOwn(body, 'user_id') &&
    !Object.hasOwn(body, 'interviewers') && typeof body.title === 'string' && Array.isArray(body.interviewer_ids) && body.interviewer_ids.every(uuid);
}
const bound = (v: InterviewRecord, id: string | undefined, app: string | null | undefined) => (!id || same(v.id, id)) &&
  (!app || same(v.application_id, app));
export const recordResult = (value: unknown, id?: string, application?: string | null) => journeyResult(value, (v): v is InterviewRecord => full(v) && bound(v, id, application));
export function summary(v: unknown): v is InterviewSummary {
  return identity(v) && record(v) && typeof v.title === 'string' && nullableText(v.step_type) &&
    nullableText(v.scheduled_at) && nullableText(v.scheduled_end_at) && typeof v.status === 'string' && typeof v.is_system === 'boolean';
}
export const directoryResult = (value: unknown, input: InterviewRecordList) => journeyResult(value, (v): v is InterviewDirectory => {
  if (!record(v) || v.page !== (input.page ?? 1) || !integer(v.total, 0) || v.has_more !== ((input.page ?? 1) * 20 < Number(v.total)) ||
    !Array.isArray(v.items) || v.items.length !== Math.min(20, Math.max(0, Number(v.total) - ((input.page ?? 1) - 1) * 20)) || !v.items.every(summary)) return false;
  return new Set(v.items.map(item => item.id)).size === v.items.length && (!input.application_id || v.items.every(item => same(item.application_id, input.application_id!)));
});
export const removedResult = (value: unknown, input: InterviewDelete) => journeyResult(value, (v): v is InterviewRemoved => record(v) &&
  typeof v.id === 'string' && same(v.id, input.interview_id) && typeof v.application_id === 'string' && same(v.application_id, input.application_id) &&
  v.deleted === true && ['not_scheduled', 'pending', 'succeeded', 'failed'].includes(String(v.calendar_cleanup)));
