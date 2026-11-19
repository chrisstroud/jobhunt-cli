import { assertPrivateFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { createCoverLetterInput, customizeApplicationDocumentsInput, prepareApplicationPackageInput } from '../client/src/package-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const hash = 'a'.repeat(64);
const token = 'synthetic_private_download_token';
const input = { package_id: id, version_id: second };
const bytes = Buffer.from('%PDF-1.7\nsynthetic-only');
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'read', label: '' } });
const grant = () => ({ ...input, url: 'https://objects.example.test/synthetic?grant=private', method: 'GET',
  expires_at: new Date(Date.now() + 60000).toISOString(), media_type: 'application/pdf',
  sha256: createHash('sha256').update(bytes).digest('hex'), size_bytes: bytes.byteLength, reusable_until_expiry: true });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });
const pdf = () => new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(bytes.length) } });
const workflow = { application_id: id, app_slug: 'role', revision: hash, fingerprint: hash, selected_id: null,
  documents: [], choices: [], changes: [], unresolved: [] };

test('role-copy inputs preserve exact review bindings; optional letters cannot bypass their fingerprint', async () => {
  const intent = { app_slug: 'role', revision: hash, expected_revision: 2, source_document_id: id, source_revision: 4,
    source_fingerprint: hash, request_id: second, include_cover_letters: true, source_package_fingerprint: hash };
  let calls = 0;
  const client = api(async (_url, init) => { calls++; assert.deepEqual(JSON.parse(String(init?.body)), intent); return Response.json(ready(workflow)); });
  assert.deepEqual((await client.customizeApplicationDocuments(intent)).data, workflow);
  assert.throws(() => customizeApplicationDocumentsInput({ ...intent, source_package_fingerprint: undefined }), /invalid_input/);
  assert.throws(() => customizeApplicationDocumentsInput({ ...intent, expected_revision: 0 }), /invalid_input/);
  assert.equal(calls, 1);
  const prep = { application_id: id, expected_revision: 2, workflow_revision: hash, fingerprint: hash,
    request_id: second, documents: [{ document_id: id, revision: 4 }] };
  assert.deepEqual(prepareApplicationPackageInput(prep), prep);
  assert.throws(() => prepareApplicationPackageInput({ ...prep, documents: [...prep.documents, ...prep.documents] }), /invalid_input/);
  assert.throws(() => prepareApplicationPackageInput({ ...prep, documents: [] }), /invalid_input/);
});

test('letters retain supplied text and provenance; malformed dates and unknown source keys fail before I/O', () => {
  const letter = { request_id: second, template_slug: 'role-copy', expected_revision: 1, expected_application_revision: 2,
    workflow_revision: hash, name: 'Letter', content: { body_paragraphs: ['My supplied wording.'], date: '2026-10-19' },
    source_refs: [{ kind: 'user_statement' }] };
  assert.deepEqual(createCoverLetterInput(letter), letter);
  assert.throws(() => createCoverLetterInput({ ...letter, content: { ...letter.content, date: '2026-02-30' } }), /invalid_input/);
  assert.throws(() => createCoverLetterInput({ ...letter, source_refs: [{ kind: 'user_statement', verified: true }] }), /invalid_input/);
  assert.throws(() => createCoverLetterInput({ ...letter, source_refs: [] }), /invalid_input/);
});

test('private storage transfer carries no product authorization, cookies or redirect permission', async () => {
  let calls = 0;
  const client = api(async (url, init) => {
    calls++; assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    if (new URL(String(url)).origin === 'https://jobhunt.app') {
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ' + token);
      return Response.json(ready(grant()));
    }
    assert.equal(new Headers(init?.headers).get('authorization'), null);
    assert.equal(new Headers(init?.headers).get('cookie'), null);
    return pdf();
  });
  const saved = await client.downloadPreparedDocument(input);
  assert.deepEqual(Buffer.from(saved.bytes), bytes); assert.equal(calls, 2);
  assert.equal('url' in saved, false);
});

test('wrong document, expired grant and unsafe URLs never reach object storage', async () => {
  for (const change of [{ version_id: id }, { package_id: second }, { expires_at: new Date(0).toISOString() },
    { url: 'http://objects.example.test/file' }, { url: 'file:///tmp/synthetic' }, { url: 'https://user:pass@objects.example.test/file' },
    { url: 'http://127.0.0.1/file' }, { url: 'https://objects.example.test/file#fragment' }, { size_bytes: 25000001 }]) {
    let calls = 0;
    await assert.rejects(api(async () => { calls++; return Response.json(ready({ ...grant(), ...change })); }).downloadPreparedDocument(input), /invalid_(response|download)/);
    assert.equal(calls, 1);
  }
});

test('truncation, oversized chunks, incorrect checksum, content and provider failures are bounded and private', async () => {
  for (const response of [() => new Response(bytes.subarray(0, 8), { headers: { 'Content-Type': 'application/pdf' } }),
    () => new Response(Buffer.concat([bytes, bytes]), { headers: { 'Content-Type': 'application/pdf' } }),
    () => new Response(Buffer.from('%PDF-1.7\nSYNTHETIC-only'), { headers: { 'Content-Type': 'application/pdf' } }),
    () => new Response(bytes, { headers: { 'Content-Type': 'text/html' } }),
    () => new Response(null, { status: 302, headers: { Location: 'https://unrelated.example.test' } }),
    () => { throw Error('https://objects.example.test/?grant=private'); }]) {
    let calls = 0;
    await assert.rejects(api(async () => ++calls === 1 ? Response.json(ready(grant())) : response()).downloadPreparedDocument(input),
      error => { assert.ok(error instanceof Error); assert.match(error.message, /^(invalid_download|download_checksum_mismatch|download_failed)$/); return true; });
    assert.equal(calls, 2);
  }
});

test('CLI publishes verified bytes privately and atomically; existing files and symlinks are retained', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jobhunt-package-test-'));
  try {
    const destination = join(root, 'synthetic.pdf'); let calls = 0;
    const fetchImpl: typeof fetch = async url => {
      calls++; return new URL(String(url)).origin === 'https://jobhunt.app' ? Response.json(ready(grant())) : pdf();
    };
    const run = async (output: string) => {
      let stdout = '', stderr = '';
      const code = await runCLI(['packages', 'download', id, '--version-id', second, '--output', output, '--json'], {
        env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([]), fetchImpl,
        stdout: new Writable({ write(c, _e, cb) { stdout += c; cb(); } }),
        stderr: new Writable({ write(c, _e, cb) { stderr += c; cb(); } }),
      }, 'test');
      assert.ok(!stdout.includes('grant=') && !stderr.includes('grant=') && !stdout.includes(destination));
      return { code, stdout, stderr };
    };
    assert.equal((await run(destination)).code, 0);
    assert.deepEqual(await readFile(destination), bytes);
    await assertPrivateFile(destination);
    assert.equal(calls, 2);
    assert.notEqual((await run(destination)).code, 0); assert.equal(calls, 2);
    const existing = join(root, 'existing'); await writeFile(existing, 'preserved');
    if (process.platform !== 'win32') {
      const pointer = join(root, 'pointer'); await symlink(existing, pointer);
      assert.notEqual((await run(pointer)).code, 0); assert.equal(calls, 2);
      assert.equal(await readFile(existing, 'utf8'), 'preserved');
    }
    assert.ok((await readdir(root)).every(name => !name.startsWith('.jobhunt-download-')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
