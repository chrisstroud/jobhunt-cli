import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, prepareSectionSave } from '../client/src/index.ts';
import { confirmResumeImportInput, createCareerDocumentInput, updateCareerSectionInput } from '../client/src/document-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const token = 'synthetic_document_credential';
const fact = { field: '/summary', value: 'Synthetic career statement', state: 'confirmed' as const, sources: [{ kind: 'user_statement' as const }] };
const section = { name: 'summary', text: null, entries: [{ fields: [fact] }] };
const document = { id, slug: 'synthetic-resume', name: 'Synthetic resume', revision: 1, type: 'resume', archetype: 'structured',
  relation: 'master', sections: [section], display_settings: {}, design: 'linen', uncertain_fields: [] };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const intent = { document_id: id, expected_revision: 1, request_id: requestId, expected_account_id: 'jh_' + id };
const create = { request_id: requestId, name: 'Synthetic resume', content: { sections: [section] } };
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });

test('document authoring retains exact facts, sources, revisions and original intent across retries', async () => {
  const calls: { path: string; body: unknown }[] = [];
  const api = client(async (url, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    calls.push({ path: new URL(String(url)).pathname, body: JSON.parse(String(init?.body)) });
    return Response.json(ready(document));
  });
  const edit = { request_id: requestId, template_slug: document.slug, section: 'summary', data: section, expected_revision: 1 };
  await api.createDocument(create); await api.updateDocumentSection(edit); await api.updateDocumentSection(edit);
  const restore = { ...intent, version_id: requestId };
  await api.restoreDocument(restore);
  assert.deepEqual(calls.map(c => c.body), [create, edit, edit, restore]);
  assert.deepEqual(calls.map(c => c.path.split('/').at(-1)), ['create_resume_template_v2', 'update_resume_section_v2', 'update_resume_section_v2', 'restore_document_revision']);
  let count = 0;
  await assert.rejects(client(async () => { count++; throw Error('Synthetic connection loss'); }).createDocument(create), /network_error/);
  assert.equal(count, 1);
});

test('section wire validation rejects ambiguous content, unknown fields, duplicate sections and malformed provenance', () => {
  for (const bad of [{ ...section, text: 'Also text' }, { ...section, settings: {} }, { ...section, unexpected: true },
    { ...section, entries: [{ fields: [{ ...fact, sources: [{ kind: 'employer_verified' }] }] }] },
    { ...section, entries: [{ fields: [{ ...fact, sources: [{ kind: 'user_statement', unrecognized: 'ignored?' }] }] }] }]) {
    assert.throws(() => createCareerDocumentInput({ ...create, content: { sections: [bad] } }), /invalid_input/);
  }
  assert.throws(() => createCareerDocumentInput({ ...create, content: { sections: [section, section] } }), /invalid_input/);
  assert.throws(() => updateCareerSectionInput({ request_id: requestId, template_slug: 'resume', section: 'work', data: section, expected_revision: 1 }), /invalid_input/);
  const settings = { name: 'resume_settings', entries: [], settings: { section_order: ['summary', 'work'], section_visibility: { work: true } } };
  assert.equal(createCareerDocumentInput({ ...create, content: { sections: [settings] } }).content.sections[0].name, 'resume_settings');
  assert.throws(() => createCareerDocumentInput({ ...create, content: { sections: [{ ...settings, settings: { section_order: ['work', 'work'] } }] } }), /invalid_input/);
});

test('reviewed imports require exact confirmed or declined facts without inferring confirmation', () => {
  const input = { request_id: requestId, import_id: id, expected_revision: 1, accepted_facts: [fact] };
  assert.deepEqual(confirmResumeImportInput(input), input);
  for (const facts of [[], [{ ...fact, state: 'draft' }], [{ ...fact, state: 'uncertain' }], [{ ...fact, state: 'declined' }], [fact, fact]])
    assert.throws(() => confirmResumeImportInput({ ...input, accepted_facts: facts }), /invalid_input/);
});

test('library and history reads retain their distinct IDs, bounded pagination and legacy null revisions', async () => {
  const queries: URL[] = [];
  const api = client(async (url, init) => {
    const query = new URL(String(url)); queries.push(query); assert.equal(init?.method, 'GET');
    if (query.pathname.includes('resume-templates')) return Response.json({ data: [{ type: 'resume_template', id: document.slug,
      attributes: { template_id: id, name: document.name, application_count: 0, version_count: 1 } }], meta: {} });
    return Response.json(ready({ items: [{ id: requestId, kind: 'document', label: 'Legacy checkpoint', revision: null }], has_more: false, next_before_id: null }));
  });
  const library = await api.listDocuments({ page: 2, pageSize: 3 });
  assert.equal(library.data[0].id, document.slug); assert.equal(library.data[0].attributes.template_id, id);
  const history = await api.documentRevisions({ document_id: id, before_id: requestId });
  assert.equal(history.data!.items[0].revision, null);
  assert.equal(queries[0].searchParams.get('page[number]'), '2');
  assert.equal(JSON.parse(queries[1].searchParams.get('arguments')!).before_id, requestId);
  await assert.rejects(api.listDocuments({ pageSize: 101 }), /invalid_input/);
  await assert.rejects(api.getDocument('../other'), /invalid_input/);
  assert.equal(queries.length, 2);
});

test('malformed document results never become successful edits or deletions', async () => {
  for (const bad of [{ ...document, revision: 0 }, { ...document, design: 'unknown' },
    { ...document, sections: [{ ...section, entries: [{ fields: [{ ...fact, state: 'verified' }] }] }] }])
    await assert.rejects(client(async () => Response.json(ready(bad))).getDocument(id), /invalid_response/);
  await assert.rejects(client(async () => Response.json(ready({ document_id: id, document: null, deleted: false, is_primary: false }))).renameDocument({ ...intent, name: 'New' }), /invalid_response/);
});

test('delete, restore and fact confirmation require exact targets before network access', async () => {
  for (const [command, input, target, response] of [
    [['documents', 'delete'], intent, id, { document_id: id, deleted: true, is_primary: false }],
    [['documents', 'restore'], { ...intent, version_id: requestId }, id, document],
    [['resume-imports', 'confirm'], { request_id: requestId, import_id: id, expected_revision: 1, accepted_facts: [fact] }, id, document],
  ] as const) {
    let calls = 0;
    for (const confirm of [undefined, 'different-id', target]) {
      let stdout = '', stderr = '';
      const code = await runCLI([...command, '--file', '-', '--json', ...(confirm ? ['--confirm', confirm] : [])], {
        env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(input)]),
        stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
        stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
        fetchImpl: async (_url, init) => { calls++; assert.deepEqual(JSON.parse(String(init?.body)), input); return Response.json(ready(response)); },
      }, 'test');
      if (confirm === target) { assert.equal(code, 0); assert.ok(stdout); assert.equal(stderr, ''); }
      else { assert.equal(code, 2); assert.equal(stdout, ''); assert.equal(JSON.parse(stderr).error.code, 'confirmation_required'); assert.equal(calls, 0); }
    }
    assert.equal(calls, 1);
  }
});


test('section retry CLI uses exact original descriptor and requires document confirmation', async () => {
  const prepared = await prepareSectionSave({ ...intent, template_slug: 'synthetic-resume', section: 'summary', value: 'Synthetic after' });
  let calls = 0;
  for (const confirm of [undefined, 'other', id]) {
    let stdout = '', stderr = '';
    const code = await runCLI(['documents', 'close-section-save', '--file', '-', '--json', ...(confirm ? ['--confirm', confirm] : [])], {
      env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(prepared.original)]),
      stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
      fetchImpl: async (url, init) => {
        calls++; assert.equal(new URL(String(url)).pathname, '/api/v1/journey/close_document_section_original_v1');
        assert.deepEqual(JSON.parse(String(init?.body)), { ...prepared.original, confirm_close: true });
        return Response.json(ready({ request_id: requestId, document_id: id, payload_hash: prepared.payloadHash, outcome: 'closed' }));
      },
    }, 'test');
    if (confirm === id) { assert.equal(code, 0); assert.equal(JSON.parse(stdout).outcome, 'closed'); }
    else { assert.equal(code, 2); assert.equal(JSON.parse(stderr).error.code, 'confirmation_required'); assert.equal(calls, 0); }
  }
  assert.equal(calls, 1);
});
