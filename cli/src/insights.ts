import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { inputJSON } from './input.ts';

export const insightOptions: Record<string, string[]> = {
  'activity list': ['page'], 'activity counts': ['date', 'hunt-id', 'tz-offset'],
  'analytics get': ['days', 'hunt-slug'], 'career get': [],
  'notifications list': ['page'], 'notifications mark-read': ['file'],
};
function number(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^-?\d+$/u.test(value)) throw new JobHuntError('invalid_input');
  return Number(value);
}
export async function insightCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'activity list') return client.listWorkActivity({ page: number(options.page) });
  if (command === 'activity counts') return client.getActivityCounts({ today: options.date as string,
    search_id: options['hunt-id'] as string | undefined, tz_offset: number(options['tz-offset']) });
  if (command === 'analytics get') return client.getAnalytics({ days: number(options.days) as 30 | 90 | 180 | undefined, search: options['hunt-slug'] as string | undefined });
  if (command === 'career get') return client.getCareerFacts();
  if (command === 'notifications list') return client.listNotifications({ page: number(options.page) });
  if (command === 'notifications mark-read') return client.markNotificationsRead(await inputJSON(options.file as string | undefined, stdin, 128 * 1024) as Parameters<JobHuntClient['markNotificationsRead']>[0]);
  throw new JobHuntError('usage_error');
}
