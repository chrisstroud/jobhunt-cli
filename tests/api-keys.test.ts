import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const key = { id, name: 'Synthetic key', key_prefix: 'jsk_test_', tier: 'free', scopes: ['read:profile'],
  is_active: true, expires_at: null, revoked_at: null, last_used_at: null, usage_count: 0, created_at: null,
  status: 'usable', fingerprint: 'a'.repeat(64), is_current_credential: false };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_key_management_credential' }, fetchImpl });
const reviewInput = { key_id: id, expected_account_id: 'jh_' + id, expected_fingerprint: key.fingerprint };
const args = { ...reviewInput, request_id: id, review_token: 'synthetic-review', confirm_revoke: true as const };
const receipt = { id, kind: 'revoke_api_key_record', status: 'succeeded', resource: null,
  retry_after_seconds: 0, retry_expires_at: '2030-01-01T00:00:00Z' };

test('key projections reject wrong targets and unexpected plaintext/hash/operator fields', async () => {
  assert.deepEqual((await api(async () => Response.json(ready(key))).apiKeys.get({ key_id: id })).data, key);
  for (const changed of [{ ...key, id: other }, { ...key, raw_key: 'synthetic-secret' },
    { ...key, key_hash: 'synthetic-hash' }, { ...key, admin_role: 'founder' }, { ...key, scopes: [{}] }]) {
    await assert.rejects(api(async () => Response.json(ready(changed))).apiKeys.get({ key_id: id }), /invalid_response/);
  }
});

test('directory binds cursor, ordered unique IDs and continuation to the actual final item', async () => {
  const directory = { items: [key], after: null, next_after: null, has_more: false, total: 1,
    active_quota_used: 1, active_quota_limit: 25, observed_at: '2030-01-01T00:00:00Z' };
  assert.deepEqual((await api(async () => Response.json(ready(directory))).apiKeys.list()).data, directory);
  for (const changed of [{ ...directory, items: [key, key] }, { ...directory, after: other },
    { ...directory, has_more: true, next_after: id }, { ...directory, secret: 'synthetic-secret' }]) {
    await assert.rejects(api(async () => Response.json(ready(changed))).apiKeys.list(), /invalid_response/);
  }
});

test('review must match exact selected source and current-connection warning', async () => {
  const review = { key, review_token: 'synthetic-review', expires_at: '2030-01-01T00:00:00Z', revokes_current_credential: false };
  assert.deepEqual((await api(async () => Response.json(ready(review))).apiKeys.reviewRevocation(reviewInput)).data, review);
  for (const changed of [{ ...review, key: { ...key, fingerprint: 'b'.repeat(64) } },
    { ...review, revokes_current_credential: true }, { ...review, secret: 'synthetic-secret' }]) {
    await assert.rejects(api(async () => Response.json(ready(changed))).apiKeys.reviewRevocation(reviewInput), /invalid_response/);
  }
});

test('metadata rejects secret-bearing envelopes and canonicalizes a valid uppercase cursor', async () => {
  for (const changed of [{ ...ready(key), meta: { secret: 'synthetic-secret' } },
    { ...ready(key), next_action: { kind: 'none', label: '', secret: 'synthetic-secret' } },
    { ...ready(key), operation: { ...receipt, secret: 'synthetic-secret' } }]) {
    await assert.rejects(api(async () => Response.json(changed)).apiKeys.get({ key_id: id }), /invalid_response/);
  }
  const cursor = 'abcdefab-1111-4111-8111-111111111111';
  const result = await api(async url => {
    assert.equal(JSON.parse(new URL(String(url)).searchParams.get('arguments')!).after, cursor);
    return Response.json(ready({ items: [], after: cursor, next_after: null, has_more: false,
      total: 1, active_quota_used: 0, active_quota_limit: 25, observed_at: '2030-01-01T00:00:00Z' }));
  }).apiKeys.list({ after: cursor.toUpperCase() });
  assert.equal(result.data?.after, cursor);
});

test('revocation keeps exact original input, requires its receipt and never automatically resends', async () => {
  let calls = 0;
  const client = api(async (_url, init) => {
    calls++; assert.equal(init?.method, 'POST'); assert.deepEqual(JSON.parse(String(init?.body)), args);
    return Response.json({ ...ready({ id, revocation_recorded: true }), operation: receipt });
  });
  assert.equal((await client.apiKeys.revoke(args)).operation?.id, id);
  assert.equal(calls, 1);
  await assert.rejects(api(async () => { calls++; throw Error('Synthetic private transport diagnostic'); }).apiKeys.revoke(args), /network_error|request_failed/);
  assert.equal(calls, 2);
  await assert.rejects(api(async () => Response.json(ready({ id, revocation_recorded: true }))).apiKeys.revoke(args), /invalid_response/);
  await assert.rejects(api(async () => Response.json({ ...ready({ id, revocation_recorded: true }), operation: { ...receipt, kind: 'other' } })).apiKeys.revoke(args), /invalid_response/);
});

test('malformed/overposted/unconfirmed inputs fail before network IO', async () => {
  let calls = 0;
  const client = api(async () => { calls++; throw Error('Unexpected request'); });
  for (const value of [{ ...args, confirm_revoke: false }, { ...args, expected_account_id: undefined },
    { ...args, key_hash: 'synthetic' }, { ...args, request_id: 'bad' }]) {
    await assert.rejects(client.apiKeys.revoke(value as never), /invalid_input/);
  }
  assert.equal(calls, 0);
  let stderr = '', stdout = '';
  const code = await runCLI(['api-keys', 'revoke', '--file', '-', '--confirm', other, '--json', '--non-interactive'], {
    env: { JOBHUNT_TOKEN: 'synthetic_key_management_credential' }, stdin: Readable.from([JSON.stringify(args)]),
    fetchImpl: async () => { calls++; throw Error('Unexpected request'); },
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk; done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk; done(); } }),
  }, 'test');
  assert.equal(code, 2); assert.equal(calls, 0); assert.equal(stdout, '');
  assert.equal(JSON.parse(stderr).error.code, 'confirmation_required');
  assert.ok(!stderr.includes('synthetic-review'));
});

test('closing preserves the complete original and validates its exact fenced or recorded outcome', async () => {
  let calls = 0;
  const client = api(async (_url, init) => {
    calls++; assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), { original: args, confirm_close: true });
    return Response.json(ready({ id, request_id: id, state: 'closed', operation: null }));
  });
  assert.equal((await client.apiKeys.closeRevocation({ original: args, confirm_close: true })).data?.state, 'closed');
  assert.equal(calls, 1);
  for (const changed of [{ id: other, request_id: id, state: 'closed', operation: null },
    { id, request_id: other, state: 'closed', operation: null }, { id, request_id: id, state: 'closed', operation: receipt },
    { id, request_id: id, state: 'recorded', operation: null }]) {
    await assert.rejects(api(async () => Response.json(ready(changed))).apiKeys.closeRevocation({ original: args, confirm_close: true }), /invalid_response/);
  }
  await assert.rejects(client.apiKeys.closeRevocation({ original: args, confirm_close: 1 } as never), /invalid_input/);
  assert.equal(calls, 1);
  await assert.rejects(api(async () => { calls++; throw Error('Synthetic lost close reply'); }).apiKeys.closeRevocation({ original: args, confirm_close: true }), /network_error|request_failed/);
  assert.equal(calls, 2);
});
