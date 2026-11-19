/** Canonical checkpoint/restore originals, never current-source proof. */
import type { JobHuntClient } from './index.ts';
import { documentWriteInput, stripDocumentName, type NamedDocumentWrite, type RestoreDocument } from './document-contracts.ts';
import { fail, integer, journeyResult, shape, uuid } from './journey-contracts.ts';
import { record } from './protocol.ts';
import { digest } from './highlight-file-contracts.ts';
import { isNativeJson, stableJsonValue } from './native-json.ts';

export type DocumentVersionOriginal = { expected_account_id: string } & (
  { operation_name: 'create_document_checkpoint_v2'; original: NamedDocumentWrite } |
  { operation_name: 'restore_document_revision'; original: RestoreDocument }
);
export type RecordedDocumentVersion = {
  operation_name: DocumentVersionOriginal['operation_name']; request_id: string;
  document_id: string; payload_hash: string; revision: number; version_id: string;
  pre_restore_version_id: string | null; retry_expires_at: string;
};
export type DocumentVersionClosure = { request_id: string; document_id: string;
  payload_hash: string; outcome: 'closed' | 'recorded' | 'expired' };
export function documentVersionOriginal(value: unknown): DocumentVersionOriginal {
  shape(value, ['expected_account_id', 'operation_name', 'original']);
  if (!isNativeJson(value) || typeof value.expected_account_id !== 'string'
    || !value.expected_account_id.startsWith('jh_') || !uuid(value.expected_account_id.slice(3))) fail();
  const kind = value.operation_name;
  if (kind !== 'create_document_checkpoint_v2' && kind !== 'restore_document_revision') fail();
  const input = kind === 'create_document_checkpoint_v2'
    ? documentWriteInput(value.original, 'named') : documentWriteInput(value.original, 'restore');
  if (input.expected_account_id != null && input.expected_account_id !== value.expected_account_id) fail();
  const original = { ...input, request_id: input.request_id.toLowerCase(),
    ...('name' in input ? { name: stripDocumentName(input.name) } : {}) };
  if ('name' in original && !original.name) fail();
  return JSON.parse(JSON.stringify({ expected_account_id: value.expected_account_id, operation_name: kind, original })) as DocumentVersionOriginal;
}
export async function prepareDocumentVersionOriginal(value: DocumentVersionOriginal) {
  // Snapshot before await; omission/null remain part of canonical receipt identity.
  const captured = documentVersionOriginal(value);
  const text = JSON.stringify(stableJsonValue(captured.original));
  return { captured, text, payloadHash: await digest(new TextEncoder().encode(text)) };
}
/** A status URL never contains a user-written checkpoint name. */
export async function documentVersionOriginalRead(value: DocumentVersionOriginal) {
  const { captured, payloadHash } = await prepareDocumentVersionOriginal(value);
  return captured.operation_name === 'restore_document_revision' ? captured : {
    expected_account_id: captured.expected_account_id, operation_name: captured.operation_name,
    original: { request_id: captured.original.request_id, document_id: captured.original.document_id,
      expected_revision: captured.original.expected_revision, expected_payload_hash: payloadHash },
  };
}
export async function recordedDocumentVersionResponse(value: unknown, input: DocumentVersionOriginal): Promise<RecordedDocumentVersion> {
  const { captured, payloadHash } = await prepareDocumentVersionOriginal(input);
  const original = captured.original, checkpoint = captured.operation_name === 'create_document_checkpoint_v2';
  const parsed = journeyResult(value, (data): data is RecordedDocumentVersion => record(data)
    && data.operation_name === captured.operation_name && data.request_id === original.request_id
    && data.document_id === original.document_id && data.payload_hash === payloadHash
    && data.revision === original.expected_revision + (checkpoint ? 0 : 1)
    && uuid(data.version_id) && (checkpoint ? data.pre_restore_version_id === null
      : data.version_id === (original as RestoreDocument).version_id && uuid(data.pre_restore_version_id))
    && typeof data.retry_expires_at === 'string' && Number.isFinite(Date.parse(data.retry_expires_at)));
  if (parsed.outcome !== 'ready' || !parsed.data || !integer(parsed.data.revision)) fail(true);
  return parsed.data;
}
export async function documentVersionClosureResponse(value: unknown, input: DocumentVersionOriginal): Promise<DocumentVersionClosure> {
  const { captured, payloadHash } = await prepareDocumentVersionOriginal(input);
  const parsed = journeyResult(value, (data): data is DocumentVersionClosure => record(data)
    && data.request_id === captured.original.request_id && data.document_id === captured.original.document_id
    && data.payload_hash === payloadHash && ['closed', 'recorded', 'expired'].includes(String(data.outcome)));
  if (parsed.outcome !== 'ready' || !parsed.data) fail(true);
  return parsed.data;
}
export class DocumentVersionOriginalClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async check(input: DocumentVersionOriginal) {
    const captured = documentVersionOriginal(input);
    const value = await this.client.request('/api/v1/journey/get_document_version_original_v1?'
      + new URLSearchParams({ arguments: JSON.stringify(await documentVersionOriginalRead(captured)) }));
    return recordedDocumentVersionResponse(value, captured);
  }
  async close(input: DocumentVersionOriginal, confirmClose: true) {
    if (confirmClose !== true) fail();
    const captured = documentVersionOriginal(input);
    const value = await this.client.request('/api/v1/journey/close_document_version_original_v1',
      { method: 'POST', body: { ...captured, confirm_close: true } });
    return documentVersionClosureResponse(value, captured);
  }
}
