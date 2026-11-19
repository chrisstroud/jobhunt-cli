/** Master-package metadata and reviewed membership; never resume bodies in lists. */
import { record } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, optional, shape, uuid, type MutationIntent } from './journey-contracts.ts';
export type LibraryDocumentSummary = { id: string; slug: string; name: string | null; archetype: string;
  editorial_status?: 'draft'|'ready'; package_editorial_status?: 'draft'|'ready';
  is_primary: boolean | null; package_anchor_id: string | null; application_count: number; version_count: number;
  published_url: string | null; updated_at: string | null; typst_style_name: string | null; contact_profile_id: string | null; revision: number };
export type LibraryPackageSummary = LibraryDocumentSummary & { document_count: number };
export type LibraryPackagePage = { packages: LibraryPackageSummary[]; documents: LibraryDocumentSummary[]; selected: LibraryDocumentSummary | null;
  default_id: string | null; page: number; total: number; has_more: boolean; documents_page: number; documents_total: number; documents_have_more: boolean };
export type LibraryPackageRead = { package_id?: string | null; page?: number; documents_page?: number };
export type LibraryPackageAdd = MutationIntent & { document_id: string; expected_revision: number; name: string;
  archetype: 'structured' | 'letter' | 'reference' | 'statement' };
export type LibraryPackageDelete = MutationIntent & { document_id: string; expected_revision: number; expected_document_ids: string[] };
export type DocumentUsageRead = { document_id: string; page?: number };
export type DocumentUsagePage = { document_id: string; applications: { slug: string; company: string | null; position: string | null }[]; next_page: number | null };
const text = (v: unknown, max: number) => typeof v === 'string' && Array.from(v).length <= max && !v.includes('\0');
export function libraryPackageReadInput(v: unknown): LibraryPackageRead {
  shape(v, ['package_id', 'page', 'documents_page']);
  if (!optional(v.package_id, uuid) || (v.page !== undefined && !integer(v.page, 1, 10000)) ||
    (v.documents_page !== undefined && !integer(v.documents_page, 1, 10000))) fail();
  return v as LibraryPackageRead;
}
export function libraryPackageWriteInput(v: unknown, action: 'add'): LibraryPackageAdd;
export function libraryPackageWriteInput(v: unknown, action: 'delete'): LibraryPackageDelete;
export function libraryPackageWriteInput(v: unknown, action: 'add' | 'delete') {
  shape(v, [...intentKeys, 'document_id', 'expected_revision', ...(action === 'add' ? ['name', 'archetype'] : ['expected_document_ids'])]); intent(v);
  if (!uuid(v.document_id) || !integer(v.expected_revision)) fail();
  if (action === 'add') {
    if (!text(v.name, 255) || !String(v.name).trim() || !['structured', 'letter', 'reference', 'statement'].includes(String(v.archetype))) fail();
  } else if (!Array.isArray(v.expected_document_ids) || v.expected_document_ids.length < 1 || v.expected_document_ids.length > 1000 ||
    !v.expected_document_ids.every(uuid) || new Set(v.expected_document_ids).size !== v.expected_document_ids.length) fail();
  return v as LibraryPackageAdd | LibraryPackageDelete;
}
export function documentUsageInput(v: unknown): DocumentUsageRead {
  shape(v, ['document_id', 'page']);
  if (!uuid(v.document_id) || (v.page !== undefined && !integer(v.page, 1, 10000))) fail();
  return v as DocumentUsageRead;
}
function summary(v: unknown): v is LibraryDocumentSummary {
  return record(v) && (v.editorial_status===undefined||['draft','ready'].includes(String(v.editorial_status))) && (v.package_editorial_status===undefined||['draft','ready'].includes(String(v.package_editorial_status))) && uuid(v.id) && text(v.slug, 255) && (v.name === null || text(v.name, 255)) && text(v.archetype, 50) &&
    (v.is_primary === null || typeof v.is_primary === 'boolean') && (v.package_anchor_id === null || uuid(v.package_anchor_id)) && integer(v.application_count, 0) && integer(v.version_count, 0) &&
    (v.published_url === null || text(v.published_url, 2048)) && (v.updated_at === null || text(v.updated_at, 80)) &&
    (v.typst_style_name === null || text(v.typst_style_name, 255)) && (v.contact_profile_id === null || uuid(v.contact_profile_id)) && integer(v.revision);
}
export const libraryPackagePageResult = (v: unknown) => journeyResult(v, (d): d is LibraryPackagePage => record(d) &&
  Array.isArray(d.packages) && d.packages.length <= 20 && d.packages.every(p => summary(p) && record(p) && integer((p as LibraryPackageSummary).document_count, 0)) &&
  Array.isArray(d.documents) && d.documents.length <= 100 && d.documents.every(summary) && (d.selected === null || summary(d.selected)) &&
  (d.default_id === null || uuid(d.default_id)) && integer(d.page, 1, 10000) && integer(d.documents_page, 1, 10000) && integer(d.total, 0) && integer(d.documents_total, 0) &&
  d.has_more === (Number(d.page) * 20 < Number(d.total)) && d.documents_have_more === (Number(d.documents_page) * 100 < Number(d.documents_total)) &&
  new Set(d.packages.map(p => p.id)).size === d.packages.length && new Set(d.documents.map(p => p.id)).size === d.documents.length &&
  (d.selected !== null || (d.documents.length === 0 && d.documents_total === 0)));
export const documentUsageResult = (v: unknown) => journeyResult(v, (d): d is DocumentUsagePage => record(d) && uuid(d.document_id) &&
  Array.isArray(d.applications) && d.applications.length <= 50 && d.applications.every(a => record(a) && text(a.slug, 255) &&
    (a.company === null || text(a.company, 255)) && (a.position === null || text(a.position, 255))) &&
  (d.next_page === null || integer(d.next_page, 2, 10001)) && new Set(d.applications.map(a => a.slug)).size === d.applications.length);
