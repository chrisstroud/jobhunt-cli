// Actual installed CLI and native vault on disposable GitHub-hosted macOS/Windows.
// The OAuth issuer below is synthetic; this is not hosted Flask acceptance.
import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

let stage = 'host guard', diagnostic = 'none', root, server, environment, artifact, origin, profile, safeReport, owned = false;
let macKeychain, macPassword, macDefault, macSearch, macCreated = false, lockedStoreVerified = false;
const check = value => { if (!value) throw Error('native vault check failed'); };
const execute = promisify(execFile);
function mark(value) {
  stage = value; process.stderr.write('Native credential check: ' + value + '.\n');
}
async function security(args, allowMissing = false) {
  try { return (await execute('/usr/bin/security', args, { env: environment, timeout: 10000, killSignal: 'SIGKILL', maxBuffer: 4096 })).stdout.trim(); }
  catch (error) {
    const message = String(error.stderr).toLowerCase();
    if (allowMissing && (message.includes('keychain could not be found') || message.includes('no default keychain'))) return null;
    diagnostic = Number.isInteger(error.code) ? 'security_exit_' + error.code : 'security_unavailable';
    throw Error('owned keychain operation failed');
  }
}
async function createMacKeychain() {
  macDefault = await security(['default-keychain', '-d', 'user'], true);
  if (macDefault) { macDefault = macDefault.replace(/^"|"$/gu, ''); check(path.isAbsolute(macDefault)); }
  const listed = await security(['list-keychains', '-d', 'user']);
  macSearch = [...listed.matchAll(/"([^"]+)"/gu)].map(match => match[1]);
  check(!listed.replace(/"[^"]+"/gu, '').trim() && macSearch.every(value => path.isAbsolute(value)));
  macKeychain = path.join(root, 'review.keychain-db'); macPassword = randomUUID() + randomUUID();
  // Password is generated in memory, never printed or added to a report/config.
  await security(['create-keychain', '-p', macPassword, macKeychain]); macCreated = true;
  await security(['set-keychain-settings', '-lut', '600', macKeychain]);
  await security(['unlock-keychain', '-p', macPassword, macKeychain]);
  await security(['list-keychains', '-d', 'user', '-s', macKeychain]);
  await security(['default-keychain', '-d', 'user', '-s', macKeychain]);
}
async function restoreMacKeychain() {
  if (macDefault) await security(['default-keychain', '-d', 'user', '-s', macDefault]);
  await security(['list-keychains', '-d', 'user', '-s', ...macSearch]);
  await security(['delete-keychain', macKeychain]);
  const current = await security(['default-keychain', '-d', 'user'], true);
  check(macDefault ? current?.replace(/^"|"$/gu, '') === macDefault : current === null);
  const listed = await security(['list-keychains', '-d', 'user']);
  check(JSON.stringify([...listed.matchAll(/"([^"]+)"/gu)].map(match => match[1])) === JSON.stringify(macSearch));
}
const probeScript = String.raw`
let phase = 'adapter';
try {
  const {createRequire}=await import('node:module'),{createHash}=await import('node:crypto');
  const [artifact,origin,profile,action,generation]=process.argv.slice(1);
  const {AsyncEntry}=createRequire(artifact)('@napi-rs/keyring');
  const key=createHash('sha256').update(origin+'\0'+profile).digest('hex');
  const entry=new AsyncEntry('jobhunt-cli',key,{linux:{store:'secret-service'}});
  phase='lookup';
  const raw=await entry.getPassword(AbortSignal.timeout(5000));
  phase='inspect';
  if(action==='empty') { if(raw!==null)throw Error(); }
  else if(action==='cleanup') { if(raw!==null)await entry.deleteCredential(AbortSignal.timeout(5000)); }
  else {
    const value=JSON.parse(raw);
    if(value.origin!==origin||value.profile!==profile||value.kind!=='oauth'||
      !value.accessToken.startsWith('jho_at_synthetic_'+generation+'_')||
      !value.refreshToken.startsWith('jho_rt_synthetic_'+generation+'_'))throw Error();
    if(action==='expire'){value.expiresAt=0;await entry.setPassword(JSON.stringify(value),AbortSignal.timeout(5000));}
    else if(value.expiresAt<=Date.now())throw Error();
  }
  process.stdout.write('ok');
} catch(error) {
  const message=String(error?.message??'').toLowerCase();
  const category=message.includes('keychain could not be found')||message.includes('no default keychain')?'keychain_missing':
    message.includes('user interaction is not allowed')?'interaction_unavailable':
    message.includes('cannot find module')||message.includes('no such file')?'adapter_missing':
    message.includes('item could not be found')?'item_missing':'withheld';
  process.stderr.write(phase+':'+category); process.exitCode=1;
}
`;

async function child(args, authorize, expectedCode = 0) {
  const processChild = spawn(process.execPath, args, { env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = '', browserStarted = false, browserFailed = false, authorization;
  const timer = setTimeout(() => { diagnostic = 'native_process_deadline'; processChild.kill('SIGKILL'); }, 25000);
  try {
    processChild.stdout.on('data', bytes => { stdout += bytes; if (stdout.length > 32768) processChild.kill(); });
    processChild.stderr.on('data', bytes => {
      stderr += bytes;
      if (stderr.length > 32768) processChild.kill();
      if (authorize && !browserStarted) {
        const match = /(http:\/\/127\.0\.0\.1:\d+\/oauth\/authorize\?[^\r\n]+)\r?\n/u.exec(stderr);
        if (match) {
          browserStarted = true;
          authorization = (async () => {
            const target = new URL(match[1]); check(target.origin === origin);
            const response = await fetch(target, { signal: AbortSignal.timeout(10000) });
            check(response.status === 200);
          })().catch(() => { browserFailed = true; processChild.kill(); });
        }
      }
    });
    const [code] = await once(processChild, 'close');
    await authorization;
    if (code !== expectedCode) {
      if (/^(adapter|lookup|inspect):(keychain_missing|interaction_unavailable|adapter_missing|item_missing|withheld)$/u.test(stderr)) diagnostic = stderr;
      else {
        try { const value = JSON.parse(stderr.trim().split('\n').at(-1));
          if (['credential_store_unavailable', 'invalid_saved_credential', 'internal_error'].includes(value.error?.code)) diagnostic = value.error.code;
        } catch { /* Never forward raw helper output. */ }
      }
    }
    check(code === expectedCode && !browserFailed && (!authorize || browserStarted));
    return { stdout, stderr };
  } finally { clearTimeout(timer); if (processChild.exitCode === null) processChild.kill(); }
}
async function probe(action, generation = 0) {
  const result = await child(['--input-type=module', '-e', probeScript, artifact, origin, profile, action, String(generation)]);
  check(result.stdout === 'ok' && !result.stderr);
}
async function cli(args, authorize = false, selectedProfile = profile) {
  const result = await child([artifact, '--origin', origin, '--allow-loopback', '--profile', selectedProfile, '--json', ...args], authorize);
  if (!authorize) check(!result.stderr);
  return JSON.parse(result.stdout);
}

try {
  check(process.env.JOBHUNT_TEST_NATIVE_VAULT === '1' && process.env.GITHUB_ACTIONS === 'true' &&
    process.env.RUNNER_ENVIRONMENT === 'github-hosted' && ['darwin', 'win32'].includes(process.platform));
  check(process.env.RUNNER_TEMP && path.isAbsolute(process.env.RUNNER_TEMP));
  mark('artifact');
  const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
  artifact = report.installedCLI;
  check(path.isAbsolute(artifact) && artifact.split(path.sep).includes('node_modules'));
  mark('owned fixture');
  root = await mkdtemp(path.join(process.env.RUNNER_TEMP, 'jobhunt-native-vault-'));
  const home = path.join(root, 'home'); await mkdir(home, { mode: 0o700 });
  profile = 'review_' + randomUUID();
  environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|SystemRoot|WINDIR|SystemDrive|COMSPEC|PATHEXT|TEMP|TMP|USERPROFILE|ProgramData|LANG|LC_ALL)$/iu.test(key)));
  Object.assign(environment, { HOME: home, XDG_CONFIG_HOME: path.join(root, 'config'), XDG_DATA_HOME: path.join(root, 'data'),
    LOCALAPPDATA: path.join(root, 'local'), APPDATA: path.join(root, 'roaming'), TMPDIR: root });
  if (process.platform === 'darwin') {
    mark('owned macOS keychain');
    await mkdir(path.join(home, 'Library', 'Keychains'), { recursive: true, mode: 0o700 });
    await mkdir(path.join(home, 'Library', 'Preferences'), { recursive: true, mode: 0o700 });
    await createMacKeychain();
  }
  const account = '11111111-1111-4111-8111-111111111111', scopes = 'read:profile read:applications write:applications read:campaigns read:companies read:contacts read:documents read:interviews read:tasks read:analytics';
  let redirect, challenge, authorizationCode, generation = 0, access, refresh, revoked = false, registered = 0, authorized = 0, exchanged = 0, refreshed = 0, reads = 0, revocations = 0, fixtureFailed = false;
  const issue = () => {
    access = 'jho_at_synthetic_' + generation + '_' + randomUUID(); refresh = 'jho_rt_synthetic_' + generation + '_' + randomUUID();
    return { token_type: 'Bearer', access_token: access, refresh_token: refresh, expires_in: 3600, scope: scopes };
  };
  server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url, origin);
      let body = ''; for await (const chunk of request) { body += chunk; check(body.length < 16384); }
      const json = value => { response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
      if (url.pathname === '/oauth/register' && request.method === 'POST') {
        const value = JSON.parse(body); check(!request.headers.authorization && value.token_endpoint_auth_method === 'none' && value.redirect_uris.length === 1);
        redirect = value.redirect_uris[0]; const callback = new URL(redirect); check(callback.origin.startsWith('http://127.0.0.1:'));
        registered++; json({ client_id: 'dyn_native_vault_fixture', token_endpoint_auth_method: 'none', redirect_uris: [redirect] });
      } else if (url.pathname === '/oauth/authorize' && request.method === 'GET') {
        const query = url.searchParams;
        check(registered === 1 && query.get('client_id') === 'dyn_native_vault_fixture' && query.get('redirect_uri') === redirect &&
          query.get('code_challenge_method') === 'S256' && query.get('scope') === scopes && query.get('resource') === 'https://jobhunt.app/mcp');
        challenge = query.get('code_challenge'); authorizationCode = randomUUID(); authorized++;
        const callback = new URL(redirect); callback.search = new URLSearchParams({ code: authorizationCode, state: query.get('state') });
        response.writeHead(302, { Location: callback.href }); response.end();
      } else if (url.pathname === '/oauth/token' && request.method === 'POST') {
        const form = new URLSearchParams(body); check(!request.headers.authorization && form.get('client_id') === 'dyn_native_vault_fixture' && form.get('resource') === 'https://jobhunt.app/mcp');
        if (form.get('grant_type') === 'authorization_code') {
          check(authorized === 1 && exchanged === 0 && form.get('code') === authorizationCode && form.get('redirect_uri') === redirect && createHash('sha256').update(form.get('code_verifier')).digest('base64url') === challenge);
          exchanged++;
        } else { check(form.get('grant_type') === 'refresh_token' && form.get('refresh_token') === refresh && !revoked); generation++; refreshed++; }
        json(issue());
      } else if (url.pathname === '/api/v1/account/' && request.method === 'GET') {
        check(!revoked && access && request.headers.authorization === 'Bearer ' + access); reads++;
        json({ data: { type: 'user_profile', id: account, attributes: { name: 'Synthetic Review', email: 'review@example.test' } } });
      } else if (url.pathname === '/oauth/revoke-token' && request.method === 'POST') {
        const form = new URLSearchParams(body); check(form.get('client_id') === 'dyn_native_vault_fixture' && form.get('token') === refresh && !revoked);
        revoked = true; revocations++; json({});
      } else { throw Error('Unexpected fixture request'); }
    })().catch(() => { fixtureFailed = true; response.writeHead(500).end(); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); origin = 'http://127.0.0.1:' + server.address().port;
  mark('native empty'); await probe('empty'); owned = true;
  mark('installed login');
  const login = await cli(['auth', 'login', '--no-browser'], true);
  check(login.authenticated && login.storage === 'keyring' && login.account_id === account); await probe('current');
  mark('private metadata');
  const config = process.platform === 'win32' ? path.join(environment.LOCALAPPDATA, 'JobHunt', 'cli') : path.join(home, 'Library', 'Application Support', 'JobHunt', 'cli');
  const files = await readdir(config); check(files.length === 1 && files[0].endsWith('.json'));
  const before = await readFile(path.join(config, files[0]), 'utf8'), metadata = JSON.parse(before);
  check(Object.keys(metadata).sort().join(',') === 'backend,origin,profile,version' && metadata.version === 1 &&
    metadata.backend === 'keyring' && metadata.origin === origin && metadata.profile === profile && !before.includes('jho_'));
  mark('cold saved login'); check((await cli(['auth', 'status'])).authenticated);
  check(!(await cli(['auth', 'status'], false, 'other_' + randomUUID())).authenticated);
  if (macCreated) {
    mark('locked macOS keychain'); await security(['lock-keychain', macKeychain]);
    try {
      const started = Date.now();
      const locked = await child([artifact, '--origin', origin, '--allow-loopback', '--profile', profile, '--json', 'auth', 'status'], false, 3);
      check(Date.now() - started < 15000);
      check(!locked.stdout && JSON.parse(locked.stderr).error.code === 'credential_store_unavailable');
      check((await readdir(config)).length === 1 && await readFile(path.join(config, files[0]), 'utf8') === before);
    } finally { await security(['unlock-keychain', '-p', macPassword, macKeychain]); }
    await probe('current'); lockedStoreVerified = true;
  }
  mark('unavailable native backend');
  // Remove only this disposable consumer's native adapter temporarily. The real
  // OS credential remains present; a cold CLI must refuse without a file copy.
  const adapter = path.dirname(createRequire(artifact).resolve('@napi-rs/keyring'));
  check(JSON.parse(await readFile(path.join(adapter, 'package.json'), 'utf8')).name === '@napi-rs/keyring');
  const parkedAdapter = adapter + '-owned-unavailable-' + randomUUID();
  await rename(adapter, parkedAdapter);
  try {
    const unavailable = await child([artifact, '--origin', origin, '--allow-loopback', '--profile', profile, '--json', 'auth', 'status'], false, 3);
    check(!unavailable.stdout && JSON.parse(unavailable.stderr).error.code === 'credential_store_unavailable');
    check((await readdir(config)).length === 1 && await readFile(path.join(config, files[0]), 'utf8') === before);
  } finally { await rename(parkedAdapter, adapter); }
  await probe('current');
  mark('native rotation'); await probe('expire');
  check((await cli(['whoami'])).data.id === account); await probe('current', 1);
  check(refreshed === 1 && (await readdir(config)).length === 1 && await readFile(path.join(config, files[0]), 'utf8') === before);
  mark('native logout'); check((await cli(['auth', 'logout'])).remote_revocation === 'completed_or_no_saved_connection');
  await probe('empty'); check((await readdir(config)).length === 0 && !(await cli(['auth', 'status'])).authenticated);
  check(!fixtureFailed && registered === 1 && authorized === 1 && exchanged === 1 && refreshed === 1 && revocations === 1 && reads === 3);
  mark('report');
  safeReport = { platform: process.platform, installedArtifact: true, nativeStorage: true, coldRestart: true,
    profileIsolation: true, metadataHasNoSecrets: true, unavailableAdapterRefusedWithoutDowngrade: true, lockedOsVaultTested: lockedStoreVerified,
    refreshRotated: true, syntheticRevocationObserved: true, nativeCredentialRemoved: true,
    fixture: 'synthetic-loopback-issuer', hostedFlaskAcceptance: false };
} catch {
  process.stderr.write('Native credential check failed at ' + stage + '. Private details withheld.\n'); process.exitCode = 1;
  if (diagnostic !== 'none') process.stderr.write('::error title=Native credential diagnostic::' + diagnostic + '\n');
} finally {
  if (macCreated) { mark('cleanup unlock'); try { await security(['unlock-keychain', '-p', macPassword, macKeychain]); } catch { process.stderr.write('Owned keychain unlock failed.\n'); process.exitCode = 1; } }
  if (owned) { mark('cleanup native credential'); try { await probe('cleanup'); await probe('empty'); } catch { process.stderr.write('Owned native credential cleanup failed.\n'); process.exitCode = 1; } }
  if (macCreated) { mark('cleanup keychain settings'); try { await restoreMacKeychain(); } catch { process.stderr.write('Owned keychain cleanup failed.\n'); process.exitCode = 1; } }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (root) { mark('cleanup owned fixture'); try { await rm(root, { recursive: true, force: true }); } catch { process.stderr.write('Owned fixture cleanup failed.\n'); process.exitCode = 1; } }
}
if (safeReport && !process.exitCode) {
  try { await writeFile('native-vault-report.json', JSON.stringify({ ...safeReport, fixtureCleanupVerified: true, macKeychainSettingsRestored: macCreated ? true : null }) + '\n'); }
  catch { process.stderr.write('Safe native report could not be saved.\n'); process.exitCode = 1; }
}
