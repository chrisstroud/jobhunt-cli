import { newCredentialFile, requireNewCredentialFile } from './credential-files.ts';
import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError, postingImportFileInput, postingImportPrivateIdentity } from '../../client/src/index.ts';
import { inputJSON } from './input.ts';
export const postingImportOptions: Record<string, string[]> = {
  'imports identity': ['file'], 'imports file': ['file'], 'imports export': ['file', 'output', 'confirm'],
  'imports list': ['before', 'limit'], 'imports get': [], 'imports start': ['file'], 'imports draft': ['file'],
  'imports open': ['file'], 'imports reconcile': ['file'], 'imports cancel': ['confirm'], 'imports stop': ['confirm'], 'imports cancel-request': ['file', 'confirm'],
};
export async function postingImportCommand(command: string, target: string | undefined, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'imports list') {
    if (options.limit !== undefined && (typeof options.limit !== 'string' || !/^\d+$/u.test(options.limit))) throw new JobHuntError('invalid_input');
    return client.postingImports.list({ before: options.before as string | undefined, limit: options.limit === undefined ? undefined : Number(options.limit) });
  }
  if (command === 'imports get') return client.postingImports.get({ attempt_id: target! });
  if (command === 'imports cancel' || command === 'imports stop') {
    if (!target || options.confirm !== target) throw new JobHuntError('confirmation_required');
    return command === 'imports stop' ? client.postingImports.stop({ attempt_id: target }) : client.postingImports.cancel({ attempt_id: target });
  }
  const value = await inputJSON(options.file as string | undefined, stdin, 1024 * 1024);
  if (command === 'imports identity') return postingImportPrivateIdentity(value as Parameters<typeof postingImportPrivateIdentity>[0]);
  if (command === 'imports file' || command === 'imports export') {
    const input = postingImportFileInput(value);
    if (command === 'imports file') return client.postingImports.files.manifest(input);
    if (options.confirm !== input.expected_account_id) throw new JobHuntError('confirmation_required');
    await requireNewCredentialFile(options.output);
    const { bytes, ...metadata } = await client.postingImports.files.download(input);
    await newCredentialFile(options.output, bytes);
    return { ...metadata, saved: true };
  }
  if (command === 'imports start') return client.postingImports.start(value as Parameters<typeof client.postingImports.start>[0]);
  if (command === 'imports draft') return client.postingImports.saveDraft(value as Parameters<typeof client.postingImports.saveDraft>[0]);
  if (command === 'imports open') return client.postingImports.open(value as Parameters<typeof client.postingImports.open>[0]);
  if (command === 'imports reconcile') return client.postingImports.reconcile(value as Parameters<typeof client.postingImports.reconcile>[0]);
  if (command === 'imports cancel-request') {
    if (!value || typeof value !== 'object' || options.confirm !== (value as { request_key?: string }).request_key) throw new JobHuntError('confirmation_required');
    return client.postingImports.cancelRequest(value as Parameters<typeof client.postingImports.cancelRequest>[0]);
  }
  throw new JobHuntError('usage_error');
}
