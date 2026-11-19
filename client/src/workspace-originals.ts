/** Explicit native-original recovery, separate from ordinary public record writes. */
import type { JobHuntClient } from './index.ts';
import { JobHuntError, record, type JsonObject } from './protocol.ts';
import { integer, journeyResult, shape, uuid, type JourneyResult } from './journey-contracts.ts';
import { digest } from './highlight-file-contracts.ts';
import { resumeHostFileInput, type HostResumeFile } from './import-file-contracts.ts';
export const MAX_WORKSPACE_ORIGINAL_BYTES = 16 * 1024 * 1024;
export type WorkspaceOriginalKind = 'task' | 'interview' | 'search' | 'company' | 'contact';

export type WorkspaceOriginalPointer = { expected_account_id: string; kind: WorkspaceOriginalKind; request_id: string; expected_payload_hash: string };
export type WorkspaceOriginalDirectory = { expected_account_id: string; page?: number; per_page?: number; kind: WorkspaceOriginalKind };
export type WorkspaceOriginalDescriptor = { account_id: string; application_id: string | null; operation_name: string; request_id: string; kind: WorkspaceOriginalKind;
  payload_hash: string; status: 'open' | 'expired' | 'confirmed' | 'discarded'; expires_at: string };
export type WorkspaceOriginalManifest = WorkspaceOriginalDescriptor & { format: 'jobhunt.workspace-original/v1'; filename: string; mime: 'application/json'; size_bytes: number; sha256: string; chunk_bytes: 24000; chunk_count: number };
export type WorkspaceOriginalChunkRead = WorkspaceOriginalPointer & { expected_sha256: string; chunk_index: number };
export type WorkspaceOriginalChunk = WorkspaceOriginalManifest & { chunk_index: number; content_base64: string; chunk_sha256: string };
export type WorkspaceOriginalCheck = { original: WorkspaceOriginalDescriptor; save_state: 'confirmed' | 'not_recorded' | 'receipt_expired'; record_id?: string | null; revision?: number | null };
export type WorkspaceOriginalReviewInput = WorkspaceOriginalPointer & { page?: number };
export type WorkspaceOriginalReview = { original: WorkspaceOriginalDescriptor; title: string; review_token: string; calendar_handoff_count: number;
  calendar_effects: { connection_id: string; provider: string; calendar_id: string; action: 'sync' | 'status' | 'remove' }[]; page: number; has_more: boolean };
export type WorkspaceOriginalRetry = WorkspaceOriginalPointer & { review_token: string; confirm_calendar_handoff_count: number };
export type WorkspaceOriginalResolution = WorkspaceOriginalPointer & { disposition: 'confirmed' | 'discarded' };
export type WorkspaceOriginalPage = { account_id: string; kind: WorkspaceOriginalKind; items: WorkspaceOriginalDescriptor[]; page: number; per_page: number; pages: number; total: number };
export type WorkspaceOriginalFileIntent = { expected_account_id: string; kind: WorkspaceOriginalKind; request_id: string; application_id?: string | null };
export type WorkspaceOriginalHostFile = WorkspaceOriginalFileIntent & { source_size: number; source_sha256: string; file: HostResumeFile };
const kinds = ['task','interview','search','company','contact'];
const fileKeys = ['expected_account_id','kind','request_id','application_id'];
export function workspaceOriginalFileIntent(v: unknown): WorkspaceOriginalFileIntent {
  shape(v, fileKeys);
  if (!account(v.expected_account_id) || !uuid(v.request_id) || !kinds.includes(String(v.kind)) ||
      (['task','interview'].includes(String(v.kind)) ? !uuid(v.application_id) : v.application_id != null)) fail();
  return { ...v, request_id: String(v.request_id).toLowerCase(), ...(v.application_id ? {application_id:String(v.application_id).toLowerCase()} : {}) } as WorkspaceOriginalFileIntent;
}
export function workspaceOriginalHostFile(v: unknown): WorkspaceOriginalHostFile {
  shape(v, [...fileKeys,'source_size','source_sha256','file']);
  const args = workspaceOriginalFileIntent(Object.fromEntries(fileKeys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]])));
  resumeHostFileInput({request_id:v.request_id,expected_account_id:v.expected_account_id,file:v.file});
  if (!integer(v.source_size,1,MAX_WORKSPACE_ORIGINAL_BYTES) || !hash(v.source_sha256)) fail();
  return {...v,...args} as WorkspaceOriginalHostFile;
}
const pointerKeys = ['expected_account_id', 'kind', 'request_id', 'expected_payload_hash'];
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const account = (v: unknown): v is string => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const fail = (): never => { throw new JobHuntError('invalid_input'); };
const invalid = (): never => { throw new JobHuntError('invalid_response'); };
export function workspaceOriginalPointer(v: unknown): WorkspaceOriginalPointer {
  shape(v, pointerKeys);
  if (!account(v.expected_account_id) || !kinds.includes(String(v.kind)) || !uuid(v.request_id) || !hash(v.expected_payload_hash)) fail();
  return { ...v, request_id: String(v.request_id).toLowerCase() } as WorkspaceOriginalPointer;
}
export function workspaceOriginalDirectory(v: unknown): WorkspaceOriginalDirectory {
  shape(v, ['expected_account_id', 'page', 'per_page', 'kind']);
  if (!account(v.expected_account_id) || v.page !== undefined && !integer(v.page, 1, 10000) || v.per_page !== undefined && !integer(v.per_page, 1, 50)) fail();
  if (!kinds.includes(String(v.kind))) fail();
  return v as WorkspaceOriginalDirectory;
}
function extended(v: unknown, extra: string[]): WorkspaceOriginalPointer & Record<string, unknown> {
  shape(v, [...pointerKeys, ...extra]);
  return { ...v, ...workspaceOriginalPointer(Object.fromEntries(pointerKeys.map(k => [k, v[k]]))) };
}
export function workspaceOriginalReviewInput(v: unknown): WorkspaceOriginalReviewInput {
  const args = extended(v, ['page']);
  if (args.page !== undefined && !integer(args.page, 1, 10000)) fail();
  return args as WorkspaceOriginalReviewInput;
}
export function workspaceOriginalRetry(v: unknown): WorkspaceOriginalRetry {
  const args = extended(v, ['review_token', 'confirm_calendar_handoff_count']);
  if (typeof args.review_token !== 'string' || !args.review_token.length || args.review_token.length > 4096 || !integer(args.confirm_calendar_handoff_count, 0)) fail();
  return args as WorkspaceOriginalRetry;
}
export function workspaceOriginalResolution(v: unknown): WorkspaceOriginalResolution {
  const args = extended(v, ['disposition']);
  if (!['confirmed', 'discarded'].includes(String(args.disposition))) fail();
  return args as WorkspaceOriginalResolution;
}
const operations: Record<WorkspaceOriginalKind, string> = { task:'native_create_task_v1', interview:'native_create_interview_v1', search:'create_job_search_v2', company:'save_workspace_company_v2', contact:'save_workspace_contact_v2' };
export const descriptor = (v: unknown): v is WorkspaceOriginalDescriptor & JsonObject => record(v) && account(v.account_id) && uuid(v.request_id) && hash(v.payload_hash) &&
  kinds.includes(String(v.kind)) && v.operation_name === operations[v.kind as WorkspaceOriginalKind] &&
  (['task','interview'].includes(String(v.kind)) ? uuid(v.application_id) : v.application_id === null) &&
  ['open', 'expired', 'confirmed', 'discarded'].includes(String(v.status)) && typeof v.expires_at === 'string' && Number.isFinite(Date.parse(v.expires_at));
export const manifest = (v: unknown): v is WorkspaceOriginalManifest & JsonObject => descriptor(v) && record(v) && v.status === 'open' && v.format === 'jobhunt.workspace-original/v1' && v.mime === 'application/json' &&
  v.filename === 'workspace-original-' + v.request_id + '.json' && integer(v.size_bytes, 1, MAX_WORKSPACE_ORIGINAL_BYTES + 65536) && hash(v.sha256) && v.chunk_bytes === 24000 &&
  integer(v.chunk_count) && v.chunk_count === Math.ceil(Number(v.size_bytes) / 24000);
const matches = (v: WorkspaceOriginalDescriptor, args: WorkspaceOriginalPointer) => v.account_id === args.expected_account_id && v.kind === args.kind && v.request_id === args.request_id && v.payload_hash === args.expected_payload_hash;
const check = (v: unknown): v is WorkspaceOriginalCheck => record(v) && descriptor(v.original) && ['confirmed', 'not_recorded', 'receipt_expired'].includes(String(v.save_state)) &&
  (v.save_state === 'confirmed' ? typeof v.record_id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u.test(v.record_id) && (v.revision == null || integer(v.revision)) : v.record_id == null && v.revision == null);
const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable) : record(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const equal = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

export class WorkspaceOriginalClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  private async get<T>(name: string, input: object, parse: (v: unknown) => v is T): Promise<JourneyResult<T>> {
    return journeyResult(await this.client.request('/api/v1/journey/' + name + '?' + new URLSearchParams({ arguments: JSON.stringify(input) })), parse);
  }
  private async post<T>(name: string, input: object, parse: (v: unknown) => v is T): Promise<JourneyResult<T>> {
    return journeyResult(await this.client.request('/api/v1/journey/' + name, { method: 'POST', body: input as JsonObject }), parse);
  }
  async list(input: WorkspaceOriginalDirectory) {
    const args = workspaceOriginalDirectory(input);
    return this.get('list_workspace_originals', args, (v): v is WorkspaceOriginalPage => record(v) && v.account_id === args.expected_account_id && v.kind === args.kind && v.page === (args.page ?? 1) && v.per_page === (args.per_page ?? 20) &&
      integer(v.total, 0) && integer(v.pages) && v.pages === Math.max(1, Math.ceil(Number(v.total) / Number(v.per_page))) && Number(v.page) <= Number(v.pages) &&
      Array.isArray(v.items) && v.items.length === Math.min(Number(v.per_page), Math.max(0, Number(v.total) - (Number(v.page) - 1) * Number(v.per_page))) &&
      v.items.every(item => descriptor(item) && item.account_id === args.expected_account_id && (!args.kind || item.kind === args.kind) && ['open', 'expired'].includes(item.status)) && new Set(v.items.map(item => item.request_id)).size === v.items.length);
  }
  async check(input: WorkspaceOriginalPointer) {
    const args = workspaceOriginalPointer(input);
    return this.get('check_workspace_original', args, (v): v is WorkspaceOriginalCheck => check(v) && matches(v.original, args));
  }
  async manifest(input: WorkspaceOriginalPointer) {
    const args = workspaceOriginalPointer(input);
    return this.get('get_workspace_original_file', args, (v): v is WorkspaceOriginalManifest => manifest(v) && matches(v, args));
  }
  async chunk(input: WorkspaceOriginalChunkRead) {
    const value = extended(input, ['expected_sha256', 'chunk_index']);
    if (!hash(value.expected_sha256) || !integer(value.chunk_index)) fail();
    const args = value as WorkspaceOriginalChunkRead;
    return this.get('read_workspace_original_chunk', args, (v): v is WorkspaceOriginalChunk => manifest(v) && record(v) && matches(v, args) && v.sha256 === args.expected_sha256 &&
      v.chunk_index === args.chunk_index && Number(v.chunk_index) <= v.chunk_count && hash(v.chunk_sha256) && typeof v.content_base64 === 'string' && v.content_base64.length <= 32000 && /^[A-Za-z0-9+/]+={0,2}$/u.test(v.content_base64));
  }
  async download(input: WorkspaceOriginalPointer) {
    const args = workspaceOriginalPointer(input), first = await this.manifest(args);
    if (first.outcome !== 'ready' || !first.data) throw new JobHuntError('download_unavailable');
    const metadata = first.data, bytes = new Uint8Array(metadata.size_bytes);
    let offset = 0;
    for (let index = 1; index <= metadata.chunk_count; index++) {
      const result = await this.chunk({ ...args, expected_sha256: metadata.sha256, chunk_index: index });
      if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
      const { chunk_index: _index, content_base64, chunk_sha256, ...view } = result.data;
      if (!equal(view, metadata)) invalid();
      let decoded: string; try { decoded = atob(content_base64); } catch { return invalid(); }
      const part = Uint8Array.from(decoded!, c => c.charCodeAt(0));
      if (btoa(decoded!) !== content_base64 || part.length !== Math.min(24000, bytes.length - offset) || await digest(part) !== chunk_sha256) invalid();
      bytes.set(part, offset); offset += part.length;
    }
    if (offset !== bytes.length || await digest(bytes) !== metadata.sha256) throw new JobHuntError('download_checksum_mismatch');
    let raw: unknown; try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return invalid(); }
    if (!record(raw) || raw.format !== metadata.format || !descriptor(raw) || !matches(raw, args) || !record(raw.command) || raw.command.kind !== args.kind || !record(raw.command.arguments) ||
      raw.command.arguments.request_id !== args.request_id || raw.command.arguments.expected_account_id !== args.expected_account_id ||
      (raw.command.arguments.application_id ?? null) !== metadata.application_id ||
      await digest(new TextEncoder().encode(JSON.stringify(stable(raw.command.arguments)))) !== args.expected_payload_hash) invalid();
    const after = await this.manifest(args);
    if (!after.data || !equal(after.data, metadata)) throw new JobHuntError('download_source_changed');
    return { ...metadata, bytes, media_type: metadata.mime };
  }
  async stageFile(input: WorkspaceOriginalFileIntent, bytes: Uint8Array) {
    const args = workspaceOriginalFileIntent(input);
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_WORKSPACE_ORIGINAL_BYTES) fail();
    const form = new FormData(); form.set('intent', JSON.stringify(args));
    form.set('original', new Blob([new Uint8Array(bytes)], { type: 'application/json' }), 'workspace-original-fields.json');
    return journeyResult(await this.client.request('/api/v1/journey/workspace-original-upload', { method: 'POST', body: form }),
      (v): v is WorkspaceOriginalDescriptor => descriptor(v) && v.account_id === args.expected_account_id && v.application_id === (args.application_id ?? null) && v.request_id === args.request_id && v.kind === args.kind && v.status === 'open');
  }
  async stageHostFile(input: WorkspaceOriginalHostFile) {
    const args = workspaceOriginalHostFile(input);
    return this.post('stage_workspace_original_file', args, (v): v is WorkspaceOriginalDescriptor => descriptor(v) && v.account_id === args.expected_account_id && v.application_id === (args.application_id ?? null) && v.request_id === args.request_id && v.kind === args.kind && v.status === 'open');
  }
  async review(input: WorkspaceOriginalReviewInput) {
    const args = workspaceOriginalReviewInput(input);
    return this.get('review_workspace_original', args, (v): v is WorkspaceOriginalReview => record(v) && descriptor(v.original) && matches(v.original, args) && v.original.status === 'open' &&
      typeof v.title === 'string' && [...v.title].length <= 255 && typeof v.review_token === 'string' && v.review_token.length > 0 && v.review_token.length <= 4096 && integer(v.calendar_handoff_count, 0) &&
      v.page === (args.page ?? 1) && v.has_more === (Number(v.page) * 25 < Number(v.calendar_handoff_count)) && Array.isArray(v.calendar_effects) &&
      v.calendar_effects.length === Math.min(25, Math.max(0, Number(v.calendar_handoff_count) - (Number(v.page) - 1) * 25)) &&
      v.calendar_effects.every(e => record(e) && uuid(e.connection_id) && typeof e.provider === 'string' && typeof e.calendar_id === 'string' && ['sync', 'status', 'remove'].includes(String(e.action))) && new Set(v.calendar_effects.map(e => e.connection_id)).size === v.calendar_effects.length);
  }
  async retry(input: WorkspaceOriginalRetry) {
    const args = workspaceOriginalRetry(input);
    return this.post('retry_workspace_original', args, (v): v is WorkspaceOriginalCheck => check(v) && matches(v.original, args) && v.save_state === 'confirmed');
  }
  async resolve(input: WorkspaceOriginalResolution) {
    const args = workspaceOriginalResolution(input);
    return this.post('resolve_workspace_original', args, (v): v is WorkspaceOriginalDescriptor => descriptor(v) && matches(v, args) && ['confirmed', ...(args.disposition === 'discarded' ? ['discarded'] : [])].includes(v.status));
  }
}
