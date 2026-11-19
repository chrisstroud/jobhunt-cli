/** Separate, origin-bound authority that survives account access revocation. */
import { JobHuntClient, normalizeOrigin, type ClientOptions } from './index.ts';
import { JobHuntError, record } from './protocol.ts';
import { uuid } from './journey-contracts.ts';

export type ErasureRecoveryFile = { kind: 'jobhunt-erasure-recovery'; version: 1; origin: string; receipt: string };
export type ErasureCleanupBinding = { version: 1; request_id: string; binding_id: string; account_digest: string; import_scope: string };
export function erasureCleanupBinding(value: unknown): ErasureCleanupBinding {
  if (!record(value) || Object.keys(value).sort().join() !== 'account_digest,binding_id,import_scope,request_id,version'
    || value.version !== 1 || !uuid(value.request_id)
    || [value.binding_id, value.account_digest, value.import_scope].some(v => typeof v !== 'string' || !/^[0-9a-f]{64}$/u.test(v))) throw new JobHuntError('invalid_response');
  return value as ErasureCleanupBinding;
}
/** Matching local keys is not authentication, proof of server deletion completion or permission to dispatch a mutation. */
export async function erasureCleanupMatches(value: ErasureCleanupBinding, accountId: string) {
  const binding = { ...erasureCleanupBinding(value) };
  if (!accountId.startsWith('jh_') || !uuid(accountId.slice(3))) throw new JobHuntError('invalid_input');
  const raw = new TextEncoder().encode('jobhunt-private-cleanup-v1\0' + binding.binding_id + '\0' + accountId);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), b => b.toString(16).padStart(2, '0')).join('');
  return digest === binding.account_digest;
}
export type ErasureRecoveryStatus = {
  status: 'pending' | 'running' | 'failed' | 'completed'; stage: string; request_id: string;
  retryable: boolean; completed_at: string | null;
  cleanup_status: 'not_required' | 'monitoring' | 'running' | 'retrying';
  cleanup_last_checked_at: string | null; retained_categories: string[]; retained_reference: boolean;
};
export function erasureRecoveryFile(value: unknown, origin: string): ErasureRecoveryFile {
  if (!record(value) || Object.keys(value).length !== 4 || value.kind !== 'jobhunt-erasure-recovery' ||
    value.version !== 1 || value.origin !== origin || typeof value.receipt !== 'string' ||
    !/^[A-Za-z0-9._~-]{32,4096}$/u.test(value.receipt)) throw new JobHuntError('invalid_recovery_file');
  return value as ErasureRecoveryFile;
}
function result(value: unknown): ErasureRecoveryStatus {
  if (!record(value) || value.ok !== true || Object.keys(value).length !== 2 || !record(value.erasure)) throw new JobHuntError('invalid_response');
  const state = value.erasure;
  const fields = ['status', 'stage', 'request_id', 'retryable', 'completed_at', 'cleanup_status',
    'cleanup_last_checked_at', 'retained_categories', 'retained_reference'];
  const time = (v: unknown) => v === null || typeof v === 'string' && v.length <= 64 && Number.isFinite(Date.parse(v));
  if (Object.keys(state).length !== fields.length || Object.keys(state).some(k => !fields.includes(k)) ||
    !['pending', 'running', 'failed', 'completed'].includes(String(state.status)) ||
    typeof state.stage !== 'string' || !/^[a-z_]{1,80}$/u.test(state.stage) || !uuid(state.request_id) ||
    typeof state.retryable !== 'boolean' || !time(state.completed_at) || !time(state.cleanup_last_checked_at) ||
    !['not_required', 'monitoring', 'running', 'retrying'].includes(String(state.cleanup_status)) ||
    !Array.isArray(state.retained_categories) || state.retained_categories.length > 20 ||
    state.retained_categories.some(v => typeof v !== 'string' || v.length > 200) || typeof state.retained_reference !== 'boolean') {
    throw new JobHuntError('invalid_response');
  }
  return state as ErasureRecoveryStatus;
}
export class ErasureRecoveryClient {
  private readonly client: JobHuntClient;
  constructor(file: ErasureRecoveryFile, options: Omit<ClientOptions, 'credential'> = {}) {
    const origin = normalizeOrigin(options.origin ?? file.origin, options.allowLoopback);
    const checked = erasureRecoveryFile(file, origin);
    this.client = new JobHuntClient({ ...options, origin, credential: { origin, token: checked.receipt } });
  }
  async status() { return result(await this.client.request('/api/v1/account-erasure/status')); }
  async cleanupBinding() {
    const value = await this.client.request('/api/v1/account-erasure/cleanup-binding');
    if (!record(value) || value.ok !== true || Object.keys(value).sort().join() !== 'binding,ok') throw new JobHuntError('invalid_response');
    return erasureCleanupBinding(value.binding);
  }
  async retry(requestId: string, confirmRetry: true) {
    if (!uuid(requestId) || confirmRetry !== true) throw new JobHuntError('confirmation_required');
    return result(await this.client.request('/api/v1/account-erasure/retry', {
      method: 'POST', body: { request_id: requestId, confirm_retry: true },
    }));
  }
}
