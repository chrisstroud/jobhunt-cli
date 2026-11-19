import { spawn } from 'node:child_process';
import { JobHuntError, record } from '../../client/src/index.ts';
import type { Vault } from './credentials.ts';

// Some macOS Security calls keep a native worker alive after AbortSignal fires.
// Isolate those calls so a locked Keychain cannot strand the CLI or its lock.
// Credentials travel only over private pipes, never argv, environment or files.
const helper = String.raw`
import { createRequire } from 'node:module';
try {
  let input = '';
  for await (const bytes of process.stdin) {
    input += bytes; if (Buffer.byteLength(input) > 65536) throw Error();
  }
  const request = JSON.parse(input);
  if (!/^[a-f0-9]{64}$/.test(request.key) || !['get','set','remove'].includes(request.action)) throw Error();
  if (request.action === 'set' && (typeof request.value !== 'string' || Buffer.byteLength(request.value) > 32768)) throw Error();
  const { AsyncEntry } = createRequire(process.argv[1])('@napi-rs/keyring');
  const entry = new AsyncEntry('jobhunt-cli', request.key, {linux:{store:'secret-service'}});
  let value = null;
  if (request.action === 'get') value = await entry.getPassword(AbortSignal.timeout(4000));
  else if (request.action === 'set') await entry.setPassword(request.value, AbortSignal.timeout(4000));
  else await entry.deleteCredential(AbortSignal.timeout(4000));
  if (value !== null && (typeof value !== 'string' || Buffer.byteLength(value) > 32768)) throw Error();
  process.stdout.write(JSON.stringify({value}));
} catch { process.exitCode = 1; }
`;

export function processVault(key: string, options: {
  moduleURL?: string; timeoutMs?: number; environment?: NodeJS.ProcessEnv;
} = {}): Vault {
  const environment = Object.fromEntries(Object.entries(options.environment ?? process.env).filter(([name]) =>
    /^(PATH|HOME|TMPDIR|TEMP|TMP|SystemRoot|WINDIR|SystemDrive|COMSPEC|PATHEXT|USERPROFILE|LOCALAPPDATA|APPDATA|LANG|LC_ALL)$/iu.test(name)));
  const invoke = (action: 'get' | 'set' | 'remove', value?: string): Promise<string | null> => new Promise((resolve, reject) => {
    if (!/^[a-f0-9]{64}$/u.test(key) || (value !== undefined && Buffer.byteLength(value) > 32768)) {
      reject(new JobHuntError('credential_store_unavailable')); return;
    }
    const child = spawn(process.execPath, ['--input-type=module', '--eval', helper, options.moduleURL ?? import.meta.url],
      { env: environment, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    let output = '', failed = false;
    const kill = () => { child.kill('SIGKILL'); };
    const timer = setTimeout(() => { failed = true; kill(); }, options.timeoutMs ?? 5000);
    process.once('exit', kill);
    child.once('error', () => { failed = true; });
    child.stdin.once('error', () => { failed = true; kill(); });
    child.stdout.on('data', bytes => {
      output += bytes;
      if (Buffer.byteLength(output) > 65536) { failed = true; kill(); }
    });
    child.once('close', code => {
      clearTimeout(timer); process.removeListener('exit', kill);
      try {
        if (failed || code !== 0) throw Error();
        const result: unknown = JSON.parse(output);
        if (!record(result) || (result.value !== null && (typeof result.value !== 'string' || Buffer.byteLength(result.value) > 32768)) ||
            (action !== 'get' && result.value !== null)) throw Error();
        resolve(result.value as string | null);
      } catch { reject(new JobHuntError('credential_store_unavailable')); }
    });
    child.stdin.end(JSON.stringify({ key, action, ...(value !== undefined ? { value } : {}) }));
  });
  return { get: () => invoke('get'), set: async value => { await invoke('set', value); }, remove: async () => { await invoke('remove'); } };
}
