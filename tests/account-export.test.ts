import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { DEFAULT_SCOPES, loginScopes } from '../cli/src/oauth.ts';

const owner = 'jh_11111111-1111-4111-8111-111111111111';
const input = { expected_account_id: owner, format: 'json' as const };
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const ready = (data: unknown) => Response.json({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const counts = Object.fromEntries(['user', 'applications', 'resume_templates', 'job_searches', 'contacts', 'companies',
  'tasks', 'interview_steps', 'mutation_receipts', 'resume_imports', 'job_hunt_preferences'].map(key => [key, 1]));
function source(bytes = Buffer.from('🙂é supplied records.'.repeat(70000)), format: 'json' | 'zip' = 'json') {
  const manifest = { account_id: owner, format, exported_at: '2026-10-23T12:34:56+00:00',
    filename: 'job-search-export-20261023.' + format, mime: format === 'json' ? 'application/json' : 'application/zip',
    size_bytes: bytes.length, sha256: hash(bytes), chunk_bytes: 64000, chunk_count: Math.ceil(bytes.length / 64000), record_counts: counts };
  const part = (index: number) => {
    const part = bytes.subarray((index - 1) * 64000, index * 64000);
    return { ...manifest, chunk_index: index, content_base64: part.toString('base64'), chunk_sha256: hash(part) };
  };
  return { manifest, part, bytes };
}
function client(fetchImpl: typeof fetch) {
  return new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_export_test' }, fetchImpl }).accountExport;
}
const reverse = (v: object) => Object.fromEntries(Object.entries(v).reverse());

test('complete >1MiB export verifies bounded chunks, sorted JSON key order and final source without private metadata', async () => {
  const { manifest, part, bytes } = source(); let calls = 0;
  const api = client(async (url, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    const parsed = new URL(String(url)), args = JSON.parse(parsed.searchParams.get('arguments')!);
    assert.equal(args.expected_account_id, owner); calls++;
    if (parsed.pathname.endsWith('manifest')) {
      if (calls !== 1) assert.equal(args.exported_at, manifest.exported_at);
      return ready(reverse(manifest));
    }
    assert.equal(args.expected_sha256, manifest.sha256); assert.equal(args.expected_size_bytes, bytes.length);
    assert.equal(args.chunk_index, calls - 1); return ready(reverse(part(args.chunk_index)));
  });
  const output = await api.download(input);
  assert.deepEqual(Buffer.from(output.bytes), bytes); assert.equal(calls, manifest.chunk_count + 2);
  assert.equal(output.sha256, manifest.sha256); assert.ok(!('content_base64' in output));
});

test('binary ZIP transport preserves every byte and canonical base64 padding', async () => {
  const { manifest, part, bytes } = source(Buffer.from(Array.from({ length: 129001 }, (_, i) => i % 256)), 'zip');
  const api = client(async url => {
    const parsed = new URL(String(url)), args = JSON.parse(parsed.searchParams.get('arguments')!);
    return ready(parsed.pathname.endsWith('manifest') ? manifest : part(args.chunk_index));
  });
  assert.deepEqual(Buffer.from((await api.download({ ...input, format: 'zip' })).bytes), bytes);
});

test('account export is opt-in and never added to ordinary login defaults', () => {
  assert.deepEqual(DEFAULT_SCOPES, ['read:profile', 'read:applications', 'write:applications']);
  assert.deepEqual(loginScopes('read:profile,read:account-export'), ['read:profile', 'read:account-export']);
  assert.ok(!loginScopes().includes('read:account-export'));
});

test('invalid captured account, format, timestamp and extra properties fail before dispatch', async () => {
  let calls = 0;
  const api = client(async () => { calls++; return ready(source().manifest); });
  for (const changes of [{ expected_account_id: 'bad' }, { format: 'csv' }, { exported_at: '2026-10-23' },
    { exported_at: '2026-02-30T12:34:56Z' }, { exported_at: '2026-10-23T24:00:00Z' }, { extra: true }]) {
    await assert.rejects(api.manifest({ ...input, ...changes } as never), /invalid_input/);
  }
  assert.equal(calls, 0);
  assert.equal((await api.manifest({ ...input, exported_at: null })).data?.account_id, owner);
});

test('malformed manifests cannot start a download', async () => {
  const { manifest } = source();
  for (const changes of [{ account_id: owner.replace('11111111', '22222222') }, { size_bytes: 0 }, { size_bytes: 2 ** 53 },
    { chunk_count: 1 }, { chunk_bytes: 32000 }, { sha256: 'x' }, { mime: 'text/html' },
    { filename: '../../private.json' }, { record_counts: { ...counts, unexpected: 1 } }, { content_base64: 'eA==' }]) {
    let calls = 0;
    await assert.rejects(client(async () => { calls++; return ready({ ...manifest, ...changes }); }).download(input), /invalid_response/);
    assert.equal(calls, 1);
  }
});

test('chunk account/source/index/count and local byte checks reject substitution', async () => {
  const { manifest, part } = source(Buffer.from('Synthetic private records'));
  for (const changes of [{ account_id: owner.replace('11111111', '22222222') }, { chunk_index: 2 }, { sha256: 'b'.repeat(64) },
    { chunk_sha256: 'b'.repeat(64) }, { exported_at: '2026-10-24T12:34:56+00:00' },
    { record_counts: { ...counts, contacts: 2 } }, { content_base64: 'bad' }, { content_base64: '' },
    { content_base64: Buffer.from('Synthetic edited records!').toString('base64'), chunk_sha256: hash(Buffer.from('Synthetic edited records!')) }]) {
    let calls = 0;
    await assert.rejects(client(async () => ready(calls++ === 0 ? manifest : { ...part(1), ...changes })).download(input), /invalid_response|download_checksum_mismatch/);
    assert.equal(calls, 2);
  }
});

test('source changes, revocation and lost reads fail without automatic retry', async () => {
  const { manifest, part } = source();
  for (const status of [401, 403, 409, 503]) {
    let calls = 0;
    const api = client(async () => {
      calls++;
      return calls === 1 ? ready(manifest) : calls === 2 ? ready(part(1)) : Response.json({ errors: [{ code: 'source_unavailable' }] }, { status });
    });
    await assert.rejects(api.download(input)); assert.equal(calls, 3);
  }
  let calls = 0;
  await assert.rejects(client(async () => {
    calls++;
    if (calls === 1) return ready(manifest);
    throw new Error('Synthetic lost response');
  }).download(input));
  assert.equal(calls, 2);
});

test('a change after the final chunk prevents successful completion', async () => {
  const { manifest, part } = source(Buffer.from('Synthetic private records')); let calls = 0;
  await assert.rejects(client(async () => {
    calls++;
    return ready(calls === 1 ? manifest : calls === 2 ? part(1) : { ...manifest, sha256: 'b'.repeat(64) });
  }).download(input), /revision_conflict/);
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(client(async () => {
    calls++;
    return calls < 3 ? ready(calls === 1 ? manifest : part(1)) :
      Response.json({ outcome: 'needs_input', data: manifest, next_action: { kind: 'reconnect', label: 'Reconnect' } });
  }).download(input), /revision_conflict/);
});
