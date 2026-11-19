import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { taskHistoryInput, taskSkipInput } from '../client/src/task-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const entry = { id: requestId, date: '2026-10-19', status: 'skipped', recorded_at: '2026-10-19T12:00:00Z' };
const history = { task_id: id, revision: 2, items: [entry], has_more: true, next_before_date: entry.date };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });

test('history CLI sends a bounded exclusive date cursor and preserves recorded statuses', async () => {
  let stdout = '', stderr = '';
  const code = await runCLI(['tasks', 'history', id, '--limit', '1', '--before-date', '2026-10-20', '--json'], {
    env: { JOBHUNT_TOKEN: 'synthetic-task-history' }, stdin: Readable.from([]),
    stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
    stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
    fetchImpl: async (url, init) => {
      const target = new URL(String(url));
      assert.equal(target.pathname, '/api/v1/journey/get_task_history_v2');
      assert.deepEqual(JSON.parse(target.searchParams.get('arguments')!), { task_id: id, limit: 1, before_date: '2026-10-20' });
      assert.equal(init?.credentials, 'omit');
      return Response.json(ready(history));
    },
  }, 'test');
  assert.equal(code, 0); assert.equal(stderr, ''); assert.deepEqual(JSON.parse(stdout).data, history);
});

test('history and skip inputs reject invalid cursors, dates, limits and incomplete review intents', () => {
  const skip = { task_id: id, request_id: requestId, expected_revision: 1, expected_fingerprint: 'a'.repeat(64), occurrence_date: '2026-11-01' };
  assert.deepEqual(taskSkipInput(skip), skip); // A future skip is an explicit schedule exception.
  for (const input of [{ ...skip, expected_revision: 0 }, { ...skip, expected_fingerprint: '' },
    { ...skip, occurrence_date: '2026-02-30' }, { ...skip, completed: true }]) assert.throws(() => taskSkipInput(input), /invalid_input/);
  for (const input of [{ task_id: id, limit: 101 }, { task_id: id, limit: 0 }, { task_id: id, before_date: 'bad' }])
    assert.throws(() => taskHistoryInput(input), /invalid_input/);
});

test('history refuses inconsistent continuation and preserves explicit unknown legacy state', async () => {
  let data: unknown = { ...history, items: [{ ...entry, status: 'unknown' }] };
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-task-history' },
    fetchImpl: async () => Response.json(ready(data)) });
  assert.equal((await client.taskHistory({ task_id: id })).data?.items[0].status, 'unknown');
  for (const invalid of [{ ...history, next_before_date: null }, { ...history, items: [] },
    { ...history, items: [{ ...entry, status: 'invented' }] }, { ...history, has_more: false }]) {
    data = invalid;
    await assert.rejects(client.taskHistory({ task_id: id }), /invalid_response/);
  }
});
