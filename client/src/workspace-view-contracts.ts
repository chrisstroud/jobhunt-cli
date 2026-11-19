/** Read-only workspace composition. A selection never grants record permissions. */
import { record } from './protocol.ts';
import { deadline, fail, integer, journeyResult, optional, resourceId, shape, text, uuid } from './journey-contracts.ts';
import { huntContextResult, type HuntContext } from './hunt-settings-contracts.ts';
import { savedJob, type SavedJob } from './job-pipeline-contracts.ts';
import { careerDocument, type CareerDocument } from './document-contracts.ts';
import { applicationDocumentsResult, packageListResult, type ApplicationDocuments, type PackageList } from './package-contracts.ts';
import { screeningResult, type ScreeningAnswers } from './screening-contracts.ts';
import { submissionHistoryResult, submissionOptionsResult, type SubmissionHistory, type SubmissionOptions } from './submission-contracts.ts';
import { applicationWorkspaceResult, type ApplicationWorkspace } from './application-record-contracts.ts';
import type { RecordReferenceSelection } from './reference-contracts.ts';

export type WorkspaceViewRead = { search_id?: string | null; application_id?: string | null; document_id?: string | null;
  section?: string | null; page?: number; hunts_page?: number; documents_page?: number; status?: string | null;
  query?: string; include_application_records?: boolean };
export type WorkspaceNavigation = {
  hunts: { id: string; name: string; status: string }[]; hunts_page: number; hunts_have_more: boolean;
  stages: { id: string; name: string; type: string; is_terminal: boolean; count: number }[];
  documents: { id: string; slug: string; name: string; type: string; archetype: string; is_primary: boolean;
    package_anchor_id: string | null; revision: number; application_id: string | null }[];
  documents_page: number; documents_have_more: boolean; documents_total: number;
};
export type WorkspaceTaskSummary = { id: string; title: string; due_at: string | null; revision: number };
export type WorkspaceTaskSummaries = { available: boolean; items: WorkspaceTaskSummary[]; has_more?: boolean;
  reason?: 'insufficient_scope' | null };
export type WorkspaceApplicationDetail = { application: SavedJob; documents: ApplicationDocuments; answers: ScreeningAnswers;
  packages: PackageList; submissions: SubmissionHistory; submission_options: SubmissionOptions; tasks: WorkspaceTaskSummaries;
  workspace?: ApplicationWorkspace | null; document?: CareerDocument | null };
export type WorkspaceView = { context: HuntContext; selection: RecordReferenceSelection;
  applications: { items: SavedJob[]; page: number; total: number; has_more: boolean }; navigation: WorkspaceNavigation;
  detail?: WorkspaceApplicationDetail | null; document?: CareerDocument | null; website_url: string };

const array = (v: unknown, max: number, check: (v: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.length <= max && v.every(check);
const boolean = (v: unknown) => typeof v === 'boolean';
const string = (v: unknown) => typeof v === 'string';
function parsed<T>(parser: (v: unknown) => { data: T | null }, value: unknown): value is T {
  try { return parser({ outcome: 'ready', data: value, next_action: { kind: 'none', label: '' } }).data != null; }
  catch { return false; }
}
export function workspaceViewInput(v: unknown): WorkspaceViewRead {
  shape(v, ['search_id', 'application_id', 'document_id', 'section', 'page', 'hunts_page', 'documents_page', 'status', 'query', 'include_application_records']);
  if (!['search_id', 'application_id', 'document_id'].every(key => optional(v[key], uuid)) ||
      !optional(v.section, x => typeof x === 'string' && /^[a-z_]{1,40}$/u.test(x) && x.trim() === x) || (v.section != null && !v.document_id) ||
      !['page', 'hunts_page', 'documents_page'].every(key => v[key] === undefined || integer(v[key], 1, 10000)) ||
      !optional(v.status, x => text(x, 100) && !!x) || (v.query !== undefined && !text(v.query, 120)) ||
      (v.include_application_records !== undefined && !boolean(v.include_application_records))) fail();
  return { ...v, ...Object.fromEntries(['search_id', 'application_id', 'document_id'].filter(key => typeof v[key] === 'string').map(key => [key, (v[key] as string).toLowerCase()])) } as WorkspaceViewRead;
}
function navigation(v: unknown): v is WorkspaceNavigation {
  return record(v) && array(v.hunts, 25, x => record(x) && uuid(x.id) && string(x.name) && string(x.status)) &&
    integer(v.hunts_page, 1, 10000) && boolean(v.hunts_have_more) &&
    array(v.stages, 100, x => record(x) && resourceId(x.id) && string(x.name) && string(x.type) && boolean(x.is_terminal) && integer(x.count, 0)) &&
    array(v.documents, 20, x => record(x) && uuid(x.id) && resourceId(x.slug) && string(x.name) && string(x.type) && string(x.archetype) &&
      boolean(x.is_primary) && optional(x.package_anchor_id, uuid) && integer(x.revision) && optional(x.application_id, uuid)) &&
    integer(v.documents_page, 1, 10000) && boolean(v.documents_have_more) && integer(v.documents_total, 0);
}
function tasks(v: unknown): v is WorkspaceTaskSummaries {
  if (!record(v) || !boolean(v.available) || !array(v.items, 5, x => record(x) && uuid(x.id) && text(x.title, 255) &&
      optional(x.due_at, deadline) && integer(x.revision)) || !optional(v.has_more, boolean)) return false;
  return v.available ? v.reason == null : v.items.length === 0 && !v.has_more && v.reason === 'insufficient_scope';
}
function detail(v: unknown): v is WorkspaceApplicationDetail {
  if (!record(v) || !savedJob(v.application) || !parsed(applicationDocumentsResult, v.documents) || !parsed(screeningResult, v.answers) ||
      !parsed(packageListResult, v.packages) || !parsed(submissionHistoryResult, v.submissions) || !parsed(submissionOptionsResult, v.submission_options) ||
      !tasks(v.tasks) || !optional(v.workspace, x => parsed(applicationWorkspaceResult, x)) || !optional(v.document, careerDocument)) return false;
  const id = v.application.id;
  const selectedDocument = v.document as CareerDocument | null | undefined;
  return [v.documents, v.answers, v.packages, v.submissions, v.submission_options].every(x => x.application_id === id) &&
    v.documents.app_slug.length > 0 && v.answers.revision === v.application.revision &&
    (v.workspace == null || (record(v.workspace) && v.workspace.application_id === id && v.workspace.revision === v.application.revision)) &&
    (!selectedDocument || ((selectedDocument.application_id == null || selectedDocument.application_id === id) && v.documents.documents.some(x => x.id === selectedDocument.id)));
}
function view(v: unknown): v is WorkspaceView {
  if (!record(v) || !record(v.selection)) return false;
  const selected = v.selection;
  if (!parsed(huntContextResult, v.context) || selected.version !== 1 ||
      !['search_id', 'application_id', 'document_id'].every(key => optional(selected[key], uuid)) ||
      !['application_revision', 'document_revision'].every(key => optional(selected[key], integer)) ||
      !optional(selected.section, string) || !record(v.applications) || !array(v.applications.items, 20, savedJob) ||
      !integer(v.applications.page, 1, 10000) || !integer(v.applications.total, 0) || !boolean(v.applications.has_more) ||
      !navigation(v.navigation) || !optional(v.detail, detail) || !optional(v.document, careerDocument) ||
      !text(v.website_url, 2048)) return false;
  try {
    const url = new URL(v.website_url as string);
    if (url.origin !== 'https://jobhunt.app' || !/^\/app(?:\/|$)/u.test(url.pathname) || url.username || url.password) return false;
  } catch { return false; }
  if ((selected.application_id != null) !== (selected.application_revision != null) ||
      (selected.document_id != null) !== (selected.document_revision != null)) return false;
  const application = v.detail ? (v.detail as WorkspaceApplicationDetail).application : null;
  const document = v.document || (v.detail as WorkspaceApplicationDetail | null)?.document;
  if (selected.application_id !== (application?.id ?? undefined) && !(selected.application_id == null && !application)) return false;
  if (application && (selected.application_revision !== application.revision || (selected.search_id ?? null) !== (application.search_id ?? null))) return false;
  if ((selected.document_id ?? null) !== (document ? (document as CareerDocument).id : null) ||
      (document && selected.document_revision !== (document as CareerDocument).revision) ||
      (selected.section != null && (!document || !(document as CareerDocument).sections.some(x => x.name === selected.section)))) return false;
  if (v.document && (application || (v.document as CareerDocument).application_id)) return false;
  const destination = application ? `https://jobhunt.app/app/applications/id/${application.id}?tab=documents` :
    document ? `https://jobhunt.app/app/documents/${encodeURIComponent((document as CareerDocument).slug)}` : 'https://jobhunt.app/app';
  if (v.website_url !== destination) return false;
  const search = v.context.search?.id ?? null;
  return v.applications.items.every(x => ((x as SavedJob).search_id ?? null) === search) &&
    v.applications.has_more === (Number(v.applications.page) * 20 < Number(v.applications.total)) &&
    v.applications.items.length === Math.min(20, Math.max(0, Number(v.applications.total) - (Number(v.applications.page) - 1) * 20)) &&
    v.navigation.documents_have_more === (v.navigation.documents_page * 20 < v.navigation.documents_total) &&
    v.navigation.documents.length === Math.min(20, Math.max(0, v.navigation.documents_total - (v.navigation.documents_page - 1) * 20)) &&
    new Set(v.applications.items.map(x => (x as SavedJob).id)).size === v.applications.items.length &&
    (!v.detail || !(v.detail as WorkspaceApplicationDetail).workspace ||
      (v.detail as WorkspaceApplicationDetail).workspace?.account_id === v.context.account.id);
}
export function workspaceViewResult(value: unknown, input: WorkspaceViewRead) {
  const result = journeyResult(value, view);
  if (result.data) {
    const data = result.data;
    if (data.applications.page !== (input.page ?? 1) || data.navigation.hunts_page !== (input.hunts_page ?? 1) ||
        data.navigation.documents_page !== (input.documents_page ?? 1) ||
        (input.search_id && data.context.search?.id !== input.search_id) ||
        (input.application_id && data.selection.application_id !== input.application_id) ||
        (input.document_id && data.selection.document_id !== input.document_id) ||
        (data.selection.section ?? null) !== (input.section ?? null) ||
        (input.status && data.applications.items.some(x => x.stage !== input.status)) ||
        (!input.include_application_records && data.detail?.workspace != null) ||
        (input.include_application_records && data.detail && !input.document_id && data.detail.workspace == null) ||
        (input.document_id && data.detail?.workspace != null) || result.website_url !== data.website_url) fail(true);
  }
  return result;
}
