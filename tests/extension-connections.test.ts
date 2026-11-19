import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, extensionOriginalHash } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';
const id = '11111111-1111-4111-8111-111111111111', account = 'jh_' + id;
const args = { token_id: id, expected_account_id: account, expected_fingerprint: 'a'.repeat(64) };
const original = { ...args, request_id: '22222222-2222-4222-8222-222222222222', review_token: 'synthetic-proof', confirm_revoke: true as const };
const metadata = { account_id: account, id, device_name: '🧭'.repeat(255), created_at: null, last_used_at: null,
  expires_at: null, revoked: false, is_expired: false, status: 'usable', fingerprint: args.expected_fingerprint };
const op = { id, kind: 'revoke_extension_connection', status: 'succeeded', resource: null, retry_after_seconds: 0, retry_expires_at: '2030-01-01T00:00:00Z' };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
test('extension client preserves native metadata and verifies exact original recovery without secret/proof URLs', async () => {
  const seen: string[] = [];
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-extension-test-token' }, fetchImpl: async (url, init) => {
    const u = new URL(String(url)), name = u.pathname.split('/').at(-1)!; seen.push(name);
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    assert.ok(!u.href.includes(original.review_token));
    if (name === 'list_extension_connections') return Response.json(ready({ account_id: account, items: [metadata], after: null, next_after: null, has_more: false, total: 1, observed_at: '2026-10-23T00:00:00Z' }));
    if (name === 'get_extension_connection') return Response.json(ready(metadata));
    if (name === 'review_extension_revocation') return Response.json(ready({ connection: metadata, review_token: original.review_token, expires_at: '2030-01-01T00:00:00Z' }));
    if (name === 'revoke_extension_connection') { assert.deepEqual(JSON.parse(String(init?.body)), original); return Response.json({ ...ready({ id, revocation_recorded: true }), operation: op }); }
    if (name === 'check_extension_revocation') {
      assert.equal(JSON.parse(u.searchParams.get('arguments')!).expected_payload_hash, await extensionOriginalHash(original)); return Response.json(ready(op));
    }
    assert.deepEqual(JSON.parse(String(init?.body)), { original, confirm_close: true });
    return Response.json(ready({ id, request_id: original.request_id, state: 'recorded', operation: op }));
  } });
  assert.equal((await client.extensions.list()).data?.items[0].device_name, metadata.device_name);
  assert.equal((await client.extensions.get({ token_id: id })).data?.id, id);
  assert.equal((await client.extensions.review(args)).data?.connection.id, id);
  assert.equal((await client.extensions.revoke(original)).data?.revocation_recorded, true);
  assert.equal((await client.extensions.check(original)).data?.kind, op.kind);
  assert.equal((await client.extensions.close(original)).data?.state, 'recorded');
  assert.equal(seen.length, 6);
});
test('extension metadata rejects credential material, substituted account, broken pagination and mismatched target', async () => {
  for (const value of [{ ...metadata, token: 'synthetic-private-value' }, { ...metadata, account_id: 'wrong' }, { ...metadata, id: original.request_id }]) {
    let calls = 0;
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-extension-test-token' }, fetchImpl: async () => { calls++; return Response.json(ready(value)); } });
    await assert.rejects(client.extensions.get({ token_id: id }), /invalid_response/u); assert.equal(calls, 1);
  }
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-extension-test-token' }, fetchImpl: async () => Response.json(ready({ account_id: account, items: [metadata], after: null, next_after: id, has_more: true, total: 2, observed_at: '2026-10-23T00:00:00Z' })) });
  await assert.rejects(client.extensions.list(), /invalid_response/u);
});
test('missing consent, extra secret fields and malformed originals never dispatch', async () => {
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-extension-test-token' }, fetchImpl: async () => { calls++; throw Error('Must not dispatch'); } });
  for (const value of [{ ...original, confirm_revoke: 1 }, { ...original, token_id: 'wrong' }, { ...original, secret: 'synthetic' }, { ...original, review_token: '' }]) {
    await assert.rejects(client.extensions.revoke(value as never), /invalid_input/u);
  }
  assert.equal(calls, 0);
});
test('revocation cannot be acknowledged from a substituted operation or missing receipt', async () => {
  for (const operation of [null, { ...op, kind: 'another_operation' }, { ...op, resource: { id, kind: 'profile', label: '', revision: null } }, { ...op, token: 'synthetic' }]) {
    let calls = 0;
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-extension-test-token' }, fetchImpl: async () => { calls++; return Response.json({ ...ready({ id, revocation_recorded: true }), operation }); } });
    await assert.rejects(client.extensions.revoke(original), /invalid_response/u); assert.equal(calls, 1);
  }
});
test('extension CLI accepts exactly one get target and rejects mismatched revoke confirmation before dispatch', async () => {
  for (const [args, expected, dispatches] of [
    [['extensions', 'get', id], 0, 1], [['extensions', 'get'], 2, 0],
    [['extensions', 'get', id, id], 2, 0], [['extensions', 'list', id], 2, 0],
    [['extensions', 'revoke', '--file', '-', '--confirm', original.request_id], 2, 0],
  ] as const) {
    let calls = 0, stdout = '', stderr = '';
    const code = await runCLI([...args, '--json'], { env: { JOBHUNT_TOKEN: 'synthetic-extension-test-token' },
      stdin: Readable.from([JSON.stringify(original)]),
      stdout: new Writable({ write(chunk, _, done) { stdout += chunk; done(); } }),
      stderr: new Writable({ write(chunk, _, done) { stderr += chunk; done(); } }),
      fetchImpl: async () => { calls++; return Response.json(ready(metadata)); } }, 'test');
    assert.equal(code, expected); assert.equal(calls, dispatches);
    if (expected) { assert.equal(stdout, ''); assert.ok(!stderr.includes(original.review_token)); }
    else { assert.equal(JSON.parse(stdout).data.id, id); assert.equal(stderr, ''); }
  }
});
