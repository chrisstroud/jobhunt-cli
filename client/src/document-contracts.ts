/** Existing career-document contracts. Provenance, ownership and content policy remain server-owned. */
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, optional, resourceId, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type CareerSource = { kind: 'user_statement' | 'import' | 'posting' | 'document' | 'written_offer' | 'verbal_offer' | 'estimate' | 'unknown';
  record_id?: string | null; field?: string | null; note?: string | null };
export type CareerFact = { field: string; value: string; state: 'draft' | 'uncertain' | 'confirmed' | 'declined'; sources: CareerSource[] };
export type CareerSectionEntry = { id?: string | null; fields: CareerFact[] };
export type CareerSection = { name: string; text: string | null; entries: CareerSectionEntry[] };
export type DocumentDisplaySettings = { section_titles?: Record<string, string>; section_order?: string[]; section_visibility?: Record<string, boolean> };
export type CareerSectionInput = Omit<CareerSection, 'text'> & { text?: string | null; settings?: DocumentDisplaySettings | null };
export type CareerDocument = {
  id: string; slug: string; name: string; revision: number;
  type: 'resume' | 'cover_letter' | 'offer_attachment' | 'supporting_document';
  archetype: 'structured' | 'letter' | 'reference' | 'statement' | 'contact'; subtype?: string | null;
  relation: 'master' | 'role_draft' | 'source' | 'prepared'; master_id?: string | null;
  contact_profile_id?: string | null; application_id?: string | null; sections: CareerSection[];
  display_settings: DocumentDisplaySettings; design: 'linen' | 'historical'; uncertain_fields: string[];
};
export type CreateCareerDocument = MutationIntent & { name: string; content: { sections: CareerSectionInput[] }; contact_profile_id?: string | null };
export type UpdateCareerSection = MutationIntent & { template_slug: string; section: string; data: CareerSectionInput; expected_revision: number };
export type DocumentWrite = MutationIntent & { document_id: string; expected_revision: number };
export type NamedDocumentWrite = DocumentWrite & { name: string };
export type RestoreDocument = DocumentWrite & { version_id: string };
export type DocumentRevisionRead = { document_id: string; before_id?: string | null; expected_account_id?: string | null; include_metadata?: boolean };
export type DocumentSummary = { id: string; kind: 'document'; label: string; revision: number | null; website_url?: string | null };
export type DocumentRevisionMetadata = { id: string; name: string | null; trigger: string; created_at: string };
export type DocumentRevisions = { items: DocumentSummary[]; has_more: boolean; next_before_id?: string | null;
  details?: { account_id: string; document_id: string; total: number; items: DocumentRevisionMetadata[] } | null };
export type DocumentLibraryResult = { document_id: string } & (
  { deleted: true; document?: null; is_primary?: boolean } |
  { deleted?: false; document: CareerDocument; is_primary: boolean }
);
export type DocumentLibraryPage = { data: { type: 'resume_template'; id: string; attributes: {
  template_id: string; name: string; is_default?: boolean | null; is_primary?: boolean | null;
  description?: string | null; application_count: number; version_count: number;
} }[]; meta: JsonObject; links?: JsonObject };
export type ResumeTextImport = MutationIntent & { text: string };
export type ConfirmResumeImport = MutationIntent & { import_id: string; expected_revision: number; accepted_facts: CareerFact[] };
export type ResumeImport = { id: string; revision: number; status: 'pending' | 'extracting' | 'review' | 'confirmed' | 'failed';
  purpose: 'resume' | 'offer'; facts: CareerFact[]; result?: DocumentSummary | null; error?: { code: string; message: string } | null };

const string = (value: unknown, maximum: number, minimum = 0) => text(value, maximum) && (value as string).length >= minimum;
/** Match Python's document-name whitespace rules, including U+0085, excluding FEFF. */
export const stripDocumentName = (value: string) => value.replace(/^[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu, '');
const nonblank = (value: unknown, maximum: number) => string(value, maximum, 1) && Boolean(stripDocumentName(value as string));
const array = (value: unknown, maximum: number, check: (value: unknown) => boolean) => Array.isArray(value) && value.length <= maximum && value.every(check);
const sourceKinds = ['user_statement', 'import', 'posting', 'document', 'written_offer', 'verbal_offer', 'estimate', 'unknown'];
const factStates = ['draft', 'uncertain', 'confirmed', 'declined'];
export function source(value: unknown): value is CareerSource {
  return record(value) && sourceKinds.includes(String(value.kind)) && optional(value.record_id, resourceId) &&
    optional(value.field, v => string(v, 160)) && optional(value.note, v => string(v, 1000));
}
function fact(value: unknown): value is CareerFact {
  return record(value) && string(value.field, 160, 1) && string(value.value, 10000) &&
    factStates.includes(String(value.state)) && array(value.sources, 20, source);
}
function entry(value: unknown): value is CareerSectionEntry {
  return record(value) && optional(value.id, resourceId) && array(value.fields, 50, fact);
}
function settings(value: unknown): value is DocumentDisplaySettings {
  return record(value) && (value.section_titles === undefined || (record(value.section_titles) &&
      Object.entries(value.section_titles).every(([key, title]) => string(key, 80, 1) && string(title, 120)))) &&
    (value.section_visibility === undefined || (record(value.section_visibility) &&
      Object.entries(value.section_visibility).every(([key, visible]) => string(key, 80, 1) && typeof visible === 'boolean'))) &&
    (value.section_order === undefined || (array(value.section_order, 30, v => string(v, 80, 1)) &&
      new Set(value.section_order as string[]).size === (value.section_order as string[]).length));
}
function inputFact(value: unknown) {
  shape(value, ['field', 'value', 'state', 'sources']);
  if (!fact(value)) fail();
  for (const item of value.sources) shape(item, ['kind', 'record_id', 'field', 'note']);
}
function sectionInput(value: unknown): asserts value is CareerSectionInput {
  shape(value, ['name', 'text', 'entries', 'settings']);
  if (!string(value.name, 80, 1) || !optional(value.text, v => string(v, 10000)) || !array(value.entries, 100, entry)) fail();
  for (const item of value.entries as CareerSectionEntry[]) {
    shape(item, ['id', 'fields']); item.fields.forEach(inputFact);
  }
  if (value.name === 'resume_settings') {
    if (value.text != null || (value.entries as unknown[]).length || !settings(value.settings)) fail();
  } else if (value.settings != null || (value.text != null && (value.entries as unknown[]).length)) fail();
  if (value.settings != null) shape(value.settings, ['section_titles', 'section_order', 'section_visibility']);
}
export function createCareerDocumentInput(value: unknown): CreateCareerDocument {
  shape(value, [...intentKeys, 'name', 'content', 'contact_profile_id']); intent(value);
  if (!nonblank(value.name, 255) || !optional(value.contact_profile_id, resourceId)) fail();
  shape(value.content, ['sections']);
  if (!Array.isArray(value.content.sections) || value.content.sections.length > 30) fail();
  value.content.sections.forEach(sectionInput);
  const names = value.content.sections.map(section => (section as CareerSectionInput).name);
  if (new Set(names).size !== names.length) fail();
  return value as CreateCareerDocument;
}
export function updateCareerSectionInput(value: unknown): UpdateCareerSection {
  shape(value, [...intentKeys, 'template_slug', 'section', 'data', 'expected_revision']); intent(value);
  if (!resourceId(value.template_slug) || !string(value.section, 80, 1) || !integer(value.expected_revision)) fail();
  sectionInput(value.data); if (value.data.name !== value.section) fail();
  return value as UpdateCareerSection;
}
export function documentWriteInput(value: unknown, kind: 'plain'): DocumentWrite;
export function documentWriteInput(value: unknown, kind: 'named'): NamedDocumentWrite;
export function documentWriteInput(value: unknown, kind: 'restore'): RestoreDocument;
export function documentWriteInput(value: unknown, kind: 'plain' | 'named' | 'restore'): DocumentWrite | NamedDocumentWrite | RestoreDocument {
  shape(value, [...intentKeys, 'document_id', 'expected_revision', ...(kind === 'named' ? ['name'] : kind === 'restore' ? ['version_id'] : [])]); intent(value);
  if (!resourceId(value.document_id) || !integer(value.expected_revision) ||
      (kind === 'named' && !nonblank(value.name, 255)) || (kind === 'restore' && !resourceId(value.version_id))) fail();
  return value as DocumentWrite;
}
export function documentRevisionReadInput(value: unknown): DocumentRevisionRead {
  shape(value, ['document_id', 'before_id', 'expected_account_id', 'include_metadata']);
  if (!resourceId(value.document_id) || !optional(value.before_id, resourceId)
    || !optional(value.expected_account_id, resourceId) || (value.include_metadata !== undefined && typeof value.include_metadata !== 'boolean')) fail();
  return value as DocumentRevisionRead;
}
export function resumeTextImportInput(value: unknown): ResumeTextImport {
  shape(value, [...intentKeys, 'text']); intent(value);
  if (!nonblank(value.text, 100000)) fail();
  return value as ResumeTextImport;
}
export function confirmResumeImportInput(value: unknown): ConfirmResumeImport {
  shape(value, [...intentKeys, 'import_id', 'expected_revision', 'accepted_facts']); intent(value);
  if (!resourceId(value.import_id) || !integer(value.expected_revision) || !array(value.accepted_facts, 500, fact) ||
      !(value.accepted_facts as CareerFact[]).some(f => f.state === 'confirmed')) fail();
  const facts = value.accepted_facts as CareerFact[];
  facts.forEach(inputFact);
  if (facts.some(f => !['confirmed', 'declined'].includes(f.state)) || new Set(facts.map(f => f.field)).size !== facts.length) fail();
  return value as ConfirmResumeImport;
}
export function careerDocument(value: unknown): value is CareerDocument {
  return record(value) && resourceId(value.id) && resourceId(value.slug) && string(value.name, 255, 1) && integer(value.revision) &&
    ['resume', 'cover_letter', 'offer_attachment', 'supporting_document'].includes(String(value.type)) &&
    ['structured', 'letter', 'reference', 'statement', 'contact'].includes(String(value.archetype)) && optional(value.subtype, v => string(v, 100)) &&
    ['master', 'role_draft', 'source', 'prepared'].includes(String(value.relation)) &&
    [value.master_id, value.contact_profile_id, value.application_id].every(v => optional(v, resourceId)) &&
    array(value.sections, 30, section => record(section) && string(section.name, 80, 1) &&
      (section.text === null || string(section.text, 100000)) && array(section.entries, 100, entry)) &&
    settings(value.display_settings) && ['linen', 'historical'].includes(String(value.design)) && array(value.uncertain_fields, 200, v => string(v, 160));
}
function summary(value: unknown): value is DocumentSummary {
  return record(value) && resourceId(value.id) && value.kind === 'document' && string(value.label, 255, 1) &&
    (value.revision === null || integer(value.revision)) && optional(value.website_url, v => string(v, 2048));
}
function revisions(value: unknown): value is DocumentRevisions {
  if (!record(value) || !array(value.items, 30, summary) || typeof value.has_more !== 'boolean' || !optional(value.next_before_id, resourceId)) return false;
  if (value.details == null) return true;
  const items = value.items as DocumentSummary[];
  const details = value.details;
  return record(details) && resourceId(details.account_id) && resourceId(details.document_id) && integer(details.total, 0)
    && Array.isArray(details.items) && details.items.length === items.length
    && Number(details.total) >= details.items.length && details.items.every((item, index) => record(item)
      && item.id === items[index].id && (item.name === null || string(item.name, 255))
      && string(item.trigger, 50) && typeof item.created_at === 'string' && Number.isFinite(Date.parse(item.created_at)))
    && new Set(items.map(item => item.id)).size === items.length
    && (value.has_more ? items.length === 30 && value.next_before_id === items.at(-1)?.id : value.next_before_id == null);
}
function library(value: unknown): value is DocumentLibraryResult {
  return record(value) && resourceId(value.document_id) && (value.deleted === true
    ? value.document == null && (value.is_primary === undefined || typeof value.is_primary === 'boolean')
    : (value.deleted === undefined || value.deleted === false) && typeof value.is_primary === 'boolean' && careerDocument(value.document));
}
function resumeImport(value: unknown): value is ResumeImport {
  return record(value) && resourceId(value.id) && integer(value.revision) && ['pending', 'extracting', 'review', 'confirmed', 'failed'].includes(String(value.status)) &&
    ['resume', 'offer'].includes(String(value.purpose)) && array(value.facts, 500, fact) && optional(value.result, summary) &&
    optional(value.error, e => record(e) && string(e.code, 80, 1) && string(e.message, 1000, 1));
}
export function documentLibraryPage(value: unknown): DocumentLibraryPage {
  if (!record(value) || !record(value.meta) || !array(value.data, 100, row => record(row) && row.type === 'resume_template' &&
      resourceId(row.id) && record(row.attributes) && resourceId(row.attributes.template_id) && string(row.attributes.name, 255, 1) &&
      integer(row.attributes.application_count, 0) && integer(row.attributes.version_count, 0) &&
      [row.attributes.is_default, row.attributes.is_primary].every(v => optional(v, b => typeof b === 'boolean')))) fail(true);
  return value as DocumentLibraryPage;
}
export const careerDocumentResult = (value: unknown) => journeyResult(value, careerDocument);
export function documentRevisionsResult(value: unknown, input?: DocumentRevisionRead) {
  const result = journeyResult(value, revisions);
  if (input?.include_metadata && result.outcome === 'ready' && (!result.data?.details
    || !(result.data.details.document_id === input.document_id || (uuid(result.data.details.document_id)
      && uuid(input.document_id) && result.data.details.document_id.toLowerCase() === input.document_id.toLowerCase()))
    || (input.expected_account_id != null && result.data.details.account_id !== input.expected_account_id))) fail(true);
  return result;
}
export const documentCheckpointResult = (value: unknown) => journeyResult(value, summary);
export const documentLibraryResult = (value: unknown) => journeyResult(value, library);
export const resumeImportResult = (value: unknown) => journeyResult(value, resumeImport);
