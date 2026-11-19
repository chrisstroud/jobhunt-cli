import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { JobHuntClient, applicationDeletionOriginal, applicationDeletionRead, type ApplicationDeletionOriginal } from '../client/src/index.ts';
import { applicationRecordCommand } from '../cli/src/application-records.ts';
const account = 'jh_11111111-1111-4111-8111-111111111111', document = '22222222-2222-4222-8222-222222222222';
const request = '33333333-3333-4333-8333-333333333333', operation = '44444444-4444-4444-8444-444444444444';
const original: ApplicationDeletionOriginal = { expected_account_id: account,
  original: { request_id: request, expected_account_id: account, application_id: document, expected_revision: 4 } };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const receipt = () => ({ id: operation, status: 'succeeded', kind: 'delete_application_v2',
  resource: { id: document, kind: 'application', label: 'Saved document', revision: 5 },
  retry_after_seconds: 0, retry_expires_at: '2030-01-01T00:00:00Z', error: null });
const sdk = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-delete-token' }, fetchImpl });
test('deletion originals snapshot exact omission/null semantics and revision before hashing', async () => {
  const input = structuredClone(original), pending = applicationDeletionRead(input); input.original.expected_revision = 99;
  assert.deepEqual(await pending, await applicationDeletionRead(original));
  const omitted = structuredClone(original); delete omitted.original.expected_account_id;
  const explicitNull = { ...omitted, original: { ...omitted.original, expected_account_id: null } };
  assert.equal(new Set(await Promise.all([original, omitted, explicitNull].map(async v => (await applicationDeletionRead(v)).expected_payload_hash))).size, 3);
});
test('deletion check uses the captured account and exact hash with the existing read operation', async () => {
  let calls = 0;
  const client = sdk(async (url, init) => {
    calls++; assert.equal(init?.method, 'GET');
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/get_job_hunt_operation');
    assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), await applicationDeletionRead(original));
    return Response.json(ready(receipt()));
  });
  const result = await client.applicationDeletions.check(original);
  assert.equal(result.application_id, document); assert.equal(result.request_id, request); assert.equal(result.operation_id, operation);
  assert.equal(calls, 1);
});
test('a wrong resource, operation, pending state or malformed receipt cannot prove deletion', async () => {
  for (const changes of [{ kind: 'set_application_target_v2' }, { status: 'pending' }, { retry_after_seconds: 2 },
    { resource: { ...receipt().resource, id: request } }, { resource: { ...receipt().resource, revision: 6 } },
    { resource: { ...receipt().resource, kind: 'document' } }, { resource: null }, { error: { code: 'failed', message: 'Synthetic failure' } }]) {
    await assert.rejects(sdk(async () => Response.json(ready({ ...receipt(), ...changes }))).applicationDeletions.check(original), /invalid_response/u);
  }
  await assert.rejects(sdk(async () => Response.json({ outcome: 'needs_input', data: null, next_action: { kind: 'none', label: '' } })).applicationDeletions.check(original), /invalid_response/u);
});
test('closure requires explicit confirmation and verifies its exact returned fence', async () => {
  const { expected_payload_hash } = await applicationDeletionRead(original);
  for (const mismatch of [false, true]) {
    let calls = 0;
    const client = sdk(async (_url, init) => {
      calls++; assert.equal(init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(init?.body)), { ...original, confirm_close: true });
      return Response.json(ready({ request_id: request, application_id: document, payload_hash: mismatch ? '0'.repeat(64) : expected_payload_hash, outcome: 'closed' }));
    });
    await assert.rejects(client.applicationDeletions.close(original, false as true)); assert.equal(calls, 0);
    if (mismatch) await assert.rejects(client.applicationDeletions.close(original, true), /invalid_response/u);
    else assert.equal((await client.applicationDeletions.close(original, true)).outcome, 'closed');
    assert.equal(calls, 1);
  }
});
test('wrong accounts, missing identity and extras fail before dispatch', () => {
  for (const input of [{ ...original, expected_account_id: 'jh_' + document },
    { original: original.original }, { ...original, extra: true },
    { ...original, original: { ...original.original, expected_revision: 0 } }]) assert.throws(() => applicationDeletionOriginal(input));
});
test('CLI check is read only; closure requires matching document confirmation', async () => {
  const { expected_payload_hash } = await applicationDeletionRead(original); let writes = 0;
  const client = sdk(async (_url, init) => {
    if (init?.method === 'POST') { writes++; return Response.json(ready({ request_id: request, application_id: document, payload_hash: expected_payload_hash, outcome: 'recorded' })); }
    return Response.json(ready(receipt()));
  });
  const input = () => Readable.from([JSON.stringify(original)]);
  assert.equal((await applicationRecordCommand('applications check-delete', undefined, { file: '-' }, client, input()) as { application_id: string }).application_id, document);
  await assert.rejects(applicationRecordCommand('applications close-delete', undefined, { file: '-', confirm: request }, client, input()));
  assert.equal(writes, 0);
  assert.equal((await applicationRecordCommand('applications close-delete', undefined, { file: '-', confirm: document }, client, input()) as { outcome: string }).outcome, 'recorded');
  assert.equal(writes, 1);
});
test('accepted UUID spelling is preserved when hashing an original', async () => {
  const spelled = { ...original, original: { ...original.original, application_id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' } };
  const lower = { ...spelled, original: { ...spelled.original, application_id: spelled.original.application_id.toLowerCase() } };
  assert.equal(applicationDeletionOriginal(spelled).original.application_id, spelled.original.application_id);
  assert.notEqual((await applicationDeletionRead(spelled)).expected_payload_hash, (await applicationDeletionRead(lower)).expected_payload_hash);
});
