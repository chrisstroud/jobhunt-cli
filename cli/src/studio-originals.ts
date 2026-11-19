import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { recordFileIntent, recordHostFile, MAX_APPLICATION_RECORD_FIELDS_BYTES } from '../../client/src/application-record-file-contracts.ts';
import { studioOriginalDirectory, studioOriginalPointer, studioOriginalResolution, studioOriginalRetry, studioOriginalReviewInput } from '../../client/src/studio-originals.ts';
import { inputBytes, inputJSON } from './input.ts';
import { privateOutput } from './private-output.ts';

export const studioOriginalOptions: Record<string, string[]> = {
  'originals list': ['file'], 'originals check': ['file'], 'originals manifest': ['file'], 'originals download': ['file', 'output'],
  'originals review': ['file'], 'originals retry': ['file', 'confirm'], 'originals resolve': ['file', 'confirm'],
  'originals stage-file': ['file', 'fields', 'confirm'], 'originals stage-host-file': ['file', 'confirm'],
};
export async function studioOriginalCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  const input = await inputJSON(typeof options.file === 'string' ? options.file : undefined, stdin, 128 * 1024);
  if (command === 'originals list') return client.studioOriginals.list(studioOriginalDirectory(input));
  if (command === 'originals check') return client.studioOriginals.check(studioOriginalPointer(input));
  if (command === 'originals manifest') return client.studioOriginals.manifest(studioOriginalPointer(input));
  if (command === 'originals download') return privateOutput(options.output, () => client.studioOriginals.download(studioOriginalPointer(input)));
  if (command === 'originals review') return client.studioOriginals.review(studioOriginalReviewInput(input));
  if (command === 'originals retry') {
    const args = studioOriginalRetry(input);
    if (options.confirm !== args.expected_account_id) throw new JobHuntError('confirmation_required');
    return client.studioOriginals.retry(args);
  }
  if (command === 'originals resolve') {
    const args = studioOriginalResolution(input);
    if (options.confirm !== args.expected_account_id) throw new JobHuntError('confirmation_required');
    return client.studioOriginals.resolve(args);
  }
  const args = command === 'originals stage-file' ? recordFileIntent(input) : recordHostFile(input);
  if (options.confirm !== args.expected_account_id) throw new JobHuntError('confirmation_required');
  if (command === 'originals stage-host-file') return client.studioOriginals.stageHostFile(args as Parameters<typeof client.studioOriginals.stageHostFile>[0]);
  if (command !== 'originals stage-file' || typeof options.fields !== 'string' || options.fields === '-') throw new JobHuntError('invalid_input');
  return client.studioOriginals.stageFile(args, await inputBytes(options.fields, stdin, MAX_APPLICATION_RECORD_FIELDS_BYTES));
}
