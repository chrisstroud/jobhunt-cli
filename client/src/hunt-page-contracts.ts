/** Existing live Hunt Page settings and explicitly reviewed publication. */
import { privateJPEGBytes } from './private-download.ts';
import { record } from './protocol.ts';
import {resumeHostFileInput,type HostResumeFile} from './import-file-contracts.ts';
import {MAX_PROFILE_FILE_BYTES} from './profile-file-contracts.ts';
import { fail, integer, intent, intentKeys, journeyResult, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export const huntPagePalettes = ['forest', 'steel', 'ochre', 'linen', 'slate', 'ocean', 'indigo', 'plum', 'clay', 'rose', 'graphite'] as const;
export type HuntPagePalette = typeof huntPagePalettes[number];
export type HuntPageDraft = { source_id: string | null; handle: string; links: { label: string; url: string }[];
  photo_id: string | null; source_ids?: string[] | null; display_name?: string;
  sidebar_mode?: 'system' | 'light' | 'dark'; sidebar_palette?: HuntPagePalette;
  profile_id?: string | null; profile_updated_at?: string | null; search_indexable?: boolean };
export type HuntPageState = { revision: number; draft: HuntPageDraft; visibility: 'public' | 'private'; published: boolean;
  preview_revision: string; public_path: string | null; source_status: string; profile_status: string | null };
export type HuntPageWorkspace = { page: HuntPageState; sources: { id: string; title: string; package_id: string; package_title: string;
  eligible: boolean; reason: string | null }[]; profiles: { id: string; name: string; updated_at: string | null }[];
  selected_documents: { id: string; revision: number }[]; sources_page: number; sources_have_more: boolean; profiles_have_more: boolean };
export type HuntPageSave = MutationIntent & { expected_revision: number; draft: HuntPageDraft; acknowledge_public_update?: boolean };
export type HuntPageMediaRead = { expected_revision: number; expected_preview_revision: string };
export type HuntPageVisibility = MutationIntent & HuntPageMediaRead & { visibility: 'public' | 'private'; confirm_publication?: boolean };
export type HuntPagePreviewRead = HuntPageMediaRead & { document_id?: string | null; page?: number };
export type HuntPagePreview = { document_id: string; page_revision: number; preview_revision: string; page: number; pages: number; image_chunks: string[] };
export type HuntPagePhotoSave = MutationIntent & HuntPageMediaRead & { acknowledge_public_update?: boolean };
export type HuntPagePhotoHostFile=HuntPagePhotoSave&{source_sha256:string;source_size:number;media_type:'image/png'|'image/jpeg';file:HostResumeFile};

export function huntPagePhotoHostFileInput(v:unknown):HuntPagePhotoHostFile {
  shape(v,[...intentKeys,'expected_revision','expected_preview_revision','acknowledge_public_update','source_sha256','source_size','media_type','file']);
  const base=Object.fromEntries([...intentKeys,'expected_revision','expected_preview_revision','acknowledge_public_update'].filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]]));
  huntPagePhotoInput(base);
  resumeHostFileInput({...Object.fromEntries(intentKeys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]])),file:v.file});
  if(typeof v.source_sha256!=='string'||!hash(v.source_sha256)||!integer(v.source_size,1,MAX_PROFILE_FILE_BYTES)||!['image/png','image/jpeg'].includes(String(v.media_type)))fail();
  return v as HuntPagePhotoHostFile;
}

const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const bool = (v: unknown) => typeof v === 'boolean';
const nullableId = (v: unknown) => v === null || uuid(v);
const string = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const revision = (v: unknown) => integer(v, 0, 2147483647);
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);
const array = (v: unknown, max: number, check: (v: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.length <= max && v.every(check);
function draft(v: unknown): v is HuntPageDraft {
  return record(v) && nullableId(v.source_id) && nullableId(v.photo_id) && string(v.handle, 120) &&
    array(v.links, 3, link => record(link) && text(link.label, 60) && text(link.url, 2048)) &&
    optional(v.source_ids, ids => ids === null || array(ids, 20, uuid)) && optional(v.display_name, s => string(s, 200)) &&
    optional(v.sidebar_mode, s => ['system', 'light', 'dark'].includes(String(s))) &&
    optional(v.sidebar_palette, s => huntPagePalettes.includes(s as HuntPagePalette)) &&
    optional(v.profile_id, nullableId) && optional(v.profile_updated_at, s => s === null || string(s, 40)) && optional(v.search_indexable, bool);
}
const draftKeys = ['source_id', 'handle', 'links', 'photo_id', 'source_ids', 'display_name', 'sidebar_mode', 'sidebar_palette', 'profile_id', 'profile_updated_at', 'search_indexable'];
export function huntPageReadInput(v: unknown) {
  shape(v, ['page']); if (v.page !== undefined && !integer(v.page, 1, 10000)) fail(); return v as { page?: number };
}
function media(v: Record<string, unknown>) {
  if (!revision(v.expected_revision) || !hash(v.expected_preview_revision)) fail();
}
export function huntPageMediaInput(v: unknown): HuntPageMediaRead {
  shape(v, ['expected_revision', 'expected_preview_revision']); media(v); return v as HuntPageMediaRead;
}
export function huntPageSaveInput(v: unknown): HuntPageSave {
  shape(v, [...intentKeys, 'expected_revision', 'draft', 'acknowledge_public_update']); intent(v);
  if (!revision(v.expected_revision) || !draft(v.draft) || !optional(v.acknowledge_public_update, bool)) fail();
  shape(v.draft, draftKeys);
  for (const link of v.draft.links) shape(link, ['label', 'url']);
  return v as HuntPageSave;
}
export function huntPageVisibilityInput(v: unknown): HuntPageVisibility {
  shape(v, [...intentKeys, 'expected_revision', 'expected_preview_revision', 'visibility', 'confirm_publication']); intent(v); media(v);
  if (!['public', 'private'].includes(String(v.visibility)) || !optional(v.confirm_publication, bool) ||
      (v.visibility === 'public' && v.confirm_publication !== true)) fail();
  return v as HuntPageVisibility;
}
export function huntPagePreviewInput(v: unknown): HuntPagePreviewRead {
  shape(v, ['expected_revision', 'expected_preview_revision', 'document_id', 'page']); media(v);
  if (!optional(v.document_id, nullableId) || !optional(v.page, p => integer(p, 1, 100))) fail(); return v as HuntPagePreviewRead;
}
export function huntPagePhotoInput(v: unknown): HuntPagePhotoSave {
  shape(v, [...intentKeys, 'expected_revision', 'expected_preview_revision', 'acknowledge_public_update']); intent(v); media(v);
  if (!optional(v.acknowledge_public_update, bool)) fail(); return v as HuntPagePhotoSave;
}
function workspace(v: unknown): v is HuntPageWorkspace {
  if (!record(v) || !record(v.page)) return false;
  const p = v.page;
  return revision(p.revision) && draft(p.draft) && ['public', 'private'].includes(String(p.visibility)) && bool(p.published) &&
    hash(p.preview_revision) && (p.public_path === null || string(p.public_path, 150)) && string(p.source_status, 100) &&
    (p.profile_status === null || string(p.profile_status, 100)) &&
    array(v.sources, 25, s => record(s) && uuid(s.id) && string(s.title, 255) && uuid(s.package_id) && string(s.package_title, 255) && bool(s.eligible) && (s.reason === null || string(s.reason, 100))) &&
    array(v.profiles, 25, s => record(s) && uuid(s.id) && string(s.name, 255) && (s.updated_at === null || string(s.updated_at, 40))) &&
    array(v.selected_documents, 20, s => record(s) && uuid(s.id) && revision(s.revision)) &&
    integer(v.sources_page, 1, 10000) && bool(v.sources_have_more) && bool(v.profiles_have_more);
}
export const huntPageResult = (v: unknown) => journeyResult(v, workspace);
export const huntPagePreviewResult = (v: unknown) => journeyResult(v, (v): v is HuntPagePreview => record(v) && uuid(v.document_id) &&
  revision(v.page_revision) && hash(v.preview_revision) && integer(v.page, 1, 100) && integer(v.pages, 1) &&
  Number(v.page) <= Number(v.pages) && array(v.image_chunks, 12, s => text(s, 64000)) && v.image_chunks.length > 0);
export function huntPagePreviewBytes(value: HuntPagePreview): Uint8Array {
  return privateJPEGBytes(value.image_chunks);
}

/** Rich current-workspace projection; retained v2 schemas stay exact. */
export type CurrentHuntPageState=HuntPageState&{user_id:string;published_at:string|null;published_snapshot_id:string|null;published_document_snapshots:Record<string,string>;has_unpublished_changes:boolean};
export type CurrentHuntPageWorkspace=Omit<HuntPageWorkspace,'page'|'sources'>&{page:CurrentHuntPageState;sources:(HuntPageWorkspace['sources'][number]&{archetype:string|null;published_at:string|null;snapshot_id:string|null;generation:string|null})[]};
export function currentHuntPageResult(v:unknown){return journeyResult(v,(value):value is CurrentHuntPageWorkspace=>{
 if(!workspace(value))return false;const p=value.page as unknown as Record<string,unknown>;
 return uuid(p.user_id)&&(p.published_at===null||string(p.published_at,40))&&(p.published_snapshot_id===null||hash(p.published_snapshot_id))&&bool(p.has_unpublished_changes)&&
  record(p.published_document_snapshots)&&Object.keys(p.published_document_snapshots).length<=20&&Object.entries(p.published_document_snapshots).every(([id,digest])=>uuid(id)&&hash(digest))&&
  value.sources.every(source=>{const s=source as unknown as Record<string,unknown>;return (s.archetype===null||string(s.archetype,100))&&(s.published_at===null||string(s.published_at,40))&&(s.snapshot_id===null||hash(s.snapshot_id))&&(s.generation===null||string(s.generation,40));});
 });}
