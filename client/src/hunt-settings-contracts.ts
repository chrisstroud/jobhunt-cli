/** Saved account preferences and read-only resumption, separate from Hunt criteria. */
import { record } from './protocol.ts';
import { fail, intent, intentKeys, integer, journeyResult, optional, resourceId, shape, text, uuid,
  type MutationIntent } from './journey-contracts.ts';
import { huntSummaryResult, type HuntSummary } from './hunt-contracts.ts';

export type HuntPreferences = {
  timezone?: string | null; tone?: 'neutral' | 'warm' | 'direct' | 'formal' | null;
  length?: 'concise' | 'standard' | 'detailed' | null; role_interests?: string[] | null;
  locations?: string[] | null; work_pattern?: 'remote' | 'hybrid' | 'onsite' | 'flexible' | null;
  preferred_resume_id?: string | null; follow_up_days?: number | null; quiet?: boolean | null;
};
export type PreferenceField = keyof HuntPreferences;
export type HuntPreferencesWrite = MutationIntent & { expected_revision: number; set: HuntPreferences; clear_fields: PreferenceField[] };
export type ConnectedHuntAccount = { id: string; name?: string; email?: string; nickname?: string };
export type ContextSummary = { id: string; kind: string; label: string; revision: number | null; website_url?: string | null };
export type HuntSettings = { account: ConnectedHuntAccount; revision: number; preferences: HuntPreferences;
  current_ids: string[]; hunts: { id: string; label: string; revision: number; preferred_resume_id: string | null }[];
  resumes: ContextSummary[]; more_hunts: boolean; more_resumes: boolean; unavailable: string[] };
export type HuntContext = { account: ConnectedHuntAccount; search: HuntSummary | null; resume: ContextSummary | null;
  preferences: HuntPreferences; choices: ContextSummary[]; missing: string[];
  next_actions: { kind: string; label: string; record_id?: string | null }[] };

const fields = ['timezone', 'tone', 'length', 'role_interests', 'locations', 'work_pattern', 'preferred_resume_id', 'follow_up_days', 'quiet'];
const list = (v: unknown, max: number, valid: (v: unknown) => boolean) => Array.isArray(v) && v.length <= max && v.every(valid);
const one = (v: unknown, values: string[]) => typeof v === 'string' && values.includes(v);
const enumValue = (v: unknown, values: string[]) => optional(v, x => one(x, values));
function preferences(v: unknown): v is HuntPreferences {
  return record(v) && Object.keys(v).every(k => fields.includes(k)) && optional(v.timezone, x => text(x, 80)) &&
    enumValue(v.tone, ['neutral', 'warm', 'direct', 'formal']) && enumValue(v.length, ['concise', 'standard', 'detailed']) &&
    optional(v.role_interests, x => list(x, 20, y => text(y, 255))) && optional(v.locations, x => list(x, 20, y => text(y, 255))) &&
    enumValue(v.work_pattern, ['remote', 'hybrid', 'onsite', 'flexible']) && optional(v.preferred_resume_id, resourceId) &&
    optional(v.follow_up_days, x => integer(x, 0, 365)) && optional(v.quiet, x => typeof x === 'boolean');
}
export function huntPreferencesInput(v: unknown): HuntPreferencesWrite {
  shape(v, [...intentKeys, 'expected_revision', 'set', 'clear_fields']); intent(v);
  if (!integer(v.expected_revision) || !preferences(v.set) || !list(v.clear_fields, 20, x => one(x, fields)) ||
    new Set(v.clear_fields as string[]).size !== (v.clear_fields as string[]).length ||
    (v.clear_fields as string[]).some(key => Object.hasOwn(v.set as object, key)) ||
    !(Object.keys(v.set).length || (v.clear_fields as string[]).length)) fail();
  if (!optional(v.set.preferred_resume_id, uuid)) fail();
  // The server owns timezone policy; validate its bounded string here without
  // imposing the local Node/ICU timezone database on another supported host.
  return v as HuntPreferencesWrite;
}
export function huntContextInput(v: unknown): { search_id?: string | null } {
  shape(v, ['search_id']); if (!optional(v.search_id, uuid)) fail(); return v as { search_id?: string | null };
}
const account = (v: unknown): v is ConnectedHuntAccount => record(v) && typeof v.id === 'string' && v.id.startsWith('jh_') && uuid(v.id.slice(3)) &&
  ['name', 'nickname'].every(k => v[k] === undefined || text(v[k], 255)) && (v.email === undefined || text(v.email, 320));
const summary = (v: unknown): v is ContextSummary => record(v) && resourceId(v.id) && text(v.kind, 40) && text(v.label, 255) && !!v.label &&
  (v.revision === null || integer(v.revision)) && optional(v.website_url, x => text(x, 2048));
const action = (v: unknown) => record(v) && text(v.kind, 40) && text(v.label, 255) && optional(v.record_id, resourceId);
export function huntSettingsResult(v: unknown): HuntSettings {
  if (!record(v) || !account(v.account) || !integer(v.revision) || !preferences(v.preferences) ||
    !list(v.current_ids, 100, resourceId) || !list(v.hunts, 50, x => record(x) && resourceId(x.id) && typeof x.label === 'string' &&
      integer(x.revision) && (x.preferred_resume_id === null || resourceId(x.preferred_resume_id))) ||
    !list(v.resumes, 50, summary) || typeof v.more_hunts !== 'boolean' || typeof v.more_resumes !== 'boolean' ||
    !list(v.unavailable, 3, x => one(x, ['current_hunt', 'preferred_resume', 'hunt_resume']))) fail(true);
  return v as HuntSettings;
}
export const huntPreferencesResult = (v: unknown) => journeyResult(v, preferences);
export const huntContextResult = (v: unknown) => journeyResult(v, (d): d is HuntContext => {
  if (!record(d) || !account(d.account) || !preferences(d.preferences) || !(d.resume === null || summary(d.resume)) ||
    !list(d.choices, 50, summary) || !list(d.missing, 20, x => text(x, 255)) || !list(d.next_actions, 3, action)) return false;
  if (d.search === null) return true;
  try { huntSummaryResult({ outcome: 'ready', data: d.search, next_action: { kind: 'none', label: '' } }); return true; }
  catch { return false; }
});
