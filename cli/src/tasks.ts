import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { taskCreateInput, taskUpdateInput, taskCompletionInput, taskScheduleInput, taskDeleteInput, taskSkipInput } from '../../client/src/task-contracts.ts';
import { cleanupWriteInput, cleanupPreviewInput } from '../../client/src/recurring-cleanup-contracts.ts';
import { inputJSON } from './input.ts';

type Options = Record<string, string | boolean | undefined>;
function string(value: string | boolean | undefined) { return typeof value === 'string' ? value : undefined; }
function integer(value: string | boolean | undefined) {
  if (typeof value !== 'string' || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))) throw new JobHuntError('invalid_input');
  return Number(value);
}
export async function taskCommand(command: string, target: string | undefined, options: Options, client: JobHuntClient, stdin: Readable) {
  const application = options['expected-application-id'];
  const context = application === undefined ? {} : { expected_application_id: application === 'none' ? null : string(application) };
  if (command === 'tasks cleanup-preview') return client.previewRecurringCleanup(cleanupPreviewInput({
    occurrence_date: string(options.date), ...(options.scope === undefined ? {} : { scope: options.scope }),
    ...(options['include-skipped'] ? { include_skipped: true } : {}),
    ...(options['after-task-id'] ? { after_task_id: options['after-task-id'] } : {}),
  }));
  if (command === 'tasks cleanup') {
    const input = cleanupWriteInput(await inputJSON(string(options.file), stdin));
    if (options.confirm !== input.occurrence_date) throw new JobHuntError('confirmation_required');
    return client.reopenRecurringCompletions(input);
  }
  if (command === 'tasks list') {
    const state = options.state ?? 'open';
    if (!['open', 'completed', 'all'].includes(String(state))) throw new JobHuntError('invalid_input');
    return client.listTasks({ ...(options.page !== undefined ? { page: integer(options.page) } : {}),
      ...(options['application-id'] !== undefined ? { application_id: string(options['application-id']) } : {}),
      ...(options['hunt-id'] !== undefined ? { search_id: string(options['hunt-id']) } : {}),
      ...(options.date !== undefined ? { occurrence_date: string(options.date) } : {}),
      is_active: state === 'all' ? null : state === 'open' });
  }
  if (command === 'tasks get') return client.getTask({ task_id: target!, ...context, ...(options.date !== undefined ? { occurrence_date: string(options.date) } : {}) });
  if (command === 'tasks history') return client.taskHistory({ task_id: target!, ...context,
    ...(options['before-date'] !== undefined ? { before_date: string(options['before-date']) } : {}),
    ...(options.limit !== undefined ? { limit: integer(options.limit) } : {}) });
  if (command === 'tasks complete' || command === 'tasks reopen') return client.updateTask({
    task_id: target!, ...context, expected_revision: integer(options.revision), request_id: string(options['request-id'])!,
    ...(options['account-id'] !== undefined ? { expected_account_id: string(options['account-id']) } : {}),
    is_active: command === 'tasks reopen',
  });
  if (command === 'tasks create') return client.createTask(taskCreateInput(await inputJSON(string(options.file), stdin)));
  if (command === 'tasks delete') {
    const input = taskDeleteInput(await inputJSON(string(options.file), stdin));
    if (options.confirm !== input.task_id) throw new JobHuntError('confirmation_required');
    return client.deleteTask(input);
  }
  if (command === 'tasks update') return client.updateTask(taskUpdateInput(await inputJSON(string(options.file), stdin)));
  if (command === 'tasks completion') return client.setTaskCompletion(taskCompletionInput(await inputJSON(string(options.file), stdin)));
  if (command === 'tasks skip') return client.skipTaskOccurrence(taskSkipInput(await inputJSON(string(options.file), stdin)));
  if (command === 'tasks schedule') return client.setTaskSchedule(taskScheduleInput(await inputJSON(string(options.file), stdin)));
  const originalHash = options['payload-hash'] === undefined ? {} : { expected_payload_hash: string(options['payload-hash']) };
  if (command === 'operations get') return client.getOperation({ operation_id: target!, ...originalHash });
  if (command === 'operations find') return client.getOperation({ request_id: string(options['request-id'])!, operation_name: string(options.operation)!, ...originalHash });
  throw new JobHuntError('usage_error');
}
