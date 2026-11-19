import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';
import { INTEGRATION_SCOPES, loginScopes } from '../cli/src/oauth.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const value = { id, provider: 'google_calendar', purpose: 'calendar', calendar_id: 'synthetic-calendar', sync_interviews: null,
  sync_tasks: false, sync_enabled: false, sync_settings: { task_types: { interview: false } }, stored_sync_settings: null,
  scopes: [], last_synced_at: null, has_error: true, consecutive_errors: 1, is_expired: false, created_at: null, updated_at: null, fingerprint: 'a'.repeat(64) };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_calendar_credential' }, fetchImpl });

test('calendar responses bind owned purpose and target and reject reusable credentials or raw errors', async () => {
  assert.deepEqual((await api(async () => Response.json(ready(value))).getCalendarConnection({ provider: 'google_calendar' })).data, value);
  for (const unsafe of [{ ...value, purpose: 'contacts' }, { ...value, id: other }, { ...value, access_token: 'synthetic-forbidden-value' }, { ...value, last_error: 'synthetic-private-provider-body' }]) {
    await assert.rejects(api(async () => Response.json(ready(unsafe))).getCalendarConnection({ connection_id: id }), /invalid_response/);
  }
  await assert.rejects(api(async () => Response.json(ready(value))).getCalendarConnection({ provider: 'google_calendar', connection_id: id } as never), /invalid_input/);
});

test('calendar clears retain null and omission; disconnect confirmation precedes HTTP and new login grants stay explicit', async () => {
  const args = { request_id: id, connection_id: id, expected_fingerprint: value.fingerprint, settings: { calendar_id: null, sync_enabled: false, sync_settings: { task_types: { custom: true } } } };
  let calls = 0;
  assert.deepEqual((await api(async (_url, init) => { calls++; assert.deepEqual(JSON.parse(String(init?.body)), args); return Response.json(ready(value)); }).updateCalendarConnection(args)).data, value);
  await assert.rejects(api(async () => { calls++; throw new Error('Synthetic private diagnostic'); }).updateCalendarConnection(args), /network_error|request_failed/);
  assert.equal(calls, 2);
  let error = '';
  const result = await runCLI(['calendar', 'disconnect', '--file', '-', '--json', '--non-interactive', '--confirm', other], {
    env: { JOBHUNT_TOKEN: 'synthetic_calendar_credential' }, stdin: Readable.from([JSON.stringify({ request_id: id, connection_id: id, expected_fingerprint: value.fingerprint })]),
    stdout: new Writable({ write(_chunk, _, done) { done(); } }), stderr: new Writable({ write(chunk, _, done) { error += chunk.toString(); done(); } }),
    fetchImpl: async () => { calls++; throw new Error('Must not send an unconfirmed disconnect'); },
  }, 'test');
  assert.equal(result, 2); assert.equal(JSON.parse(error).error.code, 'confirmation_required'); assert.equal(calls, 2);
  assert.deepEqual(loginScopes(), INTEGRATION_SCOPES);
  assert.ok(!INTEGRATION_SCOPES.includes('read:calendar') && !INTEGRATION_SCOPES.includes('write:calendar'));
  assert.deepEqual(loginScopes('read:profile,read:calendar,write:calendar'), ['read:profile', 'read:calendar', 'write:calendar']);
});

test('available calendars retain explicit empty continuations and bind the response to the selected connection', async () => {
  const page = { connection_id: id, connection_fingerprint: 'a'.repeat(64), items: [], next_cursor: 'synthetic-signed-continuation' };
  let calls = 0;
  const client = api(async (url) => {
    calls++;
    const target = new URL(String(url));
    assert.equal(target.pathname, '/api/v1/journey/list_available_calendars');
    assert.deepEqual(JSON.parse(target.searchParams.get('arguments')!), { connection_id: id, cursor: 'synthetic-signed-continuation' });
    return Response.json(ready(page));
  });
  assert.deepEqual((await client.listAvailableCalendars({ connection_id: id, cursor: 'synthetic-signed-continuation' })).data, page);
  assert.equal(calls, 1);
  for (const unsafe of [{ ...page, connection_id: other }, { ...page, next_cursor: '' }, { ...page, access_token: 'synthetic-private' },
    { ...page, items: [{ id: 'synthetic-calendar', name: 'Synthetic', primary: false, raw_response: {} }] },
    { ...page, items: [{ id: 'synthetic-duplicate', name: 'Synthetic', primary: false }, { id: 'synthetic-duplicate', name: 'Synthetic', primary: false }] }]) {
    await assert.rejects(api(async () => Response.json(ready(unsafe))).listAvailableCalendars({ connection_id: id }), /invalid_response/);
  }
  for (const bad of [{ connection_id: 'invalid' }, { connection_id: id, cursor: '' }, { connection_id: id, cursor: 'x'.repeat(16385) }]) {
    await assert.rejects(client.listAvailableCalendars(bad), /invalid_input/);
  }
  assert.equal(calls, 1);
});

test('calendar available CLI forwards only an explicit target and cursor and keeps help together', async () => {
  let output = '';
  let errors = '';
  let calls = 0;
  const dependencies = {
    env: { JOBHUNT_TOKEN: 'synthetic_calendar_credential' }, stdin: Readable.from([]),
    stdout: new Writable({ write(chunk: Buffer, _: string, done: () => void) { output += chunk.toString(); done(); } }),
    stderr: new Writable({ write(chunk: Buffer, _: string, done: () => void) { errors += chunk.toString(); done(); } }),
    fetchImpl: (async (url: string | URL | Request) => {
      calls++;
      assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), { connection_id: id, cursor: 'synthetic-cursor' });
      return Response.json(ready({ connection_id: id, connection_fingerprint: 'a'.repeat(64), items: [], next_cursor: null }));
    }) as typeof fetch,
  };
  assert.equal(await runCLI(['calendar', 'available', id, '--cursor', 'synthetic-cursor', '--json', '--non-interactive'], dependencies, 'test'), 0);
  assert.equal(JSON.parse(output).data.next_cursor, null); assert.equal(errors, ''); assert.equal(calls, 1);
  output = ''; errors = '';
  assert.equal(await runCLI(['calendar', 'available', '--json', '--non-interactive'], dependencies, 'test'), 2);
  assert.equal(calls, 1);
});
