/** Private saved-record links and exact current revision resolution. */
import { record } from './protocol.ts';
import { careerDocument, type CareerDocument } from './document-contracts.ts';
import { savedJob, type SavedJob } from './job-pipeline-contracts.ts';
import { fail, integer, journeyResult, optional, shape, text, uuid } from './journey-contracts.ts';

export type RecordReferenceIdentity = { kind: 'application' | 'document'; id: string; revision: number };
export type RecordReferenceLink = { type?: 'resource_link'; mimeType?: 'application/json'; uri: string; name: string; title: string; description: string };
export type RecordReferenceMatches = { items: RecordReferenceLink[]; has_more: boolean };
export type RecordReferenceSelection = { version: 1; search_id?: string | null; application_id?: string | null; application_revision?: number | null;
  document_id?: string | null; document_revision?: number | null; section?: string | null };
export type SavedRecordReference = { selection: RecordReferenceSelection } & (
  { kind: 'application'; application: SavedJob; document?: null } |
  { kind: 'document'; document: CareerDocument; application?: null });

export function recordReferenceIdentity(value: unknown): RecordReferenceIdentity | null {
  if (typeof value !== 'string' || value.length > 512) return null;
  const match = /^jobhunt:\/\/(applications|documents)\/([a-f0-9-]{36})\?revision=([1-9][0-9]{0,14})$/u.exec(value);
  if (!match || match[0] !== value || !uuid(match[2])) return null;
  return { kind: match[1] === 'applications' ? 'application' : 'document', id: match[2], revision: Number(match[3]) };
}
export function recordReferenceFindInput(value: unknown): { query: string } {
  shape(value, ['query']);
  if (value.query !== undefined && !text(value.query, 120)) fail();
  return { query: value.query === undefined ? '' : value.query as string };
}
export function recordReferenceReadInput(value: unknown): { uri: string } {
  shape(value, ['uri']); if (!recordReferenceIdentity(value.uri)) fail();
  return value as { uri: string };
}
export function recordReferenceMatches(value: unknown): RecordReferenceMatches {
  if (!record(value) || !Array.isArray(value.items) || value.items.length > 20 || typeof value.has_more !== 'boolean' ||
      (value.has_more && value.items.length !== 20) || !value.items.every(item => record(item) && recordReferenceIdentity(item.uri) &&
        (item.type === undefined || item.type === 'resource_link') && (item.mimeType === undefined || item.mimeType === 'application/json') &&
        text(item.name, 1024) && text(item.title, 1024) && text(item.description, 160)) ||
      new Set(value.items.map(item => item.uri)).size !== value.items.length) fail(true);
  return value as RecordReferenceMatches;
}
function selection(value: unknown): value is RecordReferenceSelection {
  if (!record(value) || value.version !== 1 || !['search_id', 'application_id', 'document_id'].every(key => optional(value[key], uuid)) ||
      !['application_revision', 'document_revision'].every(key => optional(value[key], integer)) || !optional(value.section, v => typeof v === 'string')) return false;
  return (value.application_id != null) === (value.application_revision != null) && (value.document_id != null) === (value.document_revision != null);
}
function savedReference(value: unknown): value is SavedRecordReference {
  if (!record(value) || !selection(value.selection)) return false;
  const selected = value.selection;
  if (value.kind === 'application') return savedJob(value.application) && value.document == null &&
    selected.application_id === value.application.id && selected.application_revision === value.application.revision &&
    selected.document_id == null && selected.document_revision == null;
  return value.kind === 'document' && careerDocument(value.document) && value.application == null &&
    selected.document_id === value.document.id && selected.document_revision === value.document.revision &&
    (value.document.application_id != null ? selected.application_id === value.document.application_id && selected.application_revision != null : selected.application_id == null);
}
export const savedRecordReferenceResult = (value: unknown) => journeyResult(value, savedReference);
