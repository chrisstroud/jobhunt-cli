/** Complete retained Hunt data and independently paginated native choices. */
import { record, type JsonObject } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, optional, shape, uuid } from './journey-contracts.ts';
import { huntReadInput, type HuntDelete } from './hunt-contracts.ts';

export type HuntWorkspaceRead = { search_id: string; hunts_page?: number; companies_page?: number; resumes_page?: number };
export type HuntWorkspaceRecord = { campaign: { id: string; type: 'job_search'; attributes: JsonObject }; fingerprint: string; revision: number };
export type HuntWorkspaceChoice = { databaseId: string; slug: string; name: string; status: string | null;
  archived: boolean; isCurrent: boolean; completedAt: string | null; outcome: string | null;
  currentStreak: number; longestStreak: number; applicationCount: number; lastActivityDate: string | null; revision: number };
export type HuntCompanyChoice = { id: string; name: string | null; industry: string | null; location: string | null };
export type HuntResumeChoice = { templateId: string; slug: string | null; name: string; isPrimary: boolean };
export type HuntChoicePage<T> = { items: T[]; page: number; total: number; has_more: boolean };
export type HuntWorkspace = HuntWorkspaceRecord & { campaigns: HuntChoicePage<HuntWorkspaceChoice>;
  companies: HuntChoicePage<HuntCompanyChoice>; resumes: HuntChoicePage<HuntResumeChoice> };
export type HuntDirectoryItem = { id: string; name: string; revision: number; status: 'active' | 'paused' | 'archived'; application_count: number; is_current: boolean };
export type HuntDirectory = HuntChoicePage<HuntDirectoryItem>;

const string = (v: unknown): v is string => typeof v === 'string';
const nullableString = (v: unknown) => v === null || string(v);
const digest = (v: unknown) => string(v) && /^[a-f0-9]{64}$/u.test(v);
const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export function workspaceReadInput(v: unknown): HuntWorkspaceRead {
  shape(v, ['search_id', 'hunts_page', 'companies_page', 'resumes_page']); huntReadInput({ search_id: v.search_id });
  for (const key of ['hunts_page', 'companies_page', 'resumes_page']) if (v[key] !== undefined && !integer(v[key], 1, 10000)) fail();
  return v as HuntWorkspaceRead;
}
export function originalDeleteInput(v: unknown): HuntDelete {
  shape(v, [...intentKeys, 'search_id', 'expected_revision', 'expected_application_count', 'migrate_to_id', 'expected_target_revision']); intent(v);
  if (!uuid(v.search_id) || !integer(v.expected_revision) || !integer(v.expected_application_count, 0) ||
    !optional(v.migrate_to_id, uuid) || !optional(v.expected_target_revision, integer)) fail();
  return v as HuntDelete;
}
function bounded<T>(value: unknown, page: number, check: (v: unknown) => v is T, id: (v: T) => string): value is HuntChoicePage<T> {
  if (!record(value) || value.page !== page || !integer(value.total, 0, Number.MAX_SAFE_INTEGER) ||
    typeof value.has_more !== 'boolean' || value.has_more !== (page * 25 < Number(value.total)) ||
    !Array.isArray(value.items) || value.items.length !== Math.min(25, Math.max(0, Number(value.total) - (page - 1) * 25)) || !value.items.every(check)) return false;
  return new Set(value.items.map(item => id(item as T))).size === value.items.length;
}
function workspaceRecord(value: unknown, input: { search_id: string }): value is HuntWorkspaceRecord {
  if (!record(value) || !digest(value.fingerprint) || !Number.isSafeInteger(value.revision) || !record(value.campaign)) return false;
  const campaign = value.campaign;
  if (!string(campaign.id) || campaign.type !== 'job_search' || !record(campaign.attributes)) return false;
  const attrs = campaign.attributes;
  return uuid(attrs.database_id) && sameId(attrs.database_id as string, input.search_id) && uuid(attrs.id) &&
    sameId(attrs.id as string, input.search_id) && attrs.slug === campaign.id && !Object.hasOwn(attrs, 'user_id') &&
    integer(attrs.application_count, 0, Number.MAX_SAFE_INTEGER);
}
function huntChoice(v: unknown): v is HuntWorkspaceChoice {
  return record(v) && uuid(v.databaseId) && string(v.slug) && string(v.name) && nullableString(v.status) &&
    typeof v.archived === 'boolean' && typeof v.isCurrent === 'boolean' && nullableString(v.completedAt) && nullableString(v.outcome) &&
    Number.isSafeInteger(v.currentStreak) && Number.isSafeInteger(v.longestStreak) && integer(v.applicationCount, 0) &&
    nullableString(v.lastActivityDate) && Number.isSafeInteger(v.revision);
}
function companyChoice(v: unknown): v is HuntCompanyChoice {
  return record(v) && uuid(v.id) && nullableString(v.name) && nullableString(v.industry) && nullableString(v.location);
}
function resumeChoice(v: unknown): v is HuntResumeChoice {
  return record(v) && uuid(v.templateId) && nullableString(v.slug) && string(v.name) && typeof v.isPrimary === 'boolean';
}
export const workspaceRecordResult = (value: unknown, input: { search_id: string }) => journeyResult(value, (v): v is HuntWorkspaceRecord => workspaceRecord(v, input));
export const workspaceResult = (value: unknown, input: HuntWorkspaceRead) => journeyResult(value, (v): v is HuntWorkspace =>
  workspaceRecord(v, input) && bounded((v as unknown as JsonObject).campaigns, input.hunts_page ?? 1, huntChoice, row => row.databaseId) &&
  bounded((v as unknown as JsonObject).companies, input.companies_page ?? 1, companyChoice, row => row.id) &&
  bounded((v as unknown as JsonObject).resumes, input.resumes_page ?? 1, resumeChoice, row => row.templateId));
function directoryItem(v: unknown): v is HuntDirectoryItem {
  return record(v) && uuid(v.id) && string(v.name) && integer(v.revision) && ['active', 'paused', 'archived'].includes(String(v.status)) &&
    integer(v.application_count, 0) && typeof v.is_current === 'boolean';
}
export const directoryResult = (value: unknown, page: number) => journeyResult(value, (v): v is HuntDirectory => bounded(v, page, directoryItem, row => row.id));
