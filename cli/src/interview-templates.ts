import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { createInput, deleteInput, initializeInput } from '../../client/src/interview-template-contracts.ts';
import { inputJSON } from './input.ts';

export const interviewTemplateOptions: Record<string, string[]> = {
  'interview-templates list': ['page'], 'interview-templates initialize': ['file'],
  'interview-templates create': ['file'], 'interview-templates delete': ['file', 'confirm'],
};
export async function interviewTemplateCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'interview-templates list') {
    if (options.page !== undefined && (typeof options.page !== 'string' || !/^\d+$/u.test(options.page))) throw new JobHuntError('invalid_input');
    return client.listInterviewTemplates(options.page === undefined ? {} : { page: Number(options.page) });
  }
  const value = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'interview-templates initialize') return client.initializeInterviewTemplates(initializeInput(value));
  if (command === 'interview-templates create') return client.createInterviewTemplate(createInput(value));
  const args = deleteInput(value);
  if (options.confirm !== args.template_id) throw new JobHuntError('confirmation_required');
  return client.deleteInterviewTemplate(args);
}
