import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const page = <T>(items: T[]) => ({ items, page: 1, total: items.length, has_more: false });
const record = { campaign: { id: 'synthetic-hunt', type: 'job_search', attributes: { id, database_id: id, slug: 'synthetic-hunt',
  application_count: 0, weekly_goals_hit: 3, notes: [{ body: 'Retained synthetic context' }] } }, fingerprint: 'a'.repeat(64), revision: 1 };
const workspace = { ...record, campaigns: page([]), companies: page([]), resumes: page([]) };
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { token: 'synthetic_hunt_credential', origin: 'https://jobhunt.app' }, fetchImpl });

test('complete Hunt workspace keeps native fields and binds every independent page and owned ID', async () => {
  const api = client(async (url) => { assert.ok(String(url).includes('/get_hunt_workspace?')); return Response.json(ready(workspace)); });
  assert.deepEqual((await api.getHuntWorkspace({ search_id: id })).data, workspace);
  await assert.rejects(api.getHuntWorkspace({ search_id: id, companies_page: 2 }), /invalid_response/);
  await assert.rejects(client(async () => Response.json(ready({ ...workspace, campaign: { ...record.campaign,
    attributes: { ...record.campaign.attributes, database_id: other } } }))).getHuntWorkspace({ search_id: id }), /invalid_response/);
  await assert.rejects(client(async () => Response.json(ready({ ...workspace, campaign: { ...record.campaign,
    attributes: { ...record.campaign.attributes, user_id: other } } }))).getHuntWorkspace({ search_id: id }), /invalid_response/);
});

test('original Hunt workspace saves preserve exact intent and do not retry an uncertain write', async () => {
  const intent = { request_id: id, search_id: id, expected_fingerprint: record.fingerprint, action: 'pause' as const };
  let calls = 0;
  const api = client(async (url, init) => {
    calls++; assert.ok(String(url).endsWith('/save_hunt_workspace')); assert.deepEqual(JSON.parse(String(init?.body)), intent);
    return Response.json(ready(record));
  });
  assert.deepEqual((await api.saveHuntWorkspace(intent)).data, record);
  await assert.rejects(client(async () => { calls++; throw new Error('private diagnostics'); }).saveHuntWorkspace(intent), /network_error|request_failed/);
  assert.equal(calls, 2);
});

test('native Hunt directory retains whitespace names and its completed-to-archived projection', async () => {
  const data = page([{ id, name: '   ', status: 'archived', revision: 1, application_count: 0, is_current: false }]);
  assert.deepEqual((await client(async () => Response.json(ready(data))).listHuntDirectory()).data, data);
  await assert.rejects(client(async () => Response.json(ready({ ...data, items: [{ ...data.items[0], status: 'completed' }] }))).listHuntDirectory(), /invalid_response/);
});

test('original Hunt removal preserves ignored optional input and binds its bounded acknowledgment', async () => {
  const intent = { request_id: id, search_id: id, expected_revision: 1, expected_application_count: 0, expected_target_revision: 2 };
  const deleted = { search_id: id, deleted: true, migrated_to_id: null, application_count: 0 };
  const api = client(async (url, init) => {
    assert.ok(String(url).endsWith('/remove_hunt')); assert.deepEqual(JSON.parse(String(init?.body)), intent);
    return Response.json(ready(deleted));
  });
  assert.deepEqual((await api.removeHunt(intent)).data, deleted);
  await assert.rejects(client(async () => Response.json(ready({ ...deleted, search_id: other }))).removeHunt(intent), /invalid_response/);
  let calls = 0; let stderr = '';
  const code = await runCLI(['hunts', 'remove', '--file', '-', '--json', '--non-interactive'], {
    env: { JOBHUNT_TOKEN: 'synthetic_hunt_credential' }, stdin: Readable.from([JSON.stringify(intent)]),
    fetchImpl: async () => { calls++; return Response.json(ready(deleted)); },
    stdout: new Writable({ write(_chunk, _, done) { done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk.toString(); done(); } }),
  }, 'test');
  assert.equal(code, 2); assert.equal(JSON.parse(stderr).error.code, 'confirmation_required'); assert.equal(calls, 0);
});
