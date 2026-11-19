import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const empty = () => ({ outcome: 'ready', next_action: { kind: 'read', label: 'Review' }, website_url: 'https://jobhunt.app/app', data: {
  website_url: 'https://jobhunt.app/app', context: { account: { id: 'jh_' + id }, search: null, resume: null, preferences: {}, choices: [], missing: [], next_actions: [] },
  selection: { version: 1 }, applications: { items: [], page: 1, total: 0, has_more: false },
  navigation: { hunts: [], hunts_page: 1, hunts_have_more: false, stages: [], documents: [], documents_page: 1, documents_have_more: false, documents_total: 0 },
} });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_workspace_credential' }, fetchImpl });
const application = { id, title: 'Synthetic role', company: 'Synthetic company', revision: 1, stage: '', capture_state: 'partial', submission_known: false, offer_known: false };
function selected() {
  const value = empty();
  value.website_url = value.data.website_url = `https://jobhunt.app/app/applications/id/${id}?tab=documents`;
  Object.assign(value.data.selection, { application_id: id, application_revision: 1 });
  Object.assign(value.data, { detail: { application: { ...application },
    documents: { application_id: id, app_slug: 'synthetic-role', revision: 'a'.repeat(64), fingerprint: 'b'.repeat(64), selected_id: null, documents: [], choices: [], changes: [], unresolved: [] },
    answers: { application_id: id, revision: 1, answers: [] }, packages: { application_id: id, items: [], has_more: false },
    submissions: { application_id: id, items: [], next_cursor: null, unavailable_legacy_count: 0 },
    submission_options: { application_id: id, stage: '', employer_url: null, today: '2026-10-21', timezone: null, prepared: [], external: [], prepared_have_more: false, external_have_more: false },
    tasks: { available: false, items: [], reason: 'insufficient_scope' },
  } });
  return value;
}

test('workspace preserves empty defaults, independent pages and Unicode filters', async () => {
  let calls = 0;
  const client = api(async (url, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/get_job_hunt_view');
    const args = JSON.parse(new URL(String(url)).searchParams.get('arguments')!);
    const value = empty();
    if (calls++) {
      assert.deepEqual(args, { page: 2, hunts_page: 3, documents_page: 4, query: '🙂'.repeat(120), status: 'Applied' });
      value.data.applications.page = 2; value.data.navigation.hunts_page = 3; value.data.navigation.documents_page = 4;
    } else assert.deepEqual(args, {});
    return Response.json(value);
  });
  assert.deepEqual(await client.getWorkspaceView(), empty());
  await client.getWorkspaceView({ page: 2, hunts_page: 3, documents_page: 4, query: '🙂'.repeat(120), status: 'Applied' });
  assert.equal(calls, 2);
});

test('workspace rejects malformed, ambiguous and out-of-range inputs before IO', async () => {
  let calls = 0; const client = api(async () => { calls++; return Response.json(empty()); });
  for (const args of [{ section: 'summary' }, { document_id: id, section: 'summary\n' }, { document_id: 'wrong' }, { owner_id: id },
    { page: 0 }, { page: null }, { page: 10001 }, { hunts_page: 1.5 }, { documents_page: true }, { query: null }, { query: '🙂'.repeat(121) },
    { include_application_records: 'true' }, { status: '' }]) await assert.rejects(client.getWorkspaceView(args as never), /invalid_input/);
  assert.equal(calls, 0);
});

test('workspace distinguishes missing optional task permission and binds every nested application', async () => {
  const value = selected();
  assert.deepEqual(await api(async () => Response.json(value)).getWorkspaceView({ application_id: id }), value);
  for (const field of ['documents', 'answers', 'packages', 'submissions', 'submission_options']) {
    const changed = structuredClone(value) as any; changed.data.detail[field].application_id = other;
    await assert.rejects(api(async () => Response.json(changed)).getWorkspaceView({ application_id: id }), /invalid_response/);
  }
  for (const change of [
    (v: any) => { v.data.detail.tasks.items = [{ id, title: 'Must not leak', revision: 1, due_at: null }]; },
    (v: any) => { v.data.detail.answers.revision = 2; },
    (v: any) => { v.data.selection.application_revision = 2; },
    (v: any) => { v.data.detail.workspace = { application_id: other }; },
    (v: any) => { v.website_url = v.data.website_url = `https://jobhunt.app/app/applications/id/${other}?tab=documents`; },
  ]) {
    const changed = structuredClone(value); change(changed);
    await assert.rejects(api(async () => Response.json(changed)).getWorkspaceView({ application_id: id }), /invalid_response/);
  }
});

test('workspace rejects substituted selections, pagination, Hunt lists and destinations', async () => {
  for (const change of [
    (v: any) => { v.data.applications.page = 2; },
    (v: any) => { v.data.navigation.documents_page = 2; },
    (v: any) => { v.data.navigation.hunts_page = 2; },
    (v: any) => { v.data.navigation.documents_total = 1; },
    (v: any) => { v.data.applications.has_more = true; },
    (v: any) => { v.data.applications.items = [{ ...application, search_id: other }]; v.data.applications.total = 1; },
    (v: any) => { v.website_url = v.data.website_url = 'https://outside.example.test/app'; },
    (v: any) => { v.website_url = v.data.website_url = 'https://jobhunt.app/appevil'; },
    (v: any) => { v.website_url = v.data.website_url = 'https://jobhunt.app/app/documents/unselected'; },
  ]) {
    const value = empty(); change(value);
    await assert.rejects(api(async () => Response.json(value)).getWorkspaceView(), /invalid_response/);
  }
  await assert.rejects(api(async () => Response.json(empty())).getWorkspaceView({ application_id: id }), /invalid_response/);
});

test('workspace CLI dispatches explicit selections, pages and optional record intent', async () => {
  let calls = 0; let stdout = '';
  const io = { env: { JOBHUNT_TOKEN: 'synthetic_workspace_credential' }, stdin: Readable.from([]),
    fetchImpl: async (url: string | URL | Request) => { calls++;
      const args = JSON.parse(new URL(String(url)).searchParams.get('arguments')!);
      assert.deepEqual(args, { application_id: id, page: 2, hunts_page: 3, documents_page: 4, include_application_records: true });
      const value = selected(); value.data.applications.page = 2; value.data.navigation.hunts_page = 3; value.data.navigation.documents_page = 4;
      Object.assign((value.data as any).detail, { workspace: { account_id: 'jh_' + id, application_id: id, revision: 1,
        ledger: { application: { uuid: id } }, reminders: [], target: null, unavailable: [], fingerprints: {} } });
      return Response.json(value);
    }, stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(_chunk, _, done) { done(); } }) };
  assert.equal(await runCLI(['workspace', 'get', '--application-id', id, '--page', '2', '--hunts-page', '3', '--documents-page', '4', '--include-records', '--json', '--non-interactive'], io, 'test'), 0);
  assert.equal(JSON.parse(stdout).data.selection.application_id, id);
  for (const args of [['--page', '1e2'], ['--section', 'summary'], ['--page', '-1'], ['extra']])
    assert.equal(await runCLI(['workspace', 'get', ...args, '--json', '--non-interactive'], io, 'test'), 2);
  assert.equal(calls, 1);
});
