import { runCLI } from './cli.ts';
declare const CLI_VERSION: string;
process.exitCode = await runCLI(process.argv.slice(2), {
  env: process.env, stdin: process.stdin, stdout: process.stdout, stderr: process.stderr,
}, CLI_VERSION);
