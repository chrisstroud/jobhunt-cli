import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, type PipelineStageCreate } from '../client/src/index.ts';
import { pipelineWriteInput } from '../client/src/pipeline-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';
const id = '11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222';
const record = { id, name: 'Synthetic stage', position: 0, stage_type: 'custom', is_terminal: false, is_system: false,
  application_count: 0, task_count: 0, assignment_count: 0 };
const base = { account_id: 'jh_' + id, fingerprint: 'a'.repeat(64), stage_automation_retired: true };
const page = { ...base, items: [record], total: 1, page: 1, has_more: false };
const state = { ...base, stage_id: id, current: record };
const ready = (d: unknown) => ({ outcome: 'ready', data: d, next_action: { kind: 'none', label: '' } });
const intent: PipelineStageCreate = { request_id: request, expected_account_id: base.account_id, expected_fingerprint: base.fingerprint,
  name: record.name, position: 0 };
const token = 'synthetic-pipeline';
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });

test('pipeline changes reject unsupported policy fields and malformed input before I/O', async () => {
  let calls = 0; const api = client(async () => { calls++; return Response.json(ready(state)); });
  for (const patch of [{ name: ' ' }, { name: 'x'.repeat(101) }, { name: 'x\0' }, { position: true }, { position: -1 },
    { expected_fingerprint: '' }, { request_id: 'invalid' }, { stage_type: 'applied' }, { is_system: true }, { unexpected: true }])
    await assert.rejects(api.createPipelineStage({ ...intent, ...patch } as PipelineStageCreate), /invalid_input/);
  assert.throws(() => pipelineWriteInput({ request_id: request, expected_fingerprint: base.fingerprint, stage_id: id, migrate_to_id: id.toUpperCase() }, 'remove'), /invalid_input/);
  await assert.rejects(api.getPipelineConfiguration({ page: 0 }), /invalid_input/);
  assert.equal(calls, 0);
});

test('pipeline writes preserve reviewed intent, exact retries and cookie-free requests', async () => {
  const bodies: unknown[] = [];
  const api = client(async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/create_pipeline_stage_v2');
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    bodies.push(JSON.parse(String(init?.body))); return Response.json(ready(state));
  });
  await api.createPipelineStage(intent); await api.createPipelineStage(intent);
  assert.deepEqual(bodies, [intent, intent]);
});

test('pipeline reads reject hidden pagination errors and invalid stage state', async () => {
  assert.deepEqual((await client(async () => Response.json(ready(page))).getPipelineConfiguration()).data, page);
  for (const patch of [{ page: 2 }, { total: 26 }, { items: Array(26).fill(record) }, { stage_automation_retired: false },
    { items: [{ ...record, task_count: -1 }] }, { fingerprint: '' }])
    await assert.rejects(client(async () => Response.json(ready({ ...page, ...patch }))).getPipelineConfiguration(), /invalid_response/);
  const value = { request_id: request, expected_fingerprint: base.fingerprint, stage_id: id, position: 1 };
  await assert.rejects(client(async () => Response.json(ready({ ...state, stage_id: request }))).reorderPipelineStage(value), /invalid_response/);
  assert.equal((await client(async () => Response.json(ready({ ...state, current: null }))).removePipelineStage({ request_id: request, expected_fingerprint: base.fingerprint, stage_id: id })).data?.current, null);
});

test('stage removal CLI requires the exact target confirmation before HTTP', async () => {
  const value = { request_id: request, expected_fingerprint: base.fingerprint, stage_id: id, migrate_to_id: null };
  let calls = 0, error = '';
  const code = await runCLI(['pipeline', 'remove-stage', '--file', '-', '--json'], {
    env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(value)]),
    stdout: new Writable({ write(_c, _e, next) { next(); } }),
    stderr: new Writable({ write(c, _e, next) { error += c; next(); } }),
    fetchImpl: async () => { calls++; return Response.json(ready(state)); },
  }, 'test');
  assert.equal(code, 2); assert.equal(calls, 0); assert.equal(JSON.parse(error).error.code, 'confirmation_required');
});

test('five domain CLI commands route to typed pipeline endpoints', async () => {
  for (const action of ['get', 'create-stage', 'rename-stage', 'reorder-stage', 'remove-stage']) {
    const common = { request_id: request, expected_fingerprint: base.fingerprint };
    const value = { ...common, ...(action === 'create-stage' ? { name: 'Synthetic', position: 0 } :
      { stage_id: id, ...(action === 'rename-stage' ? { name: 'Synthetic' } : action === 'reorder-stage' ? { position: 0 } : {}) }) };
    let calls = 0;
    const code = await runCLI(['pipeline', action, '--json', ...(action !== 'get' ? ['--file', '-'] : []), ...(action === 'remove-stage' ? ['--confirm', id] : [])], {
      env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(value)]),
      stdout: new Writable({ write(_c, _e, next) { next(); } }), stderr: new Writable({ write(_c, _e, next) { next(); } }),
      fetchImpl: async (url, init) => {
        calls++; assert.equal(init?.credentials, 'omit');
        assert.equal(new URL(String(url)).pathname, '/api/v1/journey/' + (action === 'get' ? 'get_pipeline_configuration_v2' : action.split('-')[0] + '_pipeline_stage_v2'));
        return Response.json(ready(action === 'get' ? page : state));
      },
    }, 'test');
    assert.equal(code, 0); assert.equal(calls, 1);
  }
});
