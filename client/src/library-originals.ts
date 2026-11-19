/** Exact library command checks use existing receipts, never latest-row inference. */
import type { JobHuntClient } from './index.ts';
import { documentWriteInput, type DocumentWrite, type NamedDocumentWrite } from './document-contracts.ts';
import { libraryPackageWriteInput, type LibraryPackageAdd } from './library-contracts.ts';
import { fail, integer, journeyResult, operationResult, shape, uuid } from './journey-contracts.ts';
import { record } from './protocol.ts';
import { captureProfileLink, profileLinkReceipt, type ProfileLink } from './profile-contracts.ts';
import { stableJsonValue } from './native-json.ts';
import { digest } from './highlight-file-contracts.ts';
import type { DocumentDeletionClosure } from './document-deletions.ts';
export type LibraryOperation = 'rename_document_v2' | 'duplicate_document_v2' | 'set_default_document_v2' | 'add_package_document_v2' | 'link_document_package_profile_v2';
export type LibraryOriginal = { expected_account_id: string } & (
  { operation_name: 'rename_document_v2' | 'duplicate_document_v2'; original: NamedDocumentWrite }
  | { operation_name: 'set_default_document_v2'; original: DocumentWrite }
  | { operation_name: 'add_package_document_v2'; original: LibraryPackageAdd }
  | { operation_name: 'link_document_package_profile_v2'; original: ProfileLink });
export type LibraryReceipt = { request_id: string; document_id: string; payload_hash: string; operation_id: string;
  resource_id: string; revision: number; retry_expires_at: string };
export function libraryOriginal(value: unknown): LibraryOriginal {
  shape(value,['expected_account_id','operation_name','original']);
  if (!['rename_document_v2','duplicate_document_v2','set_default_document_v2','add_package_document_v2','link_document_package_profile_v2'].includes(String(value.operation_name))
    || typeof value.expected_account_id !== 'string' || !/^jh_[a-f0-9-]+$/u.test(value.expected_account_id) || !uuid(value.expected_account_id.slice(3))) fail();
  const input = value.operation_name === 'link_document_package_profile_v2' ? captureProfileLink(value.original)
    : value.operation_name === 'add_package_document_v2' ? libraryPackageWriteInput(value.original,'add')
    : value.operation_name === 'set_default_document_v2' ? documentWriteInput(value.original,'plain') : documentWriteInput(value.original,'named');
  if (!uuid(input.document_id) || (!['add_package_document_v2','link_document_package_profile_v2'].includes(String(value.operation_name)) && input.document_id !== input.document_id.toLowerCase())
    || input.expected_account_id != null && input.expected_account_id !== value.expected_account_id
    || 'name' in input && (typeof input.name !== 'string' || input.name !== input.name.trim() || /\p{C}/u.test(input.name))) fail();
  return JSON.parse(JSON.stringify({expected_account_id:value.expected_account_id,operation_name:value.operation_name,original:{...input,request_id:input.request_id.toLowerCase()}})) as LibraryOriginal;
}
export async function prepareLibraryOriginal(input: LibraryOriginal) {
  const captured=libraryOriginal(input),payloadHash=await digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(captured.original))));
  return {captured,payloadHash};
}
export async function libraryOriginalRead(input: LibraryOriginal) {
  const {captured,payloadHash}=await prepareLibraryOriginal(input);
  return {expected_account_id:captured.expected_account_id,operation_name:captured.operation_name,request_id:captured.original.request_id,expected_payload_hash:payloadHash};
}
export async function libraryReceipt(value: unknown, input: LibraryOriginal): Promise<LibraryReceipt> {
  const {captured,payloadHash}=await prepareLibraryOriginal(input),result=operationResult(value),op=result.data;
  if(captured.operation_name==='link_document_package_profile_v2') profileLinkReceipt(value,captured.original);
  if(result.outcome!=='ready' || !op || op.kind!==captured.operation_name || op.status!=='succeeded' || op.error!=null
    || op.retry_after_seconds!==0 || op.resource?.kind!=='document' || !uuid(op.resource.id) || typeof op.resource.revision!=='number' || !integer(op.resource.revision)
    || (['duplicate_document_v2','add_package_document_v2'].includes(captured.operation_name) ? op.resource.id.toLowerCase()===captured.original.document_id.toLowerCase() : op.resource.id.toLowerCase()!==captured.original.document_id.toLowerCase())
    || (captured.operation_name==='rename_document_v2' && op.resource.revision!==captured.original.expected_revision+1)
    || (captured.operation_name==='set_default_document_v2' && op.resource.revision<captured.original.expected_revision)) fail(true);
  return {request_id:captured.original.request_id,document_id:captured.original.document_id,payload_hash:payloadHash,
    operation_id:op.id,resource_id:op.resource.id,revision:op.resource.revision,retry_expires_at:op.retry_expires_at};
}
export async function libraryClosure(value: unknown, input: LibraryOriginal): Promise<DocumentDeletionClosure> {
  const {captured,payloadHash}=await prepareLibraryOriginal(input);
  const result=journeyResult(value,(row): row is DocumentDeletionClosure => record(row) && row.request_id===captured.original.request_id
    && row.document_id===captured.original.document_id && row.payload_hash===payloadHash && ['closed','recorded','expired'].includes(String(row.outcome)));
  if(result.outcome!=='ready' || !result.data) fail(true);return result.data;
}
export class LibraryOriginalClient {
  private readonly client: Pick<JobHuntClient,'request'>;
  constructor(client: Pick<JobHuntClient,'request'>) { this.client=client; }
  async check(input: LibraryOriginal) {
    const captured=libraryOriginal(input);return libraryReceipt(await this.client.request('/api/v1/journey/get_job_hunt_operation?'
      +new URLSearchParams({arguments:JSON.stringify(await libraryOriginalRead(captured))})),captured);
  }
  async close(input: LibraryOriginal, confirm: true) {
    if(confirm!==true) fail();const captured=libraryOriginal(input);
    return libraryClosure(await this.client.request('/api/v1/journey/close_document_library_original_v1',
      {method:'POST',body:{...captured,confirm_close:true}}),captured);
  }
}
