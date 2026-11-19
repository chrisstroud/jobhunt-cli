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

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const fingerprint = 'a'.repeat(64);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const row = { id, user_id: id, title: 'Synthetic full record', date: '2026-10-23',
  description: 'd'.repeat(600001) + '🙂', impact_raw: 'r'.repeat(300001), impact_refined: 'f'.repeat(300001),
  tags: [...Array(1101).keys()].map(i => 'tag' + i), category: null, role: null, company_id: null, company_name: null,
  linked_campaign_id: null, linked_campaign_name: null, created_at: '2026-10-23T00:00:00', updated_at: '2026-10-23T00:00:00' };
const bytes = Buffer.from(JSON.stringify({ format: 'jobhunt.highlight-record/v1', account_id: 'jh_' + id, fingerprint, highlight: row }));
const metadata = { account_id: 'jh_' + id, highlight_id: id, fingerprint, title: row.title, date: row.date,
  filename: 'highlight-' + id + '.json', mime: 'application/json', format: 'jobhunt.highlight-record/v1',
  size_bytes: bytes.length, chunk_bytes: 24000, chunk_count: Math.ceil(bytes.length / 24000), sha256: hash(bytes) };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const intent = { request_id: id, expected_account_id: 'jh_' + id, action: 'create' as const };
const operation = { id, status: 'succeeded', kind: 'save_workspace_highlight_v2', retry_after_seconds: 0,
  retry_expires_at: '2026-10-24T00:00:00Z', resource: { id, kind: 'highlight', label: 'Synthetic', revision: null } };
const saved = { ...ready({ highlight_id: id, current: metadata }), operation };
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_highlight_credential' }, fetchImpl });
function sourceReply(url: string) {
  if (!url.includes('get_highlight_record_file_chunk')) return ready(metadata);
  const args = JSON.parse(new URL(url).searchParams.get('arguments')!);
  assert.equal(args.expected_fingerprint, fingerprint); assert.equal(args.expected_sha256, metadata.sha256);
  const part = bytes.subarray((args.chunk_index - 1) * 24000, args.chunk_index * 24000);
  return ready({ ...metadata, chunk_index: args.chunk_index, content_base64: part.toString('base64'), chunk_sha256: hash(part) });
}

test('full record download verifies every byte and rechecks the source without compact field limits', async () => {
  let calls = 0;
  const client = api(async (url, init) => {
    calls++; assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    return Response.json(sourceReply(String(url)));
  });
  const result = await client.downloadHighlightRecordFile(id);
  assert.deepEqual(Buffer.from(result.bytes), bytes);
  assert.deepEqual(JSON.parse(Buffer.from(result.bytes).toString()).highlight, row);
  assert.equal(calls, metadata.chunk_count + 2);
});

test('chunk responses reject mixed sources, identities, order, truncated bytes and invalid base64', async () => {
  for (const mutate of [
    (data: Record<string, unknown>) => { data.account_id = 'jh_' + other; },
    (data: Record<string, unknown>) => { data.highlight_id = other; data.filename = 'highlight-' + other + '.json'; },
    (data: Record<string, unknown>) => { data.fingerprint = 'b'.repeat(64); },
    (data: Record<string, unknown>) => { data.sha256 = 'b'.repeat(64); },
    (data: Record<string, unknown>) => { data.chunk_index = 2; },
    (data: Record<string, unknown>) => { data.content_base64 = 'YQ=='; },
    (data: Record<string, unknown>) => { data.content_base64 = '!!!!'; },
    (data: Record<string, unknown>) => { data.chunk_sha256 = 'b'.repeat(64); },
  ]) {
    const client = api(async url => {
      const reply = sourceReply(String(url));
      if (String(url).includes('_chunk')) mutate(reply.data as Record<string, unknown>);
      return Response.json(reply);
    });
    await assert.rejects(client.downloadHighlightRecordFile(id), /invalid_response|download_checksum_mismatch/);
  }
});

test('final source drift and complete JSON identity mismatch never publish a usable download', async () => {
  let reads = 0;
  await assert.rejects(api(async url => {
    const reply = sourceReply(String(url));
    if (!String(url).includes('_chunk') && reads++ > 0) reply.data = { ...metadata, fingerprint: 'b'.repeat(64) };
    return Response.json(reply);
  }).downloadHighlightRecordFile(id), /download_source_changed/);
  const wrong = Buffer.from(JSON.stringify({ format: metadata.format, account_id: 'jh_' + id, fingerprint,
    highlight: { ...row, user_id: other } }));
  const manifest = { ...metadata, size_bytes: wrong.length, chunk_count: Math.ceil(wrong.length / 24000), sha256: hash(wrong) };
  await assert.rejects(api(async url => {
    if (!String(url).includes('_chunk')) return Response.json(ready(manifest));
    const index = JSON.parse(new URL(String(url)).searchParams.get('arguments')!).chunk_index;
    const part = wrong.subarray((index - 1) * 24000, index * 24000);
    return Response.json(ready({ ...manifest, chunk_index: index, content_base64: part.toString('base64'), chunk_sha256: hash(part) }));
  }).downloadHighlightRecordFile(id), /invalid_response/);
});

test('multipart fields preserve exact bytes and intent while writes never retry automatically', async () => {
  const fields = Buffer.from(JSON.stringify({ description: null, impact_raw: 'x'.repeat(600001), tags: Array(1101).fill('🙂') }));
  let calls = 0;
  const client = api(async (url, init) => {
    calls++; assert.ok(String(url).endsWith('/highlight-fields-upload'));
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get('intent'), JSON.stringify(intent));
    assert.deepEqual(Buffer.from(await (init.body.get('fields') as File).arrayBuffer()), fields);
    return Response.json(saved);
  });
  assert.deepEqual(await client.saveHighlightFieldsFile(intent, fields), saved);
  for (const value of [{ ...intent, expected_account_id: undefined }, { ...intent, action: 'update' }, { ...intent, highlight_id: id }])
    await assert.rejects(client.saveHighlightFieldsFile(value as never, fields), /invalid_input/);
  await assert.rejects(client.saveHighlightFieldsFile(intent, new Uint8Array()), /invalid_input/);
  await assert.rejects(client.saveHighlightFieldsFile(intent, new Uint8Array(16 * 1024 * 1024 + 1)), /invalid_input/);
  assert.equal(calls, 1);
  let attempts = 0;
  await assert.rejects(api(async () => { attempts++; throw new TypeError('Synthetic disconnected transport'); }).saveHighlightFieldsFile(intent, fields));
  assert.equal(attempts, 1);
  await assert.rejects(api(async () => Response.json({ ...saved, data: { highlight_id: id, current: { ...metadata, account_id: 'jh_' + other } } })).saveHighlightFieldsFile(intent, fields), /invalid_response/);
});

async function cli(args: string[], fetchImpl: typeof fetch, input: unknown = intent) {
  let stdout = '', stderr = '';
  const code = await runCLI([...args, '--json', '--non-interactive'], {
    env: { JOBHUNT_TOKEN: 'synthetic_highlight_credential' }, stdin: Readable.from([JSON.stringify(input)]), fetchImpl,
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk.toString(); done(); } }),
  }, 'test');
  return { code, stdout, stderr };
}

test('CLI record downloads are private and exclusive and upload confirmation precedes field IO', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jobhunt-highlight-files-'));
  try {
    let calls = 0;
    const fetchImpl: typeof fetch = async url => { calls++; return Response.json(sourceReply(String(url))); };
    const output = join(dir, 'record.json');
    const args = ['highlights', 'download-record', id, '--output', output];
    const result = await cli(args, fetchImpl);
    assert.equal(result.code, 0); assert.deepEqual(await readFile(output), bytes);
    await assertPrivateFile(output);
    assert.ok(!result.stdout.includes('description') && !result.stdout.includes('content_base64'));
    calls = 0;
    assert.equal((await cli(args, fetchImpl)).code, 7); assert.equal(calls, 0);
    const link = join(dir, 'link.json'); await symlink(output, link);
    assert.equal((await cli(['highlights', 'download-record', id, '--output', link], fetchImpl)).code, 7); assert.equal(calls, 0);
    const inputFile = join(dir, 'fields.json'); await writeFile(inputFile, JSON.stringify({ title: 'Synthetic' }));
    const failed = await cli(['highlights', 'save-file', '--file', '-', '--fields', join(dir, 'absent.json')], fetchImpl);
    assert.equal(failed.code, 2); assert.ok(failed.stderr.includes('confirmation_required')); assert.equal(calls, 0);
    const sent = await cli(['highlights', 'save-file', '--file', '-', '--fields', inputFile, '--confirm', 'jh_' + id], async () => { calls++; return Response.json(saved); });
    assert.equal(sent.code, 0); assert.equal(calls, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
