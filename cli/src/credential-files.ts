/** Local-only credential files. Never return their contents or paths in errors. */
import { constants } from 'node:fs';
import { lstat, open, realpath, unlink } from 'node:fs/promises';
import { dirname, basename, join, resolve } from 'node:path';
import { JobHuntError } from '../../client/src/index.ts';
import { newWindowsPrivateFile, windowsACL, windowsPrivateTarget } from './windows-private-files.ts';

async function target(value: unknown) {
  if (typeof value !== 'string' || !value || value === '-' || value.includes('\0')) throw new JobHuntError('invalid_input');
  if (process.platform === 'win32') return windowsPrivateTarget(value);
  try {
    const absolute = resolve(value), parent = await realpath(dirname(absolute));
    const stat = await lstat(parent);
    if (!stat.isDirectory() || (stat.mode & 0o022) !== 0 || process.getuid && stat.uid !== process.getuid()) throw new Error();
    // A private leaf under an attacker-controlled ancestor is not a trusted
    // destination. Root-owned sticky temporary roots are safe when their
    // selected child belongs to this user; resolve normal OS path aliases first.
    let ancestor = dirname(parent);
    while (true) {
      const node = await lstat(ancestor);
      if (!node.isDirectory() || process.getuid && node.uid !== 0 && node.uid !== process.getuid() ||
        (node.mode & 0o022) !== 0 && !(node.uid === 0 && (node.mode & 0o1000) !== 0)) throw new Error();
      const next = dirname(ancestor); if (next === ancestor) break; ancestor = next;
    }
    return join(parent, basename(absolute));
  } catch { throw new JobHuntError('unsafe_credential_permissions'); }
}

export async function credentialBytes(value: unknown, limit = 1048576): Promise<Buffer> {
  const path = await target(value);
  const windows = process.platform === 'win32';
  if (windows) await windowsACL('file', path);
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    // Windows file IDs (and some POSIX inode IDs) exceed Number precision.
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(limit) || !windows && ((before.mode & 0o077n) !== 0n || process.getuid && before.uid !== BigInt(process.getuid()))) {
      throw new JobHuntError('unsafe_credential_permissions');
    }
    const bytes = Buffer.alloc(limit + 1); let length = 0;
    while (length < bytes.length) {
      const chunk = await handle.read(bytes, length, bytes.length - length, null);
      if (!chunk.bytesRead) break;
      length += chunk.bytesRead;
    }
    const after = await handle.stat({ bigint: true }), current = await lstat(path, { bigint: true });
    if (length > limit || before.size !== BigInt(length) || after.size !== BigInt(length) || after.mtimeNs !== before.mtimeNs ||
      current.isSymbolicLink() || current.ino !== before.ino || current.dev !== before.dev || !windows && (current.mode & 0o077n) !== 0n || current.nlink !== 1n) {
      throw new JobHuntError('credential_file_changed');
    }
    if (windows) await windowsACL('file', path);
    return bytes.subarray(0, length);
  } catch (error) {
    if (error instanceof JobHuntError) throw error;
    throw new JobHuntError('credential_file_unavailable');
  } finally { await handle?.close(); }
}

export async function credentialJSON(value: unknown): Promise<unknown> {
  const bytes = await credentialBytes(value);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new JobHuntError('invalid_credential_file'); }
}

export async function newCredentialFile(value: unknown, bytes: Buffer | Uint8Array): Promise<void> {
  const path = await target(value);
  if (process.platform === 'win32') return newWindowsPrivateFile(path, bytes);
  let handle, owned: { ino: bigint; dev: bigint } | undefined;
  try {
    handle = await open(path, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.chmod(0o600);
    const stat = await handle.stat({ bigint: true }); owned = { ino: stat.ino, dev: stat.dev };
    if (!stat.isFile() || stat.nlink !== 1n || (stat.mode & 0o077n) !== 0n || process.getuid && stat.uid !== BigInt(process.getuid())) throw new Error();
    await handle.writeFile(bytes); await handle.sync();
    const readback = Buffer.alloc(bytes.byteLength + 1);
    let offset = 0;
    while (offset < readback.length) {
      const read = await handle.read(readback, offset, readback.length - offset, offset);
      if (!read.bytesRead) break;
      offset += read.bytesRead;
    }
    if (offset !== bytes.byteLength || !readback.subarray(0, bytes.byteLength).equals(bytes)) throw new Error();
    const current = await lstat(path, { bigint: true });
    if (current.isSymbolicLink() || current.ino !== owned.ino || current.dev !== owned.dev || current.nlink !== 1n || (current.mode & 0o077n) !== 0n) throw new Error();
  } catch (error) {
    // Only remove the exact incomplete inode this call created, never an
    // existing file or a path another process replaced during interruption.
    if (owned) {
      try { const stat = await lstat(path, { bigint: true }); if (stat.ino === owned.ino && stat.dev === owned.dev && !stat.isSymbolicLink()) await unlink(path); } catch { /* Retain uncertain private state. */ }
    }
    throw new JobHuntError((error as NodeJS.ErrnoException).code === 'EEXIST' ? 'output_exists' : 'credential_file_unavailable');
  } finally { await handle?.close(); }
  // Persist the directory entry before another process can acknowledge remote
  // delivery based on this file. Failure leaves a private file for inspection.
  let directory;
  try { directory = await open(dirname(path), constants.O_RDONLY | constants.O_DIRECTORY); await directory.sync(); }
  catch { throw new JobHuntError('credential_file_unavailable'); }
  finally { await directory?.close(); }
}

export async function requireNewCredentialFile(value: unknown): Promise<void> {
  const path = await target(value);
  try { await lstat(path); throw new JobHuntError('output_exists'); }
  catch (error) {
    if (error instanceof JobHuntError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new JobHuntError('credential_file_unavailable');
  }
}
