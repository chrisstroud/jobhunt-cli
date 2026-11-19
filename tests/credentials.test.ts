import assert from 'node:assert/strict';
import test from 'node:test';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, stat, chmod, symlink, writeFile } from 'node:fs/promises';
import { CredentialStore } from '../cli/src/credentials.ts';
import type { Session, Vault } from '../cli/src/credentials.ts';
const session: Session = { version: 1, origin: 'https://jobhunt.app', profile: 'default', kind: 'oauth',
  accessToken: 'jho_at_synthetic_access_only', refreshToken: 'jho_rt_synthetic_refresh_only', clientId: 'dyn_synthetic',
  expiresAt: Date.now() + 3600000, scopes: ['read:applications'] };
function memory() {
  const values = new Map<string, string>();
  return { values, factory: async (key: string): Promise<Vault> => ({
    get: async () => values.get(key) ?? null, set: async value => { values.set(key, value); }, remove: async () => { values.delete(key); },
  }) };
}
test('native storage contains the secret; metadata does not; logout removes both', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'jobhunt-credential-test-')); const native = memory();
  const store = new CredentialStore(session.origin, session.profile, { directory, vaultFactory: native.factory });
  await store.locked(async () => { assert.equal(await store.save(session), 'keyring'); assert.deepEqual(await store.load(), session); });
  const [file] = await readdir(directory); const text = await readFile(`${directory}/${file}`, 'utf8');
  assert.ok(!text.includes(session.accessToken)); assert.ok(!text.includes(session.refreshToken));
  await store.locked(() => store.remove()); assert.equal(native.values.size, 0); assert.deepEqual(await readdir(directory), []);
});
test('unavailable native store uses owner-only POSIX fallback, isolated by host and profile', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'jobhunt-credential-test-'));
  const options = { directory, vaultFactory: async (): Promise<Vault> => { throw Error('not available'); }, platform: 'linux' };
  const store = new CredentialStore(session.origin, session.profile, options);
  await store.locked(async () => { assert.equal(await store.save(session), 'file'); assert.deepEqual(await store.load(), session); });
  const [file] = await readdir(directory); assert.equal((await stat(`${directory}/${file}`)).mode & 0o777, 0o600);
  assert.equal(await new CredentialStore('https://other.example', session.profile, options).locked(async () =>
    new CredentialStore('https://other.example', session.profile, options).load()), null);
  assert.equal(await new CredentialStore(session.origin, 'other', options).load(), null);
  await store.locked(() => store.remove());
});
test('Windows never silently writes a credential file when its vault is unavailable', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'jobhunt-credential-test-'));
  const store = new CredentialStore(session.origin, session.profile, { directory, platform: 'win32', vaultFactory: async () => { throw Error('locked'); } });
  await assert.rejects(store.locked(() => store.save(session)), /credential_store_unavailable/);
  assert.deepEqual(await readdir(directory), []);
});
test('an existing locked keyring cannot downgrade to a credential file', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'jobhunt-credential-test-')); const native = memory();
  const original = new CredentialStore(session.origin, session.profile, { directory, vaultFactory: native.factory });
  await original.locked(() => original.save(session));
  const broken = new CredentialStore(session.origin, session.profile, { directory, vaultFactory: async () => { throw Error('locked'); } });
  await assert.rejects(broken.locked(() => broken.load()), /credential_store_unavailable/);
  await assert.rejects(broken.locked(() => broken.save(session)), /credential_store_unavailable/);
  const [file] = await readdir(directory); assert.ok(!(await readFile(`${directory}/${file}`, 'utf8')).includes(session.accessToken));
});
test('unsafe permissions, symlinks and concurrent refresh are refused', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'jobhunt-credential-test-'));
  const store = new CredentialStore(session.origin, session.profile, { directory, vaultFactory: async () => { throw Error('missing'); } });
  await store.locked(() => store.save(session));
  await store.locked(async () => { await assert.rejects(store.locked(async () => null), /credential_busy/); });
  const [file] = await readdir(directory); await chmod(`${directory}/${file}`, 0o644);
  await assert.rejects(store.locked(() => store.load()), /unsafe_credential_permissions/);
  await chmod(`${directory}/${file}`, 0o600); await store.locked(() => store.remove());
  const target = `${directory}/unrelated`; await writeFile(target, 'not a credential', { mode: 0o600 });
  await symlink(target, `${directory}/${file}`);
  await assert.rejects(store.locked(() => store.load()), /credential_store_unavailable/);
  assert.equal(await readFile(target, 'utf8'), 'not a credential');
});
test('normal termination releases the owned refresh lock', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'jobhunt-credential-test-'));
  const child = spawn(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', `
    import { CredentialStore } from ${JSON.stringify(new URL('../cli/src/credentials.ts', import.meta.url).href)};
    const store = new CredentialStore('https://jobhunt.app', 'default', { directory: process.argv[1] });
    await store.locked(async () => { process.stdout.write('ready'); await new Promise(resolve => setTimeout(resolve, 30000)); });
  `, directory], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await once(child.stdout, 'data');
    const exited = once(child, 'exit'); child.kill('SIGTERM');
    assert.deepEqual(await exited, [143, null]); assert.deepEqual(await readdir(directory), []);
  } finally { if (child.exitCode === null) child.kill(); }
});
