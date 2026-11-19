import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { JobHuntClient, MAX_SECTION_SAVE_BYTES, MAX_SECTION_VALUE_BYTES, prepareSectionSave, sectionSaveOriginal, sectionSaveOriginalHash, type SectionSaveInput } from '../client/src/index.ts';
const input: SectionSaveInput = { request_id: '11111111-1111-4111-8111-111111111111',
  expected_account_id: 'jh_22222222-2222-4222-8222-222222222222', document_id: '33333333-3333-4333-8333-333333333333',
  template_slug: 'synthetic-resume', section: 'summary', expected_revision: 4,
  value: { text: 'Synthetic café 😀', '10': 1.25e-7, '2': 1, '😀': true, '\ue000': false } };
test('section preparation captures exact bytes and a content-minimal descriptor before awaiting', async () => {
  const mutable = structuredClone(input), pending = prepareSectionSave(mutable);
  mutable.value = 'Synthetic later edit'; mutable.document_id = '44444444-4444-4444-8444-444444444444';
  const prepared = await pending;
  assert.deepEqual(prepared.body.value, input.value);
  assert.equal(prepared.body.document_id, input.document_id);
  assert.equal(prepared.original.source_size, Buffer.byteLength(prepared.text));
  assert.equal(prepared.original.source_sha256, createHash('sha256').update(prepared.text).digest('hex'));
  assert.equal(prepared.payloadHash, await sectionSaveOriginalHash(prepared.original));
  assert.ok(!JSON.stringify(prepared.original).includes('Synthetic'));
});
test('different document, account, section, revision or value cannot share an original hash', async () => {
  const original = await prepareSectionSave(input);
  for (const change of [{ document_id: '44444444-4444-4444-8444-444444444444' },
    { expected_account_id: 'jh_44444444-4444-4444-8444-444444444444' }, { section: 'work' },
    { expected_revision: 5 }, { value: 'Other' }]) {
    assert.notEqual((await prepareSectionSave({ ...input, ...change })).payloadHash, original.payloadHash);
  }
});
test('invalid native JSON and missing identity fail before producing an original', async () => {
  const circular: unknown[] = []; circular.push(circular);
  for (const value of [undefined, NaN, Infinity, '\ud800', '\0', { omitted: undefined }, circular, new Date()]) {
    await assert.rejects(prepareSectionSave({ ...input, value }));
  }
  for (const change of [{ document_id: undefined }, { expected_account_id: 'other' }, { expected_revision: 0 }, { extra: true }]) {
    await assert.rejects(prepareSectionSave({ ...input, ...change } as SectionSaveInput));
  }
});
test('native carrier limits count UTF-8 bytes and descriptor parsing rejects unknown content', async () => {
  const complete = await prepareSectionSave({ ...input, value: '😀'.repeat(140000) });
  assert.ok(complete.original.source_size > 524288);
  assert.equal(complete.original.source_sha256, createHash('sha256').update(complete.text).digest('hex'));
  await assert.rejects(prepareSectionSave({ ...input, value: '😀'.repeat(MAX_SECTION_VALUE_BYTES / 4) }));
  const { original } = await prepareSectionSave(input);
  assert.throws(() => sectionSaveOriginal({ ...original, value: input.value }));
  assert.throws(() => sectionSaveOriginal({ ...original, source_size: MAX_SECTION_SAVE_BYTES + 1 }));
});

test('a full native section retains all bytes while the retry proof stays compact', async () => {
  const value = 'x'.repeat(MAX_SECTION_VALUE_BYTES - 14);
  const prepared = await prepareSectionSave({ ...input, value });
  assert.equal(Buffer.byteLength(JSON.stringify({ summary: prepared.body.value })), MAX_SECTION_VALUE_BYTES);
  assert.equal(prepared.original.source_sha256, createHash('sha256').update(prepared.text).digest('hex'));
  assert.equal(prepared.original.source_size, Buffer.byteLength(prepared.text));
  assert.ok(JSON.stringify(prepared.original).length < 1024);
});


const sdk = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: {
  origin: 'https://jobhunt.app', token: 'synthetic-section-token' }, fetchImpl });
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
test('section check binds namespace, document and original revision without writing', async () => {
  const prepared = await prepareSectionSave(input);
  for (const mismatch of ['', 'kind', 'document', 'revision', 'status']) {
    let calls = 0;
    const client = sdk(async (url, init) => {
      calls++;
      assert.equal(init?.method, 'GET');
      const args = JSON.parse(new URL(String(url)).searchParams.get('arguments')!);
      assert.deepEqual(args, { operation_name: 'save_document_section', request_id: input.request_id,
        expected_payload_hash: prepared.payloadHash });
      return Response.json(ready({ id: input.request_id, kind: mismatch === 'kind' ? 'other' : 'save_document_section',
        status: mismatch === 'status' ? 'pending' : 'succeeded', resource: { kind: 'document', label: 'Saved document',
          id: mismatch === 'document' ? input.request_id : input.document_id,
          revision: mismatch === 'revision' ? input.expected_revision : input.expected_revision + 1 },
        retry_expires_at: '2030-01-01T00:00:00Z', retry_after_seconds: 0 }));
    });
    if (mismatch) await assert.rejects(client.sectionSaves.check(prepared.original), /invalid_response/u);
    else assert.equal((await client.sectionSaves.check(prepared.original)).kind, 'save_document_section');
    assert.equal(calls, 1);
  }
});
test('section closure captures exact descriptor, requires explicit confirmation and validates proof', async () => {
  const prepared = await prepareSectionSave(input);
  for (const outcome of ['closed', 'recorded', 'expired', 'invalid']) {
    const original = structuredClone(prepared.original);
    let calls = 0;
    const client = sdk(async (url, init) => {
      calls++;
      assert.equal(new URL(String(url)).pathname, '/api/v1/journey/close_document_section_original_v1');
      assert.deepEqual(JSON.parse(String(init?.body)), { ...prepared.original, confirm_close: true });
      original.document_id = input.request_id;
      return Response.json(ready({ request_id: input.request_id, document_id: input.document_id,
        payload_hash: prepared.payloadHash, outcome }));
    });
    if (outcome === 'invalid') await assert.rejects(client.sectionSaves.close(original, true), /invalid_response/u);
    else assert.equal((await client.sectionSaves.close(original, true)).outcome, outcome);
    assert.equal(calls, 1);
    await assert.rejects(client.sectionSaves.close(prepared.original, false as true), /invalid_input/u);
    assert.equal(calls, 1);
  }
  for (const field of ['request_id', 'document_id', 'payload_hash']) {
    const client = sdk(async () => Response.json(ready({ request_id: input.request_id, document_id: input.document_id,
      payload_hash: prepared.payloadHash, outcome: 'closed', [field]: field === 'payload_hash' ? '0'.repeat(64) : input.expected_account_id })));
    await assert.rejects(client.sectionSaves.close(prepared.original, true), /invalid_response/u);
  }
});
test('lost section closure reply never triggers an automatic second write', async () => {
  const { original } = await prepareSectionSave(input); let calls = 0;
  const client = sdk(async () => { calls++; throw Error('Synthetic lost response'); });
  await assert.rejects(client.sectionSaves.close(original, true));
  assert.equal(calls, 1);
});


test('section closure cannot treat a pending envelope as fresh closure evidence', async () => {
  const prepared = await prepareSectionSave(input);
  const client = sdk(async () => Response.json({ ...ready({ request_id: input.request_id, document_id: input.document_id,
    payload_hash: prepared.payloadHash, outcome: 'closed' }), outcome: 'needs_input' }));
  await assert.rejects(client.sectionSaves.close(prepared.original, true), /invalid_response/u);
});
