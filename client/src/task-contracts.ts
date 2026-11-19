/** Wire schemas for the existing versioned task services. Authorization,
 * recurrence rules and mutation receipts remain server-owned. */
import { record, type JsonObject } from './protocol.ts';
import { calendarDate as taskDate, deadline, integer, text, uuid, optional, fail, shape, intentKeys, intent, journeyResult, type MutationIntent } from './journey-contracts.ts';
export { calendarDate as taskDate, operationResult, type MutationIntent, type OperationReceipt, type JourneyResult } from './journey-contracts.ts';

export type TaskSchedule = {
  type: 'daily' | 'weekdays' | 'mwf' | 'tth' | 'weekly' | 'custom_days' | 'times_per_week';
  days?: number[]; times_per_week?: number | null; due_time?: string | null; paused?: boolean;
};
export type TaskOccurrence = Required<Omit<TaskSchedule, 'due_time'>> & {
  due_time?: string | null; date: string; completed_at: string | null; fingerprint: string;
  status?: 'open' | 'completed' | 'skipped' | 'unknown';
};
export type SavedTask = {
  id: string; revision: number; title: string; description: string | null; description_truncated: boolean;
  due_at: string | null; is_active: boolean; completed_at: string | null;
  application_id: string | null; search_id: string | null; recurrence?: TaskOccurrence | null;
};
export type TaskPage = { items: SavedTask[]; page: number; total: number; has_more: boolean };
export type TaskListInput = { page?: number; application_id?: string | null; search_id?: string | null;
  is_active?: boolean | null; occurrence_date?: string | null };
export type TaskTarget = { task_id: string; expected_application_id?: string | null };
export type TaskReadInput = TaskTarget & { occurrence_date?: string | null };
export type TaskCreateInput = MutationIntent & { title: string; description?: string | null; due_at?: string | null;
  application_id?: string | null; search_id?: string | null; recurrence?: TaskSchedule | null };
export type TaskUpdateInput = MutationIntent & TaskTarget & { expected_revision: number; title?: string;
  description?: string | null; due_at?: string | null; is_active?: boolean };
export type TaskDeleteInput = MutationIntent & TaskReadInput & { expected_revision: number };
export type DeletedTask = { id: string; deleted: true; calendar_cleanup?: 'not_scheduled' | 'pending' | 'succeeded' | 'failed' };
export type TaskCompletionInput = MutationIntent & TaskTarget & { expected_revision: number;
  expected_fingerprint: string; completion_date: string; completed: boolean };
export type TaskSkipInput = MutationIntent & TaskTarget & { expected_revision: number;
  expected_fingerprint: string; occurrence_date: string };
export type TaskHistoryInput = TaskTarget & { before_date?: string | null; limit?: number };
export type TaskHistoryEntry = { id: string; date: string; status: 'completed' | 'skipped' | 'unknown'; recorded_at: string };
export type TaskHistory = { task_id: string; revision: number; items: TaskHistoryEntry[]; has_more: boolean; next_before_date: string | null };
export type TaskScheduleInput = MutationIntent & TaskTarget & { expected_revision: number;
  expected_fingerprint: string; occurrence_date: string; recurrence: TaskSchedule };
export type OperationInput = ({ operation_id: string; request_id?: never; operation_name?: never }
  | { operation_id?: never; request_id: string; operation_name: string }) & { expected_payload_hash?: string; expected_account_id?: string | null };
const fingerprint = /^[a-f0-9]{64}$/u;
const scheduleTypes = ['daily', 'weekdays', 'mwf', 'tth', 'weekly', 'custom_days', 'times_per_week'];
function schedule(value: unknown): value is TaskSchedule {
  return record(value) && Object.keys(value).every(key => ['type', 'days', 'times_per_week', 'due_time', 'paused'].includes(key)) &&
    scheduleTypes.includes(String(value.type)) && (value.days === undefined || (Array.isArray(value.days) && value.days.length <= 7 && value.days.every(day => integer(day, 0, 6)))) &&
    optional(value.times_per_week, value => integer(value, 1, 7)) && optional(value.due_time, value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/u.test(value)) &&
    (value.paused === undefined || typeof value.paused === 'boolean');
}
function target(value: JsonObject) {
  if (!uuid(value.task_id) || !optional(value.expected_application_id, uuid) || !integer(value.expected_revision)) fail();
}
export function taskDeleteInput(value: unknown): TaskDeleteInput {
  shape(value, [...intentKeys, 'task_id', 'expected_application_id', 'expected_revision', 'occurrence_date']); intent(value); target(value);
  if (!optional(value.occurrence_date, taskDate)) fail();
  return value as TaskDeleteInput;
}
export function taskCreateInput(value: unknown): TaskCreateInput {
  shape(value, [...intentKeys, 'title', 'description', 'due_at', 'application_id', 'search_id', 'recurrence']); intent(value);
  if (!text(value.title, 255) || !String(value.title).trim() || !optional(value.description, value => text(value, 12000)) ||
      !optional(value.due_at, deadline) || !optional(value.application_id, uuid) || !optional(value.search_id, uuid) || !optional(value.recurrence, schedule)) fail();
  return value as TaskCreateInput;
}
export function taskUpdateInput(value: unknown): TaskUpdateInput {
  const fields = ['title', 'description', 'due_at', 'is_active'];
  shape(value, [...intentKeys, 'task_id', 'expected_application_id', 'expected_revision', ...fields]); intent(value); target(value);
  if (!fields.some(field => Object.hasOwn(value, field)) ||
      ('title' in value && (!text(value.title, 255) || !String(value.title).trim())) ||
      !optional(value.description, value => text(value, 12000)) || !optional(value.due_at, deadline) ||
      ('is_active' in value && typeof value.is_active !== 'boolean')) fail();
  return value as TaskUpdateInput;
}
export function taskCompletionInput(value: unknown): TaskCompletionInput {
  shape(value, [...intentKeys, 'task_id', 'expected_application_id', 'expected_revision', 'expected_fingerprint', 'completion_date', 'completed']); intent(value); target(value);
  if (typeof value.expected_fingerprint !== 'string' || !fingerprint.test(value.expected_fingerprint) || !taskDate(value.completion_date) || typeof value.completed !== 'boolean') fail();
  return value as TaskCompletionInput;
}
export function taskSkipInput(value: unknown): TaskSkipInput {
  shape(value, [...intentKeys, 'task_id', 'expected_application_id', 'expected_revision', 'expected_fingerprint', 'occurrence_date']); intent(value); target(value);
  if (typeof value.expected_fingerprint !== 'string' || !fingerprint.test(value.expected_fingerprint) || !taskDate(value.occurrence_date)) fail();
  return value as TaskSkipInput;
}
export function taskHistoryInput(value: unknown): TaskHistoryInput {
  shape(value, ['task_id', 'expected_application_id', 'before_date', 'limit']);
  if (!uuid(value.task_id) || !optional(value.expected_application_id, uuid) || !optional(value.before_date, taskDate) || (value.limit !== undefined && !integer(value.limit, 1, 100))) fail();
  return value as TaskHistoryInput;
}
export function taskScheduleInput(value: unknown): TaskScheduleInput {
  shape(value, [...intentKeys, 'task_id', 'expected_application_id', 'expected_revision', 'expected_fingerprint', 'occurrence_date', 'recurrence']); intent(value); target(value);
  if (typeof value.expected_fingerprint !== 'string' || !fingerprint.test(value.expected_fingerprint) || !taskDate(value.occurrence_date) || !schedule(value.recurrence)) fail();
  return value as TaskScheduleInput;
}
export function taskListInput(value: unknown): TaskListInput {
  shape(value, ['page', 'application_id', 'search_id', 'is_active', 'occurrence_date']);
  if ((value.page !== undefined && !integer(value.page, 1, 10000)) || !optional(value.application_id, uuid) ||
      !optional(value.search_id, uuid) || !optional(value.is_active, value => typeof value === 'boolean') || !optional(value.occurrence_date, taskDate)) fail();
  return value as TaskListInput;
}
export function taskReadInput(value: unknown): TaskReadInput {
  shape(value, ['task_id', 'expected_application_id', 'occurrence_date']);
  if (!uuid(value.task_id) || !optional(value.expected_application_id, uuid) || !optional(value.occurrence_date, taskDate)) fail();
  return value as TaskReadInput;
}
export function operationInput(value: unknown): OperationInput {
  shape(value, ['operation_id', 'request_id', 'operation_name', 'expected_payload_hash', 'expected_account_id']);
  if (!optional(value.expected_account_id, value => typeof value === 'string' && value.startsWith('jh_') && uuid(value.slice(3)))) fail();
  if (value.expected_payload_hash !== undefined && (typeof value.expected_payload_hash !== 'string' || !fingerprint.test(value.expected_payload_hash))) fail();
  if (value.operation_id !== undefined) {
    if (!uuid(value.operation_id) || value.request_id !== undefined || value.operation_name !== undefined) fail();
  } else if (!uuid(value.request_id) || typeof value.operation_name !== 'string' || !/^[a-z][a-z0-9_]{0,99}$/u.test(value.operation_name)) fail();
  return value as OperationInput;
}
function savedTask(value: unknown): value is SavedTask {
  if (!record(value) || !uuid(value.id) || !integer(value.revision) || !text(value.title, 255) ||
      !(value.description === null || text(value.description, 12000)) || typeof value.description_truncated !== 'boolean' ||
      !(value.due_at === null || deadline(value.due_at)) || typeof value.is_active !== 'boolean' ||
      !(value.completed_at === null || deadline(value.completed_at)) || !(value.application_id === null || uuid(value.application_id)) ||
      !(value.search_id === null || uuid(value.search_id))) return false;
  return value.recurrence === undefined || value.recurrence === null || taskOccurrence(value.recurrence);
}
/** Shared wire validation for browser/native task projections. */
export function taskOccurrence(r: unknown): r is TaskOccurrence {
  return record(r) && scheduleTypes.includes(String(r.type)) && Array.isArray(r.days) && r.days.length <= 7 && r.days.every(day => integer(day, 0, 6)) &&
    (r.times_per_week === null || integer(r.times_per_week, 1, 7)) && optional(r.due_time, value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/u.test(value)) &&
    typeof r.paused === 'boolean' && taskDate(r.date) && (r.completed_at === null || deadline(r.completed_at)) &&
    typeof r.fingerprint === 'string' && fingerprint.test(r.fingerprint) &&
    (r.status === undefined || ['open', 'completed', 'skipped', 'unknown'].includes(String(r.status)));
}

export const taskResult = (value: unknown) => journeyResult(value, savedTask);
export const taskHistoryResult = (value: unknown) => journeyResult(value, (data): data is TaskHistory =>
  record(data) && uuid(data.task_id) && integer(data.revision) && Array.isArray(data.items) && data.items.length <= 100 &&
  data.items.every(item => record(item) && uuid(item.id) && taskDate(item.date) && deadline(item.recorded_at) &&
    ['completed', 'skipped', 'unknown'].includes(String(item.status))) && typeof data.has_more === 'boolean' &&
  (data.has_more ? data.items.length > 0 && data.next_before_date === data.items.at(-1).date : data.next_before_date === null));
export const taskDeleteResult = (value: unknown) => journeyResult(value, (data): data is DeletedTask =>
  record(data) && uuid(data.id) && data.deleted === true && (data.calendar_cleanup === undefined ||
    ['not_scheduled', 'pending', 'succeeded', 'failed'].includes(String(data.calendar_cleanup))));
export const taskListResult = (value: unknown) => journeyResult(value, (data): data is TaskPage => record(data) && Array.isArray(data.items) &&
  data.items.length <= 20 && data.items.every(savedTask) && integer(data.page, 1, 10000) && integer(data.total, 0, Number.MAX_SAFE_INTEGER) && typeof data.has_more === 'boolean');
