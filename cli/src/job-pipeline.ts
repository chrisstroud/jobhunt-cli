import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { captureJobDetailsInput, captureJobURLInput, captureTargetCompanyInput, editJobDetailsInput, moveJobStageInput } from '../../client/src/job-pipeline-contracts.ts';
import { recordSubmissionInput } from '../../client/src/submission-contracts.ts';
import { inputJSON } from './input.ts';

export const pipelineCommandOptions: Record<string, string[]> = {
  'applications stages': ['page', 'page-size'], 'applications inspect': [],
  'applications capture-url': ['file'], 'applications capture-details': ['file'], 'applications target-company': ['file'],
  'applications edit-details': ['file'], 'applications move': ['file'],
  'applications submission-options': ['prepared-before-id', 'external-before-id'],
  'applications close-submission-original': ['file'], 'applications submissions': ['before-id'], 'applications record-submission': ['file', 'confirm'],
};
export const pipelineCommandTargets = new Set(['applications inspect', 'applications submission-options', 'applications submissions']);
function page(value: string | boolean | undefined, fallback: number) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) throw new JobHuntError('invalid_input');
  return Number(value);
}
export async function jobPipelineCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'applications stages') return client.listPipelineStages({ page: page(options.page, 1), pageSize: page(options['page-size'], 20) });
  if (command === 'applications inspect') return client.getSavedJob(target!);
  if (command === 'applications submission-options') return client.submissionOptions({ application_id: target!,
    prepared_before_id: options['prepared-before-id'] as string | undefined, external_before_id: options['external-before-id'] as string | undefined });
  if (command === 'applications submissions') return client.listSubmissions({ application_id: target!, before_id: options['before-id'] as string | undefined });
  const input = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'applications close-submission-original') return client.closeSubmissionOriginal(input as Parameters<JobHuntClient['closeSubmissionOriginal']>[0]);
  if (command === 'applications capture-url') return client.saveJobURL(captureJobURLInput(input));
  if (command === 'applications capture-details') return client.saveJobDetails(captureJobDetailsInput(input));
  if (command === 'applications target-company') return client.saveTargetCompany(captureTargetCompanyInput(input));
  if (command === 'applications edit-details') return client.editJobDetails(editJobDetailsInput(input));
  if (command === 'applications move') return client.moveJobStage(moveJobStageInput(input));
  if (command === 'applications record-submission') {
    const intent = recordSubmissionInput(input);
    if (options.confirm !== intent.application_id) throw new JobHuntError('confirmation_required');
    return client.recordSubmission(intent);
  }
  throw new JobHuntError('usage_error');
}
