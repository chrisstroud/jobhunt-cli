/** Existing stage templates and explicitly reviewed assignment cleanup. */
import { record } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type StageTemplate = {
  account_id: string; template_id: string; stage_id: string | null; detached: boolean;
  revision: number; fingerprint: string; title: string; description: string | null;
  sort_order: number; due_days_offset: number | null; auto_complete_on_forward: boolean;
  stage_automation_retired: true; assignments: { pending: number; completed: number; skipped: number; unknown: number };
};
export type TemplateListInput = { stage_id?: string | null; include_detached?: boolean; page?: number };
export type TemplatePage = { account_id: string; items: StageTemplate[]; page: number; has_more: boolean; stage_fingerprint: string | null };
export type TemplatePatch = Partial<Pick<StageTemplate, 'title' | 'description' | 'sort_order' | 'due_days_offset' | 'auto_complete_on_forward'>>;
export type TemplateWrite = MutationIntent & { template_id: string; expected_fingerprint: string; patch: TemplatePatch };
export type TemplateRemove = MutationIntent & { template_id: string; expected_fingerprint: string;
  disposition: 'preserve_assignments' | 'remove_assignments'; confirmed: true };
export type TemplateState = { account_id: string; template_id: string; current: StageTemplate | null };
export type TemplateRemoval = TemplateState & { disposition: TemplateRemove['disposition'] };
export type TemplateReorder = MutationIntent & { stage_id: string; expected_fingerprint: string; template_ids: string[] };
const fingerprint = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const account = (value: unknown) => typeof value === 'string' && value.startsWith('jh_') && uuid(value.slice(3));
const disposition = (value: unknown) => value === 'preserve_assignments' || value === 'remove_assignments';

export function templateListInput(value: unknown): TemplateListInput {
  shape(value, ['stage_id', 'include_detached', 'page']);
  if (value.stage_id != null && !uuid(value.stage_id) || value.include_detached !== undefined && typeof value.include_detached !== 'boolean' ||
      value.page !== undefined && !integer(value.page, 1, 100000)) fail();
  return value as TemplateListInput;
}
export function templateReadInput(value: unknown): { template_id: string } {
  shape(value, ['template_id']); if (!uuid(value.template_id)) fail();
  return value as { template_id: string };
}
export function templateWriteInput(value: unknown): TemplateWrite {
  shape(value, [...intentKeys, 'template_id', 'expected_fingerprint', 'patch']); intent(value);
  if (!uuid(value.template_id) || !fingerprint(value.expected_fingerprint)) fail();
  shape(value.patch, ['title', 'description', 'sort_order', 'due_days_offset', 'auto_complete_on_forward']);
  if (!Object.keys(value.patch).length) fail();
  for (const [key, field] of Object.entries(value.patch)) {
    if (key === 'title' && (!text(field, 255) || !String(field).trim()) ||
        key === 'description' && field !== null && !text(field, 20000) ||
        key === 'sort_order' && !integer(field, 0) ||
        key === 'due_days_offset' && field !== null && !integer(field, -3650, 3650) ||
        key === 'auto_complete_on_forward' && typeof field !== 'boolean') fail();
  }
  return value as TemplateWrite;
}
export function templateRemoveInput(value: unknown): TemplateRemove {
  shape(value, [...intentKeys, 'template_id', 'expected_fingerprint', 'disposition', 'confirmed']); intent(value);
  if (!uuid(value.template_id) || !fingerprint(value.expected_fingerprint) || !disposition(value.disposition) || value.confirmed !== true) fail();
  return value as TemplateRemove;
}
export function templateReorderInput(value: unknown): TemplateReorder {
  shape(value, [...intentKeys, 'stage_id', 'expected_fingerprint', 'template_ids']); intent(value);
  if (!uuid(value.stage_id) || !fingerprint(value.expected_fingerprint) || !Array.isArray(value.template_ids) ||
      value.template_ids.length > 500 || !value.template_ids.every(uuid) || new Set(value.template_ids).size !== value.template_ids.length) fail();
  return value as TemplateReorder;
}
function template(value: unknown): value is StageTemplate {
  return record(value) && account(value.account_id) && uuid(value.template_id) && (value.stage_id === null || uuid(value.stage_id)) &&
    value.detached === (value.stage_id === null) && integer(value.revision) && fingerprint(value.fingerprint) && text(value.title, 255) &&
    (value.description === null || text(value.description, 20000)) && integer(value.sort_order, -2147483648) &&
    (value.due_days_offset === null || integer(value.due_days_offset, -2147483648)) && typeof value.auto_complete_on_forward === 'boolean' &&
    value.stage_automation_retired === true && record(value.assignments) &&
    ['pending', 'completed', 'skipped', 'unknown'].every(key => integer((value.assignments as Record<string, unknown>)[key], 0));
}
function state(value: unknown): value is TemplateState {
  return record(value) && account(value.account_id) && uuid(value.template_id) &&
    (value.current === null || template(value.current) && value.current.template_id === value.template_id && value.current.account_id === value.account_id);
}
export const templateResult = (value: unknown) => journeyResult(value, template);
export const templateStateResult = (value: unknown) => journeyResult(value, state);
export const templateRemovalResult = (value: unknown) => journeyResult(value, (data): data is TemplateRemoval => state(data) && disposition((data as TemplateRemoval).disposition));
export const templatePageResult = (value: unknown) => journeyResult(value, (data): data is TemplatePage => record(data) && account(data.account_id) &&
  Array.isArray(data.items) && data.items.length <= 20 && data.items.every(item => template(item) && item.account_id === data.account_id) &&
  integer(data.page, 1, 100000) && typeof data.has_more === 'boolean' && (data.stage_fingerprint === null || fingerprint(data.stage_fingerprint)));
