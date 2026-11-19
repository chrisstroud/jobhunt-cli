/** Owned reusable identities; account login details remain a separate resource. */
import { record, type JsonObject } from './protocol.ts';
import { stableJsonValue } from './native-json.ts';
import { digest } from './highlight-file-contracts.ts';
import { fail, integer, intent, intentKeys, journeyResult, operationResult, optional, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type ProfileSummary = { id: string; name: string; is_default: boolean; updated_at: string | null;
  linked_package_count: number; linked_hunt_page: boolean; public_use: boolean };
export type ContactProfile = ProfileSummary & { personal_data: JsonObject; usage_revision: string };
export type ProfilePage = { items: ProfileSummary[]; page: number; total: number; has_more: boolean; default_profile_id: string | null };
export type ProfileSaved = { profile_id: string; profile: ContactProfile | null; default_profile_id: string | null };
export type ProfilePersonal = { id: string; name: string; personal_data: JsonObject; updated_at: string | null; public_use: boolean };
export type ProfilePersonalSave = MutationIntent & { profile_id: string; expected_updated_at: string | null;
  personal_data: JsonObject; acknowledge_linked_updates: true };
export type ProfileIdentity = ProfilePersonal & { is_default: boolean; linked_package_count: number; linked_hunt_page: boolean };
export type ProfileIdentitySave = Omit<ProfileSave, 'expected_default_profile_id'>;
export type ProfileDirectoryItem = { id: string; name: string; is_default: boolean; updated_at: string | null;
  linked_package_count: number; linked_hunt_page: boolean };
export type ProfileDirectory = { items: ProfileDirectoryItem[]; page: number; total: number; has_more: boolean };
export type ProfilePageRead = { page?: number };
export type ProfileLinksRead = ProfilePageRead & { profile_id: string };
export type ProfileSave = MutationIntent & { profile_id?: string | null; expected_updated_at?: string | null;
  expected_default_profile_id: string | null; name: string; personal_data: JsonObject; is_default: boolean; acknowledge_linked_updates: true };
export type ProfileDefault = MutationIntent & { profile_id: string; expected_updated_at: string | null; expected_default_profile_id: string | null };
export type ProfileDelete = ProfileDefault & { expected_usage_revision: string; confirm_delete: true; acknowledge_retained_copies: true };
export type ProfileLink = MutationIntent & { document_id: string; expected_revision: number; profile_id: string;
  expected_profile_updated_at: string | null; acknowledge_linked_updates: true };
export type ProfileUnlink = MutationIntent & { document_id: string; expected_revision: number; expected_profile_id: string;
  expected_profile_updated_at: string | null; acknowledge_retained_copies: true };
export type ProfileLinksSave = MutationIntent & { profile_id: string; expected_profile_updated_at: string | null;
  documents: { document_id: string; expected_revision: number }[]; acknowledge_linked_updates: true };
export type PackageProfileBinding = { document_id: string; name: string | null; revision: number | null; profile_id: string | null; exists: boolean };
export type ProfileLinks = { profile_id: string; usage_revision: string; items: PackageProfileBinding[]; page: number; total: number; has_more: boolean };
export type ProfileBindingsSaved = { items: PackageProfileBinding[] };
export type ProfilePhotoWrite = MutationIntent & { profile_id: string; expected_updated_at: string | null; acknowledge_linked_updates: true };
export type ProfilePhoto = { photo_id: string; image_chunks: string[] };
export const MAX_PROFILE_PNG_BYTES = 367500;

const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const bool = (v: unknown) => typeof v === 'boolean';
const nullableId = (v: unknown) => v === null || uuid(v);
const version = (v: unknown) => v === null || (typeof v === 'string' && v.length <= 40 &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?$/u.test(v));
const array = (v: unknown, max: number, check: (v: unknown) => boolean, min = 0): v is unknown[] =>
  Array.isArray(v) && v.length >= min && v.length <= max && v.every(check);
function personal(v: unknown): v is JsonObject {
  if (!record(v)) return false;
  try { return new TextEncoder().encode(JSON.stringify(v)).length <= 100000; } catch { return false; }
}
export function profilePageInput(v: unknown): ProfilePageRead {
  shape(v, ['page']); if (v.page !== undefined && !integer(v.page, 1, 10000)) fail(); return v as ProfilePageRead;
}
export function profileReadInput(id: unknown) {
  if (!uuid(id)) fail(); return { profile_id: id as string };
}
export function profileLinksInput(v: unknown): ProfileLinksRead {
  shape(v, ['profile_id', 'page']); profileReadInput(v.profile_id); profilePageInput({ page: v.page }); return v as ProfileLinksRead;
}
export function profileSaveInput(v: unknown): ProfileSave {
  shape(v, [...intentKeys, 'profile_id', 'expected_updated_at', 'expected_default_profile_id', 'name', 'personal_data', 'is_default', 'acknowledge_linked_updates']); intent(v);
  if (!optional(v.profile_id, uuid) || !optional(v.expected_updated_at, version) || !nullableId(v.expected_default_profile_id) ||
      !text(v.name, 50) || !(v.name as string).trim() || !personal(v.personal_data) || !bool(v.is_default) || v.acknowledge_linked_updates !== true ||
      (v.profile_id != null && !Object.hasOwn(v, 'expected_updated_at'))) fail();
  return v as ProfileSave;
}
export function profileIdentitySaveInput(v: unknown): ProfileIdentitySave {
  shape(v, [...intentKeys, 'profile_id', 'expected_updated_at', 'name', 'personal_data', 'is_default', 'acknowledge_linked_updates']); intent(v);
  if (!optional(v.profile_id, uuid) || !optional(v.expected_updated_at, version) || !text(v.name, 50) || !(v.name as string).trim() ||
    !personal(v.personal_data) || !bool(v.is_default) || v.acknowledge_linked_updates !== true) fail();
  return v as ProfileIdentitySave;
}
export function profileIdentityResult(value: unknown, input: ProfileIdentitySave) {
  return journeyResult(value, (v): v is ProfileIdentity => record(v) && uuid(v.id) &&
    (input.profile_id == null || v.id === input.profile_id.toLowerCase()) && typeof v.name === 'string' &&
    [...v.name].length <= 50 && record(v.personal_data) && version(v.updated_at) && bool(v.public_use) &&
    bool(v.is_default) && integer(v.linked_package_count, 0) && bool(v.linked_hunt_page));
}
export function profileDirectoryResult(value: unknown, page: number) {
  return journeyResult(value, (v): v is ProfileDirectory => record(v) && integer(v.total, 0) && v.page === page &&
    typeof v.has_more === 'boolean' && v.has_more === (page * 20 < Number(v.total)) &&
    array(v.items, 20, item => record(item) && uuid(item.id) && typeof item.name === 'string' &&
      typeof item.is_default === 'boolean' && version(item.updated_at) && integer(item.linked_package_count, 0) && typeof item.linked_hunt_page === 'boolean') &&
    v.items.length === Math.min(20, Math.max(0, Number(v.total) - (page - 1) * 20)) &&
    new Set(v.items.map(item => (item as ProfileDirectoryItem).id)).size === v.items.length);
}
export function profilePersonalSaveInput(v: unknown): ProfilePersonalSave {
  shape(v, [...intentKeys, 'profile_id', 'expected_updated_at', 'personal_data', 'acknowledge_linked_updates']); intent(v);
  if (!uuid(v.profile_id) || !version(v.expected_updated_at) || !personal(v.personal_data) || v.acknowledge_linked_updates !== true) fail();
  return v as ProfilePersonalSave;
}
export function profilePersonalResult(value: unknown, id: string) {
  return journeyResult(value, (v): v is ProfilePersonal => record(v) && uuid(v.id) && v.id === id.toLowerCase() &&
    typeof v.name === 'string' && [...v.name].length <= 50 && record(v.personal_data) && version(v.updated_at) && bool(v.public_use));
}
export function profileDefaultInput(v: unknown): ProfileDefault {
  shape(v, [...intentKeys, 'profile_id', 'expected_updated_at', 'expected_default_profile_id']); intent(v);
  if (!uuid(v.profile_id) || !version(v.expected_updated_at) || !nullableId(v.expected_default_profile_id)) fail(); return v as ProfileDefault;
}
export function profileDeleteInput(v: unknown): ProfileDelete {
  shape(v, [...intentKeys, 'profile_id', 'expected_updated_at', 'expected_default_profile_id', 'expected_usage_revision', 'confirm_delete', 'acknowledge_retained_copies']); intent(v);
  if (!uuid(v.profile_id) || !version(v.expected_updated_at) || !nullableId(v.expected_default_profile_id) || !hash(v.expected_usage_revision) ||
      v.confirm_delete !== true || v.acknowledge_retained_copies !== true) fail(); return v as ProfileDelete;
}
export function profileLinkInput(v: unknown): ProfileLink {
  shape(v, [...intentKeys, 'document_id', 'expected_revision', 'profile_id', 'expected_profile_updated_at', 'acknowledge_linked_updates']); intent(v);
  if (!uuid(v.document_id) || !integer(v.expected_revision) || !uuid(v.profile_id) || !version(v.expected_profile_updated_at) || v.acknowledge_linked_updates !== true) fail();
  return v as ProfileLink;
}
/** Capture the validated scalar binding before hashing or network work. Only the
 * request UUID is normalized by the existing backend model; resource spelling
 * remains part of the original payload hash. */
export function captureProfileLink(value: unknown): ProfileLink {
  const captured = structuredClone(profileLinkInput(value));
  captured.request_id = captured.request_id.toLowerCase();
  return captured;
}
export async function prepareProfileLink(value: ProfileLink) {
  const captured = captureProfileLink(value);
  const payloadHash = await digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(captured))));
  return { captured, read: { operation_name: 'link_document_package_profile_v2', request_id: captured.request_id,
    ...(captured.expected_account_id !== undefined ? { expected_account_id: captured.expected_account_id } : {}),
    expected_payload_hash: payloadHash } };
}
export function profileLinkReceipt(value: unknown, input: ProfileLink) {
  const result = operationResult(value), operation = result.data;
  if (result.outcome !== 'ready' || !operation || operation.kind !== 'link_document_package_profile_v2'
    || operation.status !== 'succeeded' || operation.error != null || result.error != null
    || operation.retry_after_seconds !== 0 || operation.resource?.kind !== 'document'
    || !uuid(operation.resource.id) || operation.resource.id.toLowerCase() !== input.document_id.toLowerCase()
    || !integer(operation.resource.revision) || Number(operation.resource.revision) <= input.expected_revision) fail(true);
  return { operationId: operation.id, documentId: operation.resource.id, revision: Number(operation.resource.revision) };
}
export function profileUnlinkInput(v: unknown): ProfileUnlink {
  shape(v, [...intentKeys, 'document_id', 'expected_revision', 'expected_profile_id', 'expected_profile_updated_at', 'acknowledge_retained_copies']); intent(v);
  if (!uuid(v.document_id) || !integer(v.expected_revision) || !uuid(v.expected_profile_id) || !version(v.expected_profile_updated_at) || v.acknowledge_retained_copies !== true) fail();
  return v as ProfileUnlink;
}
export function profileLinksSaveInput(v: unknown): ProfileLinksSave {
  shape(v, [...intentKeys, 'profile_id', 'expected_profile_updated_at', 'documents', 'acknowledge_linked_updates']); intent(v);
  if (!uuid(v.profile_id) || !version(v.expected_profile_updated_at) || v.acknowledge_linked_updates !== true ||
      !array(v.documents, 20, item => record(item) && uuid(item.document_id) && integer(item.expected_revision), 1)) fail();
  for (const item of v.documents) shape(item, ['document_id', 'expected_revision']);
  if (new Set(v.documents.map(item => (item as { document_id: string }).document_id)).size !== v.documents.length) fail();
  return v as ProfileLinksSave;
}
export function profilePhotoInput(v: unknown): ProfilePhotoWrite {
  shape(v, [...intentKeys, 'profile_id', 'expected_updated_at', 'acknowledge_linked_updates']); intent(v);
  if (!uuid(v.profile_id) || !version(v.expected_updated_at) || v.acknowledge_linked_updates !== true) fail(); return v as ProfilePhotoWrite;
}
function summary(v: unknown): v is ProfileSummary {
  return record(v) && uuid(v.id) && text(v.name, 50) && bool(v.is_default) && version(v.updated_at) &&
    integer(v.linked_package_count, 0) && bool(v.linked_hunt_page) && bool(v.public_use);
}
function details(v: unknown): v is ContactProfile {
  return record(v) && personal(v.personal_data) && hash(v.usage_revision) && summary(v);
}
function binding(v: unknown): v is PackageProfileBinding {
  return record(v) && uuid(v.document_id) && bool(v.exists) && nullableId(v.profile_id) &&
    (v.name === null || text(v.name, 255)) && (v.revision === null || integer(v.revision));
}
export const profilePageResult = (v: unknown) => journeyResult(v, (v): v is ProfilePage => record(v) && array(v.items, 20, summary) &&
  integer(v.page, 1, 10000) && integer(v.total, 0) && bool(v.has_more) && nullableId(v.default_profile_id));
export const profileResult = (v: unknown) => journeyResult(v, details);
export const profileSavedResult = (v: unknown) => journeyResult(v, (v): v is ProfileSaved => record(v) && uuid(v.profile_id) &&
  (v.profile === null || (details(v.profile) && v.profile.id === v.profile_id)) && nullableId(v.default_profile_id));
export const profileLinksResult = (v: unknown) => journeyResult(v, (v): v is ProfileLinks => record(v) && uuid(v.profile_id) && hash(v.usage_revision) &&
  array(v.items, 20, binding) && integer(v.page, 1, 10000) && integer(v.total, 0) && bool(v.has_more));
export const profileBindingsResult = (v: unknown) => journeyResult(v, (v): v is ProfileBindingsSaved => record(v) && array(v.items, 20, binding));
export const profilePhotoResult = (v: unknown) => journeyResult(v, (v): v is ProfilePhoto => record(v) && uuid(v.photo_id) &&
  array(v.image_chunks, 12, item => text(item, 64000), 1));

function png(bytes: Uint8Array, maximum: number, response = false) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 24 || bytes.length > maximum ||
      ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte) ||
      ![73, 72, 68, 82].every((byte, i) => bytes[i + 12] === byte)) fail(response);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const edge = response ? 512 : 1024;
  if (!integer(view.getUint32(16), 1, edge) || !integer(view.getUint32(20), 1, edge)) fail(response);
}
export function photoChunks(bytes: Uint8Array): string[] {
  png(bytes, MAX_PROFILE_PNG_BYTES);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  const encoded = btoa(binary);
  return Array.from({ length: Math.ceil(encoded.length / 64000) }, (_, index) => encoded.slice(index * 64000, (index + 1) * 64000));
}
export function photoBytes(value: ProfilePhoto): Uint8Array {
  const encoded = value.image_chunks.join(''); const prefix = 'data:image/png;base64,';
  if (!encoded.startsWith(prefix) || encoded.length > 750000) fail(true);
  const base64 = encoded.slice(prefix.length);
  if (base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(base64)) fail(true);
  let bytes: Uint8Array;
  try {
    const binary = atob(base64);
    if (btoa(binary) !== base64) fail(true);
    bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch { fail(true); }
  png(bytes!, 562500, true); return bytes!;
}

/** Full identity JSON is checked by the authoritative backend canonicalizer. */
export type ProfileIdentityOriginal={expected_account_id:string;original:ProfileIdentitySave};
export function captureProfileIdentityOriginal(value:unknown):ProfileIdentityOriginal {
 shape(value,['expected_account_id','original']);
 if(typeof value.expected_account_id!=='string'||!value.expected_account_id.startsWith('jh_')||!uuid(value.expected_account_id.slice(3)))fail();
 if(!record(value.original))fail();
 const absentVersion=value.original.profile_id!=null&&!Object.hasOwn(value.original,'expected_updated_at');
 const original=structuredClone(profileIdentitySaveInput({...value.original,...(absentVersion?{expected_updated_at:null}:{})}));
 if(absentVersion)delete original.expected_updated_at;
 if(original.expected_account_id!=null&&original.expected_account_id!==value.expected_account_id)fail();
 return {expected_account_id:value.expected_account_id,original};
}
export function profileIdentityReceipt(value:unknown,input:ProfileIdentityOriginal) {
 const result=operationResult(value),operation=result.data;
 if(result.outcome!=='ready'||result.error!=null||!operation||operation.kind!=='save_hunt_profile_v2'||operation.status!=='succeeded'
  ||operation.error!=null||operation.retry_after_seconds!==0||operation.resource?.kind!=='profile'||!uuid(operation.resource.id)||operation.resource.revision!==null
  ||input.original.profile_id!=null&&operation.resource.id.toLowerCase()!==input.original.profile_id.toLowerCase())fail(true);
 return {operationId:operation.id,profileId:operation.resource.id};
}

/** Preserve lexical JSON numbers from originals produced outside JavaScript. */
export function captureProfileIdentitySource(bytes:Uint8Array) {
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>524288)fail();
 const source=new Uint8Array(bytes);
 let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(source));}catch{fail();}
 if(!record(value)||!record(value.original)||!record(value.original.personal_data))fail();
 // The backend enforces the full personal-data size/schema on the unchanged wire.
 // Re-encoding parsed numbers here could expand, round or change int/float types.
 const captured=captureProfileIdentityOriginal({...value,original:{...value.original,personal_data:{}}});
 captured.original.personal_data=value.original.personal_data;
 return {source,captured};
}
