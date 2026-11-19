import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { JobHuntError } from '../../client/src/index.ts';

/** Bound input before parsing, never include file contents or paths in errors. */
export async function inputBytes(file: string | undefined, stdin: Readable, limit: number): Promise<Buffer> {
  if (!file) throw new JobHuntError('invalid_input');
  let data: Buffer;
  if (file === '-') {
    const chunks: Buffer[] = []; let total = 0;
    for await (const chunk of stdin) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.length;
      if (total > limit) throw new JobHuntError('invalid_input');
      chunks.push(bytes);
    }
    data = Buffer.concat(chunks);
  } else {
    try {
      const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > limit) throw new JobHuntError('invalid_input');
        data = Buffer.alloc(limit + 1); let offset = 0;
        while (offset < data.length) {
          const read = await handle.read(data, offset, data.length - offset, null);
          if (!read.bytesRead) break;
          offset += read.bytesRead;
        }
        if (offset > limit) throw new JobHuntError('invalid_input');
        data = data.subarray(0, offset);
      } finally { await handle.close(); }
    } catch { throw new JobHuntError('invalid_input'); }
  }
  return data;
}

export async function inputJSON(file: string | undefined, stdin: Readable, limit = 64 * 1024): Promise<unknown> {
  const data = await inputBytes(file, stdin, limit);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)); }
  catch { throw new JobHuntError('invalid_input'); }
}
