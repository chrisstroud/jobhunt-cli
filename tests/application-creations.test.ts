import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Readable } from 'node:stream';
import { JobHuntClient, prepareApplicationCreation, prepareApplicationCreationSource, applicationCreationOriginalHash,
  APPLICATION_CREATION_OPERATION, MAX_APPLICATION_CREATION_BYTES, type ApplicationCreationInput } from '../client/src/index.ts';
import { applicationCreationCommand } from '../cli/src/application-creations.ts';
const account = 'jh_11111111-1111-4111-8111-111111111111', requestId = '22222222-2222-4222-8222-222222222222';
const applicationId = '33333333-3333-4333-8333-333333333333';
const input = (): ApplicationCreationInput => ({ expected_account_id: account, request_id: requestId, application_id: applicationId,
  fields: { title: 'Synthetic role', company_name: 'Synthetic company', job_details: { description: 'Synthetic café 😀', unknown: [false, 0, null] },
    cover_letter: { body: 'Synthetic letter' }, resume_overrides: { summary: 'Synthetic facts' }, contacts: [{ name: 'Synthetic recruiter' }],
    activity: ['Ignored native row', { type: 'note', note: 'Synthetic source history' }] },
  metadata: { import_confirmed: false } });
const receipt = () => ({ id: requestId, kind: APPLICATION_CREATION_OPERATION, status: 'succeeded', resource_type: 'application',
  result: { resource_id: applicationId, revision: 1, status: 'saved', related_ids: [] },
  retry_expires_at: '2030-01-01T00:00:00Z', retry_after_seconds: 0 });
async function response() {
  const prepared = await prepareApplicationCreation(input());
  return { ok: true, operation: receipt(), application_creation: { request_id: requestId, payload_hash: prepared.payloadHash,
    source_size: prepared.original.source_size, source_sha256: prepared.original.source_sha256 } };
}
const client = (fetchImpl: typeof fetch) => new JobHuntClient({
  credential: { origin: 'https://jobhunt.app', token: 'synthetic-application-creation-token' }, fetchImpl });
test('rich source and import metadata are frozen before the first await with exact UTF-8 evidence', async () => {
  const mutable = input(), pending = prepareApplicationCreation(mutable);
  mutable.fields.job_details!.description = 'Synthetic later edit'; mutable.metadata!.import_confirmed = true;
  const prepared = await pending;
  assert.deepEqual((prepared.body.data as { attributes: unknown }).attributes, input().fields);
  assert.deepEqual((prepared.body.data as { meta: unknown }).meta, input().metadata);
  assert.equal(prepared.original.source_sha256, createHash('sha256').update(prepared.bytes).digest('hex'));
  assert.equal(prepared.original.source_size, prepared.bytes.length);
  assert.equal(prepared.payloadHash, await applicationCreationOriginalHash(prepared.original));
  assert.deepEqual(prepared.original.fields_supplied, Object.keys(input().fields).sort());
});
test('the complete envelope fits exactly at 16 MiB and overflow fails before dispatch', async () => {
  const prepared = await prepareApplicationCreation(input());
  const raw = new Uint8Array(MAX_APPLICATION_CREATION_BYTES).fill(32); raw.set(prepared.bytes);
  assert.equal((await prepareApplicationCreationSource(raw)).original.source_size, MAX_APPLICATION_CREATION_BYTES);
  await assert.rejects(prepareApplicationCreationSource(new Uint8Array(MAX_APPLICATION_CREATION_BYTES + 1)));
  const large = input(); large.fields.job_details = { description: 'x'.repeat(MAX_APPLICATION_CREATION_BYTES) };
  await assert.rejects(prepareApplicationCreation(large));
});
test('invalid local intent never dispatches', async () => {
  let calls = 0;
  const sdk = client(async () => { calls++; throw Error('Should not dispatch'); });
  for (const fields of [{ title: '', company_name: 'Synthetic' }, { title: 'Synthetic', company_name: 'Synthetic', job_details: [] },
    { title: 'Synthetic', company_name: 'Synthetic', resume_overrides: { bad: NaN } },
    { title: 'Synthetic', company_name: 'Synthetic', contacts: ['not an object'] },
    { title: 'Synthetic', company_name: 'Synthetic', unsupported: true }]) {
    await assert.rejects(sdk.applicationCreations.create({ ...input(), fields } as ApplicationCreationInput));
  }
  await assert.rejects(sdk.applicationCreations.create({ ...input(), metadata: { import_confirmed: 'true' } } as unknown as ApplicationCreationInput));
  assert.equal(calls, 0);
});
test('SDK sends one compact creation and independently checks IDs without putting private source in the URL', async () => {
  const prepared = await prepareApplicationCreation(input()); let posts = 0, gets = 0;
  const sdk = client(async (url, init) => {
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    if (init?.method === 'POST') {
      posts++; assert.equal(new URL(String(url)).search, '?return=creation-receipt');
      assert.deepEqual(JSON.parse(String(init.body)), prepared.body);
      return Response.json(await response(), { status: 201 });
    }
    gets++; assert.equal(new URL(String(url)).pathname, '/api/v1/journey/get_application_creation_original_v1');
    assert.ok(!String(url).includes('Synthetic'));
    assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), prepared.original);
    return Response.json({ outcome: 'ready', data: { request_id: requestId, application_id: applicationId,
      revision: 1, payload_hash: prepared.payloadHash }, next_action: { kind: 'none', label: '' } });
  });
  assert.equal((await sdk.applicationCreations.create(input())).operation.result.resource_id, applicationId);
  assert.equal((await sdk.applicationCreations.check(prepared.original)).revision, 1);
  assert.equal(posts, 1); assert.equal(gets, 1);
});
test('lost or substituted acknowledgements never trigger another write', async () => {
  for (const issue of ['lost', 'hash', 'source', 'id', 'revision', 'operation']) {
    let calls = 0;
    const sdk = client(async () => {
      calls++; if (issue === 'lost') throw Error('Synthetic lost response');
      const value = await response();
      if (issue === 'hash') value.application_creation.payload_hash = '0'.repeat(64);
      if (issue === 'source') value.application_creation.source_size++;
      if (issue === 'id') value.operation.result.resource_id = requestId;
      if (issue === 'revision') value.operation.result.revision = 2;
      if (issue === 'operation') value.operation.kind = 'unrelated' as typeof APPLICATION_CREATION_OPERATION;
      return Response.json(value);
    });
    await assert.rejects(sdk.applicationCreations.create(input())); assert.equal(calls, 1);
  }
});
test('CLI closure requires the captured application identity and preserves recorded outcome', async () => {
  const prepared = await prepareApplicationCreation(input()); let calls = 0;
  const sdk = client(async (url, init) => {
    calls++; if (String(url).includes('/api/v1/applications')) return Response.json(await response(), { status: 201 });
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/close_application_creation_original_v1');
    assert.deepEqual(JSON.parse(String(init?.body)), { ...prepared.original, confirm_close: true });
    return Response.json({ outcome: 'ready', data: { request_id: requestId, application_id: applicationId,
      payload_hash: prepared.payloadHash, outcome: 'recorded', recorded_resource_id: applicationId }, next_action: { kind: 'none', label: '' } });
  });
  await applicationCreationCommand('applications create-native', { file: '-' }, sdk, Readable.from([JSON.stringify(input())]));
  await assert.rejects(applicationCreationCommand('applications close-creation', { file: '-', confirm: requestId }, sdk,
    Readable.from([JSON.stringify(prepared.original)])), /confirmation_required/u);
  assert.equal(calls, 1);
  const closed = await applicationCreationCommand('applications close-creation', { file: '-', confirm: applicationId }, sdk,
    Readable.from([JSON.stringify(input())]));
  assert.ok('recorded_resource_id' in closed); assert.equal(closed.recorded_resource_id, applicationId);
  assert.equal(calls, 2);
});
test('raw originals keep trailing whitespace and large native integers across SDK and CLI', async () => {
  const prepared = await prepareApplicationCreation(input());
  const raw = new TextEncoder().encode(JSON.stringify(prepared.body).replace('"Synthetic café 😀"', '900719925474099312345678901234567890') + '\n  ');
  const source = await prepareApplicationCreationSource(raw); let calls = 0;
  const sdk = client(async (_url, init) => {
    calls++; assert.ok(init?.body instanceof Uint8Array); assert.deepEqual(init.body, raw);
    return Response.json({ ok: true, operation: receipt(), application_creation: { request_id: requestId,
      payload_hash: source.payloadHash, source_size: raw.length, source_sha256: source.original.source_sha256 } }, { status: 201 });
  });
  const mutable = new Uint8Array(raw), pending = sdk.applicationCreations.createSource(mutable); mutable.fill(0); await pending;
  await applicationCreationCommand('applications create-native', { file: '-' }, sdk, Readable.from([raw]));
  assert.equal(calls, 2);
});

test('automatic import identity comes from the stored capture, with omitted original attributes retained', async () => {
  const plan: ApplicationCreationInput = { ...input(), fields: {}, metadata: { import_attempt_id: requestId } };
  const prepared = await prepareApplicationCreation(plan);
  assert.deepEqual(prepared.original.fields_supplied, []);
  assert.deepEqual((prepared.body.data as {attributes: unknown}).attributes, {});
  assert.deepEqual((await prepareApplicationCreationSource(prepared.bytes)).original, prepared.original);
  await assert.rejects(prepareApplicationCreation({ ...plan, metadata: { import_attempt_id: requestId, import_confirmed: true } }));
});


test('an in-flight original check stays bound to its captured descriptor', async () => {
  const prepared = await prepareApplicationCreation(input());
  const captured = structuredClone(prepared.original);
  const sdk = client(async (url) => {
    assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), captured);
    prepared.original.request_id = applicationId;
    prepared.original.source_sha256 = '0'.repeat(64);
    prepared.original.fields_supplied.length = 0;
    return Response.json({ outcome: 'ready', data: { request_id: requestId, application_id: applicationId,
      revision: 1, payload_hash: prepared.payloadHash }, next_action: { kind: 'none', label: '' } });
  });
  assert.equal((await sdk.applicationCreations.check(prepared.original)).application_id, applicationId);
});
