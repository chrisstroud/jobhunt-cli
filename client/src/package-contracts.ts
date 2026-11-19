/** Existing role-workflow/preparation contracts and short-lived private downloads. */
import { record } from './protocol.ts';
import { calendarDate, deadline, fail, integer, intent, intentKeys, journeyResult, optional, resourceId, shape, text, type MutationIntent } from './journey-contracts.ts';
import { source, type CareerSource } from './document-contracts.ts';

export type WorkflowDocument = { id: string; slug: string; name: string; revision: number; type: 'resume' | 'cover_letter';
  fingerprint: string; website_url: string; master_id?: string | null; relation: 'master' | 'role_draft' };
export type ApplicationDocuments = { application_id: string; app_slug: string; revision: string; fingerprint: string;
  selected_id: string | null; documents: WorkflowDocument[]; choices: WorkflowDocument[]; choices_have_more?: boolean;
  changes: { document_id: string; field: string; before: string | null; after: string | null;
    state: 'draft' | 'uncertain' | 'confirmed' | 'declined'; sources: CareerSource[] }[];
  changes_have_more?: boolean; unresolved: string[] };
export type ResumeChoicesRead = { app_slug: string; query?: string; page?: number };
export type ResumeChoices = { application_id: string; choices: WorkflowDocument[]; page: number; total: number; has_more: boolean };
export type SelectApplicationDocuments = MutationIntent & { app_slug: string; revision: string; expected_revision: number; package_id: string };
export type CustomizeApplicationDocuments = MutationIntent & { app_slug: string; revision: string; expected_revision: number;
  source_document_id: string; source_revision: number; source_fingerprint: string; include_cover_letters?: boolean; source_package_fingerprint?: string | null };
export type CreateCoverLetter = MutationIntent & { template_slug: string; expected_revision: number; expected_application_revision: number;
  workflow_revision: string; name: string; content: { recipient?: string; company?: string; position?: string; date?: string | null;
    salutation?: string; body_paragraphs: string[]; closing?: string; signoff?: string }; source_refs: CareerSource[] };
export type PrepareApplicationPackage = MutationIntent & { application_id: string; expected_revision: number; workflow_revision: string;
  fingerprint: string; documents: { document_id: string; revision: number }[] };
export type PreparedDocument = { version_id: string; name: string; type: 'resume' | 'cover_letter'; source_document_id: string;
  source_revision: number; sha256: string; size_bytes: number; website_url: string };
export type PreparedPackage = { id: string; application_id: string; status: 'pending' | 'running' | 'ready' | 'failed';
  source_fingerprint: string; sources_changed: boolean; documents: PreparedDocument[]; direct_host_download_supported?: false };
export type PackageListRead = { application_id: string; before_id?: string | null };
export type PackageList = { application_id: string; items: PreparedPackage[]; has_more: boolean };
export type PreparedDownloadRead = { package_id: string; version_id: string };
export type PreparedDownload = PreparedDownloadRead & { url: string; method: 'GET'; expires_at: string; media_type: 'application/pdf';
  sha256: string; size_bytes: number; reusable_until_expiry: true };

const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const string = (v: unknown, max: number, min = 0) => text(v, max) && (v as string).length >= min;
const array = (v: unknown, max: number, check: (v: unknown) => boolean, min = 0): v is unknown[] =>
  Array.isArray(v) && v.length >= min && v.length <= max && v.every(check);
const bool = (v: unknown) => typeof v === 'boolean';
const documentType = (v: unknown) => v === 'resume' || v === 'cover_letter';

export function resumeChoicesInput(v: unknown): ResumeChoicesRead {
  shape(v, ['app_slug', 'query', 'page']);
  if (!resourceId(v.app_slug) || !(v.query === undefined || text(v.query, 120)) || !(v.page === undefined || integer(v.page, 1, 10000))) fail();
  return v as ResumeChoicesRead;
}
export function selectApplicationDocumentsInput(v: unknown): SelectApplicationDocuments {
  shape(v, [...intentKeys, 'app_slug', 'revision', 'expected_revision', 'package_id']); intent(v);
  if (!resourceId(v.app_slug) || !resourceId(v.package_id) || !hash(v.revision) || !integer(v.expected_revision)) fail();
  return v as SelectApplicationDocuments;
}
export function customizeApplicationDocumentsInput(v: unknown): CustomizeApplicationDocuments {
  shape(v, [...intentKeys, 'app_slug', 'revision', 'expected_revision', 'source_document_id', 'source_revision',
    'source_fingerprint', 'include_cover_letters', 'source_package_fingerprint']); intent(v);
  if (!resourceId(v.app_slug) || !hash(v.revision) || !integer(v.expected_revision) || !resourceId(v.source_document_id) ||
      !integer(v.source_revision) || !hash(v.source_fingerprint) || !(v.include_cover_letters === undefined || bool(v.include_cover_letters)) ||
      !optional(v.source_package_fingerprint, hash) || (v.include_cover_letters && !hash(v.source_package_fingerprint))) fail();
  return v as CustomizeApplicationDocuments;
}
export function createCoverLetterInput(v: unknown): CreateCoverLetter {
  shape(v, [...intentKeys, 'template_slug', 'expected_revision', 'expected_application_revision', 'workflow_revision', 'name', 'content', 'source_refs']); intent(v);
  if (!resourceId(v.template_slug) || !integer(v.expected_revision) || !integer(v.expected_application_revision) ||
      !hash(v.workflow_revision) || !string(v.name, 255, 1) || !array(v.source_refs, 20, source, 1)) fail();
  for (const ref of v.source_refs) shape(ref, ['kind', 'record_id', 'field', 'note']);
  shape(v.content, ['recipient', 'company', 'position', 'date', 'salutation', 'body_paragraphs', 'closing', 'signoff']);
  if (!array(v.content.body_paragraphs, 30, item => string(item, 10000, 1), 1) || !optional(v.content.date, calendarDate)) fail();
  for (const key of ['recipient', 'company', 'position', 'salutation', 'signoff', 'closing'])
    if (v.content[key] !== undefined && !text(v.content[key], key === 'closing' ? 2000 : 255)) fail();
  return v as CreateCoverLetter;
}
export function prepareApplicationPackageInput(v: unknown): PrepareApplicationPackage {
  shape(v, [...intentKeys, 'application_id', 'expected_revision', 'workflow_revision', 'fingerprint', 'documents']); intent(v);
  if (!resourceId(v.application_id) || !integer(v.expected_revision) || !hash(v.workflow_revision) || !hash(v.fingerprint) ||
      !array(v.documents, 5, item => record(item) && resourceId(item.document_id) && integer(item.revision), 1)) fail();
  for (const item of v.documents) shape(item, ['document_id', 'revision']);
  if (new Set(v.documents.map(item => (item as { document_id: string }).document_id)).size !== v.documents.length) fail();
  return v as PrepareApplicationPackage;
}
export function packageListInput(v: unknown): PackageListRead {
  shape(v, ['application_id', 'before_id']);
  if (!resourceId(v.application_id) || !optional(v.before_id, resourceId)) fail(); return v as PackageListRead;
}
export function preparedDownloadInput(v: unknown): PreparedDownloadRead {
  shape(v, ['package_id', 'version_id']);
  if (!resourceId(v.package_id) || !resourceId(v.version_id)) fail(); return v as PreparedDownloadRead;
}
function workflowDocument(v: unknown): v is WorkflowDocument {
  return record(v) && resourceId(v.id) && resourceId(v.slug) && string(v.name, 255, 1) && integer(v.revision) && documentType(v.type) &&
    hash(v.fingerprint) && text(v.website_url, 2048) && optional(v.master_id, resourceId) && ['master', 'role_draft'].includes(String(v.relation));
}
function workflow(v: unknown): v is ApplicationDocuments {
  return record(v) && resourceId(v.application_id) && resourceId(v.app_slug) && hash(v.revision) && hash(v.fingerprint) &&
    (v.selected_id === null || resourceId(v.selected_id)) && array(v.documents, 5, workflowDocument) && array(v.choices, 50, workflowDocument) &&
    (v.choices_have_more === undefined || bool(v.choices_have_more)) && (v.changes_have_more === undefined || bool(v.changes_have_more)) &&
    array(v.unresolved, 50, item => typeof item === 'string') && array(v.changes, 200, item => record(item) && resourceId(item.document_id) &&
      string(item.field, 160, 1) && (item.before === null || text(item.before, 10000)) && (item.after === null || text(item.after, 10000)) &&
      ['draft', 'uncertain', 'confirmed', 'declined'].includes(String(item.state)) && array(item.sources, 20, source));
}
function preparedDocument(v: unknown): v is PreparedDocument {
  return record(v) && resourceId(v.version_id) && string(v.name, 255, 1) && documentType(v.type) && resourceId(v.source_document_id) &&
    integer(v.source_revision) && hash(v.sha256) && integer(v.size_bytes, 5, 25000000) && text(v.website_url, 2048);
}
export function isPreparedPackage(v: unknown): v is PreparedPackage {
  return record(v) && resourceId(v.id) && resourceId(v.application_id) && ['pending', 'running', 'ready', 'failed'].includes(String(v.status)) &&
    hash(v.source_fingerprint) && bool(v.sources_changed) && array(v.documents, 5, preparedDocument) &&
    (v.direct_host_download_supported === undefined || v.direct_host_download_supported === false);
}
function download(v: unknown): v is PreparedDownload {
  return record(v) && resourceId(v.package_id) && resourceId(v.version_id) && string(v.url, 8192, 1) && v.method === 'GET' &&
    deadline(v.expires_at) && v.media_type === 'application/pdf' && hash(v.sha256) && integer(v.size_bytes, 5, 25000000) && v.reusable_until_expiry === true;
}
export const applicationDocumentsResult = (v: unknown) => journeyResult(v, workflow);
export const resumeChoicesResult = (v: unknown) => journeyResult(v, (v): v is ResumeChoices => record(v) && resourceId(v.application_id) &&
  array(v.choices, 50, workflowDocument) && integer(v.page, 1, 10000) && integer(v.total, 0) && bool(v.has_more));
export const preparedPackageResult = (v: unknown) => journeyResult(v, isPreparedPackage);
export const packageListResult = (v: unknown) => journeyResult(v, (v): v is PackageList => record(v) && resourceId(v.application_id) &&
  array(v.items, 20, isPreparedPackage) && bool(v.has_more));
export const preparedDownloadResult = (v: unknown) => journeyResult(v, download);
