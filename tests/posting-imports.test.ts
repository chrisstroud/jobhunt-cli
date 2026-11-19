import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const scope = 'a'.repeat(64), hash = 'b'.repeat(64), token = 'synthetic_import_token';
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const attempt = { id, input_kind: 'url', state: 'queued', created_at: '2026-10-27T00:00:00', updated_at: '2026-10-27T00:00:00' };
const saved = { attempt, acceptance: 'recorded' };
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });

test('posting originals and draft revisions cross one authenticated request without synthetic receipts or retries', async () => {
  const paths = ['list_posting_imports_v1','get_posting_import_v1','start_posting_import_v1','save_posting_import_draft_v1',
    'open_posting_import_v1','reconcile_posting_import_request_v1','cancel_posting_import_request_v1','cancel_posting_import_v1'];
  const draft = { title: 'User reviewed title', description: 'Full original posting.\n'.repeat(2000) };
  const values = [{ attempts: [attempt], next_cursor: null, recovery_scope: scope }, saved, saved,
    { review_revision: 1, review_draft: { description: draft.description, title: draft.title } }, saved,
    { acceptance: 'unknown' }, saved, saved];
  let calls = 0;
  const c = client(async (url, init) => {
    const parsed = new URL(String(url)); assert.equal(parsed.pathname, '/api/v1/journey/' + paths[calls]);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    if (calls < 2) { assert.deepEqual(JSON.parse(parsed.searchParams.get('arguments')!), calls === 0 ? { limit: 3 } : { attempt_id: id }); }
    else { assert.equal(init?.method, 'POST'); const body = JSON.parse(String(init?.body)); assert.equal(body.request_id, undefined); if (calls === 3) assert.deepEqual(body.draft, draft); }
    return Response.json(ready(values[calls++]));
  }).postingImports;
  await c.list({ limit: 3 }); await c.get({ attempt_id: id });
  await c.start({ request_key: 'original-key', url: 'https://example.test/role' });
  await c.saveDraft({ attempt_id: id, expected_revision: 0, draft });
  await c.open({ attempt_id: id, job_search: 'synthetic', status: 'Backlog', recovery_scope: scope });
  assert.equal((await c.reconcile({ request_key: 'private-key', input_kind: 'pasted_text', input_fingerprint: hash, recovery_scope: scope })).data?.acceptance, 'unknown');
  await c.cancelRequest({ request_key: 'original-key', url: 'https://example.test/role', recovery_scope: scope });
  await c.cancel({ attempt_id: id }); assert.equal(calls, 8);
});

test('invalid originals, receipts-as-drafts and ambiguous private identity do not reach the network', async () => {
  let calls = 0; const c = client(async () => { calls++; return Response.json(ready(saved)); }).postingImports;
  for (const v of [{ limit: 51 }, { limit: true }, { before: 'bad' }]) await assert.rejects(c.list(v as never), /invalid_input/);
  for (const v of [{ request_key: 'bad key', url: 'https://example.test/role' },
    { request_key: 'same', url: 'https://name:secret@example.test/role' },
    { request_key: 'same', input_kind: 'pasted_text', text: 'too short' },
    { request_key: 'same', url: 'https://example.test/role', open_application: true },
    { request_key: 'same', url: 'https://example.test/role', expected_account_id: 'other' }]) await assert.rejects(c.start(v as never), /invalid_input/);
  await assert.rejects(c.saveDraft({ attempt_id: id, expected_revision: true as never, draft: { title: 'x' } }), /invalid_input/);
  await assert.rejects(c.saveDraft({ attempt_id: id, expected_revision: 0, draft: { _fast_entry: 'forged' } }), /invalid_input/);
  await assert.rejects(c.cancelRequest({ request_key: 'same', input_kind: 'pasted_text', input_fingerprint: hash, text: 'x'.repeat(50), recovery_scope: scope }), /invalid_input/);
  assert.equal(calls, 0);
});

test('mismatched IDs, leaked private metadata, missing result and incorrect draft acknowledgements are rejected', async () => {
  for (const data of [{}, { ...saved, attempt: { ...attempt, id: other } },
    { ...saved, attempt: { ...attempt, input_text: 'must never appear' } },
    { ...saved, attempt: { ...attempt, review_draft: { _role_update: {} } } }])
    await assert.rejects(client(async () => Response.json(ready(data))).postingImports.get({ attempt_id: id }), /invalid_response/);
  await assert.rejects(client(async () => Response.json(ready({ review_revision: 3, review_draft: { title: 'original' } }))).postingImports.saveDraft({ attempt_id: id, expected_revision: 0, draft: { title: 'original' } }), /invalid_response/);
  await assert.rejects(client(async () => Response.json(ready({ review_revision: 1, review_draft: { title: 'changed' } }))).postingImports.saveDraft({ attempt_id: id, expected_revision: 0, draft: { title: 'original' } }), /invalid_response/);
});

test('an interrupted write is not automatically retried or replaced', async () => {
  let calls = 0; const c = client(async () => { calls++; throw new Error('unavailable transport'); });
  await assert.rejects(c.postingImports.start({ request_key: 'retain-this-original', url: 'https://example.test/role' }));
  assert.equal(calls, 1);
});

async function cli(args: string[], fetchImpl: typeof fetch, input = '') {
  let out = '', err = '';
  const stream = (write: (chunk: string) => void) => new Writable({ write(chunk, _encoding, done) { write(String(chunk)); done(); } });
  const code = await runCLI([...args, '--json'], { env: { JOBHUNT_TOKEN: token, JOBHUNT_TOKEN_ORIGIN: 'https://jobhunt.app' },
    stdin: Readable.from([input]), stdout: stream(c => out += c), stderr: stream(c => err += c), fetchImpl }, 'test');
  return { code, out, err };
}
test('CLI exposes all import modes and requires the exact cancellation target', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => { calls++; return Response.json(ready(saved)); };
  assert.equal((await cli(['imports', 'get', id], fetchImpl)).code, 0);
  assert.equal((await cli(['imports', 'cancel', id], fetchImpl)).code, 2);
  assert.equal((await cli(['imports', 'cancel', id, '--confirm', id], fetchImpl)).code, 0);
  assert.equal((await cli(['imports', 'start', '--file', '-'], fetchImpl, JSON.stringify({ request_key: 'keep-key', url: 'https://example.test/role' }))).code, 0);
  assert.equal(calls, 3);
  assert.equal((await cli(['imports', 'list', '--limit', 'NaN'], fetchImpl)).code, 2);
});


test('stopping capture uses its separate typed operation and retains the exact target', async () => {
  let calls = 0;
  const c = client(async (url, init) => {
    calls++; assert.equal(new URL(String(url)).pathname, '/api/v1/journey/stop_posting_import_v1');
    assert.equal(init?.method, 'POST'); assert.deepEqual(JSON.parse(String(init?.body)), { attempt_id: id });
    return Response.json(ready({ attempt: { ...attempt, state: 'cancelled', application_id: other, application_created_at: attempt.created_at }, acceptance: 'recorded' }));
  });
  assert.equal((await c.postingImports.stop({ attempt_id: id })).data?.attempt?.state, 'cancelled');
  await assert.rejects(c.postingImports.stop({ attempt_id: 'bad' }), /invalid_input/);assert.equal(calls, 1);
  await assert.rejects(client(async () => Response.json(ready(saved))).postingImports.stop({ attempt_id: id }), /invalid_response/);
  let writes = 0;
  const fetchImpl: typeof fetch = async () => { writes++; return Response.json(ready({ attempt: { ...attempt, state: 'cancelled' }, acceptance: 'recorded' })); };
  assert.equal((await cli(['imports','stop',id], fetchImpl)).code, 2);
  assert.equal((await cli(['imports','stop',id,'--confirm',other], fetchImpl)).code, 2);
  assert.equal((await cli(['imports','stop',id,'--confirm',id], fetchImpl)).code, 0);assert.equal(writes, 1);
});
