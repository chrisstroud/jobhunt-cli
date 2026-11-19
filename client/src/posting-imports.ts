import { PostingImportFilesClient } from './posting-import-files.ts';
/** Durable posting originals; browser services own admission, CAS and cancellation. */
import type { JobHuntClient } from './index.ts';
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, journeyResult, optional, shape, text, uuid } from './journey-contracts.ts';

export type ImportAccount = { expected_account_id?: string | null };
export type PostingInputKind = 'url' | 'pasted_text' | 'browser_selection';
export type PostingImportList = ImportAccount & { before?: string | null; limit?: number };
export type PostingImportRead = ImportAccount & { attempt_id: string };
export type PostingImportStart = ImportAccount & { request_key: string; input_kind?: PostingInputKind;
  url?: string | null; text?: string | null; input_fingerprint?: string | null; recovery_scope?: string | null;
  open_application?: boolean; job_search?: string | null; status?: string | null;
  update_application?: { application_id: string; expected_version: number } | null };
export type PostingImportDraft = PostingImportRead & { expected_revision: number; draft: Record<string, string> };
export type PostingImportOpen = PostingImportRead & { job_search: string; status: string; recovery_scope: string };
export type PostingImportReconcile = ImportAccount & { request_key: string; input_kind: 'pasted_text' | 'browser_selection';
  input_fingerprint: string; recovery_scope: string };
export type PostingImportCancel = ImportAccount & { request_key: string; recovery_scope: string; input_kind?: PostingInputKind;
  input_fingerprint?: string | null; url?: string | null; text?: string | null };
export type PostingImportAttempt = { id: string; input_kind: PostingInputKind; state: string; created_at: string; updated_at: string;
  original_url?: string | null; capture_result?: JsonObject | null; application_id?: string | null;
  application_slug?: string | null; application_import_state?: string | null; application_update?: boolean;
  application_update_id?: string | null; application_created_at?: string | null; error_code?: string | null;
  recovery_code?: string | null; review_draft?: JsonObject | null; review_revision?: number | null };
export type PostingImportData = { attempt?: PostingImportAttempt | null; attempts?: PostingImportAttempt[] | null;
  next_cursor?: string | null; recovery_scope?: string | null; review_draft?: JsonObject | null;
  review_revision?: number | null; acceptance?: 'recorded' | 'unknown' | null };
const pythonWhitespace = /^[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu;
const accountKeys = ['expected_account_id'];
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const key = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9._-]{1,96}$/u.test(v);
const kind = (v: unknown) => ['url', 'pasted_text', 'browser_selection'].includes(String(v));
const string = (v: unknown, max: number) => text(v, max) && new TextDecoder("utf-8", { ignoreBOM: true }).decode(new TextEncoder().encode(v as string)) === v;
function bound(v: unknown, keys: string[]): asserts v is JsonObject {
  shape(v, [...accountKeys, ...keys]);
  if (!optional(v.expected_account_id, x => typeof x === 'string' && x.startsWith('jh_') && uuid(x.slice(3)))) fail();
}
export function postingImportInput(action: string, value: unknown): JsonObject {
  if (action === 'list') {
    bound(value, ['before', 'limit']);
    if (!optional(value.before, uuid) || (value.limit !== undefined && !integer(value.limit, 1, 50))) fail();
  } else if (action === 'get' || action === 'cancel' || action === 'stop') {
    bound(value, ['attempt_id']); if (!uuid(value.attempt_id)) fail();
  } else if (action === 'draft') {
    bound(value, ['attempt_id', 'expected_revision', 'draft']);
    const limits: Record<string, number> = { company: 160, title: 160, location: 600, employment_type: 160,
      compensation: 600, description: 100000, source: 160, job_search: 160, status: 80 };
    if (!uuid(value.attempt_id) || !integer(value.expected_revision, 0, 2147483646) || !record(value.draft) ||
        !Object.keys(value.draft).length || Object.keys(value.draft).some(k => !Object.hasOwn(limits, k) || !string((value.draft as JsonObject)[k], limits[k]!))) fail();
  } else if (action === 'open') {
    bound(value, ['attempt_id', 'job_search', 'status', 'recovery_scope']);
    if (!uuid(value.attempt_id) || !string(value.job_search, 255) || !(value.job_search as string).trim() ||
        !string(value.status, 100) || !(value.status as string).trim() || !hash(value.recovery_scope)) fail();
  } else if (action === 'reconcile') {
    bound(value, ['request_key', 'input_kind', 'input_fingerprint', 'recovery_scope']);
    if (!key(value.request_key) || !['pasted_text', 'browser_selection'].includes(String(value.input_kind)) ||
        !hash(value.input_fingerprint) || !hash(value.recovery_scope)) fail();
  } else if (action === 'start' || action === 'cancel-request') {
    bound(value, ['request_key', 'input_kind', 'url', 'text', 'input_fingerprint', 'recovery_scope',
      ...(action === 'start' ? ['open_application', 'job_search', 'status', 'update_application'] : [])]);
    if (!key(value.request_key) || (value.input_kind !== undefined && !kind(value.input_kind)) ||
        !optional(value.recovery_scope, hash) || (action === 'cancel-request' && !hash(value.recovery_scope)) || !optional(value.input_fingerprint, hash)) fail();
    const inputKind = value.input_kind ?? 'url';
    const fingerprintOnly = action === 'cancel-request' && value.input_fingerprint != null;
    if (fingerprintOnly) {
      if (inputKind === 'url' || value.url != null || value.text != null) fail();
    } else {
      if (inputKind === 'url' ? value.text != null : !string(value.text, 100000) || [...String(value.text)].length < 50 || !String(value.text).replace(pythonWhitespace, "")) fail();
      if (value.url != null) {
        if (!string(value.url, 4096)) fail();
        let url: URL; try { url = new URL(String(value.url).replace(pythonWhitespace, "")); } catch { return fail(); }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname) fail();
      } else if (inputKind !== 'pasted_text') fail();
    }
    if (action === 'start') {
      if (value.open_application !== undefined && typeof value.open_application !== 'boolean') fail();
      if (value.open_application && (inputKind !== 'url' || !string(value.job_search, 255) || !String(value.job_search).trim() ||
          !string(value.status, 100) || !String(value.status).trim())) fail();
      if (value.update_application != null) {
        shape(value.update_application, ['application_id', 'expected_version']);
        if (inputKind !== 'url' || value.open_application || !uuid(value.update_application.application_id) || !integer(value.update_application.expected_version, 1, 2147483645)) fail();
      }
    }
  } else return fail();
  return value;
}
const attemptKeys = ['id', 'input_kind', 'state', 'created_at', 'updated_at', 'original_url', 'capture_result', 'application_id',
  'application_slug', 'application_import_state', 'application_update', 'application_update_id', 'application_created_at',
  'error_code', 'recovery_code', 'review_draft', 'review_revision'];
function publicDraft(v: unknown) { return record(v) && !Object.hasOwn(v, '_fast_entry') && !Object.hasOwn(v, '_role_update'); }
function attempt(v: unknown): v is PostingImportAttempt {
  return record(v) && Object.keys(v).every(k => attemptKeys.includes(k)) && uuid(v.id) && kind(v.input_kind) &&
    string(v.state, 80) && string(v.created_at, 40) && string(v.updated_at, 40) && optional(v.original_url, x => string(x, 4096)) &&
    optional(v.application_id, uuid) && optional(v.application_update_id, uuid) && optional(v.capture_result, record) &&
    optional(v.review_draft, publicDraft) && optional(v.review_revision, x => integer(x, 0)) &&
    (v.application_update === undefined || typeof v.application_update === 'boolean') &&
    ['application_slug', 'application_import_state', 'application_created_at', 'error_code', 'recovery_code'].every(k => optional(v[k], x => string(x, 4096)));
}
function data(v: unknown): v is PostingImportData {
  return record(v) && Object.keys(v).every(k => ['attempt', 'attempts', 'next_cursor', 'recovery_scope', 'review_draft', 'review_revision', 'acceptance'].includes(k)) &&
    optional(v.attempt, attempt) && optional(v.attempts, x => Array.isArray(x) && x.length <= 50 && x.every(attempt)) &&
    optional(v.next_cursor, uuid) && optional(v.recovery_scope, hash) && optional(v.review_draft, publicDraft) &&
    optional(v.review_revision, x => integer(x, 0)) && optional(v.acceptance, x => x === 'recorded' || x === 'unknown') &&
    (v.acceptance !== 'unknown' || v.attempt == null);
}
const names = { list: 'list_posting_imports_v1', get: 'get_posting_import_v1', start: 'start_posting_import_v1', draft: 'save_posting_import_draft_v1',
  cancel: 'cancel_posting_import_v1', stop: 'stop_posting_import_v1', open: 'open_posting_import_v1', reconcile: 'reconcile_posting_import_request_v1', 'cancel-request': 'cancel_posting_import_request_v1' } as const;
export class PostingImportsClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  readonly files: PostingImportFilesClient;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; this.files = new PostingImportFilesClient(client); }
  private async run(action: keyof typeof names, input: unknown) {
    const args = postingImportInput(action, input), read = action === 'list' || action === 'get';
    const url = '/api/v1/journey/' + names[action];
    const result = journeyResult(await this.client.request(read ? url + '?' + new URLSearchParams({ arguments: JSON.stringify(args) }) : url,
      read ? undefined : { method: 'POST', body: args }), data);
    if (result.data?.attempt && args.attempt_id && result.data.attempt.id.toLowerCase() !== String(args.attempt_id).toLowerCase()) fail(true);
    if (action === 'list' && result.data?.attempts && result.data.attempts.length > Number(args.limit ?? 20)) fail(true);
    const value = result.data;
    if (!value) fail(true);
    if (action === 'list' ? !Array.isArray(value.attempts) || !hash(value.recovery_scope) :
        action === 'draft' ? !record(value.review_draft) || value.review_revision !== Number(args.expected_revision) + 1 :
        action === 'reconcile' && value.acceptance === 'unknown' ? value.attempt != null :
        !value.attempt || value.acceptance !== 'recorded') fail(true);
    if (action === 'stop' && value.attempt?.state !== 'cancelled') fail(true);
    if (action === 'draft') {
      const expected = args.draft as JsonObject, saved = value.review_draft!;
      if (Object.keys(expected).length !== Object.keys(saved).length || Object.keys(expected).some(k => expected[k] !== saved[k])) fail(true);
    }
    if (action === 'start' && value.attempt && value.attempt.input_kind !== (args.input_kind ?? 'url')) fail(true);
    return result;
  }
  list(input: PostingImportList = {}) { return this.run('list', input); }
  get(input: PostingImportRead) { return this.run('get', input); }
  start(input: PostingImportStart) { return this.run('start', input); }
  saveDraft(input: PostingImportDraft) { return this.run('draft', input); }
  cancel(input: PostingImportRead) { return this.run('cancel', input); }
  stop(input: PostingImportRead) { return this.run('stop', input); }
  open(input: PostingImportOpen) { return this.run('open', input); }
  reconcile(input: PostingImportReconcile) { return this.run('reconcile', input); }
  cancelRequest(input: PostingImportCancel) { return this.run('cancel-request', input); }
}

/** Canonical wire identity matches Python ensure_ascii JSON, not a credential. */
export async function postingImportPrivateIdentity(input: PostingImportStart) {
  const args = postingImportInput('start', input), inputKind = args.input_kind;
  if (inputKind !== 'pasted_text' && inputKind !== 'browser_selection') return fail();
  const source = typeof args.url === 'string' ? args.url.replace(pythonWhitespace, '') : null;
  const canonical = JSON.stringify([inputKind, source, args.text]).replace(/[\u007f-\uffff]/g,
    char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)));
  return { input_kind: inputKind, input_fingerprint: Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('') };
}
