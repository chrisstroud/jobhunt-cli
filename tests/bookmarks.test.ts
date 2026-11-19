import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { bookmarkSaveInput } from '../client/src/bookmark-contracts.ts';
import { INTEGRATION_SCOPES, loginScopes } from '../cli/src/oauth.ts';
import { runCLI } from '../cli/src/cli.ts';
import { inputJSON } from '../cli/src/input.ts';

const intent = { request_id: '22222222-2222-4222-8222-222222222222', expected_revision: 0,
  bookmarks: { version: 1 as const, revision: 1, items: [{ id: 'board', name: 'Synthetic board', url: 'https://example.test/jobs', note: '' }] } };
const result = { outcome: 'ready', data: intent.bookmarks, next_action: { kind: 'none', label: 'Saved' } };

test('bookmark CLI reads and saves through the public routes without cookies or URL fetching', async () => {
  for (const command of ['get', 'save']) {
    let stdout = '', stderr = '', calls = 0;
    const code = await runCLI(['bookmarks', command, '--json', ...(command === 'save' ? ['--file', '-'] : [])], {
      env: { JOBHUNT_TOKEN: 'synthetic-bookmark' }, stdin: Readable.from([JSON.stringify(intent)]),
      stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
      fetchImpl: async (url, init) => {
        calls++;
        assert.equal(String(url), `https://jobhunt.app/api/v1/journey/${command}_hunt_bookmarks_v2`);
        assert.equal(init?.credentials, 'omit');
        assert.equal(init?.method, command === 'get' ? 'GET' : 'POST');
        if (command === 'save') assert.deepEqual(JSON.parse(String(init?.body)), intent);
        return Response.json(result);
      },
    }, 'test');
    assert.equal(code, 0); assert.equal(stderr, ''); assert.equal(calls, 1);
    assert.deepEqual(JSON.parse(stdout).data, intent.bookmarks);
  }
});

test('bookmark wire validation bounds the list and fields while retaining unicode and server-owned policy', async () => {
  const valid = structuredClone(intent);
  valid.bookmarks.items[0].name = '🌳'.repeat(80);
  assert.deepEqual(bookmarkSaveInput(valid), valid);
  for (const invalid of [{ ...intent, expected_revision: -1 }, { ...intent, request_id: '' },
    { ...intent, user_id: 'foreign' }, { ...intent, bookmarks: { ...intent.bookmarks, version: 2 } },
    { ...intent, bookmarks: { ...intent.bookmarks, items: Array(51).fill(intent.bookmarks.items[0]) } },
    { ...intent, bookmarks: { ...intent.bookmarks, items: [{ ...intent.bookmarks.items[0], note: 'x'.repeat(181) }] } },
    { ...intent, bookmarks: { ...intent.bookmarks, items: [{ ...intent.bookmarks.items[0], unexpected: true }] } }]) {
    assert.throws(() => bookmarkSaveInput(invalid), /invalid_input/);
  }
  let calls = 0;
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-bookmark' },
    fetchImpl: async () => { calls++; return Response.json(result); } });
  await assert.rejects(client.saveBookmarks({ ...intent, expected_revision: -1 }), /invalid_input/);
  assert.equal(calls, 0);
});

test('bookmark empty revision zero is valid but malformed successful responses are refused', async () => {
  let data: unknown = { version: 1, revision: 0, items: [] };
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-bookmark' },
    fetchImpl: async () => Response.json({ ...result, data }) });
  assert.deepEqual((await client.getBookmarks()).data, data);
  for (const invalid of [null, { version: 1, revision: -1, items: [] }, { version: 1, revision: 1, items: [{}] }]) {
    data = invalid;
    await assert.rejects(client.getBookmarks(), /invalid_response/);
  }
});

test('profile writes are an explicit OAuth scope replacement without expanding default grants', () => {
  assert.deepEqual(loginScopes('read:profile,write:profile'), ['read:profile', 'write:profile']);
  assert.deepEqual(loginScopes(), INTEGRATION_SCOPES);
  assert.ok(!INTEGRATION_SCOPES.includes('write:profile'));
});

test('bookmark stdin accepts its larger bounded payload while retaining other commands limits', async () => {
  const payload = JSON.stringify({ text: 'x'.repeat(70 * 1024) });
  await assert.rejects(inputJSON('-', Readable.from([payload])), /invalid_input/);
  assert.equal((await inputJSON('-', Readable.from([payload]), 512 * 1024) as { text: string }).text.length, 70 * 1024);
  await assert.rejects(inputJSON('-', Readable.from([' '.repeat(512 * 1024 + 1)]), 512 * 1024), /invalid_input/);
});
