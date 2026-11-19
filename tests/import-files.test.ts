import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { MAX_RESUME_FILE_BYTES } from '../client/src/import-file-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const token = 'synthetic_file_import_credential';
const input = { request_id: id, expected_account_id: 'jh_' + id };
const source = Buffer.from('%PDF-1.7\nsynthetic-only');
const result = { outcome: 'needs_input', data: { id, revision: 1, status: 'review', purpose: 'resume', facts: [] },
  next_action: { kind: 'edit', label: 'Review supplied facts' } };
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });

function uploadResult(meta: { size_bytes: number; sha256: string; media_type: string }) {
  return { outcome: 'ready', next_action: { kind: 'none', label: '' }, data: { id, status: 'awaiting_upload', ...meta,
    expires_at: new Date(Date.now() + 900000).toISOString(), import_id: null,
    upload: { url: 'https://storage.example.test/synthetic-grant', method: 'PUT', reusable_until_expiry: true,
      expires_at: new Date(Date.now() + 60000).toISOString(), headers: { 'Content-Type': meta.media_type,
        'Content-Length': String(meta.size_bytes), 'x-amz-meta-sha256': meta.sha256,
        'x-amz-checksum-sha256': Buffer.from(meta.sha256, 'hex').toString('base64') } } } };
}

test('direct upload freezes source and intent and sends no product credential to private storage', async () => {
  const supplied = Buffer.from(source); const suppliedIntent = { ...input }; const calls: string[] = [];
  const api = client(async (url, init) => {
    const parsed = new URL(String(url)); calls.push(parsed.pathname);
    if (parsed.pathname.endsWith('/prepare_resume_file_upload')) {
      const meta = JSON.parse(String(init?.body)); assert.equal(meta.request_id, id);
      supplied.fill(0); suppliedIntent.request_id = '22222222-2222-4222-8222-222222222222';
      const { size_bytes, sha256, media_type } = meta;
      return Response.json(uploadResult({ size_bytes, sha256, media_type }));
    }
    if (parsed.hostname === 'storage.example.test') {
      assert.equal(init?.method, 'PUT'); assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
      assert.equal(new Headers(init?.headers).get('Authorization'), null);
      assert.deepEqual(Buffer.from(init?.body as Uint8Array), source);
      return new Response(null, { status: 204 });
    }
    assert.equal(parsed.pathname, '/api/v1/journey/import_uploaded_resume');
    assert.deepEqual(JSON.parse(String(init?.body)), { ...input, upload_id: id });
    return Response.json(result);
  });
  assert.deepEqual(await api.uploadResumeFile(suppliedIntent, supplied, 'direct'), result);
  assert.equal(calls.length, 3);
});

test('auto selects direct transfer for large files and accepted replay never uploads again', async () => {
  const large = Buffer.alloc(4 * 1024 * 1024 + 1); source.copy(large);
  const calls: string[] = [];
  const api = client(async (url, init) => {
    const path = new URL(String(url)).pathname; calls.push(path);
    assert.ok(String(init?.body).length < 4096);
    if (path.endsWith('/prepare_resume_file_upload')) {
      const { size_bytes, sha256, media_type } = JSON.parse(String(init?.body));
      const prepared = uploadResult({ size_bytes, sha256, media_type });
      return Response.json({ ...prepared, data: { ...prepared.data, status: 'accepted', import_id: id, upload: null } });
    }
    assert.ok(path.endsWith('/import_uploaded_resume')); return Response.json(result);
  });
  assert.deepEqual(await api.uploadResumeFile(input, large), result);
  assert.equal(calls.length, 2);
});

test('hostile, expired or mismatched upload grants fail before transferring any bytes', async () => {
  for (const damage of ['auth', 'expired', 'size', 'checksum', 'insecure', 'redirect-credentials']) {
    let calls = 0;
    const api = client(async (_url, init) => {
      calls++;
      const { size_bytes, sha256, media_type } = JSON.parse(String(init?.body));
      const prepared = uploadResult({ size_bytes, sha256, media_type });
      const grant = prepared.data.upload;
      if (damage === 'auth') Object.assign(grant.headers, { Authorization: 'synthetic-private' });
      if (damage === 'expired') grant.expires_at = new Date(Date.now() - 1).toISOString();
      if (damage === 'size') grant.headers['Content-Length'] = '1';
      if (damage === 'checksum') grant.headers['x-amz-checksum-sha256'] = 'invalid';
      if (damage === 'insecure') grant.url = 'http://storage.example.test/file';
      if (damage === 'redirect-credentials') grant.url = 'https://user:password@storage.example.test/file';
      return Response.json(prepared);
    });
    await assert.rejects(api.uploadResumeFile(input, source, 'direct'), /invalid_(?:upload|response)/);
    assert.equal(calls, 1);
  }
});

test('a private upload failure neither retries nor submits the import and hides provider diagnostics', async () => {
  let calls = 0;
  const api = client(async (url, init) => {
    calls++;
    if (new URL(String(url)).pathname.endsWith('/prepare_resume_file_upload')) {
      const { size_bytes, sha256, media_type } = JSON.parse(String(init?.body));
      return Response.json(uploadResult({ size_bytes, sha256, media_type }));
    }
    return new Response('private signed URL and storage diagnostic', { status: 403 });
  });
  await assert.rejects(api.uploadResumeFile(input, source, 'direct'), error => {
    assert.ok(error instanceof Error); assert.equal(error.message, 'upload_failed'); return true;
  });
  assert.equal(calls, 2);
});

test('multipart imports retain exact bytes, account and request ID without a personal filename', async () => {
  let calls = 0;
  const api = client(async (url, init) => {
    calls++; assert.equal(new URL(String(url)).pathname, '/api/v1/journey/resume-upload');
    assert.equal(init?.method, 'POST'); assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('content-type'), null); // fetch supplies the matching boundary.
    assert.equal(headers.get('authorization'), 'Bearer ' + token);
    const form = init?.body; assert.ok(form instanceof FormData);
    assert.equal(form.get('request_id'), id); assert.equal(form.get('expected_account_id'), input.expected_account_id);
    const file = form.get('file'); assert.ok(file instanceof File);
    assert.equal(file.name, 'resume.pdf'); assert.equal(file.type, 'application/pdf');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), source);
    return Response.json(result);
  });
  assert.deepEqual(await api.uploadResumeFile(input, source), result);
  assert.deepEqual(await api.uploadResumeFile(input, source), result);
  assert.equal(calls, 2);
});

test('invalid byte signatures, oversized files and malformed identities fail before the first request', async () => {
  let calls = 0;
  const api = client(async () => { calls++; return Response.json(result); });
  for (const bytes of [new Uint8Array(), Buffer.from('not a document'), new Uint8Array(MAX_RESUME_FILE_BYTES + 1)])
    await assert.rejects(api.uploadResumeFile(input, bytes), /invalid_input/);
  await assert.rejects(api.uploadResumeFile({ request_id: 'invalid' }, source), /invalid_input/);
  await assert.rejects(api.uploadResumeFile({ ...input, expected_account_id: 'wrong' }, source), /invalid_input/);
  assert.equal(calls, 0);
});

test('transport failure makes one attempt, preserves the original intent and does not leak diagnostics', async () => {
  let calls = 0;
  await assert.rejects(client(async () => { calls++; throw Error('private-filename-and-content'); }).uploadResumeFile(input, source),
    error => { assert.ok(error instanceof Error); assert.equal(error.message, 'network_error'); return true; });
  assert.equal(calls, 1);
});

test('host-file import is a server request with exact metadata; the client never downloads the supplied URL', async () => {
  const hostInput = { ...input, file: { download_url: 'https://verified-files.example.test/resume?grant=synthetic', file_id: 'synthetic-file' } };
  let calls = 0;
  const api = client(async (url, init) => {
    calls++; assert.equal(new URL(String(url)).origin, 'https://jobhunt.app');
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/import_resume_file');
    assert.deepEqual(JSON.parse(String(init?.body)), hostInput);
    return Response.json(result);
  });
  assert.deepEqual(await api.importResumeHostFile(hostInput), result);
  await assert.rejects(api.importResumeHostFile({ ...hostInput, file: { ...hostInput.file, file_id: '' } }), /invalid_input/);
  assert.equal(calls, 1);
});

test('CLI accepts bounded binary stdin and regular files; rejects symlinks, directories and mixed token stdin', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jobhunt-upload-test-'));
  try {
    const path = join(root, 'synthetic-input'); await writeFile(path, source);
    let calls = 0;
    const run = async (file: string, extra: string[] = []) => {
      let stdout = '', stderr = '';
      const code = await runCLI(['resume-imports', 'file', '--file', file, '--request-id', id, '--json', ...extra], {
        env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([source]),
        fetchImpl: async () => { calls++; return Response.json(result); },
        stdout: new Writable({ write(c, _e, cb) { stdout += c; cb(); } }),
        stderr: new Writable({ write(c, _e, cb) { stderr += c; cb(); } }),
      }, 'test');
      assert.ok(!stderr.includes(root) && !stdout.includes(root) && !stderr.includes('synthetic-only'));
      return code;
    };
    assert.equal(await run('-'), 0); assert.equal(await run(path), 0); assert.equal(calls, 2);
    assert.equal(await run(root), 2); assert.equal(await run('-',['--token-stdin']), 2);
    if (process.platform !== 'win32') {
      const link = join(root, 'link'); await symlink(path, link); assert.equal(await run(link), 2);
    }
    const large = join(root, 'oversized'); await writeFile(large, new Uint8Array(MAX_RESUME_FILE_BYTES + 1));
    assert.equal(await run(large), 2); assert.equal(calls, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an upstream multipart limit returns an input error without exposing its HTML diagnostics', async () => {
  let output = '', error = '';
  const code = await runCLI(['resume-imports', 'file', '--file', '-', '--request-id', id, '--json'], {
    env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([source]),
    fetchImpl: async () => new Response('<html>private diagnostics</html>', { status: 413 }),
    stdout: new Writable({ write(c, _e, cb) { output += c; cb(); } }),
    stderr: new Writable({ write(c, _e, cb) { error += c; cb(); } }),
  }, 'test');
  assert.equal(code, 2); assert.equal(output, ''); assert.ok(!error.includes('private diagnostics'));
  assert.equal(JSON.parse(error).error.status, 413);
});
