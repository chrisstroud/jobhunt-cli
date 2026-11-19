import assert from 'node:assert/strict';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';

const id = '11111111-1111-4111-8111-111111111111';
const app = '22222222-2222-4222-8222-222222222222';
const value = { id, application_id: app, search_id: null, revision: 1, fingerprint: 'a'.repeat(64),
  interview: { id, application_id: app, title: 'Synthetic prep', interviewer_ids: [] } };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_preparation_credential' }, fetchImpl });

test('preparation actions preserve merge nulls and checklist contents without automatic write retries', async () => {
  const input = { request_id: id, application_id: app, interview_id: id, expected_revision: 1, expected_fingerprint: value.fingerprint,
    change: { action: 'merge_feedback' as const, feedback: { retained: 'Synthetic', remove: null } } };
  let calls = 0;
  assert.deepEqual((await api(async (_url, init) => { calls++; assert.deepEqual(JSON.parse(String(init?.body)), input); return Response.json(ready(value)); }).changeInterviewPreparation(input)).data, value);
  await assert.rejects(api(async () => { calls++; throw new Error('Synthetic private diagnostic'); }).changeInterviewPreparation(input), /network_error|request_failed/);
  assert.equal(calls, 2);
  await assert.rejects(api(async () => Response.json(ready(value))).changeInterviewPreparation({ ...input, change: { action: 'checklist', checklist: [], feedback: {} } } as never), /invalid_input/);
  await assert.rejects(api(async () => Response.json(ready(value))).reorderInterviewRounds({ request_id: id, application_id: app, expected_fingerprint: value.fingerprint, order: [id, id.toUpperCase()] }), /invalid_input/);
  await assert.rejects(api(async () => Response.json(ready(value))).reorderInterviewRounds({ request_id: id, application_id: app, expected_fingerprint: value.fingerprint, order_chunks: [[id], [id]] }), /invalid_input/);
  const chunks = { request_id: id, application_id: app, expected_fingerprint: value.fingerprint, order_chunks: [[id], [app]] };
  const ordered = { application_id: app, fingerprint: 'b'.repeat(64) };
  assert.deepEqual((await api(async (_url, init) => { assert.deepEqual(JSON.parse(String(init?.body)), chunks); return Response.json(ready(ordered)); }).reorderInterviewRounds(chunks)).data, ordered);
});

test('preparation responses bind parent identity and independent pages while preserving repeated task references', async () => {
  const empty = { items: [], page: 1, total: 0, has_more: false };
  const tasks = { items: [{ id, title: 'Synthetic task', completed_at: null }, { id, title: 'Synthetic task', completed_at: null }], page: 1, total: 2, has_more: false };
  const result = { record: { ...value, interview: { id, application_id: app, title: 'Synthetic prep' } }, interviewers: empty, tasks, sibling_steps: empty, order_fingerprint: value.fingerprint };
  const args = { interview_id: id, expected_application_id: app };
  assert.deepEqual((await api(async () => Response.json(ready(result))).getInterviewPreparation(args)).data, result);
  await assert.rejects(api(async () => Response.json(ready({ ...result, tasks: { ...tasks, page: 2 } }))).getInterviewPreparation(args), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...result, record: { ...value, application_id: id } }))).getInterviewPreparation(args), /invalid_response/);
});
