import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const item = { href: '/app/contacts/' + id, title: 'Synthetic contact', meta: null, type: 'Contact', mark: 'C', updatedAt: null };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_search_credential' }, fetchImpl });

test('typed search and resolution preserve exact arguments and metadata, including omitted default state', async () => {
  let calls = 0;
  const api = client(async (url, init) => {
    calls++; assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    const args = JSON.parse(new URL(String(url)).searchParams.get('arguments')!);
    if (calls === 1) { assert.deepEqual(args, { query: '🙂'.repeat(120), kind: 'Contact' }); return Response.json(ready({ items: [item] })); }
    assert.deepEqual(args, { kind: 'document', identifier: 'supplied-slug' }); return Response.json(ready({ kind: 'document', id }));
  });
  assert.deepEqual((await api.searchWorkspace({ query: '🙂'.repeat(120), kind: 'Contact' })).data, { items: [item] });
  assert.equal((await api.resolveWorkspaceLocation({ kind: 'document', identifier: 'supplied-slug' })).data?.id, id);
  assert.equal(calls, 2);
});

test('invalid queries and location selections fail before network IO', async () => {
  let calls = 0; const api = client(async () => { calls++; return Response.json(ready({ items: [] })); });
  for (const args of [{ query: '🙂'.repeat(121) }, { query: null }, { kind: 'Unknown' }, { page: 1 }])
    await assert.rejects(api.searchWorkspace(args as never), /invalid_input/);
  for (const args of [{ kind: 'application', identifier: id }, { kind: 'search', identifier: '' }, { kind: 'document', identifier: 'x'.repeat(256) }])
    await assert.rejects(api.resolveWorkspaceLocation(args as never), /invalid_input/);
  assert.equal(calls, 0);
});

test('search replies reject wrong families, external destinations, malformed metadata and excess matches', async () => {
  for (const changed of [{ ...item, href: 'https://outside.example.test/record' }, { ...item, href: '/app/documents/' + id },
    { ...item, updatedAt: 'not-a-time' }, { ...item, mark: 'D' }, { ...item, type: 'Unsupported' }])
    await assert.rejects(client(async () => Response.json(ready({ items: [changed] }))).searchWorkspace(), /invalid_response/);
  await assert.rejects(client(async () => Response.json(ready({ items: Array(11).fill(item) }))).searchWorkspace(), /invalid_response/);
  await assert.rejects(client(async () => Response.json(ready({ items: [item] }))).searchWorkspace({ kind: 'Task' }), /invalid_response/);
  await assert.rejects(client(async () => Response.json(ready({ kind: 'search', id }))).resolveWorkspaceLocation({ kind: 'document', identifier: id }), /invalid_response/);
});

test('workspace CLI dispatches exact queries and requires a complete explicit location', async () => {
  let stdout = ''; let calls = 0;
  const io = { env: { JOBHUNT_TOKEN: 'synthetic_search_credential' }, stdin: Readable.from([]),
    fetchImpl: async (url: string | URL | Request) => {
      calls++; const args = JSON.parse(new URL(String(url)).searchParams.get('arguments')!);
      if (calls === 1) { assert.deepEqual(args, { query: 'supplied', kind: 'Contact' }); return Response.json(ready({ items: [item] })); }
      assert.deepEqual(args, { kind: 'search', identifier: 'supplied-slug' }); return Response.json(ready({ kind: 'search', id }));
    }, stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(_chunk, _, done) { done(); } }) };
  assert.equal(await runCLI(['workspace', 'search', '--query', 'supplied', '--kind', 'Contact', '--json', '--non-interactive'], io, 'test'), 0);
  assert.deepEqual(JSON.parse(stdout).data.items, [item]); stdout = '';
  assert.equal(await runCLI(['workspace', 'resolve', '--kind', 'search', '--identifier', 'supplied-slug', '--json', '--non-interactive'], io, 'test'), 0);
  assert.equal(calls, 2);
  assert.equal(await runCLI(['workspace', 'resolve', '--kind', 'document', '--json', '--non-interactive'], io, 'test'), 2);
  assert.equal(calls, 2);
});
