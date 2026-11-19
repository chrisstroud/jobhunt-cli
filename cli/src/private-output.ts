import { link, lstat, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { JobHuntError } from '../../client/src/index.ts';
import { newWindowsPrivateFile, windowsPrivateTarget } from './windows-private-files.ts';

/** Publish verified private bytes exclusively; never replace a file or symlink. */
export async function privateOutput<T extends { bytes: Uint8Array }>(value: unknown, load: () => Promise<T>) {
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new JobHuntError('invalid_input');
  const target = process.platform === 'win32' ? await windowsPrivateTarget(value) : resolve(value);
  try { await lstat(target); throw new JobHuntError('output_exists'); }
  catch (error) {
    if (error instanceof JobHuntError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new JobHuntError('output_unavailable');
  }
  const { bytes, ...metadata } = await load();
  if (process.platform === 'win32') {
    await newWindowsPrivateFile(target, bytes);
    return { ...metadata, saved: true };
  }
  let scratch: string | undefined;
  try {
    scratch = await mkdtemp(join(dirname(target), '.jobhunt-download-'));
    const staged = join(scratch, 'verified-file');
    await writeFile(staged, bytes, { flag: 'wx', mode: 0o600 });
    await link(staged, target);
  } catch (error) {
    throw new JobHuntError((error as NodeJS.ErrnoException).code === 'EEXIST' ? 'output_exists' : 'output_unavailable');
  } finally { if (scratch) await rm(scratch, { recursive: true, force: true }).catch(() => {}); }
  return { ...metadata, saved: true };
}
