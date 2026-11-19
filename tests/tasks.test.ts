import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JobHuntClient } from '../client/src/index.ts';
import { taskDate } from '../client/src/task-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';
import { inputJSON } from '../cli/src/input.ts';
const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const token = 'synthetic_task_credential_only';
const saved = { id, revision: 2, title: 'Synthetic task', description: null, description_truncated: false,
  due_at: '2026-10-19', is_active: true, completed_at: null, application_id: null, search_id: null, recurrence: null };
const ready = { outcome: 'ready', data: saved, revision: 2, next_action: { kind: 'none', label: '' } };

test('task HTTP methods preserve supplied deadlines, explicit false/null, request IDs and credentials', async () => {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl: async (input, init) => {
    const url = new URL(String(input)); calls.push({ url, init });
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${token}`);
    return Response.json(url.pathname.includes('list_tasks') ? { ...ready, data: { items: [saved], page: 1, total: 1, has_more: false } } : ready);
  } });
  await client.listTasks({ is_active: null, occurrence_date: '2026-10-18' });
  assert.deepEqual(JSON.parse(calls[0].url.searchParams.get('arguments')!), { is_active: null, occurrence_date: '2026-10-18' });
  const create = { request_id: requestId, title: 'Synthetic task', due_at: '2026-10-19' };
  await client.createTask(create); await client.createTask(create);
  assert.equal(calls[1].url.pathname, '/api/v1/journey/create_task_v2');
  assert.equal((calls[1].init?.headers as Record<string, string>)['Content-Type'], 'application/json');
  assert.equal(calls[1].init?.body, calls[2].init?.body);
  await client.updateTask({ request_id: requestId, task_id: id, expected_revision: 2, due_at: null, is_active: false });
  assert.equal(JSON.parse(String(calls[3].init?.body)).is_active, false);
  assert.equal(JSON.parse(String(calls[3].init?.body)).due_at, null);
  let requests = 0;
  const failed = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl: async () => { requests++; throw Error(token); } });
  await assert.rejects(failed.createTask(create), /network_error/); assert.equal(requests, 1);
});

test('task schemas reject malformed dates, unsafe identifiers, missing intents and unversioned changes', async () => {
  let requests = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl: async () => { requests++; return Response.json(ready); } });
  for (const value of ['2026-02-30', '2026-10-19T10:30:00', 'tomorrow', '']) {
    await assert.rejects(client.createTask({ request_id: requestId, title: 'Synthetic', due_at: value }), /invalid_input/);
  }
  for (const date of ['2026-02-30', '0000-01-01', '2026-1-1']) assert.equal(taskDate(date), false);
  assert.equal(taskDate('2028-02-29'), true);
  await assert.rejects(client.getTask({ task_id: '../account' }), /invalid_input/);
  await assert.rejects(client.createTask({ request_id: '', title: 'Synthetic' }), /invalid_input/);
  await assert.rejects(client.updateTask({ request_id: requestId, task_id: id, expected_revision: 2 }), /invalid_input/);
  await assert.rejects(client.setTaskCompletion({ request_id: requestId, task_id: id, expected_revision: 2,
    expected_fingerprint: '', completion_date: '2026-10-19', completed: true }), /invalid_input/);
  assert.equal(requests, 0);
});

test('task and receipt results cannot report malformed or failed outcomes as successful', async () => {
  for (const data of [{ ...saved, revision: 0 }, { ...saved, is_active: 'true' }, { ...saved, description_truncated: undefined },
    { ...saved, recurrence: { type: 'daily', days: [], times_per_week: null, paused: false, date: '2026-10-19', completed_at: null, fingerprint: 'not-a-fingerprint' } }]) {
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl: async () => Response.json({ ...ready, data }) });
    await assert.rejects(client.getTask({ task_id: id }), /invalid_response/);
  }
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl: async () => Response.json({
    outcome: 'failed', data: null, error: { code: 'processing_failed', message: token }, next_action: { kind: 'support', label: 'Open support' },
  }) });
  await assert.rejects(client.getOperation({ operation_id: id }), error => error instanceof Error && error.message === 'processing_failed');
});

test('CLI file and stdin input carry typed intents without consuming token stdin twice', async () => {
  let stdout = '', stderr = '', calls = 0;
  const args = { request_id: requestId, title: 'Synthetic task', recurrence: { type: 'weekly', days: [4], due_time: '09:30' } };
  const io = { env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(args)]),
    stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
    stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
    fetchImpl: (async (_input, init) => { calls++; assert.deepEqual(JSON.parse(String(init?.body)), args); return Response.json(ready); }) as typeof fetch };
  assert.equal(await runCLI(['tasks', 'create', '--file', '-', '--json'], io, 'test'), 0);
  assert.equal(calls, 1); assert.equal(JSON.parse(stdout).data.id, id); assert.equal(stderr, '');
  assert.equal(await runCLI(['tasks', 'create', '--file', '-', '--token-stdin', '--json'], io, 'test'), 2);
  assert.equal(calls, 1); assert.ok(!stderr.includes(token));
  const directory = await mkdtemp(path.join(tmpdir(), 'jobhunt-task-input-'));
  const file = path.join(directory, 'input.json');
  await writeFile(file, JSON.stringify(args)); assert.deepEqual(await inputJSON(file, Readable.from([])), args);
  await writeFile(file, 'x'.repeat(65537)); await assert.rejects(inputJSON(file, Readable.from([])), /invalid_input/);
  await assert.rejects(inputJSON('-', Readable.from([Buffer.from([0xff])])), /invalid_input/);
});

test('CLI complete and reopen require explicit revision and request identity', async () => {
  let calls = 0;
  const io = { env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([]),
    stdout: new Writable({ write(_chunk, _encoding, next) { next(); } }),
    stderr: new Writable({ write(_chunk, _encoding, next) { next(); } }),
    fetchImpl: (async (_input, init) => { calls++; const data = JSON.parse(String(init?.body));
      assert.equal(data.request_id, requestId); assert.equal(data.expected_revision, 2); assert.equal(data.is_active, calls === 2);
      return Response.json(ready);
    }) as typeof fetch };
  assert.equal(await runCLI(['tasks', 'complete', id, '--revision', '2', '--json'], io, 'test'), 2);
  assert.equal(calls, 0);
  for (const command of ['complete', 'reopen']) assert.equal(await runCLI(['tasks', command, id, '--revision', '2', '--request-id', requestId, '--json'], io, 'test'), 0);
  assert.equal(calls, 2);
});
