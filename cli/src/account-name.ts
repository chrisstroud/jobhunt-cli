import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError, accountNameInput } from '../../client/src/index.ts';
import {accountNamePartsInput} from '../../client/src/account-name-parts.ts';
import { inputJSON } from './input.ts';
export const accountNameOptions: Record<string, string[]> = {
  'account get-name-parts':[], 'account set-name-parts':['file','confirm'], 'account check-name-parts':['file'], 'account close-name-parts':['file','confirm'],
  'account get-name': [], 'account set-name': ['file', 'confirm'],
  'account check-name': ['file'], 'account close-name': ['file', 'confirm'],
};
export async function accountNameCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if(command==='account get-name-parts')return client.accountNameParts.get();
  if(command.endsWith('-name-parts')){const original=accountNamePartsInput(await inputJSON(options.file as string|undefined,stdin,512*1024));if(command==='account check-name-parts')return client.accountNameParts.check(original);if(options.confirm!==original.expected_account_id)throw new JobHuntError('confirmation_required');return command==='account close-name-parts'?client.accountNameParts.close(original):client.accountNameParts.save(original);}
  if (command === 'account get-name') return client.accountName.get();
  const original = accountNameInput(await inputJSON(options.file as string | undefined, stdin, 512 * 1024));
  if (command === 'account check-name') return client.accountName.check(original);
  if (options.confirm !== original.expected_account_id) throw new JobHuntError('confirmation_required');
  return command === 'account close-name' ? client.accountName.close(original) : client.accountName.save(original);
}
