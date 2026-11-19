import assert from 'node:assert/strict';
import test from 'node:test';
import { JobHuntClient, apiKeyAttributeFile, createApiKeyRecipient, type ApiKeyFileReviewInput } from '../client/src/index.ts';
import { keyFileCreationInput } from '../client/src/key-delivery.ts';
const account = 'jh_11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222', key = '33333333-3333-4333-8333-333333333333';
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
test('full native attributes bind exact bytes without the compact scope-string or UTF16 restriction', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ name: ' '.repeat(300) + '🧭'.repeat(255), scopes: ['read:developer'.repeat(60000)] }));
  const metadata = await apiKeyAttributeFile(bytes);
  assert.equal(metadata.source_size, bytes.length); assert.ok(bytes.length > 524288);
  const nativeWhitespace = new TextEncoder().encode(JSON.stringify({ name: '\u0085'.repeat(300) + '🧭'.repeat(255) + '\u001c'.repeat(300) }));
  assert.equal((await apiKeyAttributeFile(nativeWhitespace)).source_size, nativeWhitespace.length);
  await assert.rejects(apiKeyAttributeFile(new Uint8Array([...bytes, 32]), metadata), /source_file_changed/u);
  await assert.rejects(apiKeyAttributeFile(new TextEncoder().encode('{"name":"Synthetic","private_pkcs8":"synthetic"}')), /invalid_input/u);
});
test('review and issue upload only public intent plus the exact bounded attributes file', async () => {
  const recipient = await createApiKeyRecipient(), bytes = new TextEncoder().encode('{"name":"Synthetic","scopes":["read:developer"]}');
  const input: ApiKeyFileReviewInput = { expected_account_id: account, request_id: request, recipient_public_key: recipient.recipient_public_key, ...await apiKeyAttributeFile(bytes) };
  const original = { ...input, review_token: 'synthetic-reviewed-file', confirm_create: true as const };
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-parent' }, fetchImpl: async (url, init) => {
    calls++; assert.equal(init?.method, 'POST'); assert.ok(init.body instanceof FormData);
    const form = init.body as FormData, intent = JSON.parse(String(form.get('intent')));
    assert.ok(!('file' in intent) && !('private_pkcs8' in intent) && !('attributes' in intent));
    assert.equal(await (form.get('attributes') as Blob).text(), new TextDecoder().decode(bytes));
    if (String(url).endsWith('api-key-attributes-review')) return Response.json(ready({ recipient_fingerprint: recipient.recipient_fingerprint,
      active_quota_used: 0, active_quota_limit: 25, review_token: original.review_token, expires_at: '2030-01-01T00:00:00Z' }));
    assert.deepEqual(intent, original);
    return Response.json({ ...ready({ key_id: key, request_id: request, recipient_fingerprint: recipient.recipient_fingerprint,
      state: 'available', sealed_jwe: 'a.b.c.d.e', expires_at: '2030-01-01T00:00:00Z' }), operation: { id: key,
      kind: 'issue_api_key_record', status: 'succeeded', resource: null, retry_after_seconds: 0, retry_expires_at: '2030-01-01T00:00:00Z' } });
  } });
  assert.equal((await client.apiKeys.issuance.reviewFile(input, bytes)).data?.recipient_fingerprint, recipient.recipient_fingerprint);
  assert.equal((await client.apiKeys.issuance.issueFile(original, bytes)).data?.key_id, key);
  await assert.rejects(client.apiKeys.issuance.issueFile({ ...original, source_sha256: 'a'.repeat(64) }, bytes), /source_file_changed/u);
  assert.equal(calls, 2);
});
test('file original rejects private fields, wrong account, source bounds and nonboolean consent', () => {
  const input = { expected_account_id: account, request_id: request, recipient_public_key: 'a'.repeat(550), source_size: 100, source_sha256: 'b'.repeat(64),
    review_token: 'synthetic', confirm_create: true };
  for (const changed of [{ ...input, confirm_create: 1 }, { ...input, source_size: 16 * 1024 * 1024 + 1 },
    { ...input, expected_account_id: request }, { ...input, private_pkcs8: 'synthetic' }]) assert.throws(() => keyFileCreationInput(changed, true), /invalid_input/u);
});
