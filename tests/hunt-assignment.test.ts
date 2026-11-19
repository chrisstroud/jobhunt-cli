import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, type HuntAssignmentWrite } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';
const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const value: HuntAssignmentWrite = { request_id: other, expected_account_id: 'jh_' + id, search_id: id,
  scope: 'all', expected_fingerprint: 'a'.repeat(64), expected_application_count: 3, expected_moving_count: 2 };
const data = { account_id: 'jh_' + id, target: { id, slug: 'synthetic-target', name: 'Synthetic Hunt', revision: 1,
  status: 'completed', archived: false }, fingerprint: 'b'.repeat(64), application_count: 3, moving_count: 0,
  already_assigned_count: 3, all_assigned: true };
const ready = (d: unknown) => ({ outcome: 'ready', data: d, next_action: { kind: 'none', label: '' } });
const token = 'synthetic-assignment';
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });

test('assignment requires exact all-scope and bounded consistent reviewed counts before I/O', async () => {
  let calls = 0; const api = client(async () => { calls++; return Response.json(ready(data)); });
  for (const patch of [{ scope: 'some' }, { scope: undefined }, { expected_fingerprint: '' }, { expected_application_count: -1 },
    { expected_moving_count: true }, { expected_moving_count: 4 }, { expected_application_count: 1.5 },
    { search_id: '../foreign' }, { request_id: 'invalid' }, { expected_account_id: 'foreign' }, { unexpected: true }])
    await assert.rejects(api.assignAllHuntApplications({ ...value, ...patch } as HuntAssignmentWrite), /invalid_input/);
  assert.equal(calls, 0);
});

test('assignment adapter retains exact retry intent and permits reviewed legacy destination lifecycle states', async () => {
  const bodies: unknown[] = [];
  const api = client(async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/assign_all_hunt_applications_v2');
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    bodies.push(JSON.parse(String(init?.body))); return Response.json(ready(data));
  });
  await api.assignAllHuntApplications(value); await api.assignAllHuntApplications(value);
  assert.deepEqual(bodies, [value, value]);
});

test('assignment readback rejects wrong target/account, inconsistent counts and false all-assigned state', async () => {
  for (const patch of [{ account_id: 'jh_' + other }, { target: { ...data.target, id: other } },
    { moving_count: 1 }, { application_count: 4 }, { all_assigned: false }, { fingerprint: '' }, { scope: 'some' }])
    await assert.rejects(client(async () => Response.json(ready({ ...data, ...patch }))).assignAllHuntApplications(value), /invalid_response/);
  const later = { ...data, moving_count: 1, already_assigned_count: 2, all_assigned: false };
  assert.deepEqual((await client(async () => Response.json(ready(later))).assignAllHuntApplications(value)).data, later);
});

test('assignment CLI confirms the reviewed destination before network access', async () => {
  for (const confirm of [undefined, other, id]) {
    let calls = 0, out = '', err = '';
    const code = await runCLI(['hunts', 'assign-all', '--file', '-', '--json', ...(confirm ? ['--confirm', confirm] : [])], {
      env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(value)]),
      stdout: new Writable({ write(c, _e, next) { out += c; next(); } }),
      stderr: new Writable({ write(c, _e, next) { err += c; next(); } }),
      fetchImpl: async () => { calls++; return Response.json(ready(data)); },
    }, 'test');
    assert.equal(code, confirm === id ? 0 : 2); assert.equal(calls, confirm === id ? 1 : 0);
    if (confirm !== id) { assert.equal(out, ''); assert.equal(JSON.parse(err).error.code, 'confirmation_required'); }
    else assert.deepEqual(JSON.parse(out).data, data);
  }
});

test('assignment review CLI uses only the exact owned target over cookie-free GET', async () => {
  let count = 0;
  const code = await runCLI(['hunts', 'assignment-review', id, '--json'], {
    env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([]),
    stdout: new Writable({ write(_c, _e, next) { next(); } }), stderr: new Writable({ write(_c, _e, next) { next(); } }),
    fetchImpl: async (url, init) => {
      count++; assert.equal(init?.method, 'GET'); assert.equal(init?.credentials, 'omit');
      assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), { search_id: id });
      return Response.json(ready(data));
    },
  }, 'test');
  assert.equal(code, 0); assert.equal(count, 1);
});
