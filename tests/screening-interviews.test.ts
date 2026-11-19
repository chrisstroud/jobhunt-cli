import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, type ScreeningAnswersSave } from '../client/src/index.ts';
import { screeningSaveInput } from '../client/src/screening-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';
const id = '11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222';
const answer = { question_id: 'experience', question_text: 'Relevant experience?', employer_limit: 2, answer: 'é😀',
  state: 'confirmed' as const, source_refs: [{ kind: 'user_statement' as const }] };
const write: ScreeningAnswersSave = { application_id: id, expected_revision: 1, request_id: request, answers: [answer] };
const answers = { application_id: id, revision: 2, answers: [{ ...answer, manual_on_employer_site: false, sources_changed: false, character_count: 2 }] };
const round = { id, revision: 1, applicationId: request, applicationSlug: 'synthetic', companyName: 'Synthetic', roleTitle: 'Role',
  title: 'Round', status: 'Scheduled', completedAt: null, scheduledAt: '2026-10-21T12:00:00Z', scheduledEndAt: null,
  description: null, location: null, stepType: null, contactName: null, contactRole: null, fingerprint: 'a'.repeat(64) };
const page = { items: [round], page: 1, total: 1, has_more: false };
const statusWrite = { interview_id: id, expected_revision: 1, request_id: request, expected_fingerprint: round.fingerprint, status: 'Pending' as const };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-screening-token' }, fetchImpl });

test('screening code-point limits, complete-set replacement and exact retries survive transport', async () => {
  const bodies: unknown[] = [];
  const api = client(async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/save_application_answers');
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    bodies.push(JSON.parse(String(init?.body))); return Response.json(ready(answers));
  });
  assert.deepEqual((await api.saveScreeningAnswers(write)).data, answers);
  await api.saveScreeningAnswers(write); await api.saveScreeningAnswers({ ...write, answers: [] });
  assert.deepEqual(bodies, [write, write, { ...write, answers: [] }]);
});

test('screening validates wire shape and provenance without duplicating employer content policy', async () => {
  let calls = 0; const api = client(async () => { calls++; return Response.json(ready(answers)); });
  for (const item of [{ ...answer, answer: 'é😀x' }, { ...answer, state: 'unanswered' }, { ...answer, source_refs: [] },
    { ...answer, employer_limit: false }, { ...answer, source_refs: [{ kind: 'document', record_id: id, field: '/summary' }] },
    { ...answer, source_refs: [{ kind: 'user_statement', invented: true }] }, { ...answer, manual_on_employer_site: false }])
    await assert.rejects(api.saveScreeningAnswers({ ...write, answers: [item] } as ScreeningAnswersSave), /invalid_input/);
  await assert.rejects(api.saveScreeningAnswers({ ...write, answers: [answer, answer] }), /invalid_input/);
  await assert.rejects(api.getScreeningAnswers({ application_id: 'invalid' }), /invalid_input/);
  assert.equal(calls, 0);
  assert.doesNotThrow(() => screeningSaveInput({ ...write, answers: [{ ...answer, question_text: 'Are you legally authorized to work?', employer_limit: null }] }));
});

test('screening response rejects a different application and incorrect Unicode counts', async () => {
  for (const data of [{ ...answers, application_id: request }, { ...answers, answers: [{ ...answers.answers[0], character_count: 3 }] }])
    await assert.rejects(client(async () => Response.json(ready(data))).getScreeningAnswers({ application_id: id }), /invalid_response/);
});

test('interview full statuses preserve the reviewed input and allow a derived scheduled result', async () => {
  for (const status of ['Pending', 'Completed', 'Skipped', 'Cancelled', 'No_Show', 'Rescheduling'] as const) {
    const value = { ...statusWrite, status };
    const api = client(async (url, init) => {
      assert.equal(new URL(String(url)).pathname, '/api/v1/journey/update_interview_status_v2');
      assert.deepEqual(JSON.parse(String(init?.body)), value); assert.equal(init?.credentials, 'omit');
      return Response.json(ready({ id, revision: 2, status: status === 'Pending' ? 'Scheduled' : status }));
    });
    assert.equal((await api.setInterviewStatus(value)).data?.id, id);
  }
});

test('interview paging and target checks reject malformed responses or writes', async () => {
  assert.deepEqual((await client(async () => Response.json(ready(page))).listInterviews()).data, page);
  for (const data of [{ ...page, has_more: true }, { ...page, page: 2 }, { ...page, items: [round, round] },
    { ...page, items: [{ ...round, contactName: 'Unrequested contact' }] }])
    await assert.rejects(client(async () => Response.json(ready(data))).listInterviews(), /invalid_response/);
  await assert.rejects(client(async () => { throw new Error('unexpected I/O'); }).setInterviewStatus({ ...statusWrite, status: 'Scheduled' } as never), /invalid_input/);
  await assert.rejects(client(async () => Response.json(ready({ id: request, revision: 2, status: 'Completed' }))).setInterviewStatus(statusWrite), /invalid_response/);
});

test('four domain CLI commands use typed endpoints and bounded JSON input', async () => {
  for (const [args, value, operation, data] of [
    [['applications', 'answers', id], null, 'get_application_answers', answers],
    [['applications', 'save-answers', '--file', '-'], write, 'save_application_answers', answers],
    [['interviews', 'list'], null, 'list_workspace_interviews_v2', page],
    [['interviews', 'set-status', '--file', '-'], statusWrite, 'update_interview_status_v2', { id, revision: 2, status: 'Scheduled' }],
  ] as const) {
    let calls = 0;
    const code = await runCLI([...args, '--json'], { env: { JOBHUNT_TOKEN: 'synthetic-screening-token' }, stdin: Readable.from([JSON.stringify(value)]),
      stdout: new Writable({ write(_c, _e, next) { next(); } }), stderr: new Writable({ write(_c, _e, next) { next(); } }),
      fetchImpl: async (url, init) => { calls++; assert.equal(init?.credentials, 'omit');
        assert.equal(new URL(String(url)).pathname, '/api/v1/journey/' + operation); return Response.json(ready(data)); },
    }, 'test');
    assert.equal(code, 0); assert.equal(calls, 1);
  }
});
