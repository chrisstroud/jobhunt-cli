import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, type LibraryPackageAdd } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';
const id = '11111111-1111-4111-8111-111111111111', created = '22222222-2222-4222-8222-222222222222', request = '33333333-3333-4333-8333-333333333333';
const summary = { id, slug: 'synthetic-master', name: 'Synthetic master', revision: 1, archetype: 'structured', is_primary: false,
  package_anchor_id: null, application_count: 0, version_count: 1, published_url: null, updated_at: null, typst_style_name: null, contact_profile_id: null };
const page = { packages: [{ ...summary, document_count: 1 }], documents: [summary], selected: summary,
  default_id: id, page: 1, total: 1, has_more: false, documents_page: 1, documents_total: 1, documents_have_more: false };
const document = { id: created, slug: 'synthetic-letter', name: 'Synthetic letter', revision: 1, type: 'cover_letter', archetype: 'letter',
  relation: 'master', sections: [], display_settings: {}, design: 'linen', uncertain_fields: [] };
const saved = { document_id: created, document, deleted: false, is_primary: false };
const removed = { document_id: id, document: null, deleted: true, is_primary: false };
const add: LibraryPackageAdd = { request_id: request, document_id: id, expected_revision: 1, name: 'Synthetic letter', archetype: 'letter' };
const deletion = { request_id: request, document_id: id, expected_revision: 1, expected_document_ids: [id, created] };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-library-token' }, fetchImpl });

test('master package pages preserve independent selectors and member pagination', async () => {
  const result = await api(async (url, init) => {
    const target = new URL(String(url)); assert.equal(target.pathname, '/api/v1/journey/list_document_packages_v2');
    assert.deepEqual(JSON.parse(target.searchParams.get('arguments')!), { package_id: id, page: 2, documents_page: 2 });
    assert.equal(init?.credentials, 'omit'); return Response.json(ready({ ...page, page: 2, packages: [], documents_page: 2, documents: [] }));
  }).listLibraryPackages({ package_id: id, page: 2, documents_page: 2 });
  assert.equal(result.data?.selected?.id, id);
});

test('library mutations preserve exact reviewed input and never publish or retry automatically', async () => {
  const bodies: unknown[] = [];
  const client = api(async (url, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    bodies.push(JSON.parse(String(init?.body))); return Response.json(ready(String(url).includes('/add_') ? saved : removed));
  });
  await client.addLibraryDocument(add); await client.addLibraryDocument(add); await client.deleteLibraryPackage(deletion);
  assert.deepEqual(bodies, [add, add, deletion]);
});

test('library validates complete membership, allowed fields and wire bounds before requests', async () => {
  let calls = 0; const client = api(async () => { calls++; return Response.json(ready(saved)); });
  for (const patch of [{ expected_document_ids: [] }, { expected_document_ids: [id, id] }, { expected_document_ids: Array(1001).fill(id) },
    { expected_document_ids: ['bad'] }, { expected_revision: 0 }, { confirm: true }])
    await assert.rejects(client.deleteLibraryPackage({ ...deletion, ...patch } as never), /invalid_input/);
  for (const patch of [{ archetype: 'contact' }, { name: ' ' }, { published_url: 'https://example.invalid/' }, { content: {} }])
    await assert.rejects(client.addLibraryDocument({ ...add, ...patch } as never), /invalid_input/);
  await assert.rejects(client.listLibraryPackages({ documents_page: 0 }), /invalid_input/);
  await assert.rejects(client.documentUsage({ document_id: id, page: 10001 }), /invalid_input/);
  assert.equal(calls, 0);
});

test('library refuses wrong selected package, mismatched deletion and malformed metadata', async () => {
  for (const data of [{ ...page, selected: { ...summary, id: created } }, { ...page, documents_have_more: true },
    { ...page, documents: [summary, summary] }, { ...page, packages: [{ ...summary, document_count: -1 }] }])
    await assert.rejects(api(async () => Response.json(ready(data))).listLibraryPackages({ package_id: id }), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ ...removed, document_id: created }))).deleteLibraryPackage(deletion), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready(removed))).addLibraryDocument(add), /invalid_response/);
});

test('document usage enforces exact identity and next-page cursor without fetching public URLs', async () => {
  const value = { document_id: id, applications: [{ slug: 'synthetic-role', company: null, position: 'Synthetic role' }], next_page: null };
  assert.deepEqual((await api(async () => Response.json(ready(value))).documentUsage({ document_id: id })).data, value);
  for (const data of [{ ...value, document_id: created }, { ...value, next_page: 3 }, { ...value, applications: [value.applications[0], value.applications[0]] }])
    await assert.rejects(api(async () => Response.json(ready(data))).documentUsage({ document_id: id }), /invalid_response/);
});

test('package deletion requires exact CLI confirmation before HTTP; all four commands route correctly', async () => {
  for (const [args, value, operation, data, expected] of [
    [['library', 'packages'], null, 'list_document_packages_v2', page, 0],
    [['documents', 'usage', id], null, 'list_document_usage_v2', { document_id: id, applications: [], next_page: null }, 0],
    [['library', 'add-document', '--file', '-'], add, 'add_package_document_v2', saved, 0],
    [['library', 'delete-package', '--file', '-'], deletion, 'delete_document_package_v2', removed, 2],
    [['library', 'delete-package', '--file', '-', '--confirm', id], deletion, 'delete_document_package_v2', removed, 0],
  ] as const) {
    let calls = 0;
    const code = await runCLI([...args, '--json'], { env: { JOBHUNT_TOKEN: 'synthetic-library-token' }, stdin: Readable.from([JSON.stringify(value)]),
      stdout: new Writable({ write(_c, _e, next) { next(); } }), stderr: new Writable({ write(_c, _e, next) { next(); } }),
      fetchImpl: async (url, init) => { calls++; assert.equal(init?.credentials, 'omit'); assert.equal(new URL(String(url)).pathname, '/api/v1/journey/' + operation); return Response.json(ready(data)); },
    }, 'test');
    assert.equal(code, expected); assert.equal(calls, expected ? 0 : 1);
  }
});
