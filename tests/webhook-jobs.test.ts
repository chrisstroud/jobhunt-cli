import assert from 'node:assert/strict';
import test from 'node:test';
import { JobHuntClient, webhookJobOriginalHash, webhookTestInput, webhookReconcileInput,
  type WebhookTestOriginal, type WebhookReconcileOriginal, type WebhookJobState } from '../client/src/index.ts';
const account = 'jh_11111111-1111-4111-8111-111111111111', sub = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333', req = '44444444-4444-4444-8444-444444444444', expiry = '2030-01-01T00:00:00Z';
const plan = { expected_account_id: account, subscription_id: sub, request_id: req, expected_metadata_sha256: 'a'.repeat(64) };
const original: WebhookTestOriginal = { ...plan, review_token: 'synthetic-test-review', confirm_send: true };
const reconcilePlan = { expected_account_id: account, subscription_id: sub, request_id: req, job_id: id, expected_fingerprint: 'b'.repeat(64) };
const reconciliation: WebhookReconcileOriginal = { ...reconcilePlan, review_token: 'synthetic-reconcile-review', confirm_reconcile: true };
const state = (): WebhookJobState => ({ job_id: id, subscription_id: sub, request_id: req, kind: 'test', job_state: 'pending', receiver_state: 'not_started',
  delivery_id: null, response_status: null, attempt_count: 0, max_attempts: 3, next_attempt_at: expiry, lease_expires_at: null, failure_code: null, can_reconcile: false, fingerprint: 'b'.repeat(64) });
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const receipt = (name: string, status = 'succeeded') => ({ id, kind: name, status, resource: null, retry_after_seconds: status === 'pending' ? 2 : 0, retry_expires_at: expiry });
function fixture(reply?: unknown) {
  const calls: { name: string; args: Record<string, unknown>; method: string }[] = [];
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-job-parent' }, fetchImpl: async (url, init) => {
    const parsed = new URL(String(url)), name = parsed.pathname.split('/').at(-1)!;
    const args = init?.method === 'POST' ? JSON.parse(String(init.body)) : JSON.parse(parsed.searchParams.get('arguments')!);
    calls.push({ name, args, method: init?.method ?? 'GET' });
    if (reply) return Response.json(reply);
    if (name.startsWith('review_')) return Response.json(ready({ subscription_id: sub, review_token: 'synthetic-reviewed', expires_at: expiry }));
    if (name.startsWith('close_')) return Response.json(ready({ request_id: req, state: 'closed', operation: null }));
    if (name.startsWith('check_')) return Response.json(ready(receipt(name === 'check_webhook_test' ? 'send_webhook_test' : 'reconcile_webhook_delivery')));
    if (name === 'list_webhook_delivery_jobs') return Response.json(ready({ account_id: account, subscription_id: sub, items: [state()], after: null, next_after: null, has_more: false, total: 1 }));
    if (name === 'get_webhook_delivery_job') return Response.json(ready(state()));
    return Response.json({ ...ready(name === 'send_webhook_test' ? state() : { ...state(), job_state: 'succeeded', receiver_state: 'confirmed', delivery_id: id, response_status: 204 }), operation: receipt(name, name === 'send_webhook_test' ? 'pending' : 'succeeded') });
  } });
  return { jobs: client.webhooks.jobs, calls };
}
test('all ten job workflows use canonical originals, exact checks and thin HTTP paths', async () => {
  const { jobs, calls } = fixture();
  assert.equal((await jobs.reviewTest(plan)).data?.subscription_id, sub);
  assert.equal((await jobs.sendTest(original)).data?.job_state, 'pending');
  assert.equal((await jobs.checkTest(original)).data?.kind, 'send_webhook_test');
  assert.equal((await jobs.closeTest(original)).data?.state, 'closed');
  assert.equal((await jobs.list({ expected_account_id: account, subscription_id: sub })).data?.items[0].job_id, id);
  assert.equal((await jobs.get({ expected_account_id: account, subscription_id: sub, job_id: id })).data?.receiver_state, 'not_started');
  assert.equal((await jobs.reviewReconciliation(reconcilePlan)).data?.subscription_id, sub);
  assert.equal((await jobs.reconcile(reconciliation)).data?.receiver_state, 'confirmed');
  assert.equal((await jobs.checkReconciliation(reconciliation)).data?.status, 'succeeded');
  assert.equal((await jobs.closeReconciliation(reconciliation)).data?.state, 'closed');
  assert.equal(calls.length, 10);
  assert.deepEqual(calls.find(c => c.name === 'send_webhook_test')?.args, original);
  assert.equal(calls.find(c => c.name === 'check_webhook_test')?.args.expected_payload_hash, await webhookJobOriginalHash(original));
  assert.deepEqual(calls.find(c => c.name === 'close_webhook_delivery_reconciliation')?.args, { original: reconciliation, confirm_close: true });
});
test('invalid original consent, identifiers and private fields fail before network', async () => {
  const f = fixture();
  for (const value of [{ ...original, confirm_send: 1 }, { ...original, private_payload: {} }, { ...original, request_id: 'bad' }]) await assert.rejects(f.jobs.sendTest(value as WebhookTestOriginal));
  await assert.rejects(f.jobs.reconcile({ ...reconciliation, confirm_reconcile: false } as unknown as WebhookReconcileOriginal));
  assert.equal(f.calls.length, 0);
  assert.throws(() => webhookTestInput({ ...plan, expected_metadata_sha256: 'bad' }));
  assert.throws(() => webhookReconcileInput({ ...reconcilePlan, expected_fingerprint: 'bad' }));
});
test('status rejects foreign projections, private fields and contradictory confirmation', async () => {
  for (const data of [{ ...state(), subscription_id: id }, { ...state(), payload: { private: true } },
    { ...state(), receiver_state: 'confirmed', response_status: 500 }, { ...state(), can_reconcile: true }, { ...state(), job_id: 'bad' }]) {
    const f = fixture(ready(data)); await assert.rejects(f.jobs.get({ expected_account_id: account, subscription_id: sub, job_id: id }));
  }
  const f = fixture(ready({ account_id: 'jh_' + id, subscription_id: sub, items: [], after: null, next_after: null, has_more: false, total: 0 }));
  await assert.rejects(f.jobs.list({ expected_account_id: account, subscription_id: sub }));
});
test('request hashing is canonical and binds original consent, target and proof', async () => {
  assert.equal(await webhookJobOriginalHash(original), await webhookJobOriginalHash(Object.fromEntries(Object.entries(original).reverse()) as WebhookTestOriginal));
  assert.notEqual(await webhookJobOriginalHash(original), await webhookJobOriginalHash({ ...original, review_token: 'synthetic-other-proof' }));
  assert.notEqual(await webhookJobOriginalHash(original), await webhookJobOriginalHash({ ...original, subscription_id: id }));
});
