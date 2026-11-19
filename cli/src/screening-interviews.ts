import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { screeningSaveInput } from '../../client/src/screening-contracts.ts';
import { interviewStatusInput } from '../../client/src/interview-contracts.ts';
import { inputJSON } from './input.ts';
export const screeningInterviewOptions: Record<string, string[]> = { 'applications answers': [], 'applications save-answers': ['file'], 'applications close-answers-original': ['file'],
  'interviews list': ['page'], 'interviews set-status': ['file'] };
export const screeningInterviewTargets = new Set(['applications answers']);
export async function screeningInterviewCommand(command: string, target: string | undefined, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'applications answers') return client.getScreeningAnswers({ application_id: target! });
  if (command === 'interviews list') {
    if (options.page !== undefined && (typeof options.page !== 'string' || !/^\d+$/u.test(options.page))) throw new JobHuntError('invalid_input');
    return client.listInterviews({ page: options.page === undefined ? 1 : Number(options.page) });
  }
  const value = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'applications close-answers-original') return client.closeScreeningAnswersOriginal(value as Parameters<JobHuntClient['closeScreeningAnswersOriginal']>[0]);
  if (command === 'applications save-answers') return client.saveScreeningAnswers(screeningSaveInput(value));
  return client.setInterviewStatus(interviewStatusInput(value));
}
