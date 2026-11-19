import { assertPrivateFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI, type IO } from '../cli/src/cli.ts';
const id = '11111111-1111-4111-8111-111111111111', event = '22222222-2222-4222-8222-222222222222';
const args = { expected_account_id: 'jh_' + id, subscription_id: id, delivery_id: event };
const bytes = Buffer.from(JSON.stringify({ id: event, subscription_id: id, error_message: 'Synthetic full detail 🙂é'.repeat(24000) }));
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const manifest = { account_id: args.expected_account_id, subscription_id: id, delivery_id: event, filename: 'webhook-metadata.json',
  mime: 'application/json', size_bytes: bytes.length, sha256: hash(bytes), chunk_bytes: 64000, chunk_count: Math.ceil(bytes.length / 64000) };
const ready = (data: unknown) => Response.json({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
function transport(tamper = false, drift = false) {
  let manifests = 0;
  return async (url: string | URL | Request) => {
    const u = new URL(String(url)), value = JSON.parse(u.searchParams.get('arguments')!);
    assert.equal(value.expected_account_id, args.expected_account_id); assert.equal(value.subscription_id, id); assert.equal(value.delivery_id, event);
    if (u.pathname.endsWith('get_webhook_metadata_file')) return ready({ ...manifest, ...(++manifests > 1 && drift ? { sha256: 'b'.repeat(64) } : {}) });
    assert.equal(value.expected_sha256, manifest.sha256); assert.equal(value.expected_size_bytes, manifest.size_bytes);
    const part = bytes.subarray((value.chunk_index - 1) * 64000, value.chunk_index * 64000);
    return ready({ ...manifest, chunk_index: value.chunk_index, content_base64: part.toString('base64'), chunk_sha256: tamper ? 'b'.repeat(64) : hash(part) });
  };
}
test('complete webhook metadata verifies every chunk and full file before final source check', async () => {
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-test-token' }, fetchImpl: transport() });
  const result = await client.webhooks.metadata.download(args);
  assert.equal(result.sha256, manifest.sha256); assert.deepEqual(Buffer.from(result.bytes), bytes);
  assert.ok(result.size_bytes > 600000); assert.equal(JSON.parse(Buffer.from(result.bytes).toString()).error_message.length, 'Synthetic full detail 🙂é'.length * 24000);
});
test('webhook metadata rejects chunk tampering and changed source rather than partial success', async () => {
  await assert.rejects(new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-test-token' }, fetchImpl: transport(true) }).webhooks.metadata.download(args), /download_checksum_mismatch/);
  await assert.rejects(new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-webhook-test-token' }, fetchImpl: transport(false, true) }).webhooks.metadata.download(args), /revision_conflict/);
});
test('CLI complete metadata requires explicit account confirmation and exclusively saves private verified bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jh-webhook-file-')), file = join(root, 'request.json'), output = join(root, 'metadata.json');
  await writeFile(file, JSON.stringify(args), { mode: 0o600 }); let out = '', err = '', calls = 0; const load = transport();
  const io: IO = { env: { JOBHUNT_TOKEN: 'synthetic-webhook-file-token' }, stdin: Readable.from([]),
    stdout: new Writable({ write(c, _e, next) { out += c; next(); } }), stderr: new Writable({ write(c, _e, next) { err += c; next(); } }),
    fetchImpl: async (...args) => { calls++; return load(args[0]); } };
  const command = ['webhooks', 'metadata', '--file', file, '--output', output, '--json'];
  assert.equal(await runCLI(command, io, 'test'), 2); assert.equal(calls, 0); out = ''; err = '';
  assert.equal(await runCLI([...command, '--confirm', args.expected_account_id], io, 'test'), 0);
  assert.deepEqual(await readFile(output), bytes); await assertPrivateFile(output);
  assert.equal(JSON.parse(out).saved, true); assert.ok(!out.includes('Synthetic full detail')); assert.equal(err, '');
  out = ''; const seen = calls; assert.notEqual(await runCLI([...command, '--confirm', args.expected_account_id], io, 'test'), 0); assert.equal(calls, seen);
});
