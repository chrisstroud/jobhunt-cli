/** Wire contracts for the existing owned application workspace and records. */
import { record, type JsonObject } from './protocol.ts';
import { deadline, fail, integer, intent, intentKeys, journeyResult, operationResult, optional, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type ApplicationRecordKind = 'note' | 'task' | 'follow-up' | 'interview' | 'person';
export type ApplicationWorkspaceInput = { application_id: string };
export type ApplicationWorkspace = {
  account_id: string; application_id: string; revision: number;
  ledger: JsonObject; reminders: JsonObject[]; target?: JsonObject | null;
  unavailable: (ApplicationRecordKind | 'document')[]; fingerprints: Record<string, string>;
};
export type ApplicationRecordSaveInput = MutationIntent & {
  application_id: string; expected_revision: number; kind: ApplicationRecordKind;
  record_id?: string | null; expected_fingerprint?: string | null;
  title: string; body?: string; date?: string | null;
  status?: 'Open' | 'Completed' | 'Pending' | 'Skipped' | 'Contact' | 'Primary';
  location?: string; email?: string; phone?: string; linkedin_url?: string; format?: string;
  reminder_type?: 'follow_up' | 'interview_prep' | 'deadline' | 'check_in'; participants?: string[];
};
export type ApplicationRecordDeleteInput = MutationIntent & {
  application_id: string; expected_revision: number; kind: ApplicationRecordKind;
  record_id: string; expected_fingerprint: string;
};
export type ApplicationRecordSaved = { application_id: string; revision: number; record_id: string; deleted?: boolean;
  calendar_cleanup?: 'not_scheduled' | 'pending' | 'succeeded' | 'failed' | null };

export type ApplicationDeleteInput = MutationIntent & { application_id: string; expected_revision: number };
export type ApplicationTargetInput = ApplicationDeleteInput & { expected_target_revision: string; target_company: boolean };
export type ApplicationMutationSaved = { application_id: string; revision: number; deleted?: boolean };

export function applicationDeleteInput(value: unknown): ApplicationDeleteInput {
  shape(value, [...intentKeys, 'application_id', 'expected_revision']); intent(value);
  if (!uuid(value.application_id) || !integer(value.expected_revision)) fail();
  return value as ApplicationDeleteInput;
}
export function applicationTargetInput(value: unknown): ApplicationTargetInput {
  shape(value, [...intentKeys, 'application_id', 'expected_revision', 'expected_target_revision', 'target_company']); intent(value);
  if (!uuid(value.application_id) || !integer(value.expected_revision) || !fingerprint(value.expected_target_revision) || typeof value.target_company !== 'boolean') fail();
  return value as ApplicationTargetInput;
}
export function applicationMutationResult(value: unknown, input: ApplicationDeleteInput, deleted: boolean) {
  const result = journeyResult(value, (data): data is ApplicationMutationSaved => record(data) && data.application_id === input.application_id &&
    integer(data.revision) && data.revision === input.expected_revision + 1 &&
    (data.deleted === undefined || typeof data.deleted === 'boolean') && (data.deleted ?? false) === deleted);
  if (result.data && (result.operation?.kind !== (deleted ? 'delete_application_v2' : 'set_application_target_v2') ||
      result.operation.resource?.id?.toLowerCase() !== input.application_id.toLowerCase() || result.operation.resource?.revision !== result.data.revision ||
      result.website_url !== 'https://jobhunt.app/app')) fail(true);
  return result;
}

const kinds = ['note', 'task', 'follow-up', 'interview', 'person'];
const identifier = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u.test(value);
const fingerprint = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const targetKeys = ['application_id', 'expected_revision', 'kind', 'record_id', 'expected_fingerprint'];
function target(value: JsonObject) {
  intent(value);
  if (!uuid(value.application_id) || !integer(value.expected_revision) || !kinds.includes(String(value.kind))) fail();
}
export function applicationWorkspaceInput(value: unknown): ApplicationWorkspaceInput {
  shape(value, ['application_id']);
  if (!uuid(value.application_id)) fail();
  return value as ApplicationWorkspaceInput;
}
export function applicationRecordSaveInput(value: unknown): ApplicationRecordSaveInput {
  shape(value, [...intentKeys, ...targetKeys, 'title', 'body', 'date', 'status', 'location', 'email', 'phone', 'linkedin_url', 'format', 'reminder_type', 'participants']);
  target(value);
  const limits = { body: 12000, location: 2000, email: 255, phone: 50, linkedin_url: 2048, format: 30 };
  if (!text(value.title, 255) || !String(value.title).trim() ||
      Object.entries(limits).some(([key, limit]) => value[key] !== undefined && !text(value[key], limit)) ||
      !optional(value.record_id, identifier) || !optional(value.expected_fingerprint, fingerprint) ||
      Boolean(value.record_id) !== Boolean(value.expected_fingerprint) ||
      !optional(value.date, value => value === '' || deadline(value)) ||
      (value.status !== undefined && !['Open', 'Completed', 'Pending', 'Skipped', 'Contact', 'Primary'].includes(String(value.status))) ||
      (value.reminder_type !== undefined && !['follow_up', 'interview_prep', 'deadline', 'check_in'].includes(String(value.reminder_type))) ||
      (value.participants !== undefined && (!Array.isArray(value.participants) || value.participants.length > 30 || !value.participants.every(identifier)))) fail();
  // The server owns kind-specific statuses, date rules and relationship access.
  return value as ApplicationRecordSaveInput;
}
export function applicationRecordDeleteInput(value: unknown): ApplicationRecordDeleteInput {
  shape(value, [...intentKeys, ...targetKeys]); target(value);
  if (!identifier(value.record_id) || !fingerprint(value.expected_fingerprint)) fail();
  return value as ApplicationRecordDeleteInput;
}
function workspace(value: unknown): value is ApplicationWorkspace {
  if (!record(value) || !uuid(value.application_id) || !integer(value.revision) ||
      typeof value.account_id !== 'string' || !value.account_id.startsWith('jh_') || !uuid(value.account_id.slice(3)) ||
      !record(value.ledger) || !record(value.ledger.application) || value.ledger.application.uuid !== value.application_id ||
      !Array.isArray(value.reminders) || value.reminders.length > 200 || !value.reminders.every(record) ||
      !optional(value.target, record) || !Array.isArray(value.unavailable) || value.unavailable.length > 6 ||
      !value.unavailable.every(kind => [...kinds, 'document'].includes(String(kind))) ||
      !record(value.fingerprints) || Object.keys(value.fingerprints).length > 1200 ||
      !Object.entries(value.fingerprints).every(([key, stamp]) => {
        const [kind, id, extra] = key.split(':');
        return kinds.includes(kind) && identifier(id) && extra === undefined && fingerprint(stamp);
      })) return false;
  return true;
}
function saved(value: unknown): value is ApplicationRecordSaved {
  return record(value) && uuid(value.application_id) && integer(value.revision) && identifier(value.record_id) &&
    (value.deleted === undefined || typeof value.deleted === 'boolean') && optional(value.calendar_cleanup,
      state => ['not_scheduled', 'pending', 'succeeded', 'failed'].includes(String(state)));
}
export const applicationWorkspaceResult = (value: unknown) => journeyResult(value, workspace);
export const applicationRecordResult = (value: unknown) => journeyResult(value, saved);


/** Exact application deletion evidence does not consult a later/missing source. */
export type ApplicationDeletionOriginal = { expected_account_id: string; original: ApplicationDeleteInput };
export type ApplicationDeletionClosure = { request_id: string; application_id: string; payload_hash: string; outcome: 'closed' | 'recorded' | 'expired' };
export function applicationDeletionOriginal(value: unknown): ApplicationDeletionOriginal {
  shape(value, ['expected_account_id', 'original']);
  if (typeof value.expected_account_id !== 'string' || !/^jh_[a-f0-9-]+$/u.test(value.expected_account_id)
    || !uuid(value.expected_account_id.slice(3))) fail();
  const original = applicationDeleteInput(value.original);
  if (original.expected_account_id != null && original.expected_account_id !== value.expected_account_id) fail();
  return JSON.parse(JSON.stringify({ expected_account_id: value.expected_account_id,
    original: { ...original, request_id: original.request_id.toLowerCase() } })) as ApplicationDeletionOriginal;
}
export async function applicationDeletionRead(input: ApplicationDeletionOriginal) {
  const captured = applicationDeletionOriginal(input);
  const { stableJsonValue } = await import('./native-json.ts');
  const { digest } = await import('./highlight-file-contracts.ts');
  return { expected_account_id: captured.expected_account_id, operation_name: 'delete_application_v2',
    request_id: captured.original.request_id,
    expected_payload_hash: await digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(captured.original)))) };
}
export async function applicationDeletionReceipt(value: unknown, input: ApplicationDeletionOriginal) {
  const captured = applicationDeletionOriginal(input), read = await applicationDeletionRead(captured);
  const result = operationResult(value), operation = result.data;
  if (result.outcome !== 'ready' || !operation || operation.kind !== 'delete_application_v2'
    || operation.status !== 'succeeded' || operation.resource?.kind !== 'application'
    || operation.resource.id !== captured.original.application_id
    || operation.resource.revision !== captured.original.expected_revision + 1
    || operation.retry_after_seconds !== 0 || operation.error != null) fail(true);
  return { request_id: read.request_id, application_id: captured.original.application_id,
    payload_hash: read.expected_payload_hash, operation_id: operation.id };
}
export async function applicationDeletionClosure(value: unknown, input: ApplicationDeletionOriginal) {
  const captured = applicationDeletionOriginal(input), read = await applicationDeletionRead(captured);
  const parsed = journeyResult(value, (data): data is ApplicationDeletionClosure => record(data)
    && data.request_id === captured.original.request_id && data.application_id === captured.original.application_id
    && data.payload_hash === read.expected_payload_hash && ['closed', 'recorded', 'expired'].includes(String(data.outcome)));
  if (parsed.outcome !== 'ready' || !parsed.data) fail(true);
  return parsed.data;
}
