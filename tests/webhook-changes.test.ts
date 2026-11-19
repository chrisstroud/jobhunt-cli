import { assertPrivateFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, webhookChangeOriginal, webhookChangeHash } from '../client/src/index.ts';
import { runCLI, type IO } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222';
const plan = { expected_account_id: 'jh_' + id, subscription_id: id, request_id: request,
  expected_metadata_sha256: 'a'.repeat(64), action: 'update' as const,
  attributes: { url: 'https://example.test/🙂', events: ['task.completed'], is_active: false } };
const original = { ...plan, review_token: 'synthetic-source-bound-proof', confirm_change: true as const };
const receipt = { id: request, status: 'succeeded', kind: 'update_webhook_subscription', resource: null,
  retry_after_seconds: 0, retry_expires_at: '2026-10-24T00:00:00Z' };
const review = { subscription_id: id, action: 'update', metadata_sha256: plan.expected_metadata_sha256,
  delivery_count: 7, queued_job_count: 2, review_token: original.review_token, expires_at: '2026-10-24T00:00:00Z' };
const ready = (data: unknown, operation?: unknown) => ({ outcome: 'ready', data, ...(operation ? { operation } : {}), next_action: { kind: 'none', label: '' } });

test('reviewed webhook changes preserve exact recursive originals and method/receipt identity', async () => {
  const calls: string[] = [];
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-token' }, fetchImpl: async (url, init) => {
    const u = new URL(String(url)), name = u.pathname.split('/').at(-1)!;
    calls.push(name);
    if (name === 'review_webhook_change') { assert.equal(init?.method, 'GET'); return Response.json(ready(review)); }
    if (name === 'update_webhook_subscription') {
      assert.equal(init?.method, 'POST'); assert.deepEqual(JSON.parse(String(init.body)), original);
      return Response.json(ready({ id, action: 'update', recorded: true }, receipt));
    }
    if (name === 'check_webhook_change') {
      const args = JSON.parse(u.searchParams.get('arguments')!);
      assert.equal(args.expected_payload_hash, await webhookChangeHash(original));
      return Response.json(ready(receipt));
    }
    assert.deepEqual(JSON.parse(String(init?.body)), { original, confirm_close: true });
    return Response.json(ready({ request_id: request, state: 'recorded', operation: receipt }));
  } });
  assert.equal((await client.webhooks.changes.review(plan)).data?.delivery_count, 7);
  assert.equal((await client.webhooks.changes.apply(original)).data?.recorded, true);
  assert.equal((await client.webhooks.changes.check(original)).data?.id, request);
  assert.equal((await client.webhooks.changes.close(original)).data?.state, 'recorded');
  assert.equal(calls.length, 4);
  const canonical = JSON.stringify({ action: 'update', attributes: { events: ['task.completed'], is_active: false, url: 'https://example.test/🙂' },
    confirm_change: true, expected_account_id: plan.expected_account_id, expected_metadata_sha256: plan.expected_metadata_sha256,
    request_id: request, review_token: original.review_token, subscription_id: id });
  assert.equal(await webhookChangeHash(original), createHash('sha256').update(canonical).digest('hex'));
  const { attributes: _attributes, ...base } = original;
  const deleted = { ...base, action: 'delete' as const };
  assert.notEqual(await webhookChangeHash(deleted), await webhookChangeHash({ ...deleted, attributes: null }));
});

test('webhook client refuses loose confirmation, unknown fields, wrong receipts and never retries a lost write', async () => {
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-token' }, fetchImpl: async () => { calls++; throw new Error('Synthetic lost reply'); } });
  for (const args of [{ ...original, confirm_change: 1 }, { ...original, attributes: {} }, { ...original, attributes: { is_active: null } },
    { ...original, secret: 'synthetic' }, { ...original, action: 'delete' }, { ...original, expected_account_id: 'invalid' }]) {
    assert.throws(() => webhookChangeOriginal(args), /invalid_input/);
  }
  assert.equal(calls, 0);
  await assert.rejects(client.webhooks.changes.apply(original)); assert.equal(calls, 1);
  for (const operation of [{ ...receipt, kind: 'delete_webhook_subscription' }, { ...receipt, resource: { id, kind: 'application' } },
    { ...receipt, secret: 'synthetic' }, { ...receipt, status: 'pending' }]) {
    const invalid = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-token' },
      fetchImpl: async () => Response.json(ready({ id, action: 'update', recorded: true }, operation)) });
    await assert.rejects(invalid.webhooks.changes.apply(original), /invalid_response/);
  }
});

test('CLI saves a private original before explicit update, exposes recovery and never prints the review proof', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jh-webhook-original-'));
  try {
    const file = join(directory, 'original.json'); let out = '', err = '', sends = 0, reviews = 0;
    const io: IO = { env: { JOBHUNT_TOKEN: 'synthetic-cli-token' }, stdin: Readable.from([JSON.stringify(plan)]),
      stdout: new Writable({ write(c, _e, cb) { out += c; cb(); } }), stderr: new Writable({ write(c, _e, cb) { err += c; cb(); } }),
      fetchImpl: async (url) => {
        const name = new URL(String(url)).pathname.split('/').at(-1)!;
        if (name === 'review_webhook_change') { reviews++; return Response.json(ready(review)); }
        if (name === 'check_webhook_change') return Response.json(ready(receipt));
        if (name === 'close_webhook_change') return Response.json(ready({ request_id: request, state: 'recorded', operation: receipt }));
        sends++; assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), original);
        return Response.json(ready({ id, action: 'update', recorded: true }, receipt));
      } };
    assert.equal(await runCLI(['webhooks', 'review-change', '--file', '-', '--output', file, '--json'], io, 'test'), 0);
    assert.equal(JSON.parse(out).saved, true); await assertPrivateFile(file);
    assert.ok(!out.includes(original.review_token) && !out.includes(plan.attributes.url));
    out = ''; io.stdin = Readable.from([JSON.stringify(plan)]);
    assert.equal(await runCLI(['webhooks', 'review-change', '--file', '-', '--output', file, '--json'], io, 'test'), 7);
    assert.equal(reviews, 1);
    out = ''; err = '';
    assert.equal(await runCLI(['webhooks', 'update', '--file', file, '--confirm', request, '--json'], io, 'test'), 2);
    assert.equal(sends, 0);
    out = ''; err = '';
    assert.equal(await runCLI(['webhooks', 'remove', '--file', file, '--confirm', id, '--json'], io, 'test'), 2);
    assert.equal(sends, 0);
    for (const command of ['update', 'check-change', 'close-change']) {
      out = ''; err = '';
      assert.equal(await runCLI(['webhooks', command, '--file', file, ...(command === 'check-change' ? [] : ['--confirm', id]), '--json'], io, 'test'), 0);
      assert.equal(err, ''); assert.ok(!out.includes(original.review_token));
    }
    assert.equal(sends, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
