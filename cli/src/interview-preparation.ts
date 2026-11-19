import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { changeInput, reorderInput } from '../../client/src/interview-preparation-contracts.ts';
import { inputJSON } from './input.ts';

export const interviewPreparationOptions: Record<string, string[]> = {
  'interviews prep': ['expected-application-id', 'interviewers-page', 'tasks-page', 'rounds-page'],
  'interviews preparation-save': ['file'], 'interviews rounds': ['page'], 'interviews reorder': ['file'],
};
export const interviewPreparationTargets = new Set(['interviews prep', 'interviews rounds']);
export async function interviewPreparationCommand(command: string, target: string | undefined, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  const number = (key: string) => {
    const value = options[key]; if (typeof value !== 'string' || !/^\d+$/u.test(value)) throw new JobHuntError('invalid_input'); return Number(value);
  };
  if (command === 'interviews prep') return client.getInterviewPreparation({ interview_id: target!,
    ...(options['expected-application-id'] !== undefined ? { expected_application_id: options['expected-application-id'] as string } : {}),
    ...(options['interviewers-page'] !== undefined ? { interviewers_page: number('interviewers-page') } : {}),
    ...(options['tasks-page'] !== undefined ? { tasks_page: number('tasks-page') } : {}),
    ...(options['rounds-page'] !== undefined ? { rounds_page: number('rounds-page') } : {}) });
  if (command === 'interviews rounds') return client.getInterviewRounds({ application_id: target!, ...(options.page !== undefined ? { page: number('page') } : {}) });
  const value = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'interviews preparation-save') return client.changeInterviewPreparation(changeInput(value));
  return client.reorderInterviewRounds(reorderInput(value));
}
