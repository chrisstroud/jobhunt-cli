import { JobHuntClient } from '../../client/src/index.ts';

export const referenceOptions: Record<string, string[]> = {
  'references find': ['query'], 'references get': ['uri'],
};
export function referenceCommand(command: string, values: Record<string, string | boolean | undefined>, client: JobHuntClient) {
  if (command === 'references find') return client.findRecordReferences({ query: values.query as string | undefined });
  return client.getRecordReference({ uri: values.uri as string });
}
