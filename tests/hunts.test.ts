import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, type HuntFields, type HuntSave } from '../client/src/index.ts';
import { huntCurrentInput, huntDeleteInput, huntSaveInput } from '../client/src/hunt-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const hash = 'a'.repeat(64), token = 'synthetic_hunt_credential';
const hunt = { id, slug: 'synthetic-hunt', name: 'Synthetic hunt', revision: 1, status: 'active',
  is_current: false, application_count: 0, outcome: null, completed_at: null };
const fields: HuntFields = { name: hunt.name, target_roles: [], target_locations: [], target_industries: [],
  target_company_sizes: [], target_company_ids: [], target_skills: [], must_haves: [], deal_breakers: [],
  remote_preference: null, target_experience_level: null, target_salary_min: 0, target_salary_max: null,
  salary_currency: 'USD', weekly_app_goal: null, start_date: null, end_date: null, preferred_resume_template_id: null, notes: [] };
const data = { hunt, fields, fingerprint: hash };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });
const save: HuntSave = { request_id: other, expected_account_id: 'jh_' + id,
  search_id: id, expected_fingerprint: hash, action: 'update', fields };

test('Hunt criteria require complete explicit fields, valid ranges and bounded notes before I/O', async () => {
  let calls = 0;
  const api = client(async () => { calls++; return Response.json(ready(data)); });
  for (const patch of [{ name: ' ' }, { target_roles: Array(31).fill('Synthetic') },
    { target_company_ids: [id, id] }, { target_salary_min: true }, { target_salary_min: -1 },
    { target_salary_min: 100, target_salary_max: 50 }, { start_date: '2026-02-30' },
    { start_date: '2026-02-02', end_date: '2026-01-01' }, { notes: [{ id: 'a', body: 'Synthetic' }] },
    { notes: Array(101).fill({}) }, { remote_preference: 'unknown' }, { salary_currency: 'unknown' },
    { preferred_resume_template_id: undefined }, { weekly_app_goal: 0 }, { unexpected: true }])
    await assert.rejects(api.saveHunt({ ...save, fields: { ...fields, ...patch } } as HuntSave), /invalid_input/);
  for (const patch of [{ expected_fingerprint: '' }, { search_id: '../other' }, { fields: undefined },
    { outcome: 'no_offer' }, { action: 'pause' }, { action: 'complete', fields: null, outcome: 'accepted' }])
    await assert.rejects(api.saveHunt({ ...save, ...patch } as HuntSave), /invalid_input/);
  await assert.rejects(api.createHunt({ request_id: other, name: ' ', start_date: null }), /invalid_input/);
  for (const page of [0, -1, 1.5, 10001, null, NaN]) await assert.rejects(api.listHunts({ page: page as number }), /invalid_input/);
  assert.equal(calls, 0);
});

test('Hunt writes preserve nulls, zeroes, all reviewed notes and the original retry key', async () => {
  const bodies: unknown[] = [];
  const api = client(async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/save_hunt_details_v2');
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    bodies.push(JSON.parse(String(init?.body))); return Response.json(ready(data));
  });
  await api.saveHunt(save); await api.saveHunt(save);
  assert.deepEqual(bodies, [save, save]);
  for (const action of ['pause', 'resume', 'archive', 'restore', 'reopen'] as const)
    assert.equal(huntSaveInput({ ...save, fields: null, action }).action, action);
  for (const outcome of ['no_offer', 'cancelled'] as const)
    assert.equal(huntSaveInput({ ...save, fields: null, action: 'complete', outcome }).outcome, outcome);
});

test('Hunt reads preserve legacy criteria but reject wrong IDs and hidden pagination loss', async () => {
  const legacy = { ...data, fields: { ...fields, name: 'x'.repeat(200), notes: [{ id: 'legacy', body: 'Retained' }] } };
  assert.deepEqual((await client(async () => Response.json(ready(legacy))).getHunt({ search_id: id })).data, legacy);
  for (const value of [{ ...data, hunt: { ...hunt, id: other } }, { ...data, fingerprint: '' }, { ...data, fields: null }])
    await assert.rejects(client(async () => Response.json(ready(value))).getHunt({ search_id: id }), /invalid_response/);
  const page = { items: [hunt], page: 1, total: 1, has_more: false, current_ids: [] };
  for (const value of [{ ...page, page: 2 }, { ...page, items: Array(26).fill(hunt) }, { ...page, total: 26 },
    { ...page, items: [{ ...hunt, application_count: -1 }] }])
    await assert.rejects(client(async () => Response.json(ready(value))).listHunts(), /invalid_response/);
});

test('Current Hunt and deletion require exact reviewed IDs and destination revision', () => {
  const current = { request_id: other, search_id: id, expected_revision: 1, expected_current_ids: [other] };
  assert.deepEqual(huntCurrentInput(current), current);
  for (const patch of [{ expected_current_ids: [other, other.toUpperCase()] }, { expected_revision: 0 }, { expected_current_ids: null }])
    assert.throws(() => huntCurrentInput({ ...current, ...patch }), /invalid_input/);
  const deletion = { request_id: other, search_id: id, expected_revision: 1, expected_application_count: 2,
    migrate_to_id: other, expected_target_revision: 3 };
  assert.deepEqual(huntDeleteInput(deletion), deletion);
  for (const patch of [{ migrate_to_id: id }, { migrate_to_id: null }, { expected_target_revision: null },
    { expected_application_count: -1 }, { expected_application_count: false }])
    assert.throws(() => huntDeleteInput({ ...deletion, ...patch }), /invalid_input/);
});

test('Hunt CLI current selection and deletion require target confirmation before I/O', async () => {
  for (const command of ['set-current', 'delete']) {
    let calls = 0, stderr = '';
    const value = { request_id: other, search_id: id, expected_revision: 1,
      ...(command === 'delete' ? { expected_application_count: 0 } : { expected_current_ids: [] }) };
    const code = await runCLI(['hunts', command, '--file', '-', '--json'], {
      env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(value)]),
      stdout: new Writable({ write(_chunk, _, next) { next(); } }),
      stderr: new Writable({ write(chunk, _, next) { stderr += chunk; next(); } }),
      fetchImpl: async () => { calls++; return Response.json(ready(data)); },
    }, 'test');
    assert.equal(code, 2); assert.equal(JSON.parse(stderr).error.code, 'confirmation_required'); assert.equal(calls, 0);
  }
});

test('Hunt deletion checks migration readback and pipeline initialization checks all stages', async () => {
  const input = { request_id: other, search_id: id, expected_revision: 1, expected_application_count: 2,
    migrate_to_id: other, expected_target_revision: 3 };
  const deleted = { search_id: id, deleted: true, migrated_to_id: other, application_count: 2 };
  assert.deepEqual((await client(async () => Response.json(ready(deleted))).deleteHunt(input)).data, deleted);
  for (const patch of [{ search_id: other }, { migrated_to_id: null }, { application_count: 0 }])
    await assert.rejects(client(async () => Response.json(ready({ ...deleted, ...patch }))).deleteHunt(input), /invalid_response/);
  const pipeline = { items: [{ id, name: 'To Apply', type: 'initial' }], total: 1 };
  assert.deepEqual((await client(async () => Response.json(ready(pipeline))).initializePipeline({ request_id: other })).data, pipeline);
  await assert.rejects(client(async () => Response.json(ready({ ...pipeline, total: 2 }))).initializePipeline({ request_id: other }), /invalid_response/);
});

test('partial Hunt input preserves omission and null while refusing account-level settings', async () => {
  let calls = 0;
  const api = client(async () => { calls++; return Response.json(ready(data)); });
  const input = { request_id: other, search_id: id, expected_revision: 1 };
  for (const change of [{}, { status: null }, { preferences: { tone: 'warm' } }, { preferences: { role_interests: Array(21).fill('Synthetic') } },
    { preferences: { work_pattern: 'unknown' } }, { preferred_resume_id: '../other' }, { expected_revision: 0, status: 'paused' }])
    await assert.rejects(api.updateHunt({ ...input, ...change } as never), /invalid_input/);
  await assert.rejects(api.renameHunt({ ...input, name: ' ' }), /invalid_input/);
  assert.equal(calls, 0);
});

test('Hunt summary and partial update use original operations and bind returned identity', async () => {
  const input = { request_id: other, search_id: id, expected_revision: 1,
    preferences: { role_interests: null, locations: [], work_pattern: null }, preferred_resume_id: null };
  const summary = { id, name: 'Synthetic hunt', revision: 2, status: 'active', preferences: { role_interests: [], locations: [] }, preferred_resume: null };
  let answer: unknown = summary; let calls = 0;
  const api = client(async (url, init) => {
    calls++; const path = new URL(String(url)).pathname;
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    if (path.endsWith('get_job_search')) return Response.json(ready(answer));
    assert.ok(path.endsWith('update_job_search')); assert.deepEqual(JSON.parse(String(init?.body)), input);
    return Response.json({ ...ready(answer), operation: { id: other, kind: 'update_job_search', status: 'succeeded',
      resource: { id, kind: 'search', label: 'Synthetic hunt', revision: 2 }, retry_after_seconds: 0, retry_expires_at: '2026-10-23T00:00:00Z' } });
  });
  assert.deepEqual((await api.getHuntSummary({ search_id: id })).data, summary);
  assert.deepEqual((await api.updateHunt(input)).data, summary);
  answer = { ...summary, id: other };
  await assert.rejects(api.getHuntSummary({ search_id: id }), /invalid_response/);
  await assert.rejects(api.updateHunt(input), /invalid_response/);
  assert.equal(calls, 4);
});

test('bounded Hunt rename retains the native rename receipt and permits fresh later state', async () => {
  const input = { request_id: other, search_id: id, expected_revision: 1, name: 'Synthetic rename' };
  let receiptKind = 'rename_hunt_v2';
  const api = client(async (url, init) => {
    assert.ok(new URL(String(url)).pathname.endsWith('rename_hunt_record_v2'));
    assert.deepEqual(JSON.parse(String(init?.body)), input);
    return Response.json({ ...ready({ ...hunt, name: 'Synthetic later edit', revision: 3 }), website_url: 'https://jobhunt.app/app',
      operation: { id: other, kind: receiptKind, status: 'succeeded', resource: { id, kind: 'search', label: 'Hunt', revision: 2 },
        retry_after_seconds: 0, retry_expires_at: '2026-10-23T00:00:00Z' } });
  });
  assert.equal((await api.renameHunt(input)).data?.revision, 3);
  receiptKind = 'rename_hunt_record_v2';
  await assert.rejects(api.renameHunt(input), /invalid_response/);
});

test('Hunt creation accepts optional freeform notes without interpreting targeting',async()=>{
  const {huntCreateInput}=await import('../client/src/hunt-contracts.ts');
  const original={request_id:other,name:'Research hunt',notes_text:'Goals, ideas\n\nNext steps'};
  assert.deepEqual(huntCreateInput(original),original);
  assert.deepEqual(huntCreateInput({request_id:other,name:'Research hunt'}),{request_id:other,name:'Research hunt'});
  assert.throws(()=>huntCreateInput({...original,notes_text:'x'.repeat(5001)}));
  assert.throws(()=>huntCreateInput({...original,notes_text:['wrong type']}));
});
