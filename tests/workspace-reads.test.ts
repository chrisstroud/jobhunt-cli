import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient, type TaskDescriptionManifest } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const token = 'synthetic_workspace_read_credential';
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const task = { id, revision: 1, title: 'Synthetic task', description: 'Synthetic full notes '.repeat(1000), dueAt: null,
  completedAt: null, isActive: true, applicationId: null, applicationSlug: null, roleTitle: null, companyName: null, recurrence: null };
const page = (number = 1, total = 1) => ({ page: number, total, has_more: false, items: [task] });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });
const sha = async (bytes: Uint8Array<ArrayBuffer>) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');

test('portable workspace reads preserve full notes, nullable application context and independent choice pages', async () => {
  let calls = 0;
  const client = api(async (url, init) => {
    calls++; assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    const parsed = new URL(String(url)); const args = JSON.parse(parsed.searchParams.get('arguments')!);
    if (parsed.pathname.endsWith('get_task_workspace')) {
      assert.deepEqual(args, { task_id: id, expected_application_id: null, occurrence_date: '2026-10-22' });
      return Response.json(ready(page()));
    }
    assert.deepEqual(args, { page: 2 });
    return Response.json(ready(parsed.pathname.endsWith('list_task_workspace') ? page(2, 21) : {
      page: 2, total: 101, has_more: false, items: [{ id, slug: null, companyName: '', position: 'Synthetic role', stage: 'Backlog',
        revision: 1, contactRole: 'other', isPrimaryContact: false }],
    }));
  });
  assert.equal((await client.getTaskWorkspace({ task_id: id, expected_application_id: null, occurrence_date: '2026-10-22' })).data?.items[0].description, task.description);
  assert.equal((await client.listTaskWorkspace({ page: 2 })).data?.total, 21);
  assert.equal((await client.listApplicationChoices({ page: 2 })).data?.items[0].slug, null);
  assert.equal(calls, 3);
});

test('workspace reads reject substituted identity, pages, context, recurrence and invalid input', async () => {
  for (const change of [{ id: other }, { applicationId: other }, { revision: 0 }, { description: 1 }])
    await assert.rejects(api(async () => Response.json(ready({ ...page(), items: [{ ...task, ...change }] })))
      .getTaskWorkspace({ task_id: id, expected_application_id: null }), /invalid_response/);
  for (const change of [{ page: 2 }, { total: 2 }, { has_more: true }, { items: [] }])
    await assert.rejects(api(async () => Response.json(ready({ ...page(), ...change }))).getTaskWorkspace({ task_id: id }), /invalid_response/);
  let calls = 0; const client = api(async () => { calls++; return Response.json(ready(page())); });
  await assert.rejects(client.listTaskWorkspace({ page: 0 }), /invalid_input/);
  await assert.rejects(client.listApplicationChoices({ slug: '../foreign' }), /invalid_input/);
  await assert.rejects(client.getTaskWorkspace({ task_id: id, occurrence_date: '2026-02-30' }), /invalid_input/);
  await assert.rejects(client.getTaskDescriptionManifest({ task_id: '../foreign' }), /invalid_input/);
  await assert.rejects(client.getOwnedPhoto('../foreign'), /invalid_input/);
  assert.equal(calls, 0);
});

async function noteServer(text: string, options: { isNull?: boolean; wrongWholeHash?: boolean; changedAccount?: boolean; disconnect?: boolean } = {}) {
  const bytes = new TextEncoder().encode(text), points = [...text];
  const manifest: TaskDescriptionManifest = { account_id: 'jh_' + id, task_id: id, application_id: null, revision: 1,
    task_type: 'quick', is_stage_template: false,
    is_null: options.isNull ?? false, filename: 'task-' + id + '.txt', mime: 'text/plain', size_bytes: bytes.length,
    size_chars: points.length, chunk_chars: 32000, chunk_count: Math.ceil(points.length / 32000),
    sha256: options.wrongWholeHash ? 'a'.repeat(64) : await sha(bytes) };
  let calls = 0;
  const fetchImpl: typeof fetch = async url => {
    calls++; const parsed = new URL(String(url)); const args = JSON.parse(parsed.searchParams.get('arguments')!);
    if (parsed.pathname.endsWith('_manifest')) return Response.json(ready(manifest));
    assert.equal(args.expected_application_id, null); assert.equal(args.expected_revision, 1); assert.equal(args.expected_sha256, manifest.sha256);
    if (options.disconnect && args.chunk_index === 2) throw new TypeError('Synthetic interrupted task-note read');
    const part = points.slice((args.chunk_index - 1) * 32000, args.chunk_index * 32000).join('');
    return Response.json(ready({ ...manifest, ...(options.changedAccount ? { account_id: 'jh_' + other } : {}),
      chunk_index: args.chunk_index, text: part, chunk_sha256: await sha(new TextEncoder().encode(part)) }));
  };
  return { manifest, fetchImpl, bytes, calls: () => calls };
}

test('complete task notes verify Unicode chunks, complete bytes, null state and empty files', async () => {
  const server = await noteServer('Synthetic 😀é\n'.repeat(6000));
  const downloaded = await api(server.fetchImpl).downloadTaskDescription({ task_id: id });
  assert.deepEqual(downloaded.bytes, server.bytes); assert.equal(downloaded.account_id, 'jh_' + id);
  assert.equal(server.calls(), server.manifest.chunk_count + 1);
  for (const isNull of [false, true]) {
    const empty = await noteServer('', { isNull });
    const value = await api(empty.fetchImpl).downloadTaskDescription({ task_id: id });
    assert.equal(value.bytes.length, 0); assert.equal(value.is_null, isNull); assert.equal(empty.calls(), 1);
  }
});

test('complete notes reject changed accounts and a false whole-file checksum', async () => {
  for (const options of [{ changedAccount: true }, { wrongWholeHash: true }]) {
    const server = await noteServer('Synthetic private note', options);
    await assert.rejects(api(server.fetchImpl).downloadTaskDescription({ task_id: id }),
      options.changedAccount ? /invalid_response/ : /download_checksum_mismatch/);
  }
});

async function cli(args: string[], fetchImpl: typeof fetch) {
  let stdout = '', stderr = '';
  const code = await runCLI([...args, '--json', '--non-interactive'], { env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([]), fetchImpl,
    stdout: new Writable({ write(v, _e, done) { stdout += v; done(); } }),
    stderr: new Writable({ write(v, _e, done) { stderr += v; done(); } }),
  }, 'test');
  return { code, stdout, stderr };
}

test('CLI private note downloads never publish partial files or replace an existing output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'synthetic-task-note-'));
  try {
    const output = join(directory, 'note.txt');
    const server = await noteServer('Synthetic interrupted 😀\n'.repeat(4000), { disconnect: true });
    const failed = await cli(['tasks', 'description', id, '--output', output], server.fetchImpl);
    assert.equal(failed.code, 7); assert.equal(failed.stdout, ''); assert.ok(server.calls() > 2);
    await assert.rejects(access(output));
    await writeFile(output, 'Synthetic retained file');
    const before = server.calls();
    assert.equal((await cli(['tasks', 'description', id, '--output', output], server.fetchImpl)).code, 7);
    assert.equal(server.calls(), before); assert.equal(await readFile(output, 'utf8'), 'Synthetic retained file');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('owned photo download binds the requested artifact and refuses invalid PNG data', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZAsAAAAASUVORK5CYII=', 'base64');
  const photo = { photo_id: id, image_chunks: ['data:image/png;base64,' + png.toString('base64')] };
  const good = await api(async url => {
    assert.ok(new URL(String(url)).pathname.endsWith('get_owned_photo')); return Response.json(ready(photo));
  }).downloadOwnedPhoto(id);
  assert.deepEqual(Buffer.from(good.bytes), png);
  for (const value of [{ ...photo, photo_id: other }, { ...photo, image_chunks: ['not-a-png'] }])
    await assert.rejects(api(async () => Response.json(ready(value))).downloadOwnedPhoto(id), /invalid_response/);
});

test('complete note reads honor bounded throttling and never retry other failures', async () => {
  const server = await noteServer('Synthetic rate-limited private note');
  let attempts = 0;
  const downloaded = await api(async (url, init) => {
    assert.equal(init?.method, 'GET');
    if (String(url).includes('_chunk') && attempts++ === 0)
      return Response.json({ errors: [{ code: 'rate_limited' }] }, { status: 429, headers: { 'Retry-After': '1' } });
    return server.fetchImpl(url, init);
  }).downloadTaskDescription({ task_id: id });
  assert.deepEqual(downloaded.bytes, server.bytes); assert.equal(attempts, 2);
  for (const seconds of ['120', 'invalid']) {
    let calls = 0;
    await assert.rejects(api(async () => { calls++; return Response.json({ errors: [{ code: 'rate_limited' }] },
      { status: 429, headers: { 'Retry-After': seconds } }); }).downloadTaskDescription({ task_id: id }),
      error => !!error && typeof error === 'object' && 'status' in error && error.status === 429);
    assert.equal(calls, 1);
  }
});
