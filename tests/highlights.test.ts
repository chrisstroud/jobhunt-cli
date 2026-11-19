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
const token = 'synthetic_highlight_credential';
const fingerprint = 'a'.repeat(64);
const row = { id, user_id: id, title: 'Supplied fact', date: '2026-10-21', description: null, impact_raw: null, impact_refined: null,
  category: null, role: null, company_id: null, company_name: null, linked_campaign_id: null, linked_campaign_name: null,
  tags: [], created_at: '2026-10-21T00:00:00', updated_at: '2026-10-21T00:00:00' };
const page = { journal: { ok: true, items: [row], total: 1, page: 1, per_page: 50, pages: 1 }, fingerprints: { [id]: fingerprint } };
const saved = { deleted: false, highlight: row, fingerprint };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });
const exportText = '## Supplied facts\n\nUnicode: 🙂 — supplied wording.\n';
const file = { text_chunks: [exportText.slice(0, 10), exportText.slice(10)], filename: 'highlights-all.md', mime: 'text/markdown',
  size_bytes: Buffer.byteLength(exportText), sha256: createHash('sha256').update(exportText).digest('hex') };

test('journal reads retain every filter and partial edits preserve omission/null exactly without retries', async () => {
  const query = { search: 'supplied', per_page: 50, category: 'delivery', company_id: id, role: 'Engineer', tags: ['one', 'two'], sort: 'date_asc' as const };
  const patch = { request_id: id, action: 'update' as const, highlight_id: id, expected_fingerprint: fingerprint, fields: { description: null } };
  let calls = 0;
  const client = api(async (url, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    if (calls++ === 0) {
      assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), query);
      return Response.json(ready(page));
    }
    assert.ok(String(url).endsWith('/save_highlight_record_v2'));
    assert.deepEqual(JSON.parse(String(init?.body)), patch);
    return Response.json(ready(saved));
  });
  assert.deepEqual((await client.listHighlights(query)).data, page);
  assert.deepEqual((await client.saveHighlight(patch)).data, saved);
  assert.equal(calls, 2);
});

test('journal intent rejects invalid actions, stale shapes and dates before any request', async () => {
  let calls = 0; const client = api(async () => { calls++; return Response.json(ready(saved)); });
  for (const value of [{ action: 'create', fields: {} }, { action: 'create', highlight_id: id, fields: { title: 'Supplied' } },
    { action: 'update', highlight_id: id, expected_fingerprint: fingerprint, fields: { date: null } },
    { action: 'delete', highlight_id: id, expected_fingerprint: fingerprint, fields: {} },
    { action: 'update', highlight_id: id, expected_fingerprint: fingerprint, fields: { title: ' ' } },
    { action: 'create', fields: { title: 'Supplied', company_id: 'bad' } }])
    await assert.rejects(client.saveHighlight({ request_id: id, ...value } as never), /invalid_input/);
  for (const value of [{ date_from: '2026-02-30' }, { date_from: '2026-10-22', date_to: '2026-10-21' }, { per_page: 101 }, { sort: 'unsupported' }, { tags: Array(1001).fill('x') }])
    await assert.rejects(client.listHighlights(value as never), /invalid_input/);
  await assert.rejects(client.getHighlight('bad'), /invalid_input/);
  assert.equal(calls, 0);
});

test('journal replies bind IDs, page size and exact edit fingerprints', async () => {
  await assert.rejects(api(async () => Response.json(ready({ ...saved, highlight: { ...row, id: other } }))).getHighlight(id), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...page, fingerprints: {} }))).listHighlights(), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...page, journal: { ...page.journal, per_page: 100 } }))).listHighlights(), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...saved, deleted: true }))).saveHighlight({ request_id: id, action: 'create', fields: { title: 'Supplied' } }), /invalid_response/);
});

test('private text export verifies UTF-8 bytes, format and checksum without fetching a URL', async () => {
  let calls = 0;
  const client = api(async (url, init) => {
    calls++; assert.ok(String(url).includes('/get_highlight_export_v2?'));
    assert.equal(init?.credentials, 'omit'); return Response.json(ready(file));
  });
  const result = await client.downloadHighlights({ format: 'markdown' });
  assert.equal(new TextDecoder().decode(result.bytes), exportText); assert.ok(!('text_chunks' in result)); assert.equal(calls, 1);
  for (const changed of [{ ...file, sha256: 'b'.repeat(64) }, { ...file, size_bytes: 1 },
    { ...file, filename: '../unsafe.md' }, { ...file, mime: 'text/html' }, { ...file, text_chunks: ['x'.repeat(64001)] }])
    await assert.rejects(api(async () => Response.json(ready(changed))).downloadHighlights({ format: 'markdown' }), /invalid_response|download_checksum_mismatch/);
});

async function cli(args: string[], input: unknown, data: unknown) {
  let stdout = ''; let stderr = ''; let calls = 0;
  const code = await runCLI([...args, '--json', '--non-interactive'], { env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(input)]),
    fetchImpl: async url => {
      calls++;
      if (data && typeof data === 'object' && 'text_chunks' in data) {
        const { text_chunks, ...metadata } = data as typeof file;
        const text = text_chunks.join('');
        const manifest = { ...metadata, format: 'markdown', size_chars: [...text].length, chunk_chars: 64000, chunk_count: 1 };
        return Response.json(ready(String(url).includes('get_highlight_export_manifest_v2') ? manifest :
          { ...manifest, chunk_index: 1, text, chunk_sha256: metadata.sha256 }));
      }
      return Response.json(ready(data));
    },
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk.toString(); done(); } }),
  }, 'test'); return { code, stdout, stderr, calls };
}

test('delete requires an exact record confirmation and rejects mismatched command actions', async () => {
  const input = { request_id: id, action: 'delete', highlight_id: id, expected_fingerprint: fingerprint };
  assert.equal((await cli(['highlights', 'delete', '--file', '-'], input, saved)).code, 2);
  assert.equal((await cli(['highlights', 'delete', '--file', '-', '--confirm', other], input, saved)).calls, 0);
  assert.equal((await cli(['highlights', 'update', '--file', '-'], input, saved)).calls, 0);
  assert.equal((await cli(['highlights', 'delete', '--file', '-', '--confirm', id], input, { deleted: true, highlight: null, fingerprint: null })).code, 0);
  assert.equal((await cli(['highlights', 'get', id], {}, saved)).code, 0);
});

test('private journal export writes mode 0600, refuses files/symlinks and prints no journal text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jobhunt-journal-'));
  try {
    const output = join(dir, 'journal.md'); const link = join(dir, 'link.md');
    const args = ['highlights', 'export', '--file', '-', '--output', output];
    const result = await cli(args, { format: 'markdown' }, file);
    assert.equal(result.code, 0); await assertPrivateFile(output);
    assert.equal(await readFile(output, 'utf8'), exportText); assert.ok(!result.stdout.includes('text_chunks') && !result.stdout.includes('Supplied facts'));
    assert.equal((await cli(args, { format: 'markdown' }, file)).calls, 0);
    await symlink(output, link);
    assert.equal((await cli(['highlights', 'export', '--file', '-', '--output', link], { format: 'markdown' }, file)).calls, 0);
    await writeFile(join(dir, 'keep'), 'Synthetic existing text');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
