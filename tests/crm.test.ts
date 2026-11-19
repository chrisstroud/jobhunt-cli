import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, type CrmMutation } from '../client/src/index.ts';
import { crmMutationInput } from '../client/src/crm-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const hash = 'a'.repeat(64), token = 'synthetic_crm_credential';
const company = { id, name: 'Synthetic company', description: null, industry: null, location: null,
  size: null, status: 'target', website: null, isTarget: true, applicationCount: 0, contactCount: 0,
  furthestStage: null, lastActivity: null };
const workspace = { company, tasks: [], notes: [], applications: [], contacts: [], activity: [], truncated: false };
const data = { entity_id: id, workspace, fingerprint: hash, deleted: false, item_id: null,
  related_page: 1, related_has_more: false, changed_item: null };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });
const save: CrmMutation = { kind: 'company', action: 'update', entity_id: id, expected_fingerprint: hash,
  request_id: other, fields: { description: null, is_target: false } };

test('CRM rejects malformed review, foreign-kind fields, links and unbounded content before I/O', async () => {
  let calls = 0;
  const api = client(async () => { calls++; return Response.json(ready(data)); });
  for (const patch of [
    { expected_fingerprint: '' }, { request_id: '' }, { entity_id: '../other' }, { fields: {} },
    { fields: { email: 'synthetic@example.test' } }, { fields: { name: ' ' } },
    { fields: { website: 'https://user:secret@example.test' } }, { fields: { website: 'javascript:alert(1)' } },
    { fields: { description: 'x'.repeat(12001) } }, { fields: { is_target: null } },
    { action: 'interaction_save', title: 'Synthetic call' }, { action: 'note_delete', item_id: null },
    { action: 'create', fields: { name: 'Synthetic' } },
  ]) await assert.rejects(api.saveCrmCompany({ ...save, ...patch } as CrmMutation), /invalid_input/);
  await assert.rejects(api.saveCrmContact(save), /invalid_input/);
  for (const page of [0, -1, 10001, 1.5, null, NaN]) await assert.rejects(api.listCrm({ kind: 'company', page: page as number }), /invalid_input/);
  assert.equal(calls, 0);
  assert.deepEqual(crmMutationInput(save), save);
});

test('CRM requests preserve reviewed intents, explicit null/false and complete returned state', async () => {
  const bodies: unknown[] = [];
  const api = client(async (url, init) => {
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/save_workspace_company_v2');
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    bodies.push(JSON.parse(String(init?.body))); return Response.json(ready(data));
  });
  assert.deepEqual((await api.saveCrmCompany(save)).data, data);
  await api.saveCrmCompany(save);
  assert.deepEqual(bodies, [save, save]);
  const changed = { ...data, changed_item: { id: 'synthetic-note', body: 'Saved outside first page' } };
  assert.deepEqual((await client(async () => Response.json(ready(changed))).saveCrmCompany(save)).data?.changed_item, changed.changed_item);
});

test('CRM reads reject wrong records, kind, page and silently truncated related state', async () => {
  for (const malformed of [
    { ...data, entity_id: other }, { ...data, related_page: 2 }, { ...data, related_has_more: true },
    { ...data, fingerprint: '' }, { ...data, workspace: { ...workspace, contacts: null } },
    { ...data, workspace: { ...workspace, company: { ...company, id: other } } },
    { ...data, deleted: true },
  ]) await assert.rejects(client(async () => Response.json(ready(malformed))).getCrm({ kind: 'company', entity_id: id }), /invalid_response/);
  const page = { items: [company], page: 1, total: 1, has_more: false };
  assert.deepEqual((await client(async () => Response.json(ready(page))).listCrm({ kind: 'company' })).data, page);
  for (const malformed of [{ ...page, page: 2 }, { ...page, items: Array(21).fill(company) },
    { ...page, has_more: null }, { ...page, items: [{ ...company, contactCount: -1 }] }])
    await assert.rejects(client(async () => Response.json(ready(malformed))).listCrm({ kind: 'company' }), /invalid_response/);
});

test('CRM relationship writes require exact application revision and preserve explicit role/primary intent', () => {
  const link: CrmMutation = { kind: 'contact', action: 'link_application', entity_id: id,
    expected_fingerprint: hash, request_id: other, application_id: other, expected_application_revision: 2,
    role: 'referral', is_primary: false };
  assert.deepEqual(crmMutationInput(link), link);
  for (const patch of [{ application_id: null }, { expected_application_revision: 0 },
    { expected_application_revision: true }, { role: 'unknown' }, { is_primary: null }])
    assert.throws(() => crmMutationInput({ ...link, ...patch }), /invalid_input/);
});

test('CRM CLI deletion requires the reviewed target before I/O', async () => {
  let calls = 0;
  const input = { ...save, action: 'delete', fields: undefined };
  async function run(confirm?: string) {
    let stdout = '', stderr = '';
    const code = await runCLI(['crm', 'save-company', '--file', '-', '--json', ...(confirm ? ['--confirm', confirm] : [])], {
      env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(input)]),
      stdout: new Writable({ write(chunk, _, next) { stdout += chunk; next(); } }),
      stderr: new Writable({ write(chunk, _, next) { stderr += chunk; next(); } }),
      fetchImpl: async () => { calls++; return Response.json(ready({ ...data, deleted: true, workspace: null, fingerprint: null })); },
    }, 'test');
    return { code, stdout, stderr };
  }
  for (const confirm of [undefined, other]) {
    const result = await run(confirm); assert.equal(result.code, 2); assert.equal(result.stdout, '');
    assert.equal(JSON.parse(result.stderr).error.code, 'confirmation_required');
  }
  assert.equal(calls, 0);
  assert.equal((await run(id)).code, 0); assert.equal(calls, 1);
});

test('CRM deletion accepts omitted related-page defaults while rejecting a deleted workspace', async () => {
  const input: CrmMutation = { ...save, action: 'delete', fields: undefined };
  const removed = { entity_id: id, workspace: null, fingerprint: null, item_id: null, deleted: true };
  assert.deepEqual((await client(async () => Response.json(ready(removed))).saveCrmCompany(input)).data, removed);
  for (const patch of [{ workspace }, { fingerprint: hash }, { related_has_more: true }])
    await assert.rejects(client(async () => Response.json(ready({ ...removed, ...patch }))).saveCrmCompany(input), /invalid_response/);
});
