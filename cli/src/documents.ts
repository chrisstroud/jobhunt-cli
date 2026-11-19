import { documentDeletionOriginal, MAX_DELETION_ORIGINAL_BYTES } from '../../client/src/document-deletions.ts';
import { libraryOriginal } from '../../client/src/library-originals.ts';
import {resumeImportOriginal} from '../../client/src/resume-import-originals.ts';
import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError, record } from '../../client/src/index.ts';
import { confirmResumeImportInput, documentWriteInput } from '../../client/src/document-contracts.ts';
import { MAX_RESUME_FILE_BYTES, resumeFileUploadInput, type ResumeUploadTransport } from '../../client/src/import-file-contracts.ts';
import { privateOutput } from './private-output.ts';
import { inputBytes, inputJSON } from './input.ts';
import { MAX_SECTION_SAVE_BYTES, prepareSectionSave, sectionSaveOriginal } from '../../client/src/section-saves.ts';
import { MAX_RESUME_SAVE_BYTES, prepareResumeSave } from '../../client/src/resume-saves.ts';
import { documentVersionOriginal } from '../../client/src/version-originals.ts';
import { MAX_DOCUMENT_CREATION_BYTES, prepareDocumentCreation, prepareDocumentCreationSource, documentCreationOriginal } from '../../client/src/document-creations.ts';

export const documentCommandOptions: Record<string, string[]> = {
  'documents create-native': ['file'], 'documents check-creation': ['file'],
  'documents close-creation': ['file', 'confirm'], 'documents create-native-host-file': ['file'],
  'documents check-delete': ['file'], 'documents close-delete': ['file', 'confirm'],
  'documents check-library': ['file'], 'documents close-library': ['file', 'confirm'],
  'documents check-version': ['file'], 'documents close-version': ['file', 'confirm'],
  'documents check-section-save': ['file'], 'documents close-section-save': ['file', 'confirm'],
  'documents save-profile': ['file'], 'documents check-profile-save': ['file'], 'documents close-profile-save': ['file', 'confirm'], 'documents save-profile-host-file': ['file'],
  'documents preview': ['file', 'output'], 'documents list': ['page', 'page-size'], 'documents get': [], 'documents create': ['file'],
  'documents update-section': ['file'], 'documents revisions': ['before-id', 'include-metadata'], 'documents checkpoint': ['file'],
  'documents version-file': ['version-id', 'output'],
  'documents restore': ['file', 'confirm'], 'documents restore-snapshot': ['file', 'confirm'], 'documents rename': ['file'], 'documents duplicate': ['file'],
  'documents set-default': ['file'], 'documents delete': ['file', 'confirm'],
  'resume-imports text': ['file'], 'resume-imports get': [], 'resume-imports confirm': ['file', 'confirm'],
  'resume-imports file': ['file', 'request-id', 'account-id', 'transport'], 'resume-imports host-file': ['file'],
  'resume-imports check-original':['file'], 'resume-imports close-original':['file','confirm'],
  'resume-imports check-file':['file','request-id','account-id','original-unbound'], 'resume-imports close-file':['file','request-id','account-id','original-unbound','confirm'],
};
export const documentCommandTargets = new Set(['documents get', 'documents revisions', 'documents version-file', 'resume-imports get']);
function page(value: string | boolean | undefined, fallback: number) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) throw new JobHuntError('invalid_input');
  return Number(value);
}
function confirmed(actual: string | boolean | undefined, target: string) {
  if (actual !== target) throw new JobHuntError('confirmation_required');
}
export async function documentCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'documents list') return client.listDocuments({ page: page(options.page, 1), pageSize: page(options['page-size'], 20) });
  if (['documents create-native', 'documents check-creation', 'documents close-creation'].includes(command)) {
    const bytes = await inputBytes(options.file as string | undefined, stdin, MAX_DOCUMENT_CREATION_BYTES);
    let input: unknown;
    try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new JobHuntError('invalid_input'); }
    const source = record(input) && Object.hasOwn(input, 'data');
    if (command === 'documents create-native') return source ? client.documentCreations.createSource(bytes)
      : client.documentCreations.create(input as Parameters<typeof prepareDocumentCreation>[0]);
    const original = record(input) && Object.hasOwn(input, 'fields')
      ? (await prepareDocumentCreation(input as Parameters<typeof prepareDocumentCreation>[0])).original
      : source ? (await prepareDocumentCreationSource(bytes)).original : documentCreationOriginal(input);
    if (command === 'documents close-creation') {
      confirmed(options.confirm, original.document_id);
      return client.documentCreations.close(original, true);
    }
    return client.documentCreations.check(original);
  }
  if (command === 'documents create-native-host-file') return client.documentCreations.host(
    await inputJSON(options.file as string | undefined, stdin, 16384) as Parameters<typeof client.documentCreations.host>[0]);
  if (command === 'documents check-delete' || command === 'documents close-delete') {
    const original = documentDeletionOriginal(await inputJSON(options.file as string | undefined, stdin, MAX_DELETION_ORIGINAL_BYTES));
    if (command === 'documents close-delete') { confirmed(options.confirm, original.original.document_id); return client.documentDeletions.close(original, true); }
    return client.documentDeletions.check(original);
  }
  if (command === 'documents check-library' || command === 'documents close-library') {
    const original = libraryOriginal(await inputJSON(options.file as string | undefined,stdin,16384));
    if (command === 'documents close-library') { confirmed(options.confirm,original.original.document_id);return client.libraryOriginals.close(original,true); }
    return client.libraryOriginals.check(original);
  }
  if (command === 'documents check-version' || command === 'documents close-version') {
    const original = documentVersionOriginal(await inputJSON(options.file as string | undefined, stdin, 16384));
    if (command === 'documents close-version') { confirmed(options.confirm, original.original.document_id); return client.versionOriginals.close(original, true); }
    return client.versionOriginals.check(original);
  }
  if (command === 'documents check-section-save' || command === 'documents close-section-save') {
    const input = await inputJSON(options.file as string | undefined, stdin, MAX_SECTION_SAVE_BYTES);
    const original = record(input) && Object.hasOwn(input, 'value')
      ? (await prepareSectionSave(input as Parameters<typeof prepareSectionSave>[0])).original
      : sectionSaveOriginal(input);
    if (command === 'documents close-section-save') { confirmed(options.confirm, original.document_id); return client.sectionSaves.close(original, true); }
    return client.sectionSaves.check(original);
  }
  if (command === 'documents save-profile') return client.resumeSaves.save(
    await inputJSON(options.file as string | undefined, stdin, MAX_RESUME_SAVE_BYTES) as Parameters<typeof client.resumeSaves.save>[0]);
  if (command === 'documents check-profile-save' || command === 'documents close-profile-save') {
    const input = await inputJSON(options.file as string | undefined, stdin, MAX_RESUME_SAVE_BYTES);
    const original = record(input) && Object.hasOwn(input, 'fields')
      ? (await prepareResumeSave(input as Parameters<typeof prepareResumeSave>[0])).original
      : input as Parameters<typeof client.resumeSaves.check>[0];
    if (command === 'documents close-profile-save') { confirmed(options.confirm, original.document_id); return client.resumeSaves.close(original, true); }
    return client.resumeSaves.check(original);
  }
  if (command === 'documents save-profile-host-file') return client.resumeSaves.host(
    await inputJSON(options.file as string | undefined, stdin, 16384) as Parameters<typeof client.resumeSaves.host>[0]);
  if (command === 'documents get') return client.getDocument(target!);
  if (command === 'documents revisions') return client.documentRevisions({ document_id: target!, before_id: options['before-id'] as string | undefined,
    ...(options['include-metadata'] === true ? { include_metadata: true } : {}) });
  if (command === 'documents version-file') return privateOutput(options.output, () => client.versionFiles.download({
    document_id: target!, version_id: options['version-id'] as string }));
  if (command === 'resume-imports get') return client.getResumeImport(target!);
  if(command==='resume-imports check-file'||command==='resume-imports close-file'){
    const original=resumeFileUploadInput({request_id:options['request-id'],expected_account_id:options['account-id']});
    if(original.expected_account_id==null)throw new JobHuntError('invalid_input');
    if(command.endsWith('close-file'))confirmed(options.confirm,original.request_id);
    const bytes=await inputBytes(options.file as string|undefined,stdin,MAX_RESUME_FILE_BYTES);
    const captured={...original,expected_account_id:original.expected_account_id,...(options['original-unbound']===true?{original_account_unbound:true as const}:{})};
    return command.endsWith('close-file')?client.closeResumeImportFileOriginal(captured,bytes):client.checkResumeImportFileOriginal(captured,bytes);
  }
  if (command === 'resume-imports file') {
    const intent = resumeFileUploadInput({ request_id: options['request-id'], expected_account_id: options['account-id'] });
    const transport = options.transport ?? 'auto';
    if (!['auto', 'multipart', 'direct'].includes(String(transport))) throw new JobHuntError('invalid_input');
    return client.uploadResumeFile(intent, await inputBytes(options.file as string | undefined, stdin, MAX_RESUME_FILE_BYTES), transport as ResumeUploadTransport);
  }
  const input = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if(command==='resume-imports check-original'||command==='resume-imports close-original'){
    const original=resumeImportOriginal(input);
    if(command.endsWith('close-original'))confirmed(options.confirm,original.command.original.request_id);
    return command.endsWith('close-original')?client.closeResumeImportOriginal(original):client.checkResumeImportOriginal(original);
  }
  if (command === 'documents preview') return privateOutput(options.output, () => client.downloadDocumentPreview(input as Parameters<JobHuntClient['downloadDocumentPreview']>[0]));
  // Client validators retain the original bounded JSON exactly; no drafting or policy here.
  if (command === 'documents create') return client.createDocument(input as Parameters<JobHuntClient['createDocument']>[0]);
  if (command === 'documents update-section') return client.updateDocumentSection(input as Parameters<JobHuntClient['updateDocumentSection']>[0]);
  if (command === 'resume-imports text') return client.importResumeText(input as Parameters<JobHuntClient['importResumeText']>[0]);
  if (command === 'resume-imports host-file') return client.importResumeHostFile(input as Parameters<JobHuntClient['importResumeHostFile']>[0]);
  if (command === 'resume-imports confirm') {
    const intent = confirmResumeImportInput(input); confirmed(options.confirm, intent.import_id);
    return client.confirmResumeImport(intent);
  }
  if (command === 'documents restore' || command === 'documents restore-snapshot') {
    const intent = documentWriteInput(input, 'restore'); confirmed(options.confirm, intent.document_id);
    return command === 'documents restore-snapshot' ? client.restoreDocumentSnapshot(intent) : client.restoreDocument(intent);
  }
  if (command === 'documents delete') {
    const intent = documentWriteInput(input, 'plain'); confirmed(options.confirm, intent.document_id);
    return client.deleteDocument(intent);
  }
  if (command === 'documents set-default') return client.setDefaultDocument(documentWriteInput(input, 'plain'));
  if (command === 'documents checkpoint') return client.checkpointDocument(documentWriteInput(input, 'named'));
  if (command === 'documents rename') return client.renameDocument(documentWriteInput(input, 'named'));
  if (command === 'documents duplicate') return client.duplicateDocument(documentWriteInput(input, 'named'));
  throw new JobHuntError('usage_error');
}
