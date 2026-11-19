/** Reviewed sources and temporary private document/Hunt Page exports. */
import { record } from './protocol.ts';
import { calendarDate, deadline, fail, integer, intent, intentKeys, journeyResult, optional, shape, text, uuid, type JourneyResult, type MutationIntent } from './journey-contracts.ts';
import type { HuntPageMediaRead } from './hunt-page-contracts.ts';

export type ExportFormat = 'pdf' | 'docx';
export type PageExportFormat = ExportFormat | 'md' | 'txt';
export type ExportMode = 'resume' | 'cover' | 'cover_only' | 'references' | 'all';
export type ExportMediaType = 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'text/markdown' | 'text/plain';
export type ExportDocumentSelection = { document_id: string; format?: ExportFormat; mode?: ExportMode; page_size?: 'us-letter' | 'a4' };
export type ExportPageSelection = HuntPageMediaRead & { document_id?: string | null; format?: PageExportFormat };
export type PrepareDocumentExport = MutationIntent & ExportDocumentSelection & { expected_revision: number; expected_fingerprint: string };
export type PreparePageExport = MutationIntent & ExportPageSelection & { expected_document_revision: number; expected_fingerprint: string };
export type ExportRead = { export_id: string };
export type CancelExport = MutationIntent & ExportRead & { expected_account_id: string; confirm_cancel: true };
export type ExportSource = { source: 'document' | 'hunt_page'; document_id: string; revision: number; fingerprint: string;
  format: PageExportFormat; mode?: ExportMode | null; render_date: string; page_revision?: number | null; preview_revision?: string | null };
export type ExportState = ExportSource & { id: string; status: 'pending' | 'running' | 'ready' | 'failed' | 'cancelled' | 'expired';
  expires_at: string; media_type: ExportMediaType; sha256?: string | null; size_bytes?: number | null };
export type ExportDownload = ExportRead & { url: string; method: 'GET'; expires_at: string; media_type: ExportMediaType;
  sha256: string; size_bytes: number; reusable_until_expiry: true };

export const PDF = 'application/pdf';
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MARKDOWN = 'text/markdown';
export const TEXT = 'text/plain';
const mediaByFormat = { pdf: PDF, docx: DOCX, md: MARKDOWN, txt: TEXT } as const;
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const format = (v: unknown) => v === 'pdf' || v === 'docx';
const pageFormat = (v: unknown): v is PageExportFormat => format(v) || v === 'md' || v === 'txt';
const mode = (v: unknown) => ['resume', 'cover', 'cover_only', 'references', 'all'].includes(String(v));
const media = (v: unknown) => v === PDF || v === DOCX || v === MARKDOWN || v === TEXT;
const minimumSize = (mediaType: unknown) => mediaType === MARKDOWN || mediaType === TEXT ? 1 : 5;
const documentKeys = ['document_id', 'format', 'mode', 'page_size'];
const pageKeys = ['document_id', 'format', 'expected_revision', 'expected_preview_revision'];
function documentSelection(v: Record<string, unknown>) {
  if (!(v.page_size === undefined || v.page_size === 'us-letter' || v.page_size === 'a4') || !uuid(v.document_id) || !(v.format === undefined || format(v.format)) || !(v.mode === undefined || mode(v.mode))) fail();
}
function pageSelection(v: Record<string, unknown>) {
  if (!optional(v.document_id, uuid) || !(v.format === undefined || pageFormat(v.format)) ||
      !integer(v.expected_revision, 0) || !hash(v.expected_preview_revision)) fail();
}
export function exportDocumentInput(v: unknown): ExportDocumentSelection {
  shape(v, documentKeys); documentSelection(v); return v as ExportDocumentSelection;
}
export function exportPageInput(v: unknown): ExportPageSelection {
  shape(v, pageKeys); pageSelection(v); return v as ExportPageSelection;
}
export function prepareDocumentExportInput(v: unknown): PrepareDocumentExport {
  shape(v, [...documentKeys, ...intentKeys, 'expected_revision', 'expected_fingerprint']); intent(v); documentSelection(v);
  if (!integer(v.expected_revision) || !hash(v.expected_fingerprint)) fail(); return v as PrepareDocumentExport;
}
export function preparePageExportInput(v: unknown): PreparePageExport {
  shape(v, [...pageKeys, ...intentKeys, 'expected_document_revision', 'expected_fingerprint']); intent(v); pageSelection(v);
  if (!integer(v.expected_document_revision) || !hash(v.expected_fingerprint)) fail(); return v as PreparePageExport;
}
export function exportReadInput(v: unknown): ExportRead {
  shape(v, ['export_id']); if (!uuid(v.export_id)) fail(); return v as ExportRead;
}
export function cancelExportInput(v: unknown): CancelExport {
  shape(v, ['export_id', ...intentKeys, 'confirm_cancel']); intent(v);
  if (!uuid(v.export_id) || !v.expected_account_id || v.confirm_cancel !== true) fail(); return v as CancelExport;
}
function source(v: unknown): v is ExportSource {
  return record(v) && ['document', 'hunt_page'].includes(String(v.source)) && uuid(v.document_id) && integer(v.revision) &&
    hash(v.fingerprint) && pageFormat(v.format) && (v.source === 'hunt_page' || format(v.format)) && optional(v.mode, mode) && calendarDate(v.render_date) &&
    optional(v.page_revision, n => integer(n, 0)) && optional(v.preview_revision, hash) &&
    (v.source !== 'hunt_page' || (integer(v.page_revision, 0) && hash(v.preview_revision)));
}
export const exportSourceResult = (v: unknown) => journeyResult(v, source);
const state = (v: unknown): v is ExportState => record(v) && uuid(v.id) &&
  ['pending', 'running', 'ready', 'failed', 'cancelled', 'expired'].includes(String(v.status)) && deadline(v.expires_at) &&
  pageFormat(v.format) && v.media_type === mediaByFormat[v.format] &&
  (v.status === 'ready' ? hash(v.sha256) && integer(v.size_bytes, minimumSize(v.media_type), 25000000) : v.sha256 == null && v.size_bytes == null) && source(v);
export function exportStateResult(v: unknown): JourneyResult<ExportState> {
  // Reading a failed job is a successful status read. Preserve its structured
  // state so automation can distinguish a terminal render from an HTTP failure.
  if (record(v) && v.outcome === 'failed' && record(v.data) && v.data.status === 'failed' &&
      record(v.error) && v.error.code === 'processing_failed' && text(v.error.message, 1000)) {
    return { ...journeyResult({ ...v, outcome: 'ready' }, state), outcome: 'failed' };
  }
  return journeyResult(v, state);
}
export const exportDownloadResult = (v: unknown) => journeyResult(v, (v): v is ExportDownload => record(v) && uuid(v.export_id) &&
  text(v.url, 8192) && !!v.url && v.method === 'GET' && deadline(v.expires_at) && media(v.media_type) && hash(v.sha256) &&
  integer(v.size_bytes, minimumSize(v.media_type), 25000000) && v.reusable_until_expiry === true);
