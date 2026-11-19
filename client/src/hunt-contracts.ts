/** Hunt lifecycle and complete criteria, with explicit review and retry intent. */
import { record, type JsonObject } from './protocol.ts';
import { calendarDate, deadline, fail, integer, intent, intentKeys, journeyResult, optional,
  resourceId, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type HuntRecord = { id: string; slug: string; name: string; revision: number;
  status: 'active' | 'paused' | 'completed' | 'archived'; is_current: boolean;
  application_count: number; outcome: 'accepted' | 'no_offer' | 'cancelled' | null; completed_at: string | null };
export type HuntPage = { items: HuntRecord[]; page: number; total: number; has_more: boolean; current_ids: string[] };
export type HuntDetails = { hunt: HuntRecord; fields: JsonObject; fingerprint: string };
export type HuntNote = { id: string; title: string; body: string; tag_ids: string[]; created_at: string; updated_at: string };
export type HuntFields = { name: string; target_roles: string[]; target_locations: string[];
  target_industries: string[]; target_company_sizes: string[]; target_company_ids: string[];
  target_skills: string[]; must_haves: string[]; deal_breakers: string[];
  remote_preference: 'flexible' | 'hybrid' | 'onsite' | 'remote' | null;
  target_experience_level: string | null; target_salary_min: number | null; target_salary_max: number | null;
  salary_currency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'SGD' | 'INR' | 'BRL' | 'MXN';
  weekly_app_goal: number | null; start_date: string | null; end_date: string | null;
  preferred_resume_template_id: string | null; notes: HuntNote[] };
export type HuntSave = MutationIntent & { search_id: string; expected_fingerprint: string;
  action: 'update' | 'pause' | 'resume' | 'archive' | 'restore' | 'complete' | 'reopen';
  fields?: HuntFields | null; outcome?: 'cancelled' | 'no_offer' | null };
export type HuntCreate = MutationIntent & { name: string; start_date?: string | null; notes_text?: string | null };
export type HuntCurrent = MutationIntent & { search_id: string; expected_revision: number; expected_current_ids: string[] };
export type HuntDelete = MutationIntent & { search_id: string; expected_revision: number;
  expected_application_count: number; migrate_to_id?: string | null; expected_target_revision?: number | null };
export type DeletedHunt = { search_id: string; deleted: true; migrated_to_id: string | null; application_count: number };
export type HuntSummary = { id: string; name: string; revision: number; status: HuntRecord['status'];
  preferred_resume?: JsonObject | null; preferences: JsonObject };
export type HuntUpdate = MutationIntent & { search_id: string; expected_revision: number;
  preferences?: { role_interests?: string[] | null; locations?: string[] | null;
    work_pattern?: 'remote' | 'hybrid' | 'onsite' | 'flexible' | null } | null;
  status?: 'active' | 'paused'; preferred_resume_id?: string | null };
export type HuntRename = MutationIntent & { search_id: string; expected_revision: number; name: string };
export type InitializedPipeline = { items: { id: string; name: string; type: string }[]; next_cursor?: string | null; total: number };

const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const list = (v: unknown, max: number, check: (item: unknown) => boolean) => Array.isArray(v) && v.length <= max && v.every(check);
const nullable = (v: unknown, check: (item: unknown) => boolean) => v === null || check(v);
const requiredName = (v: unknown, max: number) => text(v, max) && !!String(v).trim();
export function huntPageInput(v: unknown): { page?: number } {
  shape(v, ['page']);
  if (v.page !== undefined && !integer(v.page, 1, 10000)) fail();
  return v as { page?: number };
}
export function huntReadInput(v: unknown): { search_id: string } {
  shape(v, ['search_id']); if (!uuid(v.search_id)) fail(); return v as { search_id: string };
}
export function huntUpdateInput(v: unknown): HuntUpdate {
  shape(v, [...intentKeys, 'search_id', 'expected_revision', 'preferences', 'status', 'preferred_resume_id']); intent(v);
  if (!uuid(v.search_id) || !integer(v.expected_revision) ||
      !['preferences', 'status', 'preferred_resume_id'].some(key => v[key] !== undefined) ||
      (v.status !== undefined && !['active', 'paused'].includes(String(v.status))) ||
      !optional(v.preferred_resume_id, uuid)) fail();
  if (v.preferences != null) {
    const preferences = v.preferences;
    shape(preferences, ['role_interests', 'locations', 'work_pattern']);
    if (!['role_interests', 'locations'].every(key => optional(preferences[key], values => list(values, 20, item => text(item, 255)))) ||
        !optional(preferences.work_pattern, item => ['remote', 'hybrid', 'onsite', 'flexible'].includes(String(item)))) fail();
  }
  return v as HuntUpdate;
}
export function huntRenameInput(v: unknown): HuntRename {
  shape(v, [...intentKeys, 'search_id', 'expected_revision', 'name']); intent(v);
  if (!uuid(v.search_id) || !integer(v.expected_revision) || !requiredName(v.name, 100)) fail();
  return v as HuntRename;
}
export function huntCreateInput(v: unknown): HuntCreate {
  shape(v, [...intentKeys, 'name', 'start_date', 'notes_text']); intent(v);
  if (!requiredName(v.name, 255) || !optional(v.start_date, calendarDate) || !optional(v.notes_text, value => text(value, 5000))) fail(); return v as HuntCreate;
}
export function huntFieldsInput(v: unknown): HuntFields {
  const arrays = ['target_roles', 'target_locations', 'target_industries', 'target_company_sizes', 'target_skills', 'must_haves', 'deal_breakers'];
  shape(v, ['name', ...arrays, 'target_company_ids', 'remote_preference', 'target_experience_level',
    'target_salary_min', 'target_salary_max', 'salary_currency', 'weekly_app_goal', 'start_date', 'end_date', 'preferred_resume_template_id', 'notes']);
  if (!requiredName(v.name, 120) || arrays.some(key => !list(v[key], 30, item => text(item, 120))) ||
    !list(v.target_company_ids, 100, resourceId) || new Set(v.target_company_ids as string[]).size !== (v.target_company_ids as string[]).length ||
    !nullable(v.remote_preference, x => ['flexible', 'hybrid', 'onsite', 'remote'].includes(String(x))) ||
    !nullable(v.target_experience_level, x => text(x, 40)) ||
    !nullable(v.target_salary_min, x => integer(x, 0)) || !nullable(v.target_salary_max, x => integer(x, 0)) ||
    !['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'INR', 'BRL', 'MXN'].includes(String(v.salary_currency)) ||
    !nullable(v.weekly_app_goal, x => integer(x, 1, 50)) ||
    !nullable(v.start_date, calendarDate) || !nullable(v.end_date, calendarDate) ||
    !nullable(v.preferred_resume_template_id, resourceId) || !Array.isArray(v.notes) || v.notes.length > 100) fail();
  if (v.start_date !== null && v.end_date !== null && String(v.end_date) < String(v.start_date)) fail();
  if (v.target_salary_min !== null && v.target_salary_max !== null && Number(v.target_salary_max) < Number(v.target_salary_min)) fail();
  for (const note of v.notes as unknown[]) {
    shape(note, ['id', 'title', 'body', 'tag_ids', 'created_at', 'updated_at']);
    if (!text(note.id, 100) || !note.id || !text(note.title, 200) || !text(note.body, 5000) ||
      !list(note.tag_ids, 100, item => text(item, 100)) || !text(note.created_at, 64) || !text(note.updated_at, 64)) fail();
  }
  return v as HuntFields;
}
export function huntSaveInput(v: unknown): HuntSave {
  shape(v, [...intentKeys, 'search_id', 'expected_fingerprint', 'action', 'fields', 'outcome']); intent(v);
  if (!uuid(v.search_id) || !hash(v.expected_fingerprint) ||
    !['update', 'pause', 'resume', 'archive', 'restore', 'complete', 'reopen'].includes(String(v.action)) ||
    (v.action === 'update') !== (v.fields != null) || (v.action === 'complete') !== (v.outcome != null) ||
    !optional(v.outcome, x => ['cancelled', 'no_offer'].includes(String(x)))) fail();
  if (v.fields != null) huntFieldsInput(v.fields);
  return v as HuntSave;
}
export function huntCurrentInput(v: unknown): HuntCurrent {
  shape(v, [...intentKeys, 'search_id', 'expected_revision', 'expected_current_ids']); intent(v);
  if (!uuid(v.search_id) || !integer(v.expected_revision) || !list(v.expected_current_ids, 100, uuid) ||
    new Set((v.expected_current_ids as string[]).map(x => x.toLowerCase())).size !== (v.expected_current_ids as string[]).length) fail();
  return v as HuntCurrent;
}
export function huntDeleteInput(v: unknown): HuntDelete {
  shape(v, [...intentKeys, 'search_id', 'expected_revision', 'expected_application_count', 'migrate_to_id', 'expected_target_revision']); intent(v);
  if (!uuid(v.search_id) || !integer(v.expected_revision) || !integer(v.expected_application_count, 0) ||
    !optional(v.migrate_to_id, uuid) || !optional(v.expected_target_revision, integer) ||
    (!!v.migrate_to_id !== (v.expected_target_revision != null)) ||
    (v.migrate_to_id && String(v.migrate_to_id).toLowerCase() === String(v.search_id).toLowerCase())) fail();
  return v as HuntDelete;
}
export function pipelineInitializeInput(v: unknown): MutationIntent {
  shape(v, intentKeys); intent(v); return v as MutationIntent;
}
function huntRecord(v: unknown): v is HuntRecord {
  return record(v) && uuid(v.id) && resourceId(v.slug) && requiredName(v.name, 255) && integer(v.revision) &&
    ['active', 'paused', 'completed', 'archived'].includes(String(v.status)) && typeof v.is_current === 'boolean' &&
    integer(v.application_count, 0) && nullable(v.outcome, x => ['accepted', 'no_offer', 'cancelled'].includes(String(x))) && nullable(v.completed_at, deadline);
}
export const huntRenamedResult = (v: unknown) => journeyResult(v, huntRecord);
export const huntPageResult = (v: unknown) => journeyResult(v, (d): d is HuntPage => record(d) &&
  list(d.items, 25, huntRecord) && integer(d.page, 1, 10000) && integer(d.total, 0) && typeof d.has_more === 'boolean' &&
  d.has_more === (Number(d.page) * 25 < Number(d.total)) && list(d.current_ids, 100, uuid));
export const huntDetailsResult = (v: unknown) => journeyResult(v, (d): d is HuntDetails => record(d) &&
  huntRecord(d.hunt) && hash(d.fingerprint) && record(d.fields));
export const huntSummaryResult = (v: unknown) => journeyResult(v, (d): d is HuntSummary => record(d) &&
  uuid(d.id) && requiredName(d.name, 255) && integer(d.revision) && record(d.preferences) &&
  ['active', 'paused', 'completed', 'archived'].includes(String(d.status)) && optional(d.preferred_resume, record));
export const huntDeletedResult = (v: unknown) => journeyResult(v, (d): d is DeletedHunt => record(d) &&
  uuid(d.search_id) && d.deleted === true && nullable(d.migrated_to_id, uuid) && integer(d.application_count, 0));
export const pipelineInitializedResult = (v: unknown) => journeyResult(v, (d): d is InitializedPipeline => record(d) &&
  list(d.items, 100, x => record(x) && uuid(x.id) && requiredName(x.name, 100) && text(x.type, 80)) &&
  integer(d.total, 0, 100) && (d.items as unknown[]).length === d.total && optional(d.next_cursor, x => x === null));

export type HuntAssignment = { account_id: string; target: { id: string; slug: string; name: string; revision: number; status: string; archived: boolean };
  fingerprint: string; application_count: number; moving_count: number; already_assigned_count: number; all_assigned: boolean; scope?: 'all' };
export type HuntAssignmentWrite = MutationIntent & { search_id: string; scope: 'all'; expected_fingerprint: string;
  expected_application_count: number; expected_moving_count: number };
export function huntAssignmentInput(v: unknown): HuntAssignmentWrite {
  shape(v, [...intentKeys, 'search_id', 'scope', 'expected_fingerprint', 'expected_application_count', 'expected_moving_count']); intent(v);
  if (!uuid(v.search_id) || v.scope !== 'all' || !hash(v.expected_fingerprint) ||
    !integer(v.expected_application_count, 0) || !integer(v.expected_moving_count, 0) ||
    Number(v.expected_moving_count) > Number(v.expected_application_count)) fail();
  return v as HuntAssignmentWrite;
}
export const huntAssignmentResult = (v: unknown) => journeyResult(v, (d): d is HuntAssignment => record(d) &&
  typeof d.account_id === 'string' && d.account_id.startsWith('jh_') && uuid(d.account_id.slice(3)) &&
  record(d.target) && uuid(d.target.id) && resourceId(d.target.slug) && requiredName(d.target.name, 255) &&
  integer(d.target.revision) && text(d.target.status, 80) && typeof d.target.archived === 'boolean' &&
  hash(d.fingerprint) && integer(d.application_count, 0) && integer(d.moving_count, 0) && integer(d.already_assigned_count, 0) &&
  d.application_count === Number(d.moving_count) + Number(d.already_assigned_count) && d.all_assigned === (d.moving_count === 0) &&
  (d.scope === undefined || d.scope === 'all'));
