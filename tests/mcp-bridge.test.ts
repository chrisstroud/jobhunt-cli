import assert from 'node:assert/strict';
import test from 'node:test';
import { PassThrough } from 'node:stream';
import { JobHuntError } from '../client/src/index.ts';
import { runBridge } from '../cli/src/mcp-bridge.ts';

const secret = 'synthetic_bridge_credential';
async function run(lines: string[], fetchImpl: typeof fetch, token = async () => secret) {
  const input = new PassThrough(), output = new PassThrough(), log = new PassThrough();
  const out: string[] = [], err: string[] = [];
  output.on('data', chunk => out.push(String(chunk))); log.on('data', chunk => err.push(String(chunk)));
  const done = runBridge({ origin: 'https://jobhunt.app', input, output, log, token, fetchImpl });
  for (const line of lines) input.write(line + '\n');
  input.end(); await done;
  return { out: out.join('').split('\n').filter(Boolean).map(line => JSON.parse(line)), err: err.join('') };
}

test('each message is posted to /mcp with the saved sign-in and the answer comes back on stdout', async () => {
  const seen: { url: string; headers: Record<string, string>; body: string; redirect?: string }[] = [];
  const result = await run([JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })], async (url, init) => {
    seen.push({ url: String(url), headers: init?.headers as Record<string, string>, body: String(init?.body), redirect: init?.redirect });
    return Response.json({ jsonrpc: '2.0', id: 1, result: { tools: [] } });
  });
  assert.equal(seen.length, 1); assert.equal(seen[0].url, 'https://jobhunt.app/mcp');
  assert.equal(seen[0].headers.Authorization, `Bearer ${secret}`); assert.equal(seen[0].redirect, 'error');
  assert.deepEqual(result.out, [{ jsonrpc: '2.0', id: 1, result: { tools: [] } }]);
  assert.ok(!result.err.includes(secret));
});

test('a notification gets no answer and a 202 writes nothing', async () => {
  const result = await run([JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })],
    async () => new Response(null, { status: 202 }));
  assert.deepEqual(result.out, []);
});

test('a signed-out or refused connection answers the waiting request with a plain error and no secret', async () => {
  const request = JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list' });
  const signedOut = await run([request], async () => { throw Error('must not request'); },
    async () => { throw new JobHuntError('saved_credential_missing'); });
  assert.equal(signedOut.out[0].id, 7); assert.match(signedOut.out[0].error.message, /jobhunt auth login/);
  const refused = await run([request], async () => new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }));
  assert.equal(refused.out[0].id, 7); assert.match(refused.out[0].error.message, /jobhunt auth login/);
  const down = await run([request], async () => { throw new TypeError(`fetch failed ${secret}`); });
  assert.equal(down.out[0].error.message, 'JobHunt could not be reached.');
  assert.ok(!JSON.stringify(down).includes(secret));
});

test('bad input is answered once and never forwarded; the token is read per message', async () => {
  let posts = 0, reads = 0;
  const result = await run(['not json', '[1]', JSON.stringify({ jsonrpc: '2.0', id: 'a', method: 'ping' }),
    JSON.stringify({ jsonrpc: '2.0', id: 'b', method: 'ping' })],
  async () => { posts++; return Response.json({ jsonrpc: '2.0', id: 'x', result: {} }); }, async () => { reads++; return secret; });
  assert.equal(posts, 2); assert.equal(reads, 2);
  assert.equal(result.out.filter(value => value.error?.code === -32700).length, 1);
  assert.equal(result.out.filter(value => value.error?.code === -32600).length, 1);
});

test('a page that is not JSON is not passed on', async () => {
  const result = await run([JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping' })],
    async () => new Response('<html>sign in</html>', { status: 200, headers: { 'content-type': 'text/html' } }));
  assert.equal(result.out[0].id, 3); assert.match(result.out[0].error.message, /unexpected response/);
});

test('concurrent messages share one read of the saved sign-in and a busy store is retried', async () => {
  const { sharedToken } = await import('../cli/src/mcp-bridge.ts');
  let reads = 0, busy = 2;
  const token = sharedToken(async () => {
    reads++;
    if (busy-- > 0) throw new JobHuntError('credential_busy');
    await new Promise(resolve => setTimeout(resolve, 20));
    return { token: secret, expiresAt: Date.now() + 3_600_000 };
  }, { waitMs: 5 });
  const answers = await Promise.all(Array.from({ length: 8 }, () => token()));
  assert.deepEqual(new Set(answers), new Set([secret]));
  assert.equal(reads, 3);                      // two busy tries, then one good read shared by all eight
  await token(); assert.equal(reads, 3);       // reused until a minute before it expires
});

test('a store that stays busy fails with its own error after the retries; an expiring token is read again', async () => {
  const { sharedToken } = await import('../cli/src/mcp-bridge.ts');
  const stuck = sharedToken(async () => { throw new JobHuntError('credential_busy'); }, { retries: 2, waitMs: 1 });
  await assert.rejects(stuck(), /credential_busy/);
  let reads = 0, clock = 0;
  const token = sharedToken(async () => { reads++; return { token: secret, expiresAt: clock + 100_000 }; }, { now: () => clock });
  await token(); clock = 50_000; await token(); assert.equal(reads, 2);   // within 60 s of expiry: read again
});
