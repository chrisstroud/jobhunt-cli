import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { MAX_APPLICATION_RECORD_FIELDS_BYTES, recordFileDirectory, recordFileIntent, recordFileRead, recordHostFile } from '../../client/src/application-record-file-contracts.ts';
import { inputBytes, inputJSON } from './input.ts';
import { privateOutput } from './private-output.ts';

export const applicationRecordFileOptions: Record<string, string[]> = {
  'applications record-files': ['file'],
  'applications record-file': ['file'],
  'applications record-download': ['file', 'output'],
  'applications record-save-file': ['file', 'fields', 'confirm'],
  'applications record-save-host-file': ['file', 'confirm'],
};
export async function applicationRecordFileCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  const input = await inputJSON(typeof options.file === 'string' ? options.file : undefined, stdin, 128 * 1024);
  if (command === 'applications record-files') return client.listApplicationRecordFiles(recordFileDirectory(input));
  if (command === 'applications record-file') return client.getApplicationRecordFile(recordFileRead(input));
  if (command === 'applications record-download') return privateOutput(options.output, () => client.downloadApplicationRecordFile(recordFileRead(input)));
  const intent = command === 'applications record-save-file' ? recordFileIntent(input) : recordHostFile(input);
  if (options.confirm !== intent.expected_account_id) throw new JobHuntError('confirmation_required');
  if (command === 'applications record-save-host-file') return client.saveApplicationRecordFieldsHostFile(intent as Parameters<JobHuntClient['saveApplicationRecordFieldsHostFile']>[0]);
  if (command !== 'applications record-save-file' || typeof options.fields !== 'string' || options.fields === '-') throw new JobHuntError('invalid_input');
  return client.saveApplicationRecordFieldsFile(intent, await inputBytes(options.fields, stdin, MAX_APPLICATION_RECORD_FIELDS_BYTES));
}
