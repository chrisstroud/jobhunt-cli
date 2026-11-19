/** Exact browser workspace DTOs and complete private task-note transport. */
import { record } from './protocol.ts';
import { fail, integer, journeyResult, optional, resourceId, shape, uuid } from './journey-contracts.ts';
import { taskOccurrence, taskReadInput, type TaskOccurrence, type TaskReadInput, type TaskTarget } from './task-contracts.ts';

export type WorkspaceTask = { id: string; revision: number; title: string; description: string | null;
  dueAt: string | null; completedAt: string | null; isActive: boolean; applicationSlug: string | null;
  applicationId: string | null; roleTitle: string | null; companyName: string | null; recurrence?: TaskOccurrence | null };
export type WorkspaceTaskPage = { items: WorkspaceTask[]; page: number; total: number; has_more: boolean };
export type WorkspacePageRead = { page?: number };
export type ApplicationChoice = { id: string; slug: string | null; companyName: string; position: string;
  stage: string | null; revision: number | null; contactRole: 'other'; isPrimaryContact: false };
export type ApplicationChoices = { items: ApplicationChoice[]; page: number; total: number; has_more: boolean };
export type ApplicationChoicesRead = WorkspacePageRead & { slug?: string | null };
export type TaskDescriptionManifest = { account_id: string; task_id: string; application_id: string | null;
  revision: number; task_type: string | null; is_stage_template: boolean; is_null: boolean; filename: string; mime: 'text/plain'; size_bytes: number; size_chars: number;
  chunk_chars: 32000; chunk_count: number; sha256: string };
export type TaskDescriptionChunkRead = TaskTarget & { expected_revision: number; expected_sha256: string; chunk_index: number };
export type TaskDescriptionChunk = TaskDescriptionManifest & { chunk_index: number; text: string; chunk_sha256: string };

const string = (v: unknown): v is string => typeof v === 'string';
const nullableString = (v: unknown) => v === null || string(v);
const digest = (v: unknown): v is string => string(v) && /^[a-f0-9]{64}$/u.test(v);
const array = (v: unknown, check: (v: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.every(check);
const bound = (v: unknown, page: number, per: number, check: (v: unknown) => boolean) => record(v) && v.page === page &&
  integer(v.total, 0, Number.MAX_SAFE_INTEGER) && typeof v.has_more === 'boolean' && array(v.items, check) &&
  v.items.length === Math.min(per, Math.max(0, Number(v.total) - (page - 1) * per)) &&
  v.has_more === (page * per < Number(v.total)) && new Set(v.items.map(item => (item as { id: string }).id)).size === v.items.length;

export function workspacePageInput(v: unknown): WorkspacePageRead {
  shape(v, ['page']); if (v.page !== undefined && !integer(v.page, 1, 10000)) fail();
  return v as WorkspacePageRead;
}
export function choicesInput(v: unknown): ApplicationChoicesRead {
  shape(v, ['page', 'slug']);
  if ((v.page !== undefined && !integer(v.page, 1, 10000)) || !optional(v.slug, resourceId)) fail();
  return v as ApplicationChoicesRead;
}
export function descriptionInput(v: unknown): TaskTarget {
  shape(v, ['task_id', 'expected_application_id']); taskReadInput(v); return v as TaskTarget;
}
export function descriptionChunkInput(v: unknown): TaskDescriptionChunkRead {
  shape(v, ['task_id', 'expected_application_id', 'expected_revision', 'expected_sha256', 'chunk_index']);
  descriptionInput({ task_id: v.task_id, ...(v.expected_application_id !== undefined ? { expected_application_id: v.expected_application_id } : {}) });
  if (!integer(v.expected_revision) || !digest(v.expected_sha256) || !integer(v.chunk_index, 1, Number.MAX_SAFE_INTEGER)) fail();
  return v as TaskDescriptionChunkRead;
}
export function photoInput(id: unknown): { photo_id: string } {
  if (!uuid(id)) fail(); return { photo_id: id as string };
}
function workspaceTask(v: unknown): v is WorkspaceTask {
  return record(v) && uuid(v.id) && integer(v.revision) && string(v.title) && nullableString(v.description) &&
    nullableString(v.dueAt) && nullableString(v.completedAt) && typeof v.isActive === 'boolean' &&
    (v.applicationId === null || uuid(v.applicationId)) && nullableString(v.applicationSlug) && nullableString(v.roleTitle) &&
    nullableString(v.companyName) && optional(v.recurrence, taskOccurrence);
}
export const taskWorkspaceResult = (v: unknown, input: TaskReadInput) => journeyResult(v, (d): d is WorkspaceTaskPage => {
  if (!bound(d, 1, 20, workspaceTask) || !record(d) || d.total !== 1 || (d.items as WorkspaceTask[])[0].id !== input.task_id.toLowerCase()) return false;
  const item = (d.items as WorkspaceTask[])[0];
  return (input.expected_application_id === undefined || item.applicationId === (input.expected_application_id?.toLowerCase() ?? null)) &&
    (!input.occurrence_date || !item.recurrence || item.recurrence.date === input.occurrence_date);
});
export const taskWorkspacePageResult = (v: unknown, input: WorkspacePageRead) => journeyResult(v, (d): d is WorkspaceTaskPage => bound(d, input.page ?? 1, 20, workspaceTask));
function choice(v: unknown): v is ApplicationChoice {
  return record(v) && uuid(v.id) && nullableString(v.slug) && string(v.companyName) && string(v.position) && nullableString(v.stage) &&
    (v.revision === null || integer(v.revision, 0)) && v.contactRole === 'other' && v.isPrimaryContact === false;
}
export const choicesResult = (v: unknown, input: ApplicationChoicesRead) => journeyResult(v, (d): d is ApplicationChoices => {
  if (!bound(d, input.page ?? 1, 100, choice) || !record(d)) return false;
  return !input.slug || (d.items as ApplicationChoice[]).every(row => row.slug === input.slug || row.id.toLowerCase() === input.slug!.toLowerCase());
});
function manifest(v: unknown): v is TaskDescriptionManifest {
  return record(v) && string(v.account_id) && v.account_id.startsWith('jh_') && uuid(v.account_id.slice(3)) &&
    uuid(v.task_id) && (v.application_id === null || uuid(v.application_id)) && integer(v.revision) && nullableString(v.task_type) &&
    typeof v.is_stage_template === 'boolean' && typeof v.is_null === 'boolean' &&
    v.filename === 'task-' + v.task_id + '.txt' && v.mime === 'text/plain' &&
    integer(v.size_bytes, 0, Number.MAX_SAFE_INTEGER) && integer(v.size_chars, 0, Number.MAX_SAFE_INTEGER) &&
    Number(v.size_bytes) >= Number(v.size_chars) && Number(v.size_bytes) <= Number(v.size_chars) * 4 &&
    (!v.is_null || v.size_chars === 0) && v.chunk_chars === 32000 && integer(v.chunk_count, 0, Number.MAX_SAFE_INTEGER) &&
    v.chunk_count === Math.ceil(Number(v.size_chars) / 32000) && digest(v.sha256);
}
const descriptionMatches = (v: TaskDescriptionManifest, input: TaskTarget) => v.task_id === input.task_id.toLowerCase() &&
  (input.expected_application_id === undefined || v.application_id === (input.expected_application_id?.toLowerCase() ?? null));
export const descriptionManifestResult = (v: unknown, input: TaskTarget) => journeyResult(v, (d): d is TaskDescriptionManifest => manifest(d) && descriptionMatches(d, input));
export const descriptionChunkResult = (v: unknown, input: TaskDescriptionChunkRead) => journeyResult(v, (d): d is TaskDescriptionChunk => {
  if (!record(d)) return false;
  const part = d;
  return manifest(d) && descriptionMatches(d, input) && d.sha256 === input.expected_sha256 && d.revision === input.expected_revision &&
    part.chunk_index === input.chunk_index && integer(part.chunk_index, 1, d.chunk_count) && string(part.text) &&
    [...part.text].length === Math.min(32000, d.size_chars - (input.chunk_index - 1) * 32000) && digest(part.chunk_sha256);
});
