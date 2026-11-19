/** Wire contracts for existing capture/edit/stage services; product policy stays on the server. */
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, optional, resourceId, shape, text, type MutationIntent } from './journey-contracts.ts';

export const jobId = resourceId;
const nonblank = (value: unknown, limit: number) => text(value, limit) && Boolean((value as string).trim());
const bool = (value: unknown) => value === undefined || typeof value === 'boolean';
export function jobReadInput(value: unknown): { application_id: string } {
  shape(value, ['application_id']); if (!jobId(value.application_id)) fail();
  return value as { application_id: string };
}
export type CaptureJobURL = MutationIntent & {
  url: string; search_id?: string | null; job_search_slug?: string | null;
  status?: string | null; save_separately?: boolean;
};
export type CaptureJobDetails = MutationIntent & {
  title?: string | null; company?: string | null; posting_text?: string | null; source_url?: string | null;
  company_id?: string | null; source_contact_id?: string | null; search_id?: string | null; stage_id?: string | null;
  location?: string; employment?: string; compensation?: string; save_separately?: boolean;
};
export type CaptureTargetCompany = MutationIntent & { name: string; website?: string | null; notes?: string | null; search_id?: string | null };
export type EditJobDetails = MutationIntent & {
  application_id: string; expected_revision: number; title?: string; company?: string;
  posting_text?: string | null; source_url?: string | null;
};
export type MoveJobStage = MutationIntent & {
  application_id: string; expected_revision: number; stage_id: string; closed_reason?: string | null;
};
export function captureJobURLInput(value: unknown): CaptureJobURL {
  shape(value, [...intentKeys, 'url', 'search_id', 'job_search_slug', 'status', 'save_separately']); intent(value);
  if (!nonblank(value.url, 2048) || !optional(value.search_id, jobId) || !optional(value.job_search_slug, jobId) ||
      (value.search_id != null && value.job_search_slug != null) || !optional(value.status, v => nonblank(v, 100)) || !bool(value.save_separately)) fail();
  return value as CaptureJobURL;
}
export function captureJobDetailsInput(value: unknown): CaptureJobDetails {
  shape(value, [...intentKeys, 'title', 'company', 'posting_text', 'source_url', 'company_id', 'source_contact_id',
    'search_id', 'stage_id', 'location', 'employment', 'compensation', 'save_separately']); intent(value);
  for (const key of ['title', 'company']) if (!optional(value[key], v => nonblank(v, 255))) fail();
  for (const key of ['company_id', 'source_contact_id', 'search_id', 'stage_id']) if (!optional(value[key], jobId)) fail();
  if (!optional(value.posting_text, v => nonblank(v, 100000)) || !optional(value.source_url, v => nonblank(v, 2048)) ||
      (!value.posting_text && !(value.title && value.company)) || !bool(value.save_separately)) fail();
  for (const [key, limit] of [['location', 2000], ['employment', 255], ['compensation', 2000]] as const)
    if (value[key] !== undefined && !text(value[key], limit)) fail();
  return value as CaptureJobDetails;
}
export function captureTargetCompanyInput(value: unknown): CaptureTargetCompany {
  shape(value, [...intentKeys, 'name', 'website', 'notes', 'search_id']); intent(value);
  if (!nonblank(value.name, 255) || !optional(value.website, v => text(v, 500)) ||
      !optional(value.notes, v => text(v, 10000)) || !optional(value.search_id, jobId)) fail();
  return value as CaptureTargetCompany;
}
function existing(value: JsonObject) {
  intent(value); if (!jobId(value.application_id) || !integer(value.expected_revision)) fail();
}
export function editJobDetailsInput(value: unknown): EditJobDetails {
  const fields = ['title', 'company', 'posting_text', 'source_url'];
  shape(value, [...intentKeys, 'application_id', 'expected_revision', ...fields]); existing(value);
  if (!fields.some(key => Object.hasOwn(value, key))) fail();
  for (const key of ['title', 'company']) if (Object.hasOwn(value, key) && !nonblank(value[key], 255)) fail();
  if (!optional(value.posting_text, v => text(v, 100000)) || !optional(value.source_url, v => text(v, 2048))) fail();
  return value as EditJobDetails;
}
export function moveJobStageInput(value: unknown): MoveJobStage {
  shape(value, [...intentKeys, 'application_id', 'expected_revision', 'stage_id', 'closed_reason']); existing(value);
  if (!jobId(value.stage_id) || !optional(value.closed_reason, v => nonblank(v, 255))) fail();
  return value as MoveJobStage;
}
export type SavedJob = {
  id: string; title: string; company: string; revision: number; stage: string;
  search_id?: string | null; source_url?: string | null; captured_at?: string | null;
  capture_state: 'pending' | 'captured' | 'partial' | 'needs_input' | 'failed'; posting?: string | null;
  submission_known: boolean; offer_known: boolean; company_id?: string | null;
};
export function savedJob(value: unknown): value is SavedJob {
  return record(value) && jobId(value.id) && nonblank(value.title, 255) && nonblank(value.company, 255) && integer(value.revision) &&
    text(value.stage, 100) && ['pending', 'captured', 'partial', 'needs_input', 'failed'].includes(String(value.capture_state)) &&
    optional(value.search_id, jobId) && optional(value.company_id, jobId) && optional(value.source_url, v => text(v, 2048)) &&
    optional(value.captured_at, v => text(v, 40)) && optional(value.posting, v => text(v, 100000)) &&
    typeof value.submission_known === 'boolean' && typeof value.offer_known === 'boolean';
}
export const savedJobResult = (value: unknown) => journeyResult(value, savedJob);
export type PipelineStage = { type: 'pipeline_stage'; id: string; attributes: {
  display_name: string; stage_type: string; sort_order: number; is_custom?: boolean;
} };
export type PipelineStages = { data: PipelineStage[]; meta: JsonObject; links?: JsonObject };
export function pipelineStagesResult(value: unknown): PipelineStages {
  if (!record(value) || !Array.isArray(value.data) || value.data.length > 100 || !record(value.meta) ||
      !value.data.every(row => record(row) && row.type === 'pipeline_stage' && jobId(row.id) && record(row.attributes) &&
        nonblank(row.attributes.display_name, 100) && text(row.attributes.stage_type, 100) &&
        Number.isSafeInteger(row.attributes.sort_order) && bool(row.attributes.is_custom))) fail(true);
  return value as PipelineStages;
}
