import { privateMode, privateFixtureFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { ErasureRecoveryClient, erasureRecoveryFile, erasureCleanupMatches } from '../client/src/index.ts';
import { runCLI, type IO } from '../cli/src/cli.ts';

const file = { kind: 'jobhunt-erasure-recovery' as const, version: 1 as const,
  origin: 'https://jobhunt.app', receipt: 'synthetic-private-erasure-receipt-only' };
const identifier = '11111111-1111-4111-8111-111111111111';
const state = { status: 'pending', stage: 'waiting_for_transfers', request_id: identifier, retryable: false,
  completed_at: null, cleanup_status: 'not_required', cleanup_last_checked_at: null, retained_categories: [], retained_reference: false };
const response = () => Response.json({ ok: true, erasure: state });
const localAccount = 'jh_' + identifier;
const binding = { version: 1 as const, request_id: identifier, binding_id: 'a'.repeat(64), import_scope: 'b'.repeat(64),
  account_digest: createHash('sha256').update('jobhunt-private-cleanup-v1\0' + 'a'.repeat(64) + '\0' + localAccount).digest('hex') };

test('opaque cleanup binding is an exact read and matches only the original local account', async () => {
  let calls = 0;
  const client = new ErasureRecoveryClient(file, { fetchImpl: async (url, options) => {
    calls++; assert.equal(new URL(String(url)).pathname, '/api/v1/account-erasure/cleanup-binding');
    assert.equal(options?.method, 'GET'); assert.equal(options?.redirect, 'error');
    assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer ' + file.receipt);
    return Response.json({ ok: true, binding });
  } });
  const value = await client.cleanupBinding();
  assert.deepEqual(value, binding); assert.equal(calls, 1);
  assert.equal(await erasureCleanupMatches(value, localAccount), true);
  assert.equal(await erasureCleanupMatches(value, 'jh_22222222-2222-4222-8222-222222222222'), false);
  await assert.rejects(erasureCleanupMatches(value, 'unknown'));
});

test('invalid or unavailable cleanup bindings never authorize a local match or automatic retry', async () => {
  for (const changed of [{ version: 2 }, { request_id: 'bad' }, { account_digest: 'bad' }, { import_scope: 'bad' }, { user_id: identifier }]) {
    let calls = 0;
    const client = new ErasureRecoveryClient(file, { fetchImpl: async () => { calls++; return Response.json({ ok: true, binding: { ...binding, ...changed } }); } });
    await assert.rejects(client.cleanupBinding(), /invalid_response/); assert.equal(calls, 1);
  }
  let calls = 0;
  const client = new ErasureRecoveryClient(file, { fetchImpl: async () => { calls++; return Response.json({ ok: false, code: 'cleanup_binding_unavailable' }, { status: 409 }); } });
  await assert.rejects(client.cleanupBinding()); assert.equal(calls, 1);
});

test('caller mutation while hashing cannot change the captured cleanup binding', async () => {
  const original = { ...binding };
  const matching = erasureCleanupMatches(original, localAccount);
  original.account_digest = '0'.repeat(64); original.binding_id = '0'.repeat(64);
  assert.equal(await matching, true);
});

test('CLI reads cleanup metadata from its private file without ordinary account authority', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jh-cleanup-binding-test-')), path = join(directory, 'recovery.json');
  await privateFixtureFile(path, JSON.stringify(file));
  let stdout = '', stderr = '', calls = 0;
  const io: IO = { env: { JOBHUNT_TOKEN: 'synthetic-ordinary-token-not-used' }, stdin: Readable.from([]),
    stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
    stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
    storeFactory: () => { throw Error('Ordinary account vault must not be read'); },
    fetchImpl: async (_url, options) => { calls++; assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer ' + file.receipt); return Response.json({ ok: true, binding }); } };
  assert.equal(await runCLI(['account', 'erasure-cleanup-binding', '--recovery-file', path, '--json'], io, 'test'), 0);
  assert.equal(calls, 1); assert.deepEqual(JSON.parse(stdout), binding); assert.equal(stderr, '');
  assert.ok(!stdout.includes(file.receipt) && !stdout.includes(localAccount));
});

test('purpose-specific client sends private header only to its exact origin without cookies or redirects', async () => {
  const paths: string[] = [];
  const client = new ErasureRecoveryClient(file, { fetchImpl: async (url, options) => {
    const target = new URL(String(url)); paths.push(target.pathname);
    assert.equal(target.origin, file.origin); assert.equal(target.search, '');
    assert.equal(options?.redirect, 'error'); assert.equal(options?.credentials, 'omit');
    assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer ' + file.receipt);
    if (options?.method === 'POST') assert.deepEqual(JSON.parse(String(options.body)), { request_id: identifier, confirm_retry: true });
    return response();
  } });
  assert.deepEqual(await client.status(), state); assert.deepEqual(await client.retry(identifier, true), state);
  assert.deepEqual(paths, ['/api/v1/account-erasure/status', '/api/v1/account-erasure/retry']);
  await assert.rejects(client.retry(identifier, false as true), /confirmation_required/);
  await assert.rejects(client.retry('bad', true), /confirmation_required/);
  assert.equal(paths.length, 2);
});

test('recovery files cannot silently transfer authority, accept extra data or use insecure origins', () => {
  for (const changed of [{ version: 2 }, { kind: 'account-token' }, { receipt: 'short' }, { receipt: 'x'.repeat(4100) },
    { receipt: file.receipt + '\n' }, { account: identifier }, { origin: 'https://attacker.example.test' }]) {
    assert.throws(() => erasureRecoveryFile({ ...file, ...changed }, file.origin));
  }
  assert.throws(() => new ErasureRecoveryClient(file, { origin: 'https://attacker.example.test' }));
  assert.throws(() => new ErasureRecoveryClient({ ...file, origin: 'http://jobhunt.app' }));
});

test('untrusted recovery responses never become successful status or automatic retries', async () => {
  for (const changed of [{ status: 'accepted' }, { request_id: 'bad' }, { stage: 'raw private detail' },
    { retained_reference: 1 }, { retryable: 1 }, { cleanup_status: 'done' }, { completed_at: 'bad' }, { account_records: [] }]) {
    let calls = 0;
    const client = new ErasureRecoveryClient(file, { fetchImpl: async () => { calls++; return Response.json({ ok: true, erasure: { ...state, ...changed } }); } });
    await assert.rejects(client.status(), /invalid_response/); assert.equal(calls, 1);
  }
  for (const status of [401, 403, 409, 429, 503]) {
    let calls = 0;
    const client = new ErasureRecoveryClient(file, { fetchImpl: async () => { calls++; return Response.json({ ok: false, code: 'recovery_authentication_required' }, { status }); } });
    await assert.rejects(client.status()); assert.equal(calls, 1);
  }
});

test('CLI recovery uses only a private file, bypasses ordinary vault login, confirms retry and redacts credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jh-recovery-test-')), path = join(directory, 'recovery.json');
  await privateFixtureFile(path, JSON.stringify(file));
  let calls = 0, stdout = '', stderr = '';
  const io: IO = { env: { JOBHUNT_TOKEN: 'synthetic-ordinary-token-must-not-be-used' }, stdin: Readable.from([]),
    stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
    stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
    storeFactory: () => { throw Error('Ordinary account vault must not be read'); },
    fetchImpl: async (_url, options) => { calls++; assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer ' + file.receipt); return response(); } };
  assert.equal(await runCLI(['account', 'erasure-status', '--recovery-file', path, '--json'], io, 'test'), 0);
  assert.deepEqual(JSON.parse(stdout), state); assert.equal(stderr, ''); stdout = '';
  assert.equal(await runCLI(['account', 'retry-erasure', '--recovery-file', path, '--json'], io, 'test'), 2);
  assert.equal(calls, 1); assert.equal(stdout, ''); stderr = '';
  assert.equal(await runCLI(['account', 'retry-erasure', '--recovery-file', path, '--confirm', identifier, '--json'], io, 'test'), 0);
  assert.equal(calls, 2); assert.ok(!(stdout + stderr).includes(file.receipt)); stdout = ''; stderr = '';
  await privateMode(path, 0o644);
  assert.equal(await runCLI(['account', 'erasure-status', '--recovery-file', path, '--json'], io, 'test'), 3);
  assert.equal(JSON.parse(stderr).error.code, 'unsafe_credential_permissions');
  assert.equal(calls, 2); assert.ok(!(stdout + stderr).includes(file.receipt));
});
