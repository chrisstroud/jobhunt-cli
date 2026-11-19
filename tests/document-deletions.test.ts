import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { JobHuntClient, documentDeletionOriginal, prepareDocumentDeletion, documentDeletionRead, type DocumentDeletionOriginal } from '../client/src/index.ts';
import { documentCommand } from '../cli/src/documents.ts';
const account = 'jh_11111111-1111-4111-8111-111111111111', document = '22222222-2222-4222-8222-222222222222';
const request = '33333333-3333-4333-8333-333333333333', operation = '44444444-4444-4444-8444-444444444444';
const original: DocumentDeletionOriginal = { expected_account_id: account,
  original: { request_id: request, expected_account_id: account, document_id: document, expected_revision: 4 } };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const receipt = () => ({ id: operation, status: 'succeeded', kind: 'delete_document_v2',
  resource: { id: document, kind: 'document', label: 'Saved document', revision: null },
  retry_after_seconds: 0, retry_expires_at: '2030-01-01T00:00:00Z', error: null });
const sdk = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-delete-token' }, fetchImpl });
test('deletion originals snapshot exact omission/null semantics and revision before hashing', async () => {
  const input = structuredClone(original), pending = prepareDocumentDeletion(input); input.original.expected_revision = 99;
  assert.equal((await pending).captured.original.expected_revision, 4);
  const omitted = structuredClone(original); delete omitted.original.expected_account_id;
  const explicitNull = { ...omitted, original: { ...omitted.original, expected_account_id: null } };
  assert.equal(new Set(await Promise.all([original, omitted, explicitNull].map(async v => (await prepareDocumentDeletion(v)).payloadHash))).size, 3);
});
test('deletion check uses the captured account and exact hash with the existing read operation', async () => {
  let calls = 0;
  const client = sdk(async (url, init) => {
    calls++; assert.equal(init?.method, 'GET');
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/get_job_hunt_operation');
    assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), await documentDeletionRead(original));
    return Response.json(ready(receipt()));
  });
  const result = await client.documentDeletions.check(original);
  assert.equal(result.document_id, document); assert.equal(result.request_id, request); assert.equal(result.operation_id, operation);
  assert.equal(calls, 1);
});
test('a wrong resource, operation, pending state or malformed receipt cannot prove deletion', async () => {
  for (const changes of [{ kind: 'rename_document_v2' }, { status: 'pending' }, { retry_after_seconds: 2 },
    { resource: { ...receipt().resource, id: request } }, { resource: { ...receipt().resource, revision: 5 } },
    { resource: { ...receipt().resource, kind: 'application' } }, { resource: null }, { error: { code: 'failed', message: 'Synthetic failure' } }]) {
    await assert.rejects(sdk(async () => Response.json(ready({ ...receipt(), ...changes }))).documentDeletions.check(original), /invalid_response/u);
  }
  await assert.rejects(sdk(async () => Response.json({ outcome: 'needs_input', data: null, next_action: { kind: 'none', label: '' } })).documentDeletions.check(original), /invalid_response/u);
});
test('closure requires explicit confirmation and verifies its exact returned fence', async () => {
  const { payloadHash } = await prepareDocumentDeletion(original);
  for (const mismatch of [false, true]) {
    let calls = 0;
    const client = sdk(async (_url, init) => {
      calls++; assert.equal(init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(init?.body)), { ...original, confirm_close: true });
      return Response.json(ready({ request_id: request, document_id: document, payload_hash: mismatch ? '0'.repeat(64) : payloadHash, outcome: 'closed' }));
    });
    await assert.rejects(client.documentDeletions.close(original, false as true)); assert.equal(calls, 0);
    if (mismatch) await assert.rejects(client.documentDeletions.close(original, true), /invalid_response/u);
    else assert.equal((await client.documentDeletions.close(original, true)).outcome, 'closed');
    assert.equal(calls, 1);
  }
});
test('wrong accounts, missing identity and extras fail before dispatch', () => {
  for (const input of [{ ...original, expected_account_id: 'jh_' + document },
    { original: original.original }, { ...original, extra: true },
    { ...original, original: { ...original.original, expected_revision: 0 } }]) assert.throws(() => documentDeletionOriginal(input));
});
test('CLI check is read only; closure requires matching document confirmation', async () => {
  const { payloadHash } = await prepareDocumentDeletion(original); let writes = 0;
  const client = sdk(async (_url, init) => {
    if (init?.method === 'POST') { writes++; return Response.json(ready({ request_id: request, document_id: document, payload_hash: payloadHash, outcome: 'recorded' })); }
    return Response.json(ready(receipt()));
  });
  const input = () => Readable.from([JSON.stringify(original)]);
  assert.equal((await documentCommand('documents check-delete', undefined, { file: '-' }, client, input()) as { document_id: string }).document_id, document);
  await assert.rejects(documentCommand('documents close-delete', undefined, { file: '-', confirm: request }, client, input()));
  assert.equal(writes, 0);
  assert.equal((await documentCommand('documents close-delete', undefined, { file: '-', confirm: document }, client, input()) as { outcome: string }).outcome, 'recorded');
  assert.equal(writes, 1);
});
