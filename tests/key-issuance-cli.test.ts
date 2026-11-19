import { privateMode } from './private-file-fixture.ts';
import { assertPrivateFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import { createCipheriv, createHash, createPublicKey, publicEncrypt, randomBytes } from 'node:crypto';
import { link, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { runCLI, type IO } from '../cli/src/cli.ts';
import { CredentialStore } from '../cli/src/credentials.ts';

const account = 'jh_11111111-1111-4111-8111-111111111111', key = '22222222-2222-4222-8222-222222222222';
const secret = 'jsk_live_' + '1'.repeat(32), parent = 'synthetic-parent-credential';
const encode = (bytes: Uint8Array | string) => Buffer.from(bytes).toString('base64url');
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'jobhunt-key-cli-'));
  const plan = join(dir, 'plan.json'), recipient = join(dir, 'recipient.json'), original = join(dir, 'original.json'), output = join(dir, 'secret.txt');
  await writeFile(plan, JSON.stringify({ expected_account_id: account, attributes: { name: 'Synthetic test key', scopes: ['read:developer'] } }), { mode: 0o600 });
  let savedOriginal: Record<string, unknown> | null = null, delivery: Record<string, unknown> | null = null;
  let created = 0, acknowledged = 0, requests = 0, lost = false, loseAck = false;
  const fetchImpl: typeof fetch = async (url, init) => {
    requests++;
    assert.ok(!String(init?.body).includes(secret) && !String(init?.body).includes('PRIVATE KEY'));
    const path = new URL(String(url)).pathname;
    const args = init?.method === 'POST' ? JSON.parse(String(init.body)) : JSON.parse(new URL(String(url)).searchParams.get('arguments')!);
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer ' + parent);
    if (path.endsWith('review_api_key_creation')) return Response.json(ready({ recipient_fingerprint: createHash('sha256').update(Buffer.from(args.recipient_public_key, 'base64url')).digest('hex'),
      active_quota_used: 0, active_quota_limit: 25, review_token: 'synthetic-review', expires_at: '2030-01-01T00:00:00Z' }));
    if (path.endsWith('issue_api_key_record')) {
      if (savedOriginal) assert.deepEqual(args, savedOriginal);
      else {
        savedOriginal = args; created++;
        const publicKey = createPublicKey({ key: Buffer.from(args.recipient_public_key, 'base64url'), format: 'der', type: 'spki' });
        const kid = createHash('sha256').update(Buffer.from(args.recipient_public_key, 'base64url')).digest('hex');
        const header = encode(JSON.stringify({ account_id: account, alg: 'RSA-OAEP-256', enc: 'A256GCM', key_id: key,
          kid, request_id: args.request_id, typ: 'jobhunt-api-key+jwe' }));
        const cek = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', cek, iv); cipher.setAAD(Buffer.from(header));
        const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
        delivery = { key_id: key, request_id: args.request_id, recipient_fingerprint: kid, state: 'available', expires_at: '2030-01-01T00:00:00Z',
          sealed_jwe: [header, encode(publicEncrypt({ key: publicKey, oaepHash: 'sha256' }, cek)), encode(iv), encode(encrypted), encode(cipher.getAuthTag())].join('.') };
      }
      if (lost) { lost = false; throw Error('synthetic-private-transport'); }
      return Response.json({ ...ready(delivery), operation: { id: key, kind: 'issue_api_key_record', status: 'succeeded', resource: null,
        retry_after_seconds: 0, retry_expires_at: '2030-01-01T00:00:00Z' } });
    }
    if (path.endsWith('get_api_key_delivery')) return delivery ? Response.json(ready(delivery)) : Response.json({ errors: [{ code: 'not_found' }] }, { status: 404 });
    if (path.endsWith('acknowledge_api_key_delivery')) {
      assert.equal(args.confirm_received, true); assert.equal(args.recipient_fingerprint, delivery?.recipient_fingerprint);
      acknowledged++; delivery = { ...delivery, state: 'acknowledged', sealed_jwe: null };
      if (loseAck) { loseAck = false; throw Error('synthetic-private-acknowledgment'); }
      return Response.json(ready(delivery));
    }
    throw Error('Unexpected synthetic request');
  };
  async function run(command: string, flags: string[] = [], offline = false) {
    let stdout = '', stderr = '';
    const io: IO = { env: offline ? {} : { JOBHUNT_TOKEN: parent }, stdin: Readable.from([]), fetchImpl,
      stdout: new Writable({ write(chunk, _encoding, done) { stdout += chunk; done(); } }),
      stderr: new Writable({ write(chunk, _encoding, done) { stderr += chunk; done(); } }),
      storeFactory: (origin, profile) => {
        if (offline) throw Error('Offline preparation must not load credentials');
        const store = new CredentialStore(origin, profile, { directory: join(dir, 'unused-vault') });
        store.locked = async () => { throw Error('Personal keychain must not be touched'); };
        return store;
      } };
    const code = await runCLI([...command.split(' '), ...flags, '--json', '--non-interactive'], io, 'test');
    assert.ok(!stdout.includes(secret) && !stderr.includes(secret) && !stdout.includes('PRIVATE KEY') && !stderr.includes('PRIVATE KEY'));
    return { code, stdout, stderr, data: stdout ? JSON.parse(stdout) : null };
  }
  const prepare = () => run('api-keys prepare-recipient', ['--file', plan, '--output', recipient, '--confirm', account], true);
  const review = () => run('api-keys review-create', ['--recipient-file', recipient, '--output', original]);
  const issue = () => run('api-keys issue', ['--recipient-file', recipient, '--file', original, '--confirm', account]);
  const receive = () => run('api-keys receive', ['--recipient-file', recipient, '--file', original, '--output', output, '--confirm', key]);
  const acknowledge = () => run('api-keys acknowledge', ['--recipient-file', recipient, '--file', original, '--secret-file', output, '--confirm', key]);
  return { dir, plan, recipient, original, output, run, prepare, review, issue, receive, acknowledge,
    get counts() { return { created, acknowledged, requests }; }, loseIssue() { lost = true; }, loseAck() { loseAck = true; } };
}

test('local prepare avoids authentication/network and retains a mode0600 recipient before review', async () => {
  const f = await fixture();
  try {
    const result = await f.prepare(); assert.equal(result.code, 0); assert.equal(result.data.prepared, true);
    assert.equal(f.counts.requests, 0); await assertPrivateFile(f.recipient);
    const publicInput = await f.run('api-keys recipient', ['--recipient-file', f.recipient], true);
    assert.equal(publicInput.code, 0); assert.equal(publicInput.data.request_id, result.data.request_id);
    assert.ok(publicInput.data.recipient_public_key); assert.ok(!('private_pkcs8' in publicInput.data));
    assert.equal(f.counts.requests, 0);
    assert.equal((await f.review()).code, 0); await assertPrivateFile(f.original);
    const original = JSON.parse(await readFile(f.original, 'utf8'));
    assert.equal(original.request_id, result.data.request_id); assert.equal(original.confirm_create, true);
    assert.equal(f.counts.created, 0);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('lost issue recovers exact original, receive saves privately, acknowledgment verifies retention', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.prepare()).code, 0); assert.equal((await f.review()).code, 0);
    f.loseIssue(); assert.equal((await f.issue()).code, 7); assert.equal(f.counts.created, 1);
    const checked = await f.run('api-keys check-delivery', ['--file', f.original]);
    assert.equal(checked.code, 0); assert.equal(checked.data.data.key_id, key); assert.ok(!('sealed_jwe' in checked.data.data));
    assert.equal((await f.issue()).code, 0); assert.equal(f.counts.created, 1);
    const received = await f.receive(); assert.equal(received.code, 0); assert.equal(received.data.acknowledged, false);
    await assertPrivateFile(f.output); assert.equal((await readFile(f.output, 'utf8')).trim(), secret);
    assert.equal(f.counts.acknowledged, 0);
    assert.equal((await f.receive()).code, 7); // Existing file is never replaced.
    f.loseAck(); assert.equal((await f.acknowledge()).code, 7); assert.equal(f.counts.acknowledged, 1);
    const recovered = await f.acknowledge(); assert.equal(recovered.code, 0); assert.equal(recovered.data.already_acknowledged, true);
    assert.equal(recovered.data.local_file_verified, false); assert.equal(f.counts.acknowledged, 1);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('wrong recipient/origin, changed original and unsafe recipient files prevent issuance', async () => {
  const f = await fixture();
  try {
    await f.prepare(); await f.review();
    const raw = await readFile(f.recipient, 'utf8'), saved = JSON.parse(raw);
    for (const changed of [{ ...saved, origin: 'https://another.example' }, { ...saved, private_pkcs8: 'synthetic-corrupt-private-key' }]) {
      await writeFile(f.recipient, JSON.stringify(changed));
      const before = f.counts.requests; assert.equal((await f.issue()).code, 3); assert.equal(f.counts.requests, before);
    }
    await writeFile(f.recipient, raw); await privateMode(f.recipient, 0o644);
    const before = f.counts.requests; assert.equal((await f.issue()).code, 3); assert.equal(f.counts.requests, before);
    await privateMode(f.recipient, 0o600);
    const original = JSON.parse(await readFile(f.original, 'utf8')); original.attributes.name = 'Synthetic changed intent';
    await writeFile(f.original, JSON.stringify(original)); assert.equal((await f.issue()).code, 3);
    assert.equal(f.counts.created, 0);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('symlinks, hardlinks, unconfirmed writes and existing output fail closed without secret loss', async () => {
  const f = await fixture();
  try {
    await f.prepare(); await f.review();
    assert.equal((await f.run('api-keys issue', ['--file', f.original, '--recipient-file', f.recipient, '--confirm', key])).code, 2);
    assert.equal(f.counts.created, 0);
    await link(f.recipient, join(f.dir, 'recipient-alias')); assert.equal((await f.issue()).code, 3);
    await rm(join(f.dir, 'recipient-alias'));
    await f.issue();
    const untouched = join(f.dir, 'untouched.txt'); await writeFile(untouched, 'Synthetic unchanged output', { mode: 0o600 });
    await symlink(untouched, f.output);
    const before = f.counts.requests; assert.equal((await f.receive()).code, 7); assert.equal(f.counts.requests, before);
    assert.equal(await readFile(untouched, 'utf8'), 'Synthetic unchanged output');
    await rm(f.output); await writeFile(f.output, 'synthetic-wrong-secret\n', { mode: 0o600 });
    assert.equal((await f.acknowledge()).code, 3); assert.equal(f.counts.acknowledged, 0);
    await rm(f.output); await f.receive(); await privateMode(f.output, 0o640);
    assert.equal((await f.acknowledge()).code, 3); assert.equal(f.counts.acknowledged, 0);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('competing local preparation publishes only one private recipient and never calls a service', async () => {
  const f = await fixture();
  try {
    const results = await Promise.all([f.prepare(), f.prepare()]);
    assert.deepEqual(results.map(result => result.code).sort(), [0, 7]); assert.equal(f.counts.requests, 0);
    assert.equal((await f.review()).code, 0);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('private leaf inside a writable ancestor is rejected before creating credential material', async () => {
  const f = await fixture();
  try {
    const shared = join(f.dir, 'shared'), leaf = join(shared, 'private');
    await mkdir(leaf, { recursive: true, mode: 0o700 }); await privateMode(shared, 0o777);
    const result = await f.run('api-keys prepare-recipient', ['--file', f.plan, '--output', join(leaf, 'recipient.json'), '--confirm', account], true);
    assert.equal(result.code, 3); assert.equal(f.counts.requests, 0);
    await assert.rejects(lstat(join(leaf, 'recipient.json')));
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});
