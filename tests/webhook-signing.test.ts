import assert from 'node:assert/strict';
import { createCipheriv, createHash, createPublicKey, publicEncrypt, randomBytes } from 'node:crypto';
import test from 'node:test';
import { JobHuntClient, createWebhookRecipient, decryptWebhookSigningDelivery, webhookCreationHash,
  webhookCreationInput, type WebhookSigningDelivery } from '../client/src/index.ts';

const owner = 'jh_11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222', id = '33333333-3333-4333-8333-333333333333';
const expected = { expected_account_id: owner, request_id: request, subscription_id: id };
const b64 = (v: Uint8Array | string) => Buffer.from(v).toString('base64url');
async function fixture() {
  const recipient = await createWebhookRecipient();
  const header = { account_id: owner, alg: 'RSA-OAEP-256', enc: 'A256GCM', kid: recipient.recipient_fingerprint,
    request_id: request, subscription_id: id, typ: 'jobhunt-webhook-signing+jwe' };
  const protectedPart = b64(JSON.stringify(header)), cek = randomBytes(32), iv = randomBytes(12);
  const encryptedKey = publicEncrypt({ key: createPublicKey({ key: Buffer.from(recipient.recipient_public_key, 'base64url'),
    format: 'der', type: 'spki' }), oaepHash: 'sha256' }, cek);
  const cipher = createCipheriv('aes-256-gcm', cek, iv); cipher.setAAD(Buffer.from(protectedPart));
  const secret = 'a'.repeat(64), encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
  const delivery: WebhookSigningDelivery = { subscription_id: id, request_id: request, recipient_fingerprint: recipient.recipient_fingerprint,
    state: 'available', expires_at: '2030-01-01T00:00:00Z',
    sealed_jwe: [protectedPart, b64(encryptedKey), b64(iv), b64(encrypted), b64(cipher.getAuthTag())].join('.') };
  return { recipient, delivery, secret };
}
test('webhook recipient is nonextractable; exact account/request/subscription delivery decrypts locally', async () => {
  const f = await fixture();
  assert.equal(f.recipient.privateKey.extractable, false);
  assert.equal(await decryptWebhookSigningDelivery(f.delivery, expected, f.recipient.privateKey), f.secret);
  assert.ok(!JSON.stringify(f.delivery).includes(f.secret));
  await assert.rejects(crypto.subtle.exportKey('pkcs8', f.recipient.privateKey));
  const other = await createWebhookRecipient();
  await assert.rejects(decryptWebhookSigningDelivery(f.delivery, expected, other.privateKey), /invalid_credential_delivery/);
  for (const changed of [{ ...expected, expected_account_id: 'jh_' + id }, { ...expected, request_id: id }, { ...expected, subscription_id: request }]) {
    await assert.rejects(decryptWebhookSigningDelivery(f.delivery, changed, f.recipient.privateKey), /invalid_credential_delivery/);
  }
  for (const part of [0, 1, 2, 3, 4]) {
    const pieces = f.delivery.sealed_jwe!.split('.'), bytes = Buffer.from(pieces[part]!, 'base64url');
    bytes[0] = bytes[0]! ^ 1; pieces[part] = b64(bytes);
    await assert.rejects(decryptWebhookSigningDelivery({ ...f.delivery, sealed_jwe: pieces.join('.') }, expected, f.recipient.privateKey), /invalid_credential_delivery/);
  }
});
test('SDK binds creation recipient, rejects plaintext/extra fields and never retries a lost write', async () => {
  const f = await fixture(), original = { expected_account_id: owner, request_id: request, url: ' https://example.test/synthetic ',
    events: ['task.completed'], recipient_public_key: f.recipient.recipient_public_key, review_token: 'synthetic-review', confirm_create: true as const };
  const operation = { id, kind: 'issue_webhook_subscription', status: 'succeeded', resource: null, retry_after_seconds: 0, retry_expires_at: '2030-01-01T00:00:00Z' };
  const ready = (data: unknown) => ({ outcome: 'ready', data, operation, next_action: { kind: 'none', label: '' } });
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-parent' }, fetchImpl: async (_url, init) => {
    calls++; assert.equal(init?.method, 'POST'); assert.deepEqual(JSON.parse(String(init?.body)), original); return Response.json(ready(f.delivery));
  } });
  assert.deepEqual((await client.webhooks.issuance.issue(original)).data, f.delivery); assert.equal(calls, 1);
  for (const extra of [{ secret: f.secret }, { raw_key: f.secret }, { payload: {} }, { recipient_fingerprint: 'b'.repeat(64) }]) {
    const unsafe = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-parent' }, fetchImpl: async () => Response.json(ready({ ...f.delivery, ...extra })) });
    await assert.rejects(unsafe.webhooks.issuance.issue(original), /invalid_response/);
  }
  const lost = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-parent' }, fetchImpl: async () => { calls++; throw Error('synthetic-lost-response'); } });
  await assert.rejects(lost.webhooks.issuance.issue(original)); assert.equal(calls, 2);
  await assert.rejects(client.webhooks.issuance.issue({ ...original, confirm_create: 1 } as never), /invalid_input/); assert.equal(calls, 2);
});
test('creation hashing preserves URL whitespace, event ordering and native UUID normalization', async () => {
  const original = { expected_account_id: owner, request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    url: ' https://example.test/🙂 ', events: ['task.completed', 'task.created'], recipient_public_key: 'a'.repeat(550),
    review_token: 'synthetic', confirm_create: true as const };
  assert.equal(await webhookCreationHash(original), await webhookCreationHash({ ...original, request_id: original.request_id.toUpperCase() }));
  assert.notEqual(await webhookCreationHash(original), await webhookCreationHash({ ...original, url: original.url.trim() }));
  assert.notEqual(await webhookCreationHash(original), await webhookCreationHash({ ...original, events: [...original.events].reverse() }));
  const stable = Object.fromEntries(Object.entries(original).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  assert.equal(await webhookCreationHash(original), createHash('sha256').update(JSON.stringify(stable)).digest('hex'));
  for (const input of [{ ...original, url: 'x'.repeat(2049) }, { ...original, events: [] }, { ...original, events: [1] }, { ...original, secret: 'synthetic' }]) {
    assert.throws(() => webhookCreationInput(input, true), /invalid_input/);
  }
});
