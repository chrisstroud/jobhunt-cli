/** Account-wide task preferences; no task records or retired automation writes. */
import { record } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, shape, type MutationIntent } from './journey-contracts.ts';

export type TaskPreferences = {
  default_due_time: string;
  default_jbr_recurrence: 'daily' | 'weekdays' | 'mwf' | 'tth' | 'weekly' | 'custom_days' | 'times_per_week';
  snooze_options: number[];
  hide_completed_tasks: boolean;
  section_order: ('jbr' | 'quick' | 'interview' | 'pipeline')[];
};
export type TaskPreferencesData = { account_id: string; fingerprint: string; settings: TaskPreferences; stage_automation_retired: true };
export type TaskPreferencesWrite = MutationIntent & { expected_fingerprint: string;
  patch: Partial<Omit<TaskPreferences, 'default_due_time'>> & { default_due_time?: string | null } };
const fields = ['default_due_time', 'default_jbr_recurrence', 'snooze_options', 'hide_completed_tasks', 'section_order'];
const times = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const fingerprint = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const recurrences = ['daily', 'weekdays', 'mwf', 'tth', 'weekly', 'custom_days', 'times_per_week'];
const sections = ['jbr', 'quick', 'interview', 'pipeline'];
function validField(name: string, value: unknown): boolean {
  if (name === 'default_due_time') return typeof value === 'string' && times.test(value);
  if (name === 'default_jbr_recurrence') return typeof value === 'string' && recurrences.includes(value);
  if (name === 'hide_completed_tasks') return typeof value === 'boolean';
  if (name === 'snooze_options') return Array.isArray(value) && value.every(item => integer(item, 1, 2147483647));
  return name === 'section_order' && Array.isArray(value) && value.every(item => typeof item === 'string' && sections.includes(item));
}
export function taskPreferencesInput(value: unknown): TaskPreferencesWrite {
  shape(value, [...intentKeys, 'expected_fingerprint', 'patch']); intent(value);
  if (!fingerprint(value.expected_fingerprint)) fail();
  shape(value.patch, fields);
  if (!Object.keys(value.patch).length) fail();
  for (const [name, field] of Object.entries(value.patch)) {
    if (name === 'default_due_time' && field === null) continue;
    if (!validField(name, field)) fail();
  }
  if (Array.isArray(value.patch.snooze_options) && value.patch.snooze_options.length > 50) fail();
  if (Array.isArray(value.patch.section_order) && (value.patch.section_order.length > 4 ||
      new Set(value.patch.section_order).size !== value.patch.section_order.length)) fail();
  return value as TaskPreferencesWrite;
}
function preferencesData(value: unknown): value is TaskPreferencesData {
  if (!record(value) || typeof value.account_id !== 'string' ||
      !/^jh_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(value.account_id) ||
      !fingerprint(value.fingerprint) || value.stage_automation_retired !== true) return false;
  const settings = value.settings;
  return record(settings) && fields.every(name => validField(name, settings[name]));
}
export const taskPreferencesResult = (value: unknown) => journeyResult(value, preferencesData);
