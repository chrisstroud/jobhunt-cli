import { createHash, randomUUID } from 'node:crypto';
import { constants, unlinkSync } from 'node:fs';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { JobHuntError, record, validToken } from '../../client/src/index.ts';
import { processVault } from './native-vault-process.ts';

export type Session = {
  version: 1; origin: string; profile: string; kind: 'oauth';
  accessToken: string; refreshToken: string; clientId: string; expiresAt: number; scopes: string[];
};
export type Vault = { get(): Promise<string | null>; set(value: string): Promise<void>; remove(): Promise<void> };
type Metadata = { version: 1; backend: 'keyring' | 'file'; origin: string; profile: string; session?: Session };

export function configDirectory(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (platform === 'win32') return path.join(env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local'), 'JobHunt', 'cli');
  if (platform === 'darwin') return path.join(homedir(), 'Library', 'Application Support', 'JobHunt', 'cli');
  const base = env.XDG_CONFIG_HOME || path.join(homedir(), '.config');
  if (!path.isAbsolute(base)) throw new JobHuntError('invalid_config_directory');
  return path.join(base, 'jobhunt', 'cli');
}
export function validateSession(value: unknown, origin: string, profile: string): Session {
  if (!record(value) || value.version !== 1 || value.kind !== 'oauth' || value.origin !== origin || value.profile !== profile ||
      !validToken(value.accessToken) || !validToken(value.refreshToken) || typeof value.clientId !== 'string' ||
      !/^[A-Za-z0-9._-]{1,255}$/u.test(value.clientId) || !Number.isSafeInteger(value.expiresAt) || Number(value.expiresAt) < 0 ||
      !Array.isArray(value.scopes) || value.scopes.some(s => typeof s !== 'string' || !/^[a-z]+:[a-z-]+$/u.test(s))) {
    throw new JobHuntError('invalid_saved_credential');
  }
  return value as unknown as Session;
}
async function nativeVault(key: string): Promise<Vault> {
  if (process.platform === 'darwin') return processVault(key);
  const { AsyncEntry } = await import('@napi-rs/keyring');
  const entry = new AsyncEntry('jobhunt-cli', key, { linux: { store: 'secret-service' } });
  return { get: () => entry.getPassword(AbortSignal.timeout(5000)),
    set: value => entry.setPassword(value, AbortSignal.timeout(5000)),
    remove: async () => { await entry.deleteCredential(AbortSignal.timeout(5000)); } };
}
/** The credential store failed: say which step, plus the platform's own short reason. It never holds a secret. */
function storeProblem(step: string, error: unknown): JobHuntError {
  const reason = error instanceof Error ? error.message.replace(/[^\x20-\x7e]/gu, ' ').trim().slice(0, 140) : '';
  return new JobHuntError('credential_store_unavailable', 0, undefined, undefined, `${step}${reason ? ` (${reason})` : ''}.`);
}
function isMissing(error: unknown) { return record(error) && error.code === 'ENOENT'; }

/** Every caller holds this store's lock across load/refresh/save or logout. */
export class CredentialStore {
  private readonly root: string;
  private readonly file: string;
  private readonly key: string;
  private readonly origin: string;
  private readonly profile: string;
  private readonly platform: string;
  private readonly factory: (key: string) => Promise<Vault>;
  constructor(origin: string, profile = 'default', options: {
    directory?: string; vaultFactory?: (key: string) => Promise<Vault>; platform?: string;
  } = {}) {
    if (!/^[A-Za-z0-9_-]{1,48}$/u.test(profile)) throw new JobHuntError('invalid_profile');
    this.origin = origin; this.profile = profile; this.root = options.directory ?? configDirectory();
    this.platform = options.platform ?? process.platform; this.factory = options.vaultFactory ?? nativeVault;
    this.key = createHash('sha256').update(`${origin}\0${profile}`).digest('hex');
    this.file = path.join(this.root, `${this.key}.json`);
  }
  private async directory() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const stat = await lstat(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (this.platform !== 'win32' &&
        ((stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())))) throw new JobHuntError('unsafe_credential_permissions');
  }
  async locked<T>(operation: () => Promise<T>): Promise<T> {
    await this.directory();
    let lock;
    try { lock = await open(`${this.file}.lock`, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
    catch { throw new JobHuntError('credential_busy'); }
    // Normal interruption must not strand the refresh lock. A hard kill remains
    // fail-closed and requires the documented manual recovery.
    const cleanup = () => { try { unlinkSync(`${this.file}.lock`); } catch { /* Best effort at process exit. */ } };
    const interrupt = () => process.exit(130);
    const terminate = () => process.exit(143);
    process.once('exit', cleanup); process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
    try { return await operation(); }
    finally {
      process.removeListener('exit', cleanup); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
      await lock.close(); await unlink(`${this.file}.lock`);
    }
  }
  private async metadata(): Promise<Metadata | null> {
    let handle;
    try { handle = await open(this.file, constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (error) { if (isMissing(error)) return null; throw new JobHuntError('credential_store_unavailable'); }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 32768 || (this.platform !== 'win32' &&
          ((stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())))) throw new JobHuntError('unsafe_credential_permissions');
      const value: unknown = JSON.parse(await handle.readFile('utf8'));
      if (!record(value) || value.version !== 1 || value.origin !== this.origin || value.profile !== this.profile ||
          !['keyring', 'file'].includes(String(value.backend))) throw new JobHuntError('invalid_saved_credential');
      return value as unknown as Metadata;
    } catch (error) { if (error instanceof JobHuntError) throw error; throw new JobHuntError('invalid_saved_credential'); }
    finally { await handle.close(); }
  }
  async load(): Promise<Session | null> {
    const metadata = await this.metadata(); if (!metadata) return null;
    if (metadata.backend === 'file') {
      if (this.platform === 'win32') throw new JobHuntError('credential_store_unavailable');
      return validateSession(metadata.session, this.origin, this.profile);
    }
    try {
      const raw = await (await this.factory(this.key)).get();
      if (!raw) throw new JobHuntError('saved_credential_missing');
      return validateSession(JSON.parse(raw), this.origin, this.profile);
    } catch (error) { if (error instanceof JobHuntError) throw error; throw new JobHuntError('credential_store_unavailable'); }
  }
  async save(session: Session): Promise<'keyring' | 'file'> {
    validateSession(session, this.origin, this.profile);
    const previous = await this.metadata();
    let backend: 'keyring' | 'file' = previous?.backend ?? 'keyring';
    if (backend === 'keyring') {
      let vault: Vault | undefined;
      try {
        vault = await this.factory(this.key);
        await vault.get(); // Establish availability before writing any secret.
      } catch (error) {
        if (previous || this.platform === 'win32') throw storeProblem('the operating system credential store could not be opened', error);
        backend = 'file'; vault = undefined;
      }
      if (vault) {
        try {
          await vault.set(JSON.stringify(session));
          if (await vault.get() !== JSON.stringify(session)) throw new Error('Credential readback mismatch');
        } catch (error) {
          if (!previous) await vault.remove().catch(() => {});
          // Never create a second secret copy after a possibly successful write.
          throw storeProblem(error instanceof Error && error.message === 'Credential readback mismatch'
            ? 'the credential store did not return what was written' : 'the credential store refused the write', error);
        }
      }
    }
    const metadata: Metadata = { version: 1, backend, origin: this.origin, profile: this.profile,
      ...(backend === 'file' ? { session } : {}) };
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await handle.writeFile(JSON.stringify(metadata)); await handle.sync(); }
      finally { await handle.close(); }
      await rename(temporary, this.file);
    }
    finally { await unlink(temporary).catch(error => { if (!isMissing(error)) throw error; }); }
    return backend;
  }
  async remove(): Promise<void> {
    const metadata = await this.metadata(); if (!metadata) return;
    if (metadata.backend === 'keyring') {
      try { await (await this.factory(this.key)).remove(); }
      catch { throw new JobHuntError('credential_store_unavailable'); }
    }
    await unlink(this.file);
  }
}
