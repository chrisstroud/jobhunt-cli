/** Private saved-document and immutable prepared-PDF page previews. */
import { record } from './protocol.ts';
import { fail, integer, journeyResult, shape, text, uuid } from './journey-contracts.ts';

export type DocumentPreviewRead = { document_id: string; expected_revision: number; page?: number };
export type PreparedPreviewRead = { application_id: string; version_id: string; expected_revision: number; expected_sha256: string; page?: number };
export type DocumentPreview = { document_id: string; revision: number; page: number; pages: number; image_chunks: string[] };
function pageRevision(v: Record<string, unknown>) {
  if (!integer(v.expected_revision, 1) || (v.page !== undefined && !integer(v.page, 1, 100))) fail();
}
export function documentPreviewInput(v: unknown): DocumentPreviewRead {
  shape(v, ['document_id', 'expected_revision', 'page']); pageRevision(v);
  if (!uuid(v.document_id)) fail(); return v as DocumentPreviewRead;
}
export function preparedPreviewInput(v: unknown): PreparedPreviewRead {
  shape(v, ['application_id', 'version_id', 'expected_revision', 'expected_sha256', 'page']); pageRevision(v);
  if (!uuid(v.application_id) || !uuid(v.version_id) || typeof v.expected_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(v.expected_sha256)) fail();
  return v as PreparedPreviewRead;
}
export const documentPreviewResult = (v: unknown) => journeyResult(v, (v): v is DocumentPreview => record(v) && uuid(v.document_id) &&
  integer(v.revision, 1) && integer(v.page, 1, 100) && integer(v.pages, 1) && Number(v.page) <= Number(v.pages) &&
  Array.isArray(v.image_chunks) && v.image_chunks.length > 0 && v.image_chunks.length <= 12 && v.image_chunks.every(s => text(s, 64000)));
