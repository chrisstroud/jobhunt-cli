import assert from 'node:assert/strict';
import test from 'node:test';
import { JobHuntClient, JobHuntError, normalizeOrigin } from '../client/src/index.ts';
const origin = 'https://jobhunt.app';
const credential = { origin, token: 'jsk_test_synthetic_not_a_real_key' };
const application = { type: 'application', id: 'example-engineer', attributes: {
  title: 'Engineer', company_name: 'Example', status: 'To Apply', version: 2,
} };
const fetcher = (fn: (url: URL, init: RequestInit) => Promise<Response>) =>
  (async (input, init) => fn(new URL(String(input)), init ?? {})) as typeof fetch;

test('origins exclude credentials, path confusion and implicit plaintext hosts', () => {
  for (const value of ['http://jobhunt.app', 'https://u:p@jobhunt.app', 'https://jobhunt.app/path',
    'https://jobhunt.app?x=1', 'https://jobhunt.app#x', 'https://jobhunt.app\\@elsewhere.example', 'https://jobhunt.app\n']) {
    assert.throws(() => normalizeOrigin(value), JobHuntError);
  }
  assert.equal(normalizeOrigin('http://127.0.0.1:8080', true), 'http://127.0.0.1:8080');
  assert.throws(() => normalizeOrigin('http://localhost:8080', true), JobHuntError);
  assert.throws(() => new JobHuntClient({ origin: 'https://other.example', credential }), /credential_origin_mismatch/);
});
test('bounded list uses the established query and forbids cookies and redirects', async () => {
  const client = new JobHuntClient({ credential, fetchImpl: fetcher(async (url, init) => {
    assert.equal(url.origin, origin); assert.equal(url.pathname, '/api/v1/applications');
    assert.equal(url.searchParams.get('page[size]'), '12'); assert.equal(url.searchParams.get('page[number]'), '2');
    assert.equal(url.searchParams.get('filter[search]'), 'Example & Co');
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error');
    assert.equal((init.headers as Record<string, string>).Authorization, `Bearer ${credential.token}`);
    assert.ok(init.signal); return Response.json({ data: [application], meta: { total: 20, page: 2 } });
  }) });
  assert.equal((await client.listApplications({ page: 2, pageSize: 12, search: 'Example & Co' })).data.length, 1);
  for (const pageSize of [0, 101, 1.5, NaN]) await assert.rejects(client.listApplications({ pageSize }), /invalid_input/);
});
test('normalized paths cannot escape the supported API namespace', async () => {
  const client = new JobHuntClient({ credential, fetchImpl: async () => { throw Error('must not send'); } });
  for (const path of ['/api/v1/../../admin', '/oauth/%2e%2e/admin', '//other.example/api/v1/', '/api/v1/account/#secret']) {
    await assert.rejects(client.request(path), /invalid_path/);
  }
});
test('HTML success cannot falsely confirm revocation, and header request IDs survive empty metadata', async () => {
  const html = new JobHuntClient({ fetchImpl: async () => new Response('<html>proxy error</html>') });
  await assert.rejects(html.request('/oauth/revoke-token', { authenticated: false, method: 'POST' }), /invalid_response/);
  const failed = new JobHuntClient({ credential, fetchImpl: async () => Response.json({ meta: {}, errors: [] },
    { status: 503, headers: { 'X-Request-ID': 'header-request-1' } }) });
  await assert.rejects(failed.identity(), (error: unknown) => error instanceof JobHuntError && error.requestId === 'header-request-1');
});
test('create, versioned update and deletion preserve the wire contract', async () => {
  const calls: Array<{ path: string; method: string | undefined; body: unknown }> = [];
  const client = new JobHuntClient({ credential, fetchImpl: fetcher(async (url, init) => {
    calls.push({ path: url.pathname, method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined });
    return init.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ data: application });
  }) });
  await client.createApplication({ title: 'Engineer', company_name: 'Example' });
  await client.updateApplication('example-engineer', { title: 'Senior Engineer' }, 2);
  await client.deleteApplication('example-engineer');
  assert.deepEqual(calls[1], { path: '/api/v1/applications/example-engineer', method: 'PATCH',
    body: { data: { type: 'application', id: 'example-engineer', attributes: { title: 'Senior Engineer' }, meta: { version: 2 } } } });
  assert.equal(calls[0].method, 'POST'); assert.equal(calls[2].method, 'DELETE');
  await assert.rejects(client.updateApplication('example-engineer', { title: 'Changed' }, 0), /invalid_input/);
  await assert.rejects(client.getApplication('../account'), /invalid_input/);
});
test('errors retain safe contract facts and never expose server details', async () => {
  const client = new JobHuntClient({ credential, fetchImpl: fetcher(async () => Response.json({
    errors: [{ code: 'rate_limited', detail: 'private-server-detail' }], meta: { request_id: 'req-123' },
  }, { status: 429, headers: { 'Retry-After': '7' } })) });
  await assert.rejects(client.listApplications(), (error: unknown) => {
    assert.ok(error instanceof JobHuntError); assert.equal(error.code, 'rate_limited');
    assert.equal(error.retryAfterSeconds, 7); assert.equal(error.requestId, 'req-123');
    assert.ok(!JSON.stringify(error).includes('private-server-detail')); return true;
  });
});
test('an uncertain mutation is sent once, with a safe error', async () => {
  let calls = 0;
  const client = new JobHuntClient({ credential, fetchImpl: fetcher(async () => { calls++; throw Error(credential.token); }) });
  await assert.rejects(client.createApplication({ title: 'Engineer', company_name: 'Example' }), /network_error/);
  assert.equal(calls, 1);
});
test('malformed and oversized responses cannot become successful typed data', async () => {
  for (const body of [{ data: [{ ...application, attributes: { title: 'x' } }] }, { data: null }]) {
    const client = new JobHuntClient({ credential, fetchImpl: fetcher(async () => Response.json(body)) });
    await assert.rejects(client.listApplications(), /invalid_response/);
  }
  const client = new JobHuntClient({ credential, fetchImpl: fetcher(async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))) });
  await assert.rejects(client.listApplications(), /response_too_large/);
});
