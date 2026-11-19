import assert from 'node:assert/strict';
import { createCipheriv, createPublicKey, publicEncrypt, randomBytes, constants } from 'node:crypto';
import test from 'node:test';
import { JobHuntClient, createApiKeyRecipient, decryptApiKeyDelivery, type ApiKeyDelivery } from '../client/src/index.ts';
import { keyCreationInput } from '../client/src/key-delivery.ts';

const owner = 'jh_11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222', key = '33333333-3333-4333-8333-333333333333';
const expected = { expected_account_id: owner, request_id: request, key_id: key };
const b64 = (value: Uint8Array | string) => Buffer.from(value).toString('base64url');
test('key names preserve the native 255 Unicode code-point boundary', () => {
  const input = { expected_account_id: owner, request_id: request, attributes: { name: '🧭'.repeat(255), scopes: [] }, recipient_public_key: 'a'.repeat(550) };
  assert.equal((keyCreationInput(input) as typeof input).attributes.name, input.attributes.name);
  for (const name of ['🧭'.repeat(256), 'x'.repeat(256), '']) assert.throws(() => keyCreationInput({ ...input, attributes: { name, scopes: [] } }), /invalid_input/u);
});
async function fixture() {
  const recipient = await createApiKeyRecipient();
  const header = { account_id: owner, alg: 'RSA-OAEP-256', enc: 'A256GCM', key_id: key,
    kid: recipient.recipient_fingerprint, request_id: request, typ: 'jobhunt-api-key+jwe' };
  const protectedPart = b64(JSON.stringify(header)), cek = randomBytes(32), iv = randomBytes(12);
  const encryptedKey = publicEncrypt({ key: createPublicKey({ key: Buffer.from(recipient.recipient_public_key, 'base64url'), format: 'der', type: 'spki' }),
    padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, cek);
  const cipher = createCipheriv('aes-256-gcm', cek, iv); cipher.setAAD(Buffer.from(protectedPart));
  const secret = 'jsk_live_' + '1'.repeat(32);
  const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
  const value: ApiKeyDelivery = { key_id: key, request_id: request, recipient_fingerprint: recipient.recipient_fingerprint,
    state: 'available', expires_at: '2030-01-01T00:00:00Z',
    sealed_jwe: [protectedPart, b64(encryptedKey), b64(iv), b64(encrypted), b64(cipher.getAuthTag())].join('.') };
  return { recipient, value, secret };
}

test('local recipient is nonextractable and native compact JWE decrypts only with exact binding', async () => {
  const f = await fixture();
  assert.equal(f.recipient.privateKey.extractable, false);
  assert.equal(f.recipient.privateKey.algorithm.name, 'RSA-OAEP');
  assert.match(f.recipient.recipient_fingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(await decryptApiKeyDelivery(f.value, expected, f.recipient.privateKey), f.secret);
  assert.ok(!JSON.stringify(f.value).includes(f.secret));
  await assert.rejects(crypto.subtle.exportKey('pkcs8', f.recipient.privateKey));
});

test('recipient, target, account, nonce, authenticated header and ciphertext substitutions fail safely', async () => {
  const f = await fixture(), another = await createApiKeyRecipient();
  for (const changed of [{ ...expected, expected_account_id: 'jh_' + key }, { ...expected, request_id: key }, { ...expected, key_id: request }]) {
    await assert.rejects(decryptApiKeyDelivery(f.value, changed, f.recipient.privateKey), /invalid_credential_delivery/u);
  }
  await assert.rejects(decryptApiKeyDelivery(f.value, expected, another.privateKey), /invalid_credential_delivery/u);
  for (const part of [0, 1, 2, 3, 4]) {
    const parts = f.value.sealed_jwe!.split('.');
    const bytes = Buffer.from(parts[part]!, 'base64url'); bytes[0] = bytes[0]! ^ 1; parts[part] = b64(bytes);
    await assert.rejects(decryptApiKeyDelivery({ ...f.value, sealed_jwe: parts.join('.') }, expected, f.recipient.privateKey), /invalid_credential_delivery/u);
  }
  for (const state of ['acknowledged', 'expired', 'unavailable'] as const) {
    await assert.rejects(decryptApiKeyDelivery({ ...f.value, state, sealed_jwe: null }, expected, f.recipient.privateKey), /invalid_credential_delivery/u);
  }
});

test('issuance client preserves exact original, rejects secret-bearing replies and never retries', async () => {
  const f = await fixture();
  const original = { expected_account_id: owner, request_id: request, attributes: { name: 'Synthetic CLI key', scopes: ['read:developer'] }, recipient_public_key: f.recipient.recipient_public_key,
    review_token: 'synthetic-review', confirm_create: true as const };
  const operation = { id: key, kind: 'issue_api_key_record', status: 'succeeded', resource: null, retry_after_seconds: 0, retry_expires_at: '2030-01-01T00:00:00Z' };
  const ready = (data: unknown) => ({ outcome: 'ready', data, operation, next_action: { kind: 'none', label: '' } });
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-parent' }, fetchImpl: async (_url, init) => {
    calls++; assert.equal(init?.method, 'POST'); assert.deepEqual(JSON.parse(String(init?.body)), original); return Response.json(ready(f.value));
  } });
  assert.deepEqual((await client.apiKeys.issuance.issue(original)).data, f.value); assert.equal(calls, 1);
  for (const extra of [{ secret: f.secret }, { key_hash: 'synthetic-hash' }, { raw_key: f.secret }]) {
    const unsafe = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-parent' }, fetchImpl: async () => Response.json(ready({ ...f.value, ...extra })) });
    await assert.rejects(unsafe.apiKeys.issuance.issue(original), /invalid_response/u);
  }
  const lost = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-parent' }, fetchImpl: async () => { calls++; throw Error('synthetic-private-network-error'); } });
  await assert.rejects(lost.apiKeys.issuance.issue(original), /request_failed|network_error/u); assert.equal(calls, 2);
  await assert.rejects(client.apiKeys.issuance.issue({ ...original, confirm_create: 1 } as never), /invalid_input/u); assert.equal(calls, 2);
});
