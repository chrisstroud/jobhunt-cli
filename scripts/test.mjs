import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const files = (await readdir(new URL('../tests/', import.meta.url))).filter(name => name.endsWith('.test.ts')).sort();
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files.map(name => `tests/${name}`)], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
