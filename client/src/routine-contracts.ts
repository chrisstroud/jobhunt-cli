/** Owned daily agenda and complete paginated search-routine records. */
import { record, type JsonObject } from './protocol.ts';
import { calendarDate, fail, integer, intent, intentKeys, journeyResult, optional, resourceId, shape, text } from './journey-contracts.ts';
import { taskOccurrence, type TaskOccurrence } from './task-contracts.ts';

export type RoutineKind = 'link' | 'target' | 'aggregator';
export type RoutineLink = { kind: 'link'; id: string; label: string; url: string; aggregator: string | null;
  enabled: boolean; order: number; last_opened: string | null };
export type RoutineTarget = { kind: 'target'; id: string; name: string; careers_url: string | null; pinned: boolean; order: number };
export type RoutineAggregator = { kind: 'aggregator'; id: string; name: string };
export type RoutineRecord = RoutineLink | RoutineTarget | RoutineAggregator;
export type RoutinePage<T extends RoutineRecord> = { items: T[]; page: number; per_page: number; total: number; has_more: boolean };
export type RoutineRead = { links_page?: number; targets_page?: number; aggregators_page?: number; per_page?: number };
export type RoutineRecordRead = { kind: RoutineKind; entity_id: string };
export type SearchRoutine = { fingerprint: string; links: RoutinePage<RoutineLink>; targets: RoutinePage<RoutineTarget>; aggregators: RoutinePage<RoutineAggregator> };
export type SearchRoutineRecord = { fingerprint: string; record: RoutineRecord };
export type RoutineFields = { name?: string | null; label?: string | null; url?: string | null; careers_url?: string | null;
  aggregator?: string | null; enabled?: boolean | null; pinned?: boolean | null };
export type RoutineWrite = { request_id: string; expected_account_id?: string | null; expected_fingerprint: string;
  kind: RoutineKind; action: 'create' | 'update' | 'delete' | 'move' | 'opened'; entity_id?: string | null;
  fields?: RoutineFields | null; direction?: 'up' | 'down' | null; confirm_delete?: true | null };
export type RoutineSaved = { id: string; kind: RoutineKind; deleted: boolean; exists: boolean; fingerprint: string; record: RoutineRecord | null };
export type TodayRead = { today: string };
export type TodayTask = { id: string; title: string; task_type: string; due_at: string | null; completed_at: string | null;
  is_active: boolean; urgency: string; application: { id: string; slug: string | null; company: string | null; position: string | null } | null };
export type TodayWorkspace = { agenda: { ok: true; sections: { tasks: TodayTask[] }[] }; taskRevisions: Record<string, number>;
  recurringTasks: Record<string, TaskOccurrence>; activity: { data: { id: string; type: 'activity_event'; attributes: JsonObject }[] };
  routine: { aggregators: string[]; links: Omit<RoutineLink, 'kind' | 'order' | 'last_opened'>[];
    targetCompanies: { id: string; name: string; careersUrl: string | null; pinned: boolean }[] }; fingerprint: string };

const kinds = ['link', 'target', 'aggregator'];
const string = (v: unknown): v is string => typeof v === 'string';
const digest = (v: unknown): v is string => string(v) && /^[a-f0-9]{64}$/u.test(v);
const name = (v: unknown): v is string => text(v, 255) && !!(v as string).trim();
const boolean = (v: unknown) => typeof v === 'boolean';
const timestamp = (v: unknown) => v === null || (string(v) && v.length <= 80);
const array = (v: unknown, check: (v: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.every(check);
function publicURL(v: unknown) {
  if (!text(v, 2048) || !/^https?:\/\//iu.test((v as string).trim())) return false;
  try { const url = new URL((v as string).trim()); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
export function routineReadInput(v: unknown): RoutineRead {
  shape(v, ['links_page', 'targets_page', 'aggregators_page', 'per_page']);
  if (!['links_page', 'targets_page', 'aggregators_page'].every(k => v[k] === undefined || integer(v[k], 1, 10000)) ||
      (v.per_page !== undefined && !integer(v.per_page, 1, 100))) fail();
  return v as RoutineRead;
}
export function routineRecordInput(v: unknown): RoutineRecordRead {
  shape(v, ['kind', 'entity_id']);
  if (!kinds.includes(String(v.kind)) || !name(v.entity_id)) fail();
  return v as RoutineRecordRead;
}
export function routineWriteInput(v: unknown): RoutineWrite {
  shape(v, [...intentKeys, 'expected_fingerprint', 'kind', 'action', 'entity_id', 'fields', 'direction', 'confirm_delete']); intent(v);
  if (!digest(v.expected_fingerprint) || !kinds.includes(String(v.kind)) || !['create', 'update', 'delete', 'move', 'opened'].includes(String(v.action)) ||
      (v.action === 'create' ? v.entity_id != null : !name(v.entity_id)) ||
      (v.entity_id != null && v.kind !== 'aggregator' && (!resourceId(v.entity_id) || (v.entity_id as string).length > 255)) ||
      (v.action === 'delete' ? v.confirm_delete !== true : v.confirm_delete != null) ||
      (v.action === 'move' ? v.kind === 'aggregator' || !['up', 'down'].includes(String(v.direction)) : v.direction != null) ||
      (v.action === 'opened' && v.kind !== 'link')) fail();
  if (v.action === 'create' || v.action === 'update') {
    if (!record(v.fields) || !Object.keys(v.fields).length || (v.kind === 'aggregator' && v.action === 'update')) fail();
    const fields = v.fields as JsonObject;
    const allowed = v.kind === 'link' ? ['label', 'url', 'aggregator', 'enabled'] : v.kind === 'target' ? ['name', 'careers_url', 'pinned'] : ['name'];
    const required = v.kind === 'link' ? ['label', 'url'] : ['name'];
    if (Object.keys(fields).some(k => !allowed.includes(k)) || (v.action === 'create' && required.some(k => fields[k] == null)) ||
        ['name', 'label'].some(k => k in fields && !name(fields[k])) ||
        ('url' in fields && !publicURL(fields.url)) ||
        ('careers_url' in fields && fields.careers_url !== null && fields.careers_url !== '' && !publicURL(fields.careers_url)) ||
        ('aggregator' in fields && fields.aggregator !== null && (!text(fields.aggregator, 255) || fields.aggregator === '')) ||
        ['enabled', 'pinned'].some(k => k in fields && !boolean(fields[k]))) fail();
  } else if (v.fields != null) fail();
  return v as RoutineWrite;
}
export function todayInput(v: unknown): TodayRead {
  shape(v, ['today']); if (!calendarDate(v.today)) fail(); return v as TodayRead;
}
function routineRecord(v: unknown): v is RoutineRecord {
  if (!record(v) || !kinds.includes(String(v.kind)) || !string(v.id)) return false;
  if (v.kind === 'aggregator') return string(v.name) && v.id === v.name;
  if (!resourceId(v.id) || !integer(v.order, -2147483648)) return false;
  return v.kind === 'target' ? string(v.name) && (v.careers_url === null || string(v.careers_url)) && boolean(v.pinned) :
    string(v.label) && string(v.url) && (v.aggregator === null || string(v.aggregator)) && boolean(v.enabled) && timestamp(v.last_opened);
}
function page(v: unknown, kind: RoutineKind, number: number, per: number): boolean {
  if (!record(v) || v.page !== number || v.per_page !== per || !integer(v.total, 0) || !boolean(v.has_more) ||
      !array(v.items, item => routineRecord(item) && item.kind === kind)) return false;
  return v.items.length === Math.min(per, Math.max(0, Number(v.total) - (number - 1) * per)) &&
    v.has_more === (number * per < Number(v.total)) && new Set(v.items.map(item => (item as RoutineRecord).id)).size === v.items.length;
}
export const routineResult = (v: unknown, input: RoutineRead) => journeyResult(v, (v): v is SearchRoutine => record(v) && digest(v.fingerprint) &&
  page(v.links, 'link', input.links_page ?? 1, input.per_page ?? 25) && page(v.targets, 'target', input.targets_page ?? 1, input.per_page ?? 25) &&
  page(v.aggregators, 'aggregator', input.aggregators_page ?? 1, input.per_page ?? 25));
export const routineRecordResult = (v: unknown, input: RoutineRecordRead) => journeyResult(v, (v): v is SearchRoutineRecord => record(v) &&
  digest(v.fingerprint) && routineRecord(v.record) && v.record.kind === input.kind && v.record.id === input.entity_id);
export function routineSavedResult(v: unknown, input: RoutineWrite) {
  const result = journeyResult(v, (v): v is RoutineSaved => record(v) && string(v.id) && v.kind === input.kind && boolean(v.deleted) && boolean(v.exists) &&
    digest(v.fingerprint) && (v.record === null || (routineRecord(v.record) && v.record.id === v.id && v.record.kind === v.kind)) &&
    v.exists === (v.record != null) && v.deleted === (input.action === 'delete') && (input.action === 'create' || v.id === input.entity_id));
  if (result.data && (result.website_url !== 'https://jobhunt.app/app/daily' || result.operation?.kind !== 'change_search_routine' ||
      result.operation.resource?.id !== (input.kind === 'aggregator' ? 'search-routine' : result.data.id))) fail(true);
  return result;
}
function todayTask(v: unknown): v is TodayTask {
  return record(v) && resourceId(v.id) && string(v.title) && string(v.task_type) && timestamp(v.due_at) && timestamp(v.completed_at) &&
    boolean(v.is_active) && string(v.urgency) && (v.application === null || (record(v.application) && resourceId(v.application.id) &&
      (v.application.slug === null || string(v.application.slug)) && (v.application.company === null || string(v.application.company)) && (v.application.position === null || string(v.application.position))));
}
export const todayResult = (v: unknown) => journeyResult(v, (v): v is TodayWorkspace => record(v) && digest(v.fingerprint) && record(v.agenda) &&
  v.agenda.ok === true && array(v.agenda.sections, section => record(section) && array(section.tasks, todayTask)) &&
  record(v.taskRevisions) && Object.entries(v.taskRevisions).every(([id, revision]) => resourceId(id) && integer(revision)) &&
  record(v.recurringTasks) && Object.entries(v.recurringTasks).every(([id, occurrence]) => resourceId(id) && taskOccurrence(occurrence)) &&
  record(v.activity) && array(v.activity.data, item => record(item) && resourceId(item.id) && item.type === 'activity_event' && record(item.attributes)) &&
  record(v.routine) && array(v.routine.aggregators, string) && array(v.routine.links, item => record(item) && resourceId(item.id) && string(item.label) &&
    string(item.url) && (item.aggregator === null || string(item.aggregator)) && boolean(item.enabled)) &&
  array(v.routine.targetCompanies, item => record(item) && resourceId(item.id) && string(item.name) &&
    (item.careersUrl === null || string(item.careersUrl)) && boolean(item.pinned)));
