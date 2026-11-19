import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';

const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const digest = (v: Uint8Array | string) => createHash('sha256').update(v).digest('hex');
const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, value]) => [k, stable(value)])) : v;
const intent = { application_id: id, kind: 'note' as const, expected_account_id: 'jh_' + id, expected_revision: 1, request_id: id };
const command = { ...intent, title: 'Synthetic original', body: 'Paragraphs.\n\n' + 'x'.repeat(600001) + '🙂', status: 'Open' };
const original = { account_id: intent.expected_account_id, application_id: id, application_slug: 'synthetic-role', request_id: id,
  kind: 'note' as const, payload_hash: digest(JSON.stringify(stable(command))), status: 'open' as const, expires_at: '2026-10-24T00:00:00Z' };
const pointer = { expected_account_id: original.account_id, application_id: id, request_id: id, expected_payload_hash: original.payload_hash };
const bytes = Buffer.from(JSON.stringify({ format: 'jobhunt.studio-original/v1', ...original, command }));
const manifest = { ...original, format: 'jobhunt.studio-original/v1', filename: 'studio-original-' + id + '.json', mime: 'application/json', size_bytes: bytes.length,
  sha256: digest(bytes), chunk_bytes: 24000, chunk_count: Math.ceil(bytes.length / 24000) };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_original_credential' }, fetchImpl });
function reply(url: string) {
  if (!url.includes('_chunk')) return ready(manifest);
  const args = JSON.parse(new URL(url).searchParams.get('arguments')!);
  assert.equal(args.expected_payload_hash, original.payload_hash);
  const part = bytes.subarray((args.chunk_index - 1) * 24000, args.chunk_index * 24000);
  return ready({ ...manifest, chunk_index: args.chunk_index, content_base64: part.toString('base64'), chunk_sha256: digest(part) });
}
test('complete private original verifies every chunk, original hash, identity and final manifest', async () => {
  const calls: string[] = [];
  const client = api(async (url, init) => { calls.push(String(url)); assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error'); return Response.json(reply(String(url))); });
  assert.deepEqual(Buffer.from((await client.studioOriginals.download(pointer)).bytes), bytes);
  assert.equal(calls.length, manifest.chunk_count + 2);
});
test('mixed identity, private hashes and invalid chunks cannot produce an original file', async () => {
  for (const change of [
    (v: Record<string, unknown>) => { v.account_id = 'jh_' + other; },
    (v: Record<string, unknown>) => { v.request_id = other; },
    (v: Record<string, unknown>) => { v.payload_hash = 'a'.repeat(64); },
    (v: Record<string, unknown>) => { v.kind = 'task'; },
    (v: Record<string, unknown>) => { v.chunk_index = 2; },
    (v: Record<string, unknown>) => { v.content_base64 = 'YQ=='; },
    (v: Record<string, unknown>) => { v.chunk_sha256 = 'b'.repeat(64); },
  ]) {
    await assert.rejects(api(async url => { const r = reply(String(url)); if (String(url).includes('_chunk')) change(r.data as Record<string, unknown>); return Response.json(r); }).studioOriginals.download(pointer), /invalid_response|download_checksum_mismatch/);
  }
});
test('retired or changed final manifest prevents publication of an original', async () => {
  let manifests = 0;
  await assert.rejects(api(async url => { const r = reply(String(url)); if (!String(url).includes('_chunk') && manifests++ > 0) r.data = { ...manifest, expires_at: '2026-10-25T00:00:00Z' }; return Response.json(r); }).studioOriginals.download(pointer), /download_source_changed/);
});
test('staging transmits exact private bytes once and rejects mismatched response account', async () => {
  const fields = Buffer.from(JSON.stringify({ title: command.title, body: command.body, status: 'Open' }));
  let attempts = 0;
  const client = api(async (url, init) => {
    attempts++; assert.ok(String(url).endsWith('/studio-original-fields-upload')); assert.ok(init?.body instanceof FormData);
    assert.deepEqual(Buffer.from(await (init.body.get('fields') as File).arrayBuffer()), fields);
    assert.equal(init.body.get('intent'), JSON.stringify(intent)); return Response.json(ready({ ...original, account_id: 'jh_' + other }));
  });
  await assert.rejects(client.studioOriginals.stageFile(intent, fields), /invalid_response/); assert.equal(attempts, 1);
});
test('read-only check cannot retry, unknown retry never resends and missing review fails locally', async () => {
  const calls: string[] = [], retry = { ...pointer, review_token: 'synthetic-signed-review', confirm_calendar_handoff_count: 0 };
  const client = api(async (url, init) => { calls.push(init?.method ?? 'GET'); if (String(url).includes('/retry_')) throw Error('Synthetic response lost'); return Response.json(ready({ original, save_state: 'not_recorded', record_id: null, revision: null })); });
  assert.equal((await client.studioOriginals.check(pointer)).data?.save_state, 'not_recorded');
  await assert.rejects(client.studioOriginals.retry(retry));
  await assert.rejects(client.studioOriginals.retry({ ...retry, review_token: '' }), /invalid_input/);
  assert.deepEqual(calls, ['GET', 'POST']);
});
test('review validates complete page count and source identity; resolution validates original disposition', async () => {
  const value = { original, title: command.title, review_token: 'synthetic', calendar_handoff_count: 1,
    calendar_effects: [{ connection_id: id, provider: 'google_calendar', calendar_id: 'synthetic-calendar', action: 'sync' }], page: 1, has_more: false };
  for (const data of [{ ...value, calendar_handoff_count: 2 }, { ...value, original: { ...original, application_id: other } }, { ...value, page: 2 }]) {
    await assert.rejects(api(async () => Response.json(ready(data))).studioOriginals.review(pointer), /invalid_response/);
  }
  await assert.rejects(api(async () => Response.json(ready({ ...original, status: 'open' }))).studioOriginals.resolve({ ...pointer, disposition: 'discarded' }), /invalid_response/);
});
