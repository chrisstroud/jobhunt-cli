import assert from 'node:assert/strict';
import test from 'node:test';
import { JobHuntClient, createWebhookRecipient, webhookFieldFile, webhookFieldInput, webhookFieldHash,
  type WebhookFieldCreation, type WebhookFieldIssue, type WebhookFieldUpdate } from '../client/src/index.ts';

const account = 'jh_11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222';
const subscription = '33333333-3333-4333-8333-333333333333', expiry = '2030-01-01T00:00:00Z';
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const operation = (kind = 'issue_webhook_subscription') => ({ id: subscription, kind, status: 'succeeded', resource: null, retry_after_seconds: 0, retry_expires_at: expiry });
const creationBytes = new TextEncoder().encode(JSON.stringify({ url: ' https://example.test/synthetic ', events: Array(40000).fill('task.completed') }));
test('complete fields retain native arrays and exact bytes beyond compact limits', async () => {
  assert.ok(creationBytes.length > 524288);
  const descriptor = await webhookFieldFile(creationBytes, true);
  assert.equal(descriptor.source_size, creationBytes.length);
  await assert.rejects(webhookFieldFile(new Uint8Array([...creationBytes, 32]), true, descriptor), /source_file_changed/u);
  for (const value of [{ secret: 'synthetic' }, { url: 'x', events: ['task.completed'], private_pkcs8: 'synthetic' }, { events: [null] }]) {
    await assert.rejects(webhookFieldFile(new TextEncoder().encode(JSON.stringify(value)), true), /invalid_input/u);
  }
  await assert.rejects(webhookFieldFile(new Uint8Array(16 * 1024 * 1024 + 1), false), /invalid_input/u);
});
test('multipart create and update bind public descriptors and preserve exact source bytes', async () => {
  const recipient = await createWebhookRecipient();
  const input: WebhookFieldCreation = { expected_account_id: account, request_id: request, recipient_public_key: recipient.recipient_public_key, ...await webhookFieldFile(creationBytes, true) };
  const original = { ...input, review_token: 'synthetic-reviewed', confirm_create: true as const };
  const patch = new TextEncoder().encode(JSON.stringify({ events: Array(2001).fill('task.completed'), is_active: false }));
  const update: WebhookFieldUpdate = { expected_account_id: account, request_id: request, subscription_id: subscription,
    action: 'update', expected_metadata_sha256: 'a'.repeat(64), ...await webhookFieldFile(patch, false) };
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-fields-parent' }, fetchImpl: async (url, init) => {
    calls++; assert.ok(init?.body instanceof FormData); assert.equal(init.method, 'POST');
    const args = JSON.parse(String(init.body.get('intent'))), bytes = new Uint8Array(await (init.body.get('attributes') as Blob).arrayBuffer());
    assert.ok(!('attributes' in args) && !('url' in args) && !('events' in args) && !('private_pkcs8' in args));
    assert.deepEqual(bytes, String(url).includes('update') ? patch : creationBytes);
    if (String(url).endsWith('creation-review')) return Response.json(ready({ recipient_fingerprint: recipient.recipient_fingerprint, review_token: original.review_token, expires_at: expiry }));
    if (String(url).endsWith('fields-issue')) return Response.json({ ...ready({ subscription_id: subscription, request_id: request,
      recipient_fingerprint: recipient.recipient_fingerprint, state: 'available', sealed_jwe: 'a.b.c.d.e', expires_at: expiry }), operation: operation() });
    if (String(url).endsWith('update-review')) return Response.json(ready({ subscription_id: subscription, action: 'update', metadata_sha256: update.expected_metadata_sha256,
      delivery_count: 0, queued_job_count: 0, review_token: 'synthetic-update', expires_at: expiry }));
    return Response.json({ ...ready({ id: subscription, action: 'update', recorded: true }), operation: operation('update_webhook_subscription') });
  } });
  assert.equal((await client.webhooks.fields.reviewCreation(input, creationBytes)).data?.recipient_fingerprint, recipient.recipient_fingerprint);
  assert.equal((await client.webhooks.fields.issue(original, creationBytes)).data?.subscription_id, subscription);
  assert.equal((await client.webhooks.fields.reviewUpdate(update, patch)).data?.metadata_sha256, update.expected_metadata_sha256);
  assert.equal((await client.webhooks.fields.update({ ...update, review_token: 'synthetic-update', confirm_change: true }, patch)).data?.recorded, true);
  assert.equal(calls, 4);
});
test('malformed descriptors, changed files and unsafe consent dispatch nothing; lost mutation is not retried', async () => {
  const recipient = await createWebhookRecipient();
  const original: WebhookFieldIssue = { expected_account_id: account, request_id: request, recipient_public_key: recipient.recipient_public_key,
    ...await webhookFieldFile(creationBytes, true), review_token: 'synthetic-webhook-fields-parent', confirm_create: true };
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-fields-parent' }, fetchImpl: async () => { calls++; throw Error('synthetic-private-network-error'); } });
  for (const changed of [{ ...original, confirm_create: 1 }, { ...original, source_size: true }, { ...original, private_pkcs8: 'synthetic' },
    { ...original, expected_account_id: request }, { ...original, source_sha256: 'invalid' }]) {
    assert.throws(() => webhookFieldInput(changed, true, true), /invalid_input/u);
  }
  await assert.rejects(client.webhooks.fields.issue(original, new Uint8Array([...creationBytes, 32])), /source_file_changed/u);
  assert.equal(calls, 0);
  await assert.rejects(client.webhooks.fields.issue(original, creationBytes)); assert.equal(calls, 1);
});
test('file check/closure use original hashes and the existing receipt namespaces without source bytes', async () => {
  const original = webhookFieldInput({ expected_account_id: account, request_id: request, recipient_public_key: 'a'.repeat(550),
    source_sha256: 'b'.repeat(64), source_size: 100, review_token: 'synthetic-webhook-fields-parent', confirm_create: true }, true, true);
  const expected = await webhookFieldHash(original); const calls: string[] = [];
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-fields-parent' }, fetchImpl: async (url, init) => {
    const u = new URL(String(url)); calls.push(u.pathname);
    if (u.pathname.endsWith('check_webhook_creation')) {
      assert.equal(JSON.parse(u.searchParams.get('arguments')!).expected_payload_hash, expected);
      return Response.json(ready(operation()));
    }
    assert.deepEqual(JSON.parse(String(init?.body)), { original, confirm_close: true });
    return Response.json(ready({ request_id: request, state: 'closed', subscription_id: null }));
  } });
  assert.equal((await client.webhooks.fields.checkCreation(original)).data?.kind, 'issue_webhook_subscription');
  assert.equal((await client.webhooks.fields.closeCreation(original)).data?.state, 'closed'); assert.equal(calls.length, 2);
});
test('forged private or wrong-recipient file review responses fail closed', async () => {
  const recipient = await createWebhookRecipient();
  const input = { expected_account_id: account, request_id: request, recipient_public_key: recipient.recipient_public_key, ...await webhookFieldFile(creationBytes, true) };
  for (const data of [{ recipient_fingerprint: '0'.repeat(64), review_token: 'synthetic-webhook-fields-parent', expires_at: expiry },
    { recipient_fingerprint: recipient.recipient_fingerprint, review_token: 'synthetic-webhook-fields-parent', expires_at: expiry, secret: 'synthetic' }]) {
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-fields-parent' }, fetchImpl: async () => Response.json(ready(data)) });
    await assert.rejects(client.webhooks.fields.reviewCreation(input, creationBytes), /invalid_response/u);
  }
});
