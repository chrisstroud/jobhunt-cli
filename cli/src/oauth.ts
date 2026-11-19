import { callbackPage, CALLBACK_PAGE_POLICY, type CallbackPageKind } from './callback-page.ts';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { JobHuntClient, JobHuntError, OAUTH_RESOURCE, record, validToken } from '../../client/src/index.ts';
import type { Session } from './credentials.ts';

export const DEFAULT_SCOPES = ['read:profile', 'read:applications', 'write:applications'];
/**
 * What `jobhunt auth login` asks for with no flags: the standard set for first-party integrations on this computer
 * (docs/plugin-contract.md). One write permission, saving a link. `--scopes` replaces it.
 */
export const INTEGRATION_SCOPES = ['read:profile', 'read:applications', 'write:applications', 'read:campaigns', 'read:companies',
  'read:contacts', 'read:documents', 'read:interviews', 'read:tasks', 'read:analytics'];
export const LOGIN_SCOPES = [...DEFAULT_SCOPES, 'read:contacts', 'write:contacts', 'read:tasks', 'write:tasks', 'read:campaigns',
  'read:calendar', 'write:calendar', 'read:developer', 'write:developer',
  'read:extensions', 'write:extensions',
  'read:account-export',
  'read:interviews', 'write:interviews', 'read:documents', 'write:documents', 'read:companies', 'write:companies', 'write:campaigns', 'write:profile',
  'read:analytics', 'read:activity', 'read:highlights', 'write:highlights', 'read:notifications', 'write:notifications'];
/** Explicit replacement, never an implicit expansion of existing grants. */
/** How long `auth login` waits for the person to approve in the browser. */
export const LOGIN_TIMEOUT_MS = 300_000;
export function loginScopes(value?: string): string[] {
  if (value === undefined) return [...INTEGRATION_SCOPES];
  const scopes = value.split(',');
  if (!scopes.includes('read:profile') || scopes.some(scope => !LOGIN_SCOPES.includes(scope)) ||
      new Set(scopes).size !== scopes.length) throw new JobHuntError('invalid_input');
  return scopes;
}
/** What is wrong with a token answer, in words that name no secret; undefined when it is acceptable. */
export function tokenProblem(value: unknown, expectedScopes: string[]): string | undefined {
  if (!record(value)) return 'the token answer is not a JSON object';
  if (value.token_type?.toString().toLowerCase() !== 'bearer') return 'token_type is not Bearer';
  if (!validToken(value.access_token)) return 'access_token is missing or malformed';
  if (!validToken(value.refresh_token)) return 'refresh_token is missing or malformed';
  if (!Number.isSafeInteger(value.expires_in) || Number(value.expires_in) < 1 || Number(value.expires_in) > 31536000) return 'expires_in is not a whole number of seconds between 1 and one year';
  if (typeof value.scope !== 'string') return 'scope is missing';
  const scopes = value.scope.split(' ').filter(Boolean);
  if (new Set(scopes).size !== scopes.length) return 'scope repeats a permission';
  const unexpected = scopes.filter(scope => !expectedScopes.includes(scope)), missing = expectedScopes.filter(scope => !scopes.includes(scope));
  if (unexpected.length || missing.length) {
    const list = (items: string[]) => items.filter(item => /^[a-z]+:[a-z-]+$/u.test(item)).join(', ') || 'other';
    return `the granted permissions differ from the ones asked for${missing.length ? `; not granted: ${list(missing)}` : ''}${unexpected.length ? `; not asked for: ${list(unexpected)}` : ''}`;
  }
  return undefined;
}
export function parseToken(value: unknown, base: Pick<Session, 'origin' | 'profile' | 'clientId'>, expectedScopes: string[], now = Date.now()): Session {
  const problem = tokenProblem(value, expectedScopes);
  if (problem !== undefined || !record(value)) {
    const scopeProblem = problem?.startsWith('the granted permissions') || problem === 'scope repeats a permission';
    throw new JobHuntError(scopeProblem ? 'granted_scope_mismatch' : 'invalid_token_response', 0, undefined, undefined, problem);
  }
  return { ...base, version: 1, kind: 'oauth', accessToken: value.access_token as string,
    refreshToken: value.refresh_token as string, expiresAt: now + Number(value.expires_in) * 1000, scopes: String(value.scope).split(' ').filter(Boolean) };
}
export async function refresh(client: JobHuntClient, session: Session): Promise<Session> {
  const value = await client.request('/oauth/token', { authenticated: false, method: 'POST',
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: session.clientId,
      refresh_token: session.refreshToken, resource: OAUTH_RESOURCE }) });
  return acceptToken(client, value, session, session.scopes);
}
export async function revoke(client: JobHuntClient, session: Pick<Session, 'clientId' | 'refreshToken'>): Promise<void> {
  await client.request('/oauth/revoke-token', { authenticated: false, method: 'POST',
    body: new URLSearchParams({ client_id: session.clientId, token: session.refreshToken, token_type_hint: 'refresh_token' }) });
}
async function acceptToken(client: JobHuntClient, value: unknown, base: Pick<Session, 'origin' | 'profile' | 'clientId'>, scopes: string[]) {
  try { return parseToken(value, base, scopes); }
  catch (error) {
    // An issued credential with an invalid contract must not be left usable
    // merely because the local client refuses to store it.
    if (record(value)) {
      const token = validToken(value.refresh_token) ? value.refresh_token : value.access_token;
      if (validToken(token)) await client.request('/oauth/revoke-token', { authenticated: false, method: 'POST',
        body: new URLSearchParams({ client_id: base.clientId, token }) }).catch(() => {});
    }
    throw error;
  }
}
export async function openBrowser(url: string): Promise<void> {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32'
    ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]];
  const child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true });
  await once(child, 'spawn'); child.unref();
}

/** Public client, S256 PKCE, exact loopback callback, bounded one-use state. */
export async function login(client: JobHuntClient, profile: string, options: {
  onAuthorization: (url: string) => Promise<void>; timeoutMs?: number; scopes?: string;
}): Promise<Session> {
  const scopes = loginScopes(options.scopes);
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(32).toString('base64url');
  const callbackPath = `/callback/${randomBytes(16).toString('hex')}`;
  let finish: (value: string) => void = () => {};
  let fail: (error: Error) => void = () => {};
  const code = new Promise<string>((resolve, reject) => { finish = resolve; fail = reject; });
  // Registration/browser startup can fail before the callback is awaited.
  void code.catch(() => {});
  let consumed = false;
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', CALLBACK_PAGE_POLICY);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    const page = (status: number, kind: CallbackPageKind) => { response.writeHead(status).end(callbackPage(kind)); };
    const address = server.address();
    if (!address || typeof address === 'string' || request.headers.host !== `127.0.0.1:${address.port}` ||
        request.method !== 'GET' || !request.url?.startsWith('/') || request.url.startsWith('//') || request.url.length > 4096) {
      page(400, 'error'); return;
    }
    const url = new URL(request.url, `http://127.0.0.1:${address.port}`);
    if (url.pathname !== callbackPath || url.hash) { page(404, 'error'); return; }
    const returnedState = url.searchParams.get('state') ?? '';
    if (consumed || url.searchParams.getAll('state').length !== 1 || Buffer.byteLength(returnedState) !== Buffer.byteLength(state) ||
        !timingSafeEqual(Buffer.from(returnedState), Buffer.from(state))) {
      page(400, 'error'); return;
    }
    if (url.searchParams.has('error')) {
      if (url.searchParams.getAll('error').length !== 1 || url.searchParams.has('code')) {
        page(400, 'error'); return;
      }
      consumed = true; page(200, 'denied');
      fail(new JobHuntError('authorization_denied')); return;
    }
    const result = url.searchParams.get('code');
    if (!result || result.length > 2048 || url.searchParams.getAll('code').length !== 1) {
      page(400, 'error'); return;
    }
    consumed = true; page(200, 'success'); finish(result);
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw new JobHuntError('callback_unavailable');
  const redirectUri = `http://127.0.0.1:${address.port}${callbackPath}`;
  const timer = setTimeout(() => { consumed = true; fail(new JobHuntError('authorization_timeout')); }, options.timeoutMs ?? LOGIN_TIMEOUT_MS);
  try {
    const registered = await client.request('/oauth/register', { authenticated: false, method: 'POST', body: {
      client_name: 'JobHunt CLI', redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
    } });
    if (!record(registered) || typeof registered.client_id !== 'string' || !/^[A-Za-z0-9._-]{1,255}$/u.test(registered.client_id) ||
        registered.token_endpoint_auth_method !== 'none' || !Array.isArray(registered.redirect_uris) ||
        registered.redirect_uris.length !== 1 || registered.redirect_uris[0] !== redirectUri) throw new JobHuntError('invalid_registration_response');
    const url = new URL('/oauth/authorize', client.origin);
    url.search = new URLSearchParams({ client_id: registered.client_id, response_type: 'code',
      redirect_uri: redirectUri, scope: scopes.join(' '), state,
      code_challenge: challenge, code_challenge_method: 'S256', resource: OAUTH_RESOURCE }).toString();
    await options.onAuthorization(url.href);
    const value = await client.request('/oauth/token', { authenticated: false, method: 'POST',
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: registered.client_id,
        redirect_uri: redirectUri, code: await code, code_verifier: verifier, resource: OAUTH_RESOURCE }) });
    return await acceptToken(client, value, { origin: client.origin, profile, clientId: registered.client_id }, scopes);
  } finally { clearTimeout(timer); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
