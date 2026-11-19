import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { workspaceOriginalFileIntent, workspaceOriginalHostFile, MAX_WORKSPACE_ORIGINAL_BYTES } from '../../client/src/workspace-originals.ts';
import { workspaceOriginalDirectory, workspaceOriginalPointer, workspaceOriginalResolution, workspaceOriginalRetry, workspaceOriginalReviewInput } from '../../client/src/workspace-originals.ts';
import { inputBytes, inputJSON } from './input.ts';
import { privateOutput } from './private-output.ts';

export const workspaceOriginalOptions: Record<string, string[]> = {
  'captures list': ['file'], 'captures check': ['file'], 'captures manifest': ['file'], 'captures download': ['file', 'output'],
  'captures review': ['file'], 'captures retry': ['file', 'confirm'], 'captures resolve': ['file', 'confirm'],
  'captures stage-file': ['file', 'original', 'confirm'], 'captures stage-host-file': ['file', 'confirm'],
};
export async function workspaceOriginalCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  const input = await inputJSON(typeof options.file === 'string' ? options.file : undefined, stdin, 128 * 1024);
  if (command === 'captures list') return client.workspaceOriginals.list(workspaceOriginalDirectory(input));
  if (command === 'captures check') return client.workspaceOriginals.check(workspaceOriginalPointer(input));
  if (command === 'captures manifest') return client.workspaceOriginals.manifest(workspaceOriginalPointer(input));
  if (command === 'captures download') return privateOutput(options.output, () => client.workspaceOriginals.download(workspaceOriginalPointer(input)));
  if (command === 'captures review') return client.workspaceOriginals.review(workspaceOriginalReviewInput(input));
  if (command === 'captures retry') {
    const args = workspaceOriginalRetry(input);
    if (options.confirm !== args.expected_account_id) throw new JobHuntError('confirmation_required');
    return client.workspaceOriginals.retry(args);
  }
  if (command === 'captures resolve') {
    const args = workspaceOriginalResolution(input);
    if (options.confirm !== args.expected_account_id) throw new JobHuntError('confirmation_required');
    return client.workspaceOriginals.resolve(args);
  }
  const args = command === 'captures stage-file' ? workspaceOriginalFileIntent(input) : workspaceOriginalHostFile(input);
  if (options.confirm !== args.expected_account_id) throw new JobHuntError('confirmation_required');
  if (command === 'captures stage-host-file') return client.workspaceOriginals.stageHostFile(args as Parameters<typeof client.workspaceOriginals.stageHostFile>[0]);
  if (command !== 'captures stage-file' || typeof options.original !== 'string' || options.original === '-') throw new JobHuntError('invalid_input');
  return client.workspaceOriginals.stageFile(args, await inputBytes(options.original, stdin, MAX_WORKSPACE_ORIGINAL_BYTES));
}
