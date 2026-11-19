import { assertPrivateFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const fingerprint = 'a'.repeat(64), hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const target = { application_id: id, kind: 'note' as const, record_id: id };
const fields = { title: 'Synthetic complete note', body: 'Keep\n\n' + 'x'.repeat(600001) + '🙂', status: 'Open' };
const bytes = Buffer.from(JSON.stringify({ format: 'jobhunt.application-record/v1', account_id: 'jh_' + id, revision: 3, ...target, fingerprint, fields }));
const metadata = { account_id: 'jh_' + id, revision: 3, ...target, fingerprint, title: fields.title,
  filename: 'application-record-note-' + id + '.json', mime: 'application/json', format: 'jobhunt.application-record/v1',
  size_bytes: bytes.length, chunk_bytes: 24000, chunk_count: Math.ceil(bytes.length / 24000), sha256: hash(bytes) };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const intent = { application_id: id, kind: 'note' as const, expected_revision: 1, expected_account_id: 'jh_' + id, request_id: id };
const operation = { id, status: 'succeeded', kind: 'save_application_record_file_v1', retry_after_seconds: 0,
  retry_expires_at: '2026-10-24T00:00:00Z', resource: { id, kind: 'application', label: 'Synthetic', revision: 3 } };
const saved = { ...ready({ application_id: id, record_id: id, current: metadata }), operation };
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_record_credential' }, fetchImpl });
function sourceReply(url: string) {
  if (!url.includes('_chunk')) return ready(metadata);
  const args = JSON.parse(new URL(url).searchParams.get('arguments')!);
  assert.equal(args.application_id, id); assert.equal(args.kind, 'note'); assert.equal(args.record_id, id);
  assert.equal(args.expected_fingerprint, fingerprint); assert.equal(args.expected_sha256, metadata.sha256);
  const part = bytes.subarray((args.chunk_index - 1) * 24000, args.chunk_index * 24000);
  return ready({ ...metadata, chunk_index: args.chunk_index, content_base64: part.toString('base64'), chunk_sha256: hash(part) });
}
test('complete private record download verifies all chunks, JSON identity and final source', async () => {
  let calls = 0;
  const client = api(async (url, init) => { calls++; assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error'); return Response.json(sourceReply(String(url))); });
  const result = await client.downloadApplicationRecordFile(target);
  assert.deepEqual(Buffer.from(result.bytes), bytes);
  assert.equal(calls, metadata.chunk_count + 2);
});
test('mixed owner/parent/kind/record/source/order and corrupt chunks never form a download', async () => {
  for (const mutate of [
    (v: Record<string, unknown>) => { v.account_id = 'jh_' + other; },
    (v: Record<string, unknown>) => { v.application_id = other; },
    (v: Record<string, unknown>) => { v.kind = 'task'; },
    (v: Record<string, unknown>) => { v.record_id = other; },
    (v: Record<string, unknown>) => { v.revision = 4; },
    (v: Record<string, unknown>) => { v.fingerprint = 'b'.repeat(64); },
    (v: Record<string, unknown>) => { v.sha256 = 'b'.repeat(64); },
    (v: Record<string, unknown>) => { v.chunk_index = 2; },
    (v: Record<string, unknown>) => { v.content_base64 = 'YQ=='; },
    (v: Record<string, unknown>) => { v.content_base64 = '!!!!'; },
    (v: Record<string, unknown>) => { v.chunk_sha256 = 'b'.repeat(64); },
  ]) {
    await assert.rejects(api(async url => { const reply = sourceReply(String(url)); if (String(url).includes('_chunk')) mutate(reply.data as Record<string, unknown>); return Response.json(reply); }).downloadApplicationRecordFile(target), /invalid_response|download_checksum_mismatch/);
  }
});
test('a later parent revision invalidates the final file even if its content is unchanged', async () => {
  let reads = 0;
  await assert.rejects(api(async url => {
    const reply = sourceReply(String(url));
    if (!String(url).includes('_chunk') && reads++ > 0) reply.data = { ...metadata, revision: 4 };
    return Response.json(reply);
  }).downloadApplicationRecordFile(target), /download_source_changed/);
});
test('full field upload preserves bytes, checks response account and never retries a lost write', async () => {
  const raw = Buffer.from(JSON.stringify(fields)); let calls = 0;
  const client = api(async (url, init) => {
    calls++; assert.ok(String(url).endsWith('/application-record-fields-upload')); assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get('intent'), JSON.stringify(intent));
    assert.deepEqual(Buffer.from(await (init.body.get('fields') as File).arrayBuffer()), raw); return Response.json(saved);
  });
  assert.deepEqual(await client.saveApplicationRecordFieldsFile(intent, raw), saved);
  for (const value of [{ ...intent, expected_account_id: undefined }, { ...intent, record_id: id }, { ...intent, expected_fingerprint: fingerprint }]) await assert.rejects(client.saveApplicationRecordFieldsFile(value as never, raw), /invalid_input/);
  assert.equal(calls, 1);
  let attempts = 0;
  await assert.rejects(api(async () => { attempts++; throw new TypeError('Synthetic response lost'); }).saveApplicationRecordFieldsFile(intent, raw));
  assert.equal(attempts, 1);
  await assert.rejects(api(async () => Response.json({ ...saved, data: { application_id: other, record_id: id, current: { ...metadata, application_id: other } } })).saveApplicationRecordFieldsFile(intent, raw), /invalid_response/);
});
async function cli(args: string[], fetchImpl: typeof fetch, input: unknown = intent) {
  let stdout = '', stderr = '';
  const code = await runCLI([...args, '--json', '--non-interactive'], {
    env: { JOBHUNT_TOKEN: 'synthetic_record_credential' }, stdin: Readable.from([JSON.stringify(input)]), fetchImpl,
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk.toString(); done(); } }),
  }, 'test');
  return { code, stdout, stderr };
}
test('CLI publication is private/exclusive; upload confirmation precedes reading fields', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jobhunt-record-files-'));
  try {
    let calls = 0; const fetchImpl: typeof fetch = async url => { calls++; return Response.json(sourceReply(String(url))); };
    const output = join(dir, 'record.json'), args = ['applications', 'record-download', '--file', '-', '--output', output];
    const result = await cli(args, fetchImpl, target);
    assert.equal(result.code, 0); assert.deepEqual(await readFile(output), bytes); await assertPrivateFile(output);
    assert.ok(!result.stdout.includes(fields.body) && !result.stdout.includes('content_base64'));
    calls = 0; assert.equal((await cli(args, fetchImpl, target)).code, 7); assert.equal(calls, 0);
    const link = join(dir, 'link.json'); await symlink(output, link);
    assert.equal((await cli(['applications', 'record-download', '--file', '-', '--output', link], fetchImpl, target)).code, 7); assert.equal(calls, 0);
    const refused = await cli(['applications', 'record-save-file', '--file', '-', '--fields', join(dir, 'absent.json')], fetchImpl);
    assert.equal(refused.code, 2); assert.ok(refused.stderr.includes('confirmation_required')); assert.equal(calls, 0);
    const input = join(dir, 'fields.json'); await writeFile(input, JSON.stringify(fields));
    const sent = await cli(['applications', 'record-save-file', '--file', '-', '--fields', input, '--confirm', 'jh_' + id], async () => { calls++; return Response.json(saved); });
    assert.equal(sent.code, 0); assert.equal(calls, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
