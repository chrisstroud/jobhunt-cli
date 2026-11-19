import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, type HuntPreferencesWrite } from '../client/src/index.ts';
import { huntPreferencesInput } from '../client/src/hunt-settings-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';
const id = '11111111-1111-4111-8111-111111111111', request = '22222222-2222-4222-8222-222222222222';
const account = { id: 'jh_' + id }, token = 'synthetic-hunt-settings';
const prefs = { timezone: 'America/Los_Angeles', quiet: false, follow_up_days: 0, locations: [] };
const settings = { account, revision: 1, preferences: prefs, current_ids: [], hunts: [], resumes: [],
  more_hunts: false, more_resumes: false, unavailable: [] };
const context = { account, search: null, resume: null, preferences: prefs, choices: [], missing: [], next_actions: [] };
const ready = (data: unknown) => ({ outcome: 'ready', data, revision: 2, next_action: { kind: 'none', label: '' } });
const input: HuntPreferencesWrite = { request_id: request, expected_account_id: account.id,
  expected_revision: 1, set: prefs, clear_fields: ['tone'] };
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });

test('preference writes preserve omission, explicit null, empty lists, zero and false across identical retries', async () => {
  const bodies: unknown[] = [];
  const api = client(async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/update_job_hunt_preferences');
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    bodies.push(JSON.parse(String(init?.body))); return Response.json(ready(prefs));
  });
  await api.updateHuntPreferences(input); await api.updateHuntPreferences(input);
  assert.deepEqual(bodies, [input, input]);
  assert.deepEqual(huntPreferencesInput({ ...input, set: { preferred_resume_id: null }, clear_fields: [] }).set, { preferred_resume_id: null });
});

test('preference intent rejects ambiguous, unbounded and malformed changes before I/O', async () => {
  let calls = 0; const api = client(async () => { calls++; return Response.json(ready(prefs)); });
  for (const patch of [{ expected_revision: 0 }, { set: {} , clear_fields: [] }, { set: { quiet: 'yes' } },
    { set: { follow_up_days: true } }, { set: { follow_up_days: -1 } }, { set: { follow_up_days: 366 } },
    { set: { timezone: 'x'.repeat(81) } }, { set: { tone: 'unknown' } }, { set: { locations: Array(21).fill('Remote') } },
    { set: { role_interests: ['x'.repeat(256)] } }, { set: { billing: true } }, { set: { preferred_resume_id: 'invalid' } }, { clear_fields: ['unknown'] },
    { clear_fields: ['tone', 'tone'] }, { clear_fields: ['quiet'] }, { clear_fields: null }, { set: null },
    { expected_account_id: 'foreign' }, { request_id: 'unsafe' }, { unexpected: true }])
    await assert.rejects(api.updateHuntPreferences({ ...input, ...patch } as HuntPreferencesWrite), /invalid_input/);
  assert.equal(calls, 0);
});

test('saved settings preserve bounded choices and refuse malformed successful responses', async () => {
  assert.deepEqual(await client(async () => Response.json(settings)).getHuntSettings(), settings);
  for (const patch of [{ account: { id: 'jh_foreign' } }, { preferences: { quiet: 'true' } },
    { hunts: Array(51).fill({ id, label: 'Hunt', revision: 1, preferred_resume_id: null }) },
    { revision: 0 }, { more_hunts: null }, { unavailable: ['invented'] }, { current_ids: ['../foreign'] }])
    await assert.rejects(client(async () => Response.json({ ...settings, ...patch })).getHuntSettings(), /invalid_response/);
  await assert.rejects(client(async () => Response.json(ready({ unknown: 'discarded' }))).updateHuntPreferences(input), /invalid_response/);
});

test('context uses exact explicit selection and supports needs-input without guessing', async () => {
  let requested = '';
  await assert.rejects(client(async () => { throw new Error('No request expected'); }).getHuntContext({ search_id: 'invalid' }), /invalid_input/);
  const ambiguous = { ...ready({ ...context, missing: ['select_search'] }), outcome: 'needs_input' };
  assert.equal((await client(async url => { requested = String(url); return Response.json(ambiguous); }).getHuntContext()).outcome, 'needs_input');
  assert.deepEqual(JSON.parse(new URL(requested).searchParams.get('arguments')!), {});
  await assert.rejects(client(async () => Response.json(ready(context))).getHuntContext({ search_id: id }), /invalid_response/);
  for (const patch of [{ choices: Array(51).fill({}) }, { next_actions: Array(4).fill({ kind: 'read', label: '' }) },
    { account: { id: 'foreign' } }, { preferences: null }])
    await assert.rejects(client(async () => Response.json(ready({ ...context, ...patch }))).getHuntContext(), /invalid_response/);
});

test('domain CLI exposes settings and read-only context through cookie-free HTTP', async () => {
  for (const args of [['hunt-settings', 'get'], ['hunt-settings', 'update', '--file', '-'], ['context', 'get']]) {
    let out = '', err = '', count = 0;
    const code = await runCLI([...args, '--json'], {
      env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(input)]),
      stdout: new Writable({ write(c, _e, next) { out += c; next(); } }),
      stderr: new Writable({ write(c, _e, next) { err += c; next(); } }),
      fetchImpl: async (url, init) => {
        count++; assert.equal(init?.credentials, 'omit');
        if (args[1] === 'update') assert.deepEqual(JSON.parse(String(init?.body)), input);
        if (args[0] === 'context') assert.equal(new URL(String(url)).pathname, '/api/v1/journey/get_job_hunt_context');
        return Response.json(args[0] === 'context' ? ready(context) : args[1] === 'get' ? settings : ready(prefs));
      },
    }, 'test');
    assert.equal(code, 0); assert.equal(err, ''); assert.equal(count, 1); assert.ok(JSON.parse(out));
  }
});
