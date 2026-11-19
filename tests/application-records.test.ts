import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const token = 'synthetic_record_credential';
const data = { application_id: id, revision: 3, record_id: 'legacy-note-1', deleted: false };
const ready = { outcome: 'ready', data, next_action: { kind: 'none', label: '' } };
const save = { application_id: id, expected_revision: 2, request_id: requestId, kind: 'note' as const,
  title: 'Synthetic note', body: '', date: null, record_id: data.record_id, expected_fingerprint: 'a'.repeat(64) };

test('application record transport preserves explicit input and typed failures', async () => {
  const requests: { url: URL; init?: RequestInit }[] = [];
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl: async (url, init) => {
    requests.push({ url: new URL(String(url)), init });
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    assert.equal((init?.headers as Record<string, string>)['Content-Type'], 'application/json');
    return Response.json(ready);
  } });
  await client.saveApplicationRecord(save);
  await client.saveApplicationRecord(save);
  assert.equal(requests[0].url.pathname, '/api/v1/journey/save_application_record_v2');
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), save);
  assert.equal(requests[0].init?.body, requests[1].init?.body);
  for (const changes of [{ expected_revision: 0 }, { request_id: '' }, { expected_fingerprint: undefined },
    { record_id: '../other' }, { title: ' ' }, { participants: ['bad/id'] }, { unexpected: true }]) {
    await assert.rejects(client.saveApplicationRecord({ ...save, ...changes }), /invalid_input/);
  }
  assert.equal(requests.length, 2);
});

test('workspace keeps unavailable collections explicit and rejects malformed fingerprints', async () => {
  const workspace = { account_id: 'jh_' + id, application_id: id, revision: 2,
    ledger: { application: { uuid: id } }, reminders: [], target: null,
    unavailable: ['task', 'person', 'interview', 'document'], fingerprints: { 'note:legacy-note-1': 'a'.repeat(64) } };
  let answer: unknown = workspace;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl: async (url, init) => {
    assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), { application_id: id });
    assert.equal(init?.method, 'GET');
    return Response.json({ ...ready, data: answer });
  } });
  assert.deepEqual((await client.applicationWorkspace({ application_id: id })).data, workspace);
  for (const changes of [{ unavailable: ['unknown'] }, { fingerprints: { 'task:missing': '' } }, { revision: 0 },
    { ledger: { application: { uuid: requestId } } }, { reminders: [null] }]) {
    answer = { ...workspace, ...changes };
    await assert.rejects(client.applicationWorkspace({ application_id: id }), /invalid_response/);
  }
});

test('CLI application record deletion requires exact target confirmation before any request', async () => {
  const { title: _title, body: _body, date: _date, ...intent } = save;
  let calls = 0;
  async function run(confirm?: string) {
    let stdout = '', stderr = '';
    const status = await runCLI(['applications', 'record-delete', '--file', '-', '--json', ...(confirm ? ['--confirm', confirm] : [])], {
      env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(intent)]),
      stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
      fetchImpl: async (url, init) => {
        calls++;
        assert.equal(new URL(String(url)).pathname, '/api/v1/journey/delete_application_record_v2');
        assert.deepEqual(JSON.parse(String(init?.body)), intent);
        return Response.json({ ...ready, data: { ...data, deleted: true } });
      },
    }, 'test');
    return { status, stdout, stderr };
  }
  for (const confirmation of [undefined, 'other-record']) {
    const refused = await run(confirmation);
    assert.equal(refused.status, 2); assert.equal(refused.stdout, '');
    assert.equal(JSON.parse(refused.stderr).error.code, 'confirmation_required');
  }
  assert.equal(calls, 0);
  const deleted = await run(data.record_id);
  assert.equal(deleted.status, 0); assert.equal(JSON.parse(deleted.stdout).data.deleted, true);
  assert.equal(calls, 1);
});

test('reviewed application actions bind acknowledgments to exact revisions and original operation', async () => {
  const input = { application_id: id, expected_revision: 2, request_id: requestId };
  const answer = (deleted: boolean) => ({ ...ready, data: { application_id: id, revision: 3, ...(deleted ? { deleted: true } : {}) },
    website_url: 'https://jobhunt.app/app', operation: { id: requestId, kind: deleted ? 'delete_application_v2' : 'set_application_target_v2', status: 'succeeded',
      resource: { id, kind: 'application', label: 'Application', revision: 3 }, retry_after_seconds: 0, retry_expires_at: '2026-10-23T00:00:00Z' } });
  for (const deleted of [false, true]) {
    let response = answer(deleted); let calls = 0;
    const args = deleted ? input : { ...input, expected_target_revision: 'a'.repeat(64), target_company: false };
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl: async (url, init) => {
      calls++; assert.equal(new URL(String(url)).pathname, '/api/v1/journey/' + (deleted ? 'delete_application_v2' : 'set_application_target_v2'));
      assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
      assert.deepEqual(JSON.parse(String(init?.body)), args); return Response.json(response);
    } });
    const run = () => deleted ? client.removeApplication(args) : client.setApplicationTarget(args as never);
    assert.deepEqual(await run(), answer(deleted));
    for (const mutate of [
      (v: any) => { v.data.application_id = requestId; }, (v: any) => { v.data.revision = 4; },
      (v: any) => { v.operation.resource.revision = 2; }, (v: any) => { v.operation.resource.id = requestId; },
      (v: any) => { v.data.deleted = !deleted; }, (v: any) => { v.operation.kind = 'other'; },
    ]) { response = answer(deleted); mutate(response); await assert.rejects(run(), /invalid_response/); }
    assert.equal(calls, 7);
  }
});

test('application remove requires exact confirmation and malformed target review never reaches HTTP', async () => {
  let calls = 0;
  const input = { request_id: requestId, application_id: id, expected_revision: 2 };
  for (const confirm of [[], ['--confirm', requestId]]) {
    let error = '';
    const status = await runCLI(['applications', 'remove', '--file', '-', '--json', ...confirm], {
      env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(input)]),
      stdout: new Writable({ write(_v, _e, done) { done(); } }),
      stderr: new Writable({ write(v, _e, done) { error += v; done(); } }),
      fetchImpl: async () => { calls++; return Response.json(ready); },
    }, 'test');
    assert.equal(status, 2); assert.equal(JSON.parse(error).error.code, 'confirmation_required');
  }
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl: async () => { calls++; return Response.json(ready); } });
  for (const change of [{ expected_revision: 0 }, { application_id: '../other' }, { request_id: '' }, { secret: true }])
    await assert.rejects(client.removeApplication({ ...input, ...change }), /invalid_input/);
  for (const change of [{ expected_target_revision: '' }, { target_company: null }, { target_company: 'false' }])
    await assert.rejects(client.setApplicationTarget({ ...input, expected_target_revision: 'a'.repeat(64), target_company: false, ...change } as never), /invalid_input/);
  assert.equal(calls, 0);
});
