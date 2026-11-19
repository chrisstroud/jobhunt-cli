import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { editInput, updateInput } from '../../client/src/calendar-contracts.ts';
import { controlInput } from '../../client/src/calendar-change-contracts.ts';
import { mutationInput as handoffMutation } from '../../client/src/calendar-handoff-contracts.ts';
import { inputJSON } from './input.ts';

export const calendarOptions: Record<string, string[]> = {
  'calendar connections': ['page'], 'calendar connection': [], 'calendar provider': [],
  'calendar settings': ['file'], 'calendar disconnect': ['file', 'confirm'],
  'calendar available': ['cursor'],
  'calendar upcoming': ['cursor'], 'calendar queue-batch': ['file'],
  'calendar preview': ['file'], 'calendar queue': ['file'], 'calendar change': [],
  'calendar changes': ['source-kind', 'source-id', 'page'], 'calendar cancel': ['file', 'confirm'], 'calendar resolve': ['file', 'confirm'],
  'calendar handoffs': ['page', 'include-admitted'], 'calendar handoff': [], 'calendar handoff-review': ['file'],
  'calendar handoff-resume': ['file', 'confirm'], 'calendar handoff-leave': ['file', 'confirm'],
};
export const calendarTargets = new Set(['calendar connection', 'calendar provider', 'calendar available', 'calendar change', 'calendar upcoming', 'calendar handoff']);
export async function calendarCommand(command: string, target: string | undefined, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'calendar connection') return client.getCalendarConnection({ connection_id: target! });
  if (command === 'calendar provider') return client.getCalendarConnection({ provider: target! });
  if (command === 'calendar change') return client.getCalendarChange({ change_id: target! });
  if (command === 'calendar handoff') return client.getCalendarHandoff({ handoff_id: target! });
  if (command === 'calendar handoffs') {
    if (options.page !== undefined && (typeof options.page !== 'string' || !/^\d+$/u.test(options.page))) throw new JobHuntError('invalid_input');
    if (options['include-admitted'] !== undefined && !['true', 'false'].includes(String(options['include-admitted']))) throw new JobHuntError('invalid_input');
    return client.listCalendarHandoffs({ ...(options.page === undefined ? {} : { page: Number(options.page) }),
      ...(options['include-admitted'] === undefined ? {} : { include_admitted: options['include-admitted'] === 'true' }) });
  }
  if (command === 'calendar upcoming') return client.getUpcomingCalendarSources({ connection_id: target!, ...(options.cursor === undefined ? {} : { cursor: options.cursor as string }) });
  if (command === 'calendar changes') {
    if (options.page !== undefined && (typeof options.page !== 'string' || !/^\d+$/u.test(options.page))) throw new JobHuntError('invalid_input');
    return client.listCalendarChanges({ ...(options.page === undefined ? {} : { page: Number(options.page) }),
      ...(options['source-kind'] === undefined ? {} : { source_kind: options['source-kind'] as 'interview' | 'task' }),
      ...(options['source-id'] === undefined ? {} : { source_id: options['source-id'] as string }) });
  }
  if (command === 'calendar available') return client.listAvailableCalendars({ connection_id: target!, ...(options.cursor === undefined ? {} : { cursor: options.cursor as string }) });
  if (command === 'calendar connections') {
    if (options.page !== undefined && (typeof options.page !== 'string' || !/^\d+$/u.test(options.page))) throw new JobHuntError('invalid_input');
    return client.listCalendarConnections(options.page === undefined ? {} : { page: Number(options.page) });
  }
  const value = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'calendar handoff-review') return client.reviewCalendarHandoff(value as never);
  if (command === 'calendar handoff-resume' || command === 'calendar handoff-leave') {
    const args = handoffMutation(value, command === 'calendar handoff-leave');
    if (options.confirm !== args.handoff_id) throw new JobHuntError('confirmation_required');
    return command === 'calendar handoff-resume' ? client.resumeCalendarHandoff(args as never) : client.resolveCalendarHandoff(args as never);
  }
  if (command === 'calendar preview') return client.previewCalendarChange(value as never);
  if (command === 'calendar queue') return client.queueCalendarChange(value as never);
  if (command === 'calendar queue-batch') return client.queueCalendarChanges(value as never);
  if (command === 'calendar cancel' || command === 'calendar resolve') {
    const args = controlInput(value, command === 'calendar resolve');
    if (options.confirm !== args.change_id) throw new JobHuntError('confirmation_required');
    return command === 'calendar resolve' ? client.resolveCalendarChange(args as never) : client.cancelCalendarChange(args as never);
  }
  if (command === 'calendar settings') return client.updateCalendarConnection(updateInput(value));
  const args = editInput(value);
  if (options.confirm !== args.connection_id) throw new JobHuntError('confirmation_required');
  return client.disconnectCalendarConnection(args);
}
