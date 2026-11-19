import {captureProfileIdentityClosureSource,captureProfilePhotoOriginal} from '../../client/src/profile-originals.ts';
import {MAX_PROFILE_FILE_BYTES,profileHostFileInput} from '../../client/src/profile-file-contracts.ts';
import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { MAX_PROFILE_PNG_BYTES, profileDeleteInput, profilePhotoInput, profileSaveInput, profileUnlinkInput } from '../../client/src/profile-contracts.ts';
import { inputBytes, inputJSON } from './input.ts';
import { privateOutput } from './private-output.ts';

export const profileCommandOptions: Record<string, string[]> = {
  'profiles photo-upload-host-file': ['file', 'confirm'], 'profiles photo-upload-file': ['file', 'image', 'confirm'], 'profiles close-identity': ['file','confirm'], 'profiles close-photo': ['file','confirm'], 'profiles check-identity': ['file'], 'profiles save-identity': ['file'], 'profiles directory': ['page'], 'profiles photo-upload': ['file', 'image', 'confirm'],
  'profiles personal': [], 'profiles update-personal': ['file'],
  'profiles list': ['page'], 'profiles get': [], 'profiles links': ['page'],
  'profiles create': ['file'], 'profiles update': ['file'], 'profiles set-default': ['file'],
  'profiles delete': ['file', 'confirm'], 'profiles link': ['file'], 'profiles link-many': ['file'],
  'profiles unlink': ['file', 'confirm'], 'profiles photo-save': ['file', 'image', 'confirm'],
  'profiles photo-download': ['output'],
};
export const profileCommandTargets = new Set(['profiles personal', 'profiles get', 'profiles links', 'profiles photo-download']);
function page(value: string | boolean | undefined) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) throw new JobHuntError('invalid_input');
  return Number(value);
}
function confirmed(value: string | boolean | undefined, target: string) {
  if (value !== target) throw new JobHuntError('confirmation_required');
}
export async function profileCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'profiles directory') return client.listProfileDirectory({ page: page(options.page) });
  if (command === 'profiles personal') return client.getProfilePersonal(target!);
  if (command === 'profiles list') return client.listProfiles({ page: page(options.page) });
  if (command === 'profiles get') return client.getProfile(target!);
  if (command === 'profiles links') return client.listProfilePackages({ profile_id: target!, page: page(options.page) });
  if (command === 'profiles photo-download') return privateOutput(options.output, () => client.downloadProfilePhoto(target!));
  if (command === 'profiles check-identity') return client.checkProfileIdentitySource(await inputBytes(options.file as string | undefined, stdin, 512 * 1024));
  if (command === 'profiles close-identity') {
    const source=await inputBytes(options.file as string | undefined,stdin,512*1024);
    const {captured}=captureProfileIdentityClosureSource(source);confirmed(typeof options.confirm==='string'?options.confirm.toLowerCase():options.confirm,captured.original.request_id.toLowerCase());
    return client.profileOriginals.closeIdentitySource(source);
  }
  const input = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'profiles close-photo') {
    const captured=captureProfilePhotoOriginal(input);confirmed(typeof options.confirm==='string'?options.confirm.toLowerCase():options.confirm,captured.original.request_id);
    return client.profileOriginals.closePhoto(captured,true);
  }
  if (command === 'profiles save-identity') return client.saveProfileIdentity(input as Parameters<JobHuntClient['saveProfileIdentity']>[0]);
  if (command === 'profiles update-personal') return client.saveProfilePersonal(input as Parameters<JobHuntClient['saveProfilePersonal']>[0]);
  if (command === 'profiles create' || command === 'profiles update') {
    const intent = profileSaveInput(input);
    if (command === 'profiles create' ? intent.profile_id != null || intent.expected_updated_at != null : intent.profile_id == null)
      throw new JobHuntError('invalid_input');
    return client.saveProfile(intent);
  }
  if (command === 'profiles set-default') return client.setDefaultProfile(input as Parameters<JobHuntClient['setDefaultProfile']>[0]);
  if (command === 'profiles delete') {
    const intent = profileDeleteInput(input); confirmed(options.confirm, intent.profile_id);
    return client.deleteProfile(intent);
  }
  if (command === 'profiles link') return client.linkProfile(input as Parameters<JobHuntClient['linkProfile']>[0]);
  if (command === 'profiles link-many') return client.linkProfilePackages(input as Parameters<JobHuntClient['linkProfilePackages']>[0]);
  if (command === 'profiles unlink') {
    const intent = profileUnlinkInput(input); confirmed(options.confirm, intent.document_id);
    return client.unlinkProfile(intent);
  }
  if (command === 'profiles photo-upload-host-file') {
    const intent = profileHostFileInput(input); confirmed(options.confirm, intent.profile_id);
    return client.uploadProfilePhotoHostFile(intent);
  }
  if (command === 'profiles photo-save' || command === 'profiles photo-upload' || command === 'profiles photo-upload-file') {
    const intent = profilePhotoInput(input); confirmed(options.confirm, intent.profile_id);
    if (typeof options.image !== 'string' || options.image === '-') throw new JobHuntError('invalid_input');
    const bytes = await inputBytes(options.image, stdin, command === 'profiles photo-upload-file' ? MAX_PROFILE_FILE_BYTES : MAX_PROFILE_PNG_BYTES);
    if (command === 'profiles photo-upload-file') return client.uploadProfilePhotoFile(intent, bytes);
    return command === 'profiles photo-upload' ? client.uploadProfilePhoto(intent, bytes) : client.saveProfilePhoto(intent, bytes);
  }
  throw new JobHuntError('usage_error');
}
