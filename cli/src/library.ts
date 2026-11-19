import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { libraryPackageWriteInput } from '../../client/src/library-contracts.ts';
import { archiveWriteInput, type LibraryStatus } from '../../client/src/archive-contracts.ts';
import { inputJSON } from './input.ts';
export const libraryOptions: Record<string, string[]> = { 'library order': [], 'library reorder': ['file'], 'documents editorial-history':['kind','before-id'], 'documents editorial': ['kind'], 'documents editorial-list': ['kind','status','after-id'], 'documents set-editorial': ['file'], 'documents check-editorial': ['file'], 'documents close-editorial': ['file','confirm'], 'library documents': ['status', 'page'],
  'library archive-review': ['page'], 'library archive': ['file'], 'library unarchive': ['file'], 'library packages': ['package-id', 'page', 'documents-page'],
  'library add-document': ['file'], 'library delete-package': ['file', 'confirm'], 'documents usage': ['page'] };
export const libraryTargets = new Set(['library order','documents editorial-history','documents editorial', 'documents usage', 'library archive-review']);
function page(v: string | boolean | undefined) {
  if (v === undefined) return 1;
  if (typeof v !== 'string' || !/^\d+$/u.test(v)) throw new JobHuntError('invalid_input');
  return Number(v);
}
export async function libraryCommand(command: string, target: string | undefined, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if(command==='library order')return client.getDocumentPackageOrder({package_id:target!});
  if(command==='documents editorial-history')return client.documentEditorialHistory({document_id:target!,kind:options.kind as 'document'|'package'|undefined,before_id:options['before-id'] as string|undefined});
  if(command==='documents editorial')return client.getDocumentEditorialStatus({document_id:target!,kind:options.kind as 'document'|'package'|undefined});
  if(command==='documents editorial-list')return client.listDocumentEditorialStatuses({kind:options.kind as 'document'|'package'|undefined,status:options.status as 'draft'|'ready'|undefined,after_id:options['after-id'] as string|undefined});
  if (command === 'library documents') return client.listLibraryDocuments({ status: options.status as LibraryStatus | undefined, page: page(options.page) });
  if (command === 'library archive-review') return client.documentArchiveState({ document_id: target!, page: page(options.page) });
  if (command === 'library packages') return client.listLibraryPackages({ package_id: options['package-id'] as string | undefined,
    page: page(options.page), documents_page: page(options['documents-page']) });
  if (command === 'documents usage') return client.documentUsage({ document_id: target!, page: page(options.page) });
  const value = await inputJSON(options.file as string | undefined, stdin, 128 * 1024);
  if(command==='library reorder')return client.reorderDocumentPackage(value as import('../../client/src/package-order.ts').PackageOrderWrite);
  if(command==='documents set-editorial')return client.setDocumentEditorialStatus(value as import('../../client/src/editorial-contracts.ts').EditorialWrite);
  if(command==='documents check-editorial')return client.checkDocumentEditorialStatus(value as import('../../client/src/editorial-contracts.ts').EditorialOriginal);
  if(command==='documents close-editorial'){const original=(await import('../../client/src/editorial-contracts.ts')).editorialOriginal(value);if(options.confirm!==original.original.document_id)throw new JobHuntError('confirmation_required');return client.closeDocumentEditorialOriginal(original,true);}
  if (command === 'library archive') return client.archiveDocumentPackage(archiveWriteInput(value));
  if (command === 'library unarchive') return client.unarchiveDocumentPackage(archiveWriteInput(value));
  if (command === 'library add-document') return client.addLibraryDocument(libraryPackageWriteInput(value, 'add'));
  const intent = libraryPackageWriteInput(value, 'delete');
  if (options.confirm !== intent.document_id) throw new JobHuntError('confirmation_required');
  return client.deleteLibraryPackage(intent);
}
