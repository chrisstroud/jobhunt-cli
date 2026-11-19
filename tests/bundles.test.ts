import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { JobHuntClient, type BundleSelection } from '../client/src/index.ts';
import { bundleSourceInput, ZIP } from '../client/src/bundle-contracts.ts';

const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const hash = 'a'.repeat(64);
const selection: BundleSelection = { source: 'document', document_id: id, documents: ['resume', 'references'], format: 'zip' };
const source = { source: 'bundle', bundle_kind: 'document', selection, sources: [{ id, revision: 1 }], fingerprint: hash,
  format: 'zip', render_date: '2026-10-19', members: ['Synthetic-Resume.pdf', 'Synthetic-References.pdf'], download_name: 'Synthetic-Documents.zip' };
const state = { ...source, id: other, status: 'pending', expires_at: new Date(Date.now() + 86400000).toISOString(), media_type: ZIP, sha256: null, size_bytes: null };
const intent = { selection, expected_sources: source.sources, expected_fingerprint: hash, request_id: other, expected_account_id: 'jh_' + id };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'read', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_bundle_credential' }, fetchImpl });

test('bundle selection rejects duplicates, unbounded lists and mixed source selectors before I/O', () => {
  for (const value of [
    { ...selection, documents: ['resume', 'resume'] }, { ...selection, application_id: other },
    { source: 'library', document_ids: [] }, { source: 'library', document_ids: Array(51).fill(id) },
    { source: 'library', document_ids: [id, id.toUpperCase()] }, { ...selection, documents: ['all'] },
  ]) assert.throws(() => bundleSourceInput({ selection: value }), /invalid_input/);
  assert.deepEqual(bundleSourceInput({ selection: { source: 'library', document_ids: [id] } }),
    { selection: { source: 'library', document_ids: [id], format: 'json_zip' } });
});

test('bundle response must match complete selected sources, ordered members and reviewed fingerprint', async () => {
  assert.deepEqual((await api(async () => Response.json(ready(source))).getDocumentBundleSource({ selection })).data, source);
  for (const value of [
    { ...source, members: ['only-one.pdf'] }, { ...source, members: ['../escape.pdf', 'Synthetic.pdf'] },
    { ...source, sources: [{ id: other, revision: 1 }] }, { ...source, format: 'pdf' },
    { ...source, selection: { ...selection, documents: ['references', 'resume'] } },
  ]) await assert.rejects(api(async () => Response.json(ready(value))).getDocumentBundleSource({ selection }), /invalid_response/);
  let calls = 0;
  await api(async (_url, init) => { calls++; assert.deepEqual(JSON.parse(String(init?.body)), intent); return Response.json(ready(state)); }).prepareDocumentBundle(intent);
  await assert.rejects(api(async () => { calls++; throw Error('synthetic private detail'); }).prepareDocumentBundle(intent), /network_error|request_failed/);
  assert.equal(calls, 2);
  await assert.rejects(api(async () => Response.json(ready({ ...state, sources: [{ id, revision: 2 }] }))).prepareDocumentBundle(intent), /invalid_response/);
});

test('bundle failed-state reads preserve a structured terminal result', async () => {
  const result = { ...ready({ ...state, status: 'failed' }), outcome: 'failed', error: { code: 'processing_failed', message: 'Review and prepare again.' } };
  assert.deepEqual(await api(async () => Response.json(result)).getDocumentBundle({ export_id: other }), result);
});

test('ZIP transfer validates exact bytes without forwarding credentials, extracting files or exposing grants', async () => {
  const content = Buffer.from([80, 75, 3, 4, 5, 6, 7, 8]);
  const grant = { export_id: other, url: 'https://objects.example.test/private?grant=synthetic', method: 'GET',
    expires_at: new Date(Date.now() + 60000).toISOString(), media_type: ZIP, sha256: createHash('sha256').update(content).digest('hex'),
    size_bytes: content.length, reusable_until_expiry: true, download_name: 'Synthetic.zip' };
  let calls = 0;
  const client = api(async (_url, init) => {
    if (++calls === 1) return Response.json(ready(grant));
    assert.equal(new Headers(init?.headers).has('Authorization'), false); assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    return new Response(content, { headers: { 'Content-Type': ZIP } });
  });
  const saved = await client.downloadDocumentBundle({ export_id: other });
  assert.deepEqual(Buffer.from(saved.bytes), content); assert.equal('url' in saved, false);
  for (const data of [Buffer.from('invalid!'), Buffer.concat([content, content]), content.subarray(0, 5)]) {
    let index = 0;
    await assert.rejects(api(async () => ++index === 1 ? Response.json(ready(grant)) : new Response(data, { headers: { 'Content-Type': ZIP } })).downloadDocumentBundle({ export_id: other }), /invalid_download|download_checksum_mismatch/);
  }
});


test('independent package selections preserve complete ordered sources and reject partial or foreign responses', async () => {
  const selection:BundleSelection={source:'package',document_ids:[other,id],format:'zip',page_size:'a4'};
  const view={...source,bundle_kind:'package',selection,sources:[{id:other,revision:2},{id,revision:1}],members:['01-Cover.pdf','02-Resume.pdf']};
  assert.deepEqual((await api(async()=>Response.json(ready(view))).getDocumentBundleSource({selection})).data,view);
  for(const picked of [{...selection,document_ids:[]},{...selection,document_ids:[id,id.toUpperCase()]},{...selection,document_ids:Array(9).fill(id)},
    {...selection,page_size:null},{...selection,format:'docx'},{...selection,document_id:id}]) {
    assert.throws(()=>bundleSourceInput({selection:picked}),/invalid_input/);
  }
  for(const changed of [{...view,sources:view.sources.slice(1)},{...view,sources:[...view.sources].reverse()},{...view,members:['only-one.pdf']},
    {...view,selection:{...selection,document_ids:[id,other]}}]) {
    await assert.rejects(api(async()=>Response.json(ready(changed))).getDocumentBundleSource({selection}),/invalid_response/);
  }
});
