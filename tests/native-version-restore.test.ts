import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';
const documentId = '11111111-1111-4111-8111-111111111111', requestId = '22222222-2222-4222-8222-222222222222';
const input = { document_id: documentId, version_id: requestId, request_id: requestId, expected_revision: 3 };
const data = { id: documentId, kind: 'document', label: 'Restored document', revision: 4 };
const ready = () => ({ outcome: 'ready', data, revision: 4, next_action: { kind: 'none', label: 'Saved' },
  operation: { id: requestId, kind: 'restore_document_revision', status: 'succeeded', resource: data,
    retry_after_seconds: 0, retry_expires_at: '2030-01-01T00:00:00Z' } });

test('native restore shares the captured canonical original and returns an exact content-minimal recorded revision', async () => {
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_native_restore' }, fetchImpl: async (url, init) => {
    calls++; assert.equal(new URL(String(url)).pathname, '/api/v1/journey/restore_document_snapshot_v1');
    assert.equal(init?.method, 'POST'); assert.deepEqual(JSON.parse(String(init?.body)), input);
    return Response.json(ready());
  } });
  const response = await client.restoreDocumentSnapshot(input);
  assert.equal(response.data?.revision, 4); assert.equal(calls, 1);
  assert.equal('content' in response.data!, false); assert.equal('sections' in response.data!, false);
});

for (const change of ['document', 'revision', 'operation', 'resource', 'missing']) {
  test(`native restore rejects a mismatched ${change} response`, async () => {
    const value = ready();
    if (change === 'document') value.data = { ...data, id: requestId };
    if (change === 'revision') value.data = { ...data, revision: 5 };
    if (change === 'operation') value.operation = { ...value.operation, kind: 'create_document_checkpoint_v2' };
    if (change === 'resource') value.operation = { ...value.operation, resource: { ...data, id: requestId } };
    if (change === 'missing') delete (value as Partial<typeof value>).operation;
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_native_restore' },
      fetchImpl: async () => Response.json(value) });
    await assert.rejects(client.restoreDocumentSnapshot(input), /invalid_response/);
  });
}

test('CLI native restore requires exact document confirmation before a write and omits private content', async () => {
  let calls = 0;
  for (const confirmation of [undefined, 'other', documentId]) {
    let stdout = '', stderr = '';
    const code = await runCLI(['documents', 'restore-snapshot', '--file', '-', '--json',
      ...(confirmation ? ['--confirm', confirmation] : [])], {
      env: { JOBHUNT_TOKEN: 'synthetic_native_restore' }, stdin: Readable.from([JSON.stringify(input)]),
      stdout: new Writable({ write(value, _encoding, next) { stdout += value; next(); } }),
      stderr: new Writable({ write(value, _encoding, next) { stderr += value; next(); } }),
      fetchImpl: async (url, init) => { calls++; assert.equal(new URL(String(url)).pathname, '/api/v1/journey/restore_document_snapshot_v1');
        assert.deepEqual(JSON.parse(String(init?.body)), input); return Response.json(ready()); },
    }, 'test');
    if (confirmation === documentId) { assert.equal(code, 0); assert.equal(stderr, ''); assert.equal(JSON.parse(stdout).data.revision, 4); }
    else { assert.equal(code, 2); assert.equal(stdout, ''); assert.equal(calls, 0); assert.equal(JSON.parse(stderr).error.code, 'confirmation_required'); }
  }
  assert.equal(calls, 1);
});
