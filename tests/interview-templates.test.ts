import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_template_credential' }, fetchImpl });

test('template directory validates complete pages and rejects user data or accidental initialization claims', async () => {
  const value = { items: [], page: 1, total: 0, has_more: false, fingerprint: 'a'.repeat(64) };
  assert.deepEqual((await api(async () => Response.json(ready(value))).listInterviewTemplates()).data, value);
  await assert.rejects(api(async () => Response.json(ready({ ...value, total: 1 }))).listInterviewTemplates(), /invalid_response/);
  await assert.rejects(api(async () => Response.json(ready({ initialized: true, created_ids: [id] }))).initializeInterviewTemplates({ request_id: id, expected_fingerprint: value.fingerprint }), /invalid_response/);
  const row = { id, user_id: other, title: 'Synthetic', default_step_type: null, sort_order: 1, is_system: false, created_at: null, fingerprint: value.fingerprint };
  await assert.rejects(api(async () => Response.json(ready({ ...value, items: [row], total: 1 }))).listInterviewTemplates(), /invalid_response/);
});

test('template deletion requires exact confirmation before HTTP and never retries a failed write', async () => {
  const value = { request_id: id, template_id: id, expected_fingerprint: 'a'.repeat(64) };
  let calls = 0; let error = '';
  const status = await runCLI(['interview-templates', 'delete', '--file', '-', '--json', '--non-interactive', '--confirm', other], {
    env: { JOBHUNT_TOKEN: 'synthetic_template_credential' }, stdin: Readable.from([JSON.stringify(value)]),
    stdout: new Writable({ write(_chunk, _, done) { done(); } }),
    stderr: new Writable({ write(chunk, _, done) { error += chunk.toString(); done(); } }),
    fetchImpl: async () => { calls++; throw new Error('Synthetic private diagnostic'); },
  }, 'test');
  assert.equal(status, 2); assert.equal(JSON.parse(error).error.code, 'confirmation_required'); assert.equal(calls, 0);
  await assert.rejects(api(async () => { calls++; throw new Error('Synthetic private diagnostic'); }).deleteInterviewTemplate(value), /network_error|request_failed/);
  assert.equal(calls, 1);
  await assert.rejects(api(async () => Response.json(ready({ id: other, deleted: true }))).deleteInterviewTemplate(value), /invalid_response/);
});
