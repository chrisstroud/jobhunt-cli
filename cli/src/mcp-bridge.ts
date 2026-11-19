import type { Readable, Writable } from 'node:stream';
import { createInterface } from 'node:readline';
import { JobHuntError } from '../../client/src/index.ts';

/** Largest single JSON-RPC line the bridge forwards; the server refuses more anyway. */
export const MAX_LINE_BYTES = 1024 * 1024;
const MAX_ANSWER_BYTES = 8 * 1024 * 1024;
const PROTOCOL_HEADER = '2025-06-18';

export type BridgeOptions = {
  origin: string;
  input: Readable; output: Writable; log: Writable;
  /** A current access token. Called before every request so refresh, and a sign-out, are noticed. */
  token: () => Promise<string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const isId = (value: unknown) => typeof value === 'string' || typeof value === 'number';

/**
 * A stdio MCP server that forwards each JSON-RPC message to `<origin>/mcp` with the saved sign-in.
 * It holds no token itself, never follows redirects and logs nothing but fixed phrases to `log`.
 */
export async function runBridge(options: BridgeOptions): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL('/mcp', options.origin).href;
  const pending = new Set<Promise<void>>();
  const send = (value: unknown) => { options.output.write(JSON.stringify(value) + '\n'); };

  async function forward(line: string): Promise<void> {
    let message: unknown;
    try { message = JSON.parse(line); } catch { send(rpcError(null, -32700, 'Parse error')); return; }
    const request = message !== null && typeof message === 'object' && !Array.isArray(message) ? message as Record<string, unknown> : undefined;
    // Batches are not part of the protocol versions JobHunt serves.
    if (!request) { send(rpcError(null, -32600, 'Send one JSON-RPC message per line')); return; }
    const wantsAnswer = isId(request.id) && typeof request.method === 'string';
    const id = request.id;
    const fail = (code: number, text: string) => { if (wantsAnswer) send(rpcError(id, code, text)); options.log.write(text + '\n'); };
    let token: string;
    try { token = await options.token(); }
    catch (error) {
      fail(-32000, error instanceof JobHuntError && error.code === 'saved_credential_missing' || (error instanceof JobHuntError && error.code === 'authentication_required')
        ? 'Signed out. Run "jobhunt auth login" and restart this connection.' : 'Could not read the saved JobHunt sign-in.');
      return;
    }
    let response: Response;
    try {
      response = await fetchImpl(url, { method: 'POST', redirect: 'error', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}`,
          'MCP-Protocol-Version': PROTOCOL_HEADER },
        body: line, signal: AbortSignal.timeout(options.timeoutMs ?? 60000) });
    } catch { fail(-32000, 'JobHunt could not be reached.'); return; }
    if (response.status === 202) return;
    if (response.status === 401) { fail(-32000, 'JobHunt refused the saved sign-in. Run "jobhunt auth login" and restart this connection.'); return; }
    const type = response.headers.get('content-type') ?? '';
    const text = await response.text().catch(() => '');
    if (!type.startsWith('application/json') || text.length > MAX_ANSWER_BYTES) { fail(-32000, `JobHunt answered with an unexpected response (HTTP ${response.status}).`); return; }
    let answer: unknown;
    try { answer = JSON.parse(text); } catch { fail(-32000, 'JobHunt answered with an unreadable response.'); return; }
    if (wantsAnswer) send(answer);
  }

  const lines = createInterface({ input: options.input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    if (Buffer.byteLength(line) > MAX_LINE_BYTES) { send(rpcError(null, -32600, 'Message is too large')); continue; }
    const work = forward(line).catch(() => { options.log.write('The bridge could not handle a message.\n'); });
    pending.add(work); void work.finally(() => pending.delete(work));
  }
  await Promise.all(pending);
}

export type Credential = { token: string; expiresAt: number };

/**
 * Turns a "read the saved sign-in" step into one the bridge can call for every message, even when a client sends
 * several at once. Reads run one at a time in this process, the answer is reused until a minute before it expires
 * (so most messages never touch the credential store), and a store that another process holds for a moment
 * (`credential_busy`) is retried briefly instead of failing the message.
 */
export function sharedToken(read: () => Promise<Credential>, options: { now?: () => number; retries?: number; waitMs?: number } = {}): () => Promise<string> {
  const now = options.now ?? Date.now, retries = options.retries ?? 25, waitMs = options.waitMs ?? 200;
  let cached: Credential | undefined;
  let chain: Promise<unknown> = Promise.resolve();
  const fresh = async (): Promise<string> => {
    if (cached && cached.expiresAt - 60_000 > now()) return cached.token;
    for (let attempt = 0; ; attempt++) {
      try { cached = await read(); return cached.token; }
      catch (error) {
        if (!(error instanceof JobHuntError && error.code === 'credential_busy') || attempt >= retries) throw error;
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  };
  return () => { const next = chain.then(fresh, fresh); chain = next.catch(() => undefined); return next; };
}
