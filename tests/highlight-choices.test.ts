import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const page = <T>(items: T[]) => ({ items, page: 1, pages: 1, per_page: 50, total: items.length });
const data = { companies: page([{ id, name: 'Synthetic company' }]),
  hunts: page([{ id, name: null, slug: 'synthetic-hunt' }]), roles: page(['Engineer']) };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic_choices_credential' }, fetchImpl });

test('choices retain independently requested pages, null legacy Hunt names and full slug lengths', async () => {
  const expected = { company_page: 2, hunt_page: 1, role_page: 3, per_page: 1 };
  const value = { companies: { ...data.companies, page: 2, pages: 2, per_page: 1, total: 2 },
    hunts: { ...data.hunts, per_page: 1, items: [{ ...data.hunts.items[0], slug: 'x'.repeat(255) }] },
    roles: { ...data.roles, page: 3, pages: 3, per_page: 1, total: 3 } };
  let calls = 0;
  const result = await client(async (url, init) => {
    calls++; assert.ok(String(url).includes('/get_highlight_choices_v2?'));
    assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), expected);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error'); return Response.json(ready(value));
  }).getHighlightChoices(expected);
  assert.deepEqual(result.data, value); assert.equal(calls, 1);
});

test('invalid directory pagination fails before any HTTP request', async () => {
  let calls = 0; const api = client(async () => { calls++; return Response.json(ready(data)); });
  for (const input of [{ company_page: 0 }, { hunt_page: 1.5 }, { role_page: null }, { per_page: 101 }, { per_page: '50' }, { page: 1 }])
    await assert.rejects(api.getHighlightChoices(input as never), /invalid_input/);
  assert.equal(calls, 0);
});

test('directory replies reject incomplete pages, mismatched requests and duplicate identities', async () => {
  const company = data.companies;
  for (const changed of [{ companies: { ...company, items: [] } }, { companies: { ...company, pages: 2 } },
    { companies: { ...company, per_page: 100 } }, { companies: { ...company, items: [company.items[0], company.items[0]], total: 2 } },
    { roles: { ...data.roles, items: ['Engineer', 'Engineer'], total: 2 } }, { hunts: { ...data.hunts, items: [{ ...data.hunts.items[0], id: 'bad' }] } }])
    await assert.rejects(client(async () => Response.json(ready({ ...data, ...changed }))).getHighlightChoices(), /invalid_response/);
  const empty = { companies: page([]), hunts: page([]), roles: page([]) };
  assert.deepEqual((await client(async () => Response.json(ready(empty))).getHighlightChoices()).data, empty);
});

test('CLI choices forwards explicit independent pages and rejects unknown flags without IO', async () => {
  let stdout = ''; let calls = 0;
  const io = { env: { JOBHUNT_TOKEN: 'synthetic_choices_credential' }, stdin: Readable.from([]),
    fetchImpl: async (url: string | URL | Request) => { calls++; assert.equal(new URL(String(url)).searchParams.get('arguments'), '{"company_page":1,"hunt_page":1,"role_page":1,"per_page":50}'); return Response.json(ready(data)); },
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(_chunk, _, done) { done(); } }) };
  const args = ['highlights', 'choices', '--company-page', '1', '--hunt-page', '1', '--role-page', '1', '--per-page', '50', '--json', '--non-interactive'];
  assert.equal(await runCLI(args, io, 'test'), 0); assert.deepEqual(JSON.parse(stdout).data, data); assert.equal(calls, 1);
  assert.equal(await runCLI([...args, '--page', '1'], io, 'test'), 2); assert.equal(calls, 1);
});
