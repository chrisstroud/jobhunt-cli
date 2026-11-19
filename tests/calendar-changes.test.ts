import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const selection = { connection_id: id, source_kind: 'interview' as const, source_id: id, action: 'sync' as const, recover_of: null };
const state = { id, selection, mode: 'create', calendar_id: 'synthetic-calendar', event_id: 'synthetic-event', status: 'pending',
  provider_state: 'not_started', local_state: 'pending', failure_code: null, can_cancel: true, resolved_by: null, resolution: null, fingerprint: 'a'.repeat(64) };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_calendar_credential' }, fetchImpl });

test('calendar review binds source and accepts no source/provider body in a response', async () => {
  const value = { selection, mode: 'create', calendar_id: 'synthetic-calendar', event_id: null, source_fingerprint: 'b'.repeat(64),
    event_fingerprint: 'c'.repeat(64), fingerprint: 'd'.repeat(64), review_token: 'synthetic-signed-proof', status_prefix: '', previous_event_retained: false };
  let calls = 0;
  const client = api(async (url) => {
    calls++;
    assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), selection);
    return Response.json(ready(value));
  });
  assert.deepEqual((await client.previewCalendarChange(selection)).data, value);
  const omittedDefaults = { ...value, selection: { connection_id: id, source_kind: 'interview', source_id: id } };
  assert.deepEqual((await api(async () => Response.json(ready(omittedDefaults))).previewCalendarChange({ connection_id: id, source_kind: 'interview', source_id: id })).data, omittedDefaults);
  for (const unsafe of [{ ...value, event: { description: 'Synthetic private notes' } }, { ...value, raw_response: {} },
    { ...value, selection: { ...selection, source_id: other } }, { ...value, selection: { ...selection, action: 'remove' } }, { ...value, fingerprint: 'invalid' }]) {
    await assert.rejects(api(async () => Response.json(ready(unsafe))).previewCalendarChange(selection), /invalid_response/);
  }
  await assert.rejects(client.previewCalendarChange({ ...selection, source_id: 'invalid' }), /invalid_input/);
  assert.equal(calls, 1);
});

test('calendar status distinguishes confirmed and uncertain outcomes and validates identity and history', async () => {
  assert.deepEqual((await api(async () => Response.json(ready(state))).getCalendarChange({ change_id: id })).data, state);
  for (const unsafe of [{ ...state, id: other }, { ...state, event: {} }, { ...state, authorization: {} },
    { ...state, status: 'succeeded' }, { ...state, status: 'needs_review', can_cancel: false },
    { ...state, status: 'cancelled', provider_state: 'confirmed', local_state: 'unchanged', can_cancel: false },
    { ...state, status: 'resolved', resolution: 'followup', resolved_by: null, can_cancel: false }]) {
    await assert.rejects(api(async () => Response.json(ready(unsafe))).getCalendarChange({ change_id: id }), /invalid_response/);
  }
  const uncertain = { ...state, status: 'needs_review', provider_state: 'unknown', local_state: 'needs_review', can_cancel: false };
  assert.deepEqual((await api(async () => Response.json(ready(uncertain))).getCalendarChange({ change_id: id })).data, uncertain);
  const failure = { ...ready(uncertain), outcome: 'failed', error: { code: 'processing_failed', message: 'Review the recorded provider outcome.' } };
  const readFailure = await api(async () => Response.json(failure)).getCalendarChange({ change_id: id });
  assert.deepEqual(readFailure.data, uncertain); assert.equal(readFailure.outcome, 'failed');
  const history = { items: [state], page: 1, total: 1, has_more: false };
  assert.deepEqual((await api(async () => Response.json(ready(history))).listCalendarChanges({ source_kind: 'interview', source_id: id })).data, history);
  await assert.rejects(api(async () => Response.json(ready({ ...history, items: [{ ...state, selection: { ...selection, source_id: other } }] })))
    .listCalendarChanges({ source_kind: 'interview', source_id: id }), /invalid_response/);
});

test('calendar controls require account, real booleans and explicit CLI confirmation before HTTP', async () => {
  let calls = 0;
  const client = api(async () => { calls++; return Response.json(ready(state)); });
  for (const input of [{ request_id: id, change_id: id, confirm_cancel: true },
    { request_id: id, expected_account_id: 'jh_' + id, change_id: id, confirm_cancel: 1 }]) {
    await assert.rejects(client.cancelCalendarChange(input as never), /invalid_input/);
  }
  await assert.rejects(client.listCalendarChanges({ source_id: id }), /invalid_input/);
  let errors = '';
  const result = await runCLI(['calendar', 'resolve', '--file', '-', '--confirm', other, '--json', '--non-interactive'], {
    env: { JOBHUNT_TOKEN: 'synthetic_calendar_credential' },
    stdin: Readable.from([JSON.stringify({ request_id: id, expected_account_id: 'jh_' + id, change_id: id,
      expected_fingerprint: 'a'.repeat(64), confirm_leave_unchanged: true })]),
    stdout: new Writable({ write(_chunk, _, done) { done(); } }), stderr: new Writable({ write(chunk, _, done) { errors += chunk.toString(); done(); } }),
    fetchImpl: async () => { calls++; throw new Error('Must not send an unconfirmed resolution'); },
  }, 'test');
  assert.equal(result, 2); assert.equal(JSON.parse(errors).error.code, 'confirmation_required'); assert.equal(calls, 0);
});

test('upcoming calendar pages reject inconsistent counts, cursors, ownership and private content', async () => {
  const page = { connection_id: id, as_of: '2026-10-22T00:00:00Z', fingerprint: 'a'.repeat(64),
    items: [{ source_kind: 'interview', source_id: other }], total: 1, interviews: 1, tasks: 0, offset: 0, next_cursor: null };
  assert.deepEqual((await api(async () => Response.json(ready(page))).getUpcomingCalendarSources({ connection_id: id })).data, page);
  for (const unsafe of [{ ...page, connection_id: other }, { ...page, tasks: 1 }, { ...page, offset: 20 },
    { ...page, next_cursor: 'synthetic-unnecessary-cursor' }, { ...page, raw_response: {} },
    { ...page, items: [{ ...page.items[0], notes: 'Synthetic private notes' }] }]) {
    await assert.rejects(api(async () => Response.json(ready(unsafe))).getUpcomingCalendarSources({ connection_id: id }), /invalid_response/);
  }
});

test('calendar batches retain partial outcomes and reject duplicate intent or leaked data', async () => {
  const args = { request_id: id, review_tokens: ['synthetic-first-review', 'synthetic-second-review'] };
  const batch = { batch_id: id, accepted: 1, rejected: 1,
    items: [{ request_id: id, change: state, error: null },
      { request_id: other, change: null, error: { code: 'revision_conflict', message: 'Review current state.' } }] };
  assert.deepEqual((await api(async () => Response.json(ready(batch))).queueCalendarChanges(args)).data, batch);
  for (const unsafe of [{ ...batch, accepted: 2, rejected: 0 }, { ...batch, review_tokens: args.review_tokens },
    { ...batch, items: [batch.items[0], batch.items[0]] },
    { ...batch, items: [batch.items[0], { ...batch.items[1], error: { code: 'revision_conflict', message: 'Review current state.', provider_body: {} } }] }]) {
    await assert.rejects(api(async () => Response.json(ready(unsafe))).queueCalendarChanges(args), /invalid_response/);
  }
  let called = false;
  await assert.rejects(api(async () => { called = true; throw new Error('Must not send duplicate reviews'); })
    .queueCalendarChanges({ ...args, review_tokens: ['synthetic-review', 'synthetic-review'] }), /invalid_input/);
  assert.equal(called, false);
});
