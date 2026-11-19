import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { runCLI } from '../cli/src/cli.ts';
import type { IO } from '../cli/src/cli.ts';
import { JobHuntClient, JobHuntError } from '../client/src/index.ts';
import type { CredentialStore, Session } from '../cli/src/credentials.ts';
import { INTEGRATION_SCOPES, LOGIN_SCOPES, LOGIN_TIMEOUT_MS, loginScopes } from '../cli/src/oauth.ts';
import { PLUGIN_SCOPES, localDay } from '../cli/src/plugin.ts';

const docs = new URL('../cli/docs/', import.meta.url);
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`plugin-fixtures/${name}`, docs), 'utf8'));
const token = 'jsk_test_synthetic_plugin_only';
const noon = new Date('2026-11-18T20:30:00Z');
function io(fetchImpl: typeof fetch, options: { env?: NodeJS.ProcessEnv; store?: Partial<CredentialStore>; now?: Date } = {}) {
  let stdout = '', stderr = '';
  const value: IO = { env: options.env ?? { JOBHUNT_TOKEN: token }, fetchImpl, stdin: Readable.from(['']), now: () => options.now ?? noon,
    stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
    stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }) };
  if (options.store) value.storeFactory = () => options.store as CredentialStore;
  return { value, out: () => stdout, err: () => stderr };
}
const run = async (args: string[], harness: ReturnType<typeof io>) => runCLI([...args, '--json'], harness.value, 'test');
/** A tool-call answer as /mcp sends it. */
const answer = (structured: unknown, isError = false) => Response.json({ jsonrpc: '2.0', id: 1,
  result: { content: [{ type: 'text', text: JSON.stringify(structured) }], structuredContent: structured, isError } });
const account = { data: { type: 'user_profile', id: '00000000-0000-4000-8000-000000000001', attributes: { name: 'Sample Person', email: 'sample@example.test' } } };
const noSession = { locked: async <T>(action: () => Promise<T>) => action(), load: async () => undefined } as unknown as Partial<CredentialStore>;
function singleLine(text: string) { assert.ok(text.endsWith('\n') && !text.slice(0, -1).includes('\n'), 'one line of JSON'); assert.ok(!/\u001b/u.test(text), 'no colour'); return JSON.parse(text); }

test('the contract document embeds exactly the fixture files the plugin is built against', () => {
  const document = readFileSync(new URL('plugin-contract.md', docs), 'utf8');
  const names = [...document.matchAll(/<!-- fixture: ([a-z-]+\.json) -->\n```json\n([\s\S]*?)\n```/gu)];
  assert.deepEqual(names.map(match => match[1]).sort(), ['activity.json', 'error-refused.json', 'error-signed-out.json', 'jobs-save.json', 'login-success.json',
    'overview.json', 'status-signed-in.json', 'status-signed-out.json']);
  for (const [, name, body] of names) assert.deepEqual(JSON.parse(body), fixture(name), name);
});

test('status says only whether the person is signed in', async () => {
  const seen: string[] = [];
  const signedIn = io(async url => { seen.push(new URL(String(url)).pathname); return Response.json(account); });
  assert.equal(await run(['status'], signedIn), 0);
  assert.deepEqual(singleLine(signedIn.out()), fixture('status-signed-in.json'));
  assert.ok(!signedIn.out().includes('sample@example.test') && !signedIn.out().includes('Sample Person') && !signedIn.err());
  assert.deepEqual(seen, ['/api/v1/account']);
  // No saved connection: no request at all.
  const none = io(async () => { throw new Error('must not request'); }, { env: {}, store: noSession });
  assert.equal(await run(['status'], none), 0); assert.deepEqual(singleLine(none.out()), fixture('status-signed-out.json'));
  // A connection the service no longer accepts.
  const revoked = io(async () => Response.json({ errors: [{ code: 'unauthorized' }] }, { status: 401 }));
  assert.equal(await run(['status'], revoked), 0); assert.deepEqual(singleLine(revoked.out()), fixture('status-signed-out.json'));
  // A refresh token the service refuses: signed out, not an error.
  const expired = { version: 1, kind: 'oauth', origin: 'https://jobhunt.app', profile: 'default', clientId: 'client', accessToken: token,
    refreshToken: 'refresh_synthetic', expiresAt: Date.now() - 1000, scopes: ['read:profile'] } as Session;
  const refused = io(async () => Response.json({ error: 'invalid_grant' }, { status: 400 }), { env: {},
    store: { locked: async <T>(action: () => Promise<T>) => action(), load: async () => expired } as unknown as Partial<CredentialStore> });
  assert.equal(await run(['status'], refused), 0); assert.deepEqual(singleLine(refused.out()), fixture('status-signed-out.json'));
});

test('status is an error, not signed out, when the service cannot be reached', async () => {
  const down = io(async () => { throw new TypeError('offline'); });
  assert.equal(await run(['status'], down), 7);
  assert.equal(down.out(), ''); assert.equal(singleLine(down.err()).error.code, 'network_error');
  const broken = io(async () => Response.json({ errors: [{ code: 'unavailable' }] }, { status: 503 }));
  assert.equal(await run(['status'], broken), 7); assert.equal(broken.out(), '');
});

test('overview is the get_overview result, byte for byte', async () => {
  let call: { url: string; headers: Record<string, string>; body: unknown } | undefined;
  const harness = io(async (url, init) => { call = { url: String(url), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) };
    return answer(fixture('overview.json')); });
  assert.equal(await run(['overview'], harness), 0);
  assert.deepEqual(singleLine(harness.out()), fixture('overview.json'));
  assert.equal(call?.url, 'https://jobhunt.app/mcp');
  assert.equal(call?.headers.Authorization, `Bearer ${token}`); assert.equal(call?.headers['MCP-Protocol-Version'], '2025-06-18');
  assert.equal(call?.headers['Content-Type'], 'application/json');
  assert.deepEqual(call?.body, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_overview', arguments: {} } });
  assert.ok(!harness.err());
});

test('a refusal or a bad answer is one line of JSON on stderr, nothing on stdout, and a non-zero exit', async () => {
  const lacking = io(async () => answer({ ok: false, code: 'insufficient_scope', message: 'Reconnect and approve read access to tasks.' }, true));
  assert.equal(await run(['overview'], lacking), 4);
  assert.equal(lacking.out(), ''); assert.deepEqual(singleLine(lacking.err()), { error: { code: 'insufficient_scope', status: 403, message: 'Reconnect and approve read access to tasks.' } });
  const signedOut = io(async () => Response.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Authentication required' } }, { status: 401 }));
  assert.equal(await run(['overview'], signedOut), 3);
  assert.deepEqual(singleLine(signedOut.err()), { error: { code: 'unauthorized', status: 401 } });
  const garbled = io(async () => Response.json({ jsonrpc: '2.0', id: 1, result: {} }));
  assert.equal(await run(['overview'], garbled), 7); assert.equal(singleLine(garbled.err()).error.code, 'invalid_response');
  const limited = io(async () => Response.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Rate limited' } }, { status: 429, headers: { 'Retry-After': '30' } }));
  assert.equal(await run(['overview'], limited), 6); assert.equal(singleLine(limited.err()).error.retry_after_seconds, 30);
});

test('jobs save sends the link to save_job and returns the saved job', async () => {
  let body: any;
  const harness = io(async (_url, init) => { body = JSON.parse(String(init?.body)); return answer(fixture('jobs-save.json')); });
  assert.equal(await run(['jobs', 'save', 'https://jobs.example/postings/123'], harness), 0);
  assert.deepEqual(singleLine(harness.out()), fixture('jobs-save.json'));
  assert.deepEqual(body.params, { name: 'save_job', arguments: { url: 'https://jobs.example/postings/123' } });
  const refused = io(async () => answer({ ok: false, code: 'invalid_input', message: 'url: use a public https link to the posting.' }, true));
  assert.equal(await run(['jobs', 'save', 'https://jobs.example/postings/123'], refused), 2);
  assert.deepEqual(singleLine(refused.err()), fixture('error-refused.json')); assert.equal(refused.out(), '');
});

test('jobs save refuses what is not a plain web link before any request', async () => {
  const never = io(async () => { throw new Error('must not request'); });
  for (const args of [['jobs', 'save'], ['jobs', 'save', 'not a link'], ['jobs', 'save', 'ftp://jobs.example/1'], ['jobs', 'save', 'https://user:pw@jobs.example/1'],
    ['jobs', 'save', 'https://jobs.example/' + 'a'.repeat(2000)], ['jobs', 'save', 'https://jobs.example/a b'], ['jobs', 'save', 'https://jobs.example/1', 'extra'],
    ['jobs', 'save', 'https://jobs.example/1', '--page', '2']]) {
    assert.equal(await run(args, never), 2, args.join(' '));
  }
  assert.equal(never.out(), '');
});

function activityFetch(seen: { query?: unknown }) {
  const sparse = fixture('activity.json').days.filter((day: { count: number }) => day.count > 0);
  return async (url: URL | RequestInfo) => {
    const parsed = new URL(String(url)); assert.equal(parsed.pathname, '/api/v1/journey/get_hunt_activity_v2');
    seen.query = JSON.parse(parsed.searchParams.get('arguments') ?? '{}');
    const query = seen.query as { today: string };
    return Response.json({ outcome: 'ready', next_action: { kind: 'none', label: '' }, data: { applications: 1, follow_ups: 2, notes: 0, record_updates: 0,
      days: sparse, history_start_date: '2026-01-01', origin_date: '2026-01-01', today_date: query.today, scope: { kind: 'account', label: 'All Hunts', active_hunt_count: 1, total_hunt_count: 1 } } });
  };
}

test('activity fills every day of the window with the recorded count, oldest first, in the person\'s zone', async () => {
  const seen: { query?: unknown } = {};
  const harness = io(activityFetch(seen));
  assert.equal(await run(['activity', '--days', '28', '--time-zone', 'America/Los_Angeles'], harness), 0);
  assert.deepEqual(singleLine(harness.out()), fixture('activity.json'));
  assert.deepEqual(seen.query, { today: '2026-11-18', tz_offset: 480 });
  const fixtureDays = fixture('activity.json').days as { date: string; count: number }[];
  assert.equal(fixtureDays.length, 28); assert.equal(fixtureDays.at(-1)?.date, '2026-11-18');
  // Defaults: a year, in this machine's zone.
  const wide = io(activityFetch({}), { env: { JOBHUNT_TOKEN: token, TZ: 'UTC' } });
  assert.equal(await run(['activity', '--time-zone', 'UTC'], wide), 0);
  const result = singleLine(wide.out()); assert.equal(result.days.length, 365); assert.equal(result.from, '2025-11-19');
  assert.deepEqual(result.days.slice(-28), fixtureDays); // same counts, same order
});

test('activity reads the calendar day and the offset the way the app does', () => {
  assert.deepEqual(localDay(new Date('2026-11-19T03:30:00Z'), 'America/Los_Angeles'), { today: '2026-11-18', offset: 480 });
  assert.deepEqual(localDay(new Date('2026-07-01T12:00:00Z'), 'America/Los_Angeles'), { today: '2026-07-01', offset: 420 });
  assert.deepEqual(localDay(new Date('2026-07-01T23:30:00Z'), 'Europe/London'), { today: '2026-07-02', offset: -60 });
  assert.deepEqual(localDay(new Date('2026-11-18T20:30:00Z'), 'Asia/Kolkata'), { today: '2026-11-19', offset: -330 });
  assert.deepEqual(localDay(new Date('2026-11-18T20:30:00.900Z'), 'UTC'), { today: '2026-11-18', offset: 0 });
});

test('activity refuses a window or a zone it cannot use before any request', async () => {
  const never = io(async () => { throw new Error('must not request'); });
  for (const args of [['activity', '--days', '0'], ['activity', '--days', '1099'], ['activity', '--days', 'many'], ['activity', '--days', '-3'],
    ['activity', '--time-zone', 'Mars/Olympus'], ['activity', 'extra'], ['activity', '--page', '2']]) assert.equal(await run(args, never), 2, args.join(' '));
  assert.equal(never.out(), '');
  // The two-word activity commands keep working, and a wrong second word is still a usage error.
  const counts = io(activityFetch({})); assert.equal(await run(['activity', 'counts', '--date', '2026-11-18'], counts), 0);
  assert.equal(await run(['activity', 'nothing'], never), 2);
});

test('the permissions the plugin asks for are valid, minimal and enough for every call it makes', () => {
  assert.equal(loginScopes(PLUGIN_SCOPES.join(',')).length, PLUGIN_SCOPES.length);
  assert.ok(PLUGIN_SCOPES.every(scope => LOGIN_SCOPES.includes(scope)));
  assert.ok(PLUGIN_SCOPES.includes('read:profile')); assert.equal(new Set(PLUGIN_SCOPES).size, PLUGIN_SCOPES.length);
  // The remaining checks compare these permissions with the JobHunt server's tool contract, which is published
  // with the server and is not part of this repository; they run where that file exists.
  const contractFile = new URL('../../mcp/v2/contract.json', import.meta.url);
  if (!existsSync(contractFile)) return;
  const contract = JSON.parse(readFileSync(contractFile, 'utf8'));
  const tools = (Array.isArray(contract.tools) ? contract.tools : Object.values(contract.tools ?? contract)) as { name: string; securitySchemes: { scopes: string[] }[] }[];
  const overview = tools.find(tool => tool.name === 'get_overview')!.securitySchemes[0].scopes;
  for (const scope of overview) assert.ok(PLUGIN_SCOPES.includes(scope), `get_overview declares ${scope}`);
  // The operations behind the other two commands (services/journey_sidebar.py, mcp/v2/tools/jobs.py).
  for (const scope of ['read:analytics', 'read:campaigns', 'write:applications']) assert.ok(PLUGIN_SCOPES.includes(scope), scope);
  // Nothing that writes beyond saving a link.
  assert.deepEqual(PLUGIN_SCOPES.filter(scope => scope.startsWith('write:')), ['write:applications']);
});

test('the help lists the plugin commands', async () => {
  const harness = io(async () => { throw new Error('must not request'); });
  assert.equal(await runCLI(['--help'], harness.value, 'test'), 0);
  for (const line of ['status ', 'overview ', 'activity [--days N]', 'jobs save URL']) assert.ok(harness.out().includes(line), line);
});

/** A service that registers a client, issues a token for exactly the scopes asked, and knows the account. */
function loginService(seen: { scope?: string; client?: string }) {
  let redirect = '';
  return (async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/oauth/register') {
      const body = JSON.parse(String(init?.body)); redirect = body.redirect_uris[0]; seen.client = body.client_name;
      return Response.json({ client_id: 'cli_client', token_endpoint_auth_method: 'none', redirect_uris: [redirect] });
    }
    if (url.pathname === '/oauth/token') return Response.json({ token_type: 'Bearer', access_token: 'access_synthetic', refresh_token: 'refresh_synthetic',
      expires_in: 3600, scope: seen.scope });
    if (url.pathname === '/api/v1/account') return Response.json(account);
    throw new Error(`unexpected request ${url.pathname}`);
  }) as typeof fetch;
}
const memoryStore = (saved: Session[]) => ({ locked: async <T>(action: () => Promise<T>) => action(), load: async () => undefined,
  save: async (session: Session) => { saved.push(session); return 'keyring'; } }) as unknown as Partial<CredentialStore>;

test('auth login with no flags asks for the integration permissions, opens the browser and exits 0 once approved', async () => {
  const seen: { scope?: string; client?: string } = {}; const saved: Session[] = []; const opened: string[] = [];
  const harness = io(loginService(seen), { env: {}, store: memoryStore(saved) });
  harness.value.browser = async raw => {
    const authorize = new URL(raw); opened.push(raw);
    seen.scope = authorize.searchParams.get('scope') ?? '';
    assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
    const callback = new URL(authorize.searchParams.get('redirect_uri')!);
    callback.search = new URLSearchParams({ code: 'synthetic-code', state: authorize.searchParams.get('state')! }).toString();
    assert.equal((await fetch(callback)).status, 200);
  };
  assert.equal(await run(['auth', 'login'], harness), 0);
  assert.equal(seen.scope, INTEGRATION_SCOPES.join(' ')); assert.equal(seen.client, 'JobHunt CLI');
  assert.equal(opened.length, 1); assert.equal(saved.length, 1); assert.deepEqual(saved[0].scopes, INTEGRATION_SCOPES);
  // Success: one line on stdout with no name or email; stderr carries the approval link on its second line, for a plugin to show if no browser opened.
  const result = singleLine(harness.out());
  assert.deepEqual(result, fixture('login-success.json'));
  assert.equal(result.authenticated, true); assert.ok(!harness.out().includes('sample@example.test') && !harness.out().includes('Sample Person'));
  assert.equal(harness.err(), `Authorize JobHunt in your browser:\n${opened[0]}\n`);
});

test('auth login explicit --scopes still replaces the set, and an invalid set asks nothing', async () => {
  const seen: { scope?: string } = {}; const harness = io(loginService(seen), { env: {}, store: memoryStore([]) });
  harness.value.browser = async raw => {
    const authorize = new URL(raw); seen.scope = authorize.searchParams.get('scope') ?? '';
    const callback = new URL(authorize.searchParams.get('redirect_uri')!);
    callback.search = new URLSearchParams({ code: 'synthetic-code', state: authorize.searchParams.get('state')! }).toString(); await fetch(callback);
  };
  assert.equal(await run(['auth', 'login', '--scopes', 'read:profile,read:tasks'], harness), 0); assert.equal(seen.scope, 'read:profile,read:tasks'.replace(',', ' ').replace(',', ' '));
  const never = io(async () => { throw new Error('must not request'); }, { env: {}, store: memoryStore([]) });
  assert.equal(await run(['auth', 'login', '--scopes', 'admin:*'], never), 2);
});

test('auth login fails with the contract error when nobody approves or the person declines, and never prompts', async () => {
  const waiting = io(loginService({ scope: INTEGRATION_SCOPES.join(' ') }), { env: {}, store: memoryStore([]) });
  waiting.value.loginTimeoutMs = 40; waiting.value.browser = async () => {};
  assert.equal(await run(['auth', 'login'], waiting), 3);
  assert.equal(waiting.out(), '');
  assert.equal(singleLine(waiting.err().split('\n').slice(2).join('\n')).error.code, 'authorization_timeout');
  const declined = io(loginService({ scope: INTEGRATION_SCOPES.join(' ') }), { env: {}, store: memoryStore([]) });
  declined.value.browser = async raw => {
    const authorize = new URL(raw); const callback = new URL(authorize.searchParams.get('redirect_uri')!);
    callback.search = new URLSearchParams({ error: 'access_denied', state: authorize.searchParams.get('state')! }).toString(); await fetch(callback);
  };
  assert.equal(await run(['auth', 'login'], declined), 3); assert.equal(declined.out(), '');
  assert.equal(singleLine(declined.err().split('\n').slice(2).join('\n')).error.code, 'authorization_denied');
  // A GUI process has no terminal: with no browser opener it fails closed, and the link is still on stderr.
  assert.equal(LOGIN_TIMEOUT_MS, 300_000);
  const refused = io(loginService({}), { env: {}, store: memoryStore([]) });
  assert.equal(await runCLI(['auth', 'login', '--non-interactive', '--json'], refused.value, 'test'), 2);
});

/** The browser step of a login: approve the request exactly as asked. */
const approve = async (raw: string) => {
  const authorize = new URL(raw); const callback = new URL(authorize.searchParams.get('redirect_uri')!);
  callback.search = new URLSearchParams({ code: 'synthetic-code', state: authorize.searchParams.get('state')! }).toString(); await fetch(callback);
};
/** Like loginService, but the token and account answers are chosen by the test, and revocations are counted. */
function brokenService(options: { scope?: (asked: string) => string; token?: Record<string, unknown>; account?: () => Response; revoked?: string[] }) {
  const base = loginService({});
  return (async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/oauth/token') return Response.json({ token_type: 'Bearer', access_token: 'access_synthetic', refresh_token: 'refresh_synthetic',
      expires_in: 3600, scope: (options.scope ?? (() => INTEGRATION_SCOPES.join(' ')))(''), ...options.token });
    if (url.pathname === '/oauth/revoke-token') { options.revoked?.push(new URLSearchParams(String(init?.body)).get('token') ?? ''); return new Response('', { status: 200 }); }
    if (url.pathname === '/api/v1/account' && options.account) return options.account();
    return base(input, init);
  }) as typeof fetch;
}

test('every login failure after approval has its own code and a one-line reason, and the issued connection is revoked', async () => {
  const cases: Array<[string, Parameters<typeof brokenService>[0], string, RegExp, number]> = [
    // What a service that narrows the permissions would do: refused, and the reason names what was not granted.
    ['narrowed scope', { scope: () => 'read:profile read:tasks' }, 'granted_scope_mismatch', /not granted: .*read:applications/u, 3],
    ['empty scope', { scope: () => '' }, 'granted_scope_mismatch', /not granted: /u, 3],
    ['no scope field', { token: { scope: undefined } }, 'invalid_token_response', /scope is missing/u, 3],
    ['wrong token type', { token: { token_type: 'MAC' } }, 'invalid_token_response', /token_type is not Bearer/u, 3],
    ['no refresh token', { token: { refresh_token: undefined } }, 'invalid_token_response', /refresh_token is missing/u, 3],
    ['expiry not a number', { token: { expires_in: '3600' } }, 'invalid_token_response', /expires_in/u, 3],
    ['account check refused', { account: () => Response.json({ error: 'boom' }, { status: 500 }) }, 'account_check_failed', /HTTP 500/u, 7],
    ['account without an id', { account: () => Response.json({ data: { name: 'No Id' } }) }, 'account_check_failed', /invalid_response/u, 7],
  ];
  for (const [label, options, code, reason, exit] of cases) {
    const revoked: string[] = [];
    const harness = io(brokenService({ ...options, revoked }), { env: {}, store: memoryStore([]) });
    harness.value.browser = async raw => { await approve(raw); };
    assert.equal(await runCLI(['auth', 'login', '--json'], harness.value, 'test'), exit, label);
    assert.equal(harness.out(), '', label);
    const lines = harness.err().trim().split('\n');
    assert.equal(lines.length, 3, `${label}: two link lines then one error line`);
    const error = JSON.parse(lines[2]).error;
    assert.equal(error.code, code, label); assert.match(error.message, reason, label);
    assert.ok(!lines[2].includes('access_synthetic') && !lines[2].includes('refresh_synthetic'), `${label}: no credential in the reason`);
    // Only the connection that was actually issued is revoked; a malformed answer may have nothing to revoke.
    if (code === 'account_check_failed' || code === 'granted_scope_mismatch') assert.ok(revoked.length >= 1, `${label}: revoked`);
  }
});

test('a name or email of any shape does not stop a login, and the check ignores everything but the id', async () => {
  for (const data of [{ id: 'u_123', name: null, email: null }, { id: 'u_123' }, { id: 'u_123', name: 7, email: ['x'], profile_picture: {} }]) {
    const saved: Session[] = [];
    const harness = io(brokenService({ account: () => Response.json({ data }) }), { env: {}, store: memoryStore(saved) });
    harness.value.browser = async raw => { await approve(raw); };
    assert.equal(await runCLI(['auth', 'login', '--json'], harness.value, 'test'), 0, JSON.stringify(data));
    assert.equal(saved.length, 1); assert.equal(JSON.parse(harness.out()).account_id, 'u_123');
  }
});

test('a credential store that refuses the write says which step failed, and the connection is revoked', async () => {
  const revoked: string[] = [];
  const store = { locked: async <T>(action: () => Promise<T>) => action(), load: async () => undefined,
    save: async () => { throw new JobHuntError('credential_store_unavailable', 0, undefined, undefined, 'the credential store refused the write (Secret Service is locked).'); } } as unknown as Partial<CredentialStore>;
  const harness = io(brokenService({ revoked }), { env: {}, store });
  harness.value.browser = async raw => { await approve(raw); };
  assert.equal(await runCLI(['auth', 'login', '--json'], harness.value, 'test'), 3);
  const error = JSON.parse(harness.err().trim().split('\n')[2]).error;
  assert.equal(error.code, 'credential_store_unavailable'); assert.match(error.message, /refused the write/u);
  assert.equal(revoked.length, 1);
});

/** The website host as production runs it: a path under /api/ that ends in a slash is answered with a redirect, which this client refuses. */
const websiteGateway = (inner: typeof fetch) => (async (input, init) => {
  const url = new URL(String(input));
  if (url.pathname.startsWith('/api/') && url.pathname.endsWith('/')) {
    assert.equal(init?.redirect, 'error', 'the client must keep refusing redirects');
    throw new TypeError('fetch failed: redirect mode is set to error');
  }
  return inner(input, init);
}) as typeof fetch;

test('login, status and a list call work through a host that redirects slash-ended API paths', async () => {
  const saved: Session[] = []; const seen: string[] = [];
  const service = websiteGateway((async (input, init) => {
    const url = new URL(String(input)); seen.push(url.pathname);
    if (url.pathname === '/api/v1/applications') return Response.json({ data: [], meta: { total: 0 } });
    return brokenService({})(input, init);
  }) as typeof fetch);
  const harness = io(service, { env: {}, store: memoryStore(saved) });
  harness.value.browser = async raw => { await approve(raw); };
  assert.equal(await runCLI(['auth', 'login', '--json'], harness.value, 'test'), 0, harness.err());
  assert.equal(saved.length, 1); assert.ok(seen.includes('/api/v1/account'));
  const client = new JobHuntClient({ fetchImpl: service, credential: { origin: 'https://jobhunt.app', token: 'access_synthetic' } });
  assert.equal((await client.verifiedAccountId()).length > 0, true);
  await client.request('/api/v1/applications/?return=creation-receipt'); assert.ok(seen.includes('/api/v1/applications'));
});
