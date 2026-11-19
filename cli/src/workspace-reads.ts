import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { privateOutput } from './private-output.ts';

export const workspaceReadOptions: Record<string, string[]> = {
  'tasks workspace': ['date', 'expected-application-id'], 'tasks workspace-list': ['page'],
  'tasks description': ['expected-application-id', 'output'], 'photos download': ['output'],
  'applications choices': ['page', 'identifier'],
};
export const workspaceReadTargets = new Set(['tasks workspace', 'tasks description', 'photos download']);
function number(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) throw new JobHuntError('invalid_input');
  return Number(value);
}
export async function workspaceReadCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient) {
  const application = options['expected-application-id'];
  const context = application === undefined ? {} : { expected_application_id: application === 'none' ? null : application as string };
  if (command === 'tasks workspace') return client.getTaskWorkspace({ task_id: target!, ...context,
    ...(options.date !== undefined ? { occurrence_date: options.date as string } : {}) });
  if (command === 'tasks workspace-list') return client.listTaskWorkspace({ page: number(options.page) });
  if (command === 'applications choices') return client.listApplicationChoices({ page: number(options.page),
    ...(options.identifier !== undefined ? { slug: options.identifier as string } : {}) });
  if (command === 'photos download') return privateOutput(options.output, () => client.downloadOwnedPhoto(target!));
  if (command === 'tasks description') return privateOutput(options.output, () => client.downloadTaskDescription({ task_id: target!, ...context }));
  throw new JobHuntError('usage_error');
}
