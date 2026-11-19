/** Reviewed CRM workflows shared with the existing browser workspace. */
import { record, type JsonObject } from './protocol.ts';
import { deadline, fail, integer, intent, intentKeys, journeyResult, optional, resourceId, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type CrmKind = 'contact' | 'company';
export type CrmAction = 'create' | 'update' | 'delete' | 'note_save' | 'note_delete' |
  'interaction_save' | 'interaction_delete' | 'task_create' | 'link_application' |
  'unlink_application' | 'update_relationship';
export type CrmFields = {
  name?: string | null; title?: string | null; company?: string | null; company_id?: string | null;
  email?: string | null; phone?: string | null; linkedin_url?: string | null;
  description?: string | null; industry?: string | null; location?: string | null;
  size?: string | null; status?: 'target' | 'applied' | 'engaged' | 'closed';
  website?: string | null; is_target?: boolean;
};
export type CrmList = { kind: CrmKind; page?: number };
export type CrmRead = { kind: CrmKind; entity_id: string; related_page?: number };
export type CrmMutation = MutationIntent & {
  kind: CrmKind; action: CrmAction; entity_id?: string | null;
  expected_fingerprint?: string | null; fields?: CrmFields | null; item_id?: string | null;
  title?: string; body?: string; occurred_at?: string | null;
  interaction_type?: 'call' | 'email_received' | 'email_sent' | 'linkedin_message' | 'meeting' | 'text' | 'video_call';
  application_id?: string | null; expected_application_revision?: number | null;
  role?: 'recruiter' | 'hiring_manager' | 'interviewer' | 'referral' | 'other'; is_primary?: boolean;
};
export type CrmPage = { items: JsonObject[]; page: number; total: number; has_more: boolean };
export type CrmData = { workspace: JsonObject | null; fingerprint: string | null; entity_id: string;
  item_id: string | null; deleted: boolean; related_page?: number; related_has_more?: boolean;
  changed_item?: JsonObject | null };

const kind = (v: unknown): v is CrmKind => v === 'contact' || v === 'company';
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const nullableText = (v: unknown, max: number) => v === null || text(v, max);
const contactFields = ['name', 'title', 'company', 'company_id', 'email', 'phone', 'linkedin_url'];
const companyFields = ['name', 'description', 'industry', 'location', 'size', 'status', 'website', 'is_target'];
const actions: CrmAction[] = ['create', 'update', 'delete', 'note_save', 'note_delete',
  'interaction_save', 'interaction_delete', 'task_create', 'link_application', 'unlink_application', 'update_relationship'];
const linking = ['link_application', 'unlink_application', 'update_relationship'];
function publicLink(v: unknown) {
  if (v === null || v === '') return true;
  if (typeof v !== 'string') return false;
  try { const url = new URL(v); return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}

export function crmListInput(v: unknown): CrmList {
  shape(v, ['kind', 'page']);
  if (!kind(v.kind) || !optional(v.page, x => integer(x, 1, 10000)) || v.page === null) fail();
  return v as CrmList;
}
export function crmReadInput(v: unknown): CrmRead {
  shape(v, ['kind', 'entity_id', 'related_page']);
  if (!kind(v.kind) || !uuid(v.entity_id) || !optional(v.related_page, x => integer(x, 1, 10000)) || v.related_page === null) fail();
  return v as CrmRead;
}
export function crmMutationInput(v: unknown, expectedKind?: CrmKind): CrmMutation {
  shape(v, [...intentKeys, 'kind', 'action', 'entity_id', 'expected_fingerprint', 'fields', 'item_id', 'title', 'body',
    'interaction_type', 'occurred_at', 'application_id', 'expected_application_revision', 'role', 'is_primary']);
  intent(v);
  if (!kind(v.kind) || (expectedKind !== undefined && v.kind !== expectedKind) || !actions.includes(v.action as CrmAction) ||
      !optional(v.entity_id, uuid) || !optional(v.expected_fingerprint, hash) || !optional(v.item_id, resourceId) ||
      !optional(v.application_id, uuid) || !optional(v.expected_application_revision, integer) ||
      !(v.title === undefined || text(v.title, 255)) || !(v.body === undefined || text(v.body, 12000)) ||
      !optional(v.occurred_at, deadline) || !(v.is_primary === undefined || typeof v.is_primary === 'boolean') ||
      !(v.role === undefined || ['recruiter', 'hiring_manager', 'interviewer', 'referral', 'other'].includes(String(v.role))) ||
      !(v.interaction_type === undefined || ['call', 'email_received', 'email_sent', 'linkedin_message', 'meeting', 'text', 'video_call'].includes(String(v.interaction_type)))) fail();
  if (v.fields != null) {
    shape(v.fields, v.kind === 'contact' ? contactFields : companyFields);
    for (const [key, value] of Object.entries(v.fields)) {
      if (key === 'company_id') { if (!optional(value, uuid)) fail(); }
      else if (key === 'is_target') { if (typeof value !== 'boolean') fail(); }
      else if (key === 'status') { if (!['target', 'applied', 'engaged', 'closed'].includes(String(value))) fail(); }
      else {
        const max = key === 'description' ? 12000 : ['website', 'linkedin_url'].includes(key) ? 500 : ['phone', 'size'].includes(key) ? 50 : 255;
        if (!nullableText(value, max) || (['website', 'linkedin_url'].includes(key) && !publicLink(value))) fail();
      }
    }
    if (Object.hasOwn(v.fields, 'name') && (typeof v.fields.name !== 'string' || !v.fields.name.trim())) fail();
  }
  if (v.action === 'create') {
    if (v.entity_id || v.expected_fingerprint || !record(v.fields) || typeof v.fields.name !== 'string' || !v.fields.name.trim()) fail();
  } else if (!v.entity_id || !v.expected_fingerprint) fail();
  if (v.action === 'update' && (!record(v.fields) || !Object.keys(v.fields).length)) fail();
  if (['task_create', 'interaction_save'].includes(String(v.action)) && (typeof v.title !== 'string' || !v.title.trim())) fail();
  if (String(v.action).endsWith('_delete') && !v.item_id) fail();
  if (linking.includes(String(v.action)) && (v.kind !== 'contact' || !v.application_id || !v.expected_application_revision)) fail();
  if (String(v.action).startsWith('interaction') && v.kind !== 'contact') fail();
  return v as CrmMutation;
}

function summary(v: unknown, type: CrmKind): v is JsonObject {
  if (!record(v) || !uuid(v.id) || !text(v.name, 255) || !integer(v.applicationCount, 0)) return false;
  if (type === 'contact') return ['title', 'companyName', 'email'].every(key => nullableText(v[key], 255)) &&
    nullableText(v.phone, 50) && nullableText(v.linkedinUrl, 500) && optional(v.lastContactedAt, deadline);
  return nullableText(v.description, 12000) && ['industry', 'location', 'furthestStage'].every(key => nullableText(v[key], 255)) &&
    nullableText(v.size, 50) && nullableText(v.website, 500) && ['target', 'applied', 'engaged', 'closed'].includes(String(v.status)) &&
    typeof v.isTarget === 'boolean' && integer(v.contactCount, 0) && optional(v.lastActivity, deadline);
}
export function crmPageResult(v: unknown, type: CrmKind) {
  return journeyResult(v, (d): d is CrmPage => record(d) && Array.isArray(d.items) && d.items.length <= 20 &&
    d.items.every(item => summary(item, type)) && integer(d.page, 1, 10000) && integer(d.total, 0) && typeof d.has_more === 'boolean');
}
function data(v: unknown, type: CrmKind): v is CrmData {
  if (!record(v) || !uuid(v.entity_id) || typeof v.deleted !== 'boolean' || !optional(v.item_id, resourceId) ||
      !optional(v.changed_item, record)) return false;
  // The shared API excludes unset defaults. A deleted record has no related
  // page; omission must not turn an accepted deletion into an uncertain failure.
  if (v.deleted) return v.workspace === null && v.fingerprint === null &&
    (v.related_page === undefined || integer(v.related_page, 1, 10000)) &&
    (v.related_has_more === undefined || v.related_has_more === false);
  if (!integer(v.related_page, 1, 10000) || typeof v.related_has_more !== 'boolean' ||
      !hash(v.fingerprint) || !record(v.workspace) || !summary(v.workspace[type], type) ||
      (v.workspace[type] as JsonObject).id !== v.entity_id || v.workspace.truncated !== v.related_has_more) return false;
  const workspace = v.workspace;
  const lists = type === 'contact' ? ['tasks', 'notes', 'applications', 'timeline'] : ['tasks', 'notes', 'applications', 'contacts', 'activity'];
  return lists.every(key => Array.isArray(workspace[key]) && (workspace[key] as unknown[]).length <= 100 &&
    (workspace[key] as unknown[]).every(record));
}
export const crmDataResult = (v: unknown, type: CrmKind) => journeyResult(v, (d): d is CrmData => data(d, type));
