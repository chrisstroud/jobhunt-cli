import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { applicationDeletionOriginal, applicationDeleteInput, applicationTargetInput, applicationRecordDeleteInput, applicationRecordSaveInput } from '../../client/src/application-record-contracts.ts';
import { inputJSON } from './input.ts';

export async function applicationRecordCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'applications workspace') return client.applicationWorkspace({ application_id: target! });
  const input = await inputJSON(typeof options.file === 'string' ? options.file : undefined, stdin);
  if (command === 'applications check-delete' || command === 'applications close-delete') {
    const captured = applicationDeletionOriginal(input);
    if (command === 'applications check-delete') return client.applicationDeletions.check(captured);
    if (options.confirm !== captured.original.application_id) throw new JobHuntError('confirmation_required');
    return client.applicationDeletions.close(captured, true);
  }
  if (command === 'applications remove') {
    const intent = applicationDeleteInput(input);
    if (options.confirm !== intent.application_id) throw new JobHuntError('confirmation_required');
    return client.removeApplication(intent);
  }
  if (command === 'applications set-target') return client.setApplicationTarget(applicationTargetInput(input));
  if (command === 'applications record-save') return client.saveApplicationRecord(applicationRecordSaveInput(input));
  if (command === 'applications record-delete') {
    const intent = applicationRecordDeleteInput(input);
    if (options.confirm !== intent.record_id) throw new JobHuntError('confirmation_required');
    return client.deleteApplicationRecord(intent);
  }
  throw new JobHuntError('usage_error');
}
