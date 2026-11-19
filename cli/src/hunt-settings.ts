import type { Readable } from 'node:stream';
import { JobHuntClient } from '../../client/src/index.ts';
import { huntPreferencesInput } from '../../client/src/hunt-settings-contracts.ts';
import { inputJSON } from './input.ts';

export const huntSettingsOptions: Record<string, string[]> = {
  'hunt-settings get': [], 'hunt-settings update': ['file'], 'context get': ['hunt-id'],
};
export async function huntSettingsCommand(command: string, options: Record<string, string | boolean | undefined>,
  client: JobHuntClient, stdin: Readable) {
  if (command === 'hunt-settings get') return client.getHuntSettings();
  if (command === 'context get') return client.getHuntContext(options['hunt-id'] === undefined ? {} : { search_id: options['hunt-id'] as string });
  return client.updateHuntPreferences(huntPreferencesInput(await inputJSON(options.file as string | undefined, stdin, 64 * 1024)));
}
