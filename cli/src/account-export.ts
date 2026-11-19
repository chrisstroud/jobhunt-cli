import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError, accountExportInput } from '../../client/src/index.ts';
import { inputJSON } from './input.ts';
import { newCredentialFile, requireNewCredentialFile } from './credential-files.ts';

export const accountExportOptions: Record<string, string[]> = {
  'account export-manifest': ['file'], 'account export': ['file', 'output', 'confirm'],
};
export async function accountExportCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  const input = accountExportInput(await inputJSON(options.file as string | undefined, stdin, 4096));
  if (command === 'account export-manifest') return client.accountExport.manifest(input);
  if (options.confirm !== input.expected_account_id) throw new JobHuntError('confirmation_required');
  await requireNewCredentialFile(options.output);
  const { bytes, ...metadata } = await client.accountExport.download(input);
  await newCredentialFile(options.output, bytes);
  return { ...metadata, saved: true };
}
