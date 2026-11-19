import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, publicEncrypt, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError, decryptApiKeyDelivery, apiKeyAttributeFile, MAX_API_KEY_ATTRIBUTES_BYTES, record, type ApiKeyCreationReviewInput, type ApiKeyDelivery, type ApiKeyIssue, type ApiKeyFileReviewInput, type ApiKeyFileIssue } from '../../client/src/index.ts';
import { keyCreationInput, keyFileCreationInput } from '../../client/src/key-delivery.ts';
import { credentialBytes, credentialJSON, newCredentialFile, requireNewCredentialFile } from './credential-files.ts';
import { inputJSON } from './input.ts';

export const keyIssuanceOptions: Record<string, string[]> = {
  'api-keys prepare-recipient': ['file', 'output', 'confirm'],
  'api-keys prepare-file-recipient': ['account', 'file', 'output', 'confirm'],
  'api-keys recipient': ['recipient-file'],
  'api-keys review-create': ['recipient-file', 'output'],
  'api-keys review-file-create': ['recipient-file', 'attributes-file', 'output'],
  'api-keys issue': ['file', 'recipient-file', 'confirm'],
  'api-keys issue-file': ['file', 'recipient-file', 'attributes-file', 'confirm'],
  'api-keys check-delivery': ['file'],
  'api-keys receive': ['file', 'recipient-file', 'output', 'confirm'],
  'api-keys acknowledge': ['file', 'recipient-file', 'secret-file', 'confirm'],
  'api-keys close-create': ['file', 'confirm'],
};
type Options = Record<string, string | boolean | undefined>;
type ReviewInput = ApiKeyCreationReviewInput | ApiKeyFileReviewInput;
type Original = ApiKeyIssue | ApiKeyFileIssue;
type Recipient = { version: 1 | 2; origin: string; review_input: ReviewInput; recipient_fingerprint: string; private_pkcs8: string };
function exact(value: unknown, fields: string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === fields.length && Object.keys(value).every(field => fields.includes(field));
}
function summary(value: ApiKeyDelivery) { const { sealed_jwe: _encrypted, ...metadata } = value; return metadata; }
function consent(options: Options, expected: string) { if (options.confirm !== expected) throw new JobHuntError('confirmation_required'); }
function reviewed(value: Original): ReviewInput {
  const common = { expected_account_id: value.expected_account_id, request_id: value.request_id, recipient_public_key: value.recipient_public_key };
  return 'attributes' in value ? { ...common, attributes: value.attributes } : { ...common, source_size: value.source_size, source_sha256: value.source_sha256 };
}
function parseOriginal(value: unknown): Original {
  return record(value) && 'source_sha256' in value ? keyFileCreationInput(value, true) as ApiKeyFileIssue : keyCreationInput(value, true) as ApiKeyIssue;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
async function recipientFile(path: unknown, origin: string): Promise<Recipient> {
  const saved = await credentialJSON(path);
  try {
    if (!exact(saved, ['version', 'origin', 'review_input', 'recipient_fingerprint', 'private_pkcs8']) || saved.version !== 1 && saved.version !== 2 || saved.origin !== origin ||
      typeof saved.private_pkcs8 !== 'string' || saved.private_pkcs8.length > 8192 || typeof saved.recipient_fingerprint !== 'string') throw new Error();
    const input = saved.version === 1 ? keyCreationInput(saved.review_input) as ApiKeyCreationReviewInput : keyFileCreationInput(saved.review_input) as ApiKeyFileReviewInput;
    const privateKey = createPrivateKey(saved.private_pkcs8), publicKey = createPublicKey(privateKey);
    if (privateKey.asymmetricKeyType !== 'rsa' || ![3072, 4096].includes(privateKey.asymmetricKeyDetails?.modulusLength ?? 0) || privateKey.asymmetricKeyDetails?.publicExponent !== 65537n) throw new Error();
    const der = publicKey.export({ type: 'spki', format: 'der' });
    if (der.toString('base64url') !== input.recipient_public_key || createHash('sha256').update(der).digest('hex') !== saved.recipient_fingerprint) throw new Error();
    const challenge = randomBytes(32), cipher = publicEncrypt({ key: publicKey, oaepHash: 'sha256' }, challenge);
    if (!timingSafeEqual(privateDecrypt({ key: privateKey, oaepHash: 'sha256' }, cipher), challenge)) throw new Error();
    return saved as unknown as Recipient;
  } catch { throw new JobHuntError('invalid_credential_recipient'); }
}
async function originalFile(path: unknown): Promise<Original> {
  return parseOriginal(await credentialJSON(path));
}
async function originalAndRecipient(options: Options, origin: string) {
  const original = await originalFile(options.file), recipient = await recipientFile(options['recipient-file'], origin);
  if (canonical(reviewed(original)) !== canonical(recipient.review_input)) throw new JobHuntError('credential_recipient_mismatch');
  return { original, recipient };
}

/** Entirely local: no auth store, network, default keychain or secret stdout. */
export async function prepareKeyRecipient(options: Options, origin: string, stdin: Readable) {
  const plan = await inputJSON(options.file as string | undefined, stdin, 524288);
  if (!exact(plan, ['expected_account_id', 'attributes']) || typeof plan.expected_account_id !== 'string') throw new JobHuntError('invalid_input');
  consent(options, plan.expected_account_id);
  return retainRecipient(options, origin, 1, publicKey => keyCreationInput({ expected_account_id: plan.expected_account_id,
    attributes: plan.attributes, request_id: randomUUID(), recipient_public_key: publicKey }) as ApiKeyCreationReviewInput);
}

export async function prepareFileKeyRecipient(options: Options, origin: string) {
  if (typeof options.account !== 'string') throw new JobHuntError('invalid_input');
  consent(options, options.account);
  const metadata = await apiKeyAttributeFile(await credentialBytes(options.file, MAX_API_KEY_ATTRIBUTES_BYTES));
  return retainRecipient(options, origin, 2, publicKey => keyFileCreationInput({ expected_account_id: options.account,
    ...metadata, request_id: randomUUID(), recipient_public_key: publicKey }) as ApiKeyFileReviewInput);
}

async function retainRecipient(options: Options, origin: string, version: 1 | 2, input: (publicKey: string) => ReviewInput) {
  await requireNewCredentialFile(options.output);
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicExponent: 65537 });
  const publicDER = keys.publicKey.export({ format: 'der', type: 'spki' });
  const review_input = input(publicDER.toString('base64url'));
  const recipient: Recipient = { version, origin, review_input, recipient_fingerprint: createHash('sha256').update(publicDER).digest('hex'),
    private_pkcs8: keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString() };
  await newCredentialFile(options.output, Buffer.from(JSON.stringify(recipient)));
  // Read back through the same strict authority/permission and pair checks used
  // before issuance. A failure sends no request and never creates a second file.
  await recipientFile(options.output, origin);
  return { prepared: true, account_id: review_input.expected_account_id, request_id: review_input.request_id,
    recipient_fingerprint: recipient.recipient_fingerprint };
}

/** Public request only, suitable for a separate authorized MCP connection. */
export async function publicKeyRecipient(options: Options, origin: string) {
  return (await recipientFile(options['recipient-file'], origin)).review_input;
}

export async function keyIssuanceCommand(command: string, options: Options, client: JobHuntClient, stdin: Readable) {
  if (command === 'api-keys review-create' || command === 'api-keys review-file-create') {
    await requireNewCredentialFile(options.output);
    const recipient = await recipientFile(options['recipient-file'], client.origin);
    const file = command === 'api-keys review-file-create';
    if (recipient.version !== (file ? 2 : 1)) throw new JobHuntError('invalid_input');
    const reviewed = file
      ? await client.apiKeys.issuance.reviewFile(recipient.review_input as ApiKeyFileReviewInput, await credentialBytes(options['attributes-file'], MAX_API_KEY_ATTRIBUTES_BYTES))
      : await client.apiKeys.issuance.review(recipient.review_input as ApiKeyCreationReviewInput);
    if (!reviewed.data || reviewed.data.recipient_fingerprint !== recipient.recipient_fingerprint) throw new JobHuntError('invalid_response');
    const original: Original = { ...recipient.review_input, review_token: reviewed.data.review_token, confirm_create: true };
    await newCredentialFile(options.output, Buffer.from(JSON.stringify(original)));
    return { reviewed: true, account_id: original.expected_account_id, request_id: original.request_id,
      recipient_fingerprint: recipient.recipient_fingerprint, active_quota_used: reviewed.data.active_quota_used,
      active_quota_limit: reviewed.data.active_quota_limit, expires_at: reviewed.data.expires_at };
  }
  if (command === 'api-keys check-delivery') {
    const value = await inputJSON(options.file as string | undefined, stdin, 1048576);
    const hasOriginal = record(value) && ('attributes' in value || 'source_sha256' in value);
    const locator = hasOriginal ? reviewed(parseOriginal(value)) : value;
    if (!record(locator)) throw new JobHuntError('invalid_input');
    const read = hasOriginal ? { expected_account_id: locator.expected_account_id, request_id: locator.request_id } : locator;
    const result = await client.apiKeys.issuance.get(read as Parameters<typeof client.apiKeys.issuance.get>[0]);
    if (!result.data) throw new JobHuntError('invalid_response');
    return { ...result, data: summary(result.data) };
  }
  if (command === 'api-keys close-create') {
    const original = await originalFile(options.file); consent(options, original.expected_account_id);
    return 'attributes' in original ? client.apiKeys.issuance.close({ original, confirm_close: true }) : client.apiKeys.issuance.closeFile({ original, confirm_close: true });
  }
  const { original, recipient } = await originalAndRecipient(options, client.origin);
  if (command === 'api-keys issue' || command === 'api-keys issue-file') {
    consent(options, original.expected_account_id);
    const file = command === 'api-keys issue-file';
    if (file === ('attributes' in original)) throw new JobHuntError('invalid_input');
    const result = file
      ? await client.apiKeys.issuance.issueFile(original as ApiKeyFileIssue, await credentialBytes(options['attributes-file'], MAX_API_KEY_ATTRIBUTES_BYTES))
      : await client.apiKeys.issuance.issue(original as ApiKeyIssue);
    if (!result.data || result.data.recipient_fingerprint !== recipient.recipient_fingerprint) throw new JobHuntError('invalid_response');
    return { ...result, data: summary(result.data) };
  }
  if (!['api-keys receive', 'api-keys acknowledge'].includes(command)) throw new JobHuntError('usage_error');
  if (command === 'api-keys receive') await requireNewCredentialFile(options.output);
  const result = await client.apiKeys.issuance.get({ expected_account_id: original.expected_account_id, request_id: original.request_id });
  if (!result.data || result.data.recipient_fingerprint !== recipient.recipient_fingerprint) throw new JobHuntError('invalid_response');
  consent(options, result.data.key_id);
  if (command === 'api-keys acknowledge' && result.data.state === 'acknowledged') return { ...summary(result.data), already_acknowledged: true, local_file_verified: false };
  if (result.data.state !== 'available') throw new JobHuntError('api_key_delivery_unavailable', 410);
  const privateKey = createPrivateKey(recipient.private_pkcs8);
  const der = privateKey.export({ format: 'der', type: 'pkcs8' });
  const localKey = await crypto.subtle.importKey('pkcs8', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  const secret = Buffer.from(await decryptApiKeyDelivery(result.data, { expected_account_id: original.expected_account_id,
    request_id: original.request_id, key_id: result.data.key_id }, localKey));
  if (command === 'api-keys receive') {
    await newCredentialFile(options.output, Buffer.concat([secret, Buffer.from('\n')]));
    const retained = await credentialBytes(options.output, 128);
    if (!retained.equals(Buffer.concat([secret, Buffer.from('\n')]))) throw new JobHuntError('credential_file_changed');
    return { ...summary(result.data), saved: true, acknowledged: false };
  }
  const retained = await credentialBytes(options['secret-file'], 128);
  const bytes = retained.at(-1) === 10 ? retained.subarray(0, -1) : retained;
  if (bytes.length !== secret.length || !timingSafeEqual(bytes, secret)) throw new JobHuntError('credential_file_mismatch');
  const acknowledged = await client.apiKeys.issuance.acknowledge({ expected_account_id: original.expected_account_id,
    request_id: original.request_id, recipient_fingerprint: recipient.recipient_fingerprint, confirm_received: true });
  if (!acknowledged.data || acknowledged.data.key_id !== result.data.key_id) throw new JobHuntError('invalid_response');
  return { ...summary(acknowledged.data), local_file_verified: true };
}
