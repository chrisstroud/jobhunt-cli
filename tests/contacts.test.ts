import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';
const token = 'synthetic_contact_credential_only';
const id = '01111111-1111-4111-8111-111111111111';
const contact = { type: 'contact', id, attributes: { name: 'Synthetic Contact', revision: 3,
  email: null, phone: null, linkedin_url: null, company: null, company_id: null, title: null } };
const credential = { origin: 'https://jobhunt.app', token };

test('contact pagination, clear values and revisions use the existing HTTP contract without retries', async () => {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const client = new JobHuntClient({ credential, fetchImpl: async (input, init) => {
    const url = new URL(String(input)); calls.push({ url, init });
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${token}`);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    return Response.json({ data: url.search ? [contact] : contact });
  } });
  await client.listContacts({ page: 2, pageSize: 1, companyId: id });
  assert.equal(calls[0].url.pathname, '/api/v1/contacts');
  assert.equal(calls[0].url.searchParams.get('page[number]'), '2');
  assert.equal(calls[0].url.searchParams.get('filter[company_id]'), id);
  await client.updateContact(id, { email: null }, 3);
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { data: { type: 'contact', id, attributes: { email: null }, meta: { revision: 3 } } });
  const before = calls.length;
  for (const operation of [() => client.listContacts({ pageSize: 101 }), () => client.getContact('../account'),
    () => client.createContact({ name: '' }), () => client.createContact({ name: 'Synthetic', phone: '0'.repeat(51) }),
    () => client.updateContact(id, { name: 'Synthetic' }, 0), () => client.updateContact(id, {}, 3)]) {
    await assert.rejects(operation, /invalid_input/);
  }
  assert.equal(calls.length, before);
  const failing = new JobHuntClient({ credential, fetchImpl: async () => { calls.push({ url: new URL(credential.origin) }); throw Error(token); } });
  await assert.rejects(failing.createContact({ name: 'Synthetic' }), /network_error/);
  assert.equal(calls.length, before + 1);
});

test('contact responses must have a usable revision and correct resource type', async () => {
  for (const response of [{ ...contact, type: 'user_profile' }, { ...contact, attributes: { ...contact.attributes, revision: undefined } },
    { ...contact, attributes: { ...contact.attributes, revision: 0 } }]) {
    const client = new JobHuntClient({ credential, fetchImpl: async () => Response.json({ data: response }) });
    await assert.rejects(client.getContact(id), /invalid_response/);
  }
});

test('CLI contact writes require a revision or exact delete confirmation and never echo credentials', async () => {
  let calls = 0, stdout = '', stderr = '';
  const io = { env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([]),
    stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
    stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
    fetchImpl: (async (_input, init) => { calls++;
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      const body = JSON.parse(String(init?.body));
      assert.equal(body.data.meta.revision, 3); assert.equal(body.data.attributes.email, '');
      return Response.json({ data: contact });
    }) as typeof fetch };
  for (const args of [['contacts', 'update', id, '--email', ''], ['contacts', 'delete', id],
    ['contacts', 'delete', id, '--confirm', 'different'], ['contacts', 'create', '--name', '']]) {
    assert.equal(await runCLI([...args, '--json'], io, 'test'), 2);
  }
  assert.equal(calls, 0); assert.equal(stdout, '');
  assert.equal(await runCLI(['contacts', 'update', id, '--revision', '3', '--email', '', '--json'], io, 'test'), 0);
  assert.equal(await runCLI(['contacts', 'delete', id, '--confirm', id, '--non-interactive', '--json'], io, 'test'), 0);
  assert.equal(calls, 2); assert.ok(!stdout.includes(token) && !stderr.includes(token));
});
