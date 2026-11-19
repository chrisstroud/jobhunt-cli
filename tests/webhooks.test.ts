import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI, type IO } from '../cli/src/cli.ts';
const id = '11111111-1111-4111-8111-111111111111', event = '22222222-2222-4222-8222-222222222222', account = 'jh_' + id;
const sub = { id, url: 'https://example.test/hook/' + '🙂'.repeat(4000), events: ['task.completed'], is_active: false,
  consecutive_failures: 10, last_triggered_at: null, created_at: '2026-10-23T00:00:00Z', updated_at: null };
const attempt = { id: event, subscription_id: id, event_type: 'task.completed', response_status: 503, attempt_count: 3, success: false,
  error_message: 'Synthetic failure 🙂'.repeat(10000), delivered_at: null, created_at: null };
const { url: _url, events: _events, ...summary } = sub;
const { error_message: _error, ...eventSummary } = attempt;
const page = { account_id: account, items: [summary], after: null, next_after: null, has_more: false, total: 1 };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const value = (name: string) => name === 'list_webhook_subscriptions' ? page : name === 'get_webhook_subscription' ? sub :
  name === 'list_webhook_deliveries' ? { ...page, subscription_id: id, items: [eventSummary] } : attempt;
test('webhook client preserves complete native metadata and exact account/subscription identity', async () => {
  const seen: string[] = [];
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-token' }, fetchImpl: async (url, init) => {
    const u = new URL(String(url)), name = u.pathname.split('/').at(-1)!; seen.push(name);
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit'); assert.equal(init?.method, 'GET');
    assert.equal(JSON.parse(u.searchParams.get('arguments')!).expected_account_id, account);
    return Response.json(ready(value(name)));
  } });
  assert.deepEqual((await client.webhooks.list({ expected_account_id: account })).data, page);
  assert.deepEqual((await client.webhooks.get({ expected_account_id: account, subscription_id: id })).data, sub);
  assert.deepEqual((await client.webhooks.deliveries({ expected_account_id: account, subscription_id: id })).data?.items, [eventSummary]);
  assert.deepEqual((await client.webhooks.delivery({ expected_account_id: account, subscription_id: id, delivery_id: event })).data, attempt);
  assert.equal(seen.length, 4);
});
test('webhook client rejects extra private fields, substituted identities and broken cursor pages', async () => {
  for (const data of [{ ...page, account_id: 'jh_' + event }, { ...page, after: event }, { ...page, has_more: true },
    { ...page, next_after: id }, { ...page, items: [{ ...summary, secret: 'synthetic-signing-secret' }] },
    { ...page, items: [summary, summary] }, { ...page, total: 0 }, { ...page, items: [{ ...summary, is_active: 1 }] }]) {
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-test-token' }, fetchImpl: async () => Response.json(ready(data)) });
    await assert.rejects(async () => client.webhooks.list({ expected_account_id: account }), /invalid_response/);
  }
  for (const data of [{ ...attempt, subscription_id: event }, { ...attempt, id }, { ...attempt, payload: {} }, { ...attempt, response_body: 'private' }]) {
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-test-token' }, fetchImpl: async () => Response.json(ready(data)) });
    await assert.rejects(async () => client.webhooks.delivery({ expected_account_id: account, subscription_id: id, delivery_id: event }), /invalid_response/);
  }
});
test('invalid webhook input dispatches nothing; failed reads never automatically retry', async () => {
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-test-token' }, fetchImpl: async () => { calls++; return Response.json({ ok: false, code: 'insufficient_scope' }, { status: 403 }); } });
  for (const args of [{ expected_account_id: 'bad' }, { expected_account_id: account, after: 'bad' }, { expected_account_id: account, secret: 'invalid' }]) {
    assert.throws(() => client.webhooks.list(args), /invalid_input/);
  }
  assert.equal(calls, 0);
  await assert.rejects(client.webhooks.list({ expected_account_id: account })); assert.equal(calls, 1);
});
test('CLI exposes four owned reads with required captured account and no implicit writes', async () => {
  let out = '', err = ''; const seen: string[] = [];
  const io: IO = { env: { JOBHUNT_TOKEN: 'synthetic-webhook-cli-token' }, stdin: Readable.from([]),
    stdout: new Writable({ write(chunk, _enc, cb) { out += chunk; cb(); } }), stderr: new Writable({ write(chunk, _enc, cb) { err += chunk; cb(); } }),
    fetchImpl: async (url, init) => { const name = new URL(String(url)).pathname.split('/').at(-1)!; seen.push(name); assert.equal(init?.method, 'GET'); return Response.json(ready(value(name))); } };
  for (const args of [['list'], ['get', id], ['deliveries', id], ['delivery', event, '--subscription-id', id]]) {
    out = ''; assert.equal(await runCLI(['webhooks', ...args, '--account-id', account, '--json'], io, 'test'), 0);
    assert.equal(JSON.parse(out).outcome, 'ready'); assert.equal(err, '');
  }
  out = ''; assert.equal(await runCLI(['webhooks', 'list', '--json'], io, 'test'), 2); assert.equal(out, ''); assert.equal(seen.length, 4);
});

test('compact webhook reads preserve the explicit complete-file recovery state', async () => {
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-test-token' },
    fetchImpl: async () => Response.json({ outcome: 'needs_input', data: null, next_action: { kind: 'read', label: 'Use get_webhook_metadata_file with this same account and record for complete fields.' } }) });
  const result = await client.webhooks.delivery({ expected_account_id: account, subscription_id: id, delivery_id: event });
  assert.equal(result.outcome, 'needs_input'); assert.equal(result.data, null); assert.match(result.next_action.label, /get_webhook_metadata_file/);
});
