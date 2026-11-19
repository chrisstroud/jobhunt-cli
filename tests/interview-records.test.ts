import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const app = '22222222-2222-4222-8222-222222222222';
const value = { id, application_id: app, search_id: null, revision: 1, fingerprint: 'a'.repeat(64),
  interview: { id, application_id: app, title: 'Synthetic interview', interviewer_ids: [], notes: 'Complete notes', tags: ['Synthetic'], scheduled_end_at: null } };
const operation = { id, status: 'succeeded', kind: 'create_interview_record', resource: { id, kind: 'interview', label: 'Synthetic interview', revision: 1 },
  retry_after_seconds: 0, retry_expires_at: '2026-10-23T00:00:00Z' };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_interview_credential' }, fetchImpl });

test('complete interview writes preserve omission, explicit clears, dates and reviewed identity without retries', async () => {
  const args = { request_id: id, interview_id: id, application_id: app, expected_revision: 1, expected_fingerprint: value.fingerprint,
    fields: { scheduled_end_at: null, tags: [], completed_at: '2026-10-21T17:30:00-07:00', interviewer_ids: [] } };
  let calls = 0;
  const api = client(async (url, init) => {
    calls++; assert.ok(String(url).endsWith('/update_interview_record')); assert.deepEqual(JSON.parse(String(init?.body)), args);
    return Response.json({ ...ready(value), operation });
  });
  assert.deepEqual((await api.updateInterviewRecord(args)).data, value);
  await assert.rejects(client(async () => { calls++; throw new Error('private diagnostics'); }).updateInterviewRecord(args), /network_error|request_failed/);
  assert.equal(calls, 2);
  await assert.rejects(api.updateInterviewRecord({ ...args, fields: {} }), /invalid_input/);
  await assert.rejects(api.updateInterviewRecord({ ...args, fields: { user_id: app } } as never), /invalid_input/);
  await assert.rejects(api.updateInterviewRecord({ ...args, fields: { title: null } } as never), /invalid_input/);
});

test('complete interview responses cannot switch application or disclose unsanctioned contact/user projections', async () => {
  const args = { interview_id: id, expected_application_id: app };
  assert.deepEqual((await client(async () => Response.json(ready(value))).getInterviewRecord(args)).data, value);
  for (const interview of [{ ...value.interview, user_id: app }, { ...value.interview, interviewers: [{ id: app, name: 'Unreviewed source' }] }]) {
    await assert.rejects(client(async () => Response.json(ready({ ...value, interview }))).getInterviewRecord(args), /invalid_response/);
  }
  await assert.rejects(client(async () => Response.json(ready({ ...value, application_id: id, interview: { ...value.interview, application_id: id } }))).getInterviewRecord(args), /invalid_response/);
  await assert.rejects(client(async () => Response.json({ ...ready(value), operation: { ...operation, resource: { ...operation.resource, id: app } } })).createInterviewRecord({ request_id: id, application_id: app, fields: { title: 'Synthetic' } }), /invalid_response/);
});

test('interview CLI deletion requires exact confirmation before HTTP and reports calendar cleanup separately', async () => {
  const args = { request_id: id, interview_id: id, application_id: app, expected_revision: 1, expected_fingerprint: value.fingerprint };
  let calls = 0; let stdout = ''; let stderr = '';
  const run = async (confirm?: string) => runCLI(['interviews', 'delete', '--file', '-', '--json', '--non-interactive', ...(confirm ? ['--confirm', confirm] : [])], {
    env: { JOBHUNT_TOKEN: 'synthetic_interview_credential' }, stdin: Readable.from([JSON.stringify(args)]),
    fetchImpl: async () => { calls++; return Response.json(ready({ id, application_id: app, deleted: true, calendar_cleanup: 'pending' })); },
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk.toString(); done(); } }),
  }, 'test');
  assert.equal(await run(), 2); assert.equal(JSON.parse(stderr).error.code, 'confirmation_required'); assert.equal(calls, 0);
  stderr = ''; assert.equal(await run(id), 0); assert.equal(calls, 1); assert.equal(JSON.parse(stdout).data.calendar_cleanup, 'pending');
});
