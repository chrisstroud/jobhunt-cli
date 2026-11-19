import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { inputJSON } from './input.ts';

export const routineOptions: Record<string, string[]> = {
  'today get': ['date'], 'routine list': ['links-page', 'targets-page', 'aggregators-page', 'per-page'],
  'routine get': ['kind', 'id'], 'routine save': ['file', 'confirm'],
};
function number(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) throw new JobHuntError('invalid_input');
  return Number(value);
}
export async function routineCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'today get') return client.getTodayAgenda({ today: options.date as string });
  if (command === 'routine list') return client.getSearchRoutine({ links_page: number(options['links-page']), targets_page: number(options['targets-page']),
    aggregators_page: number(options['aggregators-page']), per_page: number(options['per-page']) });
  if (command === 'routine get') return client.getSearchRoutineRecord({ kind: options.kind as 'link' | 'target' | 'aggregator', entity_id: options.id as string });
  const args = await inputJSON(options.file as string | undefined, stdin, 128 * 1024) as Parameters<JobHuntClient['changeSearchRoutine']>[0];
  if (args?.action === 'delete' ? options.confirm !== args.entity_id : options.confirm !== undefined) throw new JobHuntError('confirmation_required');
  return client.changeSearchRoutine(args);
}
