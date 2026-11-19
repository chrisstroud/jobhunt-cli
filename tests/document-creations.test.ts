import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Readable } from 'node:stream';
import { JobHuntClient, prepareDocumentCreation, prepareDocumentCreationSource, documentCreationOriginalHash, documentCreationSlug,
  DOCUMENT_CREATION_OPERATION, MAX_NATIVE_DOCUMENT_BYTES, type DocumentCreationInput } from '../client/src/index.ts';
import { documentCommand } from '../cli/src/documents.ts';

const account = 'jh_11111111-1111-4111-8111-111111111111', requestId = '22222222-2222-4222-8222-222222222222';
const documentId = '33333333-3333-4333-8333-333333333333';
const input = (): DocumentCreationInput => ({ expected_account_id: account, request_id: requestId, document_id: documentId,
  fields: { name: 'Synthetic native package', content: { summary: 'Synthetic café 😀', unknown: [false, 0, null] } } });
const receipt = () => ({ id: requestId, kind: DOCUMENT_CREATION_OPERATION, status: 'succeeded', resource_type: 'document',
  result: { resource_id: documentId, revision: 1, status: 'saved', related_ids: [] },
  retry_expires_at: '2030-01-01T00:00:00Z', retry_after_seconds: 0 });
async function response() {
  const prepared = await prepareDocumentCreation(input());
  return { ok: true, operation: receipt(), document_creation: { request_id: requestId, payload_hash: prepared.payloadHash,
    source_size: prepared.original.source_size, source_sha256: prepared.original.source_sha256 } };
}
const client = (fetchImpl: typeof fetch) => new JobHuntClient({
  credential: { origin: 'https://jobhunt.app', token: 'synthetic-document-creation-token' }, fetchImpl });

test('creation snapshots complete UTF-8 source before awaiting without implicit identity or facts', async () => {
  const mutable = input(), pending = prepareDocumentCreation(mutable);
  mutable.fields.content.summary = 'Synthetic later edit';
  const prepared = await pending;
  assert.deepEqual((prepared.body.data as { attributes: unknown }).attributes, input().fields);
  assert.equal(prepared.original.source_sha256, createHash('sha256').update(prepared.bytes).digest('hex'));
  assert.equal(prepared.original.source_size, prepared.bytes.length);
  assert.equal(prepared.payloadHash, await documentCreationOriginalHash(prepared.original));
  assert.deepEqual(prepared.original.fields_supplied, ['content', 'name']);
  assert.equal(documentCreationSlug(documentId), 'resume-' + documentId.replaceAll('-', ''));
});

test('complete content supports the exact native bound and rejects overflow before dispatch', async () => {
  const plan = input();
  plan.fields.content = { summary: 'x'.repeat(MAX_NATIVE_DOCUMENT_BYTES - JSON.stringify({ summary: '' }).length) };
  assert.equal(new TextEncoder().encode(JSON.stringify((await prepareDocumentCreation(plan)).body)).length > MAX_NATIVE_DOCUMENT_BYTES, true);
  plan.fields.content.summary += 'x';
  await assert.rejects(prepareDocumentCreation(plan));
});

test('invalid native fields and reserved metadata never dispatch', async () => {
  let calls = 0;
  const sdk = client(async () => { calls++; throw Error('Should not dispatch'); });
  for (const fields of [{ name: 'Synthetic', content: { bad: '\ud800' } }, { name: 'Synthetic', content: { bad: NaN } },
    { name: 'Synthetic', content: { bad: undefined } }, { name: '', content: {} }, { name: 'Synthetic', content: null },
    { name: 'Synthetic', content: {}, source_metadata: { journey: { facts: [] } } },
    { name: 'Synthetic', content: {}, is_default: 'true' }, { name: 'Synthetic', content: {}, contact_profile_id: 'not-a-profile' }]) {
    await assert.rejects(sdk.documentCreations.create({ ...input(), fields } as DocumentCreationInput));
  }
  assert.equal(calls, 0);
});

test('SDK dispatches one original and check is a separate read without private source in its URL', async () => {
  const prepared = await prepareDocumentCreation(input());
  let posts = 0, gets = 0;
  const sdk = client(async (url, init) => {
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    if (init?.method === 'POST') {
      posts++; assert.deepEqual(JSON.parse(String(init.body)), prepared.body);
      return Response.json(await response(), { status: 201 });
    }
    gets++; assert.equal(new URL(String(url)).pathname, '/api/v1/journey/get_document_creation_original_v1');
    assert.ok(!String(url).includes('Synthetic'));
    assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), prepared.original);
    return Response.json({ outcome: 'ready', data: { request_id: requestId, document_id: documentId,
      slug: documentCreationSlug(documentId), revision: 1, payload_hash: prepared.payloadHash }, next_action: { kind: 'none', label: '' } });
  });
  assert.equal((await sdk.documentCreations.create(input())).operation.result.resource_id, documentId);
  assert.equal((await sdk.documentCreations.check(prepared.original)).revision, 1);
  assert.equal(posts, 1); assert.equal(gets, 1);
});

test('lost or substituted creation replies never cause an automatic second write', async () => {
  for (const issue of ['lost', 'hash', 'source', 'id', 'revision', 'operation']) {
    let calls = 0;
    const sdk = client(async () => {
      calls++;
      if (issue === 'lost') throw Error('Synthetic lost response');
      const value = await response();
      if (issue === 'hash') value.document_creation.payload_hash = '0'.repeat(64);
      if (issue === 'source') value.document_creation.source_size++;
      if (issue === 'id') value.operation.result.resource_id = requestId;
      if (issue === 'revision') value.operation.result.revision = 2;
      if (issue === 'operation') value.operation.kind = 'unrelated' as typeof DOCUMENT_CREATION_OPERATION;
      return Response.json(value);
    });
    await assert.rejects(sdk.documentCreations.create(input()));
    assert.equal(calls, 1);
  }
});

test('CLI creation and guarded closure use public SDK contracts and retain exact intent', async () => {
  const prepared = await prepareDocumentCreation(input());
  let calls = 0;
  const sdk = client(async (url, init) => {
    calls++;
    if (String(url).includes('/api/v1/resume-templates')) return Response.json(await response(), { status: 201 });
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/close_document_creation_original_v1');
    assert.deepEqual(JSON.parse(String(init?.body)), { ...prepared.original, confirm_close: true });
    return Response.json({ outcome: 'ready', data: { request_id: requestId, document_id: documentId,
      payload_hash: prepared.payloadHash, outcome: 'closed' }, next_action: { kind: 'none', label: '' } });
  });
  await documentCommand('documents create-native', undefined, { file: '-' }, sdk, Readable.from([JSON.stringify(input())]));
  await assert.rejects(documentCommand('documents close-creation', undefined, { file: '-', confirm: requestId }, sdk,
    Readable.from([JSON.stringify(prepared.original)])), /confirmation_required/u);
  assert.equal(calls, 1);
  await documentCommand('documents close-creation', undefined, { file: '-', confirm: documentId }, sdk,
    Readable.from([JSON.stringify(input())]));
  assert.equal(calls, 2);
});

test('raw local originals retain whitespace and integers beyond JavaScript precision through SDK and CLI', async () => {
  const prepared = await prepareDocumentCreation(input());
  const original = new TextEncoder().encode(JSON.stringify(prepared.body).replace('"Synthetic café 😀"', '900719925474099312345678901234567890') + '\n  ');
  const source = await prepareDocumentCreationSource(original);
  let calls = 0;
  const sdk = client(async (_url, init) => {
    calls++; assert.ok(init?.body instanceof Uint8Array); assert.deepEqual(init.body, original);
    return Response.json({ ok: true, operation: receipt(), document_creation: { request_id: requestId,
      payload_hash: source.payloadHash, source_size: original.length, source_sha256: source.original.source_sha256 } }, { status: 201 });
  });
  const mutable = new Uint8Array(original), pending = sdk.documentCreations.createSource(mutable);
  mutable.fill(0); await pending;
  await documentCommand('documents create-native', undefined, { file: '-' }, sdk, Readable.from([original]));
  assert.equal(calls, 2);
});
