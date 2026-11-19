import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { documentSettingsInput } from '../client/src/document-settings-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const account = 'jh_11111111-1111-4111-8111-111111111111';
const intent = { request_id: '22222222-2222-4222-8222-222222222222', expected_account_id: account,
  expected_fingerprint: 'a'.repeat(64), patch: { default_page_size: 'a4' } };
const data = { account_id: account, fingerprint: 'b'.repeat(64), settings: { default_download: 'combined', default_page_size: 'a4', default_theme: 'imprecv', default_view: '50', show_beta_themes: false } };
const result = { outcome: 'ready', data, next_action: { kind: 'none', label: '' } };

test('document defaults CLI preserves reviewed intents through cookie-free HTTP', async () => {
  for (const command of ['get', 'update']) {
    let stdout = '', stderr = '', calls = 0;
    const code = await runCLI(['document-settings', command, '--json', ...(command === 'update' ? ['--file', '-'] : [])], {
      env: { JOBHUNT_TOKEN: 'synthetic-preferences' }, stdin: Readable.from([JSON.stringify(intent)]),
      stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
      fetchImpl: async (url, init) => {
        calls++;
        assert.equal(String(url), `https://jobhunt.app/api/v1/journey/${command}_document_settings`);
        assert.equal(init?.credentials, 'omit');
        assert.equal(init?.method, command === 'get' ? 'GET' : 'POST');
        if (command === 'update') assert.deepEqual(JSON.parse(String(init?.body)), intent);
        return Response.json(result);
      },
    }, 'test');
    assert.equal(code, 0); assert.equal(stderr, ''); assert.equal(calls, 1);
    assert.deepEqual(JSON.parse(stdout).data, data);
  }
});


test('document defaults reject null, empty and retired edits before networking', async () => {
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-defaults' },
    fetchImpl: async () => { calls++; return Response.json(result); } });
  for (const patch of [{}, { default_download: null }, { default_page_size: [] }, { default_page_size: 'legal' },
    { default_theme: 'imprecv' }, { default_view: '50' }, { show_beta_themes: false }]) {
    await assert.rejects(client.updateDocumentSettings({ ...intent, patch } as never), /invalid_input/);
  }
  for (const expected_account_id of [undefined, null, 'jh_foreign']) {
    assert.throws(() => documentSettingsInput({ ...intent, expected_account_id }), /invalid_input/);
  }
  assert.equal(calls, 0); assert.deepEqual(documentSettingsInput(intent), intent);
});
test('document defaults reject malformed success responses', async () => {
  let response: unknown;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-defaults' },
    fetchImpl: async () => Response.json(response) });
  for (const bad of [{ ...data, account_id: 'jh_foreign' }, { ...data, fingerprint: '' },
    { ...data, settings: { ...data.settings, default_view: '25' } },
    { ...data, settings: { ...data.settings, show_beta_themes: true } },
    { ...data, settings: { ...data.settings, default_page_size: 'legal' } }]) {
    response = { ...result, data: bad };
    await assert.rejects(client.getDocumentSettings(), /invalid_response/);
  }
});
