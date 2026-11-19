import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const ready = (data: unknown) => Response.json({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
function source(text: string) {
  const chars = [...text];
  const manifest = { format: 'plain' as const, filename: 'highlights-all.txt', mime: 'text/plain' as const,
    size_bytes: Buffer.byteLength(text), size_chars: chars.length, chunk_chars: 64000 as const,
    chunk_count: Math.ceil(chars.length / 64000), sha256: hash(text) };
  const part = (index: number) => {
    const text = chars.slice((index - 1) * 64000, index * 64000).join('');
    return { ...manifest, chunk_index: index, text, chunk_sha256: hash(text) };
  };
  return { manifest, part };
}
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_export_credential' }, fetchImpl });

test('complete export assembles more than one MB in bounded Unicode chunks at one checksum', async () => {
  const text = '🙂é\u0001'.repeat(180000); const { manifest, part } = source(text); let calls = 0;
  const api = client(async (url, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    const args = JSON.parse(new URL(String(url)).searchParams.get('arguments')!);
    if (calls++ === 0) { assert.deepEqual(args, { format: 'plain' }); return ready(manifest); }
    assert.equal(args.expected_sha256, manifest.sha256); assert.equal(args.chunk_index, calls - 1);
    const chunk = part(args.chunk_index); assert.ok([...chunk.text].length <= 64000); return ready(chunk);
  });
  const result = await api.downloadCompleteHighlights({ format: 'plain' });
  assert.equal(new TextDecoder().decode(result.bytes), text); assert.equal(result.size_bytes, Buffer.byteLength(text));
  assert.equal(calls, manifest.chunk_count + 1); assert.ok(!('text' in result) && !('text_chunks' in result));
});

test('complete export rejects malformed manifests before requesting chunks', async () => {
  const { manifest } = source('Supplied fact');
  for (const change of [{ chunk_count: 2 }, { size_chars: 0 }, { size_bytes: 1 }, { mime: 'text/html' }, { filename: 'highlights-start-now.txt' }, { size_bytes: Number.MAX_SAFE_INTEGER + 1 }]) {
    let calls = 0;
    await assert.rejects(client(async () => { calls++; return ready({ ...manifest, ...change }); }).downloadCompleteHighlights({ format: 'plain' }), /invalid_response/);
    assert.equal(calls, 1);
  }
});

test('chunk identity, selected date range, lengths and each checksum are verified', async () => {
  const { manifest, part } = source('Supplied fact');
  for (const change of [{ chunk_index: 2 }, { sha256: 'b'.repeat(64) }, { text: 'Short' }, { chunk_sha256: 'b'.repeat(64) }, { filename: 'highlights-start-now.txt' }]) {
    let calls = 0;
    await assert.rejects(client(async () => calls++ === 0 ? ready(manifest) : ready({ ...part(1), ...change })).downloadCompleteHighlights({ format: 'plain' }), /invalid_response|download_checksum_mismatch/);
  }
  const hugeChars = 2147483648;
  const huge = { ...manifest, size_bytes: hugeChars, size_chars: hugeChars, chunk_count: Math.ceil(hugeChars / 64000) };
  assert.equal((await client(async () => ready(huge)).getHighlightExportManifest({ format: 'plain' })).data?.size_bytes, hugeChars);
  const dated = { ...manifest, filename: 'highlights-2026-10-01-now.txt' };
  assert.equal((await client(async () => ready(dated)).getHighlightExportManifest({ format: 'plain', date_from: '2026-10-01' })).data?.filename, dated.filename);
});

test('source conflict during download fails after one attempt and never retries a changed revision', async () => {
  const { manifest, part } = source('Synthetic fact '.repeat(10000)); let calls = 0;
  const api = client(async () => {
    calls++;
    if (calls === 1) return ready(manifest);
    if (calls === 2) return ready(part(1));
    return Response.json({ errors: [{ code: 'revision_conflict', title: 'Review source' }] }, { status: 409 });
  });
  await assert.rejects(api.downloadCompleteHighlights({ format: 'plain' }), /revision_conflict/);
  assert.equal(calls, 3);
});

test('complete download checks whole-file bytes independently and returns only declared metadata', async () => {
  const { manifest, part } = source('Synthetic fact'); let calls = 0;
  const altered = 'Synthetic edit';
  await assert.rejects(client(async () => calls++ === 0 ? ready(manifest) :
    ready({ ...part(1), text: altered, chunk_sha256: hash(altered) })).downloadCompleteHighlights({ format: 'plain' }), /download_checksum_mismatch/);
  calls = 0;
  const result = await client(async () => calls++ === 0 ? ready({ ...manifest, text: 'Undeclared content' }) : ready(part(1))).downloadCompleteHighlights({ format: 'plain' });
  assert.ok(!('text' in result));
  let fetches = 0;
  await assert.rejects(client(async () => { fetches++; return ready(part(1)); }).getHighlightExportChunk({ format: 'plain', expected_sha256: 'bad', chunk_index: 1 }), /invalid_input/);
  assert.equal(fetches, 0);
});
