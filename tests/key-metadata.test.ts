import assert from 'node:assert/strict';
import test from 'node:test';
import { JobHuntClient, keyMetadataDigest, type ApiKeySummary } from '../client/src/index.ts';
import { apiKeySummary, verifiedApiKeyScopes } from '../client/src/key-metadata.ts';
const key = '11111111-1111-4111-8111-111111111111', account = 'jh_22222222-2222-4222-8222-222222222222';
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
async function fixture(scopes = ['read:developer']) {
  const fingerprint = 'a'.repeat(64), bytes = new TextEncoder().encode(JSON.stringify({ account_id: account, key_id: key, fingerprint, format: 'jobhunt.api-key-scopes/v1', scopes }));
  const summary: ApiKeySummary = { id: key, name: 'Synthetic metadata', key_prefix: 'jsk_test_', tier: 'free', is_active: true, expires_at: null,
    revoked_at: null, last_used_at: null, usage_count: 0, created_at: '2026-10-23T12:00:00Z', status: 'usable', fingerprint, is_current_credential: false,
    scope_count: scopes.length, scopes_file: { account_id: account, key_id: key, fingerprint, format: 'jobhunt.api-key-scopes/v1', mime: 'application/json', filename: 'api-key-permissions.json',
      size_bytes: bytes.length, chunk_bytes: 24000, chunk_count: Math.ceil(bytes.length / 24000), sha256: await keyMetadataDigest(bytes) } };
  return { summary, bytes, scopes };
}
function clientFor(summary: ApiKeySummary, bytes: Uint8Array, edit?: (v: Record<string, unknown>) => void, encoded = false) {
  let downloads = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-metadata-token' }, fetchImpl: async (url, init) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer synthetic-metadata-token');
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    const path = new URL(String(url)), args = JSON.parse(path.searchParams.get('arguments')!);
    if (path.pathname.endsWith('get_api_key_summary')) return Response.json(ready(summary));
    if (path.pathname.endsWith('api-key-permissions-file')) {
      downloads++; assert.equal(args.expected_sha256, summary.scopes_file.sha256);
      return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/json',
        'Content-Length': encoded ? '123' : String(bytes.length), ...(encoded ? { 'Content-Encoding': 'gzip' } : {}) } });
    }
    const part = bytes.slice((args.chunk_index - 1) * 24000, args.chunk_index * 24000);
    const v = { ...summary.scopes_file, chunk_index: args.chunk_index, content_base64: Buffer.from(part).toString('base64'), chunk_sha256: await keyMetadataDigest(part) };
    edit?.(v); return Response.json(ready(v));
  } });
  return { client, downloads: () => downloads };
}
test('large native permissions use a source-bound private file without raising ordinary JSON response limits', async () => {
  const { summary, bytes, scopes } = await fixture(['retained:' + 'x'.repeat(2 * 1024 * 1024)]);
  const h = clientFor(summary, bytes), value = await h.client.apiKeys.metadata.downloadScopes({ key_id: key });
  assert.deepEqual(value.scopes, scopes); assert.deepEqual(value.bytes, bytes); assert.equal(h.downloads(), 1);
  assert.deepEqual((await clientFor(summary, bytes, undefined, true).client.apiKeys.metadata.downloadScopes({ key_id: key })).bytes, bytes);
  const ordinary = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-metadata-token' }, fetchImpl: async () => new Response(new Uint8Array(bytes)) });
  await assert.rejects(ordinary.request('/api/v1/journey/get_api_key_record'), /response_too_large/u);
});
test('complete permission chunks verify source, per-chunk digests, size and full hash', async () => {
  const { summary, bytes, scopes } = await fixture(['retained:' + '界'.repeat(24000)]);
  const h = clientFor(summary, bytes), value = await h.client.apiKeys.metadata.downloadScopes({ key_id: key }, 'chunks');
  assert.ok(summary.scopes_file.chunk_count > 1); assert.deepEqual(value.scopes, scopes); assert.equal(h.downloads(), 0);
  for (const edit of [(v: Record<string, unknown>) => { v.account_id = 'jh_' + key; },
    (v: Record<string, unknown>) => { v.chunk_sha256 = 'b'.repeat(64); }, (v: Record<string, unknown>) => { v.content_base64 = 'YQ=='; },
    (v: Record<string, unknown>) => { v.raw_key = 'synthetic'; }]) {
    await assert.rejects(clientFor(summary, bytes, edit).client.apiKeys.metadata.downloadScopes({ key_id: key }, 'chunks'), /invalid_response/u);
  }
});
test('private file checksum and strict decoded envelope reject substituted content', async () => {
  const { summary, bytes } = await fixture();
  const wrong = new Uint8Array(bytes); wrong[0] = 32;
  await assert.rejects(clientFor(summary, wrong).client.apiKeys.metadata.downloadScopes({ key_id: key }), /download_checksum_mismatch/u);
  const value = JSON.parse(new TextDecoder().decode(bytes));
  for (const changed of [{ ...value, raw_key: 'synthetic' }, { ...value, key_id: account.slice(3) }, { ...value, scopes: [null] }]) {
    assert.throws(() => verifiedApiKeyScopes(new TextEncoder().encode(JSON.stringify(changed)), summary.scopes_file), /invalid_response/u);
  }
});
test('summaries exclude secret fields, inconsistent scope counts and foreign file identity', async () => {
  const { summary } = await fixture(); assert.equal(apiKeySummary(summary), true);
  for (const changed of [{ ...summary, raw_key: 'synthetic' }, { ...summary, scope_count: -1 },
    { ...summary, scopes_file: { ...summary.scopes_file, key_id: account.slice(3) } }]) assert.equal(apiKeySummary(changed), false);
});
