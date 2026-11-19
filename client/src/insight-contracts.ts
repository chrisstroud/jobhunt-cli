/** Factual owned activity, analytics, career summaries and inbox. */
import { record, type JsonObject } from './protocol.ts';
import { calendarDate, fail, integer, intent, intentKeys, journeyResult, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';

export type InsightPageRead = { page?: number };
export type AnalyticsRead = { days?: 30 | 90 | 180; search?: string | null };
export type ActivityCountsRead = { today: string; search_id?: string | null; tz_offset?: number };
export type WorkActivity = { id: string; type: 'work_activity_event'; attributes: JsonObject };
export type WorkActivityPage = { items: WorkActivity[]; page: number; total: number; has_more: boolean };
export type ActivityCounts = { applications: number; days: JsonObject[]; follow_ups: number; history_start_date: string;
  notes: number; origin_date: string; record_updates: number; scope: JsonObject; today_date: string };
export type Analytics = { summary: JsonObject; funnel: JsonObject; weekly_activity: JsonObject; campaigns: JsonObject[]; days: number; search: string | null };
export type CareerFacts = { as_of: string; total: number; last30: number; last90: number; latest: JsonObject | null; resume: JsonObject | null; network: JsonObject };
export type InboxNotification = { id: string; type: 'notification'; attributes: JsonObject };
export type Inbox = { notifications: { data: InboxNotification[]; meta: { pagination: { count: number; current_page: number; page_size: number; total_pages: number; total: number } } };
  settings: { defaultFilter: 'all' | 'unread'; markReadOnOpen: boolean } };
export type MarkNotificationsRead = MutationIntent & { action: 'read' | 'read_all'; notification_id?: string | null };
export type InboxSaved = { action: 'read' | 'read_all'; notification: { id: string; attributes: JsonObject } | null };
const objects = (v: unknown): v is JsonObject[] => Array.isArray(v) && v.every(record);
const nonnegative = (v: unknown) => integer(v, 0);
export function insightPageInput(v: unknown): InsightPageRead {
  shape(v, ['page']); if (v.page !== undefined && !integer(v.page, 1, 10000)) fail(); return v as InsightPageRead;
}
export function analyticsInput(v: unknown): AnalyticsRead {
  shape(v, ['days', 'search']);
  if ((v.days !== undefined && ![30, 90, 180].includes(Number(v.days))) ||
      (v.days !== undefined && typeof v.days !== 'number') || (v.search != null && (typeof v.search !== 'string' || !text(v.search, 200) || !v.search.length))) fail();
  return v as AnalyticsRead;
}
export function activityCountsInput(v: unknown): ActivityCountsRead {
  shape(v, ['today', 'search_id', 'tz_offset']);
  if (!calendarDate(v.today) || (v.search_id != null && !uuid(v.search_id)) ||
      (v.tz_offset !== undefined && !integer(v.tz_offset, -840, 840))) fail();
  return v as ActivityCountsRead;
}
export function inboxWriteInput(v: unknown): MarkNotificationsRead {
  shape(v, [...intentKeys, 'action', 'notification_id']); intent(v);
  if (!['read', 'read_all'].includes(String(v.action)) ||
      (v.action === 'read' ? !uuid(v.notification_id) : v.notification_id != null)) fail();
  return v as MarkNotificationsRead;
}
export const workActivityResult = (v: unknown) => journeyResult(v, (v): v is WorkActivityPage => record(v) &&
  Array.isArray(v.items) && v.items.length <= 50 && v.items.every(item => record(item) && text(item.id, 300) &&
    item.type === 'work_activity_event' && record(item.attributes)) && integer(v.page, 1, 10000) && nonnegative(v.total) && typeof v.has_more === 'boolean');
export const activityCountsResult = (v: unknown) => journeyResult(v, (v): v is ActivityCounts => record(v) &&
  ['applications', 'follow_ups', 'notes', 'record_updates'].every(key => nonnegative(v[key])) && objects(v.days) &&
  calendarDate(v.history_start_date) && calendarDate(v.origin_date) && calendarDate(v.today_date) && record(v.scope));
export const analyticsResult = (v: unknown) => journeyResult(v, (v): v is Analytics => record(v) && record(v.summary) &&
  record(v.funnel) && record(v.weekly_activity) && objects(v.campaigns) && [30, 90, 180].includes(Number(v.days)) &&
  typeof v.days === 'number' && (v.search === null || text(v.search, 200)));
export const careerFactsResult = (v: unknown) => journeyResult(v, (v): v is CareerFacts => record(v) && text(v.as_of, 40) &&
  ['total', 'last30', 'last90'].every(key => nonnegative(v[key])) && (v.latest === null || record(v.latest)) &&
  (v.resume === null || record(v.resume)) && record(v.network));
export const inboxResult = (v: unknown) => journeyResult(v, (v): v is Inbox => {
  if (!record(v) || !record(v.notifications) || !record(v.notifications.meta) || !record(v.notifications.meta.pagination) || !record(v.settings)) return false;
  const page = v.notifications.meta.pagination;
  return Array.isArray(v.notifications.data) && v.notifications.data.length <= 100 &&
    v.notifications.data.every(n => record(n) && uuid(n.id) && n.type === 'notification' && record(n.attributes)) &&
    nonnegative(page.count) && page.count === v.notifications.data.length && integer(page.current_page, 1, 10000) && page.page_size === 100 &&
    nonnegative(page.total_pages) && nonnegative(page.total) && ['all', 'unread'].includes(String(v.settings.defaultFilter)) && typeof v.settings.markReadOnOpen === 'boolean';
});
export const inboxSavedResult = (v: unknown) => journeyResult(v, (v): v is InboxSaved => record(v) && ['read', 'read_all'].includes(String(v.action)) &&
  (v.notification === null || (record(v.notification) && uuid(v.notification.id) && record(v.notification.attributes))));
