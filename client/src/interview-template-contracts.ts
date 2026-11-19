/** Complete owned interview template discovery and explicit initialization. */
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, optional, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type InterviewTemplate = { id: string; title: string; default_step_type: string | null; sort_order: number | null;
  is_system: boolean | null; created_at: string | null; fingerprint: string };
export type InterviewTemplateList = { page?: number };
export type InterviewTemplateDirectory = { items: InterviewTemplate[]; page: number; total: number; has_more: boolean; fingerprint: string };
export type InterviewTemplateInitialize = MutationIntent & { expected_fingerprint: string };
export type InterviewTemplatesInitialized = { initialized: boolean; created_ids: string[] };
export type InterviewTemplateCreate = MutationIntent & { title: string; default_step_type?: string | null };
export type InterviewTemplateDelete = MutationIntent & { template_id: string; expected_fingerprint: string };
export type InterviewTemplateRemoved = { id: string; deleted: true };
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function listInput(v: unknown): InterviewTemplateList {
  shape(v, ['page']); if (v.page !== undefined && !integer(v.page, 1, 10000)) fail(); return v as InterviewTemplateList;
}
export function initializeInput(v: unknown): InterviewTemplateInitialize {
  shape(v, [...intentKeys, 'expected_fingerprint']); intent(v); if (!digest(v.expected_fingerprint)) fail(); return v as InterviewTemplateInitialize;
}
export function createInput(v: unknown): InterviewTemplateCreate {
  shape(v, [...intentKeys, 'title', 'default_step_type']); intent(v);
  if (!text(v.title, 255) || !String(v.title).trim() || !optional(v.default_step_type, value => text(value, 50))) fail();
  return v as InterviewTemplateCreate;
}
export function deleteInput(v: unknown): InterviewTemplateDelete {
  shape(v, [...intentKeys, 'template_id', 'expected_fingerprint']); intent(v);
  if (!uuid(v.template_id) || !digest(v.expected_fingerprint)) fail(); return v as InterviewTemplateDelete;
}
function template(v: unknown): v is InterviewTemplate & JsonObject {
  return record(v) && uuid(v.id) && typeof v.title === 'string' &&
    (v.default_step_type === null || typeof v.default_step_type === 'string') && (v.sort_order === null || integer(v.sort_order, -2147483648, 2147483647)) &&
    (v.is_system === null || typeof v.is_system === 'boolean') && (v.created_at === null || typeof v.created_at === 'string') && digest(v.fingerprint) && !Object.hasOwn(v, 'user_id');
}
export const templateResult = (v: unknown) => journeyResult(v, template);
export const directoryResult = (value: unknown, args: InterviewTemplateList) => journeyResult(value, (v): v is InterviewTemplateDirectory => {
  if (!record(v) || v.page !== (args.page ?? 1) || !integer(v.total, 0) || !digest(v.fingerprint) ||
    v.has_more !== ((args.page ?? 1) * 25 < Number(v.total)) || !Array.isArray(v.items) ||
    v.items.length !== Math.min(25, Math.max(0, Number(v.total) - ((args.page ?? 1) - 1) * 25)) || !v.items.every(template)) return false;
  return new Set(v.items.map(item => item.id)).size === v.items.length;
});
export const initializedResult = (value: unknown) => journeyResult(value, (v): v is InterviewTemplatesInitialized => record(v) &&
  Array.isArray(v.created_ids) && v.created_ids.length <= 9 && v.created_ids.every(uuid) && new Set(v.created_ids).size === v.created_ids.length &&
  typeof v.initialized === 'boolean' && (v.initialized ? v.created_ids.length === 9 : v.created_ids.length === 0));
export const removedResult = (value: unknown, args: InterviewTemplateDelete) => journeyResult(value, (v): v is InterviewTemplateRemoved =>
  record(v) && typeof v.id === 'string' && same(v.id, args.template_id) && v.deleted === true);
