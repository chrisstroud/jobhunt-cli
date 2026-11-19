/** Reversible whole-package archive state; source bodies and publication choices stay server-owned. */
import { record } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, shape, uuid, type MutationIntent } from './journey-contracts.ts';
export type LibraryStatus = 'active' | 'archived' | 'all';
export type ArchiveDocument = { id: string; slug: string; name: string | null; archetype: string | null; revision: number;
  is_archived: boolean | null; is_primary: boolean | null; package_anchor_id: string | null; is_role_copy: boolean; has_public_link: boolean };
export type LibraryDocumentsRead = { status?: LibraryStatus; page?: number };
export type LibraryDocumentsPage = { items: ArchiveDocument[]; status: LibraryStatus; total: number; page: number; has_more: boolean };
export type DocumentArchiveRead = { document_id: string; page?: number };
export type DocumentArchiveState = { document_id: string; anchor_id: string; fingerprint: string; items: ArchiveDocument[];
  member_count: number; archived_count: number; internal_contact_count: number; total: number; page: number; has_more: boolean };
export type DocumentArchiveWrite = MutationIntent & { document_id: string; expected_anchor_id: string; expected_fingerprint: string };
export type DocumentArchiveSaved = { anchor_id: string; current: DocumentArchiveState | null };
const statuses = ['active', 'archived', 'all'];
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const text = (v: unknown, max: number) => typeof v === 'string' && Array.from(v).length <= max && !v.includes('\0');
export function libraryDocumentsInput(v: unknown): LibraryDocumentsRead {
  shape(v, ['status', 'page']);
  if ((v.status !== undefined && !statuses.includes(String(v.status))) || (v.page !== undefined && !integer(v.page, 1, 10000))) fail();
  return v as LibraryDocumentsRead;
}
export function archiveReadInput(v: unknown): DocumentArchiveRead {
  shape(v, ['document_id', 'page']);
  if (!uuid(v.document_id) || (v.page !== undefined && !integer(v.page, 1, 10000))) fail();
  return v as DocumentArchiveRead;
}
export function archiveWriteInput(v: unknown): DocumentArchiveWrite {
  shape(v, [...intentKeys, 'document_id', 'expected_anchor_id', 'expected_fingerprint']); intent(v);
  if (!uuid(v.document_id) || !uuid(v.expected_anchor_id) || !hash(v.expected_fingerprint)) fail();
  return v as DocumentArchiveWrite;
}
function document(v: unknown): v is ArchiveDocument {
  return record(v) && uuid(v.id) && text(v.slug, 255) && (v.name === null || text(v.name, 255)) &&
    (v.archetype === null || text(v.archetype, 50)) && integer(v.revision) &&
    [v.is_archived, v.is_primary].every(x => x === null || typeof x === 'boolean') &&
    (v.package_anchor_id === null || uuid(v.package_anchor_id)) && typeof v.is_role_copy === 'boolean' && typeof v.has_public_link === 'boolean';
}
function items(v: unknown): v is ArchiveDocument[] {
  return Array.isArray(v) && v.length <= 50 && v.every(document) && new Set(v.map(x => x.id)).size === v.length;
}
function state(v: unknown): v is DocumentArchiveState {
  return record(v) && uuid(v.document_id) && uuid(v.anchor_id) && hash(v.fingerprint) && items(v.items) &&
    integer(v.member_count) && integer(v.archived_count, 0, Number(v.member_count)) && integer(v.internal_contact_count, 0, Number(v.member_count)) &&
    integer(v.total, 0) && Number(v.total) + Number(v.internal_contact_count) === v.member_count && integer(v.page, 1, 10000) &&
    v.has_more === (Number(v.page) * 50 < Number(v.total));
}
export const libraryDocumentsResult = (v: unknown) => journeyResult(v, (d): d is LibraryDocumentsPage => record(d) && items(d.items) &&
  statuses.includes(String(d.status)) && integer(d.total, 0) && integer(d.page, 1, 10000) && d.has_more === (Number(d.page) * 50 < Number(d.total)));
export const archiveStateResult = (v: unknown) => journeyResult(v, state);
export const archiveSavedResult = (v: unknown) => journeyResult(v, (d): d is DocumentArchiveSaved => record(d) && uuid(d.anchor_id) &&
  (d.current === null || (state(d.current) && d.current.anchor_id === d.anchor_id && d.current.document_id === d.anchor_id)));
