import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { templateWriteInput, templateRemoveInput, templateReorderInput } from '../client/src/stage-template-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const stage = '33333333-3333-4333-8333-333333333333';
const account = 'jh_' + id;
const intent = { request_id: '22222222-2222-4222-8222-222222222222', expected_account_id: account,
  template_id: id, expected_fingerprint: 'a'.repeat(64) };
const template = { account_id: account, template_id: id, stage_id: stage, detached: false,
  title: 'Synthetic template', description: null, revision: 1, fingerprint: intent.expected_fingerprint,
  sort_order: 0, due_days_offset: null, auto_complete_on_forward: false, stage_automation_retired: true,
  assignments: { pending: 1, completed: 1, skipped: 0, unknown: 0 } };
const page = { account_id: account, items: [template], page: 1, has_more: false, stage_fingerprint: 'b'.repeat(64) };
const result = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });

test('template commands preserve reviewed intents over cookie-free HTTP', async () => {
  const cases = [
    { args: ['list', '--stage-id', stage, '--include-detached'], name: 'list_stage_task_templates_v2', data: page, input: undefined },
    { args: ['get', id], name: 'get_stage_task_template_v2', data: template, input: undefined },
    { args: ['update', '--file', '-'], name: 'update_stage_task_template_v2', data: { account_id: account, template_id: id, current: template }, input: { ...intent, patch: { title: 'Changed' } } },
    { args: ['remove', '--file', '-', '--confirm', id], name: 'remove_stage_task_template_v2', data: { account_id: account, template_id: id, current: null, disposition: 'remove_assignments' }, input: { ...intent, disposition: 'remove_assignments', confirmed: true } },
    { args: ['reorder', '--file', '-'], name: 'reorder_stage_task_templates_v2', data: page, input: { request_id: intent.request_id, stage_id: stage, expected_fingerprint: page.stage_fingerprint, template_ids: [id] } },
  ];
  for (const item of cases) {
    let stdout = '', stderr = '', calls = 0;
    const status = await runCLI(['stage-templates', ...item.args, '--json'], {
      env: { JOBHUNT_TOKEN: 'synthetic-template' }, stdin: Readable.from([JSON.stringify(item.input ?? {})]),
      stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
      fetchImpl: async (url, init) => {
        calls++;
        assert.equal(new URL(String(url)).pathname, '/api/v1/journey/' + item.name);
        assert.equal(init?.credentials, 'omit');
        assert.equal(init?.method, item.input ? 'POST' : 'GET');
        if (item.input) assert.deepEqual(JSON.parse(String(init?.body)), item.input);
        else if (item.args[0] === 'list') assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!),
          { page: 1, stage_id: stage, include_detached: true });
        return Response.json(result(item.data));
      },
    }, 'test');
    assert.equal(status, 0); assert.equal(stderr, ''); assert.equal(calls, 1);
    assert.deepEqual(JSON.parse(stdout).data, item.data);
  }
});

test('template removal requires both a server disposition and a matching CLI confirmation', async () => {
  let calls = 0;
  for (const extra of [[], ['--confirm', stage]]) {
    const status = await runCLI(['stage-templates', 'remove', '--file', '-', '--json', ...extra], {
      env: { JOBHUNT_TOKEN: 'synthetic-template' }, stdin: Readable.from([JSON.stringify({ ...intent, confirmed: true, disposition: 'preserve_assignments' })]),
      stdout: new Writable({ write(_chunk, _encoding, next) { assert.fail('No success output'); next(); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { assert.equal(JSON.parse(String(chunk)).error.code, 'confirmation_required'); next(); } }),
      fetchImpl: async () => { calls++; return Response.json(result(null)); },
    }, 'test');
    assert.equal(status, 2);
  }
  assert.equal(calls, 0);
  for (const change of [{ confirmed: 1 }, { confirmed: false }, { disposition: 'auto' }, { expected_fingerprint: '' }]) {
    assert.throws(() => templateRemoveInput({ ...intent, confirmed: true, disposition: 'preserve_assignments', ...change }), /invalid_input/);
  }
});

test('template patches and ordering reject invalid data before transport', () => {
  assert.deepEqual(templateWriteInput({ ...intent, patch: { description: null, due_days_offset: null } }).patch,
    { description: null, due_days_offset: null });
  for (const patch of [{}, { title: null }, { title: ' ' }, { title: 'a\0b' }, { description: 4 },
    { sort_order: -1 }, { sort_order: true }, { due_days_offset: 3651 }, { auto_complete_on_forward: 'true' }, { is_stage_template: false }]) {
    assert.throws(() => templateWriteInput({ ...intent, patch }), /invalid_input/);
  }
  for (const template_ids of [[id, id], ['foreign'], Array(501).fill(id)]) {
    assert.throws(() => templateReorderInput({ request_id: intent.request_id, stage_id: stage,
      expected_fingerprint: 'b'.repeat(64), template_ids }), /invalid_input/);
  }
});

test('template client rejects foreign or malformed returned state', async () => {
  let response: unknown = result(template), calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-template' },
    fetchImpl: async () => { calls++; return Response.json(response); } });
  await assert.rejects(client.getStageTemplate('bad-id'), /invalid_input/);
  assert.equal(calls, 0);
  for (const invalid of [{ ...template, detached: true }, { ...template, assignments: {} },
    { ...template, fingerprint: '' }, { ...template, stage_automation_retired: false }]) {
    response = result(invalid);
    await assert.rejects(client.getStageTemplate(id), /invalid_response/);
  }
  response = result({ account_id: account, template_id: stage, current: template });
  await assert.rejects(client.updateStageTemplate({ ...intent, patch: { title: 'Changed' } }), /invalid_response/);
});
