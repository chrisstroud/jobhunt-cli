import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { runCLI } from '../cli/src/cli.ts';
import type { IO } from '../cli/src/cli.ts';
import { CredentialStore } from '../cli/src/credentials.ts';
import { JobHuntError } from '../client/src/index.ts';
const token = 'jsk_test_synthetic_automation_only';
const application = { type: 'application', id: 'example-engineer', attributes: { title: 'Engineer', company_name: 'Example', status: 'To Apply', version: 1 } };
function io(fetchImpl: typeof fetch, env: NodeJS.ProcessEnv = { JOBHUNT_TOKEN: token }, input = '') {
  let stdout = '', stderr = '';
  const value: IO = { env, fetchImpl, stdin: Readable.from([input]),
    stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
    stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }) };
  return { value, result: () => ({ stdout, stderr }) };
}
test('JSON output preserves one-page API results and request errors stay on stderr', async () => {
  const success = io(async () => Response.json({ data: [application], meta: { total: 2 } }));
  assert.equal(await runCLI(['applications', 'list', '--json', '--non-interactive'], success.value, 'test'), 0);
  assert.equal(JSON.parse(success.result().stdout).meta.total, 2); assert.equal(success.result().stderr, '');
  for (const [status, exit] of [[401, 3], [403, 4], [404, 8], [409, 5], [429, 6], [503, 7], [422, 2]]) {
    const failed = io(async () => Response.json({ errors: [{ code: 'request_failed', detail: token }] }, { status }));
    assert.equal(await runCLI(['applications', 'list', '--json'], failed.value, 'test'), exit);
    assert.equal(failed.result().stdout, ''); assert.ok(!failed.result().stderr.includes(token));
    assert.equal(JSON.parse(failed.result().stderr).error.status, status);
  }
});
test('origin override never transfers a production automation credential', async () => {
  let called = false; const options = io(async () => { called = true; return Response.json({}); });
  assert.equal(await runCLI(['applications', 'list', '--origin', 'https://other.example', '--json'], options.value, 'test'), 3);
  assert.equal(called, false); assert.equal(JSON.parse(options.result().stderr).error.code, 'credential_origin_mismatch');
});
test('destructive operation requires the exact target and sends one request', async () => {
  let calls = 0; const options = io(async (_url, init) => { calls++; assert.equal(init?.method, 'DELETE'); return new Response(null, { status: 204 }); });
  assert.equal(await runCLI(['applications', 'delete', 'example-engineer', '--json', '--non-interactive'], options.value, 'test'), 2);
  assert.equal(calls, 0);
  assert.equal(await runCLI(['applications', 'delete', 'example-engineer', '--confirm', 'example-engineer', '--json'], options.value, 'test'), 0);
  assert.equal(calls, 1);
});
test('token stdin is ephemeral and arguments are never echoed on parse errors', async () => {
  let calls = 0; const options = io(async (_url, init) => { calls++; assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${token}`); return Response.json({ data: [application] }); }, {}, token+'\n');
  assert.equal(await runCLI(['applications', 'list', '--token-stdin', '--json'], options.value, 'test'), 0); assert.equal(calls, 1);
  const bad = io(async () => { throw Error('must not request'); });
  assert.equal(await runCLI(['applications', 'list', '--token', token, '--json'], bad.value, 'test'), 2);
  assert.ok(!bad.result().stderr.includes(token));
});
test('noninteractive login fails before browser/network and invalid commands fail safely', async () => {
  const options = io(async () => { throw Error('must not request'); }, {});
  options.value.browser = async () => { throw Error('must not open'); };
  assert.equal(await runCLI(['auth', 'login', '--non-interactive', '--json'], options.value, 'test'), 2);
  for (const args of [['applications', 'get'], ['applications', 'list', '--title', 'x'], ['applications', 'list', '--page', '1', '--page', '2']]) {
    assert.equal(await runCLI([...args, '--json'], options.value, 'test'), 2);
  }
  assert.equal(await runCLI(['auth', 'login', '--scopes', 'admin:*', '--json'], options.value, 'test'), 2);
});
test('unsafe saved-credential permissions have the authentication exit code', async () => {
  const options = io(async () => { throw Error('must not request'); }, {});
  const store = new CredentialStore('https://jobhunt.app');
  store.locked = async () => { throw new JobHuntError('unsafe_credential_permissions'); };
  options.value.storeFactory = () => store;
  assert.equal(await runCLI(['auth', 'status', '--json'], options.value, 'test'), 3);
  assert.equal(JSON.parse(options.result().stderr).error.code, 'unsafe_credential_permissions');
});
