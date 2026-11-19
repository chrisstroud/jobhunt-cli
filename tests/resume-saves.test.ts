import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { JobHuntClient, prepareResumeSave, resumeSaveInput, resumeSaveOriginalHash,
  RESUME_SAVE_OPERATION, type ResumeSaveInput } from '../client/src/index.ts';

const account = 'jh_11111111-1111-4111-8111-111111111111';
const request = '22222222-2222-4222-8222-222222222222';
const document = '33333333-3333-4333-8333-333333333333';
const input: ResumeSaveInput = { request_id: request, expected_account_id: account, document_id: document,
  slug: 'synthetic-profile', fields: { expected_revision: 3, name: 'Synthetic profile',
    description: '', content: { summary: 'Synthetic café 😀', private: [true, 1.5, null] } } };
const receipt = () => ({ id: request, kind: RESUME_SAVE_OPERATION, status: 'succeeded', resource_type: 'document',
  result: { resource_id: document, revision: 4, status: 'saved', related_ids: [] },
  retry_expires_at: '2030-01-01T00:00:00Z', retry_after_seconds: 0 });
async function response() {
  const prepared = await prepareResumeSave(input);
  return { ok: true, operation: receipt(), resume_save: { request_id: request, payload_hash: prepared.payloadHash,
    source_size: prepared.original.source_size, source_sha256: prepared.original.source_sha256 } };
}
const client = (fetchImpl: typeof fetch) => new JobHuntClient({
  credential: { origin: 'https://jobhunt.app', token: 'synthetic-profile-save-token' }, fetchImpl });

test('explicit closure checks exact descriptor proof and never retries a lost response', async () => {
  const prepared = await prepareResumeSave(input);
  let writes = 0;
  const sdk = client(async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/close_resume_profile_original_v1');
    assert.deepEqual(JSON.parse(String(init?.body)), { ...prepared.original, confirm_close: true });
    writes++;
    return Response.json({ outcome: 'ready', data: { request_id: request, document_id: document,
      payload_hash: prepared.payloadHash, outcome: 'closed' }, next_action: { kind: 'none', label: '' } });
  });
  assert.equal((await sdk.resumeSaves.close(prepared.original, true)).outcome, 'closed');
  assert.equal(writes, 1);
  const lost = client(async () => { writes++; throw Error('Synthetic lost reply'); });
  await assert.rejects(lost.resumeSaves.close(prepared.original, true));
  assert.equal(writes, 2);
});

test('substituted closure proof cannot confirm local cleanup', async () => {
  const prepared = await prepareResumeSave(input);
  const sdk = client(async () => Response.json({ outcome: 'ready', data: { request_id: request, document_id: document,
    payload_hash: '0'.repeat(64), outcome: 'closed' }, next_action: { kind: 'none', label: '' } }));
  await assert.rejects(sdk.resumeSaves.close(prepared.original, true));
});

test('full originals bind exact UTF-8 bytes and snapshot caller fields before awaiting', async () => {
  const mutable = structuredClone(input);
  const pending = prepareResumeSave(mutable);
  mutable.fields.content!.summary = 'Synthetic later mutation';
  mutable.fields.layout = 'single-page';
  const prepared = await pending;
  assert.deepEqual((prepared.body.data as { attributes: unknown }).attributes, input.fields);
  const raw = new TextEncoder().encode(JSON.stringify(prepared.body));
  assert.equal(prepared.original.source_size, raw.length);
  assert.equal(prepared.original.source_sha256, createHash('sha256').update(raw).digest('hex'));
  assert.equal(prepared.payloadHash, await resumeSaveOriginalHash(prepared.original));
  assert.deepEqual(prepared.original.fields_supplied, ['content', 'description', 'name']);
});

test('SDK requests bounded receipt-only saves and checks exact source without repeating writes', async () => {
  const prepared = await prepareResumeSave(input);
  const seen: string[] = [];
  const sdk = client(async (url, init) => {
    const parsed = new URL(String(url)); seen.push(parsed.pathname);
    assert.equal(init!.redirect, 'error'); assert.equal(init!.credentials, 'omit');
    if (init!.method === 'PATCH') {
      assert.equal(parsed.searchParams.get('return'), 'receipt');
      assert.deepEqual(JSON.parse(String(init!.body)), prepared.body);
      return Response.json(await response());
    }
    assert.equal(parsed.pathname, '/api/v1/resume-templates/save-original/status');
    assert.equal(parsed.searchParams.get('expected_payload_hash'), prepared.payloadHash);
    assert.equal(parsed.searchParams.get('document_id'), document);
    assert.ok(!parsed.href.includes('Synthetic'));
    return Response.json({ ok: true, operation: receipt() });
  });
  assert.equal((await sdk.resumeSaves.save(input)).operation.id, request);
  assert.equal((await sdk.resumeSaves.check(prepared.original)).id, request);
  assert.equal(seen.length, 2);
});

test('complete fields retain native capacity without compact fact limits', async () => {
  const large = { ...input, fields: { ...input.fields,
    content: { summary: 'x'.repeat(12000), skills: Array.from({ length: 150 }, () => ({ name: 'Synthetic' })),
      _untouched: { custom: true } } } };
  assert.deepEqual((await prepareResumeSave(large)).body.data,
    { type: 'resume_template', attributes: large.fields });
  for (const fields of [{ expected_revision: 3, content: { invalid: '\ud800' } },
    { expected_revision: 3, content: { invalid: NaN } }, { expected_revision: 3, content: { invalid: undefined } },
    { expected_revision: 3, content: null }, { expected_revision: 3, is_default: null },
    { expected_revision: 3, unexpected: 'Synthetic' }, { expected_revision: 3 }]) {
    assert.throws(() => resumeSaveInput({ ...input, fields }));
  }
});

test('substituted receipts and source proofs fail without repeating a mutation', async () => {
  for (const scenario of ['resource', 'revision', 'kind', 'status', 'payload', 'source', 'size']) {
    let calls = 0;
    const sdk = client(async () => {
      calls++;
      const value = await response();
      if (scenario === 'resource') value.operation.result.resource_id = request;
      if (scenario === 'revision') value.operation.result.revision = 3;
      if (scenario === 'kind') value.operation.kind = 'unrelated' as typeof RESUME_SAVE_OPERATION;
      if (scenario === 'status') value.operation.status = 'pending';
      if (scenario === 'payload') value.resume_save.payload_hash = '0'.repeat(64);
      if (scenario === 'source') value.resume_save.source_sha256 = '0'.repeat(64);
      if (scenario === 'size') value.resume_save.source_size++;
      return Response.json(value);
    });
    await assert.rejects(() => sdk.resumeSaves.save(input), /invalid_response/u);
    assert.equal(calls, 1);
  }
});

test('operation lookups carry optional exact hashes and validate them before dispatch', async () => {
  let calls = 0;
  const prepared = await prepareResumeSave(input);
  const sdk = client(async url => {
    calls++;
    const args = JSON.parse(new URL(String(url)).searchParams.get('arguments')!);
    assert.equal(args.expected_payload_hash, prepared.payloadHash);
    return Response.json({ outcome: 'ready', next_action: { kind: 'none', label: '' }, data: {
      id: request, kind: RESUME_SAVE_OPERATION, status: 'succeeded', resource: {
        id: document, kind: 'document', label: 'Saved document', revision: 4 },
      retry_expires_at: '2030-01-01T00:00:00Z', retry_after_seconds: 0 } });
  });
  await sdk.getOperation({ operation_id: request, expected_payload_hash: prepared.payloadHash });
  await assert.rejects(() => sdk.getOperation({ operation_id: request, expected_payload_hash: 'invalid' }), /invalid_input/u);
  assert.equal(calls, 1);
});
