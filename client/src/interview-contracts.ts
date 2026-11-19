/** Owned interview collection and reviewed status-only changes. */
import { record } from './protocol.ts';
import { deadline, fail, integer, intent, intentKeys, journeyResult, shape, uuid, type MutationIntent } from './journey-contracts.ts';
export type InterviewStatus = 'Pending' | 'Completed' | 'Skipped' | 'Cancelled' | 'No_Show' | 'Rescheduling';
export type InterviewRound = { id: string; revision: number; applicationId: string; applicationSlug: string; companyName: string; roleTitle: string;
  title: string; status: string; completedAt: string | null; scheduledAt: string | null; scheduledEndAt: string | null;
  description: string | null; location: string | null; stepType: string | null; contactName: null; contactRole: null; fingerprint: string };
export type InterviewPage = { items: InterviewRound[]; page: number; has_more: boolean; total: number };
export type InterviewStatusWrite = MutationIntent & { interview_id: string; expected_revision: number; expected_fingerprint: string; status: InterviewStatus };
export type InterviewStatusSaved = { id: string; revision: number; status: string };
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const text = (v: unknown, max: number) => typeof v === 'string' && Array.from(v).length <= max && !v.includes('\0');
const statuses = ['Pending', 'Completed', 'Skipped', 'Cancelled', 'No_Show', 'Rescheduling'];
export function interviewPageInput(v: unknown): { page?: number } {
  shape(v, ['page']); if (v.page !== undefined && !integer(v.page, 1, 10000)) fail(); return v as { page?: number };
}
export function interviewStatusInput(v: unknown): InterviewStatusWrite {
  shape(v, [...intentKeys, 'interview_id', 'expected_revision', 'expected_fingerprint', 'status']); intent(v);
  if (!uuid(v.interview_id) || !integer(v.expected_revision) || !hash(v.expected_fingerprint) || !statuses.includes(String(v.status))) fail();
  return v as InterviewStatusWrite;
}
function round(v: unknown): v is InterviewRound {
  return record(v) && uuid(v.id) && integer(v.revision) && uuid(v.applicationId) && text(v.applicationSlug, 256) &&
    text(v.companyName, 255) && text(v.roleTitle, 255) && text(v.title, 255) && text(v.status, 50) &&
    [v.completedAt, v.scheduledAt, v.scheduledEndAt].every(x => x === null || deadline(x)) &&
    (v.description === null || text(v.description, 12000)) && (v.location === null || text(v.location, 2048)) &&
    (v.stepType === null || text(v.stepType, 50)) && v.contactName === null && v.contactRole === null && hash(v.fingerprint);
}
export const interviewPageResult = (v: unknown) => journeyResult(v, (d): d is InterviewPage => record(d) &&
  Array.isArray(d.items) && d.items.length <= 20 && d.items.every(round) && integer(d.page, 1, 10000) && integer(d.total, 0) &&
  d.has_more === (Number(d.page) * 20 < Number(d.total)) && new Set(d.items.map(x => x.id)).size === d.items.length);
export const interviewStatusResult = (v: unknown) => journeyResult(v, (d): d is InterviewStatusSaved => record(d) &&
  uuid(d.id) && integer(d.revision) && text(d.status, 50));
