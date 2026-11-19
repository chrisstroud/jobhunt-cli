import assert from 'node:assert/strict';
import test from 'node:test';
import { JobHuntClient, accountNameInput, accountNameOriginalHash } from '../client/src/index.ts';
const account = 'jh_11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222';
const original = { expected_account_id: account, request_id: request, expected_name: 'Synthetic before', name: ' 🧭 Synthetic after ' };
const data = { account_id: account, name: '🧭 Synthetic after', email: 'synthetic@example.test' };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const saved = () => ({ ...ready(data), operation: { id: request, kind: 'save_account_display_name', status: 'succeeded',
  resource: { id: account.slice(3), kind: 'profile', label: 'Account display name', revision: null, website_url: null }, retry_after_seconds: 0, retry_expires_at: '2030-01-01T00:00:00Z' } });
test('account name uses exact captured original and independently verifies returned account/receipt', async () => {
  const seen: string[] = [];
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-account-name-token' }, fetchImpl: async (url, init) => {
    const u = new URL(String(url)); seen.push(u.pathname);
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    if (u.pathname.endsWith('get_account_display_name')) return Response.json(ready(data));
    if (u.pathname.endsWith('save_account_display_name')) { assert.deepEqual(JSON.parse(String(init?.body)), original); return Response.json(saved()); }
    if (u.pathname.endsWith('check_account_display_name')) {
      const args = JSON.parse(u.searchParams.get('arguments')!); assert.equal(args.expected_payload_hash, await accountNameOriginalHash(original));
      assert.ok(!u.href.includes('Synthetic')); return Response.json(saved());
    }
    assert.deepEqual(JSON.parse(String(init?.body)), { original, confirm_close: true });
    return Response.json(ready({ request_id: request, state: 'recorded' }));
  } });
  assert.equal((await client.accountName.get()).data?.account_id, account);
  assert.equal((await client.accountName.save(original)).data?.name, data.name);
  assert.equal((await client.accountName.check(original)).operation?.id, request);
  assert.equal((await client.accountName.close(original)).data?.state, 'recorded');
  assert.equal(seen.length, 4);
});
test('name originals preserve Unicode/whitespace and reject missing source, malformed IDs and private fields', async () => {
  assert.deepEqual(accountNameInput(original), original);
  assert.equal((await accountNameOriginalHash(original)).length, 64);
  assert.notEqual(await accountNameOriginalHash(original), await accountNameOriginalHash({ ...original, name: original.name.trim() }));
  for (const value of [{ ...original, expected_name: undefined }, { ...original, request_id: 'wrong' },
    { ...original, raw_key: 'synthetic' }, { ...original, name: '\ud800' }, { ...original, name: 9 }]) assert.throws(() => accountNameInput(value));
});
test('account or receipt substitutions fail closed without retrying the mutation', async () => {
  for (const value of [{ ...saved(), data: { ...data, account_id: 'jh_' + request } },
    { ...saved(), raw_key: 'synthetic' }, { ...saved(), operation: { ...saved().operation, resource: { ...saved().operation.resource, id: request } } }, ready(data)]) {
    let calls = 0;
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-account-name-token' }, fetchImpl: async () => { calls++; return Response.json(value); } });
    await assert.rejects(client.accountName.save(original), /invalid_response/u); assert.equal(calls, 1);
  }
});
