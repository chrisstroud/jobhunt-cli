import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { JobHuntClient, documentVersionOriginal, prepareDocumentVersionOriginal, documentVersionOriginalRead, type DocumentVersionOriginal } from '../client/src/index.ts';
import { documentCommand } from '../cli/src/documents.ts';
const account = 'jh_11111111-1111-4111-8111-111111111111', document = '22222222-2222-4222-8222-222222222222';
const request = '33333333-3333-4333-8333-333333333333', version = '44444444-4444-4444-8444-444444444444';
const recovery = '55555555-5555-4555-8555-555555555555';
const checkpoint: DocumentVersionOriginal = { expected_account_id: account, operation_name: 'create_document_checkpoint_v2',
  original: { expected_account_id: account, request_id: request, document_id: document, expected_revision: 4, name: ' Synthetic checkpoint 😀 ' } };
const restore: DocumentVersionOriginal = { expected_account_id: account, operation_name: 'restore_document_revision',
  original: { expected_account_id: account, request_id: request, document_id: document, expected_revision: 4, version_id: version } };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const sdk = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-version-token' }, fetchImpl });
async function recorded(input: DocumentVersionOriginal) {
  const { captured, payloadHash } = await prepareDocumentVersionOriginal(input);
  return { operation_name: captured.operation_name, request_id: request, document_id: document, payload_hash: payloadHash,
    revision: input.operation_name === 'create_document_checkpoint_v2' ? 4 : 5,
    version_id: version, pre_restore_version_id: input.operation_name === 'create_document_checkpoint_v2' ? null : recovery,
    retry_expires_at: '2030-01-01T00:00:00Z' };
}
test('version preparation snapshots exact canonical fields before awaits', async () => {
  const mutable = structuredClone(checkpoint), pending = prepareDocumentVersionOriginal(mutable);
  mutable.original.expected_revision = 99;
  const result = await pending;
  assert.equal(result.captured.original.expected_revision, 4);
  assert.equal(JSON.parse(result.text).name, 'Synthetic checkpoint 😀');
  assert.equal(result.text, JSON.stringify(JSON.parse(result.text)));
  assert.notEqual(result.payloadHash, (await prepareDocumentVersionOriginal(mutable)).payloadHash);
});
test('checkpoint Unicode normalization matches server strip and full character capacity', async () => {
  for (const name of ['\u0085Synthetic\u0085', '\u001cSynthetic\u001f', '\ufeff', '😀'.repeat(255)]) {
    const value = documentVersionOriginal({ ...checkpoint, original: { ...checkpoint.original, name } });
    assert.equal('name' in value.original && value.original.name, name.includes('Synthetic') ? 'Synthetic' : name);
  }
  for (const name of ['\u0085', '😀'.repeat(256), '\ud800', '\0']) {
    assert.throws(() => documentVersionOriginal({ ...checkpoint, original: { ...checkpoint.original, name } }));
  }
});
test('legacy omitted and explicit null account retain distinct original hashes', async () => {
  const omitted = structuredClone(checkpoint); delete omitted.original.expected_account_id;
  const explicitNull = { ...omitted, original: { ...omitted.original, expected_account_id: null } } as DocumentVersionOriginal;
  const hashes = await Promise.all([checkpoint, omitted, explicitNull].map(async value => (await prepareDocumentVersionOriginal(value)).payloadHash));
  assert.equal(new Set(hashes).size, 3);
  assert.equal(Object.hasOwn(documentVersionOriginal(omitted).original, 'expected_account_id'), false);
});
for (const original of [checkpoint, restore]) test(`${original.operation_name}: check validates exact effect without writes`, async () => {
  const expected = await recorded(original);
  for (const change of [{}, { payload_hash: '0'.repeat(64) }, { version_id: recovery }, { revision: 99 },
    { request_id: version }, { document_id: version }, { operation_name: 'other' }, { retry_expires_at: 'invalid' },
    { pre_restore_version_id: original.operation_name === 'create_document_checkpoint_v2' ? recovery : null }]) {
    // A checkpoint has a server-chosen version ID; any valid UUID is permitted.
    const valid = !Object.keys(change).length || ('version_id' in change && original.operation_name === 'create_document_checkpoint_v2');
    let calls = 0;
    const client = sdk(async (url, init) => {
      calls++; assert.equal(init?.method, 'GET');
      assert.ok(new URL(String(url)).pathname.endsWith('/get_document_version_original_v1'));
      assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), await documentVersionOriginalRead(original));
      assert.ok(!String(url).includes('Synthetic'));
      return Response.json(ready({ ...expected, ...change }));
    });
    if (valid) assert.equal((await client.versionOriginals.check(original)).payload_hash, expected.payload_hash);
    else await assert.rejects(client.versionOriginals.check(original), /invalid_response/u);
    assert.equal(calls, 1);
  }
});
test('check cannot accept a non-ready response as recorded proof', async () => {
  const client = sdk(async () => Response.json({ outcome: 'needs_input', data: null, next_action: { kind: 'retry', label: '' } }));
  await assert.rejects(client.versionOriginals.check(restore), /invalid_response/u);
});
test('closure snapshots original, requires exact confirmation and checks returned fence', async () => {
  const expected = await recorded(restore);
  for (const mismatch of [false, true]) {
    let calls = 0;
    const mutable = structuredClone(restore);
    const client = sdk(async (_url, init) => {
      calls++; assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body)); assert.equal(body.confirm_close, true);
      assert.deepEqual(body.original, restore.original);
      return Response.json(ready({ request_id: request, document_id: document,
        payload_hash: mismatch ? '0'.repeat(64) : expected.payload_hash, outcome: 'closed' }));
    });
    await assert.rejects(client.versionOriginals.close(mutable, false as true)); assert.equal(calls, 0);
    const pending = client.versionOriginals.close(mutable, true); mutable.original.expected_revision = 99;
    if (mismatch) await assert.rejects(pending, /invalid_response/u);
    else assert.equal((await pending).outcome, 'closed');
    assert.equal(calls, 1);
  }
});
test('CLI version check uses a file intent; closure requires matching document confirmation', async () => {
  let writes = 0;
  const proof = await recorded(checkpoint);
  const client = sdk(async (_url, init) => {
    if (init?.method === 'POST') { writes++; return Response.json(ready({ request_id: request, document_id: document,
      payload_hash: proof.payload_hash, outcome: 'recorded' })); }
    return Response.json(ready(proof));
  });
  const stdin = () => Readable.from([JSON.stringify(checkpoint)]);
  const checked = await documentCommand('documents check-version', undefined, { file: '-' }, client, stdin());
  assert.ok('revision' in checked); assert.equal(checked.revision, 4);
  await assert.rejects(documentCommand('documents close-version', undefined, { file: '-' }, client, stdin()), /confirmation_required/u);
  assert.equal(writes, 0);
  const closed = await documentCommand('documents close-version', undefined, { file: '-', confirm: document }, client, stdin());
  assert.ok('outcome' in closed); assert.equal(closed.outcome, 'recorded');
  assert.equal(writes, 1);
});
