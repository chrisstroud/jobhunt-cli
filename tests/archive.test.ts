import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';
const id = '11111111-1111-4111-8111-111111111111', sibling = '22222222-2222-4222-8222-222222222222', request = '33333333-3333-4333-8333-333333333333';
const document = { id, slug: 'synthetic', name: 'Synthetic document', archetype: 'structured', revision: 1,
  is_archived: false, is_primary: null, package_anchor_id: null, is_role_copy: false, has_public_link: true };
const state = { document_id: id, anchor_id: id, fingerprint: 'a'.repeat(64), items: [document], member_count: 2,
  archived_count: 0, internal_contact_count: 1, total: 1, page: 1, has_more: false };
const page = { items: [document], status: 'all', total: 1, page: 1, has_more: false };
const intent = { document_id: sibling, expected_anchor_id: id, expected_fingerprint: state.fingerprint, request_id: request };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-archive-token' }, fetchImpl });

test('archive review retains a sibling selection and exact whole-package footprint', async () => {
  const client = api(async (url, init) => {
    const target = new URL(String(url)); assert.equal(target.pathname, '/api/v1/journey/get_document_archive_state_v2');
    assert.deepEqual(JSON.parse(target.searchParams.get('arguments')!), { document_id: sibling, page: 2 });
    assert.equal(init?.credentials, 'omit'); return Response.json(ready({ ...state, document_id: sibling, items: [], page: 2 }));
  });
  assert.equal((await client.documentArchiveState({ document_id: sibling, page: 2 })).data?.anchor_id, id);
});

test('archive writes preserve reviewed intent and accept fresh state after later unarchive or deletion', async () => {
  const bodies: unknown[] = [];
  const client = api(async (url, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    bodies.push(JSON.parse(String(init?.body))); return Response.json(ready({ anchor_id: id, current: String(url).includes('/unarchive_') ? null : state }));
  });
  await client.archiveDocumentPackage(intent); await client.archiveDocumentPackage(intent); await client.unarchiveDocumentPackage(intent);
  assert.deepEqual(bodies, [intent, intent, intent]);
});

test('archive wire validation rejects missing review, policy fields and invalid pages before HTTP', async () => {
  let calls = 0; const client = api(async () => { calls++; return Response.json(ready({ anchor_id: id, current: state })); });
  for (const patch of [{ expected_anchor_id: 'bad' }, { expected_fingerprint: '' }, { request_id: 'bad' }, { published_url: null }, { is_archived: true }])
    await assert.rejects(client.archiveDocumentPackage({ ...intent, ...patch } as never), /invalid_input/);
  await assert.rejects(client.listLibraryDocuments({ status: 'deleted' } as never), /invalid_input/);
  await assert.rejects(client.documentArchiveState({ document_id: id, page: 0 }), /invalid_input/);
  assert.equal(calls, 0);
});

test('archive response rejects wrong selection, inconsistent hidden counts and changed anchor', async () => {
  for (const value of [{ ...state, document_id: sibling }, { ...state, member_count: 1 },
    { ...state, archived_count: 3 }, { ...state, has_more: true }, { ...state, items: [document, document] }])
    await assert.rejects(api(async () => Response.json(ready(value))).documentArchiveState({ document_id: id }), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ anchor_id: sibling, current: null }))).archiveDocumentPackage(intent), /invalid_response/);
});

test('archive discovery validates the exact requested filter and preserves nullable legacy metadata', async () => {
  const legacy = { ...page, items: [{ ...document, name: null, archetype: null, is_archived: null }] };
  assert.deepEqual((await api(async () => Response.json(ready(legacy))).listLibraryDocuments({ status: 'all' })).data, legacy);
  for (const value of [{ ...page, status: 'active' }, { ...page, page: 2 }])
    await assert.rejects(api(async () => Response.json(ready(value))).listLibraryDocuments({ status: 'all' }), /invalid_response/);
});

test('four archive domain commands use typed routes and explicit reviewed JSON', async () => {
  for (const [args, body, operation, data] of [
    [['library', 'documents', '--status', 'all'], null, 'list_library_documents_v2', page],
    [['library', 'archive-review', id], null, 'get_document_archive_state_v2', state],
    [['library', 'archive', '--file', '-'], intent, 'archive_document_package_v2', { anchor_id: id, current: state }],
    [['library', 'unarchive', '--file', '-'], intent, 'unarchive_document_package_v2', { anchor_id: id, current: state }],
  ] as const) {
    let calls = 0;
    const code = await runCLI([...args, '--json'], { env: { JOBHUNT_TOKEN: 'synthetic-archive-token' }, stdin: Readable.from([JSON.stringify(body)]),
      stdout: new Writable({ write(_c, _e, next) { next(); } }), stderr: new Writable({ write(_c, _e, next) { next(); } }),
      fetchImpl: async (url, init) => { calls++; assert.equal(init?.credentials, 'omit');
        assert.equal(new URL(String(url)).pathname, '/api/v1/journey/' + operation); return Response.json(ready(data)); },
    }, 'test');
    assert.equal(code, 0); assert.equal(calls, 1);
  }
});
