/** Owned career journal, reviewed partial edits and private text export. */
import { record, type JsonObject } from './protocol.ts';
import { calendarDate, fail, integer, intent, intentKeys, journeyResult, shape, uuid, type MutationIntent } from './journey-contracts.ts';

export type HighlightFields = { title?: string; date?: string | null; description?: string | null; impact_raw?: string | null;
  impact_refined?: string | null; category?: string | null; role?: string | null; company_id?: string | null; linked_campaign_id?: string | null; tags?: string[] };
export type HighlightRecord = Required<Omit<HighlightFields, 'title' | 'date'>> & { id: string; user_id: string; title: string; date: string;
  company_name: string | null; linked_campaign_name: string | null; created_at: string | null; updated_at: string | null };
export type HighlightRead = { page?: number; per_page?: number; search?: string | null; date_from?: string | null; date_to?: string | null;
  category?: string | null; company_id?: string | null; role?: string | null; tags?: string[] | null; sort?: 'date_desc' | 'date_asc' | 'created_desc' };
export type HighlightPage = { journal: { ok: true; items: HighlightRecord[]; total: number; page: number; per_page: number; pages: number }; fingerprints: Record<string, string> };
export type HighlightSaved = { deleted: boolean; highlight: HighlightRecord | null; fingerprint: string | null };
export type HighlightWrite = MutationIntent & { action: 'create' | 'update' | 'delete'; highlight_id?: string | null; expected_fingerprint?: string | null; fields?: HighlightFields | null };
export type HighlightOptions = { companyOptions: { id: string; name: string }[]; companyState: 'ready'; searchOptions: { id: string; name: string; slug: string }[]; searchState: 'ready'; roles: string[] };
export type HighlightChoicesRead = { company_page?: number; hunt_page?: number; role_page?: number; per_page?: number };
export type HighlightChoicePage<T> = { items: T[]; total: number; page: number; pages: number; per_page: number };
export type HighlightChoices = { companies: HighlightChoicePage<{ id: string; name: string }>;
  hunts: HighlightChoicePage<{ id: string; name: string | null; slug: string }>; roles: HighlightChoicePage<string> };
export type HighlightExportRead = { format: 'markdown' | 'plain'; date_from?: string | null; date_to?: string | null; page?: number };
export type HighlightExport = { text_chunks: string[]; filename: string; mime: 'text/markdown' | 'text/plain'; size_bytes: number; sha256: string };
export type HighlightExportManifest = Omit<HighlightExport, 'text_chunks'> & { format: 'markdown' | 'plain'; size_chars: number; chunk_chars: 64000; chunk_count: number };
export type HighlightExportChunkRead = HighlightExportRead & { expected_sha256: string; chunk_index: number };
export type HighlightExportChunk = HighlightExportManifest & { chunk_index: number; text: string; chunk_sha256: string };
const string = (v: unknown, max: number): v is string => typeof v === 'string' && !v.includes('\0') && [...v].length <= max;
const nullable = (v: unknown, check: (v: unknown) => boolean) => v === null || check(v);
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || nullable(v, check);
export const validHighlightId = uuid;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const tags = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 1000 && v.every(s => string(s, 80));
const fieldKeys = ['title', 'date', 'description', 'impact_raw', 'impact_refined', 'category', 'role', 'company_id', 'linked_campaign_id', 'tags'];
function dates(v: JsonObject) {
  if (!optional(v.date_from, calendarDate) || !optional(v.date_to, calendarDate) || (v.date_from && v.date_to && String(v.date_from) > String(v.date_to))) fail();
}
export function highlightReadInput(v: unknown): HighlightRead {
  shape(v, ['page', 'per_page', 'search', 'date_from', 'date_to', 'category', 'company_id', 'role', 'tags', 'sort']); dates(v);
  if ((v.page !== undefined && !integer(v.page, 1, 10000)) || (v.per_page !== undefined && !integer(v.per_page, 1, 100)) ||
      !optional(v.search, s => string(s, 100000)) || !optional(v.category, s => string(s, 50)) || !optional(v.role, s => string(s, 200)) ||
      !optional(v.company_id, uuid) || !optional(v.tags, tags) || (v.sort !== undefined && !['date_desc', 'date_asc', 'created_desc'].includes(String(v.sort)))) fail();
  return v as HighlightRead;
}
export function highlightChoicesInput(v: unknown): HighlightChoicesRead {
  shape(v, ['company_page', 'hunt_page', 'role_page', 'per_page']);
  if (['company_page', 'hunt_page', 'role_page'].some(key => v[key] !== undefined && !integer(v[key], 1, Number.MAX_SAFE_INTEGER)) ||
      (v.per_page !== undefined && !integer(v.per_page, 1, 100))) fail();
  return v as HighlightChoicesRead;
}
function validFields(v: unknown): v is HighlightFields {
  if (!record(v)) return false;
  return (v.title === undefined || (string(v.title, 500) && Boolean(v.title.trim()))) && optional(v.date, calendarDate) &&
    ['description', 'impact_raw', 'impact_refined'].every(key => optional(v[key], s => string(s, 100000))) &&
    optional(v.category, s => string(s, 50)) && optional(v.role, s => string(s, 200)) &&
    optional(v.company_id, uuid) && optional(v.linked_campaign_id, uuid) && (v.tags === undefined || tags(v.tags));
}
export function highlightWriteInput(v: unknown): HighlightWrite {
  shape(v, [...intentKeys, 'action', 'highlight_id', 'expected_fingerprint', 'fields']); intent(v);
  if (!['create', 'update', 'delete'].includes(String(v.action))) fail();
  if (v.action === 'create' ? v.highlight_id != null || v.expected_fingerprint != null : !uuid(v.highlight_id) || !hash(v.expected_fingerprint)) fail();
  if (v.action === 'delete') { if (v.fields != null) fail(); }
  else {
    if (!validFields(v.fields)) fail(); shape(v.fields, fieldKeys);
    if ((v.action === 'create' && !v.fields.title) || (v.action === 'update' && v.fields.date === null)) fail();
  }
  return v as HighlightWrite;
}
export function highlightExportInput(v: unknown): HighlightExportRead {
  shape(v, ['format', 'date_from', 'date_to', 'page']); dates(v);
  if (!['markdown', 'plain'].includes(String(v.format)) || (v.page !== undefined && !integer(v.page, 1, 10000))) fail();
  return v as HighlightExportRead;
}
export function highlightExportChunkInput(v: unknown): HighlightExportChunkRead {
  shape(v, ['format', 'date_from', 'date_to', 'page', 'expected_sha256', 'chunk_index']);
  const { expected_sha256, chunk_index, ...selection } = v;
  highlightExportInput(selection);
  if (!hash(expected_sha256) || !integer(chunk_index, 1, Number.MAX_SAFE_INTEGER)) fail();
  return v as HighlightExportChunkRead;
}
export function highlightExportMatches(v: { filename: string; mime: string }, input: HighlightExportRead) {
  const label = input.date_from || input.date_to ? `${input.date_from || 'start'}-${input.date_to || 'now'}` : 'all';
  return v.mime === (input.format === 'markdown' ? 'text/markdown' : 'text/plain') &&
    v.filename === `highlights-${label}.${input.format === 'markdown' ? 'md' : 'txt'}`;
}
function highlight(v: unknown): v is HighlightRecord {
  return record(v) && uuid(v.id) && uuid(v.user_id) && string(v.title, 500) && calendarDate(v.date) &&
    ['description', 'impact_raw', 'impact_refined'].every(key => nullable(v[key], s => string(s, 100000))) &&
    nullable(v.category, s => string(s, 50)) && nullable(v.role, s => string(s, 200)) && nullable(v.company_id, uuid) && nullable(v.linked_campaign_id, uuid) &&
    nullable(v.company_name, s => string(s, 100000)) && nullable(v.linked_campaign_name, s => string(s, 100000)) &&
    nullable(v.created_at, s => string(s, 40)) && nullable(v.updated_at, s => string(s, 40)) && tags(v.tags);
}
export const highlightPageResult = (v: unknown) => journeyResult(v, (v): v is HighlightPage => {
  if (!record(v) || !record(v.journal) || !record(v.fingerprints)) return false;
  const j = v.journal;
  return j.ok === true && Array.isArray(j.items) && j.items.length <= 100 && j.items.every(highlight) && integer(j.total, 0) &&
    integer(j.page, 1, 10000) && integer(j.per_page, 1, 100) && integer(j.pages, 1) && j.items.length <= Number(j.per_page) &&
    Object.keys(v.fingerprints).length === j.items.length && j.items.every(item => hash((v.fingerprints as JsonObject)[item.id]));
});
export const highlightSavedResult = (v: unknown) => journeyResult(v, (v): v is HighlightSaved => record(v) && typeof v.deleted === 'boolean' &&
  (v.highlight === null ? v.fingerprint === null : highlight(v.highlight) && hash(v.fingerprint)));
export const highlightOptionsResult = (v: unknown) => journeyResult(v, (v): v is HighlightOptions => record(v) && v.companyState === 'ready' && v.searchState === 'ready' &&
  Array.isArray(v.companyOptions) && v.companyOptions.length <= 1000 && v.companyOptions.every(x => record(x) && uuid(x.id) && string(x.name, 100000)) &&
  Array.isArray(v.searchOptions) && v.searchOptions.length <= 1000 && v.searchOptions.every(x => record(x) && uuid(x.id) && string(x.name, 100000) && string(x.slug, 200)) &&
  Array.isArray(v.roles) && v.roles.length <= 1000 && v.roles.every(x => string(x, 200)));
function choicePage<T>(v: unknown, item: (value: unknown) => value is T): v is HighlightChoicePage<T> {
  return record(v) && Array.isArray(v.items) && v.items.length <= 100 && v.items.every(item) && integer(v.total, 0, Number.MAX_SAFE_INTEGER) &&
    integer(v.page, 1, Number.MAX_SAFE_INTEGER) && integer(v.pages, 1, Number.MAX_SAFE_INTEGER) && integer(v.per_page, 1, 100) &&
    v.pages === Math.max(1, Math.ceil(Number(v.total) / Number(v.per_page))) && Number(v.page) <= Number(v.pages) &&
    v.items.length === Math.min(Number(v.per_page), Math.max(0, Number(v.total) - (Number(v.page) - 1) * Number(v.per_page)));
}
export const highlightChoicesResult = (v: unknown) => journeyResult(v, (v): v is HighlightChoices => record(v) &&
  choicePage(v.companies, (x): x is HighlightChoices['companies']['items'][number] => record(x) && uuid(x.id) && string(x.name, 255)) &&
  choicePage(v.hunts, (x): x is HighlightChoices['hunts']['items'][number] => record(x) && uuid(x.id) && nullable(x.name, s => string(s, 255)) && string(x.slug, 255)) &&
  choicePage(v.roles, (x): x is string => string(x, 200) && x.length > 0) &&
  new Set(v.companies.items.map(x => x.id.toLowerCase())).size === v.companies.items.length &&
  new Set(v.hunts.items.map(x => x.id.toLowerCase())).size === v.hunts.items.length && new Set(v.roles.items).size === v.roles.items.length);
export const highlightExportResult = (v: unknown) => journeyResult(v, (v): v is HighlightExport => record(v) &&
  Array.isArray(v.text_chunks) && v.text_chunks.length > 0 && v.text_chunks.length <= 16 && v.text_chunks.every(s => string(s, 64000)) &&
  string(v.filename, 100) && /^highlights-[a-z0-9-]+\.(?:md|txt)$/u.test(v.filename) && ['text/markdown', 'text/plain'].includes(String(v.mime)) &&
  integer(v.size_bytes, 1, 1000000) && hash(v.sha256));

function exportManifest(v: unknown): v is HighlightExportManifest {
  return record(v) && ['markdown', 'plain'].includes(String(v.format)) && string(v.filename, 100) &&
    /^highlights-[a-z0-9-]+\.(?:md|txt)$/u.test(v.filename) && v.mime === (v.format === 'markdown' ? 'text/markdown' : 'text/plain') &&
    v.filename.endsWith(v.format === 'markdown' ? '.md' : '.txt') &&
    integer(v.size_bytes, 1, Number.MAX_SAFE_INTEGER) && integer(v.size_chars, 1, Number.MAX_SAFE_INTEGER) && Number(v.size_bytes) >= Number(v.size_chars) && Number(v.size_bytes) <= Number(v.size_chars) * 4 &&
    v.chunk_chars === 64000 && integer(v.chunk_count, 1, Number.MAX_SAFE_INTEGER) && v.chunk_count === Math.ceil(Number(v.size_chars) / 64000) && hash(v.sha256);
}
export const highlightExportManifestResult = (v: unknown) => journeyResult(v, exportManifest);
export const highlightExportChunkResult = (v: unknown) => journeyResult(v, (v): v is HighlightExportChunk => {
  if (!record(v)) return false;
  const part = v;
  return exportManifest(v) && integer(part.chunk_index, 1, Number(v.chunk_count)) && string(part.text, 64000) &&
    [...part.text].length === Math.min(64000, v.size_chars - (Number(part.chunk_index) - 1) * 64000) && hash(part.chunk_sha256);
});
