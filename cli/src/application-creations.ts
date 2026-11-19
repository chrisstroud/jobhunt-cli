import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError, record } from '../../client/src/index.ts';
import { applicationCreationOriginal, MAX_APPLICATION_CREATION_BYTES, prepareApplicationCreation, prepareApplicationCreationSource } from '../../client/src/application-creations.ts';
import { inputBytes, inputJSON } from './input.ts';
export const applicationCreationOptions: Record<string, string[]> = {
  'applications create-native': ['file'], 'applications check-creation': ['file'],
  'applications close-creation': ['file', 'confirm'], 'applications create-native-host-file': ['file'],
};
export async function applicationCreationCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'applications create-native-host-file') return client.applicationCreations.host(
    await inputJSON(options.file as string | undefined, stdin, 16384) as Parameters<typeof client.applicationCreations.host>[0]);
  const bytes = await inputBytes(options.file as string | undefined, stdin, MAX_APPLICATION_CREATION_BYTES);
  let input: unknown;
  try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new JobHuntError('invalid_input'); }
  const source = record(input) && Object.hasOwn(input, 'data');
  if (command === 'applications create-native') return source ? client.applicationCreations.createSource(bytes)
    : client.applicationCreations.create(input as Parameters<typeof prepareApplicationCreation>[0]);
  const original = record(input) && Object.hasOwn(input, 'fields')
    ? (await prepareApplicationCreation(input as Parameters<typeof prepareApplicationCreation>[0])).original
    : source ? (await prepareApplicationCreationSource(bytes)).original : applicationCreationOriginal(input);
  if (command === 'applications close-creation') {
    if (options.confirm !== original.application_id) throw new JobHuntError('confirmation_required');
    return client.applicationCreations.close(original, true);
  }
  if (command !== 'applications check-creation') throw new JobHuntError('invalid_input');
  return client.applicationCreations.check(original);
}
