import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { processVault } from '../cli/src/native-vault-process.ts';

const key = 'a'.repeat(64), secret = 'synthetic_pipe_secret_only';
async function fixture(source: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'jobhunt-vault-process-'));
  const dependency = path.join(root, 'node_modules', '@napi-rs', 'keyring');
  await mkdir(dependency, { recursive: true });
  await writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name: '@napi-rs/keyring', main: 'index.cjs' }));
  await writeFile(path.join(dependency, 'index.cjs'), source);
  return { root, moduleURL: pathToFileURL(path.join(root, 'fixture.mjs')).href };
}
function unavailable(error: unknown) {
  assert.ok(error instanceof Error); assert.equal(error.message, 'credential_store_unavailable'); return true;
}

test('native helper uses the selected module, private pipes and a narrow environment', async () => {
  const owned = await fixture(`exports.AsyncEntry = class {
    constructor(service,key) {
      if(service!=='jobhunt-cli'||key!==${JSON.stringify(key)}||process.env.JOBHUNT_SYNTHETIC_SECRET||
        process.env.NODE_OPTIONS||process.argv.some(value=>value.includes(${JSON.stringify(secret)})))throw Error();
    }
    async getPassword(){return ${JSON.stringify(secret)};}
    async setPassword(value){if(value!==${JSON.stringify(secret)})throw Error();}
    async deleteCredential(){return false;}
  };`);
  try {
    const vault = processVault(key, { moduleURL: owned.moduleURL,
      environment: { ...process.env, JOBHUNT_SYNTHETIC_SECRET: secret, NODE_OPTIONS: '--invalid-injected-flag' } });
    assert.equal(await vault.get(), secret); await vault.set(secret); await vault.remove();
  } finally { await rm(owned.root, { recursive: true, force: true }); }
});

test('blocked native work is killed before reporting unavailability', { timeout: 15000 }, async () => {
  const owned = await fixture(''); const pidFile = path.join(owned.root, 'owned.pid');
  await writeFile(path.join(owned.root, 'node_modules', '@napi-rs', 'keyring', 'index.cjs'),
    `exports.AsyncEntry=class { getPassword(){require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));while(true){}} };`);
  try {
    const start = Date.now();
    await assert.rejects(processVault(key, { moduleURL: owned.moduleURL, timeoutMs: 2000 }).get(), unavailable);
    assert.ok(Date.now() - start < 10000);
    const pid = Number(await readFile(pidFile, 'utf8')); assert.ok(pid > 0);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally { await rm(owned.root, { recursive: true, force: true }); }
});

test('private native errors and oversized output do not escape the helper', async () => {
  for (const body of [`throw Error(${JSON.stringify(secret)})`, `return 'x'.repeat(32769)`]) {
    const owned = await fixture(`exports.AsyncEntry=class { async getPassword(){${body}} };`);
    try { await assert.rejects(processVault(key, { moduleURL: owned.moduleURL }).get(), unavailable); }
    finally { await rm(owned.root, { recursive: true, force: true }); }
  }
});

test('interrupting a blocked vault caller releases its lock and kills its helper',
  { skip: process.platform === 'win32', timeout: 15000 }, async () => {
    const owned = await fixture(''); const pidFile = path.join(owned.root, 'owned.pid'), directory = path.join(owned.root, 'credentials');
    await writeFile(path.join(owned.root, 'node_modules', '@napi-rs', 'keyring', 'index.cjs'),
      `exports.AsyncEntry=class { getPassword(){require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));while(true){}} };`);
    const child = spawn(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', `
      import { CredentialStore } from ${JSON.stringify(new URL('../cli/src/credentials.ts', import.meta.url).href)};
      import { processVault } from ${JSON.stringify(new URL('../cli/src/native-vault-process.ts', import.meta.url).href)};
      const store=new CredentialStore('https://jobhunt.app','default',{directory:${JSON.stringify(directory)},
        vaultFactory:async key=>processVault(key,{moduleURL:${JSON.stringify(owned.moduleURL)}})});
      await store.locked(()=>store.save({version:1,origin:'https://jobhunt.app',profile:'default',kind:'oauth',
        accessToken:'jho_at_synthetic',refreshToken:'jho_rt_synthetic',clientId:'dyn_synthetic',expiresAt:Date.now()+60000,scopes:[]}));
    `], { stdio: ['ignore', 'ignore', 'ignore'] });
    let pid: number | undefined;
    try {
      const end = Date.now() + 8000;
      while (Date.now() < end) {
        try { pid = Number(await readFile(pidFile, 'utf8')); break; } catch { await new Promise(resolve => setTimeout(resolve, 20)); }
      }
      assert.ok(pid && pid > 0);
      const closed = once(child, 'close'); child.kill('SIGTERM'); assert.deepEqual(await closed, [143, null]);
      assert.deepEqual(await readdir(directory), []);
      // A killed helper may briefly remain a zombie until the OS reaps it.
      for (let i = 0; i < 100; i++) {
        try { process.kill(pid, 0); } catch (error) { assert.equal((error as NodeJS.ErrnoException).code, 'ESRCH'); return; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.fail('Owned native helper remained alive after caller termination');
    } finally {
      if (child.exitCode === null) child.kill('SIGKILL');
      if (pid) { try { process.kill(pid, 'SIGKILL'); } catch { /* Already stopped. */ } }
      await rm(owned.root, { recursive: true, force: true });
    }
  });
