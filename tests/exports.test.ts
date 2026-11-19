import { assertPrivateFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { cancelExportInput, DOCX, MARKDOWN, PDF, TEXT } from '../client/src/export-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const token = 'synthetic_private_export_credential';
const hash = 'a'.repeat(64);
const source = { source: 'document', document_id: id, revision: 1, fingerprint: hash, format: 'docx', mode: 'resume', render_date: '2026-10-19' };
const intent = { document_id: id, format: 'docx' as const, request_id: other, expected_account_id: 'jh_' + id, expected_revision: 1, expected_fingerprint: hash };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'read', label: '' } });
const state = { ...source, id: other, status: 'ready', expires_at: new Date(Date.now() + 86400000).toISOString(), media_type: DOCX, sha256: hash, size_bytes: 10 };
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });

test('export preparation preserves reviewed source/account/request and never retries an uncertain write', async () => {
  let calls = 0;
  const client = api(async (url, init) => {
    calls++; assert.ok(String(url).endsWith('/prepare_document_export'));
    assert.deepEqual(JSON.parse(String(init?.body)), intent); return Response.json(ready(state));
  });
  await client.prepareDocumentExport(intent);
  for (const changes of [{ expected_fingerprint: 'bad' }, { expected_revision: 0 }, { document_id: 'bad' }, { mode: 'zip' }, { unknown: true }])
    await assert.rejects(client.prepareDocumentExport({ ...intent, ...changes } as never), /invalid_input/);
  assert.equal(calls, 1);
  await assert.rejects(api(async () => { calls++; throw Error('private diagnostic'); }).prepareDocumentExport(intent), /network_error|request_failed/);
  assert.equal(calls, 2);
});

test('export responses bind the reviewed source, page and export identifiers', async () => {
  await assert.rejects(api(async () => Response.json(ready({ ...source, document_id: other }))).getDocumentExportSource({ document_id: id }), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready(state))).getDocumentExport({ export_id: id }), /invalid_response/);
  const selection = { document_id: id, expected_revision: 2, expected_preview_revision: hash };
  const page = { ...source, source: 'hunt_page', page_revision: 2, preview_revision: hash };
  assert.deepEqual((await api(async () => Response.json(ready(page))).getHuntPageExportSource(selection)).data, page);
  await assert.rejects(api(async () => Response.json(ready({ ...page, page_revision: 3 }))).getHuntPageExportSource(selection), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...state, sha256: null }))).getDocumentExport({ export_id: other }), /invalid_response/);
});

test('reading a failed export preserves structured terminal state without treating it as a network failure', async () => {
  const result = { ...ready({ ...state, status: 'failed', sha256: null, size_bytes: null }), outcome: 'failed',
    error: { code: 'processing_failed', message: 'Review the source before preparing a new export.' } };
  assert.deepEqual(await api(async () => Response.json(result)).getDocumentExport({ export_id: other }), result);
  await assert.rejects(api(async () => Response.json({ ...result, data: { ...state, status: 'failed', sha256: hash, size_bytes: null } })).getDocumentExport({ export_id: other }), /invalid_response/);
});

for (const media of [PDF, DOCX, MARKDOWN, TEXT]) test(`verified ${media} transfer omits credentials and provider URLs`, async () => {
  const content = media === PDF ? Buffer.from('%PDF-synthetic') : media === DOCX ? Buffer.from([80, 75, 3, 4, 1, 2, 3, 4]) : Buffer.from('Synthetic résumé\n');
  const grant = { export_id: other, url: 'https://objects.example.test/synthetic?private=grant', method: 'GET',
    expires_at: new Date(Date.now() + 60000).toISOString(), media_type: media,
    sha256: createHash('sha256').update(content).digest('hex'), size_bytes: content.length, reusable_until_expiry: true };
  const client = api(async (url, init) => {
    if (new URL(String(url)).origin === 'https://jobhunt.app') return Response.json(ready(grant));
    assert.equal(new Headers(init?.headers).get('authorization'), null); assert.equal(new Headers(init?.headers).get('cookie'), null);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    return new Response(content, { headers: { 'Content-Type': media } });
  });
  const downloaded = await client.downloadDocumentExport({ export_id: other });
  assert.deepEqual(Buffer.from(downloaded.bytes), content); assert.equal('url' in downloaded, false);
  for (const change of [{ export_id: id }, { url: 'http://objects.example.test/file' }, { expires_at: new Date(0).toISOString() }, { size_bytes: 25000001 }]) {
    let calls = 0;
    await assert.rejects(api(async () => { calls++; return Response.json(ready({ ...grant, ...change })); }).downloadDocumentExport({ export_id: other }), /invalid_response|invalid_download/);
    assert.equal(calls, 1);
  }
  for (const body of [content.subarray(0, 5), Buffer.concat([content, content]), Buffer.alloc(content.length)]) {
    let calls = 0;
    await assert.rejects(api(async () => ++calls === 1 ? Response.json(ready(grant)) : new Response(body, { headers: { 'Content-Type': media } })).downloadDocumentExport({ export_id: other }), /invalid_download|download_checksum_mismatch/);
  }
});

for (const [format, media] of [['md', MARKDOWN], ['txt', TEXT]] as const) {
  test(`${format} is a Hunt Page format, not an unimplemented standalone format`, async () => {
    const selection = { document_id: id, expected_revision: 2, expected_preview_revision: hash, format };
    const page = { ...source, source: 'hunt_page', format, page_revision: 2, preview_revision: hash };
    assert.deepEqual((await api(async () => Response.json(ready(page))).getHuntPageExportSource(selection)).data, page);
    let requests = 0;
    await assert.rejects(api(async () => { requests++; throw new Error('Unexpected request'); })
      .getDocumentExportSource({ document_id: id, format: format as never }), /invalid_input/);
    assert.equal(requests, 0);
    await assert.rejects(api(async () => Response.json(ready({ ...source, format })))
      .getDocumentExportSource({ document_id: id }), /invalid_response/);
    await assert.rejects(api(async () => Response.json(ready({ ...state, ...page, media_type: PDF })))
      .getDocumentExport({ export_id: other }), /invalid_response/);
  });

  test(`${format} validates UTF-8 even when a transfer has the declared checksum`, async () => {
    for (const content of [Buffer.from('é'), Buffer.from([0xff, 0xfe]), Buffer.from('name\u0000'), Buffer.from(' \n')]) {
      const grant = { export_id: other, url: 'https://objects.example.test/synthetic', method: 'GET',
        expires_at: new Date(Date.now() + 60000).toISOString(), media_type: media,
        sha256: createHash('sha256').update(content).digest('hex'), size_bytes: content.length, reusable_until_expiry: true };
      const client = api(async url => new URL(String(url)).origin === 'https://jobhunt.app' ? Response.json(ready(grant)) :
        new Response(content, { headers: { 'Content-Type': media + '; charset=utf-8' } }));
      if (content.equals(Buffer.from('é'))) assert.deepEqual(Buffer.from((await client.downloadDocumentExport({ export_id: other })).bytes), content);
      else await assert.rejects(client.downloadDocumentExport({ export_id: other }), /invalid_download/);
    }
  });
}

async function cli(args: string[], fetchImpl: typeof fetch) {
  let stdout = '', stderr = '';
  const code = await runCLI([...args, '--json'], { env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([]), fetchImpl,
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk; done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk; done(); } }),
  }, 'test');
  return { code, stdout, stderr };
}

test('cancellation requires exact explicit account confirmation before I/O', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'export-cancel-'));
  try {
    const input = { export_id: other, request_id: id, expected_account_id: 'jh_' + id, confirm_cancel: true as const };
    const path = join(dir, 'intent.json'); await writeFile(path, JSON.stringify(input));
    assert.throws(() => cancelExportInput({ ...input, confirm_cancel: 1 }), /invalid_input/);
    let calls = 0;
    const fetchImpl = async () => { calls++; return Response.json(ready({ ...state, status: 'cancelled', sha256: null, size_bytes: null })); };
    for (const extra of [[], ['--confirm', 'jh_' + other]]) {
      const result = await cli(['exports', 'cancel', '--file', path, ...extra], fetchImpl);
      assert.equal(result.code, 2); assert.equal(JSON.parse(result.stderr).error.code, 'confirmation_required');
    }
    assert.equal(calls, 0);
    assert.equal((await cli(['exports', 'cancel', '--file', path, '--confirm', input.expected_account_id], fetchImpl)).code, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('export CLI writes private bytes once and never prints grants', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'export-file-'));
  try {
    const content = Buffer.from([80, 75, 3, 4, 1, 2, 3, 4]);
    const grant = { export_id: other, url: 'https://objects.example.test/synthetic?private=grant', method: 'GET',
      expires_at: new Date(Date.now() + 60000).toISOString(), media_type: DOCX,
      sha256: createHash('sha256').update(content).digest('hex'), size_bytes: content.length, reusable_until_expiry: true };
    let calls = 0;
    const fetchImpl: typeof fetch = async url => {
      calls++; return new URL(String(url)).origin === 'https://jobhunt.app' ? Response.json(ready(grant)) : new Response(content, { headers: { 'Content-Type': DOCX } });
    };
    const path = join(dir, 'synthetic.docx');
    const result = await cli(['exports', 'download', other, '--output', path], fetchImpl);
    assert.equal(result.code, 0); assert.deepEqual(await readFile(path), content);
    assert.ok(!result.stdout.includes('grant') && !result.stdout.includes(path));
    await assertPrivateFile(path);
    assert.equal((await cli(['exports', 'download', other, '--output', path], fetchImpl)).code, 7); assert.equal(calls, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('paper overrides use the same private inspection wire contract and reject malformed values before HTTP', async () => {
  let calls = 0;
  const client = api(async (url) => {
    calls++;
    const body = JSON.parse(new URL(String(url)).searchParams.get('arguments')!);
    assert.equal(body.page_size, 'a4');
    return Response.json({ ...ready(source), next_action: { kind: 'none', label: 'Paper: A4' } });
  });
  const read = await client.getDocumentExportSource({ document_id: id, format: 'docx', page_size: 'a4' });
  assert.equal(read.next_action.label, 'Paper: A4');
  assert.equal(calls, 1);
  for (const page_size of [null, '', 'legal', ['a4'], {}, true]) {
    await assert.rejects(client.getDocumentExportSource({ document_id: id, page_size } as never), /invalid_input/);
  }
  assert.equal(calls, 1);
});
