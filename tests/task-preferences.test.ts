import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { taskPreferencesInput } from '../client/src/task-preferences-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const account = 'jh_11111111-1111-4111-8111-111111111111';
const intent = { request_id: '22222222-2222-4222-8222-222222222222', expected_account_id: account,
  expected_fingerprint: 'a'.repeat(64), patch: { hide_completed_tasks: true } };
const data = { account_id: account, fingerprint: 'b'.repeat(64), stage_automation_retired: true,
  settings: { default_due_time: '17:00', default_jbr_recurrence: 'daily', snooze_options: [60],
    hide_completed_tasks: true, section_order: ['quick'] } };
const result = { outcome: 'ready', data, next_action: { kind: 'none', label: '' } };

test('task settings CLI preserves reviewed intents through cookie-free HTTP', async () => {
  for (const command of ['get', 'update']) {
    let stdout = '', stderr = '', calls = 0;
    const code = await runCLI(['task-settings', command, '--json', ...(command === 'update' ? ['--file', '-'] : [])], {
      env: { JOBHUNT_TOKEN: 'synthetic-preferences' }, stdin: Readable.from([JSON.stringify(intent)]),
      stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
      fetchImpl: async (url, init) => {
        calls++;
        assert.equal(String(url), `https://jobhunt.app/api/v1/journey/${command}_task_settings_v2`);
        assert.equal(init?.credentials, 'omit');
        assert.equal(init?.method, command === 'get' ? 'GET' : 'POST');
        if (command === 'update') assert.deepEqual(JSON.parse(String(init?.body)), intent);
        return Response.json(result);
      },
    }, 'test');
    assert.equal(code, 0); assert.equal(stderr, ''); assert.equal(calls, 1);
    assert.deepEqual(JSON.parse(stdout).data, data);
  }
});

test('task preference input requires a nonempty bounded patch and preserves explicit resets', () => {
  for (const patch of [{ hide_completed_tasks: true }, { default_due_time: null }, { snooze_options: [], section_order: [] }]) {
    assert.deepEqual(taskPreferencesInput({ ...intent, patch }), { ...intent, patch });
  }
  for (const patch of [{}, { default_due_time: '25:00' }, { default_due_time: '9:00' },
    { default_due_time: '09:00:00' }, { default_due_time: '0\u0660:0\u0660' }, { hide_completed_tasks: 1 }, { hide_completed_tasks: null },
    { snooze_options: [true] }, { snooze_options: [0] }, { snooze_options: Array(51).fill(1) },
    { section_order: ['quick', 'quick'] }, { section_order: ['foreign'] },
    { default_jbr_recurrence: null }, { auto_complete_pipeline_on_forward: true }]) {
    assert.throws(() => taskPreferencesInput({ ...intent, patch }), /invalid_input/);
  }
  assert.throws(() => taskPreferencesInput({ ...intent, expected_fingerprint: '' }), /invalid_input/);
});

test('task preferences reject malformed success responses and invalid writes before network access', async () => {
  let calls = 0, response: unknown = result;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-preferences' },
    fetchImpl: async () => { calls++; return Response.json(response); } });
  await assert.rejects(client.updateTaskSettings({ ...intent, expected_fingerprint: '' }), /invalid_input/);
  assert.equal(calls, 0);
  for (const invalid of [{ ...data, account_id: 'jh_foreign' }, { ...data, fingerprint: '' },
    { ...data, stage_automation_retired: false }, { ...data, settings: {} },
    { ...data, settings: { ...data.settings, hide_completed_tasks: 'yes' } }]) {
    response = { ...result, data: invalid };
    await assert.rejects(client.getTaskSettings(), /invalid_response/);
  }
});
