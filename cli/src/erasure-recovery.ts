import { ErasureRecoveryClient, erasureRecoveryFile, JobHuntError } from '../../client/src/index.ts';
import type { ClientOptions } from '../../client/src/index.ts';
import { credentialJSON } from './credential-files.ts';

export const erasureRecoveryOptions: Record<string, string[]> = {
  'account erasure-status': ['recovery-file'], 'account retry-erasure': ['recovery-file', 'confirm'],
  'account erasure-cleanup-binding': ['recovery-file'],
};
export async function erasureRecoveryCommand(command: string, options: Record<string, string | boolean | undefined>, context: ClientOptions & { origin: string }) {
  const file = erasureRecoveryFile(await credentialJSON(options['recovery-file']), context.origin);
  const client = new ErasureRecoveryClient(file, context);
  if (command === 'account erasure-status') return client.status();
  if (command === 'account erasure-cleanup-binding') return client.cleanupBinding();
  if (typeof options.confirm !== 'string') throw new JobHuntError('confirmation_required');
  return client.retry(options.confirm, true);
}
