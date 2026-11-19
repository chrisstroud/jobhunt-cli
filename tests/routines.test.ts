import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const page = (number = 1, per = 25) => ({ items: [], page: number, per_page: per, total: 0, has_more: false });
const routine = () => ({ fingerprint: 'a'.repeat(64), links: page(), targets: page(), aggregators: page() });
const link = { kind: 'link', id, label: 'Synthetic board', url: 'https://example.test/jobs', aggregator: null, enabled: true, order: 0, last_opened: null };
const intent = { request_id: id, expected_account_id: 'jh_' + id, expected_fingerprint: 'a'.repeat(64), kind: 'link' as const, action: 'update' as const, entity_id: id, fields: { enabled: false } };
const saved = () => ({ ...ready({ id, kind: 'link', deleted: false, exists: true, fingerprint: 'b'.repeat(64), record: { ...link, enabled: false } }),
  website_url: 'https://jobhunt.app/app/daily', operation: { id, status: 'succeeded', kind: 'change_search_routine',
    resource: { id, kind: 'profile', label: 'Search routine', revision: null }, retry_after_seconds: 0, retry_expires_at: '2026-10-22T00:00:00Z' } });
const today = { fingerprint: 'a'.repeat(64), agenda: { ok: true, sections: [{ tasks: [] }] }, taskRevisions: {}, recurringTasks: {},
  activity: { data: [] }, routine: { aggregators: [], links: [], targetCompanies: [] } };
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_routine_credential' }, fetchImpl });

test('routine reads bind independent pages and exact record identity without session cookies', async () => {
  let calls = 0;
  const client = api(async (url, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    const parsed = new URL(String(url)); const args = JSON.parse(parsed.searchParams.get('arguments')!);
    if (calls++ === 0) {
      assert.equal(parsed.pathname, '/api/v1/journey/get_search_routine');
      assert.deepEqual(args, { links_page: 2, targets_page: 3, aggregators_page: 4, per_page: 100 });
      return Response.json(ready({ ...routine(), links: page(2, 100), targets: page(3, 100), aggregators: page(4, 100) }));
    }
    assert.deepEqual(args, { kind: 'link', entity_id: id });
    return Response.json(ready({ fingerprint: 'a'.repeat(64), record: link }));
  });
  await client.getSearchRoutine({ links_page: 2, targets_page: 3, aggregators_page: 4, per_page: 100 });
  assert.equal((await client.getSearchRoutineRecord({ kind: 'link', entity_id: id })).data?.record.id, id);
  assert.equal(calls, 2);
});

test('routine rejects ambiguous destructive intents, unsafe new URLs and impossible dates before IO', async () => {
  let calls = 0; const client = api(async () => { calls++; return Response.json(saved()); });
  for (const change of [
    { action: 'delete', fields: null }, { action: 'move', fields: null }, { action: 'opened', kind: 'target', fields: null },
    { fields: { name: 'Wrong field' } }, { fields: { enabled: null } }, { fields: { url: 'https://user:password@example.test/jobs' } },
    { action: 'create', entity_id: null, fields: { label: 'Missing URL' } }, { fields: { label: '   ' } },
    { expected_account_id: 'foreign' }, { expected_fingerprint: 'wrong' },
  ]) await assert.rejects(client.changeSearchRoutine({ ...intent, ...change } as never), /invalid_input/);
  for (const args of [{ per_page: 101 }, { links_page: 0 }, { targets_page: null }, { aggregators_page: true }, { user_id: id }])
    await assert.rejects(client.getSearchRoutine(args as never), /invalid_input/);
  await assert.rejects(client.getTodayAgenda({ today: '2026-02-30' }), /invalid_input/);
  assert.equal(calls, 0);
});

test('routine response validation rejects substituted pages, records, receipts and destinations', async () => {
  for (const change of [
    (v: any) => { v.links.total = 1; }, (v: any) => { v.targets.page = 2; },
    (v: any) => { v.aggregators.has_more = true; }, (v: any) => { v.fingerprint = 'not-a-digest'; },
  ]) { const value = routine(); change(value); await assert.rejects(api(async () => Response.json(ready(value))).getSearchRoutine(), /invalid_response/); }
  await assert.rejects(api(async () => Response.json(ready({ fingerprint: 'a'.repeat(64), record: { ...link, id: 'another' } })))
    .getSearchRoutineRecord({ kind: 'link', entity_id: id }), /invalid_response/);
  for (const change of [
    (v: any) => { v.data.exists = false; }, (v: any) => { v.operation.resource.id = 'another'; },
    (v: any) => { v.data.record.kind = 'target'; }, (v: any) => { v.website_url = 'https://outside.example.test/app/daily'; },
  ]) { const value = saved(); change(value); await assert.rejects(api(async () => Response.json(value)).changeSearchRoutine(intent), /invalid_response/); }
});

test('routine writes preserve the exact reviewed request and never automatically retry uncertain writes', async () => {
  let calls = 0;
  const client = api(async (url, init) => {
    calls++; assert.equal(new URL(String(url)).pathname, '/api/v1/journey/change_search_routine');
    assert.equal(init?.method, 'POST'); assert.deepEqual(JSON.parse(String(init?.body)), intent);
    return Response.json(saved());
  });
  assert.equal((await client.changeSearchRoutine(intent)).data?.record?.kind, 'link');
  await assert.rejects(api(async () => { calls++; throw new TypeError('synthetic transport loss'); }).changeSearchRoutine(intent));
  assert.equal(calls, 2);
});

test('Today keeps typed recurrence and agenda projection while rejecting malformed state', async () => {
  assert.deepEqual((await api(async () => Response.json(ready(today))).getTodayAgenda({ today: '2026-10-21' })).data, today);
  for (const change of [
    (v: any) => { v.agenda.ok = false; }, (v: any) => { v.taskRevisions[id] = 0; },
    (v: any) => { v.routine.links.push({ ...link, enabled: 'true' }); },
    (v: any) => { v.recurringTasks[id] = { status: 'completed' }; },
  ]) { const value = structuredClone(today); change(value); await assert.rejects(api(async () => Response.json(ready(value))).getTodayAgenda({ today: '2026-10-21' }), /invalid_response/); }
});

test('domain CLI preserves intent and requires exact deletion confirmation before HTTP', async () => {
  async function run(args: string[], input?: unknown) {
    let calls = 0; let stdout = ''; let stderr = '';
    const code = await runCLI([...args, '--json', '--non-interactive'], { env: { JOBHUNT_TOKEN: 'synthetic_routine_credential' },
      stdin: Readable.from(input === undefined ? [] : [JSON.stringify(input)]),
      fetchImpl: async url => { calls++; return Response.json(String(url).includes('get_today_agenda') ? ready(today) : ready(routine())); },
      stdout: new Writable({ write(chunk, _, done) { stdout += chunk; done(); } }), stderr: new Writable({ write(chunk, _, done) { stderr += chunk; done(); } }),
    }, 'test'); return { code, calls, stdout, stderr };
  }
  assert.equal((await run(['today', 'get', '--date', '2026-10-21'])).code, 0);
  assert.equal((await run(['routine', 'list'])).code, 0);
  for (const args of [['today', 'get'], ['routine', 'list', '--links-page', 'zero'], ['routine', 'get', '--kind', 'foreign', '--id', id]]) {
    const result = await run(args); assert.equal(result.code, 2); assert.equal(result.calls, 0);
  }
  for (const confirm of [[], ['--confirm', 'wrong']]) {
    const result = await run(['routine', 'save', '--file', '-', ...confirm], { ...intent, action: 'delete', fields: null, confirm_delete: true });
    assert.equal(result.code, 2); assert.equal(result.calls, 0); assert.equal(result.stdout, '');
  }
});
