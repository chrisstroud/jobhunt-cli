import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, type HuntSelectionSave } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';
const id = '11111111-1111-4111-8111-111111111111', target = '22222222-2222-4222-8222-222222222222';
const input: HuntSelectionSave = { request_id: target, expected_account_id: 'jh_' + id, expected_fingerprint: 'a'.repeat(64),
  selection: { version: 1, view: 'all', activeIds: ['synthetic-hunt'] }, selected_hunt_ids: [target] };
const data = { account_id: 'jh_' + id, selection: input.selection, fingerprint: 'b'.repeat(64), hunts: [{ id: target, slug: 'synthetic-hunt', name: 'Synthetic Hunt' }] };
const operation = { id: target, status: 'succeeded', kind: 'save_hunt_selection_v2', resource: { id, kind: 'profile', label: 'Pipeline view', revision: null }, retry_after_seconds: 0, retry_expires_at: '2026-11-01T00:00:00Z' };
const reply = (value: unknown = data, receipt: unknown = operation) => Response.json({ outcome: 'ready', data: value,
  next_action: { kind: 'none', label: '' }, ...(receipt ? { operation: receipt } : {}) });
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-selection-credential' }, fetchImpl });
test('selection client requires the original account and exact identity mapping before I/O', async () => {
  let calls = 0;
  const api = client(async () => { calls++; return reply(); });
  for (const patch of [{ expected_account_id: null }, { expected_account_id: undefined }, { expected_fingerprint: '' },
    { selected_hunt_ids: [] }, { selected_hunt_ids: ['bad'] }, { selection: { ...input.selection, view: 'other' } },
    { selection: { ...input.selection, activeIds: ['one', 'one'] }, selected_hunt_ids: [target, target] }, { unexpected: true }])
    await assert.rejects(api.saveHuntSelection({ ...input, ...patch } as HuntSelectionSave), /invalid_input/);
  assert.equal(calls, 0);
});
test('selection client preserves exact retries and permits fresh current state on a historical receipt', async () => {
  const bodies: unknown[] = [];
  const api = client(async (url, init) => { assert.ok(String(url).endsWith('/save_hunt_selection_v2'));
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error'); bodies.push(JSON.parse(String(init?.body)));
    return reply({ ...data, selection: { ...input.selection, activeIds: [] } }); });
  await api.saveHuntSelection(input); await api.saveHuntSelection(input); assert.deepEqual(bodies, [input, input]);
});
test('selection client refuses wrong account, operation, owner receipt and duplicate choices', async () => {
  for (const [value, receipt] of [[{ ...data, account_id: 'jh_' + target }, operation],
    [data, { ...operation, kind: 'other' }], [data, { ...operation, resource: { ...operation.resource, id: target } }],
    [{ ...data, hunts: [...data.hunts, ...data.hunts] }, operation]])
    await assert.rejects(client(async () => reply(value, receipt)).saveHuntSelection(input), /invalid_response/);
});
test('selection CLI reads and saves via public HTTP without cookies or UI dependencies', async () => {
  for (const write of [false, true]) {
    let calls = 0, out = '';
    const code = await runCLI(['hunts', write ? 'selection-save' : 'selection', ...(write ? ['--file', '-'] : []), '--json'], {
      env: { JOBHUNT_TOKEN: 'synthetic-selection-credential' }, stdin: Readable.from(write ? [JSON.stringify(input)] : []),
      stdout: new Writable({ write(c, _e, next) { out += c; next(); } }), stderr: new Writable({ write(_c, _e, next) { next(); } }),
      fetchImpl: async (url, init) => { calls++; assert.equal(init?.credentials, 'omit');
        assert.ok(String(url).endsWith(write ? '/save_hunt_selection_v2' : '/get_hunt_selection_v2'));
        if (write) assert.deepEqual(JSON.parse(String(init?.body)), input); return reply(data, write ? operation : null); },
    }, 'test');
    assert.equal(code, 0); assert.equal(calls, 1); assert.deepEqual(JSON.parse(out).data, data);
  }
});

test('selection revision metadata is additive for older readers and rejects invalid supplied revisions', async () => {
  for (const revision of [undefined, null, 1]) {
    const result = await client(async () => reply({ ...data, hunts: [{ ...data.hunts[0], revision }] }, null)).getHuntSelection();
    assert.equal(result.data?.hunts[0].revision, revision);
  }
  for (const revision of [0, -1, true, '1'])
    await assert.rejects(client(async () => reply({ ...data, hunts: [{ ...data.hunts[0], revision }] }, null)).getHuntSelection(), /invalid_response/);
});
