/** Exact deletion recovery reuses the ordinary operation receipt and retry fence. */
import type { JobHuntClient } from './index.ts';
import { libraryPackageWriteInput, type LibraryPackageDelete } from './library-contracts.ts';
import { documentWriteInput, type DocumentWrite } from './document-contracts.ts';
import { fail, journeyResult, shape, uuid, operationResult } from './journey-contracts.ts';
import { record } from './protocol.ts';
import { stableJsonValue } from './native-json.ts';
import { digest } from './highlight-file-contracts.ts';

export type DocumentPackageDeletionOriginal = { expected_account_id: string; operation_name: 'delete_document_package_v2'; original: LibraryPackageDelete };
export type DocumentDeletionOriginal = DocumentPackageDeletionOriginal | { expected_account_id: string; operation_name?: 'delete_document_v2'; original: DocumentWrite };
export const MAX_DELETION_ORIGINAL_BYTES = 128 * 1024;
export const documentDeletionOperation = (input: DocumentDeletionOriginal) => input.operation_name ?? 'delete_document_v2';
export type DocumentDeletionClosure = { request_id: string; document_id: string; payload_hash: string;
  outcome: 'closed' | 'recorded' | 'expired' };
export type RecordedDocumentDeletion = { request_id: string; document_id: string; payload_hash: string;
  operation_id: string; retry_expires_at: string };
export function documentDeletionOriginal(value: unknown): DocumentDeletionOriginal {
  shape(value, ['expected_account_id', 'operation_name', 'original']);
  if (value.operation_name !== undefined && value.operation_name !== 'delete_document_v2' && value.operation_name !== 'delete_document_package_v2') fail();
  if (typeof value.expected_account_id !== 'string' || !/^jh_[a-f0-9-]+$/u.test(value.expected_account_id)
    || !uuid(value.expected_account_id.slice(3))) fail();
  const input = value.operation_name === 'delete_document_package_v2'
    ? libraryPackageWriteInput(value.original, 'delete') : documentWriteInput(value.original, 'plain');
  if (!uuid(input.document_id) || input.document_id !== input.document_id.toLowerCase()
    || (input.expected_account_id != null && input.expected_account_id !== value.expected_account_id)) fail();
  return JSON.parse(JSON.stringify({ expected_account_id: value.expected_account_id,
    ...(value.operation_name !== undefined ? { operation_name: value.operation_name } : {}), original: { ...input, request_id: input.request_id.toLowerCase() } })) as DocumentDeletionOriginal;
}
export async function prepareDocumentDeletion(value: DocumentDeletionOriginal) {
  const captured = documentDeletionOriginal(value);
  const payloadHash = await digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(captured.original))));
  return { captured, payloadHash };
}
export async function documentDeletionRead(value: DocumentDeletionOriginal) {
  const { captured, payloadHash } = await prepareDocumentDeletion(value);
  return { expected_account_id: captured.expected_account_id, operation_name: documentDeletionOperation(captured),
    request_id: captured.original.request_id, expected_payload_hash: payloadHash };
}
export async function recordedDocumentDeletionResponse(value: unknown, input: DocumentDeletionOriginal): Promise<RecordedDocumentDeletion> {
  const { captured, payloadHash } = await prepareDocumentDeletion(input), result = operationResult(value);
  const operation = result.data;
  if (result.outcome !== 'ready' || !operation || operation.kind !== documentDeletionOperation(captured)
    || operation.status !== 'succeeded' || operation.resource?.kind !== 'document'
    || operation.resource.id !== captured.original.document_id || operation.resource.revision !== null
    || operation.retry_after_seconds !== 0 || operation.error != null) fail(true);
  return { request_id: captured.original.request_id, document_id: captured.original.document_id,
    payload_hash: payloadHash, operation_id: operation.id, retry_expires_at: operation.retry_expires_at };
}
export async function documentDeletionClosureResponse(value: unknown, input: DocumentDeletionOriginal): Promise<DocumentDeletionClosure> {
  const { captured, payloadHash } = await prepareDocumentDeletion(input);
  const parsed = journeyResult(value, (data): data is DocumentDeletionClosure => record(data)
    && data.request_id === captured.original.request_id && data.document_id === captured.original.document_id
    && data.payload_hash === payloadHash && ['closed', 'recorded', 'expired'].includes(String(data.outcome)));
  if (parsed.outcome !== 'ready' || !parsed.data) fail(true);
  return parsed.data;
}
export class DocumentDeletionClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async check(input: DocumentDeletionOriginal) {
    const captured = documentDeletionOriginal(input);
    return recordedDocumentDeletionResponse(await this.client.request('/api/v1/journey/get_job_hunt_operation?'
      + new URLSearchParams({ arguments: JSON.stringify(await documentDeletionRead(captured)) })), captured);
  }
  async close(input: DocumentDeletionOriginal, confirmClose: true) {
    if (confirmClose !== true) fail();
    const captured = documentDeletionOriginal(input);
    return documentDeletionClosureResponse(await this.client.request('/api/v1/journey/close_document_delete_original_v1',
      { method: 'POST', body: { ...captured, confirm_close: true } }), captured);
  }
}
