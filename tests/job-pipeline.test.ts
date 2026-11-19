import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, type RecordSubmission } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';
import { captureJobDetailsInput, captureJobURLInput, editJobDetailsInput } from '../client/src/job-pipeline-contracts.ts';
import { recordSubmissionInput } from '../client/src/submission-contracts.ts';

const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const token = 'synthetic_pipeline_credential';
const intent = { application_id: id, expected_revision: 3, request_id: requestId, expected_account_id: 'jh_' + id };
const job = { id, title: 'Engineer', company: 'Synthetic Company', revision: 4, stage: 'Backlog',
  capture_state: 'captured', submission_known: false, offer_known: false };
const report = { id: requestId, application_id: id, date: '2026-10-19', evidence: 'user_report', document_knowledge: 'unknown',
  documents: [], prepared_id: null, destination: null, destination_known: false, supersedes_id: null, superseded: false, recorded_at: '2026-10-19T12:00:00Z' };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const reported: RecordSubmission = { ...intent, date: report.date, user_confirmed: true, document_knowledge: 'unknown' };
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });

test('versioned job writes keep the caller intent and never use cookies or retry a failed response', async () => {
  const sent: { path: string; body: unknown }[] = [];
  const api = client(async (url, init) => {
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error'); assert.equal(init?.method, 'POST');
    assert.equal((init?.headers as Record<string, string>)['Content-Type'], 'application/json');
    sent.push({ path: new URL(String(url)).pathname, body: JSON.parse(String(init?.body)) });
    return Response.json(ready(job));
  });
  const urlInput = { request_id: requestId, url: 'https://jobs.example.invalid/role', save_separately: false };
  const detailInput = { request_id: requestId, posting_text: 'Synthetic supplied posting', company: null };
  const targetInput = { request_id: requestId, name: 'Synthetic target', notes: 'Research only' };
  const edit = { ...intent, posting_text: null, source_url: null };
  const move = { ...intent, stage_id: id, closed_reason: 'User withdrew' };
  await api.saveJobURL(urlInput); await api.saveJobDetails(detailInput); await api.saveTargetCompany(targetInput);
  await api.editJobDetails(edit); await api.moveJobStage(move); await api.moveJobStage(move);
  assert.deepEqual(sent.map(x => x.path.split('/').at(-1)), ['save_job_url_v2', 'save_job_details', 'save_target_company_v2', 'edit_job_details', 'move_job_stage', 'move_job_stage']);
  assert.deepEqual(sent.map(x => x.body), [urlInput, detailInput, targetInput, edit, move, move]);
  let calls = 0;
  await assert.rejects(client(async () => { calls++; throw Error('Synthetic connection loss'); }).moveJobStage(move), /network_error/);
  assert.equal(calls, 1);
});

test('capture and edit reject ambiguous selections and accidental absent changes before transport', () => {
  for (const change of [{ search_id: id, job_search_slug: 'current' }, { status: '' }, { save_separately: 'yes' }, { request_id: '' }, { url: '\0' }, { unknown: true }])
    assert.throws(() => captureJobURLInput({ request_id: requestId, url: 'https://jobs.example.invalid/', ...change }), /invalid_input/);
  for (const value of [{}, { title: 'Engineer' }, { posting_text: ' ' }, { posting_text: 'x'.repeat(100001) }, { title: 'Engineer', company: 'Synthetic', location: null }])
    assert.throws(() => captureJobDetailsInput({ request_id: requestId, ...value }), /invalid_input/);
  for (const value of [{}, { title: null }, { company: '' }, { unexpected: true }, { expected_revision: 0, title: 'Engineer' }])
    assert.throws(() => editJobDetailsInput({ ...intent, ...value }), /invalid_input/);
  assert.equal(editJobDetailsInput({ ...intent, posting_text: null }).posting_text, null);
});

test('submission inputs cannot infer consent, evidence or an unknown document selection', () => {
  for (const change of [{ user_confirmed: false }, { user_confirmed: 'true' }, { date: '2026-02-30' }, { evidence: 'employer_verified' },
    { prepared_id: null }, { external_document_ids: [] }, { document_knowledge: 'prepared' },
    { document_knowledge: 'external', external_document_ids: [id, id] }, { document_knowledge: 'external', external_document_ids: [id], prepared_id: null }])
    assert.throws(() => recordSubmissionInput({ ...reported, ...change }), /invalid_input/);
  assert.deepEqual(recordSubmissionInput({ ...reported, document_knowledge: 'external', external_document_ids: [id], move_to_applied: false }),
    { ...reported, document_knowledge: 'external', external_document_ids: [id], move_to_applied: false });
});

test('reads preserve exact cursors and stage pagination without mutation or selection guesses', async () => {
  const queries: URL[] = [];
  const options = { application_id: id, stage: 'To Apply', employer_url: null, today: '2026-10-19', timezone: null,
    prepared: [], external: [], prepared_have_more: false, external_have_more: false };
  const api = client(async (url, init) => {
    const path = new URL(String(url)); queries.push(path); assert.equal(init?.method, 'GET'); assert.equal(init?.body, undefined);
    return Response.json(path.pathname.includes('pipeline-stages') ? { data: [], meta: { pagination: { total: 0 } } } :
      ready(path.pathname.endsWith('get_application_v2') ? job : path.pathname.endsWith('get_submission_options') ? options :
        { application_id: id, items: [report], next_cursor: null, unavailable_legacy_count: 0 }));
  });
  await api.getSavedJob(id); await api.submissionOptions({ application_id: id, prepared_before_id: requestId, external_before_id: id });
  await api.listSubmissions({ application_id: id, before_id: requestId }); await api.listPipelineStages({ page: 2, pageSize: 3 });
  assert.deepEqual(JSON.parse(queries[1].searchParams.get('arguments')!), { application_id: id, prepared_before_id: requestId, external_before_id: id });
  assert.equal(JSON.parse(queries[2].searchParams.get('arguments')!).before_id, requestId);
  assert.equal(queries[3].searchParams.get('page[number]'), '2'); assert.equal(queries[3].searchParams.get('page[size]'), '3');
  for (const input of [{ page: 0 }, { pageSize: 101 }, { page: 1.5 }]) await assert.rejects(api.listPipelineStages(input), /invalid_input/);
  assert.equal(queries.length, 4);
});

test('malformed responses cannot become a successful capture or employer submission', async () => {
  for (const data of [{ ...job, revision: 0 }, { ...job, capture_state: 'done' }, { ...job, submission_known: 'yes' }, { ...job, posting: 'x'.repeat(100001) }])
    await assert.rejects(client(async () => Response.json(ready(data))).getSavedJob(id), /invalid_response/);
  for (const data of [{ ...report, evidence: 'employer_verified' }, { ...report, documents: [null] }, { ...report, date: '2026-02-30' }])
    await assert.rejects(client(async () => Response.json(ready(data))).recordSubmission(reported), /invalid_response/);
  await assert.rejects(client(async () => Response.json({ data: [{ type: 'pipeline_stage', id, attributes: { display_name: 'Stage' } }], meta: {} })).listPipelineStages(), /invalid_response/);
});

test('CLI submission reporting requires exact confirmation and retains unknown files and correction intent', async () => {
  let calls = 0;
  async function run(confirm?: string) {
    let stdout = '', stderr = '';
    const status = await runCLI(['applications', 'record-submission', '--file', '-', '--json', ...(confirm ? ['--confirm', confirm] : [])], {
      env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([JSON.stringify(reported)]),
      stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
      fetchImpl: async (url, init) => {
        calls++; assert.equal(new URL(String(url)).pathname, '/api/v1/journey/record_submission');
        assert.deepEqual(JSON.parse(String(init?.body)), reported); return Response.json(ready(report));
      },
    }, 'test');
    return { status, stdout, stderr };
  }
  for (const confirm of [undefined, requestId]) {
    const result = await run(confirm); assert.equal(result.status, 2); assert.equal(result.stdout, '');
    assert.equal(JSON.parse(result.stderr).error.code, 'confirmation_required');
  }
  assert.equal(calls, 0);
  const result = await run(id); assert.equal(result.status, 0); assert.deepEqual(JSON.parse(result.stdout).data.documents, []); assert.equal(calls, 1);
});
