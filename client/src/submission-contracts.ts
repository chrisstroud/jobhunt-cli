/** User-reported submissions and their exact document choices; never employer delivery. */
import { record } from './protocol.ts';
import { calendarDate, fail, integer, intent, intentKeys, journeyResult, optional, shape, text, type MutationIntent } from './journey-contracts.ts';
import { jobId } from './job-pipeline-contracts.ts';

export type SubmissionRead = { application_id: string; before_id?: string | null };
export type SubmissionOptionsRead = { application_id: string; prepared_before_id?: string | null; external_before_id?: string | null };
export type RecordSubmission = MutationIntent & {
  application_id: string; expected_revision: number; date: string; user_confirmed: true;
  evidence?: 'user_report'; destination?: string | null; supersedes_id?: string | null; move_to_applied?: boolean;
} & ({ document_knowledge: 'unknown' } | { document_knowledge: 'prepared'; prepared_id: string } |
  { document_knowledge: 'external'; external_document_ids: string[] });
export function submissionReadInput(value: unknown): SubmissionRead {
  shape(value, ['application_id', 'before_id']);
  if (!jobId(value.application_id) || !optional(value.before_id, jobId)) fail();
  return value as SubmissionRead;
}
export function submissionOptionsInput(value: unknown): SubmissionOptionsRead {
  shape(value, ['application_id', 'prepared_before_id', 'external_before_id']);
  if (!jobId(value.application_id) || !optional(value.prepared_before_id, jobId) || !optional(value.external_before_id, jobId)) fail();
  return value as SubmissionOptionsRead;
}
export function recordSubmissionInput(value: unknown): RecordSubmission {
  shape(value, [...intentKeys, 'application_id', 'expected_revision', 'date', 'user_confirmed', 'evidence',
    'document_knowledge', 'prepared_id', 'external_document_ids', 'destination', 'supersedes_id', 'move_to_applied']); intent(value);
  if (!jobId(value.application_id) || !integer(value.expected_revision) || !calendarDate(value.date) || value.user_confirmed !== true ||
      (value.evidence !== undefined && value.evidence !== 'user_report') || !optional(value.supersedes_id, jobId) ||
      !optional(value.destination, v => text(v, 2048) && (v as string).length > 0) ||
      (value.move_to_applied !== undefined && typeof value.move_to_applied !== 'boolean')) fail();
  if (value.document_knowledge === 'prepared') {
    if (!jobId(value.prepared_id) || Object.hasOwn(value, 'external_document_ids')) fail();
  } else if (value.document_knowledge === 'external') {
    if (Object.hasOwn(value, 'prepared_id') || !Array.isArray(value.external_document_ids) || value.external_document_ids.length < 1 ||
        value.external_document_ids.length > 5 || !value.external_document_ids.every(jobId) || new Set(value.external_document_ids).size !== value.external_document_ids.length) fail();
  } else if (value.document_knowledge !== 'unknown' || Object.hasOwn(value, 'prepared_id') || Object.hasOwn(value, 'external_document_ids')) fail();
  return value as RecordSubmission;
}
export type SubmissionFile = { id: string; name: string; kind: 'prepared' | 'external'; type: string; sha256?: string | null };
export type Submission = {
  id: string; application_id: string; date: string; evidence: 'user_report'; document_knowledge: 'prepared' | 'external' | 'unknown';
  documents: SubmissionFile[]; prepared_id?: string | null; destination?: string | null; destination_known: boolean;
  supersedes_id?: string | null; superseded: boolean; recorded_at: string;
};
export type SubmissionHistory = { application_id: string; items: Submission[]; next_cursor: string | null; unavailable_legacy_count: number };
export type PreparedSubmissionChoice = { id: string; name: string; created_at: string; documents: SubmissionFile[] };
export type SubmissionOptions = {
  application_id: string; stage: string; employer_url: string | null; today: string; timezone: string | null;
  prepared: PreparedSubmissionChoice[]; external: SubmissionFile[]; prepared_have_more: boolean; external_have_more: boolean;
  prepared_next_cursor?: string | null; external_next_cursor?: string | null;
};
function file(value: unknown): value is SubmissionFile {
  return record(value) && jobId(value.id) && text(value.name, 255) && (value.name as string).length > 0 &&
    ['prepared', 'external'].includes(String(value.kind)) && text(value.type, 40) &&
    optional(value.sha256, v => typeof v === 'string' && /^[0-9a-f]{64}$/u.test(v));
}
function files(value: unknown, maximum: number): value is SubmissionFile[] {
  return Array.isArray(value) && value.length <= maximum && value.every(file);
}
function submission(value: unknown): value is Submission {
  return record(value) && jobId(value.id) && jobId(value.application_id) && calendarDate(value.date) && value.evidence === 'user_report' &&
    ['prepared', 'external', 'unknown'].includes(String(value.document_knowledge)) && files(value.documents, 5) &&
    optional(value.prepared_id, jobId) && optional(value.supersedes_id, jobId) && optional(value.destination, v => text(v, 2048)) &&
    typeof value.destination_known === 'boolean' && typeof value.superseded === 'boolean' && text(value.recorded_at, 40);
}
function history(value: unknown): value is SubmissionHistory {
  return record(value) && jobId(value.application_id) && Array.isArray(value.items) && value.items.length <= 50 && value.items.every(submission) &&
    (value.next_cursor === null || jobId(value.next_cursor)) && integer(value.unavailable_legacy_count, 0);
}
function options(value: unknown): value is SubmissionOptions {
  return record(value) && jobId(value.application_id) && text(value.stage, 100) && optional(value.employer_url, v => text(v, 2048)) &&
    calendarDate(value.today) && optional(value.timezone, v => text(v, 100)) && Array.isArray(value.prepared) && value.prepared.length <= 20 &&
    value.prepared.every(row => record(row) && jobId(row.id) && text(row.name, 255) && text(row.created_at, 40) && files(row.documents, 5)) &&
    files(value.external, 20) && typeof value.prepared_have_more === 'boolean' && typeof value.external_have_more === 'boolean' &&
    optional(value.prepared_next_cursor, jobId) && optional(value.external_next_cursor, jobId);
}
export const submissionResult = (value: unknown) => journeyResult(value, submission);
export const submissionHistoryResult = (value: unknown) => journeyResult(value, history);
export const submissionOptionsResult = (value: unknown) => journeyResult(value, options);
