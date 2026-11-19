import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const token = 'synthetic_insight_credential';
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const activity = { items: [], page: 1, total: 0, has_more: false };
const counts = { applications: 0, days: [], follow_ups: 0, history_start_date: '2026-10-01', notes: 0, origin_date: '2026-10-01', record_updates: 0, scope: { kind: 'account' }, today_date: '2026-10-21' };
const analytics = { summary: { total_applications: 0 }, funnel: {}, weekly_activity: {}, campaigns: [], days: 90, search: null };
const career = { as_of: '2026-10-21T00:00:00Z', total: 0, last30: 0, last90: 0, latest: null, resume: null, network: { valid: true, total: 0 } };
const inbox = { notifications: { data: [], meta: { pagination: { count: 0, current_page: 1, page_size: 100, total_pages: 0, total: 0 } } }, settings: { defaultFilter: 'unread', markReadOnOpen: true } };
const saved = { action: 'read_all', notification: null };
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });

test('insight reads retain query semantics and explicit notification actions use one unretried request', async () => {
  const expected = ['list_workspace_activity_v2', 'get_hunt_activity_v2', 'get_workspace_analytics_v2', 'get_workspace_career_health_v2', 'get_workspace_notifications_v2', 'mark_workspace_notifications_read_v2'];
  const values = [activity, counts, analytics, career, inbox, saved]; let calls = 0;
  const intent = { request_id: id, expected_account_id: 'jh_' + id, action: 'read_all' as const };
  const client = api(async (url, init) => {
    const parsed = new URL(String(url)); assert.equal(parsed.pathname, '/api/v1/journey/' + expected[calls]);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    if (calls === 1) assert.deepEqual(JSON.parse(parsed.searchParams.get('arguments')!), { today: '2026-10-21', tz_offset: -420 });
    if (calls === 5) { assert.equal(init?.method, 'POST'); assert.deepEqual(JSON.parse(String(init?.body)), intent); }
    else assert.ok(init?.method === undefined || init.method === 'GET');
    return Response.json(ready(values[calls++]));
  });
  assert.deepEqual((await client.listWorkActivity()).data, activity);
  assert.deepEqual((await client.getActivityCounts({ today: '2026-10-21', tz_offset: -420 })).data, counts);
  assert.deepEqual((await client.getAnalytics()).data, analytics);
  assert.deepEqual((await client.getCareerFacts()).data, career);
  assert.deepEqual((await client.listNotifications()).data, inbox);
  assert.deepEqual((await client.markNotificationsRead(intent)).data, saved);
  assert.equal(calls, 6);
});

test('invalid insight windows, calendar dates, IDs and ambiguous inbox intents never reach the network', async () => {
  let calls = 0; const client = api(async () => { calls++; return Response.json(ready(inbox)); });
  for (const page of [0, 10001, 1.5]) {
    await assert.rejects(client.listWorkActivity({ page }), /invalid_input/);
    await assert.rejects(client.listNotifications({ page }), /invalid_input/);
  }
  for (const input of [{ days: 60 }, { days: '90' }, { search: '' }, { search: 'x'.repeat(201) }])
    await assert.rejects(client.getAnalytics(input as never), /invalid_input/);
  for (const input of [{ today: '2026-02-30' }, { today: '2026-10-21', tz_offset: 841 }, { today: '2026-10-21', search_id: 'bad' }])
    await assert.rejects(client.getActivityCounts(input), /invalid_input/);
  for (const input of [{ request_id: id, action: 'read' }, { request_id: id, action: 'read_all', notification_id: id },
    { request_id: id, action: 'delete' }, { request_id: id, action: 'read', notification_id: 'bad' }])
    await assert.rejects(client.markNotificationsRead(input as never), /invalid_input/);
  assert.equal(calls, 0);
});

test('mismatched insight pages, query scope and notification results are rejected', async () => {
  await assert.rejects(api(async () => Response.json(ready({ ...activity, page: 2 }))).listWorkActivity(), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...activity, items: Array(51).fill({}) }))).listWorkActivity(), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...counts, scope: { kind: 'hunt' } }))).getActivityCounts({ today: '2026-10-21' }), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...analytics, days: 30 }))).getAnalytics(), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...analytics, search: 'another-hunt' }))).getAnalytics(), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...career, total: -1 }))).getCareerFacts(), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...inbox, settings: { defaultFilter: 'bad' } }))).listNotifications(), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ action: 'read', notification: { id: '22222222-2222-4222-8222-222222222222', attributes: {} } }))).markNotificationsRead({ request_id: id, action: 'read', notification_id: id }), /invalid_response/);
});

async function cli(args: string[], data: unknown) {
  let stdout = ''; let stderr = ''; let calls = 0;
  const code = await runCLI([...args, '--json', '--non-interactive'], { env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([]),
    fetchImpl: async () => { calls++; return Response.json(ready(data)); },
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk.toString(); done(); } }),
  }, 'test'); return { code, stdout, stderr, calls };
}

test('domain insight commands dispatch and invalid flags fail before requests', async () => {
  for (const [args, data] of [[['activity', 'list'], activity], [['activity', 'counts', '--date', '2026-10-21', '--tz-offset=-420'], counts],
    [['analytics', 'get'], analytics], [['career', 'get'], career], [['notifications', 'list'], inbox]] as const) {
    const result = await cli([...args], data); assert.equal(result.code, 0); assert.equal(result.calls, 1);
    assert.deepEqual(JSON.parse(result.stdout).data, data); assert.equal(result.stderr, '');
  }
  for (const args of [['activity', 'counts'], ['activity', 'list', '--page', '0'], ['analytics', 'get', '--days', '60'], ['notifications', 'list', '--page', 'one']]) {
    const result = await cli(args, inbox); assert.equal(result.code, 2); assert.equal(result.calls, 0);
  }
});
