import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { createInput, deleteInput, updateInput } from '../../client/src/interview-record-contracts.ts';
import { inputJSON } from './input.ts';

export const interviewRecordOptions: Record<string, string[]> = {
  'interviews records': ['page', 'application-id'], 'interviews get': ['expected-application-id'],
  'interviews create': ['file'], 'interviews update': ['file'], 'interviews delete': ['file', 'confirm'],
};
export const interviewRecordTargets = new Set(['interviews get']);
export async function interviewRecordCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'interviews get') return client.getInterviewRecord({ interview_id: target!,
    ...(options['expected-application-id'] !== undefined ? { expected_application_id: options['expected-application-id'] as string } : {}) });
  if (command === 'interviews records') {
    if (options.page !== undefined && (typeof options.page !== 'string' || !/^\d+$/u.test(options.page))) throw new JobHuntError('invalid_input');
    return client.listInterviewRecords({ ...(options.page !== undefined ? { page: Number(options.page) } : {}),
      ...(options['application-id'] !== undefined ? { application_id: options['application-id'] as string } : {}) });
  }
  const value = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'interviews create') return client.createInterviewRecord(createInput(value));
  if (command === 'interviews update') return client.updateInterviewRecord(updateInput(value));
  const intent = deleteInput(value);
  if (options.confirm !== intent.interview_id) throw new JobHuntError('confirmation_required');
  return client.deleteInterviewRecord(intent);
}
