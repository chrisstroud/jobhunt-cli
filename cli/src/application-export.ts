import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError, applicationExportInput } from '../../client/src/index.ts';
import { inputJSON } from './input.ts';
import { newCredentialFile, requireNewCredentialFile } from './credential-files.ts';

export const applicationExportOptions: Record<string, string[]> = {
  'applications export-manifest': ['file'], 'applications export': ['file', 'output', 'confirm'],
};
export async function applicationExportCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  const input = applicationExportInput(await inputJSON(options.file as string | undefined, stdin, 4096));
  if (command === 'applications export-manifest') return client.applicationExport.manifest(input);
  if (options.confirm !== input.expected_account_id) throw new JobHuntError('confirmation_required');
  await requireNewCredentialFile(options.output);
  const { bytes, ...metadata } = await client.applicationExport.download(input);
  await newCredentialFile(options.output, bytes);
  return { ...metadata, saved: true };
}
