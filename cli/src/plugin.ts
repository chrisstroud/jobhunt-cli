/**
 * Commands for desktop plugins and status bars: stable JSON on stdout, exit 0 on success, no prompts, safe to call
 * every few minutes. The contract is packages/cli/docs/plugin-contract.md; tests/plugin.test.ts pins it.
 */
import { JobHuntClient, JobHuntError, type JsonObject } from '../../client/src/index.ts';

/** What every command below needs (get_overview, save_job and the activity counts): one write permission, saving a link. A bare
 * `jobhunt auth login` asks for the standard set, which includes all of these. */
export const PLUGIN_SCOPES = ['read:profile', 'read:applications', 'write:applications', 'read:campaigns', 'read:companies',
  'read:contacts', 'read:documents', 'read:interviews', 'read:tasks', 'read:analytics'];
export const pluginOptions: Record<string, string[]> = {
  status: [], overview: [], activity: ['days', 'time-zone'], 'jobs save': [],
};
/** Commands of one word. `activity list` and `activity counts` keep working: they have two words. */
export const pluginOneWord = new Set(['status', 'overview', 'activity']);
export const DEFAULT_ACTIVITY_DAYS = 365;
/** The service keeps at most this many days of history for the activity counts. */
export const MAX_ACTIVITY_DAYS = 1098;

/** A refused credential: the saved connection was revoked or expired for good, so the person must sign in again. */
export function signedOut(error: unknown): boolean {
  return error instanceof JobHuntError && (error.status === 401 || ['invalid_grant', 'invalid_client', 'invalid_token'].includes(error.code));
}
export async function pluginStatus(client: JobHuntClient): Promise<{ signed_in: boolean }> {
  try { await client.verifiedAccountId(); return { signed_in: true }; }
  catch (error) { if (signedOut(error)) return { signed_in: false }; throw error; }
}

function days(value: string | boolean | undefined): number {
  if (value === undefined) return DEFAULT_ACTIVITY_DAYS;
  if (typeof value !== 'string' || !/^\d{1,4}$/u.test(value)) throw new JobHuntError('invalid_input');
  const result = Number(value); if (result < 1 || result > MAX_ACTIVITY_DAYS) throw new JobHuntError('invalid_input');
  return result;
}
function zoneName(value: string | boolean | undefined): string {
  if (value !== undefined && typeof value !== 'string') throw new JobHuntError('invalid_input');
  const zone = value ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  try { new Intl.DateTimeFormat('en-CA', { timeZone: zone }); } catch { throw new JobHuntError('invalid_input'); }
  return zone;
}
/** The calendar day and the offset (minutes behind UTC, like Date.getTimezoneOffset) at this instant in this zone. */
export function localDay(now: Date, timeZone: string): { today: string; offset: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  const local = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  const offset = Math.round((Math.floor(now.getTime() / 1000) * 1000 - local) / 60000);
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return { today: `${pad(part('year'), 4)}-${pad(part('month'))}-${pad(part('day'))}`, offset };
}
const dayMs = 86_400_000;
const isoDay = (value: number) => new Date(value).toISOString().slice(0, 10);

/** One entry per calendar day, oldest first, ending today, zero where nothing was recorded. */
export async function pluginActivity(client: JobHuntClient, options: Record<string, string | boolean | undefined>, now: Date) {
  const count = days(options.days);
  const timeZone = zoneName(options['time-zone']);
  const { today, offset } = localDay(now, timeZone);
  const result = await client.getActivityCounts({ today, tz_offset: offset });
  if (!result.data) throw new JobHuntError('invalid_response');
  const recorded = new Map<string, number>();
  for (const day of result.data.days) {
    if (typeof day.date === 'string' && Number.isSafeInteger(day.count) && Number(day.count) > 0) recorded.set(day.date, Number(day.count));
  }
  const end = Date.parse(`${today}T00:00:00.000Z`);
  const series: { date: string; count: number }[] = [];
  for (let index = count - 1; index >= 0; index--) { const date = isoDay(end - index * dayMs); series.push({ date, count: recorded.get(date) ?? 0 }); }
  return { today, time_zone: timeZone, from: series[0].date, days: series,
    active_days: series.filter(day => day.count > 0).length, recorded_actions: series.reduce((sum, day) => sum + day.count, 0) };
}

export function postingURL(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2000 || /[\s\u0000-\u001f\u007f]/u.test(value)) throw new JobHuntError('invalid_input');
  let url: URL; try { url = new URL(value); } catch { throw new JobHuntError('invalid_input'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new JobHuntError('invalid_input');
  return value;
}

export async function pluginCommand(command: string, target: string | undefined, options: Record<string, string | boolean | undefined>,
    client: JobHuntClient, now: () => Date = () => new Date()): Promise<JsonObject> {
  if (command === 'status') return await pluginStatus(client);
  if (command === 'overview') return await client.callTool('get_overview', {});
  if (command === 'activity') return await pluginActivity(client, options, now());
  if (command === 'jobs save') return await client.callTool('save_job', { url: postingURL(target) });
  throw new JobHuntError('usage_error');
}
