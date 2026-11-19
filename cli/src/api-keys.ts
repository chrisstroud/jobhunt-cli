import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { keyReceiptInput, keyReviewInput, keyRevokeInput } from '../../client/src/api-keys.ts';
import { inputJSON } from './input.ts';
import { newCredentialFile, requireNewCredentialFile } from './credential-files.ts';

export const apiKeyOptions: Record<string, string[]> = {
  'api-keys list': ['after'], 'api-keys get': [], 'api-keys review-revoke': ['file'],
  'api-keys revoke': ['file', 'confirm'], 'api-keys check-revoke': ['file'],
  'api-keys close-revoke': ['file', 'confirm'],
  'api-keys list-summary': ['after'], 'api-keys get-summary': [],
  'api-keys download-permissions': ['output'], 'api-keys review-revoke-summary': ['file'],
};
export const apiKeyTargets = new Set(['api-keys get', 'api-keys get-summary', 'api-keys download-permissions']);
export async function apiKeyCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'api-keys list') return client.apiKeys.list(options.after === undefined ? {} : { after: options.after as string });
  if (command === 'api-keys get') return client.apiKeys.get({ key_id: target! });
  if (command === 'api-keys list-summary') return client.apiKeys.metadata.list(options.after === undefined ? {} : { after: options.after as string });
  if (command === 'api-keys get-summary') return client.apiKeys.metadata.get({ key_id: target! });
  if (command === 'api-keys download-permissions') {
    await requireNewCredentialFile(options.output);
    const value = await client.apiKeys.metadata.downloadScopes({ key_id: target! });
    await newCredentialFile(options.output, value.bytes);
    return { saved: true, account_id: value.summary.scopes_file.account_id, key_id: value.summary.id,
      fingerprint: value.summary.fingerprint, scope_count: value.scopes.length,
      size_bytes: value.bytes.length, sha256: value.summary.scopes_file.sha256 };
  }
  const value = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'api-keys review-revoke') return client.apiKeys.reviewRevocation(keyReviewInput(value));
  if (command === 'api-keys review-revoke-summary') return client.apiKeys.metadata.reviewRevocation(keyReviewInput(value));
  if (command === 'api-keys check-revoke') return client.apiKeys.checkRevocation(keyReceiptInput(value));
  const args = keyRevokeInput(value);
  if (options.confirm !== args.key_id) throw new JobHuntError('confirmation_required');
  if (command === 'api-keys close-revoke') return client.apiKeys.closeRevocation({ original: args, confirm_close: true });
  return client.apiKeys.revoke(args);
}
