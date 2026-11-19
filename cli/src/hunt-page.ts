import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { huntPagePhotoHostFileInput, huntPagePhotoInput, huntPageVisibilityInput } from '../../client/src/hunt-page-contracts.ts';
import {MAX_PROFILE_FILE_BYTES} from '../../client/src/profile-file-contracts.ts';
import { MAX_PROFILE_PNG_BYTES } from '../../client/src/profile-contracts.ts';
import { inputBytes, inputJSON } from './input.ts';
import { privateOutput } from './private-output.ts';

export const huntPageOptions: Record<string, string[]> = {
  'hunt-page photo-upload-file':['file','image','confirm'], 'hunt-page photo-upload-host-file':['file','confirm'],
  'hunt-page workspace': ['page'], 'hunt-page get': ['page'], 'hunt-page save': ['file'], 'hunt-page preview': ['file', 'output'],
  'hunt-page publish': ['file', 'confirm'], 'hunt-page unpublish': ['file', 'confirm'],
  'hunt-page photo-save': ['file', 'image', 'confirm'], 'hunt-page photo-download': ['file', 'output'],
};
export async function huntPageCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'hunt-page get' || command === 'hunt-page workspace') {
    if (options.page !== undefined && (typeof options.page !== 'string' || !/^\d+$/u.test(options.page))) throw new JobHuntError('invalid_input');
    const input={page:options.page === undefined ? undefined : Number(options.page)};
    return command==='hunt-page workspace'?client.getHuntPageWorkspace(input):client.getHuntPage(input);
  }
  const input = await inputJSON(options.file as string | undefined, stdin, 128 * 1024);
  if (command === 'hunt-page save') return client.saveHuntPage(input as Parameters<JobHuntClient['saveHuntPage']>[0]);
  if (command === 'hunt-page publish' || command === 'hunt-page unpublish') {
    const value = huntPageVisibilityInput(input);
    if (value.visibility !== (command === 'hunt-page publish' ? 'public' : 'private')) throw new JobHuntError('invalid_input');
    if (!value.expected_account_id || options.confirm !== value.expected_account_id) throw new JobHuntError('confirmation_required');
    return client.setHuntPageVisibility(value);
  }
  if (command === 'hunt-page preview') return privateOutput(options.output, () => client.downloadHuntPagePreview(input as Parameters<JobHuntClient['downloadHuntPagePreview']>[0]));
  if (command === 'hunt-page photo-download') return privateOutput(options.output, () => client.downloadHuntPagePhoto(input as Parameters<JobHuntClient['downloadHuntPagePhoto']>[0]));
  if(command==='hunt-page photo-upload-host-file'||command==='hunt-page photo-upload-file') {
    const value=command==='hunt-page photo-upload-host-file'?huntPagePhotoHostFileInput(input):huntPagePhotoInput(input);
    if(!value.expected_account_id||options.confirm!==value.expected_account_id)throw new JobHuntError('confirmation_required');
    if(command==='hunt-page photo-upload-host-file')return client.uploadHuntPagePhotoHostFile(value as Parameters<JobHuntClient['uploadHuntPagePhotoHostFile']>[0]);
    if(typeof options.image!=='string'||options.image==='-')throw new JobHuntError('invalid_input');
    return client.uploadHuntPagePhotoFile(value,await inputBytes(options.image,stdin,MAX_PROFILE_FILE_BYTES));
  }
  if (command === 'hunt-page photo-save') {
    const value = input as Parameters<JobHuntClient['saveHuntPagePhoto']>[0];
    if (!value.expected_account_id || options.confirm !== value.expected_account_id) throw new JobHuntError('confirmation_required');
    if (typeof options.image !== 'string' || options.image === '-') throw new JobHuntError('invalid_input');
    return client.saveHuntPagePhoto(value, await inputBytes(options.image, stdin, MAX_PROFILE_PNG_BYTES));
  }
  throw new JobHuntError('usage_error');
}
