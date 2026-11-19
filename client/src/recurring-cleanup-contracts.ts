/** Reviewed recurring task/date cleanup; authorization and policy stay server-owned. */
import { record } from './protocol.ts';
import { calendarDate, deadline, fail, integer, intent, intentKeys, journeyResult, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type CleanupSelection = { occurrence_date: string; scope?: 'all' | 'jbr'; include_skipped?: boolean };
export type CleanupPreviewInput = CleanupSelection & { after_task_id?: string | null };
export type CleanupWriteInput = CleanupSelection & MutationIntent & {
  targets: { task_id: string; expected_fingerprint: string }[]; confirmed: true;
};
export type CleanupItem = { task_id: string; title: string; application_id: string | null; fingerprint: string;
  eligible_records: number; records: { source: 'task' | 'legacy_jbr'; id: string; status: 'completed' | 'skipped' | 'unknown'; recorded_at: string }[] };
export type CleanupPage = Required<CleanupSelection> & { account_id: string; items: CleanupItem[]; has_more: boolean; next_after_task_id: string | null };
export type CleanupResult = Required<CleanupSelection> & { account_id: string; reopened_task_ids: string[];
  current: { task_id: string; current: CleanupItem | null }[] };
const selectionKeys = ['occurrence_date', 'scope', 'include_skipped'];
const fingerprint = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const account = (v: unknown) => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
function selection(v: Record<string, unknown>) {
  return calendarDate(v.occurrence_date) && (v.scope === undefined || v.scope === 'all' || v.scope === 'jbr') &&
    (v.include_skipped === undefined || typeof v.include_skipped === 'boolean');
}
export function cleanupPreviewInput(v: unknown): CleanupPreviewInput {
  shape(v, [...selectionKeys, 'after_task_id']);
  if (!selection(v) || v.after_task_id != null && !uuid(v.after_task_id)) fail();
  return v as CleanupPreviewInput;
}
export function cleanupWriteInput(v: unknown): CleanupWriteInput {
  shape(v, [...selectionKeys, ...intentKeys, 'targets', 'confirmed']); intent(v);
  if (!selection(v) || v.confirmed !== true || !Array.isArray(v.targets) || !v.targets.length || v.targets.length > 20) fail();
  const ids = [];
  for (const target of v.targets) {
    shape(target, ['task_id', 'expected_fingerprint']);
    if (!uuid(target.task_id) || !fingerprint(target.expected_fingerprint)) fail();
    ids.push(String(target.task_id).toLowerCase());
  }
  if (new Set(ids).size !== ids.length) fail();
  return v as CleanupWriteInput;
}
function item(v: unknown): v is CleanupItem {
  return record(v) && uuid(v.task_id) && text(v.title, 255) && (v.application_id === null || uuid(v.application_id)) &&
    fingerprint(v.fingerprint) && integer(v.eligible_records, 0, 2) && Array.isArray(v.records) && v.records.length <= 2 &&
    Number(v.eligible_records) <= v.records.length && new Set(v.records.map(r => record(r) ? r.source : null)).size === v.records.length &&
    v.records.every(r => record(r) && ['task', 'legacy_jbr'].includes(String(r.source)) && uuid(r.id) &&
      ['completed', 'skipped', 'unknown'].includes(String(r.status)) && deadline(r.recorded_at));
}
function responseSelection(v: unknown): boolean {
  return record(v) && selection(v) && typeof v.include_skipped === 'boolean' && (v.scope === 'all' || v.scope === 'jbr') && account(v.account_id);
}
export const cleanupPageResult = (v: unknown) => journeyResult(v, (data): data is CleanupPage => record(data) && responseSelection(data) &&
  Array.isArray(data.items) && data.items.length <= 20 && data.items.every(item) &&
  new Set(data.items.map(row => row.task_id)).size === data.items.length && typeof data.has_more === 'boolean' &&
  (data.has_more ? uuid(data.next_after_task_id) : data.next_after_task_id === null));
export const cleanupSavedResult = (v: unknown) => journeyResult(v, (data): data is CleanupResult => record(data) && responseSelection(data) &&
  Array.isArray(data.reopened_task_ids) && data.reopened_task_ids.length > 0 && data.reopened_task_ids.length <= 20 &&
  data.reopened_task_ids.every(uuid) && new Set(data.reopened_task_ids).size === data.reopened_task_ids.length &&
  Array.isArray(data.current) && data.current.length === data.reopened_task_ids.length &&
  new Set(data.current.map(row => record(row) ? row.task_id : null)).size === data.current.length &&
  data.current.every(row => record(row) && (data.reopened_task_ids as unknown[]).includes(row.task_id) &&
    (row.current === null || item(row.current) && row.current.task_id === row.task_id)));
