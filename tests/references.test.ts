import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { recordReferenceIdentity } from '../client/src/reference-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const uri = (kind = 'documents', identifier = id, revision = 1) => `jobhunt://${kind}/${identifier}?revision=${revision}`;
const application = { id, title: '🙂'.repeat(255), company: 'Synthetic', revision: 1, stage: '', capture_state: 'partial', submission_known: false, offer_known: false };
const document = { id, slug: 'synthetic-document', name: '🙂'.repeat(255), revision: 1, type: 'resume', archetype: 'structured', relation: 'master',
  sections: [{ name: 'summary', text: null, entries: [{ fields: [{ field: '/summary', value: '🙂'.repeat(10000), state: 'uncertain', sources: [] }] }] }],
  display_settings: {}, design: 'historical', uncertain_fields: ['/summary'] };
const resolved = (kind: 'application' | 'document' = 'document') => ({ outcome: 'ready', revision: 1,
  website_url: kind === 'application' ? `https://jobhunt.app/app/applications/id/${id}` : 'https://jobhunt.app/app/documents/synthetic-document',
  data: kind === 'application' ? { kind, selection: { version: 1, application_id: id, application_revision: 1 }, application: structuredClone(application) } :
    { kind, selection: { version: 1, document_id: id, document_revision: 1 }, document: structuredClone(document) }, next_action: { kind: 'read', label: 'Review' } });
const link = { uri: uri(), name: 'Synthetic saved record', title: 'Synthetic saved record', description: 'Select to read' };
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_reference_credential' }, fetchImpl });

test('reference lookup preserves defaults, exact query and plain bounded resource-link results', async () => {
  let calls = 0;
  const client = api(async (url, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    assert.equal(new URL(String(url)).pathname, '/api/v1/journey/find_job_hunt_records');
    assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), { query: calls++ ? '🙂'.repeat(120) : '' });
    return Response.json({ items: [link], has_more: false });
  });
  assert.deepEqual(await client.findRecordReferences(), { items: [link], has_more: false });
  await client.findRecordReferences({ query: '🙂'.repeat(120) }); assert.equal(calls, 2);
});

test('reference resolution preserves full Unicode document facts and application selection', async () => {
  for (const kind of ['application', 'document'] as const) {
    const value = resolved(kind);
    const result = await api(async (url) => {
      assert.equal(new URL(String(url)).pathname, '/api/v1/journey/get_job_hunt_reference');
      assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), { uri: uri(kind === 'application' ? 'applications' : 'documents') });
      return Response.json(value);
    }).getRecordReference({ uri: uri(kind === 'application' ? 'applications' : 'documents') });
    assert.deepEqual(result, value);
  }
  const role = resolved();
  Object.assign(role.data.document!, { relation: 'role_draft', application_id: other });
  Object.assign(role.data.selection, { application_id: other, application_revision: 3 });
  assert.deepEqual(await api(async () => Response.json(role)).getRecordReference({ uri: uri() }), role);
});

test('invalid reference queries and noncanonical URIs fail before IO', async () => {
  let calls = 0; const client = api(async () => { calls++; return Response.json({}); });
  for (const input of [{ query: null }, { query: '🙂'.repeat(121) }, { query: 'x\0' }, { page: 2 }])
    await assert.rejects(client.findRecordReferences(input as never), /invalid_input/);
  for (const value of [uri() + '\n', uri() + '#fragment', uri() + '&revision=1', uri().replace('revision=1', 'revision=01'),
    uri().replace('revision=1', 'revision=0'), uri().replace('documents', 'contacts'), uri().replace('jobhunt:', 'https:'), uri().replace('11111111', 'AAAAAAAA'), '', undefined]) {
    assert.equal(recordReferenceIdentity(value), null);
    await assert.rejects(client.getRecordReference({ uri: value as string }), /invalid_input/);
  }
  assert.equal(calls, 0);
});

test('lookup rejects malformed metadata, duplicate/excess links and contradictory truncation', async () => {
  for (const value of [{ items: [link, link], has_more: false }, { items: Array(21).fill(link), has_more: true },
    { items: [link], has_more: true }, { items: [{ ...link, mimeType: 'text/html' }], has_more: false },
    { items: [{ ...link, type: 'text' }], has_more: false }, { items: [{ ...link, uri: 'https://outside.example.test' }], has_more: false },
    { items: [{ ...link, description: 'x'.repeat(161) }], has_more: false }])
    await assert.rejects(api(async () => Response.json(value)).findRecordReferences(), /invalid_response/);
});

test('resolution binds record, revision, parent selection and canonical destination', async () => {
  for (const change of [
    (v: ReturnType<typeof resolved>) => { v.revision = 2; },
    (v: ReturnType<typeof resolved>) => { v.website_url += '?other=1'; },
    (v: ReturnType<typeof resolved>) => { v.data.document!.id = other; v.data.selection.document_id = other; },
    (v: ReturnType<typeof resolved>) => { v.data.selection.document_revision = 2; },
    (v: ReturnType<typeof resolved>) => { Object.assign(v.data.selection, { application_id: other, application_revision: 1 }); },
    (v: ReturnType<typeof resolved>) => { v.data.document!.name = '🙂'.repeat(256); },
  ]) {
    const value = structuredClone(resolved()); change(value);
    await assert.rejects(api(async () => Response.json(value)).getRecordReference({ uri: uri() }), /invalid_response/);
  }
  await assert.rejects(api(async () => Response.json(resolved('application'))).getRecordReference({ uri: uri() }), /invalid_response/);
});

test('domain CLI dispatches find/get and rejects incomplete or unsupported selections', async () => {
  let stdout = ''; let calls = 0;
  const io = { env: { JOBHUNT_TOKEN: 'synthetic_reference_credential' }, stdin: Readable.from([]),
    fetchImpl: async (url: string | URL | Request) => {
      const args = JSON.parse(new URL(String(url)).searchParams.get('arguments')!); calls++;
      if (calls === 1) { assert.deepEqual(args, { query: 'Synthetic' }); return Response.json({ items: [link], has_more: false }); }
      assert.deepEqual(args, { uri: uri() }); return Response.json(resolved());
    }, stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(_chunk, _, done) { done(); } }) };
  assert.equal(await runCLI(['references', 'find', '--query', 'Synthetic', '--json', '--non-interactive'], io, 'test'), 0);
  assert.deepEqual(JSON.parse(stdout), { items: [link], has_more: false }); stdout = '';
  assert.equal(await runCLI(['references', 'get', '--uri', uri(), '--json', '--non-interactive'], io, 'test'), 0);
  assert.equal(JSON.parse(stdout).data.document.id, id);
  assert.equal(await runCLI(['references', 'get', '--json', '--non-interactive'], io, 'test'), 2);
  assert.equal(await runCLI(['references', 'find', '--page', '2', '--json', '--non-interactive'], io, 'test'), 2);
  assert.equal(calls, 2);
});
