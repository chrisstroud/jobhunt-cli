import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const intent = { task_id: id, request_id: '22222222-2222-4222-8222-222222222222', expected_revision: 2 };
const result = { outcome: 'ready', data: { id, deleted: true, calendar_cleanup: 'pending' }, next_action: { kind: 'none', label: 'Saved' } };

test('task delete requires exact confirmation before HTTP and preserves cleanup status', async () => {
  let calls = 0;
  for (const confirm of [undefined, 'other-task', id]) {
    let stdout = '', stderr = '';
    const code = await runCLI(['tasks', 'delete', '--file', '-', '--json', ...(confirm ? ['--confirm', confirm] : [])], {
      env: { JOBHUNT_TOKEN: 'synthetic-task-delete' }, stdin: Readable.from([JSON.stringify(intent)]),
      stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
      fetchImpl: async (url, init) => {
        calls++;
        assert.equal(new URL(String(url)).pathname, '/api/v1/journey/delete_task_v2');
        assert.deepEqual(JSON.parse(String(init?.body)), intent);
        return Response.json(result);
      },
    }, 'test');
    assert.equal(code, confirm === id ? 0 : 2);
    if (confirm === id) assert.equal(JSON.parse(stdout).data.calendar_cleanup, 'pending');
    else { assert.equal(calls, 0); assert.equal(JSON.parse(stderr).error.code, 'confirmation_required'); }
  }
  assert.equal(calls, 1);
});

test('task delete validates the revision, intent and deleted response', async () => {
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-task-delete' },
    fetchImpl: async () => { calls++; return Response.json({ ...result, data: { id, deleted: false } }); } });
  await assert.rejects(client.deleteTask({ ...intent, expected_revision: 0 }), /invalid_input/);
  await assert.rejects(client.deleteTask({ ...intent, request_id: '' }), /invalid_input/);
  assert.equal(calls, 0);
  await assert.rejects(client.deleteTask(intent), /invalid_response/);
});
