import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { extensionReviewInput, extensionRevokeInput } from '../../client/src/extension-connections.ts';
import { inputJSON } from './input.ts';
export const extensionOptions: Record<string, string[]> = {
  'extensions list': ['after'], 'extensions get': [], 'extensions review-revoke': ['file'],
  'extensions revoke': ['file', 'confirm'], 'extensions check-revoke': ['file'], 'extensions close-revoke': ['file', 'confirm'],
};
export async function extensionCommand(command: string, target: string | undefined, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'extensions list') return client.extensions.list({ after: options.after as string | undefined });
  if (command === 'extensions get') return client.extensions.get({ token_id: target! });
  const input = await inputJSON(options.file as string | undefined, stdin, 32768);
  if (command === 'extensions review-revoke') return client.extensions.review(extensionReviewInput(input));
  const original = extensionRevokeInput(input);
  if (command === 'extensions check-revoke') return client.extensions.check(original);
  if (options.confirm !== original.token_id) throw new JobHuntError('confirmation_required');
  return command === 'extensions revoke' ? client.extensions.revoke(original) : client.extensions.close(original);
}
