/** Saved screening drafts; content policy and source truth remain server-owned. */
import { isNativeJson } from './native-json.ts';
import { record } from './protocol.ts';
import type { CareerSource } from './document-contracts.ts';
import { fail, integer, intent, intentKeys, journeyResult, optional, resourceId, shape, uuid, type MutationIntent } from './journey-contracts.ts';
export type ScreeningSource = CareerSource & { revision?: number | null };
export type ScreeningAnswer = { question_id: string; question_text: string; employer_limit: number | null;
  answer: string | null; state: 'draft' | 'confirmed' | 'unanswered'; source_refs: ScreeningSource[] };
export type ScreeningAnswerView = ScreeningAnswer & { manual_on_employer_site: boolean; sources_changed: boolean; character_count: number };
export type ScreeningAnswers = { application_id: string; revision: number; answers: ScreeningAnswerView[] };
export type ScreeningAnswersSave = MutationIntent & { application_id: string; expected_revision: number; answers: ScreeningAnswer[] };
const kinds = ['user_statement', 'import', 'posting', 'document', 'written_offer', 'verbal_offer', 'estimate', 'unknown'];
// Python/Pydantic employer limits count code points, including astral characters.
const string = (v: unknown, max: number) => typeof v === 'string' && Array.from(v).length <= max && !v.includes('\0');
function source(v: unknown): v is ScreeningSource {
  return record(v) && kinds.includes(String(v.kind)) && optional(v.record_id, resourceId) &&
    optional(v.field, x => string(x, 160)) && optional(v.note, x => string(x, 1000)) && optional(v.revision, integer) &&
    (!['document', 'import'].includes(String(v.kind)) || (!!v.record_id && !!v.field && integer(v.revision)));
}
export function isScreeningAnswer(v: unknown): v is ScreeningAnswer {
  return record(v) && resourceId(v.question_id) && string(v.question_text, 2000) && !!String(v.question_text).trim() &&
    (v.employer_limit === null || integer(v.employer_limit, 1, 10000)) &&
    (v.answer === null || string(v.answer, 10000)) &&
    ['draft', 'confirmed', 'unanswered'].includes(String(v.state)) && Array.isArray(v.source_refs) && v.source_refs.length <= 20 && v.source_refs.every(source) &&
    (v.answer === null || v.employer_limit === null || Array.from(String(v.answer)).length <= Number(v.employer_limit)) &&
    (v.state === 'unanswered' ? v.answer === null : typeof v.answer === 'string' && !!v.answer.trim() && v.source_refs.some(s => ['document', 'import', 'user_statement'].includes(s.kind))) &&
    (v.state !== 'confirmed' || v.source_refs.some(s => s.kind === 'user_statement'));
}
export function screeningReadInput(v: unknown): { application_id: string } {
  shape(v, ['application_id']); if (!uuid(v.application_id)) fail(); return v as { application_id: string };
}
export function screeningSaveInput(v: unknown): ScreeningAnswersSave {
  shape(v, [...intentKeys, 'application_id', 'expected_revision', 'answers']); intent(v);
  if (!uuid(v.application_id) || !integer(v.expected_revision) || !Array.isArray(v.answers) || v.answers.length > 30 || !v.answers.every(isScreeningAnswer) ||
    new Set(v.answers.map(a => a.question_id)).size !== v.answers.length) fail();
  for (const item of v.answers) {
    shape(item, ['question_id', 'question_text', 'employer_limit', 'answer', 'state', 'source_refs']);
    for (const ref of item.source_refs) shape(ref, ['kind', 'record_id', 'field', 'note', 'revision']);
  }
  // The canonical service budgets model_dump() with nullable source defaults
  // and Python JSON's separator spaces, rather than compact wire bytes.
  const full = v.answers.map(item => ({ ...item, source_refs: item.source_refs.map(ref => ({kind:ref.kind,record_id:ref.record_id??null,field:ref.field??null,note:ref.note??null,revision:ref.revision??null})) }));
  if (!isNativeJson(JSON.parse(JSON.stringify(full)))) fail();
  const budget = JSON.stringify(full).replace(/"(?:[^"\\]|\\.)*"|[:,]/gu, token => token.length === 1 ? token + ' ' : token);
  if (new TextEncoder().encode(budget).length > 300000) fail();
  return v as ScreeningAnswersSave;
}
export const screeningResult = (v: unknown) => journeyResult(v, (d): d is ScreeningAnswers => record(d) && uuid(d.application_id) && integer(d.revision) &&
  Array.isArray(d.answers) && d.answers.length <= 30 && d.answers.every(a => record(a) &&
    typeof a.manual_on_employer_site === 'boolean' && typeof a.sources_changed === 'boolean' &&
    integer(a.character_count, 0, 10000) && isScreeningAnswer(a) &&
    (a as unknown as ScreeningAnswerView).character_count === Array.from(a.answer ?? '').length) &&
  new Set(d.answers.map(a => a.question_id)).size === d.answers.length);
