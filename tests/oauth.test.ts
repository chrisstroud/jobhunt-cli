import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { JobHuntClient } from '../client/src/index.ts';
import { login, loginScopes, parseToken, refresh, DEFAULT_SCOPES, INTEGRATION_SCOPES } from '../cli/src/oauth.ts';
const token = { token_type: 'Bearer', access_token: 'jho_at_synthetic_access', refresh_token: 'jho_rt_synthetic_refresh',
  expires_in: 3600, scope: DEFAULT_SCOPES.join(' ') };
function issuer(scopes = INTEGRATION_SCOPES) {
  let challenge = '', exchanged = 0;
  const client = new JobHuntClient({ fetchImpl: (async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://jobhunt.app'); assert.ok(!(init?.headers as Record<string, string>).Authorization);
    if (url.pathname === '/oauth/register') {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.token_endpoint_auth_method, 'none');
      return Response.json({ client_id: 'dyn_synthetic_cli', token_endpoint_auth_method: 'none', redirect_uris: body.redirect_uris });
    }
    assert.equal(url.pathname, '/oauth/token'); exchanged++;
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get('code'), 'synthetic-code');
    assert.equal(body.get('resource'), 'https://jobhunt.app/mcp');
    assert.equal(createHash('sha256').update(body.get('code_verifier')!).digest('base64url'), challenge);
    return Response.json({ ...token, scope: scopes.join(' ') });
  }) as typeof fetch });
  return { client, challenge: (value: string) => { challenge = value; }, exchanged: () => exchanged };
}
test('loopback PKCE rejects forged/duplicate callbacks and exchanges exactly once', async () => {
  const server = issuer();
  const session = await login(server.client, 'default', { onAuthorization: async raw => {
    const auth = new URL(raw); assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(auth.searchParams.get('scope'), INTEGRATION_SCOPES.join(' '));
    server.challenge(auth.searchParams.get('code_challenge')!);
    const callback = new URL(auth.searchParams.get('redirect_uri')!);
    assert.equal(callback.hostname, '127.0.0.1'); assert.notEqual(callback.port, '');
    callback.search = new URLSearchParams({ code: 'synthetic-code', state: 'forged' }).toString();
    assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.set('state', auth.searchParams.get('state')!);
    const forgedHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(callback, { headers: { Host: 'attacker.example' } }, response => {
        response.resume(); response.on('end', () => resolve(response.statusCode));
      });
      req.on('error', reject); req.end();
    });
    assert.equal(forgedHostStatus, 400);
    const accepted = await fetch(callback); assert.equal(accepted.status, 200);
    assert.equal(accepted.headers.get('Referrer-Policy'), 'no-referrer');
    assert.ok(!(await accepted.text()).includes('synthetic-code'));
    assert.equal((await fetch(callback)).status, 400);
  } });
  assert.equal(session.accessToken, token.access_token); assert.equal(server.exchanged(), 1);
});
test('explicit contact grants replace defaults and invalid scope choices perform no authorization', async () => {
  const requested = ['read:profile', 'read:contacts'];
  const server = issuer(requested);
  const session = await login(server.client, 'contacts-read', { scopes: requested.join(','), onAuthorization: async raw => {
    const auth = new URL(raw);
    assert.equal(auth.searchParams.get('scope'), requested.join(' '));
    server.challenge(auth.searchParams.get('code_challenge')!);
    const callback = new URL(auth.searchParams.get('redirect_uri')!);
    callback.search = new URLSearchParams({ code: 'synthetic-code', state: auth.searchParams.get('state')! }).toString();
    assert.equal((await fetch(callback)).status, 200);
  } });
  assert.deepEqual(session.scopes, requested);
  assert.deepEqual(loginScopes(), INTEGRATION_SCOPES);
  const pipeline = ['read:profile', 'read:applications', 'write:applications', 'read:campaigns', 'write:campaigns', 'write:companies', 'read:documents'];
  assert.deepEqual(loginScopes(pipeline.join(',')), pipeline);
  assert.deepEqual(loginScopes('read:profile,read:documents,write:documents'), ['read:profile', 'read:documents', 'write:documents']);
  const insights = ['read:profile', 'read:analytics', 'read:activity', 'read:highlights', 'write:highlights', 'read:notifications', 'write:notifications'];
  assert.deepEqual(loginScopes(insights.join(',')), insights);
  assert.deepEqual(loginScopes('read:profile,read:developer,write:developer'), ['read:profile', 'read:developer', 'write:developer']);
  assert.deepEqual(loginScopes(), INTEGRATION_SCOPES);
  for (const value of ['', '*', 'read:contacts', 'read:profile,admin:*', 'read:profile,read:profile', 'read:profile, read:contacts']) {
    await assert.rejects(login(server.client, 'default', { scopes: value, onAuthorization: async () => { assert.fail('must not authorize'); } }), /invalid_input/);
  }
  assert.equal(server.exchanged(), 1);
});
test('denial and timeout close authorization without exchanging a token', async () => {
  const denied = issuer();
  await assert.rejects(login(denied.client, 'default', { onAuthorization: async raw => {
    const auth = new URL(raw); const callback = new URL(auth.searchParams.get('redirect_uri')!);
    callback.search = new URLSearchParams({ error: 'access_denied', state: auth.searchParams.get('state')! }).toString();
    assert.equal((await fetch(callback)).status, 200);
  } }), /authorization_denied/);
  assert.equal(denied.exchanged(), 0);
  const timed = issuer();
  await assert.rejects(login(timed.client, 'default', { timeoutMs: 20, onAuthorization: async () => {} }), /authorization_timeout/);
  assert.equal(timed.exchanged(), 0);
});
test('token shape and exact granted scope are checked before persistence', () => {
  const base = { origin: 'https://jobhunt.app', profile: 'default', clientId: 'dyn_synthetic_cli' };
  for (const changed of [{ token_type: 'Basic' }, { expires_in: -1 }, { access_token: 'bad\ncredential' }, { refresh_token: '' }]) {
    assert.throws(() => parseToken({ ...token, ...changed }, base, DEFAULT_SCOPES), /invalid_token_response/);
  }
  assert.throws(() => parseToken({ ...token, scope: 'read:applications' }, base, DEFAULT_SCOPES), /granted_scope_mismatch/);
  assert.throws(() => parseToken({ ...token, scope: token.scope + ' admin:*' }, base, DEFAULT_SCOPES), /granted_scope_mismatch/);
});
test('a rotated credential with unexpected scopes is revoked before failing closed', async () => {
  const base = { origin: 'https://jobhunt.app', profile: 'default', clientId: 'dyn_synthetic_cli' };
  const current = parseToken(token, base, DEFAULT_SCOPES);
  const calls: string[] = [];
  const client = new JobHuntClient({ fetchImpl: (async (input, init) => {
    const path = new URL(String(input)).pathname; calls.push(path);
    if (path === '/oauth/token') return Response.json({ ...token, scope: 'read:applications' });
    assert.equal(path, '/oauth/revoke-token');
    assert.equal(new URLSearchParams(String(init?.body)).get('token'), token.refresh_token);
    return new Response('', { status: 200 });
  }) as typeof fetch });
  await assert.rejects(refresh(client, current), /granted_scope_mismatch/);
  assert.deepEqual(calls, ['/oauth/token', '/oauth/revoke-token']);
});

test('the callback page renders its three states from fixed text, shows nothing from the request, and keeps the single-use behaviour', async () => {
  const seenPages: string[] = [];
  const attempt = async (query: (state: string) => Record<string, string>, expectation: { status: number; contains: string }) => {
    const server = issuer();
    await login(server.client, 'default', { timeoutMs: 2000, onAuthorization: async raw => {
      const auth = new URL(raw); server.challenge(auth.searchParams.get('code_challenge')!);
      const callback = new URL(auth.searchParams.get('redirect_uri')!);
      callback.search = new URLSearchParams(query(auth.searchParams.get('state')!)).toString();
      const answer = await fetch(callback); const html = await answer.text();
      assert.equal(answer.status, expectation.status); assert.match(answer.headers.get('Content-Type') ?? '', /^text\/html/u);
      assert.ok(html.includes(expectation.contains), expectation.contains);
      // Nothing from the request, the account or the address is on the page.
      for (const secret of ['synthetic-code', callback.searchParams.get('state')!, callback.port, '127.0.0.1', callback.pathname]) assert.ok(!html.includes(secret), `page shows ${secret}`);
      assert.ok(!/<script|src="http|href="http|@import|url\(/u.test(html), 'no scripts or network references');
      const policy = answer.headers.get('Content-Security-Policy') ?? '';
      assert.match(policy, /^default-src 'none'; style-src 'sha256-[A-Za-z0-9+/=]+'; img-src data:; frame-ancestors 'none'$/u);
      seenPages.push(html);
    } }).catch(() => {});
  };
  await attempt(state => ({ code: 'synthetic-code', state }), { status: 200, contains: "You&apos;re signed in".replace('&apos;', "'") });
  await attempt(state => ({ error: 'access_denied', state }), { status: 200, contains: 'Sign-in was cancelled.' });
  await attempt(() => ({ code: 'synthetic-code', state: 'forged' }), { status: 400, contains: "This sign-in link can't be used." });
  assert.equal(new Set(seenPages).size, 3);
  for (const html of seenPages) assert.ok(html.length < 40000);
});
