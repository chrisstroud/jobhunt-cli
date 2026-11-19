import assert from 'node:assert/strict';
import test from 'node:test';
import { JobHuntClient, JobHuntError } from '../client/src/index.ts';
import { compensationBytes, compensationRequestId } from '../client/src/compensation-contracts.ts';

const application = '11111111-1111-4111-8111-111111111111';
const account = 'jh_22222222-2222-4222-8222-222222222222';
const bytes = new TextEncoder().encode('{"salary_min":0}');
const hash = async (data: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(data))), b => b.toString(16).padStart(2, '0')).join('');
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });

test('complete compensation download rejects mixed source, invalid encoding and checksum corruption', async () => {
  const sha256 = await hash(bytes);
  const view = { account_id: account, application_id: application, revision: 1, size_bytes: bytes.length,
    sha256, chunk_bytes: 24000, chunk_count: 1, filename: `compensation-${application}.json`, mime: 'application/json' };
  const chunk = { ...view, chunk_index: 1, base64: btoa(new TextDecoder().decode(bytes)), chunk_sha256: sha256 };
  for (const patch of [{}, { account_id: 'jh_33333333-3333-4333-8333-333333333333' },
    { revision: 2 }, { chunk_sha256: 'a'.repeat(64) }, { base64: '====' }, { base64: 'YWJj' }]) {
    let calls = 0;
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'jsk_test_' + 's'.repeat(32) },
      fetchImpl: (async () => new Response(JSON.stringify(ready(calls++ === 0 ? view : { ...chunk, ...patch })),
        { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch });
    if (!Object.keys(patch).length) assert.deepEqual((await client.downloadApplicationCompensation({ application_id: application })).bytes, bytes);
    else await assert.rejects(client.downloadApplicationCompensation({ application_id: application }), JobHuntError);
  }
});

test('base64 canonical form and stable child intents reject ambiguous input', async () => {
  for (const invalid of ['YWJj\n', 'AB==', '=YWJj', '']) assert.throws(() => compensationBytes(invalid), JobHuntError);
  assert.equal(await compensationRequestId(application, 'chunk:1'), await compensationRequestId(application, 'chunk:1'));
  assert.notEqual(await compensationRequestId(application, 'chunk:1'), await compensationRequestId(application, 'commit'));
});
