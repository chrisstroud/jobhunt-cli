import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { compensationAppend, compensationDraftWrite, compensationMaxBytes, compensationPrepare,
  compensationReplaceIntent } from '../../client/src/compensation-contracts.ts';
import { inputBytes, inputJSON } from './input.ts';
import { privateOutput } from './private-output.ts';

export const compensationOptions: Record<string, string[]> = {
  'applications compensation': [], 'applications compensation-download': ['output'],
  'applications compensation-replace': ['intent', 'file', 'confirm'],
  'applications compensation-draft': ['draft-id'],
  'applications compensation-prepare': ['file'], 'applications compensation-append': ['file'],
  'applications compensation-commit': ['file', 'confirm'], 'applications compensation-cancel': ['file'],
};
export const compensationTargets = new Set(['applications compensation', 'applications compensation-download',
  'applications compensation-replace', 'applications compensation-draft']);

export async function compensationCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'applications compensation') return client.getApplicationCompensation({ application_id: target! });
  if (command === 'applications compensation-download') return privateOutput(options.output,
    () => client.downloadApplicationCompensation({ application_id: target! }));
  if (command === 'applications compensation-draft') return client.getCompensationReplacement({ application_id: target!, draft_id: options['draft-id'] as string });
  if (command === 'applications compensation-replace') {
    // Keep the value file's bytes intact: JSON.parse/stringify would silently
    // round historical JSON integers beyond JavaScript's safe integer range.
    if (options.intent === '-' || (options.file === '-' && options['token-stdin'])) throw new JobHuntError('usage_error');
    const intent = compensationReplaceIntent(await inputJSON(options.intent as string | undefined, stdin));
    if (target?.toLowerCase() !== intent.application_id.toLowerCase() || options.confirm !== target) throw new JobHuntError('confirmation_required');
    const bytes = await inputBytes(options.file as string | undefined, stdin, compensationMaxBytes);
    return client.replaceApplicationCompensation(intent, bytes);
  }
  const value = await inputJSON(options.file as string | undefined, stdin, 256 * 1024);
  if (command === 'applications compensation-prepare') return client.prepareCompensationReplacement(compensationPrepare(value));
  if (command === 'applications compensation-append') return client.appendCompensationReplacement(compensationAppend(value));
  const intent = compensationDraftWrite(value);
  if (command === 'applications compensation-commit') {
    if (options.confirm !== intent.application_id) throw new JobHuntError('confirmation_required');
    return client.commitCompensationReplacement(intent);
  }
  if (command === 'applications compensation-cancel') return client.cancelCompensationReplacement(intent);
  throw new JobHuntError('usage_error');
}
