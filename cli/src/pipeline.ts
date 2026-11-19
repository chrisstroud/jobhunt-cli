import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { pipelineWriteInput } from '../../client/src/pipeline-contracts.ts';
import { inputJSON } from './input.ts';
export const pipelineOptions: Record<string, string[]> = { 'pipeline get': ['page'], 'pipeline create-stage': ['file'],
  'pipeline rename-stage': ['file'], 'pipeline reorder-stage': ['file'], 'pipeline remove-stage': ['file', 'confirm'] };
export async function pipelineCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'pipeline get') {
    if (options.page !== undefined && (typeof options.page !== 'string' || !/^\d+$/u.test(options.page))) throw new JobHuntError('invalid_input');
    return client.getPipelineConfiguration({ page: options.page === undefined ? 1 : Number(options.page) });
  }
  const value = await inputJSON(options.file as string | undefined, stdin, 64 * 1024);
  if (command === 'pipeline create-stage') return client.createPipelineStage(pipelineWriteInput(value, 'create'));
  if (command === 'pipeline rename-stage') return client.renamePipelineStage(pipelineWriteInput(value, 'rename'));
  if (command === 'pipeline reorder-stage') return client.reorderPipelineStage(pipelineWriteInput(value, 'reorder'));
  const input = pipelineWriteInput(value, 'remove');
  if (options.confirm !== input.stage_id) throw new JobHuntError('confirmation_required');
  return client.removePipelineStage(input);
}
