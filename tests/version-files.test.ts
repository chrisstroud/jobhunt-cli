import { assertPrivateFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient, verifiedVersionRecord, type VersionFileManifest } from '../client/src/index.ts';
import { documentCommand } from '../cli/src/documents.ts';
const accountId = 'jh_11111111-1111-4111-8111-111111111111', documentId = '22222222-2222-4222-8222-222222222222';
const versionId = '44444444-4444-4444-8444-444444444444';
const ids = { document_id: documentId, version_id: versionId };
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
function fixture(content: Record<string, unknown> = { summary: 'Synthetic saved content 😀', retained: { exact: [false, 0, null] } }, metadata: Record<string, unknown> | null = { journey: { revision: 3, facts: [{ state: 'uncertain', sources: [{ kind: 'unknown' }] }] } }) {
  const record = { format: 'jobhunt.document-version/v1', account_id: accountId, ...ids,
    revision: metadata?.journey ? 3 : null, document_type: 'resume', name: 'Synthetic checkpoint', trigger: 'manual',
    created_at: '2026-10-24T10:00:00', content, metadata };
  const bytes = new TextEncoder().encode(JSON.stringify(record));
  const manifest: VersionFileManifest = { format: 'jobhunt.document-version/v1', account_id: accountId, ...ids,
    revision: record.revision, filename: `jobhunt-version-${versionId}.json`, mime: 'application/json', sha256: hash(bytes),
    size_bytes: bytes.length, chunk_bytes: 24000, chunk_count: Math.ceil(bytes.length / 24000) };
  return { record, bytes, manifest };
}
function client(fetchImpl: typeof fetch) { return new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-version-file' }, fetchImpl }); }
function fetchRecord(value = fixture(), alter?: (path: string, body: unknown) => unknown) {
  let requests = 0;
  const fetcher: typeof fetch = async (url, init) => {
    requests++; assert.equal(init?.method, 'GET'); assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error');
    assert.ok(new Headers(init.headers).get('Authorization')?.startsWith('Bearer '));
    const parsed = new URL(String(url)), path = parsed.pathname;
    if (path.endsWith('/get_document_version_file')) {
      assert.deepEqual(JSON.parse(parsed.searchParams.get('arguments')!), ids);
      const response = ready(value.manifest); return Response.json(alter ? alter(path, response) : response);
    }
    if (path.endsWith('/document-version-file')) {
      assert.equal(parsed.searchParams.get('expected_sha256'), value.manifest.sha256);
      assert.equal(parsed.searchParams.get('expected_size_bytes'), String(value.bytes.length));
      const payload = alter ? alter(path, value.bytes) as Uint8Array : value.bytes;
      return new Response(payload as BodyInit, { headers: { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) } });
    }
    assert.ok(path.endsWith('/get_document_version_file_chunk'));
    const args = JSON.parse(parsed.searchParams.get('arguments')!);
    assert.equal(args.expected_sha256, value.manifest.sha256); assert.equal(args.expected_size_bytes, value.bytes.length);
    const part = value.bytes.slice((args.chunk_index - 1) * 24000, args.chunk_index * 24000);
    const response = ready({ ...value.manifest, chunk_index: args.chunk_index, content_base64: Buffer.from(part).toString('base64'), chunk_sha256: hash(part) });
    return Response.json(alter ? alter(path, response) : response);
  };
  return { client: client(fetcher), count: () => requests };
}

test('HTTP file and bounded chunks retain full saved fields and provenance without actor inference', async () => {
  const value = fixture(), api = fetchRecord(value);
  const file = await api.client.versionFiles.download(ids);
  assert.deepEqual(file.bytes, value.bytes); assert.deepEqual(await verifiedVersionRecord(file.bytes, value.manifest), value.record);
  assert.equal(api.count(), 2); assert.equal('record' in file, false, 'CLI metadata must not print private fields');
  const chunks = await api.client.versionFiles.downloadChunks(ids); assert.deepEqual(chunks.bytes, value.bytes);
  assert.equal('actor' in (await verifiedVersionRecord(chunks.bytes, value.manifest)), false);
});

test('full native 16MiB content uses one bounded complete HTTP file, above ordinary JSON response capacity', async () => {
  const value = fixture({ summary: 'x'.repeat(16 * 1024 * 1024 - 14) });
  assert.ok(value.bytes.length > 16 * 1024 * 1024);
  const api = fetchRecord(value), file = await api.client.versionFiles.download(ids);
  assert.equal(file.bytes.length, value.bytes.length); assert.equal(hash(file.bytes), value.manifest.sha256); assert.equal(api.count(), 2);
  await assert.rejects(client(async () => new Response(value.bytes)).request('/api/v1/journey/other-large-response'), /response_too_large/);
});

test('multiple UTF8 chunks preserve exact content and final partial bytes', async () => {
  const value = fixture({ summary: 'Synthetic 😀'.repeat(9000) }), api = fetchRecord(value);
  assert.ok(value.manifest.chunk_count > 3);
  const file = await api.client.versionFiles.downloadChunks(ids); assert.equal(hash(file.bytes), value.manifest.sha256);
});

test('legacy null and empty metadata remain distinct with unknown revision', async () => {
  for (const metadata of [null, {}]) {
    const value = fixture({}, metadata), api = fetchRecord(value);
    const file = await api.client.versionFiles.download(ids), parsed = await verifiedVersionRecord(file.bytes, value.manifest);
    assert.equal(parsed.revision, null); assert.deepEqual(parsed.metadata, metadata);
  }
});

for (const change of ['hash', 'document', 'account', 'revision', 'metadata']) test(`complete file rejects changed ${change} without accepting later content`, async () => {
  const value = fixture(), api = fetchRecord(value, (path, body) => {
    if (!path.endsWith('/document-version-file')) return body;
    if (change === 'hash') return new TextEncoder().encode(JSON.stringify({ ...value.record, content: { summary: 'Synthetic later content' } }));
    const record = { ...value.record, ...(change === 'document' ? { document_id: versionId } : change === 'account'
      ? { account_id: 'jh_' + versionId } : change === 'revision' ? { revision: 4 } : { metadata: [] }) };
    return new TextEncoder().encode(JSON.stringify(record));
  });
  await assert.rejects(api.client.versionFiles.download(ids), /invalid_response/);
  if (change !== 'hash') {
    const badRecord = { ...value.record, ...(change === 'document' ? { document_id: versionId } : change === 'account'
      ? { account_id: 'jh_' + versionId } : change === 'revision' ? { revision: 4 } : { metadata: [] }) };
    const bytes = new TextEncoder().encode(JSON.stringify(badRecord));
    const matchingHash = fetchRecord({ ...value, bytes, manifest: { ...value.manifest, sha256: hash(bytes), size_bytes: bytes.length, chunk_count: Math.ceil(bytes.length / 24000) } });
    await assert.rejects(matchingHash.client.versionFiles.download(ids), /invalid_response/);
  }
});

for (const change of ['hash', 'account', 'index', 'base64']) test(`chunk reader rejects changed ${change}`, async () => {
  const value = fixture(), api = fetchRecord(value, (path, raw) => {
    if (!path.endsWith('/get_document_version_file_chunk')) return raw;
    const envelope = raw as { data: Record<string, unknown> };
    return { ...envelope, data: { ...envelope.data, ...(change === 'hash' ? { chunk_sha256: 'a'.repeat(64) }
      : change === 'account' ? { account_id: 'jh_' + versionId } : change === 'index' ? { chunk_index: 2 } : { content_base64: 'not a valid chunk' }) } };
  });
  await assert.rejects(api.client.versionFiles.downloadChunks(ids), /invalid_response/);
});

test('invalid identifiers never dispatch and status errors do not become a source fallback', async () => {
  let requests = 0;
  const api = client(async () => { requests++; return Response.json({ errors: [{ code: 'resource_not_found' }] }, { status: 404 }); });
  await assert.rejects(api.versionFiles.download({ ...ids, version_id: 'not-an-id' }), /invalid_input/); assert.equal(requests, 0);
  await assert.rejects(api.versionFiles.chunk({ ...ids, expected_sha256: 'a'.repeat(64), expected_size_bytes: 10,
    chunk_index: 1, extra: true } as Parameters<typeof api.versionFiles.chunk>[0]), /invalid_input/); assert.equal(requests, 0);
  await assert.rejects(api.versionFiles.download(ids), /resource_not_found/); assert.equal(requests, 1);
});

test('CLI private output contains verified bytes, never overwrites, and returns only content-minimal metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jobhunt-version-file-'));
  try {
    const output = join(directory, 'version.json'), value = fixture(), api = fetchRecord(value);
    const result = await documentCommand('documents version-file', documentId, { 'version-id': versionId, output }, api.client, Readable.from([])) as Record<string, unknown>;
    assert.equal(result.saved, true); assert.equal('record' in result, false); assert.equal('content' in result, false); assert.equal('metadata' in result, false);
    assert.deepEqual(new Uint8Array(await readFile(output)), value.bytes); await assertPrivateFile(output);
    const calls = api.count(); await assert.rejects(documentCommand('documents version-file', documentId,
      { 'version-id': versionId, output }, api.client, Readable.from([])), /output_exists/); assert.equal(api.count(), calls);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
