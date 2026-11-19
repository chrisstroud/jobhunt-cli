/** Reviewed pipeline administration; separate from moving an application. */
import { record } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, optional, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';
export type PipelineStageRecord = { id: string; name: string; position: number; stage_type: string; is_terminal: boolean;
  is_system: boolean; application_count: number; task_count: number; assignment_count: number };
export type PipelineConfiguration = { account_id: string; fingerprint: string; items: PipelineStageRecord[];
  total: number; page: number; has_more: boolean; stage_automation_retired: true };
export type PipelineStageState = { account_id: string; stage_id: string; fingerprint: string;
  current: PipelineStageRecord | null; stage_automation_retired: true };
export type PipelineStageCreate = MutationIntent & { expected_fingerprint: string; name: string; position: number };
export type PipelineStageRename = MutationIntent & { expected_fingerprint: string; stage_id: string; name: string };
export type PipelineStageReorder = MutationIntent & { expected_fingerprint: string; stage_id: string; position: number };
export type PipelineStageRemove = MutationIntent & { expected_fingerprint: string; stage_id: string; migrate_to_id?: string | null };
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const account = (v: unknown) => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const name = (v: unknown) => text(v, 100) && !!String(v).trim();
export function pipelineReadInput(v: unknown): { page?: number } {
  shape(v, ['page']); if (v.page !== undefined && !integer(v.page, 1, 100000)) fail(); return v as { page?: number };
}
export function pipelineWriteInput(v: unknown, action: 'create'): PipelineStageCreate;
export function pipelineWriteInput(v: unknown, action: 'rename'): PipelineStageRename;
export function pipelineWriteInput(v: unknown, action: 'reorder'): PipelineStageReorder;
export function pipelineWriteInput(v: unknown, action: 'remove'): PipelineStageRemove;
export function pipelineWriteInput(v: unknown, action: string) {
  const extra = action === 'create' ? ['name', 'position'] : action === 'rename' ? ['stage_id', 'name'] :
    action === 'reorder' ? ['stage_id', 'position'] : action === 'remove' ? ['stage_id', 'migrate_to_id'] : fail();
  shape(v, [...intentKeys, 'expected_fingerprint', ...extra]); intent(v);
  if (!hash(v.expected_fingerprint) || (action !== 'create' && !uuid(v.stage_id)) ||
    (['create', 'rename'].includes(action) && !name(v.name)) ||
    (['create', 'reorder'].includes(action) && !integer(v.position, 0)) ||
    (action === 'remove' && (!optional(v.migrate_to_id, uuid) || (v.migrate_to_id && String(v.migrate_to_id).toLowerCase() === String(v.stage_id).toLowerCase())))) fail();
  return v as PipelineStageCreate | PipelineStageRename | PipelineStageReorder | PipelineStageRemove;
}
function stage(v: unknown): v is PipelineStageRecord {
  return record(v) && uuid(v.id) && text(v.name, 100) && integer(v.position, 0) && text(v.stage_type, 50) &&
    typeof v.is_terminal === 'boolean' && typeof v.is_system === 'boolean' && integer(v.application_count, 0) &&
    integer(v.task_count, 0) && integer(v.assignment_count, 0);
}
export const pipelineConfigurationResult = (v: unknown) => journeyResult(v, (d): d is PipelineConfiguration => record(d) &&
  account(d.account_id) && hash(d.fingerprint) && Array.isArray(d.items) && d.items.length <= 25 && d.items.every(stage) &&
  new Set(d.items.map(x => x.id)).size === d.items.length && integer(d.total, 0) && integer(d.page, 1, 100000) &&
  d.has_more === (Number(d.page) * 25 < Number(d.total)) && d.stage_automation_retired === true);
export const pipelineStageResult = (v: unknown) => journeyResult(v, (d): d is PipelineStageState => record(d) &&
  account(d.account_id) && uuid(d.stage_id) && hash(d.fingerprint) && d.stage_automation_retired === true &&
  (d.current === null || (stage(d.current) && d.current.id === d.stage_id)));
