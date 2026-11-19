/** Complete reviewed document/application packages and JSON library archives. */
import { record } from './protocol.ts';
import { calendarDate, deadline, fail, integer, intent, intentKeys, journeyResult, shape, text, uuid, type JourneyResult, type MutationIntent } from './journey-contracts.ts';
import { DOCX, PDF, type ExportDownload, type ExportState } from './export-contracts.ts';

export const ZIP = 'application/zip';
type Mode = 'resume' | 'cover_only' | 'references';
type Format = 'pdf' | 'zip' | 'docx';
export type BundleSelection = { source: 'document'; document_id: string; documents: Mode[]; format: Format; page_size?: 'us-letter' | 'a4' } |
  { source: 'application'; application_id: string; documents: Mode[]; format: Format; page_size?: 'us-letter' | 'a4' } |
  { source: 'library'; document_ids: string[]; format?: 'json_zip' } |
  { source: 'package'; document_ids: string[]; format: 'pdf' | 'zip'; page_size?: 'us-letter' | 'a4' };
export type BundleReadSource = { selection: BundleSelection };
export type BundleRevision = { id: string; revision: number };
export type PrepareBundleExport = MutationIntent & BundleReadSource & { expected_sources: BundleRevision[]; expected_fingerprint: string };
export type BundleSource = { source: 'bundle'; bundle_kind: BundleSelection['source']; selection: BundleSelection;
  sources: BundleRevision[]; fingerprint: string; format: Format; render_date: string; members: string[]; download_name: string };
export type BundleMedia = typeof PDF | typeof DOCX | typeof ZIP;
export type BundleState = BundleSource & Pick<ExportState, 'id' | 'status' | 'expires_at' | 'sha256' | 'size_bytes'> & { media_type: BundleMedia };
export type BundleDownload = Omit<ExportDownload, 'media_type'> & { media_type: BundleMedia; download_name: string };
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const name = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && new TextEncoder().encode(v).length <= 255 &&
  !/[\x00-\x1f\\/:]/u.test(v) && v !== '.' && v !== '..';
const revisions = (v: unknown): v is BundleRevision[] => Array.isArray(v) && v.length >= 1 && v.length <= 50 &&
  v.every(item => record(item) && Object.keys(item).every(key => ['id', 'revision'].includes(key)) && uuid(item.id) && integer(item.revision));

function selection(v: unknown): BundleSelection {
  if (!record(v)) fail();
  if (v.source === 'package') {
    shape(v, ['source', 'document_ids', 'format', 'page_size']);
    if (!Array.isArray(v.document_ids) || v.document_ids.length < 1 || v.document_ids.length > 8 || !v.document_ids.every(uuid) ||
        !(v.format === 'pdf' || v.format === 'zip') || !(v.page_size === undefined || v.page_size === 'us-letter' || v.page_size === 'a4')) fail();
    const ids = (v.document_ids as string[]).map(id => id.toLowerCase());
    if (new Set(ids).size !== ids.length) fail();
    return { source: 'package', document_ids: ids, format: v.format, ...(v.page_size === undefined ? {} : { page_size: v.page_size }) } as BundleSelection;
  }
  if (v.source === 'library') {
    shape(v, ['source', 'document_ids', 'format']);
    if (!Array.isArray(v.document_ids) || v.document_ids.length < 1 || v.document_ids.length > 50 || !v.document_ids.every(uuid) ||
        !(v.format === undefined || v.format === 'json_zip')) fail();
    const ids = (v.document_ids as string[]).map(id => id.toLowerCase());
    if (new Set(ids).size !== ids.length) fail();
    return { source: 'library', document_ids: ids, format: 'json_zip' };
  }
  if (v.source !== 'document' && v.source !== 'application') fail();
  const key = v.source === 'document' ? 'document_id' : 'application_id';
  shape(v, ['source', key, 'documents', 'format', 'page_size']);
  if (!(v.page_size === undefined || v.page_size === 'us-letter' || v.page_size === 'a4')) fail();
  if (!uuid(v[key]) || !['pdf', 'zip', 'docx'].includes(String(v.format)) || !Array.isArray(v.documents) ||
      v.documents.length < 1 || v.documents.length > 3 || !v.documents.every(mode => ['resume', 'cover_only', 'references'].includes(mode)) ||
      new Set(v.documents).size !== v.documents.length) fail();
  return { source: v.source, [key]: (v[key] as string).toLowerCase(), documents: v.documents, format: v.format, ...(v.page_size === undefined ? {} : { page_size: v.page_size }) } as BundleSelection;
}
export const selectionKey = (v: BundleSelection) => JSON.stringify(selection(v));
export function bundleSourceInput(v: unknown): BundleReadSource {
  shape(v, ['selection']); return { selection: selection(v.selection) };
}
export function prepareBundleInput(v: unknown): PrepareBundleExport {
  shape(v, ['selection', ...intentKeys, 'expected_sources', 'expected_fingerprint']); intent(v);
  if (!revisions(v.expected_sources) || !hash(v.expected_fingerprint)) fail();
  return { ...v, selection: selection(v.selection) } as PrepareBundleExport;
}
function source(v: unknown): v is BundleSource {
  if (!record(v) || v.source !== 'bundle' || !hash(v.fingerprint) || !calendarDate(v.render_date) || !name(v.download_name) ||
      !revisions(v.sources) || !Array.isArray(v.members) || !v.members.every(name) || new Set(v.members).size !== v.members.length) return false;
  let picked: BundleSelection;
  try { picked = selection(v.selection); } catch { return false; }
  if (v.bundle_kind !== picked.source) return false;
  const ids = (picked.source === 'library' || picked.source === 'package') ? picked.document_ids : [picked.source === 'document' ? picked.document_id : picked.application_id];
  const count = (picked.source === 'library' || picked.source === 'package') ? ids.length : picked.documents.length;
  const format = picked.format === 'pdf' ? 'pdf' : picked.format === 'docx' && count === 1 ? 'docx' : 'zip';
  return v.format === format && v.members.length === count && v.sources.length === ids.length &&
    v.sources.every((item, index) => item.id === ids[index]);
}
export const bundleSourceResult = (v: unknown) => journeyResult(v, source);
const state = (v: unknown): v is BundleState => record(v) && uuid(v.id) && deadline(v.expires_at) &&
  ['pending', 'running', 'ready', 'failed', 'cancelled', 'expired'].includes(String(v.status)) &&
  v.media_type === (v.format === 'pdf' ? PDF : v.format === 'docx' ? DOCX : ZIP) &&
  (v.status === 'ready' ? hash(v.sha256) && integer(v.size_bytes, 5, 25000000) : v.sha256 == null && v.size_bytes == null) && source(v);
export function bundleStateResult(v: unknown): JourneyResult<BundleState> {
  if (record(v) && v.outcome === 'failed' && record(v.data) && v.data.status === 'failed' &&
      record(v.error) && v.error.code === 'processing_failed' && text(v.error.message, 1000))
    return { ...journeyResult({ ...v, outcome: 'ready' }, state), outcome: 'failed' };
  return journeyResult(v, state);
}
export const bundleDownloadResult = (v: unknown) => journeyResult(v, (item): item is BundleDownload => record(item) && uuid(item.export_id) &&
  text(item.url, 8192) && !!item.url && item.method === 'GET' && deadline(item.expires_at) && [PDF, DOCX, ZIP].includes(String(item.media_type)) &&
  hash(item.sha256) && integer(item.size_bytes, 5, 25000000) && item.reusable_until_expiry === true && name(item.download_name));
