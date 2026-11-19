import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../cli/package.json', import.meta.url)));
await mkdir(new URL('../cli/dist/', import.meta.url), { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['cli/src/main.ts'], outfile: 'cli/dist/jobhunt.js',
  bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: false,
  external: ['@napi-rs/keyring'], banner: { js: '#!/usr/bin/env node' },
  define: { CLI_VERSION: JSON.stringify(manifest.version) } });
await chmod(new URL('../cli/dist/jobhunt.js', import.meta.url), 0o755);
await build({ absWorkingDir: root, entryPoints: ['client/src/index.ts'], outfile: 'client/dist/index.js',
  bundle: true, platform: 'node', format: 'esm', target: 'node22' });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'client/src/index.ts', '--declaration',
  '--emitDeclarationOnly', '--allowImportingTsExtensions', '--outDir', 'client/dist', '--target', 'ES2023', '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext', '--newLine', 'lf', '--strict', '--skipLibCheck'], { cwd: root, stdio: 'inherit' });
