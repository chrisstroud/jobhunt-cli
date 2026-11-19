import { assertPrivateFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const token = 'synthetic_preview_credential';
const document = { document_id: id, expected_revision: 2, page: 1 };
const prepared = { application_id: other, version_id: id, expected_revision: 2, expected_sha256: 'a'.repeat(64), page: 1 };
const jpeg = Buffer.from([255, 216, 255, 217]);
const image = { document_id: id, revision: 2, page: 1, pages: 2, image_chunks: ['data:image/jpeg;base64,' + jpeg.toString('base64')] };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });

test('private previews use exact public GET contracts and never fetch image URLs', async () => {
  const seen: string[] = [];
  const client = api(async (url, init) => {
    const parsed = new URL(String(url)); seen.push(parsed.pathname);
    assert.deepEqual(JSON.parse(parsed.searchParams.get('arguments')!), seen.length === 1 ? document : prepared);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    return Response.json(ready(image));
  });
  const saved = await client.downloadDocumentPreview(document);
  const frozen = await client.downloadPreparedDocumentPreview(prepared);
  assert.deepEqual(saved.bytes, new Uint8Array(jpeg)); assert.equal(saved.media_type, 'image/jpeg');
  assert.equal(frozen.source_sha256, prepared.expected_sha256); assert.equal(frozen.application_id, other);
  assert.ok(!('image_chunks' in saved) && !('sha256' in frozen));
  assert.deepEqual(seen, ['/api/v1/journey/get_document_page_preview_v2', '/api/v1/journey/get_prepared_page_preview_v2']);
});

test('invalid preview intent fails before network access', async () => {
  let calls = 0; const client = api(async () => { calls++; return Response.json(ready(image)); });
  for (const changed of [{ ...document, page: 0 }, { ...document, page: 101 }, { ...document, page: 1.5 },
    { ...document, expected_revision: 0 }, { ...document, document_id: 'invalid' }, { ...document, url: 'https://files.example.test' }])
    await assert.rejects(client.previewDocumentPage(changed), /invalid_input/);
  for (const changed of [{ ...prepared, application_id: 'invalid' }, { ...prepared, version_id: 'invalid' },
    { ...prepared, expected_sha256: 'bad' }, { ...prepared, expected_sha256: 'A'.repeat(64) }, { ...prepared, page: 101 }])
    await assert.rejects(client.previewPreparedDocumentPage(changed), /invalid_input/);
  assert.equal(calls, 0);
});

test('preview replies bind identity, saved revision and page and reject unbounded or invalid JPEG transport', async () => {
  for (const changed of [{ ...image, document_id: other }, { ...image, revision: 3 }, { ...image, page: 2 },
    { ...image, pages: 0 }, { ...image, image_chunks: [] }, { ...image, image_chunks: Array(13).fill('a') },
    { ...image, image_chunks: ['a'.repeat(64001)] }, { ...image, image_chunks: ['https://files.example.test/private.jpg'] },
    { ...image, image_chunks: ['data:image/jpeg;base64,/9j/2Q==extra'] },
    { ...image, image_chunks: ['data:image/jpeg;base64,YmFk'] },
    { ...image, image_chunks: ['data:image/png;base64,/9j/2Q=='] }]) {
    let calls = 0;
    const client = api(async () => { calls++; return Response.json(ready(changed)); });
    await assert.rejects(client.downloadDocumentPreview(document), /invalid_response/);
    await assert.rejects(client.downloadPreparedDocumentPreview(prepared), /invalid_response/);
    assert.equal(calls, 2);
  }
});

async function cli(args: string[], fetchImpl: typeof fetch) {
  let stdout = ''; let stderr = '';
  const code = await runCLI([...args, '--json', '--non-interactive'], { env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([]), fetchImpl,
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk.toString(); done(); } }),
  }, 'test');
  return { code, stdout, stderr };
}

for (const group of ['documents', 'packages']) test(`${group} preview writes private bytes exclusively and prints metadata only`, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jobhunt-preview-')); let calls = 0;
  try {
    const path = join(dir, 'intent.json'); const output = join(dir, 'page.jpg'); const link = join(dir, 'symlink.jpg');
    await writeFile(path, JSON.stringify(group === 'documents' ? document : prepared));
    const fetchImpl = async () => { calls++; return Response.json(ready(image)); };
    const args = [group, 'preview', '--file', path, '--output', output];
    const result = await cli(args, fetchImpl);
    assert.equal(result.code, 0); assert.equal(JSON.parse(result.stdout).saved, true);
    assert.ok(!result.stdout.includes('image_chunks') && !result.stdout.includes('data:image') && !result.stdout.includes(token));
    assert.deepEqual(await readFile(output), jpeg); await assertPrivateFile(output);
    assert.equal((await cli(args, fetchImpl)).code, 7);
    await symlink(output, link);
    assert.equal((await cli([group, 'preview', '--file', path, '--output', link], fetchImpl)).code, 7);
    assert.equal(calls, 1);
    const raced = join(dir, 'raced.jpg');
    const race = await cli([group, 'preview', '--file', path, '--output', raced], async () => {
      await writeFile(raced, 'Synthetic existing file'); return Response.json(ready(image));
    });
    assert.equal(race.code, 7); assert.equal(await readFile(raced, 'utf8'), 'Synthetic existing file');
  } finally { await rm(dir, { force: true, recursive: true }); }
});
