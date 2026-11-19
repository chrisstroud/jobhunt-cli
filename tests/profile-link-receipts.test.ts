import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { captureProfileLink, prepareProfileLink, profileLinkReceipt, type ProfileLink } from '../client/src/index.ts';
const input: ProfileLink = { request_id: 'ABCDEFAB-1234-4234-8234-123456789ABC', expected_account_id: 'jh_33333333-3333-4333-8333-333333333333',
  document_id: 'abcdefab-1111-4111-8111-111111111111', profile_id: 'abcdefab-2222-4222-8222-222222222222', expected_revision: 4,
  expected_profile_updated_at: '2026-10-24T12:00:00.123456', acknowledge_linked_updates: true };
const receipt = () => {
  const operation = { id: input.request_id.toLowerCase(), kind: 'link_document_package_profile_v2', status: 'succeeded',
    resource: { id: input.document_id, kind: 'document', label: 'Saved document', revision: 5 }, retry_after_seconds: 0,
    retry_expires_at: '2026-10-25T12:00:00Z', error: null };
  return { outcome: 'ready', data: operation, operation, next_action: { kind: 'none', label: '' } };
};
test('binding capture precedes hashing and preserves original resource spelling and null/omission semantics', async () => {
  const mutable = { ...input }, pending = prepareProfileLink(mutable);
  mutable.profile_id = input.document_id; mutable.expected_revision = 99;
  const { captured, read } = await pending;
  assert.deepEqual(captured, { ...input, request_id: input.request_id.toLowerCase() });
  const expected = createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(captured).sort(([a], [b]) => a < b ? -1 : 1)))).digest('hex');
  assert.equal(read.expected_payload_hash, expected); assert.equal(read.expected_account_id, input.expected_account_id);
  assert.equal(read.operation_name, 'link_document_package_profile_v2');
  const upper = { ...input, document_id: input.document_id.toUpperCase(), profile_id: input.profile_id.toUpperCase() };
  const prepared = await prepareProfileLink(upper);
  assert.equal(prepared.captured.document_id, upper.document_id); assert.equal(prepared.captured.profile_id, upper.profile_id);
  assert.notEqual(prepared.read.expected_payload_hash, expected);
  assert.equal(profileLinkReceipt(receipt(), upper).documentId, input.document_id);
  const omitted = { ...input }; delete omitted.expected_account_id;
  assert.notEqual((await prepareProfileLink(omitted)).read.expected_payload_hash, (await prepareProfileLink({ ...omitted, expected_account_id: null })).read.expected_payload_hash);
  assert.equal(Object.hasOwn((await prepareProfileLink(omitted)).read, 'expected_account_id'), false);
});
test('binding receipt requires a successful document result newer than the reviewed revision', () => {
  assert.equal(profileLinkReceipt(receipt(), input).revision, 5);
  for (const fault of ['kind', 'resource', 'revision', 'pending', 'error', 'retry']) {
    const value = receipt();
    if (fault === 'kind') value.data.kind = 'save_hunt_profile_v2';
    if (fault === 'resource') value.data.resource.kind = 'profile';
    if (fault === 'revision') value.data.resource.revision = 4;
    if (fault === 'pending') value.data.status = 'pending';
    if (fault === 'error') (value.data as unknown as { error: unknown }).error = { code: 'processing_failed', message: 'Not saved' };
    if (fault === 'retry') value.data.retry_after_seconds = 1;
    assert.throws(() => profileLinkReceipt(value, input), /invalid_response/);
  }
  assert.throws(() => captureProfileLink({ ...input, unknown: true }), /invalid_input/);
});
